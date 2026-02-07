/**
 * Settlements Routes
 * API endpoints for billing settlements / payouts
 */
import { Request, Response, Router } from 'express';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const settlements = await dbAll(
      `
    SELECT id, period_start, period_end, amount, currency, status, paid_at, created_at
    FROM settlements WHERE organization_id = ?
    ORDER BY created_at DESC LIMIT 50
  `,
      [orgId]
    );
    res.json(settlements || []);
  })
);

router.get(
  '/summary',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const summary = await dbGet(
      `
    SELECT 
      COUNT(*) as total_settlements,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
      MAX(paid_at) as last_paid_at
    FROM settlements WHERE organization_id = ?
  `,
      [orgId]
    );
    res.json(summary || { total_settlements: 0, total_paid: 0, total_pending: 0 });
  })
);

router.get(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const settlement = await dbGet(
      `
    SELECT * FROM settlements WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    res.json(settlement);
  })
);

router.get(
  '/:id/line-items',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const items = await dbAll(
      `
    SELECT id, description, quantity, unit_price, total, created_at
    FROM settlement_line_items WHERE settlement_id = ?
    ORDER BY created_at
  `,
      [id]
    );
    res.json(items || []);
  })
);

// SuperAdmin: process settlement
router.post(
  '/:id/process',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await dbRun(
      `
    UPDATE settlements SET status = 'processing', updated_at = datetime('now') WHERE id = ? AND status = 'pending'
  `,
      [id]
    );
    logger.info(`[Settlements] Processing settlement ${id}`);
    res.json({ success: true });
  })
);

export default router;
