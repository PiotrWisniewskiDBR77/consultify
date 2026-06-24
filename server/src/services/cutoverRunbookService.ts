/**
 * Cutover Runbook Service — M14 / F5 (5.4)
 *
 * A cutover runbook captures the go-live plan for an initiative stage:
 * an ordered list of steps (owners + time windows), dedicated rollback
 * steps, and a go/no-go decision gate. Plus a pure `evaluateRollbackTriggers`
 * that decides whether an in-flight cutover should roll back based on live
 * metrics (error rate, performance vs baseline, critical-process health).
 *
 * org-scoped queries, node-pg snake_case columns via DbPromise.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

export type CutoverRunbookStatus = 'planned' | 'in_progress' | 'completed' | 'aborted';
export type CutoverGoNoGo = 'go' | 'no_go' | 'pending';
export type CutoverStepStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'failed';

export interface CutoverStep {
  id: string;
  organizationId: string;
  runbookId: string;
  sequence: number;
  title: string;
  ownerId: string | null;
  timeWindow: string | null;
  status: CutoverStepStatus;
  isRollback: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CutoverRunbook {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  stageId: string | null;
  name: string;
  status: CutoverRunbookStatus;
  goNoGo: CutoverGoNoGo | null;
  createdAt: string;
  updatedAt: string;
  steps?: CutoverStep[];
}

export interface CreateRunbookData {
  id?: string;
  initiativeId?: string | null;
  stageId?: string | null;
  name: string;
  status?: CutoverRunbookStatus;
  goNoGo?: CutoverGoNoGo | null;
}

export interface AddStepData {
  id?: string;
  sequence?: number;
  title: string;
  ownerId?: string | null;
  timeWindow?: string | null;
  status?: CutoverStepStatus;
  isRollback?: boolean;
}

// ==========================================
// ROLLBACK TRIGGER EVALUATION (pure)
// ==========================================

export interface RollbackMetrics {
  /** Observed error rate, in percent (e.g. 4.2 means 4.2%). */
  errorRatePct?: number;
  /** Performance vs baseline, in percent (100 = at baseline, 130 = 30% slower). */
  perfVsBaselinePct?: number;
  /** Whether all business-critical processes are healthy. */
  criticalProcessesOk?: boolean;
}

export interface RollbackThresholds {
  /** Roll back when errorRatePct strictly exceeds this. */
  errorRatePct: number;
  /** Roll back when perfVsBaselinePct strictly exceeds this. */
  perfVsBaselinePct: number;
}

export interface RollbackEvaluation {
  rollback: boolean;
  reasons: string[];
}

export const DEFAULT_ROLLBACK_THRESHOLDS: RollbackThresholds = {
  errorRatePct: 2,
  perfVsBaselinePct: 110,
};

/**
 * Pure decision function: should an in-flight cutover roll back?
 *
 * Rolls back when ANY of:
 *  - error rate exceeds the threshold,
 *  - performance vs baseline exceeds the threshold (e.g. >110% = >10% slower),
 *  - a business-critical process is reported not-OK.
 *
 * Undefined metrics are treated as "no signal" (do not trigger).
 */
export function evaluateRollbackTriggers(
  metrics: RollbackMetrics,
  thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS
): RollbackEvaluation {
  const reasons: string[] = [];

  if (
    typeof metrics.errorRatePct === 'number' &&
    metrics.errorRatePct > thresholds.errorRatePct
  ) {
    reasons.push(
      `Error rate ${metrics.errorRatePct}% exceeds threshold ${thresholds.errorRatePct}%`
    );
  }

  if (
    typeof metrics.perfVsBaselinePct === 'number' &&
    metrics.perfVsBaselinePct > thresholds.perfVsBaselinePct
  ) {
    reasons.push(
      `Performance ${metrics.perfVsBaselinePct}% of baseline exceeds threshold ${thresholds.perfVsBaselinePct}%`
    );
  }

  if (metrics.criticalProcessesOk === false) {
    reasons.push('Critical processes are not healthy');
  }

  return { rollback: reasons.length > 0, reasons };
}

// ==========================================
// ROW MAPPERS
// ==========================================

