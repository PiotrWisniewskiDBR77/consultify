import { describe, expect, it } from 'vitest';

import { capacityOptionFindings } from '../capacityOptions.js';
import { NoCapacityPressureError, proposeCapacityOptions } from '../capacityOptionsAdvisor.js';
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

const plan: PlanScenario = {
  scenarioId: 'plan-1',
  scenarioVersion: 4,
  status: 'PUBLISHED',
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'w1', start: '2026-08-01', end: '2026-08-08' },
    { periodId: 'w2', start: '2026-08-08', end: '2026-08-15' },
  ],
  windows: [
    {
      initiativeId: 'initiative-1',
      initiativeVersion: 2,
      earliest: '2026-08-01',
      target: '2026-08-04',
      latest: '2026-08-15',
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

const capacity = (demand = 8, supply = 4): CapacityScenario => ({
  scenarioId: 'capacity-1',
  scenarioVersion: 3,
  status: 'PUBLISHED',
  planScenarioId: plan.scenarioId,
  planScenarioVersion: plan.scenarioVersion,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    {
      periodId: 'w1',
      start: '2026-08-01',
      end: '2026-08-08',
      demand: known(demand),
      supply: known(supply),
    },
    { periodId: 'w2', start: '2026-08-08', end: '2026-08-15', demand: known(1), supply: known(4) },
  ],
  constraints: [],
  proposedAssignments: [
    {
      assignmentId: 'assignment-1',
      initiativeId: 'initiative-1',
      resourceOrRoleId: 'team-a',
      periodIds: ['w1'],
      demand: known(demand),
      rationale: 'Praca zespołu A',
    },
  ],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: 'planner',
  publishedAt: '2026-08-28T00:00:00.000Z',
});

describe('deterministic capacity option advisor', () => {
  it('returns exactly the canonical three kinds in order', () => {
    expect(proposeCapacityOptions(plan, capacity()).map((option) => option.kind)).toEqual([
      'RESEQUENCE',
      'SCOPE_SPLIT',
      'ADD_CAPACITY',
    ]);
  });

  it('produces options accepted without capacityOptionFindings', () => {
    expect(proposeCapacityOptions(plan, capacity()).flatMap(capacityOptionFindings)).toEqual([]);
  });

  it('refuses honestly when no period is overloaded', () => {
    expect(() => proposeCapacityOptions(plan, capacity(4, 4))).toThrow(NoCapacityPressureError);
  });

  it('keeps unknown unit cost null instead of inventing zero', () => {
    const addCapacity = proposeCapacityOptions(plan, capacity())[2];
    expect(addCapacity.impact.cost).toMatchObject({
      low: null,
      base: null,
      high: null,
      knowledgeState: 'UNKNOWN',
    });
  });

  it('uses real period, membership and resource identifiers', () => {
    const options = proposeCapacityOptions(plan, capacity());
    expect(options[0]).toMatchObject({
      affectedPeriods: ['w1'],
      affectedMemberships: [{ initiativeId: 'initiative-1', membershipVersion: 2 }],
      affectedResources: [{ resourceRef: 'team-a', version: 3 }],
    });
  });
});
