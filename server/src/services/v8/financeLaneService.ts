/**
 * P05-B: Finance Lane Service — bounded E2E closure
 *
 * Wraps existing finance services into a governed lane:
 * import → analysis → mutation → readback
 *
 * Ensures: no split-truth with KPI, honest error taxonomy, mutation audit.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[V8:FinanceLane]';

// ==========================================
// TYPES
// ==========================================

export const FinanceLaneStepValues = ['import', 'analysis', 'mutation', 'readback'] as const;
export type FinanceLaneStep = (typeof FinanceLaneStepValues)[number];

export const ImportOutcomeValues = [
  'completed',
  'completed_with_warnings',
  'failed',
  'queued',
  'running',
  'cancelled',
  'mapping_missing',
  'schema_drift',
] as const;
export type ImportOutcome = (typeof ImportOutcomeValues)[number];

export const MutationOutcomeValues = ['applied', 'failed', 'conflict', 'rolled_back'] as const;
export type MutationOutcome = (typeof MutationOutcomeValues)[number];

export const VersionTypeValues = ['current', 'actual'] as const;
export type VersionType = (typeof VersionTypeValues)[number];

export const FinanceDegradedReasonValues = [
  'import_mapping_missing',
  'import_completed_with_warnings',
  'import_failed',
  'schema_drift',
  'stale_model',
  'stale_linkage',
  'mutation_conflict',
  'mutation_failed',
  'permission_denied',
  'switchover_misconfigured',
  'reconciliation_mismatch',
] as const;
export type FinanceDegradedReason = (typeof FinanceDegradedReasonValues)[number];

export interface FinanceLaneRun {
  runId: string;
  organizationId: string;
  currentStep: FinanceLaneStep;
  importOutcome: ImportOutcome | null;
  analysisCompleted: boolean;
  mutationOutcome: MutationOutcome | null;
  readbackConfirmed: boolean;
  degraded: Array<{ reason: FinanceDegradedReason; detail: string; nextAction: string }>;
  auditTrail: Array<{ at: string; step: FinanceLaneStep; actor: string; outcome: string; detail?: string }>;
  versionType: VersionType;
  kpiLinkageStatus: 'coherent' | 'stale' | 'unavailable';
  createdAt: string;
  updatedAt: string;
}

export interface FinanceMutationAudit {
  auditId: string;
  organizationId: string;
  runId: string;
  mutationType: string;
  targetEntity: string;
  previousValue: string | null;
  newValue: string;
  outcome: MutationOutcome;
  actor: string;
  createdAt: string;
}

export interface FinanceVersionSnapshot {
  snapshotId: string;
  organizationId: string;
  versionType: VersionType;
  snapshotData: Record<string, unknown>;
  switchoverDate: string | null;
  switchoverActor: string | null;
  isFinalized: boolean;
  createdAt: string;
}

// ==========================================
// LANE ORCHESTRATION
// ==========================================

export async function startLaneRun(params: {
  organizationId: string;
  actor: string;
  versionType?: VersionType;
}): Promise<FinanceLaneRun> {
  const runId = uuidv4();
  const now = new Date().toISOString();
  const run: FinanceLaneRun = {
    runId,
    organizationId: params.organizationId,
    currentStep: 'import',
    importOutcome: null,
    analysisCompleted: false,
    mutationOutcome: null,
    readbackConfirmed: false,
    degraded: [],
    auditTrail: [{ at: now, step: 'import', actor: params.actor, outcome: 'started' }],
    versionType: params.versionType || 'current',
    kpiLinkageStatus: 'coherent',
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_finance_lane_runs (
      run_id, organization_id, current_step, import_outcome,
      analysis_completed, mutation_outcome, readback_confirmed,
      degraded_json, audit_trail_json, version_type, kpi_linkage_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId,
      run.organizationId,
      run.currentStep,
      run.importOutcome,
      run.analysisCompleted ? 1 : 0,
      run.mutationOutcome,
      run.readbackConfirmed ? 1 : 0,
      JSON.stringify(run.degraded),
      JSON.stringify(run.auditTrail),
      run.versionType,
      run.kpiLinkageStatus,
      run.createdAt,
      run.updatedAt,
    ]
  );

  logger.info(`${LOG_PREFIX} Started lane run ${runId}`);
  return run;
}

export async function advanceLaneStep(
  runId: string,
  organizationId: string,
  actor: string,
  outcome: string,
  detail?: string
): Promise<FinanceLaneRun> {
  const run = await getLaneRun(runId, organizationId);
  if (!run) throw Object.assign(new Error('Lane run not found'), { code: 'P05_RUN_NOT_FOUND' });

  const validOutcomes: Record<FinanceLaneStep, string[]> = {
    import: [
      'completed',
      'completed_with_warnings',
      'failed',
      'queued',
      'running',
      'cancelled',
      'mapping_missing',
      'schema_drift',
    ],
    analysis: ['completed', 'failed'],
    mutation: ['applied', 'failed', 'conflict', 'rolled_back'],
    readback: ['confirmed', 'failed'],
  };

  const allowed = validOutcomes[run.currentStep];
  if (allowed && !allowed.includes(outcome)) {
    throw Object.assign(
      new Error(`Invalid outcome '${outcome}' for step '${run.currentStep}'. Valid: ${allowed.join(', ')}`),
      { code: 'P05_INVALID_OUTCOME' }
    );
  }

  const now = new Date().toISOString();
  const stepOrder: FinanceLaneStep[] = ['import', 'analysis', 'mutation', 'readback'];
  const currentIdx = stepOrder.indexOf(run.currentStep);

  run.auditTrail.push({ at: now, step: run.currentStep, actor, outcome, detail });

  if (run.currentStep === 'import') {
    run.importOutcome = outcome as ImportOutcome;
    if (outcome === 'failed') {
      run.degraded.push({
        reason: 'import_failed',
        detail: detail || 'Import failed — downstream mutation blocked',
        nextAction: 'Fix source data and retry import',
      });
    } else if (outcome === 'completed_with_warnings') {
      run.degraded.push({
        reason: 'import_completed_with_warnings',
        detail: detail || 'Import completed with warnings — review impacted rows',
        nextAction: 'Review warning details and fix affected mappings',
      });
    } else if (outcome === 'mapping_missing') {
      run.importOutcome = 'failed' as ImportOutcome;
      run.degraded.push({
        reason: 'import_mapping_missing',
        detail: detail || 'Import mapping missing or invalid — import blocked',
        nextAction: 'Configure required mapping fields and retry',
      });
    } else if (outcome === 'schema_drift') {
      run.importOutcome = 'failed' as ImportOutcome;
      run.degraded.push({
        reason: 'schema_drift',
        detail: detail || 'Source dataset schema has drifted — mapping update required',
        nextAction: 'Review schema changes and update mapping configuration',
      });
    }
  } else if (run.currentStep === 'analysis') {
    run.analysisCompleted = outcome === 'completed';
  } else if (run.currentStep === 'mutation') {
    run.mutationOutcome = outcome as MutationOutcome;
    if (outcome === 'conflict') {
      run.degraded.push({
        reason: 'mutation_conflict',
        detail: detail || 'Concurrent mutation conflict',
        nextAction: 'Retry on latest model state',
      });
    } else if (outcome === 'failed') {
      run.degraded.push({
        reason: 'mutation_failed',
        detail: detail || 'Mutation failed — safe degraded state preserved',
        nextAction: 'Review failure cause and retry',
      });
    }
    if (outcome === 'failed' || outcome === 'conflict') {
      // §2.3.4: auto-create audit event on mutation failure
      await recordMutationAudit({
        organizationId,
        runId,
        mutationType: 'lane_step_mutation',
        targetEntity: 'finance_model',
        previousValue: undefined,
        newValue: outcome,
        outcome: outcome as MutationOutcome,
        actor,
      }).catch((e) => logger.warn(`${LOG_PREFIX} Auto-audit on mutation failure failed`, e));
    }
  } else if (run.currentStep === 'readback') {
    run.readbackConfirmed = outcome === 'confirmed';
  }

  // §2.3.2: enforce KPI coherence before confirming readback
  if (run.currentStep === 'readback' && outcome === 'confirmed') {
    const coherence = await checkKpiLinkageCoherence(organizationId, runId);
    if (coherence.status === 'stale') {
      run.degraded.push({
        reason: 'stale_linkage',
        detail: coherence.detail,
        nextAction: 'Refresh KPI linkage before confirming readback',
      });
      run.kpiLinkageStatus = 'stale';
      run.readbackConfirmed = false;
    } else if (coherence.status === 'unavailable') {
      run.degraded.push({
        reason: 'stale_linkage',
        detail: coherence.detail,
        nextAction: 'KPI linkage data unavailable — proceed with caution',
      });
      run.kpiLinkageStatus = 'unavailable';
    } else {
      run.kpiLinkageStatus = 'coherent';
    }
  }

  if (
    outcome !== 'failed' &&
    outcome !== 'conflict' &&
    outcome !== 'mapping_missing' &&
    outcome !== 'schema_drift' &&
    currentIdx < stepOrder.length - 1
  ) {
    run.currentStep = stepOrder[currentIdx + 1];
  }

  run.updatedAt = now;

  await dbRun(
    `UPDATE v8_finance_lane_runs SET
      current_step = ?, import_outcome = ?, analysis_completed = ?,
      mutation_outcome = ?, readback_confirmed = ?, degraded_json = ?,
      audit_trail_json = ?, kpi_linkage_status = ?, updated_at = ?
     WHERE run_id = ? AND organization_id = ?`,
    [
      run.currentStep,
      run.importOutcome,
      run.analysisCompleted ? 1 : 0,
      run.mutationOutcome,
      run.readbackConfirmed ? 1 : 0,
      JSON.stringify(run.degraded),
      JSON.stringify(run.auditTrail),
      run.kpiLinkageStatus,
      run.updatedAt,
      runId,
      organizationId,
    ]
  );

  logger.info(`${LOG_PREFIX} Advanced run ${runId} to ${run.currentStep} (outcome=${outcome})`);
  return run;
}

export async function getLaneRun(runId: string, organizationId: string): Promise<FinanceLaneRun | null> {
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM v8_finance_lane_runs WHERE run_id = ? AND organization_id = ?`,
    [runId, organizationId],
    { fallback: true }
  );
  if (!row) return null;
  return rowToLaneRun(row);
}

export async function getLaneRuns(organizationId: string, limit = 20): Promise<FinanceLaneRun[]> {
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM v8_finance_lane_runs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
    [organizationId, limit],
    { fallback: true }
  );
  return (rows || []).map(rowToLaneRun);
}

// ==========================================
// MUTATION AUDIT
// ==========================================

export async function recordMutationAudit(params: {
  organizationId: string;
  runId: string;
  mutationType: string;
  targetEntity: string;
  previousValue?: string;
  newValue: string;
  outcome: MutationOutcome;
  actor: string;
}): Promise<FinanceMutationAudit> {
  const auditId = uuidv4();
  const now = new Date().toISOString();
  const audit: FinanceMutationAudit = {
    auditId,
    organizationId: params.organizationId,
    runId: params.runId,
    mutationType: params.mutationType,
    targetEntity: params.targetEntity,
    previousValue: params.previousValue || null,
    newValue: params.newValue,
    outcome: params.outcome,
    actor: params.actor,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_finance_mutation_audit (
      audit_id, organization_id, run_id, mutation_type, target_entity,
      previous_value, new_value, outcome, actor, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      audit.auditId,
      audit.organizationId,
      audit.runId,
      audit.mutationType,
      audit.targetEntity,
      audit.previousValue,
      audit.newValue,
      audit.outcome,
      audit.actor,
      audit.createdAt,
    ]
  );

  logger.info(`${LOG_PREFIX} Recorded mutation audit ${auditId} for run ${params.runId}`);
  return audit;
}

export async function getMutationAudits(organizationId: string, runId?: string): Promise<FinanceMutationAudit[]> {
  let sql = `SELECT * FROM v8_finance_mutation_audit WHERE organization_id = ?`;
  const bind: unknown[] = [organizationId];
  if (runId) {
    sql += ` AND run_id = ?`;
    bind.push(runId);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<Record<string, unknown>>(sql, bind, { fallback: true });
  return (rows || []).map((r) => ({
    auditId: String(r.audit_id),
    organizationId: String(r.organization_id),
    runId: String(r.run_id),
    mutationType: String(r.mutation_type),
    targetEntity: String(r.target_entity),
    previousValue: r.previous_value != null ? String(r.previous_value) : null,
    newValue: String(r.new_value),
    outcome: r.outcome as MutationOutcome,
    actor: String(r.actor),
    createdAt: String(r.created_at),
  }));
}

// ==========================================
// VERSIONING
// ==========================================

export async function createVersionSnapshot(params: {
  organizationId: string;
  versionType: VersionType;
  snapshotData: Record<string, unknown>;
  actor: string;
}): Promise<FinanceVersionSnapshot> {
  const snapshotId = uuidv4();
  const now = new Date().toISOString();
  const snapshot: FinanceVersionSnapshot = {
    snapshotId,
    organizationId: params.organizationId,
    versionType: params.versionType,
    snapshotData: params.snapshotData,
    switchoverDate: null,
    switchoverActor: null,
    isFinalized: false,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_finance_version_snapshots (
      snapshot_id, organization_id, version_type, snapshot_data,
      switchover_date, switchover_actor, is_finalized, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.snapshotId,
      snapshot.organizationId,
      snapshot.versionType,
      JSON.stringify(snapshot.snapshotData),
      snapshot.switchoverDate,
      snapshot.switchoverActor,
      snapshot.isFinalized ? 1 : 0,
      snapshot.createdAt,
    ]
  );

  logger.info(`${LOG_PREFIX} Created version snapshot ${snapshotId} type=${params.versionType}`);
  return snapshot;
}

export async function finalizeSwitchover(
  snapshotId: string,
  organizationId: string,
  actor: string
): Promise<FinanceVersionSnapshot> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_finance_version_snapshots SET
      is_finalized = 1, switchover_date = ?, switchover_actor = ?
     WHERE snapshot_id = ? AND organization_id = ? AND is_finalized = 0`,
    [now, actor, snapshotId, organizationId]
  );

  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM v8_finance_version_snapshots WHERE snapshot_id = ? AND organization_id = ?`,
    [snapshotId, organizationId],
    { fallback: true }
  );
  if (!row) throw Object.assign(new Error('Snapshot not found'), { code: 'P05_SNAPSHOT_NOT_FOUND' });

  return {
    snapshotId: String(row.snapshot_id),
    organizationId: String(row.organization_id),
    versionType: row.version_type as VersionType,
    snapshotData: safeJsonParse(row.snapshot_data, {}),
    switchoverDate: row.switchover_date != null ? String(row.switchover_date) : null,
    switchoverActor: row.switchover_actor != null ? String(row.switchover_actor) : null,
    isFinalized: !!row.is_finalized,
    createdAt: String(row.created_at),
  };
}

export async function getVersionSnapshots(
  organizationId: string,
  versionType?: VersionType
): Promise<FinanceVersionSnapshot[]> {
  let sql = `SELECT * FROM v8_finance_version_snapshots WHERE organization_id = ?`;
  const bind: unknown[] = [organizationId];
  if (versionType) {
    sql += ` AND version_type = ?`;
    bind.push(versionType);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<Record<string, unknown>>(sql, bind, { fallback: true });
  return (rows || []).map((r) => ({
    snapshotId: String(r.snapshot_id),
    organizationId: String(r.organization_id),
    versionType: r.version_type as VersionType,
    snapshotData: safeJsonParse(r.snapshot_data, {}),
    switchoverDate: r.switchover_date != null ? String(r.switchover_date) : null,
    switchoverActor: r.switchover_actor != null ? String(r.switchover_actor) : null,
    isFinalized: !!r.is_finalized,
    createdAt: String(r.created_at),
  }));
}

// ==========================================
// KPI LINKAGE COHERENCE CHECK
// ==========================================

export async function checkKpiLinkageCoherence(
  organizationId: string,
  runId: string
): Promise<{ status: 'coherent' | 'stale' | 'unavailable'; detail: string }> {
  try {
    const linkages = await dbAll<Record<string, unknown>>(
      `SELECT * FROM v8_kpi_finance_reconciliations WHERE organization_id = ? AND reconciliation_status != 'reconciled' LIMIT 5`,
      [organizationId],
      { fallback: true }
    );

    if (!linkages || linkages.length === 0) {
      return { status: 'coherent', detail: 'No unresolved KPI↔Finance discrepancies' };
    }

    const staleLinkages = linkages.filter((l) => {
      const updated = Date.parse(String(l.updated_at));
      return !Number.isNaN(updated) && Date.now() - updated > 7 * 24 * 3600 * 1000;
    });

    if (staleLinkages.length > 0) {
      await dbRun(
        `UPDATE v8_finance_lane_runs SET kpi_linkage_status = 'stale' WHERE run_id = ? AND organization_id = ?`,
        [runId, organizationId]
      );
      return { status: 'stale', detail: `${staleLinkages.length} stale reconciliation(s) — refresh required` };
    }

    return { status: 'coherent', detail: `${linkages.length} active reconciliation(s) in progress` };
  } catch {
    return { status: 'unavailable', detail: 'KPI linkage data unavailable' };
  }
}

// ==========================================
// HELPERS
// ==========================================

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToLaneRun(row: Record<string, unknown>): FinanceLaneRun {
  return {
    runId: String(row.run_id),
    organizationId: String(row.organization_id),
    currentStep: row.current_step as FinanceLaneStep,
    importOutcome: (row.import_outcome as ImportOutcome) || null,
    analysisCompleted: !!row.analysis_completed,
    mutationOutcome: (row.mutation_outcome as MutationOutcome) || null,
    readbackConfirmed: !!row.readback_confirmed,
    degraded: safeJsonParse(row.degraded_json as string, []),
    auditTrail: safeJsonParse(row.audit_trail_json as string, []),
    versionType: (row.version_type as VersionType) || 'current',
    kpiLinkageStatus: (row.kpi_linkage_status as FinanceLaneRun['kpiLinkageStatus']) || 'coherent',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