function mapRunbookRow(row: any): CutoverRunbook {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id ?? null,
    stageId: row.stage_id ?? null,
    name: row.name,
    status: (row.status ?? 'planned') as CutoverRunbookStatus,
    goNoGo: (row.go_no_go ?? null) as CutoverGoNoGo | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStepRow(row: any): CutoverStep {
  return {
    id: row.id,
    organizationId: row.organization_id,
    runbookId: row.runbook_id,
    sequence: Number(row.sequence ?? 0),
    title: row.title,
    ownerId: row.owner_id ?? null,
    timeWindow: row.time_window ?? null,
    status: (row.status ?? 'pending') as CutoverStepStatus,
    isRollback: Number(row.is_rollback ?? 0) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// CRUD (org-scoped)
// ==========================================

/**
 * Get the runbook for an initiative (most-recent), with its ordered steps.
 */
export async function getRunbook(
  orgId: string,
  initiativeId: string
): Promise<CutoverRunbook | null> {
  const row = await dbGet<any>(
    `SELECT * FROM cutover_runbooks
     WHERE organization_id = ? AND initiative_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [orgId, initiativeId]
  );
  if (!row) return null;

  const runbook = mapRunbookRow(row);
  const stepRows = await dbAll<any>(
    `SELECT * FROM cutover_steps
     WHERE organization_id = ? AND runbook_id = ?
     ORDER BY sequence ASC, created_at ASC`,
    [orgId, runbook.id]
  );
  runbook.steps = stepRows.map(mapStepRow);
  return runbook;
}

/**
 * Create a new cutover runbook for an org.
 */
export async function createRunbook(
  orgId: string,
  data: CreateRunbookData
): Promise<CutoverRunbook> {
  const id = data.id || uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO cutover_runbooks
       (id, organization_id, initiative_id, stage_id, name, status, go_no_go, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      data.initiativeId ?? null,
      data.stageId ?? null,
      data.name,
      data.status ?? 'planned',
      data.goNoGo ?? null,
      now,
      now,
    ]
  );

  return {
    id,
    organizationId: orgId,
    initiativeId: data.initiativeId ?? null,
    stageId: data.stageId ?? null,
    name: data.name,
    status: data.status ?? 'planned',
    goNoGo: data.goNoGo ?? null,
    createdAt: now,
    updatedAt: now,
    steps: [],
  };
}

/**
 * Append a step to a runbook. Auto-assigns the next sequence when omitted.
 */
export async function addStep(
  orgId: string,
  runbookId: string,
  step: AddStepData
): Promise<CutoverStep> {
  const id = step.id || uuidv4();
  const now = new Date().toISOString();

  let sequence = step.sequence;
  if (typeof sequence !== 'number') {
    const maxRow = await dbGet<any>(
      `SELECT MAX(sequence) AS max_seq FROM cutover_steps
       WHERE organization_id = ? AND runbook_id = ?`,
      [orgId, runbookId]
    );
    const maxSeq = maxRow?.max_seq;
    sequence = (typeof maxSeq === 'number' ? maxSeq : Number(maxSeq ?? -1)) + 1;
    if (!Number.isFinite(sequence)) sequence = 0;
  }

  await dbRun(
    `INSERT INTO cutover_steps
       (id, organization_id, runbook_id, sequence, title, owner_id, time_window, status, is_rollback, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      runbookId,
      sequence,
      step.title,
      step.ownerId ?? null,
      step.timeWindow ?? null,
      step.status ?? 'pending',
      step.isRollback ? 1 : 0,
      now,
      now,
    ]
  );

  return {
    id,
    organizationId: orgId,
    runbookId,
    sequence,
    title: step.title,
    ownerId: step.ownerId ?? null,
    timeWindow: step.timeWindow ?? null,
    status: step.status ?? 'pending',
    isRollback: Boolean(step.isRollback),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Advance a single step to a new status (org-scoped).
 */
export async function advanceStep(
  orgId: string,
  stepId: string,
  status: CutoverStepStatus
): Promise<CutoverStep | null> {
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE cutover_steps
       SET status = ?, updated_at = ?
     WHERE organization_id = ? AND id = ?`,
    [status, now, orgId, stepId]
  );

  const row = await dbGet<any>(
    `SELECT * FROM cutover_steps WHERE organization_id = ? AND id = ?`,
    [orgId, stepId]
  );
  return row ? mapStepRow(row) : null;
}
