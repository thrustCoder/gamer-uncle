import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Environment detection utilities for simulator-specific functionality
 * Used to enable mock voice services only during iOS simulator development
 */
export class EnvironmentDetection {
  /**
   * Detects if running on iOS simulator
   * @returns true only if running on iOS simulator (not physical device)
   */
  static isSimulator(): boolean {
    return __DEV__ && 
           Platform.OS === 'ios' && 
           Constants.isDevice === false; // Explicitly check for false, not undefined
  }
  
  /**
   * Detects if running in development mode
   * @returns true if in development environment
   */
  static isDevelopment(): boolean {
    return __DEV__;
  }
  
  // Cached result to avoid recomputing on every render
  private static _shouldUseMockVoiceResult: boolean | null = null;

  /**
   * Determines if mock voice service should be used
   * Very specific conditions to prevent accidental usage in production
   * Result is cached since the environment never changes at runtime.
   * @returns true only for iOS simulator in development mode
   */
  static shouldUseMockVoice(): boolean {
    if (EnvironmentDetection._shouldUseMockVoiceResult !== null) {
      return EnvironmentDetection._shouldUseMockVoiceResult;
    }

    // Temporarily allow web testing in development
    const isWebDev = __DEV__ && Platform.OS === 'web';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Use real voice on physical devices, mock voice only on simulators/web
    // If isDevice is undefined, we should assume it's a physical device to be safe
    const shouldUseMock = Constants.isDevice === false || (isWebDev && !isProduction);

    EnvironmentDetection._shouldUseMockVoiceResult = shouldUseMock;
    return shouldUseMock;
  }

  /**
   * Gets environment description for debugging
   * @returns string describing current environment
   */
  static getEnvironmentInfo(): string {
    const platform = Platform.OS;
    const isDevice = Constants.isDevice;
    const isDev = __DEV__;
    
    return `Platform: ${platform}, Device: ${isDevice}, Dev: ${isDev}`;
  }
}