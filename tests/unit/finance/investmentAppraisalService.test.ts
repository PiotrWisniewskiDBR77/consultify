/**
 * M16/7.1 — investmentAppraisalService unit tests.
 *
 * Pins the computational core of Investment Appraisal. Every expectation is
 * hand-computed from the textbook formula (shown in comments). The KEY guard
 * is that the discount rate is a PARAMETER: the same cash flows produce a
 * DIFFERENT NPV at a different rate — no 10% hardcoded anywhere.
 */
import { describe, it, expect } from 'vitest';

import {
  npv,
  irr,
  mirr,
  payback,
  discountedPayback,
  profitabilityIndex,
  appraise,
} from '../../../server/src/services/investmentAppraisalService.js';

// Canonical worked example used across several tests.
const CF = [100, 200, 300, 400, 500];
const INIT = 1000;

describe('npv', () => {
  it('matches the hand-computed worked example at 10%', () => {
    // Σ cf/(1.1)^t = 1065.2588…  − 1000 = 65.2588…
    expect(npv(CF, 10, INIT)).toBeCloseTo(65.2588, 3);
  });

  it('is the discount rate, NOT 10% hardcoded: different rate ⇒ different NPV', () => {
    const at5 = npv(CF, 5, INIT);
    const at10 = npv(CF, 10, INIT);
    const at20 = npv(CF, 20, INIT);
    // Higher discount rate ⇒ lower NPV. Monotonic and DISTINCT.
    expect(at5).toBeGreaterThan(at10);
    expect(at10).toBeGreaterThan(at20);
    expect(at5).not.toBeCloseTo(at10, 1);
    // At 0% NPV is just the undiscounted sum minus outlay = 500.
    expect(npv(CF, 0, INIT)).toBeCloseTo(500, 6);
  });
});

describe('irr', () => {
  it('finds the rate where NPV ≈ 0', () => {
    const rate = irr(CF, INIT);
    expect(rate).not.toBeNull();
    // NPV at the discovered IRR must be ~0.
    expect(npv(CF, rate as number, INIT)).toBeCloseTo(0, 4);
    // Sanity band: known IRR for this stream is ~12.0%.
    expect(rate as number).toBeGreaterThan(11);
    expect(rate as number).toBeLessThan(13);
  });

  it('returns null when there is no sign change (all-positive flows)', () => {
    expect(irr([100, 100, 100], 0)).toBeNull();
  });
});

describe('mirr', () => {
  it('matches the hand-computed MIRR for the worked example', () => {
    // FV of positives @10% reinvest to t=5:
    //   100*1.1^4 + 200*1.1^3 + 300*1.1^2 + 400*1.1 + 500 = 1715.61
    // PV of negatives @10% finance: -1000 at t=0 = -1000
    // MIRR = (1715.61/1000)^(1/5) - 1 = 0.113996… → 11.3996%
    expect(mirr(CF, 10, 10, INIT)).toBeCloseTo(11.3996, 3);
  });

  it('reinvest rate moves the result (parameter, not constant)', () => {
    const low = mirr(CF, 10, 5, INIT);
    const high = mirr(CF, 10, 15, INIT);
    expect(high).toBeGreaterThan(low);
  });
});

describe('payback & discountedPayback', () => {
  it('simple payback recovers the outlay (interpolated)', () => {
    // Cumulative: 100,300,600,1000 → exactly recovered at end of period 4.
    expect(payback(CF, INIT)).toBeCloseTo(4, 6);
  });

  it('discounted payback is LONGER than simple payback', () => {
    const simple = payback(CF, INIT);
    const disc = discountedPayback(CF, 10, INIT);
    expect(disc).toBeGreaterThan(simple);
  });

  it('returns Infinity when never recovered', () => {
    expect(payback([10, 10], 1000)).toBe(Infinity);
    expect(discountedPayback([10, 10], 10, 1000)).toBe(Infinity);
  });
});

describe('profitabilityIndex', () => {
  it('PI = PV(benefits)/initialInvestment', () => {
    // PV = 1065.2588…, PI = 1.06526
    expect(profitabilityIndex(CF, 10, INIT)).toBeCloseTo(1.06526, 4);
  });

  it('depends on the rate (higher rate ⇒ lower PI)', () => {
    expect(profitabilityIndex(CF, 5, INIT)).toBeGreaterThan(
      profitabilityIndex(CF, 20, INIT),
    );
  });
});

describe('appraise', () => {
  it('GO when NPV>0, IRR>hurdle, PI>1', () => {
    const r = appraise({
      cashflows: CF,
      initialInvestment: INIT,
      discountRatePct: 10,
      hurdleRatePct: 8,
    });
    expect(r.verdict).toBe('go');
    expect(r.npv).toBeCloseTo(65.2588, 3);
    expect(r.pi).toBeGreaterThan(1);
    expect(r.irr).not.toBeNull();
  });

  it('NO-GO when NPV<0 / PI<1 (value-destroying)', () => {
    const r = appraise({
      cashflows: [100, 100, 100],
      initialInvestment: 1000,
      discountRatePct: 10,
      hurdleRatePct: 8,
    });
    expect(r.verdict).toBe('no-go');
    expect(r.npv).toBeLessThan(0);
    expect(r.pi).toBeLessThan(1);
  });

  it('CONDITIONAL when positive NPV/PI but IRR does not clear the hurdle', () => {
    // IRR of CF is ~12%; set hurdle above it but below the discount-rate NPV>0 zone.
    const r = appraise({
      cashflows: CF,
      initialInvestment: INIT,
      discountRatePct: 10, // NPV>0, PI>1
      hurdleRatePct: 15, // IRR (~12%) < hurdle
    });
    expect(r.verdict).toBe('conditional');
    expect(r.npv).toBeGreaterThan(0);
    expect(r.pi).toBeGreaterThan(1);
  });

  it('verdict tracks the discount-rate PARAMETER (go flips to no-go at a high rate)', () => {
    const go = appraise({
      cashflows: CF,
      initialInvestment: INIT,
      discountRatePct: 5,
      hurdleRatePct: 4,
    });
    const noGo = appraise({
      cashflows: CF,
      initialInvestment: INIT,
      discountRatePct: 25, // high WACC pushes NPV negative
      hurdleRatePct: 4,
    });
    expect(go.verdict).toBe('go');
    expect(noGo.verdict).toBe('no-go');
    expect(go.npv).toBeGreaterThan(noGo.npv);
  });
});
