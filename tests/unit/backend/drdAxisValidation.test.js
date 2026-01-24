/**
 * DRD Axis Validation Unit Tests
 * Tests Digital Readiness Diagnostic axis scoring and validation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// DRD Axis Validation implementation
const createDRDAxisValidation = () => {
  const axes = [
    { id: 'strategy', name: 'Strategy & Vision', maxScore: 100 },
    { id: 'culture', name: 'Culture & People', maxScore: 100 },
    { id: 'technology', name: 'Technology', maxScore: 100 },
    { id: 'data', name: 'Data & Analytics', maxScore: 100 },
    { id: 'operations', name: 'Operations', maxScore: 100 },
    { id: 'customer', name: 'Customer Experience', maxScore: 100 },
  ];

  return {
    getAxes: () => [...axes],

    validateScore: (axisId, score) => {
      const axis = axes.find((a) => a.id === axisId);
      if (!axis) return { valid: false, error: 'Invalid axis' };
      if (typeof score !== 'number') return { valid: false, error: 'Score must be a number' };
      if (score < 0) return { valid: false, error: 'Score cannot be negative' };
      if (score > axis.maxScore)
        return { valid: false, error: `Score cannot exceed ${axis.maxScore}` };

      return { valid: true };
    },

    validateAssessment: (scores) => {
      const errors = [];
      const validated = {};

      for (const axis of axes) {
        const score = scores[axis.id];
        if (score === undefined) {
          errors.push({ axis: axis.id, error: 'Missing score' });
        } else {
          const validation = this.validateScore?.(axis.id, score) || {
            valid: score >= 0 && score <= axis.maxScore,
          };
          if (!validation.valid) {
            errors.push({ axis: axis.id, error: validation.error });
          } else {
            validated[axis.id] = score;
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        validated,
      };
    },

    calculateOverallScore: (scores) => {
      const validScores = Object.entries(scores)
        .filter(([axisId]) => axes.some((a) => a.id === axisId))
        .map(([, score]) => score);

      if (validScores.length === 0) return 0;
      return Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
    },

    getMaturityLevel: (score) => {
      if (score >= 80) return { level: 5, name: 'Optimizing' };
      if (score >= 60) return { level: 4, name: 'Managed' };
      if (score >= 40) return { level: 3, name: 'Defined' };
      if (score >= 20) return { level: 2, name: 'Repeatable' };
      return { level: 1, name: 'Initial' };
    },

    getWeakestAxis: (scores) => {
      let weakest = null;
      let lowestScore = Infinity;

      for (const axis of axes) {
        const score = scores[axis.id];
        if (score !== undefined && score < lowestScore) {
          lowestScore = score;
          weakest = { axis, score };
        }
      }

      return weakest;
    },

    getStrongestAxis: (scores) => {
      let strongest = null;
      let highestScore = -1;

      for (const axis of axes) {
        const score = scores[axis.id];
        if (score !== undefined && score > highestScore) {
          highestScore = score;
          strongest = { axis, score };
        }
      }

      return strongest;
    },

    normalizeScores: (scores) => {
      const normalized = {};
      for (const axis of axes) {
        const score = scores[axis.id];
        normalized[axis.id] = score !== undefined ? Math.round((score / axis.maxScore) * 100) : 0;
      }
      return normalized;
    },
  };
};

describe('DRDAxisValidation', () => {
  let validator;

  beforeEach(() => {
    validator = createDRDAxisValidation();
  });

  describe('Axis Configuration', () => {
    it('should return all axes', () => {
      const axes = validator.getAxes();
      expect(axes.length).toBe(6);
      expect(axes.map((a) => a.id)).toContain('strategy');
    });
  });

  describe('Score Validation', () => {
    it('should validate valid score', () => {
      const result = validator.validateScore('strategy', 85);
      expect(result.valid).toBe(true);
    });

    it('should reject negative score', () => {
      const result = validator.validateScore('strategy', -10);
      expect(result.valid).toBe(false);
    });

    it('should reject score above max', () => {
      const result = validator.validateScore('strategy', 150);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid axis', () => {
      const result = validator.validateScore('invalid', 50);
      expect(result.valid).toBe(false);
    });
  });

  describe('Assessment Validation', () => {
    it('should validate complete assessment', () => {
      const scores = {
        strategy: 80,
        culture: 70,
        technology: 85,
        data: 60,
        operations: 75,
        customer: 90,
      };

      const result = validator.validateAssessment(scores);
      expect(result.valid).toBe(true);
    });

    it('should detect missing scores', () => {
      const scores = { strategy: 80 };
      const result = validator.validateAssessment(scores);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Overall Score', () => {
    it('should calculate overall score', () => {
      const scores = { strategy: 80, culture: 60, technology: 70 };
      const overall = validator.calculateOverallScore(scores);

      expect(overall).toBe(70);
    });
  });

  describe('Maturity Level', () => {
    it('should determine maturity level', () => {
      expect(validator.getMaturityLevel(85).name).toBe('Optimizing');
      expect(validator.getMaturityLevel(65).name).toBe('Managed');
      expect(validator.getMaturityLevel(45).name).toBe('Defined');
    });
  });

  describe('Axis Analysis', () => {
    it('should find weakest axis', () => {
      const scores = { strategy: 80, culture: 40, technology: 70 };
      const weakest = validator.getWeakestAxis(scores);

      expect(weakest.axis.id).toBe('culture');
      expect(weakest.score).toBe(40);
    });

    it('should find strongest axis', () => {
      const scores = { strategy: 80, culture: 40, technology: 95 };
      const strongest = validator.getStrongestAxis(scores);

      expect(strongest.axis.id).toBe('technology');
    });
  });
});
