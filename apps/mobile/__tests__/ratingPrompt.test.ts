import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowRatingPrompt,
  recordDismissal,
  recordRated,
  resetRatingStateForDev,
  _resetForTesting,
  _constants,
  _getMajorVersion,
} from '../services/ratingPrompt';

// AsyncStorage is auto-mocked by jest-expo / __mocks__

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('ratingPrompt', () => {
  // ── shouldShowRatingPrompt ─────────────────────────────────

  describe('shouldShowRatingPrompt', () => {
    /**
     * Helper: set up storage so the user looks like a returning visitor
     * (first_open and last_active on different calendar days).
     */
    const setupReturningUser = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await AsyncStorage.setItem(
        _constants.FIRST_OPEN_KEY,
        yesterday.toISOString(),
      );
      await AsyncStorage.setItem(
        _constants.LAST_ACTIVE_KEY,
        new Date().toISOString(),
      );
    };

    it('skips multi-session check in dev mode (first-session user still sees prompt)', async () => {
      // In __DEV__ mode, the multi-session check is bypassed for local testing.
      // In production, a first-session user (same calendar day) would NOT see the prompt.
      const now = new Date().toISOString();
      await AsyncStorage.setItem(_constants.FIRST_OPEN_KEY, now);
      await AsyncStorage.setItem(_constants.LAST_ACTIVE_KEY, now);

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(true); // __DEV__ bypasses the multi-session condition
    });

    it('returns true for a returning user with 1+ messages and no errors', async () => {
      await setupReturningUser();

      const result = await shouldShowRatingPrompt(1, false);
      expect(result).toBe(true);
    });

    it('returns true for a returning user with multiple messages', async () => {
      await setupReturningUser();

      const result = await shouldShowRatingPrompt(5, false);
      expect(result).toBe(true);
    });

    it('returns false when already rated for the current major version', async () => {
      await setupReturningUser();
      // Stored major version matches current (mock is 3.2.7 → major '3')
      await AsyncStorage.setItem(_constants.RATED_KEY, '3');

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
    });

    it('returns true when rated for a previous major version (app upgraded)', async () => {
      await setupReturningUser();
      // Rated on major version 2, but current is 3.x.y
      await AsyncStorage.setItem(_constants.RATED_KEY, '2');

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(true);
    });

    it('returns false when legacy rated value "true" is stored', async () => {
      await setupReturningUser();
      // Pre-version-aware flag
      await AsyncStorage.setItem(_constants.RATED_KEY, 'true');

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
    });

    it('returns false when dismissed less than 7 days ago', async () => {
      await setupReturningUser();
      // Dismissed 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      await AsyncStorage.setItem(
        _constants.DISMISSED_AT_KEY,
        threeDaysAgo.toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
    });

    it('returns true when dismissed more than 7 days ago', async () => {
      await setupReturningUser();
      // Dismissed 8 days ago
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      await AsyncStorage.setItem(
        _constants.DISMISSED_AT_KEY,
        eightDaysAgo.toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(true);
    });

    it('returns false when session has errors', async () => {
      await setupReturningUser();

      const result = await shouldShowRatingPrompt(2, true);
      expect(result).toBe(false);
    });

    it('returns false when session message count is 0', async () => {
      await setupReturningUser();

      const result = await shouldShowRatingPrompt(0, false);
      expect(result).toBe(false);
    });

    it('returns true in dev mode even when first_open is missing (bypassed)', async () => {
      // In production, missing first_open would return false.
      await AsyncStorage.setItem(
        _constants.LAST_ACTIVE_KEY,
        new Date().toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(true); // __DEV__ bypasses
    });

    it('returns true in dev mode even when last_active is missing (bypassed)', async () => {
      // In production, missing last_active would return false.
      await AsyncStorage.setItem(
        _constants.FIRST_OPEN_KEY,
        new Date().toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(true); // __DEV__ bypasses
    });
  });

  // ── recordDismissal ────────────────────────────────────────

  describe('recordDismissal', () => {
    it('stores the current timestamp', async () => {
      await recordDismissal();

      const stored = await AsyncStorage.getItem(_constants.DISMISSED_AT_KEY);
      expect(stored).toBeTruthy();

      const storedDate = new Date(stored!);
      const now = new Date();
      // Should be within the last 2 seconds
      expect(now.getTime() - storedDate.getTime()).toBeLessThan(2000);
    });
  });

  // ── recordRated ────────────────────────────────────────────

  describe('recordRated', () => {
    it('stores the current major version', async () => {
      await recordRated();

      const stored = await AsyncStorage.getItem(_constants.RATED_KEY);
      // Mock expo-constants version is 3.2.7 → major '3'
      expect(stored).toBe('3');
    });

    it('suppresses the prompt for the same major version', async () => {
      // Set up a returning user who would normally see the prompt
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await AsyncStorage.setItem(
        _constants.FIRST_OPEN_KEY,
        yesterday.toISOString(),
      );
      await AsyncStorage.setItem(
        _constants.LAST_ACTIVE_KEY,
        new Date().toISOString(),
      );

      // Before rating: should show
      expect(await shouldShowRatingPrompt(2, false)).toBe(true);

      // After rating: should NOT show (same major version)
      await recordRated();
      expect(await shouldShowRatingPrompt(2, false)).toBe(false);
    });
  });

  // ── resetRatingStateForDev ──────────────────────────────────

  describe('resetRatingStateForDev', () => {
    it('clears rated and dismissed keys in dev mode', async () => {
      await AsyncStorage.setItem(_constants.RATED_KEY, 'true');
      await AsyncStorage.setItem(_constants.DISMISSED_AT_KEY, new Date().toISOString());

      await resetRatingStateForDev();

      expect(await AsyncStorage.getItem(_constants.RATED_KEY)).toBeNull();
      expect(await AsyncStorage.getItem(_constants.DISMISSED_AT_KEY)).toBeNull();
    });
  });

  // ── _resetForTesting ───────────────────────────────────────

  describe('_resetForTesting', () => {
    it('clears dismissed_at and rated keys', async () => {
      await AsyncStorage.setItem(_constants.DISMISSED_AT_KEY, 'some-date');
      await AsyncStorage.setItem(_constants.RATED_KEY, '3');

      await _resetForTesting();

      expect(await AsyncStorage.getItem(_constants.DISMISSED_AT_KEY)).toBeNull();
      expect(await AsyncStorage.getItem(_constants.RATED_KEY)).toBeNull();
    });
  });

  // ── _getMajorVersion ─────────────────────────────────────

  describe('_getMajorVersion', () => {
    it('extracts major version from semver string', () => {
      expect(_getMajorVersion('3.2.7')).toBe('3');
      expect(_getMajorVersion('4.0.0')).toBe('4');
      expect(_getMajorVersion('10.1.2')).toBe('10');
    });

    it('returns "0" for empty or malformed input', () => {
      expect(_getMajorVersion('')).toBe('');
    });
  });
});
