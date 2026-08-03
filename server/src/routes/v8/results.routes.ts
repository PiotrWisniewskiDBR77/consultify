/**
 * V8 read-only Results / KPI / ROI bridge — org-scoped dashboard snapshot from
 * `resultsROIService` runtime aggregates.
 * Namespace: /api/v8/results (mounted by v8/index).
 *
 * @module routes/v8/results.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as ReportBuilderService from '../../services/reportBuilderService.js';
import {
  type RcaSuggestInput,
  suggestActions,
  suggestRca,
} from '../../services/results/deviationRcaSuggestService.js';
import { detectAnomalies } from '../../services/results/kpiAnomalyService.js';
import {
  archiveDefinition as archiveKpiDefinition,
  createDefinition as createKpiDefinition,
  getCurrentDefinition as getCurrentKpiDefinition,
  getCurrentDefinitionVersionId,
  KpiDefinitionArchivedError,
  KpiDefinitionNotFoundError,
  KpiDefinitionVersionConflictError,
  updateDefinition as updateKpiDefinition,
} from '../../services/results/kpiDefinitionService.js';
import {
  type KpiDirection as KpiForecastDirection,
  leadingAlert,
  linearTrend,
  projectToTarget,
} from '../../services/results/kpiForecastService.js';
import {
  KpiMeasurementKpiNotFoundError,
  recordKpiMeasurement,
} from '../../services/results/kpiMeasurementWriterService.js';
import {
  buildRecoveryCardDTO,
  closeRecoveryCard,
  ensureRecoveryAction,
  ensureRecoveryCardForCase,
  ensureRecoveryCheckpoint,
  getRecoveryCardDTO,
  linkRecoveryActionTask,
  markRecoveryActionTaskLinkFailed,
  progressRecoveryCard,
  type RecoveryActionRow,
  type RecoveryCardRow,
  RecoveryCardServiceError,
  resolveRecoveryCheckpoint,
  toActionDTO,
  toCheckpointDTO,
  updateRecoveryCard,
} from '../../services/results/kpiRecoveryCardService.js';
import {
  createKpiReportSnapshot,
  getKpiReportSnapshot,
  ResultsKpiReportSnapshotError,
} from '../../services/results/kpiReportSnapshotService.js';
import {
  addKpiToScorecard,
  createScorecard,
  getScorecard,
  getScorecardKpis,
  listScorecards,
  removeKpiFromScorecard,
  RESULTS_SCORECARD_OWNER_DOMAIN,
  ScorecardKpiNotFoundError,
  updateScorecard,
} from '../../services/results/kpiScorecardService.js';
import { resultsEnterpriseService } from '../../services/resultsEnterpriseService.js';
import {
  type KpiDriverMapping,
  pullAndReconcileInitiative,
} from '../../services/v8/resultsFinanceReconciliationService.js';
import {
  getReconciliationOverview,
  getResultsDashboard,
  getResultsKpiCatalog,
  getResultsKpiDrawerDetail,
  getROIInitiativeDetail,
  getROIPortfolioSummary,
} from '../../services/v8/resultsROIService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';

const router = Router();

/** Stable contract id for V8 Results read responses. */
export const V8_RESULTS_READ_CONTRACT = 'results_runtime_read_v1';
export const V8_RESULTS_WRITE_CONTRACT = 'results_runtime_write_v1';

function resultsMeta() {
  return { version: 'v8' as const, contract: V8_RESULTS_READ_CONTRACT };
}

function resultsWriteMeta() {
  return { version: 'v8' as const, contract: V8_RESULTS_WRITE_CONTRACT };
}

/**
 * RES-003A Recovery Card db adapter for kpiRecoveryCardService. Unlike most
 * dbGet/dbAll/dbRun call sites in this file, `{ fallback: false }` is
 * deliberate here: these routes lean on "0 rows returned" as the signal for
 * an optimistic-concurrency version conflict (see closeRecoveryCard /
 * progressRecoveryCard / updateRecoveryCard), so a real SQL error must throw
 * instead of silently resolving to `[]`/`null` and being misread as a
 * legitimate version conflict.
 */
function buildRecoveryDb() {
  return {
    get: (sql: string, params?: unknown[]) => dbGet(sql, params, { fallback: false }),
    all: (sql: string, params?: unknown[]) => dbAll(sql, params, { fallback: false }),
    run: (sql: string, params?: unknown[]) => dbRun(sql, params, { fallback: false }),
  } as any;
}

/** Maps a RecoveryCardServiceError to the right HTTP status; returns true if handled. */
function mapRecoveryServiceError(err: unknown, res: Response): boolean {
  if (!(err instanceof RecoveryCardServiceError)) return false;
  const statusByCode: Record<string, number> = {
    NOT_FOUND: 404,
    TASK_NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    TASK_ALREADY_LINKED: 409,
    CONFLICT: 409,
  };
  const status = statusByCode[err.code] || 500;
  res.status(status).json({ error: err.message, code: `RESULTS_RECOVERY_${err.code}` });
  return true;
}

async function recordDeviationAudit(params: {
  organizationId: string;
  kpiId: string;
  eventType: string;
  actorUserId?: string | null;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  await resultsEnterpriseService.createMetricAuditEntry(params.organizationId, {
    kpiId: params.kpiId,
    section: 'deviation_case',
    eventType: params.eventType,
    source: 'results_v8',
    actorUserId: params.actorUserId || null,
    summary: params.summary,
    before: params.before || {},
    after: params.after || {},
  });
}

async function createV8KpiReportArtifact(params: {
  organizationId: string;
  userId: string;
  created: Awaited<ReturnType<typeof createKpiReportSnapshot>>;
}) {
  const { organizationId, userId, created } = params;
  const report = await ReportBuilderService.createReport({
    organizationId,
    sourceType: 'RESULTS_KPI_REPORT',
    sourceId: created.snapshotId,
    sourceName: created.snapshot.title,
    title: created.snapshot.title,
    description: `KPI review for ${created.snapshot.periodStart}${created.snapshot.periodEnd ? ` → ${created.snapshot.periodEnd}` : ''}`,
    createdBy: userId,
  });

  await Promise.all([
    ReportBuilderService.updateSectionContent(
      report.report.id,
      'executive_summary',
      created.markdown.executive_summary,
      userId
    ),
    ReportBuilderService.updateSectionContent(
      report.report.id,
      'kpi_overview',
      created.markdown.kpi_overview,
      userId
    ),
    ReportBuilderService.updateSectionContent(
      report.report.id,
      'deviation_cases',
      created.markdown.deviation_cases,
      userId
    ),
    ReportBuilderService.updateSectionContent(
      report.report.id,
      'action_plan',
      created.markdown.action_plan,
      userId
    ),
    ReportBuilderService.updateSectionContent(
      report.report.id,
      'appendix',
      created.markdown.appendix,
      userId
    ),
  ]);
  await ReportBuilderService.updateReportStatus(report.report.id, 'GENERATED', userId);
  return report.report.id;
}

// P04-B permission gate: extracted (RES-003A) to services/results/kpiPermissions.js
// so the legacy /api/benefits router can apply the identical role-derivation
// and assertion instead of forking a copy. See that file for the doc-comment
// on why 'edit_finance_artifacts'/'manage_reconciliation_finance' are excluded.
import {
  assertKpiPermission as p04AssertKpiPermission,
  type KpiGuardedAction as P04KpiGuardedAction,
  kpiRoleFromRequest as p04KpiRoleFromRequest,
} from '../../services/results/kpiPermissions.js';

/**
 * KPI lifecycle statuses that represent a finalized / locked KPI set.
 * Mirrors the definition/target lock in `resultsROIService` (§8.1F): once a KPI
 * has transitioned into benefits realization or formal review it is frozen and
 * must not absorb new report snapshots without a status transition first.
 */
const RESULTS_LOCKED_KPI_STATUSES: readonly string[] = ['benefits_realization', 'review', 'locked'];

/**
 * Report snapshot statuses that mean the snapshot has been finalized. Creating a
 * fresh report on top of a finalized snapshot for the same scope is a hidden
 * finalization bypass and must be blocked.
 */
const RESULTS_FINALIZED_REPORT_STATUSES: readonly string[] = ['finalized', 'locked', 'approved'];

/**
 * Guards `POST /kpi-reports` against creating a report on a finalized/locked KPI
 * set. Returns a structured violation when the selected KPIs (or, when no scope
 * is given, any org KPI) are in a locked lifecycle status, OR when a finalized
 * snapshot already exists for the requested period scope. Returns `null` when
 * creation is allowed.
 */
export async function findKpiReportFinalizationViolation(params: {
  organizationId: string;
  kpiIds: string[] | null;
}): Promise<{ code: string; error: string; detail: Record<string, unknown> } | null> {
  const { organizationId, kpiIds } = params;

  // 1) Block when any selected KPI is in a locked/finalized lifecycle status.
  if (kpiIds && kpiIds.length) {
    const placeholders = kpiIds.map(() => '?').join(', ');
    const lockedRows = await dbAll<{ id: string; status: string | null }>(
      `SELECT id, status FROM initiative_kpis
       WHERE organization_id = ? AND id IN (${placeholders})`,
      [organizationId, ...kpiIds],
      { fallback: true }
    ).catch(() => [] as { id: string; status: string | null }[]);

    const locked = (lockedRows || []).filter((row) =>
      RESULTS_LOCKED_KPI_STATUSES.includes(String(row.status || '').toLowerCase())
    );
    if (locked.length) {
      return {
        code: 'RESULTS_KPI_REPORT_SET_LOCKED',
        error:
          'Cannot create a report: one or more selected KPIs are in a finalized/locked status.',
        detail: {
          lockedKpiIds: locked.map((row) => row.id),
          lockedStatuses: Array.from(
            new Set(locked.map((row) => String(row.status || '').toLowerCase()))
          ),
        },
      };
    }
  }

  // 2) Block when a finalized snapshot already exists for the same KPI scope.
  // A finalized snapshot is immutable evidence; a new snapshot would silently
  // supersede it. The schema-tolerant query degrades to "no violation" when the
  // status column is absent (older snapshot table variants).
  const snapshotRows = await dbAll<{ id: string; status: string | null }>(
    `SELECT id, status FROM results_kpi_report_snapshots WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  ).catch(() => [] as { id: string; status: string | null }[]);

  const finalizedSnapshot = (snapshotRows || []).find((row) =>
    RESULTS_FINALIZED_REPORT_STATUSES.includes(String(row.status || '').toLowerCase())
  );
  if (finalizedSnapshot) {
    return {
      code: 'RESULTS_KPI_REPORT_ALREADY_FINALIZED',
      error:
        'Cannot create a report: a finalized report snapshot already exists for this organization scope.',
      detail: { finalizedSnapshotId: finalizedSnapshot.id },
    };
  }

  return null;
}

/**
 * Guards direct KPI definition/target edits (PUT /kpis/:kpiId) against a
 * finalized/locked KPI lifecycle status. Mirrors the report-creation guard
 * (`findKpiReportFinalizationViolation`) AND the workflow doctrine
 * (`getKpiWorkflowStatus` §8.1F: "KPI is in '<status>' status — definition and
 * target edits are blocked"). Without this, a caller within their own org could
 * mass-assign `baseline_value` / `target_value` / `direction` / thresholds on a
 * KPI that has moved into benefits realization or formal review, corrupting the
 * baseline against which realized value is reconciled.
 *
 * Returns a structured violation when the KPI's current status is locked, or
 * `null` when the edit is allowed. Schema-tolerant: degrades to no-violation
 * when the status column is absent.
 */
export async function findKpiEditLockViolation(params: {
  organizationId: string;
  kpiId: string;
}): Promise<{ code: string; error: string; detail: Record<string, unknown> } | null> {
  const { organizationId, kpiId } = params;
  const row = await dbGet<{ status: string | null }>(
    `SELECT k.status
     FROM initiative_kpis k
     LEFT JOIN initiatives i ON i.id = k.initiative_id
     WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
    [kpiId, organizationId],
    { fallback: true }
  ).catch(() => null);

  const status = String(row?.status || '').toLowerCase();
  if (status && RESULTS_LOCKED_KPI_STATUSES.includes(status)) {
    return {
      code: 'RESULTS_KPI_EDIT_LOCKED',
      error: `Cannot edit this KPI: it is in a finalized/locked status ('${status}'). Transition its status before editing the definition or targets.`,
      detail: { kpiId, status },
    };
  }
  return null;
}

// deriveKpiPeriodKey moved to kpiMeasurementWriterService.js (RES-003) — this
// file's copy and the one in benefits.routes.ts were byte-identical
// duplicates; both now import the single shared implementation.

/**
 * GET /api/v8/results/dashboard
 * Composed KPI scorecard, active deviation count, ROI dashboard, reconciliation health,
 * and recent executive review pack rollups for the V8 org context.
 */
/**
 * KARTY KPI (D-04, MVP 2026-07-28) — warstwa, której brakowało.
 *
 * Uwaga Piotra: „organizacja ma wiele kart — ze względu na terminy, na różne działy;
 * różne działy mają swoje karty w różnych okresach: za styczeń, za luty, za marzec.
 * Potrzebna nam tabela, gdzie te karty wybieramy, i możliwość tworzenia kart."
 *
 * Dotąd Wyniki otwierały się od razu na PŁASKIEJ liście wszystkich 27 wskaźników —
 * „jakby cała firma miała tylko jedną kartę". Ten endpoint dostarcza brakujący
 * poziom: listę kart (dział × okres) z licznikami.
 *
 * Karta może zawierać ten sam wskaźnik co inna (np. marża jest i w karcie Finansów,
 * i w karcie Zarządu) — stąd tabela łącząca `kpi_scorecard_items`, nie kolumna.
 */
router.get(
  '/scorecards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    // RES-11: isAdmin deliberately false here — the packet flags "does admin
    // see private_to_owner KPIs" as an open policy decision (§10), not yet
    // resolved by Piotr. Fail-closed default until that decision lands.
    const scorecards = await listScorecards(organizationId, { userId, isAdmin: false });
    return res.json({
      data: { scorecards, count: scorecards.length, ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN },
      meta: resultsMeta(),
    });
  })
);

/** Wskaźniki należące do jednej karty — wnętrze karty po kliknięciu w wiersz tabeli. */
router.get(
  '/scorecards/:scorecardId/kpis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const scorecardId = String(req.params.scorecardId || '').trim();
    const result = await getScorecardKpis(organizationId, scorecardId, { userId, isAdmin: false });
    if (!result) {
      return res.status(404).json({ error: 'Scorecard not found', code: 'SCORECARD_NOT_FOUND' });
    }
    return res.json({
      data: {
        scorecard: result.scorecard,
        kpis: result.kpis,
        count: result.kpis.length,
        ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN,
      },
      meta: resultsMeta(),
    });
  })
);

