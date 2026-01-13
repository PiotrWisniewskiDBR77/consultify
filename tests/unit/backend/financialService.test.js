/**
 * Financial Service Unit Tests
 * Tests financial data, metrics, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Financial Service implementation
const createFinancialService = () => {
  const transactions = [];
  const metrics = new Map();
  let counter = 0;

  return {
    recordTransaction: (data) => {
      const transaction = {
        id: `txn-${Date.now()}-${++counter}`,
        type: data.type,
        amount: data.amount,
        currency: data.currency || 'USD',
        category: data.category,
        description: data.description,
        date: data.date || new Date(),
      };
      transactions.push(transaction);
      return transaction;
    },

    getFinancials: (period = 'month') => {
      const now = new Date();
      const periodStart = new Date(now);

      if (period === 'month') periodStart.setMonth(now.getMonth() - 1);
      else if (period === 'year') periodStart.setFullYear(now.getFullYear() - 1);
      else if (period === 'quarter') periodStart.setMonth(now.getMonth() - 3);

      const periodTxns = transactions.filter((t) => new Date(t.date) >= periodStart);

      const revenue = periodTxns
        .filter((t) => t.type === 'revenue')
        .reduce((sum, t) => sum + t.amount, 0);

      const costs = periodTxns
        .filter((t) => t.type === 'cost')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        revenue,
        costs,
        profit: revenue - costs,
        margin: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
        transactionCount: periodTxns.length,
      };
    },

    setMetric: (name, value) => {
      metrics.set(name, {
        value,
        updatedAt: new Date(),
      });
    },

    getMetric: (name) => metrics.get(name)?.value || null,

    getMRR: () => metrics.get('mrr')?.value || 0,

    getARR: () => (metrics.get('mrr')?.value || 0) * 12,

    calculateGrowthRate: (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    },

    getRevenueByCategory: () => {
      return transactions
        .filter((t) => t.type === 'revenue')
        .reduce((acc, t) => {
          acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + t.amount;
          return acc;
        }, {});
    },

    getCostByCategory: () => {
      return transactions
        .filter((t) => t.type === 'cost')
        .reduce((acc, t) => {
          acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + t.amount;
          return acc;
        }, {});
    },

    getTransactions: (filters = {}) => {
      let result = [...transactions];
      if (filters.type) result = result.filter((t) => t.type === filters.type);
      if (filters.category) result = result.filter((t) => t.category === filters.category);
      return result.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
  };
};

describe('FinancialService', () => {
  let financialService;

  beforeEach(() => {
    financialService = createFinancialService();
  });

  describe('Transaction Recording', () => {
    it('should record revenue transaction', () => {
      const txn = financialService.recordTransaction({
        type: 'revenue',
        amount: 10000,
        category: 'subscription',
      });

      expect(txn.id).toBeDefined();
      expect(txn.amount).toBe(10000);
    });

    it('should record cost transaction', () => {
      const txn = financialService.recordTransaction({
        type: 'cost',
        amount: 5000,
        category: 'infrastructure',
      });

      expect(txn.type).toBe('cost');
    });
  });

  describe('Financial Summary', () => {
    it('should calculate financials', () => {
      financialService.recordTransaction({ type: 'revenue', amount: 100000 });
      financialService.recordTransaction({ type: 'cost', amount: 60000 });

      const financials = financialService.getFinancials('month');

      expect(financials.revenue).toBe(100000);
      expect(financials.costs).toBe(60000);
      expect(financials.profit).toBe(40000);
    });

    it('should calculate margin', () => {
      financialService.recordTransaction({ type: 'revenue', amount: 100 });
      financialService.recordTransaction({ type: 'cost', amount: 75 });

      const financials = financialService.getFinancials();
      expect(financials.margin).toBe(25); // 25% margin
    });
  });

  describe('Metrics', () => {
    it('should track MRR', () => {
      financialService.setMetric('mrr', 50000);
      expect(financialService.getMRR()).toBe(50000);
    });

    it('should calculate ARR from MRR', () => {
      financialService.setMetric('mrr', 50000);
      expect(financialService.getARR()).toBe(600000);
    });
  });

  describe('Growth Calculation', () => {
    it('should calculate growth rate', () => {
      const rate = financialService.calculateGrowthRate(110, 100);
      expect(rate).toBe(10); // 10% growth
    });

    it('should handle zero previous value', () => {
      const rate = financialService.calculateGrowthRate(100, 0);
      expect(rate).toBe(100);
    });
  });

  describe('Category Analysis', () => {
    it('should group revenue by category', () => {
      financialService.recordTransaction({
        type: 'revenue',
        amount: 5000,
        category: 'subscription',
      });
      financialService.recordTransaction({
        type: 'revenue',
        amount: 3000,
        category: 'subscription',
      });
      financialService.recordTransaction({ type: 'revenue', amount: 2000, category: 'consulting' });

      const byCategory = financialService.getRevenueByCategory();

      expect(byCategory.subscription).toBe(8000);
      expect(byCategory.consulting).toBe(2000);
    });
  });
});
