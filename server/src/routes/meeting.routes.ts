import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { closedBetaModuleGate } from '../middleware/betaGate.middleware.js';
import { meetingIntelligenceService } from '../services/ai/meetingIntelligenceService.js';
import { HandoffSpineError } from '../services/artifactHandoff/handoffSpineService.js';
import {
  decideMeetingNote,
  findMeetingNoteReplay,
  listMeetingNotesForMeeting,
  MeetingBoundaryError,
  proposeMeetingNote,
} from '../services/meetingBoundary/meetingBoundaryService.js';
import {
  createMeeting,
  deleteMeeting,
  ensureMeetingTables,
  getMeeting,
  listMeetings,
  updateMeeting,
  updateMeetingStatus,
} from '../services/meetingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const MEETING_CAPTURE_POLICY = Object.freeze({
  recordingEnabled: false,
  automaticTranscriptionEnabled: false,
  acceptsManualSourceText: true,
} as const);

const MANUAL_NOTE_FIELDS = new Set(['transcript', 'language', 'idempotencyKey']);
const CAPTURE_FIELD = /(record|transcrib|audio|media|blob|provider|upload|file|url)/i;

export function validateManualMeetingNotePayload(body: unknown):
  | { ok: true }
  | {
      ok: false;
      code: 'MEETING_CAPTURE_DISABLED' | 'UNSUPPORTED_MEETING_NOTE_FIELD';
      fields: string[];
    } {
  const value =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const unsupported = Object.keys(value).filter((key) => !MANUAL_NOTE_FIELDS.has(key));
  if (unsupported.length === 0) return { ok: true };
  return {
    ok: false,
    code: unsupported.some((key) => CAPTURE_FIELD.test(key))
      ? 'MEETING_CAPTURE_DISABLED'
      : 'UNSUPPORTED_MEETING_NOTE_FIELD',
    fields: unsupported.sort(),
  };
}

/** Maps `HandoffSpineError.code` (and our own boundary errors of the same
 * shape) onto the HTTP status the route should answer with. Centralised so
 * every proposal-flow route (generate-notes, notes/:noteId/decision) reports
 * the same code the same way instead of each re-deriving it. */
function statusForSpineErrorCode(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'INVALID_STATE_TRANSITION':
    case 'NOT_APPROVED':
    case 'IDEMPOTENCY_CONFLICT':
      return 409;
    case 'NOT_A_HUMAN_ACTOR':
    case 'INVALID_ARGUMENT':
      return 400;
    default:
      return 500;
  }
}

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role?: string; email?: string };
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

function isMeetingAdmin(req: AuthRequest): boolean {
  return PRIVILEGED_MEETING_ROLES.includes(getMeetingUserRole(req).toLowerCase());
}

function normalizeParticipant(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function canAccessMeeting(
  req: AuthRequest,
  meeting: Awaited<ReturnType<typeof getMeeting>>
): boolean {
  if (!meeting || !req.user) return false;
  if (isMeetingAdmin(req) || meeting.createdBy === req.user.id) return true;
  const identities = new Set(
    [req.user.id, req.user.email].map(normalizeParticipant).filter(Boolean)
  );
  return meeting.attendees.some((attendee) => identities.has(normalizeParticipant(attendee)));
}

function denyMeetingAccess(res: Response): Response {
  // Deliberately 404: do not reveal a same-tenant meeting to a non-participant.
  return res.status(404).json({ error: 'Meeting not found' });
}

function hasDirectMeetingOutputs(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return [value.decisions, value.followUps].some(
    (candidate) => candidate !== undefined && (!Array.isArray(candidate) || candidate.length > 0)
  );
}

function rejectDirectMeetingOutputs(res: Response): Response {
  return res.status(409).json({
    error: 'Meeting decisions and follow-ups require a governed proposal',
    code: 'MEETING_PROPOSAL_REQUIRED',
  });
}

router.use(verifyToken);
router.use(isAuthenticated);
router.use(closedBetaModuleGate);
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
    return res.json({ meetings: meetings.filter((meeting) => canAccessMeeting(req, meeting)) });
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
    if (hasDirectMeetingOutputs(req.body)) return rejectDirectMeetingOutputs(res);

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
      // Decisions are outputs, never scheduling metadata. They enter only via
      // the governed note proposal below, not through meeting creation.
      decisions: [],
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
    if (hasDirectMeetingOutputs(req.body)) return rejectDirectMeetingOutputs(res);
    const existing = await getMeeting({
      organizationId: orgId,
      meetingId: String(req.params.id),
    });
    if (!existing) return res.status(404).json({ error: 'Meeting not found' });
    if (!isMeetingAdmin(req) && existing.createdBy !== req.user?.id) return denyMeetingAccess(res);

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
    const meeting = await getMeeting({ organizationId: orgId, meetingId: String(req.params.id) });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);
    return res.status(410).json({
      error: 'Direct meeting decision writes are retired; submit governed meeting notes',
      code: 'MEETING_PROPOSAL_REQUIRED',
    });
  })
);

