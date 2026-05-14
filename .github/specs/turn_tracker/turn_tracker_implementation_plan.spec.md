# Turn Tracker - Implementation Plan

## Overview

The Turn Tracker feature helps board gamers track whose turn it currently is during play. Users arrange players around a virtual circular table, then tap a center marker (or adjacent seats) to advance turns clockwise or anti-clockwise. The marker position, seating order, and direction are persisted per active player group so games can be paused and resumed across navigation, app backgrounding, and cold starts.

The Turn Tracker hub also surfaces two existing features as **secondary** entry points via a bottom toolbar:
- **Pick Turns** (existing `TurnSelectorScreen`) — random turn order via the spinning wheel
- **Timer** (existing `TimerScreen`) — countdown timer for time-boxed turns

Landing-page changes are minimal:
- The existing landing-page **Pick Turns** icon (`refresh-circle`, position unchanged) is repurposed: it now opens the Turn Tracker hub instead of `TurnSelectorScreen` directly. Only the label changes — from "Pick Turns" to "Track Turns". Direct access to `TurnSelectorScreen` from the landing page goes away (it is reachable only via the Turn Tracker bottom toolbar).
- The existing landing-page **Timer** icon stays **exactly** as it is today (icon, label, position, and route to `TimerScreen` all unchanged). Users can still launch the Timer directly from the landing screen; the bottom-toolbar entry inside Turn Tracker is just an additional convenience shortcut.

Entry point: Landing Screen `turn` icon → Turn Tracker hub → seating setup → in-game tracking.

---

## Requirements Summary

### UX Decisions
| Decision | Choice |
|----------|--------|
| Landing icon | Reuse existing `refresh-circle` icon and position; relabel "Pick Turns" → "Track Turns"; route to new `TurnTracker` screen |
| Groups integration | Mirror `TurnSelectorScreen`: if groups enabled use `activeGroup`, else fall back to `appCache.getPlayers()` |
| Player count range | 2–20 (matches `TurnSelector` and `PlayerGroups`) |
| Seating-input UX | Tap each empty seat → pick a player from a name list |
| Marker visualization | Both — rotating center pointer **and** active seat highlight (scale + glow) |
| Advance gestures | Tap the center marker, tap the upcoming seat (advances), or tap the preceding seat (retracts). All other seats are non-interactive. |
| Direction toggle | Visible during gameplay (in-game screen only); default = clockwise |
| Direction-aware next/previous | Tapping "the upcoming seat" respects current direction; flipping direction swaps which neighbour is tappable |
| Begin Game validation | All seats must be filled; the **Begin Game** CTA stays disabled otherwise |
| Game session lifecycle | Explicit **End Game** button only; survives navigation, backgrounding, and cold starts |
| Active group switching | Locked **only** on the in-game Turn Tracker screen. Group switches from any other screen are permitted; sessions survive on their source group and resume when that group is reactivated |
| Enable/disable groups during an active session | Active group's session migrates: `disableGroups` copies `turnTracker` to `appCache`; `enableGroups` copies `appCache.turnTracker` to the new first group |
| Player renames during game | Live-updated by index lookup; renames in `TurnSelector` / `CreateGroup` reflect on the seating circle without disruption |
| Score button | Persistent button below the circle; navigates to existing `ScoreTrackerScreen` and preserves session |
| Sub-feature buttons | Bottom toolbar with **Pick Turn** (→ `TurnSelectorScreen`) and **Timer** (→ `TimerScreen`) |
| Telemetry | Full event set (game lifecycle + per-turn events) |

### Data / Storage Decisions
| Decision | Choice |
|----------|--------|
| Persistence | Per active group (when groups enabled) on the `PlayerGroup` record; per-app for non-group mode in `appCache` — same `AsyncStorage` mechanism the rest of the app uses |
| Stable player identity | **Index** into the active player list (`activeGroup.playerNames` or `appCache.getPlayers()`). Names are looked up at render time so renames are reflected live |
| Backward compatibility | New optional `turnTracker` field on `PlayerGroup` and new `appCache.getTurnTracker` / `setTurnTracker` keys. Existing persisted state without these fields parses safely (undefined → null session) |

