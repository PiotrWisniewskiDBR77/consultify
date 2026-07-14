/**
 * Rollout Stages Service — M14/F5 (5.1)
 *
 * Wave-based rollout planning layer for an execution / implementation program.
 * A rollout is a sequence of stages (waves) that move an initiative from a
 * controlled pilot out to full adoption and eventual closure:
 *
 *   pilot → limited → full → hypercare → closure
 *
 * Each stage has its own lifecycle:
 *
 *   not_started → active → gated → done
 *
 * Backed by the `rollout_stages` table (migration 20260623_rollout_stages.sql).
 * Every query is org-scoped (organization_id is always a WHERE / INSERT column).
 *
 * node-pg note: rows come back snake_case. We read snake_case columns directly
 * and tolerate driver casing via `row[k] ?? row[k.toLowerCase()]`.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type WaveType = 'pilot' | 'limited' | 'full' | 'hypercare' | 'closure';
export type StageStatus = 'not_started' | 'active' | 'gated' | 'done';

export interface RolloutStage {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  waveType: WaveType;
  sequence: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  baselineStart: string | null;
  baselineEnd: string | null;
  status: StageStatus;
  entryCriteria: string | null;
  exitCriteria: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStageInput {
  projectId?: string | null;
  name: string;
  waveType: WaveType;
  sequence?: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  status?: StageStatus;
  entryCriteria?: string | null;
  exitCriteria?: string | null;
}

export type UpdateStagePatch = Partial<
  Omit<CreateStageInput, 'projectId'> & { projectId: string | null }
>;

// ==========================================
// CONSTANTS / ORDERINGS
// ==========================================

export const WAVE_ORDER: WaveType[] = ['pilot', 'limited', 'full', 'hypercare', 'closure'];

export const STATUS_ORDER: StageStatus[] = ['not_started', 'active', 'gated', 'done'];

/**
 * Returns the next wave in the canonical rollout taxonomy, or null if the
 * current wave is the last one (closure) or unrecognized.
 */
export function nextWave(currentWaveType: WaveType): WaveType | null {
  const idx = WAVE_ORDER.indexOf(currentWaveType);
  if (idx < 0 || idx >= WAVE_ORDER.length - 1) return null;
  return WAVE_ORDER[idx + 1];
}

/**
 * Returns the next stage status, or null if already at the terminal status
 * (done) or the status is unrecognized.
 */
export function nextStatus(currentStatus: StageStatus): StageStatus | null {
  const idx = STATUS_ORDER.indexOf(currentStatus);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

// ==========================================
// ROW MAPPING (node-pg snake_case safe)
// ==========================================

function pick(row: Record<string, any>, key: string): any {
  return row[key] ?? row[key.toLowerCase()];
}

function mapRow(row: Record<string, any>): RolloutStage {
  return {
    id: pick(row, 'id'),
    organizationId: pick(row, 'organization_id'),
    projectId: pick(row, 'project_id') ?? null,
    name: pick(row, 'name'),
    waveType: pick(row, 'wave_type') as WaveType,
    sequence: Number(pick(row, 'sequence') ?? 0),
    plannedStart: pick(row, 'planned_start') ?? null,
    plannedEnd: pick(row, 'planned_end') ?? null,
    baselineStart: pick(row, 'baseline_start') ?? null,
    baselineEnd: pick(row, 'baseline_end') ?? null,
    status: (pick(row, 'status') ?? 'not_started') as StageStatus,
    entryCriteria: pick(row, 'entry_criteria') ?? null,
    exitCriteria: pick(row, 'exit_criteria') ?? null,
    createdAt: pick(row, 'created_at'),
    updatedAt: pick(row, 'updated_at'),
  };
}

// ==========================================
// QUERIES
// ==========================================

/**
 * List rollout stages for an org, optionally filtered by project, ordered by
 * sequence then created_at. Org-scoped.
 */
export async function listStages(
  organizationId: string,
  projectId?: string | null
): Promise<RolloutStage[]> {
  if (!organizationId) return [];

  const params: unknown[] = [organizationId];
  let sql =
    'SELECT id, organization_id, project_id, name, wave_type, sequence, ' +
    'planned_start, planned_end, baseline_start, baseline_end, status, ' +
    'entry_criteria, exit_criteria, created_at, updated_at ' +
    'FROM rollout_stages WHERE organization_id = ?';

  if (projectId !== undefined && projectId !== null) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }
  sql += ' ORDER BY sequence ASC, created_at ASC';

  const rows = await dbAll<Record<string, any>>(sql, params);
  return (rows || []).map(mapRow);
}

/**
 * Fetch a single stage by id, org-scoped.
 */
