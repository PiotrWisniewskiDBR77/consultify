/**
 * User Integrations Settings Routes
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
    const settings = await dbGet(
      'SELECT settings FROM user_integration_settings WHERE user_id = ?',
      [req.user?.id]
    ) as { settings: string } | null;
    res.json(
      settings?.settings ? JSON.parse(settings.settings) : { connectedApps: [], syncEnabled: false }
    );
  })
);

router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const json = JSON.stringify(req.body);
    await dbRun(
      `INSERT INTO user_integration_settings (user_id, settings, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')`,
      [req.user?.id, json, json]
    );
    res.json({ success: true });
  })
);

export default router;
