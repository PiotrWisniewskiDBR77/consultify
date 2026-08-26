import { type NextFunction, type Response, Router } from 'express';
import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireAudit } from '../../middleware/requireAudit.middleware.js';
import adminSessionService from '../../services/adminSessionService.js';
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
router.use(requireAudit);

function auditUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    code: 'AUDIT_UNAVAILABLE',
    operationApplied: true,
    error: 'Operation completed but its audit record could not be persisted',
  });
}
async function policy(o: string) {
  const row = await dbGet<{ setting_value?: string }>(
    'SELECT setting_value FROM organization_settings WHERE organization_id=? AND setting_key=?',
    [o, 'admin_iam_policy'],
    { fallback: true }
  );
  try {
    return JSON.parse(row?.setting_value || '{}');
  } catch {
    return {};
  }
}
async function payload(o: string) {
  const sessions = (await adminSessionService.getActiveSessions(undefined, o)).filter(
    (s) => s.sessionType === 'break_glass'
  );
  const p = await policy(o);
  const ids = Array.isArray(p.breakGlassApprovers) ? p.breakGlassApprovers : [];
  const approvers = ids.length
    ? await dbAll(
        'SELECT u.id,u.email,u.first_name,u.last_name FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status=? AND u.id IN (' +
          ids.map(() => '?').join(',') +
          ')',
        [o, 'ACTIVE', ...ids],
        { fallback: false }
      )
    : [];
  return {
    sessions,
    policy: { breakGlassEnabled: Boolean(p.breakGlassEnabled), breakGlassApprovers: ids },
    approvers,
  };
}
router.get(
  '/sessions',
  asyncHandler(async (req: AuthRequest, res: Response) =>
    res.json({ success: true, ...(await payload(String(req.user?.organizationId))) })
  )
);
router.post(
  '/sessions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      actor = String(req.user?.id),
      reason = String(req.body?.breakGlassReason || '').trim(),
      approvedBy = String(req.body?.approvedBy || '').trim();
    if (reason.length < 10)
      return res
        .status(400)
        .json({ error: 'breakGlassReason must contain at least 10 characters' });
    if (!approvedBy || approvedBy === actor)
      return res.status(400).json({ error: 'approvedBy must be a different active member' });
    const approver = await dbGet(
      'SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND status=?',
      [o, approvedBy, 'ACTIVE'],
      { fallback: false }
    );
    if (!approver)
      return res
        .status(400)
        .json({ error: 'Approver must be an active member of this organization' });
    const p = await policy(o);
    if (p.breakGlassEnabled === false)
      return res.status(400).json({ error: 'Break-glass is disabled by organization policy' });
    if (
      Array.isArray(p.breakGlassApprovers) &&
      p.breakGlassApprovers.length &&
      !p.breakGlassApprovers.includes(approvedBy)
    )
      return res.status(400).json({ error: 'Member is not an approved break-glass approver' });
    const session = await adminSessionService.createSession({
      userId: actor,
      organizationId: o,
      sessionType: 'break_glass',
      expiresInHours: 1,
      breakGlassReason: reason,
      approvedBy,
      createdBy: actor,
    });
    try {
      await req.emitAuditEvent?.({
        action: 'break_glass_session.created',
        resourceType: 'break_glass_session',
        resourceId: String(session?.id || actor),
        after: { active: true, approvedBy },
        metadata: { reason, approvedBy, expiresInHours: 1 },
      });
    } catch {
      return auditUnavailable(res);
    }
    res.status(201).json({ success: true, ...(await payload(o)) });
  })
);
router.delete(
  '/sessions/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const o = String(req.user?.organizationId),
      id = String(req.params.id);
    const found = await dbGet(
      `SELECT id FROM admin_sessions WHERE id=? AND organization_id=? AND session_type='break_glass'`,
      [id, o],
      { fallback: false }
    );
    if (!found) return res.status(404).json({ error: 'Not found' });
    const revoked = await adminSessionService.revokeSession(id);
    if (revoked === false) return res.status(409).json({ error: 'Session could not be revoked' });
    try {
      await req.emitAuditEvent?.({
        action: 'break_glass_session.revoked',
        resourceType: 'break_glass_session',
        resourceId: id,
        before: { active: true },
        after: { active: false },
      });
    } catch {
      return auditUnavailable(res);
    }
    res.json({ success: true, ...(await payload(o)) });
  })
);
export default router;
