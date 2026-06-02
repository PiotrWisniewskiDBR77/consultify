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

async function fireAdvanceHooks(run: FinanceLaneRun, actor: string, outcome: string) {
  const hooks = await import('./financeIntegrationHooks.js');

  // ART-4: register lane run as artifact on every advance
  await hooks.registerLaneRunArtifact({
    runId: run.runId,
    organizationId: run.organizationId,
    actor,
    step: run.currentStep,
  });

  // WF-2: upsert inbox item
  await hooks.upsertFinanceInboxItems({
    runId: run.runId,
    organizationId: run.organizationId,
    actor,
    degradedCount: run.degraded.length,
    currentStep: run.currentStep,
  });

  // WF-4: push new degraded states to radar
  if (run.degraded.length > 0) {
    await hooks.pushDegradedToRadar({
      runId: run.runId,
      organizationId: run.organizationId,
      degradedReasons: run.degraded.map((d) => d.reason),
    });
  }

  // Readback confirmed: CTX-2, WF-1, ART-3
  if (run.readbackConfirmed && outcome === 'confirmed') {
    await hooks.captureFinanceContextSnapshot({
      runId: run.runId,
      organizationId: run.organizationId,
      actor,
    });
    await hooks.emitFinanceCycleSignal({
      runId: run.runId,
      organizationId: run.organizationId,
      actor,
    });
    await hooks.sendFinanceNotification({
      organizationId: run.organizationId,
      actor,
      event: 'lane_completed',
      detail: `Finance lane run ${run.runId} completed successfully.`,
    });
  }

  // Reconciliation mismatch: ART-3
  if (run.degraded.some((d) => d.reason === 'reconciliation_mismatch')) {
    await hooks.sendFinanceNotification({
      organizationId: run.organizationId,
      actor,
      event: 'reconciliation_mismatch',
      detail: `Reconciliation mismatch detected in lane run ${run.runId}.`,
    });
  }
}

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
  auditTrail: Array<{
    at: string;
    step: FinanceLaneStep;
    actor: string;
    outcome: string;
    detail?: string;
  }>;
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

  // Atomic INSERT … WHERE NOT EXISTS to prevent TOCTOU race on concurrent starts
  const insertResult = await dbRun(
    `INSERT INTO v8_finance_lane_runs (
      run_id, organization_id, current_step, import_outcome,
      analysis_completed, mutation_outcome, readback_confirmed,
      degraded_json, audit_trail_json, version_type, kpi_linkage_status,
      created_at, updated_at
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM v8_finance_lane_runs
      WHERE organization_id = ?
        AND (current_step != 'readback' OR readback_confirmed = 0)
    )`,
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
      params.organizationId,
    ]
  );

  if (insertResult?.changes === 0) {
    const activeRun = await dbGet<Record<string, unknown>>(
      `SELECT run_id FROM v8_finance_lane_runs
       WHERE organization_id = ?
         AND (current_step != 'readback' OR readback_confirmed = 0)
       ORDER BY created_at DESC LIMIT 1`,
      [params.organizationId],
      { fallback: true }
    );
    throw Object.assign(
      new Error(`Active lane run already exists: ${activeRun?.run_id ?? 'unknown'}`),
      { code: 'P05_CONCURRENT_RUN_EXISTS', activeRunId: String(activeRun?.run_id ?? '') }
    );
  }

  logger.info(`${LOG_PREFIX} Started lane run ${runId}`);
  return run;
}

export interface AdvanceLaneContext {
  hasPermission?: boolean;
  blockedCapability?: string;
  modelUpdatedAt?: string | null;
}

