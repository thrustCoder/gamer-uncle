# Score Tracker - Implementation Plan

## Overview

The Score Tracker feature allows users to track scores during board game sessions. It consists of three main sections:
1. **Player Names** - Editable player list (synced with app-wide player cache)
2. **Game Score** - Track scores per round for a single game session
3. **Leaderboard** - Track aggregate scores across multiple games

Entry point: Feature icon on Landing Screen → Score Tracker Screen

---

## Requirements Summary

### Data Model Decisions
| Decision | Choice |
|----------|--------|
| Game Score aggregation | Sum of all rounds per player |
| Leaderboard aggregation | Sum of all game scores per player |
| Multiple games in Game Score | One game at a time |
| Player sync | Sync with `appCache.getPlayers()` |
| Game data storage | Full details (name, thumbnail, BGG ID) |
| Custom game names | Allowed for Leaderboard entries |
| Data persistence | Indefinite until user clears |
| Storage limits | None |

### UX Decisions
| Decision | Choice |
|----------|--------|
| Score input | Numeric keyboard + stepper buttons (+/-) |
| Stack ranking animation | Animated bars on score updates |
| Player identification | Initials (with discriminator if duplicates) |
| Bar colors | Same color, trophy emoji for 1st place |
| Deletion flow | Confirmation popup only (no undo) |
| Row management | Swipe gestures (fallback: explicit icons) |
| Layout | Vertical scroll: Players → Game Score → Leaderboard |
| Empty state buttons | "Add Game Score" & "Add Leaderboard Score" horizontally aligned |

---

## Architecture

### File Structure

```
apps/mobile/
├── screens/
│   ├── ScoreTrackerScreen.tsx          # Main score tracker page
│   └── ScoreInputScreen.tsx            # Add/edit scores for a round or game
├── components/
│   ├── scoreTracker/
│   │   ├── PlayerNamesSection.tsx      # Editable player names container
│   │   ├── GameScoreSection.tsx        # Game score section with close button
│   │   ├── LeaderboardSection.tsx      # Leaderboard section with close button
│   │   ├── StackRankingChart.tsx       # Animated horizontal bar chart
│   │   ├── ScoreTable.tsx              # Tabular score display with swipe actions
│   │   ├── ScoreTableRow.tsx           # Individual swipeable row
│   │   ├── GameSearchModal.tsx         # Modal with game search typeahead
│   │   └── ScoreInputRow.tsx           # Player score input with stepper
├── store/
│   └── ScoreTrackerContext.tsx         # Context for score tracker state
├── services/
│   └── storage/
│       └── appCache.ts                 # Extended with score tracker keys
├── styles/
│   └── scoreTrackerStyles.ts           # Styles for score tracker screens
└── types/
    └── scoreTracker.ts                 # TypeScript interfaces
```

### Data Types

```typescript
// types/scoreTracker.ts

export interface GameInfo {
  id: string;           // BGG ID or generated UUID for custom games
  name: string;
  thumbnailUrl?: string;
  isCustom: boolean;    // true if user typed custom name
}

export interface RoundScore {
  roundNumber: number;
  scores: Record<string, number>;  // playerName -> score
  timestamp: number;
}

export interface GameScoreSession {
  game: GameInfo;
  rounds: RoundScore[];
  createdAt: number;
}

export interface LeaderboardEntry {
  game: GameInfo;
  scores: Record<string, number>;  // playerName -> score for this game
  timestamp: number;
}

export interface ScoreTrackerState {
  gameScore: GameScoreSession | null;
  leaderboard: LeaderboardEntry[];
}
```

### State Management

