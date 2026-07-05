import { describe, it, expect } from 'vitest';
import {
  annualizedRunRate,
  inYearValue,
  runRateBridge,
  valueTimingSplit,
} from '../../../server/src/services/results/runRateService.js';

describe('runRateService', () => {
  describe('annualizedRunRate', () => {
    it('annualizes a partial-period realized value', () => {
      // 300 over 3 months -> 100/month -> 1200/year
      expect(annualizedRunRate(300, 3)).toBe(1200);
    });

    it('returns the same value when periodMonths is 12', () => {
      expect(annualizedRunRate(1200, 12)).toBe(1200);
    });

    it('returns 0 for non-positive periodMonths', () => {
      expect(annualizedRunRate(500, 0)).toBe(0);
      expect(annualizedRunRate(500, -4)).toBe(0);
    });

    it('returns 0 for non-finite inputs', () => {
      expect(annualizedRunRate(Number.NaN, 3)).toBe(0);
      expect(annualizedRunRate(300, Number.NaN)).toBe(0);
    });
  });

  describe('inYearValue', () => {
    const points = [
      { month: '2025-11', value: 50 },
      { month: '2026-01', value: 100 },
      { month: '2026-03-01', value: 200 },
      { month: '2027-02', value: 999 },
    ];

    it('sums only the values within the requested year', () => {
      expect(inYearValue(points, 2026)).toBe(300);
    });

    it('handles full ISO date prefixes', () => {
      expect(inYearValue([{ month: '2026-12-31', value: 42 }], 2026)).toBe(42);
    });

    it('returns 0 when no points match', () => {
      expect(inYearValue(points, 2030)).toBe(0);
    });

    it('ignores malformed entries and non-finite values', () => {
      const messy = [
        { month: '2026-05', value: 10 },
        { month: 'xx', value: 5 },
        { month: '2026-06', value: Number.NaN },
      ];
      expect(inYearValue(messy, 2026)).toBe(10);
    });

    it('returns 0 for non-array input', () => {
      // @ts-expect-error testing defensive guard
      expect(inYearValue(null, 2026)).toBe(0);
    });
  });

  describe('runRateBridge', () => {
    it('projects already-realized value forward over remaining months', () => {
      // realized 600 over 6 months -> runRate 1200 -> 100/month
      // remaining 6 months -> projected = 600 + 100*6 = 1200
      const result = runRateBridge({
        realizedToDate: 600,
        periodMonths: 6,
        remainingMonthsInYear: 6,
      });
      expect(result.runRate).toBe(1200);
      expect(result.alreadyRealized).toBe(600);
      expect(result.projectedInYear).toBe(1200);
    });

    it('projectedInYear equals alreadyRealized when no months remain', () => {
      const result = runRateBridge({
        realizedToDate: 900,
        periodMonths: 9,
        remainingMonthsInYear: 0,
      });
      expect(result.projectedInYear).toBe(900);
      expect(result.runRate).toBe(1200);
    });

    it('yields zero run-rate for non-positive periodMonths', () => {
      const result = runRateBridge({
        realizedToDate: 500,
        periodMonths: 0,
        remainingMonthsInYear: 6,
      });
      expect(result.runRate).toBe(0);
      expect(result.projectedInYear).toBe(500);
      expect(result.alreadyRealized).toBe(500);
    });
  });

  describe('valueTimingSplit', () => {
    it('aggregates total realized and total run-rate across items', () => {
      const result = valueTimingSplit([
        { realizedValue: 300, periodMonths: 3 }, // runRate 1200
        { realizedValue: 600, periodMonths: 6 }, // runRate 1200
      ]);
      expect(result.totalRealized).toBe(900);
      expect(result.totalRunRate).toBe(2400);
    });

    it('treats missing fields as zero and skips run-rate without periodMonths', () => {
      const result = valueTimingSplit([
        { realizedValue: 100 }, // no periodMonths -> 0 run-rate
        {}, // nothing -> 0/0
        { realizedValue: 240, periodMonths: 12 }, // runRate 240
      ]);
      expect(result.totalRealized).toBe(340);
      expect(result.totalRunRate).toBe(240);
    });

    it('returns zeros for non-array input', () => {
      // @ts-expect-error testing defensive guard
      expect(valueTimingSplit(undefined)).toEqual({ totalRunRate: 0, totalRealized: 0 });
    });
  });
});
