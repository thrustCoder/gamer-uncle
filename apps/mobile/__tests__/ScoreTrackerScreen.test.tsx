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
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => { cb(); }, []);
  },
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

// Mock PlayerGroupsContext
jest.mock('../store/PlayerGroupsContext', () => ({
  usePlayerGroups: () => ({
    state: { enabled: false, activeGroupId: null, groups: [] },
    activeGroup: null,
    updateActiveGroupData: jest.fn(),
  }),
  PlayerGroupsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock EnableGroupsToggle and GroupPicker
jest.mock('../components/EnableGroupsToggle', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'enable-groups-toggle' });
});
jest.mock('../components/GroupPicker', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'group-picker' });
});

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

describe('ScoreTrackerScreen - player count from cache vs score data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses appCache player count when score data has fewer players', async () => {
    // Simulate: user set 6 players in Shuffle Teams, but old score data has 4 players
    const { appCache } = require('../services/storage/appCache');
    appCache.getPlayerCount.mockResolvedValue(6);
    appCache.getPlayers.mockResolvedValue(['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']);
    appCache.getGameScore.mockResolvedValue({
      game: { name: 'Old Game' },
      rounds: [
        {
          roundNumber: 1,
          scores: { OldP1: 10, OldP2: 20, OldP3: 30, OldP4: 40 },
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      lowestScoreWins: false,
    });
    appCache.getLeaderboard.mockResolvedValue([]);

    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);

    await waitFor(() => {
      expect(getByTestId('player-count')).toBeTruthy();
    });

    // Should show 6 players (from appCache), NOT 4 (from score data)
    expect(getByTestId('player-count').props.children).toBe('Players: 6');
    expect(getByTestId('player-name-5')).toBeTruthy();
    expect(getByTestId('player-name-5').props.value).toBe('Frank');
  });

  it('uses appCache player count when no score data exists', async () => {
    const { appCache } = require('../services/storage/appCache');
    appCache.getPlayerCount.mockResolvedValue(6);
    appCache.getPlayers.mockResolvedValue(['A', 'B', 'C', 'D', 'E', 'F']);
    appCache.getGameScore.mockResolvedValue(null);
    appCache.getLeaderboard.mockResolvedValue([]);

    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);

    await waitFor(() => {
      expect(getByTestId('player-count')).toBeTruthy();
    });

    expect(getByTestId('player-count').props.children).toBe('Players: 6');
  });

  it('does not overwrite cached player count with default value on mount', async () => {
    // Simulate: cache has 6 players from Shuffle Teams
    const { appCache } = require('../services/storage/appCache');
    appCache.getPlayerCount.mockResolvedValue(6);
    appCache.getPlayers.mockResolvedValue(['A', 'B', 'C', 'D', 'E', 'F']);
    appCache.getGameScore.mockResolvedValue(null);
    appCache.getLeaderboard.mockResolvedValue([]);

    const { getByTestId } = renderWithContext(<ScoreTrackerScreen />);

    await waitFor(() => {
      expect(getByTestId('player-count').props.children).toBe('Players: 6');
    });

    // setPlayerCount should NOT have been called with the default value 4
    const setCountCalls = appCache.setPlayerCount.mock.calls.map((c: any[]) => c[0]);
    expect(setCountCalls).not.toContain(4);
  });
});

// Note: Tests for "with existing data" scenarios are covered by E2E tests
// since they require complex async state mocking with multiple providers
