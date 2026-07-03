/**
 * M16/2.1 — Living Business Case service (pure, DB-free).
 *
 * Pins the on-read NPV/IRR/payback/PI recompute against a REAL WACC
 * (the "living" part), and the extraction of economics out of a financial
 * analysis' investment ratios. Every expectation is hand-computed from the
 * formula and shown in comments so a regression FAILS here.
 */

import { describe, it, expect } from 'vitest';

import {
  buildBusinessCaseFromAnalysis,
  computeNpvOnRead,
  toRoiAssumptions,
  type BusinessCaseEconomics,
} from '../../../server/src/services/livingBusinessCaseService.js';
import type { RatioResult } from '../../../server/src/services/financialAnalysisService.js';

// ---------------------------------------------------------------------------
// computeNpvOnRead
// ---------------------------------------------------------------------------

describe('computeNpvOnRead', () => {
  it('positive NPV: benefits discounted above capex', () => {
    // capex 1000, 3 years of 500, r = 10%.
    // PV = 500/1.1 + 500/1.21 + 500/1.331
    //    = 454.5454.. + 413.2231.. + 375.6574.. = 1243.4260..
    // NPV = 1243.4260.. − 1000 = 243.4260..
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [500, 500, 500],
    };
    const out = computeNpvOnRead(econ, 10);
    expect(out.npv).toBeCloseTo(243.426, 2);
    // PI = PV/capex = 1243.426/1000
    expect(out.pi).toBeCloseTo(1.243426, 4);
    // Positive NPV ⇒ IRR above the 10% discount rate.
    expect(out.irr).not.toBeNull();
    expect(out.irr as number).toBeGreaterThan(0.1);
  });

  it('negative NPV: capex exceeds discounted benefits', () => {
    // capex 2000, 3 years of 500, r = 10%. PV = 1243.426 < 2000.
    // NPV = 1243.426 − 2000 = -756.574
    const econ: BusinessCaseEconomics = {
      capex: 2000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [500, 500, 500],
    };
    const out = computeNpvOnRead(econ, 10);
    expect(out.npv).toBeCloseTo(-756.574, 2);
    expect(out.pi as number).toBeLessThan(1);
    // Never recovers capex ⇒ no discounted payback.
    expect(out.paybackYears).toBeNull();
  });

  it('IRR ≈ known root for a flat annuity', () => {
    // capex 1000, 3 years of 500. IRR solves 500*[1/(1+i)+1/(1+i)^2+1/(1+i)^3]=1000.
    // Known root i ≈ 0.23375 (23.375%).
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [500, 500, 500],
    };
    const out = computeNpvOnRead(econ, 10);
    expect(out.irr).not.toBeNull();
    expect(out.irr as number).toBeCloseTo(0.23375, 3);
    // Sanity: NPV at the solved IRR is ~0.
    const atIrr = computeNpvOnRead(econ, (out.irr as number) * 100);
    expect(atIrr.npv).toBeCloseTo(0, 4);
  });

  it('discounted payback lands in the recovery year', () => {
    // capex 1000, cashflows [600, 600, 600], r = 10%.
    // disc1 = 600/1.1 = 545.4545 (cum 545.4545 < 1000)
    // disc2 = 600/1.21 = 495.8677 (cum 1041.3223 ≥ 1000)
    // need = 1000 − 545.4545 = 454.5455; fraction = 454.5455/495.8677 = 0.91666
    // payback = 1 + 0.91666 = 1.91666 years
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 600,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [600, 600, 600],
    };
    const out = computeNpvOnRead(econ, 10);
    expect(out.paybackYears).not.toBeNull();
    expect(out.paybackYears as number).toBeCloseTo(1.91666, 3);
  });

  it('PI = PV(benefits)/capex', () => {
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [500, 500, 500],
    };
    const out = computeNpvOnRead(econ, 10);
    // PI consistent with NPV: NPV = PV − capex = (PI*capex) − capex.
    const pi = out.pi as number;
    expect(out.npv).toBeCloseTo(pi * 1000 - 1000, 4);
  });

  it('WACC affects NPV — higher WACC lowers NPV (uses the param, not 10%)', () => {
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10, // baked-in default that MUST be overridden by param
      cashflows: [500, 500, 500],
    };
    const at5 = computeNpvOnRead(econ, 5);
    const at10 = computeNpvOnRead(econ, 10);
    const at20 = computeNpvOnRead(econ, 20);

    // Strictly monotonic decreasing in the discount rate.
    expect(at5.npv).toBeGreaterThan(at10.npv);
    expect(at10.npv).toBeGreaterThan(at20.npv);

    // Proof it is NOT silently using 10%: at5 differs from at10 by a real margin.
    // At r=5%: PV = 500/1.05 + 500/1.1025 + 500/1.157625 = 1361.62.. ⇒ NPV ≈ 361.62
    expect(at5.npv).toBeCloseTo(361.62, 1);
    expect(at5.npv - at10.npv).toBeGreaterThan(100);
  });

  it('falls back to baked-in discountRatePct when WACC param is non-finite', () => {
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 0,
      revenueDelta: 0,
      costSavings: 500,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [500, 500, 500],
    };
    const fallback = computeNpvOnRead(econ, NaN);
    const at10 = computeNpvOnRead(econ, 10);
    expect(fallback.npv).toBeCloseTo(at10.npv, 6);
  });
});

