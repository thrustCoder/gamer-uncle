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
});
