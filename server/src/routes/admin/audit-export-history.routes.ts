import { type NextFunction, type Response, Router } from 'express';
import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
const router = Router();
router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const o = String(req.user?.organizationId || ''),
      u = String(req.user?.id || '');
    if (!o || !u) return res.status(401).json({ error: 'Unauthorized' });
    const m = await dbGet<{ role?: string; status?: string }>(
      'SELECT role,status FROM organization_members WHERE organization_id=? AND user_id=? LIMIT 1',
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
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      raw = parseInt(String(req.query.limit || 50), 10),
      limit = Math.min(200, Math.max(1, Number.isFinite(raw) ? raw : 50));
    const receipts = await dbAll(
      'SELECT id,requested_by,export_kind,filters_json,row_count,output_format,created_at FROM admin_audit_export_receipts WHERE organization_id=? ORDER BY created_at DESC LIMIT ?',
      [o, limit],
      { fallback: false }
    );
    res.json({ success: true, receipts });
  })
);
export default router;
