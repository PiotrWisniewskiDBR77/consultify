import { describe, expect, it } from 'vitest';

import { drdAdapter } from '../drdAdapter';

describe('drdAdapter.resolveOpenLevels — DRD ramp mechanic', () => {
  it('levels 1,2 satisfied, 3 not, 4 satisfied out of order → currentLevel=2, blockedAtLevel=3, aboveGapLevels=[4]', () => {
    const result = drdAdapter.resolveOpenLevels({
      unitId: '1A',
      confirmedLevels: [1, 2, 4],
      evidenceByLevel: {},
    });
    expect(result.currentLevel).toBe(2);
    expect(result.blockedAtLevel).toBe(3);
    expect(result.aboveGapLevels).toEqual([4]);
    expect(result.openLevels).toEqual([1, 2, 3]);
  });

  it('aboveGap NEVER raises currentLevel, however high the confirmed above-gap level is', () => {
    const result = drdAdapter.resolveOpenLevels({
      unitId: '1A',
      confirmedLevels: [7], // level 1 itself is unconfirmed
      evidenceByLevel: {},
    });
    expect(result.currentLevel).toBeNull();
    expect(result.blockedAtLevel).toBe(1);
    expect(result.aboveGapLevels).toEqual([7]);
  });

  it('aboveGap does not raise currentLevel even when several above-gap levels are confirmed', () => {
    const result = drdAdapter.resolveOpenLevels({
      unitId: '1A',
      confirmedLevels: [1, 2, 5, 6],
      evidenceByLevel: {},
    });
    expect(result.currentLevel).toBe(2);
    expect(result.blockedAtLevel).toBe(3);
    expect(result.aboveGapLevels).toEqual([5, 6]);
  });

  it('confirming everything in order reaches the top of the unit-specific scale, nothing blocked', () => {
    const result = drdAdapter.resolveOpenLevels({
      unitId: '2A', // axis 2, scale 1-5
      confirmedLevels: [1, 2, 3, 4, 5],
      evidenceByLevel: {},
    });
    expect(result.currentLevel).toBe(5);
    expect(result.blockedAtLevel).toBeNull();
    expect(result.openLevels).toEqual([]);
    expect(result.aboveGapLevels).toEqual([]);
  });

  it('confirming nothing blocks at level 1, currentLevel stays null', () => {
    const result = drdAdapter.resolveOpenLevels({ unitId: '1A', confirmedLevels: [], evidenceByLevel: {} });
    expect(result.currentLevel).toBeNull();
    expect(result.blockedAtLevel).toBe(1);
    expect(result.openLevels).toEqual([1]);
    expect(result.aboveGapLevels).toEqual([]);
  });

  it('prerequisite skipped (only level 3 confirmed, 1 & 2 never) is rejected — currentLevel stays null', () => {
    const result = drdAdapter.resolveOpenLevels({ unitId: '1A', confirmedLevels: [3], evidenceByLevel: {} });
    expect(result.currentLevel).toBeNull();
    expect(result.blockedAtLevel).toBe(1);
    expect(result.aboveGapLevels).toEqual([3]);
  });

  it('unknown unit id degrades safely instead of throwing', () => {
    const result = drdAdapter.resolveOpenLevels({ unitId: 'ZZ', confirmedLevels: [1], evidenceByLevel: {} });
    expect(result).toEqual({ currentLevel: null, blockedAtLevel: null, openLevels: [], aboveGapLevels: [] });
  });

  it('is deterministic — same input twice yields identical output', () => {
    const input = { unitId: '1A', confirmedLevels: [1, 2, 4], evidenceByLevel: {} };
    const a = drdAdapter.resolveOpenLevels(input);
    const b = drdAdapter.resolveOpenLevels(input);
    expect(a).toEqual(b);
  });
});
