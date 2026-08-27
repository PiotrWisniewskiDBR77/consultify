import { describe, expect, it } from 'vitest';

import {
  formatEmployeeCount,
  formatHeadcountPL,
  normalizeIndustry,
} from '../assessmentReportContractService.js';

// FIX-3/FIX-4 (nadzorca 2026-08-28). Both fixes are about what a CLIENT
// reads on the cover of a paid advisory document, so both are pinned here as
// pure-function tests — no database needed, therefore no reason for the
// guard to be skipped in any environment.
describe('DRD cover — headcount grammar (FIX-4)', () => {
  it('uses the correct Polish numeral form for every class of count', () => {
    // Singular.
    expect(formatHeadcountPL(1)).toBe('1 osoba');
    // Nominative plural: 2–4 and anything ending in 2–4 outside the teens.
    for (const value of [2, 3, 4, 22, 23, 24, 102, 104, 1002]) {
      expect(formatHeadcountPL(value)).toBe(`${value} osoby`);
    }
    // Genitive plural: 5–21 (teens included, even though 12–14 end in 2–4),
    // and anything ending in 0, 1 or 5–9.
    for (const value of [0, 5, 9, 11, 12, 13, 14, 15, 21, 25, 111, 214, 1000]) {
      expect(formatHeadcountPL(value)).toBe(`${value} osób`);
    }
  });

  it('never emits the pre-fix "N osób" form for 2–4', () => {
    // Regression pin for the exact wording the owner would have seen.
    expect(formatHeadcountPL(2)).not.toBe('2 osób');
    expect(formatHeadcountPL(3)).not.toBe('3 osób');
    expect(formatHeadcountPL(4)).not.toBe('4 osób');
  });
});

describe('DRD cover — employee_count column (FIX-3)', () => {
  it('reads a real integer headcount and renders it with correct grammar', () => {
    expect(formatEmployeeCount(214)).toBe('214 osób');
    expect(formatEmployeeCount(3)).toBe('3 osoby');
    expect(formatEmployeeCount('42')).toBe('42 osoby');
  });

  it('treats absent, zero and non-numeric values as no data, never as "0 osób"', () => {
    for (const value of [null, undefined, 0, -5, '', 'brak', Number.NaN]) {
      expect(formatEmployeeCount(value)).toBeNull();
    }
  });
});

describe('DRD cover — business profile (FIX-3)', () => {
  it("rejects the legacy organizations.industry DEFAULT 'General' as missing data", () => {
    // server/migrations/000_z_core_baseline.sql:34 gives organizations.industry
    // DEFAULT 'General'. Printing that word on a client cover is worse than an
    // honest gap, so it is treated as absence.
    expect(normalizeIndustry('General')).toBeNull();
    expect(normalizeIndustry('general')).toBeNull();
    expect(normalizeIndustry('  General  ')).toBeNull();
  });

  it('keeps a real industry value untouched and trims blanks to null', () => {
    expect(normalizeIndustry('Obróbka i przetwórstwo metali')).toBe(
      'Obróbka i przetwórstwo metali'
    );
    expect(normalizeIndustry('   ')).toBeNull();
    expect(normalizeIndustry(null)).toBeNull();
    expect(normalizeIndustry(undefined)).toBeNull();
  });
});
