/**
 * Daily Brief Routes
 * API endpoints for user daily briefing
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;

    // Aggregate today's brief
    const tasks = await dbAll(
      `
    SELECT id, title, priority, due_date FROM tasks 
    WHERE assignee_id = ? AND status != 'completed' AND due_date <= date('now', '+7 days')
    ORDER BY priority DESC, due_date ASC LIMIT 10
  `,
      [userId]
    );

    const notifications = await dbAll(
      `
    SELECT id, title, type, created_at FROM notifications
    WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 5
  `,
      [userId]
    );

    const meetings = await dbAll(
      `
    SELECT id, title, start_time, end_time FROM calendar_events
    WHERE user_id = ? AND date(start_time) = date('now') ORDER BY start_time ASC
  `,
      [userId]
    );

    const decisions = await dbAll(
      `
    SELECT id, title, status FROM decisions
    WHERE organization_id = ? AND status = 'pending' LIMIT 5
  `,
      [orgId]
    );

    res.json({
      date: new Date().toISOString().split('T')[0],
      tasks: tasks || [],
      notifications: notifications || [],
      meetings: meetings || [],
      pendingDecisions: decisions || [],
      summary: {
        tasksDue: (tasks || []).length,
        unreadNotifications: (notifications || []).length,
        meetingsToday: (meetings || []).length,
        pendingDecisions: (decisions || []).length,
      },
    });
  })
);

router.get(
  '/settings',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const settings = await dbGet(`SELECT settings FROM daily_brief_settings WHERE user_id = ?`, [
      userId,
    ]);
    res.json(
      settings?.settings
        ? JSON.parse(settings.settings)
        : {
            enabled: true,
            sendTime: '08:00',
            includeCalendar: true,
            includeTasks: true,
            includeDecisions: true,
            email: false,
          }
    );
  })
);

router.put(
  '/settings',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const settingsJson = JSON.stringify(req.body);
    await dbRun(
      `
    INSERT INTO daily_brief_settings (user_id, settings, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')
  `,
      [userId, settingsJson, settingsJson]
    );
    res.json({ success: true });
  })
);

export default router;
