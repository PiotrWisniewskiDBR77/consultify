/**
 * Economics Calculation Tests
 * Tests for financial and ROI calculations
 *
 * @module tests/economics/calculations.test.js
 */

import { describe, it, expect } from 'vitest';

// Economics calculation utilities
const economicsCalc = {
  // ROI Calculations
  calculateROI: (gain, cost) => {
    if (cost === 0) return 0;
    return ((gain - cost) / cost) * 100;
  },

  calculatePaybackPeriod: (investment, annualCashFlow) => {
    if (annualCashFlow <= 0) return Infinity;
    return investment / annualCashFlow;
  },

  calculateNPV: (cashFlows, discountRate) => {
    return cashFlows.reduce((npv, cf, year) => {
      return npv + cf / Math.pow(1 + discountRate, year);
    }, 0);
  },

  calculateIRR: (cashFlows, guess = 0.1) => {
    const maxIterations = 100;
    const tolerance = 0.0001;
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivNpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        const factor = Math.pow(1 + rate, j);
        npv += cashFlows[j] / factor;
        derivNpv -= (j * cashFlows[j]) / Math.pow(1 + rate, j + 1);
      }

      const newRate = rate - npv / derivNpv;
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }
      rate = newRate;
    }
    return rate;
  },

  // Margin Calculations
  calculateGrossMargin: (revenue, cogs) => {
    if (revenue === 0) return 0;
    return ((revenue - cogs) / revenue) * 100;
  },

  calculateNetMargin: (netIncome, revenue) => {
    if (revenue === 0) return 0;
    return (netIncome / revenue) * 100;
  },

  // Growth Calculations
  calculateGrowthRate: (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  },

  calculateCAGR: (startValue, endValue, years) => {
    if (startValue <= 0 || years <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  },

  // Cost Calculations
  calculateTCO: (initialCost, annualCosts, years) => {
    return initialCost + annualCosts * years;
  },

  calculateBreakeven: (fixedCosts, pricePerUnit, variableCostPerUnit) => {
    const contribution = pricePerUnit - variableCostPerUnit;
    if (contribution <= 0) return Infinity;
    return fixedCosts / contribution;
  },

  // Efficiency Calculations
  calculateEfficiencyGain: (before, after) => {
    if (before === 0) return 0;
    return ((before - after) / before) * 100;
  },

  calculateProductivity: (output, input) => {
    if (input === 0) return 0;
    return output / input;
  },

  // Subscription Metrics
  calculateMRR: (subscriptions) => {
    return subscriptions.reduce((total, sub) => {
      return total + sub.price / (sub.billingCycle === 'yearly' ? 12 : 1);
    }, 0);
  },

  calculateARR: (mrr) => mrr * 12,

  calculateLTV: (avgRevenue, avgLifespan) => {
    return avgRevenue * avgLifespan;
  },

  calculateCAC: (salesCost, marketingCost, newCustomers) => {
    if (newCustomers === 0) return 0;
    return (salesCost + marketingCost) / newCustomers;
  },

  calculateLTVtoCAC: (ltv, cac) => {
    if (cac === 0) return ltv > 0 ? Infinity : 0;
    return ltv / cac;
  },

  calculateChurnRate: (lostCustomers, totalCustomers) => {
    if (totalCustomers === 0) return 0;
    return (lostCustomers / totalCustomers) * 100;
  },

  // Currency Formatting
  formatCurrency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  },
};

