# Azure Functions .NET 8 -> .NET 10 Migration Specification

## Trigger

**Azure Service Health advisory (Tracking ID: 0RYZ-CKZ)**:
> Support for .NET 8 ends on 10 November 2026—upgrade your apps to .NET 10.
> You're receiving this notification because you're associated with one or more Azure
> subscriptions that use .NET 8 app(s) on Azure Functions. Your Azure Function Apps will
> continue to operate, but security updates will no longer be provided.

- **Deadline**: 10 November 2026
- **Live Azure assessment**: 8 November 2026
- **Spec updated**: 9 November 2026
- **Runway**: One calendar day until the published deadline; treat this as urgent.
- **Affected subscription**: `e1a26719-3504-42e4-bc8c-05aa63259e4b` (Visual Studio Enterprise Subscription)
- **Status**: Draft for review; implementation and resource changes have not started.

This specification establishes the proposed change, approval gates, and acceptance criteria.
Updating or approving this document does not authorize provisioning, deployment, disabling
triggers, stopping apps, changing access, or deleting resources. Those actions require separate
implementation approval.

The deadline is an end-of-support date, not an automatic shutdown date. Existing apps continue
to operate, but .NET 8 no longer receives security updates or support after that date. Continued
operation is not a reason to defer the upgrade or a guarantee of uninterrupted service.

### The good news (up front)

The email's in-process -> isolated worker migration path **does not apply to us**.
`GamerUncle.Function.BggSync` is **already on the isolated worker model**
(`Microsoft.Azure.Functions.Worker.*` packages, `<OutputType>Exe</OutputType>`,
`AzureFunctionsVersion v4`). Both live apps also report `DOTNET-ISOLATED|8.0`.
No in-process migration or Functions host major-version upgrade is required.

### The catch (the real work)

.NET 10 isolated is supported on Azure Functions, **but Linux Consumption does not support
.NET 10**. Live resource inspection confirmed that both apps use Linux Consumption
(`Y1` / `Dynamic`); the pipeline's `functionAppLinux` value alone does not establish their plan.
The dominant scope item is a **side-by-side migration to new Flex Consumption apps**, not just
a code/package bump or a portal runtime-setting change.

---

## Scope Summary

One Functions code project and its **two deployed Function Apps** are in scope:

| Item | Value |
|---|---|
| Function project | `services\functions\GamerUncle.Function.BggSync\GamerUncle.Function.BggSync.csproj` |
| Test project | `services\tests\functions\GamerUncle.Functions.Tests.csproj` |
| Shared dependency | `services\shared\models\GamerUncle.Shared.Models.csproj` (also referenced by the net8 API) |
| Dev app | `gamer-uncle-dev-function` (RG `gamer-uncle-dev-rg`) |
| Prod app | `gamer-uncle-prod-function` (RG `gamer-uncle-prod-rg`) |
| Pipeline | `pipelines\azure-pipelines.yml` |
| Operational dependencies | Deployment verification, function callers/keys, maintenance scripts, monitoring, and alert resource references |

`GamerUncle.Api` and `GamerUncle.Mcp` runtime upgrades are **out of scope for this change**, not
exempt from .NET 8 end-of-support. They also target `net8.0` and require separate, independently
deployable upgrade work against the same .NET support deadline. Any deferral requires explicit
risk ownership; completing this spec's migration does not make the entire backend supported.

No mobile store release, mobile version bump, API contract change, Cosmos schema change, BGG
selection change, or timer cadence change is intended. Existing supported mobile clients must
continue to work unchanged.

---

## Current State

The live findings below were observed on **8 November 2026** in the advisory's subscription.
Reconfirm them during implementation preflight; they are not a completed migration-readiness
assessment.

| App | Region | OS / plan | Runtime | State |
|---|---|---|---|---|
| `gamer-uncle-dev-function` | West US | Linux / Consumption (`Y1`, `Dynamic`) | `DOTNET-ISOLATED\|8.0` | Running |
| `gamer-uncle-prod-function` | West US | Linux / Consumption (`Y1`, `Dynamic`) | `DOTNET-ISOLATED\|8.0` | Running |

