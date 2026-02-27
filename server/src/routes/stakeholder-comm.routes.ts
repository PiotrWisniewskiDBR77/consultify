import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import * as commSvc from '../services/stakeholderCommService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken as any);

/* ------------------------------------------------------------------ */
/*  Segments                                                           */
/* ------------------------------------------------------------------ */

router.get(
  '/segments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const segments = await commSvc.getSegments(orgId, req.query.initiativeId as string | undefined);
    res.json({ data: segments });
  })
);

router.post(
  '/segments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const seg = await commSvc.createSegment(orgId, { ...req.body, createdBy: req.user?.id });
    res.status(201).json({ data: seg });
  })
);

router.put(
  '/segments/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const seg = await commSvc.updateSegment(orgId, req.params.id, req.body);
    if (!seg) return res.status(404).json({ error: 'Segment not found' });
    res.json({ data: seg });
  })
);

router.delete(
  '/segments/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    await commSvc.deleteSegment(orgId, req.params.id);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  Communication Plans                                                */
/* ------------------------------------------------------------------ */

router.get(
  '/plans',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const plans = await commSvc.getPlans(orgId, req.query.initiativeId as string | undefined);
    res.json({ data: plans });
  })
);

router.post(
  '/plans',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const plan = await commSvc.createPlan(orgId, { ...req.body, createdBy: req.user?.id });
    res.status(201).json({ data: plan });
  })
);

router.put(
  '/plans/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const plan = await commSvc.updatePlan(orgId, req.params.id, req.body);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ data: plan });
  })
);

/* ------------------------------------------------------------------ */
/*  Plan Items                                                         */
/* ------------------------------------------------------------------ */

router.get(
  '/plans/:planId/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const items = await commSvc.getPlanItems(req.params.planId);
    res.json({ data: items });
  })
);

router.post(
  '/plans/:planId/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const item = await commSvc.createPlanItem(orgId, req.params.planId, req.body);
    res.status(201).json({ data: item });
  })
);

router.post(
  '/plans/:planId/items/:itemId/send',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const userId = req.user?.id ?? '';
    const item = await commSvc.markItemSent(
      String(req.params.planId),
      String(req.params.itemId),
      userId
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await commSvc.logSend(orgId, {
      planItemId: item.id,
      initiativeId: req.body.initiativeId,
      segmentId: req.body.segmentId,
      channel: item.channel,
      recipientCount: req.body.recipientCount ?? 0,
      sentBy: userId,
      followUpTask: req.body.followUpTask,
    });
    await commSvc.advancePlanDue(orgId, String(req.params.planId));
    res.json({ data: item });
  })
);

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

router.get(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const templates = await commSvc.getTemplates(orgId);
    res.json({ data: templates });
  })
);

router.post(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const tpl = await commSvc.createTemplate(orgId, { ...req.body, createdBy: req.user?.id });
    res.status(201).json({ data: tpl });
  })
);

/* ------------------------------------------------------------------ */
/*  Send Log & Overdue                                                 */
/* ------------------------------------------------------------------ */

router.get(
  '/log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const log = await commSvc.getSendLog(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: log });
  })
);

router.get(
  '/overdue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const plans = await commSvc.getOverduePlans(orgId);
    res.json({ data: plans });
  })
);

export default router;
