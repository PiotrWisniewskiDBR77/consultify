/**
 * Stabilization Routes - System stabilization monitoring
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();

router.get(
  '/status',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const dbStatus = (await dbGet(
      `SELECT COUNT(*)::int as tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    )) as { tables: number } | null;
    const errorCount = await dbGet<any>(
      "SELECT COUNT(*)::int as count FROM error_logs WHERE created_at > NOW() - INTERVAL '1 hour'"
    );
    res.json({
      status: 'stable',
      uptime: process.uptime(),
      database: { tables: dbStatus?.tables || 0, status: 'connected' },
      recentErrors: errorCount?.count || 0,
      memory: process.memoryUsage(),
    });
  })
);

router.get(
  '/health-history',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const history = await dbAll(`
    SELECT date, avg_response_ms, error_rate, uptime_pct FROM system_health_history ORDER BY date DESC LIMIT 30
  `);
    res.json(history);
  })
);

export default router;
