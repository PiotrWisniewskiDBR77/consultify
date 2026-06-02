import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { emitOrgContextRebuilt } from '../realtime/orgContextRealtime.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
}

function isAdminLike(req: AuthRequest): boolean {
  const normalizedRole = String(req.user?.role || '')
    .trim()
    .toLowerCase();
  return ['admin', 'administrator', 'owner', 'superadmin', 'super_admin'].includes(normalizedRole);
}

router.use(verifyToken);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const context = await organizationContextService.buildResolvedContext(orgId);
    res.json(context);
  })
);

router.get(
  '/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 25), 100));
    const timeline = await organizationContextService.listTimeline(orgId, limit);
    res.json({ timeline });
  })
);

router.get(
  '/claims',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 200));
    const claims = await organizationContextService.listClaims(orgId, limit);
    res.json({ claims });
  })
);

router.post(
  '/rebuild',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    await organizationContextService.rebuildSnapshot(orgId);
    const context = await organizationContextService.buildResolvedContext(orgId);
    // M16 P1-3: notify other open clients for this org so their context banner refreshes live.
    emitOrgContextRebuilt({
      organizationId: orgId,
      rebuiltAt: context.snapshotUpdatedAt,
      counts: context.counts,
    });
    res.json({ ok: true, rebuiltAt: context.snapshotUpdatedAt, counts: context.counts });
  })
);

export default router;
