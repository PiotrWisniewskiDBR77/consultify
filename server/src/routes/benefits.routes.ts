/**
 * Benefits Routes — Bundle 12 (LEGACY — /api/benefits path)
 *
 * @deprecated Use the canonical V8 routes:
 *   GET /api/results          (KPI + time-series, results-kpi-reports.routes)
 *   GET /api/results-value    (value intelligence + scorecard)
 *   GET /api/results-strategic (BSC + BDN + narrative)
 *   GET /api/results-extended  (signals, run-rate, scenarios, AI insights)
 *
 * This router stays mounted for backwards-compat with legacy FE paths.
 * Do NOT add new routes here — add to the V8 canonical routes above.
 *
 * T046: ROI Tracking, T047: KPI Time Series, T048: Attribution, T049: Financial Mapping
 */

import { type NextFunction, type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { computeAttribution } from '../services/kpiAttributionService.js';
import {
  callRemoteTool,
  makeIrisHeaders,
  parseStreamableHttpConfig,
} from '../services/mcp/mcpProviderClient.js';
import {
  archiveDefinition as archiveKpiDefinition,
  createDefinition as createKpiDefinition,
  getCurrentDefinition as getCurrentKpiDefinition,
  KpiDefinitionArchivedError,
  KpiDefinitionNotFoundError,
  KpiDefinitionVersionConflictError,
  updateDefinition as updateKpiDefinition,
} from '../services/results/kpiDefinitionService.js';
import {
  deriveKpiPeriodKey,
  KpiMeasurementKpiNotFoundError,
  recordKpiMeasurement,
} from '../services/results/kpiMeasurementWriterService.js';
import { assertKpiPermission } from '../services/results/kpiPermissions.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.user?.userId || '';
}

/**
 * KPI lifecycle statuses that represent a finalized / locked KPI set. Mirrors
 * RESULTS_LOCKED_KPI_STATUSES in v8/results.routes.ts and the workflow doctrine
 * (`getKpiWorkflowStatus` §8.1F): once a KPI moves into benefits realization or
 * formal review its definition/targets are frozen and must not be edited
 * directly — doing so would corrupt the baseline used for value reconciliation.
 */
const BENEFITS_LOCKED_KPI_STATUSES: readonly string[] = [
  'benefits_realization',
  'review',
  'locked',
];

// deriveKpiPeriodKey moved to kpiMeasurementWriterService.js (RES-003) — this
// file's copy and the one in v8/results.routes.ts were byte-identical
// duplicates; both now import the single shared implementation.

// ============================================================
// V3-H01: KPI LIST + CREATE (global KPI)
// ============================================================

router.get(
  '/kpis',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const rows = await dbAll<any>(
      `
      SELECT
        k.*,
        i.name AS initiative_name,
        u.first_name AS owner_first_name,
        u.last_name AS owner_last_name,
        ts.value AS latest_value,
        ts.period_start AS latest_period_start,
        ts_prev.value AS prev_value,
        ts_prev.period_start AS prev_period_start,
        c.id AS open_case_id,
        c.severity AS open_case_severity,
        c.status AS open_case_status
      FROM initiative_kpis k
      LEFT JOIN initiatives i ON i.id = k.initiative_id
      LEFT JOIN users u ON u.id = k.owner_user_id
      LEFT JOIN LATERAL (
        SELECT value, period_start
        FROM kpi_time_series
        WHERE kpi_id = k.id AND organization_id = ?
        ORDER BY period_start DESC, created_at DESC
        LIMIT 1
      ) ts ON TRUE
      LEFT JOIN LATERAL (
        SELECT value, period_start
        FROM kpi_time_series
        WHERE kpi_id = k.id AND organization_id = ?
        ORDER BY period_start DESC, created_at DESC
        OFFSET 1
        LIMIT 1
      ) ts_prev ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, severity, status
        FROM kpi_deviation_cases
        WHERE organization_id = ? AND kpi_id = k.id AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')
        ORDER BY CASE WHEN severity = 'RED' THEN 0 ELSE 1 END, detected_at DESC
        LIMIT 1
      ) c ON TRUE
      WHERE COALESCE(k.organization_id, i.organization_id) = ?
      ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
      `,
      [orgId, orgId, orgId, orgId]
    );

    const data = (rows || []).map((r: any) => {
      const latestValue = r.latest_value ?? r.current_value ?? null;
      const targetValue = r.target_value ?? null;
      const direction = String(r.direction || 'HIGHER_IS_BETTER');
      const isOnTarget =
        latestValue == null || targetValue == null
          ? false
          : direction === 'LOWER_IS_BETTER'
            ? Number(latestValue) <= Number(targetValue)
            : Number(latestValue) >= Number(targetValue);

      return {
        id: r.id,
        initiativeId: r.initiative_id || null,
        initiativeName: r.initiative_name || null,
        name: r.name,
        description: r.description || null,
        unit: r.unit || null,
        baselineValue: r.baseline_value ?? null,
        targetValue,
        measurementFrequency: r.measurement_frequency || 'MONTHLY',
        alertThreshold: r.alert_threshold ?? null,
        alertDirection: r.alert_direction || 'BELOW',
        direction,
        thresholdMode: r.threshold_mode || 'PERCENT_FROM_TARGET',
        amberThresholdPct: r.amber_threshold_pct ?? null,
        redThresholdPct: r.red_threshold_pct ?? null,
        amberThresholdAbs: r.amber_threshold_abs ?? null,
        redThresholdAbs: r.red_threshold_abs ?? null,
        ownerUserId: r.owner_user_id || null,
        ownerName:
          r.owner_first_name || r.owner_last_name
            ? `${r.owner_first_name || ''} ${r.owner_last_name || ''}`.trim()
            : null,
        currentValue: r.current_value ?? null,
        latestValue: latestValue,
        latestMeasurementDate: r.latest_period_start ? String(r.latest_period_start) : null,
        prevValue: r.prev_value != null ? Number(r.prev_value) : null,
        prevMeasurementDate: r.prev_period_start ? String(r.prev_period_start) : null,
        openDeviationCase: r.open_case_id
          ? {
              id: r.open_case_id,
              severity: r.open_case_severity,
              status: r.open_case_status,
            }
          : null,
        isOnTarget,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    res.json({ success: true, data });
  })
);

router.post(
  '/kpis',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

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
    if (!safeName) return res.status(400).json({ success: false, error: 'name is required' });

    // RES-02: canonical write goes through kpiDefinitionService — no direct
    // SQL against initiative_kpis here anymore (this router used to be a
    // second, forked INSERT of the same owner object as v8/results.routes.ts).
    const created = await createKpiDefinition({
      organizationId: orgId,
      initiativeId: null,
      actorUserId: getUserId(req) || null,
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
      source: 'benefits.routes',
      reason: 'legacy-benefits-kpi-create',
    });

    res.json({ success: true, data: { id: created.id } });
  })
);

