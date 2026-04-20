# Player Groups — Implementation Plan

## 1. Feature Overview

Player Groups lets users organize players into named groups (e.g., "Friday Night Crew", "Family Game Night") so that all per-player data — names, scores, leaderboard, game setup cache — is scoped to the active group. When groups are disabled, the user reverts to the current flat (ungrouped) player model.

---

## 2. Requirements Summary

### 2.1 Enabling Groups

| # | Requirement |
|---|-------------|
| R1 | On every screen that shows player count/names (**ScoreTracker, GameSetup, TurnSelector, TeamRandomizer**), display an **"Enable Player Groups"** toggle when groups are not yet enabled. |
| R2 | Tapping the toggle shows a **confirmation popup** explaining that the user is about to enable different groups of players, with a **Confirm** button. |
| R3 | On confirm, the user is navigated to the **ManageGroups** screen. |
| R4 | The current ungrouped players and **all existing data** (scores, leaderboard, game setup cache) are automatically migrated into the first group, named **"Game Night Group"**. |
| R5 | Group names are **editable**. |

### 2.2 Group Management

| # | Requirement |
|---|-------------|
| R6 | A new **ManageGroups** screen is added to the main stack navigator, accessible from any group picker's **"Manage Groups"** link. |
| R7 | A separate **CreateGroup** screen lets the user create a new group (name, player count, player names). |
| R8 | Each group supports **2–20 players**. Player naming is available when the group has **≤ 10** players; for 11–20, only the count is stored. |
| R9 | Maximum of **10 groups** allowed. |
| R10 | At least **1 group** must exist while groups are enabled. |
| R11 | Deleting the currently active group **auto-selects the next available group**. |

### 2.3 Group Picker (Post-Enable UX)

| # | Requirement |
|---|-------------|
| R12 | Once groups are enabled, the screens listed in R1 replace the player count/names inputs with a **group picker dropdown** and a **"Manage Groups"** link. |
| R13 | The group picker selection is **global** — changing the active group on one screen persists across all other screens. |
| R14 | Switching the active group while a ScoreTracker session is in progress shows a **warning**: "Switching will save your current session and load the selected group's data." User must confirm. |

### 2.4 Disabling Groups

| # | Requirement |
|---|-------------|
| R15 | At the bottom of the ManageGroups screen, a **"Disable Groups"** option is available. |
| R16 | Tapping it shows a **confirmation popup**: "All groups and their data will be deleted except the currently active group. The active group's players and data will be kept as ungrouped players." |
| R17 | On confirm: the active group's data (player names, count, scores, leaderboard, game setup cache) is promoted to ungrouped state; all other groups and their data are **permanently deleted**. |
| R18 | After disabling, the screens revert to showing the original player count/names inputs with the "Enable Player Groups" toggle. |

---

## 3. Screens Affected

| Screen | Current Player UI | Post-Enable Player UI |
|--------|-------------------|-----------------------|
| **ScoreTrackerScreen** | Player count button + name inputs (≤6) | Group picker dropdown + "Manage Groups" link |
| **GameSetupScreen** | Player count picker button | Group picker dropdown + "Manage Groups" link |
| **TurnSelectorScreen** | Player count button + name inputs (≤6) | Group picker dropdown + "Manage Groups" link |
| **TeamRandomizerScreen** | Player count button + name inputs (≤6) | Group picker dropdown + "Manage Groups" link |
| **ChatScreen** | _(not affected)_ | _(not affected)_ |

---

## 4. Data Model

### 4.1 New Types — `apps/mobile/types/playerGroups.ts`

```typescript
/** A single player group */
export interface PlayerGroup {
  /** Unique identifier (UUID) */
  id: string;
  /** Editable display name (e.g., "Friday Night Crew") */
  name: string;
  /** Number of players in this group (2–20) */
  playerCount: number;
  /** Player names. Populated only when playerCount ≤ 10. */
  playerNames: string[];
  /** Number of teams (used by TeamRandomizer) */
  teamCount: number;
  /** Score Tracker: active game scoring session */
  gameScore: GameScoreSession | null;
  /** Score Tracker: leaderboard entries */
  leaderboard: LeaderboardEntry[];
  /** Game Setup: cached game name */
  gameSetupGameName: string;
  /** Game Setup: cached player count for setup queries */
  gameSetupPlayerCount: number;
  /** Game Setup: cached AI response */
  gameSetupResponse: string | null;
}

/** Top-level player groups state persisted in AsyncStorage */
export interface PlayerGroupsState {
  /** Whether the groups feature is currently enabled */
  enabled: boolean;
  /** ID of the currently active group */
  activeGroupId: string | null;
  /** All groups */
  groups: PlayerGroup[];
}
```

