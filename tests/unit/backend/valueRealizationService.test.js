/**
 * Value Realization Service Unit Tests
 *
 * Tests for tracking value realization from initiatives.
 *
 * @module tests/unit/backend/valueRealizationService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create value realization service implementation
const createValueRealizationService = () => {
  const valueRecords = new Map();
  const plans = new Map();

  // Helper function for total realized value
  const getTotalRealizedInternal = (planId) => {
    const records = valueRecords.get(planId) || [];
    return records.reduce((sum, r) => sum + r.value, 0);
  };

  return {
    // Create value realization plan
    createPlan: async (data) => {
      if (!data.initiativeId) throw new Error('Initiative ID required');

      const id = `vr-plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const plan = {
        id,
        initiativeId: data.initiativeId,
        expectedValue: data.expectedValue || 0,
        currency: data.currency || 'USD',
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate,
        milestones: data.milestones || [],
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      plans.set(id, plan);
      valueRecords.set(id, []);
      return plan;
    },

    // Get plan by ID
    getPlan: async (id) => {
      return plans.get(id) || null;
    },

    // Record realized value
    recordValue: async (planId, data) => {
      const plan = plans.get(planId);
      if (!plan) throw new Error('Plan not found');

      const record = {
        id: `vr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        planId,
        value: data.value,
        category: data.category || 'general',
        description: data.description,
        evidenceUrl: data.evidenceUrl,
        recordedBy: data.recordedBy,
        recordedAt: new Date().toISOString(),
      };

      const history = valueRecords.get(planId) || [];
      history.push(record);
      valueRecords.set(planId, history);

      return record;
    },

    // Get all value records for a plan
    getValueRecords: async (planId) => {
      return valueRecords.get(planId) || [];
    },

    // Calculate total realized value
    getTotalRealized: async (planId) => {
      return getTotalRealizedInternal(planId);
    },

    // Calculate realization rate
    getRealizationRate: async (planId) => {
      const plan = plans.get(planId);
      if (!plan) throw new Error('Plan not found');

      const totalRealized = getTotalRealizedInternal(planId);
      const rate = plan.expectedValue > 0 ? (totalRealized / plan.expectedValue) * 100 : 0;

      return {
        planId,
        expectedValue: plan.expectedValue,
        realizedValue: totalRealized,
        rate: Math.round(rate * 100) / 100,
        gap: plan.expectedValue - totalRealized,
        onTrack: rate >= 75,
      };
    },

    // Get value by category
    getValueByCategory: async (planId) => {
      const records = valueRecords.get(planId) || [];
      const categories = new Map();

      for (const record of records) {
        const current = categories.get(record.category) || 0;
        categories.set(record.category, current + record.value);
      }

      return Array.from(categories.entries()).map(([category, value]) => ({
        category,
        value,
      }));
    },

    // Update plan
    updatePlan: async (planId, updates) => {
      const plan = plans.get(planId);
      if (!plan) throw new Error('Plan not found');

      const updated = { ...plan, ...updates };
      plans.set(planId, updated);
      return updated;
    },

    // Complete plan
    completePlan: async (planId) => {
      const plan = plans.get(planId);
      if (!plan) throw new Error('Plan not found');

      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      plans.set(planId, plan);
      return plan;
    },

    // Get summary across all plans
    getSummary: async () => {
      let totalExpected = 0;
      let totalRealized = 0;
      let activePlans = 0;
      let completedPlans = 0;

      for (const plan of plans.values()) {
        totalExpected += plan.expectedValue;
        if (plan.status === 'active') activePlans++;
        if (plan.status === 'completed') completedPlans++;

        const records = valueRecords.get(plan.id) || [];
        totalRealized += records.reduce((sum, r) => sum + r.value, 0);
      }

      return {
        totalExpected,
        totalRealized,
        overallRate: totalExpected > 0 ? (totalRealized / totalExpected) * 100 : 0,
        activePlans,
        completedPlans,
      };
    },

    // Clear for testing
    clear: () => {
      valueRecords.clear();
      plans.clear();
    },
  };
};

describe('ValueRealizationService', () => {
  let valueService;

  beforeEach(() => {
    valueService = createValueRealizationService();
  });

  describe('Plan Creation', () => {
    it('should create a value realization plan', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 500000,
        currency: 'USD',
      });

      expect(plan.id).toBeDefined();
      expect(plan.expectedValue).toBe(500000);
      expect(plan.status).toBe('active');
    });

    it('should require initiative ID', async () => {
      await expect(valueService.createPlan({})).rejects.toThrow('Initiative ID required');
    });
  });

  describe('Value Recording', () => {
    it('should record realized value', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 100000,
      });

      await valueService.recordValue(plan.id, {
        value: 25000,
        category: 'cost_savings',
        description: 'Q1 operational savings',
      });

      await valueService.recordValue(plan.id, {
        value: 15000,
        category: 'revenue',
        description: 'New client revenue',
      });

      const records = await valueService.getValueRecords(plan.id);
      expect(records).toHaveLength(2);

      const total = await valueService.getTotalRealized(plan.id);
      expect(total).toBe(40000);
    });
  });

  describe('Realization Rate', () => {
    it('should calculate realization rate', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 100000,
      });

      await valueService.recordValue(plan.id, { value: 80000 });

      const rate = await valueService.getRealizationRate(plan.id);

      expect(rate.realizedValue).toBe(80000);
      expect(rate.rate).toBe(80);
      expect(rate.gap).toBe(20000);
      expect(rate.onTrack).toBe(true);
    });

    it('should indicate off-track when below 75%', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 100000,
      });

      await valueService.recordValue(plan.id, { value: 50000 });

      const rate = await valueService.getRealizationRate(plan.id);

      expect(rate.onTrack).toBe(false);
    });
  });

  describe('Category Breakdown', () => {
    it('should breakdown value by category', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 200000,
      });

      await valueService.recordValue(plan.id, { value: 50000, category: 'cost_savings' });
      await valueService.recordValue(plan.id, { value: 30000, category: 'cost_savings' });
      await valueService.recordValue(plan.id, { value: 40000, category: 'revenue' });

      const breakdown = await valueService.getValueByCategory(plan.id);

      const costSavings = breakdown.find((b) => b.category === 'cost_savings');
      const revenue = breakdown.find((b) => b.category === 'revenue');

      expect(costSavings.value).toBe(80000);
      expect(revenue.value).toBe(40000);
    });
  });

  describe('Plan Completion', () => {
    it('should complete a plan', async () => {
      const plan = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 100000,
      });

      const completed = await valueService.completePlan(plan.id);

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe('Summary', () => {
    it('should calculate summary across all plans', async () => {
      const plan1 = await valueService.createPlan({
        initiativeId: 'init-1',
        expectedValue: 100000,
      });
      const plan2 = await valueService.createPlan({
        initiativeId: 'init-2',
        expectedValue: 200000,
      });

      await valueService.recordValue(plan1.id, { value: 50000 });
      await valueService.recordValue(plan2.id, { value: 100000 });

      await valueService.completePlan(plan1.id);

      const summary = await valueService.getSummary();

      expect(summary.totalExpected).toBe(300000);
      expect(summary.totalRealized).toBe(150000);
      expect(summary.activePlans).toBe(1);
      expect(summary.completedPlans).toBe(1);
    });
  });
});
