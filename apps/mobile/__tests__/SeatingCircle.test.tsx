import { getSeatPosition, getSeatAngleDeg, computeSeatSize } from '../components/turnTracker/SeatingCircle';

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
  const minSize = 40;

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

