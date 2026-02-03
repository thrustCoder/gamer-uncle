# Game Search Feature - Implementation Plan

## Overview

This document outlines the implementation plan for the **Game Search** feature in the Gamer Uncle mobile app. The feature allows users to search for board games using a type-ahead experience and view detailed game information.

---

## Feature Summary

When a user taps the "Game Search" icon on the landing page, they navigate to the Game Search screen. The screen features:
1. **Type-ahead search bar** - Shows game suggestions as user types (minimum 3 characters)
2. **Game details view** - Displays comprehensive game information when a selection is made
3. **Chat integration** - "Have questions?" button navigates to Chat with game context

---

## Architecture Decisions

### Security Model
**Approach: App-Secret Header + Rate Limiting (Defense in Depth)**

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| L1 | `X-GamerUncle-AppKey` header | Reject non-app requests immediately |
| L2 | Rate Limiting (30 req/min per IP) | Prevent abuse from legitimate app users |

**Implementation Details:**
- API validates `X-GamerUncle-AppKey` header on all Game Search endpoints
- Returns `401 Unauthorized` if header is missing/invalid
- App-key stored in mobile app config (not user-facing)
- Rate limiting uses existing `FixedWindowLimiter` infrastructure

### Caching Strategy
**L1 (Memory) + L2 (Upstash Redis) Caching**

| Cache Level | TTL | Purpose |
|-------------|-----|---------|
| L1 Memory | 10 minutes | Fast in-process cache for hot searches |
| L2 Redis | 30 minutes | Distributed cache across API instances |

- Cache key format: `game-search:{normalized-query}`
- Query normalization: lowercase, trimmed, first 50 chars

---

## Technical Specifications

### Search Behavior
| Parameter | Value |
|-----------|-------|
| Minimum characters | 3 |
| Maximum results | 5 |
| Search scope | Game name only |
| Debounce delay | 300ms |
| Search type | Case-insensitive prefix/contains match |

### Game Details Display
| Field | Source | Display Format |
|-------|--------|----------------|
| Name | `GameDocument.name` | As-is |
| Image | `GameDocument.imageUrl` | Thumbnail with placeholder fallback |
| Overview | `GameDocument.overview` | Markdown rendered |
| Average Rating | `GameDocument.averageRating` | 5-star scale (÷2), 1 decimal |
| BGG Rating | `GameDocument.bggRating` | 5-star scale (÷2), 1 decimal |
| Number of Votes | `GameDocument.numVotes` | Formatted with commas |
| Min Players | `GameDocument.minPlayers` | Integer |
| Max Players | `GameDocument.maxPlayers` | Integer |
| Age Requirement | `GameDocument.ageRequirement` | "{age}+" format |
| Rules Link | `GameDocument.rulesUrl` | Opens in external browser |

### Rating Display
- BGG uses 10-point scale → Convert to 5-star scale by dividing by 2
- Display as filled/partial/empty stars (e.g., ★★★★☆ for 4.0)
- Show numeric value with 1 decimal place next to stars

---

## User Experience Flows

### Flow 1: Successful Game Search
```
Landing Page → [Tap Search Icon] → Game Search Screen
→ [Type "catan"] → (300ms debounce) → API call
→ Display 5 suggestions → [Tap "Catan"]
→ Show Game Details with all fields
→ [Tap "Have questions?"] → Chat Screen with game context
```

### Flow 2: No Results Found
```
Game Search Screen → [Type "xyznonexistent"]
→ API returns empty results
→ Display friendly message: "We couldn't find a game matching your search."
→ Show button: "Want to ask Gamer Uncle?"
→ [Tap button] → Navigate to Chat Screen
```

### Flow 3: Network Error
```
Game Search Screen → [Type query] → API call fails
→ Display user-friendly error: "Oops! We're having trouble connecting. Please check your connection and try again."
→ Show retry option
```

---

## API Design

### New Endpoint: Game Search

```
GET /api/Games/search?q={query}
```

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-GamerUncle-AppKey` | Yes | App secret for client validation |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 3 chars) |

**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "bgg-13",
      "name": "Catan",
      "imageUrl": "https://...",
      "averageRating": 7.1,
      "minPlayers": 3,
      "maxPlayers": 4
    }
  ],
  "totalCount": 1
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Query must be at least 3 characters"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or missing app key"
}
```

### New Endpoint: Game Details

