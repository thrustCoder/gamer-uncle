# Game Setup Assistant - Implementation Plan

## Feature Overview

The Game Setup Assistant allows users to quickly get initial setup instructions for any board game based on the number of players. This feature provides a streamlined experience for the most common game-related question: "How do I set up this game?"

## User Flow

```
Landing Screen               Game Setup Screen              Chat Screen
┌─────────────────┐         ┌─────────────────────┐        ┌─────────────────────┐
│                 │         │                     │        │                     │
│  [Uncle Header] │         │ ← Back              │        │ ← Back              │
│                 │         │                     │        │                     │
│ ┌────┐  ┌────┐  │         │ Game Name:          │        │ System: What else   │
│ │Turn│  │Team│  │         │ [_______________]   │        │ do you want to know │
│ └────┘  └────┘  │         │                     │        │ about [Game]?       │
│                 │         │ Number of Players:  │        │                     │
│ ┌────┐  ┌────┐  │  Click  │ [ 4 ▼ ]            │  API   │ [Chat continues...] │
│ │Dice│  │Timer│ │ ──────► │                     │ ────►  │                     │
│ └────┘  └────┘  │         │                     │        │                     │
│                 │         │ [Get Game Setup]    │        │                     │
│ ┌────┐          │         │                     │        │                     │
│ │Setup│         │         │ ── Response Area ── │  Click │                     │
│ └────┘          │         │ (Markdown rendered) │ ──────►│                     │
│                 │         │                     │        │                     │
│                 │         │ [Need more help?]   │        │                     │
└─────────────────┘         └─────────────────────┘        └─────────────────────┘
```

## Technical Requirements

### 1. New Files to Create

| File | Purpose |
|------|---------|
| `screens/GameSetupScreen.tsx` | Main screen component with form inputs and response display |
| `styles/gameSetupStyles.ts` | Styling following existing pattern (similar to `turnSelectorStyles.ts`) |
| `assets/images/setup_icon.png` | Icon for landing page grid (designer to provide) |

### 2. Files to Modify

| File | Changes |
|------|---------|
| `App.tsx` | Add `GameSetup` screen to Stack.Navigator |
| `screens/LandingScreen.tsx` | Add new icon button for Game Setup |
| `styles/landingStyles.ts` | Add style for new `iconButtonSetup` |
| `store/ChatContext.tsx` | Add optional `initialContext` state for prefilled messages |

### 3. Component Breakdown

#### GameSetupScreen.tsx

**State:**
```typescript
interface GameSetupState {
  gameName: string;           // Text input for game name
  playerCount: number;        // Selected number of players (1-20)
  isLoading: boolean;         // Loading state during API call
  setupResponse: string | null; // Markdown response from AI
  error: string | null;       // Error message if API fails
}
```

**Key Functions:**
- `handleGetSetup()` - Constructs prompt and calls `getRecommendations()` API
- `handleNeedMoreHelp()` - Navigates to Chat with prefilled context

**Prompt Construction:**
```typescript
const prompt = `What is the initial game setup for ${gameName} with ${playerCount} players? 
Please provide step-by-step setup instructions including:
- Board/play area setup
- Initial card/piece distribution per player
- Starting positions
- Any player-count specific variations`;
```

### 4. Navigation & Context Passing

**Navigate to Chat with Context:**
```typescript
// In GameSetupScreen.tsx
const handleNeedMoreHelp = () => {
  navigation.navigate('Chat', {
    prefillContext: {
      gameName: gameName,
      playerCount: playerCount,
      previousSetupQuery: true
    }
  });
};
```

**Receiving Context in ChatScreen:**
```typescript
// In ChatScreen.tsx - add route params handling
const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
const { prefillContext } = route.params || {};

useEffect(() => {
  if (prefillContext?.previousSetupQuery) {
    // Add system message with prefilled context
    const contextMessage: ChatMessage = {
      id: `context-${Date.now()}`,
      type: 'system',
      text: `What else would you like to know about setting up ${prefillContext.gameName} for ${prefillContext.playerCount} players? I can help with rules clarification, strategy tips, or anything else about this game! 🎲`
    };
    setMessages(prev => [...prev, contextMessage]);
  }
}, [prefillContext]);
```

### 5. UI Components

**Player Count Selector:**
- Use React Native `Alert.alert` with options (matching TurnSelectorScreen pattern)
- OR use `@react-native-picker/picker` for a native dropdown
- Range: 1-20 players

