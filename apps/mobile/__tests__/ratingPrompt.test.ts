import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowRatingPrompt,
  recordDismissal,
  recordRated,
  _resetForTesting,
  _constants,
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

    it('returns false for a first-session user (same calendar day)', async () => {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(_constants.FIRST_OPEN_KEY, now);
      await AsyncStorage.setItem(_constants.LAST_ACTIVE_KEY, now);

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
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

    it('returns false when already rated', async () => {
      await setupReturningUser();
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

    it('returns false when first_open is missing', async () => {
      await AsyncStorage.setItem(
        _constants.LAST_ACTIVE_KEY,
        new Date().toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
    });

    it('returns false when last_active is missing', async () => {
      await AsyncStorage.setItem(
        _constants.FIRST_OPEN_KEY,
        new Date().toISOString(),
      );

      const result = await shouldShowRatingPrompt(2, false);
      expect(result).toBe(false);
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
    it('sets the rated flag to "true"', async () => {
      await recordRated();

      const stored = await AsyncStorage.getItem(_constants.RATED_KEY);
      expect(stored).toBe('true');
    });

    it('permanently suppresses the prompt', async () => {
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

      // After rating: should NOT show
      await recordRated();
      expect(await shouldShowRatingPrompt(2, false)).toBe(false);
    });
  });

  // ── _resetForTesting ───────────────────────────────────────

  describe('_resetForTesting', () => {
    it('clears dismissed_at and rated keys', async () => {
      await AsyncStorage.setItem(_constants.DISMISSED_AT_KEY, 'some-date');
      await AsyncStorage.setItem(_constants.RATED_KEY, 'true');

      await _resetForTesting();

      expect(await AsyncStorage.getItem(_constants.DISMISSED_AT_KEY)).toBeNull();
      expect(await AsyncStorage.getItem(_constants.RATED_KEY)).toBeNull();
    });
  });
});
