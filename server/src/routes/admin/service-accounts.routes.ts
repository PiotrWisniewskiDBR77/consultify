import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { serviceAccountService } from '../../services/tablePlatform/ServiceAccountService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';

const router = Router();
router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId)
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const membership = await dbGet<{ role?: string; status?: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
      [organizationId, userId],
      { fallback: false }
    );
    if (!membership || String(membership.status).toUpperCase() !== 'ACTIVE')
      return res.status(403).json({ success: false, code: 'ADMIN_MEMBERSHIP_REQUIRED' });
    if (!['OWNER', 'ADMIN'].includes(String(membership.role).toUpperCase()))
      return res.status(403).json({ success: false, code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    return res.json({
      success: true,
      data: await serviceAccountService.listServiceAccounts(organizationId),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    const name = String(req.body?.name || '').trim();
    const scopes = Array.isArray(req.body?.scopes)
      ? req.body.scopes.map(String).filter(Boolean)
      : [];
    if (!name || scopes.length === 0)
      return res.status(400).json({ success: false, error: 'name and scopes are required' });
    const result = await serviceAccountService.createServiceAccount(organizationId, {
      name,
      description: String(req.body?.description || '').trim() || undefined,
      scopes,
      expiresInDays: Number(req.body?.expiresInDays) || undefined,
      createdBy: req.user?.id,
    });
    return res.status(201).json({ success: true, data: result });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    const found = await dbGet<{ id: string }>(
      'SELECT id FROM tp_service_accounts WHERE id = ? AND organization_id = ?',
      [req.params.id, organizationId],
      { fallback: false }
    );
    if (!found) return res.status(404).json({ success: false, error: 'Service account not found' });
    await serviceAccountService.revokeServiceAccount(req.params.id);
    return res.status(204).send();
  })
);

export default router;