export async function advanceLaneStep(
  runId: string,
  organizationId: string,
  actor: string,
  outcome: string,
  detail?: string,
  context?: AdvanceLaneContext
): Promise<FinanceLaneRun> {
  const run = await getLaneRun(runId, organizationId);
  if (!run) throw Object.assign(new Error('Lane run not found'), { code: 'P05_RUN_NOT_FOUND' });

  if (context?.hasPermission === false) {
    run.degraded.push({
      reason: 'permission_denied',
      detail: `Permission denied: ${context.blockedCapability || 'unknown capability'}`,
      nextAction: 'Request appropriate role or wait for review window to unlock',
    });
    run.updatedAt = new Date().toISOString();
    await dbRun(
      `UPDATE v8_finance_lane_runs SET degraded_json = ?, updated_at = ? WHERE run_id = ? AND organization_id = ?`,
      [JSON.stringify(run.degraded), run.updatedAt, runId, organizationId]
    );
    throw Object.assign(new Error('Permission denied'), { code: 'P05_PERMISSION_DENIED' });
  }

  if (context?.modelUpdatedAt) {
    const staleDays = 30;
    const modelAge =
      (Date.now() - new Date(context.modelUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (modelAge > staleDays) {
      run.degraded.push({
        reason: 'stale_model',
        detail: `Finance model last updated ${Math.round(modelAge)} days ago — exceeds ${staleDays}-day threshold`,
        nextAction: 'Refresh model data before proceeding',
      });
    }
  }

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
      new Error(
        `Invalid outcome '${outcome}' for step '${run.currentStep}'. Valid: ${allowed.join(', ')}`
      ),
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
      const auditParams = {
        organizationId,
        runId,
        mutationType: 'lane_step_mutation',
        targetEntity: 'finance_model',
        previousValue: undefined,
        newValue: outcome,
        outcome: outcome as MutationOutcome,
        actor,
      };
      try {
        await recordMutationAudit(auditParams);
      } catch (firstErr) {
        logger.warn(`${LOG_PREFIX} Auto-audit attempt 1 failed, retrying in 200ms`, firstErr);
        try {
          await new Promise((r) => setTimeout(r, 200));
          await recordMutationAudit(auditParams);
        } catch (retryErr) {
          logger.warn(`${LOG_PREFIX} Auto-audit retry also failed — recording degraded`, retryErr);
          run.degraded.push({
            reason: 'mutation_failed' as FinanceDegradedReason,
            detail: `Mutation audit persistence failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
            nextAction: 'Audit record could not be saved — review mutation logs manually',
          });
        }
      }
    }
  } else if (run.currentStep === 'readback') {
    run.readbackConfirmed = outcome === 'confirmed';
    if (outcome === 'confirmed') {
      const audits = await getMutationAudits(organizationId, runId);
      const lastApplied = audits.filter((a) => a.outcome === 'applied').at(-1);
      if (lastApplied) {
        run.auditTrail.push({
          at: now,
          step: 'readback',
          actor,
          outcome: 'readback_verified',
          detail: `Verified mutation ${lastApplied.auditId}: ${lastApplied.mutationType} → ${lastApplied.newValue}`,
        });
      }
    }
  }

  // §2.3.2: enforce KPI coherence before confirming readback
  if (run.currentStep === 'readback' && outcome === 'confirmed') {
    const coherence = await checkKpiLinkageCoherence(organizationId, runId);

    if (coherence.reconciliationMismatches && coherence.reconciliationMismatches.length > 0) {
      const alreadyHas = run.degraded.some((d) => d.reason === 'reconciliation_mismatch');
      if (!alreadyHas) {
        run.degraded.push({
          reason: 'reconciliation_mismatch',
          detail: `${coherence.reconciliationMismatches.length} reconciliation mismatch(es) detected — review required`,
          nextAction: 'Review mismatch categories, add notes, and acknowledge or escalate',
        });
      }
    }

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

  // Fire integration hooks (non-blocking)
  void fireAdvanceHooks(run, actor, outcome).catch((err) =>
    logger.warn(`${LOG_PREFIX} Integration hooks failed (non-blocking)`, err)
  );

  return run;
}

export async function getLaneRun(
  runId: string,
  organizationId: string
): Promise<FinanceLaneRun | null> {
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

export async function getMutationAudits(
  organizationId: string,
  runId?: string
): Promise<FinanceMutationAudit[]> {
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
  const pre = await dbGet<Record<string, unknown>>(
    `SELECT * FROM v8_finance_version_snapshots WHERE snapshot_id = ? AND organization_id = ?`,
    [snapshotId, organizationId],
    { fallback: true }
  );
  if (!pre)
    throw Object.assign(new Error('Snapshot not found'), { code: 'P05_SNAPSHOT_NOT_FOUND' });

  const pushSwitchoverDegraded = async (detail: string) => {
    try {
      const activeRun = await dbGet<Record<string, unknown>>(
        `SELECT run_id, degraded_json FROM v8_finance_lane_runs
         WHERE organization_id = ? AND (current_step != 'readback' OR readback_confirmed = 0)
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId],
        { fallback: true }
      );
      if (activeRun) {
        const degraded = safeJsonParse(
          activeRun.degraded_json as string | null | undefined,
          []
        ) as Array<Record<string, unknown>>;
        degraded.push({
          reason: 'switchover_misconfigured',
          detail,
          nextAction: 'Fix switchover configuration before retrying finalization',
        });
        await dbRun(
          `UPDATE v8_finance_lane_runs SET degraded_json = ? WHERE run_id = ? AND organization_id = ?`,
          [JSON.stringify(degraded), String(activeRun.run_id), organizationId]
        );
      }
    } catch (e) {
      logger.warn(`${LOG_PREFIX} Failed to record switchover_misconfigured degraded entry`, e);
    }
  };

  if (pre.is_finalized) {
    await pushSwitchoverDegraded('Snapshot already finalized');
    throw Object.assign(new Error('Switchover misconfigured: snapshot already finalized'), {
      code: 'P05_SWITCHOVER_MISCONFIGURED',
      degradedReason: 'switchover_misconfigured' as const,
    });
  }
  if (pre.version_type !== 'actual') {
    await pushSwitchoverDegraded('Only "actual" snapshots can be finalized');
    throw Object.assign(
      new Error('Switchover misconfigured: only "actual" snapshots can be finalized'),
      { code: 'P05_SWITCHOVER_MISCONFIGURED', degradedReason: 'switchover_misconfigured' as const }
    );
  }

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
  if (!row)
    throw Object.assign(new Error('Snapshot not found after update'), {
      code: 'P05_SNAPSHOT_NOT_FOUND',
    });

  const result: FinanceVersionSnapshot = {
    snapshotId: String(row.snapshot_id),
    organizationId: String(row.organization_id),
    versionType: row.version_type as VersionType,
    snapshotData: safeJsonParse(row.snapshot_data as string | null | undefined, {}),
    switchoverDate: row.switchover_date != null ? String(row.switchover_date) : null,
    switchoverActor: row.switchover_actor != null ? String(row.switchover_actor) : null,
    isFinalized: !!row.is_finalized,
    createdAt: String(row.created_at),
  };

  // WF-3 + ART-3: Fire switchover hooks (non-blocking)
  void (async () => {
    try {
      const hooks = await import('./financeIntegrationHooks.js');
      await hooks.recordSwitchoverDecision({
        snapshotId,
        organizationId,
        actor,
        versionType: result.versionType,
      });
      await hooks.captureFinanceContextSnapshot({
        runId: snapshotId,
        organizationId,
        actor,
        snapshotId,
      });
      await hooks.sendFinanceNotification({
        organizationId,
        actor,
        event: 'switchover_finalized',
        detail: `Version snapshot ${snapshotId} finalized as ${result.versionType}.`,
      });
    } catch (err) {
      logger.warn(`${LOG_PREFIX} Switchover hooks failed (non-blocking)`, err);
    }
  })();

  return result;
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
    snapshotData: safeJsonParse(r.snapshot_data as string | null | undefined, {}),
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
): Promise<{
  status: 'coherent' | 'stale' | 'unavailable';
  detail: string;
  reconciliationMismatches?: Array<{ reconciliationId: string; mismatchCategory: string }>;
}> {
  try {
    const linkages = await dbAll<Record<string, unknown>>(
      `SELECT * FROM v8_kpi_finance_reconciliations WHERE organization_id = ? AND reconciliation_status != 'reconciled' LIMIT 20`,
      [organizationId],
      { fallback: true }
    );

    if (!linkages || linkages.length === 0) {
      return { status: 'coherent', detail: 'No unresolved KPI↔Finance discrepancies' };
    }

    const mismatches = linkages
      .filter((l) => {
        const status = String(l.reconciliation_status || '');
        return ['disputed', 'escalated', 'requires_review'].includes(status);
      })
      .map((l) => ({
        reconciliationId: String(l.id || l.reconciliation_id),
        mismatchCategory: String(l.mismatch_category || l.reconciliation_status || 'unknown'),
      }));

    // NOTE: reconciliation_mismatch degraded entries are returned via
    // the result object — the *caller* (advanceLaneStep) is responsible
    // for pushing to run.degraded and persisting, avoiding the overwrite
    // race where a separate DB write here gets clobbered by the caller's
    // final UPDATE.

    const staleLinkages = linkages.filter((l) => {
      const updated = Date.parse(String(l.updated_at));
      return !Number.isNaN(updated) && Date.now() - updated > 7 * 24 * 3600 * 1000;
    });

    if (staleLinkages.length > 0) {
      // kpi_linkage_status update is handled by the caller (advanceLaneStep)
      // to avoid overwrite race with the final UPDATE
      return {
        status: 'stale',
        detail: `${staleLinkages.length} stale reconciliation(s) — refresh required`,
        reconciliationMismatches: mismatches.length > 0 ? mismatches : undefined,
      };
    }

    return {
      status: 'coherent',
      detail: `${linkages.length} active reconciliation(s) in progress`,
      reconciliationMismatches: mismatches.length > 0 ? mismatches : undefined,
    };
  } catch {
    return { status: 'unavailable', detail: 'KPI linkage data unavailable' };
  }
}

// ==========================================
// HELPERS
// ==========================================

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'string') {
    if (!raw.trim()) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  // Postgres drivers can return json/jsonb columns as already-parsed objects.
  if (typeof raw === 'object') {
    return raw as T;
  }

  return fallback;
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
