/**
 * V8 read-only Results / KPI / ROI bridge — org-scoped dashboard snapshot from
 * `resultsROIService` runtime aggregates.
 * Namespace: /api/v8/results (mounted by v8/index).
 *
 * @module routes/v8/results.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getResultsDashboard,
  getResultsKpiDrawerDetail,
  getResultsKpiCatalog,
  getROIPortfolioSummary,
  getROIInitiativeDetail,
} from '../../services/v8/resultsROIService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 Results read responses. */
export const V8_RESULTS_READ_CONTRACT = 'results_runtime_read_v1';

function resultsMeta() {
  return { version: 'v8' as const, contract: V8_RESULTS_READ_CONTRACT };
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
