import { appCache } from '../services/storage/appCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('appCache', () => {
  beforeEach(async () => {
    // @ts-ignore
    await AsyncStorage.clear();
  });

  it('persists and retrieves numbers', async () => {
    await appCache.setPlayerCount(6);
    await appCache.setTeamCount(3);
    await appCache.setDiceCount(2);

    await expect(appCache.getPlayerCount(4)).resolves.toBe(6);
    await expect(appCache.getTeamCount(2)).resolves.toBe(3);
    await expect(appCache.getDiceCount(1)).resolves.toBe(2);
  });

  it('persists and retrieves players list', async () => {
    const players = ['Alice', 'Bob', 'Cleo'];
    await appCache.setPlayers(players);
    await expect(appCache.getPlayers([])).resolves.toEqual(players);
  });

  it('returns fallbacks on invalid data', async () => {
    // @ts-ignore
    await AsyncStorage.setItem('app.playerCount', 'NaN');
    await expect(appCache.getPlayerCount(5)).resolves.toBe(5);
  });

  describe('game setup persistence', () => {
    it('persists and retrieves game setup game name', async () => {
      await appCache.setGameSetupGameName('Catan');
      await expect(appCache.getGameSetupGameName()).resolves.toBe('Catan');
    });

    it('returns empty string for missing game name', async () => {
      await expect(appCache.getGameSetupGameName()).resolves.toBe('');
    });

    it('persists and retrieves game setup player count', async () => {
      await appCache.setGameSetupPlayerCount(6);
      await expect(appCache.getGameSetupPlayerCount()).resolves.toBe(6);
    });

    it('returns fallback for missing game setup player count', async () => {
      await expect(appCache.getGameSetupPlayerCount(4)).resolves.toBe(4);
    });

    it('persists and retrieves game setup response', async () => {
      const response = 'Setup instructions for Catan with 4 players...';
      await appCache.setGameSetupResponse(response);
      await expect(appCache.getGameSetupResponse()).resolves.toBe(response);
    });

    it('returns null for missing game setup response', async () => {
      await expect(appCache.getGameSetupResponse()).resolves.toBeNull();
    });

    it('stores null response as empty string and retrieves as null', async () => {
      await appCache.setGameSetupResponse(null);
      await expect(appCache.getGameSetupResponse()).resolves.toBeNull();
    });

    it('clearGameSetup removes all game setup keys', async () => {
      await appCache.setGameSetupGameName('Catan');
      await appCache.setGameSetupPlayerCount(3);
      await appCache.setGameSetupResponse('Some response');

      await appCache.clearGameSetup();

      await expect(appCache.getGameSetupGameName()).resolves.toBe('');
      await expect(appCache.getGameSetupPlayerCount(4)).resolves.toBe(4);
      await expect(appCache.getGameSetupResponse()).resolves.toBeNull();
    });
  });

  describe('player groups persistence', () => {
    it('persists and retrieves player groups state', async () => {
      const groupsState = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [{
          id: 'g1', name: 'Friday Night Crew', playerCount: 4,
          playerNames: ['Alice', 'Bob', 'Carol', 'Dave'], teamCount: 2,
          gameScore: null, leaderboard: [],
          gameSetupGameName: 'Catan', gameSetupPlayerCount: 4, gameSetupResponse: null,
        }],
      };
      await appCache.setPlayerGroups(groupsState);
      const retrieved = await appCache.getPlayerGroups();
      expect(retrieved).toEqual(groupsState);
    });

    it('returns default state when no groups data exists', async () => {
      const retrieved = await appCache.getPlayerGroups();
      expect(retrieved).toEqual({
        enabled: false,
        activeGroupId: null,
        groups: [],
      });
    });

    it('persists multiple groups', async () => {
      const groupsState = {
        enabled: true,
        activeGroupId: 'g2',
        groups: [
          { id: 'g1', name: 'Group A', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null },
          { id: 'g2', name: 'Group B', playerCount: 3, playerNames: ['X', 'Y', 'Z'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 3, gameSetupResponse: null },
        ],
      };
      await appCache.setPlayerGroups(groupsState);
      const retrieved = await appCache.getPlayerGroups();
      expect(retrieved.groups).toHaveLength(2);
      expect(retrieved.activeGroupId).toBe('g2');
    });

    it('overwrites previous groups state', async () => {
      const state1 = {
        enabled: true,
        activeGroupId: 'g1',
        groups: [{ id: 'g1', name: 'Old', playerCount: 2, playerNames: ['A', 'B'], teamCount: 2, gameScore: null, leaderboard: [], gameSetupGameName: '', gameSetupPlayerCount: 2, gameSetupResponse: null }],
      };
      const state2 = {
        enabled: false,
        activeGroupId: null as string | null,
        groups: [] as any[],
      };
      await appCache.setPlayerGroups(state1);
      await appCache.setPlayerGroups(state2);
      const retrieved = await appCache.getPlayerGroups();
      expect(retrieved.enabled).toBe(false);
      expect(retrieved.groups).toEqual([]);
    });
  });
});