/** Creates a new department × period card. Results-owned — never touches `goals`. */
router.post(
  '/scorecards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { name, department, periodLabel, periodStart, periodEnd } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required', code: 'SCORECARD_NAME_REQUIRED' });
    }
    const scorecard = await createScorecard(organizationId, {
      name: name.trim(),
      department: department ?? null,
      periodLabel: periodLabel ?? null,
      periodStart: periodStart ?? null,
      periodEnd: periodEnd ?? null,
      createdBy: userId ?? null,
    });
    return res.status(201).json({
      data: { scorecard, ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN },
      meta: resultsWriteMeta(),
    });
  })
);

/** Updates card metadata (name/department/period/status). Fail-closed on cross-tenant id. */
router.put(
  '/scorecards/:scorecardId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const scorecardId = String(req.params.scorecardId || '').trim();
    const { name, department, periodLabel, periodStart, periodEnd, status } = req.body || {};
    const updated = await updateScorecard(
      organizationId,
      scorecardId,
      {
        ...(name !== undefined ? { name } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(periodLabel !== undefined ? { periodLabel } : {}),
        ...(periodStart !== undefined ? { periodStart } : {}),
        ...(periodEnd !== undefined ? { periodEnd } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      { userId, isAdmin: false }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Scorecard not found', code: 'SCORECARD_NOT_FOUND' });
    }
    return res.json({
      data: { scorecard: updated, ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN },
      meta: resultsWriteMeta(),
    });
  })
);

/** Attaches an existing `initiative_kpis` row to a card. Both ids are org-checked. */
router.post(
  '/scorecards/:scorecardId/kpis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const scorecardId = String(req.params.scorecardId || '').trim();
    const kpiId = typeof req.body?.kpiId === 'string' ? req.body.kpiId.trim() : '';
    const sortOrder = Number.isFinite(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0;
    if (!kpiId) {
      return res.status(400).json({ error: 'kpiId is required', code: 'SCORECARD_KPI_REQUIRED' });
    }
    const card = await getScorecard(organizationId, scorecardId);
    if (!card) {
      return res.status(404).json({ error: 'Scorecard not found', code: 'SCORECARD_NOT_FOUND' });
    }
    try {
      await addKpiToScorecard(organizationId, scorecardId, kpiId, sortOrder);
    } catch (err) {
      if (err instanceof ScorecardKpiNotFoundError) {
        return res.status(404).json({ error: err.message, code: 'SCORECARD_KPI_NOT_FOUND' });
      }
      throw err;
    }
    return res.status(201).json({
      data: { ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN },
      meta: resultsWriteMeta(),
    });
  })
);

/** Detaches a KPI from a card (the KPI definition itself is untouched). */
router.delete(
  '/scorecards/:scorecardId/kpis/:kpiId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const scorecardId = String(req.params.scorecardId || '').trim();
    const kpiId = String(req.params.kpiId || '').trim();
    const card = await getScorecard(organizationId, scorecardId);
    if (!card) {
      return res.status(404).json({ error: 'Scorecard not found', code: 'SCORECARD_NOT_FOUND' });
    }
    await removeKpiFromScorecard(organizationId, scorecardId, kpiId);
    return res.json({
      data: { ownerDomain: RESULTS_SCORECARD_OWNER_DOMAIN },
      meta: resultsWriteMeta(),
    });
  })
);

router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }
    let snapshot;
    try {
      // RES-11: isAdmin deliberately false — packet §10 open decision, fail-closed.
      snapshot = await getResultsDashboard(organizationId, {
        initiativeId,
        viewer: { userId, isAdmin: false },
      });
    } catch {
      return res.status(500).json({
        error: 'Failed to load results dashboard',
        code: 'RESULTS_DASHBOARD_READ_FAILED',
      });
    }
    return res.json({
      data: { snapshot },
      meta: resultsMeta(),
    });
  })
);

/**
 * GET /api/v8/results/reconciliations
 * Org-scoped KPI–Finance reconciliation overview for the Results ROI surface.
 * Finance (M16) writes reconciliation rows; Results (M15) reads status +
 * projected-vs-realized variance here. Optional `initiativeId` / `kpiId` narrow.
 */
router.get(
  '/reconciliations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;
    const kpiId =
      typeof req.query.kpiId === 'string' && req.query.kpiId.trim()
        ? req.query.kpiId.trim()
        : undefined;

    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }

    let overview;
    try {
      overview = await getReconciliationOverview(organizationId, { initiativeId, kpiId });
    } catch (err) {
      logger.error(`[V8:Results] Reconciliation overview read failed: ${String(err)}`);
      return res.status(500).json({
        error: 'Failed to load reconciliation overview',
        code: 'RESULTS_RECONCILIATION_READ_FAILED',
      });
    }

    return res.json({
      data: overview,
      meta: resultsMeta(),
    });
  })
);

/**
 * POST /api/v8/results/reconciliations/pull
 * Reconciliation ENGINE (M15 ↔ M16). Pulls actuals from Results for one
 * initiative, maps each KPI to its finance-model driver via a unit-conversion
 * multiplier, computes the realized-vs-projected deviation and persists it with
 * a CONCLUSION_LAYER. Body: { initiativeId, mappings:[{kpiId, driverKey,
 * unitMultiplier?, projectedValue?}] }.
 */
router.post(
  '/reconciliations/pull',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = (req.body ?? {}) as {
      initiativeId?: unknown;
      mappings?: unknown;
    };

    const initiativeId =
      typeof body.initiativeId === 'string' && body.initiativeId.trim()
        ? body.initiativeId.trim()
        : '';
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId is required',
        code: 'RESULTS_RECONCILIATION_INITIATIVE_REQUIRED',
      });
    }

    if (!Array.isArray(body.mappings) || body.mappings.length === 0) {
      return res.status(400).json({
        error: 'mappings[] (kpiId → driverKey) is required',
        code: 'RESULTS_RECONCILIATION_MAPPINGS_REQUIRED',
      });
    }

    // Org-scope guard: the initiative must belong to the caller's org.
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: `Initiative ${initiativeId} not found`,
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    const mappings: KpiDriverMapping[] = [];
    for (const raw of body.mappings as unknown[]) {
      const m = (raw ?? {}) as Record<string, unknown>;
      const kpiId = typeof m.kpiId === 'string' ? m.kpiId.trim() : '';
      const driverKey = typeof m.driverKey === 'string' ? m.driverKey.trim() : '';
      if (!kpiId || !driverKey) continue;
      mappings.push({
        kpiId,
        driverKey,
        unitMultiplier: typeof m.unitMultiplier === 'number' ? m.unitMultiplier : undefined,
        projectedValue: typeof m.projectedValue === 'number' ? m.projectedValue : undefined,
      });
    }

    if (mappings.length === 0) {
      return res.status(400).json({
        error: 'no valid mappings (each needs kpiId + driverKey)',
        code: 'RESULTS_RECONCILIATION_MAPPINGS_INVALID',
      });
    }

    let result;
    try {
      result = await pullAndReconcileInitiative(organizationId, initiativeId, mappings, {
        initiatedBy: 'results',
        recordedBy: userId,
      });
    } catch (err) {
      logger.error(`[V8:Results] Reconciliation pull failed: ${String(err)}`);
      return res.status(500).json({
        error: 'Failed to reconcile actuals against finance model',
        code: 'RESULTS_RECONCILIATION_PULL_FAILED',
      });
    }

    return res.json({
      data: result,
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * GET /api/v8/results/kpis/catalog
 * Shared KPI + mapping read seam for active Results KPI surfaces.
 */
router.get(
  '/kpis/catalog',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = typeof req.query.kpiId === 'string' ? req.query.kpiId.trim() : undefined;
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }
    let catalog;
    try {
      catalog = await getResultsKpiCatalog(organizationId, { kpiId, initiativeId });
    } catch {
      return res.status(500).json({
        error: 'Failed to load KPI catalog',
        code: 'RESULTS_CATALOG_READ_FAILED',
      });
    }
    const normalizedCatalog = {
      ...catalog,
      initiatives: Array.isArray((catalog as any)?.initiatives) ? (catalog as any).initiatives : [],
      kpis: Array.isArray((catalog as any)?.kpis) ? (catalog as any).kpis : [],
      mappings: Array.isArray((catalog as any)?.mappings) ? (catalog as any).mappings : [],
    };
    return res.json({
      data: normalizedCatalog,
      meta: resultsMeta(),
    });
  })
);

/**
 * POST /api/v8/results/kpis
 * Bounded KPI create seam for the active Results surfaces.
 */