Both apps have system-assigned and user-assigned managed identities, HTTPS-only enabled, and
client certificates disabled. Existing user-assigned identities are
`gamer-uncle-dev-function-uami` and `gamer-uncle-prod-function-uami`. The startup code selects the
identity through `AZURE_CLIENT_ID`; the replacement must preserve that configuration and verify
the identity's actual access to dependencies.

Azure CLI listed **West US** as supporting Flex Consumption and listed **.NET 10 isolated**
as an available Flex runtime there. Subscription quota, cost, deployment permissions, complete
configuration compatibility, identity role coverage, and active Durable instances remain
unverified. The local machine had .NET 8 and 9 SDKs installed, but no .NET 10 SDK.

The repository changes are bounded as follows; exact dependency versions must be pinned during
implementation rather than using floating `latest` references.

| Component | Current | Target | Notes |
|---|---|---|---|
| Function `TargetFramework` | `net8.0` | `net10.0` | `GamerUncle.Function.BggSync.csproj` line 4 |
| Worker model | Isolated | Isolated | No in-process migration needed |
| Functions host | `v4` | `v4` | Do not confuse host version with .NET version |
| `Microsoft.Azure.Functions.Worker` | `1.21.0` | Supported stable .NET 10 version; current guide specifies at least `2.50.0` | Validate Worker 2.x behavior changes |
| Build SDK | `Microsoft.Azure.Functions.Worker.Sdk` `1.17.0` | Supported .NET 10 build SDK, pinned | Current guide documents `Azure.Functions.Sdk` `1.0.0` or later; resolve SDK path before implementation |
| `...Worker.Extensions.Http` | `3.1.0` | Compatible pinned stable version | Preserve HTTP request/response behavior |
| `...Worker.Extensions.Timer` | `4.3.1` | Compatible pinned stable version | Preserve schedules and environment gating |
| `...Worker.Extensions.CosmosDB` | `4.0.0` | Compatible pinned stable version | Verify bindings and permissions |
| `...Worker.Extensions.DurableTask` | `1.1.0` | Compatible pinned stable version | Verify serialization and orchestration behavior |
| `Microsoft.DurableTask.Client` / `Worker` | `1.10.0` | Compatible pinned versions, if direct references remain necessary | Align with the Durable extension |
| Azure SDK / Application Insights packages | Existing pinned versions | Change only where required for compatibility or a directly relevant fix | Avoid unrelated dependency modernization |
| Test project `TargetFramework` | `net8.0` | `net10.0` | Must match — a net8 test project cannot reference a net10 project |
| Test `Microsoft.Extensions.Hosting` | `8.0.0` | Compatible pinned .NET 10 version | Align with the upgraded worker |
| Shared models `TargetFramework` | `net8.0` | `net8.0` (keep) | net10 function can reference a net8 lib; net8 API cannot reference net10 — so **leave shared at net8** |
| Pipeline SDK (function build/test jobs) | `8.x` build SDK | .NET 10 SDK | Keep .NET 8 available for unrelated net8 jobs |
| Deployment task (dev + prod) | `AzureFunctionApp@1` | `AzureFunctionApp@2`, `isFlexConsumption: true` | Task v1 does not support Flex |
| Runtime configuration | Legacy `runtimeStack` / `linuxFxVersion` | Flex `functionAppConfig.runtime`: `dotnet-isolated`, `10.0` | Do not configure Flex through the legacy deployment-task `runtimeStack` input |
| Hosting plan | Linux Consumption | Flex Consumption (`FC1`) | Separate replacement apps; no in-place recreation |

Source anchors: Functions project lines 4 and 21-29; `host.json` line 5; pipeline function build
job near line 161, deployments near lines 485 and 1166, and alert resource lookups near lines
956 and 1480. Line numbers describe the assessment baseline and may move during implementation.

---

## Risk Assessment

Risk is **moderate-high**, driven by stateful cutover and the short deadline, not by an
in-process migration.

