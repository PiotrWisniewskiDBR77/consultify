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
import { resultsEnterpriseService } from '../../services/resultsEnterpriseService.js';
import { handleTimeSeriesRecorded } from '../../services/results/kpiDeviationService.js';
import {
  createKpiReportSnapshot,
  getKpiReportSnapshot,
} from '../../services/results/kpiReportSnapshotService.js';
import {
  getResultsDashboard,
  getResultsKpiCatalog,
  getResultsKpiDrawerDetail,
  getROIInitiativeDetail,
  getROIPortfolioSummary,
} from '../../services/v8/resultsROIService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

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

/** P04-B: role for `canPerformKpiAction` (header override; default viewer). */
const P04_KPI_ROLE_HEADER = 'x-kpi-role';
const P04_CANON_KPI_ROLES: readonly KpiPermissionRole[] = [
  'kpi_owner',
  'finance_owner',
  'viewer',
  'commenter',
];

function p04KpiRoleFromRequest(req: AuthRequest): KpiPermissionRole {
  const raw = String(req.headers[P04_KPI_ROLE_HEADER] ?? 'viewer').toLowerCase();
  return (P04_CANON_KPI_ROLES as readonly string[]).includes(raw)
    ? (raw as KpiPermissionRole)
    : 'viewer';
}

type P04KpiGuardedAction =
  | 'create_signal'
  | 'create_next_action'
  | 'manage_reconciliation'
  | 'comment';

async function p04AssertKpiPermission(
  req: AuthRequest,
  res: Response,
  action: P04KpiGuardedAction
): Promise<boolean> {
  const { canPerformKpiAction } = await import('../../services/v8/kpiWorkflowCanon.js');
  const role = p04KpiRoleFromRequest(req);
  if (!canPerformKpiAction(role, action)) {
    res.status(403).json({ error: 'Permission denied', code: 'P04_PERMISSION_DENIED' });
    return false;
  }
  return true;
}

function deriveKpiPeriodKey(
  periodStart?: string | null,
  measurementFrequency?: string | null
): string | null {
  const start = String(periodStart || '').slice(0, 10);
  if (!start) return null;
  const [year, month = '01', day = '01'] = start.split('-');
  const frequency = String(measurementFrequency || 'MONTHLY').toUpperCase();

  if (frequency === 'DAILY') return start;
  if (frequency === 'WEEKLY') {
    return `${year}-W${String(Math.max(1, Math.ceil(Number(day) / 7))).padStart(2, '0')}`;
  }
  if (frequency === 'QUARTERLY')
    return `${year}-Q${String(Math.max(1, Math.ceil(Number(month) / 3)))}`;
  return `${year}-${month}`;
}

