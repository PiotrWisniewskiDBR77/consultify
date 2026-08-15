import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { betaGate } from '../middleware/betaGate.middleware.js';
import { meetingIntelligenceService } from '../services/ai/meetingIntelligenceService.js';
import {
  addNoteEntry,
  addParticipant,
  adoptLegacyMeetingCore,
  approveOutput,
  archiveNoteEntry,
  closeMeeting,
  ConflictError,
  createMeetingCore,
  createProductionMaterializer,
  ForbiddenError,
  getMeetingAggregate,
  IllegalTransitionError,
  listNoteEntries,
  listParticipants,
  materializeOutput,
  MEETING_TRANSITION_NAMES,
  MeetingNotFoundError,
  type MeetingRole,
  type MeetingTransitionName,
  type NoteEntryType,
  type OutputKind,
  proposeOutput,
  reconcileMaterializingOutput,
  rejectOutput,
  removeParticipant,
  transitionMeeting,
  updateMeetingPrep,
  ValidationError,
} from '../services/meetingCore/index.js';
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
    // L-04 asymmetry fix: PUT (full update — title/time/attendees/agenda) was
    // the only mutating route on this resource with NO role gate, while
    // DELETE and PATCH /:id/status both required admin/owner/superadmin.
    // Mirror the same gate here — updating a meeting's core details is at
    // least as sensitive as changing its status.
    if (!requireMeetingAdmin(req, res)) return;

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

    // AI extraction is preview-only. Decisions and tasks must pass through the
    // Meeting Core proposal -> human approval -> materialization flow below;
    // this legacy endpoint must never silently create downstream records.

    const refreshed = await getMeeting({ organizationId: orgId, meetingId });
    return res.status(201).json({ note, meeting: refreshed || meeting });
  })
);

// ==========================================================================
// Meeting Core (Wave 2) — /api/meeting/core/*
//
// First real, non-realtime Meeting domain: lifecycle transitions,
// meeting-scoped roles, structured notes, and the output-approval saga
// (server/src/services/meetingCore/). Deliberately namespaced under /core so
// it cannot collide with the legacy single-segment `/:id` routes above
// (which stay untouched except for the PUT gate fix). organizationId is
// ALWAYS req.user.organizationId (JWT-derived) and actorUserId is ALWAYS
// req.user.id — neither is ever read from the request body or headers, so a
// caller can never act as another org or another user.
// ==========================================================================

const coreRouter = Router();

function requireAuthContext(
  req: AuthRequest,
  res: Response
): { organizationId: string; userId: string } | null {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { organizationId, userId };
}

function requireIdempotencyKey(req: AuthRequest, res: Response): string | null {
  const key = String(req.get('Idempotency-Key') || '').trim();
  if (key.length < 8 || key.length > 200) {
    res.status(400).json({
      error: 'A valid Idempotency-Key header (8-200 characters) is required.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
    return null;
  }
  return key;
}

/** Maps meetingCore's typed errors to HTTP responses. Returns true if handled. */
function handleMeetingCoreError(err: unknown, res: Response): boolean {
  if (err instanceof MeetingNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code });
    return true;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, code: err.code });
    return true;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message, code: err.code });
    return true;
  }
  if (err instanceof IllegalTransitionError) {
    res.status(409).json({ error: err.message, code: err.code });
    return true;
  }
  // Optimistic-concurrency loser. Without this branch a lost race fell through
  // to `throw err` and surfaced as a 500 — i.e. a normal, expected conflict was
  // reported to the caller as a server fault. That is exactly the kind of
  // dishonest signalling this module is supposed to eliminate: the client
  // cannot distinguish "someone else closed it first, re-read and retry" from
  // "the server is broken". 409 is the honest answer for both concurrent
  // lifecycle transitions and concurrent output materialization/reconciliation.
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}

const VALID_MEETING_ROLES: readonly MeetingRole[] = [
  'owner',
  'facilitator',
  'participant',
  'observer',
];
const VALID_NOTE_ENTRY_TYPES: readonly NoteEntryType[] = [
  'discussion',
  'insight',
  'question',
  'risk',
  'proposed_decision',
  'proposed_task',
  'parking_lot',
];
const VALID_OUTPUT_KINDS: readonly OutputKind[] = ['task', 'decision'];

coreRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const meeting = await createMeetingCore({
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        projectId:
          typeof req.body?.projectId === 'string' ? req.body.projectId.trim() || null : null,
        title: String(req.body?.title || ''),
        startAt: String(req.body?.startAt || ''),
        endAt: typeof req.body?.endAt === 'string' ? req.body.endAt : undefined,
        location: typeof req.body?.location === 'string' ? req.body.location : undefined,
        purpose: typeof req.body?.purpose === 'string' ? req.body.purpose : undefined,
        expectedOutcomes:
          typeof req.body?.expectedOutcomes === 'string' ? req.body.expectedOutcomes : undefined,
        preparationNotes:
          typeof req.body?.preparationNotes === 'string' ? req.body.preparationNotes : undefined,
      });
      return res.status(201).json({ meeting });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const aggregate = await getMeetingAggregate({
      organizationId: ctx.organizationId,
      meetingId: String(req.params.id),
    });
    if (!aggregate) return res.status(404).json({ error: 'Meeting not found' });
    return res.json(aggregate);
  })
);

