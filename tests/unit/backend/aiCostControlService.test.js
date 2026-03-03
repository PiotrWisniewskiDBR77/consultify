/**
 * AI Cost Control Service Unit Tests
 * Tests budget management, usage limits, and cost tracking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Cost Control implementation
const createAICostControlService = () => {
  const budgets = new Map();
  const usage = new Map();

  return {
    setBudget: (organizationId, config) => {
      const budget = {
        organizationId,
        dailyLimit: config.dailyLimit || 10,
        monthlyLimit: config.monthlyLimit || 100,
        alertThreshold: config.alertThreshold || 0.8,
        hardLimit: config.hardLimit ?? true,
      };
      budgets.set(organizationId, budget);
      return budget;
    },

    getBudget: (organizationId) => budgets.get(organizationId) || null,

    recordUsage: (organizationId, amount) => {
      const current = usage.get(organizationId) || { daily: 0, monthly: 0 };
      current.daily += amount;
      current.monthly += amount;
      current.lastUpdated = new Date();
      usage.set(organizationId, current);
      return current;
    },

    getUsage: (organizationId) => usage.get(organizationId) || { daily: 0, monthly: 0 },

    checkBudget: (organizationId) => {
      const budget = budgets.get(organizationId) || { dailyLimit: 10, monthlyLimit: 100 };
      const currentUsage = usage.get(organizationId) || { daily: 0, monthly: 0 };

      const dailyRemaining = budget.dailyLimit - currentUsage.daily;
      const monthlyRemaining = budget.monthlyLimit - currentUsage.monthly;

      return {
        allowed: dailyRemaining > 0 && monthlyRemaining > 0,
        daily: {
          used: currentUsage.daily,
          limit: budget.dailyLimit,
          remaining: Math.max(0, dailyRemaining),
        },
        monthly: {
          used: currentUsage.monthly,
          limit: budget.monthlyLimit,
          remaining: Math.max(0, monthlyRemaining),
        },
      };
    },

    canMakeRequest: (organizationId, estimatedCost) => {
      const status = this.checkBudget?.(organizationId) || { allowed: true };
      const budget = budgets.get(organizationId);

      if (!budget) return { allowed: true, reason: 'No budget configured' };

      const currentUsage = usage.get(organizationId) || { daily: 0, monthly: 0 };

      if (currentUsage.daily + estimatedCost > budget.dailyLimit) {
        return { allowed: false, reason: 'Daily limit exceeded' };
      }
      if (currentUsage.monthly + estimatedCost > budget.monthlyLimit) {
        return { allowed: false, reason: 'Monthly limit exceeded' };
      }

      return { allowed: true, reason: 'Within budget' };
    },

    isAlertThresholdReached: (organizationId) => {
      const budget = budgets.get(organizationId);
      if (!budget) return false;

      const currentUsage = usage.get(organizationId) || { monthly: 0 };
      return currentUsage.monthly >= budget.monthlyLimit * budget.alertThreshold;
    },

    resetDailyUsage: (organizationId) => {
      const current = usage.get(organizationId);
      if (current) {
        current.daily = 0;
      }
    },
  };
};

describe('AICostControlService', () => {
  let costService;

  beforeEach(() => {
    costService = createAICostControlService();
  });

  describe('Budget Management', () => {
    it('should set budget', () => {
      const budget = costService.setBudget('org-1', {
        dailyLimit: 50,
        monthlyLimit: 500,
      });

      expect(budget.dailyLimit).toBe(50);
      expect(budget.monthlyLimit).toBe(500);
    });

    it('should get budget', () => {
      costService.setBudget('org-1', { dailyLimit: 100 });
      const budget = costService.getBudget('org-1');

      expect(budget).not.toBeNull();
    });

    it('should use default limits', () => {
      const budget = costService.setBudget('org-1', {});

      expect(budget.dailyLimit).toBe(10);
      expect(budget.monthlyLimit).toBe(100);
    });
  });

  describe('Usage Tracking', () => {
    it('should record usage', () => {
      costService.recordUsage('org-1', 5);
      costService.recordUsage('org-1', 3);

      const usage = costService.getUsage('org-1');
      expect(usage.daily).toBe(8);
      expect(usage.monthly).toBe(8);
    });
  });

  describe('Budget Checking', () => {
    it('should check budget status', () => {
      costService.setBudget('org-1', { dailyLimit: 10, monthlyLimit: 100 });
      costService.recordUsage('org-1', 5);

      const status = costService.checkBudget('org-1');

      expect(status.allowed).toBe(true);
      expect(status.daily.remaining).toBe(5);
    });

    it('should block when daily limit exceeded', () => {
      costService.setBudget('org-1', { dailyLimit: 10, monthlyLimit: 100 });
      costService.recordUsage('org-1', 10);

      const status = costService.checkBudget('org-1');

      expect(status.allowed).toBe(false);
      expect(status.daily.remaining).toBe(0);
    });

    it('should block when monthly limit exceeded', () => {
      costService.setBudget('org-1', { dailyLimit: 10, monthlyLimit: 20 });
      costService.recordUsage('org-1', 20);

      const status = costService.checkBudget('org-1');

      expect(status.allowed).toBe(false);
    });
  });

  describe('Request Authorization', () => {
    it('should allow request within budget', () => {
      costService.setBudget('org-1', { dailyLimit: 10, monthlyLimit: 100 });

      const result = costService.canMakeRequest('org-1', 5);
      expect(result.allowed).toBe(true);
    });

    it('should deny request exceeding daily limit', () => {
      costService.setBudget('org-1', { dailyLimit: 5, monthlyLimit: 100 });

      const result = costService.canMakeRequest('org-1', 10);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Alert Thresholds', () => {
    it('should detect alert threshold', () => {
      costService.setBudget('org-1', { monthlyLimit: 100, alertThreshold: 0.8 });
      costService.recordUsage('org-1', 80);

      expect(costService.isAlertThresholdReached('org-1')).toBe(true);
    });

    it('should not alert below threshold', () => {
      costService.setBudget('org-1', { monthlyLimit: 100, alertThreshold: 0.8 });
      costService.recordUsage('org-1', 50);

      expect(costService.isAlertThresholdReached('org-1')).toBe(false);
    });
  });

  describe('Usage Reset', () => {
    it('should reset daily usage', () => {
      costService.recordUsage('org-1', 50);
      costService.resetDailyUsage('org-1');

      const usage = costService.getUsage('org-1');
      expect(usage.daily).toBe(0);
      expect(usage.monthly).toBe(50);
    });
  });
});