| Risk | Required mitigation |
|---|---|
| Old and new apps compete for Durable work | Separate task hubs or storage during parallel operation; never run both deployments against the same hub |
| Duplicate timer or HTTP-started syncs | Keep replacement timer starters disabled until cutover; prevent new starts on the source before draining |
| Pending orchestrations are abandoned or replay incompatibly | Inventory and drain source work; do not assume live state can be copied to a new hub |
| Identity, storage, or secret access differs | Reattach the user-assigned identity and verify required access end-to-end; inventory system-assigned identity dependencies separately |
| Worker/SDK upgrade changes behavior | Pin compatible versions and exercise host startup, HTTP serialization, orchestration, and activity execution |
| Pipeline still deploys to or monitors the old app | Update deployment targets, scripts, callers, verification, alert references, and resource-specific service-connection permissions |
| Costs or scaling increase unexpectedly | Approve the estimate and explicit memory/concurrency/scale settings; use on-demand capacity unless always-ready instances are justified |
| Deadline pressure bypasses validation | Keep acceptance gates mandatory; record any missed deadline and unsupported-runtime exposure explicitly |

Existing isolation, one bounded code project, and observable Cosmos upserts reduce the code-change
scope. They do not remove the need for separate dev and production validation.

---

## Scope of Changes

### 1. Function project package + TFM upgrade

Retarget the Functions project to `net10.0` and pin a supported worker, build SDK, and compatible
binding/Durable dependencies. Confirm the current Microsoft guidance rather than treating an old
minimum `Worker.Sdk` version as the target.

If adopting `Azure.Functions.Sdk`, follow the documented project migration, including removing the
old `Microsoft.Azure.Functions.Worker.Sdk` reference and properties supplied by the new SDK. Verify
the direct project restore/build/publish sequence used by CI. Do not mix incompatible build SDK
paths or change function names, orchestration activity ordering, payload shapes, filters, or
schedules as part of this upgrade.

### 2. Test project and coverage

Retarget `GamerUncle.Functions.Tests` to `net10.0`, align hosting dependencies, and run all existing
Functions tests. Add or update unit tests for changed C# methods. Include a dedicated Functions
test job in CI; the existing API/mobile/pipeline test jobs are not a substitute for it. Do not
add tests solely for YAML edits.

Cloud verification must cover a small approved BGG sync through HTTP start, Durable orchestration,
activity execution, Cosmos upsert, and telemetry. A successful build, app root response, or
function listing alone does not prove that the migration works.

For the smoke test, use an explicit request covering **at most five approved candidate IDs**,
for example a bounded `GameSyncHighSignalStart` request with explicit `StartId` and `EndId`.
Select input expected to pass the existing filters and exercise a real BGG fetch and Cosmos
write. An orchestration that only skips existing games or returns no data is insufficient evidence.
Read back the expected document and correlate it with the instance/activity logs. Never delete
production documents to force a test write. Do not submit empty/default high-signal or ranked
requests: their defaults can scan very large ranges. Agree on a completion timeout during
preflight and fail the verification if it expires.

### 3. Shared models compatibility

**Leave `GamerUncle.Shared.Models` on `net8.0`.** The net10 Function can reference this library
while the net8 API/MCP consumers retain compatibility. A net8-targeted class library executing
inside a supported .NET 10 process does not require a separate .NET 8 process. Do not retarget
this shared project or add multi-targeting merely for this migration.

### 4. Hosting-plan migration: Consumption -> Flex Consumption

The proposed target is **new Flex Consumption apps alongside the existing apps**, in the same
resource groups and West US region, subject to quota and user approval. Retain the originals for
rollback; do not delete/recreate them to preserve their names. Replacement names remain to be
approved. Flex does not support deployment slots, so this is not a slot-swap deployment.

Inventory and deliberately translate settings, including storage, identity, Cosmos, BGG credentials,
Key Vault references if used, telemetry, environment selection, HTTPS/authentication, networking,
and scale/concurrency limits. Flex uses `functionAppConfig` for runtime, deployment storage, and
scaling; do not blindly copy legacy Consumption settings. Preserve secure secret handling and
existing authentication; no secret values belong in this spec, source control, or deployment logs.
Preserve `AzureWebJobsStorage` or its supported identity-based equivalents for required host and
Durable access. Flex deployment blob storage is not a replacement for Durable state storage;
validate the permissions for each use separately.

Reattach each environment's existing user-assigned identity and preserve `AZURE_CLIENT_ID`.
A new system-assigned identity is a different principal: discover and explicitly approve any
role assignments needed for it. New app URLs and function keys must be handled through approved
operational configuration, not assumed to match the originals.

