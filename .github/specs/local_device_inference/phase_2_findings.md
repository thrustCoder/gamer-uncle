# Phase 2 Findings — On-Device Local Inference Spike

**Feature:** On-device criteria extraction for Gamer Uncle (see `local_device_inference_plan.spec.md`)
**Phase:** 2 (Android runtime spike) + follow-up experiments (2b)
**Date:** 2026-08-21
**Status:** Spike complete. Runtime proven end-to-end on two physical devices. Key go/no-go decisions surfaced below.

> This document captures the empirical findings from the Phase 2 spike for reuse in
> presentations and Phase 3/5 planning. All latency numbers are measured on physical
> hardware with the shipping model + grammar, not estimates.
>
> 👉 **Just need the go/no-go?** Read **[`phase_2_decision_summary.md`](./phase_2_decision_summary.md)** — a
> 1-page, plain-English summary with options and a recommendation. This file is the full evidence trail
> (1000+ lines) and is written in chronological order, so **later sections correct earlier ones** — §20 and
> §21 in particular revise conclusions in §1–§18. Read §21 before quoting any number from §16 or §18.

---

## 1. Executive summary

- **The native runtime works.** `llama.rn` (llama.cpp) loads Qwen2.5-0.5B-Instruct (q4_k_m GGUF) on a
  physical Android device and produces a **grammar-constrained** `GameQueryCriteria` JSON via a single
  decode. Validated on a 2019 mid-flagship (Pixel 4) and a 2023 flagship (Galaxy S23).
- **Latency is the problem, not correctness.** Even on a flagship (S23, Snapdragon 8 Gen 2), a realistic
  first-message extraction takes **~5.3 s** on CPU with the original prompt — roughly **8× slower than the
  cloud "mini" extractor (~0.65 s)**. Shortening the prompt (§10b) cuts this to **~3.8 s** (still ~6×). This
  is a genuine UX regression on the first message if on-device serves.
- **GPU/NPU offload did NOT help** for this 0.5B model — now measured on both accelerators (§10c). On the
  S23, latency ranks **CPU 3.8 s < GPU (Adreno OpenCL) 4.6 s < NPU (Hexagon HTP) 5.7 s**; the offload really
  ran (device usage confirmed), it's just slower. Production default stays **CPU-only**. Note this is
  llama.cpp's experimental HTP backend, not a purpose-built QNN runtime.
- **The latency is prefill-bound (~80%).** ~4.2 s of the ~5.3 s is *prompt processing*, not token
  generation. This changes which levers matter (prompt length and a fast-prefill runtime — not a bigger model).
- **BREAKTHROUGH — `q4_0` quant + compact grammar make on-device CPU latency-competitive with cloud (§16).**
  Measured on the S23: the best config (**q4_0 + optional-key grammar + omit-prompt**) does a cold
  first-message extraction in **~0.69 s** and warm ones in **~0.28 s** — warm *beats* cloud-mini (0.65 s),
  cold is within ~1 s of it, and it's **~5.5× faster** than today's shipping q4_k_m+full (3.8 s). Two stacking
  levers: `q4_0` gives ~3.4–4× faster prefill (one-line model swap; §19 shows this is a general ARM-CPU win, not
  `i8mm`-only — it reproduces 2.3–3.4× on ARMv8.2 Pixel 4/5); the compact grammar
  gives ~4.5× fewer decode tokens (but the grammar change ALONE backfired — it needs a matching omit-prompt).
  No accelerator, no vendor lock-in, portable across ARMv8.2+ CPUs. Gate: gold-set quality A/B before defaulting.
- **GATE RESULT — the quality A/B kills on-device as a cloud replacement (§18), with measurement caveats (§20).**
  Running the full 100-query gold set across all four `{q4_k_m,q4_0}×{full,compact}` configs on the S23: the 0.5B
  gets **player counts wrong ~31% of the time** and fails outright on **13%** of queries (q4km-full) — both
  artifact-free measurements. `q4_0`+full is **rejected** (47–48% null extractions from query-echo, reproduced on
  three devices); `q4_0`+compact adds 12% runaway-to-cap nulls; the cleanest config (q4_k_m+compact, 2% null)
  craters numeric player/playtime fields. **Net: latency was never the binding constraint, quality is.**
  ⚠️ The committed `cloud-mini` baseline is a **synthetic Phase-1 fixture** (82/100 "predictions" are copies of the
  answer key), and the array scorer is stricter than production matching — so the *direction* is solid but the
  quantified "4–8×" gap is withdrawn pending a real cloud capture (§20). The §16.4 stability fix was validated at
  scale in the same run (400 completions, 0 crashes). On-device stays an opt-in offline/cost/privacy fallback;
  the untested quality levers are few-shot prompting and a larger model (§20.5).
- **KV-cache reuse ~halves the *typical* latency (§13) — implemented + measured.** Keeping the context warm
  and resetting per query via `loadSession` of a primed system snapshot (`restore`) gives **~2 s per
  extraction** and fixes a **cross-query KV-contamination bug** we caught. Residual: a minor restored-vs-fresh
  drift. (Its `loadSession` churn is also the most exposed to the llama.rn grammar-sampler crash, §16.4.)
- **Every *accelerator* we could test lost (§10c, §12).** GPU (OpenCL) and NPU (HTP) are slower than CPU for a
  0.5 B; purpose-built GenieX/QNN NPU is fast (~1.1 s projected) but flagship-only (8 Elite/2024+),
  Qualcomm-only, no iOS — no-go for broad shipping. The winning path is **CPU, optimized** (above), not silicon.
- **iOS (§17): same llama.cpp stack works and inherits every JS win for free** — but needs a new EAS build to
  measure (llama.rn is still uncommitted). ANE/MLX are out-of-scope: neither supports GBNF grammar.
- **Two production-config changes are required to ship on-device at all:** the app must move to React
  Native's **New Architecture**, and **`expo-splash-screen`** must be added.

---

## 2. What the spike set out to prove

From the plan, Phase 2 is the "Android runtime spike": prove `llama.rn` can (a) load the model on device,
(b) run a GBNF-grammar-constrained decode that yields a valid `GameQueryCriteria`, and (c) measure the
criteria-tier latency so Phase 5's time-budget/fallback design has real numbers.

---

## 3. Method

| Aspect | Detail |
|---|---|
| Runtime | `llama.rn` 0.12.9 (llama.cpp), New Architecture (codegen-only module) |
| Model | Qwen2.5-0.5B-Instruct, **q4_k_m** GGUF (~469 MB), downloaded to app storage |
| Decode | Grammar-constrained (GBNF generated from the C#/TS schema), `temperature: 0`, `n_predict: 256` |
| Prompt | System prompt + 3 few-shot examples + user query |
| Trigger | Dev-only floating "LI" button → `runLocalInferenceSpike()` → on-screen report + logcat |
| Instrumentation | Reports device model, `gpu`, `reasonNoGPU`, loaded native lib, compute `devices`, `loadMs`, `latencyMs`, parsed criteria |
| Query | "Can you suggest cooperative games for 8 players?" |

### Devices

| Device | SoC | Arch / key feature | Android | Role |
|---|---|---|---|---|
| Pixel 4 | Snapdragon 855 | ARMv8.2 — **no `i8mm`** | 13 | Older mid-flagship (floor case) |
| Galaxy S23 (SM-S911U1) | Snapdragon 8 Gen 2 | ARMv9 — **`i8mm` + `bf16`** | 16 | 2023 flagship (GPU/NPU capable) |

---

## 4. Results

### 4.1 Runtime validation ✅

- Model downloads (~469 MB), loads into a llama context, and decodes end-to-end.
- The GBNF grammar reliably yields a **valid, parseable** `GameQueryCriteria`.
- Works under **New Architecture** (Fabric) alongside all existing native deps (WebRTC voice,
  reanimated, screens, gesture-handler, svg, async-storage).

### 4.2 Criteria correctness ✅ (after the extraction fix)

For "cooperative games for 8 players" the model now emits:

```json
{ "MinPlayers": 8, "MaxPlayers": 8, "Mechanics": ["cooperative"] }
```

The backend interprets player count as a **range-overlap** (`c.maxPlayers >= 8 AND c.minPlayers <= 8`),
so this correctly means "any game that seats 8". See §6 for the bug this fixed.

### 4.3 Latency — the headline data

Same query, same model, same grammar. "Cold" = first decode after a fresh model load. "Warm (cached
prompt)" = repeat of the *identical* query (llama.cpp reuses the prompt KV-cache — **not representative**
of production, where each query is unique). "Realistic (unique query)" = warm context, a **new** prompt.

| Device | Path | Cold (first) | Warm, cached prompt | Realistic (unique query) |
|---|---|---:|---:|---:|
| **S23** (SD 8 Gen 2) | **CPU** (`n_gpu_layers=0`) | 6.2 s | 1.1 s | **~5.3 s** |
| **S23** | **GPU** (OpenCL + Hexagon) | 12.8 s* | 3.7 s | — |
| **Pixel 4** (SD 855) | **CPU** (GPU unavailable) | — | 4.7 s | **~5–7 s** |
| **Cloud gpt-4.1-mini** (reference) | server | — | — | **~0.65 s** (p50 654 ms, p95 749 ms) |

\* S23 GPU cold includes one-time **OpenCL kernel JIT compilation**.

Model load times: cold ~20–31 s (dominated by the ~469 MB download + GPU/HTP init on first run); warm
~1.5 s; reusing an already-loaded context ~0 s.

**Read of the data:**
- The flagship S23 is **not meaningfully faster** than the 4-year-older Pixel 4 for a realistic
  first-message query (~5.3 s vs ~5–7 s). Both are ~8× slower than cloud-mini.
- Warm-cached numbers (1.1 s / 3.7 s) are a **measurement artifact** of repeating the identical query and
  should not be quoted as production latency.

### 4.4 Where the time goes — prefill vs decode (critical)

Deriving from the S23 CPU numbers:

- Warm, cached prompt ≈ **decode only** (~40 output tokens) ≈ **1.1 s**.
- Realistic unique query ≈ **prefill (~450 prompt tokens) + decode** ≈ **5.3 s**.
- ⟹ **Prefill ≈ 4.2 s (~80% of the total)**, at roughly ~100 prompt-tokens/sec on CPU.

**This reframes the whole optimization problem: the bottleneck is *prompt processing*, not generation.**
A bigger model makes both worse; the real levers are prompt length and prefill throughput (§7).

---

## 5. Platform findings (required to ship)

1. **New Architecture is mandatory.** `llama.rn` 0.12.9 ships only a codegen (New-Arch) module with no
   old-bridge fallback, so `newArchEnabled` must be `true`. The whole app was re-validated working under
   New Arch (navigation, telemetry, WebRTC voice `isVoiceSupported: true`).
2. **`expo-splash-screen` is required under New Arch.** Expo's precompiled `ReactActivityDelegateWrapper`
   references `expo.modules.splashscreen.SplashScreenManager` reflectively; without the package the app
   crashes on launch (`ClassNotFoundException`). Fix: `expo install expo-splash-screen` (31.0.13).
3. **Native variant selection is CPU-feature-gated.** `llama.rn` only loads its OpenCL+Hexagon variant
   (`...dotprod_i8mm_hexagon_opencl`) when the CPU reports **`i8mm`** (ARMv8.6+). The Pixel 4 (ARMv8.2)
   silently falls back to a CPU-only `dotprod` lib — GPU offload is simply unreachable on that class of SoC.

---

## 6. Extraction-quality bug + fix

