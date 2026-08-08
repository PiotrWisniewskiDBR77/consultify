import { describe, expect, it } from 'vitest';

import { formatValuationMoney } from '../valuationExportService.js';

describe('valuation export monetary unit contract', () => {
  it('exports native thousands as full currency value', () => {
    expect(formatValuationMoney(465989.07, 'PLN', 1000)).toBe('465.99M PLN');
  });
});
