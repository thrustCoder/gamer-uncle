import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import PlayerPickerModal from '../components/turnTracker/PlayerPickerModal';

describe('PlayerPickerModal', () => {
  const baseProps = {
    visible: true,
    playerNames: ['Alice', 'Bob', 'Carol', 'Dave'],
    seatNumber: 1,
    onPick: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all player names', () => {
    const { getByText } = render(
      <PlayerPickerModal {...baseProps} seatedPlayerIndices={[]} currentSelection={null} />
    );
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Dave')).toBeTruthy();
  });

  it('marks already-seated players as disabled (except the current selection)', () => {
    const { getByText, getByTestId } = render(
      <PlayerPickerModal
        {...baseProps}
        seatedPlayerIndices={[0, 2]}
        currentSelection={2}
      />
    );
    // Alice is seated elsewhere → disabled subtext shown
    expect(getByText('Already seated')).toBeTruthy();
    // Carol is the current selection → "Currently in this seat" shown
    expect(getByText('Currently in this seat')).toBeTruthy();

    // Pressing Alice (disabled) should NOT call onPick
    fireEvent.press(getByTestId('player-picker-row-0'));
    expect(baseProps.onPick).not.toHaveBeenCalled();
  });

  it('invokes onPick with the selected player index', () => {
    const onPick = jest.fn();
    const { getByTestId } = render(
      <PlayerPickerModal
        {...baseProps}
        onPick={onPick}
        seatedPlayerIndices={[]}
        currentSelection={null}
      />
    );
    fireEvent.press(getByTestId('player-picker-row-1'));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('shows clear-seat action only when editing a filled seat', () => {
    const onClear = jest.fn();
    const { queryByTestId, rerender } = render(
      <PlayerPickerModal
        {...baseProps}
        seatedPlayerIndices={[1]}
        currentSelection={null}
        onClear={onClear}
      />
    );
    expect(queryByTestId('player-picker-clear')).toBeNull();

    rerender(
      <PlayerPickerModal
        {...baseProps}
        seatedPlayerIndices={[1]}
        currentSelection={1}
        onClear={onClear}
      />
    );
    expect(queryByTestId('player-picker-clear')).not.toBeNull();
  });

  it('invokes onClose when cancel is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PlayerPickerModal
        {...baseProps}
        onClose={onClose}
        seatedPlayerIndices={[]}
        currentSelection={null}
      />
    );
    fireEvent.press(getByTestId('player-picker-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
