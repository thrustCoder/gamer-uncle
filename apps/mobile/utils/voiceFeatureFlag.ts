import { Platform } from 'react-native';

/**
 * Voice / WebRTC feature gate.
 *
 * Voice is shipped on iOS only for v1 of the Android release (see
 * `.github/specs/android/android_implementation_plan.spec.md` §4.3).
 *
 * To re-enable voice on Android in v1.1:
 *   1. Restore `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` in `app.json`
 *      under `android.permissions`.
 *   2. Update this helper to return `true` for Android (or remove the
 *      Platform branch entirely).
 *   3. Validate on a physical Android device (emulators lack mics).
 */
export const isVoiceFeatureEnabled = (): boolean => Platform.OS === 'ios';
