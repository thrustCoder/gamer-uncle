# Azure Monitor Alerts — Active Registry

> **Last updated:** 2026-03-02
>
> Living reference of all Azure Monitor alert rules across dev and prod environments.
> Update this file after adding, modifying, or removing alerts.

## Summary

| Environment | Metric Alerts | Log Alerts | Suppression Rules | Total |
|---|---|---|---|---|
| **Dev** | 8 | 16 | 1 | 25 |
| **Prod** | 8 | 16 | 0 | 24 |

---

## Alert Rules

### Category 1: API Availability & Errors

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 1 | `health-endpoint-down` | Metric | **1** | ✅ | ✅ | 1m / 5m | App Service health check failing — app unreachable or crashing |
| 2 | `http-5xx-spike` | Log | 2 | ✅ | ✅ | 5m / 5m | HTTP 5xx responses spiking — unhandled exceptions in controllers |
| 3 | `http-429-rejections` | Log | 3 | ✅ | ✅ | 5m / 15m | Rate-limited (429) responses — users throttled or potential abuse |

### Category 2: AI Agent Performance & Quality

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 4 | `agent-duration-p95` | Log | 2 | ✅ | ✅ | 5m / 15m | Agent request P95 latency > threshold — users experiencing slow responses |
| 5 | `agent-fallback-rate` | Log | 2 | ✅ | ✅ | 15m / 30m | AI returning fallback responses — Foundry quality degraded |
| 6 | `agent-transient-retries` | Log | 3 | ✅ | ✅ | 5m / 15m | Elevated transient retries (429/502/503/504) from AI Foundry |
| 7 | `low-quality-retries` | Log | 3 | ✅ | ✅ | 15m / 30m | AI returning placeholder/generic responses requiring quality retries |

### Category 3: Cache & Data Layer

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 8 | `redis-l2-failures` | Log | 2 | ✅ | ✅ | 5m / 15m | Redis (Upstash) L2 cache failures — traffic falls through to Cosmos + AI |
| 9 | `cosmos-429-throttling` | Metric | 2 | ✅ | ✅ | 5m / 5m | Cosmos DB returning 429s — RU budget exhausted |
| 10 | `cosmos-ru-high` | Metric | 3 | ✅ | ✅ | 5m / 15m | Cosmos DB Normalized RU consumption high — early warning before 429s |

### Category 4: Voice Pipeline

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 11 | `voice-failures` | Log | 2 | ❌ | ❌ | 5m / 15m | Voice processing (STT/Agent/TTS) failed — **disabled** (no voice metrics exist yet) |
| 12 | `voice-duration-p95` | Log | 3 | ❌ | ❌ | 5m / 15m | Voice round-trip P95 latency high — **disabled** (no voice metrics exist yet) |

### Category 5: Azure Functions (BGG Sync)

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 13 | `function-failures` | Metric | 2 | ✅ | ✅ | 15m / 1h | Durable Function activities failing — BGG data freshness degrades |
| 14 | `function-duration` | Log | 3 | ✅ | ✅ | 15m / 1h | Function execution P95 duration abnormally high |

### Category 6: Client-Side Telemetry

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 15 | `client-api-errors` | Log | 2 | ✅ | ✅ | 15m / 30m | Mobile app encountering API failures — cross-validates with server 5xx |
| 16 | `client-voice-errors` | Log | 3 | ✅ | ✅ | 15m / 30m | Voice feature failing on client side — microphone, encoding, or API |
| 17 | `session-drop-off` | — | 3 | — | — | — | **Deferred** — needs ~2 weeks of prod session baseline data |

### Category 7: Infrastructure (App Service)

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 18 | `cpu-high` | Metric | 2 | ✅ | ✅ | 5m / 10m | App Service Plan CPU sustained high — needs scale-up |
| 19 | `memory-high` | Metric | 2 | ✅ | ✅ | 5m / 10m | App Service Plan memory high — may cause OOM restarts |
| 20 | `response-time-p95` | Metric | 2 | ✅ | ✅ | 5m / 10m | App Service response time P95 elevated (all endpoints) |

### Category 8: Client Feature Health

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 21 | `game-search-errors` | Log | 2 | ✅ | ✅ | 15m / 30m | Game Search API failing from client — network errors, 5xx, Cosmos timeouts |
| 22 | `game-setup-errors` | Log | 2 | ✅ | ✅ | 15m / 30m | Game Setup API failures — users stuck without setup instructions |
| 23 | `feature-nav-failure` | Log | 2 | ✅ | ✅ | 30m / 1h | Feature tap-to-view ratio drop — crash or navigation failure detected |
| 24 | `tool-feature-errors` | Log | 3 | ✅ | ✅ | 30m / 1h | Runtime errors in local tool features (Timer, Team, Turn, Dice, Score) |

### Category 9: AI Foundry Quota

| # | Alert Name | Type | Sev | Dev | Prod | Eval / Window | Description |
|---|---|---|---|---|---|---|---|
| 25 | `ai-tpm-saturation` | Metric | 2 | ✅ | ✅ | 5m / 15m | AI Services token usage approaching provisioned TPM quota |

---

## Thresholds

