/**
 * User Settings History Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll } from '../../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const history = await dbAll(
      `SELECT id, setting_key, old_value, new_value, changed_at
    FROM user_settings_history WHERE user_id = ? ORDER BY changed_at DESC LIMIT 50`,
      [req.user?.id]
    );
    res.json(history || []);
  })
);

export default router;
