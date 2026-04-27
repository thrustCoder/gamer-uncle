import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import GameScoreSection from '../components/scoreTracker/GameScoreSection';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock ScoreTracker context
const mockClearGameScore = jest.fn();
const mockDeleteRound = jest.fn();
const mockAddLeaderboardEntry = jest.fn();
let mockGameScore: any = null;
let mockRanking: any[] = [];

jest.mock('../store/ScoreTrackerContext', () => ({
  useScoreTracker: () => ({
    gameScore: mockGameScore,
    clearGameScore: mockClearGameScore,
    getGameScoreRanking: () => mockRanking,
    deleteRound: mockDeleteRound,
    addLeaderboardEntry: mockAddLeaderboardEntry,
  }),
}));

// Mock StackRankingChart
jest.mock('../components/scoreTracker/StackRankingChart', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockStackRankingChart() {
    return React.createElement(View, { testID: 'stack-ranking-chart' });
  };
});

// Mock ScoreTable
jest.mock('../components/scoreTracker/ScoreTable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockScoreTable({ data, onEdit }: any) {
    return React.createElement(View, { testID: 'score-table' });
  };
});

describe('GameScoreSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameScore = {
      game: {
        id: 'bgg-13',
        name: 'Catan',
        thumbnailUrl: 'https://example.com/catan.jpg',
        isCustom: false,
      },
      rounds: [
        { roundNumber: 1, scores: { Alice: 10, Bob: 15 }, timestamp: Date.now() },
      ],
      createdAt: Date.now(),
    };
    mockRanking = [
      { player: 'Bob', total: 15 },
      { player: 'Alice', total: 10 },
    ];
  });

  it('renders nothing when gameScore is null', () => {
    mockGameScore = null;
    const { toJSON } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the game name', () => {
    const { getByText } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );
    expect(getByText('Catan')).toBeTruthy();
  });

  it('renders the "Add Round" button', () => {
    const { getByText } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );
    expect(getByText('+ Add Round')).toBeTruthy();
  });

  it('navigates to ScoreInput when Add Round is pressed', () => {
    const { getByText } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('+ Add Round'));
    expect(mockNavigate).toHaveBeenCalledWith('ScoreInput', { mode: 'addRound' });
  });

  it('shows confirmation alert when close button is pressed', () => {
    jest.spyOn(Alert, 'alert');

    const { getByText } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('✕'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Clear Game Score',
      'Are you sure you want to clear the current game score? This cannot be undone.',
      expect.any(Array)
    );
  });

  it('calls clearGameScore when confirming clear', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons: any) => {
      // Find and call the destructive button
      const clearBtn = buttons.find((b: any) => b.text === 'Clear');
      clearBtn?.onPress?.();
    });

    const { getByText } = render(
      <GameScoreSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('✕'));
    expect(mockClearGameScore).toHaveBeenCalledTimes(1);
  });

  describe('Close Game', () => {
    it('renders the "Close Game" button when there is at least one round', () => {
      const { getByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );
      expect(getByText('✓ Close Game')).toBeTruthy();
    });

    it('does not render the "Close Game" button when there are no rounds', () => {
      mockGameScore = { ...mockGameScore, rounds: [] };
      const { queryByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );
      expect(queryByText('✓ Close Game')).toBeNull();
    });

    it('shows confirmation alert when Close Game is pressed', () => {
      jest.spyOn(Alert, 'alert');
      const { getByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );

      fireEvent.press(getByText('✓ Close Game'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Close Game',
        'Close this game and add the total scores to the Leaderboard? This will clear the current game score.',
        expect.any(Array)
      );
    });

    it('adds aggregate scores to leaderboard and clears the game on confirm', () => {
      mockGameScore = {
        ...mockGameScore,
        rounds: [
          { roundNumber: 1, scores: { Alice: 10, Bob: 15 }, timestamp: 1 },
          { roundNumber: 2, scores: { Alice: 5, Bob: 7 }, timestamp: 2 },
          { roundNumber: 3, scores: { Alice: 3, Bob: 8 }, timestamp: 3 },
        ],
        lowestScoreWins: false,
      };
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons: any) => {
        const confirmBtn = buttons.find((b: any) => b.text === 'Close & Save');
        confirmBtn?.onPress?.();
      });

      const { getByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );

      fireEvent.press(getByText('✓ Close Game'));

      expect(mockAddLeaderboardEntry).toHaveBeenCalledTimes(1);
      expect(mockAddLeaderboardEntry).toHaveBeenCalledWith(
        mockGameScore.game,
        { Alice: 18, Bob: 30 },
        false,
      );
      expect(mockClearGameScore).toHaveBeenCalledTimes(1);
    });

    it('preserves lowestScoreWins flag when closing the game', () => {
      mockGameScore = {
        ...mockGameScore,
        rounds: [
          { roundNumber: 1, scores: { Alice: 10, Bob: 15 }, timestamp: 1 },
        ],
        lowestScoreWins: true,
      };
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons: any) => {
        const confirmBtn = buttons.find((b: any) => b.text === 'Close & Save');
        confirmBtn?.onPress?.();
      });

      const { getByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );

      fireEvent.press(getByText('✓ Close Game'));

      expect(mockAddLeaderboardEntry).toHaveBeenCalledWith(
        mockGameScore.game,
        { Alice: 10, Bob: 15 },
        true,
      );
    });

    it('does not add to leaderboard or clear game when Cancel is pressed', () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons: any) => {
        const cancelBtn = buttons.find((b: any) => b.text === 'Cancel');
        cancelBtn?.onPress?.();
      });

      const { getByText } = render(
        <GameScoreSection playerNames={['Alice', 'Bob']} />
      );

      fireEvent.press(getByText('✓ Close Game'));

      expect(mockAddLeaderboardEntry).not.toHaveBeenCalled();
      expect(mockClearGameScore).not.toHaveBeenCalled();
    });
  });
});