router.put(
  '/kpis/:kpiId',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    const { kpiId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!kpiId) return res.status(400).json({ success: false, error: 'kpiId is required' });

    // Minimal R0 update contract (extend as needed).
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

    // RES-02: same client-round-tripped CAS pointer as v8/results.routes.ts —
    // this fallback receives the identical payload from the active Results UI
    // when the primary v8 write 400/404/405/501s, so it must honor the same
    // expectedVersion the client already sent rather than re-deriving its own.
    // A key that's present but garbage (non-integer, <= 0, wrong type) fails
    // closed with 400 instead of silently degrading to the self-read fallback
    // below — that degrade path is for callers who never sent the key at all.
    let clientExpectedVersion: number | null = null;
    if (expectedVersion !== undefined) {
      const isNumericInput =
        typeof expectedVersion === 'number' || typeof expectedVersion === 'string';
      const parsed = isNumericInput ? Number(expectedVersion) : NaN;
      if (!isNumericInput || !Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({
          success: false,
          error: 'expectedVersion must be a positive integer',
          code: 'RESULTS_KPI_INVALID_EXPECTED_VERSION',
        });
      }
      clientExpectedVersion = parsed;
    }

    const row = await dbGet<any>(
      `
      SELECT k.id, k.status
      FROM initiative_kpis k
      LEFT JOIN initiatives i ON i.id = k.initiative_id
      WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?
      `,
      [kpiId, orgId]
    );
    if (!row?.id) return res.status(404).json({ success: false, error: 'KPI not found' });

    // State-machine guard: block definition/target mass-assignment when the KPI
    // is in a finalized/locked lifecycle status. Mirrors the v8 results router so
    // the legacy benefits surface cannot be used as a bypass.
    const lockedStatus = String(row.status || '').toLowerCase();
    if (lockedStatus && BENEFITS_LOCKED_KPI_STATUSES.includes(lockedStatus)) {
      return res.status(409).json({
        success: false,
        error: `Cannot edit this KPI: it is in a finalized/locked status ('${lockedStatus}'). Transition its status before editing the definition or targets.`,
        code: 'RESULTS_KPI_EDIT_LOCKED',
        detail: { kpiId, status: lockedStatus },
      });
    }

    // RES-02: canonical write goes through kpiDefinitionService (CAS-versioned,
    // audited, transactional) — no direct SQL against initiative_kpis. The
    // lock-status guard above is unchanged (a lifecycle-state check, not a
    // definition-versioning concern) and still runs first, before any write.
    const current = await getCurrentKpiDefinition(String(kpiId), orgId);
    if (!current) return res.status(404).json({ success: false, error: 'KPI not found' });
    let updated;
    try {
      updated = await updateKpiDefinition({
        organizationId: orgId,
        kpiId: String(kpiId),
        expectedVersion: clientExpectedVersion ?? current.currentDefinitionVersion,
        actorUserId: getUserId(req) || null,
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
        source: 'benefits.routes',
        reason: 'legacy-benefits-kpi-update',
      });
    } catch (error) {
      if (error instanceof KpiDefinitionNotFoundError) {
        return res.status(404).json({ success: false, error: 'KPI not found' });
      }
      if (error instanceof KpiDefinitionArchivedError) {
        return res.status(409).json({
          success: false,
          error: 'Cannot edit an archived KPI',
          code: 'RESULTS_KPI_ARCHIVED',
        });
      }
      if (error instanceof KpiDefinitionVersionConflictError) {
        return res.status(409).json({
          success: false,
          error: 'KPI definition changed concurrently; reload and retry',
          code: 'RESULTS_KPI_VERSION_CONFLICT',
        });
      }
      throw error;
    }

    res.json({ success: true, currentDefinitionVersion: updated.currentDefinitionVersion });
  })
);

router.delete(
  '/kpis/:kpiId',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'delete_kpi'))) return;
    const orgId = getOrgId(req);
    const { kpiId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!kpiId) return res.status(400).json({ success: false, error: 'kpiId is required' });

    // Ensure KPI belongs to org (global KPI or initiative-bound KPI).
    const row = await dbGet<any>(
      `
      SELECT k.id
      FROM initiative_kpis k
      LEFT JOIN initiatives i ON i.id = k.initiative_id
      WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?
      `,
      [kpiId, orgId]
    );
    if (!row?.id) return res.status(404).json({ success: false, error: 'KPI not found' });

    // RES-02: delete = archive. Every immutable definition version and every
    // kpi_time_series/kpi_deviation_cases row stays exactly as it was — this
    // used to hard-DELETE the KPI and cascade-delete its measurement and
    // deviation history, which is precisely what the archive contract forbids.
    // The initiative_kpi_mappings unlink still runs (removing this KPI from
    // any initiative's active assignment list is a real, intended effect of
    // "delete" — only the canonical definition + its history is preserved).
    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      orgId,
    ]).catch(() => null);

    await archiveKpiDefinition({
      organizationId: orgId,
      kpiId: String(kpiId),
      actorUserId: getUserId(req) || null,
      reason: 'legacy-benefits-kpi-delete',
    });

    res.json({ success: true });
  })
);

// ============================================================
// T047: KPI TIME SERIES
// ============================================================

router.get(
  '/kpis/:kpiId/time-series',
  asyncHandler(async (req, res) => {
    const { kpiId } = req.params;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const rows = await dbAll<any>(
      `
      SELECT
        ts.*,
        k.measurement_frequency,
        u.id AS user_id,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name
      FROM kpi_time_series ts
      LEFT JOIN initiative_kpis k ON k.id = ts.kpi_id
      LEFT JOIN users u ON u.id = ts.recorded_by
      WHERE ts.kpi_id = ? AND ts.organization_id = ?
      ORDER BY ts.period_start DESC, ts.created_at DESC
      `,
      [kpiId, orgId]
    );

    const data = (rows || []).map((r: any) => ({
      id: r.id,
      kpiId: r.kpi_id,
      value: r.value,
      measuredAt: r.period_start ? String(r.period_start) : null,
      periodStart: r.period_start ? String(r.period_start) : null,
      periodEnd: r.period_end ? String(r.period_end) : null,
      periodKey: deriveKpiPeriodKey(r.period_start, r.measurement_frequency),
      notes: r.notes || null,
      createdAt: r.created_at,
      createdBy: r.user_id
        ? {
            id: r.user_id,
            firstName: r.user_first_name || '',
            lastName: r.user_last_name || '',
          }
        : undefined,
    }));

    res.json({ success: true, data });
  })
);

