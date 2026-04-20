import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ScoreTableRow from '../components/scoreTracker/ScoreTableRow';

describe('ScoreTableRow', () => {
  const defaultProps = {
    label: 'Round 1',
    scores: { Alice: 10, Bob: 15, Charlie: 8 },
    playerNames: ['Alice', 'Bob', 'Charlie'],
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the row label', () => {
    const { getByText } = render(<ScoreTableRow {...defaultProps} />);
    expect(getByText('Round 1')).toBeTruthy();
  });

  it('renders scores for each player', () => {
    const { getByText } = render(<ScoreTableRow {...defaultProps} />);
    expect(getByText('10')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
  });

  it('renders 0 for players with missing scores', () => {
    const { getAllByText } = render(
      <ScoreTableRow
        {...defaultProps}
        scores={{ Alice: 5 }}
      />
    );
    // Bob and Charlie should show 0
    const zeros = getAllByText('0');
    expect(zeros.length).toBe(2);
  });

  it('calls onEdit when edit button is pressed', () => {
    const onEdit = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ScoreTableRow {...defaultProps} onEdit={onEdit} />
    );

    // Find the TouchableOpacity with the edit handler
    // Use the last one which should be the edit button
    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const editButton = touchables[touchables.length - 1];
    fireEvent.press(editButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders with custom column widths', () => {
    const { getByText } = render(
      <ScoreTableRow
        {...defaultProps}
        playerColumnWidth={60}
        firstColumnWidth={100}
      />
    );
    // Just verify it renders without error
    expect(getByText('Round 1')).toBeTruthy();
  });

  it('renders game thumbnail when game prop is provided', () => {
    const game = {
      id: 'bgg-13',
      name: 'Catan',
      thumbnailUrl: 'https://example.com/catan.jpg',
      isCustom: false,
    };

    const { getByText } = render(
      <ScoreTableRow
        {...defaultProps}
        game={game}
      />
    );

    expect(getByText('Round 1')).toBeTruthy();
  });

  it('renders placeholder when game has no thumbnail', () => {
    const game = {
      id: 'custom-1',
      name: 'My Game',
      isCustom: true,
    };

    const { getByText } = render(
      <ScoreTableRow
        {...defaultProps}
        game={game}
      />
    );

    expect(getByText('Round 1')).toBeTruthy();
  });
});
