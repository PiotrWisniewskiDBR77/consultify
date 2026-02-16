/**
 * Journey Analytics Routes
 * API endpoints for customer journey tracking
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const journeys = await dbAll(
      `
    SELECT id, name, stage_count, conversion_rate, avg_duration_days, created_at
    FROM journey_definitions WHERE organization_id = ? AND is_active = 1
    ORDER BY created_at DESC
  `,
      [orgId]
    );
    res.json(journeys || []);
  })
);

router.get(
  '/funnel',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const funnel = await dbAll(
      `
    SELECT stage, COUNT(*) as count FROM journey_events
    WHERE organization_id = ? AND created_at >= date('now', '-30 days')
    GROUP BY stage ORDER BY stage ASC
  `,
      [orgId]
    );
    res.json(funnel || []);
  })
);

router.get(
  '/metrics',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const metrics = await dbGet(
      `
    SELECT COUNT(DISTINCT user_id) as total_users,
           AVG(duration_seconds) as avg_session_duration,
           COUNT(*) as total_events
    FROM journey_events WHERE organization_id = ? AND created_at >= date('now', '-30 days')
  `,
      [orgId]
    );
    res.json(metrics || { total_users: 0, avg_session_duration: 0, total_events: 0 });
  })
);

export default router;
