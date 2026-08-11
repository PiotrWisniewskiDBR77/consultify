import { describe, expect, it } from 'vitest';
import {
  validateCapacityScenario,
  type CapacityScenario,
} from '../../../server/src/domain/initiatives-execution/capacityScenario';
const unknown = {
  knowledgeState: 'UNKNOWN' as const,
  low: null,
  base: null,
  high: null,
  sourceRef: null,
  sourceVersion: null,
  asOf: '2026-08-09T20:00:00Z',
  confidence: 'UNKNOWN' as const,
  ownerId: 'resource-owner',
  reason: 'Non-project load unavailable',
};
const scenario: CapacityScenario = {
  scenarioId: 'c1',
  scenarioVersion: 1,
  status: 'DRAFT',
  planScenarioId: 'p1',
  planScenarioVersion: 2,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    {
      periodId: 'w1',
      start: '2026-10-01T00:00:00Z',
      end: '2026-10-08T00:00:00Z',
      demand: unknown,
      supply: unknown,
    },
  ],
  constraints: [],
  proposedAssignments: [],
  createdBy: 'rm',
  updatedBy: 'rm',
  publishedBy: null,
  publishedAt: null,
};
describe('Capacity Scenario', () => {
  it('preserves UNKNOWN as null rather than zero', () => {
    expect(() => validateCapacityScenario(scenario)).not.toThrow();
    expect(scenario.periods[0].supply.base).toBeNull();
  });
  it('rejects UNKNOWN represented as zero and inconsistent ranges', () => {
    expect(() =>
      validateCapacityScenario({
        ...scenario,
        periods: [{ ...scenario.periods[0], supply: { ...unknown, base: 0 } }],
      })
    ).toThrow(/UNKNOWN/);
  });
});