router.post(
  '/kpis/:kpiId/time-series',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'record_measurement'))) return;
    const { kpiId } = req.params;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const body = req.body || {};
    const value = body.value;
    const periodStartRaw =
      body.periodStart || body.period_start || body.measuredAt || body.measured_at;
    const periodEndRaw = body.periodEnd || body.period_end;
    const source = body.source;
    const notes = body.notes;

    const periodStart = periodStartRaw ? String(periodStartRaw).slice(0, 10) : '';
    const periodEnd = periodEndRaw ? String(periodEndRaw).slice(0, 10) : null;

    if (!kpiId) return res.status(400).json({ success: false, error: 'kpiId is required' });
    if (value == null || value === '' || !Number.isFinite(Number(value))) {
      return res.status(400).json({ success: false, error: 'value is required' });
    }
    if (!periodStart) {
      return res
        .status(400)
        .json({ success: false, error: 'periodStart (or measuredAt) is required' });
    }

    // RES-003: recordKpiMeasurement performs the org-ownership precheck on
    // kpiId itself (mirrors the SEC-3 (L-04) SELECT this route used to
    // inline), upserts on (kpiId, periodStart, source) instead of a bare
    // INSERT, and resolves the RES-02 definition_version_id pin via the
    // canonical owner's own getCurrentDefinitionVersionId. It also now
    // writes kpi_metric_audit_log, which this deprecated fallback route
    // previously skipped (the canonical v8 route always wrote it — a real
    // behavioural divergence between the two "same" endpoints, closed by
    // routing both through one writer).
    let result;
    try {
      result = await recordKpiMeasurement({
        organizationId: orgId,
        kpiId: String(kpiId),
        value: Number(value),
        periodStart,
        periodEnd,
        source,
        notes,
        actorUserId: (req as any).user?.id || null,
      });
    } catch (error) {
      if (error instanceof KpiMeasurementKpiNotFoundError) {
        return res.status(404).json({
          success: false,
          error: 'KPI not found',
          code: 'RESULTS_KPI_NOT_FOUND',
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: {
        id: result.id,
        kpiId: result.kpiId,
        value: result.value,
        measuredAt: result.periodStart,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        periodKey: result.periodKey,
        wasNewRow: result.wasNewRow,
        definitionVersionId: result.definitionVersionId,
      },
    });
  })
);

// ============================================================
// R1: KPI DEVIATION CASES + ACTION PLAN
// ============================================================

router.get(
  '/kpis/:kpiId/deviation-cases',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { kpiId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!kpiId) return res.status(400).json({ success: false, error: 'kpiId is required' });

    const openOnly =
      String((req.query as any)?.openOnly || '').trim() === '1' ||
      String((req.query as any)?.openOnly || '')
        .trim()
        .toLowerCase() === 'true';

    const cases = await dbAll<any>(
      `
      SELECT *
      FROM kpi_deviation_cases
      WHERE organization_id = ? AND kpi_id = ?
      ${openOnly ? "AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')" : ''}
      ORDER BY detected_at DESC, created_at DESC
      `,
      [orgId, kpiId]
    );

    const caseIds = (cases || []).map((c: any) => c.id);
    const actions =
      caseIds.length > 0
        ? await dbAll<any>(
            `
            SELECT *
            FROM kpi_deviation_actions
            WHERE case_id IN (${caseIds.map(() => '?').join(',')})
            ORDER BY created_at ASC
            `,
            caseIds
          )
        : [];

    const actionsByCase: Record<string, any[]> = {};
    (actions || []).forEach((a: any) => {
      const cid = String(a.case_id);
      if (!actionsByCase[cid]) actionsByCase[cid] = [];
      actionsByCase[cid].push({
        id: a.id,
        title: a.title,
        ownerUserId: a.owner_user_id || null,
        dueDate: a.due_date ? String(a.due_date) : null,
        status: a.status,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      });
    });

    const data = (cases || []).map((c: any) => ({
      id: c.id,
      kpiId: c.kpi_id,
      organizationId: c.organization_id,
      periodStart: c.period_start ? String(c.period_start) : null,
      periodEnd: c.period_end ? String(c.period_end) : null,
      severity: c.severity,
      status: c.status,
      ownerUserId: c.owner_user_id || null,
      deviationSummary: c.deviation_summary || null,
      rcaText: c.rca_text || null,
      detectedAt: c.detected_at,
      acknowledgedAt: c.acknowledged_at,
      resolvedAt: c.resolved_at,
      closedAt: c.closed_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      actions: actionsByCase[String(c.id)] || [],
    }));

    res.json({ success: true, data });
  })
);

