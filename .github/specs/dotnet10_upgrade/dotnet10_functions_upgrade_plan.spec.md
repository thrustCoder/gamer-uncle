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
- **Status**: Initial repository implementation and local verification completed following
  authorization on 9 November 2026. Host/cloud validation and operational migration remain pending.
  Azure provisioning, deployment, access changes, sync execution, and cutover remain separately gated.

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
(`Microsoft.Azure.Functions.Worker.*` packages and executable Functions host v4 configuration).
The new build SDK supplies the executable/host properties. Both assessed live apps report `DOTNET-ISOLATED|8.0`.
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
unverified. At assessment, the local machine had .NET 8 and 9 SDKs installed, but no .NET 10 SDK;
repository preparation subsequently used a session-local .NET 10 SDK without replacing them.

The repository changes are bounded as follows. Dependency selections below are now pinned in
the project files; local compatibility evidence does not establish deployed runtime compatibility.

| Component | Assessed baseline | Repository target | Notes |
|---|---|---|---|
| Function `TargetFramework` | `net8.0` | `net10.0` | Functions project only |
| Worker model | Isolated | Isolated | No in-process migration needed |
| Functions host | `v4` | `v4` | Do not confuse host version with .NET version |
| `Microsoft.Azure.Functions.Worker` | `1.21.0` | `2.52.0` | Verify Worker 2.x behavior locally and in dev |
| Build SDK | `Microsoft.Azure.Functions.Worker.Sdk` `1.17.0` | `Azure.Functions.Sdk/1.0.0` | Old SDK reference and SDK-supplied project properties removed |
| `...Worker.Extensions.Http` | `3.1.0` | `3.1.0` (unchanged) | Preserve HTTP request/response behavior |
| `...Worker.Extensions.Timer` | `4.3.1` | `4.3.1` (unchanged) | Preserve schedules and environment gating |
| `...Worker.Extensions.CosmosDB` | `4.0.0` | `4.0.0` (unchanged) | Verify bindings and permissions in dev |
| `...Worker.Extensions.DurableTask` | `1.1.0` | `1.21.1` | Verify serialization and orchestration behavior |
| `Microsoft.DurableTask.Client` / `Worker` | Direct `1.10.0` references | Direct references removed; extension resolves `1.27.0` transitively | Avoid overriding the extension's compatible dependencies |
| Azure SDK / Application Insights packages | Existing pinned versions | Change only where required for compatibility or a directly relevant fix | Avoid unrelated dependency modernization |
| Test project `TargetFramework` | `net8.0` | `net10.0` | Must match — a net8 test project cannot reference a net10 project |
| Test `Microsoft.Extensions.Hosting` | `8.0.0` | `10.0.14` | Aligned with the upgraded worker |
| Shared models `TargetFramework` | `net8.0` | `net8.0` (keep) | net10 function can reference a net8 lib; net8 API cannot reference net10 — so **leave shared at net8** |
| Pipeline SDK (function build/test jobs) | `8.x` build SDK | .NET 10 SDK | Keep .NET 8 available for unrelated net8 jobs |
| Deployment task (dev + prod) | `AzureFunctionApp@1` | `AzureFunctionApp@2`, `isFlexConsumption: true` | Task v1 does not support Flex |
| Runtime configuration | Legacy `runtimeStack` / `linuxFxVersion` | Flex `functionAppConfig.runtime`: `dotnet-isolated`, `10.0` | Do not configure Flex through the legacy deployment-task `runtimeStack` input |
| Hosting plan | Linux Consumption | Flex Consumption (`FC1`) | Separate replacement apps; no in-place recreation |

Source anchors: Functions project lines 4 and 21-29; `host.json` line 5; pipeline function build
job near line 161, deployments near lines 485 and 1166, and alert resource lookups near lines
956 and 1480. Line numbers describe the assessment baseline and may move during implementation.

### Repository preparation evidence (local only)

| Area | Observed result |
|---|---|
| Tooling | Session-local .NET SDK `10.0.403`; repository NuGet feeds and machine-wide SDK configuration unchanged |
| Functions | Release build and publish succeeded; all 99 Functions tests passed |
| Generated discovery | Actual generated `IFunctionMetadataProvider` exposes all 13 functions with entry points and bindings |
| Existing consumers | Unchanged net8 API and MCP projects built successfully; shared models remain net8 |
| Pipeline checks | All 53 existing pipeline tests passed; changed YAML parsed and stage dependency references resolved locally |
| Deployment guard logic | All 29 Azure/HTTP-mocked PowerShell scenarios passed without contacting Azure, including wrong runtime/plan, missing configuration, enabled starters, hub reuse, host errors, and incomplete discovery |
| Artifact | Actual pipeline contract/checksum scripts passed against local publish output and ZIP, including hidden `.azurefunctions` assemblies and rejection of an incorrect approved SHA256 |
| Cloud operations | None performed: no provisioning, access changes, deployment, sync starts, source changes, or cutover |

