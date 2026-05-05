import { Audio } from 'expo-av';
import { playTurnTickSound, unloadTurnTickSound } from '../services/turnTrackerSound';

const replayAsync = jest.fn(() => Promise.resolve());
const stopAsync = jest.fn(() => Promise.resolve());
const unloadAsync = jest.fn(() => Promise.resolve());
const createAsync = jest.fn(() => Promise.resolve({
  sound: {
    replayAsync,
    stopAsync,
    unloadAsync,
    setOnPlaybackStatusUpdate: jest.fn(),
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: (...args: any[]) => (createAsync as any)(...args),
    },
  },
}));

describe('turnTrackerSound', () => {
  beforeEach(async () => {
    // Tear down any cached sound from previous tests BEFORE clearing mocks so
    // the cleanup doesn't pollute the next test's call counts.
    await unloadTurnTickSound();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lazily loads the sound on first play', async () => {
    await playTurnTickSound();
    expect(createAsync).toHaveBeenCalledTimes(1);
    expect(replayAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached sound on subsequent plays', async () => {
    await playTurnTickSound();
    await playTurnTickSound();
    await playTurnTickSound();
    expect(createAsync).toHaveBeenCalledTimes(1);
    expect(replayAsync).toHaveBeenCalledTimes(3);
  });

  it('does not throw when audio fails to load', async () => {
    createAsync.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(playTurnTickSound()).resolves.toBeUndefined();
  });

  it('does not throw when replay fails', async () => {
    await playTurnTickSound(); // load + first play
    replayAsync.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(playTurnTickSound()).resolves.toBeUndefined();
  });

  it('auto-stops playback shortly after the tap', async () => {
    jest.useFakeTimers();
    await playTurnTickSound();
    expect(stopAsync).not.toHaveBeenCalled();

    // 220 ms is the configured MAX_TICK_MS; advance just past it.
    jest.advanceTimersByTime(250);
    expect(stopAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending stop when a new tap arrives quickly', async () => {
    jest.useFakeTimers();
    await playTurnTickSound();
    // First tap scheduled stop; before it fires, fire another tap.
    jest.advanceTimersByTime(100);
    await playTurnTickSound();
    // Advance a tiny bit more — original timer would have fired by now if it
    // hadn't been cancelled (100 + 130 = 230 > 220 MAX_TICK_MS).
    jest.advanceTimersByTime(130);
    expect(stopAsync).not.toHaveBeenCalled();

    // The second tap's timer fires after another 100 ms (total 200 since 2nd play).
    jest.advanceTimersByTime(100);
    expect(stopAsync).toHaveBeenCalledTimes(1);
  });

  it('unloadTurnTickSound releases the cache so the next play reloads', async () => {
    await playTurnTickSound();
    await unloadTurnTickSound();
    expect(unloadAsync).toHaveBeenCalledTimes(1);

    await playTurnTickSound();
    // createAsync called once before unload + once after = 2
    expect(createAsync).toHaveBeenCalledTimes(2);
  });

  it('Audio module is consumed', () => {
    // Smoke check that the test really wired the mock
    expect(Audio.Sound.createAsync).toBeDefined();
  });
});
