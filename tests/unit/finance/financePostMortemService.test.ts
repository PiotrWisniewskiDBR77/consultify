import { describe, expect, it } from 'vitest';

import {
  decomposeVariance,
  type MarketShift,
} from '../../../server/src/services/financePostMortemService.ts';

const shift = (
  factor: string,
  deltaFraction: number,
  confidence: MarketShift['confidence'] = 'confirmed'
): MarketShift => ({ factor, deltaFraction, confidence });

describe('decomposeVariance — identity', () => {
  it('market + execution effects always sum exactly to the total variance', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', -0.35)],
    });
    expect(d.marketEffect + d.executionEffect).toBeCloseTo(d.totalVariance, 5);
  });
});

describe('decomposeVariance — verdicts', () => {
  it('calls a miss market-driven when the market shift explains most of the gap', () => {
    // plan 1000, market shrank 35% → baseline 650; realized 700 → we BEAT the
    // shrunken market (+50 execution), but the -300 gap is mostly market.
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', -0.35)],
    });
    expect(d.verdict).toBe('market-driven');
    expect(d.marketEffect).toBe(-350);
    expect(d.executionEffect).toBe(50); // beat the down market on execution
    expect(d.marketShare).toBeGreaterThan(0.66);
    expect(d.confidence).toBe('confirmed');
  });

  it('calls the same -300 miss execution-driven when the market held flat', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', 0)],
    });
    expect(d.verdict).toBe('execution-driven');
    expect(d.marketEffect).toBe(0);
    expect(d.executionEffect).toBe(-300);
  });

  it('calls it mixed when market and execution are comparable', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', -0.15)], // market -150, execution -150
    });
    expect(d.verdict).toBe('mixed');
    expect(d.marketShare).toBeCloseTo(0.5, 1);
  });

  it('reports on-plan when within ±5% of the plan', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 1030,
      marketShifts: [shift('demand', 0.02)],
    });
    expect(d.verdict).toBe('on-plan');
  });
});

describe('decomposeVariance — honesty', () => {
  it('is undetermined (not execution) when no market data is supplied', () => {
    const d = decomposeVariance({ projected: 1000, realized: 700 });
    expect(d.verdict).toBe('undetermined');
    expect(d.confidence).toBe('undetermined');
    // whole residual lands in execution numerically, but the verdict refuses
    // to blame execution without market evidence
    expect(d.executionEffect).toBe(-300);
    expect(d.explanation.en.toLowerCase()).toContain('guess');
  });

  it('degrades confidence to undetermined when any shift is missing', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', -0.3, 'missing')],
    });
    expect(d.confidence).toBe('undetermined');
  });

  it('reports declared confidence when a shift is only declared', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 700,
      marketShifts: [shift('demand', -0.35, 'declared')],
    });
    expect(d.confidence).toBe('declared');
  });

  it('combines multiple market factors additively', () => {
    const d = decomposeVariance({
      projected: 1000,
      realized: 800,
      marketShifts: [shift('price', -0.1), shift('volume', -0.05)], // net -0.15
    });
    expect(d.marketEffect).toBe(-150);
    expect(d.executionEffect).toBe(-50);
  });
});
