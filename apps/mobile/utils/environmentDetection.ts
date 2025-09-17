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
           !Constants.isDevice; // False on simulators, true on physical devices
  }
  
  /**
   * Detects if running in development mode
   * @returns true if in development environment
   */
  static isDevelopment(): boolean {
    return __DEV__;
  }
  
  /**
   * Determines if mock voice service should be used
   * Very specific conditions to prevent accidental usage in production
   * @returns true only for iOS simulator in development mode
   */
  static shouldUseMockVoice(): boolean {
    // Temporarily allow web testing in development
    const isWebDev = __DEV__ && Platform.OS === 'web';
    const isSimulator = EnvironmentDetection.isSimulator();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Debug logging to help troubleshoot
    console.log('🔍 [DEBUG] Environment Detection:', {
      __DEV__,
      platform: Platform.OS,
      isDevice: Constants.isDevice,
      isWebDev,
      isSimulator,
      isProduction,
      nodeEnv: process.env.NODE_ENV
    });
    
    const result = (isSimulator || isWebDev) && !isProduction;
    console.log('🔍 [DEBUG] shouldUseMockVoice result:', result);
    
    return result;
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