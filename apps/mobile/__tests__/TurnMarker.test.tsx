import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Override the global mock with one that exports Svg/Path as plain View
// functions. The global mock in jest.setup.js sometimes resolves the default
// export as an object (instead of a function) when interop occurs through
// ts-jest, which makes React reject the element type.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = ({ children, ...rest }: any) =>
    React.createElement(View, rest, children);
  return {
    __esModule: true,
    default: Stub,
    Svg: Stub,
    Path: Stub,
    Circle: Stub,
    G: Stub,
    Text: Stub,
  };
});

import TurnMarker, { shortestAngleDelta } from '../components/turnTracker/TurnMarker';

describe('shortestAngleDelta', () => {
  it('returns 0 for identical angles', () => {
    expect(shortestAngleDelta(0, 0)).toBe(0);
    expect(shortestAngleDelta(45, 45)).toBe(0);
  });

  it('returns positive delta for clockwise short paths', () => {
    expect(shortestAngleDelta(0, 60)).toBe(60);
    expect(shortestAngleDelta(90, 180)).toBe(90);
  });

  it('returns negative delta for counter-clockwise short paths', () => {
    expect(shortestAngleDelta(60, 0)).toBe(-60);
    expect(shortestAngleDelta(180, 90)).toBe(-90);
  });

  it('takes the shortest path across the 0/360 boundary', () => {
    // 350 -> 10 should be +20 (cw), not -340
    expect(shortestAngleDelta(350, 10)).toBe(20);
    // 10 -> 350 should be -20 (ccw), not +340
    expect(shortestAngleDelta(10, 350)).toBe(-20);
  });

  it('handles the half-turn case as positive 180', () => {
    expect(shortestAngleDelta(0, 180)).toBe(180);
    expect(shortestAngleDelta(180, 0)).toBe(180);
  });

  it('produces consistent results when stacked (cumulative animation use case)', () => {
    // Simulate marker walking around the circle for N=6 cw
    let abs = 0;
    const steps: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const target = (i * 60) % 360;
      const delta = shortestAngleDelta(abs % 360, target);
      abs += delta;
      steps.push(delta);
    }
    // Each step should be 60° in the cw direction
    expect(steps.every((s) => s === 60)).toBe(true);
    // Two full revolutions => abs == 720
    expect(abs).toBe(720);
  });
});

describe('TurnMarker (rendering)', () => {
  const baseProps = {
    centerX: 100,
    centerY: 100,
    size: 64,
    targetAngle: 0,
  } as const;

  it('renders a TouchableOpacity wired to onPress when onPress is provided', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<TurnMarker {...baseProps} onPress={onPress} />);
    const marker = getByTestId('turn-marker');
    fireEvent.press(marker);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a non-touchable wrapper when onPress is omitted', () => {
    const { getByTestId } = render(<TurnMarker {...baseProps} />);
    const marker = getByTestId('turn-marker');
    expect(marker).toBeTruthy();
    // Pressing should not throw; no callback should fire either.
    fireEvent.press(marker);
  });

  it('honours a custom testID', () => {
    const { getByTestId } = render(
      <TurnMarker {...baseProps} testID="custom-marker" onPress={() => {}} />
    );
    expect(getByTestId('custom-marker')).toBeTruthy();
  });

  it('renders without crashing when targetAngle is null (setup mode)', () => {
    const { getByTestId } = render(
      <TurnMarker {...baseProps} targetAngle={null} />
    );
    expect(getByTestId('turn-marker')).toBeTruthy();
  });
});
