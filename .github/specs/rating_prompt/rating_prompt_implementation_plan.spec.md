# Rating Prompt — Implementation Plan

## Overview

Nudge engaged users to rate **Gamer Uncle** on the App Store / Play Store after a positive interaction in the chat screen. The prompt is conservative by design: it targets returning users who have demonstrated multi-session engagement, appears as a dismissible banner (non-modal), and respects a 7-day cooldown after dismissal.

---

## Design Decisions (from clarifying questions)

| Decision | Choice |
|---|---|
| **Trigger** | Multi-session engagement — user has opened the app in **≥ 2 separate sessions** AND has **sent ≥ 1 chat message** in the current session |
| **UX** | Dismissible **banner at the top** of the chat screen |
| **Suppression** | 7-day cooldown after dismissal; permanent suppression after the user taps "Rate" |
| **Store API** | `expo-store-review` (native in-app review) with fallback to deep-link to the store listing |

---

## Trigger Logic (detailed)

The rating prompt should appear when **all** of the following are true:

1. **Multi-session user** — the telemetry `@telemetry_last_active` key shows at least one prior session on a different calendar day (i.e., the user is a return visitor).
2. **Current-session engagement** — the user has sent **at least 1 message** in the current session (tracked locally via a counter in `ChatScreen`).
3. **No API errors this session** — if an `Error.Api` event has been tracked in this session, suppress the prompt (no "rate us" after a broken experience).
4. **Cooldown respected** — the last dismissal was > 7 days ago (or never dismissed).
5. **Not already rated** — the user has not previously tapped "Rate" (tracked in AsyncStorage).

When conditions 1-5 are met, the banner renders at the top of the chat screen **after the AI response is displayed** (not during the typing indicator).

---

## Suppression & Persistence

| AsyncStorage Key | Type | Purpose |
|---|---|---|
| `@rating_prompt_dismissed_at` | ISO date string | Timestamp of last dismissal; used for 7-day cooldown |
| `@rating_prompt_rated` | `"true"` | Set when user taps "Rate"; permanently suppresses prompt |

These keys sit alongside existing telemetry keys and follow the same `@`-prefix convention.

---

## UX Specification

### Banner Design

```
┌─────────────────────────────────────────────────┐
│  ⭐  Enjoying Gamer Uncle? Rate us!   [Rate] [✕] │
└─────────────────────────────────────────────────┘
```

- **Position**: Top of the `ChatScreen`, above the message list (inside `SafeAreaView`, below the header).
- **Animation**: Slides down with a 300 ms ease-out animation (`Animated.View` with `translateY`).
- **Background**: Translucent warm color matching the app's palette (e.g., `rgba(255, 193, 7, 0.15)` with a left accent border).
- **Actions**:
  - **Rate** button → calls `expo-store-review` → sets `@rating_prompt_rated = "true"` → hides banner.
  - **✕ (dismiss)** → sets `@rating_prompt_dismissed_at = now` → hides banner with slide-up animation.
- **Accessibility**: Banner is announced to screen readers; buttons have `accessibilityLabel` and `accessibilityRole`.

### Timing

