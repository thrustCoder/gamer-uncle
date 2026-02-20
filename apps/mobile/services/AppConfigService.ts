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
