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

  describe('No-session no-ops', () => {
    it('advanceTurn does nothing when no session is active', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(() => act(() => result.current.advanceTurn())).not.toThrow();
      expect(result.current.session).toBeNull();
      expect(result.current.activeSeatIndex).toBeNull();
    });

    it('retractTurn does nothing when no session is active', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(() => act(() => result.current.retractTurn())).not.toThrow();
      expect(result.current.session).toBeNull();
    });

    it('setDirection does nothing when no session is active', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(() => act(() => result.current.setDirection('ccw'))).not.toThrow();
      expect(result.current.session).toBeNull();
    });
  });

  describe('Derived helpers (next/prev seat & player indices)', () => {
    it('computes nextSeatIndex / prevSeatIndex correctly for cw direction', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([5, 1, 7, 2], 'cw'));

      // active=0, n=4, step=+1
      expect(result.current.activeSeatIndex).toBe(0);
      expect(result.current.nextSeatIndex).toBe(1);
      expect(result.current.prevSeatIndex).toBe(3);
      // Player indices follow seatOrder
      expect(result.current.activePlayerIndex).toBe(5);
      expect(result.current.nextPlayerIndex).toBe(1);
      expect(result.current.prevPlayerIndex).toBe(2);
    });

    it('wraps prev/next around the modulo boundary', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([10, 20, 30], 'cw'));
      // active = 0; prev wraps to 2 (last seat)
      expect(result.current.prevSeatIndex).toBe(2);
      expect(result.current.prevPlayerIndex).toBe(30);
    });

    it('inverts next/prev when direction is ccw', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([10, 20, 30, 40], 'ccw'));
      // active=0, step=-1
      expect(result.current.nextSeatIndex).toBe(3); // 0 - 1 mod 4
      expect(result.current.prevSeatIndex).toBe(1); // 0 + 1 mod 4
      expect(result.current.nextPlayerIndex).toBe(40);
      expect(result.current.prevPlayerIndex).toBe(20);
    });
  });

  describe('Persistence (group mode)', () => {
    const groupId = 'g1';
    const makeGroupsStateJson = (turnTracker: TurnTrackerSession | null) =>
      JSON.stringify({
        enabled: true,
        activeGroupId: groupId,
        groups: [
          {
            id: groupId,
            name: 'Test Group',
            playerCount: 4,
            playerNames: ['A', 'B', 'C', 'D'],
            teamCount: 2,
            gameScore: null,
            leaderboard: [],
            gameSetupGameName: '',
            gameSetupPlayerCount: 4,
            gameSetupResponse: null,
            turnTracker,
          },
        ],
      });

    it('hydrates from the active group when groups are enabled', async () => {
      const session: TurnTrackerSession = {
        seatOrder: [3, 1, 0, 2],
        activeSeatIndex: 1,
        direction: 'cw',
        startedAt: Date.now() - 5000,
        playerCountAtStart: 4,
        totalAdvances: 1,
        totalRetracts: 0,
      };
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playerGroups') return Promise.resolve(makeGroupsStateJson(session));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.seatOrder).toEqual([3, 1, 0, 2]);
      expect(result.current.session?.activeSeatIndex).toBe(1);
    });

    it('persists session updates back to the active group (NOT the appCache key)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playerGroups') return Promise.resolve(makeGroupsStateJson(null));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      act(() => result.current.beginGame([0, 1, 2, 3], 'cw'));
      await flushAsync();
      // Allow the PlayerGroups debounced persistence (400ms) to flush.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 450));
      });

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      // In group mode the TurnTrackerContext writes through updateActiveGroupData
      // (PlayerGroupsContext persists the whole groups state under
      // 'app.playerGroups'), NOT to 'app.turnTracker'.
      const groupWrites = setItemCalls.filter((call) => call[0] === 'app.playerGroups');
      expect(groupWrites.length).toBeGreaterThan(0);
      const lastGroupWrite = JSON.parse(groupWrites[groupWrites.length - 1][1]);
      const activeGroup = lastGroupWrite.groups.find((g: any) => g.id === groupId);
      expect(activeGroup?.turnTracker).not.toBeNull();
      expect(activeGroup?.turnTracker?.seatOrder).toEqual([0, 1, 2, 3]);
    });

    it('discards a group session whose playerCountAtStart mismatches the group player count', async () => {
      const stale: TurnTrackerSession = {
        seatOrder: [0, 1, 2],
        activeSeatIndex: 0,
        direction: 'cw',
        startedAt: Date.now() - 1000,
        playerCountAtStart: 3,
        totalAdvances: 0,
        totalRetracts: 0,
      };
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playerGroups') return Promise.resolve(makeGroupsStateJson(stale));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      // Group reports playerCount=4 but session says 3 → session is dropped.
      expect(result.current.session).toBeNull();
    });
  });

  describe('beginGame counters and snapshot', () => {
    it('records playerCountAtStart from seatOrder length', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2, 3, 4], 'cw'));
      expect(result.current.session?.playerCountAtStart).toBe(5);
    });

    it('resets totalAdvances and totalRetracts on every new game', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();
      act(() => result.current.beginGame([0, 1, 2], 'cw'));
      act(() => result.current.advanceTurn());
      act(() => result.current.advanceTurn());
      act(() => result.current.retractTurn());
      expect(result.current.session?.totalAdvances).toBe(2);
      expect(result.current.session?.totalRetracts).toBe(1);

      act(() => {
        result.current.endGame();
      });
      act(() => result.current.beginGame([0, 1, 2], 'cw'));
      expect(result.current.session?.totalAdvances).toBe(0);
      expect(result.current.session?.totalRetracts).toBe(0);
    });

    it('seatOrder is copied (mutations to the input array do not affect the session)', async () => {
      const { result } = renderHook(() => useTurnTracker(), { wrapper });
      await flushAsync();

      const input = [0, 1, 2, 3];
      act(() => result.current.beginGame(input, 'cw'));
      input[0] = 99;
      expect(result.current.session?.seatOrder).toEqual([0, 1, 2, 3]);
    });
  });
});
