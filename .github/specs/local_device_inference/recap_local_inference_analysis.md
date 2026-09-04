# AI Game-Night Recap — Local Inference Feasibility Analysis

**Date:** 2026-08-30 · **Status:** analysis complete, awaiting decision
**Related:** [`phase_2_decision_summary.md`](./phase_2_decision_summary.md) (criteria extraction — **dropped**)

> **Bottom line:** this use case *does* stack differently from criteria extraction — but the surprise is that
> **it probably doesn't need an LLM at all.** A deterministic template layer produced better recaps than the
> on-device 0.5B in every scenario tested, at zero latency, zero cost, and zero hallucination risk.

---

## 1. Requirements you confirmed

| Question | Your answer | Why it matters |
|---|---|---|
| Where does the recap go? | **In-app only**, sharing nice-to-have | Lowers the prose bar — no stranger scrutiny |
| Card or image? | **Styled visual card** (template + real scores/names) | No image model needed; RN renders it |
| How much wording variety? | **Some, but reliability matters more** | Decisive — see §5 |
| Volume assumption | **Retention play — model both** low and high | See §6 |

---

## 2. What the app actually stores today (checked, not assumed)

**✅ Score data is rich enough.** `GameScoreSession.rounds[]` (`apps/mobile/types/scoreTracker.ts`) holds
per-round, per-player scores plus timestamps, and a `lowestScoreWins` flag. Every narrative beat is derivable.

**✅ Turn identity IS tracked per player — corrected 2026-08-30.** An earlier draft of this doc claimed turns
were "counters only". That was wrong. `TurnTrackerSession` stores `seatOrder` (player indices in seating order)
and `activeSeatIndex`, and `TurnTrackerScreen` resolves them to real names via
`getPlayerName(playerIndex) → playerNames[playerIndex]`. That resolution is exactly what drives the
chevron/arrow pointing at the current player's chip. So at any moment — including the moment the game ends —
**the app knows whose turn it is, by name.**

Derivable from turn data today, with no schema change:

| Fact | Derivation | Available? |
|---|---|---|
| **Who held the final turn** | `getPlayerName(seatOrder[activeSeatIndex])` | ✅ exact |
| Next / previous player | `seatOrder[(activeSeatIndex ± step) % n]` | ✅ exact |
| Seating order (by name) | `seatOrder.map(getPlayerName)` | ✅ exact |
| Total turns taken | `totalAdvances` | ✅ exact |
| Undos (drama signal) | `totalRetracts` | ✅ exact |
| Game duration | `Date.now() - startedAt` | ✅ exact |
| Turns per player | `totalAdvances / n` (even split) | ✅ approximate |
| **Full turn-by-turn replay** | — | ❌ **not stored** |

**⚠️ There is no historical turn *log*.** The session keeps the *current* seat plus running counters, not a
timestamped list of past turns. It also can't be reliably reconstructed after the fact: `setDirection`
(direction flips) and `retractTurn` (undos) both mutate position **without being logged**, so replaying
`totalAdvances` from seat 0 does not reproduce the stored `activeSeatIndex` (verified — it desyncs).

