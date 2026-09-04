# Local Inference — Decision Summary (Phase 2)

**Audience:** decision-maker. **Purpose:** answer one question — *do we pursue on-device inference or not?*
**Date:** 2026-08-25 · **Full detail:** [`phase_2_findings.md`](./phase_2_findings.md) (1000+ lines; this is the short version)

> ## ✅ DECISION: DROPPED (2026-08-30)
>
> On-device inference for **criteria extraction** is **not being pursued**. The recommendation in §6 was
> accepted: the cost case (~$0.04/month) does not justify a ~3× accuracy regression, a 350 MB download, and a
> second code path to maintain.
>
> **What this closes:** Phases 3–5 of `local_device_inference_plan.spec.md` (settings toggle, nudge UX,
> fallback chain, measurement) are cancelled for this use case. Production defaults were never changed, so
> nothing needs reverting.
>
> **What carries forward:**
> 1. **The cloud orchestration win (§4②)** — ~2.4 s of avoidable latency on every user's every search. Tracked
>    separately; it has nothing to do with on-device.
> 2. **The eval harness** (100 questions + scorer) and the **real cloud baseline** — reusable for any future
>    extraction-quality work.
> 3. **The prompt-contamination lesson (§4③)** — mandatory reading before any future small-model work.
>
> **Still open:** on-device is being re-evaluated for a *different* use case — an AI game-night recap /
> storyteller — which has a different risk and quality profile. See
> [`recap_local_inference_analysis.md`](./recap_local_inference_analysis.md). **That analysis does not depend on
> this decision**; the two use cases stack very differently.

---

## 1. The one-paragraph version

We tried to move the *criteria extraction* step (turning "co-op games for 6 players" into a search filter) from
the cloud onto the phone. **It technically works, it's faster than our cloud, and it's essentially free to run.**
But the small model that fits on a phone is **~3× less accurate** than the cloud model, and — critically — **the
cost saving we were chasing is worth about $0.04/month at our current traffic.** The strategic case has
evaporated even though the engineering succeeded.

**Recommendation: don't ship it. Take the free cloud speedup we found along the way instead — it's worth more
to users than the feature would have been.**

---

## 2. What we set out to prove, and what actually happened

The original plan named four wins. Here's the scorecard:

| Original goal | Expected | **What we measured** | Verdict |
|---|---|---|---|
| **Cost** — "high-confidence win" | Delete one cloud call per query | Real traffic: **234 requests in 90 days**. Savings ≈ **$0.04/month** | ❌ **Not worth anything yet** |
| **Latency** | On-device would be *slower*; a cost/privacy play | On-device is **FASTER** than our cloud path (2.7s vs 3.6s) | ✅ **Won — but see §4** |
| **Quality** | Roughly comparable | On-device **26%** vs cloud **74%** exact-match | ❌ **Materially worse** |
| **Offline / resilience** | Works with no network | True — but only for the *filter* step; the answer still needs the cloud | ⚠️ **Partial** |

**Read that top row carefully.** The entire business case rested on cost. At 2.6 requests/day, on-device saves
about **50 cents a year**. Even at **100× our current traffic** it's ~$4/month.

<sub>Cost math: ~1,050 input + ~45 output tokens per extraction × 234 calls, at gpt-4.1-mini published rates
($0.40/$1.60 per 1M tokens) = $0.12 per 90 days. The conclusion holds under any plausible price.
Traffic source: production Log Analytics, `AgentRequest.Started`, 2026-05-31 → 2026-08-21 (a real 3-month
window, not truncated by retention). Volume is **flat-to-declining** across that span (113 → 48 → 55 per month),
so the cost case is not one that "grows into" viability on the current trajectory.</sub>

---

## 3. The numbers that matter

All measured on a Galaxy S23 over the same 100 real-world test questions.

| | **Cloud (today)** | **Best on-device** |
|---|---|---|
| Gets the filter completely right | **74%** | 26% |
| Fails entirely (falls back to cloud) | 0% | 6% |
| Finds the right games (recall) | **75%** | 35% |
| Gets player count right | **100%** | 85% |
| Speed | 3.6 s | **2.7 s** |
| Cost per query | ~$0.0005 | **$0** |
| Extra app download | — | **350 MB** |

**Plain-English translation:** on-device is about **a second faster and free**, but roughly **1 in 4 searches
would return noticeably worse games**, and **1 in 16 would fail outright** (silently falling back to cloud, so
the user just waits longer).

---

## 4. Three things we got wrong along the way (worth knowing)

These are the interesting findings — and two of them reverse what we believed for most of the project.

**① We thought on-device was slow. It isn't — *our cloud* is slow.**
The whole study assumed cloud extraction took ~650 ms. That number turned out to be **fabricated** — it came
from a test fixture, not a measurement. Real production telemetry says **3,644 ms**. On-device was never the
latency problem.

