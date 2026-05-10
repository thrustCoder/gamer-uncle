import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

import { turnTrackerStyles as styles } from '../../styles/turnTrackerStyles';

/**
 * Seat states:
 *  - `empty`  — setup mode, no player assigned. Dashed border + "+". Tappable.
 *  - `filled` — setup mode, player assigned. Solid look. Tappable (re-edits).
 *  - `idle`   — in-game, this seat is neither active nor a tap target. Solid look. Not tappable.
 *  - `tap`    — in-game, next or previous seat (direction-aware). Solid look (visually
 *               identical to `idle` so users get no hint about which seat is tappable).
 *               Tappable.
 *  - `active` — in-game, this seat currently holds the turn. Scaled up + glowing.
 */
export type SeatState = 'empty' | 'filled' | 'idle' | 'tap' | 'active';

interface PlayerSeatProps {
  /** Player display name. Empty seats pass an empty string. */
  name: string;
  /** Seat index in the seating circle (1-based label for empty seats). */
  seatNumber: number;
  /** Visual / interaction state for this seat. */
  state: SeatState;
  /** Diameter of the seat circle in pixels. */
  size: number;
  /** Pixel position (top-left of the seat box) within the circle stage. */
  left: number;
  top: number;
  /** Tap handler. Only invoked for `empty`, `filled`, or `tap` states. */
  onPress?: () => void;
  /** Accessibility hint for tappable in-game seats. */
  tapAccessibilityLabel?: string;
  /** Optional testID prefix; default `seat`. */
  testIDPrefix?: string;
  /**
   * Optional pre-computed label to render inside the seat circle. When the
   * caller knows the full roster it can supply a unique prefix (e.g. "P1"
   * vs "P18") so identifiers don't collide. Falls back to `getInitials(name)`
   * — the legacy two-letter behaviour — when omitted.
   */
  displayLabel?: string;
}

/**
 * Returns up to 2 uppercase initials from a player's display name.
 * Falls back to "?" for empty/whitespace-only names.
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '?';
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
};

/**
 * Picks an inner-label font size that keeps the entire `label` visible inside
 * a circular seat of diameter `size` without ellipsis truncation. The chord
 * across a circle at the text baseline is ~85% of the diameter, and a bold
 * sans-serif glyph occupies roughly 0.6× its font size in width — so the
 * widest font that fits is `(size * 0.85) / (label.length * 0.6)`. The
 * result is clamped to a readable range.
 */
export const getSeatLabelFontSize = (
  size: number,
  label: string,
  maxFont: number = 22,
  minFont: number = 10,
): number => {
  const len = Math.max(label.length, 1);
  const fitted = Math.floor((size * 0.85) / (len * 0.6));
  return Math.max(minFont, Math.min(maxFont, fitted));
};

const PlayerSeat: React.FC<PlayerSeatProps> = ({
  name,
  seatNumber,
  state,
  size,
  left,
  top,
  onPress,
  tapAccessibilityLabel,
  testIDPrefix = 'seat',
  displayLabel,
}) => {
  const isInteractive = state === 'empty' || state === 'filled' || state === 'tap';
  const isActive = state === 'active';

  // Active seat scales up. Other seats stay at scale 1 — no visual hint about tappability.
  const scaleAnim = useRef(new Animated.Value(isActive ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.15 : 1,
      useNativeDriver: true,
      tension: 80,
      friction: 6,
    }).start();
  }, [isActive, scaleAnim]);

  const seatStyle = [
    styles.seatCircle,
    state === 'empty' && styles.seatCircleEmpty,
    isActive && styles.seatCircleActive,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
  ];

  const innerLabel = displayLabel ?? getInitials(name);

  const Inner = (
    <Animated.View
      style={[seatStyle, { transform: [{ scale: scaleAnim }] }]}
      testID={`${testIDPrefix}-${seatNumber - 1}`}
    >
      {state === 'empty' ? (
        <Text style={styles.seatPlaceholderText}>+</Text>
      ) : (
        <Text
          // Shrink the font so the full label (e.g. "P18") fits inside small
          // seats — otherwise React Native truncates with an ellipsis at
          // numberOfLines=1.
          style={[styles.seatInitials, { fontSize: getSeatLabelFontSize(size, innerLabel) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {innerLabel}
        </Text>
      )}
    </Animated.View>
  );

  const accessibilityLabel =
    state === 'empty'
      ? `Seat ${seatNumber}, empty, tap to assign player`
      : state === 'filled'
        ? `Seat ${seatNumber}, ${name}, tap to change player`
        : state === 'tap'
          ? tapAccessibilityLabel ?? `Tap ${name}`
          : `${name}`;

  return (
    <View
      style={[
        styles.seatContainer,
        { left, top, width: size, height: size },
      ]}
      pointerEvents="box-none"
    >
      {isInteractive && onPress ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          testID={`${testIDPrefix}-${seatNumber - 1}-touch`}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {Inner}
        </TouchableOpacity>
      ) : (
        Inner
      )}

      {/*
       * Sub-label rules:
       *   - Empty (setup): show "Seat N" so the user knows which seat to fill.
       *   - Filled (setup): show the player's name to confirm the assignment.
       *   - In-game (active / idle / tap): hide. The initial inside the circle
       *     already conveys the player; an extra label below clutters the
       *     circle, especially when default names like "P1" are used.
       */}
      {(state === 'empty' || state === 'filled') && (
        <Text
          style={[
            styles.seatLabel,
            { top: size + 4, width: Math.max(size + 30, 80), left: -((Math.max(size + 30, 80) - size) / 2) },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {state === 'empty' ? `Seat ${seatNumber}` : name}
        </Text>
      )}
    </View>
  );
};

export default PlayerSeat;