router.post(
  '/deviation-cases/:caseId/acknowledge',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    const before = await dbGet<any>(
      `SELECT * FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, orgId]
    );

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.acknowledge',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        before: before ? { status: before.status } : undefined,
        after: { status: 'ACKNOWLEDGED' },
        metadata: { kpiId: before?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true });
  })
);

router.put(
  '/deviation-cases/:caseId/rca',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    const { rcaText } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    const before = await dbGet<any>(
      `SELECT status, rca_text, kpi_id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET rca_text = ?, status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [rcaText != null ? String(rcaText) : null, caseId, orgId]
    );

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.update_rca',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        before: before ? { status: before.status, rcaText: before.rca_text } : undefined,
        after: { rcaText: rcaText ?? null },
        metadata: { kpiId: before?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/actions',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    const { title, ownerUserId, dueDate } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });
    const safeTitle = String(title || '').trim();
    if (!safeTitle) return res.status(400).json({ success: false, error: 'title is required' });

    const deviationCase = await dbGet<any>(
      `SELECT kpi_id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );
    // SEC-3 (L-04): the INSERT below keys only on case_id (no org column on
    // kpi_deviation_actions), so without this gate a foreign-org caseId would attach an
    // action to another org's deviation case. Reject when the parent case is not owned.
    if (!deviationCase) {
      return res.status(404).json({
        success: false,
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

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.add_action',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        after: { actionId: id, title: safeTitle },
        metadata: { kpiId: deviationCase?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true, data: { id } });
  })
);

router.put(
  '/deviation-cases/:caseId/actions/:actionId',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const { caseId, actionId } = req.params;
    const { title, ownerUserId, dueDate, status } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId || !actionId)
      return res.status(400).json({ success: false, error: 'caseId and actionId are required' });

    const beforeAction = await dbGet<any>(
      `SELECT * FROM kpi_deviation_actions WHERE id = ? AND case_id = ?`,
      [actionId, caseId]
    );
    const deviationCase = await dbGet<any>(
      `SELECT kpi_id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );

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
        orgId,
      ]
    );

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.update_action',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        before: beforeAction
          ? { actionId, status: beforeAction.status, title: beforeAction.title }
          : undefined,
        after: {
          actionId,
          status: status || beforeAction?.status,
          title: title || beforeAction?.title,
        },
        metadata: { kpiId: deviationCase?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/resolve',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    const before = await dbGet<any>(
      `SELECT status, kpi_id FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, orgId]
    );

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.resolve',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        before: before ? { status: before.status } : undefined,
        after: { status: 'RESOLVED' },
        metadata: { kpiId: before?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/close',
  requireAudit as any,
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'manage_deviation'))) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { caseId } = req.params;
    const { evidenceText, evidenceRef, resolutionNotes, linkedInitiativeId, linkedTaskId } =
      req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    if (!evidenceText && !evidenceRef) {
      return res.status(400).json({
        success: false,
        error: 'At least one of evidenceText or evidenceRef is required to close a deviation case',
      });
    }

    const before = await dbGet<any>(
      `SELECT * FROM kpi_deviation_cases WHERE id = ? AND organization_id = ?`,
      [caseId, orgId]
    );

    try {
      await dbRun(
        `UPDATE kpi_deviation_cases SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         evidence_text = ?, evidence_ref = ?, closed_by = ?, resolution_notes = ?,
         linked_initiative_id = COALESCE(?, linked_initiative_id),
         linked_task_id = COALESCE(?, linked_task_id)
         WHERE id = ? AND organization_id = ?`,
        [
          evidenceText || null,
          evidenceRef || null,
          userId || null,
          resolutionNotes || null,
          linkedInitiativeId || null,
          linkedTaskId || null,
          caseId,
          orgId,
        ]
      );
    } catch {
      await dbRun(
        `UPDATE kpi_deviation_cases SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         evidence_text = ?, evidence_ref = ?, closed_by = ?, resolution_notes = ?
         WHERE id = ? AND organization_id = ?`,
        [
          evidenceText || null,
          evidenceRef || null,
          userId || null,
          resolutionNotes || null,
          caseId,
          orgId,
        ]
      );
    }

    try {
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'deviation_case.close',
        resourceType: 'kpi_deviation_case',
        resourceId: String(caseId),
        before: before ? { status: before.status } : undefined,
        after: {
          status: 'CLOSED',
          hasEvidence: !!(evidenceText || evidenceRef),
          linkedInitiativeId,
          linkedTaskId,
        },
        metadata: { kpiId: before?.kpi_id },
      });
    } catch {
      /* audit best-effort */
    }

    res.json({ success: true });
  })
);

// ============================================================
// V3-M08: MCP-IRIS proof path (read-only KPI refresh)
// ============================================================
router.post(
  '/kpis/:kpiId/refresh/iris',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'record_measurement'))) return;
    const orgId = getOrgId(req);
    const { kpiId } = req.params;
    const providerId = req.body?.providerId ? String(req.body.providerId).trim() : null;
    const factoryId = req.body?.factoryId ? String(req.body.factoryId).trim() : null;

    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!kpiId) return res.status(400).json({ success: false, error: 'kpiId is required' });

    // Ensure MCP providers table exists
    const mcpCols = await dbAll<{ name: string }>('PRAGMA table_info(mcp_providers)', []).catch(
      () => []
    );
    if (!mcpCols?.length) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    const provider = providerId
      ? await dbGet<any>(
          `SELECT id, name, type, status, config FROM mcp_providers WHERE id = ? AND organization_id = ? AND status = 'active'`,
          [providerId, orgId]
        )
      : await dbGet<any>(
          `SELECT id, name, type, status, config
           FROM mcp_providers
           WHERE organization_id = ? AND status = 'active' AND lower(name) LIKE '%iris%'
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
          [orgId]
        );

    if (!provider?.id) {
      return res.status(404).json({ success: false, error: 'IRIS MCP provider not configured' });
    }

    const cfgObj = (() => {
      try {
        return provider.config
          ? typeof provider.config === 'string'
            ? JSON.parse(provider.config)
            : provider.config
          : {};
      } catch {
        return {};
      }
    })() as Record<string, unknown>;

    const cfg = parseStreamableHttpConfig(provider.config);
    if (!cfg) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid IRIS provider config (baseUrl required)' });
    }

    const toolName = 'iris.kpi.timeseries.get';
    const args = {
      kpiId,
      range: req.body?.range || { days: 30 },
    };

    const started = Date.now();
    try {
      const result = await callRemoteTool({
        providerId: String(provider.id),
        orgId,
        userId: (req as any).user?.id || null,
        config: cfg,
        toolName,
        args,
        extraHeaders: makeIrisHeaders(cfgObj, factoryId),
      });

      // Accept a few common shapes:
      // - { points: [{ periodStart, value }, ...] }
      // - { values: [{ date|periodStart, value }, ...] }
      // - [{ periodStart, value }, ...]
      const pointsRaw: any[] = Array.isArray((result as any)?.points)
        ? (result as any).points
        : Array.isArray((result as any)?.values)
          ? (result as any).values
          : Array.isArray(result)
            ? (result as any)
            : [];

      const points = pointsRaw
        .map((p: any) => ({
          periodStart: String(p?.periodStart || p?.period_start || p?.date || '').slice(0, 10),
          value: Number(p?.value),
        }))
        .filter((p) => p.periodStart && Number.isFinite(p.value));

      if (!points.length) {
        return res.json({
          success: true,
          providerId: String(provider.id),
          inserted: 0,
          durationMs: Math.max(0, Date.now() - started),
          note: 'No points returned by IRIS tool',
        });
      }

      // RES-003: route through the canonical measurement writer — upsert on
      // (kpiId, periodStart, source) instead of the prior bare INSERT (which
      // had "no hard dedupe" by its own comment), a real per-org ownership
      // check on kpiId (this route previously had none — the current_value
      // UPDATE below was org-scoped, but the INSERT above it was not, so a
      // foreign-org kpiId could get an IRIS-sourced row written under the
      // caller's org), and the RES-02 definition_version_id pin resolved
      // once per point (each point still gets the version current AT THE
      // TIME OF ITS OWN WRITE — the writer resolves it fresh per call, not
      // once for the whole batch; all points land "now" in quick succession
      // so this is the same version in practice, just resolved correctly
      // instead of assumed). `runDeviationCheck: false` keeps this loop's
      // existing behaviour of not firing a deviation evaluation (and
      // possible owner notification) per point — with up to 500 points per
      // call that would be a notification storm nobody asked for here.
      let inserted = 0;
      for (const p of points.slice(0, 500)) {
        try {
          await recordKpiMeasurement({
            organizationId: orgId,
            kpiId: String(kpiId),
            value: p.value,
            periodStart: p.periodStart,
            source: 'mcp_iris',
            notes: `ref:provider=${provider.id}`,
            actorUserId: (req as any).user?.id || null,
            auditEventType: 'connector_ingest',
            auditSummary: `IRIS refresh ingested ${p.value} for ${p.periodStart}`,
            runDeviationCheck: false,
          });
          inserted += 1;
        } catch (pointError) {
          if (pointError instanceof KpiMeasurementKpiNotFoundError) {
            // Foreign-org or unknown kpiId — stop the loop, every remaining
            // point would fail the same way (single kpiId per call).
            return res.status(404).json({ success: false, error: 'KPI not found' });
          }
          // Preserve prior best-effort semantics for any other per-point failure.
        }
      }

      return res.json({
        success: true,
        providerId: String(provider.id),
        toolName,
        inserted,
        durationMs: Math.max(0, Date.now() - started),
      });
    } catch (e: any) {
      const msg = String(e?.message || 'iris_refresh_failed');
      const retriable = /HTTP\s*5\d\d/i.test(msg) || /timeout/i.test(msg) || /ECONN/i.test(msg);
      logger.warn('[Benefits] IRIS KPI refresh failed', {
        orgId,
        kpiId,
        providerId: provider?.id,
        error: msg,
        retriable,
      });
      return res.status(502).json({ success: false, error: msg, retriable });
    }
  })
);