router.post(
  '/kpis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'edit_definition'))) return;
    const { organizationId, userId } = getV8Context(req);
    const {
      name,
      description,
      unit,
      baselineValue,
      targetValue,
      measurementFrequency,
      alertThreshold,
      alertDirection,
      ownerUserId,
      direction,
      thresholdMode,
      amberThresholdPct,
      redThresholdPct,
      amberThresholdAbs,
      redThresholdAbs,
    } = req.body || {};

    const safeName = String(name || '').trim();
    if (!safeName) {
      return res.status(400).json({
        error: 'name is required',
        code: 'RESULTS_KPI_NAME_REQUIRED',
      });
    }

    // RES-02: canonical write goes through kpiDefinitionService — no direct
    // SQL against initiative_kpis here anymore (this used to be a second,
    // forked copy of the exact same INSERT in benefits.routes.ts).
    const created = await createKpiDefinition({
      organizationId,
      initiativeId: null,
      actorUserId: userId || null,
      name: safeName,
      description: description ? String(description).trim() : null,
      unit: unit ? String(unit).trim() : null,
      baselineValue: baselineValue != null && baselineValue !== '' ? Number(baselineValue) : null,
      targetValue: targetValue != null && targetValue !== '' ? Number(targetValue) : null,
      measurementFrequency: measurementFrequency || 'MONTHLY',
      alertThreshold:
        alertThreshold != null && alertThreshold !== '' ? Number(alertThreshold) : null,
      alertDirection: alertDirection || 'BELOW',
      ownerUserId: ownerUserId || null,
      direction: direction || 'HIGHER_IS_BETTER',
      thresholdMode: thresholdMode || 'PERCENT_FROM_TARGET',
      amberThresholdPct:
        amberThresholdPct != null && amberThresholdPct !== '' ? Number(amberThresholdPct) : null,
      redThresholdPct:
        redThresholdPct != null && redThresholdPct !== '' ? Number(redThresholdPct) : null,
      amberThresholdAbs:
        amberThresholdAbs != null && amberThresholdAbs !== '' ? Number(amberThresholdAbs) : null,
      redThresholdAbs:
        redThresholdAbs != null && redThresholdAbs !== '' ? Number(redThresholdAbs) : null,
      source: 'v8_results_create',
      reason: 'v8-results-kpi-create',
    });

    return res.status(201).json({
      data: { id: created.id },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * PUT /api/v8/results/kpis/:kpiId
 * Bounded KPI settings save seam for the active Results drawer surface.
 */
router.put(
  '/kpis/:kpiId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'edit_definition'))) return;
    const { organizationId, userId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }

    const {
      name,
      description,
      unit,
      baselineValue,
      targetValue,
      measurementFrequency,
      alertThreshold,
      alertDirection,
      ownerUserId,
      direction,
      thresholdMode,
      amberThresholdPct,
      redThresholdPct,
      amberThresholdAbs,
      redThresholdAbs,
      expectedVersion,
    } = req.body || {};

    // RES-02: a caller-supplied `expectedVersion` is the client's own last-seen
    // pointer (round-tripped from the catalog read) — using it enforces real
    // optimistic concurrency: a stale client loses the race with a 409 instead
    // of silently overwriting a concurrent edit. Callers that don't send the
    // key at all (older/other integrations) keep the previous self-read
    // fallback below. A caller that DOES send the key but with a garbage
    // value (non-integer, <= 0, or any non-numeric type) must fail closed with
    // 400 — silently coercing it to "not sent" would let a stale/malicious
    // client bypass CAS by sending an invalid token instead of omitting it.
    let clientExpectedVersion: number | null = null;
    if (expectedVersion !== undefined) {
      const isNumericInput =
        typeof expectedVersion === 'number' || typeof expectedVersion === 'string';
      const parsed = isNumericInput ? Number(expectedVersion) : NaN;
      if (!isNumericInput || !Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({
          error: 'expectedVersion must be a positive integer',
          code: 'RESULTS_KPI_INVALID_EXPECTED_VERSION',
        });
      }
      clientExpectedVersion = parsed;
    }

    const row = await dbGet<any>(
      `
      SELECT k.id
      FROM initiative_kpis k
      LEFT JOIN initiatives i ON i.id = k.initiative_id
      WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?
      `,
      [kpiId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }

    // State-machine guard: block definition/target mass-assignment when the KPI
    // is in a finalized/locked lifecycle status (benefits_realization/review/
    // locked). The report-creation guard already blocks this path; the direct
    // edit path must enforce the same lock or it is a hidden bypass. Unchanged
    // by RES-02 — a lifecycle-state check, not a definition-versioning concern.
    const editLockViolation = await findKpiEditLockViolation({ organizationId, kpiId });
    if (editLockViolation) {
      return res.status(409).json({
        error: editLockViolation.error,
        code: editLockViolation.code,
        detail: editLockViolation.detail,
      });
    }

    // RES-02: canonical CAS-versioned write. No direct SQL against
    // initiative_kpis here anymore, and no `.catch(() => null)` audit
    // side-effect either — kpiDefinitionService writes
    // before/after to kpi_metric_audit_log in the SAME transaction as the
    // version bump, so a failed audit insert now rolls back the whole write
    // instead of silently leaving an unaudited definition change (this used
    // to be the ONLY one of the 5 writers that audited at all).
    const current = await getCurrentKpiDefinition(kpiId, organizationId);
    if (!current) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }
    let updated;
    try {
      updated = await updateKpiDefinition({
        organizationId,
        kpiId,
        expectedVersion: clientExpectedVersion ?? current.currentDefinitionVersion,
        actorUserId: userId || null,
        name: name != null && String(name).trim() ? String(name).trim() : undefined,
        description: description != null ? String(description).trim() : undefined,
        unit: unit != null ? String(unit).trim() : undefined,
        baselineValue:
          baselineValue != null && baselineValue !== '' ? Number(baselineValue) : undefined,
        targetValue: targetValue != null && targetValue !== '' ? Number(targetValue) : undefined,
        measurementFrequency: measurementFrequency || undefined,
        alertThreshold:
          alertThreshold != null && alertThreshold !== '' ? Number(alertThreshold) : undefined,
        alertDirection: alertDirection || undefined,
        ownerUserId: ownerUserId || undefined,
        direction: direction || undefined,
        thresholdMode: thresholdMode || undefined,
        amberThresholdPct:
          amberThresholdPct != null && amberThresholdPct !== ''
            ? Number(amberThresholdPct)
            : undefined,
        redThresholdPct:
          redThresholdPct != null && redThresholdPct !== '' ? Number(redThresholdPct) : undefined,
        amberThresholdAbs:
          amberThresholdAbs != null && amberThresholdAbs !== ''
            ? Number(amberThresholdAbs)
            : undefined,
        redThresholdAbs:
          redThresholdAbs != null && redThresholdAbs !== '' ? Number(redThresholdAbs) : undefined,
        source: 'v8_results_update',
        reason: 'v8-results-kpi-update',
      });
    } catch (error) {
      if (error instanceof KpiDefinitionNotFoundError) {
        return res.status(404).json({ error: 'KPI not found', code: 'RESULTS_KPI_NOT_FOUND' });
      }
      if (error instanceof KpiDefinitionArchivedError) {
        return res.status(409).json({
          error: 'Cannot edit an archived KPI',
          code: 'RESULTS_KPI_ARCHIVED',
        });
      }
      if (error instanceof KpiDefinitionVersionConflictError) {
        return res.status(409).json({
          error: 'KPI definition changed concurrently; reload and retry',
          code: 'RESULTS_KPI_VERSION_CONFLICT',
        });
      }
      throw error;
    }

    return res.json({
      data: { success: true, currentDefinitionVersion: updated.currentDefinitionVersion },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * DELETE /api/v8/results/kpis/:kpiId
 * Bounded KPI delete seam for the active Results drawer surface.
 */
router.delete(
  '/kpis/:kpiId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'delete_kpi'))) return;
    const { organizationId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `
      SELECT k.id
      FROM initiative_kpis k
      LEFT JOIN initiatives i ON i.id = k.initiative_id
      WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?
      `,
      [kpiId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }

    // RES-02: delete = archive. Every immutable definition version and every
    // kpi_time_series/kpi_deviation_cases row is preserved — this used to
    // hard-DELETE the KPI and cascade-delete its measurement and deviation
    // history, exactly what the archive contract forbids. The mapping unlink
    // still runs (a real, intended effect of "delete").
    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      organizationId,
    ]).catch(() => null);

    const { userId: deletingUserId } = getV8Context(req);
    await archiveKpiDefinition({
      organizationId,
      kpiId,
      actorUserId: deletingUserId || null,
      reason: 'v8-results-kpi-delete',
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/kpi-mappings
 * Bounded initiative <-> KPI mapping create seam for the active Results surfaces.
 */
router.post(
  '/kpi-mappings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const {
      initiativeId,
      kpiId,
      impactWeight,
      impactDirection,
      expectedDelta,
      expectedDeltaUnit,
      lagDays,
      confidence,
      notes,
    } = req.body || {};

    if (!initiativeId || !kpiId) {
      return res.status(400).json({
        error: 'initiativeId and kpiId are required',
        code: 'RESULTS_KPI_MAPPING_REQUIRED_FIELDS',
      });
    }
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(initiativeId), organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
    }
    const kpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), organizationId],
      { fallback: true }
    );
    if (!kpi?.id) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO initiative_kpi_mappings (id, initiative_id, kpi_id, organization_id, impact_weight, impact_direction, expected_delta, expected_delta_unit, lag_days, confidence, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(initiative_id, kpi_id) DO UPDATE SET impact_weight=excluded.impact_weight, impact_direction=excluded.impact_direction, expected_delta=excluded.expected_delta, lag_days=excluded.lag_days, confidence=excluded.confidence, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        initiativeId,
        kpiId,
        organizationId,
        impactWeight || 1.0,
        impactDirection || 'increase',
        expectedDelta || null,
        expectedDeltaUnit || null,
        lagDays || 0,
        confidence || 'medium',
        notes || null,
        userId || null,
      ]
    );

    return res.json({
      data: { id, initiativeId, kpiId },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * DELETE /api/v8/results/kpi-mappings/:mappingId
 * Bounded initiative <-> KPI mapping remove seam for the active Results surfaces.
 */
router.delete(
  '/kpi-mappings/:mappingId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const mappingId = typeof req.params.mappingId === 'string' ? req.params.mappingId.trim() : '';
    if (!mappingId) {
      return res.status(400).json({
        error: 'mappingId is required',
        code: 'RESULTS_KPI_MAPPING_ID_REQUIRED',
      });
    }

    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE id = ? AND organization_id = ?`, [
      mappingId,
      organizationId,
    ]);

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/deviation-cases/:caseId/acknowledge
 * Bounded deviation-case acknowledge seam for the active Results drawer surface.
 */
router.post(
  '/deviation-cases/:caseId/acknowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id, kpi_id, status FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, organizationId]
    );
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_acknowledged',
      actorUserId: userId,
      summary: `Deviation case ${caseId} acknowledged`,
      before: { caseId, status: row.status },
      after: { caseId, status: 'ACKNOWLEDGED' },
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * PUT /api/v8/results/deviation-cases/:caseId/rca
 * Bounded deviation-case RCA save seam for the active Results drawer surface.
 */
router.put(
  '/deviation-cases/:caseId/rca',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    const { rcaText } = req.body || {};
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id, kpi_id, status, rca_text FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET rca_text = ?, status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [rcaText != null ? String(rcaText) : null, caseId, organizationId]
    );
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_rca_updated',
      actorUserId: userId,
      summary: `RCA updated for deviation case ${caseId}`,
      before: { caseId, status: row.status, rcaText: row.rca_text || null },
      after: { caseId, rcaText: rcaText != null ? String(rcaText) : null },
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * GET /api/v8/results/deviation-cases/:caseId/rca-suggest
 * Heuristic RCA hypotheses + recommended actions for a deviation case. Wires the
 * previously orphaned `deviationRcaSuggestService` into the V8 Results drawer
 * surface. Read-only — does NOT write `rca_text`; pair with
 * PUT /deviation-cases/:caseId/rca to persist the chosen hypothesis text.
 *
 * Signals are derived from the case + KPI's recorded time-series where
 * possible (deviationPct, trend, staleData). adoptionScore/scopeChanged/
 * capacityOverloaded are not represented in the schema — pass them as query
 * overrides when the caller (consultant/UI) has that judgment available.
 * Any derived signal can also be overridden via query string.
 */
router.get(
  '/deviation-cases/:caseId/rca-suggest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const kase = await dbGet<{
      id: string;
      kpi_id: string;
      period_start: string;
    }>(
      `SELECT id, kpi_id, period_start FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!kase?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    const kpi = await dbGet<{
      target_value: number | string | null;
      measurement_frequency: string | null;
    }>(
      `SELECT target_value, measurement_frequency FROM initiative_kpis WHERE id = ? AND organization_id = ?`,
      [kase.kpi_id, organizationId]
    );

    const measurement = await dbGet<{ value: number | string }>(
      `SELECT value FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ? AND period_start <= ?
       ORDER BY period_start DESC LIMIT 1`,
      [kase.kpi_id, organizationId, kase.period_start]
    );

    const recent = await dbAll<{
      value: number | string;
      period_start: string | null;
      measured_at: string | null;
    }>(
      `SELECT value, period_start, measured_at
       FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY COALESCE(period_start, measured_at) DESC LIMIT 6`,
      [kase.kpi_id, organizationId]
    );

    const target = kpi?.target_value != null ? Number(kpi.target_value) : null;
    let deviationPct: number | undefined;
    if (measurement?.value != null && target != null && Number.isFinite(target) && target !== 0) {
      deviationPct = (Number(measurement.value) - target) / Math.abs(target);
    }

    // Same "raw value delta" convention as GET /workflow/kpi/:kpiId/inspect's
    // KpiTrend.direction — improving/declining reflect the number moving up/down,
    // not goodness relative to KPI direction (kept consistent across surfaces).
    let trend: 'improving' | 'flat' | 'declining' | undefined;
    if (recent.length >= 2) {
      const last = Number(recent[0].value);
      const first = Number(recent[recent.length - 1].value);
      const delta = last - first;
      if (Number.isFinite(delta)) {
        trend = Math.abs(delta) < 1e-9 ? 'flat' : delta > 0 ? 'improving' : 'declining';
      }
    }

    let staleData: boolean | undefined;
    const lastMeasuredIso = recent[0]?.period_start || recent[0]?.measured_at || null;
    if (lastMeasuredIso) {
      const daysSince = (Date.now() - new Date(lastMeasuredIso).getTime()) / 86400000;
      const freq = String(kpi?.measurement_frequency || '').toLowerCase();
      const staleDays = freq === 'daily' ? 3 : freq === 'weekly' ? 14 : 60;
      if (Number.isFinite(daysSince)) staleData = daysSince > staleDays;
    }

    const q = req.query;
    const overrideBool = (v: unknown): boolean | undefined =>
      v == null ? undefined : String(v).toLowerCase() === 'true';
    const overrideNum = (v: unknown): number | undefined =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : undefined;
    const overrideTrend = (v: unknown): 'improving' | 'flat' | 'declining' | undefined =>
      v === 'improving' || v === 'flat' || v === 'declining' ? v : undefined;

    const input: RcaSuggestInput = {
      deviationPct: overrideNum(q.deviationPct) ?? deviationPct,
      trend: overrideTrend(q.trend) ?? trend,
      adoptionScore: overrideNum(q.adoptionScore),
      staleData: overrideBool(q.staleData) ?? staleData,
      scopeChanged: overrideBool(q.scopeChanged),
      capacityOverloaded: overrideBool(q.capacityOverloaded),
    };

    const hypotheses = suggestRca(input);
    const actions = suggestActions(hypotheses);

    return res.json({
      data: { caseId, kpiId: kase.kpi_id, signals: input, hypotheses, actions },
      meta: resultsMeta(),
    });
  })
);

/**
 * POST /api/v8/results/deviation-cases/:caseId/actions
 * Bounded deviation-case action-create seam for the active Results drawer surface.
 */
router.post(
  '/deviation-cases/:caseId/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    const { title, ownerUserId, dueDate } = req.body || {};
    const safeTitle = typeof title === 'string' ? title.trim() : '';

    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }
    if (!safeTitle) {
      return res.status(400).json({
        error: 'title is required',
        code: 'RESULTS_DEVIATION_ACTION_TITLE_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id, kpi_id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `
      INSERT INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, caseId, safeTitle, ownerUserId || null, dueDate ? String(dueDate).slice(0, 10) : null]
    );
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_action_created',
      actorUserId: userId,
      summary: `Action created for deviation case ${caseId}`,
      after: { caseId, actionId: id, title: safeTitle, ownerUserId: ownerUserId || null },
    });

    return res.json({
      data: { id, caseId },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * PUT /api/v8/results/deviation-cases/:caseId/actions/:actionId
 * Bounded deviation-action status-update seam for the active Results drawer surface.
 */
router.put(
  '/deviation-cases/:caseId/actions/:actionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    const actionId = typeof req.params.actionId === 'string' ? req.params.actionId.trim() : '';
    const { title, ownerUserId, dueDate, status } = req.body || {};

    if (!caseId || !actionId) {
      return res.status(400).json({
        error: 'caseId and actionId are required',
        code: 'RESULTS_DEVIATION_ACTION_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `
      SELECT a.id, a.title, a.status, a.owner_user_id, a.due_date, c.kpi_id
      FROM kpi_deviation_actions a
      INNER JOIN kpi_deviation_cases c ON c.id = a.case_id
      WHERE a.id = ? AND a.case_id = ? AND c.organization_id = ?
      `,
      [actionId, caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation action not found',
        code: 'RESULTS_DEVIATION_ACTION_NOT_FOUND',
      });
    }

    await dbRun(
      `
      UPDATE kpi_deviation_actions a
      SET
        title = COALESCE(?, a.title),
        owner_user_id = COALESCE(?, a.owner_user_id),
        due_date = COALESCE(?, a.due_date),
        status = COALESCE(?, a.status),
        updated_at = CURRENT_TIMESTAMP
      WHERE a.id = ? AND a.case_id = ? AND EXISTS (
        SELECT 1 FROM kpi_deviation_cases c WHERE c.id = a.case_id AND c.organization_id = ?
      )
      `,
      [
        title != null ? String(title).trim() : null,
        ownerUserId || null,
        dueDate ? String(dueDate).slice(0, 10) : null,
        status || null,
        actionId,
        caseId,
        organizationId,
      ]
    );
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_action_updated',
      actorUserId: userId,
      summary: `Action ${actionId} updated for deviation case ${caseId}`,
      before: {
        caseId,
        actionId,
        title: row.title,
        status: row.status,
        ownerUserId: row.owner_user_id || null,
        dueDate: row.due_date || null,
      },
      after: {
        caseId,
        actionId,
        title: title != null ? String(title).trim() : row.title,
        status: status || row.status,
        ownerUserId: ownerUserId || row.owner_user_id || null,
        dueDate: dueDate ? String(dueDate).slice(0, 10) : row.due_date || null,
      },
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/deviation-cases/:caseId/resolve
 * Bounded deviation-case resolve seam for the active Results drawer surface.
 */
router.post(
  '/deviation-cases/:caseId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id, kpi_id, status FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, organizationId]
    );
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_resolved',
      actorUserId: userId,
      summary: `Deviation case ${caseId} resolved`,
      before: { caseId, status: row.status },
      after: { caseId, status: 'RESOLVED' },
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/deviation-cases/:caseId/close
 * Bounded deviation-case close seam for the active Results drawer surface.
 */
router.post(
  '/deviation-cases/:caseId/close',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    const { evidenceText, evidenceRef, resolutionNotes, linkedInitiativeId, linkedTaskId } =
      req.body || {};

    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const safeEvidenceText = typeof evidenceText === 'string' ? evidenceText.trim() : '';
    const safeEvidenceRef = typeof evidenceRef === 'string' ? evidenceRef.trim() : '';
    const safeResolutionNotes = typeof resolutionNotes === 'string' ? resolutionNotes.trim() : '';

    if (!safeEvidenceText && !safeEvidenceRef) {
      return res.status(400).json({
        error: 'At least one of evidenceText or evidenceRef is required to close a deviation case',
        code: 'RESULTS_DEVIATION_CLOSE_EVIDENCE_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id, kpi_id, status, evidence_text, evidence_ref, resolution_notes
       FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }
    const safeLinkedInitiativeId =
      typeof linkedInitiativeId === 'string' && linkedInitiativeId.trim()
        ? linkedInitiativeId.trim()
        : '';
    if (safeLinkedInitiativeId) {
      const linkedInitiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [safeLinkedInitiativeId, organizationId],
        { fallback: true }
      );
      if (!linkedInitiative?.id) {
        return res.status(404).json({
          error: 'Initiative not found',
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }

    try {
      await dbRun(
        `UPDATE kpi_deviation_cases SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         evidence_text = ?, evidence_ref = ?, closed_by = ?, resolution_notes = ?,
         linked_initiative_id = COALESCE(?, linked_initiative_id),
         linked_task_id = COALESCE(?, linked_task_id)
         WHERE id = ? AND organization_id = ?`,
        [
          safeEvidenceText || null,
          safeEvidenceRef || null,
          userId || null,
          safeResolutionNotes || null,
          safeLinkedInitiativeId || null,
          linkedTaskId || null,
          caseId,
          organizationId,
        ]
      );
    } catch {
      await dbRun(
        `UPDATE kpi_deviation_cases SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         evidence_text = ?, evidence_ref = ?, closed_by = ?, resolution_notes = ?
         WHERE id = ? AND organization_id = ?`,
        [
          safeEvidenceText || null,
          safeEvidenceRef || null,
          userId || null,
          safeResolutionNotes || null,
          caseId,
          organizationId,
        ]
      );
    }
    await recordDeviationAudit({
      organizationId,
      kpiId: String(row.kpi_id),
      eventType: 'deviation_case_closed',
      actorUserId: userId,
      summary: `Deviation case ${caseId} closed with evidence`,
      before: {
        caseId,
        status: row.status,
        evidenceText: row.evidence_text || null,
        evidenceRef: row.evidence_ref || null,
        resolutionNotes: row.resolution_notes || null,
      },
      after: {
        caseId,
        status: 'CLOSED',
        evidenceText: safeEvidenceText || null,
        evidenceRef: safeEvidenceRef || null,
        resolutionNotes: safeResolutionNotes || null,
        linkedInitiativeId: safeLinkedInitiativeId || null,
        linkedTaskId: linkedTaskId || null,
      },
    });

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

// ============================================================================
// RES-003A — KPI Recovery Card canonical loop.
// See server/migrations/20260801_res003a_kpi_recovery_card.sql for schema +
// rationale, and server/src/services/results/kpiRecoveryCardService.ts for
// the state-machine logic. Every mutating endpoint below gates on
// 'manage_deviation' — a narrower capability specifically for close/escalate
// is a deliberate product decision this round did not make (NEEDS_CODEX_DECISION).
// ============================================================================

/**
 * GET /api/v8/results/deviation-cases/:caseId/recovery-card
 * Returns the Recovery Card for a deviation case if one exists. Does NOT
 * auto-create — cards are created either automatically on deviation
 * detection (handleTimeSeriesRecorded) or explicitly via the POST below.
 */
router.get(
  '/deviation-cases/:caseId/recovery-card',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<RecoveryCardRow>(
      `SELECT * FROM kpi_recovery_cards WHERE deviation_case_id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row) {
      return res.status(404).json({
        error: 'Recovery card not found',
        code: 'RESULTS_RECOVERY_CARD_NOT_FOUND',
      });
    }

    const card = await buildRecoveryCardDTO(buildRecoveryDb(), organizationId, row);
    return res.json({ data: card, meta: resultsMeta() });
  })
);

/**
 * POST /api/v8/results/deviation-cases/:caseId/recovery-card
 * Explicit create — thin wrapper over ensureRecoveryCardForCase for callers
 * that want to open a Recovery Card before/without a new time-series write
 * triggering it automatically.
 */
router.post(
  '/deviation-cases/:caseId/recovery-card',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    // Explicit ownership precheck BEFORE the insert path: without this, a
    // cross-org caller could POST an arbitrary caseId and — via
    // ensureRecoveryCardForCase's own re-derivation of org/kpi from the
    // case row — still succeed in creating a card, just scoped to whichever
    // org actually owns that case. 404 here stops that before any write.
    const kase = await dbGet<{ id: string; kpi_id: string; severity: string | null }>(
      `SELECT id, kpi_id, severity FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!kase?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }
    const severity: 'AMBER' | 'RED' =
      String(kase.severity || '').toUpperCase() === 'RED' ? 'RED' : 'AMBER';

    try {
      const result = await ensureRecoveryCardForCase({
        db: buildRecoveryDb(),
        orgId: organizationId,
        kpiId: kase.kpi_id,
        caseId,
        severity,
        actorUserId: userId || null,
      });
      if (!result?.cardId) {
        return res.status(404).json({
          error: 'Deviation case not found',
          code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
        });
      }
      const cardRow = await dbGet<RecoveryCardRow>(
        `SELECT * FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
        [result.cardId, organizationId]
      );
      if (!cardRow) {
        return res.status(500).json({
          error: 'Recovery card creation failed',
          code: 'RESULTS_RECOVERY_CARD_CREATE_FAILED',
        });
      }
      const card = await buildRecoveryCardDTO(buildRecoveryDb(), organizationId, cardRow);
      return res.status(result.created ? 201 : 200).json({
        data: { ...card, created: result.created },
        meta: resultsWriteMeta(),
      });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * PUT /api/v8/results/recovery-cards/:id
 * Edits the RCA / plan fields. Version-guarded (409 + fresh state on conflict).
 */
router.put(
  '/recovery-cards/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const {
      version,
      hypothesis,
      confirmedCause,
      impactDescription,
      priority,
      expectedImpact,
      dependencies,
      risks,
      expectedRecoveryDate,
      effectivenessCriteria,
    } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({
        error: 'version is required',
        code: 'RESULTS_RECOVERY_CARD_VERSION_REQUIRED',
      });
    }

    const owned = await dbGet<{ id: string }>(
      `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
      [cardId, organizationId]
    );
    if (!owned?.id) {
      return res.status(404).json({
        error: 'Recovery card not found',
        code: 'RESULTS_RECOVERY_CARD_NOT_FOUND',
      });
    }

    try {
      const result = await updateRecoveryCard({
        db: buildRecoveryDb(),
        orgId: organizationId,
        recoveryCardId: cardId,
        expectedVersion: Number(version),
        patch: {
          hypothesis,
          confirmedCause,
          impactDescription,
          priority,
          expectedImpact,
          dependencies,
          risks,
          expectedRecoveryDate,
          effectivenessCriteria,
        },
        actorUserId: userId || null,
      });
      if (!result.ok) {
        const fresh = await getRecoveryCardDTO(buildRecoveryDb(), organizationId, cardId);
        return res.status(409).json({
          error: 'Version conflict',
          code: 'RESULTS_RECOVERY_CARD_VERSION_CONFLICT',
          data: fresh,
        });
      }
      return res.json({ data: result.card, meta: resultsWriteMeta() });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/actions
 * Creates an immediate/durable recovery action line. Ownership of :id is
 * enforced inside ensureRecoveryAction (SELECT before any INSERT).
 */
router.post(
  '/recovery-cards/:id/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const { title, description, actionType, ownerUserId, dueDate, idempotencyKey } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }

    try {
      const result = await ensureRecoveryAction({
        db: buildRecoveryDb(),
        orgId: organizationId,
        recoveryCardId: cardId,
        actionType,
        title,
        description: description || null,
        ownerUserId: ownerUserId || null,
        dueDate: dueDate ? String(dueDate).slice(0, 10) : null,
        idempotencyKey: idempotencyKey || null,
        actorUserId: userId || null,
      });
      const actionRow = await dbGet<RecoveryActionRow>(
        `SELECT * FROM kpi_recovery_actions WHERE id = ? AND organization_id = ?`,
        [result.actionId, organizationId]
      );
      return res.status(result.created ? 201 : 200).json({
        data: actionRow ? toActionDTO(actionRow) : null,
        meta: resultsWriteMeta(),
      });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * PUT /api/v8/results/recovery-cards/:id/actions/:actionId
 * Ownership pattern mirrors the existing PUT .../deviation-cases/:caseId/actions/:actionId
 * (INNER JOIN to the parent, org-scoped) — no separate version guard here,
 * same as that precedent.
 */
router.put(
  '/recovery-cards/:id/actions/:actionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const actionId = typeof req.params.actionId === 'string' ? req.params.actionId.trim() : '';
    const { status, ownerUserId, dueDate } = req.body || {};

    if (!cardId || !actionId) {
      return res.status(400).json({
        error: 'id and actionId are required',
        code: 'RESULTS_RECOVERY_ACTION_ID_REQUIRED',
      });
    }
    const validStatuses = ['OPEN', 'DONE', 'CANCELLED'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${validStatuses.join(', ')}`,
        code: 'RESULTS_RECOVERY_ACTION_INVALID_STATUS',
      });
    }

    const owned = await dbGet<{ id: string }>(
      `
      SELECT a.id
      FROM kpi_recovery_actions a
      INNER JOIN kpi_recovery_cards c ON c.id = a.recovery_card_id
      WHERE a.id = ? AND a.recovery_card_id = ? AND c.organization_id = ?
      `,
      [actionId, cardId, organizationId]
    );
    if (!owned?.id) {
      return res.status(404).json({
        error: 'Recovery action not found',
        code: 'RESULTS_RECOVERY_ACTION_NOT_FOUND',
      });
    }

    await dbRun(
      `
      UPDATE kpi_recovery_actions
      SET status = COALESCE(?, status),
          owner_user_id = COALESCE(?, owner_user_id),
          due_date = COALESCE(?, due_date),
          updated_at = now()
      WHERE id = ? AND recovery_card_id = ? AND organization_id = ?
      `,
      [
        status || null,
        ownerUserId || null,
        dueDate ? String(dueDate).slice(0, 10) : null,
        actionId,
        cardId,
        organizationId,
      ]
    );

    const actionRow = await dbGet<RecoveryActionRow>(
      `SELECT * FROM kpi_recovery_actions WHERE id = ? AND organization_id = ?`,
      [actionId, organizationId]
    );
    return res.json({ data: actionRow ? toActionDTO(actionRow) : null, meta: resultsWriteMeta() });
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/actions/:actionId/link-task
 * THE fix for the execution_follow_up_ref bug documented in the migration:
 * creates a real `tasks` row and links it via kpi_recovery_actions.linked_task_id
 * with an explicit task_link_status, instead of the old silently-swallowed
 * UPDATE ... execution_follow_up_ref in /workflow/kpi/:id/next-action (that
 * endpoint is left untouched — it is a separate, no-longer-used path).
 */
router.post(
  '/recovery-cards/:id/actions/:actionId/link-task',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const actionId = typeof req.params.actionId === 'string' ? req.params.actionId.trim() : '';

    if (!cardId || !actionId) {
      return res.status(400).json({
        error: 'id and actionId are required',
        code: 'RESULTS_RECOVERY_ACTION_ID_REQUIRED',
      });
    }

    const action = await dbGet<{
      id: string;
      title: string;
      description: string | null;
      owner_user_id: string | null;
      due_date: string | null;
    }>(
      `
      SELECT a.id, a.title, a.description, a.owner_user_id, a.due_date
      FROM kpi_recovery_actions a
      INNER JOIN kpi_recovery_cards c ON c.id = a.recovery_card_id
      WHERE a.id = ? AND a.recovery_card_id = ? AND c.organization_id = ?
      `,
      [actionId, cardId, organizationId]
    );
    if (!action?.id) {
      return res.status(404).json({
        error: 'Recovery action not found',
        code: 'RESULTS_RECOVERY_ACTION_NOT_FOUND',
      });
    }

    const recoveryDb = buildRecoveryDb();
    let taskId: string;
    try {
      taskId = uuidv4();
      await dbRun(
        `
        INSERT INTO tasks (
          id, organization_id, title, description, status, priority,
          assignee_id, due_date, created_by, source_type, source_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'todo', 'medium', ?, ?, ?, 'kpi_recovery_action', ?, now(), now())
        `,
        [
          taskId,
          organizationId,
          action.title,
          action.description || `KPI recovery action (${actionId})`,
          action.owner_user_id || userId || null,
          action.due_date || null,
          userId || null,
          actionId,
        ]
      );
    } catch (err: any) {
      await markRecoveryActionTaskLinkFailed({
        db: recoveryDb,
        orgId: organizationId,
        actionId,
        error: err?.message || 'Task creation failed',
      }).catch(() => null);
      return res.status(500).json({
        error: 'Failed to create linked task',
        code: 'RESULTS_RECOVERY_TASK_CREATE_FAILED',
      });
    }

    try {
      const result = await linkRecoveryActionTask({
        db: recoveryDb,
        orgId: organizationId,
        actionId,
        taskId,
      });
      const freshAction = await dbGet<RecoveryActionRow>(
        `SELECT * FROM kpi_recovery_actions WHERE id = ? AND organization_id = ?`,
        [actionId, organizationId]
      );
      return res.json({
        data: { ...result, action: freshAction ? toActionDTO(freshAction) : null },
        meta: resultsWriteMeta(),
      });
    } catch (err) {
      // Never a silent swallow (that was the original bug): always record
      // the failure on the action row, then surface an error to the caller.
      await markRecoveryActionTaskLinkFailed({
        db: recoveryDb,
        orgId: organizationId,
        actionId,
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => null);
      if (mapRecoveryServiceError(err, res)) return;
      return res.status(500).json({
        error: 'Failed to link task to recovery action',
        code: 'RESULTS_RECOVERY_TASK_LINK_FAILED',
      });
    }
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/checkpoints
 */
router.post(
  '/recovery-cards/:id/checkpoints',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const { checkpointDate, notes } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }

    try {
      const checkpoint = await ensureRecoveryCheckpoint({
        db: buildRecoveryDb(),
        orgId: organizationId,
        recoveryCardId: cardId,
        checkpointDate,
        notes: notes || null,
        actorUserId: userId || null,
      });
      return res.status(201).json({ data: toCheckpointDTO(checkpoint), meta: resultsWriteMeta() });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * PUT /api/v8/results/recovery-cards/:id/checkpoints/:checkpointId/resolve
 */
router.put(
  '/recovery-cards/:id/checkpoints/:checkpointId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const checkpointId =
      typeof req.params.checkpointId === 'string' ? req.params.checkpointId.trim() : '';
    const { status, kpiTimeSeriesId } = req.body || {};

    if (!cardId || !checkpointId) {
      return res.status(400).json({
        error: 'id and checkpointId are required',
        code: 'RESULTS_RECOVERY_CHECKPOINT_ID_REQUIRED',
      });
    }

    try {
      const checkpoint = await resolveRecoveryCheckpoint({
        db: buildRecoveryDb(),
        orgId: organizationId,
        recoveryCardId: cardId,
        checkpointId,
        status,
        kpiTimeSeriesId: kpiTimeSeriesId || null,
      });
      return res.json({ data: toCheckpointDTO(checkpoint), meta: resultsWriteMeta() });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/close
 * Version-guarded. On a non-closeable outcome, returns 409 with `reason`
 * and the fresh card state so the client can refetch without a second
 * round trip.
 */
router.post(
  '/recovery-cards/:id/close',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const { version, evidenceText, evidenceRef, effectivenessRating } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({
        error: 'version is required',
        code: 'RESULTS_RECOVERY_CARD_VERSION_REQUIRED',
      });
    }
    const validRatings = ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE'];
    if (!validRatings.includes(effectivenessRating)) {
      return res.status(400).json({
        error: `effectivenessRating must be one of: ${validRatings.join(', ')}`,
        code: 'RESULTS_RECOVERY_CARD_INVALID_RATING',
      });
    }

    const owned = await dbGet<{ id: string }>(
      `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
      [cardId, organizationId]
    );
    if (!owned?.id) {
      return res.status(404).json({
        error: 'Recovery card not found',
        code: 'RESULTS_RECOVERY_CARD_NOT_FOUND',
      });
    }

    try {
      const result = await closeRecoveryCard({
        db: buildRecoveryDb(),
        orgId: organizationId,
        recoveryCardId: cardId,
        expectedVersion: Number(version),
        evidenceText: evidenceText || null,
        evidenceRef: evidenceRef || null,
        effectivenessRating,
        actorUserId: userId || null,
      });
      if (!result.closed) {
        const fresh = await getRecoveryCardDTO(buildRecoveryDb(), organizationId, cardId);
        return res.status(409).json({
          error: 'Recovery card could not be closed',
          code: `RESULTS_RECOVERY_CARD_CLOSE_${result.reason}`,
          reason: result.reason,
          latestMeasurement: 'latestMeasurement' in result ? result.latestMeasurement : undefined,
          data: fresh,
        });
      }
      return res.json({ data: result.card, meta: resultsWriteMeta() });
    } catch (err) {
      if (mapRecoveryServiceError(err, res)) return;
      throw err;
    }
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/continue
 */
router.post(
  '/recovery-cards/:id/continue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const { version, note } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({
        error: 'version is required',
        code: 'RESULTS_RECOVERY_CARD_VERSION_REQUIRED',
      });
    }

    const owned = await dbGet<{ id: string }>(
      `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
      [cardId, organizationId]
    );
    if (!owned?.id) {
      return res.status(404).json({
        error: 'Recovery card not found',
        code: 'RESULTS_RECOVERY_CARD_NOT_FOUND',
      });
    }

    const result = await progressRecoveryCard({
      db: buildRecoveryDb(),
      orgId: organizationId,
      recoveryCardId: cardId,
      expectedVersion: Number(version),
      decision: 'CONTINUE',
      note: note || null,
      actorUserId: userId || null,
    });
    if (!result.ok) {
      const fresh = await getRecoveryCardDTO(buildRecoveryDb(), organizationId, cardId);
      return res.status(409).json({
        error: 'Version conflict',
        code: 'RESULTS_RECOVERY_CARD_VERSION_CONFLICT',
        data: fresh,
      });
    }
    return res.json({ data: result.card, meta: resultsWriteMeta() });
  })
);

/**
 * POST /api/v8/results/recovery-cards/:id/escalate
 * NEEDS_CODEX_DECISION: `escalateTo` (an addressee) is intentionally NOT
 * accepted/wired here — there is no escalation-addressee/notification
 * mechanism in this schema slice, and `escalationForSignal` (the closest
 * existing concept) is dead code with zero callers. Wiring a real
 * escalation-notification path (addressee resolution, channel, SLA) is a
 * deliberate product decision out of scope for this round.
 */
router.post(
  '/recovery-cards/:id/escalate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'manage_deviation'))) return;
    const { organizationId, userId } = getV8Context(req);
    const cardId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const { version, note } = req.body || {};

    if (!cardId) {
      return res.status(400).json({
        error: 'id is required',
        code: 'RESULTS_RECOVERY_CARD_ID_REQUIRED',
      });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({
        error: 'version is required',
        code: 'RESULTS_RECOVERY_CARD_VERSION_REQUIRED',
      });
    }

    const owned = await dbGet<{ id: string }>(
      `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
      [cardId, organizationId]
    );
    if (!owned?.id) {
      return res.status(404).json({
        error: 'Recovery card not found',
        code: 'RESULTS_RECOVERY_CARD_NOT_FOUND',
      });
    }

    const result = await progressRecoveryCard({
      db: buildRecoveryDb(),
      orgId: organizationId,
      recoveryCardId: cardId,
      expectedVersion: Number(version),
      decision: 'ESCALATE',
      note: note || null,
      actorUserId: userId || null,
    });
    if (!result.ok) {
      const fresh = await getRecoveryCardDTO(buildRecoveryDb(), organizationId, cardId);
      return res.status(409).json({
        error: 'Version conflict',
        code: 'RESULTS_RECOVERY_CARD_VERSION_CONFLICT',
        data: fresh,
      });
    }
    return res.json({ data: result.card, meta: resultsWriteMeta() });
  })
);

/**
 * GET /api/v8/results/kpis/:kpiId/drawer-detail
 * Bounded KPI drawer bridge for time-series and open deviation-case continuity.
 */
router.get(
  '/kpis/:kpiId/drawer-detail',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }
    let detail;
    try {
      detail = await getResultsKpiDrawerDetail(kpiId, organizationId, { initiativeId });
    } catch (error) {
      if (error instanceof Error && error.message === 'RESULTS_KPI_NOT_FOUND') {
        return res.status(404).json({
          error: `KPI ${kpiId} not found`,
          code: 'RESULTS_KPI_NOT_FOUND',
        });
      }
      return res.status(500).json({
        error: 'Failed to load KPI drawer detail',
        code: 'RESULTS_KPI_DRAWER_READ_FAILED',
      });
    }
    return res.json({
      data: detail,
      meta: resultsMeta(),
    });
  })
);

/**
 * POST /api/v8/results/kpis/:kpiId/time-series
 * Bounded KPI time-series record seam for the active Results drawer surface.
 */
router.post(
  '/kpis/:kpiId/time-series',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'record_measurement'))) return;
    const { organizationId, userId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    const body = req.body || {};
    const value = body.value;
    const periodStartRaw =
      body.periodStart || body.period_start || body.measuredAt || body.measured_at;
    const periodEndRaw = body.periodEnd || body.period_end;
    const source = body.source;
    const notes = body.notes;

    const periodStart = periodStartRaw ? String(periodStartRaw).slice(0, 10) : '';
    const periodEnd = periodEndRaw ? String(periodEndRaw).slice(0, 10) : null;

    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }
    if (value == null || value === '' || !Number.isFinite(Number(value))) {
      return res.status(400).json({
        error: 'value is required',
        code: 'RESULTS_KPI_VALUE_REQUIRED',
      });
    }
    if (!periodStart) {
      return res.status(400).json({
        error: 'periodStart (or measuredAt) is required',
        code: 'RESULTS_KPI_PERIOD_START_REQUIRED',
      });
    }

    // RES-003: recordKpiMeasurement performs the org-ownership precheck on
    // kpiId itself (mirrors the SEC-3 (L-04) SELECT this route used to inline)
    // before any write, upserts on (kpiId, periodStart, source) instead of a
    // bare INSERT, and resolves the RES-02 definition_version_id pin via the
    // canonical owner's own getCurrentDefinitionVersionId — this route no
    // longer needs its own kpi_definition_versions join.
    let result;
    try {
      result = await recordKpiMeasurement({
        organizationId,
        kpiId,
        value: Number(value),
        periodStart,
        periodEnd,
        source,
        notes,
        actorUserId: userId || null,
      });
    } catch (error) {
      if (error instanceof KpiMeasurementKpiNotFoundError) {
        return res.status(404).json({
          error: 'KPI not found',
          code: 'RESULTS_KPI_NOT_FOUND',
        });
      }
      throw error;
    }

    return res.status(201).json({
      data: {
        id: result.id,
        kpiId: result.kpiId,
        value: result.value,
        measuredAt: result.periodStart,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        periodKey: result.periodKey,
        source: result.source,
        notes: result.notes,
        wasNewRow: result.wasNewRow,
        definitionVersionId: result.definitionVersionId,
      },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * GET /api/v8/results/kpis/:kpiId/anomalies
 * Anomaly detection (z-score + IQR) over a KPI's recorded time-series. Wires the
 * previously orphaned `kpiAnomalyService` into the V8 Results surface — read-only,
 * org-scoped, no side effects. Optional query overrides: zThreshold, iqrK,
 * severeZThreshold (see kpiAnomalyService.detectAnomalies for defaults).
 */
router.get(
  '/kpis/:kpiId/anomalies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }

    const kpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [kpiId, organizationId]
    );
    if (!kpi?.id) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }

    const rows = await dbAll<{
      value: number | string;
      period_start: string | null;
      measured_at: string | null;
    }>(
      `SELECT value, period_start, measured_at
       FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY COALESCE(period_start, measured_at) ASC`,
      [kpiId, organizationId]
    );

    const values = (rows || []).map((r) => Number(r.value));
    const zThresholdRaw = req.query.zThreshold;
    const iqrKRaw = req.query.iqrK;
    const severeZThresholdRaw = req.query.severeZThreshold;
    const zThreshold =
      zThresholdRaw != null && Number.isFinite(Number(zThresholdRaw))
        ? Number(zThresholdRaw)
        : undefined;
    const iqrK = iqrKRaw != null && Number.isFinite(Number(iqrKRaw)) ? Number(iqrKRaw) : undefined;
    const severeZThreshold =
      severeZThresholdRaw != null && Number.isFinite(Number(severeZThresholdRaw))
        ? Number(severeZThresholdRaw)
        : undefined;

    const result = detectAnomalies(values, { zThreshold, iqrK, severeZThreshold });
    const anomalies = result.anomalies.map((a) => ({
      ...a,
      periodIso: rows[a.index]?.period_start || rows[a.index]?.measured_at || null,
    }));

    return res.json({
      data: { kpiId, anomalies, summary: result.summary },
      meta: resultsMeta(),
    });
  })
);

/**
 * GET /api/v8/results/kpis/:kpiId/forecast
 * Linear-trend forecast + target-hit projection over a KPI's time-series. Wires
 * the previously orphaned `kpiForecastService` into the V8 Results surface —
 * read-only, org-scoped, no side effects. Optional query override: deadlineT
 * (numeric time index — see kpiForecastService.leadingAlert).
 */
router.get(
  '/kpis/:kpiId/forecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = typeof req.params.kpiId === 'string' ? req.params.kpiId.trim() : '';
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }

    const kpi = await dbGet<{
      id: string;
      target_value: number | string | null;
      direction: string | null;
    }>(
      `SELECT k.id, k.target_value, k.direction
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [kpiId, organizationId]
    );
    if (!kpi?.id) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }

    const rows = await dbAll<{
      value: number | string;
      period_start: string | null;
      measured_at: string | null;
    }>(
      `SELECT value, period_start, measured_at
       FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY COALESCE(period_start, measured_at) ASC`,
      [kpiId, organizationId]
    );

    // t = ordinal index over the (chronologically sorted) recorded periods —
    // the service is time-unit-agnostic, so an ordinal index keeps callers from
    // having to pass timestamps while still supporting the deadlineT query override.
    const points = (rows || [])
      .map((r, i) => ({
        t: i,
        value: Number(r.value),
        periodIso: r.period_start || r.measured_at || null,
      }))
      .filter((p) => Number.isFinite(p.value));

    const trend = linearTrend(points);
    const target = kpi.target_value != null ? Number(kpi.target_value) : null;
    const direction: KpiForecastDirection =
      kpi.direction === 'LOWER_IS_BETTER' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';

    let projection: ReturnType<typeof projectToTarget> | null = null;
    let alert: ReturnType<typeof leadingAlert> | null = null;
    if (target != null && Number.isFinite(target)) {
      projection = projectToTarget({ points, target, direction });
      const deadlineTRaw = req.query.deadlineT;
      const deadlineT =
        deadlineTRaw != null && Number.isFinite(Number(deadlineTRaw))
          ? Number(deadlineTRaw)
          : undefined;
      alert = leadingAlert(projection, deadlineT);
    }

    return res.json({
      data: {
        kpiId,
        target,
        direction,
        trend,
        points: points.map(({ t, value, periodIso }) => ({ t, value, periodIso })),
        projection,
        alert,
      },
      meta: resultsMeta(),
    });
  })
);

/**
 * GET /api/v8/results/roi/portfolio-summary
 * Active ROI portfolio rollup for Results surfaces, exposed from the V8 namespace.
 */
router.get(
  '/roi/portfolio-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }
    let portfolio;
    try {
      portfolio = await getROIPortfolioSummary(
        organizationId,
        initiativeId ? { initiativeId } : undefined
      );
    } catch {
      return res.status(500).json({
        error: 'Failed to load ROI portfolio summary',
        code: 'RESULTS_ROI_PORTFOLIO_READ_FAILED',
      });
    }
    return res.json({
      data: portfolio,
      meta: resultsMeta(),
    });
  })
);

