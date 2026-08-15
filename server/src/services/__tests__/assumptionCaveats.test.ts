import { describe, expect, it } from 'vitest';

import { extractAssumptionCaveats } from '../assumptionCaveats.js';

describe('extractAssumptionCaveats', () => {
  it('extracts an explicit status and its matching note', () => {
    expect(
      extractAssumptionCaveats({
        implementationLagMonths: null,
        implementationLagAssumptionStatus: 'NEEDS_PRODUCT_DECISION',
        implementationLagAssumptionNote: 'No ramp-up schedule exists in source data.',
        discountRatePct: 10,
      })
    ).toEqual([
      {
        key: 'implementationLag',
        status: 'NEEDS_PRODUCT_DECISION',
        note: 'No ramp-up schedule exists in source data.',
      },
    ]);
  });

  it('returns an empty list for absent, malformed, or marker-free assumptions', () => {
    expect(extractAssumptionCaveats(null)).toEqual([]);
    expect(extractAssumptionCaveats(undefined)).toEqual([]);
    expect(extractAssumptionCaveats({ discountRatePct: 10 })).toEqual([]);
    expect(extractAssumptionCaveats({ pricingAssumptionStatus: 42 })).toEqual([]);
  });

  it('keeps a marker without a note and returns multiple markers in stable key order', () => {
    expect(
      extractAssumptionCaveats({
        pricingAssumptionStatus: 'CONFIRMED',
        implementationLagAssumptionStatus: 'NEEDS_PRODUCT_DECISION',
        implementationLagAssumptionNote: 'No source schedule.',
      })
    ).toEqual([
      {
        key: 'implementationLag',
        status: 'NEEDS_PRODUCT_DECISION',
        note: 'No source schedule.',
      },
      { key: 'pricing', status: 'CONFIRMED', note: undefined },
    ]);
  });
});
