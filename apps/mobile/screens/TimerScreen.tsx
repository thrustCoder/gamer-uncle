import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, Animated, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import BackButton from '../components/BackButton';
import { timerStyles as styles } from '../styles/timerStyles';
import { Colors } from '../styles/colors';
import { Dimensions } from 'react-native';
import { useTimer } from '../store/TimerContext';

const { width } = Dimensions.get('window');
const PRESET_VALUES = [
  { label: '10s', seconds: 10 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
];

export default function TimerScreen() {
  // Use global timer context - timer continues even when navigating away
  const {
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
  } = useTimer();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when timer completes (triggered by timeLeft becoming 0 after running)
  const wasRunningRef = useRef(false);
  useEffect(() => {
    // Detect when timer just completed (was running, now stopped with timeLeft = 0)
    if (wasRunningRef.current && !isRunning && timeLeft === 0 && totalTime === 0) {
      // Timer just completed - play pulse animation
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
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, timeLeft, totalTime, pulseAnim]);

  const handlePresetSelect = (seconds: number) => {
    const success = addTime(seconds);
    if (!success) {
      Alert.alert('Time Limit', 'Maximum timer duration is 10 minutes.');
    }
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
              onPress={start}
              testID="start-timer"
            >
              <Text style={styles.mainButtonText}>START</Text>
            </TouchableOpacity>
          )}

          {/* Show RESET button when presets are selected but timer not running */}
          {showStartButton && !isRunning && (
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={reset}
              testID="reset-timer"
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          )}

          {/* Show PAUSE/RESUME when timer is running */}
          {isRunning && (
            <TouchableOpacity
              style={styles.mainButton}
              onPress={isPaused ? resume : pause}
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
              onPress={reset}
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