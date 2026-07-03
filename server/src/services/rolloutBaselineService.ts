/**
 * Rollout Baseline Service (M14/F5 5.3 — plan baseline / rebaseline)
 *
 * Persists an approved snapshot of the rollout (implementation) plan into
 * `plan_baselines`. A "baseline" freezes the plan's JSON state at approval time;
 * a later "rebaseline" simply captures another snapshot — the most recent row
 * for an org+project is the active baseline used for slip comparison.
 *
 * Org-scoping: every read and write is filtered by `organization_id`. The caller
 * (route) is responsible for resolving the authenticated org and verifying the
 * project belongs to it; this service additionally carries `organization_id` on
 * every query so a foreign-org caller can never read or overwrite a baseline.
 *
 * `snapshot` is stored as a JSON string (TEXT). Callers pass a plain object;
 * this service does the JSON.stringify on write and JSON.parse on read.
 */
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun, all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const LOG_PREFIX = '[Execution:RolloutBaseline]';

export interface CaptureBaselineOptions {
  /** Human label for the baseline, e.g. "Approved kickoff plan". */
  label?: string | null;
  /** Why this baseline/rebaseline was taken (scope change, slip, etc.). */
  reason?: string | null;
  /** Authenticated caller id — never client-supplied. */
  createdBy?: string | null;
}

export interface PlanBaseline {
  id: string;
  organizationId: string;
  projectId: string;
  label: string | null;
  /** Parsed plan snapshot (JSON state of the plan at approval time). */
  snapshot: unknown;
  reason: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

interface PlanBaselineRow {
  id: string;
  organization_id: string;
  project_id: string;
  label: string | null;
  snapshot: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
}

/** Schedule slip (in days) of an actual window versus its baseline window. */
export interface ScheduleSlip {
  startSlipDays: number;
  endSlipDays: number;
}

export interface DateWindow {
  start: string;
  end: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseSnapshot(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A non-JSON snapshot should never happen (we always stringify on write),
    // but never throw on read — surface the raw string instead.
    return raw;
  }
}

function mapRow(row: PlanBaselineRow): PlanBaseline {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    label: row.label ?? null,
    snapshot: parseSnapshot(row.snapshot),
    reason: row.reason ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

/**
 * Capture (baseline or rebaseline) the current plan state for an org+project.
 *
 * `snapshot` is any JSON-serialisable representation of the plan; it is stored
 * verbatim as a JSON string. Returns the persisted baseline with the snapshot
 * re-parsed so callers get back an object, not a string.
 */
export async function captureBaseline(
  organizationId: string,
  projectId: string,
  snapshot: unknown,
  options: CaptureBaselineOptions = {}
): Promise<PlanBaseline> {
  const id = uuidv4().replace(/-/g, '');
  const snapshotJson = JSON.stringify(snapshot ?? null);
  const label = options.label ?? null;
  const reason = options.reason ?? null;
  const createdBy = options.createdBy ?? null;

  await dbRun(
    `INSERT INTO plan_baselines (
       id, organization_id, project_id, label, snapshot, reason, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, organizationId, projectId, label, snapshotJson, reason, createdBy]
  );

  logger.info(
    `${LOG_PREFIX} Captured baseline ${id} for project ${projectId} (org ${organizationId})`
  );

  return {
    id,
    organizationId,
    projectId,
    label,
    snapshot: snapshot ?? null,
    reason,
    createdBy,
    createdAt: null,
  };
}

/** List all baselines for an org+project, newest first. Org-scoped. */
export async function listBaselines(
  organizationId: string,
  projectId: string
): Promise<PlanBaseline[]> {
  const rows = await dbAll<PlanBaselineRow>(
    `SELECT id, organization_id, project_id, label, snapshot, reason, created_by, created_at
       FROM plan_baselines
      WHERE organization_id = ? AND project_id = ?
      ORDER BY created_at DESC, id DESC`,
    [organizationId, projectId]
  );
  return rows.map(mapRow);
}

/** Most recent baseline for an org+project (the active baseline), or null. Org-scoped. */
export async function getLatestBaseline(
  organizationId: string,
  projectId: string
): Promise<PlanBaseline | null> {
  const row = await dbGet<PlanBaselineRow>(
    `SELECT id, organization_id, project_id, label, snapshot, reason, created_by, created_at
       FROM plan_baselines
      WHERE organization_id = ? AND project_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [organizationId, projectId]
  );
  return row ? mapRow(row) : null;
}

/**
 * Pure schedule-slip computation: how many days the actual window slipped past
 * the baseline window. Positive = late (actual after baseline); negative = early.
 *
 * No DB access — exported for use by callers that already hold both windows.
 */
export function computeSlip(baseline: DateWindow, actual: DateWindow): ScheduleSlip {
  const diffDays = (laterIso: string, baseIso: string): number => {
    const later = Date.parse(laterIso);
    const base = Date.parse(baseIso);
    if (Number.isNaN(later) || Number.isNaN(base)) return 0;
    return Math.round((later - base) / MS_PER_DAY);
  };
  return {
    startSlipDays: diffDays(actual.start, baseline.start),
    endSlipDays: diffDays(actual.end, baseline.end),
  };
}
