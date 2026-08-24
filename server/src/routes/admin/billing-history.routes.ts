import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';

const router = Router();

router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId) {
      res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    const membership = await dbGet<{ role?: string; status?: string }>(
      `SELECT role, status FROM organization_members
       WHERE organization_id = ? AND user_id = ? LIMIT 1`,
      [organizationId, userId],
      { fallback: false }
    );
    if (!membership || String(membership.status || '').trim().toUpperCase() !== 'ACTIVE') {
      res.status(403).json({ success: false, error: 'Active organization membership required', code: 'ADMIN_MEMBERSHIP_REQUIRED' });
      return;
    }
    if (!['OWNER', 'ADMIN'].includes(String(membership.role || '').trim().toUpperCase())) {
      res.status(403).json({ success: false, error: 'Tenant admin role required', code: 'ADMIN_ACCESS_REQUIRED' });
      return;
    }
    next();
  })
);
router.use(verifyAdmin);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    if (!organizationId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const requestedLimit = Number.parseInt(String(req.query.limit || '50'), 10);
    const requestedOffset = Number.parseInt(String(req.query.offset || '0'), 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));
    const offset = Math.max(0, Number.isFinite(requestedOffset) ? requestedOffset : 0);
    const rows = await dbAll(
      `SELECT id, action, from_plan, to_plan, reason, performed_by, metadata, created_at
       FROM subscription_history
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [organizationId, limit, offset],
      { fallback: false }
    );
    return res.json({ success: true, data: rows, pagination: { limit, offset } });
  })
);

export default router;
