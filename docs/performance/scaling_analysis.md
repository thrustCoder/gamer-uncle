# Scalability Analysis — Gamer Uncle Backend

> **Date**: February 17, 2026  
> **Current Users**: ~60 installs  
> **Target**: 1,000+ installs within 3 months  
> **Scope**: API Service, Azure Functions, Cosmos DB, Upstash (Redis), Azure AI Foundry

---

## Table of Contents

1. [Growth Projections](#growth-projections)
2. [Findings Summary](#findings-summary)
3. [Detailed Findings](#detailed-findings)
   - [#1 — Three Separate CosmosClient Instances (P0, 9/10)](#1-three-separate-cosmosclient-instances)
   - [#2 — In-Memory Conversation Thread Map (P0, 9/10)](#2-in-memory-conversation-thread-map)
   - [#3 — No CosmosClientOptions Configuration (P0, 8/10)](#3-no-cosmosclientoptions-configuration)
   - [#4 — No Autoscaling Rules (P1, 8/10)](#4-no-autoscaling-rules)
   - [#5 — Rate Limiting Is Per-Instance (P1, 7/10)](#5-rate-limiting-is-per-instance-not-distributed)
   - [#6 — Polly Referenced But Not Used (P1, 7/10)](#6-polly-referenced-but-not-used--no-resilience-policies)
   - [#7 — CORS Allows All Origins (P2, 4/10)](#7-cors-allows-all-origins)
   - [#8 — No Upstash Health Check (P2, 3/10)](#8-no-upstash-health-check)
4. [What's Already Well-Architected](#whats-already-well-architected)
5. [Capacity Recommendations](#capacity-recommendations)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Growth Projections

| Timeframe | Installs | Estimated DAU (15%) | Peak Concurrent |
|-----------|----------|---------------------|-----------------|
| Current   | ~60      | ~9                  | ~5              |
| Month 1   | 200–500  | 30–75               | ~20             |
| Month 3   | 1,000+   | 150+                | ~50             |

---

## Findings Summary

| # | Finding | Priority | Criticality (1-10) | Category | Effort | Implemented? |
|---|---------|----------|---------------------|----------|--------|:------------:|
| 1 | [Three separate CosmosClient instances](#1-three-separate-cosmosclient-instances) | P0 | **9** | Connection Management | 2–4 hours | ✅ Yes |
| 2 | [In-memory conversation thread map](#2-in-memory-conversation-thread-map) | P0 | **9** | Statefulness | 4–6 hours | ✅ Yes |
| 3 | [No CosmosClientOptions configuration](#3-no-cosmosclientoptions-configuration) | P0 | **8** | Connection Management | 1–2 hours | ✅ Yes |
| 4 | [No autoscaling rules](#4-no-autoscaling-rules) | P1 | **8** | Infrastructure | 2–4 hours | 🟠 No |
| 5 | [Rate limiting is per-instance](#5-rate-limiting-is-per-instance-not-distributed) | P1 | **7** | Distributed Systems | 4–8 hours | 🟠 No |
| 6 | [Polly referenced but not used](#6-polly-referenced-but-not-used--no-resilience-policies) | P1 | **7** | Resilience | 4–6 hours | 🟠 No |
| 7 | [CORS allows all origins](#7-cors-allows-all-origins) | P2 | **4** | Security | 30 min | 🟠 No |
| 8 | [No Upstash health check](#8-no-upstash-health-check) | P2 | **3** | Observability | 1–2 hours | 🟠 No |

### How to read this table

- **Priority**: P0 = fix before scaling, P1 = fix during first scaling sprint, P2 = plan for next sprint, P3 = monitor only.
- **Criticality**: 1 = cosmetic/minor, 10 = will cause outages at projected scale.
- **Implemented?**: Whether the fix has been applied to the codebase — ✅ Yes / 🟠 No.

---

## Detailed Findings

### 1. Three Separate CosmosClient Instances

| | |
|---|---|
| **Priority** | P0 |
| **Criticality** | 9/10 |
| **Implemented** | Yes (Feb 2026) |

**Location**: `services/api/Program.cs` (singleton registration), `services/api/Services/Cosmos/CosmosDbService.cs`, `services/api/Services/GameData/GameDataService.cs`, `services/api/Services/GameSearch/GameSearchService.cs`

**Problem**: Three services each create their own `CosmosClient` via `new CosmosClient(endpoint, credential)`. Each client opens its own TCP connection pool. Microsoft documentation explicitly recommends **one CosmosClient per application lifetime**.

**Impact at scale**: At 500+ concurrent users, the app will hit TCP port exhaustion, causing `SocketException` errors and cascading request failures.

**Fix**: Register a single `CosmosClient` as a Singleton in `Program.cs` and inject the `Container` into all three services. All three services now accept `Container` via constructor injection. `CosmosClientOptions` are configured with tuned connection and retry settings (see Finding #3).

---

### 2. In-Memory Conversation Thread Map

| | |
|---|---|
| **Priority** | P0 |
| **Criticality** | 9/10 |
| **Implemented** | Yes (Feb 2026) |

**Location**: `services/api/Services/AgentService/AgentServiceClient.cs:20`

**Problem**: Conversation-to-AI-thread mappings were stored in a static `ConcurrentDictionary<string, string>`. This was an in-process, volatile data structure.

**Impact at scale**:
- **App restart**: All mappings were lost — users lost conversation context mid-session.
- **Multiple instances**: Each App Service instance had its own dictionary. Load-balanced requests hitting different instances lost thread tracking.
- **No eviction**: Dictionary grew unbounded with no TTL or cleanup.

**Fix**: Introduced `IThreadMappingStore` abstraction with two implementations:
- **`RedisThreadMappingStore`**: Distributed, durable store using Upstash (already in the stack) with configurable TTL (default 2 hours). Refreshes TTL on access to keep active conversations alive. Fails silently on Redis errors (worst case: new thread created).
- **`InMemoryThreadMappingStore`**: Fallback when Redis is unavailable, with TTL-based expiry and periodic cleanup of expired entries.
- Registration in `Program.cs` auto-selects Redis-backed store when connected, otherwise falls back to in-memory.
- `AgentServiceClient` constructor now accepts `IThreadMappingStore` via DI instead of using a static dictionary.

---

### 3. No CosmosClientOptions Configuration

| | |
|---|---|
| **Priority** | P0 |
| **Criticality** | 8/10 |
| **Implemented** | Yes (Feb 2026) |

**Location**: `services/api/Program.cs` (singleton `CosmosClient` registration with `CosmosClientOptions`).

**Problem**: All `CosmosClient` instances were created with bare defaults — no `CosmosClientOptions`. This means no control over retry, connection pooling, or connection mode settings.

**Impact at scale**: Default retry settings can amplify load during Cosmos DB throttling (429s). No connection tuning means suboptimal throughput.

**Fix**: Configured `CosmosClientOptions` on the singleton `CosmosClient` with:
- `ConnectionMode = Direct` (explicit)
- `MaxRetryAttemptsOnRateLimitedRequests = 5`
- `MaxRetryWaitTimeOnRateLimitedRequests = 15s`
- `MaxRequestsPerTcpConnection = 10`
- `MaxTcpConnectionsPerEndpoint = 10`

---

### 4. No Autoscaling Rules

| | |
|---|---|
| **Priority** | P1 |
| **Criticality** | 8/10 |
| **Implemented** | No |

**Location**: Pipeline deploys to `gamer-uncle-dev-app-svc` and `gamer-uncle-prod-app-svc` with no autoscaling configuration.

**Problem**: The App Service likely runs on a single fixed instance. No autoscaling rules based on CPU, memory, or request count.

**Impact at scale**: A gaming recommendation app has bursty traffic (evenings/weekends). Peak concurrent usage of ~50 users sending AI-powered recommendation requests will overwhelm a single B1/S1 instance, resulting in 503 errors and high response latency.

**Fix**: Configure autoscaling: minimum 2 instances, maximum 4–6, scale-out at 70% CPU. Can be done via Azure portal or CLI in ~2 hours.

---

### 5. Rate Limiting Is Per-Instance (Not Distributed)

| | |
|---|---|
| **Priority** | P1 |
| **Criticality** | 7/10 |
| **Implemented** | No |

**Location**: `services/api/Program.cs` (rate limiter configuration block)

**Problem**: ASP.NET Core's built-in `AddFixedWindowLimiter` uses in-process counters. Production limits: `GameRecommendations` = 15/min, `GameSearch` = 30/min, `McpSsePolicy` = 5/5min.

**Impact at scale**: With 2+ App Service instances, each allows the full rate independently. A user could consume 2× the intended rate across 2 instances, doubling backend load on AI Foundry and Cosmos DB.

**Fix**: Use `RedisRateLimiting` NuGet package or custom Redis-backed limiter. Upstash is already in the stack.

> **Note**: This is P1 rather than P0 because it only matters once autoscaling is enabled (multiple instances). On a single instance the current setup is correct.

---

### 6. Polly Referenced But Not Used — No Resilience Policies

| | |
|---|---|
| **Priority** | P1 |
| **Criticality** | 7/10 |
| **Implemented** | No |

**Location**: `services/api/GamerUncle.Api.csproj:30` (package reference), no usage in any source files.

**Problem**: `Microsoft.Extensions.Http.Polly` is listed as a dependency but zero Polly policies are configured. No timeout, retry, or circuit breaker on:
- Azure AI Agent calls (slowest path, most failure-prone)
- Upstash (Redis) operations
- External HTTP calls

**Impact at scale**: A slow AI Foundry response at 500+ users ties up request threads with no timeout. A transient Upstash failure cascades without circuit breaking. A brief Cosmos DB outage produces uncontrolled retry storms.

**Fix**: Add Polly policies: timeout (30s) + retry (2 attempts with exponential backoff) on AI calls, circuit breaker on Upstash operations.

---

### 7. CORS Allows All Origins

| | |
|---|---|
| **Priority** | P2 |
| **Criticality** | 4/10 |
| **Implemented** | No |

**Location**: `services/api/Program.cs` — `.SetIsOriginAllowed(_ => true)`

**Problem**: CORS is configured to accept requests from any origin. While the API also uses app-key authentication, the open CORS policy increases attack surface.

**Impact at scale**: At 1,000+ users the app becomes a more attractive target. Combined with per-instance rate limiting, attackers could abuse the API from any origin.

**Fix**: Restrict to actual mobile app origins and known development URLs. ~30 minutes.

---

### 8. No Upstash Health Check

| | |
|---|---|
| **Priority** | P2 |
| **Criticality** | 3/10 |
| **Implemented** | No |

**Location**: `services/api/Program.cs` — health check registration block.

**Problem**: The `/health` endpoint checks Azure authentication and self-check but **not Upstash (Redis) availability**. If Upstash goes down, the app silently degrades to L1-only caching with no alerting.

**Impact at scale**: Invisible Upstash failures cause increased Cosmos DB and AI Foundry load (cache misses). Without visibility, you won't know why costs/latency spike.

**Fix**: Add an Upstash health check to the existing health endpoint. ~1–2 hours.

---

## What's Already Well-Architected

These areas are **production-ready and scale-appropriate** — no changes needed:

| Area | Details | Why It's Good |
|------|---------|---------------|
| **Two-tier caching** | L1 (Memory) + L2 (Upstash) in `CriteriaCache.cs` and `GameSearchService.cs` | Absorbs majority of repeated queries; graceful Upstash failure fallback to L1-only |
| **Cache key normalization** | Strips filler words, lowercases, sorts tokens | Great deduplication of semantically similar queries |
| **Adaptive AI polling** | Progressive intervals (50→500ms) in `AgentServiceClient.cs` | Saves 200–400ms per AI call by catching fast responses early |
| **AI quality retry** | Low-quality response detection with configurable max retries | Prevents poor UX without infinite retry loops |
| **Managed Identity** | `DefaultAzureCredential` for Cosmos DB and AI Foundry | No secrets in code; automatic credential rotation |
| **OpenTelemetry + App Insights** | Custom voice metrics + distributed tracing | Production-grade observability already in place |
| **CI/CD pipeline** | Multi-stage with parallel builds, functional tests, env promotion | Reliable, automated deployments |
| **BGG sync throttling** | 500ms between API calls, 3s between pages | Respects external rate limits; won't get IP-blocked |
| **Payload truncation** | 240K char limit on AI agent payloads | Prevents token overflow and optimizes cost |
| **Environment isolation** | Separate dev/prod Cosmos, Key Vault, AI Foundry, App Service | Clean separation; prod changes don't affect dev |

---

## Capacity Recommendations

For 1,000 installed users (~150 DAU, ~50 peak concurrent):

| Resource | Current (Estimated) | Recommended | Notes |
|----------|---------------------|-------------|-------|
| **App Service Plan** | B1 or S1, 1 instance | S2 or P1v3, 2–4 instances | Enable autoscale rules |
| **Cosmos DB** | 400 RU/s provisioned | 1,000 RU/s or autoscale (400–4,000) | `CONTAINS` queries are RU-expensive |
| **Redis** | Upstash (free/pro) | Upstash Pro (fine for now) | Monitor latency; upgrade to Azure Cache if needed |
| **AI Foundry** | GPT-4.1 + GPT-4.1-mini | **Check TPM quota** in Azure portal | #1 bottleneck at scale — hardest to engineer around |
| **Azure Functions** | Consumption plan | No change needed | Background sync only |

---

## Implementation Roadmap

### Sprint 1 — Pre-scaling (before marketing push)
- [x] **#1 + #3**: Consolidate CosmosClient to singleton with configured options
- [x] **#2**: Move conversation thread map to Upstash with TTL-based expiry
- [ ] **#4**: Configure App Service autoscaling (2 min, 4–6 max)

### Sprint 2 — Resilience hardening
- [ ] **#6**: Add Polly timeout + retry policies on AI agent calls
- [ ] **#5**: Implement Redis-backed distributed rate limiting
- [ ] **#8**: Add Upstash health check

### Sprint 3 — Operational maturity
- [ ] **#7**: Restrict CORS to production origins