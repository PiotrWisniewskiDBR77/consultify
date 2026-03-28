import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getDomainReadiness, getPlatformHealth } from '../../services/v8/platformHealthService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    try {
      const health = await getPlatformHealth(orgId);
      res.json({ data: health, meta: { version: 'v8' } });
    } catch {
      res.json({
        data: { overall: 'not_ready', domains: {}, timestamp: new Date().toISOString() },
        meta: { version: 'v8', note: 'V8 tables may not be initialized yet' },
      });
    }
  })
);

router.get(
  '/readiness',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const readiness = await getDomainReadiness(orgId);
    res.json({ data: readiness, meta: { version: 'v8' } });
  })
);

export default router;
