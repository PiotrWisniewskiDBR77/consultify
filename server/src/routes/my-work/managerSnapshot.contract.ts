/**
 * Manager snapshot — WIRE CONTRACT + self-consistency invariants (M02-008).
 *
 * Split out of the route so the invariants can be tested as a pure function,
 * with no express, no DB and no network. The route computes the figures; this
 * file defines what it means for those figures to agree with each other.
 */

export interface ManagerSnapshotBasisTasks {
  /** Tasks that are not in a closed status, regardless of when they were created. */
  openTotal: number;
  /** Subset of `openTotal` whose due date is strictly before today. */
  overdue: number;
  /** Subset of `openTotal` that is blocked. */
  blocked: number;
}

export interface ManagerSnapshotBasisDecisions {
  /** Real COUNT(*) — never a page length. */
  pending: number;
  escalated: number;
}

export interface ManagerSnapshot {
  generatedAt: string;
  window: { period: 'week' | 'month'; days: number; start: string; end: string; today: string };
  scope: { organizationId: string; ownerUserId: string };
  owner: {
    basis: 'owner';
    tasks: ManagerSnapshotBasisTasks & {
      windowCreated: number;
      windowCompleted: number;
      completionPct: number;
      onTimePct: number;
      previousWindowCreated: number;
      previousWindowCompleted: number;
      previousCompletionPct: number;
      trend: 'up' | 'down' | 'stable';
    };
    decisions: ManagerSnapshotBasisDecisions & { critical: number; avgWaitDays: number };
  };
  organization: {
    basis: 'organization';
    tasks: ManagerSnapshotBasisTasks;
    decisions: ManagerSnapshotBasisDecisions;
    approvals: { proposed: number; accepted: number; executed: number };
  };
  team: {
    basis: 'organization';
    memberCount: number;
    avgUtilizationPct: number;
    overloaded: number;
    available: number;
    /** false when utilization is not credible (no members, or unbounded estimates). */
    utilizationCredible: boolean;
  };
  health: {
    score: number;
    previousScore: number;
    trend: 'up' | 'down' | 'stable';
    breakdown: { execution: number; decisions: number; capacity: number; risk: number };
  };
  risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    blockers: number;
    escalations: number;
  };
  /**
   * Machine-checkable invariants. `ok:false` means the snapshot contradicts
   * itself and the UI must degrade rather than print numbers it cannot defend.
   */
  coherence: { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> };
}

/** Reads one numeric column off a row that may be null or hold strings. */
export const num = (row: unknown, key: string): number => Number((row as any)?.[key] || 0);
/** Integer percent, guarded against a zero denominator. */
export const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/**
 * Every check compares two figures FROM THE SAME SNAPSHOT. A failure means the
 * queries disagree with each other, not that the business is unhealthy.
 */
export function buildCoherenceChecks(
  snapshot: Omit<ManagerSnapshot, 'coherence'>
): ManagerSnapshot['coherence'] {
  const o = snapshot.owner;
  const g = snapshot.organization;
  const t = snapshot.team;

  const checks = [
    {
      id: 'owner.tasks.overdue<=openTotal',
      ok: o.tasks.overdue <= o.tasks.openTotal,
      detail: `${o.tasks.overdue} <= ${o.tasks.openTotal}`,
    },
    {
      id: 'owner.tasks.blocked<=openTotal',
      ok: o.tasks.blocked <= o.tasks.openTotal,
      detail: `${o.tasks.blocked} <= ${o.tasks.openTotal}`,
    },
    {
      id: 'owner.tasks.openTotal<=org.tasks.openTotal',
      ok: o.tasks.openTotal <= g.tasks.openTotal,
      detail: `${o.tasks.openTotal} <= ${g.tasks.openTotal}`,
    },
    {
      id: 'owner.tasks.overdue<=org.tasks.overdue',
      ok: o.tasks.overdue <= g.tasks.overdue,
      detail: `${o.tasks.overdue} <= ${g.tasks.overdue}`,
    },
    {
      id: 'owner.decisions.pending<=org.decisions.pending',
      ok: o.decisions.pending <= g.decisions.pending,
      detail: `${o.decisions.pending} <= ${g.decisions.pending}`,
    },
    {
      id: 'owner.decisions.escalated<=org.decisions.escalated',
      ok: o.decisions.escalated <= g.decisions.escalated,
      detail: `${o.decisions.escalated} <= ${g.decisions.escalated}`,
    },
    {
      id: 'owner.decisions.critical<=owner.decisions.pending',
      ok: o.decisions.critical <= o.decisions.pending,
      detail: `${o.decisions.critical} <= ${o.decisions.pending}`,
    },
    {
      id: 'owner.tasks.completionPct in 0..100',
      ok: o.tasks.completionPct >= 0 && o.tasks.completionPct <= 100,
      detail: String(o.tasks.completionPct),
    },
    {
      id: 'team.overloaded+available<=memberCount',
      ok: t.overloaded + t.available <= t.memberCount,
      detail: `${t.overloaded} + ${t.available} <= ${t.memberCount}`,
    },
    {
      // The Risk card printed "Escalations" from a different query than the AI
      // copy did. Both now read this one field.
      id: 'risk.escalations==org.decisions.escalated',
      ok: snapshot.risk.escalations === g.decisions.escalated,
      detail: `${snapshot.risk.escalations} == ${g.decisions.escalated}`,
    },
    {
      id: 'risk.blockers==owner.tasks.overdue',
      ok: snapshot.risk.blockers === o.tasks.overdue,
      detail: `${snapshot.risk.blockers} == ${o.tasks.overdue}`,
    },
  ];

  return { ok: checks.every((c) => c.ok), checks };
}
