import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LeaderboardSection from '../components/scoreTracker/LeaderboardSection';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock ScoreTracker context
const mockClearLeaderboard = jest.fn();
const mockDeleteLeaderboardEntry = jest.fn();
let mockLeaderboard: any[] = [];
let mockRanking: any[] = [];

jest.mock('../../store/ScoreTrackerContext', () => ({
  useScoreTracker: () => ({
    leaderboard: mockLeaderboard,
    clearLeaderboard: mockClearLeaderboard,
    getLeaderboardRanking: () => mockRanking,
    deleteLeaderboardEntry: mockDeleteLeaderboardEntry,
  }),
}));

// Mock StackRankingChart
jest.mock('./StackRankingChart', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockStackRankingChart() {
    return React.createElement(View, { testID: 'stack-ranking-chart' });
  };
});

// Mock ScoreTable
jest.mock('./ScoreTable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockScoreTable() {
    return React.createElement(View, { testID: 'score-table' });
  };
});

describe('LeaderboardSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLeaderboard = [
      {
        game: { id: 'bgg-13', name: 'Catan', thumbnailUrl: null, isCustom: false },
        scores: { Alice: 30, Bob: 25 },
        timestamp: Date.now(),
      },
      {
        game: { id: 'bgg-42', name: 'Risk', thumbnailUrl: null, isCustom: false },
        scores: { Alice: 40, Bob: 20 },
        timestamp: Date.now(),
      },
    ];
    mockRanking = [
      { player: 'Alice', total: 70 },
      { player: 'Bob', total: 45 },
    ];
  });

  it('renders nothing when leaderboard is empty', () => {
    mockLeaderboard = [];
    const { toJSON } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders leaderboard title', () => {
    const { getByText } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );
    expect(getByText(/Leaderboard/)).toBeTruthy();
  });

  it('renders the "Add Game" button', () => {
    const { getByText } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );
    expect(getByText('+ Add Game')).toBeTruthy();
  });

  it('navigates to ScoreInput addLeaderboard when Add Game is pressed', () => {
    const { getByText } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('+ Add Game'));
    expect(mockNavigate).toHaveBeenCalledWith('ScoreInput', { mode: 'addLeaderboard' });
  });

  it('shows confirmation alert when close button is pressed', () => {
    jest.spyOn(Alert, 'alert');

    const { getByText } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('✕'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Clear Leaderboard',
      'Are you sure you want to clear the entire leaderboard? This cannot be undone.',
      expect.any(Array)
    );
  });

  it('calls clearLeaderboard when confirming clear', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons: any) => {
      const clearBtn = buttons.find((b: any) => b.text === 'Clear');
      clearBtn?.onPress?.();
    });

    const { getByText } = render(
      <LeaderboardSection playerNames={['Alice', 'Bob']} />
    );

    fireEvent.press(getByText('✕'));
    expect(mockClearLeaderboard).toHaveBeenCalledTimes(1);
  });
});
