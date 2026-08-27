/**
 * User Availability Routes
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken, requireActiveMembership);
interface AuthRequest extends Request {
  user?: { id: string };
}

const defaultAvailability = {
  status: 'available',
  workingHours: { start: '09:00', end: '17:00' },
  timezone: 'UTC',
  autoReply: false,
  vacationMode: false,
};

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const avail = (await dbGet('SELECT settings FROM user_availability WHERE user_id = ?', [
      req.user?.id,
    ])) as { settings: string } | null;
    if (!avail?.settings) {
      res.json(defaultAvailability);
      return;
    }

    try {
      res.json(JSON.parse(avail.settings));
    } catch {
      res.json(defaultAvailability);
    }
  })
);

router.put(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const json = JSON.stringify(req.body);
    // FIX (NOT-NULL sweep): user_availability.id is NOT NULL with no DB default
    // (Postgres) — omitting it 500s with 23502 on first insert per user (the
    // ON CONFLICT UPDATE path never touches id, so a fresh uuid here is safe).
    await dbRun(
      `INSERT INTO user_availability (id, user_id, settings, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')`,
      [uuidv4(), req.user?.id, json, json]
    );
    res.json({ success: true });
  })
);

export default router;
