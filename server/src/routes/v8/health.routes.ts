import { Router } from 'express';
import type { Response } from 'express';

import verifyToken, { type AuthRequest } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDomainReadiness, getPlatformHealth } from '../../services/v8/platformHealthService.js';

const router = Router();

router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(400).json({ error: 'Organization context required', code: 'MISSING_ORG' });
      return;
    }
    try {
      const health = await getPlatformHealth(orgId);
      res.json({ data: health, meta: { version: 'v8' } });
    } catch {
      res.json({
        data: { overall: 'not_ready', domains: {}, timestamp: new Date().toISOString() },
        meta: { version: 'v8', note: 'V8 tables may not be initialized yet' },
      });
    }
  }),
);

router.get(
  '/readiness',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(400).json({ error: 'Organization context required', code: 'MISSING_ORG' });
      return;
    }
    const readiness = await getDomainReadiness(orgId);
    res.json({ data: readiness, meta: { version: 'v8' } });
  }),
);

export default router;