```typescript
// store/ScoreTrackerContext.tsx

interface ScoreTrackerContextType {
  // State
  gameScore: GameScoreSession | null;
  leaderboard: LeaderboardEntry[];
  
  // Game Score actions
  startGameScore: (game: GameInfo) => void;
  addRound: (scores: Record<string, number>) => void;
  updateRound: (roundNumber: number, scores: Record<string, number>) => void;
  deleteRound: (roundNumber: number) => void;
  clearGameScore: () => void;
  
  // Leaderboard actions
  addLeaderboardEntry: (game: GameInfo, scores: Record<string, number>) => void;
  updateLeaderboardEntry: (index: number, game: GameInfo, scores: Record<string, number>) => void;
  deleteLeaderboardEntry: (index: number) => void;
  clearLeaderboard: () => void;
  
  // Computed
  getGameScoreRanking: () => { player: string; total: number }[];
  getLeaderboardRanking: () => { player: string; total: number }[];
}
```

### Cache Keys (appCache.ts extension)

```typescript
const Keys = {
  // ... existing keys
  scoreTrackerGameScore: 'app.scoreTracker.gameScore',
  scoreTrackerLeaderboard: 'app.scoreTracker.leaderboard',
} as const;
```

---

## Screen Specifications

### 1. ScoreTrackerScreen

**Layout (top to bottom):**
1. Back button (existing BackButton component)
2. Title: "Score Tracker"
3. Player Names Section (collapsible container)
4. Game Score Section OR "Add Game Score" button
5. Leaderboard Section OR "Add Leaderboard Score" button

**Empty State:**
- When both Game Score and Leaderboard are empty:
  - Show two horizontally aligned buttons: "Add Game Score" | "Add Leaderboard Score"
  - Buttons styled consistently with other screens (e.g., TeamRandomizer)

**Navigation:**
- Entry: Landing Screen → "Score" icon tap
- Score Input: Tap "Add Row" / "Edit" → ScoreInputScreen

### 2. PlayerNamesSection

**Behavior:**
- Syncs with `appCache.getPlayers()` on mount
- Displays editable TextInput fields for each player
- Matches styling from TurnSelectorScreen/TeamRandomizerScreen
- Player count picker (similar to other screens)
- Changes auto-save via debounced effect

**Styling:**
- Container with transparent background
- Same input field styling as TurnSelectorScreen
- "Number of players" picker button

### 3. GameScoreSection

**Components:**
1. **Header Row:**
   - Game thumbnail (small, ~40x40)
   - Game name
   - Close button (X) - triggers confirmation popup

2. **Stack Ranking Chart:**
   - Horizontal bars showing aggregate scores
   - Player initials on left
   - Score value on right of bar
   - Trophy emoji (🏆) next to 1st place
   - Bars animate on score changes

3. **Score Table:**
   - Header row: "Round" | Player1 | Player2 | ... | PlayerN
   - Data rows: Round# | Score1 | Score2 | ... | ScoreN
   - Swipeable rows revealing Edit/Delete actions
   - "Add Round" link/button at bottom

**Empty State (no game selected):**
- "Add Game Score" button
- Clicking opens GameSearchModal

### 4. LeaderboardSection

**Components:**
1. **Header Row:**
   - Title: "Leaderboard"
   - Close button (X) - triggers confirmation popup

2. **Stack Ranking Chart:**
   - Same as GameScoreSection but aggregates across all games
   - Horizontal bars with player initials
   - Trophy emoji for leader

3. **Leaderboard Table:**
   - Header row: "Game" | Player1 | Player2 | ... | PlayerN
   - Data rows: [Thumbnail + Name] | Score1 | Score2 | ... | ScoreN
   - Swipeable rows revealing Edit/Delete actions
   - "Add Game" link/button at bottom

**Empty State:**
- "Add Leaderboard Score" button
- Clicking navigates to ScoreInputScreen with leaderboard mode

### 5. ScoreInputScreen

**Modes:**
1. **Game Score Round Mode** - Add/edit scores for a round
2. **Leaderboard Entry Mode** - Add/edit game + scores

**Layout:**
1. Back button
2. Title: "Add Round" / "Edit Round" / "Add Game Score" / "Edit Game Score"
3. (Leaderboard mode only) Game search input with typeahead
4. Player score inputs:
   - Player name label
   - Numeric TextInput (centered)
   - Stepper buttons: [-] [value] [+]
5. Save button

