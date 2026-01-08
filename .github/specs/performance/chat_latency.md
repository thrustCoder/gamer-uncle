# Chat Latency Optimization Spec

> **Goal**: Reduce chat response time from 6-12 seconds to 2-4 seconds for most queries.

## Current Architecture Flow

### Text Chat Flow (Mobile → API → Response)
```
Mobile App (ChatScreen)
    ↓ POST /api/recommendations
API (RecommendationsController)
    ↓
AgentServiceClient.GetRecommendationsAsync()
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 1: ExtractGameCriteriaViaAgent()               │ ⬅️ AI CALL #1
│   - Creates agent thread                            │
│   - Sends prompt to extract query criteria          │
│   - Polls for response (500ms intervals × ~60)      │
│   - Parses JSON criteria                            │
├─────────────────────────────────────────────────────┤
│ Step 2: CosmosDbService.QueryGamesAsync()           │ ⬅️ COSMOS CALL
│   - Only if criteria found                          │
│   - Builds dynamic SQL query                        │
│   - Returns matching games for RAG context          │
├─────────────────────────────────────────────────────┤
│ Step 3: RunAgentWithMessagesAsync()                 │ ⬅️ AI CALL #2
│   - Creates/retrieves thread                        │
│   - Sends RAG context + user query                  │
│   - Polls for response (500ms × ~60)                │
│   - Up to 2 retries for low-quality responses       │
└─────────────────────────────────────────────────────┘
```

### Voice Flow (Additional latency on top of text)
```
Mobile App → /api/voice/process
    ↓ Step 1: Speech-to-Text (STT)
    ↓ Step 2: GetRecommendationsAsync() [same as above]
    ↓ Step 3: Text-to-Speech (TTS)
```

---

## Identified Latency Bottlenecks

| Bottleneck | Impact | Estimated Latency |
|------------|--------|-------------------|
| **Two AI Agent Calls** | HIGH | 2-6+ seconds each |
| Criteria extraction call #1 | | 2-4s |
| Main response call #2 | | 2-4s |
| Low-quality response retries (up to 2) | | +2-6s each |
| **500ms Polling Interval** | MEDIUM | Adds up to 500ms unnecessary wait |
| **Cosmos DB Query** | LOW-MEDIUM | 50-200ms |
| **Thread Management** | LOW | 100-300ms per operation |

---

## Optimization Tracking

### Option A: Keep Two-AI-Call Architecture (Lower Risk)

*Ranked by latency savings (highest ROI first):*