`Azure.Functions.Sdk/1.0.0` embeds generated metadata in the application assembly and enables worker
indexing; this project does not publish `functions.metadata`. CI obtains discovery evidence from
the actual generated provider through a regression test and packages it as `functions.manifest.json`.
This manifest is verification evidence, not a fabricated host metadata file. Previously generated
`publish` content is excluded from project inputs to prevent stale nested deployment files.

The only production logic adaptation is preserving the established Cosmos database/container
defaults when environment values are empty: newer .NET preserves empty values on Windows. The
configuration theories now exercise the real constructor rather than duplicating its expressions.
No function names, HTTP semantics, schedules, orchestration ordering, filters, or schemas were changed.

Both deployment opt-ins default to `false`. The shared Flex deployment template verifies the ZIP
against both its SHA256 sidecar and the current build's approved output hash. Separate named,
non-self-approvable manual gates cover dev code deployment, same-artifact dev evidence, and production
code deployment. No deployment task enables starters or starts an orchestration.

This is not a production-readiness declaration. Compatible local Core Tools host startup/discovery,
Azure DevOps server-side pipeline expansion/task execution, and real dev replay/restart, BGG/Cosmos,
API readback, telemetry, recovery, and cutover evidence are still pending. Local mocks and generated
metadata do not satisfy those operational gates. Existing alerts intentionally retain source-app
targets until their approved operational ownership transition.

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
- Configure all five replacement HTTP/timer starters as disabled **before the first code deployment**.
  Separate hubs prevent message competition but do not prevent duplicate syncs or Cosmos writes.
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
- Gate production Functions code deployment on successful **Functions-specific dev validation** and
  explicit code-deployment approval. Live-data writes and cutover require separate, scoped approval;
  approving disabled code deployment does not authorize either. API functional-test results alone
  are insufficient.
- Default both Functions deployment stages to disabled during repository preparation. Require
  explicit replacement names and opt-in approval; never fall back to the existing Consumption
  apps. A merge must not deploy the net10 artifact to a net8/Y1 app.
- Before deployment, fail closed unless the target is a different app on Flex with the .NET 10
  isolated runtime, a replacement-specific task hub, and all five HTTP/timer starters disabled. Do not
  enable scheduling or start a sync as a deployment-task side effect.
- Treat host readiness and complete function discovery as infrastructure checks only. Require a
  separate evidence review for real execution, data verification, and rollback readiness before
  production promotion. Publish the exact artifact hash with that evidence.

### 7. Local development tooling

Install an approved .NET 10 SDK and compatible Azure Functions Core Tools v4 before local
verification. Update only Functions-specific debug paths if necessary. The current net8 launch
path for the out-of-scope API must not be mechanically rewritten. Follow the isolated worker
guide's Windows installation guidance for Core Tools; its `dotnet run` integration requires a
non-npm Core Tools installation.

### 8. Regression, observation, and data-recovery gates

The five-ID smoke test is a connectivity and data-path check, not the complete regression gate.
Before production promotion, record the following additional dev evidence:

- Exercise the actual ranked orchestrator used by the timers, with explicitly bounded pages and
  `IdsPerPage`; one default page can scan 4,100 IDs and is not an approved small test.
- Exercise high-signal chunk boundaries and `ContinueAsNew`, existing-document skips, empty BGG
  results, activity failures, and interrupted/restarted work. Confirm completed work is not
  unintentionally repeated. Unit mocks do not establish cloud replay or restart correctness.
- Compare representative serialized request, orchestration, activity, and Cosmos document payloads
  with the net8 baseline, including property names/types, ratings, lists, and UTC timestamps.
  Preserve existing HTTP responses, filters, timer schedules, and environment gating.
- Run existing API functional tests unchanged and verify the API can read the validated documents.
  Keep representative workload/fault exercises in dev; do not generate production load to prove
  a code path.

Production verification must not race the source against the same Cosmos documents. Before source
draining, allow only non-writing checks or execution against an approved isolated validation
container. Disable all source HTTP/timer starters and drain nonterminal work before any replacement
sync writes to the live production container. Keep replacement timers disabled through the bounded
live-data canary and its observation gate.

Record a signed-off gate sheet before the first production write:

