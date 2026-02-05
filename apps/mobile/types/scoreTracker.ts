/**
 * Score Tracker Type Definitions
 * 
 * These types define the data structures for the Score Tracker feature,
 * which allows users to track scores during board game sessions.
 */

/**
 * Information about a game, either from BGG database or custom entry
 */
export interface GameInfo {
  /** BGG ID or generated UUID for custom games */
  id: string;
  /** Display name of the game */
  name: string;
  /** URL to game thumbnail image */
  thumbnailUrl?: string;
  /** True if user typed a custom name (not from BGG) */
  isCustom: boolean;
}

/**
 * Scores for a single round in a game session
 */
export interface RoundScore {
  /** 1-based round number */
  roundNumber: number;
  /** Map of playerName -> score for this round */
  scores: Record<string, number>;
  /** Unix timestamp when this round was recorded */
  timestamp: number;
}

/**
 * A complete game scoring session (one game at a time)
 */
export interface GameScoreSession {
  /** The game being played */
  game: GameInfo;
  /** All rounds played in this session */
  rounds: RoundScore[];
  /** Unix timestamp when session was created */
  createdAt: number;
}

/**
 * A single entry in the leaderboard (one game's scores)
 */
export interface LeaderboardEntry {
  /** The game that was played */
  game: GameInfo;
  /** Map of playerName -> total score for this game */
  scores: Record<string, number>;
  /** Unix timestamp when this entry was added */
  timestamp: number;
}

/**
 * Complete state for the Score Tracker feature
 */
export interface ScoreTrackerState {
  /** Current game score session (null if none active) */
  gameScore: GameScoreSession | null;
  /** List of leaderboard entries across multiple games */
  leaderboard: LeaderboardEntry[];
}

/**
 * Ranking entry for display in stack ranking chart
 */
export interface PlayerRanking {
  /** Player name */
  player: string;
  /** Total aggregated score */
  total: number;
}

/**
 * Mode for the ScoreInputScreen
 */
export type ScoreInputMode = 
  | 'addRound' 
  | 'editRound' 
  | 'addLeaderboard' 
  | 'editLeaderboard';

/**
 * Navigation params for ScoreInputScreen
 */
export interface ScoreInputParams {
  mode: ScoreInputMode;
  /** Round number when editing a round */
  roundNumber?: number;
  /** Leaderboard entry index when editing */
  entryIndex?: number;
  /** Pre-filled game info (for leaderboard edit) */
  game?: GameInfo;
  /** Pre-filled scores (for edit modes) */
  existingScores?: Record<string, number>;
}