describe('Economics Calculations Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // ROI CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('ROI Calculations', () => {
    it('should calculate ROI', () => {
      expect(economicsCalc.calculateROI(150, 100)).toBe(50);
    });

    it('should handle negative ROI', () => {
      expect(economicsCalc.calculateROI(80, 100)).toBe(-20);
    });

    it('should handle zero cost', () => {
      expect(economicsCalc.calculateROI(100, 0)).toBe(0);
    });
  });

  describe('Payback Period', () => {
    it('should calculate payback period', () => {
      expect(economicsCalc.calculatePaybackPeriod(100000, 25000)).toBe(4);
    });

    it('should handle zero cash flow', () => {
      expect(economicsCalc.calculatePaybackPeriod(100000, 0)).toBe(Infinity);
    });
  });

  describe('NPV', () => {
    it('should calculate NPV', () => {
      const cashFlows = [-100000, 30000, 40000, 50000, 60000];
      const npv = economicsCalc.calculateNPV(cashFlows, 0.1);
      expect(npv).toBeGreaterThan(35000);
      expect(npv).toBeLessThan(40000);
    });

    it('should handle single cash flow', () => {
      const npv = economicsCalc.calculateNPV([1000], 0.1);
      expect(npv).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MARGIN CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Margin Calculations', () => {
    it('should calculate gross margin', () => {
      expect(economicsCalc.calculateGrossMargin(100, 60)).toBe(40);
    });

    it('should calculate net margin', () => {
      expect(economicsCalc.calculateNetMargin(20, 100)).toBe(20);
    });

    it('should handle zero revenue', () => {
      expect(economicsCalc.calculateGrossMargin(0, 50)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GROWTH CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Growth Calculations', () => {
    it('should calculate growth rate', () => {
      expect(economicsCalc.calculateGrowthRate(150, 100)).toBe(50);
    });

    it('should handle negative growth', () => {
      expect(economicsCalc.calculateGrowthRate(80, 100)).toBe(-20);
    });

    it('should calculate CAGR', () => {
      const cagr = economicsCalc.calculateCAGR(100, 200, 3);
      expect(cagr).toBeCloseTo(26, 0); // ~26%
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // COST CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Cost Calculations', () => {
    it('should calculate TCO', () => {
      expect(economicsCalc.calculateTCO(50000, 10000, 5)).toBe(100000);
    });

    it('should calculate breakeven', () => {
      expect(economicsCalc.calculateBreakeven(100000, 50, 30)).toBe(5000);
    });

    it('should handle no contribution margin', () => {
      expect(economicsCalc.calculateBreakeven(100000, 30, 30)).toBe(Infinity);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EFFICIENCY CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Efficiency Calculations', () => {
    it('should calculate efficiency gain', () => {
      expect(economicsCalc.calculateEfficiencyGain(100, 60)).toBe(40);
    });

    it('should calculate productivity', () => {
      expect(economicsCalc.calculateProductivity(1000, 40)).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUBSCRIPTION METRICS
  // ═══════════════════════════════════════════════════════════════════

  describe('Subscription Metrics', () => {
    it('should calculate MRR', () => {
      const subs = [
        { price: 100, billingCycle: 'monthly' },
        { price: 1200, billingCycle: 'yearly' },
      ];
      expect(economicsCalc.calculateMRR(subs)).toBe(200);
    });

    it('should calculate ARR', () => {
      expect(economicsCalc.calculateARR(10000)).toBe(120000);
    });

    it('should calculate LTV', () => {
      expect(economicsCalc.calculateLTV(100, 24)).toBe(2400);
    });

    it('should calculate CAC', () => {
      expect(economicsCalc.calculateCAC(50000, 30000, 100)).toBe(800);
    });

    it('should calculate LTV:CAC ratio', () => {
      expect(economicsCalc.calculateLTVtoCAC(2400, 800)).toBe(3);
    });

    it('should calculate churn rate', () => {
      expect(economicsCalc.calculateChurnRate(5, 100)).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CURRENCY FORMATTING
  // ═══════════════════════════════════════════════════════════════════

  describe('Currency Formatting', () => {
    it('should format USD', () => {
      expect(economicsCalc.formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format with different currency', () => {
      const result = economicsCalc.formatCurrency(1234.56, 'EUR');
      expect(result).toContain('€');
    });

    it('should handle negative amounts', () => {
      expect(economicsCalc.formatCurrency(-1000)).toBe('-$1,000.00');
    });
  });
});
