import { Router } from 'express';
import type { Response } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getV8Flags, setV8OrgFlag, getAllOrgFlags } from '../../../services/v8/featureFlagService.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const flags = await getV8Flags(orgId);
    res.json({ data: flags, meta: { version: 'v8', organizationId: orgId } });
  }),
);

router.get(
  '/all',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const allFlags = await getAllOrgFlags();
    res.json({ data: allFlags, meta: { version: 'v8' } });
  }),
);

router.put(
  '/:module',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const { module } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean', code: 'INVALID_INPUT' });
      return;
    }

    await setV8OrgFlag(orgId, module, enabled, req.userId);
    const flags = await getV8Flags(orgId);
    res.json({ data: flags, meta: { version: 'v8', updated: module } });
  }),
);

export default router;