/**
 * POST /api/v8/results/kpi-reports
 * Bounded KPI report create seam for the active Results report surface.
 */
router.post(
  '/kpi-reports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'create_report'))) return;
    const { organizationId, userId } = getV8Context(req);
    const { periodStart, periodEnd, title, filters, kpiIds, goalIds } = req.body || {};
    const safeStart = String(periodStart || '').slice(0, 10);
    if (!safeStart) {
      return res.status(400).json({
        error: 'periodStart is required',
        code: 'RESULTS_KPI_REPORT_PERIOD_START_REQUIRED',
      });
    }

    const selectedKpiIds: string[] | null = Array.isArray(kpiIds)
      ? (kpiIds as unknown[]).map((entry) => String(entry || '').trim()).filter(Boolean)
      : null;

    // Finalization/lock guard (beyond the role header check): block report
    // creation when the targeted KPI set is finalized/locked, or when a
    // finalized snapshot already exists for the scope. This closes the
    // hidden-finalization bypass flagged by the Module 07 audit.
    const finalizationViolation = await findKpiReportFinalizationViolation({
      organizationId,
      kpiIds: selectedKpiIds && selectedKpiIds.length ? selectedKpiIds : null,
    });
    if (finalizationViolation) {
      return res.status(409).json({
        error: finalizationViolation.error,
        code: finalizationViolation.code,
        detail: finalizationViolation.detail,
      });
    }

    const selectedGoalIds: string[] | null = Array.isArray(goalIds)
      ? (goalIds as unknown[]).map((entry) => String(entry || '').trim()).filter(Boolean)
      : null;

    const enrichedFilters = {
      ...(filters && typeof filters === 'object' ? filters : {}),
      ...(selectedGoalIds && selectedGoalIds.length ? { goalIds: selectedGoalIds } : {}),
    };

    let created;
    try {
      created = await createKpiReportSnapshot({
        organizationId,
        periodStart: safeStart,
        periodEnd: periodEnd ? String(periodEnd).slice(0, 10) : null,
        title: title ? String(title) : null,
        createdBy: userId,
        filters: Object.keys(enrichedFilters).length ? enrichedFilters : null,
        kpiIds: selectedKpiIds && selectedKpiIds.length ? selectedKpiIds : null,
      });
    } catch (error) {
      if (error instanceof ResultsKpiReportSnapshotError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const reportId = await createV8KpiReportArtifact({ organizationId, userId, created });

    return res.json({
      data: { snapshotId: created.snapshotId, reportId },
      meta: resultsWriteMeta(),
    });
  })
);

