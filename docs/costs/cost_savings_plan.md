# Azure Cost Analysis & Savings Plan — Gamer Uncle

> **Date**: February 17, 2026  
> **Updated**: May 11, 2026 — Removed historical cost snapshots, projected-savings tables, implementation roadmap, and traffic-milestone sections; doc now centered on recommendations + current status only  
> **Previous update**: May 10, 2026 — Cut dev scheduled query rules 16→8, enabled adaptive sampling on prod App Insights, deleted unused `PlayerSessions` Cosmos container  
> **Subscription costs queried**: Azure Cost Management API (real data)  
> **Environments**: Dev (`gamer-uncle-dev-rg`) and Prod (`gamer-uncle-prod-rg`)  
> **Traffic projections**: ~60 installs → 500 (Month 1) → 1,000+ (Month 3)

### Cross-Reference with Scaling Analysis

This plan has been reconciled against the [Scalability Analysis](../performance/scaling_analysis.md) traffic projections. Several recommendations are **phased** — they save money at current traffic (~60 users) but need to be reversed or adjusted when scaling milestones are hit. Each recommendation now includes a **Scale Impact** assessment:

- **Safe at scale** — No conflict with scaling needs; implement permanently.
- **Temporary savings** — Save money now, but expect to scale back up at a defined traffic milestone.
- **Do not implement** — Conflicts with scaling needs; keep the current resource level.
- **Complementary** — Actually helps scaling by reducing per-request resource consumption.

---

## Table of Contents

