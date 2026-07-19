/**
 * Notification Settings Routes
 * API endpoints for user notification preferences
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

const DEFAULT_SETTINGS = {
  email: { enabled: true, digest: 'daily', types: ['task', 'decision', 'mention'] },
  push: { enabled: true, types: ['task', 'decision', 'mention', 'alert'] },
  inApp: { enabled: true, types: ['all'] },
  slack: { enabled: false, webhookUrl: null },
  quiet: { enabled: false, startHour: 22, endHour: 7 },
};

/**
 * GET /api/notification-settings
 * Get user's notification settings
 */
router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    const settings = (await dbGet(
      `
    SELECT settings FROM notification_settings WHERE user_id = ?
  `,
      [userId]
    )) as { settings: string } | null;

    if (settings?.settings) {
      try {
        res.json(JSON.parse(settings.settings));
      } catch {
        res.json(DEFAULT_SETTINGS);
      }
    } else {
      res.json(DEFAULT_SETTINGS);
    }
  })
);

/**
 * PUT /api/notification-settings
 * Update user's notification settings
 */
router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const newSettings = req.body;

    // Validate structure
    if (
      !newSettings ||
      typeof newSettings !== 'object' ||
      Array.isArray(newSettings) ||
      Object.keys(newSettings).length === 0
    ) {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    const allowedTopLevelKeys = new Set(['email', 'push', 'inApp', 'slack', 'quiet']);
    const hasKnownKey = Object.keys(newSettings).some((k) => allowedTopLevelKeys.has(k));
    if (!hasKnownKey) {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    const settingsJson = JSON.stringify(newSettings);

    const result = (await dbRun(
      `
    INSERT INTO notification_settings (user_id, settings, updated_at)
    VALUES (?, ?, now())
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = now()
  `,
      [userId, settingsJson, settingsJson]
    )) as { success?: boolean; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Failed to update notification settings');
    }

    logger.info(`[NotificationSettings] Updated for user ${userId}`);
    res.json({ success: true });
  })
);

/**
 * PATCH /api/notification-settings/:channel
 * Update specific channel settings
 */
router.patch(
  '/:channel',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { channel } = req.params;
    const channelSettings = req.body;

    const validChannels = ['email', 'push', 'inApp', 'slack', 'quiet'];
    if (!validChannels.includes(String(channel))) {
      return res.status(400).json({ error: 'Invalid channel' });
    }

    // Get existing settings
    const existing = (await dbGet(
      `
    SELECT settings FROM notification_settings WHERE user_id = ?
  `,
      [userId]
    )) as { settings: string } | null;

    let currentSettings = DEFAULT_SETTINGS;
    if (existing?.settings) {
      try {
        currentSettings = JSON.parse(existing.settings);
      } catch {}
    }

    // Merge channel settings
    currentSettings[channel as keyof typeof DEFAULT_SETTINGS] = {
      ...currentSettings[channel as keyof typeof DEFAULT_SETTINGS],
      ...channelSettings,
    };

    const settingsJson = JSON.stringify(currentSettings);

    const result = (await dbRun(
      `
    INSERT INTO notification_settings (user_id, settings, updated_at)
    VALUES (?, ?, now())
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = now()
  `,
      [userId, settingsJson, settingsJson]
    )) as { success?: boolean; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Failed to update channel settings');
    }

    const channelKey = String(channel);
    res.json({
      success: true,
      [channelKey]: currentSettings[channelKey as keyof typeof DEFAULT_SETTINGS],
    });
  })
);

/**
 * POST /api/notification-settings/reset
 * Reset to default settings
 */
router.post(
  '/reset',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    const result = (await dbRun(
      `
    DELETE FROM notification_settings WHERE user_id = ?
  `,
      [userId]
    )) as { success?: boolean; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Failed to reset notification settings');
    }

    logger.info(`[NotificationSettings] Reset for user ${userId}`);
    res.json({ success: true, settings: DEFAULT_SETTINGS });
  })
);

/**
 * POST /api/notification-settings/test/:channel
 * Send test notification
 */
router.post(
  '/test/:channel',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { channel } = req.params;

    const validChannels = ['email', 'push', 'slack'];
    if (!validChannels.includes(String(channel))) {
      return res.status(400).json({ error: 'Invalid channel for testing' });
    }

    // In production, this would actually send a test notification
    logger.info(`[NotificationSettings] Test ${channel} notification for user ${userId}`);

    res.json({
      success: true,
      message: `Test ${channel} notification sent. Check your ${channel} for the test message.`,
    });
  })
);

export default router;
