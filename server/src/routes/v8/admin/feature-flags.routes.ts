import type { Response } from 'express';
import { Router } from 'express';

import { type AuthRequest, requireSuperAdmin } from '../../../middleware/auth.middleware.js';
import {
  getAllOrgFlags,
  getV8Flags,
  setV8OrgFlag,
} from '../../../services/v8/featureFlagService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const flags = await getV8Flags(orgId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: flags, meta: { version: 'v8' } });
  })
);

router.get(
  '/all',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const allFlags = await getAllOrgFlags();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: allFlags, meta: { version: 'v8' } });
  })
);

router.put(
  '/:module',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const { module } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.setHeader('Cache-Control', 'no-store');
      res.status(400).json({ error: 'enabled must be a boolean', code: 'INVALID_INPUT' });
      return;
    }

    await setV8OrgFlag(orgId, module, enabled, req.userId);
    const flags = await getV8Flags(orgId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: flags, meta: { version: 'v8', updated: module } });
  })
);

export default router;
