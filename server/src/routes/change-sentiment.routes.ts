import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import * as sentimentSvc from '../services/changeSentimentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken as any);

/* ------------------------------------------------------------------ */
/*  Pulse Check-ins                                                    */
/* ------------------------------------------------------------------ */

router.post(
  '/pulse',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const pulse = await sentimentSvc.submitPulse(orgId, {
      ...req.body,
      userId: req.user?.id,
    });
    res.status(201).json({ data: pulse });
  })
);

router.get(
  '/pulse/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const summary = await sentimentSvc.getPulseSummary(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      projectId: req.query.projectId as string | undefined,
      days: req.query.days ? Number(req.query.days) : undefined,
    });
    res.json({ data: summary });
  })
);

/* ------------------------------------------------------------------ */
/*  Feedback                                                           */
/* ------------------------------------------------------------------ */

router.post(
  '/feedback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const fb = await sentimentSvc.submitFeedback(orgId, {
      ...req.body,
      userId: req.user?.id,
    });
    res.status(201).json({ data: fb });
  })
);

router.get(
  '/feedback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const list = await sentimentSvc.getFeedbackList(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      projectId: req.query.projectId as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ data: list });
  })
);

/* ------------------------------------------------------------------ */
/*  Resistance Alerts                                                  */
/* ------------------------------------------------------------------ */

router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const alerts = await sentimentSvc.getAlerts(orgId, {
      initiativeId: req.query.initiativeId as string | undefined,
      acknowledged:
        req.query.acknowledged !== undefined ? req.query.acknowledged === 'true' : undefined,
    });
    res.json({ data: alerts });
  })
);

router.post(
  '/alerts/check',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const alerts = await sentimentSvc.checkAndCreateAlerts(orgId, {
      initiativeId: req.body.initiativeId,
      projectId: req.body.projectId,
    });
    res.json({ data: alerts });
  })
);

router.post(
  '/alerts/:id/acknowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const alert = await sentimentSvc.acknowledgeAlert(orgId, req.params.id, req.user?.id ?? '');
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ data: alert });
  })
);

/* ------------------------------------------------------------------ */
/*  Coaching Actions                                                   */
/* ------------------------------------------------------------------ */

router.get(
  '/coaching-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? '';
    const actions = await sentimentSvc.getCoachingActions(orgId);
    res.json({ data: actions });
  })
);

export default router;
