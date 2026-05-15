import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
  seedFactoryRoleTemplates,
} from '../services/effectiveAccessService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

router.get(
  '/effective',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = String(req.user?.id || req.userId || '').trim();
    const organizationId = String(req.organizationId || req.user?.organizationId || '').trim();
    const projectId = String(req.query.projectId || '').trim() || null;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await seedFactoryRoleTemplates(organizationId);
    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole: req.userRole || req.user?.role,
      projectId,
      isImpersonating: Boolean(req.user?.impersonatorId),
    });

    const requestedCapability = String(req.query.capability || '').trim();
    return res.json({
      effectiveAccess: access,
      decision: requestedCapability
        ? {
            capability: requestedCapability,
            allowed: hasEffectiveCapability(access, requestedCapability),
          }
        : undefined,
    });
  })
);

export default router;
