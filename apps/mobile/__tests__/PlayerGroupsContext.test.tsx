import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { PlayerGroupsProvider, usePlayerGroups } from '../store/PlayerGroupsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayerGroupsProvider>{children}</PlayerGroupsProvider>
);

describe('PlayerGroupsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('Initial State', () => {
    it('should have groups disabled by default', async () => {
      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      expect(result.current.state.enabled).toBe(false);
      expect(result.current.state.groups).toEqual([]);
      expect(result.current.activeGroup).toBeNull();
    });

    it('should hydrate from AsyncStorage', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [{
          id: 'g1', name: 'Test Group', playerCount: 3,
          playerNames: ['A', 'B', 'C'], teamCount: 2,
          gameScore: null, leaderboard: [],
          gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null,
        }],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      expect(result.current.state.enabled).toBe(true);
      expect(result.current.activeGroup?.name).toBe('Test Group');
    });
  });

  describe('enableGroups', () => {
    it('should migrate ungrouped data into first group', async () => {
      // Simulate ungrouped appCache data
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'app.playersList': JSON.stringify(['Alice', 'Bob']),
          'app.playerCount': '2',
          'app.teamCount': '2',
          'app.scoreTracker.gameScore': 'null',
          'app.scoreTracker.leaderboard': '[]',
          'app.gameSetup.gameName': 'Catan',
          'app.gameSetup.playerCount': '2',
          'app.gameSetup.response': '',
        };
        return Promise.resolve(data[key] ?? null);
      });

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      await act(async () => {
        await result.current.enableGroups();
      });

      expect(result.current.state.enabled).toBe(true);
      expect(result.current.state.groups).toHaveLength(1);
      expect(result.current.state.groups[0].name).toBe('Game Night Group');
      expect(result.current.state.groups[0].playerNames).toEqual(['Alice', 'Bob']);
      expect(result.current.state.groups[0].playerCount).toBe(2);
      expect(result.current.activeGroup).not.toBeNull();
    });
  });

  describe('disableGroups', () => {
    it('should reset state to default', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [{
          id: 'g1', name: 'Group 1', playerCount: 4,
          playerNames: ['A', 'B', 'C', 'D'], teamCount: 2,
          gameScore: null, leaderboard: [],
          gameSetupGameName: 'Risk', gameSetupPlayerCount: 4, gameSetupResponse: null,
        }],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      await act(async () => {
        await result.current.disableGroups();
      });

      expect(result.current.state.enabled).toBe(false);
      expect(result.current.state.groups).toEqual([]);
    });
  });

  describe('createGroup', () => {
    it('should add a new group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [{
          id: 'g1', name: 'Group 1', playerCount: 2,
          playerNames: ['A', 'B'], teamCount: 2,
          gameScore: null, leaderboard: [],
          gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null,
        }],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.createGroup('New Group', 3, ['X', 'Y', 'Z']);
      });

      expect(result.current.state.groups).toHaveLength(2);
      expect(result.current.state.groups[1].name).toBe('New Group');
      expect(result.current.state.groups[1].playerCount).toBe(3);
    });

    it('should not exceed MAX_GROUPS', async () => {
      const groups = Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`, name: `Group ${i}`, playerCount: 2,
        playerNames: ['A', 'B'], teamCount: 2,
        gameScore: null, leaderboard: [],
        gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null,
      }));
      const savedState = { enabled: true, activeGroupId: 'g0', groups };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.createGroup('11th Group', 2, ['A', 'B']);
      });

      expect(result.current.state.groups).toHaveLength(10);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a non-active group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.deleteGroup('g2');
      });

      expect(result.current.state.groups).toHaveLength(1);
      expect(result.current.state.activeGroupId).toBe('g1');
    });

    it('should auto-select next group when deleting active group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.deleteGroup('g1');
      });

      expect(result.current.state.groups).toHaveLength(1);
      expect(result.current.state.activeGroupId).toBe('g2');
    });

    it('should not delete the last group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Only Group', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.deleteGroup('g1');
      });

      expect(result.current.state.groups).toHaveLength(1);
    });
  });

  describe('updateGroup', () => {
    it('should update group name', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Old Name', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.updateGroup('g1', { name: 'New Name' });
      });

      expect(result.current.state.groups[0].name).toBe('New Name');
    });
  });

  describe('setActiveGroup', () => {
    it('should change active group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.setActiveGroup('g2');
      });

      expect(result.current.state.activeGroupId).toBe('g2');
      expect(result.current.activeGroup?.name).toBe('Group 2');
    });

    it('should not change to non-existent group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.setActiveGroup('nonexistent');
      });

      expect(result.current.state.activeGroupId).toBe('g1');
    });
  });

  describe('updateActiveGroupData', () => {
    it('should update active group game data', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.updateActiveGroupData({ gameSetupGameName: 'Catan' });
      });

      expect(result.current.activeGroup?.gameSetupGameName).toBe('Catan');
    });
  });
});
