import type { Response } from 'express';
import { Router } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getV8MetricsSnapshot } from '../../../utils/v8MetricsStore.js';

const router = Router();

router.get(
  '/',
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const snap = getV8MetricsSnapshot();

    res.json({
      data: {
        requests: snap.requests,
        errors: snap.errors,
        avgLatencyMs: snap.avgLatencyMs,
        uptime: snap.uptime,
      },
      meta: { version: 'v8', collectedAt: new Date().toISOString() },
    });
  })
);

export default router;
