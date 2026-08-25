import { type NextFunction, type Response, Router } from 'express';
import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
const router = Router();
router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const o = String(req.user?.organizationId || '').trim(),
      u = String(req.user?.id || '').trim();
    if (!o || !u) return res.status(401).json({ error: 'Unauthorized' });
    const m = await dbGet<{ role?: string; status?: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
      [o, u],
      { fallback: false }
    );
    if (!m || String(m.status).toUpperCase() !== 'ACTIVE')
      return res.status(403).json({ code: 'ADMIN_MEMBERSHIP_REQUIRED' });
    if (!['OWNER', 'ADMIN'].includes(String(m.role).toUpperCase()))
      return res.status(403).json({ code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);
const list = async (o: string) =>
  dbAll(
    `SELECT se.id, se.event_type, se.severity, se.user_id, u.email AS user_email, se.ip_address, se.details, se.resolved, se.created_at, se.resolved_at FROM security_events se LEFT JOIN users u ON u.id=se.user_id WHERE se.organization_id = ? ORDER BY se.created_at DESC LIMIT 200`,
    [o],
    { fallback: false }
  );
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) =>
    res.json({ success: true, alerts: await list(String(req.user?.organizationId)) })
  )
);
router.put(
  '/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      id = String(req.params.id),
      actor = String(req.user?.id);
    const found = await dbGet(
      'SELECT id FROM security_events WHERE id = ? AND organization_id = ?',
      [id, o],
      { fallback: false }
    );
    if (!found) return res.status(404).json({ success: false, error: 'Not found' });
    await dbRun(
      `UPDATE security_events SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ? AND organization_id = ?`,
      [actor, id, o],
      { fallback: false }
    );
    res.json({ success: true, alerts: await list(o) });
  })
);
export default router;
