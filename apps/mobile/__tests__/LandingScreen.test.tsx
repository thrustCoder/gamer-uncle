import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LandingScreen from '../screens/LandingScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '3.1.2',
  },
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  FontAwesome5: 'FontAwesome5',
}));

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(<LandingScreen />);
    expect(getByTestId('center-circle')).toBeTruthy();
  });

  it('renders all feature buttons', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    // Verify all 8 feature buttons are present
    expect(getByTestId('chat-button')).toBeTruthy();
    expect(getByTestId('score-button')).toBeTruthy();
    expect(getByTestId('turn-button')).toBeTruthy();
    expect(getByTestId('search-button')).toBeTruthy();
    expect(getByTestId('team-button')).toBeTruthy();
    expect(getByTestId('timer-button')).toBeTruthy();
    expect(getByTestId('dice-button')).toBeTruthy();
    expect(getByTestId('setup-button')).toBeTruthy();
  });

  it('navigates to Chat when center circle is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('center-circle'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Chat');
  });

  it('navigates to Chat when chat button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('chat-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Chat');
  });

  it('navigates to ScoreTracker when score button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('score-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('ScoreTracker');
  });

  it('navigates to Turn when turn button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('turn-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Turn');
  });

  it('navigates to GameSearch when search button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('search-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('GameSearch');
  });

  it('navigates to Team when team button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('team-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Team');
  });

  it('navigates to Timer when timer button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('timer-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Timer');
  });

  it('navigates to Dice when dice button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('dice-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('Dice');
  });

  it('navigates to GameSetup when setup button is pressed', () => {
    const { getByTestId } = render(<LandingScreen />);
    
    fireEvent.press(getByTestId('setup-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('GameSetup');
  });

  it('displays version information', () => {
    const { getByText } = render(<LandingScreen />);
    
    expect(getByText(/App Version:/)).toBeTruthy();
    expect(getByText(/AI Model:/)).toBeTruthy();
  });

  it('displays feature labels', () => {
    const { getByText } = render(<LandingScreen />);
    
    expect(getByText('Talk to Uncle')).toBeTruthy();
    expect(getByText('Timer')).toBeTruthy();
  });
});
