# Azure Alerts Implementation Plan

## Implementation Progress

> **Last updated:** 2026-02-28

### Phase 0: Client Telemetry Prerequisites

| # | Task | Status | Files | Date |
|---|---|---|---|---|
| 1 | Add 6 `AnalyticsEvents` error constants | ✅ Done | [`Telemetry.ts`](apps/mobile/services/Telemetry.ts) | 2026-02-28 |
| 2 | Create `TelemetryErrorBoundary` component | ✅ Done | [`TelemetryErrorBoundary.tsx`](apps/mobile/components/TelemetryErrorBoundary.tsx) | 2026-02-28 |
| 3 | Wrap uninstrumented screens in error boundary | ✅ Done | [`App.tsx`](apps/mobile/App.tsx) — 7 screens wrapped (Dice, Timer, Turn, Team, GameSetup, ScoreTracker, ScoreInput) | 2026-02-28 |
| 4 | Replace `console.error` in GameSetupScreen with `trackEvent` | ✅ Done | [`GameSetupScreen.tsx`](apps/mobile/screens/GameSetupScreen.tsx) — API errors + empty responses | 2026-02-28 |
| 5 | Unit tests for new telemetry | ✅ Done | [`TelemetryErrorBoundary.test.tsx`](apps/mobile/__tests__/TelemetryErrorBoundary.test.tsx) (7 tests), [`Telemetry.test.ts`](apps/mobile/__tests__/Telemetry.test.ts), [`GameSetupScreen.test.tsx`](apps/mobile/__tests__/GameSetupScreen.test.tsx) — 44 tests passing | 2026-02-28 |
| 6 | Validate telemetry events in dev App Insights | ✅ Done | Confirmed `Client.Screen.Viewed`, `Client.Feature.Tapped`, `Client.Session.Started`, etc. flowing to dev App Insights. Error events (`Client.Error.*`) fire only on actual failures — pipeline verified. | 2026-02-28 |

### Phase 1: Bicep Infrastructure