**Symptom:** the 0.5B model put a *mechanic* word into the *title* field, e.g. `{"name":"Cooperative"}`.
The backend filters `name` as a title (`CONTAINS(c.name, 'cooperative')`), which matches ~zero games and
reproduces the production **"no games match the criteria"** symptom. (Player-count numbers were already
correct — the backend's range-overlap makes `MinPlayers:8, MaxPlayers:8` mean "seats 8".)

**Fix (two layers):**
- **Prompt:** an explicit "never put a genre/mechanic word in `name`" rule + 3 few-shot examples
  (including the exact failing case).
- **Parser safety net:** `reclassifyGenreName` moves a bare genre/mechanic word out of `name` into
  `Mechanics`/`Categories`, backed by a shared shorthand vocabulary (`criteriaVocab.ts`). A real title that
  merely *contains* a genre word (e.g. "Mystery of the Abbey") is left untouched.

Validated on both devices → correct `{ MinPlayers:8, MaxPlayers:8, Mechanics:['cooperative'] }`. 37 unit
tests pass; type-check clean.

> **Note on the tradeoff:** the few-shot prompt improved quality but *added ~2 s of prefill latency*
> (Pixel 4 went 4.7 s → 6.9 s when the examples were added). Because latency is prefill-bound, this is a
> direct quality↔latency dial (see §7).

---

## 7. Can a different model or runtime fix the latency?

Short answer: **a heavier model will not help — it will make latency worse.** The productive levers are
prompt length, a fast-prefill runtime, and possibly not using an LLM for the easy cases.

### 7.1 Model size — wrong direction for latency
Latency scales ~linearly with parameter count for *both* prefill and decode. A 1.5B model is ~3× slower,
a 3B ~6×. A larger model is only justified if it removes the need for the few-shot prompt (better
zero-shot structured output) — but the ~250 prompt-tokens saved cannot offset a 3–6× per-token slowdown.
**Net: heavier = slower.** Bigger models are a *quality* lever, not a *latency* lever.

### 7.2 Prompt length — the cheapest, highest-ROI lever (prefill-bound)
Since ~80% of the time is prefill, cutting the prompt cuts latency almost linearly. Trimming the few-shot
examples (3 → 0–1) and tightening the system prompt could take prefill from ~4.2 s to ~1.5–2 s
(**total ~2.5–3 s, roughly a 45% cut**) with **no runtime change**. The parser safety net already catches
the main failure mode, so we can afford fewer examples. **Action:** A/B prompt variants on the Phase 1
eval harness (field-agreement vs latency) before anything else.

### 7.3 Runtime — the real fix is NPU-accelerated *prefill*
`llama.cpp` on CPU does prefill at ~100 tok/s (measured). Purpose-built mobile stacks do prefill an order
of magnitude faster by using the NPU/GPU:

| Runtime | Accel | Notes | Effort |
|---|---|---|---|
| **llama.rn / llama.cpp** (current) | CPU (**GPU + NPU both measured slower** — see §10c) | Turnkey RN module; CPU prefill ~100 tok/s | Shipping |
| **ONNX Runtime + QNN EP** | Qualcomm **Hexagon NPU** | Fastest prefill/decode on Snapdragon; ~150 ms first-token in published benchmarks | High — ONNX conversion, QNN delegate, per-SoC support, Qualcomm-only, new native module |
| **MediaPipe LLM Inference** (Google) | GPU / NNAPI | Turnkey Android API; Gemma-family oriented; ~200 ms first-token for 2B | Medium — new native module; not a drop-in for Qwen GGUF |
| **MLC-LLM** | GPU (Vulkan/OpenCL, TVM-tuned) | Tuned kernels *might* beat our OpenCL result; uncertain for 0.5B | High — TVM compile pipeline |

> **Measured (§10c):** the NPU/GPU path *inside llama.rn* was tested directly (the build already ships the
> Hexagon `HTP0` and Adreno `GPUOpenCL` backends) and is **slower** than CPU for the 0.5B (CPU 3.8 s < GPU
> 4.6 s < NPU 5.7 s). So the "NPU wins" hypothesis below applies only to a **purpose-built QNN/ONNX
> runtime**, not to llama.cpp's experimental HTP backend.

> Published mobile numbers report **first-token latency of ~150–400 ms** and generation of 30–55 tok/s for
> small models on NPU/GPU runtimes — i.e. an NPU that does prefill at ~1000+ tok/s would turn our ~4.2 s
> prefill into <0.5 s. **This is the only path to on-device latency that competes with cloud**, but it is a
> significant engineering lift (new native module + model conversion + per-device fallbacks).

### 7.4 Don't-use-an-LLM fast-path (pragmatic, cheap)
Much of criteria extraction is deterministic: "8 players" → player count; "under 60 minutes" →
`MaxPlaytime:60`; genre/mechanic keyword match. A **rules/regex fast-path** could resolve a large fraction
of first-message queries in **<10 ms** with high precision, deferring to the LLM (or cloud) only for
genuinely ambiguous phrasing. This sidesteps the latency problem for the common cases and is cheap to
build and score on the gold set.

### 7.5 Recommendation (ordered)
1. **Shorten the prompt and re-measure** — cheap, ~45% cut, A/B on the eval harness.
2. **Prototype a rules-based fast-path** for common criteria — could make most queries effectively instant.
3. **Only if on-device must beat ~2 s while online:** spike an **NPU runtime** (ONNX Runtime + QNN, or
   MediaPipe) — big lift, revisit after (1)+(2).
4. **Do not go to a heavier model for latency.** Consider a larger model only if *quality* (not speed)
   demands it, and pay the latency with the levers above.
5. **Product reframe:** on-device's value is **cost (≈zero marginal), offline resilience, and privacy** —
   not latency. Decide whether on-device should serve while online at all, or primarily offline / as a
   background cost-saver, with cloud always preferred when it's fast.

---

## 8. Decisions made in this phase

| Decision | Rationale |
|---|---|
| **CPU-only default** (`DEFAULT_N_GPU_LAYERS = 0`) | GPU offload was slower for 0.5B in every regime; avoids the 12.8 s OpenCL cold-start. `nGpuLayers` kept as an option for future larger models. |
| **New Architecture enabled** | Mandatory for `llama.rn` 0.12.9. |
| **`expo-splash-screen` added** | Required under New Arch to avoid launch crash. |
| **Extraction fix shipped** (prompt + `criteriaVocab` reclassification) | Fixes the mechanic→`name` "no games match" bug. |
| **Spike instrumentation** (`getLoadInfo`) | Reports device + accel path for benchmarking. |

---

## 9. Open decisions for Phase 3 / 5

- **Latency strategy** (from §7): prompt-shortening + rules fast-path first; NPU-runtime spike only if
  on-device must be fast while online.
- **Time budget & fallback** (Phase 5): today's 4 s budget means on-device essentially always falls back
  to cloud on these devices. Set the budget from measured p50/p95 *after* the latency work, and gate
  on-device by measured latency per device class (not just the 4 GB RAM bar).
- **Capability gating:** consider whether to serve on-device only on devices/paths where it's fast enough
  or when offline.
- **Model hosting:** spike used the Hugging Face bootstrap URL + size-only integrity. Ship via Azure Blob +
  Front Door with SHA256 + resumable download (already a resolved decision in the plan).
- **Merge hygiene:** revert the diagnostic 60 s `extractCriteria` timeout in `index.ts` to the default
  before merging Phase 2.

---

## 10b. Iteration — prompt shortening + quality fix (2026-08-21, measured on S23)

Acting on §7.2 (prefill-bound → shorten the prompt). The extraction prompt was compressed from the
verbose "13 field-doc lines + 3 full-object few-shot examples" form, relying on the GBNF grammar for
structure and the parser safety net instead of long examples.

| | Old prompt | Compact prompt |
|---|---:|---:|
| System-prompt tokens (approx) | ~330 (incl. 3 full-object examples) | ~210 |
| Total prompt tokens (approx) | ~450 | ~230 |

### Latency won, but the first compaction *broke extraction quality*

The first aggressive pass (~181 tokens) cut latency to **3421 ms** on the S23 — but on-device testing
caught **two quality regressions** that unit tests could not (they only exercise the parser, not the live
0.5B):

1. **Category hallucination.** The field line read `Categories: theme/genre (mystery, party, strategy,
   horror)`. The 0.5B **copied that inline example list verbatim** into every output
   (`Categories: ["mystery","party","strategy","horror"]`), regardless of the query. Classic small-model
   example-leakage.
2. **`name` echo.** With no explicit "use null" rule, the model dumped the whole query into `name`
   (`"cooperative games for 8 players"`). Because the backend title-filters (`CONTAINS(c.name, …)`), that
   single field re-creates the exact **"no games match"** production bug that Phase 0/1 fixed.

The GBNF grammar already permits `null` for every field, so this is purely the 0.5B failing to comply —
prompt wording alone is not a reliable guardrail on a model this small.

### Fix (two layers)

- **Prompt:** removed the leaky inline word-lists from the `Mechanics`/`Categories` field lines; added an
  explicit `name = null unless the user names a specific published title` rule; replaced the single example
  with **two null-teaching examples** (one shows `Categories=null`, one shows `Categories=["mystery"]`).
- **Parser safety net (`stripDescriptiveName` in `criteriaParser.ts`):** deterministically drops `name`
  when it contains description words that never appear in real titles (`games|players?|minutes?|hours?`).
  This catches the echo even when the model ignores the prompt. Runs before the existing genre
  reclassifier; a bare genre word ("cooperative") still routes to `Mechanics`.

### Measured result (S23, 3 cold unique-query runs)

| Metric | Old prompt | Compact + fix |
|---|---:|---:|
| Realistic cold latency | ~5.28–5.37 s | **3854 / 3874 / 3894 ms (≈3.87 s)** |
| Extracted criteria | `{MinPlayers:8, MaxPlayers:8, Mechanics:['cooperative']}` | **identical — clean** |
| `name` echo / category hallucination | none | **none** |

Net: **~5.3 s → ~3.87 s (~27% cut)** with **no runtime change** and **no quality loss**. (The broken
3.4 s pass is not shippable; the correct prompt costs ~0.45 s more for the second example, which is worth
it.) `loadMs` after first run is ~0.65 s — the GGUF stays in the OS page cache, so warm-disk re-load is
cheap; the ~12 s cold `loadMs` only happens on the very first load after install/boot.

**Status:** code shipped + unit-tested (47 tests pass, type-check clean) + on-device confirmed on the
S23 (Snapdragon 8 Gen 2). Still ~5–6× the cloud-mini p50 (654 ms) and above the 4 s budget's comfort
zone once UI overhead is added. **The NPU/GPU offload lever was then tested (§10c) and found
counterproductive** — so ~3.8 s is effectively the llama.rn floor on flagship hardware.

---

## 10c. Iteration — backend offload spike: CPU vs GPU vs NPU (2026-08-21, measured on S23)

llama.rn 0.12.9 exposes `getBackendDevicesInfo()` and a `devices` init param, and the installed build
**already compiles in the Hexagon NPU backend** (`HTP0`) and the Adreno GPU backend (`GPUOpenCL`). So the
"NPU runtime" lever (§7.3) could be tested **with a JS param change only — no app rebuild, no model
conversion.** The spike enumerates backend devices, then re-loads the model under each backend and runs
the same grammar-constrained extraction.

**Result (S23, same query, same harness — representative run):**

| Backend | `devices` requested | Devices used | loadMs | latencyMs | Criteria |
|---|---|---|---:|---:|---|
| **CPU** (default) | — (`n_gpu_layers=0`) | reports GPUOpenCL/HTP0 available, computes on CPU | 564 | **3779** | clean ✅ |
| GPU (Adreno) | `['GPUOpenCL']`, `n_gpu_layers=99` | `GPUOpenCL` | 2347 | 4594 | clean ✅ |
| NPU (Hexagon) | `['HTP0']`, `n_gpu_layers=99` | `HTP0` | 672 | 5654 | clean ✅ |

Across repeats: CPU ~3.76–3.79 s, NPU ~5.65–6.68 s (≈0.5 s of the first NPU run is one-time HTP kernel
JIT; warm steady-state ≈6.1 s), GPU ~4.6 s incl. ~2.3 s OpenCL kernel prep. **Ranking is stable:
CPU < GPU < NPU.** The offload genuinely happened (`devicesUsed` confirms `HTP0` / `GPUOpenCL`), so this is
not a silent CPU fallback — the accelerators really are slower here.

**Why the NPU/GPU lose for a 0.5B:** the per-op dispatch + host↔accelerator transfer overhead dominates
when each matmul is tiny (0.5B weights, short sequences). Accelerators only amortize that overhead at
larger model / batch sizes. This is the same effect seen for GPU earlier, now confirmed for the NPU.

**Important nuance for §7.3:** this measures **llama.cpp's experimental HTP backend**, *not* a purpose-built
Qualcomm QNN/Genie runtime. The hypothesis that a dedicated QNN/ONNX-Runtime stack could do NPU prefill at
~1000+ tok/s is **not refuted** by this result — but it now carries a real caveat: the turnkey NPU path
inside our current runtime does not help, so beating CPU requires a *different, purpose-built* NPU stack
(large lift: new native module + ONNX/QNN model conversion + per-SoC support), with no guarantee it wins
for a model this small. **All cheap/medium on-device latency levers are now exhausted at ~3.8 s.**

**Quality is backend-independent:** all three backends returned the identical clean
`{MinPlayers:8, MaxPlayers:8, Mechanics:['cooperative']}`, confirming the §10b prompt + parser fixes hold
regardless of compute placement.

---

## 11. Decision (2026-08-21) — reframe on-device as cost/offline/privacy, cloud primary

With all cheap/medium latency levers exhausted (prompt shortening → ~3.8 s; GPU/NPU offload measured
*slower*; heavier model *worse*), on-device criteria extraction bottoms out at **~3.8 s on a 2023 flagship
— ~6× the cloud-mini p50 (654 ms)**. It is **not latency-competitive** with cloud and cannot be the primary
first-message path while the device is online.

**Chosen direction: (A) reframe.** On-device's value is **cost (≈zero marginal), offline resilience, and
privacy — not latency.** Therefore:

- **Cloud stays the primary path whenever the device is online and cloud is reachable.** On-device serves as
  an **offline / degraded-connectivity fallback** and an **optional cost-saver** the user can opt into, never
  as a silent latency regression on the happy path.
- **Keep the validated Phase 2 engine** (grammar-constrained extraction + prompt + parser safety net +
  CPU-only default + 4 s budget with cloud fallback). It is correct and backend-independent.
- **Do NOT pursue a purpose-built NPU runtime (option B) now.** The measured negative on llama.cpp's HTP
  backend, plus the large lift (new native module, ONNX/QNN conversion, per-SoC support) and uncertain payoff
  for a 0.5B, make it a poor bet at this stage. Revisit only if a concrete requirement emerges for sub-second
  on-device *while online* (and re-scope as a dedicated project, not a spike).
- **Do NOT drop on-device (option C).** The offline/cost/privacy value is real and the engine already works.

**Implication for later phases:** the production wiring (a future phase) should gate on-device behind
connectivity/opt-in rather than racing it against cloud on latency. The Settings-UI phase should frame the
toggle as "works offline / saves cost," not "faster."

---

## 12. NPU runtime spike (option B) — plan, projection, de-risk path (2026-08-21)

Per the follow-up decision, we are pursuing **option B** — a **purpose-built Qualcomm NPU runtime** — to see
whether it can beat the ~3.8 s CPU floor. Crucially, this is a *different* stack from §10c: §10c measured
**llama.cpp's experimental HTP backend** (slow); option B uses Qualcomm's optimized **GenieX / QAIRT**
runtime with QNN-compiled context binaries (the classic "Genie" runtime is being deprecated in favor of
**GenieX**).

### 12.1 Authoritative per-device numbers (corrected) + the decisive support finding

The direct read of AI Hub's `perf.yaml` for `llama_v3_2_1b_instruct` (GenieX/QAIRT, W4A16, context 4096)
gives per-device numbers — and a decisive gating fact.

> **DECISIVE: Snapdragon 8 Gen 2 is NOT a supported target.** `perf.yaml`'s `supported_chipsets` are
> `8-elite-gen5, 8-elite, x2-elite, x-elite, sa8775p, sa8650p, sa8255p, qcs7181, qcs8750, qcs9075, sa8295p,
> qcs8275`. The **oldest supported phone SoC is Snapdragon 8 Elite** (Galaxy S25, 2024+). There is **no 8
> Gen 2 / 8 Gen 3 / S23 / S24** in the matrix. **Our S23 physically cannot run this** — the on-device LLM
> path is a **2024+-flagship-only** capability, matching the ChatApp README's "8 Gen 3+ / needs newer HTP
> meta-build" warning.

Correction to my first estimate: the "~4,571 prefill / ~93.6 decode" I initially cited is the **Snapdragon
X2 Elite (a laptop/compute SoC), W4A16** — *not* a phone and certainly not the S23. Real **phone** numbers:

| Device (GenieX, W4A16) | Prefill tok/s | Decode tok/s | TTFT range (ms) |
|---|---:|---:|---:|
| Snapdragon 8 Elite Gen 5 QRD | 4,588 | 74.9 | 28–893 |
| **Snapdragon 8 Elite QRD ≈ Galaxy S25** | **3,350** | **67.1** | 38–1,222 |
| Snapdragon X2 Elite CRD (laptop) | 4,640 | 93.7 | 28–883 |
| **Snapdragon 8 Gen 2 (our S23)** | **— unsupported —** | **—** | **—** |

(W4 precision is slower: 8 Elite QRD ≈ 1,690 prefill / 33.4 decode. W4A16 is the one to use.)

**Corrected projection** for our workload (~215 prompt + ~70 output tokens), on the **best supported phone
(Galaxy S25 / 8 Elite, W4A16)**:

| Path | Prefill | Decode | Total (compute) |
|---|---:|---:|---:|
| CPU (measured, S23) | ~2.15 s | ~1.65 s | **~3.8 s** |
| GenieX NPU on **S25/8 Elite** | ~0.06 s | ~1.04 s | **~1.1 s** |
| GenieX NPU on **S23 (8 Gen 2)** | — | — | **not runnable** |

So on a *supported* flagship, ~1.1 s is a real ~3.5× win over CPU and near-cloud — but **only on 2024+
flagships**, and **not on the device in hand**. Prefill essentially vanishes; **decode dominates**, so
shortening the output (the grammar forces ~70 tokens today) remains the key second lever. GenieX almost
certainly can't do GBNF grammar (it's not llama.cpp), so we'd prompt for a compact object + rely on the
tolerant parser.

