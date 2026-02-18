import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import { getApiBaseUrl, getAppKey } from '../config/apiConfig';

// Storage keys
const SESSION_ID_KEY = '@telemetry_session_id';
const DEVICE_ID_KEY = '@telemetry_device_id';
const FIRST_OPEN_KEY = '@telemetry_first_open';
const LAST_ACTIVE_KEY = '@telemetry_last_active';
const EVENT_QUEUE_KEY = '@telemetry_event_queue';

// Flush configuration
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_QUEUE_SIZE = 50;

/**
 * Telemetry event payload sent to the API
 */
export interface TelemetryEvent {
  eventName: string;
  properties?: Record<string, string>;
  metrics?: Record<string, number>;
  timestamp: string;
  sessionId: string;
  deviceId: string;
  platform: string;
}

/**
 * Standard event names for consistent tracking across the app.
 *
 * Naming convention: <Category>.<Action>
 *   Category = Screen | Feature | Chat | Search | Voice | Session | Error
 *   Action   = Viewed | Tapped | Sent | Started | Completed | ...
 */
export const AnalyticsEvents = {
  // ── Impressions (screen views) ───────────────────────────────
  SCREEN_VIEWED: 'Screen.Viewed',

  // ── Session / Retention ──────────────────────────────────────
  SESSION_STARTED: 'Session.Started',
  APP_OPENED: 'App.Opened',
  APP_FIRST_OPEN: 'App.FirstOpen',
  APP_RETURNED_D1: 'App.Returned.D1',
  APP_RETURNED_D7: 'App.Returned.D7',

  // ── Feature usage (Landing page taps) ────────────────────────
  FEATURE_TAPPED: 'Feature.Tapped',

  // ── Chat / Conversion ────────────────────────────────────────
  CHAT_MESSAGE_SENT: 'Chat.Message.Sent',
  CHAT_VOICE_STARTED: 'Chat.Voice.Started',
  CHAT_VOICE_SUBMITTED: 'Chat.Voice.Submitted',
  CHAT_NEW_THREAD: 'Chat.NewThread',
  CHAT_CONTEXT_RECEIVED: 'Chat.Context.Received',

  // ── Game Search / Conversion ─────────────────────────────────
  SEARCH_QUERY_SUBMITTED: 'Search.Query.Submitted',
  SEARCH_RESULT_TAPPED: 'Search.Result.Tapped',
  SEARCH_DETAILS_VIEWED: 'Search.Details.Viewed',
  SEARCH_RULES_OPENED: 'Search.Rules.Opened',
  SEARCH_ASK_UNCLE_TAPPED: 'Search.AskUncle.Tapped',

  // ── Errors ───────────────────────────────────────────────────
  ERROR_API: 'Error.Api',
  ERROR_VOICE: 'Error.Voice',
  ERROR_SEARCH: 'Error.Search',
} as const;

// --- Internal state ---

let _sessionId: string | null = null;
let _deviceId: string | null = null;
let _eventQueue: TelemetryEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _initialized = false;

/**
 * Generate a UUID v4 string (no external dependency needed).
 */
const generateId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

/**
 * Returns the number of calendar days between two dates (UTC).
 */
const daysBetween = (a: Date, b: Date): number => {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.floor((utcB - utcA) / msPerDay));
};

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialise telemetry. Call once at app startup (e.g. in App.tsx).
 * - Creates or restores deviceId (persistent across installs → AsyncStorage)
 * - Creates a new sessionId every cold start
 * - Fires App.Opened, App.FirstOpen, and retention events as appropriate
 * - Starts the background flush timer
 */
