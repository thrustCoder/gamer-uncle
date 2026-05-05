import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '../../styles/colors';
import { turnTrackerStyles as styles } from '../../styles/turnTrackerStyles';

interface TurnMarkerProps {
  /** Absolute position of the marker centre relative to the circle stage. */
  centerX: number;
  centerY: number;
  /** Diameter of the marker tap target. */
  size: number;
  /**
   * Target rotation in degrees. 0° points up (12 o'clock); rotation goes clockwise.
   * Pass `null` for setup mode to render a static placeholder.
   */
  targetAngle: number | null;
  /** Tap handler — called for "advance turn". No-op when null. */
  onPress?: () => void;
  testID?: string;
}

/**
 * Computes the shortest signed angular delta between two angles (degrees).
 * Result is in (-180, 180]. Used so the marker takes the shortest visual path
 * even when wrapping past the 0/360 boundary.
 */
export const shortestAngleDelta = (from: number, to: number): number => {
  let diff = ((to - from) % 360 + 540) % 360 - 180;
  // ensure -180 maps to 180 (positive direction) for stable rendering
  if (diff === -180) diff = 180;
  return diff;
};

/**
 * Renders a vintage arrow inside a square viewBox. The shape is asymmetric so
 * the pointing tip is unmistakable:
 *   - Top: a filled triangular arrowhead (A-shape) — sharp tip, flat base.
 *   - Middle: a slim dark shaft running down the centre.
 *   - Bottom: angled fletching (feathers) — drawn as wedges on each side.
 * 0° points up (12 o'clock); rotation goes clockwise.
 */
const VintageArrow: React.FC<{ size: number }> = ({ size }) => {
  const v = 100;        // viewBox unit
  const cx = v / 2;     // horizontal centre

  // Arrowhead geometry — a filled triangle (A-shape): sharp tip at the top,
  // flat base at the bottom where it meets the shaft. Lean and slightly
  // elongated so the tip reads as a precise pointer rather than a wedge.
  const tipY = 12;
  const baseY = 36;
  const baseHalfWidth = 9;
  const trianglePath = [
    `M ${cx} ${tipY}`,
    `L ${cx + baseHalfWidth} ${baseY}`,
    `L ${cx - baseHalfWidth} ${baseY}`,
    'Z',
  ].join(' ');

  // Midrib — a thin dark vertical line down the centre of the arrowhead.
  // Adds the forged-metal detail without changing the silhouette.
  const midribPath = `M ${cx} ${tipY + 4} L ${cx} ${baseY - 2}`;

  // Shaft geometry
  const shaftHalfWidth = 2.4;
  const shaftTopY = baseY;
  const shaftBottomY = 64;
  const shaft = [
    `M ${cx - shaftHalfWidth} ${shaftTopY}`,
    `L ${cx + shaftHalfWidth} ${shaftTopY}`,
    `L ${cx + shaftHalfWidth} ${shaftBottomY}`,
    `L ${cx - shaftHalfWidth} ${shaftBottomY}`,
    'Z',
  ].join(' ');

  // Fletching geometry (bottom)
  const fletchTopY = 52;
  const fletchTipY = 84;
  const fletchHalfWidth = 11;
  const fletchRight = [
    `M ${cx} ${fletchTopY}`,
    `L ${cx + fletchHalfWidth} ${fletchTipY - 4}`,
    `L ${cx + 2} ${fletchTipY}`,
    `L ${cx} ${shaftBottomY}`,
    'Z',
  ].join(' ');
  const fletchLeft = [
    `M ${cx} ${fletchTopY}`,
    `L ${cx - fletchHalfWidth} ${fletchTipY - 4}`,
    `L ${cx - 2} ${fletchTipY}`,
    `L ${cx} ${shaftBottomY}`,
    'Z',
  ].join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${v} ${v}`}>
      {/* Fletching (drawn first so the shaft overlaps it at the centre). */}
      <Path
        d={fletchLeft}
        fill={Colors.themeBrownDark}
        stroke={Colors.themeYellow}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d={fletchRight}
        fill={Colors.themeBrownDark}
        stroke={Colors.themeYellow}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {/* Shaft */}
      <Path
        d={shaft}
        fill={Colors.themeBrownDark}
        stroke={Colors.themeYellow}
        strokeWidth={1.2}
        strokeLinejoin="miter"
      />

      {/*
       * Filled triangular arrowhead (A-shape): yellow fill with a dark
       * outline, matching the two-tone treatment used elsewhere on the arrow.
       */}
      <Path
        d={trianglePath}
        fill={Colors.themeYellow}
        stroke={Colors.themeBrownDark}
        strokeWidth={2}
        strokeLinejoin="miter"
      />

      {/* Midrib — thin dark line down the centre of the arrowhead. */}
      <Path
        d={midribPath}
        stroke={Colors.themeBrownDark}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const TurnMarker: React.FC<TurnMarkerProps> = ({
  centerX,
  centerY,
  size,
  targetAngle,
  onPress,
  testID = 'turn-marker',
}) => {
  // We track the "absolute" rotation value so animations always take the
  // shortest path (we ADD the delta rather than snapping to the modulo angle).
  const rotationDeg = useRef(new Animated.Value(targetAngle ?? 0)).current;
  const lastAngleRef = useRef<number>(targetAngle ?? 0);

  useEffect(() => {
    if (targetAngle == null) return;
    const delta = shortestAngleDelta(lastAngleRef.current, targetAngle);
    const next = lastAngleRef.current + delta;
    lastAngleRef.current = next;

    Animated.timing(rotationDeg, {
      toValue: next,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [targetAngle, rotationDeg]);

  const interpolatedRotation = rotationDeg.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
  });

  const inner = (
    <Animated.View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: interpolatedRotation }],
      }}
    >
      <VintageArrow size={size} />
    </Animated.View>
  );

  return (
    <View
      style={[
        styles.markerTouchable,
        {
          left: centerX - size / 2,
          top: centerY - size / 2,
          width: size,
          height: size,
        },
      ]}
      pointerEvents="box-none"
    >
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onPress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Advance to next turn"
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          {inner}
        </TouchableOpacity>
      ) : (
        <View
          testID={testID}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          {inner}
        </View>
      )}
    </View>
  );
};

export default TurnMarker;