---

## Architecture

### File Structure

```
apps/mobile/
├── screens/
│   └── TurnTrackerScreen.tsx              # Main feature screen (setup + in-game in one component)
├── components/
│   └── turnTracker/
│       ├── SeatingCircle.tsx              # Renders the circular layout of seats
│       ├── PlayerSeat.tsx                 # A single seat (placeholder or filled, with state)
│       ├── TurnMarker.tsx                 # Animated rotating center pointer
│       ├── PlayerPickerModal.tsx          # Modal for selecting which player goes in a tapped seat
│       ├── DirectionToggle.tsx            # Clockwise / anti-clockwise switch (in-game only)
│       └── TurnTrackerToolbar.tsx         # Bottom toolbar: Pick Turn + Timer
├── store/
│   └── TurnTrackerContext.tsx             # Context handling session state & per-group persistence
├── services/
│   └── storage/
│       └── appCache.ts                    # +getTurnTracker / setTurnTracker (non-group mode)
├── styles/
│   └── turnTrackerStyles.ts               # Styles for the screen and components
└── types/
    ├── turnTracker.ts                     # TypeScript interfaces
    └── playerGroups.ts                    # Extended with optional turnTracker field
```

### Data Types

```typescript
// types/turnTracker.ts

export type TurnDirection = 'cw' | 'ccw';

/**
 * A single ongoing turn-tracker session for one active player list.
 * Identity is by player INDEX in the active list (group or appCache players),
 * so renames automatically propagate without disrupting the game.
 */
export interface TurnTrackerSession {
  /**
   * Ordered list of player indices forming the seating arrangement.
   * Length === playerCount. Index 0 sits at the 12 o'clock seat;
   * subsequent entries fill clockwise around the circle.
   */
  seatOrder: number[];

  /** Index INTO seatOrder of the seat that currently holds the turn. */
  activeSeatIndex: number;

  /** Current direction of play. */
  direction: TurnDirection;

  /** Epoch ms timestamp the game began. */
  startedAt: number;

  /** Snapshot of playerCount at game start — used to detect mismatches if the group's playerCount changes mid-game. */
  playerCountAtStart: number;
}

/**
 * Pre-game state used while the user is placing players into seats.
 * Stored separately from `TurnTrackerSession` because it's transient and
 * does NOT need persistence (lives only in component state until Begin Game).
 */
export interface SeatingDraft {
  /** Sparse array; index = seat position, value = player index or null if unfilled. */
  seats: (number | null)[];
}
```

```typescript
// types/playerGroups.ts (additions)

import type { TurnTrackerSession } from './turnTracker';

export interface PlayerGroup {
  // ...existing fields...
  /** Active turn-tracker session for this group, or null if no game in progress. */
  turnTracker?: TurnTrackerSession | null;
}
```

```typescript
// services/storage/appCache.ts (additions)

const Keys = {
  // ...existing keys...
  turnTracker: 'app.turnTracker',
} as const;

// Non-group-mode session
getTurnTracker: (): Promise<TurnTrackerSession | null> =>
  getObject<TurnTrackerSession | null>(Keys.turnTracker, null),
setTurnTracker: (session: TurnTrackerSession | null): Promise<void> =>
  setObject(Keys.turnTracker, session),
```

### State Management

```typescript
// store/TurnTrackerContext.tsx

interface TurnTrackerContextType {
  // Session state (null when no game in progress)
  session: TurnTrackerSession | null;
  isLoading: boolean;

  /** Index of the player whose turn it currently is (relative to active player list). null if no game. */
  activePlayerIndex: number | null;
  /** Index of the upcoming player based on current direction. null if no game. */
  nextPlayerIndex: number | null;
  /** Index of the preceding player based on current direction. null if no game. */
  prevPlayerIndex: number | null;

  // Lifecycle
  beginGame: (seatOrder: number[], direction: TurnDirection) => void;
  endGame: () => void;

  // Turn manipulation
  advanceTurn: () => void;       // moves marker by +1 in current direction
  retractTurn: () => void;       // moves marker by -1 in current direction
  setDirection: (dir: TurnDirection) => void;
}
```

