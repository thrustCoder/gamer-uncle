# Azure Functions .NET 8 → .NET 10 Upgrade Implementation Plan

## Trigger

**Azure Service Health advisory (Tracking ID: 0RYZ-CKZ)**:
> Support for .NET 8 ends on 10 November 2026—upgrade your apps to .NET 10.
> You're receiving this notification because you're associated with one or more Azure
> subscriptions that use .NET 8 app(s) on Azure Functions. Your Azure Function Apps will
> continue to operate, but security updates will no longer be provided.

- **Deadline**: 10 November 2026
- **Date of Assessment**: 2 July 2026
- **Runway**: ~4 months
- **Affected subscription**: `e1a26719-3504-42e4-bc8c-05aa63259e4b` (Visual Studio Enterprise Subscription)
- **Status**: ⬜ Not started — scoping only

### The good news (up front)

The email's *primary* concern — the in-process → isolated worker migration — **does not apply
to us**. `GamerUncle.Function.BggSync` is **already on the isolated worker model**
(`Microsoft.Azure.Functions.Worker.*` packages, `<OutputType>Exe</OutputType>`,
`AzureFunctionsVersion v4`). We only need the **direct .NET 8 → .NET 10 upgrade path**.

### The catch (the real work)

.NET 10 isolated is GA on Azure Functions (announced Feb 2026), **but the Linux Consumption
plan does not support .NET 10**. Both our function apps deploy as `functionAppLinux` with
`runtimeStack: 'DOTNET-ISOLATED|8.0'` (i.e., Linux Consumption). The dominant scope item is
therefore a **hosting-plan migration to Flex Consumption**, not the code/package bump.

---

## Scope Summary

Only **one** Azure Functions app is in scope (dev + prod instances of the same project):

| Item | Value |
|---|---|
| Function project | `services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj` |
| Test project | `services/tests/functions/GamerUncle.Functions.Tests.csproj` |
| Shared dependency | `services/shared/models/GamerUncle.Shared.Models.csproj` (also referenced by the net8 API) |
| Dev app | `gamer-uncle-dev-function` (RG `gamer-uncle-dev-rg`) |
| Prod app | `gamer-uncle-prod-function` (RG `gamer-uncle-prod-rg`) |
| Pipeline | `pipelines/azure-pipelines.yml` |

> **Out of scope**: `GamerUncle.Api` (App Service, not Functions — the email is Functions-only)
> and `GamerUncle.Mcp`. They remain on `net8.0` for now. This spec covers **Functions only**.

---

## Current State

| Component | Current | Target | Notes |
|---|---|---|---|
| Function `TargetFramework` | `net8.0` | `net10.0` | `GamerUncle.Function.BggSync.csproj` line 4 |
| Worker model | Isolated ✅ | Isolated | No in-process migration needed |
| `AzureFunctionsVersion` | `v4` | `v4` | No change |
| `Microsoft.Azure.Functions.Worker` | `1.21.0` | ≥ `2.50.0` | Major bump required for .NET 10 |
| `Microsoft.Azure.Functions.Worker.Sdk` | `1.17.0` | ≥ `2.0.5` | Major bump required for .NET 10 |
| `...Worker.Extensions.Http` | `3.1.0` | latest 3.x/4.x | Align with Worker 2.x |
| `...Worker.Extensions.Timer` | `4.3.1` | latest | Align with Worker 2.x |
| `...Worker.Extensions.CosmosDB` | `4.0.0` | latest | Align with Worker 2.x |
| `...Worker.Extensions.DurableTask` | `1.1.0` | latest | Durable is supported on Flex Consumption |
| `Microsoft.DurableTask.Client` | `1.10.0` | latest | |
| `Microsoft.DurableTask.Worker` | `1.10.0` | latest | |
| `Azure.Identity` | `1.12.0` | latest | Optional but recommended |
| `Azure.Data.Tables` | `12.8.3` | latest | Optional |
| `Microsoft.Azure.Cosmos` | `3.41.0` | latest | Optional |
| `Microsoft.ApplicationInsights.WorkerService` | `2.22.0` | latest | Optional |
| Test project `TargetFramework` | `net8.0` | `net10.0` | Must match — a net8 test project cannot reference a net10 project |
| Test `Microsoft.Extensions.Hosting` | `8.0.0` | `10.0.0` | Align to .NET 10 |
| Shared models `TargetFramework` | `net8.0` | `net8.0` (keep) | net10 function can reference a net8 lib; net8 API cannot reference net10 — so **leave shared at net8** |
| Pipeline `UseDotNet@2` (function job) | `8.x` | `10.x` | Function build job (line ~161) |
| Pipeline `runtimeStack` (dev + prod) | `DOTNET-ISOLATED\|8.0` | `DOTNET-ISOLATED\|10.0` | Lines 492 & 1173 |
| Hosting plan | Linux **Consumption** | **Flex Consumption** | ⚠️ Consumption Linux does NOT support .NET 10 |

