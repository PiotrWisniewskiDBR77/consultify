/**
 * Economics financials helper tests
 */

import { describe, expect, it } from 'vitest';

import {
  calculateFinancialMetrics,
  normalizeFinancialData,
} from '../../../../src/services/economicsFinancials.js';

describe('economicsFinancials helpers', () => {
  it('calculates positive NPV for strong benefits', () => {
    const data = normalizeFinancialData({
      initialInvestment: 100000,
      annualCostSavings: 50000,
      annualRevenueIncrease: 20000,
      analysisHorizonYears: 5,
      discountRate: 8,
    });

    const metrics = calculateFinancialMetrics(data);
    expect(metrics.npv).toBeGreaterThan(0);
  });

  it('returns null ROI when costs are zero', () => {
    const data = normalizeFinancialData({
      analysisHorizonYears: 3,
      annualCostSavings: 0,
      annualRevenueIncrease: 0,
    });

    const metrics = calculateFinancialMetrics(data);
    expect(metrics.roi).toBeNull();
  });
});