The repository has alert Bicep templates, but the inspected infrastructure does not define the
Functions app/plan itself. Decide whether to add narrowly scoped provisioning IaC or an approved,
repeatable migration runbook. Do not expand this into a general infrastructure rewrite.

Elastic Premium or Dedicated hosting is a contingency requiring a separate compatibility, cost,
and approval decision if a concrete Flex blocker is found; it is not the default.

### 5. Durable state and trigger isolation

`services\functions\GamerUncle.Function.BggSync\host.json` explicitly sets the hub name to
`DurableFunctionsHub`. Copying that configuration and its backing storage to a running
replacement would make both apps compete for the same work.

- Use separate Durable storage or a unique task hub for every concurrently running replacement.
  Preserve the source hub and history; a new hub does not inherit outstanding instances.
- Configure replacement timer starters as disabled **before the first code deployment**. Separate
  hubs prevent message competition but do not prevent two timers from starting duplicate syncs.
- Inventory all HTTP and timer starters, including `GameSyncHttpStart`, `GameSyncHighSignalStart`,
  `GameSyncRankedStart`, `GameSyncTimerTriggerDev`, and `GameSyncTimerTriggerProd`.
- At cutover, prevent new source starts while leaving its orchestration/activity processing
  available to drain existing work. Stopping the source prematurely is not a drain strategy.
- Record pending, running, suspended, and other nonterminal source instances. Resolve them before
  retiring the source; do not silently terminate or abandon them to meet the deadline.
- Preserve environment gating and the schedules in code. Existing pipeline messages describe
  different cadences; do not use those messages as the source of truth.

The code currently uses `0 0 0 1 */3 *` for dev (quarterly) and `0 0 0 1 */6 *` for prod
(semiannual), with `RunOnStartup = false` and environment/past-due checks. Verify timer discovery
and gating without waiting months for the next scheduled execution or enabling a full default
sync during deployment.

### 6. Pipeline and operational references

Update `pipelines\azure-pipelines.yml` and the operational references that target the migrated
apps. Both environment deployments require the same migration treatment.

- Install the .NET 10 SDK in Function build/test jobs. Retain the .NET 8 SDK/runtime where
  unchanged API/MCP or existing test jobs require them; do not globally replace every `8.x`.
- Replace `AzureFunctionApp@1` with `AzureFunctionApp@2`, retain `appType: functionAppLinux`,
  and set `isFlexConsumption: true`. Configure .NET 10 through the Flex resource configuration,
  not the legacy `runtimeStack` task input, which applies to non-Flex Linux deployments.
- Update app names, settings targets, deployment permissions, maintenance scripts, function
  callers, and approved key distribution. Resolve `defaultHostName` from Azure rather than
  constructing or copying old hostnames.
- Update alert and suppression resource references, including the Function app ID lookups near
  lines 956 and 1480. Confirm monitoring follows the replacement, not just the retained source.
- Make verification fail on host errors, missing functions, failed orchestration, dependency
  errors, or missing expected telemetry. A root URL that returns HTTP 500/503 is not a success.
- Gate production Functions deployment on successful **Functions-specific dev validation** and
  explicit cutover approval. The existing API functional-test gate alone is insufficient.

### 7. Local development tooling

Install an approved .NET 10 SDK and compatible Azure Functions Core Tools v4 before local
verification. Update only Functions-specific debug paths if necessary. The current net8 launch
path for the out-of-scope API must not be mechanically rewritten. Follow the isolated worker
guide's Windows installation guidance for Core Tools; its `dotnet run` integration requires a
non-npm Core Tools installation.

---

## Implementation Steps (not executed)

The following phases are ordered gates, not permission to execute. Branch creation, commits,
pushes, provisioning, access changes, deployment, and source-app changes require their applicable
user approvals. This spec does not prescribe creating or switching a branch automatically.

### Phase 0: Preflight and decisions

The owner reviews the proposal and records unresolved blockers before implementation.

- [ ] Approve the target subscription, West US region, Flex plan, replacement names, cost
  estimate, and implementation scope.
- [ ] Pass the advisory subscription explicitly to Azure CLI operations; do not rely on the
  machine's active subscription, which differed during the assessment.
