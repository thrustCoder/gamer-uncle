import AsyncStorage from '@react-native-async-storage/async-storage';

// Centralized keys for persisted game state
const Keys = {
  playerCount: 'app.playerCount',
  teamCount: 'app.teamCount',
  playersList: 'app.playersList',
  diceCount: 'app.diceCount',
} as const;

async function getNumber(key: string, fallback: number): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

async function setNumber(key: string, value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch {
    // noop
  }
}

async function getStringArray(key: string, fallback: string[] = []): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(key);
    if (!v) return fallback;
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

async function setStringArray(key: string, value: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

export const appCache = {
  // players count
  getPlayerCount: (fallback = 4) => getNumber(Keys.playerCount, fallback),
  setPlayerCount: (value: number) => setNumber(Keys.playerCount, value),

  // teams count
  getTeamCount: (fallback = 2) => getNumber(Keys.teamCount, fallback),
  setTeamCount: (value: number) => setNumber(Keys.teamCount, value),

  // players list
  getPlayers: (fallback: string[] = []) => getStringArray(Keys.playersList, fallback),
  setPlayers: (players: string[]) => setStringArray(Keys.playersList, players),

  // dice count
  getDiceCount: (fallback = 1) => getNumber(Keys.diceCount, fallback),
  setDiceCount: (value: number) => setNumber(Keys.diceCount, value),

  // utility for tests/debug
  __keys: Keys,
};

export type AppCache = typeof appCache;
