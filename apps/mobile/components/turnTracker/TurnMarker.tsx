import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

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
 * Renders a compass-needle SVG inside a square viewBox. The needle is a long
 * thin shaft topped by a sharp arrowhead so it's visually obvious which seat
 * the marker is pointing at.
 */
const CompassNeedle: React.FC<{ size: number }> = ({ size }) => {
  const v = 100;       // viewBox unit
  const cx = v / 2;    // 50
  const cy = v / 2;    // 50
  const tipY = 8;      // 0=top edge; tip of arrowhead just inside the viewBox
  const headBaseY = 30;
  const tailY = 80;
  const shaftHalfWidth = 5;
  const headHalfWidth = 16;
  const hubRadius = 8;

  // Arrow path: tip → head right → shaft right → tail right → tail left → shaft left → head left → close
  const path = [
    `M ${cx} ${tipY}`,
    `L ${cx + headHalfWidth} ${headBaseY}`,
    `L ${cx + shaftHalfWidth} ${headBaseY}`,
    `L ${cx + shaftHalfWidth} ${tailY}`,
    `L ${cx - shaftHalfWidth} ${tailY}`,
    `L ${cx - shaftHalfWidth} ${headBaseY}`,
    `L ${cx - headHalfWidth} ${headBaseY}`,
    'Z',
  ].join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${v} ${v}`}>
      {/* Hub circle behind the needle for a nicer pivot look */}
      <SvgCircle
        cx={cx}
        cy={cy}
        r={hubRadius}
        fill={Colors.themeBrownDark}
        stroke={Colors.themeYellow}
        strokeWidth={2}
      />
      <Path
        d={path}
        fill={Colors.themeYellow}
        stroke={Colors.themeBrownDark}
        strokeWidth={2}
        strokeLinejoin="miter"
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
      <CompassNeedle size={size} />
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
