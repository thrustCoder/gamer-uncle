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

    it('should not crash when no active group exists', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: null,
        groups: [],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.updateActiveGroupData({ gameSetupGameName: 'Catan' });
      });

      expect(result.current.activeGroup).toBeNull();
    });

    it('should update multiple fields at once', async () => {
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
        result.current.updateActiveGroupData({
          gameSetupGameName: 'Risk',
          gameSetupResponse: 'Setup for Risk...',
          playerCount: 5,
          playerNames: ['A', 'B', 'C', 'D', 'E'],
        });
      });

      expect(result.current.activeGroup?.gameSetupGameName).toBe('Risk');
      expect(result.current.activeGroup?.gameSetupResponse).toBe('Setup for Risk...');
      expect(result.current.activeGroup?.playerCount).toBe(5);
      expect(result.current.activeGroup?.playerNames).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('should only update the active group, not others', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: 'Catan', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.updateActiveGroupData({ gameSetupGameName: 'Risk' });
      });

      expect(result.current.state.groups[0].gameSetupGameName).toBe('Risk');
      expect(result.current.state.groups[1].gameSetupGameName).toBe('Catan');
    });
  });

  describe('enableGroups - edge cases', () => {
    it('should generate default player names when no cached names exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'app.playerCount': '3',
          'app.teamCount': '2',
          'app.scoreTracker.gameScore': 'null',
          'app.scoreTracker.leaderboard': '[]',
          'app.gameSetup.gameName': '',
          'app.gameSetup.playerCount': '3',
          'app.gameSetup.response': '',
        };
        return Promise.resolve(data[key] ?? null);
      });

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      await act(async () => {
        await result.current.enableGroups();
      });

      expect(result.current.state.groups[0].playerNames).toEqual(['P1', 'P2', 'P3']);
      expect(result.current.state.groups[0].playerCount).toBe(3);
    });
  });

  describe('createGroup - edge cases', () => {
    it('should set default teamCount of 2 when not provided', async () => {
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
        result.current.createGroup('New Group', 4, ['W', 'X', 'Y', 'Z']);
      });

      expect(result.current.state.groups[1].teamCount).toBe(2);
      expect(result.current.state.groups[1].gameScore).toBeNull();
      expect(result.current.state.groups[1].leaderboard).toEqual([]);
    });

    it('should initialize new group with empty game setup data', async () => {
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
        result.current.createGroup('New Group', 3, ['A', 'B', 'C']);
      });

      const newGroup = result.current.state.groups[1];
      expect(newGroup.gameSetupGameName).toBe('');
      expect(newGroup.gameSetupPlayerCount).toBe(3);
      expect(newGroup.gameSetupResponse).toBeNull();
    });
  });

  describe('updateGroup - edge cases', () => {
    it('should update multiple fields simultaneously', async () => {
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
        result.current.updateGroup('g1', {
          name: 'New Name',
          playerCount: 3,
          playerNames: ['X', 'Y', 'Z'],
          teamCount: 3,
        });
      });

      expect(result.current.state.groups[0].name).toBe('New Name');
      expect(result.current.state.groups[0].playerCount).toBe(3);
      expect(result.current.state.groups[0].playerNames).toEqual(['X', 'Y', 'Z']);
      expect(result.current.state.groups[0].teamCount).toBe(3);
    });

    it('should not affect non-matching groups', async () => {
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
        result.current.updateGroup('g1', { name: 'Updated' });
      });

      expect(result.current.state.groups[0].name).toBe('Updated');
      expect(result.current.state.groups[1].name).toBe('Group 2');
    });
  });

  describe('deleteGroup - edge cases', () => {
    it('should select first remaining group when deleting last item in list', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g3',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 2, playerNames: ['C', 'D'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g3', name: 'Group 3', playerCount: 2, playerNames: ['E', 'F'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.deleteGroup('g3');
      });

      expect(result.current.state.groups).toHaveLength(2);
      // When deleting the last item (index 2), nextIndex = min(2, 1) = 1, so g2 is selected
      expect(result.current.state.activeGroupId).toBe('g2');
    });

    it('should select correct group when deleting middle active group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g2',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 2, playerNames: ['C', 'D'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g3', name: 'Group 3', playerCount: 2, playerNames: ['E', 'F'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => {
        result.current.deleteGroup('g2');
      });

      expect(result.current.state.groups).toHaveLength(2);
      // When deleting index 1, nextIndex = min(1, 1) = 1, which is g3 in filtered list
      expect(result.current.state.activeGroupId).toBe('g3');
    });
  });

  describe('activeGroup derivation', () => {
    it('should return null when groups are disabled', async () => {
      const savedState = {
        enabled: false,
        activeGroupId: 'g1',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      expect(result.current.activeGroup).toBeNull();
    });

    it('should return null when activeGroupId does not match any group', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'nonexistent',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      expect(result.current.activeGroup).toBeNull();
    });

    it('should return correct group when activeGroupId matches', async () => {
      const savedState = {
        enabled: true,
        activeGroupId: 'g2',
        groups: [
          { id: 'g1', name: 'Group 1', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group 2', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => usePlayerGroups(), { wrapper });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      expect(result.current.activeGroup?.id).toBe('g2');
      expect(result.current.activeGroup?.name).toBe('Group 2');
    });
  });

  describe('usePlayerGroups hook error', () => {
    it('should throw when used outside provider', () => {
      // Suppress console.error for expected error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => usePlayerGroups());
      }).toThrow('usePlayerGroups must be used within PlayerGroupsProvider');
      spy.mockRestore();
    });
  });
});
