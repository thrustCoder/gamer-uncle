import { isVoiceFeatureEnabled } from '../utils/voiceFeatureFlag';

describe('isVoiceFeatureEnabled', () => {
  const originalOS = require('react-native').Platform.OS;

  afterEach(() => {
    require('react-native').Platform.OS = originalOS;
  });

  it('returns true on iOS (voice shipped in v1)', () => {
    require('react-native').Platform.OS = 'ios';
    expect(isVoiceFeatureEnabled()).toBe(true);
  });

  it('returns false on Android (voice deferred to v1.1)', () => {
    require('react-native').Platform.OS = 'android';
    expect(isVoiceFeatureEnabled()).toBe(false);
  });

  it('returns false on web', () => {
    require('react-native').Platform.OS = 'web';
    expect(isVoiceFeatureEnabled()).toBe(false);
  });
});
