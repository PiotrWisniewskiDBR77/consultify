import { describe, expect, it } from 'vitest';
import type { CapacityScenario } from '../capacityScenario.js';
import type { PlannedWindow, PlanScenario } from '../planScenario.js';
import { solvePlanScenario } from '../planSolver.js';

const periods = [1, 2, 3, 4].map((quarter) => ({
  periodId: `Q${quarter}`,
  start: `2026-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01T00:00:00.000Z`,
  end: `2026-${String(quarter * 3).padStart(2, '0')}-28T23:59:59.999Z`,
}));

const window = (initiativeId: string, dependencies: string[] = []): PlannedWindow => ({
  initiativeId,
  initiativeVersion: 1,
  earliest: null,
  target: null,
  latest: null,
  confidence: 'HIGH',
  rationale: 'Evidence-backed planning input.',
  dependencySnapshot: dependencies,
  constraintSnapshot: [],
});

const scenario = (windows: PlannedWindow[]): PlanScenario => ({
  scenarioId: 'plan-1',
  scenarioVersion: 1,
  status: 'DRAFT',
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 1,
  windowUnit: 'FTE',
  timezone: 'UTC',
  periods,
  windows,
  assumptions: [],
  createdBy: 'owner-1',
  updatedBy: 'owner-1',
  publishedBy: null,
  publishedAt: null,
});

const knownRange = (base: number) => ({
  knowledgeState: 'KNOWN' as const,
  low: base,
  base,
  high: base,
  sourceRef: 'capacity-source',
  sourceVersion: 1,
  asOf: '2026-01-01T00:00:00.000Z',
  confidence: 'HIGH' as const,
  ownerId: 'owner-1',
  reason: null,
});

const capacity = (supply: Array<number | null>): CapacityScenario => ({
  scenarioId: 'capacity-1',
  scenarioVersion: 1,
  status: 'PUBLISHED',
  planScenarioId: 'plan-1',
  planScenarioVersion: 1,
  windowUnit: 'FTE',
  timezone: 'UTC',
  periods: periods.map((period, index) => ({
    ...period,
    demand: knownRange(1),
    supply:
      supply[index] === null
        ? {
            ...knownRange(0),
            knowledgeState: 'UNKNOWN',
            low: null,
            base: null,
            high: null,
            sourceRef: null,
            sourceVersion: null,
            reason: 'Capacity not supplied.',
          }
        : knownRange(supply[index] ?? 0),
  })),
  constraints: [],
  proposedAssignments: [],
  createdBy: 'owner-1',
  updatedBy: 'owner-1',
  publishedBy: 'owner-1',
  publishedAt: '2026-01-01T00:00:00.000Z',
});

describe('solvePlanScenario', () => {
  it('places a dependency chain in successive periods', () => {
    const result = solvePlanScenario(
      scenario([window('C', ['B']), window('A'), window('B', ['A'])])
    );
    expect(
      result.assignments.map(({ window: item, periodId }) => [item.initiativeId, periodId])
    ).toEqual([
      ['A', 'Q1'],
      ['B', 'Q2'],
      ['C', 'Q3'],
    ]);
  });

  it('keeps parallel dependants in the same earliest feasible period', () => {
    const result = solvePlanScenario(
      scenario([window('A'), window('B', ['A']), window('C', ['A'])])
    );
    expect(
      Object.fromEntries(
        result.assignments.map((item) => [item.window.initiativeId, item.periodId])
      )
    ).toEqual({ A: 'Q1', B: 'Q2', C: 'Q2' });
  });

  it('reports an impossible own window without inventing an assignment', () => {
    const impossible = { ...window('A'), earliest: '2027-01-01T00:00:00.000Z' };
    const result = solvePlanScenario(scenario([impossible]));
    expect(result.assignments).toEqual([]);
    expect(result.conflicts).toContainEqual(expect.stringContaining('No feasible period for A'));
  });

  it('makes an UNKNOWN capacity constraint explicit instead of treating it as zero', () => {
    const result = solvePlanScenario(scenario([window('A')]), capacity([null, 1, 1, 1]));
    expect(result.assignments[0]?.periodId).toBe('Q1');
    expect(result.assumptions).toContainEqual(
      expect.stringContaining('Capacity unknown for period Q1')
    );
  });

  it('pushes excess demand to the next period when capacity is known', () => {
    const result = solvePlanScenario(scenario([window('A'), window('B')]), capacity([1, 1, 1, 1]));
    expect(result.assignments.map((item) => item.periodId)).toEqual(['Q1', 'Q2']);
  });

  it('reports dependency cycles and leaves their members unassigned', () => {
    const result = solvePlanScenario(scenario([window('A', ['B']), window('B', ['A'])]));
    expect(result.assignments).toEqual([]);
    expect(result.conflicts).toContainEqual(expect.stringContaining('Dependency cycle'));
  });

  it('is deterministic for the same input', () => {
    const input = scenario([window('C', ['A']), window('B'), window('A')]);
    expect(solvePlanScenario(input, capacity([2, 2, 2, 2]))).toEqual(
      solvePlanScenario(input, capacity([2, 2, 2, 2]))
    );
  });

  it('accepts a legacy payload without optional solver fields', () => {
    const legacy = JSON.parse(JSON.stringify(scenario([window('legacy')])));
    expect(solvePlanScenario(legacy).assignments[0]?.window.initiativeId).toBe('legacy');
  });
});
