/**
 * Work Mode Routes
 * API endpoints for user work mode preferences (focus, available, away)
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const mode = await dbGet(`
    SELECT mode, custom_status, do_not_disturb, updated_at
    FROM user_work_mode WHERE user_id = ?
  `, [userId]);
  res.json(mode || { mode: 'available', customStatus: null, doNotDisturb: false });
}));

router.put('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { mode, customStatus, doNotDisturb } = req.body;
  await dbRun(`
    INSERT INTO user_work_mode (user_id, mode, custom_status, do_not_disturb, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET mode = ?, custom_status = ?, do_not_disturb = ?, updated_at = datetime('now')
  `, [userId, mode || 'available', customStatus, doNotDisturb ? 1 : 0,
    mode || 'available', customStatus, doNotDisturb ? 1 : 0]);
  res.json({ success: true });
}));

export default router;
