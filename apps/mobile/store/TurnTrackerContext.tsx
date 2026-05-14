import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appCache } from '../services/storage/appCache';
import type { TurnDirection, TurnTrackerSession } from '../types/turnTracker';
import { usePlayerGroups } from './PlayerGroupsContext';

interface TurnTrackerContextType {
  /** Current session, or null when no game is in progress for the active source. */
  session: TurnTrackerSession | null;

  /** True until the initial hydration completes for the current source. */
  isLoading: boolean;

  /** Index of the seat (within `session.seatOrder`) holding the current turn. null when no game. */
  activeSeatIndex: number | null;

  /** Index of the upcoming seat based on the current direction. null when no game. */
  nextSeatIndex: number | null;

  /** Index of the preceding seat based on the current direction. null when no game. */
  prevSeatIndex: number | null;

  /** Player index (into the active player list) of the current player. null when no game. */
  activePlayerIndex: number | null;

  /** Player index of the next player. null when no game. */
  nextPlayerIndex: number | null;

  /** Player index of the previous player. null when no game. */
  prevPlayerIndex: number | null;

  // Lifecycle
  beginGame: (seatOrder: number[], direction: TurnDirection) => void;
  endGame: () => TurnTrackerSession | null;

  // Turn manipulation
  advanceTurn: () => void;
  retractTurn: () => void;
  setDirection: (dir: TurnDirection) => void;
}

const TurnTrackerContext = createContext<TurnTrackerContextType | undefined>(undefined);

const stepFor = (dir: TurnDirection): number => (dir === 'cw' ? 1 : -1);

const sourceKeyFor = (enabled: boolean, activeGroupId: string | null): string =>
  enabled ? `group:${activeGroupId ?? 'none'}` : 'appCache';

