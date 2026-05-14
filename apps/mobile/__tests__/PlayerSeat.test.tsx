import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import PlayerSeat, { getInitials, getSeatLabelFontSize } from '../components/turnTracker/PlayerSeat';

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

describe('getSeatLabelFontSize', () => {
  it('uses the max font for short labels in large seats', () => {
    expect(getSeatLabelFontSize(64, 'AL')).toBe(22);
    expect(getSeatLabelFontSize(96, 'P1')).toBe(22);
  });

  it('shrinks the font so longer labels fit in small seats without ellipsis', () => {
    // A 3-char label in a 40px seat must use a smaller font than the default.
    const small = getSeatLabelFontSize(40, 'P18');
    expect(small).toBeLessThan(22);
    expect(small).toBeGreaterThanOrEqual(10);
    // A 4-char label is shrunk further than a 3-char label at the same size.
    expect(getSeatLabelFontSize(40, 'P100')).toBeLessThanOrEqual(small);
  });

  it('never returns a font smaller than the readable minimum', () => {
    expect(getSeatLabelFontSize(20, 'PLAYER')).toBeGreaterThanOrEqual(10);
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

  it('renders + placeholder for empty seats and omits the Seat sub-label', () => {
    const { getByText, queryByText } = render(
      <PlayerSeat {...baseProps} name="" state="empty" />
    );
    expect(getByText('+')).toBeTruthy();
    // Empty seats no longer render a "Seat N" label below the circle —
    // the dashed border + "+" already communicate "tap to assign", and
    // the labels overlapped each other on large rosters.
    expect(queryByText('Seat 1')).toBeNull();
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

  it('prefers displayLabel over getInitials when provided', () => {
    const { getByTestId, queryByText } = render(
      <PlayerSeat {...baseProps} name="P18" state="filled" displayLabel="P18" />
    );
    // The full unique prefix should be used inside the seat circle…
    const seat = getByTestId('seat-0');
    const innerText = (seat.props.children as any)?.props?.children;
    expect(innerText).toBe('P18');
    // …instead of the legacy two-letter "P1" initials.
    expect(queryByText('P1')).toBeNull();
  });

  it('falls back to getInitials when displayLabel is omitted', () => {
    const { getByTestId } = render(
      <PlayerSeat {...baseProps} name="Alice" state="filled" />
    );
    const seat = getByTestId('seat-0');
    const innerText = (seat.props.children as any)?.props?.children;
    expect(innerText).toBe('AL');
  });

  it('hides the sub-label when the inner label already shows the full name (e.g. P18)', () => {
    // Default placeholder players ("P18") get a unique prefix label equal to
    // their name. Showing the same text again below the circle would just
    // duplicate the inner label.
    const { queryAllByText } = render(
      <PlayerSeat {...baseProps} name="P18" state="filled" displayLabel="P18" />
    );
    expect(queryAllByText('P18')).toHaveLength(1);
  });

  it('still renders the sub-label when the name carries info beyond the inner label', () => {
    // Real names get truncated to initials inside the circle ("AL"), so the
    // full name stays useful as a sub-label.
    const { getByText } = render(
      <PlayerSeat {...baseProps} name="Alice" state="filled" displayLabel="A" />
    );
    expect(getByText('Alice')).toBeTruthy();
  });
});
