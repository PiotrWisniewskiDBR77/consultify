import { describe, expect, it } from 'vitest';

import {
  computeYoY,
  convertCurrency,
  mergeMultiYear,
  normalizeToPresentation,
  readinessThreshold,
  type MultiYearStatement,
  type StatementLine,
} from '../../../server/src/services/statementCompletenessService';

describe('statementCompletenessService', () => {
  describe('convertCurrency', () => {
    // rates expressed in base currency (PLN): 1 EUR = 4.3 PLN, 1 USD = 4.0 PLN
    const rates = { EUR: 4.3, USD: 4.0, PLN: 1 };

    it('converts EUR → PLN using the rate', () => {
      expect(convertCurrency(100, 'EUR', 'PLN', rates)).toBeCloseTo(430, 6);
    });

    it('converts USD → EUR via the base currency', () => {
      // 100 USD = 400 PLN = 400 / 4.3 EUR
      expect(convertCurrency(100, 'USD', 'EUR', rates)).toBeCloseTo(400 / 4.3, 6);
    });

    it('is identity when from === to', () => {
      expect(convertCurrency(50, 'EUR', 'EUR', rates)).toBe(50);
    });

    it('returns null when a rate is missing', () => {
      expect(convertCurrency(100, 'GBP', 'PLN', rates)).toBeNull();
      expect(convertCurrency(100, 'PLN', 'GBP', rates)).toBeNull();
    });

    it('returns null for a non-finite value', () => {
      expect(convertCurrency(Number.NaN, 'EUR', 'PLN', rates)).toBeNull();
    });
  });

  describe('normalizeToPresentation', () => {
    it('converts all lines to a single presentation currency', () => {
      const rates = { EUR: 4.3, USD: 4.0, PLN: 1 };
      const lines: StatementLine[] = [
        { code: 'revenue', value: 100, currency: 'EUR' },
        { code: 'cogs', value: 200, currency: 'USD' },
        { code: 'tax', value: 50, currency: 'PLN' },
      ];

      const out = normalizeToPresentation(lines, 'PLN', rates);

      expect(out).toEqual([
        { code: 'revenue', value: 430, originalCcy: 'EUR' },
        { code: 'cogs', value: 800, originalCcy: 'USD' },
        { code: 'tax', value: 50, originalCcy: 'PLN' },
      ]);
      // every normalized line is now in one currency conceptually
      expect(out.map((l) => l.value)).toEqual([430, 800, 50]);
    });

    it('keeps original value but records original currency when a rate is missing', () => {
      const rates = { EUR: 4.3, PLN: 1 };
      const lines: StatementLine[] = [{ code: 'revenue', value: 100, currency: 'GBP' }];

      const out = normalizeToPresentation(lines, 'PLN', rates);

      expect(out).toEqual([{ code: 'revenue', value: 100, originalCcy: 'GBP' }]);
    });
  });

  describe('mergeMultiYear', () => {
    it('builds a series per code across periods', () => {
      const statements: MultiYearStatement[] = [
        { period: '2023', lines: [{ code: 'revenue', value: 100 }, { code: 'cogs', value: 40 }] },
        { period: '2024', lines: [{ code: 'revenue', value: 120 }, { code: 'cogs', value: 50 }] },
        { period: '2025', lines: [{ code: 'revenue', value: 150 }] },
      ];

      const merged = mergeMultiYear(statements);

      expect(merged.periods).toEqual(['2023', '2024', '2025']);
      expect(merged.byCode.revenue).toEqual([100, 120, 150]);
      // cogs absent in 2025 → 0
      expect(merged.byCode.cogs).toEqual([40, 50, 0]);
    });

    it('returns empty structure for no statements', () => {
      expect(mergeMultiYear([])).toEqual({ periods: [], byCode: {} });
    });
  });

  describe('computeYoY', () => {
    it('computes year-over-year percentage change', () => {
      const out = computeYoY([100, 120, 150]);

      expect(out[0]).toEqual({ period: '0', value: 100, yoyPct: null });
      expect(out[1].value).toBe(120);
      expect(out[1].yoyPct).toBeCloseTo(20, 6); // +20%
      expect(out[2].value).toBe(150);
      expect(out[2].yoyPct).toBeCloseTo(25, 6); // 150 vs 120 = +25%
    });

    it('accepts {period, value} points and yields null when prior is 0', () => {
      const out = computeYoY([
        { period: '2023', value: 0 },
        { period: '2024', value: 100 },
      ]);

      expect(out[0].yoyPct).toBeNull();
      expect(out[1].period).toBe('2024');
      expect(out[1].yoyPct).toBeNull(); // division by zero prior → null
    });
  });

  describe('readinessThreshold', () => {
    it('is ready when all REQUIRED lines are covered, even if optional lines are missing', () => {
      // optional lines (e.g. 'depreciation') are NOT in requiredCoverage
      const coverage = { revenue: true, cogs: true, depreciation: false };
      const required = ['revenue', 'cogs'];

      const res = readinessThreshold(coverage, required);

      expect(res.ready).toBe(true);
      expect(res.reason).toContain('required');
    });

    it('is not ready when a required line is missing', () => {
      const coverage = { revenue: true, cogs: false };
      const required = ['revenue', 'cogs'];

      const res = readinessThreshold(coverage, required);

      expect(res.ready).toBe(false);
      expect(res.reason).toContain('cogs');
      expect(res.reason).toContain('50%');
    });

    it('is vacuously ready when no required lines are defined', () => {
      expect(readinessThreshold({}, []).ready).toBe(true);
    });
  });
});