**Response Display:**
- Reuse existing `MarkdownText` component
- Wrap in `ScrollView` for long responses
- Same styling as chat bubbles

**Action Buttons:**
- "Get Game Setup" - Primary action, styled like existing buttons
- "Need more help?" - Secondary action, appears after response

### 6. API Integration

Uses existing `getRecommendations()` from `ApiClient.ts`:
```typescript
const response = await getRecommendations({
  Query: constructedPrompt,
  UserId: userId,        // Generate session ID
  ConversationId: null   // New conversation for each setup query
});
```

**Note:** Each Game Setup request starts a fresh conversation. The conversation context is only passed to Chat if user clicks "Need more help".

### 7. Styling Guidelines

Follow existing patterns from `turnSelectorStyles.ts`:
- `ImageBackground` with `tool_background.png`
- `BackButton` component for navigation
- Consistent color scheme from `colors.ts`
- Input styling matching existing text inputs
- Button styling consistent with other screens

### 8. Testing Requirements

**Unit Tests (`__tests__/GameSetupScreen.test.tsx`):**
- [ ] Renders correctly with default state
- [ ] Updates gameName on text input
- [ ] Updates playerCount on picker selection
- [ ] Shows loading indicator during API call
- [ ] Displays markdown response correctly
- [ ] "Need more help" button navigates with correct params
- [ ] Error handling displays error message

**E2E Tests (`e2e/game-setup.spec.ts`):**
- [ ] Navigate from Landing to Game Setup
- [ ] Fill in game name and player count
- [ ] Submit and verify response appears
- [ ] Click "Need more help" and verify Chat opens with context

---

## Implementation Phases

### Phase 1: Core Screen (MVP)
1. Create `GameSetupScreen.tsx` with basic layout
2. Add navigation route in `App.tsx`
3. Create basic styles in `gameSetupStyles.ts`
4. Implement form inputs (game name, player count)
5. Integrate API call with loading state
6. Display response using `MarkdownText`

### Phase 2: Landing Page Integration
1. Add setup icon to `LandingScreen.tsx` (reuse `dice_icon.png` temporarily)
2. Update grid layout to 3+2 (3 top, 2 bottom)
3. Add `iconButtonSetup` style to `landingStyles.ts`

### Phase 3: Chat Context Flow
1. Implement "Need more help" button
2. Add route params to Chat navigation
3. Handle prefilled context in `ChatScreen.tsx`
4. Add system message for context continuity

### Phase 4: Testing & Polish
1. Write unit tests
2. Write E2E tests
3. Error handling refinements
4. UI polish and animations

---

## Decisions (Resolved)

1. **Additional inputs beyond game name + player count?**
   - **Decision:** Game name (free-form text) + player count only. Users can mention variants/expansions in the game name text field (e.g., "Catan with Seafarers expansion").

2. **Icon Design:**
   - **Decision:** Reuse existing `dice_icon.png` temporarily. A custom icon will be created during the landing page overhaul.

3. **Landing Grid Layout:**
   - **Decision:** 3+2 layout (3 icons top row, 2 icons bottom row). Simple approach before landing page overhaul.

4. **Player Count Input Method:**
   - **Decision:** Alert picker (matches TurnSelectorScreen pattern) - consistent UX.

5. **Conversation ID Strategy:**
   - **Decision:** Generate new ConversationId for each Game Setup query. When "Need more help" is clicked, pass context to Chat for continuity.

---

## Dependencies

- No new npm packages required
- Reuses existing components: `BackButton`, `MarkdownText`
- Reuses existing API: `getRecommendations`
- Reuses existing context: `ChatContext` (with minor additions)

---

## Estimated Effort

| Phase | Estimate |
|-------|----------|
| Phase 1: Core Screen | 4-6 hours |
| Phase 2: Landing Integration | 1-2 hours |
| Phase 3: Chat Context Flow | 2-3 hours |
| Phase 4: Testing & Polish | 3-4 hours |
| **Total** | **10-15 hours** |

---

## Success Criteria

1. ✅ User can access Game Setup from landing page
2. ✅ User can enter game name and select player count
3. ✅ API returns setup instructions displayed in markdown
4. ✅ "Need more help" seamlessly transitions to Chat with context
5. ✅ Chat shows contextual system message about the game
6. ✅ Error states are handled gracefully
7. ✅ UI is consistent with existing app design
