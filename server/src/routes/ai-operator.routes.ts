import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import aiOperatorService from '../services/aiOperatorService.js';
import { getMeeting } from '../services/meetingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

function getAuth(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id || null;
  const role = req.userRole || req.user?.role || null;
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { organizationId, userId, role };
}

const MEETING_ADMIN_ROLES = new Set(['admin', 'owner', 'superadmin']);

function canReadMeetingBrief(req: AuthRequest, meeting: NonNullable<Awaited<ReturnType<typeof getMeeting>>>): boolean {
  const userId = String(req.user?.id || '').trim();
  const email = String(req.user?.email || '').trim().toLowerCase();
  const role = String(req.userRole || req.user?.role || '').trim().toLowerCase();
  if (MEETING_ADMIN_ROLES.has(role) || meeting.createdBy === userId) return true;
  const identities = new Set([userId.toLowerCase(), email].filter(Boolean));
  return meeting.attendees.some((attendee) => identities.has(String(attendee).trim().toLowerCase()));
}

router.get(
  '/overview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    const data = await aiOperatorService.getOverview(auth.organizationId, auth.userId);
    res.json(data);
  })
);

router.get(
  '/foundation',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getFoundationOverview(auth.organizationId, auth.userId));
  })
);

router.get(
  '/execution',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getExecutionOverview(auth.organizationId, auth.userId));
  })
);

router.get(
  '/communication',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getCommunicationOverview(auth.organizationId, auth.userId));
  })
);

router.get(
  '/value',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getValueOverview(auth.organizationId));
  })
);

router.get(
  '/ops',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getOpsOverview(auth.organizationId));
  })
);

router.get(
  '/meetings/:meetingId/brief',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    const meeting = await getMeeting({
      organizationId: auth.organizationId,
      meetingId: String(req.params.meetingId),
    });
    if (!meeting || !canReadMeetingBrief(req, meeting)) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    const brief = await aiOperatorService.getMeetingBrief(
      auth.organizationId,
      String(req.params.meetingId)
    );
    if (!brief) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    res.json(brief);
  })
);

router.put(
  '/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    const profile = await aiOperatorService.upsertProfile({
      organizationId: auth.organizationId,
      userId: auth.userId,
      currentStage: typeof req.body?.currentStage === 'string' ? req.body.currentStage : null,
      relationshipStatus:
        typeof req.body?.relationshipStatus === 'string' ? req.body.relationshipStatus : null,
      clientDna:
        req.body?.clientDna && typeof req.body.clientDna === 'object' ? req.body.clientDna : {},
      preferences:
        req.body?.preferences && typeof req.body.preferences === 'object'
          ? req.body.preferences
          : {},
      notes: typeof req.body?.notes === 'string' ? req.body.notes : null,
    });
    res.json({ profile });
  })
);

router.get(
  '/interventions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getInterventionsOverview(auth.organizationId));
  })
);

router.get(
  '/plans/current',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.getCurrentPlan(auth.organizationId, auth.userId));
  })
);

router.post(
  '/plans/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    res.json(await aiOperatorService.regeneratePlan(auth.organizationId, auth.userId));
  })
);

router.post(
  '/interventions/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth || !auth.userId) return;
    const templateKey =
      typeof req.body?.templateKey === 'string' ? req.body.templateKey.trim() : '';
    if (!templateKey) {
      res.status(400).json({ error: 'templateKey is required' });
      return;
    }
    const intervention = await aiOperatorService.proposeIntervention(
      auth.organizationId,
      auth.userId,
      {
        templateKey: templateKey as any,
      }
    );
    if (!intervention) {
      res.status(404).json({ error: 'Intervention template unavailable' });
      return;
    }
    res.status(201).json({ intervention });
  })
);

router.post(
  '/interventions/:actionId/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth || !auth.userId) return;
    const result = await aiOperatorService.acceptIntervention(
      auth.organizationId,
      String(req.params.actionId),
      auth.userId,
      auth.role || undefined
    );
    if (!result.ok && result.reason === 'not_found') {
      res.status(404).json({ error: 'Intervention not found' });
      return;
    }
    if (!result.ok && result.reason === 'insufficient_role') {
      res.status(403).json({ error: 'Insufficient role', requiredRole: result.requiredRole });
      return;
    }
    if (!result.ok) {
      res.status(409).json({ error: 'Intervention is no longer pending acceptance' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/interventions/:actionId/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth || !auth.userId) return;
    const result = await aiOperatorService.executeIntervention(
      auth.organizationId,
      String(req.params.actionId),
      auth.userId
    );
    if (!result.ok && result.reason === 'invalid_state') {
      res.status(409).json({ error: 'Intervention must be accepted before execution' });
      return;
    }
    if (!result.ok && result.reason === 'unsupported_action_type') {
      res.status(400).json({ error: 'Unsupported intervention type' });
      return;
    }
    if (!result.ok) {
      res.status(400).json({ error: 'Intervention payload is invalid' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/interventions/:actionId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = getAuth(req, res);
    if (!auth) return;
    const result = await aiOperatorService.rejectIntervention(
      auth.organizationId,
      String(req.params.actionId)
    );
    if (!result.ok) {
      res.status(404).json({ error: 'Intervention not found or not rejectable' });
      return;
    }
    res.json(result);
  })
);

export default router;
