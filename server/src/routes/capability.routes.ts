import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import * as capSvc from '../services/capabilityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken as any);

/* ------------------------------------------------------------------ */
/*  Capability Catalog                                                 */
/* ------------------------------------------------------------------ */

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const domain = req.query.domain as string | undefined;
    const caps = await capSvc.getCapabilities(orgId, domain);
    res.json({ data: caps });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const cap = await capSvc.createCapability(orgId, { ...req.body, createdBy: req.user?.id });
    res.status(201).json({ data: cap });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const cap = await capSvc.updateCapability(orgId, req.params.id, req.body);
    if (!cap) return res.status(404).json({ error: 'Capability not found' });
    res.json({ data: cap });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    await capSvc.deleteCapability(orgId, req.params.id);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  User Capability Profile                                            */
/* ------------------------------------------------------------------ */

router.get(
  '/users/:userId/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const caps = await capSvc.getUserCapabilities(orgId, req.params.userId);
    res.json({ data: caps });
  })
);

router.post(
  '/users/:userId/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const { capabilityId, level, ...extra } = req.body;
    const uc = await capSvc.setUserCapability(orgId, req.params.userId, capabilityId, level, extra);
    res.status(201).json({ data: uc });
  })
);

router.delete(
  '/users/:userId/profile/:capabilityId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    await capSvc.removeUserCapability(orgId, req.params.userId, req.params.capabilityId);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  Requirements                                                       */
/* ------------------------------------------------------------------ */

router.get(
  '/requirements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const reqs = await capSvc.getRequirements(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      taskId: req.query.taskId as string | undefined,
    });
    res.json({ data: reqs });
  })
);

router.post(
  '/requirements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const r = await capSvc.setRequirement(orgId, { ...req.body, createdBy: req.user?.id });
    res.status(201).json({ data: r });
  })
);

router.delete(
  '/requirements/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    await capSvc.deleteRequirement(orgId, req.params.id);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  Matching & Assignments                                             */
/* ------------------------------------------------------------------ */

router.get(
  '/match',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const candidates = await capSvc.matchCandidates(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      taskId: req.query.taskId as string | undefined,
    });
    res.json({ data: candidates });
  })
);

router.post(
  '/assignments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const a = await capSvc.recordAssignment(orgId, { ...req.body, decidedBy: req.user?.id });
    res.status(201).json({ data: a });
  })
);

export default router;
