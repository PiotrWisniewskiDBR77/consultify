/**
 * M15/W2-W4 — value intelligence route.
 *
 * GET /api/results-value/:projectId/value-intelligence — gathers the org's
 * initiatives + ROI assumptions + realized values and composes the value-assurance
 * payload (banked/forecast/at-risk, funnel, SCALE/INTERVENE/STOP decisions).
 * Org-wide when projectId is 'all'/'null'/absent. Read-only.
 */
import { Router, type Response } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  buildValueIntelligence,
  type VIInitiative,
  type VIRoiAssumption,
  type VIRoiRealized,
} from '../services/results/resultsValueIntelligenceService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface AuthedRequest {
  user?: { organizationId?: string };
  params: Record<string, string>;
}

const router = Router();

router.get(
  '/:projectId/value-intelligence',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, error: 'organization context required' });
      return;
    }
    const projectId = req.params.projectId;
    const orgWide = !projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined';

    const initiatives = ((await dbAll(
      orgWide
        ? `SELECT id, name, status FROM initiatives WHERE organization_id = ?`
        : `SELECT id, name, status FROM initiatives WHERE project_id = ? AND organization_id = ?`,
      orgWide ? [orgId] : [projectId, orgId]
    )) as VIInitiative[] | undefined) || [];

    const roiAssumptions = ((await dbAll(
      `SELECT initiative_id, expected_npv, expected_revenue_delta, expected_cost_delta
       FROM roi_assumptions WHERE organization_id = ?`,
      [orgId]
    )) as VIRoiAssumption[] | undefined) || [];

    const roiRealized = ((await dbAll(
      `SELECT initiative_id, realized_revenue_delta, realized_cost_delta, realized_savings
       FROM roi_realized_values WHERE organization_id = ?`,
      [orgId]
    )) as VIRoiRealized[] | undefined) || [];

    const data = buildValueIntelligence({ initiatives, roiAssumptions, roiRealized });
    // Return the bare payload (not {success,data}): the FE Api proxy maps
    // `response.data` to the whole payload, so a wrapper would hide the fields.
    res.json(data);
  })
);

export default router;