### 4.2 AsyncStorage Key

Add one new key to `appCache.ts`:

```typescript
const Keys = {
  // ... existing keys ...
  playerGroups: 'app.playerGroups',  // JSON<PlayerGroupsState>
} as const;
```

### 4.3 Default State

```typescript
const DEFAULT_PLAYER_GROUPS_STATE: PlayerGroupsState = {
  enabled: false,
  activeGroupId: null,
  groups: [],
};
```

---

## 5. State Management — `PlayerGroupsContext`

### 5.1 New File — `apps/mobile/store/PlayerGroupsContext.tsx`

A new React context provider that manages all group state and exposes actions.

```typescript
interface PlayerGroupsContextType {
  // State
  state: PlayerGroupsState;
  isLoading: boolean;
  activeGroup: PlayerGroup | null;   // computed convenience

  // Group lifecycle
  enableGroups: () => void;           // R2–R4: migrate current data → first group, set enabled
  disableGroups: () => void;          // R15–R18: flatten active group, delete rest
  createGroup: (name: string, playerCount: number, playerNames: string[]) => void;  // R7
  updateGroup: (groupId: string, updates: Partial<Pick<PlayerGroup, 'name' | 'playerCount' | 'playerNames' | 'teamCount'>>) => void;
  deleteGroup: (groupId: string) => void;  // R10–R11
  setActiveGroup: (groupId: string) => void; // R13

  // Per-group data mutations (delegated from ScoreTracker/GameSetup when groups are active)
  updateActiveGroupData: (patch: Partial<Pick<PlayerGroup,
    'gameScore' | 'leaderboard' | 'gameSetupGameName' | 'gameSetupPlayerCount' | 'gameSetupResponse'
  >>) => void;
}
```

### 5.2 Provider Wiring — `App.tsx`

Wrap the existing providers inside `PlayerGroupsProvider`:

```
<GameProvider>
  <ChatProvider>
    <TimerProvider>
      <ScoreTrackerProvider>
        <PlayerGroupsProvider>     ← NEW (innermost so it can read GameContext & ScoreTrackerContext)
          <NavigationContainer>
            ...
          </NavigationContainer>
        </PlayerGroupsProvider>
      </ScoreTrackerProvider>
    </TimerProvider>
  </ChatProvider>
</GameProvider>
```

### 5.3 Interaction with Existing Contexts

When groups are **enabled**, `PlayerGroupsContext` becomes the source of truth for player names, count, scores, and leaderboard. The existing `GameContext` and `ScoreTrackerContext` continue to work as the _in-memory runtime state_, but their hydration and persistence shift:

| Concern | Groups Disabled (today) | Groups Enabled |
|---------|------------------------|----------------|
| Hydrate players on mount | `appCache.getPlayers()` | `activeGroup.playerNames` |
| Persist player name change | `appCache.setPlayers()` | `updateActiveGroupData({ ... })` which writes to `appCache.playerGroups` |
| Hydrate scores on mount | `appCache.getGameScore()` | `activeGroup.gameScore` |
| Persist score change | `appCache.setGameScore()` | `updateActiveGroupData({ gameScore })` |
| Hydrate leaderboard | `appCache.getLeaderboard()` | `activeGroup.leaderboard` |

The approach: the existing contexts still hold runtime state. A **bridge layer** (a `useEffect` inside `PlayerGroupsProvider`) syncs:
- **On mount / group switch**: reads from `activeGroup` → pushes into `GameContext.setPlayers()` and `ScoreTrackerContext` (via a new `hydrate` method or by calling existing setters).
- **On data change**: listens to `GameContext.players` and `ScoreTrackerContext.gameScore/leaderboard` changes and writes them back to `activeGroup` in the groups store.

This minimizes changes to existing screen code — they keep using `useGame()` and `useScoreTracker()` as before.

---

## 6. Storage Migration — Enable Flow

When the user confirms "Enable Player Groups":

