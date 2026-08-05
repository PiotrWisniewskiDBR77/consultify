/**
 * Manager snapshot client (finding M02-008).
 *
 * The Manager surface renders EVERY number from one object fetched once. That
 * is the whole point: previously seven independent requests each carried their
 * own clock and their own (invisible) scope, so the page could show "0% · 0/1"
 * next to "Overdue 71", and "Decisions pending 10" that was really a LIMIT.
 *
 * Two rules this module enforces for the UI:
 *   1. Every figure carries a BASIS ('owner' | 'organization'). The dashboard
 *      must print the basis next to the number — differing numbers are fine,
 *      silently differing numbers are not.
 *   2. If the snapshot fails its own invariants, `status` becomes
 *      'incoherent' and the dashboard degrades instead of publishing numbers
 *      it cannot defend.
 *
 * See server/src/routes/my-work/manager.routes.ts for the source of truth.
 */

import { Api } from '../../../services/api';

export type SnapshotBasis = 'owner' | 'organization';

export interface SnapshotTaskBacklog {
  openTotal: number;
  overdue: number;
  blocked: number;
}

export interface ManagerSnapshot {
  generatedAt: string;
  window: { period: 'week' | 'month'; days: number; start: string; end: string; today: string };
  scope: { organizationId: string; ownerUserId: string };
  owner: {
    basis: 'owner';
    tasks: SnapshotTaskBacklog & {
      windowCreated: number;
      windowCompleted: number;
      completionPct: number;
      onTimePct: number;
      previousWindowCreated: number;
      previousWindowCompleted: number;
      previousCompletionPct: number;
      trend: 'up' | 'down' | 'stable';
    };
    decisions: { pending: number; escalated: number; critical: number; avgWaitDays: number };
  };
  organization: {
    basis: 'organization';
    tasks: SnapshotTaskBacklog;
    decisions: { pending: number; escalated: number };
    approvals: { proposed: number; accepted: number; executed: number };
  };
  team: {
    basis: 'organization';
    memberCount: number;
    avgUtilizationPct: number;
    overloaded: number;
    available: number;
    utilizationCredible: boolean;
  };
  health: {
    score: number;
    previousScore: number;
    trend: 'up' | 'down' | 'stable';
    breakdown: { execution: number; decisions: number; capacity: number; risk: number };
  };
  risk: { level: 'low' | 'medium' | 'high' | 'critical'; blockers: number; escalations: number };
  coherence: { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> };
}

export type ManagerSnapshotResult =
  | { status: 'ok'; snapshot: ManagerSnapshot }
  /** Loaded, but the server's own invariants failed — show, but flag as unverified. */
  | { status: 'incoherent'; snapshot: ManagerSnapshot; failed: string[] }
  /** 403 — the caller is not a manager. Distinct from a transport error. */
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

/**
 * Re-runs the server's invariants on the client. Defence in depth: if the
 * server contract ever regresses, the dashboard must not print contradictory
 * numbers just because the payload parsed.
 */
export function failedCoherenceChecks(snapshot: ManagerSnapshot): string[] {
  const serverFailures = (snapshot.coherence?.checks || [])
    .filter((check) => !check.ok)
    .map((check) => `${check.id} (${check.detail})`);

  const local: string[] = [];
  const owner = snapshot.owner;
  const org = snapshot.organization;
  if (owner.tasks.overdue > owner.tasks.openTotal) {
    local.push(
      `client:owner.tasks.overdue<=openTotal (${owner.tasks.overdue} > ${owner.tasks.openTotal})`
    );
  }
  if (owner.tasks.overdue > org.tasks.overdue) {
    local.push(
      `client:owner.tasks.overdue<=org.tasks.overdue (${owner.tasks.overdue} > ${org.tasks.overdue})`
    );
  }
  if (owner.decisions.pending > org.decisions.pending) {
    local.push(
      `client:owner.decisions.pending<=org.decisions.pending (${owner.decisions.pending} > ${org.decisions.pending})`
    );
  }
  if (owner.tasks.completionPct < 0 || owner.tasks.completionPct > 100) {
    local.push(`client:owner.tasks.completionPct in 0..100 (${owner.tasks.completionPct})`);
  }
  return [...serverFailures, ...local];
}

export async function fetchManagerSnapshot(
  period: 'week' | 'month' = 'week'
): Promise<ManagerSnapshotResult> {
  try {
    const payload = (await Api.get(
      `/my-work/manager/snapshot?period=${period}`
    )) as unknown as ManagerSnapshot;

    if (!payload || typeof payload !== 'object' || !payload.generatedAt) {
      return { status: 'error', message: 'MANAGER_SNAPSHOT_MALFORMED' };
    }

    const failed = failedCoherenceChecks(payload);
    if (failed.length > 0) return { status: 'incoherent', snapshot: payload, failed };
    return { status: 'ok', snapshot: payload };
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 403) return { status: 'forbidden' };
    // Never surface a raw object — M02-004/M02-014 forbid `[object Object]`.
    const message =
      error instanceof Error && error.message ? error.message : 'MANAGER_SNAPSHOT_FAILED';
    return { status: 'error', message };
  }
}
