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

const SeatingCircle: React.FC<Props> = (props) => {
  const { stageSize, seatSize, markerSize } = props;
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
