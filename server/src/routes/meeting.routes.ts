import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  addMeetingDecision,
  addMeetingFollowUp,
  createMeeting,
  deleteMeeting,
  ensureMeetingTables,
  listMeetings,
  updateMeeting,
  updateMeetingFollowUpStatus,
  updateMeetingStatus,
} from '../services/meetingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.use(verifyToken);
router.use(isAuthenticated);
router.use(async (_req, _res, next) => {
  await ensureMeetingTables();
  next();
});

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId.trim()
        ? req.query.projectId.trim()
        : null;
    const meetings = await listMeetings({ organizationId: orgId, projectId });
    return res.json({ meetings });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const title = String(req.body?.title || '').trim();
    const startAt = String(req.body?.startAt || '').trim();
    const endAt = String(req.body?.endAt || startAt).trim();

    if (!title || !startAt) {
      return res.status(400).json({ error: 'title and startAt are required' });
    }

    const meeting = await createMeeting({
      organizationId: orgId,
      createdBy: userId,
      projectId:
        typeof req.body?.projectId === 'string' && req.body.projectId.trim()
          ? req.body.projectId.trim()
          : null,
      title,
      startAt,
      endAt,
      location: req.body?.location,
      attendees: Array.isArray(req.body?.attendees) ? req.body.attendees : [],
      preRead: Array.isArray(req.body?.preRead) ? req.body.preRead : [],
      agenda: Array.isArray(req.body?.agenda) ? req.body.agenda : [],
      decisions: Array.isArray(req.body?.decisions) ? req.body.decisions : [],
    });

    return res.status(201).json({ meeting });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    if (req.body?.title !== undefined && !String(req.body.title || '').trim()) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    if (req.body?.startAt !== undefined && !String(req.body.startAt || '').trim()) {
      return res.status(400).json({ error: 'startAt cannot be empty' });
    }

    const meeting = await updateMeeting({
      organizationId: orgId,
      meetingId: String(req.params.id),
      title: typeof req.body?.title === 'string' ? req.body.title : undefined,
      startAt: typeof req.body?.startAt === 'string' ? req.body.startAt : undefined,
      endAt: typeof req.body?.endAt === 'string' ? req.body.endAt : undefined,
      location: req.body?.location,
      attendees: Array.isArray(req.body?.attendees) ? req.body.attendees : undefined,
      preRead: Array.isArray(req.body?.preRead) ? req.body.preRead : undefined,
      agenda: Array.isArray(req.body?.agenda) ? req.body.agenda : undefined,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.json({ meeting });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const deleted = await deleteMeeting({
      organizationId: orgId,
      meetingId: String(req.params.id),
    });
    if (!deleted) return res.status(404).json({ error: 'Meeting not found' });
    return res.json({ success: true });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const status = String(req.body?.status || '')
      .trim()
      .toLowerCase();
    if (!['scheduled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'status must be scheduled or completed' });
    }
    const meeting = await updateMeetingStatus({
      organizationId: orgId,
      meetingId: String(req.params.id),
      status: status as 'scheduled' | 'completed',
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.json({ meeting });
  })
);

router.post(
  '/:id/decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const decision = String(req.body?.decision || '').trim();
    if (!decision) return res.status(400).json({ error: 'decision is required' });
    const meeting = await addMeetingDecision({
      organizationId: orgId,
      meetingId: String(req.params.id),
      decision,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.status(201).json({ meeting });
  })
);

router.post(
  '/:id/follow-ups',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });
    const meeting = await addMeetingFollowUp({
      organizationId: orgId,
      meetingId: String(req.params.id),
      title,
      owner: req.body?.owner,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.status(201).json({ meeting });
  })
);

router.patch(
  '/:meetingId/follow-ups/:followUpId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const status = String(req.body?.status || '')
      .trim()
      .toLowerCase();
    if (!['open', 'done'].includes(status)) {
      return res.status(400).json({ error: 'status must be open or done' });
    }
    const meeting = await updateMeetingFollowUpStatus({
      organizationId: orgId,
      meetingId: String(req.params.meetingId),
      followUpId: String(req.params.followUpId),
      status: status as 'open' | 'done',
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.json({ meeting });
  })
);

export default router;
