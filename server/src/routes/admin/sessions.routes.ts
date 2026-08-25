import { type NextFunction, type Response, Router } from 'express';
import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
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
    if (!['ADMIN', 'OWNER'].includes(String(m.role).toUpperCase()))
      return res.status(403).json({ code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      columns = await getTableColumns('user_sessions');
    const activity = columns.has('last_activity_at')
      ? 'last_activity_at'
      : columns.has('last_active_at')
        ? 'last_active_at'
        : 'created_at';
    const active = columns.has('is_active')
      ? `COALESCE(CAST(s.is_active AS TEXT),'0') IN ('1','true','TRUE','t','T')`
      : 'TRUE';
    const orgExtra = columns.has('organization_id') ? ' AND s.organization_id = ?' : '';
    const rawLimit = parseInt(String(req.query.limit || 50), 10),
      rawOffset = parseInt(String(req.query.offset || 0), 10),
      limit = Math.min(200, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50)),
      offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0),
      userId = String(req.query.userId || '').trim();
    const params: any[] = [o];
    if (columns.has('organization_id')) params.push(o);
    const userClause = userId ? ' AND s.user_id = ?' : '';
    if (userId) params.push(userId);
    params.push(limit, offset);
    const optional = (name: string, fallback: string) =>
      columns.has(name) ? `s.${name}` : `${fallback} AS ${name}`;
    const sessions = await dbAll(
      `SELECT s.id,s.user_id,u.email AS user_email,u.first_name,u.last_name,${optional('device_info', "''")},${optional('user_agent', "''")},${optional('ip_address', "''")},${optional('location', "''")},s.created_at,s.${activity} AS last_activity,${optional('expires_at', 'NULL')} FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE u.organization_id = ?${orgExtra} AND ${active}${userClause} ORDER BY s.${activity} DESC LIMIT ? OFFSET ?`,
      params,
      { fallback: false }
    );
    res.json({ success: true, sessions, pagination: { limit, offset } });
  })
);
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      id = String(req.params.id);
    const found = await dbGet(
      'SELECT s.id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.organization_id=?',
      [id, o],
      { fallback: false }
    );
    if (!found) return res.status(404).json({ error: 'Not found' });
    const columns = await getTableColumns('user_sessions');
    if (columns.has('revoked_at'))
      await dbRun(
        `UPDATE user_sessions SET revoked_at=CURRENT_TIMESTAMP${columns.has('is_active') ? ', is_active=0' : ''}${columns.has('revoke_reason') ? ", revoke_reason='revoked_by_tenant_admin'" : ''} WHERE id=?`,
        [id],
        { fallback: false }
      );
    else await dbRun('DELETE FROM user_sessions WHERE id=?', [id], { fallback: false });
    res.json({ success: true });
  })
);
export default router;
