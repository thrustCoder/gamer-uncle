import { useState, useCallback, useEffect } from 'react';
import {
  incrementEngagement,
  shouldShowFeatureRatingPrompt,
  resetAllEngagementCounters,
  recordDismissal,
  recordRated,
  requestStoreReview,
  resetRatingStateForDev,
  RatingFeatureKey,
} from '../services/ratingPrompt';
import { trackEvent, AnalyticsEvents } from '../services/Telemetry';

/**
 * Hook that manages the rating prompt lifecycle for a non-chat feature screen.
 *
 * Usage:
 * ```tsx
 * const { showRatingModal, trackEngagement, handleRate, handleDismiss } =
 *   useRatingPrompt('turnSelector');
 *
 * // Call trackEngagement() after the user's action (e.g., spin complete)
 * // Render <RatingModal visible={showRatingModal} onRate={handleRate} onDismiss={handleDismiss} />
 * ```
 */
export function useRatingPrompt(featureKey: RatingFeatureKey) {
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Clear persisted rating state in dev mode on mount
  useEffect(() => {
    resetRatingStateForDev();
  }, []);

  /**
   * Increment the engagement counter and evaluate whether the prompt should show.
   * Call this after the user completes a qualifying action.
   * Returns `true` if the rating modal was shown.
   */
  const trackEngagement = useCallback(async (): Promise<boolean> => {
    await incrementEngagement(featureKey);
    const shouldShow = await shouldShowFeatureRatingPrompt(featureKey);
    if (shouldShow) {
      // Reset all counters so user must re-engage after cooldown
      await resetAllEngagementCounters();
      setShowRatingModal(true);
      trackEvent(AnalyticsEvents.RATING_PROMPT_SHOWN, { source: featureKey });
    }
    return shouldShow;
  }, [featureKey]);

  const handleRate = useCallback(async () => {
    setShowRatingModal(false);
    await recordRated();
    await requestStoreReview();
    trackEvent(AnalyticsEvents.RATING_PROMPT_RATED, { source: featureKey });
  }, [featureKey]);

  const handleDismiss = useCallback(async () => {
    setShowRatingModal(false);
    await recordDismissal();
    trackEvent(AnalyticsEvents.RATING_PROMPT_DISMISSED, { source: featureKey });
  }, [featureKey]);

  return {
    showRatingModal,
    trackEngagement,
    handleRate,
    handleDismiss,
  };
}