| # | Optimization | Latency Savings | Applies To | Complexity | Status |
|---|--------------|-----------------|------------|------------|--------|
| A1 | [Criteria Extraction Caching](#a1-criteria-extraction-caching) | **2-4s** | Repeat queries | Low | ✅ Done |
| A2 | [Response Streaming](#a2-response-streaming) | **~3s perceived** | All queries | Medium | ⬜ Not Started |
| A3 | [Smaller Model for Criteria](#a3-smaller-model-for-criteria) | **1-2s** | All queries | Medium | ✅ Done |
| A4 | [Adaptive Polling Interval](#a4-adaptive-polling-interval) | **400-800ms** | All queries | Low | ✅ Done |
| A5 | [Parallel Cosmos + Top Games Prefetch](#a5-parallel-cosmos--top-games-prefetch) | 100-300ms | All queries | Low | ⬜ Not Started |
| A6 | [Thread Pool Warmup](#a6-thread-pool-warmup) | 100-300ms | Cold starts only | Low | ⬜ Not Started |
| A7 | [Cosmos Result Caching](#a7-cosmos-result-caching) | 50-150ms | Repeat criteria | Low | ⬜ Not Started |

### Option B: Modify Architecture (Higher Impact)

| # | Optimization | Latency Savings | Complexity | Status |
|---|--------------|-----------------|------------|--------|
| B1 | [Fast Path for Non-RAG Queries](#b1-fast-path-for-non-rag-queries) | 2-4s (40% queries) | Low-Medium | ⬜ Not Started |

**Status Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Done | ❌ Blocked

---

## Selected Approach: Option A (Keep Two-AI-Call Architecture)

**Rationale**: Lower risk, preserves existing behavior, cumulative gains can achieve target latency.

---

## Optimization Details

### Archived: Option B Architecture Change

#### 1. Fast Path for Non-RAG Queries

> **Note**: This section is kept for reference. We selected **Option A** (keep two-AI-call architecture).

**Problem**: Every query makes an AI call (`ExtractGameCriteriaViaAgent`) just to determine if Cosmos is needed, even for questions that clearly don't need database lookup.

**Current Behavior** (already partially optimized):
- ✅ Cosmos call IS gated by criteria - if AI returns empty criteria, Cosmos is skipped
- ❌ But AI Call #1 ALWAYS runs, even for strategy/rules questions
- ❌ AI often extracts criteria even when not useful (e.g., "How to win at Catan" → `{name: "Catan"}` → triggers unnecessary Cosmos lookup)

**Current Code** (`AgentServiceClient.cs:70-98`):
```csharp
// Step 1: ALWAYS calls AI to extract criteria
var criteria = await ExtractGameCriteriaViaAgent(userInput, threadId);

// Step 2: Cosmos only called if criteria has values
if (criteria == null || (/* all fields empty */))
{
    // No RAG - but we still wasted time on AI Call #1!
    matchingGames = new List<GameDocument>();
    messages = new[] { new { role = "user", content = userInput } }.ToList<object>();
}
else
{
    // RAG path - Cosmos called here
    var queryResults = await _cosmosDbService.QueryGamesAsync(criteria);
    // ...
}
```

**Solution**: Use fast local classification to skip AI Call #1 entirely for non-RAG queries:

```csharp
public async Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null)
{
    // FAST: Local classification (microseconds, no AI call)
    var intent = ClassifyQueryIntent(userInput);
    
    if (intent == QueryIntent.DirectAI)
    {
        // FAST PATH: Skip criteria extraction AND Cosmos - single AI call
        _telemetryClient?.TrackEvent("AgentRequest.FastPath", new Dictionary<string, string>
        {
            ["UserInput"] = userInput
        });
        return await GetDirectAIResponseAsync(userInput, threadId);
    }
    else
    {
        // RAG PATH: Keep existing two-call approach
        return await GetRAGResponseAsync(userInput, threadId);
    }
}

private QueryIntent ClassifyQueryIntent(string userInput)
{
    var input = userInput.ToLowerInvariant();
    
    // Queries that DON'T need RAG (skip AI Call #1 + Cosmos)
    var nonRagPatterns = new[]
    {
        @"how (do|to|can) (i|you|we)",      // Strategy: "How do I win at..."
        @"strategy|strategies|tips?|trick",  // Strategy keywords
        @"win|winning|beat",                 // Winning strategies
        @"rules?|how.*play",                 // Rules questions
        @"what (is|are|makes)",              // General knowledge
        @"explain|define",                   // Definitions
        @"difference|compare|versus|vs\.?",  // Comparisons
    };
    
    // Queries that NEED RAG (keep current two-call flow)
    var ragPatterns = new[]
    {
        @"\d+\s*(-|to)\s*\d+\s*player",      // "2-4 players"
        @"\d+\s*player",                      // "4 players"
        @"\d+\s*(min|minute|hour)",           // "30 minutes"
        @"(light|medium|heavy)\s*weight",
        @"recommend|suggest|find|looking for",
        @"(worker|deck|tile|dice)\s*placement|building",
        @"family|kids|children|beginner",
    };
    
    foreach (var pattern in nonRagPatterns)
        if (Regex.IsMatch(input, pattern))
            return QueryIntent.DirectAI;
            
    foreach (var pattern in ragPatterns)
        if (Regex.IsMatch(input, pattern))
            return QueryIntent.NeedsRAG;
    
    return QueryIntent.NeedsRAG; // Default: use RAG for safety
}

private async Task<AgentResponse> GetDirectAIResponseAsync(string userInput, string? threadId)
{
    var messages = new[]
    {
        new { role = "system", content = GAMER_UNCLE_SYSTEM_PROMPT },
        new { role = "user", content = userInput }
    };
    
    var (response, newThreadId) = await RunAgentWithMessagesAsync(new { messages }, threadId);
    
    return new AgentResponse
    {
        ResponseText = response ?? "Let me think about that...",
        ThreadId = newThreadId,
        MatchingGamesCount = 0
    };
}
```

**Files to Modify**:
- `services/api/Services/AgentService/AgentServiceClient.cs`
- New: `services/api/Services/AgentService/QueryIntentClassifier.cs` (optional, can inline)

**Estimated Savings**: 2-4 seconds on ~40% of queries (eliminates AI Call #1)

**Query Examples**:

| Query | Current Flow | With Fast Path |
|-------|--------------|----------------|
| "How do I win at Catan?" | AI #1 → Cosmos → AI #2 | **AI #2 only** |
| "What's the difference between Euros and Ameritrash?" | AI #1 → (no Cosmos) → AI #2 | **AI #2 only** |
| "Recommend a game for 4 players" | AI #1 → Cosmos → AI #2 | AI #1 → Cosmos → AI #2 (same) |

---

### A1. Criteria Extraction Caching

**Problem**: Users often ask similar or identical questions. AI Call #1 (criteria extraction) produces the same results for semantically equivalent queries.

**Solution**: Cache criteria extraction results keyed by normalized query:

```csharp
public class CachedCriteriaExtractor
{
    private readonly IMemoryCache _cache;
    private readonly AgentServiceClient _inner;
    
    public async Task<GameQueryCriteria?> ExtractCriteriaAsync(string userInput, string? threadId)
    {
        var normalizedKey = NormalizeQuery(userInput);
        var cacheKey = $"criteria:{normalizedKey}";
        
        return await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            entry.SlidingExpiration = TimeSpan.FromMinutes(10);
            
            _telemetryClient.TrackEvent("CriteriaCacheMiss", new Dictionary<string, string>
            {
                ["Query"] = userInput
            });
            
            return await _inner.ExtractGameCriteriaViaAgent(userInput, threadId);
        });
    }
    
    private string NormalizeQuery(string query)
    {
        // Lowercase, remove extra whitespace, sort words for "4 player games" == "games for 4 players"
        var words = query.ToLowerInvariant()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .OrderBy(w => w);
        return string.Join(" ", words);
    }
}
```

**Files to Modify**:
- `services/api/Services/AgentService/AgentServiceClient.cs`
- `services/api/Program.cs` (register IMemoryCache)

**Estimated Savings**: **2-4 seconds** on cache hits (skips entire AI Call #1)

**Why This Works with Two Calls**: This is the BIGGEST win for keeping two calls - if we cache criteria extraction, repeat queries skip AI Call #1 entirely while keeping the architecture unchanged.

---

### A2. Response Streaming

**Problem**: User waits for complete response before seeing anything. Even with two AI calls, we can stream the second (response) call.

**Solution**: Stream AI Call #2 tokens to mobile app as they arrive:

**API Changes**:
```csharp
[HttpPost("stream")]
public async IAsyncEnumerable<string> RecommendGameStream(
    [FromBody] UserQuery query,
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    // AI Call #1 runs normally (criteria extraction) - non-streamed
    var criteria = await _agentService.ExtractCriteriaAsync(query.Query);
    var games = await _cosmosDbService.QueryGamesAsync(criteria);
    
    // AI Call #2 streams to client
    await foreach (var chunk in _agentService.GetRecommendationsStreamAsync(
        query.Query, games, query.ConversationId, cancellationToken))
    {
        yield return chunk;
    }
}
```

**Mobile Changes**:
```typescript
const streamResponse = async (query: string, onChunk: (text: string) => void) => {
  const response = await fetch(`${API_URL}/recommendations/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
};
```

**Files to Modify**:
- `services/api/Controllers/GameRecommendationController.cs`
- `services/api/Services/AgentService/AgentServiceClient.cs`
- `services/shared/models/IAgentServiceClient.cs`
- `apps/mobile/services/ApiClient.ts`
- `apps/mobile/screens/ChatScreen.tsx`

**Perceived Improvement**: User waits 2-4s (AI #1 + Cosmos), then sees tokens stream immediately

**Why This Works with Two Calls**: We can't easily stream AI Call #1 (we need the complete JSON), but AI Call #2 generates the user-facing response and CAN be streamed.

---

### A3. Smaller Model for Criteria

**Problem**: Using GPT-4 for simple JSON extraction is overkill.

**Solution**: Use a smaller, faster model (GPT-3.5-turbo or GPT-4-mini) for AI Call #1:

```csharp
public class AgentServiceClient
{
    private readonly string _criteriaAgentId;  // GPT-3.5-turbo agent
    private readonly string _responseAgentId;  // GPT-4 agent (existing)
    
    private async Task<GameQueryCriteria?> ExtractGameCriteriaViaAgent(string userInput, string? threadId)
    {
        // Use faster model for criteria extraction
        var agent = await _agentsClient.GetAgentAsync(_criteriaAgentId);
        // ... rest of logic
    }
}
```

**Configuration**:
```json
{
  "AgentService": {
    "CriteriaAgentId": "asst_criteria_fast",  // GPT-3.5-turbo
    "ResponseAgentId": "asst_gamer_uncle"     // GPT-4 (existing)
  }
}
```

**Files to Modify**:
- `services/api/Services/AgentService/AgentServiceClient.cs`
- `services/api/appsettings.json`
- Azure AI Foundry: Create new agent with faster model

**Estimated Savings**: 1-2s (GPT-3.5 is ~3-4x faster than GPT-4 for simple tasks)

---

### A4. Adaptive Polling Interval

**Problem**: Fixed 500ms polling interval wastes time on fast responses. Since we make TWO AI calls, this waste is doubled.

**Current Code** (`AgentServiceClient.cs:358`):
```csharp
await Task.Delay(500); // 500ms between polls - called in BOTH AI calls
```

**Solution**: Start with fast polling, slow down over time:

```csharp
private static readonly int[] PollDelays = { 50, 100, 150, 200, 300, 400, 500 };

private async Task<Run> WaitForRunCompletionAsync(AgentThread thread, ThreadRun run, int maxIterations = 60)
{
    int pollIndex = 0;
    do
    {
        await Task.Delay(PollDelays[Math.Min(pollIndex++, PollDelays.Length - 1)]);
        run = _agentsClient.Runs.GetRun(thread.Id, run.Id);
    } while ((run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress) 
             && pollIndex < maxIterations);
    return run;
}
```

**Files to Modify**:
- `services/api/Services/AgentService/AgentServiceClient.cs` (two polling locations)

**Estimated Savings**: 200-400ms per AI call × 2 calls = **400-800ms total**

**Why This Works with Two Calls**: Both criteria extraction (AI #1) and response generation (AI #2) use the same polling loop. Improving it benefits both calls.

---

### A5. Parallel Cosmos + Top Games Prefetch

**Problem**: Cosmos query waits for criteria extraction to complete.

**Solution**: Pre-fetch top games in parallel with criteria extraction:

```csharp
public async Task<AgentResponse> GetRecommendationsAsync(string userInput, string? threadId = null)
{
    // Start both in parallel
    var criteriaTask = ExtractGameCriteriaViaAgent(userInput, threadId);
    var defaultGamesTask = _cosmosDbService.GetTopRatedGamesAsync(20);

    var criteria = await criteriaTask;
    
    IEnumerable<GameDocument> games;
    if (criteria == null || criteria.IsEmpty())
    {
        // No specific criteria - use pre-fetched top games
        games = await defaultGamesTask;
    }
    else
    {
        // Specific criteria - query Cosmos (defaultGamesTask result discarded)
        games = await _cosmosDbService.QueryGamesAsync(criteria);
    }
    
    // Continue with AI Call #2...
}
```

**Files to Modify**:
- `services/api/Services/AgentService/AgentServiceClient.cs`
- `services/api/Services/Cosmos/CosmosDbService.cs` (add `GetTopRatedGamesAsync`)
- `services/api/Services/Interfaces/ICosmosDbService.cs`

**Estimated Savings**: 100-300ms (Cosmos runs in parallel with AI Call #1)

---

### A6. Thread Pool Warmup

**Problem**: First request of the day has cold-start latency for AI agent threads.

**Solution**: Pre-create agent threads on application startup:

```csharp
public class AgentThreadWarmupService : IHostedService
{
    private readonly IAgentServiceClient _agentService;
    
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Pre-warm thread pool with 5 threads
        var warmupTasks = Enumerable.Range(0, 5).Select(_ => 
            _agentService.CreateWarmThreadAsync());
        
        await Task.WhenAll(warmupTasks);
        _logger.LogInformation("Pre-warmed {Count} agent threads", 5);
    }
}
```

**Files to Modify**:
- New: `services/api/Services/AgentService/AgentThreadWarmupService.cs`
- `services/api/Program.cs` (register hosted service)

**Estimated Savings**: 100-300ms on cold requests (first request after idle period)

---

### A7. Cosmos Result Caching

**Problem**: Repeated queries for same criteria hit Cosmos every time.

**Solution**: Add in-memory caching with 15-minute TTL:

```csharp
public class CachedCosmosDbService : ICosmosDbService
{
    private readonly IMemoryCache _cache;
    private readonly CosmosDbService _inner;
    
    public async Task<IEnumerable<GameDocument>> QueryGamesAsync(GameQueryCriteria criteria)
    {
        var cacheKey = $"games:{GenerateCacheKey(criteria)}";
        
        return await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
            entry.SlidingExpiration = TimeSpan.FromMinutes(5);
            return await _inner.QueryGamesAsync(criteria);
        });
    }
    
    private string GenerateCacheKey(GameQueryCriteria c) =>
        $"{c.MinPlayers}-{c.MaxPlayers}-{c.MinPlaytime}-{c.MaxPlaytime}-" +
        $"{string.Join(",", c.Mechanics ?? Array.Empty<string>())}-" +
        $"{string.Join(",", c.Categories ?? Array.Empty<string>())}";
}
```

**Files to Modify**:
- `services/api/Services/Cosmos/CosmosDbService.cs` (or create decorator)
- `services/api/Program.cs` (register IMemoryCache)

**Estimated Savings**: 50-150ms on cache hits

---

## Option B: Architecture Change (Reference)

### B1. Fast Path for Non-RAG Queries

> **Note**: This optimization modifies the architecture by skipping AI Call #1 for certain queries.

**See full details in the [archived section](#1-fast-path-for-non-rag-queries) above.**

**Summary**: Use fast local regex classification to skip AI Call #1 entirely for queries that clearly don't need database lookup (strategy questions, rules, comparisons).

**Estimated Savings**: 2-4s on ~40% of queries

---

## Implementation Priority (Option A Selected)

*Now matches ROI ranking order (A1 = highest ROI):*

| Priority | Optimization | Impact | Effort | Reason |
|----------|--------------|--------|--------|--------|
| 🥇 1 | A1. Criteria Caching | 2-4s (repeats) | Low | Huge win for repeat queries |
| 🥈 2 | A2. Response Streaming | Perceived 3s | Medium | Best UX improvement |
| 🥉 3 | A3. Smaller Model | 1-2s | Medium | High impact on ALL queries |
| 4 | A4. Adaptive Polling | 400-800ms | Low | Quick win, benefits BOTH AI calls |
| 5 | A5. Parallel Cosmos | 100-300ms | Low | Simple async improvement |
| 6 | A6. Thread Warmup | 100-300ms (cold) | Low | Nice-to-have |
| 7 | A7. Cosmos Caching | 50-150ms | Low | Standard cache pattern |

### Cumulative Impact Estimate

Implementing A1-A4 together:

| Scenario | Before | After (Best Case) |
|----------|--------|-------------------|
| First query | 6-12s | 3-6s |
| Repeat query (cache hit) | 6-12s | 2-4s |
| With streaming | Wait 6-12s | See text in 2-4s |

**Combined savings: 3-8 seconds depending on scenario**

---
