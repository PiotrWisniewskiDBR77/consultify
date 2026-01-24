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

router.get(
  '/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.organizationId || (req.query.organizationId as string);
    const data = await managementReportsService.getUsageAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

router.get(
  '/types',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.organizationId || (req.query.organizationId as string);
    const data = await managementReportsService.getTypesAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

export default router;