- [ ] Confirm quota/capacity, deployment permissions, dependency access, configuration compatibility,
  and provisioning approach.
- [ ] Capture a secure configuration/identity inventory and retain the original deployment artifact.
- [ ] Record all starters, callers, function-key handling, active Durable instances, and hub/storage
  isolation strategy; define drain and rollback procedures.
- [ ] Pin the worker/build SDK/dependency choices and identify any required behavior adaptations.
- [ ] Assign separate ownership for API/MCP runtime upgrades and any deadline exception.

### Phase 1: Code, tooling, and pipeline preparation

The Functions upgrade must be verifiable without deploying a net10 artifact to a Y1 app.

- [ ] Upgrade Functions and Functions tests, preserving shared models and existing contracts.
- [ ] Configure the .NET 10 tooling, targeted CI build/tests, and Flex-aware deployments.
- [ ] Build, run the Functions unit suite, and verify host startup/function discovery with Core Tools.
- [ ] Validate unchanged API/MCP consumers still build against the shared models.
- [ ] Stage pipeline targeting changes so a merge cannot deploy the new artifact to the old apps
  or enable replacement timers before cutover approval.

### Phase 2: Dev replacement and validation

Dev must exercise the same hosting, identity, storage, and deployment approach intended for prod.

- [ ] Provision the approved dev replacement with isolated Durable state and disabled timer starters.
- [ ] Configure dependencies and deploy through the updated pipeline.
- [ ] Verify runtime/configuration, expected functions, HTTP behavior, identity access, and telemetry.
- [ ] Run a small approved sync to terminal completion and confirm the expected Cosmos result.
- [ ] Rehearse cutover and rollback, including a nonterminal orchestration and duplicate-start
  prevention; preserve evidence and identify any behavior differences.
- [ ] Complete the approved dev cutover: prevent new source starts, drain source instances, update
  callers/monitoring, and enable scheduling only on the replacement.

### Phase 3: Production replacement and cutover

Production promotion requires recorded dev evidence and explicit approval for production changes.

- [ ] Provision/configure the approved prod replacement with isolated state and timer starters disabled.
- [ ] Deploy the same validated artifact and run the approved bounded production verification.
- [ ] Prevent new starts on the source; drain and account for all nonterminal source instances.
- [ ] Switch approved operational callers, pipeline targets, keys, monitoring, and alert references.
- [ ] Enable production scheduling on only the replacement after the source starters are disabled.
- [ ] Confirm completion, Cosmos results, telemetry, and absence of duplicate or stranded sync work.

### Phase 4: Observe and close

Closure follows operational evidence, not merely a deployment-task success or advisory refresh.

- [ ] Record runtime, artifact, app names, identities, validation instance IDs, and cutover results.
- [ ] Confirm a scheduled execution or approved equivalent and review errors, latency, throttling,
  resource use, and cost against the recorded baseline.
- [ ] Retain the old app, storage/history, and artifact for the approved rollback period, with its
  starters disabled; cleanup requires separate approval.
- [ ] Review advisory `0RYZ-CKZ` for eventual clearance. Refresh can lag, and retaining old net8
  apps may keep them listed; track this explicitly rather than treating clearance as immediate.
- [ ] Mark complete only after the acceptance criteria are met and the rollback-retention/cleanup
  disposition is recorded. Do not claim subscription-wide remediation while old net8 apps remain.

## Target Schedule and Approval Gates

As of 9 November, this is an accelerated target rather than a guaranteed delivery estimate.
Quota, access, dependency compatibility, and the time needed to drain existing work can extend it.

| Target | Milestone | Gate |
|---|---|---|
| 9 November 2026 | Preflight, code/pipeline preparation, dev migration and bounded verification | Approved design and resources; successful Functions-specific dev evidence |
| Before 10 November 2026 | Production migration and controlled cutover | Explicit production approval, dev evidence, source drain, and rollback readiness |
| After cutover | Observation and eventual source cleanup | Owner-approved retention window and separate cleanup approval |

Do not waive validation or terminate outstanding work to meet the date. If the deadline cannot
be met safely, record the blocker, owner, revised ETA, and explicit acceptance of temporary
unsupported-runtime exposure. Rollback after the deadline is recovery, not a supported end state.

---

## Acceptance Criteria

