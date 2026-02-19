# Azure Cost Analysis & Savings Plan — Gamer Uncle

> **Date**: February 17, 2026  
> **Updated**: February 17, 2026 — Cross-referenced with [scaling_analysis.md](../performance/scaling_analysis.md) traffic projections  
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

1. [Current Monthly Spend](#current-monthly-spend)
2. [Cost Breakdown by Service](#cost-breakdown-by-service)
3. [Resource Inventory](#resource-inventory)
4. [Optimization Recommendations](#optimization-recommendations)
5. [Dev Environment — Keep It Lean](#dev-environment--keep-it-lean)
6. [Prod Environment — Optimize for Value](#prod-environment--optimize-for-value)
7. [Projected Monthly Savings](#projected-monthly-savings)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Traffic Milestone Triggers](#traffic-milestone-triggers)

---

## Current Monthly Spend

Data from Azure Cost Management API. February is month-to-date (17 days); January is a full month.

| Environment | January 2026 (full month) | February 2026 (17 days, projected full month) |
|-------------|:-------------------------:|:---------------------------------------------:|
| **Dev** (`gamer-uncle-dev-rg`) | **$70.12** | ~$76 |
| **Prod** (`gamer-uncle-prod-rg`) | **$207.02** | ~$189 |
| Other (defaultresourcegroup-wus) | $1.42 | ~$22 |
| **Total** | **~$279** | **~$287/mo** |

---

## Cost Breakdown by Service

### Dev Environment — January 2026 ($70.12/mo)

| Service | Jan 2026 Cost | % of Dev | Notes |
|---------|:------------:|:--------:|-------|
| Azure Front Door | $35.00 | 50% | Standard_AzureFrontDoor — base fee is **$35/mo** regardless of traffic |
| Azure App Service | $32.74 | 47% | B1 plan (1 instance) — ~$54/mo list price, pro-rated |
| Foundry Models (AI) | $2.12 | 3% | GPT-4.1 + GPT-4.1-mini usage |
| Storage | $0.12 | <1% | 2× Standard_LRS accounts |
| Log Analytics | $0.14 | <1% | Low ingestion |
| Functions | $0.00 | 0% | Consumption plan (Y1) — within free grant |
| Key Vault | $0.00 | 0% | Minimal operations |
| Cosmos DB | $0.00 | 0% | **Free tier** enabled — 1000 RU/s + 25 GB free |

### Prod Environment — January 2026 ($207.02/mo)

| Service | Jan 2026 Cost | % of Prod | Notes |
|---------|:------------:|:---------:|-------|
| App Service | **$98.95** | 48% | **P1v3** plan (1 instance) — PremiumV3 tier |
| Cosmos DB | **$71.60** | 35% | Autoscale 100–4000 RU/s, **free tier NOT enabled** |
| Azure Front Door | **$35.01** | 17% | Standard_AzureFrontDoor — same $35/mo base |
| Foundry Models (AI) | $0.79 | <1% | GPT-4.1 + GPT-4.1-mini + GPT-realtime |
| Foundry Tools | $0.54 | <1% | Agent orchestration |
| Storage | $0.10 | <1% | 2× Standard_LRS accounts |
| Log Analytics | $0.03 | <1% | Low ingestion |
| Functions | $0.00 | 0% | Consumption plan (Y1) — within free grant |
| Key Vault | $0.00 | 0% | Minimal operations |

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
| gamer-uncle-dev-log-analytics-ws | Log Analytics | PerGB2018, 30d retention | ~$0.14 |
| gamer-uncle-dev-app-insights | Application Insights | (no sampling) | Included in Log Analytics |
| gameruncledevstorage | Storage Account | Standard_LRS | ~$0.06 |
| gameruncledevfuncstorage | Storage Account | Standard_LRS | ~$0.06 |
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
| gamer-uncle-prod-cosmos | Cosmos DB | Autoscale 100–4000 RU/s, **no free tier** | ~$72 |
| gamer-uncle-prod-vault | Key Vault | Standard | ~$0 |
| gamer-uncle-prod-log-analytics-ws | Log Analytics | PerGB2018, 30d retention | ~$0 |
| gamer-uncle-prod-app-insights | Application Insights | (no sampling) | Included in Log Analytics |
| gameruncleprodstorage | Storage Account | Standard_LRS | ~$0.05 |
| gameruncleprofuncstorage | Storage Account | Standard_LRS | ~$0.05 |
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
| 1 | [Downgrade prod App Service from P1v3 to S1](#1-downgrade-prod-app-service-from-p1v3) | Prod | **10** | **4** | $45/mo (temporary) | Temporary savings | 🟠 |
| 2 | [Consolidate dev AFD onto prod profile](#2-consolidate-dev-afd-onto-prod-profile) | Dev | **9** | **2** | $35/mo | Safe at scale | ✅ |
| 3 | [Switch prod Cosmos DB to serverless or lower autoscale](#3-switch-prod-cosmos-db-to-serverless-or-lower-autoscale) | Prod | **9** | **5** | $54/mo (temporary) | Temporary savings | 🟠 |
| 4 | [Downgrade dev App Service from B1 to Free/Shared or use deployment slots](#4-downgrade-dev-app-service) | Dev | **8** | **3** | $25–31/mo | Safe at scale | ✅ |
| 5 | [Use Azure Reserved Instances for prod App Service](#5-use-azure-reserved-instances-for-prod-app-service) | Prod | **7** | **2** | $15–30/mo (defer) | Depends on tier | 🟠 |
| 6 | [Optimize Cosmos DB indexing policy](#6-optimize-cosmos-db-indexing-policy) | Prod | **5** | **3** | $5–15/mo (RU savings) | Complementary | ✅ |
| 7 | [Route more traffic through AI mini model](#7-route-more-traffic-through-ai-mini-model) | Both | **4** | **3** | $0.50–2/mo (grows with scale) | Complementary | 🟠 |
| 8 | [Delete unused dev AI Foundry eastus2 resource](#8-delete-unused-dev-ai-foundry-eastus2-resource) | Dev | **3** | **1** | $0–2/mo | Safe at scale | ✅ |
| 9 | [Enable Application Insights sampling](#9-enable-application-insights-sampling) | Both | **3** | **2** | $1–5/mo (at scale) | Complementary | 🟠 |
| 10 | [Set Log Analytics daily cap on dev](#10-set-log-analytics-daily-cap-on-dev) | Dev | **2** | **1** | $1–2/mo | Safe at scale | 🟠 |
| 11 | [Consolidate or delete extra storage accounts](#11-consolidate-or-delete-extra-storage-accounts) | Both | **1** | **1** | <$1/mo | Safe at scale | 🟠 |

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

### 10. Set Log Analytics Daily Cap on Dev

| | |
|---|---|
| **Cost Contributor** | 2/10 |
| **Risk** | 1/10 |
| **Savings** | $1–2/mo |
| **Implemented** | 🟠 |

**Current state**: Both dev and prod Log Analytics workspaces have `dailyQuotaGb: -1` (unlimited). Dev is currently low cost ($0.14/mo) but this will grow as you add more logging at scale.

**Recommendation**: Set a daily cap of 0.5 GB/day on dev to prevent surprise cost spikes. First 5 GB/mo is free with Log Analytics.

---

## Prod Environment — Optimize for Value

### 1. Downgrade Prod App Service from P1v3

| | |
|---|---|
| **Cost Contributor** | 10/10 |
| **Risk** | 4/10 |
| **Savings** | $45/mo (temporary — ~2-3 months) |
| **Scale Impact** | **Temporary savings** — upgrade back to S2/P1v3 at 500+ users |
| **Implemented** | 🟠 |

**Current state**: Prod runs on **P1v3** (PremiumV3, 1 instance) at ~$99/mo. P1v3 provides 2 vCPUs, 8 GB RAM, enhanced networking, and deployment slot support.

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
| **Implemented** | 🟠 |

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
| **Implemented** | 🟠 |

**Current state**: Neither dev nor prod has Application Insights sampling enabled (`samplingPercentage: null`). Every request, dependency call, and trace is ingested at 100%.

**Why it matters at scale**: At 1,000 users, 100% ingestion will generate significant Log Analytics data volume. Log Analytics charges $2.76/GB after the free 5 GB/mo.

**Recommendation**: Enable adaptive sampling in prod (default keeps ~5 events/sec). In dev, set fixed-rate sampling at 25% to minimize cost while keeping enough data for debugging.

---

### 11. Consolidate or Delete Extra Storage Accounts

| | |
|---|---|
| **Cost Contributor** | 1/10 |
| **Risk** | 1/10 |
| **Savings** | <$1/mo |
| **Implemented** | 🟠 |

**Current state**: Each environment has 2 storage accounts — one for the app and one for Functions. Total cost is negligible (~$0.12/mo combined).

**Recommendation**: Low priority. Keep as-is unless you want to simplify resource count.

---

## Projected Monthly Savings

### Scenario 1 — Immediate Savings (~60 users, Months 0–3)

These savings apply **now** while traffic is low. Some are temporary and will be reversed as users grow.

| Recommendation | Dev Savings | Prod Savings | Duration | Notes |
|----------------|:-----------:|:------------:|:--------:|-------|
| #1 — Downgrade prod App Service to S1 | – | $45 | Temporary (3 mo) | Upgrade to S2/P1v3 at 500+ users |
| #2 — Consolidate dev AFD onto prod | $35 | – | Permanent | ✅ Dev endpoint on prod AFD profile |
| #3 — Lower Cosmos DB autoscale to 1000 | – | $54 | Temporary (2–3 mo) | Raise back to 4000 at 500+ users |
| #4 — Downgrade dev App Service (nightly F1 parking) | $25–31 | – | Permanent | ✅ Nightly scale-down + auto scale-up |
| #5 — Reserved Instance | – | – | Deferred | Wait until tier stabilizes (Month 4+) |
| #6 — Optimize Cosmos indexing | – | $5–15 | Permanent | Reduces RU consumption |
| #7 — Route to mini model | $0.25 | $0.50 | Permanent | Complementary to scaling |
| #8 — Delete unused dev AI Foundry eastus2 | $0–2 | – | Permanent | Unused resource |
| #9 — Enable App Insights sampling | $1 | $2 | Permanent | Complementary to scaling |
| #10 — Set dev Log Analytics cap | $1–2 | – | Permanent | |
| #11 — Consolidate storage | <$1 | <$1 | Permanent | Low priority |
| **Totals (Months 0–3)** | **$52–60/mo** | **$107–117/mo** | | |

### Scenario 2 — At Scale (~1,000 users, Month 3+)

Temporary savings from #1 and #3 are reversed. Permanent optimizations continue.

| Recommendation | Dev Savings | Prod Savings | Notes |
|----------------|:-----------:|:------------:|-------|
| #1 — App Service tier | – | **$0** (back to S2/P1v3) | Upgraded for autoscaling at 1,000 users |
| #2 — Consolidate dev AFD onto prod | $35 | – | Permanent | ✅ |
| #3 — Cosmos DB autoscale | – | **$0** (back to 4000 max) | Restored for burst traffic capacity |
| #4 — Dev App Service | $25–31 | – | Permanent ✅ |
| #5 — Reserved Instance | – | $30 | Purchase RI once tier is stable (Month 4+) |
| #6 — Cosmos indexing | – | $5–15 | Permanent; saves more RUs at higher traffic |
| #7 — Mini model routing | $0.25 | $5–15 | Grows with scale; significant at 1,000 users |
| #8 — Delete dev AI Foundry eastus2 | $0–2 | – | Permanent |
| #9 — App Insights sampling | $1 | $2 | Permanent; more impactful at scale |
| #10 — Dev Log Analytics cap | $1–2 | – | Permanent |
| #11 — Storage consolidation | <$1 | <$1 | |
| **Totals (Month 3+)** | **$52–60/mo** | **$42–63/mo** | |

### Summary: Cost Trajectory Over Time

| Period | Dev Spend | Prod Spend | Total | vs. Current ($277) |
|--------|:---------:|:----------:|:-----:|:-------------------:|
| **Current** | ~$70/mo | ~$207/mo | ~$277/mo | – |
| **Months 0–3** (low traffic) | ~$15/mo | ~$95/mo | **~$110/mo** | **60% reduction** |
| **Month 3+** (1,000 users) | ~$15/mo | ~$160–175/mo | **~$175–190/mo** | **31–37% reduction** |
| **Month 4+** (with RI) | ~$15/mo | ~$135–150/mo | **~$150–165/mo** | **40–46% reduction** |

> **Key insight**: You get the deepest savings (~60%) in the first 3 months when traffic is low. As you scale to 1,000 users, costs increase but are still **30–46% below today's spend** thanks to permanent optimizations (dev cleanup, indexing, sampling, mini model routing, reserved instances).

---

## Implementation Roadmap

### Phase 1 — Quick Wins (This Week, ~$134/mo immediate savings)
- [x] **#2**: Consolidate dev AFD onto prod profile → **$35/mo saved** (permanent) — completed Feb 2026
- [x] **#8**: Delete `gamer-uncle-dev-foundry-eastus2` resource → **$0–2/mo saved** (permanent) — completed Feb 2026
- [ ] **#3**: Lower prod Cosmos DB autoscale max from 4000 to 1000 RU/s → **$54/mo saved** (temporary)
  - ⚠️ **Prerequisite**: Fix CosmosClientOptions (scaling Finding #4) first
- [ ] **#1**: Downgrade prod App Service from P1v3 to S1 → **$45/mo saved** (temporary)

### Phase 2 — Moderate Effort (Next Sprint, $20/mo additional savings)
- [x] **#4**: Nightly F1 parking + auto scale-up in pipeline/testit → **$25–31/mo saved** (permanent) — completed Feb 2026
  - Nightly scale-down: `pipelines/dev-scaledown-schedule.yml` (11 PM PT daily)
  - Pipeline scale-up: `DevDeployApi` stage auto-scales to B1 before deploying
  - Manual toggle: `scripts/dev-appservice-toggle.ps1 start|stop|status`
  - testit integration: Auto-scales when `API_ENVIRONMENT=dev`
- [ ] **#10**: Set dev Log Analytics daily cap to 0.5 GB → **$1–2/mo saved** (permanent)
- [ ] **#9**: Enable App Insights adaptive sampling in prod → **$2/mo saved** (permanent)

### Phase 3 — Optimization at Scale (Before Marketing Push)
- [x] **#6**: Optimize Cosmos DB indexing policy → **$5–15/mo saved** (permanent, grows with scale) — completed Feb 2026
- [ ] **#7**: Evaluate mini model routing for simple queries → growing savings (permanent)

### Phase 4 — Scale-Up Actions (When Traffic Grows)
These are **cost increases** that reverse temporary savings, triggered by traffic milestones.

- [ ] **#3 reversal**: Raise Cosmos DB autoscale max back to **2000 RU/s** at 200+ users, **4000 RU/s** at 500+ users
- [ ] **#1 reversal**: Upgrade App Service from S1 to **S2/P1v3** at 500+ users; enable autoscaling (min 2, max 4)
- [ ] **#5**: Purchase reserved instance once prod tier stabilizes (Month 4+) → **$30/mo saved** (permanent)

---

## Traffic Milestone Triggers

Use this table to decide when to reverse temporary cost savings and scale up resources.

| Milestone | Installs | DAU (est.) | Peak Concurrent | Actions |
|-----------|:--------:|:----------:|:---------------:|---------|
| **Current** | ~60 | ~9 | ~5 | Implement Phase 1 & 2 cost savings (save ~$154/mo) |
| **200 users** | 200 | ~30 | ~10 | Raise Cosmos autoscale max to 2,000 RU/s; enable App Service autoscale (min 1, max 2) |
| **500 users** | 500 | ~75 | ~25 | Raise Cosmos autoscale max to 4,000 RU/s; evaluate S1 → S2 upgrade; implement distributed rate limiting |
| **1,000 users** | 1,000 | ~150 | ~50 | Upgrade to S2/P1v3 with 2–4 instances; verify AI Foundry TPM quotas; purchase reserved instance |

### How to Monitor These Triggers

| Metric | Where to Check | Threshold |
|--------|----------------|-----------|
| User installs | App Store Connect / Google Play Console | Milestone numbers above |
| Cosmos DB RU consumption | Azure Portal → Cosmos DB → Metrics → Normalized RU Consumption | >70% of max sustained |
| Cosmos DB 429 errors | Azure Portal → Cosmos DB → Metrics → Total Requests (filter status=429) | Any sustained 429s |
| App Service CPU | Azure Portal → App Service → Metrics → CPU Percentage | >70% sustained |
| App Service response time | Application Insights → Performance | P95 > 3 seconds |
| AI Foundry TPM | Azure Portal → AI Foundry → Deployments → Metrics | >80% of quota |