### 12.2 De-risk plan (measure before integrating)

Before building any React Native native module, get raw prefill/decode numbers for a small LLM on real
Qualcomm silicon, cheaply:

1. **Qualcomm AI Hub Workbench account** → `qai-hub configure --api_token …` (free; Qualcomm ID).
2. **Export** a small supported LLM to GenieX/QAIRT for our SoC target:
   `qai-hub-models export llama_v3_2_1b_instruct --checkpoint DEFAULT_W4 --target-runtime geniex_qairt --device "…"`
   (cloud compile, ~1–2 h). Llama-3.2-1B is the best-supported small model with published fast numbers; our
   own Qwen2.5-0.5B is *not* in the AI-Hub zoo, so use Llama-3.2-1B as the **benchmark proxy**.
3. **Run on-device** via the GenieX "run a local model" CLI (successor to `genie-t2t-run`) with a
   representative ~215-token prompt; read the reported **prefill vs decode** rates and time-to-first-token.
4. Compute projected end-to-end for our token profile; **go/no-go** vs the ~3.8 s CPU baseline (target < ~1.5 s).

### 12.3 De-risk plan — now blocked by two hard gates

The intended cheap de-risk was: Qualcomm AI Hub account → export Llama-3.2-1B for the target SoC (~1–2 h
cloud compile) → run via the GenieX CLI on real silicon → read prefill/decode. Two gates now block the
*empirical* step:

1. **No supported device in hand.** The S23 (8 Gen 2) is not a supported target (§12.1). Measuring would
   require a **Galaxy S25 / 8 Elite (or newer)** physical device, or a **Qualcomm Device Cloud (QDC)** session
   on a supported device.
2. **Qualcomm AI Hub account** (free, Qualcomm ID) is required both to compile a bundle and to use QDC.

Both need the user. Until then, the **`perf.yaml` projection (§12.1) is the authoritative "what we'd get"**:
~1.1 s on an S25-class device (W4A16), not runnable on the S23.

### 12.4 Risks that bound the value regardless of speed

- **Flagship-only reach.** GenieX/QNN on-device LLM targets **8 Elite (2024+) and newer**. The S23 and the
  overwhelming majority of the Android fleet are **excluded**. So even at ~1.1 s it can't serve the broad
  offline/cost use case that motivated on-device (decision A) — it's a **premium-tier-only** capability.
- **Qualcomm-only + no iOS.** Apple Neural Engine needs a completely different stack (CoreML/MLX). Half the
  market gets nothing from this path.
- **Large integration lift.** A **new Android native module** (C++ GenieX/QAIRT APIs — not a turnkey RN
  package), bundled QAIRT `.so` libs, a **per-SoC context binary** (~1 GB for 1B W4A16), a large model
  download, and **no GBNF grammar** (rely on prompt + tolerant parser).
- **Decode-bound.** The win is all prefill; decode (~67 tok/s on S25) × our ~70-token grammar output ≈ 1 s,
  so output-shortening is required to push below ~1 s.

### 12.5 Conclusion & recommendation (autonomous, pending user review)

**What we got:** on a *supported 2024+ flagship* (S25 / 8 Elite), GenieX/QNN projects to **~1.1 s** — a real
~3.5× win over the ~3.8 s CPU path and near cloud (654 ms). **But the device in hand (S23) and the broad
Android fleet cannot run it at all**, and integration is a large, Qualcomm-only, iOS-excluded lift.

**Recommendation: do NOT build the GenieX integration now.** The blocker is not latency (it's good on
supported HW) — it's **reach**: a premium-flagship-only, single-vendor, high-effort path does not serve the
broad offline/cost value that justified on-device in the first place. This *reinforces* decision A (CPU
on-device as a universal offline/cost fallback; cloud primary online). **Revisit only** if we deliberately
choose to ship a "fast offline mode on newest flagships" as a premium feature.

**If the user still wants the empirical flagship number** (e.g., for the deck): provide a Qualcomm AI Hub
API token and I'll compile Llama-3.2-1B for an 8-Elite target and benchmark it on **QDC** (no physical S25
needed) to confirm the ~1.1 s. That refines the number but does not change the reach conclusion.

---

## 13. Bonus lever — system-prompt prefix KV-cache reuse (measured on S23, 2026-08-21)

The one remaining **CPU-only, universal** lever we hadn't tested: our ~200-token system prompt is identical
on every request, so if llama.rn/llama.cpp reuses the KV cache for that shared prefix across *different*
queries on a warm context, prefill — ~80% of our latency — should largely disappear.

**Measured** (load CPU once, then four first-message queries on the *same* warm context; two independent runs):

| Query | Shares with prior | latencyMs (run A / run B) |
|---|---|---:|
| q1 (cold) | — | 3807 / 3713 |
| q2 (different query) | system prefix only | 1913 / 1938 |
| q3 (different query) | system prefix only | 2056 / 2099 |
| q4 (= q1 verbatim) | full prompt | 1913 / 1942 |

**Win: ~48% for warm queries** (3.7–3.8 s cold → ~1.9–2.1 s warm), reproducible. Because we keep the context
loaded for the app session, only the *first* extraction after a cold load pays the full ~3.8 s; **every
subsequent extraction — even a brand-new query — is ~2 s.** That roughly halves the *typical* on-device
latency and materially improves the offline/fallback value (§11) — no NPU, no vendor lock-in, every device.

**The catch — reproducible cross-query contamination.** With temperature 0 (greedy, deterministic), q4 is
byte-identical input to q1, yet it produced a *different* result: a phantom `MaxPlaytime:60` that cold q1
never emits, appearing from q2 onward and persisting (plus a doubled `Categories`). Both runs reproduced this
exactly, so it is **genuine KV state carryover from prior queries**, not noise. Naive context reuse therefore
**corrupts independent extractions** — the ~48% win is not free.