| Gate | Required value / decision |
|---|---|
| Bounded canary | At most five explicit approved candidate IDs; record expected IDs, filters, document state, and instance IDs |
| Completion deadline | Proposed maximum 10 minutes for the bounded canary; approver must confirm or replace this value before execution |
| Correctness | Zero failed/terminated/unaccounted instances, duplicate starts, unexpected document changes, or schema/HTTP contract differences |
| Observation | Proposed minimum 60 minutes after canary completion, followed by a separately approved bounded ranked-workload equivalent before normal scheduling |
| Performance and dependencies | Record comparable baseline, sample sizes, and numeric limits for sync duration/throughput, BGG errors, Cosmos 429/retries, API errors/p95 latency, and cost; missing limits or insufficient evidence block promotion |
| Abort and recovery | Any correctness failure or approved-limit breach pauses further replacement starts and invokes the per-instance recovery procedure; no automatic restart of source scheduling |
| Accountability | Named production approver, migration/rollback owner, decision timestamps, evidence location, and rollback resource-retention end time |

These are proposed defaults, not observations or approval to run a canary. Because scheduled syncs
are quarterly/semiannual, a quiet hour is not evidence that the normal workflow works. The bounded
equivalent must exercise that workflow, and the owner must approve the input, duration, and expected
output. Extend observation when the agreed workload has not completed; do not promote on elapsed
time alone.

Application rollback does not roll back Cosmos writes. Before live-data verification:

1. Inventory the actual Cosmos backup mode, retention, recovery permissions, and restore procedure.
   Record approved recovery-time and recovery-point objectives; do not assume point-in-time restore
   is enabled or can restore the live container in place.
2. Record each approved document's ID/partition key, presence/absence, pre-write body and ETag, and
   post-write ETag/instance correlation in an approved secure evidence location. Keep document
   snapshots out of source control and build logs.
3. Rehearse recovery in dev: restore into a separate recovery target where required, compare the
   affected documents, and perform only approved selective repairs. Use ETag preconditions so
   reconciliation cannot overwrite intervening legitimate writes.
4. For newly created incorrect documents, approve a per-document correction or other recovery
   action. Do not automatically delete records, restore the entire shared container, or overwrite
   unrelated application data. Any deletion requires separate explicit approval.
5. Verify repaired documents through Cosmos and the unchanged API before declaring recovery
   complete. If concurrent changes make repair ambiguous, stop and escalate rather than guessing.

---

## Implementation Steps and Status

The following phases are ordered gates, not permission to execute. Branch creation, commits,
pushes, provisioning, access changes, deployment, and source-app changes require their applicable
user approvals. This spec does not prescribe creating or switching a branch automatically.

### Phase 0: Preflight and decisions

The owner reviews the proposal and records unresolved blockers before the dependent cloud phases.
Repository-only implementation was authorized separately; it does not resolve these resource decisions.

- [ ] Approve the target subscription, West US region, Flex plan, replacement names, cost
  estimate, and implementation scope.
- [ ] Pass the advisory subscription explicitly to Azure CLI operations; do not rely on the
  machine's active subscription, which differed during the assessment.
- [ ] Confirm quota/capacity, deployment permissions, dependency access, configuration compatibility,
  and provisioning approach.
- [ ] Capture a secure configuration/identity inventory and retain the original deployment artifact.
- [ ] Record all starters, callers, function-key handling, active Durable instances, and hub/storage
  isolation strategy; define drain and rollback procedures.
- [ ] Approve the gate sheet, observation/timeout values, dependency/performance limits, recovery
  objectives, secure document evidence location, and Cosmos recovery method.
- [x] Pin the worker/build SDK/dependency choices and identify locally required behavior adaptations.
  Validate the selected combination through the real dev workload before promotion.
- [ ] Assign separate ownership for API/MCP runtime upgrades and any deadline exception.

### Phase 1: Code, tooling, and pipeline preparation

The Functions upgrade must be verifiable without deploying a net10 artifact to a Y1 app.

- [x] Upgrade Functions and Functions tests, preserving shared models and existing contracts.
- [x] Prepare .NET 10 SDK tooling, targeted CI build/tests, and default-off Flex-aware deployments.
- [x] Build/publish, pass all 99 Functions tests, and verify generated discovery and ZIP layout locally.
- [ ] Verify actual host startup/function discovery with compatible Core Tools.
- [x] Validate unchanged API/MCP consumers still build against the shared models.
- [x] Stage pipeline targeting changes so a merge cannot deploy the new artifact to the old apps
  or enable replacement starters; locally exercise fail-closed deployment guards.
- [ ] Validate expanded pipeline/task configuration and output-hash propagation in Azure DevOps
  before authorizing the first deployment; local YAML parsing does not replace this check.

