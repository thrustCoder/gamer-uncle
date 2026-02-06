import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { TimerProvider, useTimer } from '../store/TimerContext';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          playAsync: jest.fn(),
          unloadAsync: jest.fn(),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      })),
    },
  },
}));

// Test wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TimerProvider>{children}</TimerProvider>
);

describe('TimerContext', () => {
  describe('Initial State', () => {
    it('should have zero time initially', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      expect(result.current.timeLeft).toBe(0);
      expect(result.current.totalTime).toBe(0);
    });

    it('should not be running initially', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('should not show start button initially', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      expect(result.current.showStartButton).toBe(false);
    });

    it('should throw error when used outside TimerProvider', () => {
      const { result } = renderHook(() => {
        try {
          return useTimer();
        } catch (error) {
          return { error };
        }
      });
      
      expect((result.current as any).error).toBeTruthy();
    });
  });

  describe('addTime', () => {
    it('should add time when not running', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        const success = result.current.addTime(30);
        expect(success).toBe(true);
      });
      
      expect(result.current.timeLeft).toBe(30);
      expect(result.current.totalTime).toBe(30);
      expect(result.current.showStartButton).toBe(true);
    });

    it('should accumulate time from multiple presets', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
      });
      
      act(() => {
        result.current.addTime(60);
      });
      
      expect(result.current.timeLeft).toBe(90);
      expect(result.current.totalTime).toBe(90);
    });

    it('should not exceed maximum time (600 seconds)', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(300); // 5 minutes
      });
      
      act(() => {
        result.current.addTime(300); // Another 5 minutes
      });
      
      // Should be at max (600)
      expect(result.current.timeLeft).toBe(600);
      
      // Trying to add more should fail
      act(() => {
        const success = result.current.addTime(60);
        expect(success).toBe(false);
      });
      
      // Time should not change
      expect(result.current.timeLeft).toBe(600);
    });

    it('should not add time while running', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
      });
      
      act(() => {
        result.current.start();
      });
      
      // Verify timer is running
      expect(result.current.isRunning).toBe(true);
      
      // Timer is now running, so addTime should return false
      let success = true;
      act(() => {
        success = result.current.addTime(30);
      });
      
      expect(success).toBe(false);
      // Total time should not have changed
      expect(result.current.totalTime).toBe(30);
    });
  });

  describe('start', () => {
    it('should start the timer', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
      });
      
      act(() => {
        result.current.start();
      });
      
      expect(result.current.isRunning).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.showStartButton).toBe(false);
    });

    it('should not start with zero time', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.start();
      });
      
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('pause', () => {
    it('should pause the running timer', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
      });
      
      act(() => {
        result.current.start();
      });
      
      // Verify running first
      expect(result.current.isRunning).toBe(true);
      
      act(() => {
        result.current.pause();
      });
      
      expect(result.current.isRunning).toBe(true);
      expect(result.current.isPaused).toBe(true);
    });
  });

  describe('resume', () => {
    it('should resume a paused timer', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
      });
      
      act(() => {
        result.current.start();
      });
      
      act(() => {
        result.current.pause();
      });
      
      expect(result.current.isPaused).toBe(true);
      
      act(() => {
        result.current.resume();
      });
      
      expect(result.current.isRunning).toBe(true);
      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all timer state', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(60);
        result.current.start();
      });
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.timeLeft).toBe(0);
      expect(result.current.totalTime).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.showStartButton).toBe(false);
    });

    it('should reset when paused', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(30);
        result.current.start();
        result.current.pause();
      });
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.timeLeft).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('should reset before starting', () => {
      const { result } = renderHook(() => useTimer(), { wrapper });
      
      act(() => {
        result.current.addTime(60);
      });
      
      expect(result.current.timeLeft).toBe(60);
      expect(result.current.showStartButton).toBe(true);
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.timeLeft).toBe(0);
      expect(result.current.showStartButton).toBe(false);
    });
  });

  describe('timer countdown', () => {
    // Skipping countdown test - real timer behavior is tested in E2E tests
    // The timer uses setInterval which doesn't work well with React testing utilities
    it.skip('should countdown when running (tested in E2E)', () => {
      // This behavior is tested in the E2E timer.spec.ts tests
    });
  });
});