router.get(
  '/iris/health',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const provider = await dbGet<any>(
      `SELECT id, name, status, config
       FROM mcp_providers
       WHERE organization_id = ? AND status = 'active' AND lower(name) LIKE '%iris%'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    ).catch(() => null);

    if (!provider?.id)
      return res.status(404).json({ success: false, error: 'IRIS MCP provider not configured' });
    const cfg = parseStreamableHttpConfig(provider.config);
    if (!cfg)
      return res
        .status(400)
        .json({ success: false, error: 'Invalid IRIS provider config (baseUrl required)' });

    const cfgObj = (() => {
      try {
        return provider.config
          ? typeof provider.config === 'string'
            ? JSON.parse(provider.config)
            : provider.config
          : {};
      } catch {
        return {};
      }
    })() as Record<string, unknown>;

    try {
      const result = await callRemoteTool({
        providerId: String(provider.id),
        orgId,
        userId: (req as any).user?.id || null,
        config: cfg,
        toolName: 'iris.health.get',
        args: {},
        extraHeaders: makeIrisHeaders(cfgObj, null),
      });
      return res.json({ success: true, providerId: String(provider.id), result });
    } catch (e: any) {
      const msg = String(e?.message || 'iris_health_failed');
      const retriable = /HTTP\s*5\d\d/i.test(msg) || /timeout/i.test(msg) || /ECONN/i.test(msg);
      return res.status(502).json({ success: false, error: msg, retriable });
    }
  })
);

router.post(
  '/iris/assets/search',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'record_measurement'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const q = String(req.body?.q || req.body?.query || '').trim();
    if (!q) return res.status(400).json({ success: false, error: 'q is required' });

    const provider = await dbGet<any>(
      `SELECT id, name, status, config
       FROM mcp_providers
       WHERE organization_id = ? AND status = 'active' AND lower(name) LIKE '%iris%'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [orgId]
    ).catch(() => null);

    if (!provider?.id)
      return res.status(404).json({ success: false, error: 'IRIS MCP provider not configured' });
    const cfg = parseStreamableHttpConfig(provider.config);
    if (!cfg)
      return res
        .status(400)
        .json({ success: false, error: 'Invalid IRIS provider config (baseUrl required)' });

    const cfgObj = (() => {
      try {
        return provider.config
          ? typeof provider.config === 'string'
            ? JSON.parse(provider.config)
            : provider.config
          : {};
      } catch {
        return {};
      }
    })() as Record<string, unknown>;

    try {
      const result = await callRemoteTool({
        providerId: String(provider.id),
        orgId,
        userId: (req as any).user?.id || null,
        config: cfg,
        toolName: 'iris.assets.search',
        args: { q, limit: Math.min(50, Math.max(1, Number(req.body?.limit || 10))) },
        extraHeaders: makeIrisHeaders(cfgObj, String(req.body?.factoryId || '').trim() || null),
      });
      return res.json({ success: true, providerId: String(provider.id), result });
    } catch (e: any) {
      const msg = String(e?.message || 'iris_assets_search_failed');
      const retriable = /HTTP\s*5\d\d/i.test(msg) || /timeout/i.test(msg) || /ECONN/i.test(msg);
      return res.status(502).json({ success: false, error: msg, retriable });
    }
  })
);

router.delete(
  '/kpis/:kpiId/time-series/:tsId',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'delete_kpi'))) return;
    const { kpiId, tsId } = req.params;
    const orgId = getOrgId(req);
    await dbRun(`DELETE FROM kpi_time_series WHERE id = ? AND kpi_id = ? AND organization_id = ?`, [
      tsId,
      kpiId,
      orgId,
    ]);
    res.json({ success: true });
  })
);

// ============================================================
// T047: INITIATIVE <-> KPI MAPPINGS
// ============================================================

router.get(
  '/kpi-mappings',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { initiativeId, kpiId } = req.query;
    let query = `SELECT m.*, ik.name as kpi_name, ik.unit, i.name as initiative_name
               FROM initiative_kpi_mappings m
               LEFT JOIN initiative_kpis ik ON ik.id = m.kpi_id
               LEFT JOIN initiatives i ON i.id = m.initiative_id
               WHERE m.organization_id = ?`;
    const params: any[] = [orgId];
    if (initiativeId) {
      query += ' AND m.initiative_id = ?';
      params.push(initiativeId);
    }
    if (kpiId) {
      query += ' AND m.kpi_id = ?';
      params.push(kpiId);
    }
    const rows = await dbAll(query, params);
    res.json({ success: true, data: rows || [] });
  })
);