```
GET /api/Games/{id}
```

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-GamerUncle-AppKey` | Yes | App secret for client validation |

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Game ID (e.g., "bgg-13") |

**Response (200 OK):**
```json
{
  "id": "bgg-13",
  "name": "Catan",
  "imageUrl": "https://...",
  "overview": "Trade, build, settle...",
  "averageRating": 7.1,
  "bggRating": 7.2,
  "numVotes": 98234,
  "minPlayers": 3,
  "maxPlayers": 4,
  "ageRequirement": 10,
  "rulesUrl": "https://..."
}
```

**Response (404 Not Found):**
```json
{
  "error": "Game not found"
}
```

---

## File Changes

### Backend (services/api/)

#### New Files
| File | Purpose |
|------|---------|
| `Controllers/GamesController.cs` | New controller for game search/details endpoints |
| `Models/GameSearchRequest.cs` | Request model for search validation |
| `Models/GameSearchResponse.cs` | Response model for search results |
| `Models/GameDetailsResponse.cs` | Response model for game details |
| `Services/Interfaces/IGameSearchService.cs` | Interface for game search service |
| `Services/GameSearch/GameSearchService.cs` | Implementation with caching |
| `Services/Authentication/AppKeyAuthorizationFilter.cs` | Action filter for app-key validation |

#### Modified Files
| File | Changes |
|------|---------|
| `Program.cs` | Register new services, add rate limiting policy for Games |
| `appsettings.json` | Add `AppKey` configuration section |
| `appsettings.Development.json` | Add development app key |
| `appsettings.Production.json` | Add Key Vault reference for app key |

### Mobile App (apps/mobile/)

#### New Files
| File | Purpose |
|------|---------|
| `screens/GameSearchScreen.tsx` | Main game search screen component |
| `components/GameSearchBar.tsx` | Type-ahead search bar component |
| `components/GameSuggestionList.tsx` | Search suggestions dropdown |
| `components/GameDetailsCard.tsx` | Game details display component |
| `components/StarRating.tsx` | Reusable star rating component |
| `components/GamePlaceholder.tsx` | Placeholder image for missing game images |
| `services/GameSearchService.ts` | API client for game search |
| `styles/gameSearchStyles.ts` | Styles for game search screen |
| `hooks/useDebounce.ts` | Debounce hook for search input |

#### Modified Files
| File | Changes |
|------|---------|
| `App.tsx` | Add GameSearch screen to navigation stack |
| `screens/LandingScreen.tsx` | Update search button to navigate to GameSearch |
| `services/ApiClient.ts` | Add app-key header to all requests |
| `config/apiConfig.ts` | Add app-key configuration |
| `screens/ChatScreen.tsx` | Handle game context from navigation params |

### Shared Models (services/shared/models/)

#### New Files
| File | Purpose |
|------|---------|
| `GameSearchResult.cs` | Shared model for search results |

### Configuration

#### New Secrets (User Secrets / Key Vault)
| Secret | Environment | Purpose |
|--------|-------------|---------|
| `GameSearch:AppKey` | All | App-key for client validation |

---

## Database Considerations

### Cosmos DB Indexing
**Action Required:** Verify/add composite index on `name` field for efficient prefix searches.

```json
{
  "indexingMode": "consistent",
  "includedPaths": [
    {
      "path": "/name/*",
      "indexes": [
        {
          "kind": "Range",
          "dataType": "String",
          "precision": -1
        }
      ]
    }
  ]
}
```

**Recommended Query Pattern:**
```sql
SELECT TOP 5 c.id, c.name, c.imageUrl, c.averageRating, c.minPlayers, c.maxPlayers
FROM c 
WHERE CONTAINS(LOWER(c.name), LOWER(@searchTerm))
ORDER BY c.numVotes DESC
```

---

## Implementation Tasks

### Phase 1: Backend API ✅ COMPLETED (2026-02-02)

#### Task 1.1: App-Key Authentication ✅
- [x] Create `AppKeyAuthorizationFilter.cs` action filter
- [x] Add `GameSearch:AppKey` configuration to appsettings
- [x] Add Key Vault reference for production (dev & prod vaults)
- [x] Write unit tests for filter (7 tests passing)

#### Task 1.2: Game Search Service ✅
- [x] Create `IGameSearchService` interface
- [x] Implement `GameSearchService` with L1/L2 caching
- [x] Add Cosmos DB query for name-based search
- [x] Write unit tests for service (17 tests passing)

#### Task 1.3: Games Controller ✅
- [x] Create `GamesController` with search and details endpoints
- [x] Apply rate limiting policy
- [x] Apply app-key filter
- [x] Create request/response models
- [x] Write controller unit tests (10 tests passing)

#### Task 1.4: Rate Limiting ✅
- [x] Add `GameSearch` rate limiting policy (30 req/min)
- [x] Configure testing environment overrides

**Files Created:**
- `Controllers/GamesController.cs`
- `Models/GameSearchResponse.cs`
- `Models/GameDetailsResponse.cs`
- `Services/Interfaces/IGameSearchService.cs`
- `Services/GameSearch/GameSearchService.cs`
- `Services/Authentication/AppKeyAuthorizationFilter.cs`
- `tests/api/GamesControllerTests.cs`
- `tests/api/GameSearchServiceTests.cs`
- `tests/api/Authentication/AppKeyAuthorizationFilterTests.cs`

**Files Modified:**
- `Program.cs` - Added service registration and rate limiting
- `appsettings.json` - Added GameSearch config with Key Vault reference
- `appsettings.Development.json` - Added development app key
- `appsettings.Production.json` - Added Key Vault reference for app key
- `appsettings.Testing.json` - Added empty app key for test bypass

**Key Vault Secrets Created:**
- `gamer-uncle-dev-vault/GameSearchAppKey` ✅
- `gamer-uncle-prod-vault/GameSearchAppKey` ✅

### Phase 2: Mobile App (Estimated: 3-4 days)

#### Task 2.1: Navigation Setup
- [ ] Add `GameSearch` screen to App.tsx navigation
- [ ] Update LandingScreen search button navigation
- [ ] Update ChatScreen to accept game context params

#### Task 2.2: Search UI Components
- [ ] Create `useDebounce` hook
- [ ] Create `GameSearchBar` component
- [ ] Create `GameSuggestionList` component
- [ ] Create `GameSearchScreen` with search flow

#### Task 2.3: Game Details Components
- [ ] Create `StarRating` component (5-star display)
- [ ] Create `GamePlaceholder` component
- [ ] Create `GameDetailsCard` component
- [ ] Add external browser link handling for rules

#### Task 2.4: API Integration
- [ ] Create `GameSearchService.ts` client
- [ ] Add app-key header to ApiClient
- [ ] Handle error states and loading states

#### Task 2.5: Styling
- [ ] Create `gameSearchStyles.ts`
- [ ] Add placeholder image asset
- [ ] Follow existing app design patterns

### Phase 3: Testing (Estimated: 1-2 days)

#### Task 3.1: Backend Tests ✅ COMPLETED
- [x] Unit tests for GameSearchService (17 tests)
- [x] Unit tests for GamesController (10 tests)
- [x] Unit tests for AppKeyAuthorizationFilter (7 tests)
- [ ] Functional tests for search endpoint
- [ ] Functional tests for details endpoint

#### Task 3.2: Mobile Tests
- [ ] Unit tests for GameSearchScreen
- [ ] Unit tests for StarRating component
- [ ] E2E test for search flow
- [ ] E2E test for game details flow
- [ ] E2E test for chat navigation with context

### Phase 4: Integration & Polish (Estimated: 1 day)

#### Task 4.1: End-to-End Integration
- [ ] Verify Cosmos DB indexing
- [ ] Test caching behavior (L1 + L2)
- [ ] Test rate limiting behavior
- [ ] Test app-key rejection

#### Task 4.2: Error Handling
- [ ] Verify all error states display correctly
- [ ] Test network failure scenarios
- [ ] Test empty results scenario

---

## Chat Integration Details

### Navigation from Game Details to Chat

When user taps "Have some questions about the game?" button:

**Navigation Parameters:**
```typescript
navigation.navigate('Chat', {
  gameContext: {
    gameId: 'bgg-13',
    gameName: 'Catan',
    fromGameSearch: true
  }
});
```

**ChatScreen Behavior:**
1. Display system message: "What else do you want to know about **Catan**?"
2. Pass game context to all subsequent API calls
3. Include `gameId` and `gameName` in `UserQuery` for backend context

**Backend Enhancement:**
- Extend `UserQuery` model to include optional `GameContext` object
- Agent service uses game context for more focused responses

### Navigation from "No Results" to Chat

When user taps "Want to ask Gamer Uncle?" button:

**Navigation Parameters:**
```typescript
navigation.navigate('Chat', {
  prefillContext: {
    searchQuery: 'original search term',
    fromGameSearchNoResults: true
  }
});
```

**ChatScreen Behavior:**
1. Display system message: "I couldn't find that game in our database, but I might still be able to help! What would you like to know?"
2. Prefill input with: "Tell me about {searchQuery}"

---

## Configuration Reference

### appsettings.json (new section)
```json
{
  "GameSearch": {
    "AppKey": "", // Set via user-secrets or Key Vault
    "MaxResults": 5,
    "MinQueryLength": 3,
    "CacheKeyPrefix": "game-search"
  }
}
```

### Mobile apiConfig.ts (new)
```typescript
export const GAME_SEARCH_CONFIG = {
  minQueryLength: 3,
  maxResults: 5,
  debounceMs: 300,
  appKey: process.env.GAMER_UNCLE_APP_KEY || 'dev-key'
};
```

---

## Success Criteria

### Functional Requirements
- [ ] User can search for games with type-ahead (3+ characters)
- [ ] Search results display within 500ms of debounce
- [ ] Game details show all required fields
- [ ] Ratings display as 5-star scale
- [ ] Rules link opens in external browser
- [ ] "Have questions?" navigates to Chat with game context
- [ ] "No results" shows friendly message with Chat navigation
- [ ] Network errors display user-friendly messages

### Non-Functional Requirements
- [ ] Search API responds in < 200ms (cached), < 500ms (uncached)
- [ ] App-key validation blocks unauthorized requests
- [ ] Rate limiting prevents abuse (30 req/min per IP)
- [ ] Caching reduces Cosmos DB queries by 80%+

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| App-key extracted via reverse engineering | Medium | Defense in depth with rate limiting; monitor for abuse patterns |
| Cosmos DB query performance | Medium | Add appropriate indexing; implement caching |
| Large game database slows search | Low | Limit results to 5; use efficient query patterns |
| Clock skew if using signed requests | N/A | Not using signed requests in this implementation |

---

## Open Items

- [x] ~~Verify Cosmos DB indexing on `name` field~~ ✅ Verified 2026-02-02: Default `/*` indexing covers `name` field; no changes needed
- [x] ~~Generate and securely store production app-key in Key Vault~~ ✅ Created 2026-02-02 in both dev and prod vaults
- [ ] Add placeholder image asset to mobile app
- [ ] Determine exact styling for star rating component

---

## Appendix: Component Mockups

### Game Search Screen States

**Initial State:**
```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│     🔍 Search for a game    │
│     ┌───────────────────┐   │
│     │ Type game name... │   │
│     └───────────────────┘   │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

**With Suggestions:**
```
┌─────────────────────────────┐
│  ← Back                     │
│     ┌───────────────────┐   │
│     │ cat               │   │
│     └───────────────────┘   │
│     ┌───────────────────┐   │
│     │ 🎲 Catan          │   │
│     │ 🎲 Catan Junior   │   │
│     │ 🎲 Catan Seafarers│   │
│     │ 🎲 Cat Lady       │   │
│     │ 🎲 Catacombs      │   │
│     └───────────────────┘   │
│                             │
└─────────────────────────────┘
```

**Game Details:**
```
┌─────────────────────────────┐
│  ← Back            🔍       │
│  ┌─────────────────────┐    │
│  │    [Game Image]     │    │
│  └─────────────────────┘    │
│                             │
│  Catan                      │
│  ★★★★☆ 3.6 (98,234 votes)  │
│  BGG: ★★★★☆ 3.6            │
│                             │
│  📋 Overview                │
│  Trade, build, and settle   │
│  the island of Catan...     │
│                             │
│  👥 3-4 Players  🎂 10+     │
│                             │
│  📖 View Rules              │
│                             │
│  ┌─────────────────────┐    │
│  │ Have questions about │    │
│  │    this game?        │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**No Results:**
```
┌─────────────────────────────┐
│  ← Back                     │
│     ┌───────────────────┐   │
│     │ xyzgame           │   │
│     └───────────────────┘   │
│                             │
│     😕                      │
│     We couldn't find a      │
│     game matching your      │
│     search.                 │
│                             │
│  ┌─────────────────────┐    │
│  │ Want to ask Gamer   │    │
│  │      Uncle?         │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

*Document Version: 1.0*  
*Created: February 2, 2026*  
*Author: GitHub Copilot*