**② ~2.4 seconds of our cloud latency is pure overhead, not AI.**
When we called the AI model directly it answered in **1.2 s**. Our code takes **3.6 s** for the same work — the
difference is bookkeeping in the Azure Agent framework (creating threads, polling for results). **This is a ~3×
speedup available to every user right now, with zero quality change and no on-device work at all.**

**③ Our own prompt was sabotaging the small model.**
The instructions we send contain two examples using the words *"cooperative"* and *"mystery"*. The small model
was **copying those words into unrelated answers** — "mystery" appeared **zero times** in the correct answers but
the model emitted it **20–33 times per 100 questions**. Fixing the prompt (no model change, no new tech) took
accuracy from **10% → 26%** and cut failures in half. We had been blaming the model for a bug in our prompt.

> **Note:** we checked whether the cloud model has the same flaw — **it doesn't.** Counting terms the model
> invented that appear in neither the question nor the correct answer: **cloud = 1, on-device = 66.** Big models
> read examples as *illustrations*; small models read them as *vocabulary to reuse*. **This is a small-model
> failure mode, not a bug in our cloud prompt** — so there's nothing to fix on the cloud side, but it's a
> permanent lesson for any small-model work we ever do.

---

## 5. Your options

### Option A — Drop it (recommended)
Stop here. Keep the research as a hackathon story, and take the free cloud speedup from §4②.
- **Cost:** none. **Risk:** none. **Value:** the ~3× cloud latency win is real and immediate.

### Option B — Ship it as an opt-in "offline/turbo mode"
Put it behind a settings toggle for power users who want speed/privacy.
- **Gets you:** ~1s faster, works on a plane, zero API cost.
- **Costs you:** 350 MB download, worse results 1-in-4 searches, ongoing maintenance of a second code path,
  plus a native-build migration the app hasn't done yet (React Native New Architecture).
- **Honest take:** we'd be shipping a *worse-answers* mode to save $0.04/month. Hard to justify to users.

### Option C — Keep researching to close the quality gap
Three untried levers remain: combining the two speed tricks with the prompt fix; a bigger phone model (1.5B);
fine-tuning a model on our specific task.
- **Gets you:** possibly closes the 26%→74% gap. Fine-tuning has the highest ceiling.
- **Costs you:** days-to-weeks of effort, ~1 GB download for the bigger model.
- **Honest take:** worth it **only if** traffic grows ~100× (making cost matter) or offline becomes a real user
  ask. Not justified by today's numbers.

---

## 6. Recommendation

**Take Option A — and spend the freed-up effort on this instead:**

> **Fix the cloud orchestration overhead (§4②).** ~2.4 s of unnecessary latency on every user's every search,
> caused by Azure Agent framework bookkeeping rather than AI work. No quality change, no on-device work, no
> user-visible risk. **This is the single biggest, cheapest win the whole study uncovered** — and we'd never
> have found it if we hadn't gone looking for a baseline to compare on-device against.

**Revisit on-device if any of these change:** traffic grows ~100× · users ask for offline · a materially better
small model ships · we decide to fine-tune.

---

## 7. What's already built (nothing is wasted)

All work is **uncommitted and opt-in** — production behaviour is unchanged, so there's no risk in leaving it.

| Asset | Reusable? |
|---|---|
| **Eval harness** — 100 test questions + automatic scorer | ✅ **Yes** — works for cloud prompt changes too; already caught real bugs |
| **Real cloud baseline** — measured quality + latency | ✅ **Yes** — the honest benchmark we lacked |
| **Prompt-contamination finding** | ✅ **Yes** — applies to any small model we ever use |
| **On-device runtime** (llama.rn, model loading, grammar) | 🔸 Only if we revisit |
| **Cross-device benchmarks** (3 phones) | 🔸 Reference data |

**Also true:** on-device *does* work, on hardware as old as a 2019 Pixel 4, with no Qualcomm/vendor lock-in and
no crashes across 400+ runs. If the strategic case ever returns, the path is proven — we just don't have a
reason to walk it today.

---

## 8. Confidence & caveats

- **High confidence:** the latency numbers (production telemetry + 3 devices), the cost math (real traffic
  counts), the prompt-contamination finding (clean ablation: removing examples eliminated 100% of it).
- **Medium confidence:** the exact quality gap. Our scorer compares text strictly (`"dice"` ≠ `"Dice Rolling"`),
  so **on-device is somewhat better than 26% suggests** — our backend matches loosely. The direction is solid;
  the precise multiple isn't.
- **Known unknown:** we never measured **what share of our users' phones are capable**. If it's low, Option B's
  value drops further.