router.post(
  '/kpi-mappings',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
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
      return res.status(400).json({ success: false, error: 'initiativeId and kpiId are required' });
    }
    // SEC-3 (L-04): initiative_kpi_mappings is UNIQUE(initiative_id, kpi_id) (globally
    // unique, not per-org), so the ON CONFLICT UPSERT below could overwrite another org's
    // mapping row when handed a foreign-org (initiativeId, kpiId) pair. Verify both parents
    // belong to the caller's org before writing — mirrors the v8 router which 404s here.
    const parentInitiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(initiativeId), orgId]
    );
    if (!parentInitiative?.id) {
      return res.status(404).json({
        success: false,
        error: 'Initiative not found',
        code: 'RESULTS_INITIATIVE_NOT_FOUND',
      });
    }
    const parentKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [String(kpiId), orgId]
    );
    if (!parentKpi?.id) {
      return res.status(404).json({
        success: false,
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
        orgId,
        impactWeight || 1.0,
        impactDirection || 'increase',
        expectedDelta || null,
        expectedDeltaUnit || null,
        lagDays || 0,
        confidence || 'medium',
        notes || null,
        (req as any).user?.id,
      ]
    );
    res.json({ success: true, data: { id, initiativeId, kpiId } });
  })
);

router.delete(
  '/kpi-mappings/:mappingId',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE id = ? AND organization_id = ?`, [
      req.params.mappingId,
      orgId,
    ]);
    res.json({ success: true });
  })
);

// ============================================================
// T046: ROI ASSUMPTIONS
// ============================================================

router.get(
  '/roi/:initiativeId/assumptions',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const row = await dbGet(
      `SELECT * FROM roi_assumptions WHERE initiative_id = ? AND organization_id = ?`,
      [req.params.initiativeId, orgId]
    );
    res.json({ success: true, data: row || null });
  })
);

router.put(
  '/roi/:initiativeId/assumptions',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    const { initiativeId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    // SEC-3 (L-04): roi_assumptions is UNIQUE(initiative_id) (globally unique, not
    // per-org), so an unscoped ON CONFLICT UPSERT could overwrite another org's
    // assumptions row. Verify parent (initiative) ownership before writing — mirrors
    // the already-fixed v8 router (v8/results.routes.ts) which 404s on a foreign-org id.
    const parentInitiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (!parentInitiative?.id) {
      return res.status(404).json({ success: false, error: 'Initiative not found' });
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
    } = req.body;
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
        orgId,
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
        (req as any).user?.id,
      ]
    );
    res.json({ success: true });
  })
);

// ============================================================
// T046: ROI REALIZED VALUES
// ============================================================

router.get(
  '/roi/:initiativeId/realized',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const rows = await dbAll(
      `SELECT * FROM roi_realized_values WHERE initiative_id = ? AND organization_id = ? ORDER BY period_month DESC`,
      [req.params.initiativeId, orgId]
    );
    res.json({ success: true, data: rows || [] });
  })
);

router.post(
  '/roi/:initiativeId/realized',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    const { initiativeId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    // SEC-3 (L-04): verify parent (initiative) ownership before recording a realized
    // value, so a foreign-org id cannot attach realized data to another org's initiative
    // (mirrors the v8 router which 404s on a foreign-org id).
    const parentInitiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (!parentInitiative?.id) {
      return res.status(404).json({ success: false, error: 'Initiative not found' });
    }
    const {
      periodMonth,
      realizedRevenueDelta,
      realizedCostDelta,
      realizedSavings,
      source,
      varianceNotes,
    } = req.body;
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        initiativeId,
        orgId,
        periodMonth,
        realizedRevenueDelta || null,
        realizedCostDelta || null,
        realizedSavings || null,
        source || 'manual',
        varianceNotes || null,
        (req as any).user?.id,
      ]
    );
    res.json({ success: true, data: { id } });
  })
);

router.get(
  '/roi/:initiativeId/variance',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { initiativeId } = req.params;
    const assumptions = await dbGet(
      `SELECT * FROM roi_assumptions WHERE initiative_id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    const realized = await dbAll(
      `SELECT * FROM roi_realized_values WHERE initiative_id = ? AND organization_id = ? ORDER BY period_month`,
      [initiativeId, orgId]
    );
    const realizedList = (realized || []) as any[];

    if (!assumptions) {
      return res.json({ success: true, data: { hasAssumptions: false, variance: null } });
    }

    const ass = assumptions as any;
    const totalRealizedRevDelta = realizedList.reduce(
      (s, r) => s + (r.realized_revenue_delta || 0),
      0
    );
    const totalRealizedCostDelta = realizedList.reduce(
      (s, r) => s + (r.realized_cost_delta || 0),
      0
    );
    const totalRealizedSavings = realizedList.reduce((s, r) => s + (r.realized_savings || 0), 0);

    const projectedBenefit = (ass.expected_revenue_delta || 0) + (ass.expected_cost_delta || 0);
    const realizedBenefit = totalRealizedRevDelta + totalRealizedCostDelta + totalRealizedSavings;
    const varianceAbs = realizedBenefit - projectedBenefit;
    const variancePct =
      projectedBenefit !== 0 ? (varianceAbs / Math.abs(projectedBenefit)) * 100 : 0;

    res.json({
      success: true,
      data: {
        hasAssumptions: true,
        projected: {
          revenueDelta: ass.expected_revenue_delta,
          costDelta: ass.expected_cost_delta,
          totalBenefit: projectedBenefit,
          capex: ass.capex,
          opexAnnual: ass.opex_annual,
          roiPercent: ass.expected_roi_percent,
          npv: ass.expected_npv,
          paybackMonths: ass.expected_payback_months,
          horizonMonths: ass.horizon_months,
          confidence: ass.confidence,
        },
        realized: {
          revenueDelta: totalRealizedRevDelta,
          costDelta: totalRealizedCostDelta,
          savings: totalRealizedSavings,
          totalBenefit: realizedBenefit,
          dataPoints: realizedList.length,
        },
        variance: {
          absolute: varianceAbs,
          percent: Math.round(variancePct * 10) / 10,
          status: variancePct > 10 ? 'above_plan' : variancePct < -10 ? 'below_plan' : 'on_track',
        },
      },
    });
  })
);

// ============================================================
// T048: KPI ATTRIBUTION
// ============================================================

