import { describe, expect, it } from 'vitest';

import { financialModelForecastYear, valuationMonetaryUnit } from '../valuationService.js';

describe('valuation monetary unit contract', () => {
  it.each([
    ['units', 1],
    ['thousands', 1000],
    ['millions', 1000000],
    ['billions', 1000000000],
  ])('maps %s to its full-currency multiplier', (scaling, multiplier) => {
    expect(valuationMonetaryUnit(scaling)).toEqual({
      sourceScaling: scaling,
      multiplier,
      storageUnit: 'source_report_unit',
      displayUnit: 'currency_unit',
    });
  });

  it('uses units for unknown legacy scaling', () => {
    expect(valuationMonetaryUnit('unexpected').multiplier).toBe(1);
  });
});

describe('financial model FCFF contract', () => {
  it('subtracts CAPEX_CF from operating cash flow instead of silently ignoring it', () => {
    const result = financialModelForecastYear(
      [
        {
          date: '2026-12-01',
          label: 'FY2026',
          pl: { REVENUE: 1_227_736.1, EBITDA: 122_773.61 },
          bs: {},
          cf: { OPERATING_CF: 89_302.82, CAPEX_CF: -61_386.8 },
        },
      ],
      0
    );

    expect(result).toEqual({
      year: 1,
      fcff: 27_916.02,
      revenue: 1_227_736.1,
      ebitda: 122_773.61,
    });
  });
});
