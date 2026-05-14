import React from 'react';
import { View } from 'react-native';

import { turnTrackerStyles as styles } from '../../styles/turnTrackerStyles';
import PlayerSeat, { SeatState } from './PlayerSeat';
import TurnMarker from './TurnMarker';

interface InGameProps {
  /** True when a game is in progress; false during seating setup. */
  inGame: true;
  /** Ordered seating arrangement (player indices). Length == playerCount. */
  seatOrder: number[];
  /** Function returning the display name for a given player index. */
  getPlayerName: (playerIndex: number) => string;
  /** Index of the seat currently holding the turn (within `seatOrder`). */
  activeSeatIndex: number;
  /** Index of the seat that would receive the turn next (direction-aware). */
  nextSeatIndex: number;
  /** Index of the seat that previously held the turn (direction-aware). */
  prevSeatIndex: number;
  /** Tap on the central marker -> advance turn. */
  onMarkerPress: () => void;
  /** Tap on the upcoming seat -> advance turn. */
  onAdvancePress: () => void;
  /** Tap on the preceding seat -> retract turn. */
  onRetractPress: () => void;
}

interface SetupProps {
  /** Setup mode (no game in progress). */
  inGame: false;
  /** Number of empty seats to render. */
  playerCount: number;
  /** Sparse array; index = seat position, value = player index or null if unfilled. */
  seats: (number | null)[];
  /** Function returning the display name for a given player index. */
  getPlayerName: (playerIndex: number) => string;
  /** Tap handler for any seat (filled or empty) — opens the player picker. */
  onSeatPress: (seatIndex: number) => void;
}

type Props = (InGameProps | SetupProps) & {
  /** Stage diameter in pixels (the circle on which seats are arranged). */
  stageSize: number;
  /** Diameter of each seat circle. */
  seatSize: number;
  /** Diameter of the central marker. */
  markerSize: number;
  /**
   * Optional pre-computed display labels indexed by player index. Each entry
   * is the shortest unique prefix of that player's name within the active
   * roster (e.g. "P1" vs "P18"). When omitted, seats fall back to the legacy
   * two-initials behaviour from `getInitials`.
   */
  playerLabels?: string[];
};

/**
 * Computes (left, top) for a seat at index `i` of `n`, on a circle of diameter `stageSize`,
 * where the seat itself has diameter `seatSize`. Seats start at the 12 o'clock position
 * and proceed clockwise.
 */
export const getSeatPosition = (
  i: number,
  n: number,
  stageSize: number,
  seatSize: number,
): { left: number; top: number } => {
  const radius = stageSize / 2 - seatSize / 2 - 6; // padding so seat doesn't touch edge
  const centerX = stageSize / 2;
  const centerY = stageSize / 2;
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    left: centerX + radius * Math.cos(angle) - seatSize / 2,
    top: centerY + radius * Math.sin(angle) - seatSize / 2,
  };
};

/**
 * Computes the angle (in degrees, 0=up, clockwise) from the centre to seat index `i`.
 * The marker uses this so the pointer aims directly at the active seat.
 */
export const getSeatAngleDeg = (i: number, n: number): number => {
  return (i * 360) / n;
};

/**
 * Returns a seat diameter that prevents adjacent seats from overlapping on the
 * seating circle. The default seat size is used while it fits; once the
 * player count gets large enough that two seats placed at adjacent positions
 * on the inscribed circle would touch (or overlap), the seat size is shrunk
 * down — clamped to a minimum tap-friendly size.
 *
 * Geometry: seats sit on a circle of radius `r = stageSize/2 - seatSize/2 - 6`.
 * The chord between adjacent seat centres is `c = 2r·sin(π/n)`. For seats not
 * to overlap with a small visual gap `g`, we need `c ≥ seatSize + g`, which
 * yields the closed-form solution implemented below.
 *
 * @param playerCount number of seats on the circle (n)
 * @param stageSize   diameter of the seating stage
 * @param defaultSize preferred seat diameter when there's room
 * @param minSize     lower bound to keep seats tap-friendly (default 40)
 * @param gap         desired visual gap between adjacent seats (default 8)
 */
