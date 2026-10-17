const appConfig = require('../app.json');
const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');

describe('mobile release version consistency', () => {
  const appVersion = appConfig.expo.version;

  it('keeps package metadata aligned with the Expo version', () => {
    expect(packageJson.version).toBe(appVersion);
    expect(packageLock.version).toBe(appVersion);
    expect(packageLock.packages[''].version).toBe(appVersion);
  });

  it('keeps the iOS build number aligned with the release version', () => {
    expect(appConfig.expo.ios.buildNumber).toBe(appVersion);
  });

  it('uses a positive integer Android version code', () => {
    expect(Number.isInteger(appConfig.expo.android.versionCode)).toBe(true);
    expect(appConfig.expo.android.versionCode).toBeGreaterThan(0);
  });
});
