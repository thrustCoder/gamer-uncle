import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRatingPrompt } from '../hooks/useRatingPrompt';
import { _constants, _resetForTesting } from '../services/ratingPrompt';

// Mock Telemetry
jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    RATING_PROMPT_SHOWN: 'rating_prompt_shown',
    RATING_PROMPT_RATED: 'rating_prompt_rated',
    RATING_PROMPT_DISMISSED: 'rating_prompt_dismissed',
  },
}));

const { trackEvent } = require('../services/Telemetry');

describe('useRatingPrompt', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  /**
   * Helper: render the hook and flush the fire-and-forget
   * `resetRatingStateForDev()` called inside useEffect on mount.
   */
  const renderAndFlush = async (featureKey: Parameters<typeof useRatingPrompt>[0]) => {
    const hookReturn = renderHook(() => useRatingPrompt(featureKey));
    // Flush the async useEffect (resetRatingStateForDev)
    await act(async () => {});
    return hookReturn;
  };

  /**
   * In __DEV__ mode, the threshold is 1 and multi-session check is bypassed.
   * So calling trackEngagement once should prompt if global conditions are met.
   */
  it('initially has showRatingModal = false', async () => {
    const { result } = await renderAndFlush('turnSelector');
    expect(result.current.showRatingModal).toBe(false);
  });

  it('shows modal after engagement threshold is met (dev threshold = 1)', async () => {
    const { result } = await renderAndFlush('turnSelector');

    await act(async () => {
      const shown = await result.current.trackEngagement();
      expect(shown).toBe(true);
    });

    expect(result.current.showRatingModal).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('rating_prompt_shown', {
      source: 'turnSelector',
    });
  });

  it('resets all engagement counters when modal is shown', async () => {
    // Pre-set some counters
    await AsyncStorage.setItem(`${_constants.ENGAGEMENT_KEY_PREFIX}gameSearch`, '5');
    await AsyncStorage.setItem(`${_constants.ENGAGEMENT_KEY_PREFIX}gameSetup`, '3');

    const { result } = await renderAndFlush('turnSelector');

    await act(async () => {
      await result.current.trackEngagement();
    });

    // All counters should be cleared
    const gameSearchCount = await AsyncStorage.getItem(
      `${_constants.ENGAGEMENT_KEY_PREFIX}gameSearch`,
    );
    const gameSetupCount = await AsyncStorage.getItem(
      `${_constants.ENGAGEMENT_KEY_PREFIX}gameSetup`,
    );
    const turnSelectorCount = await AsyncStorage.getItem(
      `${_constants.ENGAGEMENT_KEY_PREFIX}turnSelector`,
    );

    expect(gameSearchCount).toBeNull();
    expect(gameSetupCount).toBeNull();
    expect(turnSelectorCount).toBeNull();
  });

  it('does not show modal when user already rated current version', async () => {
    const { result } = await renderAndFlush('turnSelector');

    // Set rated AFTER mount (dev reset clears it on mount)
    await AsyncStorage.setItem(_constants.RATED_KEY, '3');

    await act(async () => {
      const shown = await result.current.trackEngagement();
      expect(shown).toBe(false);
    });

    expect(result.current.showRatingModal).toBe(false);
  });

  it('handleRate hides modal and records rated', async () => {
    const { result } = await renderAndFlush('gameSearch');

    // Show the modal first
    await act(async () => {
      await result.current.trackEngagement();
    });
    expect(result.current.showRatingModal).toBe(true);

    // Rate
    await act(async () => {
      await result.current.handleRate();
    });

    expect(result.current.showRatingModal).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('rating_prompt_rated', {
      source: 'gameSearch',
    });

    // Rated key should be set to major version
    const rated = await AsyncStorage.getItem(_constants.RATED_KEY);
    expect(rated).toBe('3');
  });

  it('handleDismiss hides modal and records dismissal', async () => {
    const { result } = await renderAndFlush('teamRandomizer');

    // Show the modal first
    await act(async () => {
      await result.current.trackEngagement();
    });
    expect(result.current.showRatingModal).toBe(true);

    // Dismiss
    await act(async () => {
      await result.current.handleDismiss();
    });

    expect(result.current.showRatingModal).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('rating_prompt_dismissed', {
      source: 'teamRandomizer',
    });

    // Dismissed key should be set
    const dismissed = await AsyncStorage.getItem(_constants.DISMISSED_AT_KEY);
    expect(dismissed).toBeTruthy();
  });

  it('trackEngagement returns false when within cooldown after dismissal', async () => {
    const { result } = await renderAndFlush('turnSelector');

    // Show and dismiss (starts cooldown)
    await act(async () => {
      await result.current.trackEngagement();
    });
    await act(async () => {
      await result.current.handleDismiss();
    });

    // Now try again — dismissed just now, within cooldown
    await act(async () => {
      const shown = await result.current.trackEngagement();
      expect(shown).toBe(false);
    });
  });
});
