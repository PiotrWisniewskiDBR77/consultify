import { describe, expect, it } from 'vitest';

import { buildProjectStageGateRows } from '../projectStageGateModel';

describe('buildProjectStageGateRows', () => {
  it('projects five PMBOK-lite gates and marks only the current gate actionable', () => {
    const rows = buildProjectStageGateRows({
      currentPhase: 'Initiatives',
      nextGate: {
        gateType: 'PLANNING_GATE',
        status: 'READY',
        completionCriteria: [
          { criterion: 'Initiatives have owners', isMet: true, evidence: 'Verified' },
        ],
        missingElements: [],
      },
      history: [
        {
          id: 'g1',
          gate_type: 'READINESS_GATE',
          status: 'PASSED',
          approved_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'g2',
          gate_type: 'DESIGN_GATE',
          status: 'PASSED',
          approved_at: '2026-09-02T00:00:00Z',
        },
      ],
    });

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.gateType)).toEqual([
      'READINESS_GATE',
      'DESIGN_GATE',
      'PLANNING_GATE',
      'EXECUTION_GATE',
      'CLOSURE_GATE',
    ]);
    expect(rows[0]).toMatchObject({ state: 'PASSED', actionable: false });
    expect(rows[2]).toMatchObject({ state: 'READY', actionable: true, action: 'REQUEST' });
    expect(rows[3]).toMatchObject({ state: 'UPCOMING', actionable: false });
  });

  it('exposes a pending request only as an approval action for an independent reviewer', () => {
    const rows = buildProjectStageGateRows({
      currentPhase: 'Context',
      nextGate: {
        gateType: 'READINESS_GATE',
        status: 'READY',
        completionCriteria: [],
        missingElements: [],
      },
      history: [],
      actorDuty: 'REVIEWER',
      pendingRequest: { id: 'request-1', requestedBy: 'executor-1' },
    });

    expect(rows[0]).toMatchObject({
      state: 'PENDING_REVIEW',
      actionable: true,
      action: 'APPROVE',
    });
  });

  it('keeps missing readiness criteria visible and blocks passage', () => {
    const rows = buildProjectStageGateRows({
      currentPhase: 'Context',
      nextGate: {
        gateType: 'READINESS_GATE',
        status: 'NOT_READY',
        completionCriteria: [
          { criterion: 'Strategic goals defined', isMet: false, evidence: 'Not met' },
        ],
        missingElements: ['Strategic goals defined'],
      },
      history: [],
    });

    expect(rows[0]).toMatchObject({ state: 'NOT_READY', actionable: false });
    expect(rows[0].missingElements).toEqual(['Strategic goals defined']);
  });
});