1. [Resource Inventory](#resource-inventory)
2. [Optimization Recommendations](#optimization-recommendations)
3. [Dev Environment — Keep It Lean](#dev-environment--keep-it-lean)
4. [Prod Environment — Optimize for Value](#prod-environment--optimize-for-value)

---

## Resource Inventory

### Dev Resources (Queried from Azure)

| Resource | Type | SKU/Tier | Monthly Cost (Est.) |
|----------|------|----------|:-------------------:|
| gamer-uncle-dev-app-plan | App Service Plan | **B1** (Basic, 1 instance) | ~$33 |
| ~~gamer-uncle-afd-dev~~ | ~~Front Door~~ | ~~Standard_AzureFrontDoor~~ | ~~$35~~ → **$0** (consolidated onto prod AFD) |
| ~~gameuncledevwaf~~ | ~~WAF Policy~~ | ~~Standard_AzureFrontDoor~~ | ~~Included in AFD~~ → deleted |
| gamer-uncle-dev-foundry | AI Services | S0 | Pay-per-use |
| gamer-uncle-dev-speech | Speech Services | **F0** (Free) | $0 |
| gamer-uncle-dev-cosmos | Cosmos DB | **Free Tier** enabled | $0 |
| gamer-uncle-dev-vault | Key Vault | Standard | ~$0 |
| gamer-uncle-dev-log-analytics-ws | Log Analytics | PerGB2018, 30d retention, **0.5 GB/day cap** | ~$0.14 |
| gamer-uncle-dev-app-insights | Application Insights | (no sampling), **linked to dev workspace** | Included in Log Analytics |
| gameruncledevfuncstorage | Storage Account | Standard_LRS | ~$0.17 |
| gamer-uncle-dev-function | Function App | Y1 (Consumption) | ~$0 |
| Upstash Redis (external) | Redis Cache | Free/Pro | ~$0–10 |

**Dev AI Model Deployments:**

| Foundry Resource | Model | SKU | Capacity (TPM in thousands) |
|------------------|-------|-----|:-------:|
| gamer-uncle-dev-foundry | gpt-4.1 | GlobalStandard | 50K |
| gamer-uncle-dev-foundry | gpt-4.1-mini | GlobalStandard | 10K |

### Prod Resources (Queried from Azure)

| Resource | Type | SKU/Tier | Monthly Cost (Est.) |
|----------|------|----------|:-------------------:|
| gamer-uncle-prod-app-plan | App Service Plan | **P1v3** (PremiumV3, 1 instance) | ~$99 |
| gamer-uncle-prod-afd | Front Door | Standard_AzureFrontDoor | ~$35 (now serves both dev + prod endpoints) |
| gameruncleprodwaf | WAF Policy | Standard_AzureFrontDoor | Included in AFD (rate limits: dev 60/min, prod 100/min) |
| gamer-uncle-prod-foundry-resourc | AI Services | S0 | Pay-per-use |
| gamer-uncle-prod-speech | Speech Services | **S0** (Standard, paid) | Pay-per-use |
| gamer-uncle-prod-cosmos | Cosmos DB | Autoscale 100–1000 RU/s, **no free tier** | ~$18 |
| gamer-uncle-prod-vault | Key Vault | Standard | ~$0 |
| gamer-uncle-prod-log-analytics-ws | Log Analytics | PerGB2018, 30d retention, **0.5 GB/day cap** | ~$0 |
| gamer-uncle-prod-app-insights | Application Insights | (no sampling) | Included in Log Analytics |
| gameruncleprofuncstorage | Storage Account | Standard_LRS | ~$0.97 |
| gamer-uncle-prod-function | Function App | Y1 (Consumption) | ~$0 |
| Upstash Redis (external) | Redis Cache | Pro (estimated) | ~$0–10 |

**Prod AI Model Deployments:**

| Foundry Resource | Model | SKU | Capacity (TPM in thousands) |
|------------------|-------|-----|:-------:|
| gamer-uncle-prod-foundry-resourc | gpt-4.1 | GlobalStandard | 50K |
| gamer-uncle-prod-foundry-resourc | gpt-4.1-mini | GlobalStandard | 10K |
| gamer-uncle-prod-foundry-resourc | gpt-realtime | GlobalStandard | 5K |

---

## Optimization Recommendations

### Summary Table (sorted by Cost Contributor, descending)

| # | Recommendation | Env | Cost Contributor (1-10) | Risk if Changed (1-10) | Est. Monthly Savings | Scale Impact | Implemented? |
|---|----------------|:---:|:-----------------------:|:----------------------:|:--------------------:|:------------:|:------------:|
| 1 | [Downgrade prod App Service from P1v3 to S1](#1-downgrade-prod-app-service-from-p1v3) | Prod | **10** | **4** | $45/mo (temporary) | Temporary savings | ✅ (partial — autoscale min→1 verified Apr 2026; S1 downgrade deferred) |
| 2 | [Consolidate dev AFD onto prod profile](#2-consolidate-dev-afd-onto-prod-profile) | Dev | **9** | **2** | $35/mo | Safe at scale | ✅ |
| 3 | [Switch prod Cosmos DB to serverless or lower autoscale](#3-switch-prod-cosmos-db-to-serverless-or-lower-autoscale) | Prod | **9** | **5** | $54/mo (temporary) | Temporary savings | ✅ (Mar 2026) |
| 4 | [Downgrade dev App Service from B1 to Free/Shared or use deployment slots](#4-downgrade-dev-app-service) | Dev | **8** | **3** | $25–31/mo | Safe at scale | ✅ |
| 5 | [Use Azure Reserved Instances for prod App Service](#5-use-azure-reserved-instances-for-prod-app-service) | Prod | **7** | **2** | $15–30/mo (defer) | Depends on tier | 🟠 |
| 6 | [Optimize Cosmos DB indexing policy](#6-optimize-cosmos-db-indexing-policy) | Prod | **5** | **3** | $5–15/mo (RU savings) | Complementary | ✅ |
| 7 | [Route more traffic through AI mini model](#7-route-more-traffic-through-ai-mini-model) | Both | **4** | **3** | $0.50–2/mo (grows with scale) | Complementary | 🟠 |
| 8 | [Delete unused dev AI Foundry eastus2 resource](#8-delete-unused-dev-ai-foundry-eastus2-resource) | Dev | **3** | **1** | $0–2/mo | Safe at scale | ✅ |
| 9 | [Enable Application Insights sampling](#9-enable-application-insights-sampling) | Both | **3** | **2** | $1–5/mo (at scale) | Complementary | ✅ (prod May 2026) |
| 10 | [Set Log Analytics daily cap on dev and prod](#10-set-log-analytics-daily-cap-on-dev) | Both | **2** | **1** | $1–5/mo | Safe at scale | ✅ (dev Mar 2026, prod Apr 2026) |
| 11 | [Delete orphaned legacy Functions storage accounts](#11-delete-orphaned-legacy-functions-storage-accounts) | Both | **1** | **1** | <$1/mo (operational hygiene) | Safe at scale | ✅ (May 2026) |
| 12 | [Delete unused `PlayerSessions` Cosmos container](#12-delete-unused-playersessions-cosmos-container) | Both | **5** | **1** | ~$25/mo | Safe at scale | ✅ (May 2026) |
| 13 | [Reduce dev scheduled query alert rules 16→8](#13-reduce-dev-scheduled-query-alert-rules-16→8) | Dev | **5** | **2** | ~$9/mo | Safe at scale | ✅ (May 2026) |

### How to read this table

- **Cost Contributor (1-10)**: How much this resource contributes to your total bill. 10 = biggest cost driver.
- **Risk if Changed (1-10)**: How risky the optimization is. 1 = safe/easy, 10 = could impact production reliability.
- **Scale Impact**: How this recommendation interacts with projected traffic growth (see [Cross-Reference with Scaling Analysis](#cross-reference-with-scaling-analysis) for legend). *Temporary savings* should be reversed at the milestone indicated; *Complementary* optimizations actually help at scale.
- **Implemented?**: Whether this optimization has been applied. ✅ = Done, 🟠 = Not yet.

---

## Dev Environment — Keep It Lean

### 1. Downgrade Prod App Service from P1v3

> See [#1 in Prod section below](#1-downgrade-prod-app-service-from-p1v3) — listed here for the summary table ordering.

### 2. Consolidate Dev AFD onto Prod Profile

| | |
|---|---|
| **Cost Contributor** | 9/10 |
| **Risk** | 2/10 |
| **Savings** | ~$35/mo |
| **Implemented** | ✅ (Feb 2026) |

**What was done**: Instead of removing AFD entirely from dev, the dev endpoint was consolidated onto the existing prod AFD profile (`gamer-uncle-prod-afd`). This eliminates the $35/mo base fee for the separate dev AFD profile while retaining WAF protection and AFD routing for both environments.

**Implementation details**:

1. **Created dev endpoint** `gamer-uncle-dev-api` on the prod AFD profile
   - Hostname: `gamer-uncle-dev-api-bba9ctg5dchce9ag.z03.azurefd.net`
   - Origin group: `dev-app-service-origin-group` → App Service `gamer-uncle-dev-app-svc`
   - Routes: `/api/*`, `/health`, `/*` (catch-all)
   - Health probe: GET `/health` via HTTPS every 120s
   - Certificate name check: Disabled (required for new-format App Service hostnames with regional suffix)

2. **WAF rate limiting** added to shared WAF policy (`gameruncleprodwaf`):
   - `devApiRateLimit`: 60 requests/min per IP on `/api/*` paths
   - `prodApiRateLimit`: 100 requests/min per IP on `/api/*` paths
   - Security policy `waf-policy-association` links WAF to both endpoints

3. **FDID lockdown** on both App Services:
   - Access restriction: Allow only `AzureFrontDoor.Backend` service tag with `X-Azure-FDID: f2c54541-49ea-4a66-8e48-a589809412d3`
   - Deny all other traffic (direct App Service access returns 403)

4. **URL references updated** across ~27 files:
   - Old dev AFD URL → new dev endpoint URL
   - Direct App Service URLs → AFD endpoint URLs
   - Affected: mobile config, pipeline YAML, test scripts, diagnostic scripts, docs

5. **Old dev AFD profile** (`gamer-uncle-afd-dev`) and WAF policy (`gameuncledevwaf`) — deletion in progress

**Key finding**: Azure Front Door Standard tier does **not** support managed WAF rule sets (OWASP/bot protection). That requires Premium tier at ~$330/mo. Custom rules (rate limiting) work fine on Standard.

**Risk**: Minimal. Both environments share one AFD profile but have separate endpoints, origin groups, and rate limit rules. No cross-contamination.

---

### 4. Downgrade Dev App Service

| | |
|---|---|
| **Cost Contributor** | 8/10 |
| **Risk** | 3/10 |
| **Savings** | $25–31/mo |
| **Implemented** | ✅ (Feb 2026) |

**Current state**: Dev runs on **B1** (Basic tier, 1 instance) at ~$33/mo. This provides 1.75 GB RAM, 1 core.

**Options**:

| Option | Monthly Cost | Savings | Trade-off |
|--------|:----------:|:-------:|-----------|
| Keep B1 | ~$54 | – | Current setup |
| Downgrade to **F1** (Free) | $0 | $33/mo | 60 min/day compute, 1 GB memory, no custom domain, no always-on |
| ~~Downgrade to **B1** but **stop when not testing**~~ | ~~$2–8~~ | ~~$25–31/mo~~ | ~~Manual start/stop or scheduled~~ |
| Use **D1** (Shared) | ~$10 | $23/mo | Shared compute, limited features |

**What was done**: Implemented the **B1 ↔ F1 toggle** approach with full automation:

1. **Nightly scale-down schedule** (`pipelines/dev-scaledown-schedule.yml`): A separate Azure DevOps scheduled pipeline runs at 11:00 PM PT every night. It scales the dev App Service Plan from B1 → F1 (free), stopping all billing. The app deployment is preserved.

2. **Pipeline auto-scale-up** (`pipelines/azure-pipelines.yml`): The `DevDeployApi` stage now scales the plan up to B1 before deploying, with a 30s stabilization wait. This ensures CI/CD merges to `main` always succeed even if the plan was parked on F1.

3. **Manual scale-up/down script** (`scripts/dev-appservice-toggle.ps1`): For on-demand use:
   ```powershell
   .\scripts\dev-appservice-toggle.ps1 start    # Scale to B1 for testing
   .\scripts\dev-appservice-toggle.ps1 stop     # Park on F1 (free)
   .\scripts\dev-appservice-toggle.ps1 status   # Check current SKU
   ```

4. **"testit" command integration**: When `API_ENVIRONMENT` is `dev`, the testit command automatically scales the dev App Service to B1 before starting. Not needed for `local` (uses localhost) or `prod` (always running).

**How billing works**: Azure App Service Plans bill for the plan VM regardless of whether the app is running. `az webapp stop` does NOT save money on B1. The only way to eliminate charges is to scale the SKU to F1 (free). The app deployment stays intact across SKU changes.

**Cost estimate**: With nightly parking (11 PM–next pipeline/testit scale-up), dev runs on B1 for ~8–12 hrs/day on workdays = ~$2–8/mo instead of ~$33/mo. **Savings: ~$25–31/mo.**

---

### 8. Delete Unused Dev AI Foundry eastus2 Resource

| | |
|---|---|
| **Cost Contributor** | 3/10 |
| **Risk** | 1/10 |
| **Savings** | $0–2/mo |
| **Implemented** | ✅ (Feb 2026) |

**What was done**:

1. **Deleted Azure resource** `gamer-uncle-dev-foundry-eastus2` (eastus2 region) and its model deployments (gpt-realtime 5K TPM, gpt-4o 10K TPM). Resource purged from soft-delete.

2. **Deleted 7 dead code files** — all orphaned by the removal of the WebRTC/Foundry voice path that was never completed:
   - `scripts/fix-dev-app-config.ps1` — historical one-off fix script hardcoding eastus2 endpoint
   - `services/api/Services/Interfaces/IFoundryVoiceService.cs` — dead interface (no implementation, no DI registration)
   - `services/shared/models/VoiceSessionResponse.cs` — only consumer was IFoundryVoiceService
   - `services/shared/models/VoiceSessionRequest.cs` — only consumer was IFoundryVoiceService
   - `apps/mobile/services/foundryVoiceService.ts` — 794-line deprecated WebSocket client (never imported by any screen)
   - `apps/mobile/hooks/useFoundryVoiceSession.ts` — React hook wrapping the above (never imported by any source file)
   - `apps/mobile/services/audioUtils.ts` — audio utilities only used by foundryVoiceService.ts

3. **Cleaned 2 config/script files**:
   - `services/api/appsettings.Testing.json` — removed `VoiceService` section (mock config for nonexistent service)
   - `scripts/diagnose-agent-issue.ps1` — updated stale "eastus2 region" diagnostic hint

**Previous analysis** (preserved for reference):

| Check | Result |
|-------|--------|
| `appsettings.json` | Points to `gamer-uncle-dev-foundry` only — **no reference** to eastus2 |
| `appsettings.Development.json` | Points to `gamer-uncle-dev-foundry` only — **no reference** to eastus2 |
| `appsettings.Production.json` | Points to prod foundry — **no reference** to eastus2 |
| Source code (`services/api/`) | **Zero references** to `gamer-uncle-dev-foundry-eastus2` in any `.cs` or `.json` source file |
| `VoiceController.cs` | Uses `IAudioProcessingService` (STT→AI→TTS pipeline), **not** `IFoundryVoiceService` |
| `gpt-realtime` usage in dev | Per [model_usage.md](../model_usage.md): "WebRTC Voice: Only available in **production**" — dev has no gpt-realtime usage |
| `gpt-4o` model | Superseded by gpt-4.1 (deployed on the primary foundry resource) |

---

### 10. Set Log Analytics Daily Cap on Dev and Prod

| | |
|---|---|
| **Cost Contributor** | 2/10 |
| **Risk** | 1/10 |
| **Savings** | $1–5/mo |
| **Implemented** | ✅ (dev Mar 2026, prod Apr 2026) |

**What was done**:

**Dev (Mar 2026)**: Set 0.5 GB/day daily cap on both the dev workspace (`gamer-uncle-dev-log-analytics-ws`) and the default workspace (`defaultworkspace-*-wus`). This prevents the cost spikes seen in the Feb–Mar billing period ($3.56 dev + $17.15 default = $20.71 combined).

Additionally, dev App Insights was relinked from the default workspace to `gamer-uncle-dev-log-analytics-ws` (it was misconfigured, sending 5.6 GB/mo to the wrong workspace), and `StorageWrite` diagnostic logging was disabled on `gameruncledevfuncstorage` (was generating 1.1 GB/mo of `StorageBlobLogs`).

**Prod (Apr 2026)**: Set 0.5 GB/day daily cap on prod workspace (`gamer-uncle-prod-log-analytics-ws`). The prod workspace had **no daily cap** (`dailyQuotaGb: -1`), which caused $24 Log Analytics + $15 Azure Monitor charges in March 2026 — up from near-zero in January. This was likely amplified by the 2-instance App Service configuration generating double the telemetry. Verified via `az monitor log-analytics workspace show` (dailyCapGb=0.5).

First 5 GB/mo is free with Log Analytics. With the daily cap at 0.5 GB, maximum billable ingestion is ~15 GB/mo per workspace, capping worst-case cost at ~$28/workspace/mo.

---

## Prod Environment — Optimize for Value

### 1. Downgrade Prod App Service from P1v3

| | |
|---|---|
| **Cost Contributor** | 10/10 |
| **Risk** | 4/10 |
| **Savings** | $45/mo (temporary — ~2-3 months) |
| **Scale Impact** | **Temporary savings** — upgrade back to S2/P1v3 at 500+ users |
| **Implemented** | ✅ partial (Apr 2026) — autoscale min→1 (verified: min=1, default=1, max=4, currently 1 instance); full S1 downgrade deferred |

**Current state**: Prod runs on **P1v3** (PremiumV3, 1 instance) at ~$99/mo. P1v3 provides 2 vCPUs, 8 GB RAM, enhanced networking, and deployment slot support.

> **April 2026 fix**: The autoscale setting `gamer-uncle-prod-autoscale` was found with min=2, default=2 despite being marked as fixed in March. This caused the plan to run 2× P1v3 instances ($196/mo) throughout March. Fixed on April 8, 2026 — independently verified via `az monitor autoscale show` and `az appservice plan show` (capacity=1).

**Why it's oversized NOW**: With ~60 users and ~5 peak concurrent, P1v3 is significant overkill. The app is an API proxy to AI services — not compute-heavy.

**Why it's needed LATER**: The [scaling analysis](../performance/scaling_analysis.md#7-no-autoscaling-rules) recommends **S2 or P1v3, 2–4 instances** with autoscaling at 1,000 users (~50 peak concurrent). P1v3 also supports deployment slots (useful for zero-downtime deployments during rapid iteration).

**Phased approach**:

| Phase | Users | Plan | Monthly Cost | Action |
|-------|:-----:|------|:----------:|--------|
| **Now** (0–3 months) | ~60 | **S1** (Standard) | ~$54 | Downgrade from P1v3 → S1; save $45/mo |
| **Month 1–2** (200–500 users) | 200–500 | **S1 × 2 instances** | ~$108 | Enable autoscaling (min 1, max 2); configure scale rules |
| **Month 3** (1,000+ users) | 1,000+ | **S2 or P1v3 × 2–4** | $108–396 | Upgrade tier when P95 latency degrades; add more instances |

**Recommendation**: **Downgrade to S1 now** ($54/mo). S1 supports autoscaling, which is critical. When traffic hits 200+ users (Month 1), enable autoscale to 2 instances. Revisit the tier (S2 vs P1v3) when approaching 500+ users.

> **Scaling trigger**: Upgrade from S1 when CPU consistently exceeds 70% on a single instance, or when P95 response time exceeds 3 seconds.

**Risk**: Monitor response times after downgrading. The key bottleneck is AI Foundry response time (2–8s), not App Service compute. S1's 1.75 GB RAM is sufficient since the app offloads work to Cosmos DB and AI Foundry.

---

### 3. Switch Prod Cosmos DB to Serverless or Lower Autoscale

| | |
|---|---|
| **Cost Contributor** | 9/10 |
| **Risk** | 5/10 |
| **Savings** | $54/mo (temporary — ~2-3 months) |
| **Scale Impact** | **Temporary savings** — raise autoscale max back to 4000 RU/s at 500+ users |
| **Implemented** | ✅ (Mar 2026) — lowered autoscale max from 4000→1000 RU/s |

**Current state**: Prod Cosmos DB uses **autoscale at container level** with max 4,000 RU/s. The current throughput shows 100 RU/s (autoscale scales down to 10% of max). However, the **minimum billing** for autoscale is 10% of max = 400 RU/s. At ~$0.008/RU/hr, that's **~$72/mo** just for provisioned throughput.

Dev Cosmos DB has **free tier** enabled (1000 RU/s + 25 GB free), which is why dev Cosmos costs $0.

**Why it's oversized NOW**: At ~60 users (~5 peak concurrent), actual RU consumption is far below 400 RU/s. The autoscale floor is the cost driver, not actual usage.

**Why the current max is needed LATER**: The [scaling analysis](../performance/scaling_analysis.md#capacity-recommendations) recommends **1,000 RU/s or autoscale 400–4,000** for 1,000 users. `CONTAINS` queries cost 10–30 RU each. At 50 peak concurrent users × 20 RU avg = 1,000 RU/s at ceiling. Burst traffic (e.g., everyone browsing at game night) could exceed 1,000 RU/s.

**Phased approach**:

| Phase | Users | Autoscale Max | Min Billing | Monthly Cost | Action |
|-------|:-----:|:------------:|:-----------:|:----------:|--------|
| **Now** (0–3 months) | ~60 | **1,000 RU/s** | 100 RU/s | ~$18 | Lower max from 4000→1000; save $54/mo |
| **Month 2** (200–500 users) | 200–500 | **2,000 RU/s** | 200 RU/s | ~$36 | Raise max when avg RU approaches 800 |
| **Month 3** (1,000+ users) | 1,000+ | **4,000 RU/s** | 400 RU/s | ~$72 | Restore current max; cost returns to baseline |

**Recommendation**: **Lower autoscale max to 1,000 RU/s now**. This saves $54/mo with the autoscale floor dropping to 100 RU/s (~$18/mo). At ~60 users this is comfortable headroom.

> **Scaling trigger**: Raise autoscale max when Cosmos DB returns 429 (throttled) responses, or when average RU consumption exceeds 70% of max (700 RU/s sustained).

> **Critical prerequisite**: Fix [CosmosClientOptions](../performance/scaling_analysis.md#4-no-cosmosclientoptions-configuration) (scaling Finding #4) **before** lowering the ceiling. Proper retry settings on 429s will handle brief burst spikes gracefully.

**Risk**: Medium. If traffic spikes suddenly hit the 1000 RU/s ceiling without retry logic, Cosmos returns 429 errors. The app currently has no configured retry policy on Cosmos calls. Fix CosmosClientOptions first.

---


### 5. Use Azure Reserved Instances for Prod App Service

| | |
|---|---|
| **Cost Contributor** | 7/10 |
| **Risk** | 2/10 |
| **Savings** | $15–30/mo (defer until tier stabilizes) |
| **Scale Impact** | **Depends on tier** — don't commit until post-scaling tier is settled |
| **Implemented** | 🟠 |

**Current state**: App Service is on pay-as-you-go pricing.

**Why to defer (cross-reference with scaling analysis)**: Recommendation #1 proposes a phased App Service plan:
- **Months 0–3**: S1 ($54/mo) — saving money at low traffic
- **Month 3+**: S2 or P1v3 ($108–$99/mo) — upgrading for 1,000+ users

Purchasing a reserved instance on S1 now would lock you into a tier you'll likely outgrow within 3 months. RI exchanges are possible but add friction.

**Recommendation**: **Wait until Month 3–4** when you've settled on the production tier (likely S2 or P1v3 based on scaling analysis). Then purchase a 1-year reserved instance:
- S2 pay-as-you-go: ~$108/mo → S2 reserved: ~$76/mo (save ~$32/mo)
- P1v3 pay-as-you-go: ~$99/mo → P1v3 reserved: ~$69/mo (save ~$30/mo)

> **Scaling trigger**: Purchase RI once the same App Service tier has been stable for 1+ month and you're confident in the plan choice.

**Risk**: Very low. Only risk is premature commitment during the scaling transition period.

---

### 6. Optimize Cosmos DB Indexing Policy

| | |
|---|---|
| **Cost Contributor** | 5/10 |
| **Risk** | 3/10 |
| **Savings** | $5–15/mo (RU reduction) |
| **Implemented** | ✅ (Feb 2026) |

**What was done**: Applied an optimized indexing policy to the `Games` container in both dev and prod Cosmos DB. The policy excludes 12 read-only fields from indexing while keeping all queried/filtered/sorted fields indexed.

**Query analysis performed**: All 8 Cosmos DB operations across `CosmosDbService`, `GameSearchService`, `GameDataService`, and `DurableGameUpsertFunction` were analyzed to identify which fields appear in WHERE, ORDER BY, and ARRAY_CONTAINS clauses.

**Important correction**: The original recommendation incorrectly proposed excluding `description`, `mechanics`, and `categories`. Query analysis revealed:
- `description` — used in `CONTAINS(UPPER(c.description), ...)` in `GameDataService.GetRelevantGamesForQueryAsync`
- `mechanics` — used in `ARRAY_CONTAINS(c.mechanics, ...)` in dynamic criteria queries
- `categories` — used in `ARRAY_CONTAINS(c.categories, ...)` in dynamic criteria queries

These fields **must remain indexed**.

**Fields excluded from indexing** (never appear in WHERE/ORDER BY):

| Excluded Path | Type | Reason |
|---------------|------|--------|
| `/overview/?` | string | Only projected in SELECT, never filtered |
| `/bggRating/?` | double | Only returned in responses |
| `/yearPublished/?` | int | Only returned in responses |
| `/imageUrl/?` | string | Only projected/returned, never filtered |
| `/shopLink/?` | string | Never queried or projected |
| `/setupGuide/?` | string | Only in full `SELECT *` reads |
| `/rulesUrl/?` | string | Only returned in responses |
| `/ruleQnA/*` | array of objects | Complex nested data, only returned in full reads |
| `/moderatorScripts/*` | array of objects | Complex nested data, only returned in full reads |
| `/narrationTTS/*` | nested object | Complex nested data, only returned in full reads |
| `/type/?` | string | Always `"game"`, never filtered |
| `/updatedAt/?` | DateTime | Never filtered or sorted |
| `/"_etag"/?` | system property | Standard exclusion |

**Fields kept indexed** (actively queried):

| Field | Usage |
|-------|-------|
| `id` | Partition key + point reads |
| `name` | `CONTAINS()` text search |
| `description` | `CONTAINS()` text search |
| `minPlayers`, `maxPlayers` | Range comparisons (`<=`, `>=`) |
| `minPlaytime`, `maxPlaytime` | Range comparisons |
| `weight` | Range comparison (`<=`) |
| `averageRating` | Range comparison (`>=`) + ORDER BY DESC |
| `ageRequirement` | Range comparison (`<=`) |
| `numVotes` | ORDER BY DESC |
| `mechanics` | `ARRAY_CONTAINS()` |
| `categories` | `ARRAY_CONTAINS()` |

**Implementation**: Policy stored in `scripts/cosmos-indexing-policy.json`. Applied via:
```powershell
# Dev
az cosmosdb sql container update --account-name gamer-uncle-dev-cosmos --database-name gamer-uncle-dev-cosmos-container --name Games --resource-group gamer-uncle-dev-rg --idx "@scripts/cosmos-indexing-policy.json"
# Prod
az cosmosdb sql container update --account-name gamer-uncle-prod-cosmos --database-name gamer-uncle-prod-cosmos-container --name Games --resource-group gamer-uncle-prod-rg --idx "@scripts/cosmos-indexing-policy.json"
```

**Impact**: Dev (450 docs, 1.8 MB) and Prod (3,626 docs, 15.2 MB). Index rebuild runs in background with zero downtime — queries continue using the old index until the new one completes. Write RU savings are immediate for new upserts; read query performance is unchanged for indexed fields.

**Risk**: Low. Only read-only fields excluded. If a future feature needs to filter on an excluded field (e.g., `yearPublished`), add it back by removing from `excludedPaths` in the policy JSON and re-applying.

---

### 7. Route More Traffic Through AI Mini Model

| | |
|---|---|
| **Cost Contributor** | 4/10 |
| **Risk** | 3/10 |
| **Savings** | $0.50–2/mo now; $5–15/mo at 1,000 users |
| **Implemented** | 🟠 |

**Current state**: The architecture uses gpt-4.1-mini for criteria extraction and gpt-4.1 for main responses. GPT-4.1-mini is ~10x cheaper per token.

**Recommendation**: Evaluate if simple follow-up queries (e.g., "tell me more about Catan") can be routed to gpt-4.1-mini instead of gpt-4.1. This requires query classification logic but can significantly reduce AI costs at scale.

---

### 9. Enable Application Insights Sampling

| | |
|---|---|
| **Cost Contributor** | 3/10 |
| **Risk** | 2/10 |
| **Savings** | $1–5/mo (grows with scale) |
| **Implemented** | ✅ (prod May 10, 2026) — dev intentionally left at defaults |

**What was done**: Enabled adaptive sampling on the classic Application Insights SDK and added fixed-ratio sampling on the OpenTelemetry pipeline in prod. The API uses *both* SDKs side-by-side (OTel via `UseAzureMonitor` for traces/metrics; classic via `AddApplicationInsightsTelemetry` so `TelemetryClient.TrackEvent()` calls in `TelemetryController` keep working), so both pipelines need their own sampling configuration.

**Code changes** ([services/api/Program.cs](../../services/api/Program.cs)):

- Added `using Microsoft.ApplicationInsights.Extensibility;`.
- `UseAzureMonitor` now reads `ApplicationInsights:OpenTelemetrySamplingRatio` (0.0–1.0) and sets `options.SamplingRatio` accordingly. The Azure Monitor OTel distro only supports **fixed-rate** sampling — adaptive sampling is not available on that pipeline.
- `AddApplicationInsightsTelemetry` now sets `options.EnableAdaptiveSampling` from `ApplicationInsights:EnableAdaptiveSampling` (default `true`).
- After registration, `TelemetryConfiguration` is updated to call `DefaultTelemetrySink.TelemetryProcessorChainBuilder.UseAdaptiveSampling(maxTelemetryItemsPerSecond, excludedTypes)` when `ApplicationInsights:AdaptiveSampling:MaxTelemetryItemsPerSecond` is set. This overrides the SDK's default 5 items/sec budget with a tuned value.

**Prod configuration** ([services/api/appsettings.Production.json](../../services/api/appsettings.Production.json)):

```json
"ApplicationInsights": {
  "ConnectionString": "@Microsoft.KeyVault(...)",
  "EnableAdaptiveSampling": true,
  "AdaptiveSampling": {
    "MaxTelemetryItemsPerSecond": 3,
    "ExcludedTypes": "Event;Exception"
  },
  "OpenTelemetrySamplingRatio": 0.5
}
```

**Tuning rationale**:

| Setting | Value | Why |
|---------|:-----:|-----|
| `MaxTelemetryItemsPerSecond` (classic SDK) | **3** | Tighter than the SDK default of 5. Caps requests/dependencies/traces ingestion. |
| `ExcludedTypes` | `Event;Exception` | Keeps **all** custom events (`TelemetryController.TrackEvent` calls) and exceptions unsampled — these are low volume and high diagnostic value. |
| `OpenTelemetrySamplingRatio` | **0.5** | Halves the traces and metrics emitted by the OTel pipeline (which doesn't support adaptive sampling). Conservative starting point — can drop to 0.25 if ingestion is still high. |

**Dev intentionally unchanged**: `appsettings.json` and `appsettings.Development.json` do not set these keys, so dev keeps SDK defaults (adaptive sampling on at 5 items/sec, OTel ratio 1.0). Dev volume is low enough that 100% ingestion is fine, and full fidelity is more valuable for debugging.

**Deployment**: Takes effect on next App Service deploy of `appsettings.Production.json`. No Azure-side config required.

**Monitoring**: After rollout, watch the App Insights **Usage and estimated costs** blade for 5–7 days. If ingestion is still trending above the 0.5 GB/day Log Analytics cap (recommendation #10), drop `MaxTelemetryItemsPerSecond` to 2 and/or `OpenTelemetrySamplingRatio` to 0.25.

**Risk**: Low. `Event` and `Exception` types are excluded from sampling so the high-signal custom telemetry used for product analytics is unaffected. Sampled-out items still have their `itemCount` preserved, so metric aggregations (request rates, exception rates) remain accurate.

---

### 11. Delete Orphaned Legacy Functions Storage Accounts

| | |
|---|---|
| **Cost Contributor** | 1/10 |
| **Risk** | 1/10 |
| **Savings** | <$1/mo (primary benefit is operational hygiene) |
| **Implemented** | ✅ (May 11, 2026) |

**What was done**: Deleted two unused storage accounts — `gameruncledevstorage` and `gameruncleprodstorage` — that were left behind from the original Function App deployments (Jun & Jul 2025) and replaced by `gameruncle{dev,pro}funcstorage`.

**How it was identified**: Reviewing recommendation #11 against actual Azure state revealed both `gameruncle{dev,prod}storage` accounts were no longer wired to anything. Both Function Apps' `AzureWebJobsStorage`, `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`, `WEBSITE_RUN_FROM_PACKAGE`, and managed-identity blob/queue/table URIs all pointed at the `*funcstorage` accounts instead.

**Verification before deletion**:

| Check | `gameruncledevstorage` | `gameruncleprodstorage` |
|---|---|---|
| Workspace grep (code/scripts/IaC) | 0 refs | 0 refs |
| App Service config | No reference | No reference |
| Function App config | No reference | No reference |
| Bicep IaC | 0 refs | 0 refs |
| Pipelines / scripts | 0 refs | 0 refs |
| Diagnostic settings | None | None |
| Private endpoints / VNet rules | None | None |
| Event Grid system topics | None | None |
| Blob content | Stale: 35 MB `released-package.zip` + old webjobs secrets, last write 2025-06-05 | All 4 containers empty |
| Role assignments | 1 stale (`gamer-uncle-dev-function-uami` → Blob Data Owner; MI active elsewhere on Cosmos & App Insights) | None |
| Apr 8 – May 7 cost | $0.0008 | $0.0000 |

**Implementation**:
```powershell
az storage account delete --name gameruncledevstorage  --resource-group gamer-uncle-dev-rg  --yes
az storage account delete --name gameruncleprodstorage --resource-group gamer-uncle-prod-rg --yes
```

The stale `Storage Blob Data Owner` role assignment on the dev UAMI was auto-removed by Azure when the scope disappeared. The UAMI itself remains in active use (Cosmos Contributor + App Insights Monitoring Metrics Publisher).

**Risk**: None. Both accounts were unreferenced; deletion does not affect either Function App's runtime storage.

---

### 12. Delete Unused `PlayerSessions` Cosmos Container

| | |
|---|---|
| **Cost Contributor** | 5/10 |
| **Risk** | 1/10 |
| **Savings** | ~$25/mo (permanent) |
| **Scale Impact** | **Safe at scale** — container has no code references and was never used |
| **Implemented** | ✅ (May 10, 2026) |

**What was done**: Deleted the `PlayerSessions` container from both `gamer-uncle-prod-cosmos` and `gamer-uncle-dev-cosmos` (database `gamer-uncle-{env}-cosmos-container`).

**How it was identified**: While validating the April 8 – May 7 billing period, prod Cosmos DB cost was $43.33 — higher than the ~$18/mo expected after lowering the `Games` container autoscale max to 1000 RU/s (recommendation #3). Resource-level cost drill-down showed `gamer-uncle-prod-cosmos` accounting for the difference. Listing containers revealed an unexpected `PlayerSessions` container with its own dedicated autoscale at max 4000 RU/s (400 RU/s floor billing ≈ $23–25/mo).

**Verification before deletion**:

| Check | Result |
|-------|--------|
| `grep` for `PlayerSessions`, `PlayerSession`, `playerSession`, `player_session` across `.cs`, `.ts`, `.tsx`, `.json`, `.yml`, `.yaml`, `.ps1`, `.bicep` | **Zero matches** workspace-wide |
| API service (`services/api/`) | No reference |
| Mobile app (`apps/mobile/`) | No reference |
| Azure Functions (`services/functions/`) | No reference |
| Shared models (`services/shared/models/`) | No reference |
| Infrastructure / pipelines / scripts | No reference |
| Partition key | `/gameId` (matched `Games` container shape — likely an early prototype container) |

**Cost driver**: Only the prod container had dedicated throughput (autoscale max 4000 RU/s → 400 RU/s floor × 730 hrs × $0.008/100 RU/hr ≈ $23/mo). Dev shared database-level throughput and contributed $0 incremental.

**Implementation**:
```powershell
az cosmosdb sql container delete `
  --account-name gamer-uncle-prod-cosmos `
  --resource-group gamer-uncle-prod-rg `
  --database-name gamer-uncle-prod-cosmos-container `
  --name PlayerSessions --yes

az cosmosdb sql container delete `
  --account-name gamer-uncle-dev-cosmos `
  --resource-group gamer-uncle-dev-rg `
  --database-name gamer-uncle-dev-cosmos-container `
  --name PlayerSessions --yes
```

Verified post-deletion: both accounts now show only `Games` in the container list.

**Expected impact**: Prod Cosmos DB billing should drop from ~$43/mo to ~$18/mo starting with the 5/8–6/7 cycle. Validate in the next monthly bill review.

**Risk**: None. Zero code path touched this container.

---

### 13. Reduce Dev Scheduled Query Alert Rules 16→8

| | |
|---|---|
| **Cost Contributor** | 5/10 |
| **Risk** | 2/10 |
| **Savings** | ~$9/mo (permanent) |
| **Scale Impact** | **Safe at scale** — dropped rules are dev-noise alerts, not regression detectors |
| **Implemented** | ✅ (May 10, 2026) |

**What was done**: Reduced dev scheduled query alert rules from 16 → 8 by adding `if (environment == 'prod')` guards in [infrastructure/alerts/log-alerts.bicep](../../infrastructure/alerts/log-alerts.bicep) on 8 rules that don't help catch regressions in dev. Prod retains all 16 rules unchanged.

**How it was identified**: While validating the April billing period, **Azure Monitor was the #1 line item in dev RG at $15.08/mo** — more than App Service or Log Analytics. Investigation showed all 16 dev scheduled query rules had **zero activations across 5 weeks** (since April 1), so they were producing no actionable signal at current dev traffic (~60 users, mostly E2E + manual `testit` traffic).

**Decision framework**: Not "has it ever fired?" but "could a bad commit to `main` slip past this?". A rule was kept only if it covers a **distinct failure domain** that other kept rules don't cover. Rules were dropped if they (a) have sample-size issues at dev volume (P95 perf alerts that fire on a single cold-start outlier), (b) signal upstream provider health rather than code regressions, or (c) require sustained dev traffic the environment doesn't generate.

**Kept (8) — distinct regression failure domains**:

| Rule | Sev | Why it stays in dev |
|------|:---:|---------------------|
| `http-5xx-spike` | 2 | Most direct "you broke something" alert — any unhandled controller exception fires it. |
| `agent-fallback-rate` | 2 | Catches broken AI agent config (bad agent ID, wrong endpoint, auth drift). |
| `client-api-errors` | 2 | Catches mobile↔server contract drift; 5xx alert misses contract bugs that return 200s with unexpected shapes. |
| `game-search-errors` | 2 | Separate code path / Cosmos query / indexing policy from `/api/recommendations`. |
| `game-setup-errors` | 2 | Separate endpoint with its own Foundry agent path. |
| `voice-failures` | 2 | Entire separate subsystem (STT → Agent → TTS); text-chat alerts cannot detect voice breakage. |
| `redis-l2-failures` | 2 | Catches Upstash key rotation, connection string drift, StackExchange.Redis upgrade breakage. |
| `tool-feature-errors` | 3 | Mobile Timer/Team/Dice/Score features — React Native regressions E2E may not exercise. |

**Dropped (8) — prod-only**:

| Rule | Sev | Why dev doesn't need it |
|------|:---:|-------------------------|
| `agent-duration-p95` | 2 | Sample size too small — one cold-start outlier fires Sev2. P95 perf is a prod concern, not a merge gate. |
| `voice-duration-p95` | 3 | Same sample-size noise. Sev3 perf doesn't gate merges. |
| `http-429-rejections` | 3 | Dev has no real concurrent traffic; the 50/15-min dev threshold is unreachable. |
| `agent-transient-retries` | 3 | Signals upstream Foundry health (429/502/503/504), not a code regression. |
| `low-quality-retries` | 3 | Subjective AI quality metric, not a regression signal. |
| `client-voice-errors` | 3 | Server-side `voice-failures` covers the regression case; client-side noise (mic permission denied) isn't a code regression. |
| `feature-nav-failure` | 2 | KQL requires `tapCount >= 3` per target screen in 1h — dev traffic doesn't sustain this. |
| `function-duration` | 3 | BGG sync is schedule-driven, not gated by main merges. |

**Implementation**:

1. Each dropped rule's bicep `resource` declaration was changed from `= {` to `= if (environment == 'prod') {`. Comments were added explaining the prod-only rationale per rule.
2. The 8 orphaned dev rules were deleted from Azure immediately so savings take effect this billing cycle:
   ```powershell
   $rg = 'gamer-uncle-dev-rg'
   $drop = @(
     'gamer-uncle-dev-http-429-rejections',
     'gamer-uncle-dev-agent-duration-p95',
     'gamer-uncle-dev-agent-transient-retries',
     'gamer-uncle-dev-low-quality-retries',
     'gamer-uncle-dev-voice-duration-p95',
     'gamer-uncle-dev-client-voice-errors',
     'gamer-uncle-dev-feature-nav-failure',
     'gamer-uncle-dev-function-duration'
   )
   foreach ($r in $drop) {
     az monitor scheduled-query delete --resource-group $rg --name $r --yes
   }
   ```
3. Verified: dev now has 8 rules (matches keep-list), prod still has 16 (unchanged).

**Coverage matrix — what regression scenarios the keep-8 still detects**:

| Bad commit / regression scenario | Keep-8 detects? |
|---|:---:|
| Unhandled exception in API controller | ✅ (`http-5xx-spike`) |
| Broken AI agent config (endpoint/ID/auth) | ✅ (`agent-fallback-rate`) |
| Mobile/backend JSON contract drift | ✅ (`client-api-errors`) |
| Game search query / Cosmos refactor breakage | ✅ (`game-search-errors`) |
| Game setup endpoint regression | ✅ (`game-setup-errors`) |
| Voice pipeline broken (Speech key, Foundry voice config, audio service) | ✅ (`voice-failures`) |
| L2 cache integration broken (Redis dep upgrade, Upstash key) | ✅ (`redis-l2-failures`) |
| Mobile Timer/Dice/Team tool regression | ✅ (`tool-feature-errors`) |
| AI latency regression | ❌ (intentional — too noisy in dev; covered by prod alert) |
| BGG function slowdown | ❌ (intentional — not a main-merge gate; covered by prod alert) |

**Cost driver math**: Azure Monitor scheduled query rules are billed per rule per month. A 5-min eval rule runs 8,640 times/mo; a 15-min rule 2,880; a 30-min rule 1,440. Dev cost dropped from ~$15/mo (16 rules) to ~$6/mo (8 rules).

**Risk**: Low. The 8 dropped rules collectively had **zero activations** in the prior 5 weeks. Even if a regression in one of those failure domains slipped past dev, the corresponding **prod** alert (still in place) would catch it during canary/initial prod traffic. Dev now functions as a focused "merge gate" rather than a duplicate of prod.

**Reversal**: To restore any dropped rule, remove the `if (environment == 'prod')` guard in `log-alerts.bicep` and redeploy. The alert resource will be recreated with the same name on the next pipeline run.
