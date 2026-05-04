/** Direction of play around the seating circle. */
export type TurnDirection = 'cw' | 'ccw';

/**
 * A single ongoing turn-tracker session for one active player list.
 * Identity is by player INDEX in the active list (group or appCache players),
 * so renames automatically propagate without disrupting the game.
 */
export interface TurnTrackerSession {
  /**
   * Ordered list of player indices forming the seating arrangement.
   * Length === playerCount. Index 0 sits at the 12 o'clock seat;
   * subsequent entries fill clockwise around the circle.
   */
  seatOrder: number[];

  /** Index INTO seatOrder of the seat that currently holds the turn. */
  activeSeatIndex: number;

  /** Current direction of play. */
  direction: TurnDirection;

  /** Epoch ms timestamp the game began. */
  startedAt: number;

  /**
   * Snapshot of playerCount at game start.
   * Used to detect mismatches if the active player list size changes
   * mid-game (e.g. group player count edited outside the in-game lock).
   */
  playerCountAtStart: number;

  /** Running count of `advanceTurn()` calls (used for telemetry on End Game). */
  totalAdvances: number;

  /** Running count of `retractTurn()` calls (used for telemetry on End Game). */
  totalRetracts: number;
}
