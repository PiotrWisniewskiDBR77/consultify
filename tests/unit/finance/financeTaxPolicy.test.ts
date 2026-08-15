import { describe, expect, it } from 'vitest';

import {
  deriveEffectiveTaxRate,
  normalizeTaxRate,
  taxExpenseFromEbt,
} from '../../../server/src/services/financeTaxPolicy.js';

describe('canonical Finance tax policy', () => {
  it('derives the rate from EBT, not revenue', () => {
    expect(
      deriveEffectiveTaxRate({
        revenue: 1000,
        cogs: 500,
        opex: 200,
        depreciation: 50,
        interest: 50,
        tax: 38,
      })
    ).toBeCloseTo(0.19, 10);
  });

  it('does not create a tax benefit for a loss', () => {
    expect(taxExpenseFromEbt(-100, 0.19)).toBe(0);
    expect(taxExpenseFromEbt(200, 0.19)).toBeCloseTo(38, 10);
  });

  it('rejects ambiguous percent-style and missing rates', () => {
    expect(normalizeTaxRate(19)).toBeNull();
    expect(normalizeTaxRate(-0.1)).toBeNull();
    expect(normalizeTaxRate(null)).toBeNull();
  });
});
