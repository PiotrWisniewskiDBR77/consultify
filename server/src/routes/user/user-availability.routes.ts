/**
 * User Availability Routes
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
    const avail = (await dbGet('SELECT settings FROM user_availability WHERE user_id = ?', [
      req.user?.id,
    ])) as { settings: string } | null;
    res.json(
      avail?.settings
        ? JSON.parse(avail.settings)
        : {
            status: 'available',
            workingHours: { start: '09:00', end: '17:00' },
            timezone: 'UTC',
            autoReply: false,
            vacationMode: false,
          }
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
      `INSERT INTO user_availability (user_id, settings, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')`,
      [req.user?.id, json, json]
    );
    res.json({ success: true });
  })
);

export default router;