---

## Risk Assessment: 6 / 10

### Why moderate-high (not low):

- **Hosting-plan migration is the crux.** Linux Consumption cannot run .NET 10. Moving to Flex
  Consumption is not a config flip — it typically means creating a new plan + function app (or
  recreating in place), re-wiring app settings, managed identity role assignments (Cosmos, Tables,
  Key Vault), the timer/Durable task hub storage, and the deployment task. App name/URL and the
  host key may change, which affects any callers and the pipeline's post-deploy verification steps.
- **Durable Functions storage/task hub** behavior must be re-validated on the new plan.
- **Two environments** (dev + prod) must both be migrated and verified.
- Worker 1.x → 2.x is a **major version jump** with possible minor API/attribute changes.

### Why it isn't higher:

- Already on the isolated model — the hardest conceptual migration is done.
- Single, small function project (BGG sync) with a clear, testable output (Cosmos upsert).
- ~4 months of runway; the app keeps running on .NET 8 past the deadline (just unsupported).
- Flex Consumption is the Microsoft-recommended successor and supports Durable + timers.

---

## Scope of Changes

### 1. Function project package + TFM upgrade (Effort: Medium | Risk: 4/10)

`services/functions/GamerUncle.Function.BggSync/GamerUncle.Function.BggSync.csproj`:
- `<TargetFramework>net8.0</TargetFramework>` → `net10.0`
- Bump `Microsoft.Azure.Functions.Worker` → ≥ 2.50.0 and `Worker.Sdk` → ≥ 2.0.5
- Bump all `Worker.Extensions.*` and `Microsoft.DurableTask.*` to versions compatible with
  Worker 2.x (resolve concrete versions at implementation time — pin, don't float)
- Optionally refresh `Azure.Identity`, `Azure.Data.Tables`, `Microsoft.Azure.Cosmos`,
  `Microsoft.ApplicationInsights.WorkerService`
- Rebuild and resolve any analyzer/attribute breaking changes from the Worker 2.x SDK

### 2. Test project upgrade (Effort: Low | Risk: 2/10)

`services/tests/functions/GamerUncle.Functions.Tests.csproj`:
- `<TargetFramework>net8.0</TargetFramework>` → `net10.0` (mandatory — it references the
  function project, and a net8 project cannot reference a net10 project)
- `Microsoft.Extensions.Hosting` `8.0.0` → `10.0.0`
- Consider refreshing test SDK / xunit packages; re-run the full function test suite

### 3. Shared models project (Effort: None | Risk: 1/10)

**Leave `GamerUncle.Shared.Models` on `net8.0`.** A net10 function project can reference a net8
library, and the net8 API still needs it. Do **not** bump it to net10 or the API build breaks.
(Future: multi-target `net8.0;net10.0` only when the API also moves to .NET 10.)

### 4. Hosting-plan migration: Consumption → Flex Consumption (Effort: High | Risk: 6/10) ⚠️ CRITICAL

This is the item that actually unblocks .NET 10. Options:

- **Option A (recommended): Flex Consumption.** Create a Flex Consumption plan + function app for
  dev and prod; migrate app settings, managed identity + RBAC (Cosmos, Tables, Key Vault),
  AzureWebJobsStorage / Durable task-hub storage, and the timer schedule. Validate Durable
  orchestration end-to-end. Update the pipeline deploy task accordingly.
- **Option B: Elastic Premium (EP1) or App Service plan.** Supports .NET 10 without moving to
  Flex, but costs more (no scale-to-zero). Only if Flex proves problematic for Durable.

Decisions to confirm before implementation:
- New app name/URL vs. in-place recreation (affects callers, host keys, pipeline verification)
- Whether infra is codified anywhere (no Bicep/Terraform exists for the function app today — it
  appears to be created out-of-band; the pipeline only sets app settings + deploys). Decide
  whether to introduce IaC as part of this migration.

### 5. Pipeline updates (Effort: Medium | Risk: 3/10)

`pipelines/azure-pipelines.yml`:
- Function **build** job `UseDotNet@2 version: '8.x'` → `'10.x'` (line ~161). Leave the API/test
  jobs' `8.x` installs alone (API stays net8), or install both SDKs where a job builds both.
- `AzureFunctionApp@1` `runtimeStack: 'DOTNET-ISOLATED|8.0'` → `'DOTNET-ISOLATED|10.0'`
  (dev line 492, prod line 1173).
- If the plan changes to Flex Consumption, revisit `appType`/deploy task inputs and the
  post-deploy verification (`linuxFxVersion` query, base-URL health check, host-key retrieval).
- Update `pipelines/tests/GamerUncle.Pipeline.Tests.csproj` expectations if any test asserts the
  `8.0` runtime stack string.

### 6. Local dev tooling (Effort: Low | Risk: 1/10)

- Install the **.NET 10 SDK** locally.
- Update **Azure Functions Core Tools** to the latest v4 (required for .NET 10 isolated local run).
- Update `.vscode/launch.json` if it pins an `8.0` target path.

---

## Implementation Steps (for the future implementation PR — not done yet)

### Phase 0: Confirm decisions
1. ⬜ Confirm hosting-plan target (Flex Consumption vs Elastic Premium).
2. ⬜ Confirm in-place recreation vs. new app name; capture current app settings + RBAC.
3. ⬜ Confirm whether to introduce IaC (Bicep) for the function app during migration.

### Phase 1: Code + package upgrade
4. ⬜ Create feature branch.
5. ⬜ Bump function `.csproj` TFM + Worker/extension/Durable packages.
6. ⬜ Bump test `.csproj` TFM + `Microsoft.Extensions.Hosting`.
7. ⬜ `dotnet build` + fix any Worker 2.x breaking changes.
8. ⬜ Run function unit tests (`services/tests/functions`) — all green.
9. ⬜ Run locally with Core Tools v4 on .NET 10; verify timer + Durable orchestration + Cosmos upsert.

### Phase 2: Infra / hosting migration (dev)
10. ⬜ Provision Flex Consumption plan + dev function app; migrate settings, identity, RBAC, storage.
11. ⬜ Update pipeline (`UseDotNet 10.x`, `runtimeStack DOTNET-ISOLATED|10.0`, deploy task/verification).
12. ⬜ Deploy to dev; verify runtime shows .NET 10, function triggers, and BGG sync completes.

### Phase 3: Production migration
13. ⬜ Repeat plan migration for prod function app.
14. ⬜ Deploy to prod; verify runtime + a successful sync run.
15. ⬜ Confirm no callers/host-key breakage.

### Phase 4: Verify & close
16. ⬜ Confirm the Service Health advisory (0RYZ-CKZ) no longer flags the subscription.
17. ⬜ Update this spec's status to Complete.

---

## Rollback Plan

- Code/package changes are isolated to a feature branch — revert if the build or tests regress.
- Keep the existing .NET 8 Consumption function app running until the .NET 10 Flex app is verified;
  cut over only after a successful dev + prod validation. The app continues to run on .NET 8 past
  the deadline (unsupported, but functional), so there is no hard outage risk if rollback is needed.

---

## Open Questions

1. **Hosting plan**: Flex Consumption (recommended, scale-to-zero) or Elastic Premium (simpler
   Durable story, higher cost)?
2. **In-place vs new app**: Recreate `gamer-uncle-{dev,prod}-function` in place, or stand up new
   apps and cut over? Impacts URLs, host keys, and pipeline verification.
3. **IaC**: There is no Bicep/Terraform for the function app today. Do we codify it during this
   migration or continue managing it via portal + pipeline app-settings?
4. **API timing**: Do we bump `GamerUncle.Api` (App Service) to .NET 10 in the same effort, or
   defer? (Not required by this advisory, but App Service .NET 8 has its own end-of-support.)

---

## References

- Azure Service Health advisory — Tracking ID **0RYZ-CKZ** (Service Health → Health advisories)
- [Generally Available: Azure Functions .NET 10 support](https://devicebase.net/en/microsoft-azure/updates/generally-available-azure-functions-net-10-support/8qi) (Feb 2026)
- [Guide for running C# Azure Functions in an isolated worker process](https://learn.microsoft.com/en-us/azure/azure-functions/dotnet-isolated-process-guide)
- [Update language stack versions in Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/update-language-versions)
- [Tracking thread: .NET 10 support (azure-functions-dotnet-worker #3152)](https://github.com/Azure/azure-functions-dotnet-worker/issues/3152) — min versions: Worker ≥ 2.50.0, Worker.Sdk ≥ 2.0.5
- [Azure Functions Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [Migrate to the isolated worker model](https://learn.microsoft.com/en-us/azure/azure-functions/migrate-dotnet-to-isolated-model) (reference only — we're already isolated)