/**
 * GET /api/v8/results/dashboard
 * Composed KPI scorecard, active deviation count, ROI dashboard, reconciliation health,
 * and recent executive review pack rollups for the V8 org context.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const snapshot = await getResultsDashboard(organizationId);
    return res.json({
      data: { snapshot },
      meta: resultsMeta(),
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
    const catalog = await getResultsKpiCatalog(organizationId, { kpiId });
    return res.json({
      data: catalog,
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
    const { organizationId } = getV8Context(req);
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

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `
      INSERT INTO initiative_kpis (
        id, initiative_id, organization_id,
        name, description, unit,
        baseline_value, target_value, measurement_frequency,
        alert_threshold, alert_direction,
        owner_user_id, direction, threshold_mode,
        amber_threshold_pct, red_threshold_pct,
        amber_threshold_abs, red_threshold_abs,
        created_at, updated_at
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        id,
        organizationId,
        safeName,
        description ? String(description).trim() : null,
        unit ? String(unit).trim() : null,
        baselineValue != null && baselineValue !== '' ? Number(baselineValue) : null,
        targetValue != null && targetValue !== '' ? Number(targetValue) : null,
        measurementFrequency || 'MONTHLY',
        alertThreshold != null && alertThreshold !== '' ? Number(alertThreshold) : null,
        alertDirection || 'BELOW',
        ownerUserId || null,
        direction || 'HIGHER_IS_BETTER',
        thresholdMode || 'PERCENT_FROM_TARGET',
        amberThresholdPct != null && amberThresholdPct !== '' ? Number(amberThresholdPct) : null,
        redThresholdPct != null && redThresholdPct !== '' ? Number(redThresholdPct) : null,
        amberThresholdAbs != null && amberThresholdAbs !== '' ? Number(amberThresholdAbs) : null,
        redThresholdAbs != null && redThresholdAbs !== '' ? Number(redThresholdAbs) : null,
      ]
    );

    return res.json({
      data: { id },
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
    } = req.body || {};

    const row = await dbGet<any>(
      `
      SELECT k.id, k.name, k.description, k.unit, k.baseline_value, k.target_value,
             k.measurement_frequency, k.direction, k.threshold_mode,
             k.amber_threshold_pct, k.red_threshold_pct, k.amber_threshold_abs, k.red_threshold_abs
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

    await dbRun(
      `
      UPDATE initiative_kpis
      SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        unit = COALESCE(?, unit),
        baseline_value = COALESCE(?, baseline_value),
        target_value = COALESCE(?, target_value),
        measurement_frequency = COALESCE(?, measurement_frequency),
        alert_threshold = COALESCE(?, alert_threshold),
        alert_direction = COALESCE(?, alert_direction),
        owner_user_id = COALESCE(?, owner_user_id),
        direction = COALESCE(?, direction),
        threshold_mode = COALESCE(?, threshold_mode),
        amber_threshold_pct = COALESCE(?, amber_threshold_pct),
        red_threshold_pct = COALESCE(?, red_threshold_pct),
        amber_threshold_abs = COALESCE(?, amber_threshold_abs),
        red_threshold_abs = COALESCE(?, red_threshold_abs),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        name != null && String(name).trim() ? String(name).trim() : null,
        description != null ? String(description).trim() : null,
        unit != null ? String(unit).trim() : null,
        baselineValue != null && baselineValue !== '' ? Number(baselineValue) : null,
        targetValue != null && targetValue !== '' ? Number(targetValue) : null,
        measurementFrequency || null,
        alertThreshold != null && alertThreshold !== '' ? Number(alertThreshold) : null,
        alertDirection || null,
        ownerUserId || null,
        direction || null,
        thresholdMode || null,
        amberThresholdPct != null && amberThresholdPct !== '' ? Number(amberThresholdPct) : null,
        redThresholdPct != null && redThresholdPct !== '' ? Number(redThresholdPct) : null,
        amberThresholdAbs != null && amberThresholdAbs !== '' ? Number(amberThresholdAbs) : null,
        redThresholdAbs != null && redThresholdAbs !== '' ? Number(redThresholdAbs) : null,
        kpiId,
      ]
    );

    const afterState = {
      name: name != null && String(name).trim() ? String(name).trim() : row.name,
      description: description != null ? String(description).trim() : row.description,
      unit: unit != null ? String(unit).trim() : row.unit,
      baselineValue:
        baselineValue != null && baselineValue !== '' ? Number(baselineValue) : row.baseline_value,
      targetValue: targetValue != null && targetValue !== '' ? Number(targetValue) : row.target_value,
      measurementFrequency: measurementFrequency || row.measurement_frequency,
      direction: direction || row.direction,
      thresholdMode: thresholdMode || row.threshold_mode,
      amberThresholdPct:
        amberThresholdPct != null && amberThresholdPct !== '' ? Number(amberThresholdPct) : row.amber_threshold_pct,
      redThresholdPct:
        redThresholdPct != null && redThresholdPct !== '' ? Number(redThresholdPct) : row.red_threshold_pct,
      amberThresholdAbs:
        amberThresholdAbs != null && amberThresholdAbs !== '' ? Number(amberThresholdAbs) : row.amber_threshold_abs,
      redThresholdAbs:
        redThresholdAbs != null && redThresholdAbs !== '' ? Number(redThresholdAbs) : row.red_threshold_abs,
    };
    const beforeDefinition = {
      name: row.name,
      description: row.description,
      unit: row.unit,
      measurementFrequency: row.measurement_frequency,
      direction: row.direction,
    };
    const afterDefinition = {
      name: afterState.name,
      description: afterState.description,
      unit: afterState.unit,
      measurementFrequency: afterState.measurementFrequency,
      direction: afterState.direction,
    };
    const beforeTargets = {
      baselineValue: row.baseline_value,
      targetValue: row.target_value,
      thresholdMode: row.threshold_mode,
      amberThresholdPct: row.amber_threshold_pct,
      redThresholdPct: row.red_threshold_pct,
      amberThresholdAbs: row.amber_threshold_abs,
      redThresholdAbs: row.red_threshold_abs,
    };
    const afterTargets = {
      baselineValue: afterState.baselineValue,
      targetValue: afterState.targetValue,
      thresholdMode: afterState.thresholdMode,
      amberThresholdPct: afterState.amberThresholdPct,
      redThresholdPct: afterState.redThresholdPct,
      amberThresholdAbs: afterState.amberThresholdAbs,
      redThresholdAbs: afterState.redThresholdAbs,
    };
    if (JSON.stringify(beforeDefinition) !== JSON.stringify(afterDefinition)) {
      await resultsEnterpriseService.createMetricAuditEntry(organizationId, {
        kpiId,
        section: 'definition',
        eventType: 'definition_updated',
        source: 'v8_results_update',
        actorUserId: userId || null,
        summary: `Definition updated for ${afterState.name || row.name || kpiId}`,
        before: beforeDefinition,
        after: afterDefinition,
      }).catch(() => null);
    }
    if (JSON.stringify(beforeTargets) !== JSON.stringify(afterTargets)) {
      await resultsEnterpriseService.createMetricAuditEntry(organizationId, {
        kpiId,
        section: 'targets',
        eventType: 'targets_updated',
        source: 'v8_results_update',
        actorUserId: userId || null,
        summary: `Targets updated for ${afterState.name || row.name || kpiId}`,
        before: beforeTargets,
        after: afterTargets,
      }).catch(() => null);
    }

    return res.json({
      data: { success: true },
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

    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      organizationId,
    ]).catch(() => null);

    await dbRun(`DELETE FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      organizationId,
    ]).catch(() => null);

    const cases = await dbAll<any>(
      `SELECT id FROM kpi_deviation_cases WHERE organization_id = ? AND kpi_id = ?`,
      [organizationId, kpiId]
    ).catch(() => []);
    const caseIds = (cases || []).map((c: any) => String(c.id)).filter(Boolean);
    if (caseIds.length) {
      await dbRun(
        `DELETE FROM kpi_deviation_actions WHERE case_id IN (${caseIds.map(() => '?').join(',')})`,
        caseIds
      ).catch(() => null);
    }

    await dbRun(`DELETE FROM kpi_deviation_cases WHERE organization_id = ? AND kpi_id = ?`, [
      organizationId,
      kpiId,
    ]).catch(() => null);

    await dbRun(`DELETE FROM initiative_kpis WHERE id = ?`, [kpiId]);

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
    const { organizationId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
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
    const { organizationId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    const { rcaText } = req.body || {};
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
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

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
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
    const { organizationId } = getV8Context(req);
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
      `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
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
    const { organizationId } = getV8Context(req);
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
      SELECT a.id
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
    const { organizationId } = getV8Context(req);
    const caseId = typeof req.params.caseId === 'string' ? req.params.caseId.trim() : '';
    if (!caseId) {
      return res.status(400).json({
        error: 'caseId is required',
        code: 'RESULTS_DEVIATION_CASE_ID_REQUIRED',
      });
    }

    const row = await dbGet<any>(
      `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
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
      `SELECT id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, organizationId]
    );
    if (!row?.id) {
      return res.status(404).json({
        error: 'Deviation case not found',
        code: 'RESULTS_DEVIATION_CASE_NOT_FOUND',
      });
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
          linkedInitiativeId || null,
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

    return res.json({
      data: { success: true },
      meta: resultsWriteMeta(),
    });
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
    if (!kpiId) {
      return res.status(400).json({
        error: 'kpiId is required',
        code: 'RESULTS_KPI_ID_REQUIRED',
      });
    }
    const detail = await getResultsKpiDrawerDetail(kpiId, organizationId);
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

    const kpiMeta = await dbGet<{ measurement_frequency?: string | null }>(
      `SELECT measurement_frequency FROM initiative_kpis WHERE id = ? LIMIT 1`,
      [kpiId]
    ).catch(() => null);
    const periodKey = deriveKpiPeriodKey(periodStart, kpiMeta?.measurement_frequency);

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        kpiId,
        organizationId,
        Number(value),
        periodStart,
        periodEnd,
        source || 'manual',
        notes ? String(notes) : null,
        userId || null,
      ]
    );

    const kpiCols = await dbAll<{ name: string }>('PRAGMA table_info(initiative_kpis)', []).catch(
      () => []
    );
    const hasCurrentValue = (kpiCols || []).some((column) => column?.name === 'current_value');
    if (hasCurrentValue) {
      await dbRun(
        `UPDATE initiative_kpis SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(value), kpiId]
      ).catch(() => null);
    }

    try {
      await handleTimeSeriesRecorded({
        db: {
          get: (sql: string, params: any[]) => dbGet(sql, params),
          all: (sql: string, params: any[]) => dbAll(sql, params),
          run: (sql: string, params: any[]) => dbRun(sql, params),
        } as any,
        orgId: organizationId,
        kpiId: String(kpiId),
        value: Number(value),
        periodStart,
        periodEnd,
        recordedByUserId: userId || null,
      });
    } catch {
      // Do not fail the write on deviation side effects.
    }
    await resultsEnterpriseService.createMetricAuditEntry(organizationId, {
      kpiId,
      section: 'history',
      eventType: 'measurement_recorded',
      source: source ? String(source) : 'manual',
      actorUserId: userId || null,
      summary: `Measurement recorded for ${periodStart}`,
      before: {},
      after: {
        value: Number(value),
        periodStart,
        periodEnd,
        source: source || 'manual',
      },
    }).catch(() => null);

    return res.json({
      data: {
        id,
        kpiId,
        value: Number(value),
        measuredAt: periodStart,
        periodStart,
        periodEnd,
        periodKey,
      },
      meta: resultsWriteMeta(),
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
    const portfolio = await getROIPortfolioSummary(organizationId);
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
    const { organizationId, userId } = getV8Context(req);
    const { periodStart, periodEnd, title, filters, kpiIds } = req.body || {};
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

    const created = await createKpiReportSnapshot({
      organizationId,
      periodStart: safeStart,
      periodEnd: periodEnd ? String(periodEnd).slice(0, 10) : null,
      title: title ? String(title) : null,
      createdBy: userId,
      filters: filters && typeof filters === 'object' ? filters : null,
      kpiIds: selectedKpiIds && selectedKpiIds.length ? selectedKpiIds : null,
    });

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
    const { organizationId, userId } = getV8Context(req);
    const snapshotId = typeof req.params.snapshotId === 'string' ? req.params.snapshotId.trim() : '';
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

    const reportId = await createV8KpiReportArtifact({ organizationId, userId, created: refreshed });
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
  P04_KPI_WORKFLOW_CONTRACT,
  computeKpiHealthPosture,
  canPerformKpiAction,
  KPI_WORKFLOW_TRANSITIONS,
  P04_ACCEPTANCE_CHECKLIST,
  KPI_ANTI_DUPLICATE_RULES,
  LINKAGE_PATTERNS,
  KPI_PERMISSION_MATRIX,
  type KpiDegradedPosture,
  type KpiSignal,
  type KpiNextAction,
  type KpiReport,
  type KpiReconciliation,
  type KpiTarget,
  type KpiTrend,
  type KpiPermissionRole,
  type KpiWorkflowState,
  type KpiHealthStatus,
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
      severity: (String(d.severity || 'medium').toLowerCase() as KpiSignal['severity']),
      summary: String(d.deviation_summary || `Deviation on KPI ${d.kpi_id}`),
      detectedAt: String(d.detected_at || d.created_at),
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
      `SELECT ik.*, ik.id as kpi_id,
              COALESCE(ik.name, ik.id) as name,
              ik.target_value, ik.baseline_value, ik.latest_value,
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
      deviation: m.value != null && kpi.target_value != null
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
        ? (String(reconciliation.reconciliation_status) as 'pending' | 'reconciled' | 'disputed' | 'escalated')
        : null,
    });

    const signals: KpiSignal[] = openSignals.map((s) => ({
      signalId: String(s.id),
      kpiId: String(kpi.kpi_id),
      signalType: 'deviation' as const,
      severity: String(s.severity || 'medium').toLowerCase() as KpiSignal['severity'],
      summary: String(s.deviation_summary || 'Deviation detected'),
      detectedAt: String(s.detected_at || ''),
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
        workflowHint: signals.length > 0
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

    await dbRun(
      `INSERT INTO results_kpi_report_snapshots (id, organization_id, kpi_id, snapshot_json, status, created_by, created_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [reportId, organizationId, kpiId, JSON.stringify(reportPayload), userId, now]
    );

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
        ? (String(reconciliation.reconciliation_status) as 'pending' | 'reconciled' | 'disputed' | 'escalated')
        : null,
    });

    const messages: Record<KpiDegradedPosture, string> = {
      nominal: 'KPI is operating normally',
      missing_data: 'KPI has missing current or target value — trend/target comparisons disabled',
      stale_data: 'KPI data is stale (>30 days since last update) — results may be unreliable',
      discrepancy_unresolved: 'KPI has an unresolved discrepancy with Finance — reconciliation required',
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
        reconciliationStatus: (reconMap.get(String(kpi.id)) as 'pending' | 'reconciled' | 'disputed' | 'escalated') || null,
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
        workflowStates: [...KPI_WORKFLOW_TRANSITIONS.signal_detected, 'signal_detected'],
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
    if (!kpiId) return res.status(400).json({ error: 'kpiId required', code: 'P04_KPI_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'manage_reconciliation'))) return;

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
      return res.status(400).json({ error: 'reconciliationId required', code: 'P04_RECONCILIATION_ID_REQUIRED' });
    if (!status) return res.status(400).json({ error: 'status required', code: 'P04_STATUS_REQUIRED' });

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
      return res.status(400).json({ error: 'kpiId and signalType required', code: 'P04_SIGNAL_PARAMS_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'create_signal'))) return;

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
    if (!signalId) return res.status(400).json({ error: 'signalId required', code: 'P04_SIGNAL_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'comment'))) return;

    const { acknowledgeKpiSignal } = await import('../../services/v8/resultsROIService.js');
    const signal = await acknowledgeKpiSignal(signalId, organizationId, userId, req.body?.reason || '');
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
    const { signalId, kpiId, actionType, description, assignedTo, financeConsequenceRef, executionFollowUpRef } =
      req.body || {};
    if (!signalId || !kpiId || !actionType)
      return res.status(400).json({ error: 'signalId, kpiId, actionType required', code: 'P04_ACTION_PARAMS_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'create_next_action'))) return;

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
    if (!actionId) return res.status(400).json({ error: 'actionId required', code: 'P04_ACTION_ID_REQUIRED' });
    if (!(await p04AssertKpiPermission(req, res, 'create_next_action'))) return;

    const { completeKpiNextAction } = await import('../../services/v8/resultsROIService.js');
    await completeKpiNextAction(actionId, organizationId);
    return res.json({ data: { success: true }, meta: resultsWriteMeta() });
  })
);

// P04-B: KPI Workflow Status (degraded states)

router.get(
  '/kpis/:kpiId/workflow-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kpiId = req.params.kpiId?.trim();
    if (!kpiId) return res.status(400).json({ error: 'kpiId required', code: 'P04_KPI_ID_REQUIRED' });

    const { getKpiWorkflowStatus } = await import('../../services/v8/resultsROIService.js');
    const status = await getKpiWorkflowStatus(kpiId, organizationId);
    return res.json({ data: status, meta: resultsMeta() });
  })
);

export default router;
