/**
 * User Keyboard Shortcuts Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
const SHORTCUTS_KEY = 'settings:keyboard_shortcuts';
interface AuthRequest extends Request {
  user?: { id: string };
}

async function ensureUserPreferencesTable() {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, key)
    )`,
    []
  );
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserPreferencesTable();
    const settings = (await dbGet(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
      [req.user?.id, SHORTCUTS_KEY]
    )) as { value: string } | null;
    res.json(settings?.value ? JSON.parse(settings.value) : {});
  })
);

router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserPreferencesTable();
    const json = JSON.stringify(req.body);
    await dbRun(
      `INSERT INTO user_preferences (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [req.user?.id, SHORTCUTS_KEY, json]
    );
    res.json({ success: true });
  })
);

export default router;
