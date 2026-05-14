import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import SeatingCircle, {
  getSeatPosition,
  getSeatAngleDeg,
  computeSeatSize,
} from '../components/turnTracker/SeatingCircle';

// react-native-svg's mock can't render the SVG marker reliably; swap it with a
// lightweight stand-in so we can still drive press events from the circle.
jest.mock('../components/turnTracker/TurnMarker', () => {
  const React = require('react');
  const { TouchableOpacity } = require('react-native');
  const MockTurnMarker = ({ onPress, testID }: any) =>
    React.createElement(TouchableOpacity, {
      testID: testID ?? 'turn-marker',
      onPress,
      accessibilityRole: 'button',
    });
  return { __esModule: true, default: MockTurnMarker };
});

describe('getSeatAngleDeg', () => {
  it('returns 0 for the first seat (12 o\'clock)', () => {
    expect(getSeatAngleDeg(0, 4)).toBe(0);
    expect(getSeatAngleDeg(0, 6)).toBe(0);
  });

  it('progresses clockwise around the circle', () => {
    expect(getSeatAngleDeg(1, 4)).toBe(90);
    expect(getSeatAngleDeg(2, 4)).toBe(180);
    expect(getSeatAngleDeg(3, 4)).toBe(270);
  });

  it('handles arbitrary N', () => {
    expect(getSeatAngleDeg(1, 6)).toBeCloseTo(60);
    expect(getSeatAngleDeg(3, 6)).toBeCloseTo(180);
  });
});

describe('getSeatPosition', () => {
  const stage = 300;
  const seat = 60;

  it('places seat 0 at the top centre of the stage', () => {
    const pos = getSeatPosition(0, 4, stage, seat);
    // Top of stage = (stage/2 - radius - seat/2 + (seat/2)) ish; just check x is centred and y is small
    expect(pos.left).toBeCloseTo(stage / 2 - seat / 2);
    expect(pos.top).toBeLessThan(stage / 2); // upper half
  });

  it('places seats symmetrically for even N', () => {
    const top = getSeatPosition(0, 4, stage, seat);
    const right = getSeatPosition(1, 4, stage, seat);
    const bottom = getSeatPosition(2, 4, stage, seat);
    const left = getSeatPosition(3, 4, stage, seat);

    // Symmetry: top and bottom share x
    expect(top.left).toBeCloseTo(bottom.left, 4);
    // left and right share y
    expect(left.top).toBeCloseTo(right.top, 4);
  });

  it('returns valid positions for many players', () => {
    for (let n = 2; n <= 20; n++) {
      for (let i = 0; i < n; i++) {
        const pos = getSeatPosition(i, n, stage, seat);
        expect(Number.isFinite(pos.left)).toBe(true);
        expect(Number.isFinite(pos.top)).toBe(true);
        // Inside the stage bounds
        expect(pos.left).toBeGreaterThanOrEqual(-1);
        expect(pos.top).toBeGreaterThanOrEqual(-1);
        expect(pos.left + seat).toBeLessThanOrEqual(stage + 1);
        expect(pos.top + seat).toBeLessThanOrEqual(stage + 1);
      }
    }
  });
});

describe('computeSeatSize', () => {
  const stage = 304; // approximate phone STAGE_SIZE (390 * 0.78)
  const defaultSize = 64;
  const minSize = 28;

  it('uses the default size for small rosters that easily fit', () => {
    expect(computeSeatSize(2, stage, defaultSize, minSize)).toBe(defaultSize);
    expect(computeSeatSize(4, stage, defaultSize, minSize)).toBe(defaultSize);
    expect(computeSeatSize(8, stage, defaultSize, minSize)).toBe(defaultSize);
  });

  it('shrinks seats once the roster grows past ~10 players', () => {
    const size12 = computeSeatSize(12, stage, defaultSize, minSize);
    const size16 = computeSeatSize(16, stage, defaultSize, minSize);
    const size20 = computeSeatSize(20, stage, defaultSize, minSize);
    // Each step up in player count must not produce a larger seat.
    expect(size12).toBeLessThanOrEqual(defaultSize);
    expect(size16).toBeLessThan(size12);
    expect(size20).toBeLessThanOrEqual(size16);
  });

  it('never returns a seat smaller than the minimum tap target', () => {
    for (let n = 2; n <= 20; n += 1) {
      const size = computeSeatSize(n, stage, defaultSize, minSize);
      expect(size).toBeGreaterThanOrEqual(minSize);
    }
  });

  it('keeps adjacent seats from overlapping for typical phone/tablet stage sizes', () => {
    const stages = [240, 304, 380, 476]; // phone narrow, phone, large phone, tablet
    const gap = 8;
    for (const D of stages) {
      for (let n = 2; n <= 20; n += 1) {
        const seat = computeSeatSize(n, D, defaultSize, minSize, gap);
        // Chord between adjacent seat centres on the inscribed circle.
        const r = D / 2 - seat / 2 - 6;
        const chord = 2 * r * Math.sin(Math.PI / n);
        // Allow a small tolerance — when the spacing falls below the minimum
        // tap target, the floor (`minSize`) takes over and overlap is
        // unavoidable on very small stages. In that case the chord may be
        // less than `seat + gap`, which is acceptable since we'd otherwise
        // produce un-tappable seats.
        if (seat > minSize + 1) {
          expect(chord + 1).toBeGreaterThanOrEqual(seat + gap);
        }
      }
    }
  });

  it('returns the default size for degenerate inputs', () => {
    expect(computeSeatSize(1, stage, defaultSize)).toBe(defaultSize);
    expect(computeSeatSize(0, stage, defaultSize)).toBe(defaultSize);
    expect(computeSeatSize(4, 0, defaultSize)).toBe(defaultSize);
  });
});

