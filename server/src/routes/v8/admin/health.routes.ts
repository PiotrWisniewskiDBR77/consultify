import type { Response } from 'express';
import { Router } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import {
  getCrossDomainIntegrity,
  getDomainReadiness,
  getPlatformHealth,
  getPlatformMetrics,
} from '../../../services/v8/platformHealthService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;

    const [health, integrity, metrics, readiness] = await Promise.all([
      getPlatformHealth(orgId),
      getCrossDomainIntegrity(orgId),
      getPlatformMetrics(orgId),
      getDomainReadiness(orgId),
    ]);

    res.json({
      data: { health, integrity, metrics, readiness },
      meta: { version: 'v8', timestamp: new Date().toISOString() },
    });
  })
);

export default router;