**Fix — implemented and measured (3 strategies).** We added an `ExtractOptions.resetStrategy` plus a
`primeSystemPrompt()` snapshot to `LocalInferenceService` and swept three isolation strategies on the S23,
same four queries (q4 repeats q1 verbatim; at temperature 0 a *correct* strategy must reproduce q1):

| Strategy | How | q1 | q2 | q3 | q4(=q1) | Cross-query contamination | Matches fresh baseline? |
|---|---|---:|---:|---:|---:|---|---|
| **none** (reuse) | leave KV as-is | 3807 | 1914 | 2007 | 1914 | **YES** (q4 gains phantom `MaxPlaytime:60`) | q1 yes, q4 no |
| **clear** | `clearCache()` per query | 4305 | 4551 | 4721 | 4512 | **no** (q4 ≡ q1 `{8,8,coop}`) | **yes (clean)** |
| **restore** | `loadSession(primed system)` per query | 1985 | 2361 | 2302 | 2104 | **no** (q4 ≡ q1, self-consistent) | **no** (systematic `MaxPlaytime:60`) |

(`primeSystemPrompt()` = `clearCache` → prefill the chat-templated system prefix with `n_predict:0` →
`saveSession`; measured `ok:true, ms:2606`.)

**What this shows:**
- **The contamination is a real, documented behaviour** — llama.rn's `clearCache` docstring literally says
  *"Without clearing, the model may use cached context from previous conversations."* Both `clear` and
  `restore` **fix the cross-query drift** (q4 reproduces q1 within the strategy).
- **`clear` is correct but has no warm benefit** — it re-prefills the whole prompt every call (~4.3–4.7 s,
  even slower than a cold run due to `clearCache` overhead + thermal drift late in the sweep).
- **`restore` keeps the speed AND fixes the cross-query bug** — ~2.0–2.4 s for **every** query (including the
  first, because priming pre-warms the system KV), i.e. **~2.2× faster than `clear`** and no q→q drift.
- **But `restore` is not bit-identical to a fresh prefill.** Its outputs are self-consistent (q4≡q1) but
  carry a systematic phantom `MaxPlaytime:60` that the clean `clear`/cold path omits.

**Refinement attempt — raw-prompt byte-exact priming (also measured).** We hypothesised the divergence was a
*rendering* mismatch: the primed prefix (`getFormattedChat([system], add_generation_prompt:false)`) not
tokenising exactly like the system portion of the `messages:[system,user]` path. So for `restore` we switched
extraction to a **raw prompt** built from `getFormattedChat([system,user], add_generation_prompt:true)` and
asserted it `startsWith` the exact primed string — guaranteeing a byte-exact shared prefix. **Re-measured:
`restore:q1` STILL produced `MaxPlaytime:60`** (latency unchanged ~1.96 s). So the hypothesis is **refuted** —
the divergence is **not** prompt rendering. It is that **`saveSession`/`loadSession` KV state is not
numerically bit-identical to a fresh prefill** (f16 serialization / restore path), and the weak 0.5B's
greedy (temp 0) decode flips at a decision boundary on that tiny difference. (The base model is independently
noisy too — e.g. `clear:q3` still mis-reads "6 players" as 4 — so part of the overall error is model weakness,
not the cache.)

