import { describe, expect, it } from 'vitest';

import { proposeCapacityOptions } from '../capacityOptionsAdvisor.js';
import type { CapacityScenario } from '../capacityScenario.js';
import type { PlanScenario } from '../planScenario.js';

const known = (base: number) => ({
  knowledgeState: 'KNOWN' as const,
  low: base,
  base,
  high: base,
  sourceRef: 'source',
  sourceVersion: 1,
  asOf: '2026-08-28T00:00:00.000Z',
  confidence: 'HIGH' as const,
  ownerId: 'planner',
  reason: null,
});

// FIX-1 gate: a plan with a single period and a demand that exceeds the only
// available period's known supply gives the solver nowhere to shift work to.
// solvePlanScenario must report a conflict ("No feasible period for ...")
// and zero assignments. The advisor must NOT invent a shiftPeriods=1 in
// that case — it must report UNKNOWN, and must surface the solver conflict
// as an assumption instead of silently dropping it.
const infeasiblePlan: PlanScenario = {
  scenarioId: 'plan-infeasible',
  scenarioVersion: 1,
  status: 'PUBLISHED',
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [{ periodId: 'w1', start: '2026-08-01', end: '2026-08-08' }],
  windows: [
    {
      initiativeId: 'initiative-1',
      initiativeVersion: 2,
      earliest: '2026-08-01',
      target: '2026-08-04',
      latest: '2026-08-08',
      confidence: 'HIGH',
      rationale: 'Termin z opublikowanego planu',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
  ],
  assumptions: [],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: 'planner',
  publishedAt: '2026-08-28T00:00:00.000Z',
};

const infeasibleCapacity: CapacityScenario = {
  scenarioId: 'capacity-infeasible',
  scenarioVersion: 1,
  status: 'PUBLISHED',
  planScenarioId: infeasiblePlan.scenarioId,
  planScenarioVersion: infeasiblePlan.scenarioVersion,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    {
      periodId: 'w1',
      start: '2026-08-01',
      end: '2026-08-08',
      demand: known(8),
      supply: known(4),
    },
  ],
  constraints: [],
  proposedAssignments: [
    {
      assignmentId: 'assignment-1',
      initiativeId: 'initiative-1',
      resourceOrRoleId: 'team-a',
      periodIds: ['w1'],
      demand: known(8),
      rationale: 'Praca zespołu A',
    },
  ],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: 'planner',
  publishedAt: '2026-08-28T00:00:00.000Z',
};

// Feasible counterpart: same shape but a second period exists with enough
// spare supply, so the solver CAN shift the work — the advisor must still
// return a real, estimated number here (regression guard for direction b).
const feasiblePlan: PlanScenario = {
  ...infeasiblePlan,
  scenarioId: 'plan-feasible',
  periods: [
    { periodId: 'w1', start: '2026-08-01', end: '2026-08-08' },
    { periodId: 'w2', start: '2026-08-08', end: '2026-08-15' },
  ],
};

const feasibleCapacity: CapacityScenario = {
  ...infeasibleCapacity,
  scenarioId: 'capacity-feasible',
  planScenarioId: feasiblePlan.scenarioId,
  periods: [
    { periodId: 'w1', start: '2026-08-01', end: '2026-08-08', demand: known(8), supply: known(4) },
    { periodId: 'w2', start: '2026-08-08', end: '2026-08-15', demand: known(1), supply: known(4) },
  ],
};

describe('capacity option advisor — RESEQUENCE honesty (FIX-1)', () => {
  it('returns UNKNOWN, not an invented 1, when the solver finds no feasible period', () => {
    const [resequence] = proposeCapacityOptions(infeasiblePlan, infeasibleCapacity);

    expect(resequence.impact.date).toMatchObject({
      knowledgeState: 'UNKNOWN',
      confidence: 'UNKNOWN',
      low: null,
      base: null,
      high: null,
    });
    expect(resequence.rationale).toMatch(/niewykonalna/);
    expect(resequence.rationale).not.toMatch(/wyliczył przesunięcie/);
  });

  it('surfaces the solver conflict in assumptions instead of dropping it', () => {
    const [resequence] = proposeCapacityOptions(infeasiblePlan, infeasibleCapacity);

    const conflictAssumption = resequence.assumptions.find((a) =>
      a.assumption.includes('No feasible period for initiative-1')
    );
    expect(conflictAssumption).toBeDefined();
    expect(conflictAssumption?.ownerId).toBeTruthy();
    expect(conflictAssumption?.sourceRef.ref).toBeTruthy();
    expect(conflictAssumption?.sourceRef.version).toBeTruthy();
  });

  it('still returns a real ESTIMATED number when a shift is actually feasible', () => {
    const [resequence] = proposeCapacityOptions(feasiblePlan, feasibleCapacity);

    expect(resequence.impact.date.knowledgeState).toBe('ESTIMATED');
    expect(resequence.impact.date.base).toBe(1);
    expect(resequence.impact.date.low).toBe(1);
    expect(resequence.impact.date.high).toBe(1);
    expect(resequence.rationale).toMatch(/wyliczył przesunięcie/);
  });
});