```
1. Read current ungrouped state:
   - appCache.getPlayers()         → playerNames
   - appCache.getPlayerCount()     → playerCount
   - appCache.getTeamCount()       → teamCount
   - appCache.getGameScore()       → gameScore
   - appCache.getLeaderboard()     → leaderboard
   - appCache.getGameSetupGameName()      → gameSetupGameName
   - appCache.getGameSetupPlayerCount()   → gameSetupPlayerCount
   - appCache.getGameSetupResponse()      → gameSetupResponse

2. Create the first PlayerGroup:
   {
     id: uuid(),
     name: "Game Night Group",
     playerCount,
     playerNames,
     teamCount,
     gameScore,
     leaderboard,
     gameSetupGameName,
     gameSetupPlayerCount,
     gameSetupResponse,
   }

3. Save PlayerGroupsState:
   {
     enabled: true,
     activeGroupId: <new group id>,
     groups: [<new group>],
   }

4. Navigate to ManageGroups screen.
```

---

## 7. Storage Migration — Disable Flow

When the user confirms "Disable Groups":

```
1. Read active group data.

2. Write active group's data back into ungrouped AsyncStorage keys:
   - appCache.setPlayers(activeGroup.playerNames)
   - appCache.setPlayerCount(activeGroup.playerCount)
   - appCache.setTeamCount(activeGroup.teamCount)
   - appCache.setGameScore(activeGroup.gameScore)
   - appCache.setLeaderboard(activeGroup.leaderboard)
   - appCache.setGameSetupGameName(activeGroup.gameSetupGameName)
   - appCache.setGameSetupPlayerCount(activeGroup.gameSetupPlayerCount)
   - appCache.setGameSetupResponse(activeGroup.gameSetupResponse)

3. Reset PlayerGroupsState to default (enabled: false, groups: []).

4. Navigate back (the screens will show ungrouped UI again).
```

---

## 8. New Screens

### 8.1 ManageGroups Screen — `apps/mobile/screens/ManageGroupsScreen.tsx`

**Route name**: `ManageGroups`

**Layout**:
```
┌──────────────────────────────────────┐
│  ← Back                             │
│                                      │
│  Player Groups                       │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🎲 Game Night Group     ✏️ 🗑️ │  │   ← active (highlighted)
│  │    4 players                   │  │
│  ├────────────────────────────────┤  │
│  │ 🎲 Family Night         ✏️ 🗑️ │  │
│  │    6 players                   │  │
│  └────────────────────────────────┘  │
│                                      │
│  [ + Create New Group ]              │   ← disabled if 10 groups exist
│                                      │
│  ──────────────────────────────────  │
│                                      │
│  ⚠️ Disable Player Groups            │   ← R15
│                                      │
└──────────────────────────────────────┘
```

**Behavior**:
- Tapping a group row sets it as active (R13). If ScoreTracker has an in-progress session, show the switch-warning (R14).
- Tapping ✏️ navigates to CreateGroup screen in **edit mode** (pre-populated).
- Tapping 🗑️ shows a delete confirmation. If it's the last group, block deletion (R10). If it's the active group, auto-select the next group (R11).
- "+ Create New Group" navigates to CreateGroup screen. Disabled when `groups.length >= 10` (R9).
- "Disable Player Groups" triggers the disable flow (R15–R18).

### 8.2 CreateGroup Screen — `apps/mobile/screens/CreateGroupScreen.tsx`

**Route name**: `CreateGroup`

**Nav params**: `{ groupId?: string }` — if present, edit mode.

**Layout**:
```
┌──────────────────────────────────────┐
│  ← Back                             │
│                                      │
│  Create Group  /  Edit Group         │
│                                      │
│  Group Name                          │
│  ┌────────────────────────────────┐  │
│  │ Friday Night Crew              │  │
│  └────────────────────────────────┘  │
│                                      │
│  Number of Players       [ 4 ]       │   ← same Alert picker, 2–20
│                                      │
│  ┌──────┐ ┌──────┐                   │
│  │ P1   │ │ P2   │                   │   ← name inputs (only if ≤ 10)
│  ├──────┤ ├──────┤                   │
│  │ P3   │ │ P4   │                   │
│  └──────┘ └──────┘                   │
│                                      │
│  (11-20 players: "X players          │
│   configured — naming available      │
│   for 10 or fewer")                  │
│                                      │
│  [ Save Group ]                      │
│                                      │
└──────────────────────────────────────┘
```