router.post(
  '/:id/follow-ups',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const meeting = await getMeeting({ organizationId: orgId, meetingId: String(req.params.id) });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);
    return res.status(410).json({
      error: 'Direct meeting follow-up writes are retired; submit governed meeting notes',
      code: 'MEETING_PROPOSAL_REQUIRED',
    });
  })
);

router.patch(
  '/:meetingId/follow-ups/:followUpId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const meeting = await getMeeting({
      organizationId: orgId,
      meetingId: String(req.params.meetingId),
    });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);
    return res.status(410).json({
      error: 'Legacy meeting follow-ups are read-only',
      code: 'MEETING_PROPOSAL_REQUIRED',
    });
  })
);

/**
 * POST /:id/generate-notes — Module 13 activation.
 *
 * Turns a meeting transcript into structured AI notes (summary, key points,
 * decisions, action items) via meetingIntelligenceService.
 *
 * L-05 (MTG-BVP-001, 2026-08-16): this used to persist the extracted
 * decisions/action items DIRECTLY into `meetings.decisions_json` /
 * `meeting_follow_ups` whenever `persist !== false` — i.e. persistence
 * defaulted ON with NO human approval step, and no idempotency guard, so a
 * retried/double-clicked request silently duplicated. The note content
 * itself was also discarded the moment the HTTP response was sent — nothing
 * durable stored it.
 *
 * The DEFAULT is now: the note is durably stored (`meeting_notes`) and
 * proposed as a governed handoff (`artifactHandoff/handoffSpineService.ts`,
 * `targetKind: 'material'`) — NOTHING is written into
 * `meetings.decisions_json` / `meeting_follow_ups` until a human approves via
 * `POST /:id/notes/:noteId/decision`. A retried call with the same transcript
 * (or an explicit `idempotencyKey`) replays the SAME note + proposal instead
 * of creating a second one.
 *
 * The legacy `persist:true` bypass is rejected. It had no idempotency or
 * human-approval boundary and therefore cannot coexist with this contract.
 */
