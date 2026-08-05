/**
 * Manager snapshot fixture (M02-008).
 *
 * Defaults reproduce the SHAPE of the demo data that exposed the finding —
 * a tiny weekly window sitting on top of a large all-time backlog — because
 * that combination is exactly what the old code rendered incoherently.
 */

import type { ManagerSnapshot } from '../../../../../src/components/MyWork/Executive/managerSnapshot';

export function makeSnapshot(overrides: Partial<ManagerSnapshot> = {}): ManagerSnapshot {
  const base: ManagerSnapshot = {
    generatedAt: '2026-08-04T21:54:00.000Z',
    window: {
      period: 'week',
      days: 7,
      start: '2026-07-28T21:54:00.000Z',
      end: '2026-08-04T21:54:00.000Z',
      today: '2026-08-04',
    },
    scope: { organizationId: 'org-1', ownerUserId: 'user-1' },
    owner: {
      basis: 'owner',
      tasks: {
        openTotal: 84,
        overdue: 71,
        blocked: 3,
        windowCreated: 1,
        windowCompleted: 0,
        completionPct: 0,
        onTimePct: 0,
        previousWindowCreated: 2,
        previousWindowCompleted: 1,
        previousCompletionPct: 50,
        trend: 'down',
      },
      decisions: { pending: 23, escalated: 4, critical: 0, avgWaitDays: 23.9 },
    },
    organization: {
      basis: 'organization',
      tasks: { openTotal: 210, overdue: 77, blocked: 9 },
      decisions: { pending: 54, escalated: 12 },
      approvals: { proposed: 2, accepted: 1, executed: 5 },
    },
    team: {
      basis: 'organization',
      memberCount: 6,
      avgUtilizationPct: 82,
      overloaded: 1,
      available: 2,
      utilizationCredible: true,
    },
    health: {
      score: 41,
      previousScore: 61,
      trend: 'down',
      breakdown: { execution: 0, decisions: 20, capacity: 82, risk: 97 },
    },
    risk: { level: 'high', blockers: 71, escalations: 12 },
    coherence: { ok: true, checks: [] },
  };

  return { ...base, ...overrides } as ManagerSnapshot;
}
