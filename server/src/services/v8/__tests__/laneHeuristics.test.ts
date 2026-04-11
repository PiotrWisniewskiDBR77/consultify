import { describe, expect, it } from 'vitest';

import { analyzeActionQueue } from '../laneHeuristics/actionQueueHeuristics.js';
import { analyzeBlockers } from '../laneHeuristics/blockersHeuristics.js';
import { analyzeDecisions } from '../laneHeuristics/decisionsHeuristics.js';
import { analyzePeopleChange } from '../laneHeuristics/peopleChangeHeuristics.js';
import { analyzeRisk } from '../laneHeuristics/riskHeuristics.js';
import { analyzeWorkload } from '../laneHeuristics/workloadHeuristics.js';
import type { HeuristicInput, HeuristicOutput } from '../laneHeuristics/types.js';

const pastDate = '2020-01-15T00:00:00.000Z';

function baseInput(overrides: Partial<HeuristicInput> = {}): HeuristicInput {
  return {
    organizationId: 'org-heuristics-test',
    controlTowerQueues: {
      late: [],
      at_risk: [],
      blocked: [],
      overloaded: [],
      stale: [],
    },
    controlTowerCounts: {
      late: 0,
      at_risk: 0,
      blocked: 0,
      overloaded: 0,
      stale: 0,
    },
    riskSignals: [],
    delaySignals: [],
    capacityAlerts: [],
    decisions: [],
    initiatives: [],
    tasks: [],
    ...overrides,
  };
}

describe('lane heuristics (pure)', () => {
  it('analyzeActionQueue surfaces overdue work, tower counts, and suggestions', () => {
    const input = baseInput({
      controlTowerCounts: { late: 3, blocked: 2, stale: 1, at_risk: 0, overloaded: 0 },
      tasks: [
        { id: 't1', due_date: pastDate, status: 'IN_PROGRESS', assignee_id: 'u1' },
        { id: 't2', due_date: pastDate, status: 'IN_PROGRESS', assignee_id: 'u1' },
      ],
      decisions: [
        { id: 'd1', status: 'PENDING', dueDate: pastDate, title: 'Approve scope' },
      ],
    });
    const out: HeuristicOutput = analyzeActionQueue(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzeDecisions reacts to pending decisions with past dueDate', () => {
    const input = baseInput({
      decisions: [
        { id: 'd1', status: 'PENDING', dueDate: pastDate, ownerId: 'u1', createdAt: '2020-01-01T00:00:00.000Z' },
        { id: 'd2', status: 'PENDING', dueDate: pastDate, ownerId: 'u1' },
      ],
      controlTowerCounts: { blocked: 2, late: 0, at_risk: 0, overloaded: 0, stale: 0 },
    });
    const out: HeuristicOutput = analyzeDecisions(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzeBlockers uses dependency-style tower items and elevated risk signals', () => {
    const input = baseInput({
      controlTowerCounts: { blocked: 6, late: 0, at_risk: 0, overloaded: 0, stale: 0 },
      controlTowerQueues: {
        late: [],
        at_risk: [],
        overloaded: [],
        stale: [],
        blocked: [
          {
            entityType: 'TASK',
            entityId: 't-dep',
            name: 'Blocked by predecessor',
            why: [{ kind: 'dependency', detail: 'Waiting on vendor' }],
            affectsNext: [{ id: 'x1' }, { id: 'x2' }],
          },
          {
            entityType: 'INITIATIVE',
            entityId: 'i-dec',
            name: 'Blocked on approval',
            why: [{ kind: 'status', detail: 'Pending decision from steering' }],
            affectsNext: [],
          },
        ],
      },
      riskSignals: [{ id: 'r1', severity: 'HIGH', type: 'DEPENDENCY' }],
    });
    const out: HeuristicOutput = analyzeBlockers(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzeWorkload reacts to capacity alerts and uneven assignment', () => {
    const manyForAlice = Array.from({ length: 11 }, (_, i) => ({
      id: `ta-${i}`,
      status: 'IN_PROGRESS',
      assignee_id: 'user-alice',
      estimated_hours: 2,
    }));
    const fewForBob = Array.from({ length: 2 }, (_, i) => ({
      id: `tb-${i}`,
      status: 'TODO',
      assignee_id: 'user-bob',
      estimated_hours: 1,
    }));
    const unassigned = Array.from({ length: 6 }, (_, i) => ({
      id: `tu-${i}`,
      status: 'TODO',
      assignee_id: null,
      estimated_hours: 1,
    }));
    const input = baseInput({
      tasks: [...manyForAlice, ...fewForBob, ...unassigned],
      capacityAlerts: [{ userId: 'user-alice', overloadHours: 12, severity: 'warning' }],
    });
    const out: HeuristicOutput = analyzeWorkload(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzeRisk combines risk signals and initiatives missing baseline end date', () => {
    const input = baseInput({
      riskSignals: [
        { id: 'rs1', severity: 'CRITICAL', type: 'SCHEDULE' },
        { id: 'rs2', severity: 'HIGH', type: 'RESOURCE' },
      ],
      delaySignals: [{ id: 'ds1', severity: 'CRITICAL' }],
      initiatives: [
        { id: 'i1', status: 'ACTIVE', planned_end_date: null },
        { id: 'i2', status: 'IN_PROGRESS', planned_end_date: null },
      ],
      tasks: [{ id: 't1', status: 'TODO', estimated_hours: null }],
      controlTowerCounts: { late: 0, blocked: 0, stale: 0, at_risk: 0, overloaded: 0 },
    });
    const out: HeuristicOutput = analyzeRisk(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzePeopleChange flags concentrated ownership and unassigned tasks', () => {
    const initiatives = Array.from({ length: 6 }, (_, i) => ({
      id: `init-${i}`,
      status: 'IN_PROGRESS',
      ownerId: 'owner-central',
      planned_end_date: '2026-12-31',
    }));
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      id: `tsk-${i}`,
      status: 'TODO',
      assignee_id: 'owner-central',
    }));
    const input = baseInput({
      initiatives,
      tasks,
      decisions: Array.from({ length: 6 }, (_, i) => ({ id: `pd-${i}`, status: 'PENDING' })),
    });
    const out: HeuristicOutput = analyzePeopleChange(input);
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.suggestions.length).toBeGreaterThan(0);
  });
});