**Behavior:**
- Numeric keyboard for score input
- Stepper buttons increment/decrement by 1
- Long-press stepper for rapid change
- Save validates all fields have values
- Cancel returns without saving

### 6. StackRankingChart Component

**Props:**
```typescript
interface StackRankingChartProps {
  data: { player: string; total: number }[];
  maxValue?: number;  // For consistent bar scaling
  animate?: boolean;
}
```

**Behavior:**
- Sorts data descending by total
- Calculates bar width as percentage of max value
- Generates unique initials for each player
- Animates bar width changes using `Animated.timing`
- Shows 🏆 emoji next to first place

**Initials Algorithm:**
```typescript
function generateUniqueInitials(names: string[]): Record<string, string> {
  // Start with first letter
  // If duplicate, add second letter
  // Continue until unique
}
```

### 7. GameSearchModal

**Reuses GameSearchScreen patterns:**
- TextInput with search icon
- Debounced search (300ms)
- FlatList of results with thumbnails
- "Use custom name" option at bottom
- Calls `gameSearchService.searchGames()`

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
**Files to create/modify:**

| Task | File | Description |
|------|------|-------------|
| 1.1 | `types/scoreTracker.ts` | Define TypeScript interfaces |
| 1.2 | `services/storage/appCache.ts` | Add score tracker cache keys and methods |
| 1.3 | `store/ScoreTrackerContext.tsx` | Create context with state and actions |
| 1.4 | `styles/scoreTrackerStyles.ts` | Create base styles |
| 1.5 | `App.tsx` | Wrap app with ScoreTrackerProvider |

**Acceptance Criteria:**
- [ ] All types defined and exported
- [ ] Cache can persist/retrieve score tracker data
- [ ] Context provides all required actions
- [ ] Unit tests for context actions

### Phase 2: Basic Screen Structure
**Files to create/modify:**

| Task | File | Description |
|------|------|-------------|
| 2.1 | `screens/ScoreTrackerScreen.tsx` | Main screen with sections |
| 2.2 | `components/scoreTracker/PlayerNamesSection.tsx` | Player names input |
| 2.3 | `screens/LandingScreen.tsx` | Wire up Score icon navigation |
| 2.4 | `navigation/` or `App.tsx` | Add ScoreTracker route |

**Acceptance Criteria:**
- [ ] Can navigate from Landing to Score Tracker
- [ ] Player names section displays and syncs with cache
- [ ] Empty state shows both "Add" buttons horizontally
- [ ] Back button returns to Landing

### Phase 3: Game Score Feature
**Files to create/modify:**

| Task | File | Description |
|------|------|-------------|
| 3.1 | `components/scoreTracker/GameScoreSection.tsx` | Game score container |
| 3.2 | `components/scoreTracker/StackRankingChart.tsx` | Animated bar chart |
| 3.3 | `components/scoreTracker/ScoreTable.tsx` | Score table with header |
| 3.4 | `components/scoreTracker/ScoreTableRow.tsx` | Swipeable row |
| 3.5 | `components/scoreTracker/GameSearchModal.tsx` | Game selection modal |
| 3.6 | `screens/ScoreInputScreen.tsx` | Score input for rounds |

**Acceptance Criteria:**
- [ ] Can select game via search modal
- [ ] Game thumbnail and name display in header
- [ ] Can add rounds with scores
- [ ] Stack ranking updates with animations
- [ ] Can edit/delete rounds via swipe
- [ ] Close button clears after confirmation
- [ ] Data persists across app restarts

### Phase 4: Leaderboard Feature
**Files to create/modify:**

| Task | File | Description |
|------|------|-------------|
| 4.1 | `components/scoreTracker/LeaderboardSection.tsx` | Leaderboard container |
| 4.2 | `screens/ScoreInputScreen.tsx` | Extend for leaderboard mode |

**Acceptance Criteria:**
- [ ] Can add leaderboard entries with game + scores
- [ ] Custom game names supported
- [ ] Stack ranking shows cross-game totals
- [ ] Can edit/delete entries via swipe
- [ ] Close button clears after confirmation
- [ ] Data persists across app restarts