Record evidence for each criterion separately in dev and prod where applicable.

| ID | Criterion |
|---|---|
| AC-1 | Both replacements run `dotnet-isolated` `10.0` on Flex Consumption with Functions host v4; the deployed artifact is built for `net10.0` |
| AC-2 | Functions unit tests and host discovery pass; unchanged API/MCP consumers still build; existing HTTP routes, payloads, and status semantics are preserved |
| AC-3 | A sync covering at most five approved candidate IDs completes within the preflight-agreed timeout, with a real BGG fetch, verified Cosmos write/readback, and correlated telemetry; skip-only or no-data runs do not pass |
| AC-4 | Source and replacement state are isolated during overlap; all nonterminal source instances are accounted for; no duplicate scheduled syncs or stranded work remain |
| AC-5 | Relevant deployment targets, callers, keys, scripts, monitoring, alert references, and permissions target the correct replacement resources |
| AC-6 | Production promotion is blocked without Functions-specific dev evidence and explicit cutover approval |
| AC-7 | Rollback is rehearsed in dev; original artifacts/configuration/history are retained; ownership, retention period, and post-deadline exposure are recorded |
| AC-8 | Schedules, BGG selection, Cosmos schema, supported mobile behavior, and unrelated runtime targets remain unchanged; no secrets are committed or logged |

## Rollback Plan

Prepare the rollback inventory before any resource changes. The default is recovery to the
retained source app, not destructive recreation or an untested live-state transfer.

1. Pause new starts on the replacement and record all replacement instance IDs and statuses.
2. Drain replacement work where safe, or approve a per-instance recovery action. Do not blindly
   restart every request or purge the replacement hub; already completed writes must be reconciled.
3. Keep the two hubs isolated and verify that the retained source artifact, configuration,
   identity access, and storage/history are intact.
4. With approval, restore operational callers/pipeline targets/monitoring to the source and verify
   its runtime health. Restore source scheduling only after duplicate-start risk is resolved.
5. Account for work completed, pending, or interrupted on either app. Verify Cosmos results and
   telemetry before declaring recovery complete.
6. Preserve both apps and their history for investigation; do not delete either app or storage
   automatically.
7. Record the failure, owner, revised migration ETA, and any unsupported .NET 8 exposure. After
   10 November, source restoration is a temporary risk-accepted fallback only.

## Decisions and Open Questions

The design recommendations are not yet approved resource changes. Resolve these before their
dependent implementation phases.

| Decision | Proposed position / information needed |
|---|---|
| Hosting and topology | Side-by-side Flex replacements in existing RGs / West US; confirm quota, names, capacity, and cost |
| Durable storage and cutover | Prefer draining the source and using isolated replacement state; confirm actual active instances, storage configuration, and drain duration |
| Provisioning | Choose narrowly scoped IaC or an approved repeatable migration runbook; retain a reproducible final configuration |
| SDK and dependencies | Confirm the documented .NET 10 build SDK path and pin compatible stable versions before edits |
| Operational ownership | Assign production approver, migration/rollback owner, observation baseline, and retention window before cutover |
| API/MCP follow-up | Separate deployments, same .NET 8 support deadline; assign owners and explicitly acknowledge any unsupported-runtime deferral |

---

## References

Use Microsoft guidance and the dated live assessment as the evidence baseline; recheck support
and package compatibility before implementation.

- Azure Service Health advisory — Tracking ID **0RYZ-CKZ** (Service Health → Health advisories)
- [Isolated worker guide, .NET support, and SDK migration](https://learn.microsoft.com/en-us/azure/azure-functions/dotnet-isolated-process-guide)
- [Azure Functions language support policy](https://learn.microsoft.com/en-us/azure/azure-functions/language-support-policy)
- [.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core)
- [Update language stack versions in Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/update-language-versions)
- [Consumption to Flex migration](https://learn.microsoft.com/en-us/azure/azure-functions/migration/migrate-plan-consumption-to-flex?pivots=platform-linux)
- [Azure Functions Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [Azure Pipelines Functions deployment support](https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-azure-devops)
- [AzureFunctionApp@2 task inputs](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/azure-function-app-v2?view=azure-pipelines)
- [Durable task hubs and multi-app isolation](https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-hubs)
