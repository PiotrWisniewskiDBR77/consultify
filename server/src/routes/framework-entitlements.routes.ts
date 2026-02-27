/**
 * Framework Entitlements Routes
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import FrameworkEntitlementService from '../services/frameworkEntitlementService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role?: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Organization context required' });
    res.json({ entitlements: await FrameworkEntitlementService.getOrgEntitlements(orgId) });
  })
);

router.get(
  '/:frameworkId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Organization context required' });
    const fwId = String(req.params.frameworkId).toUpperCase();
    res.json({
      frameworkId: fwId,
      ...(await FrameworkEntitlementService.checkAccess(orgId, fwId)),
    });
  })
);

router.post(
  '/:frameworkId/grant',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: userId, organizationId: orgId, role } = req.user || {};
    if (!orgId || !userId) return res.status(401).json({ error: 'Auth required' });
    if (role !== 'ADMIN' && role !== 'OWNER')
      return res.status(403).json({ error: 'Only admins can grant access' });
    const fwId = String(req.params.frameworkId).toUpperCase();
    const { accessLevel, expiresAt, notes, targetOrgId } = req.body;
    if (!['locked', 'trial', 'full', 'educational'].includes(accessLevel))
      return res.status(400).json({ error: 'Invalid access level' });
    await FrameworkEntitlementService.grantAccess(
      targetOrgId || orgId,
      fwId,
      accessLevel,
      userId,
      expiresAt,
      notes
    );
    logger.info(`[Entitlements] ${userId} granted ${accessLevel} for ${fwId}`);
    res.json({ success: true, frameworkId: fwId, accessLevel });
  })
);

router.post(
  '/:frameworkId/revoke',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: userId, organizationId: orgId, role } = req.user || {};
    if (!orgId || !userId) return res.status(401).json({ error: 'Auth required' });
    if (role !== 'ADMIN' && role !== 'OWNER')
      return res.status(403).json({ error: 'Only admins can revoke access' });
    const fwId = String(req.params.frameworkId).toUpperCase();
    await FrameworkEntitlementService.revokeAccess(req.body.targetOrgId || orgId, fwId);
    res.json({ success: true, frameworkId: fwId, accessLevel: 'locked' });
  })
);

export default router;
