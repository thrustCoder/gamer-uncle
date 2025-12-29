import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Vibration, AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';

const MAX_SECONDS = 600; // 10 minutes maximum

interface TimerContextType {
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  isPaused: boolean;
  showStartButton: boolean;
  addTime: (seconds: number) => boolean; // Returns false if max time exceeded
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStartButton, setShowStartButton] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timer | number | null>(null);
  const appState = useRef(AppState.currentState);
  const pausedTime = useRef<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        pausedTime.current = Date.now();
      }
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isRunning && !isPaused && pausedTime.current) {
          const elapsed = Math.floor((Date.now() - pausedTime.current) / 1000);
          setTimeLeft((prev) => Math.max(0, prev - elapsed));
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isRunning, isPaused]);

  // Timer completion handler - plays sound regardless of current screen
  const handleTimerComplete = useCallback(async () => {
    console.log('🔔 [TIMER] Timer completed - playing sound');
    
    // Vibration
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Play bell sound
    try {
      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/bell-ring.mp3')
      );
      soundRef.current = sound;
      await sound.playAsync();
      
      // Clean up sound after it finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.warn('🔔 [TIMER] Sound playback error:', error);
    }

    setIsRunning(false);
    setIsPaused(false);
    setShowStartButton(false);
    setTimeLeft(0);
    setTotalTime(0);
  }, []);

  // Main timer interval
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current as any);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as any);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as any);
      }
    };
  }, [isRunning, isPaused, handleTimerComplete]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const addTime = useCallback((seconds: number): boolean => {
    if (isRunning) return false;
    
    const newTotalTime = totalTime + seconds;
    
    if (newTotalTime > MAX_SECONDS) {
      return false; // Exceeded max time
    }
    
    setTimeLeft(newTotalTime);
    setTotalTime(newTotalTime);
    setShowStartButton(true);
    return true;
  }, [isRunning, totalTime]);

  const start = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
      setIsPaused(false);
      setShowStartButton(false);
    }
  }, [timeLeft]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(0);
    setTotalTime(0);
    setIsPaused(false);
    setShowStartButton(false);
  }, []);

  return (
    <TimerContext.Provider value={{
      timeLeft,
      totalTime,
      isRunning,
      isPaused,
      showStartButton,
      addTime,
      start,
      pause,
      resume,
      reset,
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
