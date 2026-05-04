import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PlayerGroupsProvider } from '../store/PlayerGroupsContext';
import { TurnTrackerProvider, useTurnTracker } from '../store/TurnTrackerContext';
import type { TurnTrackerSession } from '../types/turnTracker';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayerGroupsProvider>
    <TurnTrackerProvider>{children}</TurnTrackerProvider>
  </PlayerGroupsProvider>
);

const flushAsync = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('TurnTrackerContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('Initial state', () => {
    it('starts with no session and exposes null helpers', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(result.current.session).toBeNull();
      expect(result.current.activeSeatIndex).toBeNull();
      expect(result.current.nextSeatIndex).toBeNull();
      expect(result.current.prevSeatIndex).toBeNull();
      expect(result.current.activePlayerIndex).toBeNull();
      expect(result.current.nextPlayerIndex).toBeNull();
      expect(result.current.prevPlayerIndex).toBeNull();
    });

    it('throws when used outside provider', () => {
      const { result } = renderHook(() => {
        try {
          return useTurnTracker();
        } catch (e) {
          return { error: e };
        }
      });
      expect((result.current as any).error).toBeTruthy();
    });
  });

  describe('beginGame', () => {
    it('initialises seatOrder, activeSeatIndex, direction, and counters', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      act(() => {
        result.current.beginGame([2, 0, 3, 1], 'cw');
      });

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.seatOrder).toEqual([2, 0, 3, 1]);
      expect(result.current.session?.activeSeatIndex).toBe(0);
      expect(result.current.session?.direction).toBe('cw');
      expect(result.current.session?.totalAdvances).toBe(0);
      expect(result.current.session?.totalRetracts).toBe(0);
      expect(result.current.session?.playerCountAtStart).toBe(4);
      expect(result.current.activePlayerIndex).toBe(2);
      expect(result.current.nextPlayerIndex).toBe(0);
      expect(result.current.prevPlayerIndex).toBe(1);
    });

    it('throws when fewer than 2 seats are provided', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(() => {
        act(() => {
          result.current.beginGame([0], 'cw');
        });
      }).toThrow();
    });
  });

  describe('advanceTurn', () => {
    it('moves +1 in cw direction', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'cw'));

      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(1);
      expect(result.current.session?.totalAdvances).toBe(1);

      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(2);
    });

    it('moves -1 in ccw direction', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'ccw'));

      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(3); // 0 - 1 mod 4
    });

    it('wraps around modulo N in cw direction', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2], 'cw'));

      act(() => result.current.advanceTurn());
      act(() => result.current.advanceTurn());
      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(0);
      expect(result.current.session?.totalAdvances).toBe(3);
    });

    it('wraps around modulo N in ccw direction', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2], 'ccw'));

      // 0 -> 2 -> 1 -> 0
      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(2);
      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(1);
      act(() => result.current.advanceTurn());
      expect(result.current.session?.activeSeatIndex).toBe(0);
    });
  });

  describe('retractTurn', () => {
    it('moves -1 (cw) and wraps modulo N', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'cw'));

      act(() => result.current.retractTurn());
      expect(result.current.session?.activeSeatIndex).toBe(3);
      expect(result.current.session?.totalRetracts).toBe(1);
    });

    it('inverts direction with ccw', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'ccw'));

      // ccw retract == +1 (going forward in seat indices)
      act(() => result.current.retractTurn());
      expect(result.current.session?.activeSeatIndex).toBe(1);
    });
  });

  describe('setDirection', () => {
    it('does not move active seat when direction flips', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'cw'));
      act(() => result.current.advanceTurn()); // active = 1

      act(() => result.current.setDirection('ccw'));
      expect(result.current.session?.activeSeatIndex).toBe(1);
      expect(result.current.session?.direction).toBe('ccw');
      // After flip, next/prev swap
      expect(result.current.nextSeatIndex).toBe(0);
      expect(result.current.prevSeatIndex).toBe(2);
    });

    it('is a no-op when same direction is set', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3], 'cw'));
      const before = result.current.session;

      act(() => result.current.setDirection('cw'));
      expect(result.current.session).toBe(before); // identity preserved
    });
  });

  describe('endGame', () => {
    it('clears session and returns the ended session', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      act(() => result.current.beginGame([0, 1, 2], 'cw'));
      act(() => result.current.advanceTurn());
      act(() => result.current.advanceTurn());
      act(() => result.current.retractTurn());

      let ended: TurnTrackerSession | null = null;
      act(() => {
        ended = result.current.endGame();
      });

      expect(result.current.session).toBeNull();
      expect(ended).not.toBeNull();
      const endedNonNull = ended as unknown as TurnTrackerSession;
      expect(endedNonNull.totalAdvances).toBe(2);
      expect(endedNonNull.totalRetracts).toBe(1);
      expect(endedNonNull.playerCountAtStart).toBe(3);
    });

    it('returns null when called with no active session', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      let ended: TurnTrackerSession | null = null;
      act(() => {
        ended = result.current.endGame();
      });
      expect(ended).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('Persistence (non-group mode)', () => {
    it('writes session to appCache.turnTracker key', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      act(() => result.current.beginGame([0, 1, 2], 'cw'));
      // Wait for the persistence effect to run
      await flushAsync();

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      // Several writes may happen (initial null hydration + beginGame).
      // We care about the most recent value written.
      const turnTrackerWrites = setItemCalls.filter((call) => call[0] === 'app.turnTracker');
      expect(turnTrackerWrites.length).toBeGreaterThan(0);
      const last = turnTrackerWrites[turnTrackerWrites.length - 1];
      const written = JSON.parse(last[1]);
      expect(written).not.toBeNull();
      expect(written.seatOrder).toEqual([0, 1, 2]);
      expect(written.activeSeatIndex).toBe(0);
    });

    it('discards persisted session whose playerCountAtStart mismatches current playerCount', async () => {
      // Simulate appCache: playerCount = 4, but session says 3
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playerCount') return Promise.resolve('4');
        if (key === 'app.turnTracker') {
          const stale: TurnTrackerSession = {
            seatOrder: [0, 1, 2],
            activeSeatIndex: 1,
            direction: 'cw',
            startedAt: Date.now() - 1000,
            playerCountAtStart: 3,
            totalAdvances: 0,
            totalRetracts: 0,
          };
          return Promise.resolve(JSON.stringify(stale));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(result.current.session).toBeNull();
    });

    it('hydrates a valid persisted session', async () => {
      const valid: TurnTrackerSession = {
        seatOrder: [2, 0, 1, 3],
        activeSeatIndex: 2,
        direction: 'ccw',
        startedAt: Date.now() - 10000,
        playerCountAtStart: 4,
        totalAdvances: 5,
        totalRetracts: 1,
      };
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playerCount') return Promise.resolve('4');
        if (key === 'app.turnTracker') return Promise.resolve(JSON.stringify(valid));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.seatOrder).toEqual([2, 0, 1, 3]);
      expect(result.current.session?.activeSeatIndex).toBe(2);
      expect(result.current.session?.direction).toBe('ccw');
    });
  });
});
