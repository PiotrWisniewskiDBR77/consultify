import { describe, expect, it } from 'vitest';

import {
  bankableValue,
  inYearVsFullYear,
  phasingCurve,
  splitBenefit,
} from '../../../server/src/services/runRatePhasingService.js';

describe('runRatePhasingService', () => {
  describe('splitBenefit', () => {
    it('splits total value by runRateShare', () => {
      const { runRate, oneTime } = splitBenefit({ totalValue: 100, runRateShare: 0.7 });
      expect(runRate).toBeCloseTo(70, 6);
      expect(oneTime).toBeCloseTo(30, 6);
      expect(runRate + oneTime).toBeCloseTo(100, 6);
    });

    it('treats a missing share as fully recurring (share = 1)', () => {
      const { runRate, oneTime } = splitBenefit({ totalValue: 250 });
      expect(runRate).toBe(250);
      expect(oneTime).toBe(0);
    });

    it('treats share = 0 as fully one-time', () => {
      const { runRate, oneTime } = splitBenefit({ totalValue: 80, runRateShare: 0 });
      expect(runRate).toBe(0);
      expect(oneTime).toBe(80);
    });

    it('clamps an out-of-range share into [0, 1]', () => {
      expect(splitBenefit({ totalValue: 100, runRateShare: 1.5 }).runRate).toBe(100);
      expect(splitBenefit({ totalValue: 100, runRateShare: -0.5 }).oneTime).toBe(100);
    });
  });

  describe('phasingCurve', () => {
    it('attains ~100% of run-rate at rampMonths (logistic)', () => {
      const { points } = phasingCurve({
        fullRunRate: 1200,
        rampMonths: 6,
        startPeriod: 0,
        horizonMonths: 12,
      });
      // Period index 5 == 6th month == end of ramp.
      expect(points[5].runRateAttained).toBeCloseTo(1, 6);
      // Stays at full run-rate afterwards.
      expect(points[11].runRateAttained).toBeCloseTo(1, 6);
    });

    it('produces a monotonically non-decreasing attainment and cumulative', () => {
      const { points } = phasingCurve({
        fullRunRate: 1200,
        rampMonths: 6,
        startPeriod: 0,
        horizonMonths: 12,
      });
      for (let i = 1; i < points.length; i++) {
        expect(points[i].runRateAttained).toBeGreaterThanOrEqual(points[i - 1].runRateAttained);
        expect(points[i].cumulative).toBeGreaterThanOrEqual(points[i - 1].cumulative);
      }
    });

    it('respects startPeriod (zero attainment before the ramp begins)', () => {
      const { points } = phasingCurve({
        fullRunRate: 1200,
        rampMonths: 4,
        startPeriod: 3,
        horizonMonths: 12,
      });
      expect(points[0].runRateAttained).toBe(0);
      expect(points[2].runRateAttained).toBe(0);
      expect(points[2].cumulative).toBe(0);
      // After startPeriod + rampMonths it is full.
      expect(points[6].runRateAttained).toBeCloseTo(1, 6);
    });

    it('supports a linear ramp shape', () => {
      const { points } = phasingCurve({
        fullRunRate: 1200,
        rampMonths: 4,
        startPeriod: 0,
        horizonMonths: 8,
        shape: 'linear',
      });
      expect(points[0].runRateAttained).toBeCloseTo(0.25, 6);
      expect(points[1].runRateAttained).toBeCloseTo(0.5, 6);
      expect(points[3].runRateAttained).toBeCloseTo(1, 6);
    });

    it('emits one point per horizon month', () => {
      const { points } = phasingCurve({
        fullRunRate: 600,
        rampMonths: 3,
        startPeriod: 0,
        horizonMonths: 24,
      });
      expect(points).toHaveLength(24);
      expect(points[0].period).toBe(0);
      expect(points[23].period).toBe(23);
    });
  });

  describe('inYearVsFullYear', () => {
    it('in-year impact is strictly less than full-year run-rate for a partial year', () => {
      const benefit = { totalValue: 1200, runRateShare: 1 };
      const { inYearImpact, fullYearRunRate } = inYearVsFullYear(benefit, 4);
      expect(fullYearRunRate).toBe(1200);
      expect(inYearImpact).toBeCloseTo(400, 6); // 4/12 of 1200
      expect(inYearImpact).toBeLessThan(fullYearRunRate);
    });

    it('in-year equals full-year only across a full 12 months', () => {
      const { inYearImpact, fullYearRunRate } = inYearVsFullYear(
        { totalValue: 900 },
        12,
      );
      expect(inYearImpact).toBeCloseTo(fullYearRunRate, 6);
    });

    it('only the run-rate portion is annualised (one-time excluded)', () => {
      const { fullYearRunRate } = inYearVsFullYear(
        { totalValue: 1000, runRateShare: 0.6 },
        6,
      );
      expect(fullYearRunRate).toBe(600);
    });
  });

  describe('bankableValue', () => {
    it('sums only the run-rate portion across benefits', () => {
      const benefits = [
        { totalValue: 1000, runRateShare: 0.5 }, // 500 run-rate
        { totalValue: 400, runRateShare: 1 }, // 400 run-rate
        { totalValue: 300, runRateShare: 0 }, // 0 run-rate (fully one-time)
      ];
      expect(bankableValue(benefits)).toBeCloseTo(900, 6);
    });

    it('excludes one-time value from the durable base', () => {
      const totalOfAll = 1000 + 400 + 300;
      const benefits = [
        { totalValue: 1000, runRateShare: 0.5 },
        { totalValue: 400, runRateShare: 1 },
        { totalValue: 300, runRateShare: 0 },
      ];
      expect(bankableValue(benefits)).toBeLessThan(totalOfAll);
    });

    it('returns 0 for an empty or invalid input', () => {
      expect(bankableValue([])).toBe(0);
      // @ts-expect-error intentional invalid input
      expect(bankableValue(undefined)).toBe(0);
    });
  });
});
