import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock react-native-svg (default + named exports)
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockSvg = (props: any) => React.createElement(View, props);
  const MockCircle = (props: any) => React.createElement(View, props);
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: MockCircle,
  };
});

import TimerScreen from '../screens/TimerScreen';

// Mock timer context
const mockAddTime = jest.fn(() => true);
const mockStart = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockReset = jest.fn();

jest.mock('../store/TimerContext', () => ({
  useTimer: () => ({
    timeLeft: mockTimerState.timeLeft,
    totalTime: mockTimerState.totalTime,
    isRunning: mockTimerState.isRunning,
    isPaused: mockTimerState.isPaused,
    showStartButton: mockTimerState.showStartButton,
    addTime: mockAddTime,
    start: mockStart,
    pause: mockPause,
    resume: mockResume,
    reset: mockReset,
  }),
}));

// Mock BackButton
jest.mock('../components/BackButton', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockBackButton() {
    return React.createElement(View, { testID: 'back-button' });
  };
});

// Mutable timer state for tests
let mockTimerState = {
  timeLeft: 0,
  totalTime: 0,
  isRunning: false,
  isPaused: false,
  showStartButton: false,
};

describe('TimerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimerState = {
      timeLeft: 0,
      totalTime: 0,
      isRunning: false,
      isPaused: false,
      showStartButton: false,
    };
    mockAddTime.mockReturnValue(true);
  });

  it('renders the timer screen', () => {
    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('timer-screen')).toBeTruthy();
  });

  it('renders all preset buttons', () => {
    const { getByTestId } = render(<TimerScreen />);

    expect(getByTestId('preset-10s')).toBeTruthy();
    expect(getByTestId('preset-30s')).toBeTruthy();
    expect(getByTestId('preset-1m')).toBeTruthy();
    expect(getByTestId('preset-5m')).toBeTruthy();
  });

  it('displays formatted time 00:00 initially', () => {
    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('timer-display').props.children).toBe('00:00');
  });

  it('displays formatted time correctly for non-zero time', () => {
    mockTimerState.timeLeft = 125; // 2:05
    mockTimerState.totalTime = 125;

    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('timer-display').props.children).toBe('02:05');
  });

  it('calls addTime when a preset button is pressed', () => {
    const { getByTestId } = render(<TimerScreen />);

    fireEvent.press(getByTestId('preset-30s'));
    expect(mockAddTime).toHaveBeenCalledWith(30);
  });

  it('calls addTime with correct seconds for each preset', () => {
    const { getByTestId } = render(<TimerScreen />);

    fireEvent.press(getByTestId('preset-10s'));
    expect(mockAddTime).toHaveBeenCalledWith(10);

    fireEvent.press(getByTestId('preset-1m'));
    expect(mockAddTime).toHaveBeenCalledWith(60);

    fireEvent.press(getByTestId('preset-5m'));
    expect(mockAddTime).toHaveBeenCalledWith(300);
  });

  it('shows Alert when addTime returns false (max exceeded)', () => {
    mockAddTime.mockReturnValue(false);
    jest.spyOn(Alert, 'alert');

    const { getByTestId } = render(<TimerScreen />);
    fireEvent.press(getByTestId('preset-5m'));

    expect(Alert.alert).toHaveBeenCalledWith('Time Limit', 'Maximum timer duration is 10 minutes.');
  });

  it('disables preset buttons when timer is running', () => {
    mockTimerState.isRunning = true;
    mockTimerState.timeLeft = 30;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);

    expect(getByTestId('preset-10s').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('preset-30s').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('preset-1m').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('preset-5m').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows START and RESET buttons when showStartButton is true and not running', () => {
    mockTimerState.showStartButton = true;
    mockTimerState.timeLeft = 30;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);

    expect(getByTestId('start-timer')).toBeTruthy();
    expect(getByTestId('reset-timer')).toBeTruthy();
  });

  it('does not show START button when timer is running', () => {
    mockTimerState.isRunning = true;
    mockTimerState.showStartButton = false;
    mockTimerState.timeLeft = 30;
    mockTimerState.totalTime = 30;

    const { queryByTestId } = render(<TimerScreen />);
    expect(queryByTestId('start-timer')).toBeNull();
  });

  it('calls start when START button is pressed', () => {
    mockTimerState.showStartButton = true;
    mockTimerState.timeLeft = 30;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    fireEvent.press(getByTestId('start-timer'));

    expect(mockStart).toHaveBeenCalled();
  });

  it('calls reset when RESET button is pressed', () => {
    mockTimerState.showStartButton = true;
    mockTimerState.timeLeft = 30;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    fireEvent.press(getByTestId('reset-timer'));

    expect(mockReset).toHaveBeenCalled();
  });

  it('shows PAUSE button when running and not paused', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = false;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('pause-timer')).toBeTruthy();
  });

  it('calls pause when PAUSE button is pressed', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = false;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    fireEvent.press(getByTestId('pause-timer'));

    expect(mockPause).toHaveBeenCalled();
  });

  it('shows RESUME button when paused', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = true;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('resume-timer')).toBeTruthy();
  });

  it('calls resume when RESUME button is pressed', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = true;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    fireEvent.press(getByTestId('resume-timer'));

    expect(mockResume).toHaveBeenCalled();
  });

  it('shows RESET button when paused', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = true;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { getByTestId } = render(<TimerScreen />);
    expect(getByTestId('reset-timer-paused')).toBeTruthy();
  });

  it('does not show RESET-paused button when not paused', () => {
    mockTimerState.isRunning = true;
    mockTimerState.isPaused = false;
    mockTimerState.timeLeft = 25;
    mockTimerState.totalTime = 30;

    const { queryByTestId } = render(<TimerScreen />);
    expect(queryByTestId('reset-timer-paused')).toBeNull();
  });
});
