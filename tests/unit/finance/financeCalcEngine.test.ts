/**
 * M16/1.4 — financeCalcEngine canonical SSOT primitives.
 *
 * Anchors the canonical financial math against textbook examples so the SSOT
 * cannot silently drift. Pure functions → no mocks, no DB, no setup.
 */
import { describe, expect, it } from 'vitest';

import {
  annuityPv,
  cagr,
  clamp,
  discountedPayback,
  financeCalcEngine,
  fv,
  growthRate,
  irr,
  margin,
  npv,
  payback,
  profitabilityIndex,
  pv,
  round2,
} from '../../../server/src/services/financeCalcEngine.js';

describe('financeCalcEngine — helpers', () => {
  it('clamp bounds value into range (and tolerates swapped bounds)', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(5); // swapped bounds treated defensively
  });

  it('round2 rounds to 2 dp and defends non-finite', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(10)).toBe(10);
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe('financeCalcEngine — time value of money (single amount)', () => {
  it('pv discounts a single future amount', () => {
    // 110 one period out at 10% → 100
    expect(pv(110, 10, 1)).toBeCloseTo(100, 10);
    // 121 two periods at 10% → 100
    expect(pv(121, 10, 2)).toBeCloseTo(100, 10);
  });

  it('fv compounds a single present amount', () => {
    expect(fv(100, 10, 1)).toBeCloseTo(110, 10);
    expect(fv(100, 10, 2)).toBeCloseTo(121, 10);
  });

  it('invariant: PV·(1+r)^n === FV  ⇔  fv(pv(x)) === x and pv(fv(x)) === x', () => {
    for (const [x, r, n] of [
      [1000, 5, 3],
      [250, 12.5, 7],
      [9999, 0, 4],
    ] as Array<[number, number, number]>) {
      expect(fv(pv(x, r, n), r, n)).toBeCloseTo(x, 6);
      expect(pv(fv(x, r, n), r, n)).toBeCloseTo(x, 6);
    }
  });

  it('annuityPv values an ordinary annuity (textbook example)', () => {
    // 5 yearly payments of 1000 at 8% → 3992.71 (standard annuity table)
    expect(annuityPv(1000, 8, 5)).toBeCloseTo(3992.71, 2);
    // r === 0 degenerates to payment * periods
    expect(annuityPv(1000, 0, 5)).toBe(5000);
  });
});

describe('financeCalcEngine — project appraisal', () => {
  it('npv matches a known example', () => {
    // Investment -1000, inflows 500/400/300/100 at 10%.
    // PV = 454.545 + 330.578 + 225.394 + 68.301 = 1078.82 → NPV = 78.82
    const cf = [500, 400, 300, 100];
    expect(npv(cf, 10, -1000)).toBeCloseTo(78.82, 2);
    // Zero rate → simple sum
    expect(npv(cf, 0, -1000)).toBeCloseTo(300, 10);
  });

  it('irr solves NPV = 0 (cross-check against npv) and matches a known value', () => {
    const cf = [500, 400, 300, 100];
    const rate = irr(cf, -1000);
    // Known IRR for this stream ≈ 14.49%
    expect(rate).toBeCloseTo(14.49, 1);
    // Self-consistency: NPV at the computed IRR must be ~0
    expect(npv(cf, rate, -1000)).toBeCloseTo(0, 4);
  });

  it('irr of a doubling in one period is 100%', () => {
    expect(irr([200], -100)).toBeCloseTo(100, 6);
  });

  it('irr returns NaN when there is no sign change', () => {
    expect(Number.isNaN(irr([100, 100], 100))).toBe(true); // all positive
    expect(Number.isNaN(irr([-100, -100], -100))).toBe(true); // all negative
  });

  it('payback finds the (fractional) simple payback period', () => {
    // 1000 outlay, inflows 400/400/400 → recovered partway through period 3:
    // after 2 periods 800 recovered, 200 left, /400 = 0.5 → 2.5
    expect(payback([400, 400, 400], 1000)).toBeCloseTo(2.5, 10);
    // Exact recovery at end of period 2
    expect(payback([600, 400, 400], 1000)).toBeCloseTo(2, 10);
    // Never recovered → NaN
    expect(Number.isNaN(payback([100, 100], 1000))).toBe(true);
  });

  it('discountedPayback recovers later than simple payback', () => {
    const cf = [400, 400, 400, 400];
    const simple = payback(cf, 1000);
    const disc = discountedPayback(cf, 10, 1000);
    expect(disc).toBeGreaterThan(simple);
    expect(Number.isFinite(disc)).toBe(true);
  });

  it('profitabilityIndex = PV(inflows) / |outlay|, consistent with NPV sign', () => {
    const cf = [500, 400, 300, 100];
    const pi = profitabilityIndex(cf, 10, -1000);
    // PV(inflows) ≈ 1078.82 / 1000
    expect(pi).toBeCloseTo(1.0788, 3);
    // PI > 1 ⇔ NPV > 0
    expect(pi > 1).toBe(npv(cf, 10, -1000) > 0);
    // Undefined for zero outlay
    expect(Number.isNaN(profitabilityIndex(cf, 10, 0))).toBe(true);
  });
});

describe('financeCalcEngine — growth & ratios', () => {
  it('cagr computes compound annual growth in percent', () => {
    // 100 → 200 over 3 years → 25.992%
    expect(cagr(100, 200, 3)).toBeCloseTo(25.992, 2);
    // Doubling in one year → 100%
    expect(cagr(100, 200, 1)).toBeCloseTo(100, 6);
    // Undefined for non-positive base / horizon
    expect(Number.isNaN(cagr(0, 200, 3))).toBe(true);
    expect(Number.isNaN(cagr(100, 200, 0))).toBe(true);
  });

  it('margin computes ratio in percent and defends zero denominator', () => {
    expect(margin(40, 200)).toBeCloseTo(20, 10);
    expect(Number.isNaN(margin(40, 0))).toBe(true);
  });

  it('growthRate computes period-over-period growth in percent', () => {
    expect(growthRate(200, 250)).toBeCloseTo(25, 10);
    expect(growthRate(200, 150)).toBeCloseTo(-25, 10);
    // |prev| denominator keeps direction sensible for negative base
    expect(growthRate(-100, -50)).toBeCloseTo(50, 10);
    expect(Number.isNaN(growthRate(0, 100))).toBe(true);
  });
});

describe('financeCalcEngine — namespace export', () => {
  it('exposes every primitive on the grouped namespace', () => {
    expect(typeof financeCalcEngine.npv).toBe('function');
    expect(financeCalcEngine.npv([110], 10, 0)).toBeCloseTo(100, 10);
    expect(financeCalcEngine.round2(1.005)).toBe(1.01);
  });
});