### Phase 2: Dev replacement and validation

Dev must exercise the same hosting, identity, storage, and deployment approach intended for prod.

- [ ] Provision the approved dev replacement with isolated Durable state and all five starters disabled.
- [ ] Configure dependencies and deploy through the updated pipeline.
- [ ] Verify runtime/configuration, expected functions, HTTP behavior, identity access, and telemetry.
- [ ] Run a small approved sync to terminal completion and confirm the expected Cosmos result.
- [ ] Complete the representative ranked/continuation/restart regression exercises, payload
  comparison, and unchanged API functional tests; retain results and the exact artifact hash.
- [ ] Rehearse cutover and rollback, including a nonterminal orchestration and duplicate-start
  prevention; preserve evidence and identify any behavior differences.
- [ ] Rehearse selective data recovery with ETag conflict handling and verify API readback.
- [ ] Complete the approved dev cutover: prevent new source starts, drain source instances, update
  callers/monitoring, and enable scheduling only on the replacement.

### Phase 3: Production replacement and cutover

Production promotion requires recorded dev evidence and explicit approval for production changes.

- [ ] Provision/configure the approved prod replacement with isolated state and all five starters disabled.
- [ ] Deploy the same validated artifact; perform only non-writing readiness checks or use an
  approved isolated validation container while the source can still write production data.
- [ ] Confirm backup/recovery readiness and capture approved pre-write document evidence.
- [ ] Prevent all new HTTP/timer starts on the source; drain and account for all nonterminal
  instances while keeping its orchestration/activity processing available.
- [ ] With source drain confirmed, run the approved bounded live-data canary with replacement
  timers still disabled; verify documents, API readback, telemetry, and completion deadline.
- [ ] Pass the signed-off observation/abort gate and approved bounded ranked-workload equivalent.
- [ ] Switch approved operational callers, pipeline targets, keys, monitoring, and alert references.
- [ ] Enable production scheduling on only the replacement after the observation gate and source
  starter isolation have been explicitly approved.
- [ ] Confirm completion, Cosmos results, telemetry, and absence of duplicate or stranded sync work.

### Phase 4: Observe and close

Closure follows operational evidence, not merely a deployment-task success or advisory refresh.

- [ ] Record runtime, artifact, app names, identities, validation instance IDs, and cutover results.
- [ ] Confirm a scheduled execution or approved equivalent and review errors, latency, throttling,
  resource use, and cost against the recorded baseline and approved numeric limits.
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
| AC-6 | Production code deployment is blocked without Functions-specific dev evidence and explicit code-deployment approval; live-data writes and cutover require separate scoped approval |
| AC-7 | Rollback is rehearsed in dev; original artifacts/configuration/history are retained; ownership, retention period, and post-deadline exposure are recorded |
| AC-8 | Schedules, BGG selection, Cosmos schema, supported mobile behavior, and unrelated runtime targets remain unchanged; no secrets are committed or logged |
| AC-9 | Representative ranked, continuation, restart/failure, payload-compatibility, and unchanged API functional evidence is recorded in dev; smoke-only evidence cannot authorize production |
| AC-10 | No replacement writes reach live production Cosmos before source starters are disabled and work is drained; the bounded canary and observation/abort gates pass before normal scheduling |
| AC-11 | Cosmos recovery capabilities/objectives are confirmed, document-scoped evidence is retained securely, and selective recovery with ETag conflict handling and API readback is rehearsed in dev |
| AC-12 | Functions deployment defaults are disabled; opted-in deployments fail closed for legacy/wrong-runtime targets, missing isolation, any enabled HTTP/timer starter, or artifact-hash mismatch; production cannot bypass Functions-specific dev evidence and approval |

## Rollback Plan

Prepare the rollback inventory before any resource changes. The default is recovery to the
retained source app, not destructive recreation or an untested live-state transfer.

1. Pause new starts on the replacement and record all replacement instance IDs and statuses.
2. Drain replacement work where safe, or approve a per-instance recovery action. Do not blindly
   restart every request or purge the replacement hub; already completed writes must be reconciled.
   Use the approved document inventory and Cosmos recovery procedure above. Restoring the old
   runtime alone is not data recovery; stop on ETag conflicts or unaccounted writes.
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
| SDK and dependencies | Pinned selections and local results recorded above; real host and representative dev compatibility remain approval prerequisites |
| Operational ownership | Assign production approver and migration/rollback owner; approve the gate sheet, baseline, numeric abort limits, observation duration, and retention window before cutover |
| Cosmos recovery | Confirm backup mode/retention, recovery permissions and objectives, secure document inventory, and rehearsed selective repair without overwriting concurrent writes |
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
