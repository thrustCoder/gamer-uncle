import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Lightweight test to ensure that after a prebuild, Info.plist contains the camera & microphone keys.
 * This will only run meaningfully in CI/local when the ios directory exists (prebuild executed).
 * If ios project is absent (managed workflow without prebuild), test is skipped.
 */

describe('iOS permissions Info.plist', () => {
  const appRoot = path.join(__dirname, '..');
  const iosDir = path.join(appRoot, 'ios');
  const plistCandidates: string[] = [];
  if (fs.existsSync(iosDir)) {
    const walker = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walker(full);
        else if (entry === 'Info.plist') plistCandidates.push(full);
      }
    };
    walker(iosDir);
  }

  const infoPlist = plistCandidates.find(p => /Info\.plist$/.test(p));

  const runPlistBuddy = (key: string): string | null => {
    if (!infoPlist) return null;
    try {
      return execSync(`/usr/libexec/PlistBuddy -c "Print :${key}" "${infoPlist}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return null;
    }
  };

  const requiredKeys = ['NSMicrophoneUsageDescription', 'NSCameraUsageDescription'];

  test('skip if no ios project', () => {
    if (!infoPlist) {
      console.warn('No prebuilt ios project found, skipping permission assertions. Run: npx expo prebuild --platform ios');
    }
    expect(true).toBe(true);
  });

  for (const key of requiredKeys) {
    test(`${key} present when ios project exists`, () => {
      if (!infoPlist) return; // skip
      const value = runPlistBuddy(key);
      expect(value && value.length > 0).toBe(true);
    });
  }
});
