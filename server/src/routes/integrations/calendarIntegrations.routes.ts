/**
 * Calendar Integrations Routes
 * API endpoints for calendar sync functionality
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

/**
 * GET /api/integrations/calendars
 * Get connected calendars
 */
router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const calendars = await dbAll(`
    SELECT id, provider, calendar_name, is_active, sync_enabled, last_synced_at, created_at
    FROM calendar_integrations WHERE user_id = ?
    ORDER BY created_at DESC
  `, [userId]);
  res.json(calendars || []);
}));

/**
 * POST /api/integrations/calendars/connect
 * Connect a new calendar
 */
router.post('/connect', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { provider, accessToken, refreshToken, calendarName } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'Provider is required' });
  }

  const id = uuidv4();
  const result = await dbRun(`
    INSERT INTO calendar_integrations (id, user_id, provider, calendar_name, access_token, 
                                       refresh_token, is_active, sync_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
  `, [id, userId, provider, calendarName || provider, accessToken || '', refreshToken || '']);

  if (!result.success) throw new Error(result.error || 'Failed to connect calendar');

  logger.info(`[Calendar] Connected ${provider} for user ${userId}`);
  res.status(201).json({ success: true, id });
}));

/**
 * DELETE /api/integrations/calendars/:id
 * Disconnect a calendar
 */
router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const result = await dbRun(`
    DELETE FROM calendar_integrations WHERE id = ? AND user_id = ?
  `, [id, userId]);

  if (!result.success) throw new Error(result.error || 'Failed to disconnect calendar');
  res.json({ success: true });
}));

/**
 * POST /api/integrations/calendars/:id/sync
 * Trigger calendar sync
 */
router.post('/:id/sync', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  await dbRun(`
    UPDATE calendar_integrations SET last_synced_at = datetime('now') WHERE id = ? AND user_id = ?
  `, [id, userId]);

  logger.info(`[Calendar] Sync triggered for ${id}`);
  res.json({ success: true, message: 'Calendar sync initiated' });
}));

/**
 * GET /api/integrations/calendars/settings
 * Get calendar sync settings
 */
router.get('/settings/current', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const settings = await dbGet(`
    SELECT settings FROM user_calendar_settings WHERE user_id = ?
  `, [userId]);

  res.json(settings?.settings ? JSON.parse(settings.settings) : {
    syncEnabled: false, syncInterval: 15, defaultReminder: 10, calendars: []
  });
}));

export default router;
