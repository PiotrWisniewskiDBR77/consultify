/**
 * Vertical Rhythm helper (beat-Gamma W7 anti-sparseness) — pure math.
 */
import { describe, expect, it } from 'vitest';

import {
  distributeY,
  centerY,
  fillHeights,
} from '../../../server/src/services/report/pptx/composites/verticalRhythm.js';

const region = { y: 1.0, h: 4.0 }; // contentY..contentH

describe('verticalRhythm.distributeY', () => {
  it('fill mode spans the region (last block bottom near region end)', () => {
    const ys = distributeY(region, [0.5, 0.5, 0.5], 'fill');
    expect(ys[0]).toBeCloseTo(1.0, 5);
    const lastBottom = ys[2] + 0.5;
    expect(lastBottom).toBeGreaterThan(region.y + region.h - 0.6); // reaches the bottom
    expect(lastBottom).toBeLessThanOrEqual(region.y + region.h + 0.001);
  });

  it('centers a single block in both fill and center modes', () => {
    const yFill = distributeY(region, [1.0], 'fill')[0];
    const yCenter = distributeY(region, [1.0], 'center')[0];
    expect(yFill).toBeCloseTo(2.5, 5); // 1.0 + (4-1)/2
    expect(yCenter).toBeCloseTo(2.5, 5);
  });

  it('center mode keeps blocks tight and centred', () => {
    const ys = distributeY(region, [0.4, 0.4], 'center', 0.2);
    const stackH = 0.4 + 0.4 + 0.2;
    expect(ys[0]).toBeCloseTo(region.y + (region.h - stackH) / 2, 5);
  });

  it('top mode stacks from the top', () => {
    const ys = distributeY(region, [0.5, 0.5], 'top', 0.1);
    expect(ys[0]).toBeCloseTo(1.0, 5);
    expect(ys[1]).toBeCloseTo(1.6, 5);
  });

  it('returns [] for no rows', () => {
    expect(distributeY(region, [], 'fill')).toEqual([]);
  });
});

describe('verticalRhythm.centerY / fillHeights', () => {
  it('centerY centres a block', () => {
    expect(centerY(region, 2.0)).toBeCloseTo(2.0, 5);
  });

  it('fillHeights scales rows up to fill, capped by maxScale', () => {
    const scaled = fillHeights(4.0, [0.5, 0.5], 0.2, 1.6);
    // available = 4 - 0.2 = 3.8; totalRows = 1.0; scale would be 3.8 but capped at 1.6
    expect(scaled[0]).toBeCloseTo(0.8, 5); // 0.5 * 1.6
  });

  it('fillHeights never shrinks below natural height', () => {
    const scaled = fillHeights(1.0, [0.8, 0.8], 0.2, 1.6);
    expect(scaled[0]).toBeGreaterThanOrEqual(0.8);
  });
});
