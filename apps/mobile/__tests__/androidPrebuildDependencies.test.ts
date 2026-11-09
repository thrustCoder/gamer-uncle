const { readFileSync } = require('fs');
const { resolve } = require('path');
const androidPackageJson = require('../package.json');
const androidPackageLock = require('../package-lock.json');
const expoNativeModules = require('expo/bundledNativeModules.json');
const installedSplashScreen = require('expo-splash-screen/package.json');
const rootIgnoreRules: string[] = readFileSync(
  resolve(__dirname, '..', '..', '..', '.gitignore'),
  'utf8',
).split(/\r?\n/);

describe('Android prebuild dependencies', () => {
  it('declares the Expo-compatible splash screen module required by MainActivity', () => {
    expect(androidPackageJson.dependencies['expo-splash-screen']).toBe(
      expoNativeModules['expo-splash-screen'],
    );
  });

  it('includes the splash screen module in the locked production dependencies', () => {
    expect(androidPackageLock.packages[''].dependencies['expo-splash-screen']).toBe(
      androidPackageJson.dependencies['expo-splash-screen'],
    );
    expect(androidPackageLock.packages['node_modules/expo-splash-screen'].dev).not.toBe(true);
    expect(androidPackageLock.packages['node_modules/expo-splash-screen'].version).toBe(
      installedSplashScreen.version,
    );
  });

  it.each(['android', 'ios'])(
    'excludes the generated %s directory itself from the repository-root EAS upload',
    (platform) => {
      expect(rootIgnoreRules).toContain(`apps/mobile/${platform}`);
    },
  );
});
