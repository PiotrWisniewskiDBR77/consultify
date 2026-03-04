/**
 * Benefits Routes — Bundle 12
 * T046: ROI Tracking, T047: KPI Time Series, T048: Attribution, T049: Financial Mapping
 */

import { type NextFunction, type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { computeAttribution } from '../services/kpiAttributionService.js';
import { handleTimeSeriesRecorded } from '../services/results/kpiDeviationService.js';
import {
  callRemoteTool,
  makeIrisHeaders,
  parseStreamableHttpConfig,
} from '../services/mcp/mcpProviderClient.js';
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
        orgId,
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

    res.json({ success: true, data: { id } });
  })
);

router.put(
  '/kpis/:kpiId',
  asyncHandler(async (req, res) => {
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
    } = req.body || {};

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

    res.json({ success: true });
  })
);

router.delete(
  '/kpis/:kpiId',
  asyncHandler(async (req, res) => {
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

    // Cascade cleanup (portable across sqlite/postgres):
    await dbRun(`DELETE FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      orgId,
    ]).catch(() => null);

    await dbRun(`DELETE FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ?`, [
      kpiId,
      orgId,
    ]).catch(() => null);

    const cases = await dbAll<any>(
      `SELECT id FROM kpi_deviation_cases WHERE organization_id = ? AND kpi_id = ?`,
      [orgId, kpiId]
    ).catch(() => []);
    const caseIds = (cases || []).map((c: any) => String(c.id)).filter(Boolean);
    if (caseIds.length) {
      await dbRun(
        `DELETE FROM kpi_deviation_actions WHERE case_id IN (${caseIds.map(() => '?').join(',')})`,
        caseIds
      ).catch(() => null);
    }

    await dbRun(`DELETE FROM kpi_deviation_cases WHERE organization_id = ? AND kpi_id = ?`, [
      orgId,
      kpiId,
    ]).catch(() => null);

    // Finally delete KPI.
    await dbRun(`DELETE FROM initiative_kpis WHERE id = ?`, [kpiId]);

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
        u.id AS user_id,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name
      FROM kpi_time_series ts
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
    const { kpiId } = req.params;
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const body = req.body || {};
    const value = body.value;
    const periodStartRaw = body.periodStart || body.period_start || body.measuredAt || body.measured_at;
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
      return res.status(400).json({ success: false, error: 'periodStart (or measuredAt) is required' });
    }

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        kpiId,
        orgId,
        Number(value),
        periodStart,
        periodEnd,
        source || 'manual',
        notes ? String(notes) : null,
        (req as any).user?.id,
      ]
    );

    // Best-effort: update current_value if column exists (older DBs may not have it).
    const kpiCols = await dbAll<{ name: string }>('PRAGMA table_info(initiative_kpis)', []).catch(
      () => []
    );
    const hasCurrentValue = (kpiCols || []).some((c) => c?.name === 'current_value');
    if (hasCurrentValue) {
      await dbRun(
        `UPDATE initiative_kpis SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(value), kpiId]
      ).catch(() => null);
    }

    // R1 Deviation Management: evaluate + create/reopen case + notify owner
    try {
      await handleTimeSeriesRecorded({
        db: {
          get: (sql: string, params: any[]) => dbGet(sql, params),
          all: (sql: string, params: any[]) => dbAll(sql, params),
          run: (sql: string, params: any[]) => dbRun(sql, params),
        } as any,
        orgId,
        kpiId: String(kpiId),
        value: Number(value),
        periodStart,
        periodEnd,
        recordedByUserId: (req as any).user?.id || null,
      });
    } catch {
      // do not fail write on deviation logic
    }

    res.json({
      success: true,
      data: { id, kpiId, value: Number(value), measuredAt: periodStart, periodStart, periodEnd },
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
      String((req.query as any)?.openOnly || '').trim().toLowerCase() === 'true';

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
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, orgId]
    );
    res.json({ success: true });
  })
);

router.put(
  '/deviation-cases/:caseId/rca',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    const { rcaText } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET rca_text = ?, status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [rcaText != null ? String(rcaText) : null, caseId, orgId]
    );
    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/actions',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    const { title, ownerUserId, dueDate } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });
    const safeTitle = String(title || '').trim();
    if (!safeTitle) return res.status(400).json({ success: false, error: 'title is required' });

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `
      INSERT INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, caseId, safeTitle, ownerUserId || null, dueDate ? String(dueDate).slice(0, 10) : null]
    );
    res.json({ success: true, data: { id } });
  })
);

router.put(
  '/deviation-cases/:caseId/actions/:actionId',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId, actionId } = req.params;
    const { title, ownerUserId, dueDate, status } = req.body || {};
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId || !actionId)
      return res.status(400).json({ success: false, error: 'caseId and actionId are required' });

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
    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/resolve',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, orgId]
    );
    res.json({ success: true });
  })
);

router.post(
  '/deviation-cases/:caseId/close',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { caseId } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

    await dbRun(
      `
      UPDATE kpi_deviation_cases
      SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [caseId, orgId]
    );
    res.json({ success: true });
  })
);

// ============================================================
// V3-M08: MCP-IRIS proof path (read-only KPI refresh)
// ============================================================
router.post(
  '/kpis/:kpiId/refresh/iris',
  asyncHandler(async (req, res) => {
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

      // Insert points (best-effort, no hard dedupe). Source marked for traceability.
      let inserted = 0;
      for (const p of points.slice(0, 500)) {
        const id = uuidv4().replace(/-/g, '');
        await dbRun(
          `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            kpiId,
            orgId,
            p.value,
            p.periodStart,
            null,
            'mcp_iris',
            `ref:provider=${provider.id}`,
            (req as any).user?.id,
          ]
        ).catch(() => null);
        inserted += 1;
      }

      // Update current_value to the newest point if initiative_kpis table exists.
      const ikCols = await dbAll<{ name: string }>('PRAGMA table_info(initiative_kpis)', []).catch(
        () => []
      );
      if (ikCols?.length) {
        const last = points[points.length - 1];
        await dbRun(
          `UPDATE initiative_kpis SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [last.value, kpiId]
        ).catch(() => null);
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
    const orgId = getOrgId(req);
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
    } = req.body;
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
    const orgId = getOrgId(req);
    const { initiativeId } = req.params;
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
    const orgId = getOrgId(req);
    const { initiativeId } = req.params;
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
    const result = await computeAttribution(kpiId, orgId, periodStart, periodEnd);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/attribution/:kpiId/snapshot',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const kpiId = String(req.params.kpiId);
    const { periodStart, periodEnd } = req.body;
    const result = await computeAttribution(kpiId, orgId, String(periodStart), String(periodEnd));
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO kpi_attribution_snapshots (id, kpi_id, organization_id, period_start, period_end, kpi_delta, contributions, unexplained_remainder, unexplained_percent, overall_confidence, confidence_reasons, assumptions, algorithm_version, computed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        kpiId,
        orgId,
        String(periodStart),
        String(periodEnd),
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
    const orgId = getOrgId(req);
    const { statementType, lineCode, lineName, lineNamePl, parentLineId, sortOrder } = req.body;
    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO financial_statement_lines (id, organization_id, statement_type, line_code, line_name, line_name_pl, parent_line_id, sort_order, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        id,
        orgId,
        statementType,
        lineCode,
        lineName,
        lineNamePl || null,
        parentLineId || null,
        sortOrder || 0,
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
    const orgId = getOrgId(req);
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
    } = req.body;
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
        kpiId,
        statementLineId,
        orgId,
        direction,
        relationshipType || 'linear',
        multiplier || 1.0,
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