| # | Task | Status | Files | Date |
|---|---|---|---|---|
| 1 | Action Group (email + Azure Mobile App) | ✅ Done | [`action-group.bicep`](infrastructure/alerts/action-group.bicep) | 2026-02-28 |
| 2 | Platform metric alerts (9 rules: #1, #9, #10, #13, #14, #18, #19, #20, #25) | ✅ Done | [`metric-alerts.bicep`](infrastructure/alerts/metric-alerts.bicep) | 2026-02-28 |
| 3 | Log-search KQL alerts (15 rules: #2–#8, #11, #12, #15, #16, #21–#24) | ✅ Done | [`log-alerts.bicep`](infrastructure/alerts/log-alerts.bicep) | 2026-02-28 |
| 4 | Dev suppression rules (06:45–09:00 UTC, alerts #1, #18, #19, #20) | ✅ Done | [`suppression-rules.bicep`](infrastructure/alerts/suppression-rules.bicep) | 2026-02-28 |
| 5 | Main orchestrator | ✅ Done | [`main.bicep`](infrastructure/alerts/main.bicep) | 2026-02-28 |

### Phase 2: Deployment

| # | Task | Status | Notes | Date |
|---|---|---|---|---|
| 1 | Add alert deployment step to `azure-pipelines.yml` | ⬜ Not started | New pipeline stage after DevDeploy | — |
| 2 | Deploy alerts #1–#21, #23, #25 to dev | ⬜ Not started | Can deploy now via `az deployment group create` — these use existing telemetry | — |
| 3 | Deploy alerts #22, #24 to dev | 🔶 Blocked | Requires Phase 0.6 (mobile deploy + event validation) | — |
| 4 | Deploy all alerts to prod | ⬜ Not started | After dev validation | — |

### Phase 3: Validation & Tuning

| # | Task | Status | Notes | Date |
|---|---|---|---|---|
| 1 | Trigger test alerts (stop health endpoint, simulate 5xx) | ⬜ Not started | Post-deployment | — |
| 2 | Confirm email + push notifications arrive | ⬜ Not started | Post-deployment | — |
| 3 | Tune thresholds based on baseline (1–2 weeks) | ⬜ Not started | Ongoing after go-live | — |
| 4 | Enable alert #17 (Session Drop-off) | ⬜ Not started | ~2 weeks after prod baseline established | — |

### Overall Progress

| Phase | Status | Progress |
|---|---|---|
| **Phase 0** — Client Telemetry | ✅ Complete | 6/6 tasks done |
| **Phase 1** — Bicep Infrastructure | ✅ Complete | 5/5 tasks done |
| **Phase 2** — Deployment | ⬜ Not started | 0/4 tasks done |
| **Phase 3** — Validation & Tuning | ⬜ Not started | 0/4 tasks done |

---

## Overview

This plan defines Azure Monitor alert rules for the Gamer Uncle application, covering the **API Service**, **Mobile Client telemetry**, and **Azure Functions (BGG Sync)**. Alerts target both **dev** and **prod** environments with environment-appropriate thresholds. Notifications route through an **Action Group** delivering Email + Azure Mobile App push notifications.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Alert source | Application Insights (custom events + metrics + logs) + Azure Monitor platform metrics | All telemetry already flows to App Insights; platform metrics cover infra |
| Notification channel | Email + Azure Mobile App push | Immediate awareness without over-engineering for a solo-dev project |
| On-call posture | Solo dev / side project | Sev1 = total outage only. Most alerts are Sev2 (next-morning) or Sev3 (weekly review) |
| Environments | Both dev and prod | Prod thresholds are tighter; dev thresholds are relaxed to avoid noise |
| Implementation | Bicep modules under `infrastructure/alerts/` | Declarative, version-controlled, deployable via existing CI/CD pipeline |

## Severity Definitions

| Severity | Meaning | Response Time | Example |
|---|---|---|---|
| **Sev1 (Critical)** | Total outage — no users can get recommendations | Same day | Health endpoint down, 100% 5xx |
| **Sev2 (Warning)** | Degraded experience — slow or poor-quality responses | Next morning | P95 latency > 10s, high fallback rate |
| **Sev3 (Informational)** | Latent issue — costs rising or early degradation signal | Weekly review | Cache hit rate drop, RU creep |

## Action Group

One shared Action Group per environment:

| Property | Dev | Prod |
|---|---|---|
| Name | `gamer-uncle-dev-alerts-ag` | `gamer-uncle-prod-alerts-ag` |
| Email | rajarshi129@gmail.com | rajarshi129@gmail.com |
| Azure Mobile App | Enabled | Enabled |
| Short name | `gu-dev-ag` | `gu-prod-ag` |

---

## Alert Rules

### Category 1: API Availability & Errors

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Health Endpoint Down** | App Service `HealthCheckStatus` metric OR Availability Test (ping `/health`) | Health check failures | Failures >= 3 consecutive | Failures >= 5 consecutive | 5 min | 1 min | **Sev1** | Most critical — the app is unreachable or crashing. Availability Test preferred for external perspective. |
| 2 | **HTTP 5xx Spike** | App Insights `requests` where `resultCode` starts with "5" | Count of 5xx responses | > 5 in window | > 10 in window | 5 min | 5 min | **Sev2** | Catches unhandled exceptions in `RecommendationsController`, `GamesController`, `VoiceController`. |
| 3 | **HTTP 429 Rate-Limit Rejections** | App Insights `requests` where `resultCode` = "429" | Count of 429 responses | > 20 in window | > 50 in window | 15 min | 5 min | **Sev3** | Indicates real users being throttled, or potential abuse. Prod limit is 15/min/IP. |

### Category 2: AI Agent Performance & Quality

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 4 | **Agent Request Duration P95** | App Insights custom metric `AgentRequest.Duration` | P95 aggregation exceeds threshold | > 12,000 ms (12s) | > 20,000 ms (20s) | 15 min | 5 min | **Sev2** | Polly timeout is set to 20s. If P95 approaches that, users are having a bad time. Tracks the full criteria-extraction + RAG + response cycle. |
| 5 | **Agent Fallback Response Rate** | App Insights custom event `AgentResponse.FallbackUsed` | Count of fallback events | > 3 in window | > 5 in window | 30 min | 15 min | **Sev2** | Fires when AI exhausts all retries and returns a code-generated fallback. Indicates Foundry quality degradation or prompt issues. |
| 6 | **Agent Transient Retry Spike** | App Insights custom event `AgentRequest.TransientRetry` | Count of transient retries | > 10 in window | > 15 in window | 15 min | 5 min | **Sev3** | Elevated 429/502/503/504 from AI Foundry. Early signal before full outages. |
| 7 | **Low-Quality Response Retry Rate** | App Insights custom event `AgentResponse.LowQualityRetry` | Count of low-quality retries | > 5 in window | > 10 in window | 30 min | 15 min | **Sev3** | The AI is returning placeholder/generic responses that need retries. May indicate agent prompt drift or model issues. |

### Category 3: Cache & Data Layer

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 8 | **Redis L2 Cache Failures** | App Insights exceptions where `customDimensions.Operation` starts with `CriteriaCache.L2` | Count of Redis exceptions | > 5 in window | > 10 in window | 15 min | 5 min | **Sev2** | Redis (Upstash) failures cause silent degradation: all traffic falls through to Cosmos DB + AI, spiking cost and latency. |
| 9 | **Cosmos DB Throttling (429s)** | Azure Monitor Cosmos DB metric `TotalRequests` filtered by StatusCode = 429 | Count of throttled requests | > 0 sustained | > 5 in window | 5 min | 5 min | **Sev2** | Any sustained Cosmos 429s means the RU budget is exhausted. Needs scaling or query optimization. |
| 10 | **Cosmos DB Normalized RU Consumption** | Azure Monitor Cosmos DB metric `NormalizedRUConsumption` | Avg % utilization | > 70% | > 85% | 15 min | 5 min | **Sev3** | Early warning before RU exhaustion. Gives time to scale up before 429s start. |

### Category 4: Voice Pipeline

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 11 | **Voice Processing Failures** | Custom OTel counter `voice.audio_failures_total` (App Insights `customMetrics`) | Sum of failures | > 3 in window | > 5 in window | 15 min | 5 min | **Sev2** | STT, Agent, or TTS step failed. Users on the voice screen get no response. |
| 12 | **Voice Pipeline Duration P95** | Custom OTel histogram `voice.total_duration_ms` (App Insights `customMetrics`) | P95 exceeds threshold | > 15,000 ms | > 25,000 ms | 15 min | 5 min | **Sev3** | Voice round-trip (STT → Agent → TTS) P95. Longer than 15s feels broken in a conversation. |

### Category 5: Azure Functions (BGG Sync)

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 13 | **Function Execution Failures** | Azure Monitor Function App metric `FunctionExecutionCount` where `Status` = "Failed" | Count of failed executions | > 0 | > 2 | 1 hour | 15 min | **Sev2** | Durable Function activities (`FetchGameDataActivity`, `UpsertGameDocumentActivity`) failing. Data freshness degrades. |
| 14 | **Function Execution Duration** | Azure Monitor Function App metric `FunctionExecutionUnits` or App Insights `requests` duration for function invocations | Avg duration anomaly | > 30,000 ms per activity | > 60,000 ms per activity | 1 hour | 15 min | **Sev3** | BGG API slowdowns or Cosmos upsert issues causing long-running activities. |

### Category 6: Client-Side Telemetry (via forwarded events)

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 15 | **Client API Error Spike** | App Insights custom event `Client.Error.Api` | Count of client API errors | > 10 in window | > 20 in window | 30 min | 15 min | **Sev2** | Mobile app encountering API failures (network errors, 5xx, timeouts). Cross-validates with server-side 5xx alert. |
| 16 | **Client Voice Error Spike** | App Insights custom event `Client.Error.Voice` | Count of client voice errors | > 5 in window | > 10 in window | 30 min | 15 min | **Sev3** | Voice feature failing on client side. May be microphone permissions, encoding, or API failures. |
| 17 | **Session Start Drop-off** | App Insights custom event `Client.Session.Started` | Count drops below baseline | < 50% of trailing 7-day average for same hour | N/A (dev only) | 1 hour | 30 min | **Sev3** | Significant drop in sessions signals app crash at startup, store removal, or connectivity issue. Prod-only (dev sessions are erratic). **Deferred to Phase 3** — requires ~2 weeks of prod session data to establish a baseline. |

### Category 8: Client Feature Health

These alerts detect issues with client-side features — both API-backed features (Game Search, Game Setup) and purely local tools (Timer, Team Randomizer, Turn Selector, Dice Roller, Score Tracker).

**Signal strategy:** All features are tracked via two automatic events:
- `Client.Feature.Tapped` — fires on the Landing page when a user taps a feature tile (includes `feature` and `target` properties)
- `Client.Screen.Viewed` — fires via `useAnalytics` when any screen renders successfully

A gap between taps and screen views (user tapped but screen never rendered) indicates a crash or navigation failure.

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 21 | **Game Search Error Spike** | App Insights custom event `Client.Error.Search` | Count of search errors | > 5 in window | > 10 in window | 30 min | 15 min | **Sev2** | Fires when the Game Search API call fails from the client's perspective. Covers network errors, 5xx, or Cosmos timeouts that hit the `GamesController`. Separate from the generic API error alert (#15) because search is a distinct user journey. |
| 22 | **Game Setup Error Rate** | App Insights custom event `Client.Error.GameSetup` | Count of game setup errors | > 3 in window | > 5 in window | 30 min | 15 min | **Sev2** | Game Setup calls the Recommendations API to generate setup instructions. Failures leave users stuck. **Requires prerequisite:** add `Error.GameSetup` telemetry — see [Telemetry Gaps](#telemetry-gaps-prerequisite-instrumentation). |
| 23 | **Feature Screen Navigation Failure** | KQL: `Client.Feature.Tapped` count vs `Client.Screen.Viewed` count per `target` screen, ratio < threshold | Tap-to-view ratio drops below threshold | Ratio < 0.7 (30%+ taps not reaching screen) for any feature | Ratio < 0.5 | 1 hour | 30 min | **Sev2** | Detects crashes or navigation failures across **all** features (Timer, Team Randomizer, Turn Selector, Dice Roller, Score Tracker, Game Search, Game Setup). If users tap a feature tile but the screen never renders, something is broken. KQL joins `Feature.Tapped` and `Screen.Viewed` by `target`/`screenName` within a time window. |
| 24 | **Tool Feature Error Spike** | App Insights custom events `Client.Error.Timer`, `Client.Error.TeamRandomizer`, `Client.Error.TurnSelector`, `Client.Error.DiceRoller`, `Client.Error.ScoreTracker` | Aggregate count of tool errors | > 3 in window | > 5 in window | 1 hour | 30 min | **Sev3** | Catches runtime errors in local-only tool features. **Requires prerequisite:** add error boundary telemetry to each tool screen — see [Telemetry Gaps](#telemetry-gaps-prerequisite-instrumentation). |

### Category 7: Infrastructure (App Service)

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 18 | **App Service CPU High** | Azure Monitor App Service Plan metric `CpuPercentage` | Avg CPU % | > 80% | > 90% | 10 min | 5 min | **Sev2** | Sustained high CPU means the B1 plan is saturated. Needs scale-up. |
| 19 | **App Service Memory High** | Azure Monitor App Service Plan metric `MemoryPercentage` | Avg Memory % | > 85% | > 90% | 10 min | 5 min | **Sev2** | Memory pressure can cause OOM restarts. |
| 20 | **App Service Response Time P95** | Azure Monitor App Service metric `HttpResponseTime` | P95 response time | > 5,000 ms | > 8,000 ms | 10 min | 5 min | **Sev2** | Platform-level latency (includes all endpoints). Broader than alert #4 which only tracks agent calls. |

### Category 9: AI Foundry Quota

| # | Alert Name | Signal / Data Source | Condition | Prod Threshold | Dev Threshold | Evaluation Window | Frequency | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 25 | **AI Foundry TPM Quota Saturation** | Azure Monitor `Microsoft.CognitiveServices` metric `TokenTransaction` on the AI Services account, aggregated per deployment | Token usage approaching quota limit | > 80% of provisioned TPM | > 80% of provisioned TPM | 15 min | 5 min | **Sev2** | When token throughput nears the provisioned TPM quota, new requests start getting throttled (429). Early warning gives time to request a quota increase or reduce traffic. Requires the AI Services resource ID for both dev and prod Foundry deployments. |

---

## Telemetry Gaps (Prerequisite Instrumentation)

Alerts #22, #23, and #24 depend on telemetry events that **do not yet exist** in several feature screens. The following screens need instrumentation before those alerts can fire:

| Screen | File | What to Add | Priority | Effort |
|---|---|---|---|---|
| `GameSetupScreen` | [screens/GameSetupScreen.tsx](apps/mobile/screens/GameSetupScreen.tsx) | Replace `console.error` with `trackEvent(AnalyticsEvents.ERROR_GAME_SETUP, ...)`. Add `Error.GameSetup` to `AnalyticsEvents`. | **High** — this screen makes API calls but has zero telemetry | ~15 min |
| `TimerScreen` | [screens/TimerScreen.tsx](apps/mobile/screens/TimerScreen.tsx) | Add try/catch error boundary with `trackEvent(AnalyticsEvents.ERROR_TIMER, ...)`. Add `Error.Timer` to `AnalyticsEvents`. | Medium — local-only, errors are rare | ~10 min |
| `TeamRandomizerScreen` | [screens/TeamRandomizerScreen.tsx](apps/mobile/screens/TeamRandomizerScreen.tsx) | Add try/catch with `trackEvent(AnalyticsEvents.ERROR_TEAM_RANDOMIZER, ...)`. Add `Error.TeamRandomizer`. | Medium | ~10 min |
| `TurnSelectorScreen` | [screens/TurnSelectorScreen.tsx](apps/mobile/screens/TurnSelectorScreen.tsx) | Add try/catch with `trackEvent(AnalyticsEvents.ERROR_TURN_SELECTOR, ...)`. Add `Error.TurnSelector`. | Medium | ~10 min |
| `DiceRollerScreen` | [screens/DiceRollerScreen.tsx](apps/mobile/screens/DiceRollerScreen.tsx) | Add try/catch with `trackEvent(AnalyticsEvents.ERROR_DICE_ROLLER, ...)`. Add `Error.DiceRoller`. | Low — simplest feature | ~10 min |
| `ScoreTrackerScreen` | [screens/ScoreTrackerScreen.tsx](apps/mobile/screens/ScoreTrackerScreen.tsx) | Add try/catch with `trackEvent(AnalyticsEvents.ERROR_SCORE_TRACKER, ...)`. Add `Error.ScoreTracker`. | Medium — has state logic for scores | ~10 min |

**Recommended approach:** Create a shared React error boundary wrapper component (`TelemetryErrorBoundary`) that wraps **each screen individually** (per-screen granularity — confirmed). This automatically fires `Client.Error.<FeatureName>` when a screen's render tree throws, avoids sprinkling try/catch in every handler, catches render-time crashes, and preserves screen-level attribution for alert #24.

**New `AnalyticsEvents` entries to add in `Telemetry.ts`:**
```typescript
// ── Feature-specific Errors ─────────────────────────────────
ERROR_GAME_SETUP: 'Error.GameSetup',
ERROR_TIMER: 'Error.Timer',
ERROR_TEAM_RANDOMIZER: 'Error.TeamRandomizer',
ERROR_TURN_SELECTOR: 'Error.TurnSelector',
ERROR_DICE_ROLLER: 'Error.DiceRoller',
ERROR_SCORE_TRACKER: 'Error.ScoreTracker',
```

**Implementation order:**
1. Add the new `AnalyticsEvents` constants to `Telemetry.ts`
2. Create `TelemetryErrorBoundary` component (wraps screens, catches errors, fires telemetry)
3. Wrap each uninstrumented screen in the error boundary in the navigation stack
4. Add explicit `trackEvent` calls for GameSetupScreen API errors (replace `console.error`)
5. Deploy and validate events appear in App Insights before enabling alerts #22–#24

---

## Summary: Alert Count by Category and Severity

| Category | Sev1 | Sev2 | Sev3 | Total |
|---|---|---|---|---|
| API Availability & Errors | 1 | 1 | 1 | 3 |
| AI Agent Performance & Quality | 0 | 2 | 2 | 4 |
| Cache & Data Layer | 0 | 2 | 1 | 3 |
| Voice Pipeline | 0 | 1 | 1 | 2 |
| Azure Functions | 0 | 1 | 1 | 2 |
| Client-Side Telemetry | 0 | 1 | 2 | 3 |
| Infrastructure | 0 | 3 | 0 | 3 |
| Client Feature Health | 0 | 3 | 1 | 4 |
| AI Foundry Quota | 0 | 1 | 0 | 1 |
| **Total** | **1** | **15** | **9** | **25** |

## Estimated Monthly Cost

Azure Monitor alert rules pricing (as of 2025):
- Metric alert rules: ~$0.10/rule/month
- Log-search (KQL) alert rules: ~$0.50/rule/month (+ $0.01 per 1000 evaluations beyond free tier)
- Dynamic threshold rules: ~$1.50/rule/month

| Alert Type | Count (per env) | Cost per Env | Notes |
|---|---|---|---|
| Platform metric alerts (#1, #9, #10, #13, #14, #18, #19, #20, #25) | 9 | ~$0.90 | Standard metric signals |
| Log-based / custom-event alerts (#2–#8, #11, #12, #15–#17, #21–#24) | 16 | ~$8.00 | KQL queries against App Insights |
| **Total per environment** | 25 | **~$8.90/mo** | |
| **Total (dev + prod)** | 50 | **~$17.80/mo** | Well within budget |

## Implementation Plan

### Phase 0: Client Telemetry Prerequisites
1. Add new `AnalyticsEvents` error constants to `Telemetry.ts` (6 new events)
2. Create `TelemetryErrorBoundary` component for automatic crash tracking
3. Wrap all uninstrumented feature screens in the error boundary
4. Replace `console.error` in `GameSetupScreen` with `trackEvent` calls
5. Deploy mobile app update and validate events appear in App Insights
6. Add unit tests for all new telemetry events

### Phase 1: Bicep Infrastructure
1. Create `infrastructure/alerts/` directory with Bicep modules
2. `action-group.bicep` — Action Group (email: rajarshi129@gmail.com + Azure Mobile App)
3. `metric-alerts.bicep` — Platform metric alert rules (9 alerts, including #25 TPM)
4. `log-alerts.bicep` — Log-search/custom-event alert rules (16 alerts, including #21–#24)
5. `suppression-rules.bicep` — Dev alert suppression rules for nightly scale-down window (see [Suppression Rules](#dev-alert-suppression-rules))
6. `main.bicep` — Orchestrator with environment parameter

### Phase 2: Deployment
1. Add alert deployment step to `azure-pipelines.yml` (post-deploy stage)
2. Deploy alerts #1–#21, #23, #25 to dev first (these use existing telemetry signals)
3. Deploy alerts #22, #24 after Phase 0 mobile update ships (prerequisite telemetry)
4. Alert #17 (Session Drop-off) deferred — enable after ~2 weeks of prod session baseline data
5. Deploy to prod after dev validation

### Phase 3: Validation & Tuning
1. Trigger test alerts (e.g., stop health endpoint, simulate 5xx)
2. Confirm email and mobile push notifications arrive
3. Tune thresholds based on baseline traffic patterns after 1-2 weeks
4. Enable alert #17 once session baseline is established (~2 weeks post-prod deploy)

## Dev Alert Suppression Rules

The dev App Service Plan is scaled down to F1 (free) nightly at **07:00 UTC (11:00 PM PT)** via the [dev-scaledown-schedule.yml](pipelines/dev-scaledown-schedule.yml) pipeline. During and after scale-down, the following dev alerts would fire spuriously:

| Alert # | Alert Name | Why it fires during scale-down |
|---|---|---|
| 1 | Health Endpoint Down | F1 tier has cold-start delays; `/health` may timeout |
| 18 | App Service CPU High | CPU spike during scale transition |
| 19 | App Service Memory High | Memory spike during plan migration |
| 20 | App Service Response Time P95 | Elevated latency on F1 tier |

**Suppression rule configuration (dev only):**

| Property | Value |
|---|---|
| Name | `gamer-uncle-dev-scaledown-suppression` |
| Scope | Dev App Service resource + Dev App Service Plan |
| Suppressed alerts | #1, #18, #19, #20 (dev rules only) |
| Schedule | Daily recurrence |
| Start time | 06:45 UTC (15 min before scale-down, covers pipeline delay) |
| End time | 09:00 UTC (allows ~2 hours for next-morning manual scale-up) |
| Timezone | UTC |

This suppression rule is implemented in `suppression-rules.bicep` and only deployed to the dev environment. Prod has no suppression rules.

---

## Resolved Decisions

All open questions have been resolved. Decisions are captured inline throughout the spec for traceability.

| # | Question | Decision |
|---|---|---|
| 1 | Email address for Action Group | `rajarshi129@gmail.com` |
| 2 | Session baseline for alert #17 | Deferred to Phase 3 — enable after ~2 weeks of prod session data |
| 3 | AI Foundry TPM quota alert | Added as alert #25 (Category 9) |
| 4 | Dev nightly scale-down noise | Suppression rule added for 06:45–09:00 UTC daily on dev (alerts #1, #18, #19, #20) |
| 5 | Alert #23 KQL complexity | Keep as KQL log-search alert (more flexible, no API-side changes needed) |
| 6 | Error boundary granularity | Per-screen wrapping — each screen gets its own `TelemetryErrorBoundary` for screen-level attribution |
