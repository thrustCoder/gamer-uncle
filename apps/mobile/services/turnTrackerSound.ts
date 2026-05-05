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

const loadSound = async (): Promise<Audio.Sound> => {
  if (cachedSound) return cachedSound;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
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
  if (s) {
    try {
      await s.unloadAsync();
    } catch {
      // ignore
    }
  }
};