### Phase 5: Polish & Testing
**Tasks:**

| Task | Description |
|------|-------------|
| 5.1 | Add loading states and error handling |
| 5.2 | Implement smooth animations |
| 5.3 | Add haptic feedback on actions |
| 5.4 | Write unit tests for components |
| 5.5 | Write unit tests for context/state |
| 5.6 | Manual QA on iOS and Android |
| 5.7 | Accessibility audit (labels, contrast) |

---

## Detailed Task Breakdown

### Phase 1 Tasks

#### Task 1.1: Create Type Definitions
**File:** `apps/mobile/types/scoreTracker.ts`

```typescript
export interface GameInfo {
  id: string;
  name: string;
  thumbnailUrl?: string;
  isCustom: boolean;
}

export interface RoundScore {
  roundNumber: number;
  scores: Record<string, number>;
  timestamp: number;
}

export interface GameScoreSession {
  game: GameInfo;
  rounds: RoundScore[];
  createdAt: number;
}

export interface LeaderboardEntry {
  game: GameInfo;
  scores: Record<string, number>;
  timestamp: number;
}

export interface ScoreTrackerState {
  gameScore: GameScoreSession | null;
  leaderboard: LeaderboardEntry[];
}
```

#### Task 1.2: Extend appCache
**File:** `apps/mobile/services/storage/appCache.ts`

Add new keys and methods:
```typescript
const Keys = {
  // ...existing
  scoreTrackerGameScore: 'app.scoreTracker.gameScore',
  scoreTrackerLeaderboard: 'app.scoreTracker.leaderboard',
};

// Add methods:
getGameScore: () => Promise<GameScoreSession | null>
setGameScore: (session: GameScoreSession | null) => Promise<void>
getLeaderboard: () => Promise<LeaderboardEntry[]>
setLeaderboard: (entries: LeaderboardEntry[]) => Promise<void>
```

#### Task 1.3: Create ScoreTrackerContext
**File:** `apps/mobile/store/ScoreTrackerContext.tsx`

- Create context with all state and actions
- Hydrate from cache on mount
- Persist changes to cache
- Use debounced persistence for frequent updates

#### Task 1.4: Create Styles
**File:** `apps/mobile/styles/scoreTrackerStyles.ts`

Base styles matching existing screens:
- Container with ImageBackground
- Section containers
- Table styles
- Button styles
- Input styles

#### Task 1.5: Integrate Provider
**File:** `apps/mobile/App.tsx`

Wrap app with `<ScoreTrackerProvider>`.

---

### Phase 2 Tasks

#### Task 2.1: Create ScoreTrackerScreen
**File:** `apps/mobile/screens/ScoreTrackerScreen.tsx`

Structure:
```tsx
<ImageBackground>
  <BackButton />
  <ScrollView>
    <Text>Score Tracker</Text>
    <PlayerNamesSection />
    {hasGameScore ? <GameScoreSection /> : null}
    {hasLeaderboard ? <LeaderboardSection /> : null}
    {!hasGameScore && !hasLeaderboard && <EmptyStateButtons />}
  </ScrollView>
</ImageBackground>
```

#### Task 2.2: Create PlayerNamesSection
**File:** `apps/mobile/components/scoreTracker/PlayerNamesSection.tsx`

- Reuse styling from TurnSelectorScreen
- Player count picker
- Editable name inputs
- Sync with appCache

#### Task 2.3: Update LandingScreen
**File:** `apps/mobile/screens/LandingScreen.tsx`

Change `screen: null` to `screen: 'ScoreTracker'` for score feature.

#### Task 2.4: Add Navigation Route
**File:** `apps/mobile/App.tsx` (or navigation config)

Add `ScoreTracker` and `ScoreInput` to stack navigator.

---

### Phase 3 Tasks

#### Task 3.1: Create GameScoreSection
**File:** `apps/mobile/components/scoreTracker/GameScoreSection.tsx`

