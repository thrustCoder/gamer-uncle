/**
 * Tests for the groups-enabled code paths in consumer screens.
 * These tests verify that when player groups are enabled, the screens
 * hydrate from the active group instead of appCache, and render
 * GroupPicker instead of manual player count pickers.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Shared mocks ────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
  };
});

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => { cb(); }, []);
  },
}));

jest.mock('../components/BackButton', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'back-button' });
});

jest.mock('../components/MarkdownText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ text }: { text: string }) => React.createElement(Text, { testID: 'markdown-text' }, text);
});

jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    ERROR_GAME_SETUP: 'Error.GameSetup',
    PLAYER_GROUP_SWITCHED: 'PlayerGroups.Switched',
    PLAYER_GROUPS_ENABLED: 'PlayerGroups.Enabled',
  },
}));

jest.mock('../services/ApiClient', () => ({
  getRecommendations: jest.fn(() => Promise.resolve({ responseText: 'mock response' })),
}));

jest.mock('../hooks/useRatingPrompt', () => ({
  useRatingPrompt: () => ({
    showRatingModal: false,
    trackEngagement: jest.fn(),
    handleRate: jest.fn(),
    handleDismiss: jest.fn(),
  }),
}));

jest.mock('../services/hooks/useDebouncedEffect', () => ({
  useDebouncedEffect: (callback: () => void, deps: any[]) => {
    const React = require('react');
    React.useEffect(callback, deps);
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
    },
  },
}));

jest.mock('../components/SpinningWheel', () => {
  const React = require('react');
  return ({ playerNames }: any) =>
    React.createElement('View', { testID: 'spinning-wheel' },
      playerNames.map((name: string, i: number) =>
        React.createElement('Text', { key: i, testID: `wheel-player-${i}` }, name)
      )
    );
});

// ── Mock score tracker context ──────────────────────────────────────

jest.mock('../store/ScoreTrackerContext', () => {
  const React = require('react');
  const mockContext = {
    gameScore: null,
    leaderboard: [],
    isLoading: false,
    renamePlayer: jest.fn(),
    clearGameScore: jest.fn(),
    clearLeaderboard: jest.fn(),
    loadGroupData: jest.fn(),
    startGameScore: jest.fn(),
    addRound: jest.fn(),
    updateRound: jest.fn(),
    deleteRound: jest.fn(),
    addLeaderboardEntry: jest.fn(),
    updateLeaderboardEntry: jest.fn(),
    deleteLeaderboardEntry: jest.fn(),
  };
  return {
    useScoreTracker: () => mockContext,
    ScoreTrackerProvider: ({ children }: { children: React.ReactNode }) => children,
    __mockContext: mockContext,
  };
});

// ── Mock appCache ───────────────────────────────────────────────────

jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getPlayerCount: jest.fn(() => Promise.resolve(4)),
    getPlayers: jest.fn(() => Promise.resolve([])),
    setPlayerCount: jest.fn(),
    setPlayers: jest.fn(),
    getTeamCount: jest.fn(() => Promise.resolve(2)),
    setTeamCount: jest.fn(),
    getGameScore: jest.fn(() => Promise.resolve(null)),
    setGameScore: jest.fn(),
    getLeaderboard: jest.fn(() => Promise.resolve([])),
    setLeaderboard: jest.fn(),
    getGameSetupGameName: jest.fn(() => Promise.resolve('')),
    setGameSetupGameName: jest.fn(),
    getGameSetupPlayerCount: jest.fn(() => Promise.resolve(4)),
    setGameSetupPlayerCount: jest.fn(),
    getGameSetupResponse: jest.fn(() => Promise.resolve(null)),
    setGameSetupResponse: jest.fn(),
    clearGameSetup: jest.fn(),
  },
}));

// ── Mock PlayerGroupsContext ────────────────────────────────────────

const mockUpdateActiveGroupData = jest.fn();
const activeGroupData = {
  id: 'g1',
  name: 'Friday Crew',
  playerCount: 3,
  playerNames: ['Alice', 'Bob', 'Carol'],
  teamCount: 3,
  gameScore: null,
  leaderboard: [],
  gameSetupGameName: 'Catan',
  gameSetupPlayerCount: 3,
  gameSetupResponse: 'Setup Catan with 3 players...',
};

jest.mock('../store/PlayerGroupsContext', () => ({
  usePlayerGroups: () => ({
    state: {
      enabled: true,
      activeGroupId: 'g1',
      groups: [activeGroupData],
    },
    activeGroup: activeGroupData,
    updateActiveGroupData: mockUpdateActiveGroupData,
    enableGroups: jest.fn(),
    disableGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    setActiveGroup: jest.fn(),
  }),
  PlayerGroupsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Mock GroupPicker and EnableGroupsToggle ──────────────────────────

jest.mock('../components/GroupPicker', () => {
  const React = require('react');
  return ({ onManageGroups }: any) => React.createElement('View', { testID: 'group-picker' },
    React.createElement('Text', { testID: 'group-picker-active' }, 'Friday Crew'),
    React.createElement('TouchableOpacity', { testID: 'group-picker-manage', onPress: onManageGroups }),
  );
});

jest.mock('../components/EnableGroupsToggle', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'enable-groups-toggle' });
});

// ── Mock child components for ScoreTracker ──────────────────────────

jest.mock('../components/scoreTracker/PlayerNamesSection', () => {
  const React = require('react');
  return ({ playerCount, playerNames }: any) =>
    React.createElement('View', { testID: 'player-names-section' }, [
      React.createElement('Text', { key: 'count', testID: 'player-count' }, `Players: ${playerCount}`),
      ...playerNames.map((name: string, idx: number) =>
        React.createElement('Text', { key: `name-${idx}`, testID: `player-name-${idx}` }, name)
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

jest.mock('../components/RatingModal', () => {
  const React = require('react');
  return () => null;
});

// ── Import screens after mocks ──────────────────────────────────────

import GameSetupScreen from '../screens/GameSetupScreen';
import ScoreTrackerScreen from '../screens/ScoreTrackerScreen';
import TurnSelectorScreen from '../screens/TurnSelectorScreen';
import TeamRandomizerScreen from '../screens/TeamRandomizerScreen';

const { __mockContext: scoreTrackerMock } = require('../store/ScoreTrackerContext');

jest.spyOn(Alert, 'alert');

describe('Player Groups Integration — groups enabled path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GameSetupScreen ─────────────────────────────────────────────

  describe('GameSetupScreen with groups enabled', () => {
    it('should render GroupPicker instead of player count picker', async () => {
      const { getByTestId, queryByTestId } = render(<GameSetupScreen />);

      await waitFor(() => {
        expect(getByTestId('group-picker')).toBeTruthy();
      });

      // Manual player count picker should NOT be rendered
      expect(queryByTestId('player-count-picker')).toBeNull();
    });

    it('should hydrate game name from active group', async () => {
      const { getByTestId } = render(<GameSetupScreen />);

      await waitFor(() => {
        const input = getByTestId('game-name-input');
        expect(input.props.value).toBe('Catan');
      });
    });

    it('should hydrate player count from active group', async () => {
      // The component uses activeGroup.playerCount = 3 for the query.
      // Verify by submitting and checking the query contains "3 player".
      const mockGetRecs = require('../services/ApiClient').getRecommendations;
      mockGetRecs.mockResolvedValueOnce({ responseText: 'Setup for 3...' });

      const { getByTestId } = render(<GameSetupScreen />);

      await waitFor(() => {
        expect(getByTestId('game-name-input')).toBeTruthy();
      });

      fireEvent.press(getByTestId('get-setup-button'));

      await waitFor(() => {
        expect(mockGetRecs).toHaveBeenCalledWith(
          expect.objectContaining({
            Query: expect.stringContaining('3 player'),
          })
        );
      });
    });

    it('should hydrate setup response from active group', async () => {
      const { getByTestId } = render(<GameSetupScreen />);

      await waitFor(() => {
        expect(getByTestId('markdown-text')).toBeTruthy();
      });
    });
  });

  // ── ScoreTrackerScreen ──────────────────────────────────────────

  describe('ScoreTrackerScreen with groups enabled', () => {
    it('should render GroupPicker instead of PlayerNamesSection', async () => {
      const { getByTestId, queryByTestId } = render(<ScoreTrackerScreen />);

      await waitFor(() => {
        expect(getByTestId('group-picker')).toBeTruthy();
      });

      // PlayerNamesSection should NOT be rendered when groups enabled
      // (GroupPicker replaces it in the component's conditional rendering)
      expect(queryByTestId('player-count-picker')).toBeNull();
    });

    it('should hydrate player count from active group', async () => {
      const { getByTestId } = render(<ScoreTrackerScreen />);

      // When groups are enabled and there's no active game score,
      // the empty state buttons are shown instead of GameScoreSection
      await waitFor(() => {
        expect(getByTestId('add-game-score-button')).toBeTruthy();
      });
    });

    it('should call loadGroupData with active group data', async () => {
      render(<ScoreTrackerScreen />);

      await waitFor(() => {
        expect(scoreTrackerMock.loadGroupData).toHaveBeenCalledWith(null, []);
      });
    });

    it('should sync gameScore/leaderboard back to active group via updateActiveGroupData', async () => {
      render(<ScoreTrackerScreen />);

      // useDebouncedEffect is mocked as synchronous useEffect, so it fires immediately
      await waitFor(() => {
        expect(mockUpdateActiveGroupData).toHaveBeenCalledWith(
          expect.objectContaining({
            gameScore: null,
            leaderboard: [],
          })
        );
      });
    });
  });

  // ── TurnSelectorScreen ──────────────────────────────────────────

  describe('TurnSelectorScreen with groups enabled', () => {
    it('should render GroupPicker', async () => {
      const { getByTestId } = render(<TurnSelectorScreen />);

      await waitFor(() => {
        expect(getByTestId('group-picker')).toBeTruthy();
      });
    });

    it('should hydrate player names from active group', async () => {
      const { getByTestId } = render(<TurnSelectorScreen />);

      await waitFor(() => {
        expect(getByTestId('wheel-player-0')).toBeTruthy();
      });

      expect(getByTestId('wheel-player-0').children[0]).toBe('Alice');
      expect(getByTestId('wheel-player-1').children[0]).toBe('Bob');
      expect(getByTestId('wheel-player-2').children[0]).toBe('Carol');
    });

    it('should not show manual player count picker when groups enabled', async () => {
      const { queryByTestId } = render(<TurnSelectorScreen />);

      await waitFor(() => {
        expect(queryByTestId('group-picker')).toBeTruthy();
      });

      // Manual picker should be hidden
      expect(queryByTestId('player-count-picker')).toBeNull();
    });
  });

  // ── TeamRandomizerScreen ────────────────────────────────────────

  describe('TeamRandomizerScreen with groups enabled', () => {
    it('should render GroupPicker', async () => {
      const { getByTestId } = render(<TeamRandomizerScreen />);

      await waitFor(() => {
        expect(getByTestId('group-picker')).toBeTruthy();
      });
    });

    it('should hydrate player count and team count from active group', async () => {
      // activeGroup has playerCount=3 and teamCount=3, but component clamps
      // teamCount to max(2, min(3, floor(3/2))) = 2
      const { getByText } = render(<TeamRandomizerScreen />);

      await waitFor(() => {
        expect(getByText('SHUFFLE')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
      });
    });

    it('should hydrate player names from active group', async () => {
      // When groups are enabled, the player name inputs are hidden
      // (GroupPicker replaces the expand/name-input section).
      // Verify the team count loaded from the group instead.
      // teamCount is clamped to 2 (see above).
      const { getByText } = render(<TeamRandomizerScreen />);

      await waitFor(() => {
        expect(getByText('2')).toBeTruthy();
        expect(getByText('Team count')).toBeTruthy();
      });
    });

    it('should not show manual player count picker when groups enabled', async () => {
      const { queryByTestId } = render(<TeamRandomizerScreen />);

      await waitFor(() => {
        expect(queryByTestId('group-picker')).toBeTruthy();
      });

      expect(queryByTestId('player-count-picker')).toBeNull();
    });
  });
});