**Behavior**:
- Validates group name is non-empty.
- On save, calls `createGroup()` or `updateGroup()` and navigates back to ManageGroups.
- In edit mode, pre-fills existing group data.

---

## 9. New Components

### 9.1 GroupPicker — `apps/mobile/components/GroupPicker.tsx`

A reusable component displayed on ScoreTracker, GameSetup, TurnSelector, and TeamRandomizer when groups are enabled.

**Props**:
```typescript
interface GroupPickerProps {
  /** Callback when user wants to navigate to ManageGroups */
  onManageGroups: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│  Active Group: [ Game Night Group ▼] │   ← dropdown
│  Manage Groups →                     │   ← link
└──────────────────────────────────────┘
```

**Behavior**:
- Dropdown shows all group names. Selecting one calls `setActiveGroup()`.
- Before switching, if the current screen is ScoreTracker and there's an active game session, show the R14 warning.
- "Manage Groups →" calls `onManageGroups()` which navigates to ManageGroups.

### 9.2 EnableGroupsToggle — `apps/mobile/components/EnableGroupsToggle.tsx`

A small toggle row displayed on the four screens when groups are **not** enabled.

**Props**:
```typescript
interface EnableGroupsToggleProps {
  /** Callback after user confirms enabling */
  onEnabled: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│  Enable Player Groups        [toggle]│
└──────────────────────────────────────┘
```

**Behavior**:
- Tapping the toggle shows the R2 confirmation popup.
- On confirm, calls `enableGroups()` from `PlayerGroupsContext`, then calls `onEnabled()` (which navigates to ManageGroups).

---

## 10. Screen Modifications

### 10.1 ScoreTrackerScreen

**Current**: renders `<PlayerNamesSection>` unconditionally.

**Change**:
```tsx
const { state, activeGroup } = usePlayerGroups();

// At the top of the player section:
{state.enabled ? (
  <>
    <GroupPicker onManageGroups={() => navigation.navigate('ManageGroups')} />
    {/* Player names from activeGroup shown below the picker (read-only summary) */}
  </>
) : (
  <>
    <PlayerNamesSection ... />
    <EnableGroupsToggle onEnabled={() => navigation.navigate('ManageGroups')} />
  </>
)}
```

Player count and names are now read from `activeGroup` when groups are enabled. The `renamePlayer` on name change, `clearGameScore`, `clearLeaderboard`, hydration from `appCache` — all remain as-is because the bridge layer in `PlayerGroupsProvider` keeps them in sync.

### 10.2 GameSetupScreen

**Current**: Alert-based player count picker.

**Change**: When groups are enabled, replace the player count picker section with `<GroupPicker>`. The `playerCount` for the AI query is derived from `activeGroup.playerCount`.

### 10.3 TurnSelectorScreen

**Current**: Inline player count button + name inputs.

**Change**: When groups are enabled, replace the top section with `<GroupPicker>`. Player names for the spinning wheel segments come from `activeGroup.playerNames`.

### 10.4 TeamRandomizerScreen

**Current**: Inline player count button + name inputs.

