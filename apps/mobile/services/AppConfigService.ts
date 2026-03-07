import Constants from 'expo-constants';
import { getApiBaseUrl } from '../config/apiConfig';

/**
 * Version policy returned by the /api/AppConfig endpoint.
 */
export interface AppVersionPolicy {
  minVersion: string;
  upgradeUrl?: string;
  upgradeUrlAndroid?: string;
  message?: string;
  forceUpgrade: boolean;
  /** iOS App Store URL for the in-app rating prompt (server-managed). */
  ratingUrl?: string;
  /** Android Play Store URL for the in-app rating prompt (server-managed). */
  ratingUrlAndroid?: string;
}

/**
 * Result of comparing the installed app version against the server policy.
 */
export interface VersionCheckResult {
  /** True if the installed version is below minVersion */
  needsUpdate: boolean;
  /** True if the upgrade is mandatory (blocking modal) */
  forceUpgrade: boolean;
  /** User-facing message from the server */
  message?: string;
  /** Platform-appropriate store URL */
  upgradeUrl?: string;
}

/**
 * Get the installed app version from Expo constants.
 * Falls back to app.json version, then to '0.0.0'.
 */
export const getInstalledVersion = (): string => {
  return (
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '0.0.0'
  );
};

/**
 * Compare two semver strings (major.minor.patch).
 * Returns negative if a < b, zero if equal, positive if a > b.
 */
export const compareSemver = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
};

/**
 * Fetch the version policy from the API and evaluate whether an update is needed.
 * Returns null if the check fails (network error, etc.) — the app should proceed normally.
 */
export const checkAppVersion = async (): Promise<VersionCheckResult | null> => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}AppConfig`);

    if (!response.ok) {
      console.warn(`AppConfig check failed with status ${response.status}`);
      return null;
    }

    const policy: AppVersionPolicy = await response.json();
    const installedVersion = getInstalledVersion();

    const needsUpdate = compareSemver(installedVersion, policy.minVersion) < 0;

    if (!needsUpdate) {
      return { needsUpdate: false, forceUpgrade: false };
    }

    // Determine platform-appropriate URL
    const { Platform } = require('react-native');
    const upgradeUrl =
      Platform.OS === 'android' && policy.upgradeUrlAndroid
        ? policy.upgradeUrlAndroid
        : policy.upgradeUrl;

    return {
      needsUpdate: true,
      forceUpgrade: policy.forceUpgrade,
      message: policy.message,
      upgradeUrl,
    };
  } catch (error) {
    console.warn('AppConfig version check failed:', error);
    return null;
  }
};

/**
 * Rating URLs returned by the backend, keyed by platform.
 */
export interface RatingUrls {
  ios: string;
  android: string;
}

// Hardcoded fallbacks — used when the backend is unreachable.
const FALLBACK_IOS_RATING_URL = 'https://apps.apple.com/app/id6747456645';
const FALLBACK_ANDROID_RATING_URL = 'market://details?id=com.thrustCoder.gamerUncle';

/** In-memory cache so we fetch at most once per app session. */
let _cachedRatingUrls: RatingUrls | null = null;

/**
 * Fetch the platform-specific store URLs for the rating prompt from
 * the backend /api/AppConfig endpoint. Falls back to hardcoded values
 * if the request fails or the fields are missing.
 *
 * Results are cached in-memory for the lifetime of the app session.
 */
export const fetchRatingUrls = async (): Promise<RatingUrls> => {
  if (_cachedRatingUrls) return _cachedRatingUrls;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}AppConfig`);

    if (response.ok) {
      const policy: AppVersionPolicy = await response.json();
      _cachedRatingUrls = {
        ios: policy.ratingUrl || FALLBACK_IOS_RATING_URL,
        android: policy.ratingUrlAndroid || FALLBACK_ANDROID_RATING_URL,
      };
      return _cachedRatingUrls;
    }
  } catch {
    // Network error — fall through to defaults
  }

  _cachedRatingUrls = {
    ios: FALLBACK_IOS_RATING_URL,
    android: FALLBACK_ANDROID_RATING_URL,
  };
  return _cachedRatingUrls;
};

/**
 * Reset the cached rating URLs (for testing).
 */
export const _resetRatingUrlsCache = (): void => {
  _cachedRatingUrls = null;
};