export const TurnTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state: groupsState,
    isLoading: groupsLoading,
    activeGroup,
    updateActiveGroupData,
  } = usePlayerGroups();

  const [session, setSession] = useState<TurnTrackerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Tracks which source key the current `session` was hydrated from. */
  const hydratedKeyRef = useRef<string | null>(null);

  /**
   * The session value most recently written to (or read from) the persistence
   * source. Used to short-circuit the persistence effect when the source already
   * holds the current session — prevents the hydration ↔ persistence ping-pong
   * that triggers when a different screen mutates the active group via
   * `updateActiveGroupData(...)` (which changes `activeGroup`'s object identity).
   */
  const lastSyncedSessionRef = useRef<TurnTrackerSession | null>(null);

  /**
   * Mirror of `session` kept in a ref so callbacks (e.g. `endGame`) can read
   * the latest value synchronously without depending on closure scope.
   */
  const sessionRef = useRef<TurnTrackerSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /**
   * Refs for `activeGroup`, `groupsState`, and `updateActiveGroupData` so the
   * hydration / persistence effects can read the latest values WITHOUT taking
   * a dependency on their object identities. PlayerGroupsContext recreates
   * `activeGroup` and other refs on every state mutation; depending on them
   * directly causes feedback loops (Maximum update depth exceeded).
   */
  const activeGroupRef = useRef(activeGroup);
  const groupsStateRef = useRef(groupsState);
  const updateActiveGroupDataRef = useRef(updateActiveGroupData);
  useEffect(() => {
    activeGroupRef.current = activeGroup;
    groupsStateRef.current = groupsState;
    updateActiveGroupDataRef.current = updateActiveGroupData;
  });

  const sourceKey = sourceKeyFor(groupsState.enabled, groupsState.activeGroupId);

  // ── Hydration ──────────────────────────────────────────────
  // Re-hydrate ONLY when the source identity changes:
  //   - groups feature toggled on/off
  //   - active group switched
  //   - initial mount (after PlayerGroupsContext finishes loading)
  // We deliberately do NOT depend on `activeGroup` (object ref). Within a
  // single source, the only writer to the group's `turnTracker` field is this
  // context itself, so re-hydrating on every group object change would be both
  // wasteful AND cause an infinite loop with the persistence effect below.
  useEffect(() => {
    if (groupsLoading) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      let next: TurnTrackerSession | null = null;
      let currentPC = 0;

      if (groupsStateRef.current.enabled) {
        next = activeGroupRef.current?.turnTracker ?? null;
        currentPC = activeGroupRef.current?.playerCount ?? 0;
      } else {
        next = await appCache.getTurnTracker();
        currentPC = await appCache.getPlayerCount(0);
      }

      // Sanity: discard sessions whose snapshot doesn't match current player count.
      if (next && next.playerCountAtStart !== currentPC) {
        next = null;
      }

      if (cancelled) return;
      hydratedKeyRef.current = sourceKey;
      // Mark this value as already in sync with the source so the persistence
      // effect doesn't immediately write it back (which would create churn).
      lastSyncedSessionRef.current = next;
      setSession(next);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [groupsLoading, sourceKey]);

  // ── Persistence ────────────────────────────────────────────
  // When `session` changes via internal user actions (advance/retract/etc.),
  // write back to the active source. Skipped if the source already holds the
  // same value (e.g. immediately after hydration).
  useEffect(() => {
    if (isLoading) return;
    if (hydratedKeyRef.current !== sourceKey) return;
    if (lastSyncedSessionRef.current === session) return;

    lastSyncedSessionRef.current = session;

    if (groupsStateRef.current.enabled) {
      updateActiveGroupDataRef.current({ turnTracker: session });
    } else {
      // Fire-and-forget; appCache is async but UI doesn't need to await.
      appCache.setTurnTracker(session);
    }
  }, [session, isLoading, sourceKey]);

  // ── Lifecycle ──────────────────────────────────────────────
  const beginGame = useCallback((seatOrder: number[], direction: TurnDirection) => {
    if (seatOrder.length < 2) {
      throw new Error('beginGame requires at least 2 seats');
    }
    setSession({
      seatOrder: [...seatOrder],
      activeSeatIndex: 0,
      direction,
      startedAt: Date.now(),
      playerCountAtStart: seatOrder.length,
      totalAdvances: 0,
      totalRetracts: 0,
    });
  }, []);

  /**
   * Clears the in-progress session and returns the session that was ended
   * (so the caller can fire telemetry with totalAdvances / totalRetracts /
   * duration before the data is gone).
   */
  const endGame = useCallback((): TurnTrackerSession | null => {
    const ended = sessionRef.current;
    setSession(null);
    return ended;
  }, []);

  // ── Turn manipulation ──────────────────────────────────────
  const advanceTurn = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const n = prev.seatOrder.length;
      const step = stepFor(prev.direction);
      return {
        ...prev,
        activeSeatIndex: (prev.activeSeatIndex + step + n) % n,
        totalAdvances: prev.totalAdvances + 1,
      };
    });
  }, []);

  const retractTurn = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const n = prev.seatOrder.length;
      const step = stepFor(prev.direction);
      return {
        ...prev,
        activeSeatIndex: (prev.activeSeatIndex - step + n) % n,
        totalRetracts: prev.totalRetracts + 1,
      };
    });
  }, []);

  const setDirection = useCallback((dir: TurnDirection) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (prev.direction === dir) return prev;
      return { ...prev, direction: dir };
    });
  }, []);

  // ── Derived helpers ────────────────────────────────────────
  const derived = useMemo(() => {
    if (!session) {
      return {
        activeSeatIndex: null as number | null,
        nextSeatIndex: null as number | null,
        prevSeatIndex: null as number | null,
        activePlayerIndex: null as number | null,
        nextPlayerIndex: null as number | null,
        prevPlayerIndex: null as number | null,
      };
    }
    const n = session.seatOrder.length;
    const step = stepFor(session.direction);
    const active = session.activeSeatIndex;
    const next = (active + step + n) % n;
    const prev = (active - step + n) % n;
    return {
      activeSeatIndex: active,
      nextSeatIndex: next,
      prevSeatIndex: prev,
      activePlayerIndex: session.seatOrder[active] ?? null,
      nextPlayerIndex: session.seatOrder[next] ?? null,
      prevPlayerIndex: session.seatOrder[prev] ?? null,
    };
  }, [session]);

  const value = useMemo<TurnTrackerContextType>(
    () => ({
      session,
      isLoading,
      ...derived,
      beginGame,
      endGame,
      advanceTurn,
      retractTurn,
      setDirection,
    }),
    [session, isLoading, derived, beginGame, endGame, advanceTurn, retractTurn, setDirection]
  );

  return <TurnTrackerContext.Provider value={value}>{children}</TurnTrackerContext.Provider>;
};

export const useTurnTracker = (): TurnTrackerContextType => {
  const ctx = useContext(TurnTrackerContext);
  if (!ctx) {
    throw new Error('useTurnTracker must be used within TurnTrackerProvider');
  }
  return ctx;
};