router.post(
  '/:id/generate-notes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const payloadPolicy = validateManualMeetingNotePayload(req.body);
    if (!payloadPolicy.ok) {
      return res.status(400).json({
        error:
          payloadPolicy.code === 'MEETING_CAPTURE_DISABLED'
            ? 'Meeting recording and automatic transcription are disabled'
            : 'Unsupported meeting-note request field',
        code: payloadPolicy.code,
        fields: payloadPolicy.fields,
      });
    }

    const meetingId = String(req.params.id);
    const transcript = String(req.body?.transcript || '').trim();
    if (!transcript) {
      return res.status(400).json({ error: 'transcript is required' });
    }
    const meeting = await getMeeting({ organizationId: orgId, meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);

    const language =
      typeof req.body?.language === 'string' && req.body.language.trim()
        ? req.body.language.trim()
        : 'en';

    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()
        ? req.body.idempotencyKey.trim()
        : null;
    try {
      const replay = await findMeetingNoteReplay({
        organizationId: orgId,
        meetingId,
        transcript,
        language,
        idempotencyKey,
      });
      if (replay) {
        return res.status(200).json({
          note: {
            source: replay.note.source,
            summary: replay.note.summary,
            keyPoints: replay.note.keyPoints,
            decisions: replay.note.decisions,
            actionItems: replay.note.actionItems,
          },
          meeting,
          meetingNoteId: replay.note.id,
          proposal: {
            proposalId: replay.proposal.proposalId,
            state: replay.proposal.state,
            replayed: true,
          },
        });
      }
    } catch (err: unknown) {
      if (err instanceof MeetingBoundaryError || err instanceof HandoffSpineError) {
        return res
          .status(statusForSpineErrorCode(err.code))
          .json({ error: err.message, code: err.code });
      }
      throw err;
    }

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

    let storedNote;
    let proposal;
    let replayed;
    try {
      ({
        note: storedNote,
        proposal,
        replayed,
      } = await proposeMeetingNote({
        organizationId: orgId,
        meetingId,
        createdBy: userId,
        source: note.source === 'ai' ? 'ai' : 'heuristic',
        language,
        transcript,
        summary: note.summary || '',
        keyPoints: note.keyPoints || [],
        decisions: note.decisions || [],
        actionItems: note.actionItems || [],
        idempotencyKey,
      }));
    } catch (err: unknown) {
      if (err instanceof MeetingBoundaryError || err instanceof HandoffSpineError) {
        return res
          .status(statusForSpineErrorCode(err.code))
          .json({ error: err.message, code: err.code });
      }
      throw err;
    }

    const refreshed = await getMeeting({ organizationId: orgId, meetingId });
    return res.status(201).json({
      // On replay return the first durable proposal bytes, not a fresh LLM
      // rendering that was intentionally discarded by idempotency.
      note: {
        ...note,
        source: storedNote.source,
        summary: storedNote.summary,
        keyPoints: storedNote.keyPoints,
        decisions: storedNote.decisions,
        actionItems: storedNote.actionItems,
      },
      meeting: refreshed || meeting,
      meetingNoteId: storedNote.id,
      proposal: { proposalId: proposal.proposalId, state: proposal.state, replayed },
    });
  })
);

/**
 * GET /:id/notes — durable, governed AI notes for this meeting (newest
 * first). Each entry carries `status` ('proposed' | 'approved' | 'rejected')
 * mirroring its `artifact_handoff_proposals` state.
 */
router.get(
  '/:id/notes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const meetingId = String(req.params.id);
    const meeting = await getMeeting({ organizationId: orgId, meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);
    const notes = await listMeetingNotesForMeeting({ organizationId: orgId, meetingId });
    return res.json({ notes });
  })
);

/**
 * POST /:id/notes/:noteId/decision — the human-approval gate. Body:
 * `{ action: 'approve' | 'reject', reason?: string }`.
 *
 * L-05: mirrors the existing DELETE/status-change role gate
 * (`requireMeetingAdmin`) — approving AI-extracted content into an approved
 * meeting material is treated as the same class of privileged action as
 * flipping meeting status or deleting a meeting, not an open-to-all-members
 * action like adding a manual decision/follow-up.
 *
 * On approve, this performs approve + materialize as ONE call and returns
 * the exactly-one receipt (`server/src/services/artifactHandoff/handoffSpineService.ts`
 * guarantees the exactly-one invariant under concurrency/replay — this route
 * does not reimplement it). On reject, nothing is materialized.
 */
router.post(
  '/:id/notes/:noteId/decision',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!requireMeetingAdmin(req, res)) return;

    const meetingId = String(req.params.id);
    const noteId = String(req.params.noteId);
    const action = String(req.body?.action || '')
      .trim()
      .toLowerCase();
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }

    const meeting = await getMeeting({ organizationId: orgId, meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!canAccessMeeting(req, meeting)) return denyMeetingAccess(res);

    try {
      const result = await decideMeetingNote({
        organizationId: orgId,
        meetingId,
        noteId,
        decidedBy: userId,
        action,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
      });
      if (!result) return res.status(404).json({ error: 'Meeting note not found' });
      return res.status(200).json({
        note: result.note,
        proposal: result.proposal,
        receipt: result.receipt,
        replayed: result.replayed,
      });
    } catch (err: unknown) {
      if (err instanceof HandoffSpineError) {
        return res
          .status(statusForSpineErrorCode(err.code))
          .json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

export default router;
