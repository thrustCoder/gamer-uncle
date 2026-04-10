import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PlayerNamesSection from '../components/scoreTracker/PlayerNamesSection';

describe('PlayerNamesSection', () => {
  const mockOnPlayerCountPress = jest.fn();
  const mockOnNameChange = jest.fn();
  const mockOnNameBlur = jest.fn();

  const defaultProps = {
    playerCount: 4,
    playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'],
    onPlayerCountPress: mockOnPlayerCountPress,
    onNameChange: mockOnNameChange,
    onNameBlur: mockOnNameBlur,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section heading', () => {
    const { getByText } = render(<PlayerNamesSection {...defaultProps} />);
    expect(getByText('Number of players')).toBeTruthy();
  });

  it('displays the player count', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);
    const button = getByTestId('player-count-button');
    expect(button).toBeTruthy();
  });

  it('calls onPlayerCountPress when count button is pressed', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);
    fireEvent.press(getByTestId('player-count-button'));
    expect(mockOnPlayerCountPress).toHaveBeenCalledTimes(1);
  });

  it('renders name inputs for 4 players', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);

    for (let i = 0; i < 4; i++) {
      expect(getByTestId(`player-name-input-${i}`)).toBeTruthy();
    }
  });

  it('renders name inputs with correct values', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);

    expect(getByTestId('player-name-input-0').props.value).toBe('Alice');
    expect(getByTestId('player-name-input-1').props.value).toBe('Bob');
    expect(getByTestId('player-name-input-2').props.value).toBe('Charlie');
    expect(getByTestId('player-name-input-3').props.value).toBe('Diana');
  });

  it('calls onNameChange when a name input changes', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);

    fireEvent.changeText(getByTestId('player-name-input-0'), 'Alicia');
    expect(mockOnNameChange).toHaveBeenCalledWith(0, 'Alicia');
  });

  it('calls onNameBlur when a name input loses focus', () => {
    const { getByTestId } = render(<PlayerNamesSection {...defaultProps} />);

    fireEvent(getByTestId('player-name-input-0'), 'blur');
    expect(mockOnNameBlur).toHaveBeenCalledWith(0);
  });

  it('does not render name inputs when playerCount > 6', () => {
    const { queryByTestId } = render(
      <PlayerNamesSection
        {...defaultProps}
        playerCount={8}
        playerNames={Array(8).fill('')}
      />
    );

    expect(queryByTestId('player-name-input-0')).toBeNull();
  });

  it('renders name inputs when playerCount is exactly 6', () => {
    const { getByTestId } = render(
      <PlayerNamesSection
        {...defaultProps}
        playerCount={6}
        playerNames={['A', 'B', 'C', 'D', 'E', 'F']}
      />
    );

    for (let i = 0; i < 6; i++) {
      expect(getByTestId(`player-name-input-${i}`)).toBeTruthy();
    }
  });

  it('renders 2 player name inputs for 2 players', () => {
    const { getByTestId, queryByTestId } = render(
      <PlayerNamesSection
        {...defaultProps}
        playerCount={2}
        playerNames={['Player1', 'Player2']}
      />
    );

    expect(getByTestId('player-name-input-0')).toBeTruthy();
    expect(getByTestId('player-name-input-1')).toBeTruthy();
    expect(queryByTestId('player-name-input-2')).toBeNull();
  });

  it('uses placeholder for missing names', () => {
    const { getByTestId } = render(
      <PlayerNamesSection
        {...defaultProps}
        playerCount={3}
        playerNames={['Alice']}
      />
    );

    expect(getByTestId('player-name-input-0').props.value).toBe('Alice');
    // Index 1 and 2 have undefined playerNames, so value should be ''
    expect(getByTestId('player-name-input-1').props.value).toBe('');
    expect(getByTestId('player-name-input-2').props.value).toBe('');
  });
});
