/**
 * User Security Advanced Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken);
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/sessions',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const sessions = await dbAll(
      `SELECT id,
              device_info as device,
              ip_address,
              last_active_at as last_active,
              created_at
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY COALESCE(last_active_at, created_at) DESC`,
      [req.user?.id]
    );
    res.json(sessions || []);
  })
);

router.delete(
  '/sessions/:sessionId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM user_sessions WHERE id = ? AND user_id = ?', [
      req.params.sessionId,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

router.get(
  '/login-history',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const history = await dbAll(
      `SELECT id,
              ip_address,
              user_agent as device,
              location,
              CASE WHEN status = 'success' THEN 1 ELSE 0 END as success,
              created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user?.id]
    );
    res.json(history || []);
  })
);

router.get(
  '/trusted-devices',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const devices = await dbAll(
      `SELECT id, device_name, device_fingerprint, trusted_at
    FROM trusted_devices WHERE user_id = ? ORDER BY trusted_at DESC`,
      [req.user?.id]
    );
    res.json(devices || []);
  })
);

router.delete(
  '/trusted-devices/:deviceId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM trusted_devices WHERE id = ? AND user_id = ?', [
      req.params.deviceId,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
