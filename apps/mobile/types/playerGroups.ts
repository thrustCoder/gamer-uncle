import type { GameScoreSession, LeaderboardEntry } from './scoreTracker';

/** A single player group */
export interface PlayerGroup {
  /** Unique identifier (UUID) */
  id: string;
  /** Editable display name (e.g., "Friday Night Crew") */
  name: string;
  /** Number of players in this group (2–20) */
  playerCount: number;
  /** Player names. Populated only when playerCount ≤ 12. */
  playerNames: string[];
  /** Number of teams (used by TeamRandomizer) */
  teamCount: number;
  /** Score Tracker: active game scoring session */
  gameScore: GameScoreSession | null;
  /** Score Tracker: leaderboard entries */
  leaderboard: LeaderboardEntry[];
  /** Game Setup: cached game name */
  gameSetupGameName: string;
  /** Game Setup: cached player count for setup queries */
  gameSetupPlayerCount: number;
  /** Game Setup: cached AI response */
  gameSetupResponse: string | null;
}

/** Top-level player groups state persisted in AsyncStorage */
export interface PlayerGroupsState {
  /** Whether the groups feature is currently enabled */
  enabled: boolean;
  /** ID of the currently active group */
  activeGroupId: string | null;
  /** All groups */
  groups: PlayerGroup[];
}

export const DEFAULT_PLAYER_GROUPS_STATE: PlayerGroupsState = {
  enabled: false,
  activeGroupId: null,
  groups: [],
};

export const MAX_GROUPS = 10;
export const DEFAULT_GROUP_NAME = 'Game Night Group';
