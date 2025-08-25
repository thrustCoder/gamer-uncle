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
});
