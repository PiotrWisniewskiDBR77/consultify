import { describe, expect, it } from 'vitest';

import { valuationMonetaryUnit } from '../valuationService.js';

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
