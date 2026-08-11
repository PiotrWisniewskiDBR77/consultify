import { describe, expect, it } from 'vitest';
import {
  diffPlanScenarios,
  validatePlanScenario,
  type PlanScenario,
} from '../../../server/src/domain/initiatives-execution/planScenario';
const scenario = (version: number, target = '2026-10-15T00:00:00Z'): PlanScenario => ({
  scenarioId: 'plan-1',
  scenarioVersion: version,
  status: version === 2 ? 'PUBLISHED' : 'SUPERSEDED',
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 3,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [{ periodId: 'q4', start: '2026-09-01T00:00:00Z', end: '2026-11-30T00:00:00Z' }],
  assumptions: ['Supplier window is unconfirmed'],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: null,
  publishedAt: null,
  windows: [
    {
      initiativeId: 'i1',
      initiativeVersion: 7,
      earliest: '2026-10-01T00:00:00Z',
      target,
      latest: '2026-10-31T00:00:00Z',
      confidence: 'LOW',
      rationale: 'Dependency-constrained window',
      dependencySnapshot: [],
      constraintSnapshot: [
        { constraintId: 'supplier', state: 'UNKNOWN', detail: 'Confirmation missing' },
      ],
    },
  ],
});
describe('Plan Scenario', () => {
  it('diffs versioned windows without mutating Initiative truth', () => {
    const diff = diffPlanScenarios(scenario(1), scenario(2, '2026-10-20T00:00:00Z'));
    expect(diff).toHaveLength(1);
    expect(diff[0].after?.confidence).toBe('LOW');
    expect(JSON.stringify(scenario(2))).not.toContain('lifecycleState');
  });
  it('fails closed on dependency cycles and invalid windows', () => {
    const cyclic = scenario(1);
    cyclic.windows.push({ ...cyclic.windows[0], initiativeId: 'i2', dependencySnapshot: ['i1'] });
    cyclic.windows[0].dependencySnapshot = ['i2'];
    expect(() => validatePlanScenario(cyclic)).toThrow(/cycle/);
    expect(() => validatePlanScenario(scenario(1, '2026-11-15T00:00:00Z'))).toThrow(/earliest/);
  });
});