export const initTelemetry = async (): Promise<void> => {
  if (_initialized) return;
  _initialized = true;

  try {
    // --- Device ID (persistent) ---
    let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!storedDeviceId) {
      storedDeviceId = generateId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
    }
    _deviceId = storedDeviceId;

    // --- Session ID (per cold start) ---
    _sessionId = generateId();
    await AsyncStorage.setItem(SESSION_ID_KEY, _sessionId);

    // --- Restore queued events from last session (if any) ---
    const storedQueue = await AsyncStorage.getItem(EVENT_QUEUE_KEY);
    if (storedQueue) {
      try {
        _eventQueue = JSON.parse(storedQueue);
      } catch {
        _eventQueue = [];
      }
    }

    // --- First open ---
    const firstOpen = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    const now = new Date();
    if (!firstOpen) {
      await AsyncStorage.setItem(FIRST_OPEN_KEY, now.toISOString());
      trackEvent(AnalyticsEvents.APP_FIRST_OPEN);
    }

    // --- Retention ---
    const lastActive = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (lastActive) {
      const lastDate = new Date(lastActive);
      const gap = daysBetween(lastDate, now);
      if (gap === 1) {
        trackEvent(AnalyticsEvents.APP_RETURNED_D1);
      }
      if (gap === 7) {
        trackEvent(AnalyticsEvents.APP_RETURNED_D7);
      }
    }
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, now.toISOString());

    // --- Session started ---
    trackEvent(AnalyticsEvents.SESSION_STARTED);
    trackEvent(AnalyticsEvents.APP_OPENED);

    // --- Start flush timer ---
    _flushTimer = setInterval(flushEvents, FLUSH_INTERVAL_MS);
  } catch (error) {
    console.warn('[Telemetry] init failed', error);
  }
};

/**
 * Track a custom event. Queues the event and flushes when the queue is full.
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, string>,
  metrics?: Record<string, number>,
): void => {
  const event: TelemetryEvent = {
    eventName,
    properties,
    metrics,
    timestamp: new Date().toISOString(),
    sessionId: _sessionId ?? 'unknown',
    deviceId: _deviceId ?? 'unknown',
    platform: Platform.OS,
  };

  if (__DEV__) {
    console.log('[Telemetry]', eventName, properties, metrics);
  }

  _eventQueue.push(event);

  // Persist queue to survive crashes
  persistQueue();

  if (_eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  }
};

/**
 * Track a screen view (impression). Convenience wrapper around trackEvent.
 */
export const trackScreenView = (screenName: string, extraProps?: Record<string, string>): void => {
  trackEvent(AnalyticsEvents.SCREEN_VIEWED, { screenName, ...extraProps });
};

/**
 * Flush queued events to the API. Called automatically on timer / queue full.
 * Can also be called manually (e.g. on app background).
 */
export const flushEvents = async (): Promise<void> => {
  if (_eventQueue.length === 0) return;

  const batch = [..._eventQueue];
  _eventQueue = [];

  try {
    const baseUrl = getApiBaseUrl();
    await axios.post(`${baseUrl}Telemetry/events`, { events: batch }, {
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-GamerUncle-AppKey': getAppKey(),
      },
    });
    // Queue was sent – clear the persisted copy
    await AsyncStorage.removeItem(EVENT_QUEUE_KEY);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Telemetry] flush failed – re-queuing', error);
    }
    // Put events back and persist for next attempt
    _eventQueue = [...batch, ..._eventQueue];
    persistQueue();
  }
};

/**
 * Shutdown telemetry: flush remaining events and stop the timer.
 */
export const shutdownTelemetry = async (): Promise<void> => {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  await flushEvents();
  _initialized = false;
};

// ── Internal helpers ────────────────────────────────────────────

const persistQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(_eventQueue));
  } catch {
    // best-effort
  }
};

// ── Test helpers ────────────────────────────────────────────────

/**
 * Reset internal state for unit tests.
 */
export const _resetForTesting = (): void => {
  _sessionId = null;
  _deviceId = null;
  _eventQueue = [];
  _initialized = false;
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
};

/**
 * Get the current event queue for assertions in tests.
 */
export const _getQueueForTesting = (): TelemetryEvent[] => [..._eventQueue];