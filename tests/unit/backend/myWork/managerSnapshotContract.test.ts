/**
 * Manager snapshot — self-consistency invariants (M02-008).
 *
 * These are the checks that would have FAILED on the demo screenshot that
 * produced the finding: 71 overdue tasks reported against a denominator of 1,
 * a pending-decision headline capped by a `LIMIT`, and an escalation count
 * quoted from a different query than the one behind the Risk card.
 */

import { describe, expect, it } from 'vitest';

import {
  buildCoherenceChecks,
  type ManagerSnapshot,
  num,
  pct,
} from '../../../../server/src/routes/my-work/managerSnapshot.contract';

type Base = Omit<ManagerSnapshot, 'coherence'>;

const base = (overrides: Partial<Base> = {}): Base => ({
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
  ...overrides,
});

const failedIds = (snapshot: Base) =>
  buildCoherenceChecks(snapshot)
    .checks.filter((c) => !c.ok)
    .map((c) => c.id);

describe('buildCoherenceChecks', () => {
  it('passes on a snapshot where owner figures nest inside org figures', () => {
    const result = buildCoherenceChecks(base());
    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });

  it('reports every check it ran, not only the failures', () => {
    // A silent "ok: true" with zero checks would be indistinguishable from a
    // snapshot that was never validated.
    expect(buildCoherenceChecks(base()).checks.length).toBeGreaterThanOrEqual(10);
  });

  it('fails when more tasks are overdue than are open — the on-screen bug', () => {
    const snapshot = base();
    snapshot.owner.tasks.openTotal = 1; // the old `total` (created this week)
    const failed = failedIds(snapshot);
    expect(failed).toContain('owner.tasks.overdue<=openTotal');
    expect(buildCoherenceChecks(snapshot).ok).toBe(false);
  });

  it('fails when the owner slice exceeds the organization total', () => {
    const snapshot = base();
    snapshot.organization.tasks.overdue = 10; // owner has 71
    expect(failedIds(snapshot)).toContain('owner.tasks.overdue<=org.tasks.overdue');
  });

  it('fails when owner pending decisions exceed the org count', () => {
    const snapshot = base();
    snapshot.organization.decisions.pending = 5; // owner has 23
    expect(failedIds(snapshot)).toContain('owner.decisions.pending<=org.decisions.pending');
  });

  it('fails when critical decisions are not a subset of pending ones', () => {
    const snapshot = base();
    snapshot.owner.decisions.critical = 99;
    expect(failedIds(snapshot)).toContain('owner.decisions.critical<=owner.decisions.pending');
  });

  it('fails when the risk card and the org escalation count disagree', () => {
    // This is the 71-vs-77 class of defect: two names for one quantity.
    const snapshot = base();
    snapshot.risk.escalations = 77;
    expect(failedIds(snapshot)).toContain('risk.escalations==org.decisions.escalated');
  });

  it('fails when risk blockers stop being the owner overdue count', () => {
    const snapshot = base();
    snapshot.risk.blockers = 54;
    expect(failedIds(snapshot)).toContain('risk.blockers==owner.tasks.overdue');
  });

  it('fails on a completion percent outside 0..100', () => {
    const snapshot = base();
    snapshot.owner.tasks.completionPct = 400;
    expect(failedIds(snapshot)).toContain('owner.tasks.completionPct in 0..100');
  });

  it('fails when the team buckets add up to more members than exist', () => {
    const snapshot = base();
    snapshot.team.memberCount = 2; // 1 overloaded + 2 available
    expect(failedIds(snapshot)).toContain('team.overloaded+available<=memberCount');
  });
});

describe('num / pct helpers', () => {
  it('reads numeric strings and missing rows without producing NaN', () => {
    expect(num({ a: '42' }, 'a')).toBe(42);
    expect(num(null, 'a')).toBe(0);
    expect(num({}, 'a')).toBe(0);
  });

  it('never divides by zero', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
  });
});
