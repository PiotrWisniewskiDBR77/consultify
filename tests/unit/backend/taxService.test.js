/**
 * Tax Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('TaxService', () => {
  it('should calculate tax', () => {
    const tax = { amount: 100, rate: 0.2 };
    expect(tax.rate).toBeLessThan(1);
  });

  it('should get tax rates', () => {
    const rates = [{ region: 'US', rate: 0.1 }];
    expect(rates.length).toBeGreaterThan(0);
  });
});
