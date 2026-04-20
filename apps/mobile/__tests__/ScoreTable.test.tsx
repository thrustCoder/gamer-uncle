import React from 'react';
import { render } from '@testing-library/react-native';
import ScoreTable from '../components/scoreTracker/ScoreTable';

// Mock ScoreTableRow
jest.mock('../components/scoreTracker/ScoreTableRow', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockScoreTableRow({ label, scores, playerNames }: any) {
    return React.createElement(View, { testID: `row-${label}` },
      React.createElement(Text, null, label),
      ...playerNames.map((name: string, i: number) =>
        React.createElement(Text, { key: i }, `${name}:${scores[name] ?? 0}`)
      )
    );
  };
});

// Mock initialsUtils
jest.mock('../utils/initialsUtils', () => ({
  generateUniqueInitials: (names: string[]) => {
    const result: Record<string, string> = {};
    names.forEach((name) => {
      result[name] = name.substring(0, 2).toUpperCase();
    });
    return result;
  },
}));

describe('ScoreTable', () => {
  const mockOnEdit = jest.fn();

  const defaultProps = {
    playerNames: ['Alice', 'Bob'],
    data: [
      {
        id: 'round-1',
        label: 'Round 1',
        scores: { Alice: 10, Bob: 15 },
        roundNumber: 1,
      },
      {
        id: 'round-2',
        label: 'Round 2',
        scores: { Alice: 20, Bob: 12 },
        roundNumber: 2,
      },
    ],
    firstColumnHeader: 'Round',
    onEdit: mockOnEdit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the table header', () => {
    const { getByText } = render(<ScoreTable {...defaultProps} />);
    expect(getByText('Round')).toBeTruthy();
  });

  it('renders player initials in header', () => {
    const { getByText } = render(<ScoreTable {...defaultProps} />);
    expect(getByText('AL')).toBeTruthy();
    expect(getByText('BO')).toBeTruthy();
  });

  it('renders all data rows', () => {
    const { getByTestId } = render(<ScoreTable {...defaultProps} />);
    expect(getByTestId('row-Round 1')).toBeTruthy();
    expect(getByTestId('row-Round 2')).toBeTruthy();
  });

  it('renders "No data yet" for empty data', () => {
    const { getByText } = render(
      <ScoreTable {...defaultProps} data={[]} />
    );
    expect(getByText('No data yet')).toBeTruthy();
  });

  it('renders with custom first column header', () => {
    const { getByText } = render(
      <ScoreTable {...defaultProps} firstColumnHeader="Game" />
    );
    expect(getByText('Game')).toBeTruthy();
  });

  it('renders with custom first column width', () => {
    const { getByText } = render(
      <ScoreTable {...defaultProps} firstColumnWidth={120} />
    );
    expect(getByText('Round')).toBeTruthy();
  });

  it('renders with many players', () => {
    const manyPlayers = Array.from({ length: 10 }, (_, i) => `Player${i + 1}`);
    const scores: Record<string, number> = {};
    manyPlayers.forEach((name, i) => { scores[name] = i * 5; });

    const { getByText } = render(
      <ScoreTable
        {...defaultProps}
        playerNames={manyPlayers}
        data={[{ id: 'r1', label: 'Round 1', scores, roundNumber: 1 }]}
      />
    );

    expect(getByText('Round')).toBeTruthy();
  });
});