- Banner appears **2 seconds after** the AI response renders (subtle delay so it doesn't compete with the response).
- If the user scrolls or starts typing during the 2-second window, **cancel** the prompt for this session (don't interrupt active use).

---

## File-by-File Implementation Plan

### Phase 1 — New Files

#### 1. `apps/mobile/services/ratingPrompt.ts` (new)

Core logic module — no React dependency, fully unit-testable.

```typescript
// Public API:
shouldShowRatingPrompt(): Promise<boolean>   // evaluates all 5 conditions
recordDismissal(): Promise<void>             // sets dismissed_at
recordRated(): Promise<void>                 // sets rated flag
requestStoreReview(): Promise<void>          // expo-store-review → fallback
```

**Implementation details:**

- `shouldShowRatingPrompt()`:
  - Reads `@rating_prompt_rated` — if `"true"`, return `false`.
  - Reads `@rating_prompt_dismissed_at` — if < 7 days ago, return `false`.
  - Reads `@telemetry_first_open` and `@telemetry_last_active` — if they are on the **same calendar day**, return `false` (first-session user).
  - Accepts a `sessionMessageCount: number` param — if `0`, return `false`.
  - Accepts a `hasSessionErrors: boolean` param — if `true`, return `false`.
  - Otherwise return `true`.

- `requestStoreReview()`:
  - Calls `StoreReview.isAvailableAsync()` from `expo-store-review`.
  - If available → `StoreReview.requestReview()`.
  - If unavailable → `Linking.openURL()` with platform-specific store URL:
    - iOS: `https://apps.apple.com/app/id<APP_STORE_ID>` (extract from `app.json` `extra` or hardcode).
    - Android: `market://details?id=com.thrustCoder.gamerUncle`.

#### 2. `apps/mobile/components/RatingBanner.tsx` (new)

Presentational React Native component.

**Props:**
```typescript
interface RatingBannerProps {
  visible: boolean;
  onRate: () => void;
  onDismiss: () => void;
}
```

**Renders:**
- `Animated.View` with slide-down/slide-up transitions.
- Star emoji + text + "Rate" `TouchableOpacity` + "✕" dismiss button.
- Styled with `StyleSheet.create` (no external style lib).
- Returns `null` when `visible === false` and animation is complete.

#### 3. `apps/mobile/__tests__/ratingPrompt.test.ts` (new)

Unit tests for `ratingPrompt.ts`:

| Test Case | Setup | Expected |
|---|---|---|
| First-session user → no prompt | `first_open === last_active` (same day) | `false` |
| Returning user, 1+ messages, no errors → prompt | Different days, messageCount=2, noErrors | `true` |
| Already rated → no prompt | `@rating_prompt_rated = "true"` | `false` |
| Dismissed < 7 days ago → no prompt | `dismissed_at` = 3 days ago | `false` |
| Dismissed > 7 days ago → prompt | `dismissed_at` = 8 days ago | `true` |
| Has session errors → no prompt | `hasSessionErrors = true` | `false` |
| Zero messages → no prompt | `sessionMessageCount = 0` | `false` |

#### 4. `apps/mobile/__tests__/RatingBanner.test.tsx` (new)

Component tests:

| Test Case | Expected |
|---|---|
| Renders when `visible=true` | Banner text and buttons are in the tree |
| Hidden when `visible=false` | Nothing rendered |
| Calls `onRate` when Rate tapped | Callback invoked |
| Calls `onDismiss` when ✕ tapped | Callback invoked |
| Accessibility labels present | `accessibilityLabel` on both buttons |

---

### Phase 2 — Modified Files

#### 5. `apps/mobile/screens/ChatScreen.tsx` (modify)

**Changes:**

a. **Add state variables** near the top of the component:
```typescript
const [showRatingBanner, setShowRatingBanner] = useState(false);
const [sessionMessageCount, setSessionMessageCount] = useState(0);
const [hasSessionErrors, setHasSessionErrors] = useState(false);
```

b. **Increment `sessionMessageCount`** inside `handleSend()` (after the message is added to state):
```typescript
setSessionMessageCount(prev => prev + 1);
```

c. **Set `hasSessionErrors` to `true`** in the API error catch block.

d. **Evaluate and show the banner** after a successful AI response is rendered. Add a `useEffect` that watches for new system messages:
```typescript
useEffect(() => {
  // Only evaluate after we have a new AI response
  if (sessionMessageCount === 0) return;
  
  const timer = setTimeout(async () => {
    const shouldShow = await shouldShowRatingPrompt(sessionMessageCount, hasSessionErrors);
    if (shouldShow) setShowRatingBanner(true);
  }, 2000); // 2-second delay

  return () => clearTimeout(timer);
}, [messages.length]); // re-evaluate when messages change
```

e. **Render `<RatingBanner />`** above the `FlatList` / message area:
```tsx
<RatingBanner
  visible={showRatingBanner}
  onRate={async () => {
    await recordRated();
    await requestStoreReview();
    trackEvent('Rating.Prompt.Rated');
    setShowRatingBanner(false);
  }}
  onDismiss={async () => {
    await recordDismissal();
    trackEvent('Rating.Prompt.Dismissed');
    setShowRatingBanner(false);
  }}
/>
```

f. **Cancel prompt if user is typing** — in the `onChangeText` handler of the input, if the 2-second timer is pending, clear it. (Use a `useRef` for the timer ID.)

#### 6. `apps/mobile/services/Telemetry.ts` (modify)

Add new analytics events to `AnalyticsEvents`:

```typescript
// ── Rating Prompt ──────────────────────────────────────────────
RATING_PROMPT_SHOWN: 'Rating.Prompt.Shown',
RATING_PROMPT_RATED: 'Rating.Prompt.Rated',
RATING_PROMPT_DISMISSED: 'Rating.Prompt.Dismissed',
```

#### 7. `apps/mobile/__tests__/Telemetry.test.ts` (modify)

Add a test verifying the new event constants exist and have the expected string values.

#### 8. `apps/mobile/__tests__/ChatScreen.test.tsx` (modify — if exists)

Add integration-level tests:
- Rating banner appears after conditions are met (mock `shouldShowRatingPrompt` → `true`).
- Rating banner does NOT appear on first session.
- Tapping "Rate" calls `requestStoreReview` and hides the banner.
- Tapping dismiss hides the banner and records dismissal.

---

### Phase 3 — Dependency & Config

#### 9. Install `expo-store-review`

```bash
cd apps/mobile && npx expo install expo-store-review
```

This adds the Expo-managed version to `package.json` and ensures native compatibility with SDK 53.

#### 10. `apps/mobile/app.json` (modify — optional)

If needed, add the App Store ID to `extra` for the store-link fallback:
```json
"extra": {
  "appStoreId": "<APPLE_APP_STORE_ID>",
  "eas": { ... }
}
```

> **Note**: The App Store ID is only needed for the iOS deep-link fallback. It can be hardcoded in `ratingPrompt.ts` instead if preferred.

---

## Implementation Order

| Step | Task | Depends On |
|---|---|---|
| 1 | Install `expo-store-review` | — |
| 2 | Create `services/ratingPrompt.ts` | Step 1 |
| 3 | Create `__tests__/ratingPrompt.test.ts` + verify passing | Step 2 |
| 4 | Add telemetry events to `Telemetry.ts` | — |
| 5 | Create `components/RatingBanner.tsx` | — |
| 6 | Create `__tests__/RatingBanner.test.tsx` + verify passing | Step 5 |
| 7 | Wire into `ChatScreen.tsx` | Steps 2, 4, 5 |
| 8 | Update ChatScreen tests | Step 7 |
| 9 | Manual QA on device | Step 7 |

Steps 2-3 and 4-6 can be done in parallel.

---

## Telemetry & Success Metrics

| Metric | Event | How to Measure |
|---|---|---|
| Prompt impression rate | `Rating.Prompt.Shown` | % of sessions that see the banner |
| Tap-through rate | `Rating.Prompt.Rated` / `Rating.Prompt.Shown` | How often users tap "Rate" |
| Dismissal rate | `Rating.Prompt.Dismissed` / `Rating.Prompt.Shown` | How often users dismiss |
| App Store rating trend | App Store Connect / Google Play Console | Week-over-week rating change |

---

## Edge Cases & Guards

| Scenario | Behavior |
|---|---|
| User clears app data / reinstalls | All AsyncStorage keys reset; treated as new user (no prompt until 2nd session) |
| `expo-store-review` native API throttled by OS | Falls back to store deep link |
| User on web (Expo web build) | `StoreReview.isAvailableAsync()` returns `false`; deep link may not apply — skip prompt entirely on web |
| Multiple AI responses in quick succession | The 2-second timer resets on each new message; prompt only fires once per session |
| User navigates away from ChatScreen | Timer is cleaned up via `useEffect` cleanup; no orphaned prompts |
| Conversation cleared (new thread) | `sessionMessageCount` resets to 0; prompt won't fire until new messages are sent |

---

## Out of Scope (future iterations)

- Rating prompt on other screens (Game Search, Landing).
- Sentiment analysis on AI responses to detect "positive" answers.
- A/B testing different trigger thresholds.
- Server-side prompt configuration (remote config toggle).
- Thumbs up/down on individual AI messages (separate feature).