router.post(
  '/kpi-reports/:snapshotId/refresh',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'create_report'))) return;
    const { organizationId, userId } = getV8Context(req);
    const snapshotId =
      typeof req.params.snapshotId === 'string' ? req.params.snapshotId.trim() : '';
    if (!snapshotId) {
      return res.status(400).json({
        error: 'snapshotId is required',
        code: 'RESULTS_KPI_REPORT_SNAPSHOT_ID_REQUIRED',
      });
    }

    const existing = await getKpiReportSnapshot({ organizationId, snapshotId });
    if (!existing?.snapshot) {
      return res.status(404).json({
        error: 'KPI report snapshot not found',
        code: 'RESULTS_KPI_REPORT_SNAPSHOT_NOT_FOUND',
      });
    }

    const refreshed = await createKpiReportSnapshot({
      organizationId,
      periodStart: existing.snapshot.periodStart,
      periodEnd: existing.snapshot.periodEnd,
      title: existing.snapshot.title,
      createdBy: userId,
      filters: existing.filters && typeof existing.filters === 'object' ? existing.filters : null,
      kpiIds: Array.isArray(existing.snapshot.kpis)
        ? existing.snapshot.kpis.map((kpi: any) => String(kpi.id || '').trim()).filter(Boolean)
        : null,
    });

    const reportId = await createV8KpiReportArtifact({
      organizationId,
      userId,
      created: refreshed,
    });
    return res.json({
      data: { snapshotId: refreshed.snapshotId, reportId },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * GET /api/v8/results/roi/initiative/:initiativeId/detail
 * Bounded ROI detail bridge for the active Results drawer surface.
 */
router.get(
  '/roi/initiative/:initiativeId/detail',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId =
      typeof req.params.initiativeId === 'string' ? req.params.initiativeId.trim() : '';
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId is required',
        code: 'RESULTS_ROI_INITIATIVE_ID_REQUIRED',
      });
    }
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
    }
    const detail = await getROIInitiativeDetail(initiativeId, organizationId);
    return res.json({
      data: detail,
      meta: resultsMeta(),
    });
  })
);