router.get(
  '/attribution/:kpiId',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const kpiId = String(req.params.kpiId);
    const firstQueryValue = (value: unknown): string | undefined => {
      if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
      return typeof value === 'string' ? value : undefined;
    };
    const periodStart =
      firstQueryValue(req.query.periodStart) ||
      new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    const periodEnd = firstQueryValue(req.query.periodEnd) || new Date().toISOString().slice(0, 10);
    // RES-11: isAdmin deliberately false — packet §10 leaves "does admin see
    // private_to_owner" as an open policy decision; fail-closed until resolved.
    const result = await computeAttribution(kpiId, orgId, periodStart, periodEnd, {
      userId: getUserId(req),
      isAdmin: false,
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  '/attribution/:kpiId/snapshot',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'create_report'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const kpiId = String(req.params.kpiId);
    const { periodStart, periodEnd } = req.body || {};
    // Validate the period bounds before they are coerced and persisted: an absent value
    // would be stored as the literal string "undefined", corrupting the snapshot row.
    const safePeriodStart = typeof periodStart === 'string' ? periodStart.trim() : '';
    const safePeriodEnd = typeof periodEnd === 'string' ? periodEnd.trim() : '';
    if (!safePeriodStart || !safePeriodEnd) {
      return res
        .status(400)
        .json({ success: false, error: 'periodStart and periodEnd are required' });
    }
    // SEC-3 (L-04): the INSERT below persists a snapshot row keyed on this kpiId. Without
    // an ownership precheck a foreign-org kpiId would be stored under the caller's org,
    // and computeAttribution would emit a row attributed to a KPI the caller cannot see.
    // Verify the parent KPI belongs to the caller's org first (mirrors kpi-mappings).
    const parentKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [kpiId, orgId]
    );
    if (!parentKpi?.id) {
      return res.status(404).json({
        success: false,
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }
    const result = await computeAttribution(kpiId, orgId, safePeriodStart, safePeriodEnd, {
      userId: getUserId(req),
      isAdmin: false,
    });
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO kpi_attribution_snapshots (id, kpi_id, organization_id, period_start, period_end, kpi_delta, contributions, unexplained_remainder, unexplained_percent, overall_confidence, confidence_reasons, assumptions, algorithm_version, computed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        kpiId,
        orgId,
        safePeriodStart,
        safePeriodEnd,
        result.kpiDelta,
        JSON.stringify(result.contributions),
        result.unexplainedRemainder,
        result.unexplainedPercent,
        result.overallConfidence,
        JSON.stringify(result.confidenceReasons),
        JSON.stringify(result.assumptions),
        'v1_heuristic',
        (req as any).user?.id,
      ]
    );
    res.json({ success: true, data: { ...result, snapshotId: id } });
  })
);

router.get(
  '/attribution/:kpiId/history',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const rows = await dbAll(
      `SELECT * FROM kpi_attribution_snapshots WHERE kpi_id = ? AND organization_id = ? ORDER BY computed_at DESC LIMIT 20`,
      [req.params.kpiId, orgId]
    );
    res.json({
      success: true,
      data: (rows || []).map((r: any) => ({
        ...r,
        contributions: JSON.parse(r.contributions || '[]'),
        confidence_reasons: JSON.parse(r.confidence_reasons || '[]'),
        assumptions: JSON.parse(r.assumptions || '[]'),
      })),
    });
  })
);

// ============================================================
// T049: FINANCIAL STATEMENT LINES
// ============================================================

router.get(
  '/financial/statement-lines',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const rows = await dbAll(
      `SELECT * FROM financial_statement_lines WHERE (organization_id IS NULL OR organization_id = ?) ORDER BY statement_type, sort_order`,
      [orgId]
    );
    res.json({ success: true, data: rows || [] });
  })
);

router.post(
  '/financial/statement-lines',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { statementType, lineCode, lineName, lineNamePl, parentLineId, sortOrder } =
      req.body || {};
    // Required identity fields: without them the row is a junk statement line (NULL/undefined
    // coerced into NOT NULL-ish columns), so reject before the INSERT.
    const safeStatementType = typeof statementType === 'string' ? statementType.trim() : '';
    const safeLineCode = typeof lineCode === 'string' ? lineCode.trim() : '';
    const safeLineName = typeof lineName === 'string' ? lineName.trim() : '';
    if (!safeStatementType || !safeLineCode || !safeLineName) {
      return res.status(400).json({
        success: false,
        error: 'statementType, lineCode and lineName are required',
      });
    }
    const safeSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
    // SEC-3 (L-04): parent_line_id references another statement line. Without an
    // ownership precheck a foreign-org statementLineId could be referenced as the parent
    // of a new line, leaking a hierarchy edge across orgs. Verify the parent line belongs
    // to the caller's org (or is a shared system line, organization_id IS NULL) first.
    const safeParentLineId = typeof parentLineId === 'string' ? parentLineId.trim() : '';
    if (safeParentLineId) {
      const parentLine = await dbGet<{ id: string }>(
        `SELECT id FROM financial_statement_lines
         WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
        [safeParentLineId, orgId]
      );
      if (!parentLine?.id) {
        return res.status(404).json({
          success: false,
          error: 'Parent statement line not found',
          code: 'RESULTS_STATEMENT_LINE_NOT_FOUND',
        });
      }
    }
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO financial_statement_lines (id, organization_id, statement_type, line_code, line_name, line_name_pl, parent_line_id, sort_order, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        id,
        orgId,
        safeStatementType,
        safeLineCode,
        safeLineName,
        lineNamePl ? String(lineNamePl).trim() : null,
        safeParentLineId || null,
        safeSortOrder,
      ]
    );
    res.json({ success: true, data: { id } });
  })
);

// ============================================================
// T049: KPI -> FINANCIAL MAPPING
// ============================================================

router.get(
  '/financial/kpi-mappings',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { kpiId } = req.query;
    let query = `SELECT m.*, fsl.line_name, fsl.statement_type, fsl.line_code, ik.name as kpi_name, ik.unit
               FROM kpi_financial_mappings m
               LEFT JOIN financial_statement_lines fsl ON fsl.id = m.statement_line_id
               LEFT JOIN initiative_kpis ik ON ik.id = m.kpi_id
               WHERE m.organization_id = ?`;
    const params: any[] = [orgId];
    if (kpiId) {
      query += ' AND m.kpi_id = ?';
      params.push(kpiId);
    }
    const rows = await dbAll(query, params);
    res.json({ success: true, data: rows || [] });
  })
);

router.post(
  '/financial/kpi-mappings',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const {
      kpiId,
      statementLineId,
      direction,
      relationshipType,
      multiplier,
      formulaParams,
      confidence,
      assumptionsText,
      assumptionsOwner,
    } = req.body || {};
    // kpiId + statementLineId form the conflict key (with org); direction drives the impact
    // sign. Without them the UPSERT writes a corrupt mapping, so reject malformed input.
    const safeKpiId = typeof kpiId === 'string' ? kpiId.trim() : '';
    const safeStatementLineId = typeof statementLineId === 'string' ? statementLineId.trim() : '';
    const safeDirection = typeof direction === 'string' ? direction.trim() : '';
    if (!safeKpiId || !safeStatementLineId || !safeDirection) {
      return res.status(400).json({
        success: false,
        error: 'kpiId, statementLineId and direction are required',
      });
    }
    // multiplier scales the estimated financial impact — guard against a non-numeric value
    // poisoning the stored coefficient (fall back to the prior default of 1.0).
    const safeMultiplier =
      multiplier != null && multiplier !== '' && Number.isFinite(Number(multiplier))
        ? Number(multiplier)
        : 1.0;
    // SEC-3 (L-04): the UPSERT below binds this kpiId + statementLineId into a mapping row
    // labeled with the caller's org. Without an ownership precheck a foreign-org kpiId or
    // statementLineId could be referenced, leaking a cross-org financial linkage. Verify
    // both parents belong to the caller's org (mirrors the initiative kpi-mappings route).
    const parentKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
      [safeKpiId, orgId]
    );
    if (!parentKpi?.id) {
      return res.status(404).json({
        success: false,
        error: 'KPI not found',
        code: 'RESULTS_KPI_NOT_FOUND',
      });
    }
    const parentLine = await dbGet<{ id: string }>(
      `SELECT id FROM financial_statement_lines
       WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
      [safeStatementLineId, orgId]
    );
    if (!parentLine?.id) {
      return res.status(404).json({
        success: false,
        error: 'Statement line not found',
        code: 'RESULTS_STATEMENT_LINE_NOT_FOUND',
      });
    }
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO kpi_financial_mappings (id, kpi_id, statement_line_id, organization_id, direction, relationship_type, multiplier, formula_params, confidence, assumptions_text, assumptions_owner, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kpi_id, statement_line_id, organization_id) DO UPDATE SET
       direction=excluded.direction, relationship_type=excluded.relationship_type, multiplier=excluded.multiplier,
       formula_params=excluded.formula_params, confidence=excluded.confidence, assumptions_text=excluded.assumptions_text,
       assumptions_owner=excluded.assumptions_owner, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        safeKpiId,
        safeStatementLineId,
        orgId,
        safeDirection,
        relationshipType || 'linear',
        safeMultiplier,
        formulaParams ? JSON.stringify(formulaParams) : null,
        confidence || 'medium',
        assumptionsText || null,
        assumptionsOwner || null,
        (req as any).user?.id,
      ]
    );
    res.json({ success: true, data: { id } });
  })
);

