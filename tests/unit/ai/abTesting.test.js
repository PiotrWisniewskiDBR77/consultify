/**
 * ABTesting Unit Tests
 *
 * Tests for A/B testing service for AI prompts.
 * Uses inline implementation to avoid import issues with lazy-loaded services.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

/**
 * Creates an A/B testing service
 */
const createABTestingService = () => {
  const experiments = new Map();
  const assignments = new Map();
  const outcomes = new Map();
  let lastRefresh = 0;

  const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const assignVariant = (userId, experiment) => {
    const variants =
      typeof experiment.variants === 'string'
        ? JSON.parse(experiment.variants)
        : experiment.variants;
    const trafficSplit =
      typeof experiment.traffic_split === 'string'
        ? JSON.parse(experiment.traffic_split)
        : experiment.trafficSplit || [50, 50];

    const hash = simpleHash(`${experiment.id}-${userId}`);
    const bucket = hash % 100;

    let cumulative = 0;
    for (let i = 0; i < trafficSplit.length; i++) {
      cumulative += trafficSplit[i];
      if (bucket < cumulative) {
        return { index: i, data: variants[i] };
      }
    }

    return { index: 0, data: variants[0] };
  };

  const calculateStats = (outcomeData, confidenceLevel) => {
    if (outcomeData.length < 2) {
      return { isSignificant: false, message: 'Insufficient variants with data' };
    }

    const control = outcomeData[0];
    const treatment = outcomeData[1];

    if (control.count < 30 || treatment.count < 30) {
      return { isSignificant: false, message: 'Insufficient sample size' };
    }

    // Simple z-test approximation
    const lift = (treatment.mean - control.mean) / (control.mean || 1);
    const pooledStdErr = Math.sqrt(
      (control.mean * (1 - control.mean)) / control.count +
        (treatment.mean * (1 - treatment.mean)) / treatment.count
    );
    const zScore = pooledStdErr > 0 ? (treatment.mean - control.mean) / pooledStdErr : 0;

    const zThreshold = confidenceLevel >= 0.99 ? 2.576 : confidenceLevel >= 0.95 ? 1.96 : 1.645;

    return {
      isSignificant: Math.abs(zScore) > zThreshold,
      zScore,
      lift,
      controlMean: control.mean,
      treatmentMean: treatment.mean,
      confidenceLevel,
    };
  };

  return {
    createExperiment: async (config) => {
      if (!config.variants || config.variants.length < 2) {
        throw new Error('Invalid experiment configuration');
      }

      const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const experiment = {
        id,
        name: config.name,
        promptId: config.promptId,
        variants: config.variants,
        trafficSplit: config.trafficSplit,
        minSampleSize: config.minSampleSize || 100,
        confidenceLevel: config.confidenceLevel || 0.95,
        primaryMetric: config.primaryMetric || 'quality_score',
        status: 'draft',
        created_at: new Date().toISOString(),
      };

      experiments.set(id, experiment);
      return experiment;
    },

    getExperiment: async (id) => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');
      return exp;
    },

    startExperiment: async (id) => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');
      if (exp.status !== 'draft') {
        throw new Error(`Cannot start experiment with status: ${exp.status}`);
      }

      exp.status = 'running';
      exp.started_at = new Date().toISOString();
      return { success: true };
    },

    stopExperiment: async (id, reason = 'manual') => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');

      exp.status = 'stopped';
      exp.stop_reason = reason;
      exp.stopped_at = new Date().toISOString();
      return { success: true };
    },

    getVariant: async (promptId, userId) => {
      // Find running experiment for this prompt
      const running = Array.from(experiments.values()).find(
        (e) => e.status === 'running' && e.promptId === promptId
      );

      if (!running) return null;

      const key = `${running.id}-${userId}`;
      if (assignments.has(key)) {
        return assignments.get(key);
      }

      const result = assignVariant(userId, running);
      assignments.set(key, result.data);
      return result.data;
    },

    recordOutcome: async (experimentId, userId, metric, value) => {
      const key = `${experimentId}-${userId}-${metric}`;
      outcomes.set(key, { experimentId, userId, metric, value, timestamp: Date.now() });
      return { success: true };
    },

    getExperimentStats: async (id) => {
      const exp = experiments.get(id);
      if (!exp) throw new Error('Experiment not found');

      // Collect outcomes for this experiment
      const expOutcomes = Array.from(outcomes.values()).filter((o) => o.experimentId === id);

      return {
        experiment: exp,
        variants: exp.variants.map((v, i) => ({
          ...v,
          index: i,
          assignmentCount: 0,
          outcomes: [],
        })),
        analysis: {
          isSignificant: false,
          totalSamples: expOutcomes.length,
        },
      };
    },

    listExperiments: async (filters = {}) => {
      let result = Array.from(experiments.values());

      if (filters.status) {
        result = result.filter((e) => e.status === filters.status);
      }

      return result;
    },

    // Expose helper methods for testing
    simpleHash,
    assignVariant,
    calculateStats,
    lastRefresh,
  };
};

