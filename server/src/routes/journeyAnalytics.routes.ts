/**
 * Journey Analytics Routes
 * API endpoints for customer journey tracking + event ingest (T113)
 */
import { Request, Response, Router } from 'express';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import behaviorIntelligenceService from '../services/behaviorIntelligenceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();

// T113: POST /track — single event ingest
router.post(
  '/track',
  apiAuthRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = (req as any).user?.id || req.body.userId;
    const organizationId = (req as any).user?.organizationId || req.body.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'User ID required' });
    const { eventType, eventName, phase, metadata } = req.body;
    if (!eventType || !eventName) return res.status(400).json({ error: 'eventType and eventName are required' });
    const result = await behaviorIntelligenceService.ingestJourneyEvent(userId, organizationId, { eventType, eventName, phase, metadata });
    return res.json({ success: true, id: result.id });
  })
);

// T113: POST /track/batch — batch event ingest
router.post(
  '/track/batch',
  apiAuthRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = (req as any).user?.id || req.body.userId;
    const organizationId = (req as any).user?.organizationId || req.body.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'User ID required' });
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: 'events array is required' });
    const result = await behaviorIntelligenceService.ingestJourneyBatch(userId, organizationId, events);
    return res.json({ success: true, ingested: result.ingested });
  })
);

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