**Why we can't currently get fast + fresh-identical.** The three exposed llama.rn primitives are
`clearCache` (full wipe → fresh but re-prefills), in-memory reuse (`none` → fast but retains contaminating
suffix), and `saveSession`/`loadSession` (fast + suffix-reset but not bit-exact). What's missing is a
**partial *in-memory* KV trim** — keep the exact fresh system KV in RAM, drop only the per-query suffix
(`llama_kv_cache_seq_rm` exists in llama.cpp but isn't surfaced by llama.rn 0.12.9). That single primitive
would give fast **and** fresh-identical; obtaining it means a llama.rn enhancement/patch or fork.

**Net (measured, not hypothetical):**
- The **cross-query contamination bug is real and fixed** by both `clear` and `restore`.
- **`restore` is the pragmatic on-device optimization:** ~2 s for *every* extraction (≈2.2× faster than
  `clear`, ≈halves cold), correct across queries — at the cost of a **minor per-extraction drift vs fresh**
  that is small relative to the 0.5B's own noise. A gold-set eval would quantify whether that drift is
  acceptable for shipping.
- **`clear` is the safe-but-slow option:** fresh-exact output, but ~4.5 s (no warm benefit).
- **Fast + fresh-identical needs a partial-KV-trim primitive** llama.rn doesn't yet expose.

---

## 14. Other CPU-side levers — now measured (§16 has the full matrix)

Inventory of levers on the shippable CPU path, updated with on-device measurements (S23, 2026-08-23):

1. **`restore` KV-cache reuse (§13) — implemented + measured.** ~2 s/extraction (≈halves cold), fixes the
   cross-query contamination bug; residual is a minor restored-vs-fresh drift. A llama.rn **partial-KV-trim**
   (`llama_kv_cache_seq_rm`) would make it fresh-identical. (Prefix reuse also re-confirmed via completion
   `timings.cache_n` in §16 — warm queries re-process only ~17–22 of ~300 prompt tokens.)
2. **Shorten the output — MEASURED, and it WORKS once the prompt matches the grammar (§16.2).** A compact
   GBNF that makes every key optional (no forced `null`) cuts decode from ~83 to **~17 tokens (~4.5×)**.
   *Caveat learned the hard way:* the grammar change ALONE backfired — the 0.5B hallucinated values for the
   now-optional fields (and once ran away to 255 tokens) because the prompt still said "use null". Pairing it
   with an **omit-prompt** ("output only stated keys; omit the rest") fixed both the tokens and the quality.
3. **ARM-optimized quantization — MEASURED, a big win (§16.1).** Swapping `q4_k_m → q4_0` (llama.cpp repacks
   Q4_0 into the S23's `i8mm` GEMM kernels) gave **~3.4–4× faster prefill** and ~1.4× faster decode — no code
   change beyond the model file. Slightly coarser quantization → minor quality differences (A/B on the gold
   set before defaulting).
4. **Task-specific tiny model.** Still the biggest *quality* lever (the 0.5B is the dominant error source),
   but a real ML project — not pursued.
5. **iOS on-device — assessed (§17).** Feasible via the *same* llama.rn/llama.cpp stack (all the JS-only wins
   above port for free), but needs a new EAS iOS build to measure. The "true ANE" (CoreML/MLX) path is a
   poor fit: **neither supports GBNF grammar-constrained decoding**, our reliability backbone.

Explicitly **off the table** per prior direction: rules/regex fast-path.

---

## 16. Levers matrix — measured prefill/decode split (S23, 2026-08-23)

We added exact per-extraction instrumentation (llama.rn completion `timings`: `prompt_n/ms`,
`predicted_n/ms`, `cache_n`) and a `resetStrategy` / `grammarMode` option to `LocalInferenceService`, then
swept **2 quantizations × 2 grammars** over a fixed 3-query set. Each cell = one fresh model load + 3
extractions on the `none` reset path (q1 = cold full prefill; q2/q3 reuse the cached system prefix). q4_0 +
compact grammar additionally uses the omit-prompt (§16.2).

**Cold q1 (full ~300-token prefill):**

| model | grammar | latency | prefill tok/s | decode tokens | decode tok/s | criteria |
|---|---|---:|---:|---:|---:|---|
| q4_k_m | full | 3778–3817 | 133–134 | 83 | 54 | `{8,8,cooperative}` ✅ |
| q4_k_m | compact | 2231 | 136 | **17** | 58 | `{8,8,cooperative}` ✅ |
| q4_0 | full | 1528–1683 | **450–538** | 76 | 77–80 | `{8,8,60}` (missed mechanic) |
| **q4_0** | **compact** | **691** | **552** | **17** | **86** | `{8,8,cooperative}` ✅ |

**Warm q2/q3 (system prefix cached — only ~17–22 prompt tokens re-processed, `cache_n`≈280–395):**

| model | grammar | latency | decode tokens |
|---|---|---:|---:|
| q4_k_m | full | 1978–2073 | 85–92 |
| q4_k_m | compact | 593–632 | 22 |
| q4_0 | full | 1080–1182 | 74–76 |
| **q4_0** | **compact** | **276–280** | **15–17** |

### 16.1 Quant (§14.3): q4_0 is a large, free win on ARM CPUs generally (not just ARMv8.6+/i8mm)

`q4_0` prefill is **~3.4–4× faster** than `q4_k_m` on the S23 (133 → 450–552 tok/s); decode is also ~1.4× faster
(54 → 77–86 tok/s). Cold latency alone drops **3.8 s → 1.5 s** at the same (full) grammar. It's a one-line model
swap. **Originally attributed to the `i8mm` int8-matmul kernels on ARMv8.6+ — but §19's cross-device test refutes
that:** the same ~2.3–3.4× cold-prefill win reproduces on ARMv8.2 devices *without* `i8mm` (Pixel 4 = 3.4×, Pixel
5 = 2.3×), because `q4_0`'s simpler blocks accelerate on the shared `dotprod`/SDOT path too. `i8mm` raises the S23's
*absolute* throughput but is not the source of the `q4_0`-vs-`q4_k_m` gap — so the win is portable to most 2018+
ARMv8.2 Android devices, not just 2022+ flagships. Cost: coarser quantization changes some outputs and (per §18)
sharply raises the 0.5B's extraction-failure rate (q4_0/full ~47–48% null across all three devices), which is why
the gold-set A/B disqualifies it as a default.

### 16.2 Output shortening (§14.2): compact grammar — a trap, then a win

Cutting the forced 10-key JSON to an optional-key grammar drops decode from ~83 to **~17 tokens (~4.5×)**.
But the *grammar change alone backfired*: with the prompt still saying "use null", the 0.5B filled the
now-optional fields with **hallucinated values** (`MaxWeight:1, averageRating:9, ageRequirement:18,
Categories:['mystery']`) and once **ran away to 255 decode tokens** (parse-failed) — because the rigid
structure that previously bounded it was gone. Adding an **omit-prompt** ("output ONLY stated keys; omit the
rest; never guess") fixed it: clean `{8,8,cooperative}`, 15–17 decode tokens, no runaway. Lesson: **grammar
and prompt must be co-designed** — a looser grammar needs a stricter prompt.

### 16.3 The stack: q4_0 + compact + omit-prompt

The two levers **stack multiplicatively** (prefill from quant, decode from shorter output):

| Config | Cold (q1) | Warm (q2/q3) |
|---|---:|---:|
| q4_k_m + full (today's shipping config) | **3.8 s** | ~2.0 s |
| q4_0 + full | 1.5 s | ~1.1 s |
| q4_k_m + compact | 2.2 s | ~0.6 s |
| **q4_0 + compact (best)** | **0.69 s** | **~0.28 s** |

**The best on-device config runs a cold first-message extraction in ~0.69 s and warm ones in ~0.28 s — on a
2023 flagship CPU, no accelerator, no vendor lock-in.** Warm is **faster than the cloud-mini p50 (0.65 s)**;
cold is within ~1.05 s of it. This overturns §15's earlier "on-device is not a latency play" conclusion for
the CPU path — with q4_0 + compact, on-device is **latency-competitive with cloud** on capable hardware
(and still ~5.5× faster than where we started). Quality on these three queries is clean; a gold-set eval is
the gate before shipping q4_0 and the compact grammar as defaults.

### 16.4 Stability note — llama.rn 0.12.9 grammar-sampler SIGSEGV

While building the matrix we repeatedly hit a **native crash** (`SIGSEGV` in
`rnllama::llama_rn_context_completion::initSampling` / `common_sampler_free`; fault address literally
contained GBNF bytes like `::= "-"`) when many grammar-constrained completions + cache resets
(`clearCache`/`loadSession`) accumulate in one process. It is intermittent-to-deterministic under churn and
killed the app mid-run. Workaround used for measurement: **one (model×grammar) cell per process** on the
low-churn `none` path, with each run logged immediately (so a crash still leaves data) and an on-device
cursor auto-advancing cells across relaunches. **Implication for production:** the `restore` path (which
cycles `loadSession` every query) is the most crash-exposed; a llama.rn upgrade or a native patch to the
sampler lifecycle is needed before leaning on aggressive KV cycling. The plain `none`/single-grammar path is
stable.

---

## 17. iOS on-device — feasibility assessment (§14.5)

**Can we run it on iOS today?** Not on the currently-installed dev build. llama.rn and New Architecture are
**uncommitted local changes** (committed HEAD has `newArchEnabled: false` and no `llama.rn`), so **no EAS iOS
build has ever included the native module**. Measuring on the user's iPhone requires a **new EAS iOS dev
build** (~15–20 min, interactive Apple auth) — not doable autonomously from a Windows host (no iOS build
toolchain; no `adb`/logcat equivalent to drive/observe the device). Once built, the LI spike would surface
results in the on-screen Alert for manual reading.

**How much would port for free?** All the wins above are **JS-only** (q4_0 model spec, compact grammar,
omit-prompt, KV strategies, timings) — they'd apply to iOS automatically. Apple Silicon is ARMv8.6+ with
`i8mm`, so the **q4_0 prefill speedup should carry over**, and Apple's performance cores are strong, so CPU
latency is likely in the S23 ballpark or better.

**Is the "true ANE" path worth it?** No, for our use case. Runtime landscape (2025):

| iOS runtime | Speed | Memory | **GBNF grammar?** | Notes |
|---|---|---|---|---|
| **llama.cpp** (our stack, Metal/CPU) | good | moderate | **✅ yes** | only runtime with native grammar-constrained decoding |
| MLX (Apple, Metal GPU) | fastest | moderate | ❌ no | best raw tok/s, but no structured-output guarantee |
| CoreML / **ANE** | slow–moderate | lowest | ❌ no | lowest power; grammar only via custom app-layer token filtering |

The Apple Neural Engine (CoreML) and MLX **do not support GBNF grammar-constrained decoding** — the exact
mechanism that guarantees our valid `GameQueryCriteria` JSON. Moving to ANE/MLX would mean **re-implementing
constrained decoding in the app layer** (custom token masking), a significant lift, to gain lower power at
*lower* speed (CoreML) — a poor trade for a latency/reliability-sensitive extraction. This mirrors the
Android NPU conclusion (§12): the accelerator path sacrifices the grammar backbone. **Recommendation: keep
llama.cpp (CPU, q4_0 + compact) on iOS too**; treat ANE as out-of-scope. (Minor shipping note: embedding
llama.cpp in an App Store build has had review nuances around dynamic model loading — verify before release.)

---

## 18. Gold-set quality A/B — the decisive gate (S23, 100 queries, 2026-08-23)

This is the quality gate §15/§16 flagged as the prerequisite before defaulting `q4_0`/compact. It is the
single most decision-relevant experiment in the study: it measures **extraction quality**, not just latency,
against the cloud extractor the app ships today.

### 18.1 Method

- **Gold set:** the full 100-query eval set (`services/eval/.../data/gold-set.jsonl`), tag-stratified (name 24,
  combo 21, mechanics 11, categories 10, players 9, playtime 8, weight 7, age 6, rating 4).
- **Device:** S23 (kalama / 8 Gen 2, ARMv8.6 **with i8mm**). Quality is model+grammar-determined and
  ~hardware-independent (same GGUF + grammar + temp 0 → same tokens on any CPU), so the quality A/B needs only
  **one** device; the Pixels (§19) add latency/prefill points, not quality.
- **Configs (4):** the 2×2 of `{q4_k_m, q4_0}` × `{full grammar, compact grammar + omit-prompt}`, each run over
  all 100 queries in one pass, with the **§16.4 stability fix active** (`recycleEvery=6`, `resetStrategy:'none'`).
- **Baseline:** the committed `cloud-mini` predictions (gpt-4.1-mini), scored identically.
- **Scoring:** offline via the Phase-1 .NET harness (`GamerUncle.LocalInference.Eval`) — null-aware field
  agreement across the 10 criteria fields, array micro-P/R/F1 for Mechanics/Categories, exact-match (all 10),
  and Recall@k against the games snapshot. On-device predictions were scraped from device logcat (400 rows) and
  replayed through the same scorer as the baseline.

> ⚠️ **Read §20 and §21 before quoting the `cloud-mini` column or the array-field F1 numbers.** The cloud baseline
> in this table is a *synthetic* Phase-1 fixture — §21.5 replaces it with a real gpt-4.1-mini capture (exact-match
> **74%**, not 82%) and shows its 653 ms latency was fiction (real: **3644 ms**). §21.1 also shows the on-device
> numbers here were depressed by a **prompt bug**; a few-shot fix lifts exact-match 10% → 26%. The on-device
> columns below are real measurements, but they are *not* the model's ceiling.

### 18.2 The scorecard (all 100 queries, temp 0)

| Metric | **cloud-mini** | q4km-full | q4km-compact | q4_0-full | q4_0-compact |
|---|---|---|---|---|---|
| **Null / hard-fail** | **0** | 13 | **2** | **48** | 12 |
| **Exact-match (10/10)** | **82%** | 10% | 3% | 10% | 4% |
| name | 100% | 69% | 74% | 79% | 84% |
| MinPlayers | 100% | 69% | 34% | 68% | 37% |
| MaxPlayers | 98% | 69% | 37% | 70% | 39% |
| MinPlaytime | 98% | 91% | 31% | 93% | 56% |
| MaxPlaytime | 100% | 79% | 27% | 84% | 55% |
| Mechanics (set-exact) | 95% | 37% | 33% | 77% | 73% |
| Categories (set-exact) | 97% | 59% | 23% | 67% | 33% |
| MaxWeight | 97% | 87% | 87% | 90% | 63% |
| averageRating | 97% | 84% | 90% | 92% | 68% |
| ageRequirement | 99% | 95% | 91% | 94% | 73% |
| **Mechanics F1** | **89%** | 29% | 31% | 32% | 34% |
| **Categories F1** | **95%** | 33% | 18% | 9% | 19% |
| **Recall@5** | **65%** | 16% | 7% | 14% | 11% |
| **Recall@10** | **79%** | 21% | 10% | 17% | 16% |
| Latency p50 | 653 ms | 2244 ms | 1236 ms | 1820 ms | **913 ms** |
| Latency p95 | 744 ms | 6277 ms | 4835 ms | 3738 ms | 5964 ms |

### 18.3 Reliability — two distinct q4_0 failure modes, and a compact-grammar surprise

The null column is not noise; each failure has a mechanism (characterized from `decodeN` distributions):

- **q4_0-full — 48% null, all "short" (non-runaway).** The model emits full-length, grammar-valid JSON but the
  only populated field is a *descriptive `name`* (it echoes the query) or every field is null. The parser's
  `stripDescriptiveName` safety-net (§6/§10b) correctly nulls those → degrade-to-cloud. So aggressive quant
  roughly **quadruples** the 0.5B's structured-extraction failures vs q4_k_m (13%→48%). **q4_0-full is
  disqualified outright.**
- **q4_0-compact — 12% null, *all* runaway-to-255.** The optional-key compact grammar lets q4_0 never emit the
  closing brace; it runs to the 255-token cap → truncated JSON → parse fail (these are the 5–6 s p95 outliers).
- **q4_k_m + compact — only 2% null (the cleanest of any config).** Counter-intuitively, the omit-unstated-keys
  grammar **improves** q4_k_m reliability vs full grammar (13%→2%): forcing all 10 keys as `value|null` makes the
  0.5B guess/echo more; letting it emit only confident keys produces fewer strip-to-empty failures.

**Stability-fix validation:** across 4 configs × 100 = **400 consecutive on-device completions**, the
`recycleEvery=6` context-recycle fix (§16.4) produced **zero native SIGSEGV crashes**. The grammar-sampler crash
that motivated the fix did not recur under real churn. (The nulls above are extraction-empty/parse-fail, not
crashes.) This is the on-device, at-scale validation the §16.4 unit tests could not provide.

### 18.4 Quality verdict — the 0.5B is not a drop-in replacement for cloud, on *any* config

> ⚠️ The first two bullets compare against the **synthetic** `cloud-mini` fixture and use the strict array scorer;
> per §20 the *direction* holds but these specific multiples are withdrawn pending a real cloud capture. The
> third bullet onward rests on artifact-free on-device measurements.

- **Exact-match collapses from 82% (fixture "cloud") to ≤10% (best on-device).** Even the strongest on-device
  config matches all 10 fields on 1 query in 10. *(Caveat: the 82% is a fixture artifact — see §20.1.)*
- **The retrieval-driving array fields look worst:** Mechanics F1 ~30% and Categories F1 9–33% on-device vs
  89% / 95% for the fixture; Recall@10 ~16–21% vs 79%. *(Caveat: the array scorer is stricter than production
  matching and the games snapshot is only 50 items — §20.2/§20.3. Real on-device F1 is higher than reported.)*
- **Artifact-free core finding:** a non-null on-device extraction gets the **player count wrong ~31% of the time**
  (`MinPlayers`/`MaxPlayers` agreement 69% on exact integers), on top of a **13% hard-failure rate**. That alone
  makes it unfit to replace the cloud extractor, independent of any scorer question.
- **No config is "quality-safe to default" against the current cloud path.** Ranking the on-device options:
  - **q4_k_m + full** — best-balanced field agreement (players 69%, playtime 79–91%), but slowest (p50 2.24 s)
    and 13% null.
  - **q4_k_m + compact** — most reliable (2% null) and cuts decode, but **craters numeric fields** (players
    34–37%, playtime 27–31%) because omitting uncertain keys drops values the gold expects.
  - **q4_0 + compact** — fastest on-device (p50 0.91 s) and best on `name`/Mechanics, but 12% runaway-null and
    weakest on weight/rating/age (63–73%).
  - **q4_0 + full** — **rejected** (48% null).
- **The speed/quality axes are in tension, not aligned:** the fastest config (q4_0/compact) is neither the most
  reliable (q4km/compact) nor the most accurate on structured fields (q4km/full). There is no dominant winner.

### 18.5 Latency reality-check — the "0.28 s warm" was best-case

§16 reported q4_0/compact at ~0.28 s warm / ~0.69 s cold. Those are **single-query, hand-picked warm** numbers.
Across the realistic 100-query distribution *with* periodic recycling and the 12 runaway outliers, q4_0/compact
is **p50 913 ms / p95 5964 ms** — still the fastest on-device config and close to cloud at the median, but the
tail is heavy and it no longer "beats cloud." Honest framing for the write-up: **on-device CPU can match cloud
at the median on capable ARMv8.6 hardware, but with a long quality-failure tail and far lower answer quality.**

### 18.6 Decision implication

The gate returns a clear answer: **do not default `q4_0`/compact — and, more fundamentally, do not treat the
0.5B on-device extractor as a drop-in replacement for cloud.** The latency work (§16) succeeded, but this A/B
shows latency was never the binding constraint — **quality is**. On-device 0.5B extraction is only defensible as
an **opt-in offline / cost / privacy fallback where a substantial quality drop is acceptable** (the exact multiple
vs cloud is unquantified until §20.1 is fixed; the artifact-free floor is ~31% wrong player counts + 13% hard
failures), exactly the posture §11 landed on. The most promising untried quality levers are **few-shot prompting**
and **a larger model** (§20.5), not another quant/grammar tweak. Production defaults remain unchanged (q4_k_m +
full + `none`, all new behavior opt-in), so nothing here ships by default.

---

## 19. Cross-device i8mm test (S23 + Pixel 4 + Pixel 5) — completed; the `q4_0` win is NOT `i8mm`-specific

**Goal.** §16.1 attributed the `q4_0` prefill win to ARM **`i8mm`** int8-matmul kernels (ARMv8.6+), which the S23
has but the Pixels don't. Re-running the benchmark on two ARMv8.2 devices isolates whether the win is `i8mm`-gated
or generic. **Result: it is generic — `q4_0` gives a large prefill speed-up on all three devices, including the
two without `i8mm`.** This *revises* the §16.1 framing.

**Device matrix (all three benchmarked, GOLD_MAX=30 on the Pixels):**

| Device | SoC | ISA | `i8mm` | `dotprod` |
|---|---|---|---|---|
| **S23** | kalama (8 Gen 2) | ARMv8.6 | **yes** | yes |
| **Pixel 4** | msmnile (855) | ARMv8.2 | no | yes |
| **Pixel 5** | lito (765G) | ARMv8.2 | no | yes |

### 19.1 Prefill throughput (t/s) and the `q4_0`-vs-`q4_k_m` ratio — the `i8mm` test

Full grammar, same prompt; "cold" = first query (promptN≈295, uncached), "med/p90" across the run:

| Device | q4km cold / med / p90 | q4_0 cold / med / p90 | **q4_0÷q4km (cold / med / p90)** |
|---|---|---|---|
| **S23 (i8mm)** | 138 / 76 / 93 | 465 / 129 / 266 | **3.4× / 1.7× / 2.9×** |
| **Pixel 4 (no i8mm)** | 99 / 58 / 78 | 340 / 129 / 286 | **3.4× / 2.2× / 3.7×** |
| **Pixel 5 (no i8mm)** | 55 / 43 / 55 | 128 / 80 / 128 | **2.3× / 1.9× / 2.3×** |

**Reading it:**
- **The `q4_0` speed-up survives without `i8mm`.** Cold-prefill ratio is **3.4× on Pixel 4** (no `i8mm`) — identical
  to the S23 — and **2.3× on Pixel 5**. The win comes from `q4_0`'s simpler block layout on the shared `dotprod`
  (SDOT) path, not from `i8mm`. `i8mm` raises *absolute* throughput (S23's raw numbers are highest) but is **not**
  the source of the `q4_0`/`q4_k_m` gap; on Pixel 4 the gap is even slightly larger than on the S23 at p90 (3.7×).
- **Absolute prefill tracks SoC tier**, as expected: S23 (8 Gen 2) > Pixel 4 (855) > Pixel 5 (765G). Pixel 5 is
  ~2–3× slower than the S23 in raw t/s.
- Pixel 5's cold ratio (2.3×) is lower than the others; its `q4_0` cold sample (g001) ran immediately after a
  429 MB model download, so I/O/thermal contention likely depressed that single cold point — its median/p90 (1.9×/
  2.3×) are steadier and still a clear win.

### 19.2 Degenerate (parse-fail) rate is hardware-independent — the §18 quality verdict generalizes

Same GGUF + grammar + temp 0 ⇒ same tokens on any CPU. The failure rates confirm it (normalized to %):

| Config | S23 | Pixel 4 | Pixel 5 |
|---|---|---|---|
| q4km-full | 13% | 10% | 10% |
| q4km-compact | 2% | 3% | 3% |
| **q4_0-full** | **48%** | **47%** | **47%** |
| q4_0-compact | 12% | 13% | 13% |

The `q4_0-full` failure rate is **~47–48% on every device** — the §18 quality collapse is not an S23 artifact; it
reproduces identically across three SoC generations. So the §18 A/B (which scored quality only on the S23) is
valid for the whole fleet, and `q4_0`'s disqualification holds everywhere.

### 19.3 Median latency (ms) per config per device

| Config | S23 | Pixel 4 | Pixel 5 |
|---|---|---|---|
| q4km-full | 2244 | 2894 | 4732 |
| q4km-compact | 1236 | 1433 | 2355 |
| q4_0-full | 1820 | 2136 | 3434 |
| **q4_0-compact** | **914** | **772** | **1306** |

`q4_0-compact` is the fastest config on every device; even the 2019/2020 Pixels land ~0.8–1.3 s median. But per
§18/§19.2 that config still carries a 12–13% runaway-null rate and low answer quality — fast, not shippable.

### 19.4 Conclusion

- **The `q4_0` prefill win is a general ARM-CPU win, not an `i8mm` (ARMv8.6+) exclusive** — it holds 2.3–3.4× cold
  across ARMv8.2 (Pixel 4/5) and ARMv8.6 (S23). Good news for portability *if* quality were acceptable.
- **The quality regression is equally general** — `q4_0-full` fails ~47–48% on all three devices — so the §18
  decision (don't default `q4_0`; on-device 0.5B is a cost/offline/privacy fallback, not a cloud replacement)
  stands unchanged and is now validated across the device fleet, not just one flagship.

**Method note.** Pixel 5's installed dev build was 2 months stale (2026-06-24) and predated the `llama.rn` native
module, so its LI probe button didn't render (`isAvailable()` false). Rather than a 15–20 min EAS rebuild, the
current `llama.rn` dev APK was pulled from Pixel 4 and side-loaded onto Pixel 5 (same arm64-v8a ABI + dev
signature). Both Pixels are on an AP-isolated Wi-Fi band (100% packet loss to the laptop), so Metro was reached
via an `adb reverse tcp:8081` loopback tunnel and the dev client launched at `http://localhost:8081`; they retain
internet for model downloads.

---

## 20. Threats to validity — what the §18 numbers can and cannot support (2026-08-24)

Before this study is used to justify a product decision, two measurement artifacts must be stated. Both **inflate
the apparent cloud-vs-on-device gap**. Neither changes the direction of the verdict, but they change which numbers
are quotable.

### 20.1 ⚠️ The `cloud-mini` baseline is a synthetic fixture, not a measurement

The Phase-1 plan specified the eval set be *"bootstrap[ped] from current cloud-mini output, hand-correct[ed]"*, and
the corpus-expansion script generated the baseline predictions directly from the gold labels:

```python
predicted = DEVIATIONS.get(gid, gold)   # gold copied verbatim unless a deviation was injected
obj = {"id": gid, "criteriaSource": "CloudMini", "latencyMs": latency_for(i), "predicted": predicted}
```

Verified against the committed files: **82 of 100 `cloud-mini` "predictions" are byte-identical to the gold answer
key** (80% of g001–g030, 83% of g031–g100). Consequences:

- The **"82% exact-match" for cloud is not a finding** — it is arithmetically just "100 minus the 18 rows where a
  deviation was hand-injected." It measures the fixture generator, not gpt-4.1-mini.
- The per-field cloud agreement (`name` 100%, `MinPlayers` 100%, …) is inflated for the same reason.
- The **cloud latency (p50 653 ms / p95 744 ms) is also synthetic** (`latency_for(i)`), not observed.
- Therefore the headline **"4–8× quality regression" is not defensible as stated.** The true multiple is unknown
  until real cloud predictions are captured.

**Fix (required before publishing the comparison):** run the same 100 gold queries through the live cloud extractor,
capture real `predicted` + `latencyMs` into a new predictions file, and re-score. Real cloud extraction latency is
independently available from production telemetry (`AppEvents | where Name startswith 'CriteriaExtraction'`).

### 20.2 The array-field scorer is stricter than production matching

`CriteriaScorer.NormalizeTerm` only trims + lowercases, then compares Mechanics/Categories as **exact string sets**.
The backend, by contrast, matches these fields flexibly (`CONTAINS`-style), and the app already ships a
canonicalization vocabulary (`criteriaVocab.ts`) that the .NET scorer does not use. Sampling on-device
(q4km-full) disagreements, **8 of the first 12 were string/normalization artifacts rather than comprehension
failures**:

| Query | gold | on-device | verdict |
|---|---|---|---|
| "I love worker placement games" | `Worker Placement` | `placement` | artifact |
| "A family friendly card game" | `Family`, `Card Game` | `family-friendly` | artifact |
| "Engine building please" | `Engine Building` | `building`, `engine building` | artifact (+FP) |
| "Push your luck dice games" | `Push Your Luck`, `Dice Rolling` | `push your luck dice` | artifact (merged) |
| "Economic games" | `Economic` | `economics` | artifact |
| "A heavy economic strategy game…" | `Economic`, `Strategy` | `economy`, `strategy` | artifact |
| "A dice game for the family…" | `Dice Rolling` | `dice` | artifact |
| "A fantasy adventure game for up to 4" | `Fantasy`, `Adventure` | `fantasy` | partial (recall miss) |
| "Quick family game under 45 minutes" | `Family` | `mystery` | **genuine error** |
| "Games about animals" | `Animals` | `mystery` | **genuine error** |
| "Party game for 6 to 8 people…" | `Party` | `mystery`, `cooperative` | **genuine error** |
| "A cooperative card game for 2 to 5" | `Cooperative` | `card game` (wrong field) | **genuine error** |

So the reported **Mechanics/Categories F1 (~30%) materially understates** the 0.5B's semantic quality; a
vocabulary-canonicalizing scorer that mirrors backend matching would score meaningfully higher.

**Fix:** port `criteriaVocab` canonicalization (or fuzzy/stem matching) into `CriteriaScorer` and re-score all runs.

### 20.3 Recall@k is low-confidence

`games-snapshot.json` contains only **50 games**. Recall@5/@10 over a 50-item corpus is a weak proxy for retrieval
behaviour against the real Cosmos catalogue and should not be quoted as a product metric.

### 20.4 What survives the artifacts (and keeps the verdict intact)

These are artifact-free — integer fields and failure counts, measured on real hardware across three SoCs:

- **Player-count accuracy 69%** (`MinPlayers`/`MaxPlayers`, q4km-full). These are exact integers: no synonym or
  scorer-strictness excuse. The 0.5B gets the player count **wrong ~31% of the time**.
- **Playtime agreement 79–91%** (q4km-full) — same reasoning, also artifact-free.
- **Hard-failure (null) rates: 13% (q4km-full), 2% (q4km-compact), 47–48% (q4_0-full), 12–13% (q4_0-compact)** —
  reproduced within ~1 pt on S23, Pixel 4 and Pixel 5 (§19.2).
- **Observed hallucinations in raw output**, e.g. "Tell me about Catan" → `{"name":"Catan","MinPlayers":8,
  "MaxPlayers":8,"MaxPlaytime":60,"Mechanics":["cooperative"],"Categories":["mystery"],"averageRating":8}`.

**Verdict impact:** the §18 conclusion — *don't default `q4_0`; the on-device 0.5B is not a drop-in replacement for
the cloud extractor* — **stands**, because it rests on these artifact-free numbers. What must be withdrawn is the
*quantified* claim ("82% → ≤10%", "4–8×") until §20.1/§20.2 are fixed.

### 20.5 Genuinely untested levers (could still move the quality ceiling)

Ranked by value-per-effort. Items 1–2 correct the measurement; items 3–5 could change the outcome:

1. **Capture a real cloud-mini baseline** (§20.1). Hours. Required for any published comparison.
2. **Vocabulary-aware array scoring** (§20.2). Hours. Raises on-device F1 toward its true value.
3. **Few-shot prompting — never attempted.** Every prompt iteration in this study moved *toward* brevity for
   latency (§10b, §16.2); nobody tested adding 2–3 worked examples. Few-shot exemplars are the standard remedy for
   small-model structured extraction, and `q4_0`'s ~3.4× cheaper prefill (§16.1/§19.1) makes the extra prompt
   tokens affordable for the first time. **Highest-value remaining experiment.**
4. **A larger model (e.g. Qwen2.5-1.5B-Instruct q4_0).** §14.4 repeatedly names the model as the real quality
   lever, but no larger model was ever measured. Estimated ~2–3 s latency; ~1 GB download is the shipping cost.
5. **Task-specific fine-tune / LoRA** of the 0.5B on criteria extraction. Highest ceiling, highest effort.

---

## 21. Prompt-contamination discovery + few-shot experiment + REAL cloud baseline (2026-08-24)

This section closes the two §20.5 gaps (a real cloud baseline; the untested few-shot lever). It produced the
study's most consequential result: **a large share of the on-device "quality ceiling" was a prompt bug, not a
model limit** — and a real-telemetry latency number that **inverts the study's original latency premise**.

### 21.1 ⚠️ Discovery: the shipping prompt's own examples poison the output

`CRITERIA_SYSTEM_PROMPT` ends with two worked examples containing the literal words **"cooperative"** (Ex1) and
**"mystery"** (Ex2). Checking those words against the gold set and the model's outputs:

| Word | Times in gold labels | Times emitted by model (q4km-full) | Emitted when the word was NOT in the user's query |
|---|---|---|---|
| **mystery** | **0** | 20 (full) / 33 (compact) | **20 / 33 — i.e. always** |
| **cooperative** | 4 | 22 | 19 |

The 0.5B copies the example vocabulary into unrelated queries — "Quick family game under 45 minutes" →
`Categories:["mystery"]`, "Games about animals" → `Categories:["mystery"]`. The prompt literally instructs *"Never
invent, guess, or copy words from these instructions"*, and the file's own comment notes this hazard for field
descriptions — but the **examples** had the same defect.

This is the dominant source of the array-field false positives that produced the poor F1 in §18 (Categories
FP=73). It is a **prompt bug, and therefore fixable** — which makes the §18 framing ("the 0.5B just can't do
this") wrong as stated.

### 21.2 Causal confirmation via ablation

Three prompts, all q4_k_m + full grammar, 100 gold queries each on the S23 — only the system prompt varies.
"Spurious array terms" = emitted Mechanics/Categories terms that appear neither in the user's query nor in gold:

| Prompt | Tracked example-word spurious emissions | **Total spurious array terms** |
|---|---|---|
| `default` (2 examples: "cooperative", "mystery") | 39 | **66** |
| `fewshot` (6 diverse examples, values drawn from each example's own query) | 12 (theme 4, pirate 5, deck building 3) | **26** |
| `noexamples` (identical rules, examples deleted) | **0** | **0** |

Removing the examples removes **100%** of the contamination — a clean causal demonstration. Note the few-shot arm
still leaks a little: with "mystery" gone the model latches onto the next nearest prompt nouns ("theme" from the
*field description* `Categories: theme or genre`, plus "pirate"/"deck building" from the new examples). **A 0.5B
will copy *something* from its prompt; the mitigation is to keep example vocabulary diverse and to make omission
the dominant demonstrated behaviour, not to expect zero copying.**

**Is this a general prompt bug or a small-model failure mode? Measured: it is small-model-specific.** Applying
the same spurious-term count to the real cloud capture (§21.5) — whose production prompt *also* contains worked
examples naming "Catan", "Ticket to Ride" and "Worker Placement":

| Extractor | Spurious array terms (in neither the query nor gold) | Example words copied spuriously |
|---|---|---|
| **cloud gpt-4.1-mini** (production prompt, has examples) | **1** | 0 |
| on-device 0.5B, `default` prompt | 66 | 39 |
| on-device 0.5B, `fewshot` | 26 | 12 |
| on-device 0.5B, `noexamples` | 0 | 0 |

The large model treats examples as *illustrations*; the 0.5B treats them as *vocabulary to reuse*. **So there is
nothing to fix in the cloud prompt** — but any future small-model work must treat example vocabulary as a
first-class contamination risk, and should measure spurious-term counts as a standard diagnostic.

### 21.3 Few-shot is a large, cheap quality win

Same device, model, grammar and gold set as §18 — only the prompt changed. `cloud-REAL` is the newly captured
real gpt-4.1-mini baseline (§21.5):

| Metric | **cloud-REAL** | default (§18) | **fewshot** | fewshot2 | noexamples |
|---|---|---|---|---|---|
| **Null / hard-fail** | 0 | 13 | **6** | 7 | 5 |
| **Exact-match (10/10)** | 74% | 10% | **26%** | 27% | 17% |
| name | 98% | 69% | 55% | 60% | 63% |
| MinPlayers | 100% | 69% | **85%** | 69% | 88% |
| MaxPlayers | 100% | 69% | **87%** | 74% | 85% |
| MinPlaytime | 97% | 91% | 93% | 90% | 91% |
| MaxPlaytime | 100% | 79% | **94%** | 94% | 92% |
| Mechanics (set-exact) | 93% | 37% | **77%** | 69% | 82% |
| Categories (set-exact) | 92% | 59% | 56% | 59% | 74% |
| MaxWeight | 86% | 87% | 88% | 81% | 42% |
| averageRating | 97% | 84% | 88% | 74% | 89% |
| ageRequirement | 99% | 95% | 94% | 93% | 93% |
| Mechanics F1 | 83% | 29% | 29% | 24% | 16% |
| Categories F1 | 85% | 33% | **45%** | 33% | 6% |
| **Recall@10** | 75% | 21% | **35%** | 30% | 18% |
| Latency p50 | 1197 ms¹ | 2244 ms | 2745 ms | 2777 ms | 2673 ms |

¹ direct model call, *not* the production agent tier — see §21.5.

**One prompt change, no model change, no quant change:**
- **Exact-match 10% → 26%** (2.6×)
- **Hard failures 13 → 6** (2.2× fewer)
- **Recall@10 21% → 35%** (1.7×)
- **Player counts 69% → 85–87%**, MaxPlaytime 79% → 94%, Mechanics agreement 37% → 77%

Against the real cloud baseline the gap **roughly halves**: exact-match 7.4× → 2.8×, Recall@10 3.6× → 2.1×.

**Cost:** the few-shot prompt is longer (promptN ≈ 369 vs 295), so p50 rises 2244 → 2745 ms (+22%). Cheap for the
quality gained — and still faster than the production cloud path (§21.5).

**The `noexamples` arm is instructive but not the winner.** It eliminates contamination entirely and posts the
best *agreement* on several fields (Categories 74%, Mechanics 82%), but its F1 collapses (Cat F1 **6%**) because
it becomes ultra-conservative and emits almost no array terms — agreement counts "both empty" as a match, F1 does
not. For retrieval, emitting the right terms matters, so `fewshot` (Recall@10 35%) beats `noexamples` (18%).

### 21.4 Iteration: fewshot2 traded player counts for `name` (net neutral)

`fewshot` regressed `name` (69% → 55%): every v1 example emitted a name and the concrete *"a description is NOT a
title"* counter-example had been dropped, so the model echoed descriptions into `name` ("quick family game",
"solo game") and once emitted the example's own title, "Wingspan", for the unrelated query "We have 5 players
tonight" — 22 regressions vs 8 gains.

`fewshot2` added an explicit negative example and stated `name=null` in every non-name example. It **did** recover
`name` (55% → 60%) and nudged exact-match (26% → 27%), but **regressed player counts** (MinPlayers 85% → 69%,
MaxPlayers 87% → 74%) and Recall@10 (35% → 30%) — the extra `name=null` boilerplate apparently diluted attention
on the numeric rules. **Net: `fewshot` (v1) remains the best on-device configuration.** With a 0.5B, prompt
capacity behaves like a budget: emphasising one field visibly costs another.

### 21.5 The REAL cloud baseline — two corrections to §20.1, pointing opposite ways

Captured by running all 100 gold queries through **gpt-4.1-mini** on the project's Foundry endpoint using the
**exact production system prompt** from `AgentServiceClient.ExtractGameCriteriaViaAgent` (temperature 0 for
reproducibility). The prediction file and capture script were experiment artifacts and were **not committed** —
the numbers below are the durable output. To reproduce, re-run the capture against the same gold set
(`services/eval/GamerUncle.LocalInference.Eval/data/gold-set.jsonl`).

**(a) Quality — the synthetic fixture was only mildly optimistic. §18's direction holds.**

| | synthetic fixture | **real gpt-4.1-mini** |
|---|---|---|
| Exact-match | 82% | **74%** |
| Mechanics F1 | 89% | 83% |
| Categories F1 | 95% | 85% |
| Recall@10 | 79% | 75% |
| Null | 0 | 0 |

So the §20.1 warning was correct in principle but small in magnitude (~8 pts). **Cloud really is far more accurate
than on-device**, and the quality comparison in §18 survives — now on real data.

**(b) Latency — this inverts the study's founding premise.** Production telemetry (`AppEvents`,
`CriteriaExtraction.Completed`, n=51, all real AI calls, zero cache hits) gives the **actual** server-side
criteria-tier latency:

| Cloud path | p50 | p90 | min | max |
|---|---|---|---|---|
| **Production agent tier (what users actually wait for)** | **3644 ms** | 4773 ms | 2616 ms | 7493 ms |
| Direct chat-completions call (this capture) | 1197 ms | ~1490 ms | — | — |

The entire study assumed cloud extraction cost **~650 ms** — a number that came from the synthetic fixture's
`latency_for(i)` generator and **was never measured**. The real production path is **3.6 s**, ~5.6× slower, and
its *minimum* observed value (2.6 s) still exceeds the on-device median. Consequences:

| Path | p50 |
|---|---|
| Production cloud agent tier | 3644 ms |
| on-device q4km + **fewshot** | 2745 ms |
| on-device q4km default | 2244 ms |
| on-device q4_0 + compact (§18) | 913 ms |

**Every on-device configuration is FASTER than the production cloud path** — 1.3× (few-shot) to 4× (q4_0/compact).
And this understates the on-device advantage, because the 3644 ms is measured *server-side* and excludes the
mobile→API network round-trip that a real user also pays.

The gap between the agent tier (3644 ms) and a direct model call (1197 ms) is thread-create + run + poll overhead
in the PersistentAgents flow — i.e. **~2.4 s of the cloud latency is orchestration, not model time**, and is
recoverable by the backend independently of any on-device work (see §21.6).

### 21.6 Revised conclusions

1. **"On-device is a latency regression" was false** — an artifact of an unmeasured fixture constant. On-device
   already beats the shipping cloud path on latency. The honest framing is: *on-device trades accuracy for speed
   and cost*, the exact opposite of the trade the study assumed for its first five sections.
2. **"The 0.5B's quality is the ceiling" was overstated.** A single prompt fix — costing nothing but tokens —
   moved exact-match 10% → 26% and halved the gap to cloud. The model was never given a fair prompt.
3. **A real gap remains.** Even the best on-device config (fewshot: 26% exact-match, 35% Recall@10, 6% hard
   failures) is ~2–2.8× worse than real cloud (74% / 75% / 0%). **The NO-GO for replacing cloud stands** — but on
   accuracy grounds only, and by a materially narrower margin than §18 reported.
4. **Highest-value follow-ups have shifted.** Prompt engineering is clearly *not* exhausted (two iterations, both
   informative, in one session). The remaining ladder: (i) a prompt that fixes `name` echo *without* costing
   numeric accuracy — possibly by extending the parser's `DESCRIPTIVE_NAME_SIGNAL` (which misses "people",
   "group", "solo", "quick") instead of spending prompt budget; (ii) few-shot **combined with** q4_0/compact,
   never tested together; (iii) the larger model (§20.5 item 4), now a better-justified experiment because the
   prompt confound has been removed.
5. **A cloud-side win is available regardless of on-device.** ~2.4 s of the 3.6 s cloud criteria latency is agent
   orchestration overhead, not model inference. Calling the model directly (as this capture does) instead of via
   the PersistentAgents thread/run/poll flow would cut the criteria tier to ~1.2 s **for every user, with no
   quality change** — plausibly the single highest-ROI latency fix in the whole study, and it requires no
   on-device work at all.

---

## 15. Overall conclusion (for the hackathon write-up)

- **On-device criteria extraction is *correct* and *feasible*** on real hardware (validated Pixel 4 + S23);
  the challenge is purely **latency**.
- **Latency floor on the current stack (llama.rn CPU): ~3.8 s cold, ~2.0 s warm** (§13) on a flagship — vs
  cloud-mini ~0.65 s. On-device is a **cost/offline/privacy** play, not a latency play.
- **Every accelerator we could test lost:** llama.cpp GPU (OpenCL) and NPU (HTP) are *slower* than CPU for a
  0.5 B (§10c); the purpose-built **GenieX/QNN NPU** is fast (~1.1 s projected) but **flagship-only (8 Elite/
  2024+), Qualcomm-only, no iOS, ~1 GB per-SoC bundle** and **cannot run on the S23 at all** (§12) — so it
  can't serve the broad fleet.
- **CPU-side KV-cache reuse (§13) is the best universal lever — now implemented + measured.** `restore`
  (prime the system KV, snapshot, `loadSession` per query) gives **~2 s for every extraction (≈2.2× faster
  than the correct-but-slow `clear`; ~halves cold)** and fixes the cross-query contamination bug. Residual: a
  minor restored-vs-fresh drift (KV serialization isn't bit-exact; a raw-prompt refinement did NOT close it).
  Fast **and** fresh-identical would need a `llama_kv_cache_seq_rm` partial-trim primitive llama.rn doesn't
  expose.
- **The dominant quality limiter is the 0.5B model itself**, not the runtime — it mis-reads player counts and
  hallucinates fields regardless of cache strategy. A task-specific/larger model (§14.4) is the real quality
  lever; the prompt + parser safety nets (§10b) keep it shippable.
- **BREAKTHROUGH (§16), then reality-check (§18): stacking `q4_0` + a compact grammar + omit-prompt makes
  on-device CPU latency-competitive with cloud — but quality, not latency, is the binding constraint.** Measured
  on the S23: **~0.69 s cold / ~0.28 s warm** best-case (§16), and **p50 0.91 s across the full 100-query gold
  set** (§18) — median-competitive with cloud-mini (0.65 s) and **~5.5× faster** than today's q4_k_m+full (3.8 s),
  on CPU with no accelerator or vendor lock-in. The latency work succeeded.
  - `q4_0` quant: ~3.4–4× faster prefill (one-line model swap; §19 confirms this is a *general* ARM-CPU win —
    2.3–3.4× cold on ARMv8.2 Pixel 4/5 too, not `i8mm`-gated).
  - compact grammar + omit-prompt: ~4.5× fewer decode tokens (grammar and prompt MUST be co-designed —
    the grammar change alone backfired into field hallucination + runaway generation).
- **CROSS-DEVICE VALIDATION (§19): ran the 4-config sweep on three SoCs (S23 8 Gen 2 / Pixel 4 SD855 / Pixel 5
  SD765G).** Two findings: (a) the `q4_0` prefill win is **hardware-general, not `i8mm`-specific** — 2.3–3.4× cold
  on the ARMv8.2 Pixels that lack `i8mm`; (b) the `q4_0-full` extraction-failure rate is **~47–48% on all three
  devices**, so the §18 quality collapse is not an S23 artifact and the verdict holds across the fleet. `q4_0-compact`
  is the fastest config everywhere (~0.8–1.3 s median even on the 2019/2020 Pixels) but still 12–13% runaway-null.
- **GATE CLOSED (§18): the gold-set quality A/B disqualifies defaulting q4_0/compact — the 0.5B is not a drop-in
  replacement for the cloud extractor.** Artifact-free evidence: player-count accuracy **69%** (wrong ~31% of the
  time), hard-failure rate **13%** (q4km-full) and **47–48%** (q4_0-full, reproduced on three devices), plus
  observed hallucinations. `q4_0`+full is outright rejected; `q4_0`+compact adds 12% runaway-nulls; even the
  cleanest config (q4_k_m+compact, 2% null) craters numeric player/playtime fields. **Latency was never the
  limiter — quality is.** The §16.4 stability fix was validated at scale here (400 consecutive completions, 0
  crashes).
- **⚠️ MEASUREMENT CAVEAT (§20) — now RESOLVED by §21.** The committed `cloud-mini` baseline was synthetic
  (82/100 "predictions" were copies of the gold answer key). §21.5 replaces it with a **real gpt-4.1-mini
  capture**: cloud exact-match is **74%** (fixture claimed 82%), so the quality direction holds. But the
  fixture's **653 ms cloud latency was pure fiction** — real production telemetry says **p50 3644 ms**.
- **🔄 TWO FOUNDING PREMISES INVERTED (§21).**
  (a) **On-device is FASTER than cloud, not slower.** Production cloud criteria extraction is **3644 ms p50**
  (telemetry, n=51, no cache hits); every on-device config beats it — 2745 ms (few-shot), 2244 ms (default),
  913 ms (q4_0/compact). The "on-device is a latency regression" framing came from an unmeasured constant.
  (b) **The quality ceiling was substantially a PROMPT BUG, not the model.** The shipping prompt's two examples
  contain "cooperative"/"mystery"; the 0.5B copies them into unrelated queries — "mystery" appears **0×** in gold
  yet was emitted **20–33×** per 100 queries. Deleting the examples removes **100%** of that contamination.
- **FEW-SHOT IS A LARGE, CHEAP WIN (§21.3).** One prompt change — no model, quant or grammar change — moved
  **exact-match 10% → 26%**, hard failures **13 → 6**, Recall@10 **21% → 35%**, player counts **69% → 85–87%**,
  for +22% latency. The gap to real cloud roughly **halves** (exact-match 7.4× → 2.8×).
- **Untested quality levers remain (§21.6): few-shot combined with q4_0/compact (never tried together), a
  `name`-echo fix in the parser rather than the prompt, and a larger model** — the last now better justified
  because the prompt confound has been removed.
- **A cloud-side win exists independently of on-device (§21.6):** ~2.4 s of the 3.6 s cloud criteria latency is
  PersistentAgents thread/run/poll orchestration, not model time. A direct model call measured **1197 ms** —
  a ~3× criteria-tier speedup for every user, with no quality change and no on-device work.
- **iOS (§17): feasible via the same llama.cpp stack — all JS wins port for free — but needs a new EAS build
  to measure; the ANE/CoreML/MLX path is out-of-scope because none support GBNF grammar** (our reliability
  backbone), mirroring the Android NPU conclusion.
- **Decision (§11) refined by §21: ship on-device as an opt-in fallback, but the reasoning has changed.**
  On-device is now known to be **faster** than the shipping cloud path (2.7 s vs 3.6 s) and **cheaper**; the only
  thing it loses on is **accuracy** (26% vs 74% exact-match after the few-shot fix — a ~2.8× gap, down from
  ~7.4×). The §16 levers, the §16.4 stability fix, and the §21 prompt modes are implemented and opt-in;
  production defaults (q4_k_m + full + `none` + the shipping prompt) are unchanged, so nothing here ships by
  default. Before any further on-device investment, take the **cloud-side orchestration win** (§21.6 item 5):
  ~2.4 s of the cloud criteria tier is agent thread/run/poll overhead, removable for every user at no quality
  cost.

---

## 10. Appendix — raw signal

- **S23 GPU load info:** `gpu: true`, `androidLib: rnllama_jni_v8_2_dotprod_i8mm_hexagon_opencl`,
  `devices: ['GPUOpenCL', 'HTP0']`.
- **S23 CPU load info:** `nGpuLayersRequested: 0`, realistic unique-query `latencyMs: 5284–5374`.
- **S23 compact-prompt + quality-fix:** cold unique-query `latencyMs: 3854 / 3874 / 3894`,
  `loadMs: 639–662` (warm-disk), criteria `{MinPlayers:8, MaxPlayers:8, Mechanics:['cooperative']}`.
- **S23 broken first-compaction (NOT shipped):** `latencyMs: 3421` but
  `name:'cooperative games for 8 players'` + hallucinated `Categories:['mystery','party','strategy','horror']`.
- **S23 backend 3-way (§10c):** enumerated backends `GPUOpenCL(gpu)`, `HTP0(gpu)`, `CPU(cpu)`; latency
  CPU `3779` (used CPU) < GPU `4594` (used `GPUOpenCL`, loadMs 2347) < NPU `5654` (used `HTP0`); all clean
  criteria. NPU repeats: `5654 / 6149 / 6684`.
- **S23 prefix-cache probe (§13):** one warm CPU context, 4 queries × 2 runs. q1 cold `3807 / 3713`; q2
  `1913 / 1938`; q3 `2056 / 2099`; q4(=q1) `1913 / 1942`. Contamination: q4 (≡q1, temp 0) reproducibly emits
  `MaxPlaytime:60` absent from cold q1 → KV state carryover.
- **S23 KV-strategy sweep (§13, `resetStrategy`):** prime `ok, ms 2606`. Latency by strategy (q1/q2/q3/q4):
  none `3807/1914/2007/1914`; clear `4305/4551/4721/4512`; restore `1985/2361/2302/2104`. Correctness (q4≡q1):
  none NO (q4 adds `MaxPlaytime:60`), clear YES (`{8,8,coop}`), restore YES-self-consistent but q1 carries a
  systematic `MaxPlaytime:60` vs the clean `clear` baseline. llama.rn `clearCache` doc: *"Without clearing,
  the model may use cached context from previous conversations."*
- **S23 raw-prompt restore refinement (§13):** switched `restore` extraction to a byte-exact-prefixed raw
  prompt; re-measured `restore` q1 `1962` still `{8,8,MaxPlaytime:60,coop}` → rendering was NOT the cause;
  divergence is `saveSession`/`loadSession` KV not being bit-identical to a fresh prefill.
- **S23 levers matrix (§16, 2026-08-23), cold q1 / warm q2–q3 (lat ms · prefill t/s · decode tok):**
  q4_k_m+full `3778 · 134 · 83` / `~2000 · — · 85–92`;
  q4_k_m+compact `2231 · 136 · 17` / `593–632 · — · 22`;
  q4_0+full `1528–1683 · 450–538 · 76` / `1080–1182 · — · 74–76`;
  **q4_0+compact `691 · 552 · 17` / `276–280 · — · 15–17`** (warm < cloud p50 654).
  `cache_n`≈280–395 on warm queries confirms system-prefix reuse (only ~17–22 prompt tokens re-processed).
- **§16.2 compact-grammar backfire (before omit-prompt):** hallucinated `MaxWeight/averageRating/
  ageRequirement/Categories`; q4_k_m/compact q3 ran away to `decodeN=255, parse-failed`. Fixed by the
  omit-prompt.
- **§16.4 llama.rn crash:** `SIGSEGV` in `initSampling`/`common_sampler_free`, fault addr contains GBNF bytes,
  under heavy grammar+`clearCache`/`loadSession` churn; mitigated by one-cell-per-process on the `none` path.
- **q4_0 model:** `qwen2.5-0.5b-instruct-q4_0.gguf` ~429 MB (vs q4_k_m ~491 MB); first-load incl. download
  `loadMs≈11 s`, warm-disk reload `≈1.1 s`.
- **iOS (§17):** llama.rn + New Arch are UNCOMMITTED (HEAD `newArchEnabled:false`, no llama.rn) → no EAS iOS
  build has the native module; measuring needs a new build. MLX/CoreML/ANE lack GBNF grammar support.
- **Pixel 4 load info:** `gpu: false`, `reasonNoGPU: 'GPU backend is not available'`,
  `androidLib: rnllama_jni_v8_2_dotprod` (no `i8mm` → CPU-only variant).
- **NPU/GenieX source of truth (§12):** `quic/ai-hub-models` →
  `src/qai_hub_models/models/llama_v3_2_1b_instruct/perf.yaml`. `supported_chipsets` oldest phone =
  `qualcomm-snapdragon-8-elite` (Galaxy S25); **no 8 Gen 2**. W4A16 GenieX: 8 Elite QRD 3350 prefill /
  67.1 decode; 8 Elite Gen 5 4588 / 74.9; X2 Elite (laptop) 4640 / 93.7. Runtime = `geniex_qairt` (classic
  `genie` deprecating). Export gate: `qai-hub configure --api_token` (Qualcomm AI Hub Workbench account).
- **Cloud-mini reference:** 100-query eval baseline, `latencyMs` p50 654, p95 749 (server-side extraction
  only; excludes mobile network round-trip).
- **Prompt token count:** ~450 (system + 3 few-shot examples + query); the pre-few-shot prompt was 245.