describe('SeatingCircle (rendering)', () => {
  const stageSize = 300;
  const seatSize = 64;
  const markerSize = 72;

  const baseSetupProps = {
    inGame: false as const,
    playerCount: 4,
    seats: [null, null, null, null] as (number | null)[],
    getPlayerName: (i: number) => `P${i + 1}`,
    onSeatPress: jest.fn(),
    stageSize,
    seatSize,
    markerSize,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Setup mode', () => {
    it('renders one empty seat per player and no marker', () => {
      const { getByTestId, queryByTestId } = render(<SeatingCircle {...baseSetupProps} />);
      expect(getByTestId('seating-circle')).toBeTruthy();
      for (let i = 0; i < 4; i += 1) {
        expect(getByTestId(`seat-${i}`)).toBeTruthy();
        expect(getByTestId(`seat-${i}-touch`)).toBeTruthy();
      }
      // No TurnMarker in setup mode.
      expect(queryByTestId('turn-marker')).toBeNull();
    });

    it('invokes onSeatPress with the seat index when an empty seat is tapped', () => {
      const onSeatPress = jest.fn();
      const { getByTestId } = render(
        <SeatingCircle {...baseSetupProps} onSeatPress={onSeatPress} />
      );
      fireEvent.press(getByTestId('seat-2-touch'));
      expect(onSeatPress).toHaveBeenCalledWith(2);
    });

    it('renders filled seats with the assigned player label', () => {
      const playerLabels = ['Al', 'Bo', 'Ca', 'Da'];
      const { getByText } = render(
        <SeatingCircle
          {...baseSetupProps}
          seats={[0, 1, null, null]}
          getPlayerName={(i) => ['Alice', 'Bob', 'Carol', 'Dave'][i]!}
          playerLabels={playerLabels}
        />
      );
      // Filled seats use the unique-prefix label; empty seats show "+".
      expect(getByText('Al')).toBeTruthy();
      expect(getByText('Bo')).toBeTruthy();
    });
  });

  describe('In-game mode', () => {
    const inGameProps = {
      inGame: true as const,
      seatOrder: [0, 1, 2, 3],
      getPlayerName: (i: number) => `Player${i + 1}`,
      activeSeatIndex: 0,
      nextSeatIndex: 1,
      prevSeatIndex: 3,
      onMarkerPress: jest.fn(),
      onAdvancePress: jest.fn(),
      onRetractPress: jest.fn(),
      stageSize,
      seatSize,
      markerSize,
    };

    it('renders all seats plus the central turn marker', () => {
      const { getByTestId } = render(<SeatingCircle {...inGameProps} />);
      expect(getByTestId('turn-marker')).toBeTruthy();
      for (let i = 0; i < 4; i += 1) {
        expect(getByTestId(`seat-${i}`)).toBeTruthy();
      }
    });

    it('makes only the next and prev seats tappable; active/idle seats are not', () => {
      const { queryByTestId } = render(<SeatingCircle {...inGameProps} />);
      // Active seat (index 0) is not tappable.
      expect(queryByTestId('seat-0-touch')).toBeNull();
      // Next seat (index 1) is tappable.
      expect(queryByTestId('seat-1-touch')).not.toBeNull();
      // Idle seat (index 2) is not tappable.
      expect(queryByTestId('seat-2-touch')).toBeNull();
      // Prev seat (index 3) is tappable.
      expect(queryByTestId('seat-3-touch')).not.toBeNull();
    });

    it('tapping the next seat fires onAdvancePress', () => {
      const onAdvancePress = jest.fn();
      const { getByTestId } = render(
        <SeatingCircle {...inGameProps} onAdvancePress={onAdvancePress} />
      );
      fireEvent.press(getByTestId('seat-1-touch'));
      expect(onAdvancePress).toHaveBeenCalledTimes(1);
    });

    it('tapping the prev seat fires onRetractPress', () => {
      const onRetractPress = jest.fn();
      const { getByTestId } = render(
        <SeatingCircle {...inGameProps} onRetractPress={onRetractPress} />
      );
      fireEvent.press(getByTestId('seat-3-touch'));
      expect(onRetractPress).toHaveBeenCalledTimes(1);
    });

    it('tapping the central marker fires onMarkerPress', () => {
      const onMarkerPress = jest.fn();
      const { getByTestId } = render(
        <SeatingCircle {...inGameProps} onMarkerPress={onMarkerPress} />
      );
      fireEvent.press(getByTestId('turn-marker'));
      expect(onMarkerPress).toHaveBeenCalledTimes(1);
    });
  });
});