/**
 * PUT /api/v8/results/roi/initiative/:initiativeId/assumptions
 * Bounded ROI assumptions write seam for the active Results drawer surface.
 */
router.put(
  '/roi/initiative/:initiativeId/assumptions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId =
      typeof req.params.initiativeId === 'string' ? req.params.initiativeId.trim() : '';
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId is required',
        code: 'RESULTS_ROI_INITIATIVE_ID_REQUIRED',
      });
    }
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    const {
      capex,
      opexAnnual,
      expectedRoiPercent,
      expectedNpv,
      expectedPaybackMonths,
      horizonMonths,
      baselineRevenue,
      baselineCost,
      expectedRevenueDelta,
      expectedCostDelta,
      effectStartDate,
      assumptionsText,
      assumptionsOwner,
      confidence,
    } = req.body || {};

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO roi_assumptions (id, initiative_id, organization_id, capex, opex_annual, expected_roi_percent, expected_npv, expected_payback_months, horizon_months, baseline_revenue, baseline_cost, expected_revenue_delta, expected_cost_delta, effect_start_date, assumptions_text, assumptions_owner, confidence, last_updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(initiative_id) DO UPDATE SET
         capex=excluded.capex, opex_annual=excluded.opex_annual, expected_roi_percent=excluded.expected_roi_percent,
         expected_npv=excluded.expected_npv, expected_payback_months=excluded.expected_payback_months,
         horizon_months=excluded.horizon_months, baseline_revenue=excluded.baseline_revenue, baseline_cost=excluded.baseline_cost,
         expected_revenue_delta=excluded.expected_revenue_delta, expected_cost_delta=excluded.expected_cost_delta,
         effect_start_date=excluded.effect_start_date, assumptions_text=excluded.assumptions_text,
         assumptions_owner=excluded.assumptions_owner, confidence=excluded.confidence,
         last_updated_by=excluded.last_updated_by, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        initiativeId,
        organizationId,
        capex || 0,
        opexAnnual || 0,
        expectedRoiPercent || null,
        expectedNpv || null,
        expectedPaybackMonths || null,
        horizonMonths || 36,
        baselineRevenue || null,
        baselineCost || null,
        expectedRevenueDelta || null,
        expectedCostDelta || null,
        effectStartDate || null,
        assumptionsText || null,
        assumptionsOwner || null,
        confidence || 'medium',
        userId || null,
      ]
    );

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/roi/initiative/:initiativeId/realized
 * Bounded ROI realized-entry write seam for the active Results drawer surface.
 */
router.post(
  '/roi/initiative/:initiativeId/realized',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId =
      typeof req.params.initiativeId === 'string' ? req.params.initiativeId.trim() : '';
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId is required',
        code: 'RESULTS_ROI_INITIATIVE_ID_REQUIRED',
      });
    }
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    const {
      periodMonth,
      realizedRevenueDelta,
      realizedCostDelta,
      realizedSavings,
      source,
      varianceNotes,
    } = req.body || {};

    const safePeriodMonth = typeof periodMonth === 'string' ? periodMonth.trim() : '';
    if (!safePeriodMonth) {
      return res.status(400).json({
        error: 'periodMonth is required',
        code: 'RESULTS_ROI_PERIOD_MONTH_REQUIRED',
      });
    }

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        initiativeId,
        organizationId,
        safePeriodMonth,
        realizedRevenueDelta || null,
        realizedCostDelta || null,
        realizedSavings || null,
        source || 'manual',
        varianceNotes || null,
        userId || null,
      ]
    );

    return res.json({
      data: { id },
      meta: resultsWriteMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// P04 — KPI Workflow Canon endpoints
// ────────────────────────────────────────────────────────────────

import {
  computeKpiHealthPosture,
  KPI_ANTI_DUPLICATE_RULES,
  KPI_PERMISSION_MATRIX,
  KPI_WORKFLOW_STATES,
  KPI_WORKFLOW_TRANSITIONS,
  type KpiDegradedPosture,
  type KpiHealthStatus,
  type KpiNextAction,
  type KpiReconciliation,
  type KpiReport,
  type KpiSignal,
  type KpiTarget,
  type KpiTrend,
  type KpiWorkflowState,
  LINKAGE_PATTERNS,
  P04_ACCEPTANCE_CHECKLIST,
  P04_KPI_WORKFLOW_CONTRACT,
} from '../../services/v8/kpiWorkflowCanon.js';

const p04Meta = () => ({ version: 'v8' as const, contract: P04_KPI_WORKFLOW_CONTRACT });

/**
 * GET /workflow/signals — Active KPI signals for the org.
 * Aggregates deviations + freshness + discrepancy signals.
 */
router.get(
  '/workflow/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const deviations: Array<Record<string, unknown>> = await dbAll(
      `SELECT dc.id, dc.kpi_id, dc.severity, dc.status, dc.deviation_summary, dc.detected_at, dc.created_at
       FROM kpi_deviation_cases dc
       JOIN initiative_kpis ik ON ik.id = dc.kpi_id
       WHERE ik.organization_id = ? AND dc.status NOT IN ('CLOSED', 'RESOLVED')
       ORDER BY dc.created_at DESC
       LIMIT 200`,
      [organizationId]
    );

    const signals: KpiSignal[] = deviations.map((d) => ({
      signalId: String(d.id),
      kpiId: String(d.kpi_id),
      signalType: 'deviation' as const,
      severity: String(d.severity || 'medium').toLowerCase() as KpiSignal['severity'],
      summary: String(d.deviation_summary || `Deviation on KPI ${d.kpi_id}`),
      detectedAt: d.detected_at
        ? new Date(d.detected_at).toISOString()
        : d.created_at
          ? new Date(d.created_at).toISOString()
          : '',
    }));

    return res.json({ data: { signals, count: signals.length }, meta: p04Meta() });
  })
);

/**
 * GET /workflow/kpi/:kpiId/inspect — Inspection payload for a single KPI.
 * Returns target, trend, health posture, open signals, and available actions.
 */
router.get(
  '/workflow/kpi/:kpiId/inspect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { kpiId } = req.params;

    const kpi = await dbGet(
      // Silent-degr fix: initiative_kpis has `current_value`, not `latest_value`.
      // The bogus column errored the whole SELECT -> dbGet fallback -> null ->
      // handler returned a false 404 "KPI not found" for KPIs that exist.
      `SELECT ik.*, ik.id as kpi_id,
              COALESCE(ik.name, ik.id) as name,
              ik.target_value, ik.baseline_value, ik.current_value AS latest_value,
              ik.measurement_frequency, ik.updated_at, ik.created_at
       FROM initiative_kpis ik
       WHERE ik.id = ? AND ik.organization_id = ?`,
      [kpiId, organizationId]
    );

    if (!kpi) {
      return res.status(404).json({
        error: 'KPI not found',
        code: 'KPI_NOT_FOUND',
      });
    }

    const recentMeasurements: Array<Record<string, unknown>> = await dbAll(
      `SELECT value, measured_at, period_start, period_end
       FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY measured_at DESC LIMIT 12`,
      [kpiId, organizationId]
    );

    const openSignals: Array<Record<string, unknown>> = await dbAll(
      `SELECT id, severity, status, deviation_summary, detected_at
       FROM kpi_deviation_cases
       WHERE kpi_id = ? AND status NOT IN ('CLOSED', 'RESOLVED')`,
      [kpiId]
    );

    const reconciliation = await dbGet(
      `SELECT reconciliation_id, kpi_id, finance_ref, reconciliation_status, initiated_by
       FROM v8_kpi_finance_reconciliations
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [kpiId, organizationId]
    );

    const target: KpiTarget = {
      kpiId: String(kpi.kpi_id),
      targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
      baselineValue: kpi.baseline_value != null ? Number(kpi.baseline_value) : null,
    };

    const points = recentMeasurements.map((m) => ({
      period: String(m.period_start || m.measured_at || ''),
      actualValue: m.value != null ? Number(m.value) : null,
      targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
      deviation:
        m.value != null && kpi.target_value != null
          ? Number(m.value) - Number(kpi.target_value)
          : null,
    }));

    let direction: KpiTrend['direction'] = 'insufficient_data';
    if (points.length >= 2) {
      const first = points[points.length - 1]?.actualValue;
      const last = points[0]?.actualValue;
      if (first != null && last != null) {
        const delta = last - first;
        if (Math.abs(delta) < 0.001) direction = 'stable';
        else direction = delta > 0 ? 'improving' : 'declining';
      }
    }

    const trend: KpiTrend = {
      kpiId: String(kpi.kpi_id),
      direction,
      window: `last_${points.length}_periods`,
      aggregation: 'last',
      points,
    };

    const healthPosture = computeKpiHealthPosture({
      currentValue: kpi.latest_value != null ? Number(kpi.latest_value) : null,
      targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
      updatedAt: kpi.updated_at ? String(kpi.updated_at) : null,
      financeLinked: !!reconciliation,
      reconciliationStatus: reconciliation
        ? (String(reconciliation.reconciliation_status) as
            | 'pending'
            | 'reconciled'
            | 'disputed'
            | 'escalated')
        : null,
    });

    const signals: KpiSignal[] = openSignals.map((s) => ({
      signalId: String(s.id),
      kpiId: String(kpi.kpi_id),
      signalType: 'deviation' as const,
      severity: String(s.severity || 'medium').toLowerCase() as KpiSignal['severity'],
      summary: String(s.deviation_summary || 'Deviation detected'),
      detectedAt: s.detected_at ? new Date(s.detected_at).toISOString() : '',
    }));

    return res.json({
      data: {
        kpiId: String(kpi.kpi_id),
        name: String(kpi.name),
        target,
        trend,
        healthPosture,
        openSignals: signals,
        reconciliation: reconciliation
          ? {
              reconciliationId: String(reconciliation.reconciliation_id),
              status: String(reconciliation.reconciliation_status),
              financeRef: String(reconciliation.finance_ref),
            }
          : null,
        workflowHint:
          signals.length > 0
            ? 'Signal detected — create report or assign next action'
            : 'No open signals',
      },
      meta: p04Meta(),
    });
  })
);

/**
 * POST /workflow/kpi/:kpiId/next-action — Create a next action from signal/report/reconciliation.
 */
router.post(
  '/workflow/kpi/:kpiId/next-action',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'create_next_action'))) return;
    const { organizationId, userId } = getV8Context(req);
    const { kpiId } = req.params;
    const { title, sourceType, sourceRef, assigneeId, dueDate } = req.body || {};

    if (!title || !sourceType || !sourceRef) {
      return res.status(400).json({
        error: 'title, sourceType, and sourceRef are required',
        code: 'KPI_NEXT_ACTION_MISSING_FIELDS',
      });
    }

    const validSourceTypes = ['signal', 'report', 'reconciliation', 'manual'];
    if (!validSourceTypes.includes(sourceType)) {
      return res.status(400).json({
        error: `sourceType must be one of: ${validSourceTypes.join(', ')}`,
        code: 'KPI_NEXT_ACTION_INVALID_SOURCE_TYPE',
      });
    }

    // SEC-3 (L-04): the INSERT below stores `sourceRef` directly as `case_id`, and
    // `kpi_deviation_actions` has no org column. Verify the KPI belongs to the caller's
    // org first.
    const ownedKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), organizationId]
    );
    if (!ownedKpi?.id) {
      return res.status(404).json({ error: 'KPI not found', code: 'KPI_NOT_FOUND' });
    }

    // SEC-3 (wave 5 follow-up): validate `sourceRef` against the backing table implied by
    // `sourceType`, each org-scoped, so a foreign-org or nonexistent reference cannot be
    // stored as a `case_id` (the prior guard only rejected a colliding foreign-org
    // `kpi_deviation_cases` row, leaving signal/report/reconciliation refs unvalidated).
    //
    // Backing tables:
    //   signal         → `v8_kpi_signals` (PK signal_id) OR `kpi_deviation_cases` (PK id):
    //                     signals surface from BOTH the explicit signal store and derived
    //                     deviation cases (see /workflow/signals + /workflow/kpi/:id/inspect),
    //                     so either id is a legitimate org-owned reference.
    //   report         → `results_kpi_report_snapshots` (PK id)
    //   reconciliation → `v8_kpi_finance_reconciliations` (PK reconciliation_id)
    //   manual         → free-form user reference; no backing table to validate against, so
    //                     it is accepted as-is (documented intentional skip).
    const ref = String(sourceRef);
    if (sourceType === 'signal') {
      const ownedSignal = await dbGet<{ id: string }>(
        `SELECT signal_id AS id FROM v8_kpi_signals WHERE signal_id = ? AND organization_id = ?`,
        [ref, organizationId],
        { fallback: true }
      ).catch(() => null);
      const ownedCase = ownedSignal?.id
        ? null
        : await dbGet<{ id: string }>(
            `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
            [ref, organizationId]
          ).catch(() => null);
      if (!ownedSignal?.id && !ownedCase?.id) {
        return res.status(404).json({
          error: 'Signal not found',
          code: 'RESULTS_SIGNAL_NOT_FOUND',
        });
      }
    } else if (sourceType === 'report') {
      const ownedReport = await dbGet<{ id: string }>(
        `SELECT id FROM results_kpi_report_snapshots WHERE id = ? AND organization_id = ?`,
        [ref, organizationId],
        { fallback: true }
      ).catch(() => null);
      if (!ownedReport?.id) {
        return res.status(404).json({
          error: 'Report not found',
          code: 'RESULTS_REPORT_NOT_FOUND',
        });
      }
    } else if (sourceType === 'reconciliation') {
      const ownedReconciliation = await dbGet<{ id: string }>(
        `SELECT reconciliation_id AS id FROM v8_kpi_finance_reconciliations
         WHERE reconciliation_id = ? AND organization_id = ?`,
        [ref, organizationId],
        { fallback: true }
      ).catch(() => null);
      if (!ownedReconciliation?.id) {
        return res.status(404).json({
          error: 'Reconciliation not found',
          code: 'RESULTS_RECONCILIATION_NOT_FOUND',
        });
      }
    }

    // Defense in depth: even for `manual` (or any type), if `sourceRef` happens to collide
    // with a real foreign-org deviation case, reject — the value is stored as `case_id`.
    const existingCase = await dbGet<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM kpi_deviation_cases WHERE id = ?`,
      [ref]
    );
    if (existingCase && existingCase.organization_id !== organizationId) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
    }

    const actionId = uuidv4();
    await dbRun(
      `INSERT INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', datetime('now'), datetime('now'))`,
      [actionId, sourceRef, title, assigneeId || userId || null, dueDate || null]
    );

    const action: KpiNextAction = {
      actionId,
      kpiId,
      sourceType,
      sourceRef,
      title,
      assigneeId: assigneeId || userId || null,
      dueDate: dueDate || null,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    let taskId: string | null = null;
    const { createTask } = req.body || {};
    if (createTask) {
      try {
        taskId = uuidv4();
        await dbRun(
          `INSERT INTO tasks (id, organization_id, title, description, status, priority, assigned_to, due_date, created_by, source_type, source_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'todo', 'medium', ?, ?, ?, 'kpi_next_action', ?, datetime('now'), datetime('now'))`,
          [
            taskId,
            organizationId,
            title,
            `KPI next action from ${sourceType}: ${sourceRef}`,
            assigneeId || userId || null,
            dueDate || null,
            userId,
            actionId,
          ]
        );
        await dbRun(`UPDATE kpi_deviation_actions SET execution_follow_up_ref = ? WHERE id = ?`, [
          taskId,
          actionId,
        ]);
        (action as any).taskId = taskId;
      } catch (err: any) {
        logger.warn(`[V8:Results] Task creation from next-action failed: ${err?.message}`);
      }
    }

    return res.json({ data: action, meta: { ...p04Meta(), contract: P04_KPI_WORKFLOW_CONTRACT } });
  })
);

