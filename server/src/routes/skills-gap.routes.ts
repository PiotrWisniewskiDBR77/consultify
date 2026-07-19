import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import * as gapService from '../services/skillsGapService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// AUTH-SWEEP (E-AUTH-A): every route below reads org-scoped data via
// req.organizationId / req.user (skills-gap by initiative & competency, plus a
// snapshot write). Without auth these were reachable unauthenticated with an
// empty orgId — the same class of gap as the transactionReadiness finding.
// Blanket verifyToken: none of these endpoints are public by design.
router.use(verifyToken);

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
