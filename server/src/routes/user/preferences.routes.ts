/**
 * User Preferences Routes
 * API endpoints for user preferences management
 */
import { Response, Router } from 'express';

import { AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

// GET /api/preferences - Get user preferences
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    const prefs = await dbAll(`SELECT key, value FROM user_preferences WHERE user_id = ?`, [
      userId,
    ]);

    const preferences: Record<string, any> = {};
    prefs.forEach((p: any) => {
      try {
        preferences[p.key] = JSON.parse(p.value);
      } catch {
        preferences[p.key] = p.value;
      }
    });

    res.json({
      theme: preferences.theme || 'system',
      language: preferences.language || 'en',
      timezone: preferences.timezone || 'UTC',
      notifications: preferences.notifications || { email: true, push: true },
      dashboardLayout: preferences.dashboardLayout || 'default',
      ...preferences,
    });
  })
);

// GET /api/preferences/options - Get available preference options
router.get(
  '/options',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      themes: ['light', 'dark', 'system'],
      languages: ['en', 'pl', 'de', 'fr', 'es'],
      timezones: ['UTC', 'Europe/Warsaw', 'America/New_York', 'Asia/Tokyo'],
      dashboardLayouts: ['default', 'compact', 'expanded'],
    });
  })
);

// PUT /api/preferences - Update user preferences
router.put(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      await dbRun(
        `INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at) 
             VALUES (?, ?, ?, datetime('now'))`,
        [userId, key, JSON.stringify(value)]
      );
    }

    res.json({ success: true, message: 'Preferences updated' });
  })
);

// PUT /api/preferences/ui - Update UI preferences
router.put(
  '/ui',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { theme, sidebarCollapsed, compactMode } = req.body;

    const uiPrefs = { theme, sidebarCollapsed, compactMode };

    await dbRun(
      `INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at) 
         VALUES (?, 'ui', ?, datetime('now'))`,
      [userId, JSON.stringify(uiPrefs)]
    );

    res.json({ success: true, message: 'UI preferences updated' });
  })
);

export default router;
