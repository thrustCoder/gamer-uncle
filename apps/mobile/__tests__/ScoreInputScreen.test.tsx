import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ScoreInputScreen from '../screens/ScoreInputScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = { mode: 'addRound' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
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

// Mock GameSearchModal
jest.mock('../components/scoreTracker/GameSearchModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockGameSearchModal({ visible }: { visible: boolean }) {
    if (!visible) return null;
    return React.createElement(View, { testID: 'game-search-modal' });
  };
});

// Mock RatingModal
jest.mock('../components/RatingModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockRatingModal({ visible }: { visible: boolean }) {
    if (!visible) return null;
    return React.createElement(View, { testID: 'rating-modal' });
  };
});

// Mock ScoreTracker context
const mockStartGameScore = jest.fn();
const mockAddRound = jest.fn();
const mockUpdateRound = jest.fn();
const mockDeleteRound = jest.fn();
const mockAddLeaderboardEntry = jest.fn();
const mockUpdateLeaderboardEntry = jest.fn();
const mockDeleteLeaderboardEntry = jest.fn();

jest.mock('../store/ScoreTrackerContext', () => ({
  useScoreTracker: () => ({
    gameScore: mockGameScore,
    startGameScore: mockStartGameScore,
    addRound: mockAddRound,
    updateRound: mockUpdateRound,
    deleteRound: mockDeleteRound,
    addLeaderboardEntry: mockAddLeaderboardEntry,
    updateLeaderboardEntry: mockUpdateLeaderboardEntry,
    deleteLeaderboardEntry: mockDeleteLeaderboardEntry,
    leaderboard: [],
  }),
}));

// Mock appCache
jest.mock('../services/storage/appCache', () => ({
  appCache: {
    getPlayerCount: jest.fn(() => Promise.resolve(3)),
    getPlayers: jest.fn(() => Promise.resolve(['Alice', 'Bob', 'Charlie'])),
  },
}));

// Mock ratingPrompt
jest.mock('../services/ratingPrompt', () => ({
  incrementEngagement: jest.fn(() => Promise.resolve()),
  shouldShowFeatureRatingPrompt: jest.fn(() => Promise.resolve(false)),
  resetAllEngagementCounters: jest.fn(() => Promise.resolve()),
  recordDismissal: jest.fn(() => Promise.resolve()),
  recordRated: jest.fn(() => Promise.resolve()),
  requestStoreReview: jest.fn(() => Promise.resolve()),
  resetRatingStateForDev: jest.fn(),
  RatingFeatureKeys: {
    SCORE_TRACKER_GAME_SCORE: 'score_tracker_game_score',
    SCORE_TRACKER_LEADERBOARD: 'score_tracker_leaderboard',
  },
}));

// Mock Telemetry
jest.mock('../services/Telemetry', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    RATING_PROMPT_SHOWN: 'rating_prompt_shown',
    RATING_PROMPT_RATED: 'rating_prompt_rated',
    RATING_PROMPT_DISMISSED: 'rating_prompt_dismissed',
  },
}));

let mockGameScore: any = null;

describe('ScoreInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { mode: 'addRound' };
    mockGameScore = null;
    // Restore appCache mocks to default behavior
    const { appCache } = require('../services/storage/appCache');
    appCache.getPlayerCount.mockImplementation(() => Promise.resolve(3));
    appCache.getPlayers.mockImplementation(() => Promise.resolve(['Alice', 'Bob', 'Charlie']));
  });

  describe('Add Round mode', () => {
    it('renders with correct title', async () => {
      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Add Round')).toBeTruthy();
      });
    });

    it('renders player name labels after loading', async () => {
      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();
        expect(getByText('Charlie')).toBeTruthy();
      });
    });

    it('shows loading state initially', () => {
      // Mock slow cache
      const { appCache } = require('../services/storage/appCache');
      appCache.getPlayerCount.mockReturnValue(new Promise(() => {})); // never resolves

      const { getByText } = render(<ScoreInputScreen />);
      expect(getByText('Loading...')).toBeTruthy();
    });
  });

  describe('Edit Round mode', () => {
    it('renders correct title with round number', async () => {
      mockRouteParams = {
        mode: 'editRound',
        roundNumber: 3,
        existingScores: { Alice: 10, Bob: 15, Charlie: 8 },
      };

      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Edit Round 3')).toBeTruthy();
      });
    });
  });

  describe('Add Leaderboard mode', () => {
    it('renders correct title', async () => {
      mockRouteParams = { mode: 'addLeaderboard' };

      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Add Game to Leaderboard')).toBeTruthy();
      });
    });

    it('shows game select button', async () => {
      mockRouteParams = { mode: 'addLeaderboard' };

      const { getByTestId } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByTestId('game-select-button')).toBeTruthy();
      });
    });
  });

  describe('Edit Leaderboard mode', () => {
    it('renders correct title', async () => {
      mockRouteParams = { mode: 'editLeaderboard', entryIndex: 0 };

      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Edit Leaderboard Entry')).toBeTruthy();
      });
    });
  });

  describe('New Game Score mode', () => {
    it('renders correct title', async () => {
      mockRouteParams = { mode: 'addRound', isNewGame: true };

      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('New Game Score')).toBeTruthy();
      });
    });
  });

  describe('score input interactions', () => {
    it('renders increment and decrement buttons for each player', async () => {
      const { getAllByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        const plusButtons = getAllByText('+');
        const minusButtons = getAllByText('−');
        expect(plusButtons.length).toBe(3); // 3 players
        expect(minusButtons.length).toBe(3);
      });
    });
  });

  describe('delete functionality', () => {
    it('shows confirmation alert for round deletion', async () => {
      mockRouteParams = {
        mode: 'editRound',
        roundNumber: 2,
        existingScores: { Alice: 5, Bob: 3, Charlie: 7 },
      };
      jest.spyOn(Alert, 'alert');

      const { getByText } = render(<ScoreInputScreen />);
      await waitFor(() => {
        expect(getByText('Edit Round 2')).toBeTruthy();
      });

      const deleteBtn = getByText('Delete Round');
      fireEvent.press(deleteBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Round 2?',
        'This round and its scores will be permanently removed.',
        expect.any(Array)
      );
    });
  });
});