/**
 * POST /workflow/kpi/:kpiId/report — Create a report/scorecard from inspection (§8.1D).
 * Bridges the closed-loop: signal → inspect → **report** → reconcile → next action.
 */
router.post(
  '/workflow/kpi/:kpiId/report',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { kpiId } = req.params;
    const { commentary, actionPlan, reconciliationNeeded } = req.body || {};

    const kpi = await dbGet(
      `SELECT id, name, latest_value, target_value, baseline_value
       FROM initiative_kpis WHERE id = ? AND organization_id = ?`,
      [kpiId, organizationId]
    );
    if (!kpi) {
      return res.status(404).json({ error: 'KPI not found', code: 'KPI_NOT_FOUND' });
    }

    const openSignals: Array<Record<string, unknown>> = await dbAll(
      `SELECT id, severity, deviation_summary FROM kpi_deviation_cases
       WHERE kpi_id = ? AND status NOT IN ('CLOSED', 'RESOLVED')`,
      [kpiId]
    );

    const reportId = uuidv4();
    const now = new Date().toISOString();

    const reportPayload = {
      reportId,
      kpiId,
      kpiName: String(kpi.name || kpi.id),
      snapshot: {
        currentValue: kpi.latest_value != null ? Number(kpi.latest_value) : null,
        targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
        baselineValue: kpi.baseline_value != null ? Number(kpi.baseline_value) : null,
      },
      signalsSummary: openSignals.map((s) => ({
        signalId: String(s.id),
        severity: String(s.severity),
        summary: String(s.deviation_summary || ''),
      })),
      commentary: commentary || null,
      actionPlan: actionPlan || null,
      reconciliationNeeded: !!reconciliationNeeded,
      createdBy: userId,
      createdAt: now,
      status: 'draft' as const,
    };

    // `period_start` has no DB default and is NOT NULL; this is a single-point-in-time
    // per-KPI report (no period range), so it is stamped with the creation date.
    const insertResult = await dbRun(
      `INSERT INTO results_kpi_report_snapshots
         (id, organization_id, period_start, kpi_id, snapshot_json, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        reportId,
        organizationId,
        now.slice(0, 10),
        kpiId,
        JSON.stringify(reportPayload),
        userId,
        now,
      ]
    );
    if (!insertResult?.success) {
      logger.error(
        `[V8:Results] Failed to persist KPI report snapshot ${reportId}: ${insertResult?.error}`
      );
      return res.status(500).json({
        error: 'Failed to persist report snapshot',
        code: 'RESULTS_KPI_REPORT_PERSIST_FAILED',
      });
    }

    return res.json({ data: reportPayload, meta: p04Meta() });
  })
);

/**
 * GET /workflow/kpi/:kpiId/health — Degraded posture for a single KPI (§8.1F).
 */
router.get(
  '/workflow/kpi/:kpiId/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { kpiId } = req.params;

    const kpi = await dbGet(
      `SELECT id, latest_value, target_value, updated_at
       FROM initiative_kpis
       WHERE id = ? AND organization_id = ?`,
      [kpiId, organizationId]
    );

    if (!kpi) {
      return res.status(404).json({ error: 'KPI not found', code: 'KPI_NOT_FOUND' });
    }

    const reconciliation = await dbGet(
      `SELECT reconciliation_status FROM v8_kpi_finance_reconciliations
       WHERE kpi_id = ? AND organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [kpiId, organizationId]
    );

    const posture = computeKpiHealthPosture({
      currentValue: kpi.latest_value != null ? Number(kpi.latest_value) : null,
      targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
      updatedAt: kpi.updated_at ? String(kpi.updated_at) : null,
      financeLinked: !!reconciliation,
      reconciliationStatus: reconciliation
        ? (String(reconciliation.reconciliation_status) as
            | 'pending'
            | 'reconciled'
            | 'disputed'
            | 'escalated')
        : null,
    });

    const messages: Record<KpiDegradedPosture, string> = {
      nominal: 'KPI is operating normally',
      missing_data: 'KPI has missing current or target value — trend/target comparisons disabled',
      stale_data: 'KPI data is stale (>30 days since last update) — results may be unreliable',
      discrepancy_unresolved:
        'KPI has an unresolved discrepancy with Finance — reconciliation required',
      linkage_unavailable: 'KPI has finance linkage but reconciliation data is unavailable',
      permission_denied: 'You do not have permission to access this KPI',
    };

    const health: KpiHealthStatus = {
      kpiId: String(kpi.id),
      posture,
      message: messages[posture],
      lastRefreshedAt: kpi.updated_at ? String(kpi.updated_at) : null,
    };

    return res.json({ data: health, meta: p04Meta() });
  })
);

/**
 * GET /workflow/org-health — Org-wide KPI health summary (§8.1F).
 */
router.get(
  '/workflow/org-health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const kpis: Array<Record<string, unknown>> = await dbAll(
      `SELECT ik.id, ik.latest_value, ik.target_value, ik.updated_at
       FROM initiative_kpis ik
       WHERE ik.organization_id = ?`,
      [organizationId]
    );

    const reconciliations: Array<Record<string, unknown>> = await dbAll(
      `SELECT kpi_id, reconciliation_status
       FROM v8_kpi_finance_reconciliations
       WHERE organization_id = ?
       ORDER BY created_at DESC`,
      [organizationId]
    );

    const reconMap = new Map<string, string>();
    for (const r of reconciliations) {
      const kid = String(r.kpi_id);
      if (!reconMap.has(kid)) reconMap.set(kid, String(r.reconciliation_status));
    }

    const postureCount: Record<KpiDegradedPosture, number> = {
      nominal: 0,
      missing_data: 0,
      stale_data: 0,
      discrepancy_unresolved: 0,
      linkage_unavailable: 0,
      permission_denied: 0,
    };

    for (const kpi of kpis) {
      const posture = computeKpiHealthPosture({
        currentValue: kpi.latest_value != null ? Number(kpi.latest_value) : null,
        targetValue: kpi.target_value != null ? Number(kpi.target_value) : null,
        updatedAt: kpi.updated_at ? String(kpi.updated_at) : null,
        financeLinked: reconMap.has(String(kpi.id)),
        reconciliationStatus:
          (reconMap.get(String(kpi.id)) as 'pending' | 'reconciled' | 'disputed' | 'escalated') ||
          null,
      });
      postureCount[posture]++;
    }

    const unresolvedSignals: Array<Record<string, unknown>> = await dbAll(
      `SELECT COUNT(*) as cnt FROM kpi_deviation_cases dc
       JOIN initiative_kpis ik ON ik.id = dc.kpi_id
       WHERE ik.organization_id = ? AND dc.status NOT IN ('CLOSED', 'RESOLVED')`,
      [organizationId]
    );

    return res.json({
      data: {
        totalKpis: kpis.length,
        postureBreakdown: postureCount,
        unresolvedSignals: Number(unresolvedSignals[0]?.cnt ?? 0),
        degradedCount: kpis.length - postureCount.nominal,
      },
      meta: p04Meta(),
    });
  })
);

/**
 * GET /workflow/contract — Returns the P04 contract metadata for introspection.
 */
router.get(
  '/workflow/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        contract: P04_KPI_WORKFLOW_CONTRACT,
        vocabulary: ['signal', 'target', 'trend', 'report', 'reconciliation', 'next_action'],
        workflowStates: [...KPI_WORKFLOW_STATES],
        linkagePatterns: [...LINKAGE_PATTERNS],
        permissions: KPI_PERMISSION_MATRIX,
        antiDuplicateRules: KPI_ANTI_DUPLICATE_RULES,
        acceptanceChecklist: P04_ACCEPTANCE_CHECKLIST,
      },
      meta: p04Meta(),
    });
  })
);

// ==========================================
// P04-B: Reconciliation HTTP endpoints (wiring existing service)
// ==========================================

router.post(
  '/reconciliations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { kpiId, financeRef } = req.body || {};
    if (!kpiId)
      return res.status(400).json({ error: 'kpiId required', code: 'P04_KPI_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'manage_reconciliation'))) return;

    // SEC-3 (L-04): initiateReconciliation persists a row keyed on this kpiId without
    // validating ownership service-side. Verify the parent KPI belongs to the caller's org
    // before the write so a foreign-org kpiId cannot seed a reconciliation under this org.
    const ownedKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), organizationId]
    );
    if (!ownedKpi?.id) {
      return res.status(404).json({ error: 'KPI not found', code: 'RESULTS_KPI_NOT_FOUND' });
    }

    const { initiateReconciliation } = await import('../../services/v8/resultsROIService.js');
    const result = await initiateReconciliation({
      organizationId,
      kpiId: String(kpiId),
      financeRef: financeRef ? String(financeRef) : `finance:${kpiId}`,
      initiatedBy: 'results',
    });
    return res.json({ data: result, meta: resultsWriteMeta() });
  })
);

router.put(
  '/reconciliations/:reconciliationId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const reconciliationId = req.params.reconciliationId?.trim();
    const { status } = req.body || {};
    if (!reconciliationId)
      return res
        .status(400)
        .json({ error: 'reconciliationId required', code: 'P04_RECONCILIATION_ID_REQUIRED' });
    if (!status)
      return res.status(400).json({ error: 'status required', code: 'P04_STATUS_REQUIRED' });

    const resolvedBy = req.body?.resolvedBy ?? 'finance';
    if (resolvedBy !== 'finance' && resolvedBy !== 'results') {
      return res.status(400).json({
        error: 'resolvedBy must be finance or results',
        code: 'P04_RESOLVED_BY_INVALID',
      });
    }

    if (!(await p04AssertKpiPermission(req, res, 'manage_reconciliation'))) return;

    const { resolveReconciliation } = await import('../../services/v8/resultsROIService.js');
    const result = await resolveReconciliation(reconciliationId, organizationId, status);
    return res.json({ data: result, meta: resultsWriteMeta() });
  })
);

// P04-B: KPI Signals (closed-loop workflow)

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { getKpiSignals } = await import('../../services/v8/resultsROIService.js');
    const filters: Record<string, string> = {};
    if (req.query.kpiId) filters.kpiId = String(req.query.kpiId);
    if (req.query.status) filters.status = String(req.query.status);
    if (req.query.signalType) filters.signalType = String(req.query.signalType);
    const signals = await getKpiSignals(organizationId, filters);
    return res.json({ data: signals, meta: resultsMeta() });
  })
);