// ---------------------------------------------------------------------------
// buildBusinessCaseFromAnalysis
// ---------------------------------------------------------------------------

function makeInvestmentRatios(opts: {
  npv?: number;
  irrPct?: number;
  paybackPeriods?: number;
  roiPct?: number;
}): RatioResult[] {
  const r: RatioResult[] = [];
  if (opts.npv != null)
    r.push({ category: 'investment', code: 'npv', name: 'NPV', value: opts.npv });
  if (opts.irrPct != null)
    r.push({ category: 'investment', code: 'irr_pct', name: 'IRR %', value: opts.irrPct });
  if (opts.paybackPeriods != null)
    r.push({
      category: 'investment',
      code: 'payback_periods',
      name: 'Payback (periods)',
      value: opts.paybackPeriods,
    });
  if (opts.roiPct != null)
    r.push({ category: 'investment', code: 'roi_pct', name: 'ROI %', value: opts.roiPct });
  return r;
}

describe('buildBusinessCaseFromAnalysis', () => {
  it('maps explicit benefit drivers into a flat net-benefit cashflow stream', () => {
    const ratios = makeInvestmentRatios({ npv: 5000, irrPct: 18, roiPct: 40 });
    const econ = buildBusinessCaseFromAnalysis(ratios, {
      capex: 10000,
      opex: 1000,
      revenueDelta: 3000,
      costSavings: 2000,
      horizonYears: 4,
      discountRatePct: 12,
    });

    expect(econ.capex).toBe(10000);
    expect(econ.opex).toBe(1000);
    expect(econ.revenueDelta).toBe(3000);
    expect(econ.costSavings).toBe(2000);
    expect(econ.horizonYears).toBe(4);
    expect(econ.discountRatePct).toBe(12);
    // net annual = 3000 + 2000 − 1000 = 4000, over 4 years.
    expect(econ.cashflows).toEqual([4000, 4000, 4000, 4000]);
  });

  it('reconstructs a benefit stream from ROI% when no explicit drivers given', () => {
    // roi 40% on capex 10000 ⇒ total net benefit 4000 over 5y ⇒ 800/yr net.
    // costSavings grossed up by opex (0) ⇒ 800; cashflow = 800 − 0 = 800.
    const ratios = makeInvestmentRatios({ roiPct: 40 });
    const econ = buildBusinessCaseFromAnalysis(ratios, {
      capex: 10000,
      horizonYears: 5,
    });
    expect(econ.horizonYears).toBe(5);
    expect(econ.costSavings).toBeCloseTo(800, 6);
    expect(econ.cashflows).toHaveLength(5);
    econ.cashflows.forEach((c) => expect(c).toBeCloseTo(800, 6));
    // The reconstructed case's NPV at its own rate must be finite & sensible.
    const computed = computeNpvOnRead(econ, econ.discountRatePct);
    expect(Number.isFinite(computed.npv)).toBe(true);
  });

  it('defaults horizon to 5 and discount rate to 10 when omitted', () => {
    const econ = buildBusinessCaseFromAnalysis([], { capex: 1000 });
    expect(econ.horizonYears).toBe(5);
    expect(econ.discountRatePct).toBe(10);
  });

  it('never produces negative capex/opex from junk input', () => {
    const econ = buildBusinessCaseFromAnalysis([], {
      capex: -500,
      opex: -200,
      revenueDelta: -100,
      costSavings: -50,
    });
    expect(econ.capex).toBe(0);
    expect(econ.opex).toBe(0);
    expect(econ.revenueDelta).toBe(0);
    expect(econ.costSavings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toRoiAssumptions
// ---------------------------------------------------------------------------

describe('toRoiAssumptions', () => {
  it('projects economics onto the roi_assumptions column shape', () => {
    const econ: BusinessCaseEconomics = {
      capex: 1000,
      opex: 100,
      revenueDelta: 300,
      costSavings: 200,
      horizonYears: 3,
      discountRatePct: 10,
      cashflows: [400, 400, 400], // 300 + 200 − 100
    };
    const roi = toRoiAssumptions(econ);

    expect(roi.capex).toBe(1000);
    expect(roi.opexAnnual).toBe(100);
    expect(roi.horizonMonths).toBe(36);
    expect(roi.expectedRevenueDelta).toBe(300);
    expect(roi.expectedCostDelta).toBe(200);

    // total net benefit = 1200, roi% = 1200/1000*100 = 120
    expect(roi.expectedRoiPercent).toBeCloseTo(120, 6);

    // expectedNpv consistent with computeNpvOnRead at the baked-in rate.
    const expectedNpv = computeNpvOnRead(econ, econ.discountRatePct).npv;
    expect(roi.expectedNpv).toBeCloseTo(expectedNpv, 6);
    expect(typeof roi.expectedPaybackMonths === 'number' || roi.expectedPaybackMonths === null).toBe(
      true
    );
  });
});
