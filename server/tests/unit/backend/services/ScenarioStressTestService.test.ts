import { describe, expect, it } from 'vitest';

import {
  COMMON_SCENARIO_VARIABLES,
  quickSensitivityCheck,
  runStressTest,
} from '../../../../src/services/ai/scenarioStressTestService.js';

describe('ScenarioStressTestService', () => {
  describe('COMMON_SCENARIO_VARIABLES', () => {
    it('has standard variables defined', () => {
      const names = COMMON_SCENARIO_VARIABLES.map((v) => v.name);
      expect(names).toContain('demand');
      expect(names).toContain('cost');
      expect(names).toContain('timeline');
    });

    it('each variable has variations', () => {
      for (const variable of COMMON_SCENARIO_VARIABLES) {
        expect(variable.variations.length).toBeGreaterThan(0);
        expect(variable.variations.some((v) => v.multiplier === 1.0)).toBe(true); // has base case
      }
    });
  });

  describe('runStressTest', () => {
    const testOptions = [
      {
        id: 'option-a',
        name: 'Option A',
        baseOutcome: 100,
        sensitivity: { demand: 0.5, cost: -0.3, timeline: -0.2 },
      },
      {
        id: 'option-b',
        name: 'Option B',
        baseOutcome: 90,
        sensitivity: { demand: 0.3, cost: -0.1, timeline: -0.1 },
      },
    ];

    it('returns robustness ranking for all options', () => {
      const result = runStressTest({ options: testOptions });

      expect(result.robustnessRanking.length).toBe(2);
      expect(result.robustnessRanking[0].optionId).toBeDefined();
      expect(result.robustnessRanking[0].winCount).toBeGreaterThanOrEqual(0);
    });

    it('generates multiple scenarios', () => {
      const result = runStressTest({ options: testOptions });

      expect(result.scenarios.length).toBeGreaterThan(1);
      expect(result.scenarios[0].scenarioLabel).toBeDefined();
    });

    it('calculates sensitivity analysis', () => {
      const result = runStressTest({ options: testOptions });

      expect(result.sensitivityAnalysis.length).toBeGreaterThan(0);
      expect(result.sensitivityAnalysis[0].variableName).toBeDefined();
      expect(result.sensitivityAnalysis[0].impactScore).toBeGreaterThanOrEqual(0);
    });

    it('provides recommendation', () => {
      const result = runStressTest({ options: testOptions });

      expect(result.recommendation.bestRobustChoice).toBeDefined();
      expect(result.recommendation.rationale).toBeTruthy();
    });
  });

  describe('quickSensitivityCheck', () => {
    it('returns outcome at different multiplier levels', () => {
      const option = {
        id: 'test',
        name: 'Test Option',
        baseOutcome: 100,
        sensitivity: { demand: 0.5 },
      };

      const results = quickSensitivityCheck({
        option,
        variableName: 'demand',
        range: [0.5, 1.5],
        steps: 5,
      });

      expect(results.length).toBe(5);
      expect(results[0].multiplier).toBeCloseTo(0.5);
      expect(results[4].multiplier).toBeCloseTo(1.5);
    });

    it('calculates correct percentage change', () => {
      const option = {
        id: 'test',
        name: 'Test',
        baseOutcome: 100,
        sensitivity: { demand: 1.0 }, // 1:1 elasticity
      };

      const results = quickSensitivityCheck({
        option,
        variableName: 'demand',
        range: [0.5, 1.5],
        steps: 3,
      });

      // At 0.5x demand with 1:1 elasticity, outcome should be 50% lower
      expect(results[0].percentChange).toBeCloseTo(-50, 1);
      // At 1.5x demand, outcome should be 50% higher
      expect(results[2].percentChange).toBeCloseTo(50, 1);
    });
  });
});
