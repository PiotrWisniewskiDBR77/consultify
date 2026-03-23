import { Router } from 'express';
import type { Response } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getV8MetricsSnapshot } from '../../../utils/v8MetricsStore.js';

const router = Router();

router.get(
  '/',
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const snap = getV8MetricsSnapshot();
    const avgLatency =
      snap.v8RequestCount > 0
        ? Math.round(snap.v8TotalLatencyMs / snap.v8RequestCount)
        : 0;

    res.json({
      data: {
        requests: snap.v8RequestCount,
        errors: snap.v8ErrorCount,
        avgLatencyMs: avgLatency,
        uptime: process.uptime(),
      },
      meta: { version: 'v8', collectedAt: new Date().toISOString() },
    });
  }),
);

export default router;
