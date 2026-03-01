# App Key Enforcement Plan — Recommendations & Voice APIs

## Table of Contents

- [Executive Summary](#executive-summary)
- [Objective](#objective)
- [Current State](#current-state)
- [Phased Rollout Plan](#phased-rollout-plan)
  - [Phase 1 — Client Sends App Key](#phase-1--client-sends-app-key-mobile-only-change)
  - [Phase 2 — Server: Soft Enforcement](#phase-2--server-soft-enforcement-grace-mode)
  - [Phase 3 — Force Upgrade Mechanism](#phase-3--force-upgrade-mechanism)
  - [Phase 4 — Hard Enforcement](#phase-4--hard-enforcement)
- [Target End State](#target-end-state)
- [Timeline](#timeline)

---

## Executive Summary

| Phase | Description | Estimated Duration | Status |
|---|---|---|---|
| **1. Client Sends App Key** | Mobile app starts sending `X-GamerUncle-AppKey` on Recommendations & Voice requests. No server changes. | 1–2 weeks (app review) | Complete |
| **2. Soft Enforcement** | Server validates App Key but allows requests without it (logs warning). Reject invalid keys. | Deploy after Phase 1 is live | Complete |
| **3. Force Upgrade** | Build `/api/AppConfig` endpoint + client-side version check with upgrade prompt. Currently in **nudge mode** (`ForceUpgrade: false` — dismissible banner). Can escalate to blocking modal via config. | 2–3 weeks build + 4–6 weeks observation | Complete (nudge mode) |
| **4. Hard Enforcement** | Swap graceful filter for strict `[RequireAppKey]`. All unauthenticated requests rejected. | Single deploy | Not Started |

---

## Objective

Require `X-GamerUncle-AppKey` authentication on the Recommendations (chat) and Voice endpoints, matching the security posture already in place for Game Search and Telemetry APIs — **without causing any production outage**.

## Current State

| Controller | Route | App Key Required | Rate Limited |
|---|---|---|---|
| `GamesController` | `api/Games/*` | **Yes** (`[RequireAppKey]`) | `GameSearch` |
| `TelemetryController` | `api/Telemetry/*` | **Yes** (`[RequireAppKey]`) | — |
| `RecommendationsController` | `api/Recommendations` | **Soft** (`[RequireAppKeyGraceful]`) | `GameRecommendations` |
| `VoiceController` | `api/Voice/*` | **Soft** (`[RequireAppKeyGraceful]`) | `GameRecommendations` |
| `AppConfigController` | `api/AppConfig` | No (public) | — |
| `DiagnosticsController` | `api/Diagnostics/*` | No | — |

### Key Facts

- Only client is the **Expo mobile app** (iOS / Android, distributed via App Store / Play Store).
- App store review cycle is **~1 week**; user adoption is gradual after that.
- The existing `[RequireAppKey]` attribute (`AppKeyAuthorizationFilter`) validates the `X-GamerUncle-AppKey` header against `ApiAuthentication:AppKey` config. It already has a graceful fallback: if the server-side key is not configured, validation is skipped with a warning log.
- A **nudge-upgrade mechanism** is deployed (`/api/AppConfig` with `ForceUpgrade: false`). Users below `MinVersion` see a dismissible banner; this can be escalated to a blocking modal by setting `ForceUpgrade: true` in config.
- The same Key Vault secret (`GameSearchAppKey`) already used by Game Search / Telemetry is reused.
- Current app version: **3.4.1**; `MinVersion`: **3.3.4**.

---

## Phased Rollout Plan

### Phase 1 — Client Sends App Key (Mobile-Only Change)

**Goal**: Update the mobile app to include `X-GamerUncle-AppKey` on Recommendations and Voice requests, identical to how Game Search and Telemetry already send it. No server-side changes.

#### Changes

| File | Change |
|---|---|
| `apps/mobile/services/ApiClient.ts` | Add `X-GamerUncle-AppKey: getAppKey()` to the axios instance default headers |
| `apps/mobile/services/voiceAudioService.ts` | Add `X-GamerUncle-AppKey: getAppKey()` to voice HTTP request headers |
| Unit tests | Verify headers are present on outgoing requests |

#### Risk

**Zero**. The server ignores the extra header because no filter checks it on these endpoints. Old and new app versions coexist without issue.

#### Exit Criteria

- New app version passes App Store / Play Store review and is available for download.

---

### Phase 2 — Server: Soft Enforcement (Grace Mode)

**Goal**: Deploy server-side awareness of the App Key on Recommendations and Voice, **without rejecting** old clients that don't send it yet. Gain observability into adoption.

#### Design

Create a new `[RequireAppKeyGraceful]` attribute (separate from the existing hard-enforcement `[RequireAppKey]`) with the following behavior:

| Scenario | Result |
|---|---|
| Valid App Key present | Request proceeds normally |
| Invalid / wrong App Key present | **401 Unauthorized** — reject immediately |
| No App Key header at all | Request proceeds, **but**: warning logged, `X-AppKey-Deprecated: true` response header added |

> A separate attribute is used (rather than a mode flag on the existing one) to keep hard-enforcement behavior unchanged for Games / Telemetry.

#### Changes

| File | Change |
|---|---|
| `services/api/Services/Authentication/AppKeyGracefulAuthorizationFilter.cs` | New filter implementing grace-mode logic |
| `services/api/Controllers/RecommendationsController.cs` | Add `[RequireAppKeyGraceful]` class-level attribute |
| `services/api/Controllers/VoiceController.cs` | Add `[RequireAppKeyGraceful]` class-level attribute |
| Unit tests | Cover all three scenarios (valid key, invalid key, missing key) |
| Functional tests | Update to send App Key; add test for missing-key-still-works |

#### Monitoring

- All three outcomes (Valid, Missing, Invalid) are logged via `ILogger` with stable `EventId` constants:
  - **7001** — `AppKeyGraceMode.Valid` (Information level)
  - **7002** — `AppKeyGraceMode.Missing` (Warning level)
  - **7003** — `AppKeyGraceMode.Invalid` (Warning level)
- Each log entry includes structured properties: `AppKeyOutcome`, `AppKeyPath`, `ClientIp`, `UserAgent`.
- `TelemetryClient.TrackEvent("AppKey.GraceModeRequest")` is also emitted (belt-and-suspenders for `customEvents` table) but the `traces` table via `ILogger` is the **primary** telemetry path.
- Run `scripts/check-appkey-adoption.ps1` to query adoption metrics from the `traces` table.

> **Lesson learned**: The original implementation logged the valid-key path at `Debug` level (filtered out in prod where min level = `Information`) and relied solely on `TelemetryClient.TrackEvent()` which was not ingesting to the `customEvents` table. This was fixed by promoting valid-key logging to `Information` and adding structured `ILogger` properties queryable via KQL on the `traces` table.

#### Deployment

- Deploy to **dev** immediately for testing.
- Deploy to **prod** once the Phase 1 app version is live in stores.

#### Exit Criteria

- Soft enforcement deployed to prod.
- Warning logs confirm new app versions are sending the key.

---

### Phase 3 — Force Upgrade Mechanism

**Goal**: Build a server-driven minimum-version check so old clients can be prompted (and eventually forced) to update before hard enforcement begins.

#### Design (Option B — `/api/AppConfig` Endpoint)

A new lightweight endpoint returns version policy and upgrade metadata:

```json
GET /api/AppConfig

{
  "minVersion": "1.5.0",
  "latestVersion": "1.6.0",
  "upgradeUrl": "https://apps.apple.com/app/id...",       // iOS
  "upgradeUrlAndroid": "https://play.google.com/store/apps/details?id=...",  // Android
  "message": "A new version is available with important security improvements. Please update to continue.",
  "forceUpgrade": true
}
```

##### Client behavior

1. App calls `/api/AppConfig` on launch.
2. Compare installed `appVersion` (from `app.json` / `expo-constants`) against `minVersion` using semver.
3. If below `minVersion` **and** `forceUpgrade` is `true` → show a **blocking modal** with the message and an "Update" button linking to the store. User cannot dismiss.
4. If below `minVersion` **and** `forceUpgrade` is `false` → show a **dismissible banner** encouraging update.
5. If at or above `minVersion` → no action.

##### Server-side

- `/api/AppConfig` is a **public endpoint** (no App Key required — old clients must be able to reach it).
- Version values come from `appsettings.{Environment}.json` → `AppVersionPolicy` section, so they can be changed via config without a deployment.
- The endpoint is excluded from rate limiting (lightweight, cacheable).

#### Changes

| File | Change |
|---|---|
| `services/api/Controllers/AppConfigController.cs` | New controller returning version policy |
| `services/api/Models/AppVersionPolicy.cs` | Response model |
| `appsettings.json` / `appsettings.Production.json` | `AppVersionPolicy` config section |
| `apps/mobile/services/AppConfigService.ts` | New service to fetch and evaluate version policy |
| `apps/mobile/components/ForceUpgradeModal.tsx` | Blocking upgrade modal component |
| `apps/mobile/App.tsx` or root navigator | Hook up version check on app launch |
| Unit tests (API + mobile) | Cover endpoint, semver comparison, modal display |

#### Exit Criteria

- Force upgrade mechanism deployed to prod. ✅
- `minVersion` set to `3.3.4` (the version that sends App Key). ✅
- `ForceUpgrade` is currently `false` (nudge / dismissible banner). Escalate to `true` only if needed before Phase 4.
- Monitoring confirms negligible traffic from sub-`minVersion` clients. ⏳ (requires telemetry fix to be deployed — see Phase 2 Monitoring note).

---

### Phase 4 — Hard Enforcement

**Goal**: Replace soft enforcement with hard enforcement. All Recommendations and Voice requests without a valid App Key are rejected.

#### Prerequisites

Either:
- Monitoring shows unauthenticated traffic is negligible (< 1%) — run `scripts/check-appkey-adoption.ps1` or query the `traces` table:
  ```kql
  traces
  | where timestamp > ago(30d)
  | where customDimensions has 'AppKeyOutcome'
  | extend Outcome = tostring(customDimensions['AppKeyOutcome'])
  | summarize Total=count(), Missing=countif(Outcome == 'Missing') by bin(timestamp, 1d)
  | extend MissingPct = round(todouble(Missing) / todouble(Total) * 100, 1)
  ```
- **OR** Force upgrade (Phase 3) has been escalated to blocking mode (`ForceUpgrade: true`) and active long enough that remaining old clients are a rounding error.

#### Changes

| File | Change |
|---|---|
| `services/api/Controllers/RecommendationsController.cs` | Replace `[RequireAppKeyGraceful]` with `[RequireAppKey]` |
| `services/api/Controllers/VoiceController.cs` | Replace `[RequireAppKeyGraceful]` with `[RequireAppKey]` |
| `services/api/Services/Authentication/AppKeyGracefulAuthorizationFilter.cs` | **Delete** — no longer needed |
| Functional tests | Update to enforce App Key on all Recommendations / Voice tests |

#### Exit Criteria

- All API endpoints uniformly require `X-GamerUncle-AppKey`.
- Unprotected access ceases to exist.

---

## Target End State

| Controller | Route | App Key Required |
|---|---|---|
| `GamesController` | `api/Games/*` | **Yes** |
| `TelemetryController` | `api/Telemetry/*` | **Yes** |
| `RecommendationsController` | `api/Recommendations` | **Yes** |
| `VoiceController` | `api/Voice/*` | **Yes** |
| `AppConfigController` | `api/AppConfig` | No (must be reachable by old clients) |
| `DiagnosticsController` | `api/Diagnostics/*` | No |

---

## Timeline

| Phase | Estimated Duration | Dependencies |
|---|---|---|
| **1. Client sends key** | 1–2 weeks (app review) | None |
| **2. Soft enforcement** | Deploy after Phase 1 is live | Phase 1 app in stores |
| **3. Force upgrade** | 2–3 weeks build + 4–6 weeks observation | Can be built in parallel with Phase 2 |
| **4. Hard enforcement** | Single deploy | Phase 3 observation complete |

**Total estimated timeline**: ~8–10 weeks from start to full enforcement.


