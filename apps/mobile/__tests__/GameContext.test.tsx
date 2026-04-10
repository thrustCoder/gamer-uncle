import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { GameProvider, useGame } from '../store/GameContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

describe('GameContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('Initial State', () => {
    it('should have empty players array initially', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.players).toEqual([]);
    });

    it('should default to 2 teams', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.numTeams).toBe(2);
    });

    it('should throw error when used outside GameProvider', () => {
      const { result } = renderHook(() => {
        try {
          return useGame();
        } catch (error) {
          return { error };
        }
      });

      expect((result.current as any).error).toBeTruthy();
      expect((result.current as any).error.message).toContain('useGame must be used within GameProvider');
    });
  });

  describe('Hydration', () => {
    it('should hydrate players from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.playersList') return Promise.resolve(JSON.stringify(['Alice', 'Bob', 'Charlie']));
        if (key === 'app.teamCount') return Promise.resolve('3');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.players).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should hydrate team count from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'app.teamCount') return Promise.resolve('4');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.numTeams).toBe(4);
    });

    it('should use defaults when AsyncStorage is empty', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.players).toEqual([]);
      expect(result.current.numTeams).toBe(2);
    });
  });

  describe('setPlayers', () => {
    it('should update the players list', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        result.current.setPlayers(['Player1', 'Player2']);
      });

      expect(result.current.players).toEqual(['Player1', 'Player2']);
    });

    it('should persist players to AsyncStorage after debounce', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        result.current.setPlayers(['Alice', 'Bob']);
      });

      // Advance past debounce delay (400ms)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'app.playersList',
        JSON.stringify(['Alice', 'Bob'])
      );

      jest.useRealTimers();
    });

    it('should handle empty players array', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        result.current.setPlayers([]);
      });

      expect(result.current.players).toEqual([]);
    });
  });

  describe('setNumTeams', () => {
    it('should update the team count', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        result.current.setNumTeams(5);
      });

      expect(result.current.numTeams).toBe(5);
    });

    it('should persist team count to AsyncStorage', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        result.current.setNumTeams(3);
      });

      // setNumTeams uses useEffect (not debounced), so it persists immediately
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('app.teamCount', '3');
    });
  });
});
