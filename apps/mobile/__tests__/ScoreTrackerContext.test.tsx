import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ScoreTrackerProvider, useScoreTracker } from '../store/ScoreTrackerContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameInfo } from '../types/scoreTracker';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Test wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ScoreTrackerProvider>{children}</ScoreTrackerProvider>
);

const mockGame: GameInfo = {
  id: 'test-game-1',
  name: 'Test Game',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  isCustom: false,
};

const mockCustomGame: GameInfo = {
  id: 'custom-123',
  name: 'My Custom Game',
  isCustom: true,
};

describe('ScoreTrackerContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('Initial State', () => {
    it('should have null gameScore initially', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      // Wait for hydration
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.gameScore).toBeNull();
    });

    it('should have empty leaderboard initially', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.leaderboard).toEqual([]);
    });
  });

  describe('Game Score Actions', () => {
    it('should start a new game score session', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
      });
      
      expect(result.current.gameScore).not.toBeNull();
      expect(result.current.gameScore?.game.name).toBe('Test Game');
      expect(result.current.gameScore?.rounds).toEqual([]);
    });

    it('should add a round to game score', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
      });
      
      act(() => {
        result.current.addRound({ Alice: 10, Bob: 15 });
      });
      
      expect(result.current.gameScore?.rounds.length).toBe(1);
      expect(result.current.gameScore?.rounds[0].scores).toEqual({ Alice: 10, Bob: 15 });
      expect(result.current.gameScore?.rounds[0].roundNumber).toBe(1);
    });

    it('should update a round in game score', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
        result.current.addRound({ Alice: 10, Bob: 15 });
      });
      
      act(() => {
        result.current.updateRound(1, { Alice: 20, Bob: 25 });
      });
      
      expect(result.current.gameScore?.rounds[0].scores).toEqual({ Alice: 20, Bob: 25 });
    });

    it('should delete a round and renumber remaining rounds', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
        result.current.addRound({ Alice: 10 });
        result.current.addRound({ Alice: 20 });
        result.current.addRound({ Alice: 30 });
      });
      
      act(() => {
        result.current.deleteRound(2);
      });
      
      expect(result.current.gameScore?.rounds.length).toBe(2);
      expect(result.current.gameScore?.rounds[0].roundNumber).toBe(1);
      expect(result.current.gameScore?.rounds[1].roundNumber).toBe(2);
      expect(result.current.gameScore?.rounds[1].scores).toEqual({ Alice: 30 });
    });

    it('should clear game score', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
        result.current.addRound({ Alice: 10 });
      });
      
      act(() => {
        result.current.clearGameScore();
      });
      
      expect(result.current.gameScore).toBeNull();
    });
  });

  describe('Leaderboard Actions', () => {
    it('should add a leaderboard entry', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100, Bob: 80 });
      });
      
      expect(result.current.leaderboard.length).toBe(1);
      expect(result.current.leaderboard[0].game.name).toBe('Test Game');
      expect(result.current.leaderboard[0].scores).toEqual({ Alice: 100, Bob: 80 });
    });

    it('should add multiple leaderboard entries', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100 });
        result.current.addLeaderboardEntry(mockCustomGame, { Alice: 50 });
      });
      
      expect(result.current.leaderboard.length).toBe(2);
    });

    it('should update a leaderboard entry', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100 });
      });
      
      act(() => {
        result.current.updateLeaderboardEntry(0, mockCustomGame, { Alice: 200 });
      });
      
      expect(result.current.leaderboard[0].game.name).toBe('My Custom Game');
      expect(result.current.leaderboard[0].scores).toEqual({ Alice: 200 });
    });

    it('should delete a leaderboard entry', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100 });
        result.current.addLeaderboardEntry(mockCustomGame, { Alice: 50 });
      });
      
      act(() => {
        result.current.deleteLeaderboardEntry(0);
      });
      
      expect(result.current.leaderboard.length).toBe(1);
      expect(result.current.leaderboard[0].game.name).toBe('My Custom Game');
    });

    it('should clear leaderboard', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100 });
        result.current.addLeaderboardEntry(mockCustomGame, { Alice: 50 });
      });
      
      act(() => {
        result.current.clearLeaderboard();
      });
      
      expect(result.current.leaderboard).toEqual([]);
    });
  });

  describe('Computed Rankings', () => {
    it('should calculate game score ranking (sum of rounds)', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.startGameScore(mockGame);
        result.current.addRound({ Alice: 10, Bob: 20, Charlie: 15 });
        result.current.addRound({ Alice: 25, Bob: 10, Charlie: 20 });
      });
      
      const ranking = result.current.getGameScoreRanking();
      
      // Alice: 35, Bob: 30, Charlie: 35
      expect(ranking.length).toBe(3);
      expect(ranking[0].player).toBe('Alice'); // or Charlie, they're tied
      expect(ranking[0].total).toBe(35);
    });

    it('should calculate leaderboard ranking (sum across games)', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100, Bob: 80 });
        result.current.addLeaderboardEntry(mockCustomGame, { Alice: 50, Bob: 120 });
      });
      
      const ranking = result.current.getLeaderboardRanking();
      
      // Alice: 150, Bob: 200
      expect(ranking.length).toBe(2);
      expect(ranking[0].player).toBe('Bob');
      expect(ranking[0].total).toBe(200);
      expect(ranking[1].player).toBe('Alice');
      expect(ranking[1].total).toBe(150);
    });

    it('should return empty ranking when no data', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.getGameScoreRanking()).toEqual([]);
      expect(result.current.getLeaderboardRanking()).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should not update round if no game score session exists', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.updateRound(1, { Alice: 10 });
      });
      
      expect(result.current.gameScore).toBeNull();
    });

    it('should not delete leaderboard entry with invalid index', async () => {
      const { result } = renderHook(() => useScoreTracker(), { wrapper });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      act(() => {
        result.current.addLeaderboardEntry(mockGame, { Alice: 100 });
      });
      
      act(() => {
        result.current.deleteLeaderboardEntry(5); // Invalid index
      });
      
      expect(result.current.leaderboard.length).toBe(1);
    });
  });
});
