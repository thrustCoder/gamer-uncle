import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { getInstalledVersion } from './AppConfigService';

// expo-store-review is loaded lazily to avoid crashing when the native module
// is not present in the current dev build (requires a rebuild to pick up).
let StoreReview: typeof import('expo-store-review') | null = null;
try {
  StoreReview = require('expo-store-review');
} catch {
  // Native module not available in this build — fallback to store deep link
}

// ── Storage keys ───────────────────────────────────────────────
const DISMISSED_AT_KEY = '@rating_prompt_dismissed_at';
const RATED_KEY = '@rating_prompt_rated';

// Keys shared with Telemetry.ts (read-only)
const FIRST_OPEN_KEY = '@telemetry_first_open';
const LAST_ACTIVE_KEY = '@telemetry_last_active';

// ── Configuration ──────────────────────────────────────────────
const COOLDOWN_DAYS = 7;

// Store IDs for deep-link fallback
const IOS_APP_STORE_URL = 'https://apps.apple.com/us/app/gamer-uncle/id6747456645';
const ANDROID_PLAY_STORE_URL = 'market://details?id=com.thrustCoder.gamerUncle';

// ── Helpers ────────────────────────────────────────────────────

/**
 * Extract the major version number from a semver string.
 * e.g. '3.2.7' → '3'
 */
const getMajorVersion = (version: string): string => {
  return version.split('.')[0] ?? '0';
};

/**
 * Returns the number of calendar days between two dates (UTC).
 */
const daysBetween = (a: Date, b: Date): number => {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.floor((utcB - utcA) / msPerDay));
};

// ── Public API ─────────────────────────────────────────────────

/**
 * Evaluate whether the rating prompt should be displayed.
 *
 * Returns `true` only when ALL of these conditions are met:
 * 1. The user has NOT tapped "Rate" for the current major version.
 *    (If the app upgrades to a new major version, the prompt reappears.)
 * 2. The user has NOT dismissed the prompt within the last 7 days.
 * 3. The user is a returning visitor (first open and last active are different calendar days).
 * 4. The user has sent at least 1 message in the current session.
 * 5. No API errors occurred in the current session.
 */
export const shouldShowRatingPrompt = async (
  sessionMessageCount: number,
  hasSessionErrors: boolean,
): Promise<boolean> => {
  try {
    // Condition 4: Must have sent at least 1 message
    if (sessionMessageCount === 0) return false;

    // Condition 5: No errors this session
    if (hasSessionErrors) return false;

    // Condition 1: Not already rated for this major version
    const ratedMajor = await AsyncStorage.getItem(RATED_KEY);
    if (ratedMajor) {
      const currentMajor = getMajorVersion(getInstalledVersion());
      // Suppress if the stored major version matches the running one.
      // Legacy value 'true' (pre-version-aware) also suppresses.
      if (ratedMajor === currentMajor || ratedMajor === 'true') return false;
    }

    // Condition 2: Cooldown – dismissed < 7 days ago
    const dismissedAt = await AsyncStorage.getItem(DISMISSED_AT_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const now = new Date();
      if (daysBetween(dismissedDate, now) < COOLDOWN_DAYS) return false;
    }

    // Condition 3: Multi-session user (first open ≠ last active, calendar-day-wise)
    // In dev mode, skip this check so the banner can be triggered with a single message.
    if (!__DEV__) {
      const firstOpen = await AsyncStorage.getItem(FIRST_OPEN_KEY);
      const lastActive = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

      if (!firstOpen || !lastActive) return false;

      const firstDate = new Date(firstOpen);
      const lastDate = new Date(lastActive);
      if (daysBetween(firstDate, lastDate) === 0) return false;
    }

    return true;
  } catch {
    // If anything goes wrong reading storage, don't show the prompt
    return false;
  }
};

/**
 * Record that the user dismissed the rating prompt.
 * Starts a 7-day cooldown before the prompt can appear again.
 */
export const recordDismissal = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(DISMISSED_AT_KEY, new Date().toISOString());
  } catch {
    // best-effort
  }
};

/**
 * Record that the user tapped "Rate".
 * Suppresses future prompts until the app upgrades to a new major version.
 */
export const recordRated = async (): Promise<void> => {
  try {
    const majorVersion = getMajorVersion(getInstalledVersion());
    await AsyncStorage.setItem(RATED_KEY, majorVersion);
  } catch {
    // best-effort
  }
};

/**
 * Request a store review using native in-app review dialog.
 * Falls back to opening the store listing if the native API is unavailable.
 */
export const requestStoreReview = async (): Promise<void> => {
  try {
    if (StoreReview) {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
        return;
      }
    }
  } catch {
    // Native review not available, fall through to deep link
  }

  // Fallback: open the store page directly
  const url = Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
  try {
    await Linking.openURL(url);
  } catch {
    // Can't open store — silently fail
  }
};

/**
 * In __DEV__ mode, clear persisted rating state so the banner can
 * be triggered again on every fresh app load. No-op in production.
 */
export const resetRatingStateForDev = async (): Promise<void> => {
  if (!__DEV__) return;
  await AsyncStorage.removeItem(DISMISSED_AT_KEY);
  await AsyncStorage.removeItem(RATED_KEY);
};

// ── Test helpers ────────────────────────────────────────────────

/**
 * Clear all rating prompt storage for unit tests.
 */
export const _resetForTesting = async (): Promise<void> => {
  await AsyncStorage.removeItem(DISMISSED_AT_KEY);
  await AsyncStorage.removeItem(RATED_KEY);
};

/**
 * Exposed constants for tests.
 */
export const _constants = {
  DISMISSED_AT_KEY,
  RATED_KEY,
  FIRST_OPEN_KEY,
  LAST_ACTIVE_KEY,
  COOLDOWN_DAYS,
} as const;

/** Exposed for tests. */
export const _getMajorVersion = getMajorVersion;
