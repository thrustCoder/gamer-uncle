import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import PlayerSeat, { getInitials } from '../components/turnTracker/PlayerSeat';

describe('getInitials', () => {
  it('returns ? for empty', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('returns first 2 chars uppercased for single-token names', () => {
    expect(getInitials('alice')).toBe('AL');
    expect(getInitials('Bo')).toBe('BO');
    expect(getInitials('X')).toBe('X');
  });

  it('returns first letter of first two tokens for multi-word names', () => {
    expect(getInitials('Alice Wonderland')).toBe('AW');
    expect(getInitials('john   doe   smith')).toBe('JD');
  });
});

describe('PlayerSeat', () => {
  const baseProps = {
    name: 'Alice',
    seatNumber: 1,
    size: 64,
    left: 0,
    top: 0,
  } as const;

  it('renders initials for filled seats', () => {
    const { getByText } = render(
      <PlayerSeat {...baseProps} state="active" />
    );
    expect(getByText('AL')).toBeTruthy();
  });

  it('renders + placeholder for empty seats and uses Seat label', () => {
    const { getByText } = render(
      <PlayerSeat {...baseProps} name="" state="empty" />
    );
    expect(getByText('+')).toBeTruthy();
    expect(getByText('Seat 1')).toBeTruthy();
  });

  it('invokes onPress for tap/empty/filled states', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(
      <PlayerSeat {...baseProps} state="tap" onPress={onPress} />
    );
    fireEvent.press(getByTestId('seat-0-touch'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<PlayerSeat {...baseProps} state="empty" name="" onPress={onPress} />);
    fireEvent.press(getByTestId('seat-0-touch'));
    expect(onPress).toHaveBeenCalledTimes(2);

    rerender(<PlayerSeat {...baseProps} state="filled" onPress={onPress} />);
    fireEvent.press(getByTestId('seat-0-touch'));
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('does not render a TouchableOpacity for active or idle states', () => {
    const onPress = jest.fn();
    const { queryByTestId, rerender } = render(
      <PlayerSeat {...baseProps} state="active" onPress={onPress} />
    );
    // The press target should NOT exist for active state
    expect(queryByTestId('seat-0-touch')).toBeNull();

    // Idle (other in-game seats) is not tappable either
    rerender(<PlayerSeat {...baseProps} state="idle" onPress={onPress} />);
    expect(queryByTestId('seat-0-touch')).toBeNull();
  });
});
