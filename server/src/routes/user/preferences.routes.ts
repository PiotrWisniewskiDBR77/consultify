/**
 * User Preferences Routes
 * API endpoints for user preferences management
 */
import { Response, Router } from 'express';

import { AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken);

const upsertUserPreference = async (userId: string, key: string, value: unknown) => {
  const result = await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, key, JSON.stringify(value)],
    { fallback: false }
  );

  if (!result.success) {
    throw new Error(result.error || `Failed to save preference ${key}`);
  }
};

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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    for (const [key, value] of Object.entries(updates)) {
      await upsertUserPreference(userId, key, value);
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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await upsertUserPreference(userId, 'ui', uiPrefs);

    res.json({ success: true, message: 'UI preferences updated' });
  })
);

export default router;
