import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { betaGate } from '../middleware/betaGate.middleware.js';
import { meetingIntelligenceService } from '../services/ai/meetingIntelligenceService.js';
import {
  addMeetingDecision,
  addMeetingFollowUp,
  createMeeting,
  deleteMeeting,
  ensureMeetingTables,
  getMeeting,
  listMeetings,
  updateMeeting,
  updateMeetingFollowUpStatus,
  updateMeetingStatus,
} from '../services/meetingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role?: string };
  userRole?: string;
}

// L-04: role gate on destructive/administrative operations. Org-scope (404)
// already isolates data cross-org, but every org member had full CRUD. Mirror
// the established pattern from document-studio.routes.ts:623 — read/create stay
// open to all members; DELETE + status change require admin/owner/superadmin.
const PRIVILEGED_MEETING_ROLES = ['admin', 'owner', 'superadmin'];

function getMeetingUserRole(req: AuthRequest): string {
  return String(req.userRole || req.user?.role || '');
}

function requireMeetingAdmin(req: AuthRequest, res: Response): boolean {
  const role = getMeetingUserRole(req).toLowerCase();
  if (!PRIVILEGED_MEETING_ROLES.includes(role)) {
    res.status(403).json({ error: 'Admin or owner role required' });
    return false;
  }
  return true;
}

router.use(verifyToken);
router.use(isAuthenticated);
// L-03: server-side beta gate on /api/meeting (was FE-only). betaGate is the
// SSOT-mirror middleware — currently pass-through ('open'); flips to 403
// BETA_LOCKED when MODULE_MEETING is set 'closed' in betaAccess.ts.
router.use(betaGate);
// Fail-soft lazy DDL: if ensureMeetingTables() throws (e.g. transient DB/DDL
// failure), return a structured 500 instead of leaking a bare/unhandled error.
// Mirrors the "Settings 500 = lazy DDL" remediation: a GET with ensure*Table
// and no try/catch produces an opaque 500 when the DDL path fails.
router.use(async (_req, res, next) => {
  try {
    await ensureMeetingTables();
    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Meeting] ensureMeetingTables failed: ${msg}`);
    res
      .status(500)
      .json({ error: 'Meeting storage is unavailable', code: 'MEETING_TABLES_UNAVAILABLE' });
  }
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
    if (!requireMeetingAdmin(req, res)) return;
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
    if (!requireMeetingAdmin(req, res)) return;
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

/**
 * POST /:id/generate-notes — Module 13 activation.
 * Turns a meeting transcript into structured AI notes (summary, key points,
 * decisions, action items) via meetingIntelligenceService, then persists the
 * extracted decisions + action items as meeting decisions/follow-ups so they
 * flow into the rest of the system. Falls back to the heuristic path when no
 * LLM is configured (service handles that internally).
 */
router.post(
  '/:id/generate-notes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const meetingId = String(req.params.id);
    const transcript = String(req.body?.transcript || '').trim();
    if (!transcript) {
      return res.status(400).json({ error: 'transcript is required' });
    }

    const meeting = await getMeeting({ organizationId: orgId, meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const language =
      typeof req.body?.language === 'string' && req.body.language.trim()
        ? req.body.language.trim()
        : 'en';

    const note = await meetingIntelligenceService.generateMeetingNotes({
      transcript,
      language,
      context: {
        calendarEventId: meeting.id,
        title: meeting.title,
        scheduledTime: meeting.startAt,
        participants: Array.isArray(meeting.attendees)
          ? meeting.attendees
              .map((a: any) => (typeof a === 'string' ? a : a?.name || ''))
              .filter(Boolean)
          : [],
        agenda: Array.isArray(meeting.agenda) ? meeting.agenda.join('\n') : undefined,
        organizationId: orgId,
        userId,
      },
    });

    // Persist extracted decisions + action items back into the meeting so they
    // become first-class records (not trapped inside the AI response).
    const persistOutcomes = req.body?.persist !== false;
    if (persistOutcomes) {
      try {
        for (const d of note.decisions || []) {
          if (d?.decision) {
            await addMeetingDecision({ organizationId: orgId, meetingId, decision: d.decision });
          }
        }
        for (const a of note.actionItems || []) {
          if (a?.task) {
            await addMeetingFollowUp({
              organizationId: orgId,
              meetingId,
              title: a.task,
              owner: a.owner || null,
            });
          }
        }
      } catch (persistErr: unknown) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
        logger.warn(`[Meeting] generate-notes persist failed (notes still returned): ${msg}`);
      }
    }

    const refreshed = await getMeeting({ organizationId: orgId, meetingId });
    return res.status(201).json({ note, meeting: refreshed || meeting });
  })
);

export default router;
