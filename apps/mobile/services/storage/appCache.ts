import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameScoreSession, LeaderboardEntry } from '../../types/scoreTracker';

// Centralized keys for persisted game state
const Keys = {
  playerCount: 'app.playerCount',
  teamCount: 'app.teamCount',
  playersList: 'app.playersList',
  diceCount: 'app.diceCount',
  scoreTrackerGameScore: 'app.scoreTracker.gameScore',
  scoreTrackerLeaderboard: 'app.scoreTracker.leaderboard',
  gameSetupGameName: 'app.gameSetup.gameName',
  gameSetupPlayerCount: 'app.gameSetup.playerCount',
  gameSetupResponse: 'app.gameSetup.response',
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

async function getString(key: string, fallback: string): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function setString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // noop
  }
}

async function setStringArray(key: string, value: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

async function getObject<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

async function setObject<T>(key: string, value: T): Promise<void> {
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

  // score tracker - game score session
  getGameScore: (): Promise<GameScoreSession | null> => 
    getObject<GameScoreSession | null>(Keys.scoreTrackerGameScore, null),
  setGameScore: (session: GameScoreSession | null): Promise<void> => 
    setObject(Keys.scoreTrackerGameScore, session),

  // score tracker - leaderboard
  getLeaderboard: (): Promise<LeaderboardEntry[]> => 
    getObject<LeaderboardEntry[]>(Keys.scoreTrackerLeaderboard, []),
  setLeaderboard: (entries: LeaderboardEntry[]): Promise<void> => 
    setObject(Keys.scoreTrackerLeaderboard, entries),

  // game setup - persisted state
  getGameSetupGameName: (): Promise<string> => getString(Keys.gameSetupGameName, ''),
  setGameSetupGameName: (name: string): Promise<void> => setString(Keys.gameSetupGameName, name),
  getGameSetupPlayerCount: (fallback = 4) => getNumber(Keys.gameSetupPlayerCount, fallback),
  setGameSetupPlayerCount: (value: number) => setNumber(Keys.gameSetupPlayerCount, value),
  getGameSetupResponse: (): Promise<string | null> => getString(Keys.gameSetupResponse, '').then(v => v || null),
  setGameSetupResponse: (response: string | null): Promise<void> => setString(Keys.gameSetupResponse, response ?? ''),
  clearGameSetup: async (): Promise<void> => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(Keys.gameSetupGameName),
        AsyncStorage.removeItem(Keys.gameSetupPlayerCount),
        AsyncStorage.removeItem(Keys.gameSetupResponse),
      ]);
    } catch {
      // noop
    }
  },

  // utility for tests/debug
  __keys: Keys,
};

export type AppCache = typeof appCache;