export const computeSeatSize = (
  playerCount: number,
  stageSize: number,
  defaultSize: number,
  minSize: number = 28,
  gap: number = 8,
): number => {
  if (playerCount <= 1 || stageSize <= 0) return defaultSize;
  const sinTerm = Math.sin(Math.PI / playerCount);
  // seatSize ≤ (stageSize·sin - 12·sin - gap) / (1 + sin)
  const maxBySpacing = (stageSize * sinTerm - 12 * sinTerm - gap) / (1 + sinTerm);
  if (!Number.isFinite(maxBySpacing)) return defaultSize;
  return Math.max(minSize, Math.min(defaultSize, Math.floor(maxBySpacing)));
};

const SeatingCircle: React.FC<Props> = (props) => {
  const { stageSize, seatSize, markerSize, playerLabels } = props;
  const stageStyle = { width: stageSize, height: stageSize };

  return (
    <View style={styles.circleWrap}>
      <View style={[styles.circleStage, stageStyle]} testID="seating-circle">
        {props.inGame ? (
          <>
            {props.seatOrder.map((playerIndex, seatIdx) => {
              const pos = getSeatPosition(seatIdx, props.seatOrder.length, stageSize, seatSize);
              const isActive = seatIdx === props.activeSeatIndex;
              const isNext = seatIdx === props.nextSeatIndex;
              const isPrev = seatIdx === props.prevSeatIndex;
              // Visually, all non-active seats look identical. Next/prev get an
              // invisible tap target; everyone else is non-interactive.
              const state: SeatState = isActive ? 'active' : 'idle';
              let onPress: (() => void) | undefined;
              let tapLabel: string | undefined;
              const playerName = props.getPlayerName(playerIndex);
              if (!isActive && isNext) {
                onPress = props.onAdvancePress;
                tapLabel = `Advance turn to ${playerName}`;
              } else if (!isActive && isPrev) {
                onPress = props.onRetractPress;
                tapLabel = `Go back a turn to ${playerName}`;
              }
              // Use 'tap' state when this seat is silently tappable.
              const finalState: SeatState =
                !isActive && (isNext || isPrev) ? 'tap' : state;
              return (
                <PlayerSeat
                  key={`seat-${seatIdx}`}
                  name={playerName}
                  displayLabel={playerLabels?.[playerIndex]}
                  seatNumber={seatIdx + 1}
                  state={finalState}
                  size={seatSize}
                  left={pos.left}
                  top={pos.top}
                  onPress={onPress}
                  tapAccessibilityLabel={tapLabel}
                />
              );
            })}

            <TurnMarker
              centerX={stageSize / 2}
              centerY={stageSize / 2}
              size={markerSize}
              targetAngle={getSeatAngleDeg(props.activeSeatIndex, props.seatOrder.length)}
              onPress={props.onMarkerPress}
            />
          </>
        ) : (
          <>
            {Array.from({ length: props.playerCount }).map((_, seatIdx) => {
              const pos = getSeatPosition(seatIdx, props.playerCount, stageSize, seatSize);
              const playerIdx = props.seats[seatIdx];
              const filled = playerIdx != null;
              return (
                <PlayerSeat
                  key={`setup-seat-${seatIdx}`}
                  name={filled ? props.getPlayerName(playerIdx as number) : ''}
                  displayLabel={filled ? playerLabels?.[playerIdx as number] : undefined}
                  seatNumber={seatIdx + 1}
                  state={filled ? 'filled' : 'empty'}
                  size={seatSize}
                  left={pos.left}
                  top={pos.top}
                  onPress={() => props.onSeatPress(seatIdx)}
                />
              );
            })}
          </>
        )}
      </View>
    </View>
  );
};

export default SeatingCircle;