**Persistence rules**

- When `PlayerGroupsContext.state.enabled === true`, the session is read from / written to the **active** group's `turnTracker` field via `updateActiveGroupData({ turnTracker })`. Each group has its own independent session.
- When groups are disabled, the session is read from / written to `appCache.getTurnTracker()` / `setTurnTracker()`.
- All writes are debounced (400 ms) using the existing `useDebouncedEffect` pattern, matching `ScoreTrackerScreen` / `TurnSelectorScreen`.
- On mount, the context hydrates from the appropriate source. The context **subscribes to active-group changes** (`PlayerGroupsContext.state.activeGroupId`) and re-hydrates whenever the active group changes — even if the change happens from a different screen. This makes Flow 7b "just work".
- Group enable/disable transitions migrate the session in both directions (see Flow 7e and 7f). The migration is implemented inside `PlayerGroupsContext.enableGroups` and `disableGroups`, not duplicated in `TurnTrackerContext`, so that the entire group state mutation is atomic.

**Sanity check on hydration**

If a persisted `TurnTrackerSession` is loaded but `playerCountAtStart !== currentPlayerCount` (e.g., user changed group `playerCount` outside the in-game lock — shouldn't happen because the lock prevents it, but defensive guard), the session is discarded and the user lands on the seating-setup screen.

---

## UX Flows

### Flow 1 — Entering Turn Tracker (no game in progress)

1. User taps **Track Turns** on the landing screen.
2. `TurnTrackerScreen` mounts; `TurnTrackerContext` hydrates and finds `session === null`.
3. Screen renders the **seating-setup** view:
   - Header: `BackButton` + page title "Track Turns".
   - Optional `GroupPicker` row at top (visible when groups are enabled, mirroring `TurnSelectorScreen`).
   - Subtitle: "Tap each seat to seat your players."
   - `SeatingCircle` with N empty seats (N = `activeGroup.playerCount` or `appCache.playerCount`), arranged at angles `-90 + i * 360/N` from the top.
   - Each empty seat is a dashed-border circle with a "+" icon and seat number (e.g., "Seat 1").
   - Bottom CTA: **Begin Game** (disabled until all seats are filled).
   - Bottom toolbar (always visible): **Pick Turn** | **Timer**.
4. Tapping an empty seat opens `PlayerPickerModal` showing the active player list with names. Already-seated players are shown but disabled. Tapping a name fills that seat.
5. Tapping a filled seat opens the modal again with that seat's current selection highlighted; user can swap to a different unseated player or "Clear seat".
6. Once all N seats hold a player index, **Begin Game** becomes enabled.

### Flow 2 — Beginning a game

1. User taps **Begin Game**.
2. `TurnTrackerContext.beginGame(seatOrder, direction='cw')` is called. A new `TurnTrackerSession` is created with `activeSeatIndex = 0`, `startedAt = Date.now()`, `playerCountAtStart = seatOrder.length`.
3. The session is persisted (per-group or appCache). Telemetry: `TurnTracker.GameStarted` fires with `{ playerCount, direction, source: 'groups'|'appCache' }`.
4. The screen transitions (cross-fade ~250 ms) into the **in-game view**.

### Flow 3 — In-game view

Layout (top → bottom):
1. `BackButton` (returns to landing — does NOT end game; session persists).
2. Page title "Track Turns".
3. (Optional) `GroupPicker` rendered in **disabled** state when groups are enabled, so the user can see the active group but cannot switch.
4. `SeatingCircle`:
   - Each `PlayerSeat` displays the player's current name (looked up live from active player list by index).
   - The **active** seat scales to 1.15× and pulses with a soft glow.
   - The **next** and **previous** seats (direction-aware) are fully tappable. Other seats are dimmed (opacity 0.5) and `pointerEvents="none"`.
5. `TurnMarker` at the centre — an arrow/pointer rotated to point at the active seat. Tapping it advances the turn.
6. `DirectionToggle` (small switch, e.g., ↻ / ↺ icons) just below the circle.
7. **Input Game Score** button (persistent, below the toggle) — navigates to `ScoreTrackerScreen` (active group / appCache players are already in scope there, so player names auto-populate).
8. **End Game** button (destructive style, e.g., red border) — confirms via `Alert.alert`, then clears the session and returns to seating-setup.
9. Bottom toolbar: **Pick Turn** | **Timer** (always present, both pre-game and in-game).

### Flow 4 — Advancing / retracting turns

| User action | Effect |
|---|---|
| Tap centre `TurnMarker` | `advanceTurn()` — `activeSeatIndex = (activeSeatIndex + step) mod N` where `step = +1` if `direction='cw'` else `-1` |
| Tap the upcoming seat (direction-aware "next") | Same as marker tap (`advanceTurn()`) |
| Tap the preceding seat (direction-aware "previous") | `retractTurn()` — `activeSeatIndex = (activeSeatIndex - step + N) mod N` |
| Tap any other seat | No-op (`pointerEvents="none"`) |
| Toggle direction | `setDirection(newDir)`; the next/previous tappable seats swap accordingly. Marker rotates smoothly to face the (unchanged) active seat from the new "axis". |

Each successful advance/retract:
- Persists the updated `activeSeatIndex` (debounced).
- Animates the marker via `Animated.timing` on a rotation degree value (300 ms, `Easing.out(Easing.cubic)`, `useNativeDriver: true`).
- Animates the active seat via `Animated.spring` (scale 1 → 1.15) and the previous active seat back to 1.
- Optional haptic feedback via `expo-haptics` (light impact).

### Flow 5 — Ending a game

1. User taps **End Game** → `Alert.alert("End game?", "This clears the turn tracker for this group.", [Cancel, End])`.
2. On confirm: `endGame()` sets the persisted session to `null` (per-group or appCache). Telemetry: `TurnTracker.GameEnded` fires with `{ durationSeconds, totalAdvances, totalRetracts }`.
3. Screen transitions back to the seating-setup view.

### Flow 6 — Backgrounding / navigating away

- Navigating away (e.g., to **Pick Turn**, **Timer**, **Score Tracker**, or back to landing) does **not** end the game; the session remains persisted.
- Re-entering Turn Tracker rehydrates from the active group / appCache and lands the user back in the **in-game view** with the marker at the same position.
- Cold start: same — `TurnTrackerContext` hydrates from `AsyncStorage` and resumes.

### Flow 7 — Switching active groups while a game is in progress

Because sessions are stored **per group** (`PlayerGroup.turnTracker`), each group has its own independent in-progress state. The behaviour depends on **where** the switch happens:

#### 7a. From the Turn Tracker in-game view
- The `GroupPicker` rendered on the in-game view is disabled (greyed out, non-interactive). A small helper text reads "End the current game to switch groups."
- This prevents the visually jarring case where the user is staring at the circle for "Game Night Group" and the names suddenly become "Family Crew" mid-tap.

#### 7b. From another screen (`TurnSelectorScreen`, `ScoreTrackerScreen`, `TeamRandomizerScreen`, `ManageGroupsScreen`, `CreateGroupScreen`, `GameSetupScreen`, `ChatScreen`)
- The other screens' `GroupPicker` remains **fully functional**. Switching the active group is permitted at any time — it does **not** end the in-progress Turn Tracker session, because that session lives on the source group's `turnTracker` field, not on global state.
- Concrete behaviour:
  1. User is in the middle of a Turn Tracker game on **Group A**.
  2. User navigates to e.g. `ScoreTrackerScreen` (Turn Tracker game persists; nothing changes).
  3. User switches active group to **Group B** via the `GroupPicker` there.
  4. Group A's `turnTracker` field is untouched; Group A's game is still alive on disk.
  5. If the user navigates back to Turn Tracker now, `TurnTrackerContext` reacts to the active-group change and rehydrates from **Group B's** `turnTracker` field — typically `null`, so the user sees Group B's seating-setup view. If Group B happens to have its own in-progress session, the user resumes that one.
  6. When the user switches back to Group A from anywhere, the next visit to Turn Tracker shows **Group A's** original game, marker still where they left it.
- This makes Turn Tracker effectively support concurrent in-progress games per group, with zero data loss when switching.

#### 7c. The active group is deleted via `ManageGroupsScreen`
- `PlayerGroupsContext.deleteGroup` already auto-selects the next group as active (must keep at least one). When `TurnTrackerContext` notices the active-group ID changed, it rehydrates from the new active group's `turnTracker` field.
- The deleted group's session is gone with the group itself — this is acceptable because the user explicitly deleted the group (and no other in-app feature recovers a deleted group's data either).

