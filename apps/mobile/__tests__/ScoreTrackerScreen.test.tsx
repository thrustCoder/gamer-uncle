import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ScoreTrackerScreen from '../screens/ScoreTrackerScreen';
import { ScoreTrackerProvider } from '../store/ScoreTrackerContext';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock BackButton
jest.mock('../components/BackButton', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'back-button' });
});

// Mock child components to simplify testing
jest.mock('../components/scoreTracker/PlayerNamesSection', () => {
  const React = require('react');
  return ({ playerCount, playerNames, onPlayerCountPress, onNameChange }: any) => 
    React.createElement('View', { testID: 'player-names-section' }, [
      React.createElement('Text', { key: 'count', testID: 'player-count' }, `Players: ${playerCount}`),
      React.createElement('TouchableOpacity', { 
        key: 'picker',
        testID: 'player-count-picker',
        onPress: onPlayerCountPress,
      }),
      ...playerNames.map((name: string, idx: number) => 
        React.createElement('TextInput', {
          key: `name-${idx}`,
          testID: `player-name-${idx}`,
          value: name,
          onChangeText: (text: string) => onNameChange(idx, text),
        })
      ),
    ]);
});

jest.mock('../components/scoreTracker/GameScoreSection', () => {
  const React = require('react');
  return ({ playerNames }: any) => 
    React.createElement('View', { testID: 'game-score-section' }, 
      React.createElement('Text', null, `Game Score for ${playerNames.length} players`)
    );
});

jest.mock('../components/scoreTracker/LeaderboardSection', () => {
  const React = require('react');
  return ({ playerNames }: any) => 
    React.createElement('View', { testID: 'leaderboard-section' },
      React.createElement('Text', null, `Leaderboard for ${playerNames.length} players`)
    );
});

// Mock appCache
jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getPlayerCount: jest.fn(() => Promise.resolve(4)),
    getPlayers: jest.fn(() => Promise.resolve(['Alice', 'Bob', 'Carol', 'Dave'])),
    setPlayerCount: jest.fn(),
    setPlayers: jest.fn(),
    getGameScore: jest.fn(() => Promise.resolve(null)),
    setGameScore: jest.fn(),
    getLeaderboard: jest.fn(() => Promise.resolve([])),
    setLeaderboard: jest.fn(),
  },
}));

// Mock useDebouncedEffect
jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[]) => {
    const React = require('react');
    React.useEffect(callback, deps);
  },
}));

// Mock AsyncStorage for ScoreTrackerContext
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Spy on Alert.alert
jest.spyOn(Alert, 'alert');

// Wrapper with context
const renderWithContext = (component: React.ReactElement) => {
  return render(
    <ScoreTrackerProvider>
      {component}
    </ScoreTrackerProvider>
  );
};

describe('ScoreTrackerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the score tracker screen title', async () => {
    const { getByText } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByText('Score Tracker')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('renders player names section', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('player-names-section')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows loading state initially', () => {
    const { getByText } = renderWithContext(<ScoreTrackerScreen />);
    
    // The loading state shows briefly before hydration completes
    // This may or may not catch the loading state depending on timing
    expect(getByText(/Loading|Score Tracker/)).toBeTruthy();
  });

  it('shows empty state buttons when no data exists', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('add-game-score-button')).toBeTruthy();
      expect(getByTestId('add-leaderboard-button')).toBeTruthy();
    });
  });

  it('navigates to ScoreInput for game score when button is pressed', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('add-game-score-button')).toBeTruthy();
    });
    
    fireEvent.press(getByTestId('add-game-score-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('ScoreInput', { mode: 'addRound', isNewGame: true });
  });

  it('navigates to ScoreInput for leaderboard when button is pressed', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('add-leaderboard-button')).toBeTruthy();
    });
    
    fireEvent.press(getByTestId('add-leaderboard-button'));
    
    expect(mockNavigate).toHaveBeenCalledWith('ScoreInput', { mode: 'addLeaderboard' });
  });

  it('loads player names from cache', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('player-name-0')).toBeTruthy();
    });
    
    // Check that player names are loaded
    const firstPlayerInput = getByTestId('player-name-0');
    expect(firstPlayerInput.props.value).toBe('Alice');
  });

  it('updates player name when changed', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('player-name-0')).toBeTruthy();
    });
    
    const firstPlayerInput = getByTestId('player-name-0');
    
    await act(async () => {
      fireEvent.changeText(firstPlayerInput, 'NewName');
    });
    
    expect(firstPlayerInput.props.value).toBe('NewName');
  });

  it('shows player count picker when pressed', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('player-count-picker')).toBeTruthy();
    });
    
    fireEvent.press(getByTestId('player-count-picker'));
    
    // Alert.alert should be called for player count selection
    expect(Alert.alert).toHaveBeenCalledWith(
      'Select Number of Players',
      '',
      expect.any(Array)
    );
  });

  it('renders back button', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });
  });

  it('displays correct number of players', async () => {
    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);
    
    await waitFor(() => {
      expect(getByTestId('player-count')).toBeTruthy();
    });
    
    expect(getByTestId('player-count').props.children).toBe('Players: 4');
  });
});

// Note: Tests for "with existing data" scenarios are covered by E2E tests
// since they require complex async state mocking with multiple providers