export async function getStage(organizationId: string, id: string): Promise<RolloutStage | null> {
  if (!organizationId || !id) return null;
  const row = await dbGet<Record<string, any>>(
    'SELECT id, organization_id, project_id, name, wave_type, sequence, ' +
      'planned_start, planned_end, baseline_start, baseline_end, status, ' +
      'entry_criteria, exit_criteria, created_at, updated_at ' +
      'FROM rollout_stages WHERE organization_id = ? AND id = ?',
    [organizationId, id]
  );
  return row ? mapRow(row) : null;
}

/**
 * Create a rollout stage. Org-scoped: organization_id is bound from the
 * caller, never from the input payload.
 */
export async function createStage(
  organizationId: string,
  data: CreateStageInput
): Promise<RolloutStage> {
  if (!organizationId) {
    throw new Error('createStage: organizationId is required');
  }
  if (!data || !data.name) {
    throw new Error('createStage: name is required');
  }
  if (!WAVE_ORDER.includes(data.waveType)) {
    throw new Error(`createStage: invalid waveType "${data.waveType}"`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const status: StageStatus = data.status ?? 'not_started';

  const result = await dbRun(
    'INSERT INTO rollout_stages (' +
      'id, organization_id, project_id, name, wave_type, sequence, ' +
      'planned_start, planned_end, baseline_start, baseline_end, status, ' +
      'entry_criteria, exit_criteria, created_at, updated_at' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      organizationId,
      data.projectId ?? null,
      data.name,
      data.waveType,
      data.sequence ?? 0,
      data.plannedStart ?? null,
      data.plannedEnd ?? null,
      data.baselineStart ?? null,
      data.baselineEnd ?? null,
      status,
      data.entryCriteria ?? null,
      data.exitCriteria ?? null,
      now,
      now,
    ]
  );

  if (!result.success) {
    throw new Error(`createStage: insert failed — ${result.error ?? 'unknown error'}`);
  }

  return {
    id,
    organizationId,
    projectId: data.projectId ?? null,
    name: data.name,
    waveType: data.waveType,
    sequence: data.sequence ?? 0,
    plannedStart: data.plannedStart ?? null,
    plannedEnd: data.plannedEnd ?? null,
    baselineStart: data.baselineStart ?? null,
    baselineEnd: data.baselineEnd ?? null,
    status,
    entryCriteria: data.entryCriteria ?? null,
    exitCriteria: data.exitCriteria ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

const PATCH_COLUMN_MAP: Record<keyof UpdateStagePatch, string> = {
  projectId: 'project_id',
  name: 'name',
  waveType: 'wave_type',
  sequence: 'sequence',
  plannedStart: 'planned_start',
  plannedEnd: 'planned_end',
  baselineStart: 'baseline_start',
  baselineEnd: 'baseline_end',
  status: 'status',
  entryCriteria: 'entry_criteria',
  exitCriteria: 'exit_criteria',
};

/**
 * Patch a stage's mutable fields. Org-scoped (WHERE organization_id = ?).
 * Only the provided keys are updated.
 */
export async function updateStage(
  organizationId: string,
  id: string,
  patch: UpdateStagePatch
): Promise<RolloutStage | null> {
  if (!organizationId || !id) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of Object.keys(patch) as (keyof UpdateStagePatch)[]) {
    const column = PATCH_COLUMN_MAP[key];
    if (!column) continue;
    if (key === 'waveType' && !WAVE_ORDER.includes(patch.waveType as WaveType)) {
      throw new Error(`updateStage: invalid waveType "${patch.waveType}"`);
    }
    sets.push(`${column} = ?`);
    params.push((patch as Record<string, any>)[key] ?? null);
  }

  if (sets.length === 0) {
    return getStage(organizationId, id);
  }

  const now = new Date().toISOString();
  sets.push('updated_at = ?');
  params.push(now);

  // WHERE binds (org-scope) come last.
  params.push(organizationId, id);

  const result = await dbRun(
    `UPDATE rollout_stages SET ${sets.join(', ')} WHERE organization_id = ? AND id = ?`,
    params
  );

  if (!result.success) {
    throw new Error(`updateStage: update failed — ${result.error ?? 'unknown error'}`);
  }

  return getStage(organizationId, id);
}

/**
 * Advance a stage along its status lifecycle:
 *   not_started → active → gated → done
 * No-op (returns the current stage) if already done. Org-scoped.
 */
export async function advanceStage(
  organizationId: string,
  id: string
): Promise<RolloutStage | null> {
  const current = await getStage(organizationId, id);
  if (!current) return null;

  const next = nextStatus(current.status);
  if (!next) {
    // Already terminal — nothing to advance.
    return current;
  }

  logger.info('[rolloutStages] advanceStage', {
    organizationId,
    id,
    from: current.status,
    to: next,
  });

  return updateStage(organizationId, id, { status: next });
}