router.delete(
  '/financial/kpi-mappings/:mappingId',
  asyncHandler(async (req, res) => {
    if (!(await assertKpiPermission(req as any, res, 'edit_definition'))) return;
    const orgId = getOrgId(req);
    await dbRun(`DELETE FROM kpi_financial_mappings WHERE id = ? AND organization_id = ?`, [
      req.params.mappingId,
      orgId,
    ]);
    res.json({ success: true });
  })
);

router.get(
  '/financial/impact/:kpiId',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { kpiId } = req.params;

    const mappings = await dbAll(
      `SELECT m.*, fsl.line_name, fsl.line_name_pl, fsl.statement_type, fsl.line_code
     FROM kpi_financial_mappings m
     LEFT JOIN financial_statement_lines fsl ON fsl.id = m.statement_line_id
     WHERE m.kpi_id = ? AND m.organization_id = ?`,
      [kpiId, orgId]
    );

    const kpi = (await dbGet(`SELECT * FROM initiative_kpis WHERE id = ?`, [kpiId])) as any;
    const ts = await dbAll(
      `SELECT value, period_start FROM kpi_time_series WHERE kpi_id = ? ORDER BY period_start DESC LIMIT 2`,
      [kpiId]
    );
    const tsList = (ts || []) as any[];
    const kpiDelta = tsList.length >= 2 ? tsList[0].value - tsList[1].value : 0;

    const impacts = ((mappings || []) as any[]).map((m: any) => {
      const estimatedImpact =
        kpiDelta * (m.multiplier || 1.0) * (m.direction === 'negative' ? -1 : 1);
      return {
        statementLineId: m.statement_line_id,
        lineName: m.line_name,
        lineNamePl: m.line_name_pl,
        statementType: m.statement_type,
        lineCode: m.line_code,
        direction: m.direction,
        relationshipType: m.relationship_type,
        multiplier: m.multiplier,
        confidence: m.confidence,
        kpiDelta,
        estimatedImpact: Math.round(estimatedImpact * 100) / 100,
        assumptions: m.assumptions_text,
      };
    });

    res.json({
      success: true,
      data: {
        kpiId,
        kpiName: kpi?.name,
        kpiUnit: kpi?.unit,
        currentValue: kpi?.current_value,
        baselineValue: kpi?.baseline_value,
        targetValue: kpi?.target_value,
        kpiDelta,
        impacts,
      },
    });
  })
);

// Portfolio ROI summary
router.get(
  '/roi/portfolio/summary',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const assumptions = await dbAll(
      `SELECT ra.*, i.name as initiative_name, i.status, i.priority
     FROM roi_assumptions ra
     JOIN initiatives i ON i.id = ra.initiative_id
     WHERE ra.organization_id = ?`,
      [orgId]
    );
    const realized = await dbAll(
      `SELECT initiative_id, SUM(realized_revenue_delta) as total_rev, SUM(realized_cost_delta) as total_cost, SUM(realized_savings) as total_savings, COUNT(*) as data_points
     FROM roi_realized_values WHERE organization_id = ? GROUP BY initiative_id`,
      [orgId]
    );

    const realizedMap: Record<string, any> = {};
    ((realized || []) as any[]).forEach((r: any) => {
      realizedMap[r.initiative_id] = r;
    });

    const items = ((assumptions || []) as any[]).map((a: any) => {
      const r = realizedMap[a.initiative_id];
      const projectedBenefit = (a.expected_revenue_delta || 0) + (a.expected_cost_delta || 0);
      const realizedBenefit = r
        ? (r.total_rev || 0) + (r.total_cost || 0) + (r.total_savings || 0)
        : 0;
      return {
        initiativeId: a.initiative_id,
        initiativeName: a.initiative_name,
        status: a.status,
        priority: a.priority,
        capex: a.capex,
        opexAnnual: a.opex_annual,
        projectedBenefit,
        realizedBenefit,
        variance: realizedBenefit - projectedBenefit,
        confidence: a.confidence,
        hasRealized: !!r,
      };
    });

    const totalProjected = items.reduce((s, i) => s + i.projectedBenefit, 0);
    const totalRealized = items.reduce((s, i) => s + i.realizedBenefit, 0);
    const totalCapex = items.reduce((s, i) => s + (i.capex || 0), 0);
    const coveragePercent =
      items.length > 0
        ? Math.round((items.filter((i) => i.hasRealized).length / items.length) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        items,
        summary: {
          totalProjected,
          totalRealized,
          totalCapex,
          totalVariance: totalRealized - totalProjected,
          initiativeCount: items.length,
          coveragePercent,
        },
      },
    });
  })
);

export default router;
