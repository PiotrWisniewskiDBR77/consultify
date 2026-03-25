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
import { getResultsDashboard } from '../../services/v8/resultsROIService.js';
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

export default router;
