/**
 * Permission Requests Routes
 * API endpoints for permission elevation requests
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

const permissionRequestBelongsToOrg = async (
  requestId: string,
  organizationId: string | undefined
): Promise<boolean> => {
  if (!organizationId) return false;
  const row = (await dbGet('SELECT organization_id FROM permission_requests WHERE id = ?', [
    requestId,
  ])) as { organization_id?: string } | null;
  return row?.organization_id === organizationId;
};

router.get(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const status = req.query.status || 'pending';
    const reqs = await dbAll(
      `
    SELECT pr.id, pr.user_id, pr.requested_permission, pr.reason, pr.status,
           pr.created_at, pr.resolved_at, u.first_name, u.last_name, u.email
    FROM permission_requests pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.organization_id = ? AND (pr.status = ? OR ? = 'all')
    ORDER BY pr.created_at DESC
  `,
      [orgId, status, status]
    );
    res.json(reqs || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { requestedPermission, reason } = req.body;
    if (!requestedPermission) return res.status(400).json({ error: 'Permission required' });
    const id = uuidv4();
    // permission_requests.request_type is NOT NULL with no DB default (Postgres
    // rejects the row; SQLite let it slide). This route only models one kind of
    // request (an ad-hoc permission grant), so mirror that into request_type —
    // there's no CHECK constraint restricting it to a fixed enum.
    await dbRun(
      `
    INSERT INTO permission_requests (id, user_id, organization_id, request_type, requested_permission, reason, status, created_at)
    VALUES (?, ?, ?, 'permission_grant', ?, ?, 'pending', datetime('now'))
  `,
      [id, userId, orgId, requestedPermission, reason || '']
    );
    logger.info(`[Permissions] Request by ${userId}: ${requestedPermission}`);
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id/approve',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!(await permissionRequestBelongsToOrg(id, req.user?.organizationId))) {
      return res.status(404).json({ error: 'Permission request not found' });
    }
    await dbRun(
      `
    UPDATE permission_requests SET status = 'approved', resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `,
      [userId, id]
    );
    res.json({ success: true });
  })
);

router.put(
  '/:id/reject',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const { rejectionReason } = req.body;
    if (!(await permissionRequestBelongsToOrg(id, req.user?.organizationId))) {
      return res.status(404).json({ error: 'Permission request not found' });
    }
    await dbRun(
      `
    UPDATE permission_requests SET status = 'rejected', resolved_by = ?, resolved_at = datetime('now'),
    rejection_reason = ? WHERE id = ? AND status = 'pending'
  `,
      [userId, rejectionReason || '', id]
    );
    res.json({ success: true });
  })
);

export default router;
