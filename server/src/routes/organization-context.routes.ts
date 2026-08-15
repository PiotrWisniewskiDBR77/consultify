import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { emitOrgContextRebuilt } from '../realtime/orgContextRealtime.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { OrganizationContextPublicationError } from '../services/organizationContext/OrganizationContextService.js';
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

function publicationErrorStatus(error: unknown): number {
  if (!(error instanceof OrganizationContextPublicationError)) return 500;
  if (error.code === 'CLAIM_NOT_FOUND') return 404;
  if (error.code === 'CONFIDENTIAL_SOURCE') return 403;
  return 409;
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
  '/claims/:claimId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    try {
      const result = await organizationContextService.approveClaim({
        organizationId: orgId,
        claimId: String(req.params.claimId),
        reviewerId: String(req.user?.id || ''),
        expectedReviewStatus:
          typeof req.body?.expectedReviewStatus === 'string'
            ? req.body.expectedReviewStatus
            : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(publicationErrorStatus(error)).json({
        error: error instanceof Error ? error.message : 'Claim approval failed',
        code: error instanceof OrganizationContextPublicationError ? error.code : 'INTERNAL_ERROR',
      });
    }
  })
);

router.post(
  '/publish',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    try {
      const snapshot = await organizationContextService.publishSnapshot({
        organizationId: orgId,
        createdBy: String(req.user?.id || ''),
      });
      res.status(201).json({ snapshot });
    } catch (error) {
      res.status(publicationErrorStatus(error)).json({
        error: error instanceof Error ? error.message : 'Context publication failed',
        code: error instanceof OrganizationContextPublicationError ? error.code : 'INTERNAL_ERROR',
      });
    }
  })
);

router.get(
  '/snapshots/latest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const snapshot = await organizationContextService.getPublishedSnapshot(orgId);
    if (!snapshot) {
      res.status(404).json({ error: 'Published organization context not found' });
      return;
    }
    res.json({ snapshot });
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
