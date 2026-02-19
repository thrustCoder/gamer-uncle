import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  initTelemetry,
  trackEvent,
  trackScreenView,
  flushEvents,
  shutdownTelemetry,
  AnalyticsEvents,
  _resetForTesting,
  _getQueueForTesting,
} from '../services/Telemetry';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ status: 202 }),
}));

// Mock apiConfig
jest.mock('../config/apiConfig', () => ({
  getApiBaseUrl: () => 'https://test-api.example.com/api/',
  getAppKey: () => 'test-app-key-123',
}));

describe('Telemetry Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    _resetForTesting();
    await AsyncStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await shutdownTelemetry();
    jest.useRealTimers();
  });

  describe('initTelemetry', () => {
    it('should create a persistent deviceId on first init', async () => {
      await initTelemetry();

      const storedDeviceId = await AsyncStorage.getItem('@telemetry_device_id');
      expect(storedDeviceId).toBeTruthy();
      expect(storedDeviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should reuse existing deviceId on subsequent inits', async () => {
      const existingId = 'persistent-device-id-123';
      await AsyncStorage.setItem('@telemetry_device_id', existingId);

      await initTelemetry();

      const storedDeviceId = await AsyncStorage.getItem('@telemetry_device_id');
      expect(storedDeviceId).toBe(existingId);
    });

    it('should create a new sessionId each cold start', async () => {
      await initTelemetry();
      const session1 = await AsyncStorage.getItem('@telemetry_session_id');

      _resetForTesting();

      await initTelemetry();
      const session2 = await AsyncStorage.getItem('@telemetry_session_id');

      expect(session1).toBeTruthy();
      expect(session2).toBeTruthy();
      expect(session1).not.toBe(session2);
    });

    it('should fire App.FirstOpen only on first init', async () => {
      await initTelemetry();
      const queue = _getQueueForTesting();

      const firstOpenEvents = queue.filter(e => e.eventName === AnalyticsEvents.APP_FIRST_OPEN);
      expect(firstOpenEvents.length).toBe(1);
    });

    it('should not fire App.FirstOpen on subsequent inits', async () => {
      await AsyncStorage.setItem('@telemetry_first_open', new Date().toISOString());

      await initTelemetry();
      const queue = _getQueueForTesting();

      const firstOpenEvents = queue.filter(e => e.eventName === AnalyticsEvents.APP_FIRST_OPEN);
      expect(firstOpenEvents.length).toBe(0);
    });

    it('should fire Session.Started and App.Opened on every init', async () => {
      await initTelemetry();
      const queue = _getQueueForTesting();

      expect(queue.some(e => e.eventName === AnalyticsEvents.SESSION_STARTED)).toBe(true);
      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_OPENED)).toBe(true);
    });

    it('should be idempotent (second call is no-op)', async () => {
      await initTelemetry();
      const queueSize1 = _getQueueForTesting().length;

      await initTelemetry();
      const queueSize2 = _getQueueForTesting().length;

      expect(queueSize2).toBe(queueSize1);
    });
  });

  describe('retention tracking', () => {
    it('should fire App.Returned.D1 when last active was yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await AsyncStorage.setItem('@telemetry_last_active', yesterday.toISOString());

      await initTelemetry();
      const queue = _getQueueForTesting();

      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_RETURNED_D1)).toBe(true);
      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_RETURNED_D7)).toBe(false);
    });

    it('should fire App.Returned.D7 when last active was 7 days ago', async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      await AsyncStorage.setItem('@telemetry_last_active', weekAgo.toISOString());

      await initTelemetry();
      const queue = _getQueueForTesting();

      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_RETURNED_D7)).toBe(true);
    });

    it('should not fire retention events when same day', async () => {
      await AsyncStorage.setItem('@telemetry_last_active', new Date().toISOString());

      await initTelemetry();
      const queue = _getQueueForTesting();

      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_RETURNED_D1)).toBe(false);
      expect(queue.some(e => e.eventName === AnalyticsEvents.APP_RETURNED_D7)).toBe(false);
    });
  });

  describe('trackEvent', () => {
    it('should queue an event with standard fields', async () => {
      await initTelemetry();
      trackEvent('Test.Event', { key: 'value' }, { count: 42 });

      const queue = _getQueueForTesting();
      const testEvent = queue.find(e => e.eventName === 'Test.Event');

      expect(testEvent).toBeDefined();
      expect(testEvent!.properties).toEqual({ key: 'value' });
      expect(testEvent!.metrics).toEqual({ count: 42 });
      expect(testEvent!.sessionId).toBeTruthy();
      expect(testEvent!.deviceId).toBeTruthy();
      expect(testEvent!.platform).toBeTruthy();
      expect(testEvent!.timestamp).toBeTruthy();
      expect(testEvent!.appVersion).toBeTruthy();
    });

    it('should persist queue to AsyncStorage', async () => {
      // Use real timers for this test since persistQueue uses async/await
      jest.useRealTimers();

      await initTelemetry();
      trackEvent('Persist.Test');

      // Allow async storage write to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      const stored = await AsyncStorage.getItem('@telemetry_event_queue');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.some((e: any) => e.eventName === 'Persist.Test')).toBe(true);

      // Restore fake timers for remaining tests
      jest.useFakeTimers();
    });
  });

  describe('trackScreenView', () => {
    it('should queue Screen.Viewed with screenName property', async () => {
      await initTelemetry();
      trackScreenView('Landing', { source: 'deep-link' });

      const queue = _getQueueForTesting();
      const screenEvent = queue.find(e => e.eventName === AnalyticsEvents.SCREEN_VIEWED);

      expect(screenEvent).toBeDefined();
      expect(screenEvent!.properties).toEqual({
        screenName: 'Landing',
        source: 'deep-link',
      });
    });
  });

  describe('flushEvents', () => {
    it('should POST queued events to the API', async () => {
      await initTelemetry();
      trackEvent('Flush.Test');

      await flushEvents();

      expect(axios.post).toHaveBeenCalledWith(
        'https://test-api.example.com/api/Telemetry/events',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ eventName: 'Flush.Test' }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should send X-GamerUncle-AppKey header in flush request', async () => {
      await initTelemetry();
      trackEvent('Auth.Test');

      await flushEvents();

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-GamerUncle-AppKey': 'test-app-key-123',
          }),
        }),
      );
    });

    it('should clear the queue after successful flush', async () => {
      await initTelemetry();
      trackEvent('Clear.After.Flush');

      await flushEvents();

      const queue = _getQueueForTesting();
      expect(queue.length).toBe(0);
    });

    it('should re-queue events on flush failure', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await initTelemetry();
      const preFlushed = _getQueueForTesting().length;

      trackEvent('Retry.Event');
      await flushEvents();

      const queue = _getQueueForTesting();
      // Should still contain all events (pre-existing + the new one)
      expect(queue.length).toBeGreaterThanOrEqual(preFlushed + 1);
    });

    it('should not POST when queue is empty', async () => {
      await initTelemetry();
      // Flush the init events first
      await flushEvents();
      jest.clearAllMocks();

      // Now flush again with empty queue
      await flushEvents();
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('AnalyticsEvents constants', () => {
    it('should follow Category.Action naming convention', () => {
      const values = Object.values(AnalyticsEvents);
      for (const name of values) {
        expect(name).toMatch(/^[A-Z][a-zA-Z]+\.[A-Z][a-zA-Z]+(\.[A-Z][a-zA-Z0-9]+)?$/);
      }
    });

    it('should have unique event names', () => {
      const values = Object.values(AnalyticsEvents);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('should include rating prompt events', () => {
      expect(AnalyticsEvents.RATING_PROMPT_SHOWN).toBe('Rating.Prompt.Shown');
      expect(AnalyticsEvents.RATING_PROMPT_RATED).toBe('Rating.Prompt.Rated');
      expect(AnalyticsEvents.RATING_PROMPT_DISMISSED).toBe('Rating.Prompt.Dismissed');
    });

    it('should include upgrade funnel events', () => {
      expect(AnalyticsEvents.UPGRADE_PROMPTED).toBe('Upgrade.Prompted');
      expect(AnalyticsEvents.UPGRADE_ACCEPTED).toBe('Upgrade.Accepted');
      expect(AnalyticsEvents.UPGRADE_DISMISSED).toBe('Upgrade.Dismissed');
    });
  });
});
