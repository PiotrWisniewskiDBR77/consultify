/**
 * User Keyboard Shortcuts Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = (await dbGet(
      'SELECT shortcuts FROM user_keyboard_shortcuts WHERE user_id = ?',
      [req.user?.id]
    )) as { shortcuts: string } | null;
    res.json(settings?.shortcuts ? JSON.parse(settings.shortcuts) : {});
  })
);

router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const json = JSON.stringify(req.body);
    await dbRun(
      `INSERT INTO user_keyboard_shortcuts (user_id, shortcuts, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET shortcuts = ?, updated_at = datetime('now')`,
      [req.user?.id, json, json]
    );
    res.json({ success: true });
  })
);

export default router;
