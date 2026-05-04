import { getSeatPosition, getSeatAngleDeg } from '../components/turnTracker/SeatingCircle';

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
