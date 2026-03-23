import { Router } from 'express';
import type { Response } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  getShadowStats,
  getRecentComparisons,
  getShadowPromotionReadiness,
} from '../../../services/v8/shadowModeService.js';

const router = Router();

router.get(
  '/stats',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const stats = await getShadowStats(orgId);
    res.json({ data: stats, meta: { version: 'v8' } });
  }),
);

router.get(
  '/comparisons',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const comparisons = await getRecentComparisons(orgId, Math.min(limit, 200));
    res.json({ data: comparisons, meta: { version: 'v8', count: comparisons.length } });
  }),
);

router.get(
  '/promotion-readiness',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const readiness = await getShadowPromotionReadiness(orgId);
    res.json({ data: readiness, meta: { version: 'v8' } });
  }),
);

export default router;
