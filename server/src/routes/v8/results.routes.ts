/**
 * V8 read-only Results / KPI / ROI bridge — org-scoped dashboard snapshot from
 * `resultsROIService` runtime aggregates.
 * Namespace: /api/v8/results (mounted by v8/index).
 *
 * @module routes/v8/results.routes
 */

import { Router } from 'express';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getResultsDashboard,
  getResultsKpiDrawerDetail,
  getResultsKpiCatalog,
  getROIPortfolioSummary,
  getROIInitiativeDetail,
} from '../../services/v8/resultsROIService.js';
import { run as dbRun } from '../../utils/DbPromise.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

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
  }),
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
  }),
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
      ],
    );

    return res.json({
      data: { id },
      meta: resultsWriteMeta(),
    });
  }),
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
      ],
    );

    return res.json({
      data: { id, initiativeId, kpiId },
      meta: resultsWriteMeta(),
    });
  }),
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
  }),
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
  }),
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
  }),
);

export default router;