- Header with game info + close button
- StackRankingChart
- ScoreTable
- "Add Round" button

#### Task 3.2: Create StackRankingChart
**File:** `apps/mobile/components/scoreTracker/StackRankingChart.tsx`

- Animated horizontal bars
- Unique initials generation
- Trophy emoji for leader
- Uses `Animated.timing` for smooth updates

#### Task 3.3: Create ScoreTable
**File:** `apps/mobile/components/scoreTracker/ScoreTable.tsx`

- Dynamic columns based on players
- Header row
- Maps data to ScoreTableRow components

#### Task 3.4: Create ScoreTableRow
**File:** `apps/mobile/components/scoreTracker/ScoreTableRow.tsx`

- Swipeable using `react-native-gesture-handler`
- Reveals Edit/Delete buttons on swipe
- Fallback to explicit icons if swipe not supported

#### Task 3.5: Create GameSearchModal
**File:** `apps/mobile/components/scoreTracker/GameSearchModal.tsx`

- Modal wrapper
- Reuses search patterns from GameSearchScreen
- "Use custom name" option
- Returns selected GameInfo

#### Task 3.6: Create ScoreInputScreen
**File:** `apps/mobile/screens/ScoreInputScreen.tsx`

- Mode: 'addRound' | 'editRound' | 'addLeaderboard' | 'editLeaderboard'
- ScoreInputRow for each player
- Numeric input + stepper buttons
- Save/Cancel actions

---

### Phase 4 Tasks

#### Task 4.1: Create LeaderboardSection
**File:** `apps/mobile/components/scoreTracker/LeaderboardSection.tsx`

- Header with close button
- StackRankingChart (cross-game totals)
- Leaderboard table with game thumbnails
- "Add Game" button

#### Task 4.2: Extend ScoreInputScreen
**File:** `apps/mobile/screens/ScoreInputScreen.tsx`

- Add game search input for leaderboard mode
- Support custom game name input
- Handle both round and leaderboard entry modes

---

## Dependencies

### Existing (no changes needed)
- `@react-native-async-storage/async-storage` - Data persistence
- `@react-navigation/stack` - Navigation
- `expo-av` - Sound effects (optional for score updates)

### May need to add
- `react-native-gesture-handler` - Already included with Expo, needed for swipe gestures
- `react-native-reanimated` - Already included with Expo, for smooth animations

---

## Testing Strategy

### Unit Tests
| Component | Test Cases |
|-----------|------------|
| ScoreTrackerContext | Add/edit/delete rounds, leaderboard entries, clear data |
| StackRankingChart | Correct sorting, initials generation, leader identification |
| ScoreTable | Row rendering, column alignment |
| GameSearchModal | Search, selection, custom name |

### Integration Tests
| Flow | Description |
|------|-------------|
| Game Score Flow | Select game → Add rounds → View ranking → Edit → Delete |
| Leaderboard Flow | Add games → View ranking → Edit → Delete |
| Data Persistence | Add data → Close app → Reopen → Data intact |
| Player Sync | Change players in TurnSelector → Reflected in ScoreTracker |

### Manual Testing Checklist
- [ ] Navigation from Landing works
- [ ] Player names sync correctly
- [ ] Game search returns results
- [ ] Custom game names work
- [ ] Scores calculate correctly
- [ ] Animations are smooth
- [ ] Swipe gestures work on iOS/Android
- [ ] Confirmation popups appear
- [ ] Data persists across restarts
- [ ] Empty states display correctly

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Swipe gestures inconsistent across platforms | Implement fallback explicit edit/delete icons |
| Large data sets slow down rendering | Use FlatList with proper keyExtractor, limit re-renders |
| Player name changes break existing data | Store scores by player name, handle missing players gracefully |
| Thumbnail URLs break | Show placeholder icon when image fails to load |

---

## Future Enhancements (Out of Scope)

- Export scores to CSV/share
- Score history/analytics
- Multiple game score sessions
- Player avatars/photos
- Undo functionality
- Cloud sync across devices