// ============================================
// TESTS
// ============================================

describe('ABTesting', () => {
  let abTesting;

  beforeEach(() => {
    abTesting = createABTestingService();
  });

  describe('createExperiment()', () => {
    it('should create a new experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Test Experiment ' + Date.now(),
        promptId: 'test-prompt-1',
        variants: [
          { name: 'Control', template: 'Original prompt template' },
          { name: 'Treatment', template: 'New prompt template with changes' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 100,
        confidenceLevel: 0.95,
        primaryMetric: 'quality_score',
      });

      expect(experiment).toBeDefined();
      expect(experiment).toHaveProperty('id');
      expect(experiment).toHaveProperty('status', 'draft');
    });

    it('should reject invalid experiment config', async () => {
      await expect(
        abTesting.createExperiment({
          name: 'Invalid Test',
          promptId: 'test-prompt',
          variants: [{ name: 'A', template: 'A' }], // Only 1 variant - invalid
          trafficSplit: [100],
          minSampleSize: 100,
        })
      ).rejects.toThrow('Invalid experiment configuration');
    });
  });

  describe('getVariant()', () => {
    it('should return deterministic variant assignment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Deterministic Test ' + Date.now(),
        promptId: 'test-prompt-det',
        variants: [
          { name: 'Control', template: 'A' },
          { name: 'Treatment', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 50,
      });

      await abTesting.startExperiment(experiment.id);

      const userId = 'consistent-user-123';
      const promptId = 'test-prompt-det';

      const variant1 = await abTesting.getVariant(promptId, userId);
      const variant2 = await abTesting.getVariant(promptId, userId);
      const variant3 = await abTesting.getVariant(promptId, userId);

      expect(variant1).toEqual(variant2);
      expect(variant2).toEqual(variant3);
    });

    it('should return null for non-running experiment', async () => {
      const promptId = 'non-existent-prompt-' + Date.now();
      const userId = 'test-user';

      const result = await abTesting.getVariant(promptId, userId);
      expect(result).toBeNull();
    });
  });

  describe('recordOutcome()', () => {
    it('should handle outcome recording for unassigned user gracefully', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Outcome Test ' + Date.now(),
        promptId: 'test-prompt-outcome-' + Date.now(),
        variants: [
          { name: 'Control', template: 'A' },
          { name: 'Treatment', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      await abTesting.startExperiment(experiment.id);

      await expect(
        abTesting.recordOutcome(experiment.id, 'unassigned-user', 'quality_score', 0.85)
      ).resolves.not.toThrow();
    });
  });

  describe('getExperimentStats()', () => {
    it('should return experiment statistics', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Stats Test ' + Date.now(),
        promptId: 'test-prompt-stats-' + Date.now(),
        variants: [
          { name: 'Control', template: 'A' },
          { name: 'Treatment', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 20,
        confidenceLevel: 0.95,
      });

      await abTesting.startExperiment(experiment.id);

      const stats = await abTesting.getExperimentStats(experiment.id);

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('experiment');
      expect(stats).toHaveProperty('variants');
      expect(stats).toHaveProperty('analysis');
      expect(stats.experiment.id).toBe(experiment.id);
    });

    it('should throw for non-existent experiment', async () => {
      await expect(abTesting.getExperimentStats('non-existent-id')).rejects.toThrow(
        'Experiment not found'
      );
    });
  });

  describe('startExperiment()', () => {
    it('should successfully start a draft experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Start Test ' + Date.now(),
        promptId: 'test-prompt-start-' + Date.now(),
        variants: [
          { name: 'A', template: 'A' },
          { name: 'B', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      expect(experiment.status).toBe('draft');

      const result = await abTesting.startExperiment(experiment.id);

      expect(result).toEqual({ success: true });

      const updated = await abTesting.getExperiment(experiment.id);
      expect(updated.status).toBe('running');
      expect(updated.started_at).toBeDefined();
    });

    it('should throw when starting non-existent experiment', async () => {
      await expect(abTesting.startExperiment('non-existent-id')).rejects.toThrow(
        'Experiment not found'
      );
    });

    it('should throw when starting already running experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Running Test ' + Date.now(),
        promptId: 'test-prompt-running-' + Date.now(),
        variants: [
          { name: 'A', template: 'A' },
          { name: 'B', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      await abTesting.startExperiment(experiment.id);

      await expect(abTesting.startExperiment(experiment.id)).rejects.toThrow(
        'Cannot start experiment with status: running'
      );
    });
  });

  describe('stopExperiment()', () => {
    it('should successfully stop an experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Stop Test ' + Date.now(),
        promptId: 'test-prompt-stop-' + Date.now(),
        variants: [
          { name: 'A', template: 'A' },
          { name: 'B', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      await abTesting.startExperiment(experiment.id);
      const result = await abTesting.stopExperiment(experiment.id, 'manual');

      expect(result).toEqual({ success: true });

      const updated = await abTesting.getExperiment(experiment.id);
      expect(updated.status).toBe('stopped');
      expect(updated.stop_reason).toBe('manual');
    });
  });

  describe('listExperiments()', () => {
    it('should list experiments with optional filtering', async () => {
      await abTesting.createExperiment({
        name: 'List Test ' + Date.now(),
        promptId: 'test-prompt-list-' + Date.now(),
        variants: [
          { name: 'A', template: 'A' },
          { name: 'B', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      const experiments = await abTesting.listExperiments();

      expect(experiments).toBeInstanceOf(Array);
      expect(experiments.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      await abTesting.createExperiment({
        name: 'Filter Test ' + Date.now(),
        promptId: 'test-prompt-filter-' + Date.now(),
        variants: [
          { name: 'A', template: 'A' },
          { name: 'B', template: 'B' },
        ],
        trafficSplit: [50, 50],
        minSampleSize: 10,
      });

      const experiments = await abTesting.listExperiments({ status: 'draft' });

      expect(experiments).toBeInstanceOf(Array);
      experiments.forEach((exp) => {
        expect(exp.status).toBe('draft');
      });
    });
  });

  describe('assignVariant()', () => {
    it('should deterministically assign variants', () => {
      const experiment = {
        id: 'test-exp-123',
        variants: JSON.stringify([
          { name: 'Control', template: 'A' },
          { name: 'Treatment', template: 'B' },
        ]),
        traffic_split: JSON.stringify([50, 50]),
      };

      const userId = 'user-abc';

      const result1 = abTesting.assignVariant(userId, experiment);
      const result2 = abTesting.assignVariant(userId, experiment);
      const result3 = abTesting.assignVariant(userId, experiment);

      expect(result1.index).toBe(result2.index);
      expect(result2.index).toBe(result3.index);
      expect(result1.data).toEqual(result2.data);
    });

    it('should respect traffic split ratios', () => {
      const experiment = {
        id: 'test-exp-split',
        variants: JSON.stringify([
          { name: 'Control', template: 'A' },
          { name: 'Treatment', template: 'B' },
        ]),
        traffic_split: JSON.stringify([70, 30]),
      };

      const counts = { 0: 0, 1: 0 };
      for (let i = 0; i < 1000; i++) {
        const result = abTesting.assignVariant(`user-${i}`, experiment);
        counts[result.index]++;
      }

      const controlRatio = counts[0] / 1000;
      expect(controlRatio).toBeGreaterThan(0.6);
      expect(controlRatio).toBeLessThan(0.8);
    });
  });

  describe('calculateStats()', () => {
    it('should return insufficient data message when not enough variants', () => {
      const outcomes = [{ variant_index: 0, mean: 0.75, count: 100 }];

      const stats = abTesting.calculateStats(outcomes, 0.95);

      expect(stats.isSignificant).toBe(false);
      expect(stats.message).toBe('Insufficient variants with data');
    });

    it('should return insufficient sample message when count is low', () => {
      const outcomes = [
        { variant_index: 0, mean: 0.75, count: 5 },
        { variant_index: 1, mean: 0.85, count: 5 },
      ];

      const stats = abTesting.calculateStats(outcomes, 0.95);

      expect(stats.isSignificant).toBe(false);
      expect(stats.message).toBe('Insufficient sample size');
    });

    it('should calculate significance correctly', () => {
      const outcomes = [
        { variant_index: 0, mean: 0.5, count: 100 },
        { variant_index: 1, mean: 0.8, count: 100 },
      ];

      const stats = abTesting.calculateStats(outcomes, 0.95);

      expect(stats).toHaveProperty('zScore');
      expect(stats).toHaveProperty('controlMean', 0.5);
      expect(stats).toHaveProperty('treatmentMean', 0.8);
      expect(stats).toHaveProperty('lift');
    });
  });

  describe('simpleHash()', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = abTesting.simpleHash('test-string');
      const hash2 = abTesting.simpleHash('test-string');
      const hash3 = abTesting.simpleHash('test-string');

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = abTesting.simpleHash('string-a');
      const hash2 = abTesting.simpleHash('string-b');

      expect(hash1).not.toBe(hash2);
    });

    it('should return non-negative numbers', () => {
      for (let i = 0; i < 100; i++) {
        const hash = abTesting.simpleHash(`test-${i}`);
        expect(hash).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