| # | Alert Name | Prod Threshold | Dev Threshold |
|---|---|---|---|
| 1 | Health Endpoint Down | HealthCheckStatus < 100 (avg) | Same |
| 2 | HTTP 5xx Spike | > 5 in 5m | > 10 in 5m |
| 3 | HTTP 429 Rejections | > 20 in 15m | > 50 in 15m |
| 4 | Agent Duration P95 | P95 > 15,000 ms | P95 > 20,000 ms |
| 5 | Agent Fallback Rate | > 3 in 30m | > 5 in 30m |
| 6 | Agent Transient Retries | > 10 in 15m | > 15 in 15m |
| 7 | Low-Quality Retries | > 5 in 30m | > 10 in 30m |
| 8 | Redis L2 Failures | > 5 in 15m | > 10 in 15m |
| 9 | Cosmos DB 429s | > 0 in 5m | > 5 in 5m |
| 10 | Cosmos DB RU % | > 70% avg | > 85% avg |
| 11 | Voice Failures | > 3 in 15m | > 5 in 15m |
| 12 | Voice Duration P95 | P95 > 15,000 ms | P95 > 25,000 ms |
| 13 | Function Failures | > 0 in 1h | > 2 in 1h |
| 14 | Function Duration P95 | P95 > 30,000 ms | P95 > 60,000 ms |
| 15 | Client API Errors | > 10 in 30m | > 20 in 30m |
| 16 | Client Voice Errors | > 5 in 30m | > 10 in 30m |
| 17 | Session Drop-off | < 50% of 7-day avg (deferred) | N/A |
| 18 | CPU High | > 80% avg | > 90% avg |
| 19 | Memory High | > 85% avg | > 90% avg |
| 20 | Response Time P95 | > 5,000 ms avg | > 8,000 ms avg |
| 21 | Game Search Errors | > 5 in 30m | > 10 in 30m |
| 22 | Game Setup Errors | > 3 in 30m | > 5 in 30m |
| 23 | Feature Nav Failure | Tap-to-view ratio < 0.7 | < 0.5 |
| 24 | Tool Feature Errors | > 3 in 1h | > 5 in 1h |
| 25 | AI TPM Saturation | > 600,000 tokens in 15m | Same |

---

## Suppression Rules

| Rule | Environment | Scope | Alerts Suppressed | Schedule | Reason |
|---|---|---|---|---|---|
| `dev-scaledown-suppression` | Dev only | App Service + Plan | #1, #18, #19, #20 | Daily 06:45–09:00 UTC | Nightly F1 scale-down causes spurious infra alerts |

---

## Alert Firing History

> Tracks notable alert firings for incident review and threshold tuning.

| Date | Alert # | Alert Name | Env | Sev | Value | Threshold | Status | Root Cause |
|---|---|---|---|---|---|---|---|---|
| 2026-02-28 | 14 | Function Duration | Dev | 3 | 5.56M MB-ms | 60k | Fired | **False positive** — `FunctionExecutionUnits` is MB-ms not duration. Fixed: moved to log-search alert. |
| 2026-03-01 | 12 | Voice Duration P95 | Prod | 3 | phantom | 15,000 ms | Resolved | **No-data false positive** — zero voice metrics in prod. Fixed: count-based KQL approach. |
| 2026-03-01 | 4 | Agent Duration P95 | Prod | 2 | 13,895 ms | 12,000 ms | Resolved | **No-data false positive** — zero `AgentRequest.Duration` metrics in prod. Fixed: count-based KQL. |
| 2026-03-01 | 14 | Function Duration | Prod | 3 | 300,010 ms | 30,000 ms | Resolved | **No-data false positive** — phantom timeout value, actual P95 is 601ms. |
| 2026-03-01 | 4 | Agent Duration P95 | Prod | 2 | 12,080 ms | 12,000 ms | Resolved | **No-data false positive** — same `isnotempty()` guard ineffective. |
| 2026-03-02 | 4 | Agent Duration P95 | Prod | 2 | 17,932 ms | 12,000 ms | Resolved | **No-data false positive** — last phantom before count-based fix deployed. |

---

## Bicep Source Files

| File | Contents |
|---|---|
| [`infrastructure/alerts/main.bicep`](../../infrastructure/alerts/main.bicep) | Orchestrator — deploys all modules |
| [`infrastructure/alerts/action-group.bicep`](../../infrastructure/alerts/action-group.bicep) | Action Group (email + Azure Mobile App push) |
| [`infrastructure/alerts/metric-alerts.bicep`](../../infrastructure/alerts/metric-alerts.bicep) | Platform metric alerts (#1, #9, #10, #13, #18, #19, #20, #25) |
| [`infrastructure/alerts/log-alerts.bicep`](../../infrastructure/alerts/log-alerts.bicep) | Log-search KQL alerts (#2–#8, #11, #12, #14–#16, #21–#24) |
| [`infrastructure/alerts/suppression-rules.bicep`](../../infrastructure/alerts/suppression-rules.bicep) | Dev-only suppression rules |

---

## Action Group

| Property | Dev | Prod |
|---|---|---|
| Name | `gamer-uncle-dev-alerts-ag` | `gamer-uncle-prod-alerts-ag` |
| Email | rajarshi129@gmail.com | rajarshi129@gmail.com |
| Azure Mobile App Push | Enabled | Enabled |

---

## Notes

- **Alert #17** (Session Drop-off) is deferred — requires ~2 weeks of prod session baseline data.
- **Alerts #4, #11, #12, #14** use count-based KQL (threshold baked into query, `timeAggregation: Count`) to prevent no-data false positives when metrics have zero records.
- **Dev suppression** silences infra alerts #1, #18, #19, #20 during the nightly F1 scale-down window (06:45–09:00 UTC).
- Alerts are deployed via Bicep in the CI/CD pipeline (`DevDeployAlerts` and `ProdDeployAlerts` stages).
