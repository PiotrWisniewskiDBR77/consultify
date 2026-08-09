import { describe, expect, it } from 'vitest';

import { formatValuationImpact } from '../../../src/components/Benefits/ValuationWorkspace';
import {
  valuationDisplayMultiplier,
  valuationDisplayValue,
} from '../../../src/utils/valuationMonetaryUnit';

describe('valuation sensitivity UI formatting', () => {
  it('formats floating-point driver swings as compact currency values', () => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
      notation: 'compact',
    });

    const rendered = formatValuationImpact(138926.96000000002, formatter);

    expect(rendered).toMatch(/139K/);
    expect(rendered).not.toContain('000000000');
  });

  it('converts native report thousands into full currency units', () => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
      notation: 'compact',
    });
    const results = { monetaryUnit: { sourceScaling: 'thousands', multiplier: 1000 } };
    const multiplier = valuationDisplayMultiplier(results);

    expect(multiplier).toBe(1000);
    expect(valuationDisplayValue(465989.07, multiplier)).toBe(465989070);
    expect(formatValuationImpact(465989.07, formatter, multiplier)).toMatch(/466M/);
  });

  it('fails safely to unscaled display for missing or invalid metadata', () => {
    expect(valuationDisplayMultiplier({})).toBe(1);
    expect(valuationDisplayMultiplier({ monetaryUnit: { multiplier: -1000 } })).toBe(1);
    expect(valuationDisplayValue('not-a-number', 1000)).toBeNull();
  });
});
