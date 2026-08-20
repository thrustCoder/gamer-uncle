# Local (On-Device) Inference — Implementation Plan

## Overview

Move the **criteria / intent extraction tier** of the chat recommendation pipeline from the cloud
(`gpt-4.1-mini` via Azure AI Foundry Agent Service) to an **on-device small language model** on capable
phones, while keeping the expensive **response generation** tier (`gpt-4.1` + Cosmos RAG) in the cloud.

The goal is an **experiment with measurable outcomes**: cost per query, criteria-tier latency, end-to-end
perceived latency, criteria quality, and offline resilience — with a **seamless, always-safe fallback** to
the existing cloud `gpt-4.1-mini` path whenever the device is incapable, the model is not yet downloaded, or
on-device extraction fails or times out.

This is a **hybrid inference router**, not a "fully local app." The user's message still travels to the cloud
for the response tier. See [Messaging & Privacy Framing](#messaging--privacy-framing) — the user-facing copy
must never imply that data stays on the device.

---

## Scope Decision (from clarifying questions)

| Decision | Choice |
|---|---|
| **What runs on-device** | **Criteria / intent extraction ONLY.** Cloud `gpt-4.1` + RAG still generates every response. |
| **When on-device runs** | **First user message of each chat thread only** (`conversationId == null`) — self-contained, no prior turn to reference. **All follow-ups go to cloud**, which remains the sole arbiter of thread context and pronoun resolution. |
| **Model (initial target)** | Qwen2.5-0.5B-Instruct, GGUF **q4_k_m** (~469 MB on disk) |
| **Runtime** | `llama.rn` (llama.cpp React Native binding), stable **0.12.9** |
| **Structured output** | GBNF grammar constraining decoding to the fixed 10-field `GameQueryCriteria` schema |
| **Platform order** | UI (Settings, nudge, cue) ships cross-platform; **on-device runtime enabled Android-first**, iOS behind a flag |
| **Wi-Fi gating** | **None** — download proceeds on any network (size disclosed in opt-in copy) |
| **Download UX** | **Silent background download**; chat stays fully usable; cutover happens under the hood |
| **Fallback** | Always falls back to cloud `gpt-4.1-mini` — on-device is a best-effort optimization, never a hard dependency |

---

## Two Ways to Opt In

| Path | Where | Interaction | Confirmation |
|---|---|---|---|
| **Static** | New **Settings** screen (gear icon, bottom-right of Landing) | Toggle "On-device inference" | Blocking confirmation popup (discloses ~size, cellular caveat) |
| **Usage-gated nudge** | **Chat** screen | Non-blocking **banner** (mirrors `RatingBanner`) | Tapping "Enable" flips the setting; download starts silently |

Both paths converge on the same persisted setting and the same silent background download. The nudge is a
discoverability shortcut; **Settings is always the source of truth** and can turn the feature off at any time.

---

## Design Decisions (defaults)

| Decision | Choice |
|---|---|
| **Nudge trigger** | Cumulative **≥ 5 chat interactions since origin** (persisted), device capable, not already opted-in, not permanently dismissed |
| **Interaction definition** | One user-initiated query = one text send **or** one completed voice turn; counted regardless of success |
| **Nudge UX** | Non-blocking dismissible banner at top of chat (reuses `RatingBanner` visual language) |
| **Nudge suppression** | 7-day cooldown after dismissal; stop nudging after **3** dismissals; never nudge once opted-in |
| **Settings toggle confirmation** | Blocking modal popup with Enable / Cancel |
| **Capability gating** | Unsupported device → nudge never shown; Settings toggle shown **disabled** with a short "not supported on this device" note |
| **Visual cue** | **Per-message badge** on responses whose criteria were extracted on-device (first-message responses), plus the Landing footer line. No persistent header chip. See [Visual Cue](#visual-cue) |
| **Download network** | Any network; opt-in copy discloses approx size + "may use cellular data" |
| **Model storage** | App-private sandbox via `expo-file-system`; deletable/reclaimable from Settings |

---

## Nudge Trigger Logic (detailed)

The chat nudge banner appears when **all** are true:

1. Device is **capable** (see [Capability Gating](#capability-gating)).
2. Feature is **not already enabled**.
3. Cumulative chat interaction count **≥ 5** (persisted, "since origin").
4. Nudge **not dismissed within the last 7 days**.
5. Nudge **dismissed fewer than 3 times** total.
6. No in-flight download already running.

Mirrors the `ratingPrompt.ts` engagement-counter + cooldown pattern. In `__DEV__`, threshold is **1** and
cooldown/dismissal caps are bypassed for testing.

---

## Architecture

### End-to-end request flow (with on-device tier)

```
User query (chat, text or voice)
        │
        ▼
 [Capable device? feature ON? model loaded?] ──no──► send Query only ──► API (cloud mini extracts criteria)
        │ yes
        ▼
 First user message of this thread? (conversationId == null / no prior turn)
        │ no (follow-up) ───────────────────────────► send Query only ──► API (cloud mini, uses thread history)
        │ yes
        ▼
 On-device extract criteria (llama.rn + GBNF), budget ~<Nms>
        │ success                         │ timeout / parse-fail
        ▼                                 ▼
 attach { Criteria, CriteriaSource }   send Query only ──► API (cloud mini fallback)
        │
        ▼
 API: Criteria present? ──yes──► SKIP cloud mini call, go straight to Cosmos RAG + gpt-4.1
                          └─no──► existing path (cloud mini extraction)
```

### Why the win is real (and where it isn't automatic)

- **Cost** — high-confidence win: every on-device extraction deletes one `gpt-4.1-mini` Foundry call.
- **Resilience / offline** — win: criteria no longer depends on Foundry availability/throttling.
- **Correctness** — first-message-only sidesteps cross-turn context ("it"/"this"/"that") entirely: opening
  queries are self-contained, so a tiny model never has to resolve a pronoun. All follow-ups (where context
  matters and tiny models are weakest) stay on cloud. Bonus: the first message is usually the criteria-richest
  query (the actual recommendation ask), so this targets the highest-value extraction.
- **Latency** — **must be measured**; not guaranteed:
  - Server criteria extraction today runs through Foundry **persistent threads**
    (`GetThread/CreateThread → CancelActiveRuns → CreateMessage → CreateRun → poll GetRun`), several
    sequential round-trips (~0.8–2s). Removing those is the main lever, not raw token speed.
  - **A7 regression risk:** the server currently reuses the criteria thread for the response agent to skip a
    `CreateThread` (~300ms). If criteria moves off-server, the response tier must create its own thread and
    gets ~300ms slower. **Measure end-to-end**, not just the criteria tier.
  - On-device extraction now sits on the **mobile critical path before** the API call.

---

## Backend Changes (Phase 0 — do first, independently shippable)

Additive and **backward-compatible** (respects `AppVersionPolicy:MinVersion`). Older clients omit the new
fields → server behavior unchanged.

### `UserQuery` (additive)

```csharp
public class UserQuery
{
    public required string Query { get; set; }
    public string? UserId { get; set; }
    public string? ConversationId { get; set; }

    // NEW (optional). When Criteria is present and non-empty, the server SKIPS the cloud
    // mini extraction call and uses these directly for Cosmos RAG.
    public GameQueryCriteria? Criteria { get; set; }
    public string? CriteriaSource { get; set; } // "on-device" | "cloud" | null
}
```

### `AgentServiceClient.GetRecommendationsAsync`

- Accept optional pre-extracted `criteria`. If present and non-empty, **bypass** `ExtractGameCriteriaViaAgent`
  and go straight to Cosmos RAG + response tier.
- Emit `CriteriaSource` into telemetry so cloud-vs-device can be compared.
- **Instrumentation (baseline):** add a discrete `CriteriaExtraction.Duration` metric + a per-request
  criteria-source dimension + a "mini calls saved" counter. Today only end-to-end `AgentRequest.Duration`
  exists — this is the cloud baseline the experiment measures against.

### Backward-compat verification

- Existing functional tests pass unchanged (they represent the old contract).
- Request/response JSON is a **superset** (additions only); no field renamed/removed/retyped.
- `Criteria == null` path is byte-for-byte the current behavior.

---

## Mobile Changes

### New: Settings screen + gear entry point

- **Gear icon** (`Ionicons` `settings-outline`, small, white) absolutely positioned **bottom-right of Landing**
  (LandingScreen.tsx), with safe-area padding. `testID="settings-button"`.
- Register `Settings` route in `App.tsx` `Stack.Navigator`.
- **Settings screen contents (v1):**
  - "On-device inference" toggle (disabled + explanatory note on unsupported devices).
  - Model status: `Not downloaded` / `Downloading N%` / `Ready (≈469 MB)` / `Error — retry`.
  - **Delete model** (reclaim storage) and **Re-download** actions.
  - Short honest description of what runs locally (criteria only) and the data caveat.

### New: on-device inference service (`services/localInference/`)

- Thin wrapper around `llama.rn`: lazy `require` (like `ratingPrompt.ts` does for `expo-store-review`) so a
  build without the native module degrades gracefully to cloud.
- Responsibilities: capability probe, model download + cache (`expo-file-system`), model load/unload,
  `extractCriteria(query)` returning `GameQueryCriteria | null` via **GBNF-constrained** decoding, and
  a strict **time budget** with cloud fallback.
- **No conversation history is passed to the on-device model.** Because on-device runs only on the first
  message of a thread, there is no prior context to resolve — this removes the need to port
  `ContainsContextualReference` and eliminates the entire cross-turn context-resolution risk for v1.

### New: settings/state + persistence (`services/localInferenceSettings.ts`)

- Mirror `ratingPrompt.ts` counter/flag pattern with `AsyncStorage` keys:
  - `@local_inference_enabled`
  - `@local_inference_chat_interactions` (cumulative)
  - `@local_inference_nudge_dismissed_at`, `@local_inference_nudge_dismiss_count`
  - `@local_inference_model_state`
- `incrementChatInteraction()`, `shouldShowLocalInferenceNudge()`, capability probe result cache.

### New: chat nudge banner (`components/LocalInferenceBanner.tsx`)

- Visual/interaction clone of `RatingBanner` (slide-in from top, backdrop dismiss, a11y announce).
- Copy: honest framing — e.g. *"Try on-device mode? Faster game understanding, processed on your phone.
  (~469 MB download, may use cellular.)"* → **[Enable] / ✕**.
- "Enable" flips setting + kicks off **silent background download**; banner dismisses; chat continues normally.

### ChatScreen wiring

- Increment cumulative interaction counter on each user-initiated query (text send + completed voice turn).
- After response render, evaluate `shouldShowLocalInferenceNudge()` (reusing the existing rating-timer
  scheduling shape); show `LocalInferenceBanner` if eligible.
- **Banner precedence (resolved):** never show two top-of-chat banners in one session. The **rating banner
  takes precedence** (established, store-rating relevant); if it shows this session, the local-inference
  nudge defers to a later eligible session. Their independent cooldowns naturally desync them, and once the
  user opts in the nudge never fires again — so the collision window is small.
- On send: if capable + enabled + model loaded **+ this is the first user message of the thread**
  (`conversationId == null`), attempt on-device extraction within budget; attach `Criteria` +
  `CriteriaSource` to the `getRecommendations` payload; else send `Query` only (all follow-ups → cloud).

### Visual cue

Because on-device runs only on the **first message** of a thread, a persistent header chip would over-claim
(it would imply every message is local). The honest, self-explanatory cue is **per-message**:

- **Per-message badge** (primary): a small `Ionicons hardware-chip-outline` glyph + muted "On-device" label
  under the **first-message AI response** whose criteria were actually extracted on-device. If that message
  fell back to cloud (incapable / model-not-ready / timeout / parse-fail), **no badge** is shown — so the
  badge is always truthful.
- **Landing footer line** (feature-level, kept regardless): `AI Model: OpenAI GPT` →
  `AI Model: On-device + GPT` when the feature is enabled and the model is ready.
- No persistent chat-header chip — on-device is a per-message behavior (first messages only), so a
  message-level badge is the only accurate representation.
- Optional polish: one-time subtle toast the first time an on-device extraction succeeds.

---

## Capability Gating

Feature offered only when the device can realistically run a ~0.5B model. Detected via **`expo-device`**
(`Device.totalMemory`, `Device.modelName`, `Device.osVersion`) — a small, Expo-managed dependency.

**Starting thresholds (v1, tuned in the Phase 2 spike on physical devices):**

| Platform | Arch | RAM floor | OS floor | Chip proxy |
|---|---|---|---|---|
| **Android** | `arm64-v8a` required | ≥ 4 GB `totalMemory` | Android 10 (API 29) | — |
| **iOS** | arm64 | ≥ 4 GB | iOS 15.1 (current deployment target) | A13 / iPhone 11 or newer |

- Peak runtime memory for 0.5B q4 (weights ~469 MB + KV/compute) is ~1–1.5 GB; the 4 GB floor leaves headroom
  and avoids low-RAM OOM/jank. 3 GB devices are excluded in v1, revisited after real telemetry.
- Probe result cached; unsupported devices transparently remain on cloud and **never see the nudge** (the
  Settings toggle appears disabled with a short "not supported on this device" note).

---

## Messaging & Privacy Framing

**Critical accuracy constraint:** only criteria extraction is local. The user's message **still goes to the
cloud** for the response (gpt-4.1 + RAG).

- ✅ Allowed: "on-device", "processed on your phone", "faster game understanding", "works even when the
  network is flaky (for understanding your request)".
- ❌ Avoid: "your data stays on your device", "fully private", "nothing leaves your phone", "offline chat".
- Settings description states plainly what is and isn't local.

---

## Packaging & Distribution

| Payload | Ships to | Size impact | Notes |
|---|---|---|---|
| **Native runtime** (compiled llama.cpp libs via `llama.rn`) | Everyone (in binary) | ~single-digit–low-tens MB (arm64 only via AAB split) | Present regardless of opt-in |
| **Model weights** (GGUF) | Opted-in users only | ~469 MB in app-private sandbox | On-demand HTTPS download; cached; deletable |

- **No OS permission prompt** — downloading into the app sandbox needs no runtime permission on either
  platform. The opt-in is a **product** decision (courtesy + transparency), not an OS requirement.
- `llama.rn` config plugin adds iOS memory entitlements (`increased-memory-limit`,
  `extended-virtual-addressing`, prod profile), forces C++20 on pods, and declares Android
  `libOpenCL.so` / `libcdsprpc.so` as optional (`required=false`) for GPU/Hexagon acceleration.
- **Integration watch-point:** both `plugins/ios-build-fixes.js` and the `llama.rn` plugin patch the Podfile
  `post_install`; **list `llama.rn` after** the local build-fix plugins in `app.json` and verify one clean
  `expo prebuild` / `expo run:android`.

### Model hosting

- **Production:** host the GGUF in **Azure Blob Storage**, served through the **existing Azure Front Door**
  already fronting the API — reuses your infra, IaC, and CDN edge. Versioned path
  (`/models/qwen2.5-0.5b-instruct-q4_k_m/v1/model.gguf`) so a model swap is a new path, never an overwrite.
- **Integrity:** verify the downloaded file's **SHA256** against a known-good hash before first load
  (q4_k_m = `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`); re-download on mismatch.
- **Hackathon bootstrap:** may start from the Hugging Face URL to move fast, but **move to Blob + Front Door
  before any real user rollout** (HF has no SLA / may rate-limit app traffic).
- Resumable/interruptible download (`expo-file-system` `createDownloadResumable`) so a dropped connection
  mid-download resumes rather than restarts.
- **Model refresh (resolved):** for users with the setting enabled, a new model version publishes to a new
  versioned path plus a small **version manifest** the app checks on launch; a newer version **downloads
  silently in the background** and cuts over on next load (same seamless UX as first install). Gated to
  **stable builds only**; SHA256-verified; the old file is deleted after the new one validates.

---

## Metrics & Deliverable (the experiment output)

1. **Criteria-tier latency:** on-device p50/p95 vs cloud-mini p50/p95, per device class.
2. **End-to-end perceived latency** (mobile), capturing the A7 regression.
3. **Cost/query:** mini calls eliminated × unit price → $ per 1k queries.
4. **Criteria quality:** field-level agreement + exact-match vs cloud on a fixed eval set; recall@k change in
   returned games.
5. **Fallback rate + reasons:** incapable / model-not-ready / timeout / parse-fail. (Follow-up messages are
   intentionally routed to cloud and are **not** counted as fallbacks.)
6. **Device coverage:** % of active installs capable (from telemetry).
7. Secondary: model download size/time, cold vs warm inference, battery/thermal per N inferences.

> **Coverage denominator:** on-device applies to first-thread messages only, so cost/latency wins are
> reported against *first-message* traffic. Report both the per-first-message win and the blended
> whole-traffic win (first-message share × per-message win) so the headline isn't overstated.

**Eval set:** ~100–200 representative first-message queries with gold criteria (bootstrap from current
cloud-mini output, hand-correct).

---

## Phased Delivery

| Phase | Scope | Risk | Dependency |
|---|---|---|---|
| **0. Backend baseline + contract** | `CriteriaExtraction.Duration` metric; additive `Criteria`/`CriteriaSource` on `UserQuery`; server skips mini call when criteria present; unit tests | Low | None (ship first) |
| **1. Eval harness** | ~100–200 query gold set; field-agreement + recall@k scorer | Low | Phase 0 telemetry |
| **2. Android runtime spike** | Add `llama.rn`; plugin ordering; clean prebuild; load Qwen2.5-0.5B + GBNF; trivial extract call | Medium | Native build |
| **3. Settings + gear + persistence** | Settings screen, gear entry, toggle + confirmation, model status/delete, capability probe | Low | — |
| **4. Nudge + interaction counter + cue** | Cumulative counter, `LocalInferenceBanner`, visual cue, silent download wiring | Low | Phase 3 |
| **5. Fallback chain + payload wiring** | First-message gate, time budget, attach `Criteria`; end-to-end A/B | Medium | Phases 0,2,3 |
| **6. Measurement + report** | Dashboards + the latency/cost graph | Low | Phases 1,5 |
| **Stretch. iOS** | Enable runtime on iOS; optionally iOS Foundation Models variant | Medium | Phase 5 |

---

## Testing

- **Unit (mobile, Jest):** interaction counter increments + persistence; `shouldShowLocalInferenceNudge`
  (threshold, cooldown, dismiss cap, capability, already-enabled); first-message gating (on-device only when
  `conversationId == null`); capability probe; fallback decision logic (mock `llama.rn`).
- **Unit (backend, xUnit):** `Criteria`-present bypasses mini extraction; `Criteria`-null preserves current
  path; `CriteriaSource` telemetry; backward-compat of `UserQuery` deserialization.
- **Functional:** existing suite unchanged (old contract) + new case sending pre-extracted criteria.
- **Manual (Android dev build):** silent download during active chat; seamless cutover; cue appears only when
  serving; Settings delete/re-download; unsupported-device path.

---

## Resolved Decisions (previously open)

- **On-device scope narrowed to first-thread messages** → eliminates cross-turn context risk and drops the
  `ContainsContextualReference` port; cue becomes a per-message badge. (See [Scope Decision](#scope-decision-from-clarifying-questions), [Visual Cue](#visual-cue).)
- **Capability thresholds** → arm64 + ≥ 4 GB RAM; Android 10+ / iOS 15.1+ (A13+). Via `expo-device`. Tuned in
  Phase 2. (See [Capability Gating](#capability-gating).)
- **Model hosting** → Azure Blob + existing Front Door, versioned path, SHA256 integrity, resumable download;
  HF URL only as a hackathon bootstrap. (See [Model hosting](#model-hosting).)
- **Banner precedence** → rating banner wins; local-inference nudge defers; never stack. (See ChatScreen wiring.)
- **Per-message cue** → adopted as the primary cue (badge on first-message on-device responses) + Landing
  footer line; header chip dropped.
- **Model/quant** → **Qwen2.5-0.5B-Instruct q4_k_m** is v1 (best JSON-quality/size tradeoff; Qwen advertises
  strong structured output). Run a bake-off **only if** ~469 MB proves too heavy for capability coverage or
  user testing, scored by field-agreement on the Phase 1 eval set at each candidate:
  - Llama-3.2-1B (128K vocab, q4 ~0.8 GB) — larger but strong.
  - SmolLM2-360M (small vocab, q4 ~0.3 GB) — smallest, weaker instruction-following/JSON.
  Do not pre-optimize; decide with data.
- **Nudge copy & threshold** → fixed at the current copy and **≥ 5 cumulative interactions**. No A/B.
- **Model refresh** → silent background update for enabled users (stable builds only); versioned path +
  manifest check, SHA256-verified, seamless cutover. (See [Model hosting](#model-hosting).)

## Remaining Open Items

- Final RAM floor (3 GB vs 4 GB) pending Phase 2 measurements on physical devices.