#### 7d. Active group's `playerCount` or `playerNames` change while a session is active for that same group
- `playerCount` change: prevented in normal flow (the group whose game is in progress is locked on Turn Tracker's in-game view, and `CreateGroupScreen` for editing player count is reached via `ManageGroupsScreen`). If somehow `playerCountAtStart !== currentPlayerCount` is detected on next hydration, the session is **discarded** and the user lands on seating-setup with a one-time toast: "Player count changed — please re-seat your players."
- `playerNames` change: handled by Flow 8 (live-updated via index lookup; no disruption).

#### 7e. Groups feature is disabled while a per-group session is active
- `disableGroups()` in `PlayerGroupsContext` writes the active group's player data back into the ungrouped `appCache` keys. Turn Tracker piggybacks on this: the active group's `turnTracker` is migrated to `appCache.setTurnTracker()` so the in-progress game survives the transition.
- All other groups' sessions are discarded — they're inaccessible until groups are re-enabled (which restores the same first-group from the ungrouped keys, so the migrated session reappears).

#### 7f. Groups feature is enabled while a non-group session is active
- `enableGroups()` creates the first group from current ungrouped state. We extend it to also copy `appCache.getTurnTracker()` into the new group's `turnTracker` field, then clear the ungrouped key. The user's in-progress game continues uninterrupted under the newly-created default group.

### Flow 8 — Renames during a game

- The seating circle renders names via `playerNames[seatOrder[i]]`. Because storage uses indices, any rename in `CreateGroup` / `TurnSelector` shows up immediately on the next render. No special handling needed.

---

## Visual & Animation Details

### Seating circle layout

- Centre `(centerX, centerY)`: middle of the available content area, computed from `Dimensions.get('window')`.
- Radius: `Math.min(screenWidth, screenHeight) * 0.36` on phones, `* 0.30` on tablets (mirrors `LandingScreen` scaling).
- Seat angle: `-Math.PI / 2 + i * 2 * Math.PI / N` (start at top, go clockwise).
- Seat node: 64 px × 64 px circle on phones (96 px on tablets), with player initials inside (1–2 chars from the player's display name) and the full name as a label below.

### Marker

- Implemented as an SVG arrow (or `expo-vector-icons` `Ionicons name="caret-up"` rotated) inside an `Animated.View` at `centerX`, `centerY`.
- Uses `Animated.Value` for the rotation degree.
- Direction-aware: when `direction='cw'`, the marker advances by `+ 360/N` per tap; when `'ccw'`, by `- 360/N`. The marker takes the **shortest angular path** between consecutive seats, so a tap from seat 5 → seat 0 (when N=6, cw) animates +60° rather than -300°.
- Tap target: a 96 px × 96 px transparent `TouchableOpacity` centred on the marker, larger than the marker's visible icon for ergonomic tapping.

### Active / next / previous seat states

| State | Style |
|---|---|
| Active | Scale 1.15, soft glow (`shadowColor: theme.themeYellow`, `shadowRadius: 12`), opacity 1 |
| Next / Previous (tappable) | Scale 1.0, opacity 1, subtle border (`borderColor: theme.themeBrownDark`, `borderWidth: 2`) |
| Other (non-tappable) | Scale 1.0, opacity 0.5, `pointerEvents="none"` |
| Empty (setup only) | Dashed border, "+" icon, opacity 0.7 |

Transitions between states use 200 ms `Animated.timing` on opacity and `Animated.spring` on scale.

### Direction toggle

- Two labelled buttons in a segmented control: `↻ Clockwise` | `↺ Anti-clockwise`.
- Toggling fires `Animated.timing` on the marker's rotation by ±5° "wobble" to acknowledge the change visually, then snaps back.

---

## Navigation Wiring

### `App.tsx` — register the new screen

```tsx
<Stack.Screen name="TurnTracker">
  {() => (
    <TelemetryErrorBoundary
      errorEventName={AnalyticsEvents.ERROR_TURN_TRACKER}
      screenName="Turn Tracker"
    >
      <TurnTrackerScreen />
    </TelemetryErrorBoundary>
  )}
</Stack.Screen>
```

`TurnTrackerProvider` is added near the other context providers so the session survives screen navigation:

```tsx
<PlayerGroupsProvider>
  <TurnTrackerProvider>
    <NavigationContainer ...>
      ...
    </NavigationContainer>
  </TurnTrackerProvider>
</PlayerGroupsProvider>
```

### `LandingScreen.tsx` — relabel the existing icon

In the `features` array, change the `turn` entry **only**:

```ts
{ key: 'turn', label: 'Track\nTurns', screen: 'TurnTracker', icon: 'refresh-circle', iconType: 'ionicon' },
```

- Icon, position, scale, and offsets stay exactly the same.
- The new screen name `TurnTracker` is what the navigation now targets; `TurnSelectorScreen` is no longer reachable directly from the landing page.
- The `timer`, `score`, `chat`, `search`, `team`, `dice`, and `setup` entries are **not modified**. The landing-page Timer icon in particular keeps its current label, icon, position, and route to `TimerScreen`, so users can still launch the Timer directly from the landing screen.

### `TurnSelectorScreen` and `TimerScreen` are still routable

Both screens remain registered in `App.tsx` exactly as today (`Turn` and `Timer` routes). The new `TurnTrackerToolbar` calls `navigation.navigate('Turn')` and `navigation.navigate('Timer')`. No changes required in either screen.

---

## Telemetry

Add the following to `services/Telemetry.ts → AnalyticsEvents`:

```ts
// Turn Tracker
TURN_TRACKER_GAME_STARTED: 'TurnTracker.GameStarted',
TURN_TRACKER_GAME_ENDED: 'TurnTracker.GameEnded',
TURN_TRACKER_TURN_ADVANCED: 'TurnTracker.TurnAdvanced',
TURN_TRACKER_TURN_RETRACTED: 'TurnTracker.TurnRetracted',
TURN_TRACKER_DIRECTION_FLIPPED: 'TurnTracker.DirectionFlipped',

// Errors
ERROR_TURN_TRACKER: 'Error.TurnTracker',
```

Event payloads:

| Event | Properties | Metrics |
|---|---|---|
| `TurnTracker.GameStarted` | `direction`, `source` (`groups` / `appCache`) | `playerCount` |
| `TurnTracker.GameEnded` | `direction` | `playerCount`, `durationSeconds`, `totalAdvances`, `totalRetracts` |
| `TurnTracker.TurnAdvanced` | `via` (`marker` / `seatTap`), `direction` | `activeSeatIndex` |
| `TurnTracker.TurnRetracted` | `via` (`seatTap`), `direction` | `activeSeatIndex` |
| `TurnTracker.DirectionFlipped` | `from`, `to` | (none) |

The landing-screen tap continues to use `FEATURE_TAPPED` with `{ feature: 'turn', target: 'TurnTracker' }` (target string changes from `'Turn'` to `'TurnTracker'`).

---

## Testing Plan

### Unit tests (Jest + React Native Testing Library)

Add to `apps/mobile/__tests__/`:

| File | Coverage |
|---|---|
| `TurnTrackerContext.test.tsx` | `beginGame` initialises session correctly; `advanceTurn` wraps modulo N in both directions; `retractTurn` wraps modulo N; `setDirection` does not move active seat; persistence is debounced and writes to the right backend (group vs appCache); hydration discards mismatched `playerCountAtStart` |
| `SeatingCircle.test.tsx` | Renders N seats at correct angular positions; only next/previous seats are tappable in-game; empty seats are tappable in setup; active seat receives the highlight class |
| `TurnMarker.test.tsx` | Rotation animates between the right angles; cw vs ccw take the shortest path on wraparound |
| `PlayerPickerModal.test.tsx` | Already-seated players are disabled; selecting a new player fills the seat; "Clear seat" empties the seat |
| `TurnTrackerScreen.test.tsx` | Setup → in-game transition; **Begin Game** disabled until all seats filled; **End Game** confirmation; group-picker disabled in-game; toolbar buttons navigate to `Turn` and `Timer`; score button navigates to `ScoreTracker` |

### Functional / integration

- Re-run existing `TurnSelectorScreen` and `TimerScreen` tests; both should still pass unchanged (those screens are not modified).
- Snapshot the new landing-page label in any existing landing E2E to confirm "Track Turns".

### Manual / E2E (Playwright, optional)

- A short scenario: open Track Turns → place 4 players → Begin Game → tap marker 3 times → assert active seat moved correctly → toggle direction → tap marker → assert direction respected → End Game → confirm session cleared.

---

## Backward Compatibility

1. **Persisted state**: `PlayerGroup.turnTracker` is **optional** (`?: TurnTrackerSession | null`). Existing persisted groups without this field deserialize cleanly with `turnTracker === undefined`, which the context normalises to `null`.
2. **Navigation**: The `Turn` route (existing `TurnSelectorScreen`) is **kept** in the stack so the new toolbar can still navigate to it. We do **not** delete it.
3. **Landing icon**: Icon glyph and position are unchanged; only the label and target screen change. No migrations required.
4. **Backend / API**: Pure client-side feature; no API surface changes, no backward-compatibility concerns on the server.
5. **AsyncStorage**: New key `app.turnTracker` is additive. Reading on a device that has never written it returns `null`.

---

## Implementation Order

Implement and verify in this order to keep PRs small and reviewable:

1. **Types & storage** — add `types/turnTracker.ts`, extend `PlayerGroup`, extend `appCache` (no UI yet). Unit tests for `appCache` round-tripping.
2. **`TurnTrackerContext`** — full state machine with persistence (group + appCache modes). Unit tests for `advance`/`retract`/`setDirection`/`beginGame`/`endGame`/hydration.
3. **`SeatingCircle` + `PlayerSeat`** — pure-presentational components. Unit tests for layout and tappability rules.
4. **`TurnMarker`** — animated component. Unit tests for rotation logic.
5. **`PlayerPickerModal`** — modal component with existing player list integration.
6. **`TurnTrackerScreen`** — wires everything together, including `BackButton`, `GroupPicker`, the **Begin Game** / **End Game** flows, the **Input Game Score** button, and the bottom toolbar.
7. **Navigation wiring** — register `TurnTracker` route in `App.tsx`, wrap with `TelemetryErrorBoundary` and `TurnTrackerProvider`.
8. **Landing-screen relabel** — single-line change in `LandingScreen.tsx` features array.
9. **Telemetry** — add events to `AnalyticsEvents`, instrument context calls.
10. **Final E2E sanity** — run existing `npm run test` + `npm run test:e2e:dev` to confirm no regressions in `TurnSelector` / `Timer` / `ScoreTracker`.

---

## Open Items

None — all clarifying questions have been resolved. Ready for implementation review.
