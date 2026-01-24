/**
 * Action Decision Service Unit Tests
 * Tests decision making, rule processing, and confidence scoring
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Action Decision Service implementation
const createActionDecisionService = () => {
  const rules = new Map();
  const decisions = [];
  let counter = 0;

  return {
    registerRule: (id, config) => {
      rules.set(id, {
        id,
        condition: config.condition,
        action: config.action,
        priority: config.priority || 0,
        weight: config.weight || 1.0,
      });
    },

    decide: (context, options = []) => {
      const applicableRules = [];

      for (const [id, rule] of rules) {
        if (evaluateCondition(rule.condition, context)) {
          applicableRules.push(rule);
        }
      }

      // Sort by priority
      applicableRules.sort((a, b) => b.priority - a.priority);

      // Calculate weighted decision
      let totalWeight = 0;
      let weightedScores = {};

      for (const rule of applicableRules) {
        totalWeight += rule.weight;
        const action = rule.action;
        weightedScores[action] = (weightedScores[action] || 0) + rule.weight;
      }

      // Find best action
      let bestAction = options[0] || 'none';
      let bestScore = 0;

      for (const [action, score] of Object.entries(weightedScores)) {
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      }

      const confidence = totalWeight > 0 ? bestScore / totalWeight : 0;

      const decision = {
        id: `dec-${Date.now()}-${++counter}`,
        action: bestAction,
        confidence,
        appliedRules: applicableRules.map((r) => r.id),
        context,
        timestamp: new Date(),
      };

      decisions.push(decision);
      return decision;
    },

    getDecisionHistory: () => [...decisions],

    validateInput: (context, options) => {
      const errors = [];
      if (!context || typeof context !== 'object') {
        errors.push('Context must be an object');
      }
      if (!Array.isArray(options)) {
        errors.push('Options must be an array');
      }
      return { valid: errors.length === 0, errors };
    },

    getRules: () => Array.from(rules.values()),

    clearRules: () => rules.clear(),
  };
};

function evaluateCondition(condition, context) {
  if (condition === 'always') return true;
  if (condition === 'never') return false;
  if (typeof condition === 'function') return condition(context);
  if (typeof condition === 'object') {
    for (const [key, value] of Object.entries(condition)) {
      if (context[key] !== value) return false;
    }
    return true;
  }
  return false;
}

describe('ActionDecisionService', () => {
  let decisionService;

  beforeEach(() => {
    decisionService = createActionDecisionService();
  });

  describe('Decision Making', () => {
    it('should make decision based on rules', () => {
      decisionService.registerRule('rule1', {
        condition: 'always',
        action: 'approve',
        weight: 1.0,
      });

      const decision = decisionService.decide({}, ['approve', 'reject']);

      expect(decision.action).toBe('approve');
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should apply highest priority rule', () => {
      decisionService.registerRule('low', { condition: 'always', action: 'reject', priority: 1 });
      decisionService.registerRule('high', {
        condition: 'always',
        action: 'approve',
        priority: 10,
      });

      const decision = decisionService.decide({});
      expect(decision.appliedRules).toContain('high');
    });

    it('should calculate weighted confidence', () => {
      decisionService.registerRule('r1', { condition: 'always', action: 'approve', weight: 0.8 });
      decisionService.registerRule('r2', { condition: 'always', action: 'approve', weight: 0.2 });

      const decision = decisionService.decide({});
      expect(decision.confidence).toBe(1); // All weight for same action
    });
  });

  describe('Rule Processing', () => {
    it('should evaluate condition objects', () => {
      decisionService.registerRule('conditional', {
        condition: { status: 'active' },
        action: 'process',
      });

      const match = decisionService.decide({ status: 'active' });
      const noMatch = decisionService.decide({ status: 'inactive' });

      expect(match.appliedRules).toContain('conditional');
      expect(noMatch.appliedRules).not.toContain('conditional');
    });

    it('should evaluate function conditions', () => {
      decisionService.registerRule('func', {
        condition: (ctx) => ctx.value > 10,
        action: 'high',
      });

      const high = decisionService.decide({ value: 15 });
      const low = decisionService.decide({ value: 5 });

      expect(high.appliedRules).toContain('func');
      expect(low.appliedRules).not.toContain('func');
    });
  });

  describe('Input Validation', () => {
    it('should validate context', () => {
      const validResult = decisionService.validateInput({}, []);
      expect(validResult.valid).toBe(true);

      const invalidResult = decisionService.validateInput(null, []);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate options array', () => {
      const invalidResult = decisionService.validateInput({}, 'not-array');
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('Decision History', () => {
    it('should track decision history', () => {
      decisionService.registerRule('r1', { condition: 'always', action: 'a' });
      decisionService.decide({});
      decisionService.decide({});

      const history = decisionService.getDecisionHistory();
      expect(history).toHaveLength(2);
    });
  });
});