coreRouter.post(
  '/:id/notes/:noteId/archive',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const note = await archiveNoteEntry({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        noteId: String(req.params.noteId),
        actorUserId: ctx.userId,
      });
      return res.json({ note });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/adopt',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const meeting = await adoptLegacyMeetingCore({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
      });
      return res.json({ meeting });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.patch(
  '/:id/prep',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const meeting = await updateMeetingPrep({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        startAt: typeof req.body?.startAt === 'string' ? req.body.startAt : undefined,
        endAt: typeof req.body?.endAt === 'string' ? req.body.endAt : undefined,
        location: typeof req.body?.location === 'string' ? req.body.location : undefined,
        purpose: typeof req.body?.purpose === 'string' ? req.body.purpose : undefined,
        expectedOutcomes:
          typeof req.body?.expectedOutcomes === 'string' ? req.body.expectedOutcomes : undefined,
        preparationNotes:
          typeof req.body?.preparationNotes === 'string' ? req.body.preparationNotes : undefined,
      });
      return res.json({ meeting });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/participants',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const role = String(req.body?.role || '').trim() as MeetingRole;
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!VALID_MEETING_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `role must be one of ${VALID_MEETING_ROLES.join(', ')}` });
    }
    try {
      const participant = await addParticipant({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        userId,
        role,
      });
      return res.status(201).json({ participant });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.get(
  '/:id/participants',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const participants = await listParticipants({
      organizationId: ctx.organizationId,
      meetingId: String(req.params.id),
    });
    return res.json({ participants });
  })
);

coreRouter.delete(
  '/:id/participants/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      await removeParticipant({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        targetUserId: String(req.params.userId),
      });
      return res.json({ success: true });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/transitions/:transition',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const transition = String(req.params.transition || '').toUpperCase() as MeetingTransitionName;
    if (!MEETING_TRANSITION_NAMES.includes(transition)) {
      return res
        .status(400)
        .json({ error: `transition must be one of ${MEETING_TRANSITION_NAMES.join(', ')}` });
    }
    try {
      const meeting = await transitionMeeting({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        transition,
      });
      return res.json({ meeting });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/close',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const result = await closeMeeting({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
      });
      return res.json(result);
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/notes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const entryType = String(req.body?.entryType || '').trim() as NoteEntryType;
    const content = String(req.body?.content || '');
    if (!VALID_NOTE_ENTRY_TYPES.includes(entryType)) {
      return res
        .status(400)
        .json({ error: `entryType must be one of ${VALID_NOTE_ENTRY_TYPES.join(', ')}` });
    }
    try {
      const note = await addNoteEntry({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        actorKind: 'human',
        entryType,
        content,
      });
      return res.status(201).json({ note });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.get(
  '/:id/notes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const notes = await listNoteEntries({
      organizationId: ctx.organizationId,
      meetingId: String(req.params.id),
    });
    return res.json({ notes });
  })
);

coreRouter.post(
  '/:id/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const requestIdempotencyKey = requireIdempotencyKey(req, res);
    if (!requestIdempotencyKey) return;
    const outputKind = String(req.body?.outputKind || '').trim() as OutputKind;
    if (!VALID_OUTPUT_KINDS.includes(outputKind)) {
      return res
        .status(400)
        .json({ error: `outputKind must be one of ${VALID_OUTPUT_KINDS.join(', ')}` });
    }
    const payload =
      req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    try {
      const output = await proposeOutput({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        actorUserId: ctx.userId,
        actorKind: 'human',
        outputKind,
        payload,
        sourceNoteEntryId:
          typeof req.body?.sourceNoteEntryId === 'string' ? req.body.sourceNoteEntryId : null,
        requestIdempotencyKey,
      });
      return res.status(201).json({ output });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/outputs/:outputId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const output = await approveOutput({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        outputId: String(req.params.outputId),
        actorUserId: ctx.userId,
      });
      return res.json({ output });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/outputs/:outputId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const output = await rejectOutput({
        organizationId: ctx.organizationId,
        meetingId: String(req.params.id),
        outputId: String(req.params.outputId),
        actorUserId: ctx.userId,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
      });
      return res.json({ output });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

coreRouter.post(
  '/:id/outputs/:outputId/materialize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    const requestIdempotencyKey = requireIdempotencyKey(req, res);
    if (!requestIdempotencyKey) return;
    try {
      const output = await materializeOutput(
        {
          organizationId: ctx.organizationId,
          meetingId: String(req.params.id),
          outputId: String(req.params.outputId),
          actorUserId: ctx.userId,
          requestIdempotencyKey,
        },
        createProductionMaterializer(ctx.userId)
      );
      return res.json({ output });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

/**
 * POST /:id/outputs/:outputId/reconcile — DEFEKT 2 fix. The only way to
 * unwedge an output stuck in MATERIALIZING (a prior /materialize call
 * claimed it but the process died before confirming MATERIALIZED or
 * MATERIALIZATION_FAILED — see reconcileMaterializingOutput in outputs.ts).
 * Gated to the same roles as approve/reject (never Teresa) — this is a human
 * judgment call about a stuck saga, not a routine step.
 */
coreRouter.post(
  '/:id/outputs/:outputId/reconcile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = requireAuthContext(req, res);
    if (!ctx) return;
    try {
      const output = await reconcileMaterializingOutput(
        {
          organizationId: ctx.organizationId,
          meetingId: String(req.params.id),
          outputId: String(req.params.outputId),
          actorUserId: ctx.userId,
        },
        createProductionMaterializer(ctx.userId)
      );
      return res.json({ output });
    } catch (err) {
      if (handleMeetingCoreError(err, res)) return;
      throw err;
    }
  })
);

router.use('/core', coreRouter);

export default router;