**Change**: When groups are enabled, replace the player section with `<GroupPicker>`. The team count picker remains (it's group-scoped via `activeGroup.teamCount`).

### 10.5 App.tsx — Navigation

Add two new routes to `Stack.Navigator`:

```tsx
<Stack.Screen name="ManageGroups">
  {() => (
    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_MANAGE_GROUPS} screenName="Manage Groups">
      <ManageGroupsScreen />
    </TelemetryErrorBoundary>
  )}
</Stack.Screen>
<Stack.Screen name="CreateGroup">
  {() => (
    <TelemetryErrorBoundary errorEventName={AnalyticsEvents.ERROR_CREATE_GROUP} screenName="Create Group">
      <CreateGroupScreen />
    </TelemetryErrorBoundary>
  )}
</Stack.Screen>
```

---

## 11. appCache Changes

### 11.1 New Methods

```typescript
// In appCache object:
getPlayerGroups: (): Promise<PlayerGroupsState> =>
  getObject<PlayerGroupsState>(Keys.playerGroups, DEFAULT_PLAYER_GROUPS_STATE),

setPlayerGroups: (state: PlayerGroupsState): Promise<void> =>
  setObject(Keys.playerGroups, state),
```

### 11.2 Existing Methods

No changes. The ungrouped keys (`playerCount`, `playersList`, `teamCount`, `scoreTrackerGameScore`, `scoreTrackerLeaderboard`, `gameSetup*`) remain and are used when groups are disabled. When groups are enabled, the bridge layer reads/writes via `playerGroups` key instead.

---

## 12. Telemetry

Add new analytics events to `apps/mobile/services/Telemetry.ts`:

```typescript
// In AnalyticsEvents:
PLAYER_GROUPS_ENABLED: 'player_groups_enabled',
PLAYER_GROUPS_DISABLED: 'player_groups_disabled',
PLAYER_GROUP_CREATED: 'player_group_created',
PLAYER_GROUP_DELETED: 'player_group_deleted',
PLAYER_GROUP_SWITCHED: 'player_group_switched',
ERROR_MANAGE_GROUPS: 'error_manage_groups',
ERROR_CREATE_GROUP: 'error_create_group',
```

---

## 13. Implementation Phases

### Phase 1 — Foundation (no UI changes yet)

| Step | File(s) | Description |
|------|---------|-------------|
| 1.1 | `types/playerGroups.ts` | Create `PlayerGroup`, `PlayerGroupsState` types |
| 1.2 | `services/storage/appCache.ts` | Add `playerGroups` key and `get/setPlayerGroups` methods |
| 1.3 | `store/PlayerGroupsContext.tsx` | Implement context with enable/disable/CRUD/switch actions and bridge logic |
| 1.4 | `App.tsx` | Wire `PlayerGroupsProvider` |
| 1.5 | Unit tests | Test context: enable migration, disable migration, CRUD, active group switching, bridge sync |

### Phase 2 — Enable/Disable UI

| Step | File(s) | Description |
|------|---------|-------------|
| 2.1 | `components/EnableGroupsToggle.tsx` | Build toggle + confirmation popup component |
| 2.2 | `components/GroupPicker.tsx` | Build dropdown + "Manage Groups" link component |
| 2.3 | `screens/ScoreTrackerScreen.tsx` | Integrate toggle (ungrouped) / picker (grouped) |
| 2.4 | `screens/GameSetupScreen.tsx` | Integrate toggle / picker |
| 2.5 | `screens/TurnSelectorScreen.tsx` | Integrate toggle / picker |
| 2.6 | `screens/TeamRandomizerScreen.tsx` | Integrate toggle / picker |
| 2.7 | Unit tests | Test toggle rendering, picker selection, screen conditional rendering |

### Phase 3 — Group Management Screens

| Step | File(s) | Description |
|------|---------|-------------|
| 3.1 | `screens/ManageGroupsScreen.tsx` | Build ManageGroups screen with group list, delete, disable |
| 3.2 | `screens/CreateGroupScreen.tsx` | Build CreateGroup/EditGroup screen |
| 3.3 | `styles/manageGroupsStyles.ts` | Styling for ManageGroups |
| 3.4 | `styles/createGroupStyles.ts` | Styling for CreateGroup |
| 3.5 | `App.tsx` | Add `ManageGroups` and `CreateGroup` stack routes |
| 3.6 | `services/Telemetry.ts` | Add new analytics events |
| 3.7 | Unit tests | Test ManageGroups CRUD operations, CreateGroup validation |

### Phase 4 — Group Switching Guards

| Step | File(s) | Description |
|------|---------|-------------|
| 4.1 | `components/GroupPicker.tsx` | Add switch-warning when ScoreTracker has active session (R14) |
| 4.2 | `screens/ManageGroupsScreen.tsx` | Add delete-active-group auto-select logic (R11) |
| 4.3 | `screens/ManageGroupsScreen.tsx` | Enforce minimum 1 group (R10), max 10 groups (R9) |
| 4.4 | Unit tests | Test switching guards, edge cases (delete last group blocked, delete active group selects next) |

### Phase 5 — E2E Testing

| Step | File(s) | Description |
|------|---------|-------------|
| 5.1 | `e2e/playerGroups.spec.ts` | Enable flow: toggle → confirm → ManageGroups |
| 5.2 | `e2e/playerGroups.spec.ts` | Create group, switch group, verify data isolation |
| 5.3 | `e2e/playerGroups.spec.ts` | Disable flow: verify data migration back to ungrouped |
| 5.4 | `e2e/playerGroups.spec.ts` | Edge cases: max groups, delete active, naming threshold |

---

## 14. File Inventory — New & Modified

### New Files (8)

| File | Purpose |
|------|---------|
| `apps/mobile/types/playerGroups.ts` | Type definitions |
| `apps/mobile/store/PlayerGroupsContext.tsx` | State management context |
| `apps/mobile/components/EnableGroupsToggle.tsx` | Toggle component |
| `apps/mobile/components/GroupPicker.tsx` | Dropdown picker component |
| `apps/mobile/screens/ManageGroupsScreen.tsx` | Group list & disable screen |
| `apps/mobile/screens/CreateGroupScreen.tsx` | Create/edit group screen |
| `apps/mobile/styles/manageGroupsStyles.ts` | ManageGroups styling |
| `apps/mobile/styles/createGroupStyles.ts` | CreateGroup styling |

### Modified Files (8)

| File | Change Summary |
|------|----------------|
| `apps/mobile/App.tsx` | Add `PlayerGroupsProvider`, add 2 stack routes |
| `apps/mobile/services/storage/appCache.ts` | Add `playerGroups` key + get/set methods |
| `apps/mobile/services/Telemetry.ts` | Add 7 new analytics events |
| `apps/mobile/screens/ScoreTrackerScreen.tsx` | Conditional render: toggle vs picker |
| `apps/mobile/screens/GameSetupScreen.tsx` | Conditional render: toggle vs picker |
| `apps/mobile/screens/TurnSelectorScreen.tsx` | Conditional render: toggle vs picker |
| `apps/mobile/screens/TeamRandomizerScreen.tsx` | Conditional render: toggle vs picker |
| `apps/mobile/store/ScoreTrackerContext.tsx` | Add `hydrateFromGroup()` method for bridge sync |

### Test Files (new)

| File | Purpose |
|------|---------|
| `apps/mobile/__tests__/store/PlayerGroupsContext.test.tsx` | Context unit tests |
| `apps/mobile/__tests__/components/EnableGroupsToggle.test.tsx` | Toggle component tests |
| `apps/mobile/__tests__/components/GroupPicker.test.tsx` | Picker component tests |
| `apps/mobile/__tests__/screens/ManageGroupsScreen.test.tsx` | ManageGroups screen tests |
| `apps/mobile/__tests__/screens/CreateGroupScreen.test.tsx` | CreateGroup screen tests |
| `apps/mobile/e2e/playerGroups.spec.ts` | E2E Playwright tests |

---

## 15. Edge Cases & Constraints

| # | Edge Case | Handling |
|---|-----------|----------|
| E1 | User has no data when enabling groups | Create "Game Night Group" with default 4 players (P1–P4), empty scores/leaderboard |
| E2 | Switching groups mid-ScoreTracker session | Show warning alert; on confirm, save current session to the old group and load new group's session |
| E3 | Deleting the only group | Block with alert: "You must have at least one group while groups are enabled. To remove groups, use Disable Player Groups." |
| E4 | Deleting the active group (not the only one) | Delete the group, then set `activeGroupId` to the next group in the list (or first if deleted was last) |
| E5 | Creating 11th group | "Create New Group" button is disabled; tooltip/label: "Maximum 10 groups reached" |
| E6 | Group with 11–20 players | Player names array is empty (or contains only default "P1"–"P20" placeholders). UI shows "{count} players configured" message instead of name inputs. |
| E7 | Rename collision within group | Handled by existing `renamePlayer` logic in ScoreTrackerContext — no special group handling needed |
| E8 | App upgrade: user on old version without groups | `getPlayerGroups()` returns default state (`enabled: false`). Old ungrouped keys continue to work transparently. |
| E9 | Corrupted `playerGroups` JSON in AsyncStorage | `getObject()` already catches parse errors and returns default state. Groups reset to disabled gracefully. |

---

## 16. No Backend Changes

This feature is **entirely client-side**. No API endpoints, C# models, or backend services are affected. The backend only deals with game metadata (min/max players from BGG) and AI recommendations — neither of which is player-group aware.

---

## 17. Backward Compatibility

- **No API contract changes** — backend is unaffected.
- **AsyncStorage**: all existing keys remain. The new `app.playerGroups` key is additive. Users who never enable groups see zero behavioral change.
- **Context API**: `useGame()` and `useScoreTracker()` hooks continue to expose the same interface. Screens that don't adopt the group picker yet will still work with ungrouped data.
