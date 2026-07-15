/**
 * Scenario Stress Test Service — unit tests.
 *
 * Wiring pass (2026-07-15): this engine was orphaned (0 callers). These
 * tests lock in the pure-computation contract before exposing it via
 * POST /api/ai/trust/scenario-stress-test/* (server/src/routes/ai/ai-trust.routes.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  COMMON_SCENARIO_VARIABLES,
  type DecisionOption,
  quickSensitivityCheck,
  runStressTest,
} from '../../../server/src/services/ai/scenarioStressTestService.js';

const OPTIONS: DecisionOption[] = [
  {
    id: 'opt-conservative',
    name: 'Conservative expansion',
    baseOutcome: 1000,
    sensitivity: { demand: 0.3, cost: -0.2, timeline: -0.1, competition: -0.1 },
  },
  {
    id: 'opt-aggressive',
    name: 'Aggressive expansion',
    baseOutcome: 1200,
    sensitivity: { demand: 0.9, cost: -0.5, timeline: -0.3, competition: -0.4 },
  },
];

describe('runStressTest', () => {
  it('runs every option through every generated scenario', () => {
    const summary = runStressTest({ options: OPTIONS });

    expect(summary.options).toBe(OPTIONS);
    expect(summary.scenarios.length).toBeGreaterThan(0);
    for (const scenario of summary.scenarios) {
      expect(scenario.optionResults).toHaveLength(OPTIONS.length);
      // bestOption must be one of the evaluated options
      expect(OPTIONS.map((o) => o.id)).toContain(scenario.bestOption);
    }
  });

  it('produces a robustness ranking covering all options, sorted descending', () => {
    const summary = runStressTest({ options: OPTIONS });

    expect(summary.robustnessRanking).toHaveLength(OPTIONS.length);
    const scores = summary.robustnessRanking.map((r) => r.robustnessScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it('ranks sensitivity analysis by descending impact score', () => {
    const summary = runStressTest({ options: OPTIONS });

    expect(summary.sensitivityAnalysis.length).toBe(COMMON_SCENARIO_VARIABLES.length);
    const impacts = summary.sensitivityAnalysis.map((s) => s.impactScore);
    const sorted = [...impacts].sort((a, b) => b - a);
    expect(impacts).toEqual(sorted);
    // the aggressive option has the highest |elasticity| on every variable,
    // so it must be flagged as the most-affected option everywhere.
    for (const s of summary.sensitivityAnalysis) {
      expect(s.mostAffectedOption).toBe('opt-aggressive');
    }
  });

  it('returns a recommendation whose bestRobustChoice is present in the ranking', () => {
    const summary = runStressTest({ options: OPTIONS });
    const ids = summary.robustnessRanking.map((r) => r.optionId);
    expect(ids).toContain(summary.recommendation.bestRobustChoice);
  });

  it('caps combinatorial scenario generation at 50 when generateCombinations=true', () => {
    const summary = runStressTest({ options: OPTIONS, generateCombinations: true });
    expect(summary.scenarios.length).toBeLessThanOrEqual(50);
    expect(summary.scenarios.length).toBeGreaterThan(5);
  });

  it('accepts a custom, smaller variable set', () => {
    const summary = runStressTest({
      options: OPTIONS,
      variables: [
        {
          name: 'demand',
          baseValue: 100,
          variations: [
            { label: 'pessimistic', multiplier: 0.5 },
            { label: 'base', multiplier: 1.0 },
            { label: 'optimistic', multiplier: 1.5 },
          ],
        },
      ],
    });
    expect(summary.sensitivityAnalysis).toHaveLength(1);
    expect(summary.sensitivityAnalysis[0].variableName).toBe('demand');
  });
});

describe('quickSensitivityCheck', () => {
  it('sweeps the range and computes elasticity-adjusted outcomes', () => {
    const option = OPTIONS[0];
    const results = quickSensitivityCheck({
      option,
      variableName: 'demand',
      range: [0.5, 1.5],
      steps: 5,
    });

    expect(results).toHaveLength(5);
    expect(results[0].multiplier).toBeCloseTo(0.5);
    expect(results[4].multiplier).toBeCloseTo(1.5);

    // at multiplier=1 (base), outcome should equal baseOutcome (percentChange ~0)
    const baseStep = results[2];
    expect(baseStep.multiplier).toBeCloseTo(1.0);
    expect(baseStep.outcome).toBeCloseTo(option.baseOutcome);
    expect(baseStep.percentChange).toBeCloseTo(0);
  });

  it('returns 0 elasticity impact for an unknown variable name', () => {
    const option = OPTIONS[0];
    const results = quickSensitivityCheck({
      option,
      variableName: 'unknown_variable',
      range: [0.5, 1.5],
      steps: 3,
    });
    for (const r of results) {
      expect(r.outcome).toBeCloseTo(option.baseOutcome);
      expect(r.percentChange).toBeCloseTo(0);
    }
  });
});
