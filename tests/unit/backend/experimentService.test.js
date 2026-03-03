/**
 * Experiment Service Unit Tests
 * Tests A/B testing, variant assignment, and experiment tracking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Experiment Service implementation
const createExperimentService = () => {
  const experiments = new Map();
  const assignments = new Map(); // userId -> { experimentId -> variant }
  let counter = 0;

  return {
    create: (name, config = {}) => {
      const id = `exp-${Date.now()}-${++counter}`;
      const experiment = {
        id,
        name,
        variants: config.variants || [
          { id: 'control', weight: 50 },
          { id: 'treatment', weight: 50 },
        ],
        status: 'draft',
        targetPercentage: config.targetPercentage || 100,
        createdAt: new Date(),
      };
      experiments.set(id, experiment);
      return experiment;
    },

    get: (id) => experiments.get(id) || null,

    list: () => Array.from(experiments.values()),

    start: (id) => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');
      exp.status = 'running';
      exp.startedAt = new Date();
      return exp;
    },

    stop: (id) => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');
      exp.status = 'stopped';
      exp.stoppedAt = new Date();
      return exp;
    },

    assignVariant: (experimentId, userId) => {
      const exp = experiments.get(experimentId);
      if (!exp || exp.status !== 'running') return null;

      // Check if already assigned
      const userAssignments = assignments.get(userId) || {};
      if (userAssignments[experimentId]) {
        return userAssignments[experimentId];
      }

      // Check target percentage
      const hash = hashString(userId + experimentId);
      if (hash % 100 >= exp.targetPercentage) {
        return null; // Not in experiment
      }

      // Assign variant based on weights
      const totalWeight = exp.variants.reduce((sum, v) => sum + v.weight, 0);
      const random = hash % totalWeight;
      let cumulative = 0;
      let assignedVariant = exp.variants[0].id;

      for (const variant of exp.variants) {
        cumulative += variant.weight;
        if (random < cumulative) {
          assignedVariant = variant.id;
          break;
        }
      }

      userAssignments[experimentId] = assignedVariant;
      assignments.set(userId, userAssignments);

      return assignedVariant;
    },

    getAssignment: (experimentId, userId) => {
      const userAssignments = assignments.get(userId) || {};
      return userAssignments[experimentId] || null;
    },

    getStats: (experimentId) => {
      const exp = experiments.get(experimentId);
      if (!exp) return null;

      const variantCounts = {};
      for (const variant of exp.variants) {
        variantCounts[variant.id] = 0;
      }

      for (const userAssigns of assignments.values()) {
        const variant = userAssigns[experimentId];
        if (variant && variantCounts[variant] !== undefined) {
          variantCounts[variant]++;
        }
      }

      return {
        experimentId,
        status: exp.status,
        variantCounts,
        totalAssigned: Object.values(variantCounts).reduce((a, b) => a + b, 0),
      };
    },
  };
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

describe('ExperimentService', () => {
  let experimentService;

  beforeEach(() => {
    experimentService = createExperimentService();
  });

  describe('Experiment Creation', () => {
    it('should create experiment', () => {
      const exp = experimentService.create('Homepage Redesign');

      expect(exp.id).toBeDefined();
      expect(exp.name).toBe('Homepage Redesign');
      expect(exp.status).toBe('draft');
    });

    it('should create with custom variants', () => {
      const exp = experimentService.create('Button Color', {
        variants: [
          { id: 'blue', weight: 33 },
          { id: 'green', weight: 33 },
          { id: 'red', weight: 34 },
        ],
      });

      expect(exp.variants).toHaveLength(3);
    });
  });

  describe('Experiment Lifecycle', () => {
    it('should start experiment', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);

      expect(experimentService.get(exp.id).status).toBe('running');
    });

    it('should stop experiment', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);
      experimentService.stop(exp.id);

      expect(experimentService.get(exp.id).status).toBe('stopped');
    });
  });

  describe('Variant Assignment', () => {
    it('should assign variant to user', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);

      const variant = experimentService.assignVariant(exp.id, 'user-1');

      expect(['control', 'treatment']).toContain(variant);
    });

    it('should consistently assign same variant', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);

      const first = experimentService.assignVariant(exp.id, 'user-1');
      const second = experimentService.assignVariant(exp.id, 'user-1');

      expect(first).toBe(second);
    });

    it('should not assign to stopped experiment', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);
      experimentService.stop(exp.id);

      const variant = experimentService.assignVariant(exp.id, 'user-1');
      expect(variant).toBeNull();
    });
  });

  describe('Experiment Stats', () => {
    it('should track variant distribution', () => {
      const exp = experimentService.create('Test');
      experimentService.start(exp.id);

      for (let i = 0; i < 100; i++) {
        experimentService.assignVariant(exp.id, `user-${i}`);
      }

      const stats = experimentService.getStats(exp.id);
      expect(stats.totalAssigned).toBeGreaterThan(0);
    });
  });
});
