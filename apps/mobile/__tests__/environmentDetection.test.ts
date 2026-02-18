import { EnvironmentDetection } from '../utils/environmentDetection';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Save originals so we can restore after each test
const originalIsDevice = Constants.isDevice;

beforeEach(() => {
  // Reset the cached result between tests
  (EnvironmentDetection as any)._shouldUseMockVoiceResult = null;
});

afterEach(() => {
  // Restore originals
  (Constants as any).isDevice = originalIsDevice;
  (EnvironmentDetection as any)._shouldUseMockVoiceResult = null;
});

describe('EnvironmentDetection', () => {
  describe('shouldUseMockVoice', () => {
    it('should return a boolean value', () => {
      const result = EnvironmentDetection.shouldUseMockVoice();
      expect(typeof result).toBe('boolean');
    });

    it('should cache the result on subsequent calls', () => {
      const first = EnvironmentDetection.shouldUseMockVoice();
      const second = EnvironmentDetection.shouldUseMockVoice();
      expect(first).toBe(second);
    });

    it('should return cached result without recomputing', () => {
      // Call once to populate cache
      EnvironmentDetection.shouldUseMockVoice();

      // Change the underlying value — should still return cached
      const cached = (EnvironmentDetection as any)._shouldUseMockVoiceResult;
      expect(cached).not.toBeNull();

      // A second call should return the same cached value
      const result = EnvironmentDetection.shouldUseMockVoice();
      expect(result).toBe(cached);
    });

    it('should not produce console.log output', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      EnvironmentDetection.shouldUseMockVoice();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('isSimulator', () => {
    it('should return a boolean value', () => {
      const result = EnvironmentDetection.isSimulator();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isDevelopment', () => {
    it('should return a boolean value', () => {
      const result = EnvironmentDetection.isDevelopment();
      expect(typeof result).toBe('boolean');
    });

    it('should return true in test environment (__DEV__ is true)', () => {
      // Jest sets __DEV__ = true by default
      expect(EnvironmentDetection.isDevelopment()).toBe(true);
    });
  });

  describe('getEnvironmentInfo', () => {
    it('should return a descriptive string', () => {
      const info = EnvironmentDetection.getEnvironmentInfo();
      expect(typeof info).toBe('string');
      expect(info).toContain('Platform:');
      expect(info).toContain('Device:');
      expect(info).toContain('Dev:');
    });
  });
});
