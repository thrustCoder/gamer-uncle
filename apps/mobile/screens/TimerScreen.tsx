import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Vibration, AppState, AppStateStatus, ImageBackground, Animated, Alert, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import BackButton from '../components/BackButton';
import { timerStyles as styles } from '../styles/timerStyles';
import { Colors } from '../styles/colors';
import { Dimensions } from 'react-native';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');
const MAX_SECONDS = 600; // 10 minutes maximum
const PRESET_VALUES = [
  { label: '10s', seconds: 10 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
];

export default function TimerScreen() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStartButton, setShowStartButton] = useState(false);
  const intervalRef = useRef<NodeJS.Timer | number | null>(null);
  const appState = useRef(AppState.currentState);
  const startTime = useRef<number | null>(null);
  const pausedTime = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

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
      clearInterval(intervalRef.current as any);
    }
    return () => clearInterval(intervalRef.current as any);
  }, [isRunning, isPaused]);

  const handleTimerComplete = async () => {
    // Vibration
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Play bell sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/bell-ring.mp3')
      );
      await sound.playAsync();
    } catch (error) {
      console.warn('Sound playback error:', error);
    }

    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setIsRunning(false);
    setIsPaused(false);
    setShowStartButton(false);
    setTimeLeft(0); // Reset time left
    setTotalTime(0); // Reset total time - this was missing!
  };

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

  const handlePresetSelect = (seconds: number) => {
    if (!isRunning) {
      // Additive presets - add to existing time
      const newTotalTime = totalTime + seconds;
      
      // Validate against maximum time
      if (newTotalTime > MAX_SECONDS) {
        Alert.alert('Time Limit', 'Maximum timer duration is 10 minutes.');
        return;
      }
      
      setTimeLeft(newTotalTime);
      setTotalTime(newTotalTime);
      setIsRunning(false);
      setIsPaused(false);
      setShowStartButton(true);
    }
  };

  const handleStart = () => {
    if (timeLeft > 0) {
      setIsRunning(true);
      setIsPaused(false);
      setShowStartButton(false);
      startTime.current = Date.now();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(0);
    setTotalTime(0);
    setIsPaused(false);
    setShowStartButton(false);
  };

  const formatTime = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Progress calculation for circular progress
  const elapsedTime = totalTime - timeLeft;
  const progressPercentage = totalTime > 0 ? (elapsedTime / totalTime) : 0;  
  
  // SVG circle properties - fix the sizing to match progressCircle
  const circleRadius = (width * 0.8) / 2 - 20; // Increased from -10 to -20 to account for thicker stroke
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercentage * circumference);

  return (
    <ImageBackground
      source={require('../assets/images/tool_background.png')}
      style={styles.background}
      resizeMode="repeat"
    >
      <BackButton />
      <View style={styles.container} testID="timer-screen">

        {/* Additive presets: 10s, 30s, 1m, 5m */}
        <View style={styles.presetContainer}>
          {PRESET_VALUES.map((preset, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.presetButton, isRunning && styles.disabledButton]}
              onPress={() => handlePresetSelect(preset.seconds)}
              disabled={isRunning}
              testID={`preset-${preset.label}`}
            >
              <Text style={styles.presetText}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Circular progress ring using SVG for accurate circular shape */}
        <View style={styles.circleContainer}>
        <Animated.View style={[
            styles.progressCircle,
            { transform: [{ scale: pulseAnim }] }
        ]}>
            {/* SVG Circle Progress - properly centered */}
            <Svg
            width={width * 0.8}
            height={width * 0.8}
            style={{ position: 'absolute', top: 0, left: 0 }} // Remove the offset
            >
            {/* Background orange circle */}
            <Circle
                cx={(width * 0.8) / 2}
                cy={(width * 0.8) / 2}
                r={circleRadius}
                stroke={Colors.timerOrange}
                strokeWidth="20" // Doubled from 10 to 20
                fill="none"
            />
            {/* Progress green circle */}
            <Circle
                cx={(width * 0.8) / 2}
                cy={(width * 0.8) / 2}
                r={circleRadius}
                stroke={Colors.timerGreen}
                strokeWidth="20" // Doubled from 10 to 20
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${(width * 0.8) / 2} ${(width * 0.8) / 2})`}
            />
            </Svg>
            
            <Text style={styles.timeText} testID="timer-display">{formatTime(timeLeft)}</Text>
        </Animated.View>
        </View>

        <View style={styles.buttonContainer}>
          {/* Show START button only after preset selection */}
          {showStartButton && !isRunning && (
            <TouchableOpacity
              style={styles.mainButton}
              onPress={handleStart}
              testID="start-timer"
            >
              <Text style={styles.mainButtonText}>START</Text>
            </TouchableOpacity>
          )}

          {/* Show RESET button when presets are selected but timer not running */}
          {showStartButton && !isRunning && (
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={handleReset}
              testID="reset-timer"
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          )}

          {/* Show PAUSE/RESUME when timer is running */}
          {isRunning && (
            <TouchableOpacity
              style={styles.mainButton}
              onPress={isPaused ? handleResume : handlePause}
              testID={isPaused ? "resume-timer" : "pause-timer"}
            >
              <Text style={styles.mainButtonText}>
                {isPaused ? 'RESUME' : 'PAUSE'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Show RESET button when paused */}
          {isRunning && isPaused && (
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={handleReset}
              testID="reset-timer-paused"
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </ImageBackground>
  );
}