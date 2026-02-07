/**
 * Stabilization Routes - System stabilization monitoring
 */
import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, all as dbAll } from '../utils/DbPromise.js';

const router = Router();

router.get('/status', verifyToken, verifySuperAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const dbStatus = await dbGet('SELECT COUNT(*) as tables FROM sqlite_master WHERE type = ?', ['table']);
  const errorCount = await dbGet<any>('SELECT COUNT(*) as count FROM error_logs WHERE created_at > datetime(\'now\', \'-1 hour\')');
  res.json({
    status: 'stable', uptime: process.uptime(),
    database: { tables: dbStatus?.tables || 0, status: 'connected' },
    recentErrors: errorCount?.count || 0,
    memory: process.memoryUsage()
  });
}));

router.get('/health-history', verifyToken, verifySuperAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const history = await dbAll(`
    SELECT date, avg_response_ms, error_rate, uptime_pct FROM system_health_history ORDER BY date DESC LIMIT 30
  `);
  res.json(history || []);
}));

export default router;
