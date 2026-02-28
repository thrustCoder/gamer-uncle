import { compareSemver, getInstalledVersion, checkAppVersion, fetchRatingUrls, _resetRatingUrlsCache } from '../services/AppConfigService';
import Constants from 'expo-constants';

// Mock apiConfig
jest.mock('../config/apiConfig', () => ({
  getApiBaseUrl: jest.fn(() => 'https://example.com/api/'),
  getAppKey: jest.fn(() => 'test-app-key'),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns negative when a < b (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('returns positive when a > b (major)', () => {
    expect(compareSemver('3.0.0', '2.0.0')).toBeGreaterThan(0);
  });

  it('returns negative when a < b (minor)', () => {
    expect(compareSemver('1.2.0', '1.3.0')).toBeLessThan(0);
  });

  it('returns positive when a > b (minor)', () => {
    expect(compareSemver('1.5.0', '1.3.0')).toBeGreaterThan(0);
  });

  it('returns negative when a < b (patch)', () => {
    expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('returns positive when a > b (patch)', () => {
    expect(compareSemver('1.0.3', '1.0.2')).toBeGreaterThan(0);
  });

  it('handles missing patch component', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
  });

  it('handles single component version', () => {
    expect(compareSemver('2', '1.9.9')).toBeGreaterThan(0);
  });
});

describe('getInstalledVersion', () => {
  it('returns version from expoConfig', () => {
    // Set the version on the mocked Constants
    (Constants as any).expoConfig = { version: '3.2.7', extra: {} };
    expect(getInstalledVersion()).toBe('3.2.7');
  });

  it('returns 0.0.0 when expoConfig has no version', () => {
    (Constants as any).expoConfig = { extra: {} };
    expect(getInstalledVersion()).toBe('0.0.0');
  });
});

describe('checkAppVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn();
    // Set known version for all checkAppVersion tests
    (Constants as any).expoConfig = { version: '3.2.7', extra: {} };
  });

  it('returns needsUpdate false when version meets minimum', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '3.0.0',
        forceUpgrade: false,
      }),
    });

    const result = await checkAppVersion();
    expect(result).toEqual({ needsUpdate: false, forceUpgrade: false });
  });

  it('returns needsUpdate true when version is below minimum', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '4.0.0',
        upgradeUrl: 'https://apps.apple.com/app/test',
        message: 'Please update',
        forceUpgrade: true,
      }),
    });

    const result = await checkAppVersion();
    expect(result).toEqual({
      needsUpdate: true,
      forceUpgrade: true,
      message: 'Please update',
      upgradeUrl: 'https://apps.apple.com/app/test',
    });
  });

  it('returns null on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await checkAppVersion();
    expect(result).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await checkAppVersion();
    expect(result).toBeNull();
  });

  it('calls the correct URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
      }),
    });

    await checkAppVersion();
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/api/AppConfig');
  });

  it('uses iOS upgradeUrl on iOS platform', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '99.0.0',
        upgradeUrl: 'https://apps.apple.com/ios',
        upgradeUrlAndroid: 'https://play.google.com/android',
        message: 'Update',
        forceUpgrade: false,
      }),
    });

    const result = await checkAppVersion();
    expect(result?.upgradeUrl).toBe('https://apps.apple.com/ios');
  });

  it('returns needsUpdate false when version equals minimum', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '3.2.7',
        forceUpgrade: false,
      }),
    });

    const result = await checkAppVersion();
    expect(result).toEqual({ needsUpdate: false, forceUpgrade: false });
  });
});

describe('fetchRatingUrls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetRatingUrlsCache();
    (global.fetch as jest.Mock) = jest.fn();
  });

  it('returns backend URLs when API responds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
        ratingUrl: 'https://apps.apple.com/us/app/gamer-uncle/id9999999',
        ratingUrlAndroid: 'market://details?id=com.custom.app',
      }),
    });

    const urls = await fetchRatingUrls();
    expect(urls.ios).toBe('https://apps.apple.com/us/app/gamer-uncle/id9999999');
    expect(urls.android).toBe('market://details?id=com.custom.app');
  });

  it('returns fallback URLs when API fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const urls = await fetchRatingUrls();
    expect(urls.ios).toBe('https://apps.apple.com/us/app/gamer-uncle/id6747456645');
    expect(urls.android).toBe('market://details?id=com.thrustCoder.gamerUncle');
  });

  it('returns fallback URLs when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const urls = await fetchRatingUrls();
    expect(urls.ios).toBe('https://apps.apple.com/us/app/gamer-uncle/id6747456645');
    expect(urls.android).toBe('market://details?id=com.thrustCoder.gamerUncle');
  });

  it('returns fallback iOS URL when ratingUrl is missing in response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
        ratingUrlAndroid: 'market://details?id=com.custom.app',
      }),
    });

    const urls = await fetchRatingUrls();
    expect(urls.ios).toBe('https://apps.apple.com/us/app/gamer-uncle/id6747456645');
    expect(urls.android).toBe('market://details?id=com.custom.app');
  });

  it('caches the result across multiple calls', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
        ratingUrl: 'https://cached.url',
        ratingUrlAndroid: 'market://cached',
      }),
    });

    await fetchRatingUrls();
    await fetchRatingUrls();
    await fetchRatingUrls();

    // fetch should only be called once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('cache is cleared by _resetRatingUrlsCache', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
        ratingUrl: 'https://first.url',
        ratingUrlAndroid: 'market://first',
      }),
    });

    await fetchRatingUrls();
    _resetRatingUrlsCache();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        minVersion: '1.0.0',
        forceUpgrade: false,
        ratingUrl: 'https://second.url',
        ratingUrlAndroid: 'market://second',
      }),
    });

    const urls = await fetchRatingUrls();
    expect(urls.ios).toBe('https://second.url');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
