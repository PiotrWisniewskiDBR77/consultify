/**
 * Management Reports Analytics Routes
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import managementReportsService from '../services/managementReportsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);
router.use(demoContextMiddleware);

/**
 * DEC-136: same rule as managementReports.routes.ts — organization comes from
 * the verified token only. (These two paths are today shadowed by the identical
 * routes on the main router, which is mounted first, but the fallback is
 * removed here as well so the shadowing is not what keeps them safe.)
 */
const requireOrganizationId = (req: AuthRequest, res: Response): string | null => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return organizationId;
};

router.get(
  '/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;
    const data = await managementReportsService.getUsageAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

router.get(
  '/types',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;
    const data = await managementReportsService.getTypesAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

export default router;
