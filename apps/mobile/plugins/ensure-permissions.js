// Custom config plugin to ensure microphone & camera usage descriptions are always injected.
// This provides a hard safety net so the App Store rejection for missing NSCameraUsageDescription cannot recur
// due to caching or plugin ordering.

const { withInfoPlist } = require('@expo/config-plugins');

const CAMERA_KEY = 'NSCameraUsageDescription';
const MICROPHONE_KEY = 'NSMicrophoneUsageDescription';

const cameraMessage = 'This app includes WebRTC capabilities for future video features. Currently, only voice chat is enabled.';
const micMessage = 'This app uses the microphone for voice chat functionality to enhance your gaming experience.';

function ensurePermissions(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults || {};

    if (!plist[CAMERA_KEY] || typeof plist[CAMERA_KEY] !== 'string' || plist[CAMERA_KEY].trim().length === 0) {
      plist[CAMERA_KEY] = cameraMessage;
    }
    if (!plist[MICROPHONE_KEY] || typeof plist[MICROPHONE_KEY] !== 'string' || plist[MICROPHONE_KEY].trim().length === 0) {
      plist[MICROPHONE_KEY] = micMessage;
    }

    // Ensure background audio is preserved
    if (Array.isArray(plist.UIBackgroundModes)) {
      if (!plist.UIBackgroundModes.includes('audio')) {
        plist.UIBackgroundModes.push('audio');
      }
    } else {
      plist.UIBackgroundModes = ['audio'];
    }

    return config;
  });
}

module.exports = ensurePermissions;