**This turned out not to matter — see §10.** The recap narrates at **round** fidelity (*"Priya took over in
round 3"*), which comes entirely from `rounds[]`. No turn log is needed.

**What the trackers each contribute:**

> - **Score tracker → the story.** Who led when, comebacks, lead changes, margins, the final result. Rounds are
>   intrinsically ordered by `roundNumber`, so nothing is inferred.
> - **Turn tracker → the colour.** *"…over 27 turns in 48 minutes"*, plus **who held the final turn** — all
>   exact today, no log required.

**⚠️ No sharing capability exists.** No `expo-sharing`, no `react-native-view-shot`. The card + share path is
entirely net-new (~1–2 days of work independent of any AI decision).

**✅ There's a natural trigger.** `handleEndGame` in `TurnTrackerScreen.tsx` already fires at session end — and
usefully, it already returns the ended session object precisely so end-of-game facts can be read before the
state is cleared.

---

## 3. The key structural difference from criteria extraction

| | Criteria extraction (dropped) | **Recap** |
|---|---|---|
| Model's job | **Reason** — parse intent, infer numbers | **Phrase** — restate given facts |
| Where facts come from | The model must derive them | **Computed in TypeScript, exactly correct** |
| A wrong output means | Wrong games surfaced — user gets bad results | Awkward sentence — cosmetic |
| Failure visibility | Silent (user just sees poor matches) | Obvious (you can read it) |
| Can we validate before showing? | No | **Yes** — facts are known, text is checkable |

This is why it was worth re-testing: the 0.5B failed criteria extraction because it **got player counts wrong
31% of the time**. Here it never has to compute anything.

**All narrative facts are computable with zero AI** — verified in code. From scores: `winner`, `margin`,
`lead_changes`, `stole_it_late`, `best_round`, `biggest_comeback`, `final_standings`. From turns:
`final_turn_player`, `seating_order`, `total_turns`, `undos`, `duration`.

---

## 4. Benchmark: can the 0.5B write the recap?

**Method.** Same model as the phone benchmarks (Qwen2.5-0.5B-Instruct q4_k_m, temp 0), 6 realistic scenarios
covering the shapes that actually occur: comeback, blowout, nail-biter, lowest-score-wins, single-round, and a
5-player game with a non-ASCII name. Facts were computed deterministically and **handed to the model in the
prompt** — it only had to phrase them. Prose quality is hardware-independent (findings §19.2), so this desktop
CPU run transfers to the phone; only latency differs.

**Result: 4 of 6 recaps contained factual errors — while being handed the correct facts.**

| Scenario | What the 0.5B wrote | Problem |
|---|---|---|
| **Wingspan blowout** | *"The final round was a **tie**, with Marco scoring 42"* | **Invented a tie.** Marco won 120–38 |
| **Codenames** | *"The lead changed hands **multiple times**"* | **Invented drama.** `lead_changes = 0`; 1 round was played |
| **Ticket to Ride** | *"Ben scoring 40, while Ana scored 52"* | **Attributed Eve's 40 to Ben**; misread the standings |
| **Catan comeback** | Repeated the same two sentences twice; 65 words | **Degenerate loop**, ignored the 40-word limit |
| **Azul nail-biter** | *"Jo scoring 22, securing the lead… making Kim the best single round"* | Incoherent; Jo's 22 was **round 1**, not the final |
| **Golf (low wins)** | *"Ria won with 18, leading Dev by 1"* | ✅ Correct and clean |

**Only 1 of 6 was clean.** And the failure mode is the worst possible one for a shareable artifact: it
**contradicts scores the user just entered themselves**. A user who watched Marco win by 82 will not be charmed
by "the final round was a tie."

Additional problem: the 0.5B ignored the length limit in 4 of 6 cases (44–67 words vs a 40-word cap), which
**breaks a fixed-size visual card**.

---

## 5. The finding that changes the recommendation: templates beat the model

Because the facts are already computed, a small template layer that picks an opener based on the *shape* of the
game needs no AI at all. Same 6 scenarios:

| Scenario | Template output |
|---|---|
| Catan comeback | *"Priya saved the best for last. Final: Priya 58, Sam 34 after 3 rounds. Best round of the night: Priya with 31 in round 3."* |
| Wingspan blowout | *"Marco ran away with it. Final: Marco 120, Lena 38 after 3 rounds…"* |
| Azul nail-biter | *"Kim stole it on the final round. Final: Kim 60, Jo 59 after 3 rounds…"* |
| Codenames | *"A photo finish — Alex took it. Final: Alex 9, Blue Team 7 after 1 round…"* |

**Score: 6/6 factually correct, 6/6 within the length budget (24–27 words), 0 hallucinations, ~0 ms, $0.**

**Your original headline, at round fidelity** (see §10 — rounds, not turns, are the chosen voice):

```
winner                   (score tracker) = Priya
took lead in final round (score tracker) = True
                    ↓
"Priya stole it on the final round."
Final: Priya 58, Sam 34 (24 apart) over 3 rounds.
```

Optionally closed with turn-tracker colour when that tracker was used — *"…over 27 turns in 48 minutes"* — which
is exact today and needs no turn log.

The guard is what makes this safe: *"stole it"* is only emitted when the winner genuinely **took the lead in the
final round**; otherwise the template falls back to a plainer opener. A 0.5B has no such guard — it asserted a
"tie" in a game won by 82 points.

Against your stated priority — *"some variety matters, but reliability matters more"* — templates win outright
today. With ~6 openers per game-shape and ~5 shapes, that's already 30 variants before anyone repeats.

> **Caveat found while testing (and worth fixing either way):** in the lowest-score-wins case the "best round"
> logic picked the *highest* round score, which is backwards for Golf. That's a **template bug — deterministic,
> reproducible, and fixable in one line.** Contrast with the model's errors, which are unpredictable and can't be
> patched. This is precisely the difference in maintainability between the two approaches.

---

## 6. Cost, at both volumes you asked for

Cloud recap ≈ 250 input + 60 output tokens on gpt-4.1-mini ($0.40/$1.60 per 1M).

| Scenario | Recaps/month | Cloud cost/month |
|---|---|---|
| Today's traffic (~2.6 sessions/day) | ~78 | **~$0.01** |
| 100× growth | 7,800 | **~$1.20** |
| 1,000× growth (very optimistic) | 78,000 | **~$12** |

**Cost is not a reason to go on-device for this feature either** — at 100× growth it's ~$1/month. This mirrors
the criteria-extraction finding: at this app's scale, cloud inference is effectively free, so **on-device has to
win on latency, offline, or privacy — not cost.**

---

## 7. How the two use cases stack

| Dimension | Criteria extraction | **Recap** |
|---|---|---|
| Does on-device work at all? | Yes, but 3× less accurate | **No — 4/6 recaps had invented facts** |
| Is an LLM even required? | Yes (open-ended language) | **No — templates outperform it** |
| Cost pressure | ~$0.04/mo → none | ~$0.01–1.20/mo → none |
| Latency pressure | Real (user waits mid-search) | **None** — recap appears after play ends; 2–3 s is fine |
| Failure blast radius | Bad game results | Embarrassing but cosmetic |
| **Verdict** | **Dropped** | **Don't use on-device; probably don't use an LLM at first** |

**The honest conclusion: this use case stacks differently, but not in on-device's favour.** It's *lower risk*
than criteria extraction, yet the small model still fails it — and unlike criteria extraction, there's a
**zero-AI alternative that's strictly better on every axis you care about.**

---

## 8. Recommendation

**Ship it in three stages, and only escalate if the data says to.**

**Stage 1 — Templates + card (recommended start).** Build the fact-derivation layer (~150 lines, fully unit
testable), a template bank, and the styled RN card + share. **No AI, no model download, no API cost, no latency,
nothing to fall back from.** This is also the bulk of the work regardless of which path you pick later — the
card, the trigger, and the fact layer are all shared.

**Stage 2 — Measure.** Instrument recap views/shares. If regulars report the phrasing feeling stale, you'll have
evidence rather than a guess.

**Stage 3 — Add cloud AI *only if* Stage 2 shows variety is actually the constraint.** Use cloud `gpt-4.1-mini`
with the **template as the fallback**, so a bad or slow generation never blocks the card. Cost stays ~$1/month
even at 100× growth. **Skip on-device entirely** — it's the only option that is both worse *and* more expensive
to build (350 MB download + New Architecture migration).

**What I'd explicitly not do:** ship the 0.5B for this. It writes text that contradicts scores the user entered
seconds earlier, and it can't hold a length budget, which breaks the card layout.

---

## 9. Scope + trigger decisions, and remaining open questions

### ✅ Decided: both scopes, sequenced (2026-08-30)

**Single-game recap first; whole-night summary when more than one game was played.** Verified that both are
derivable with zero AI:

| Scope | Source | Facts available |
|---|---|---|
| **Single game** | `GameScoreSession.rounds[]` | winner, margin, lead changes, comeback, "stole it in the final round", best round |
| **Whole night** | `leaderboard: LeaderboardEntry[]` | games played, wins per player, night champion, closest game, cumulative totals |

Sample night-level output from the template layer:
> *"Priya owned the night, taking 2 of 3 games. The tightest finish was Azul — Sam won it by 1."*

**⚠️ One structural limit to design around:** `LeaderboardEntry` stores only `{ game, scores: {player: total},
timestamp, lowestScoreWins }` — **no per-round data**. So a night summary can say *who won what and by how much*,
but **cannot** narrate comebacks or lead changes *within* a past game. Two implications:

1. The night summary should aggregate **outcomes**, while the single-game recap carries the **drama**. Natural
   split: show the game recap right after a game, and the night summary at the end.
2. If you later want in-game drama in the night summary, `LeaderboardEntry` would need to retain round data (or
   reference the archived session) — a **schema change**, best decided before Stage 1 ships.

**Handy detail:** `addLeaderboardEntry` already **inverts** scores when `lowestScoreWins` is true, so
higher-is-better holds uniformly at the leaderboard level. The fact layer must **not** re-invert (the
single-game path *does* still need to honour the flag).

### ✅ Decided: explicit trigger (2026-08-30)

**A "Recap" button, not an auto-trigger.** Groups use the trackers independently — some track only scores, some
only turns — so firing automatically from the Turn Tracker's End Game flow would miss score-only users and
misfire for turn-only ones. An explicit button works however the group played, and can't surprise anyone
mid-session.

**Implementation note:** the button should read whatever data exists and degrade gracefully:

| Data present | Recap quality |
|---|---|
| Scores **and** turns | **Best** — enables *"Priya stole it on the final turn"* (§5) |
| Scores only | Full drama (comebacks, lead changes, margins), round-based phrasing |
| Turns only | Thin — duration, turn count, seating; likely not worth showing |
| Neither | Button hidden / disabled |

Because `handleEndGame` clears the turn session, a recap invoked *after* End Game would lose the final-turn fact.
Two options: keep the button on the in-game screen (before End Game), or have `endGame()` stash its returned
session for the recap to read. **The latter is cleaner** — `endGame()` already returns the ended session
specifically so end-of-game facts can be captured before the clear.

### Still open

1. **Suppress trivial recaps?** Suggest no recap for a 1-round, 1-player game — there's no story to tell.

---

## 10. Turn-by-turn history log — analysed, then made unnecessary (2026-08-30 → 2026-09-04)

> ### ✅ RESOLVED: no turn log needed. Narrate at **round** fidelity.
>
> **Why:** you clarified that users enter a **round** as soon as that round finishes — nobody records
> individual *turns* as they happen. And you prefer the card to speak in rounds anyway.
>
> That single clarification removes the entire problem this section was solving. Round-fidelity narration
> needs **no turn log, no timestamps, no correlation, no runtime guard, and no schema change** — everything
> comes from `GameScoreSession.rounds[]`, which the app already stores.

### 10.1 What round-fidelity narration produces (verified)

From `rounds[]` alone, with `roundNumber` giving intrinsic ordering:

```
after round 1: leader = Sam    {Sam 20, Priya 12, Ana 8}
after round 2: leader = Sam    {Sam 29, Priya 27, Ana 22}
after round 3: leader = Priya  {Priya 58, Sam 34, Ana 32}
   ↓
"Sam led after round 1."
"Priya took over in round 3."
"Final: Priya 58, Sam 34."
```

This is the same story arc the turn-level version told — *"someone started leading early, someone else stole
it late"* — just anchored to rounds. **It is also strictly more truthful:** a round boundary is a real,
user-recorded event, whereas a turn number was always an inference from timestamp proximity (§10.3 below).

### 10.2 Why the turn log is no longer justified

| Requirement | Turn fidelity | **Round fidelity (chosen)** |
|---|---|---|
| New `TurnEvent[]` schema | Required | **Not needed** |
| Per-turn timestamps | Required | **Not needed** |
| Timestamp→round correlation | Required | **Not needed** |
| Runtime "well-separated" guard | Required | **Not needed** |
| Assumption about user behaviour | Load-bearing | **None** |
| Data source | Both trackers | `rounds[]`, already stored |

The turn log was only ever a means to an end. With the end achieved more simply, building it would be
**cost without benefit** — added persistence size, a schema migration, and a guard, all to express the same
narrative less reliably.

### 10.3 The inference that no longer has to be made

Scores and turns are separate features with no linkage — a score round carries no turn number. Turn-level
narration therefore required inferring *"which turn had we reached when this round was recorded?"* from
timestamp proximity. That inference is only sound if rounds are recorded at the instant they occur.

Your clarification is exactly why that was fragile: **rounds are entered when a round ends, not when a turn
ends**, so a round's timestamp lands somewhere in the *gap after* the last turn of that round — not on a
specific turn. The mapping was always approximate, which is why the earlier draft hedged the wording to
*"was ahead **after** turn N"* and added a guard to suppress it when timestamps bunched together.

Dropping to round fidelity removes the inference entirely. **No approximation, no hedge, no guard.**

### 10.4 What still comes from the turn tracker (no log required)

Turn data remains useful for aggregate colour, all of it exact today:

| Fact | Source |
|---|---|
| **Who held the final turn** | `getPlayerName(seatOrder[activeSeatIndex])` |
| Total turns played | `totalAdvances` |
| Undos | `totalRetracts` |
| Game duration | `Date.now() - startedAt` |
| Seating order | `seatOrder.map(getPlayerName)` |

So a card can still close with *"…over 27 turns in 48 minutes"*, and the *"X held the final turn"* fact stays
available as a bonus when the turn tracker was used. Neither needs a log.

### 10.5 Findings retained from the original analysis

Two measurements are worth keeping even though the conclusion changed:

- **Storage was never the blocker.** `TurnTrackerContext` already persists the entire session on every turn
  tap, so a log would have added size (~1 KB for a typical game), not extra writes. My original "persistence
  churn" objection was wrong on the numbers — worth recording so it isn't re-litigated from memory.
- **Turn sequence genuinely cannot be reconstructed retroactively.** Production telemetry shows **~0.95
  direction flips per game** (18 flips / 19 games), and `setDirection`/`retractTurn` mutate position without
  logging. Replaying `totalAdvances` from seat 0 desyncs from the stored `activeSeatIndex` (verified). **If
  turn-level narration is ever revisited, a log is the only mechanism** — there is no post-hoc shortcut.

### 10.6 Supporting usage data (120-day production window)

| Metric | Value | Relevance |
|---|---|---|
| Turn-tracker games started | 19 | Feature is genuinely used |
| Turns advanced | 213 (~11/game) | Short games |
| Direction flips | 18 (~0.95/game) | Blocks retroactive reconstruction (§10.5) |
| Turns retracted | 6 | Undos happen |
| **Sessions using turn tracker that also used score tracker** | **14 of 21 (67%)** | Most sessions have both signals available |
| Games formally "ended" | 12 of 19 (63%) | 37% abandoned → supports the explicit Recap button (§9) |
| `Feature.Tapped` — score / turn / search | 72 / 79 / 81 | Score Tracker is used as much as the others |

### 10.7 Net effect on the plan

Stage 1 (§8) is **unchanged in scope but smaller in risk** — it was already going to derive facts from
`rounds[]`. What's removed from the roadmap:

- ~~Add `TurnEvent[]` to `TurnTrackerSession`~~ — not needed
- ~~Runtime timestamp guard~~ — not needed
- ~~`RoundAdded` telemetry to validate the entry-timing assumption~~ — no longer load-bearing (still a
  reasonable thing to add for general product insight, but nothing depends on it)

---

## 11. Confidence

- **High:** what the app stores (read directly from source); that all narrative facts are computable without AI;
  that the 0.5B produced factual errors in 4/6 scenarios (reproducible at temp 0 — `recap_bench.py` in session
  artifacts, results in `recap_bench_results.json`).
- **Medium:** whether prompt engineering could rescue the 0.5B. We know from findings §21 that few-shot fixes
  helped criteria extraction a lot (10% → 26%), so a tuned recap prompt would likely reduce these errors —
  **but it would still have to beat a template layer that is already at 100% accuracy**, which is a very high bar.
- **Not tested:** a mid-size model (1.5B–3B) on-device for recaps. Skipped deliberately — cost pressure is
  ~$1/month, so the premise for going on-device at all doesn't hold.
- **Resolved by clarification, not by measurement:** the turn-log question (§10). Rounds are entered when a
  *round* finishes — nobody logs individual turns as they happen — and round fidelity is the preferred voice for
  the card. That removes the turn log, the timestamp correlation, and the runtime guard from the plan entirely.
  Round ordering is intrinsic (`roundNumber`), so nothing is inferred and no assumption about user behaviour is
  load-bearing.
- **Retained for the record (§10.5):** if turn-level narration is ever revisited, a log is the *only* mechanism —
  ~0.95 direction flips per game means the sequence cannot be reconstructed retroactively. And storage was never
  the obstacle (~1 KB/game); my original "persistence churn" objection was wrong on the numbers.
