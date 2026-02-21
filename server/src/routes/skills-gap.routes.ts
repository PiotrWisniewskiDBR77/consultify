import { type Response, Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import * as gapService from '../services/skillsGapService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/initiatives/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const gap = await gapService.computeInitiativeGap(orgId, req.params.initiativeId);
    res.json({ gap });
  })
);

router.get(
  '/by-competency',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const competencies = await gapService.computeGapByCompetency(orgId);
    res.json({ competencies });
  })
);

router.post(
  '/initiatives/:initiativeId/snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const gap = await gapService.computeInitiativeGap(orgId, req.params.initiativeId);
    const snapshot = await gapService.saveSnapshot(orgId, gap, req.userId || req.user?.id);
    res.status(201).json({ snapshot });
  })
);

router.get(
  '/initiatives/:initiativeId/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const snapshots = await gapService.getSnapshots(orgId, req.params.initiativeId);
    res.json({ snapshots });
  })
);

export default router;
