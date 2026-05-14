import { Audio } from 'expo-av';

/**
 * Plays the short "tick" sound used to acknowledge a turn move in Turn Tracker.
 *
 * Behaviour:
 *  - Lazily loads `assets/sounds/tick.mp3` on first call and caches the `Sound`.
 *  - Calls `replayAsync()` for subsequent plays (cheaper than re-creating).
 *  - Auto-stops playback after `MAX_TICK_MS` so a single tap can't bleed into
 *    the next one (the asset itself is longer than a tap should sound).
 *  - Silently swallows errors so audio failures never disrupt gameplay.
 *  - Independent of the Timer's bell sound; uses its own cached instance.
 */

/**
 * Maximum playback length per tap, in milliseconds. Tuned to feel like a quick
 * acknowledgement that ends right around when the marker rotation finishes
 * (~320 ms). Keep this short so back-to-back taps don't sound smeared.
 */
const MAX_TICK_MS = 220;

let cachedSound: Audio.Sound | null = null;
let loadingPromise: Promise<Audio.Sound> | null = null;
/** Pending stop timer for the in-flight tick. Cleared on each new tap. */
let stopTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Tracks whether we've already configured the iOS audio session for
 * silent-mode playback. Without `playsInSilentModeIOS: true`, the tick is
 * inaudible whenever the user has flipped their iPhone's silent switch — the
 * default audio session honours the hardware mute.
 */
let audioModeConfigured = false;

const ensureAudioMode = async (): Promise<void> => {
  if (audioModeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      // Only enable the bits we actually need. Setting `allowsRecordingIOS:
      // false` here is important so we don't accidentally route audio through
      // the earpiece if the voice service was previously recording.
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    audioModeConfigured = true;
  } catch {
    // Best-effort — if configuring the session fails we still try to play.
  }
};

const loadSound = async (): Promise<Audio.Sound> => {
  if (cachedSound) return cachedSound;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/tick.mp3'),
      { volume: 0.6 }
    );
    cachedSound = sound;
    loadingPromise = null;
    return sound;
  })();

  return loadingPromise;
};

const cancelPendingStop = () => {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
};

export const playTurnTickSound = async (): Promise<void> => {
  try {
    const sound = await loadSound();
    // Cancel any previous auto-stop that hasn't fired yet, then restart from
    // the beginning so rapid taps each get their own short tick.
    cancelPendingStop();
    await sound.replayAsync();
    stopTimer = setTimeout(() => {
      stopTimer = null;
      // stopAsync resets the playhead to 0 so the next replayAsync starts cleanly.
      sound.stopAsync().catch(() => {
        // ignore — best-effort
      });
    }, MAX_TICK_MS);
  } catch {
    // Audio failures should never disrupt gameplay.
  }
};

/**
 * Releases the cached sound. Optional — useful in tests or if the host wants
 * to free audio resources. The next `playTurnTickSound()` call will reload.
 */
export const unloadTurnTickSound = async (): Promise<void> => {
  cancelPendingStop();
  const s = cachedSound;
  cachedSound = null;
  loadingPromise = null;
  // Reset the audio-session flag so the next play re-applies the mode. This
  // also keeps test isolation clean — each test that calls unload starts
  // from a known state.
  audioModeConfigured = false;
  if (s) {
    try {
      await s.unloadAsync();
    } catch {
      // ignore
    }
  }
};
