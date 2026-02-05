import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';
import type {
  GameInfo,
  GameScoreSession,
  LeaderboardEntry,
  RoundScore,
  PlayerRanking,
} from '../types/scoreTracker';

/**
 * Context type for Score Tracker state and actions
 */
interface ScoreTrackerContextType {
  // State
  gameScore: GameScoreSession | null;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;

  // Game Score actions
  startGameScore: (game: GameInfo) => void;
  addRound: (scores: Record<string, number>) => void;
  updateRound: (roundNumber: number, scores: Record<string, number>) => void;
  deleteRound: (roundNumber: number) => void;
  clearGameScore: () => void;

  // Leaderboard actions
  addLeaderboardEntry: (game: GameInfo, scores: Record<string, number>) => void;
  updateLeaderboardEntry: (index: number, game: GameInfo, scores: Record<string, number>) => void;
  deleteLeaderboardEntry: (index: number) => void;
  clearLeaderboard: () => void;

  // Player name sync
  renamePlayer: (oldName: string, newName: string) => void;

  // Computed values
  getGameScoreRanking: () => PlayerRanking[];
  getLeaderboardRanking: () => PlayerRanking[];
}

const ScoreTrackerContext = createContext<ScoreTrackerContextType | undefined>(undefined);

export const ScoreTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameScore, setGameScore] = useState<GameScoreSession | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedGameScore, savedLeaderboard] = await Promise.all([
          appCache.getGameScore(),
          appCache.getLeaderboard(),
        ]);
        if (savedGameScore) setGameScore(savedGameScore);
        if (savedLeaderboard.length) setLeaderboard(savedLeaderboard);
      } catch (error) {
        console.error('Error loading score tracker data:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist game score changes (debounced)
  useDebouncedEffect(() => {
    if (!isLoading) {
      appCache.setGameScore(gameScore);
    }
  }, [gameScore, isLoading], 400);

  // Persist leaderboard changes (debounced)
  useDebouncedEffect(() => {
    if (!isLoading) {
      appCache.setLeaderboard(leaderboard);
    }
  }, [leaderboard, isLoading], 400);

  // === Game Score Actions ===

  const startGameScore = useCallback((game: GameInfo) => {
    const newSession: GameScoreSession = {
      game,
      rounds: [],
      createdAt: Date.now(),
    };
    setGameScore(newSession);
  }, []);

  const addRound = useCallback((scores: Record<string, number>) => {
    setGameScore((prev) => {
      if (!prev) return prev;
      const newRound: RoundScore = {
        roundNumber: prev.rounds.length + 1,
        scores,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
      };
    });
  }, []);

  const updateRound = useCallback((roundNumber: number, scores: Record<string, number>) => {
    setGameScore((prev) => {
      if (!prev) return prev;
      const updatedRounds = prev.rounds.map((round) =>
        round.roundNumber === roundNumber
          ? { ...round, scores, timestamp: Date.now() }
          : round
      );
      return { ...prev, rounds: updatedRounds };
    });
  }, []);

  const deleteRound = useCallback((roundNumber: number) => {
    setGameScore((prev) => {
      if (!prev) return prev;
      // Filter out the deleted round and renumber remaining rounds
      const filteredRounds = prev.rounds.filter((r) => r.roundNumber !== roundNumber);
      const renumberedRounds = filteredRounds.map((round, index) => ({
        ...round,
        roundNumber: index + 1,
      }));
      return { ...prev, rounds: renumberedRounds };
    });
  }, []);

  const clearGameScore = useCallback(() => {
    setGameScore(null);
  }, []);

  // === Leaderboard Actions ===

  const addLeaderboardEntry = useCallback((game: GameInfo, scores: Record<string, number>) => {
    const newEntry: LeaderboardEntry = {
      game,
      scores,
      timestamp: Date.now(),
    };
    setLeaderboard((prev) => [...prev, newEntry]);
  }, []);

  const updateLeaderboardEntry = useCallback(
    (index: number, game: GameInfo, scores: Record<string, number>) => {
      setLeaderboard((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const updated = [...prev];
        updated[index] = {
          game,
          scores,
          timestamp: Date.now(),
        };
        return updated;
      });
    },
    []
  );

  const deleteLeaderboardEntry = useCallback((index: number) => {
    setLeaderboard((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearLeaderboard = useCallback(() => {
    setLeaderboard([]);
  }, []);

  // === Player Name Sync ===

  /**
   * Renames a player across all stored data (game score rounds and leaderboard entries).
   * This ensures that when a player name changes in the top section, it reflects
   * in all the data without losing scores.
   */
  const renamePlayer = useCallback((oldName: string, newName: string) => {
    if (oldName === newName) return;

    // Helper to remap scores object
    const remapScores = (scores: Record<string, number>): Record<string, number> => {
      const remapped: Record<string, number> = {};
      Object.entries(scores).forEach(([key, value]) => {
        const newKey = key === oldName ? newName : key;
        remapped[newKey] = value;
      });
      return remapped;
    };

    // Update game score rounds
    setGameScore((prev) => {
      if (!prev) return prev;
      const updatedRounds = prev.rounds.map((round) => ({
        ...round,
        scores: remapScores(round.scores),
      }));
      return { ...prev, rounds: updatedRounds };
    });

    // Update leaderboard entries
    setLeaderboard((prev) => {
      return prev.map((entry) => ({
        ...entry,
        scores: remapScores(entry.scores),
      }));
    });
  }, []);

  // === Computed Values ===

  const getGameScoreRanking = useCallback((): PlayerRanking[] => {
    if (!gameScore || gameScore.rounds.length === 0) return [];

    // Aggregate scores across all rounds
    const totals: Record<string, number> = {};
    gameScore.rounds.forEach((round) => {
      Object.entries(round.scores).forEach(([player, score]) => {
        totals[player] = (totals[player] || 0) + score;
      });
    });

    // Convert to array and sort descending
    return Object.entries(totals)
      .map(([player, total]) => ({ player, total }))
      .sort((a, b) => b.total - a.total);
  }, [gameScore]);

  const getLeaderboardRanking = useCallback((): PlayerRanking[] => {
    if (leaderboard.length === 0) return [];

    // Aggregate scores across all games
    const totals: Record<string, number> = {};
    leaderboard.forEach((entry) => {
      Object.entries(entry.scores).forEach(([player, score]) => {
        totals[player] = (totals[player] || 0) + score;
      });
    });

    // Convert to array and sort descending
    return Object.entries(totals)
      .map(([player, total]) => ({ player, total }))
      .sort((a, b) => b.total - a.total);
  }, [leaderboard]);

  const contextValue = useMemo<ScoreTrackerContextType>(
    () => ({
      // State
      gameScore,
      leaderboard,
      isLoading,

      // Game Score actions
      startGameScore,
      addRound,
      updateRound,
      deleteRound,
      clearGameScore,

      // Leaderboard actions
      addLeaderboardEntry,
      updateLeaderboardEntry,
      deleteLeaderboardEntry,
      clearLeaderboard,

      // Player name sync
      renamePlayer,

      // Computed
      getGameScoreRanking,
      getLeaderboardRanking,
    }),
    [
      gameScore,
      leaderboard,
      isLoading,
      startGameScore,
      addRound,
      updateRound,
      deleteRound,
      clearGameScore,
      addLeaderboardEntry,
      updateLeaderboardEntry,
      deleteLeaderboardEntry,
      clearLeaderboard,
      renamePlayer,
      getGameScoreRanking,
      getLeaderboardRanking,
    ]
  );

  return (
    <ScoreTrackerContext.Provider value={contextValue}>
      {children}
    </ScoreTrackerContext.Provider>
  );
};

/**
 * Hook to access Score Tracker context
 * @throws Error if used outside of ScoreTrackerProvider
 */
export const useScoreTracker = (): ScoreTrackerContextType => {
  const context = useContext(ScoreTrackerContext);
  if (!context) {
    throw new Error('useScoreTracker must be used within ScoreTrackerProvider');
  }
  return context;
};