router.post(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { kpiId, signalType, severity, description, evidencePointers } = req.body || {};
    if (!kpiId || !signalType)
      return res
        .status(400)
        .json({ error: 'kpiId and signalType required', code: 'P04_SIGNAL_PARAMS_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'create_signal'))) return;

    // SEC-3 (L-04): createKpiSignal inserts kpi_id into v8_kpi_signals without validating
    // ownership service-side. Verify the parent KPI belongs to the caller's org before the
    // write so a foreign-org kpiId cannot be attached to a signal under this org.
    const ownedKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), organizationId]
    );
    if (!ownedKpi?.id) {
      return res.status(404).json({ error: 'KPI not found', code: 'RESULTS_KPI_NOT_FOUND' });
    }

    const { createKpiSignal } = await import('../../services/v8/resultsROIService.js');
    const signal = await createKpiSignal({
      organizationId,
      kpiId: String(kpiId),
      signalType,
      severity: severity || 'medium',
      description: description || '',
      evidencePointers: Array.isArray(evidencePointers) ? evidencePointers : [],
    });
    return res.json({ data: signal, meta: resultsWriteMeta() });
  })
);

router.post(
  '/signals/:signalId/acknowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const signalId = req.params.signalId?.trim();
    if (!signalId)
      return res.status(400).json({ error: 'signalId required', code: 'P04_SIGNAL_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'comment'))) return;

    const { acknowledgeKpiSignal } = await import('../../services/v8/resultsROIService.js');
    const signal = await acknowledgeKpiSignal(
      signalId,
      organizationId,
      userId,
      req.body?.reason || ''
    );
    return res.json({ data: signal, meta: resultsWriteMeta() });
  })
);

// P04-B: Next Actions

router.get(
  '/next-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { getKpiNextActions } = await import('../../services/v8/resultsROIService.js');
    const filters: Record<string, string> = {};
    if (req.query.kpiId) filters.kpiId = String(req.query.kpiId);
    if (req.query.signalId) filters.signalId = String(req.query.signalId);
    if (req.query.status) filters.status = String(req.query.status);
    const actions = await getKpiNextActions(organizationId, filters);
    return res.json({ data: actions, meta: resultsMeta() });
  })
);

router.post(
  '/next-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const {
      signalId,
      kpiId,
      actionType,
      description,
      assignedTo,
      financeConsequenceRef,
      executionFollowUpRef,
    } = req.body || {};
    if (!signalId || !kpiId || !actionType)
      return res.status(400).json({
        error: 'signalId, kpiId, actionType required',
        code: 'P04_ACTION_PARAMS_REQUIRED',
      });
    if (!(await p04AssertKpiPermission(req, res, 'create_next_action'))) return;

    // SEC-3 (L-04): createKpiNextAction inserts kpi_id + signal_id into v8_kpi_next_actions
    // without validating ownership service-side. Verify both parents belong to the caller's
    // org so a foreign-org kpiId/signalId cannot be referenced by an action under this org.
    const ownedKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), organizationId]
    );
    if (!ownedKpi?.id) {
      return res.status(404).json({ error: 'KPI not found', code: 'RESULTS_KPI_NOT_FOUND' });
    }
    const ownedSignal = await dbGet<{ id: string }>(
      `SELECT signal_id AS id FROM v8_kpi_signals WHERE signal_id = ? AND organization_id = ?`,
      [String(signalId), organizationId],
      { fallback: true }
    ).catch(() => null);
    if (!ownedSignal?.id) {
      return res.status(404).json({ error: 'Signal not found', code: 'RESULTS_SIGNAL_NOT_FOUND' });
    }

    const { createKpiNextAction } = await import('../../services/v8/resultsROIService.js');
    const action = await createKpiNextAction({
      organizationId,
      signalId: String(signalId),
      kpiId: String(kpiId),
      actionType,
      description: description || '',
      assignedTo: assignedTo || undefined,
      createdBy: userId,
      financeConsequenceRef: financeConsequenceRef || undefined,
      executionFollowUpRef: executionFollowUpRef || undefined,
    });
    return res.json({ data: action, meta: resultsWriteMeta() });
  })
);

router.post(
  '/next-actions/:actionId/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const actionId = req.params.actionId?.trim();
    if (!actionId)
      return res.status(400).json({ error: 'actionId required', code: 'P04_ACTION_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'create_next_action'))) return;

    const { completeKpiNextAction } = await import('../../services/v8/resultsROIService.js');
    await completeKpiNextAction(actionId, organizationId);
    return res.json({ data: { success: true }, meta: resultsWriteMeta() });
  })
);

// ============================================================================
// M14 → M15 closure-handoff benefits inbox (Decision B1b).
//
// The write side (InitiativeController.updateInitiativeStatus →
// executionResultsBridge.handoffFromClosure) materializes an initiative's
// planned KPIs into `initiative_benefits` tagged
// `source_tag = 'M14_CLOSURE_HANDOFF'` when the initiative closes (→ DONE).
// This is the M15 READER: it surfaces those benefits in the Results UI and
// lets a KPI owner either promote a benefit into a tracked sustainment KPI or
// dismiss it.
//
// Inbox lifecycle uses `initiative_benefits.status`:
//   'tracking'  → new / awaiting triage (shown in the inbox)
//   'promoted'  → converted into a sustainment KPI (leaves the inbox)
//   'dismissed' → rejected (leaves the inbox)
// ============================================================================

/** Value written to `initiative_benefits.source_tag` by the M14 closure handoff. */
const CLOSURE_HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

/** Benefit statuses that keep a closure benefit in the inbox (awaiting triage). */
const INBOX_OPEN_BENEFIT_STATUSES: readonly string[] = ['tracking', 'not_started'];

interface ClosureBenefitRow {
  id: string;
  initiative_id: string;
  name: string;
  description: string | null;
  kpi_id: string | null;
  target_value: number | null;
  status: string | null;
  created_at: string | null;
  initiative_name: string | null;
  initiative_closed_at: string | null;
  source_kpi_unit: string | null;
}

/**
 * GET /api/v8/results/benefits/inbox
 * Org-scoped list of closure-handoff benefits awaiting triage
 * (`source_tag = 'M14_CLOSURE_HANDOFF'`, still in an open status). Each row
 * carries the source KPI name, owning initiative, target and the initiative's
 * closure date so M15 can render the "incoming benefits" inbox.
 */
router.get(
  '/benefits/inbox',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const placeholders = INBOX_OPEN_BENEFIT_STATUSES.map(() => '?').join(', ');
    // Schema drift guard: `initiatives.completed_at` is absent on older
    // deployments — a hardcoded reference 42703s the whole inbox read and the
    // M14→M15 handoff surfaces as silently empty. Fall back through the other
    // closure timestamps, else NULL.
    const initiativeColumns = await getTableColumns('initiatives');
    const closedAtExpr = initiativeColumns.has('completed_at')
      ? 'i.completed_at'
      : initiativeColumns.has('done_at')
        ? 'i.done_at'
        : initiativeColumns.has('updated_at')
          ? 'i.updated_at'
          : 'NULL';
    let rows: ClosureBenefitRow[] = [];
    try {
      rows = (await dbAll<ClosureBenefitRow>(
        `SELECT b.id, b.initiative_id, b.name, b.description, b.kpi_id,
                b.target_value, b.status, b.created_at,
                COALESCE(i.title, i.name) AS initiative_name,
                ${closedAtExpr} AS initiative_closed_at,
                k.unit AS source_kpi_unit
           FROM initiative_benefits b
           LEFT JOIN initiatives i ON i.id = b.initiative_id
           LEFT JOIN initiative_kpis k ON k.id = b.kpi_id
          WHERE b.organization_id = ?
            AND b.source_tag = ?
            AND (b.status IS NULL OR b.status IN (${placeholders}))
          ORDER BY b.created_at DESC`,
        [organizationId, CLOSURE_HANDOFF_SOURCE, ...INBOX_OPEN_BENEFIT_STATUSES],
        { fallback: true }
      )) as ClosureBenefitRow[];
    } catch (err) {
      logger.error(`[V8:Results] Closure-benefit inbox read failed: ${String(err)}`);
      return res.status(500).json({
        error: 'Failed to load closure-handoff benefits',
        code: 'RESULTS_BENEFITS_INBOX_READ_FAILED',
      });
    }

    const items = (rows || []).map((row) => ({
      id: row.id,
      initiativeId: row.initiative_id,
      initiativeName: row.initiative_name || null,
      kpiName: row.name,
      sourceKpiId: row.kpi_id || null,
      unit: row.source_kpi_unit || null,
      description: row.description || null,
      targetValue: row.target_value ?? null,
      status: row.status || 'tracking',
      closedAt: row.initiative_closed_at || null,
      createdAt: row.created_at || null,
    }));

    return res.json({ data: { items }, meta: resultsMeta() });
  })
);

/**
 * POST /api/v8/results/benefits/:benefitId/promote
 * Promote a closure-handoff benefit into a tracked sustainment KPI
 * (`initiative_kpis`), then mark the benefit `promoted` so it leaves the inbox.
 *
 * Dedup: if the benefit is already `promoted` (or a sustainment KPI derived
 * from this benefit already exists) the call is idempotent and re-returns the
 * existing KPI id rather than creating a duplicate.
 */
router.post(
  '/benefits/:benefitId/promote',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'edit_definition'))) return;
    const { organizationId, userId } = getV8Context(req);
    const benefitId = typeof req.params.benefitId === 'string' ? req.params.benefitId.trim() : '';
    if (!benefitId) {
      return res.status(400).json({
        error: 'benefitId is required',
        code: 'RESULTS_BENEFIT_ID_REQUIRED',
      });
    }

    const benefit = await dbGet<{
      id: string;
      initiative_id: string;
      name: string;
      description: string | null;
      kpi_id: string | null;
      target_value: number | null;
      status: string | null;
      source_tag: string | null;
    }>(
      `SELECT id, initiative_id, name, description, kpi_id, target_value, status, source_tag
         FROM initiative_benefits
        WHERE id = ? AND organization_id = ?`,
      [benefitId, organizationId],
      { fallback: true }
    );

    if (!benefit?.id || benefit.source_tag !== CLOSURE_HANDOFF_SOURCE) {
      return res.status(404).json({
        error: `Closure-handoff benefit ${benefitId} not found`,
        code: 'RESULTS_BENEFIT_NOT_FOUND',
      });
    }

    // Dedup 1: benefit already promoted — return its sustainment KPI if we can
    // find one, otherwise just acknowledge idempotently.
    if (String(benefit.status || '').toLowerCase() === 'promoted') {
      const existing = await dbGet<{ id: string }>(
        `SELECT id FROM initiative_kpis
          WHERE organization_id = ? AND initiative_id = ? AND name = ?
          ORDER BY created_at DESC LIMIT 1`,
        [organizationId, benefit.initiative_id, benefit.name],
        { fallback: false }
      );
      return res.status(200).json({
        data: { kpiId: existing?.id || null, alreadyPromoted: true },
        meta: resultsWriteMeta(),
      });
    }

    // Dedup 2: a sustainment KPI with the same name already exists for this
    // initiative (e.g. promoted then benefit reverted) — reuse it.
    const dup = await dbGet<{ id: string }>(
      `SELECT id FROM initiative_kpis
        WHERE organization_id = ? AND initiative_id = ? AND name = ?
        ORDER BY created_at DESC LIMIT 1`,
      [organizationId, benefit.initiative_id, benefit.name],
      { fallback: false }
    );

    // RES-02: canonical write goes through kpiDefinitionService — no direct
    // SQL against initiative_kpis here anymore (this was the SECOND, forked
    // benefit-promotion writer; benefitsRegisterService.promoteBenefitToKpi
    // is the first — both create through the same canonical service now).
    let kpiId = dup?.id || null;
    if (!kpiId) {
      const promoted = await createKpiDefinition({
        organizationId,
        initiativeId: benefit.initiative_id,
        actorUserId: userId || null,
        name: benefit.name,
        description: benefit.description ?? null,
        targetValue: benefit.target_value ?? null,
        measurementFrequency: 'MONTHLY',
        alertDirection: 'BELOW',
        source: 'v8_results_benefit_promotion',
        reason: `closure-handoff-benefit-promotion:${benefitId}`,
      });
      kpiId = promoted.id;
    }

    await dbRun(
      `UPDATE initiative_benefits
          SET status = 'promoted', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`,
      [benefitId, organizationId]
    );

    return res.status(201).json({
      data: { kpiId, alreadyPromoted: false },
      meta: resultsWriteMeta(),
    });
  })
);

/**
 * POST /api/v8/results/benefits/:benefitId/dismiss
 * Reject a closure-handoff benefit — marks it `dismissed` so it leaves the inbox.
 */
router.post(
  '/benefits/:benefitId/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await p04AssertKpiPermission(req, res, 'edit_definition'))) return;
    const { organizationId } = getV8Context(req);
    const benefitId = typeof req.params.benefitId === 'string' ? req.params.benefitId.trim() : '';
    if (!benefitId) {
      return res.status(400).json({
        error: 'benefitId is required',
        code: 'RESULTS_BENEFIT_ID_REQUIRED',
      });
    }

    const benefit = await dbGet<{ id: string; source_tag: string | null }>(
      `SELECT id, source_tag FROM initiative_benefits
        WHERE id = ? AND organization_id = ?`,
      [benefitId, organizationId],
      { fallback: true }
    );
    if (!benefit?.id || benefit.source_tag !== CLOSURE_HANDOFF_SOURCE) {
      return res.status(404).json({
        error: `Closure-handoff benefit ${benefitId} not found`,
        code: 'RESULTS_BENEFIT_NOT_FOUND',
      });
    }

    await dbRun(
      `UPDATE initiative_benefits
          SET status = 'dismissed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`,
      [benefitId, organizationId]
    );

    return res.json({ data: { success: true }, meta: resultsWriteMeta() });
  })
);

// P04-B: KPI Workflow Status (degraded states)

router.get(
  '/kpis/:kpiId/workflow-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = req.params.kpiId?.trim();
    if (!kpiId)
      return res.status(400).json({ error: 'kpiId required', code: 'P04_KPI_ID_REQUIRED' });

    const { getKpiWorkflowStatus } = await import('../../services/v8/resultsROIService.js');
    const status = await getKpiWorkflowStatus(kpiId, organizationId);
    return res.json({ data: status, meta: resultsMeta() });
  })
);

export default router;
