/**
 * Realtime Platform Routes
 * V4-ENT-06, V4-IDEA-03, V4-TOOL-04, V4-TOOL-05
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  InvalidPhaseTransitionError,
  UnknownPhaseError,
} from '../services/facilitationPhaseMachine.js';
import { realtimePlatformService } from '../services/realtimePlatformService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const isToolSessionLockUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('db') ||
    message.includes('database') ||
    message.includes('sql') ||
    message.includes('timeout') ||
    message.includes('connection')
  );
};

const isRealtimeSubstrateUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('db') ||
    message.includes('database') ||
    message.includes('sql') ||
    message.includes('timeout') ||
    message.includes('connection')
  );
};

// Roles that may grant/reassign facilitation roles org-wide even without being the
// session owner or an existing facilitator (mirrors the requireRole/admin-data pattern
// used elsewhere: normalized, case-insensitive match against org membership roles).
const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'administrator', 'super_admin', 'superadmin']);

const isOrgAdminRequester = (req: AuthRequest): boolean => {
  const role = (req.userRole || req.user?.role || '').toString().trim().toLowerCase();
  if (ORG_ADMIN_ROLES.has(role)) return true;
  return Boolean(req.user?.isSuperAdmin === true);
};

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId =
    req.user?.organizationId ||
    req.organizationId ||
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string);
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// Shared authz gate for facilitation *control* actions. Changing the phase, driving the
// shared timer, ending the session, or assigning roles all mutate state that affects
// every participant of a whiteboard session — they are facilitator privileges, not
// per-member ones. Without this, any authenticated org member could end (or hijack the
// phase/timer of) someone else's session. Allowed only if the requester is (a) the
// session creator/owner (tool_facilitation_sessions.facilitator_id), (b) already holds
// the 'facilitator' role in THIS session (tool_facilitation_roles), or (c) an org
// admin/owner/superadmin. Returns true when allowed; otherwise writes a 403 with the
// caller-supplied error/code and returns false. Org-scope is assumed already enforced by
// the caller's getFacilitationSession(orgId, sessionId) fetch (cross-org → 404 first).
const ensureFacilitatorControl = async (
  req: AuthRequest,
  res: Response,
  session: unknown,
  id: { userId: string; orgId: string },
  sessionId: string,
  forbidden: { error: string; code: string }
): Promise<boolean> => {
  const isSessionOwner = (session as { facilitator_id?: string }).facilitator_id === id.userId;
  const isOrgAdmin = isOrgAdminRequester(req);
  let isExistingFacilitator = false;
  if (!isSessionOwner && !isOrgAdmin) {
    const existingRole = await realtimePlatformService.getRoleForUser(
      id.orgId,
      sessionId,
      id.userId
    );
    isExistingFacilitator = existingRole?.role_name === 'facilitator';
  }
  if (isSessionOwner || isOrgAdmin || isExistingFacilitator) return true;
  res.status(403).json(forbidden);
  return false;
};

// T9-1: an ENDED (closed) facilitation session is frozen — no phase/timer/vote/role
// mutation is allowed after it is closed. Returns true (and writes 409) when the
// session is ended, so the caller can `if (rejectIfEnded(...)) return;`.
const rejectIfEnded = (res: Response, session: unknown): boolean => {
  if ((session as { status?: string })?.status === 'ended') {
    res.status(409).json({
      error: 'This facilitation session has ended and is read-only',
      code: 'REALTIME_FACILITATION_SESSION_ENDED',
    });
    return true;
  }
  return false;
};

// ═══════════════════════════════════════════
// V4-ENT-06: Channels & Presence
// ═══════════════════════════════════════════

router.post(
  '/channels',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      channelType: z.string(),
      resourceType: z.string(),
      resourceId: z.string(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid channel payload',
        code: 'REALTIME_CHANNEL_CREATE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.createChannel(id.orgId, p.data);
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Realtime channel substrate is temporarily unavailable',
          code: 'REALTIME_CHANNEL_CREATE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/channels',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const resourceType = req.query.resourceType as string | undefined;
    try {
      res.json({ channels: await realtimePlatformService.listChannels(id.orgId, resourceType) });
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Realtime channel list is temporarily unavailable',
          code: 'REALTIME_CHANNEL_LIST_READ_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/channels/:channelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(await realtimePlatformService.deleteChannel(id.orgId, req.params.channelId));
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Realtime channel delete is temporarily unavailable',
          code: 'REALTIME_CHANNEL_DELETE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/channels/:channelId/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      userName: z.string().optional(),
      userColor: z.string().optional(),
      cursorState: z.record(z.string(), z.unknown()).optional(),
      activeElement: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid channel presence payload',
        code: 'REALTIME_CHANNEL_PRESENCE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.upsertPresence(req.params.channelId, {
        userId: id.userId,
        ...p.data,
      });
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Channel presence is temporarily unavailable',
          code: 'REALTIME_CHANNEL_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/channels/:channelId/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json({ presence: await realtimePlatformService.listPresence(req.params.channelId) });
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Channel presence is temporarily unavailable',
          code: 'REALTIME_CHANNEL_PRESENCE_READ_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/channels/:resourceType/:resourceId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      const ch = await realtimePlatformService.getChannel(
        id.orgId,
        req.params.resourceType,
        req.params.resourceId
      );
      if (!ch) {
        res.status(404).json({
          error: 'Channel not found',
          code: 'REALTIME_CHANNEL_NOT_FOUND',
        });
        return;
      }
      res.json(ch);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Realtime channel read is temporarily unavailable',
          code: 'REALTIME_CHANNEL_READ_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/channels/:channelId/heartbeat',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(await realtimePlatformService.heartbeatPresence(req.params.channelId, id.userId));
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Channel presence is temporarily unavailable',
          code: 'REALTIME_CHANNEL_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/channels/:channelId/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(await realtimePlatformService.disconnectPresence(req.params.channelId, id.userId));
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Channel presence is temporarily unavailable',
          code: 'REALTIME_CHANNEL_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/presence/clean-stale',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const staleMinutes = Number(req.query.staleMinutes) || 5;
    try {
      res.json(await realtimePlatformService.cleanStalePresence(staleMinutes));
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Realtime stale presence cleanup is temporarily unavailable',
          code: 'REALTIME_CHANNEL_CLEAN_STALE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

// ═══════════════════════════════════════════
// V4-IDEA-03: CRDT Documents
// ═══════════════════════════════════════════

router.post(
  '/crdt/documents',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      resourceType: z.string(),
      resourceId: z.string(),
      crdtType: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid CRDT document payload',
        code: 'REALTIME_CRDT_DOCUMENT_CREATE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.createCrdtDocument(id.orgId, p.data);
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'CRDT substrate is temporarily unavailable',
          code: 'REALTIME_CRDT_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/crdt/documents/:resourceType/:resourceId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      const doc = await realtimePlatformService.getCrdtDocument(
        id.orgId,
        req.params.resourceType,
        req.params.resourceId
      );
      if (!doc) {
        res.status(404).json({
          error: 'CRDT document not found',
          code: 'REALTIME_CRDT_DOCUMENT_NOT_FOUND',
        });
        return;
      }
      res.json(doc);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'CRDT substrate is temporarily unavailable',
          code: 'REALTIME_CRDT_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.put(
  '/crdt/documents/:docId/snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ stateVector: z.string(), snapshotData: z.string() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid CRDT snapshot payload',
        code: 'REALTIME_CRDT_SNAPSHOT_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      res.json(
        await realtimePlatformService.saveCrdtSnapshot(req.params.docId, {
          ...p.data,
          userId: id.userId,
        })
      );
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'CRDT substrate is temporarily unavailable',
          code: 'REALTIME_CRDT_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/crdt/documents/:docId/updates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ updateData: z.string(), originClientId: z.string().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid CRDT update payload',
        code: 'REALTIME_CRDT_UPDATE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.appendCrdtUpdate(req.params.docId, {
        ...p.data,
        originUserId: id.userId,
      });
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'CRDT substrate is temporarily unavailable',
          code: 'REALTIME_CRDT_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/crdt/documents/:docId/updates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const afterSeq = Number(req.query.afterSequence) || 0;
    try {
      res.json({
        updates: await realtimePlatformService.getCrdtUpdates(req.params.docId, afterSeq),
      });
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'CRDT substrate is temporarily unavailable',
          code: 'REALTIME_CRDT_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/crdt/documents/:docId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await realtimePlatformService.deleteCrdtDocument(id.orgId, req.params.docId));
  })
);

// ═══════════════════════════════════════════
// V4-TOOL-04: Facilitation Layer
// ═══════════════════════════════════════════

router.post(
  '/facilitation/sessions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      toolSessionId: z.string(),
      settings: z.record(z.string(), z.unknown()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation session payload',
        code: 'REALTIME_FACILITATION_SESSION_CREATE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.createFacilitationSession(id.orgId, {
        ...p.data,
        facilitatorId: id.userId,
      });
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

// B1 (M09): read-only resolve of the ACTIVE shared session for a tool_session_id (e.g.
// `whiteboard:<ideaId>`) WITHOUT creating one — used to enforce observer read-only on
// board-open while keeping facilitation lazy. Registered before /:sessionId; the
// distinct `by-tool` segment prevents any route-matching ambiguity.
router.get(
  '/facilitation/sessions/by-tool/:toolSessionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      const s = await realtimePlatformService.getActiveFacilitationSessionByTool(
        id.orgId,
        req.params.toolSessionId
      );
      // 200 with { session: null } when none active — the caller treats absence as
      // "no facilitation → not an observer", so this must not be a 404.
      res.json({ session: s ?? null });
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/facilitation/sessions/:sessionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      const s = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!s) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      res.json(s);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.put(
  '/facilitation/sessions/:sessionId/timer',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ timerState: z.record(z.string(), z.unknown()) });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation timer payload',
        code: 'REALTIME_FACILITATION_TIMER_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      if (
        !(await ensureFacilitatorControl(req, res, session, id, req.params.sessionId, {
          error:
            'Only the session facilitator, its creator, or an org admin can control this facilitation session',
          code: 'REALTIME_FACILITATION_CONTROL_FORBIDDEN',
        }))
      )
        return;
      if (rejectIfEnded(res, session)) return;
      res.json(
        await realtimePlatformService.updateTimerState(req.params.sessionId, p.data.timerState)
      );
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.put(
  '/facilitation/sessions/:sessionId/phase',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ phase: z.string() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation phase payload',
        code: 'REALTIME_FACILITATION_PHASE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      if (
        !(await ensureFacilitatorControl(req, res, session, id, req.params.sessionId, {
          error:
            'Only the session facilitator, its creator, or an org admin can control this facilitation session',
          code: 'REALTIME_FACILITATION_CONTROL_FORBIDDEN',
        }))
      )
        return;
      if (rejectIfEnded(res, session)) return;
      const currentPhase = (session as { current_phase?: string | null }).current_phase ?? null;
      res.json(
        await realtimePlatformService.updatePhase(req.params.sessionId, p.data.phase, currentPhase)
      );
    } catch (error) {
      if (error instanceof UnknownPhaseError) {
        res.status(400).json({ error: error.message, code: error.code });
        return;
      }
      if (error instanceof InvalidPhaseTransitionError) {
        res.status(409).json({ error: error.message, code: error.code });
        return;
      }
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/facilitation/sessions/:sessionId/end',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      if (
        !(await ensureFacilitatorControl(req, res, session, id, req.params.sessionId, {
          error:
            'Only the session facilitator, its creator, or an org admin can end this facilitation session',
          code: 'REALTIME_FACILITATION_CONTROL_FORBIDDEN',
        }))
      )
        return;
      res.json(await realtimePlatformService.endFacilitationSession(req.params.sessionId));
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/facilitation/sessions/:sessionId/votes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      voteTargetId: z.string(),
      voteType: z.string().optional(),
      voteValue: z.number().optional(),
      comment: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation vote payload',
        code: 'REALTIME_FACILITATION_VOTE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      // T9-1: a closed session is frozen — reject the participant mutation.
      if (rejectIfEnded(res, session)) return;
      // No facilitator gate here (deliberate): casting a vote is ordinary participation,
      // not session control. The voter is always the authenticated requester — voterId is
      // taken from id.userId, never the body — so a member can only ever vote as
      // themselves within their own org's session. Existence/org-scope is already enforced
      // by the getFacilitationSession(orgId, sessionId) fetch above.
      const r = await realtimePlatformService.castVote(req.params.sessionId, {
        voterId: id.userId,
        ...p.data,
      });
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/facilitation/sessions/:sessionId/votes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const session = await realtimePlatformService.getFacilitationSession(
      id.orgId,
      req.params.sessionId
    );
    if (!session) {
      res.status(404).json({ error: 'Facilitation session not found' });
      return;
    }
    const targetId = req.query.targetId as string | undefined;
    res.json({
      votes: await realtimePlatformService.getVotes(id.orgId, req.params.sessionId, targetId),
    });
  })
);

router.get(
  '/facilitation/sessions/:sessionId/votes/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const session = await realtimePlatformService.getFacilitationSession(
      id.orgId,
      req.params.sessionId
    );
    if (!session) {
      res.status(404).json({ error: 'Facilitation session not found' });
      return;
    }
    res.json({
      summary: await realtimePlatformService.getVoteSummary(id.orgId, req.params.sessionId),
    });
  })
);

router.post(
  '/facilitation/sessions/:sessionId/roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      userId: z.string(),
      roleName: z.string(),
      permissions: z.array(z.string()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation role payload',
        code: 'REALTIME_FACILITATION_ROLE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }

      // AUTHZ GATE (security fix): assigning a facilitation role is a privilege
      // grant — without this check any authenticated org member could hand
      // themselves (or anyone else) the 'facilitator' role and its permissions
      // (timer/voting/follow control) on someone else's session. Same gate as the
      // phase/timer/end control actions; keeps its role-specific error code.
      if (
        !(await ensureFacilitatorControl(req, res, session, id, req.params.sessionId, {
          error:
            'Only the session facilitator, its creator, or an org admin can assign facilitation roles',
          code: 'REALTIME_FACILITATION_ROLE_FORBIDDEN',
        }))
      )
        return;
      if (rejectIfEnded(res, session)) return;

      const r = await realtimePlatformService.assignRole(req.params.sessionId, p.data);
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/facilitation/sessions/:sessionId/roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const session = await realtimePlatformService.getFacilitationSession(
      id.orgId,
      req.params.sessionId
    );
    if (!session) {
      res.status(404).json({ error: 'Facilitation session not found' });
      return;
    }
    res.json({ roles: await realtimePlatformService.getRoles(id.orgId, req.params.sessionId) });
  })
);

router.post(
  '/facilitation/sessions/:sessionId/outcomes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      outcomeType: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      voteSummary: z.record(z.string(), z.unknown()).optional(),
      exportedToType: z.string().optional(),
      exportedToId: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation outcome payload',
        code: 'REALTIME_FACILITATION_OUTCOME_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const session = await realtimePlatformService.getFacilitationSession(
        id.orgId,
        req.params.sessionId
      );
      if (!session) {
        res.status(404).json({
          error: 'Facilitation session not found',
          code: 'REALTIME_FACILITATION_SESSION_NOT_FOUND',
        });
        return;
      }
      const r = await realtimePlatformService.createOutcome(req.params.sessionId, p.data);
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/facilitation/sessions/:sessionId/outcomes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const session = await realtimePlatformService.getFacilitationSession(
      id.orgId,
      req.params.sessionId
    );
    if (!session) {
      res.status(404).json({ error: 'Facilitation session not found' });
      return;
    }
    res.json({
      outcomes: await realtimePlatformService.getOutcomes(id.orgId, req.params.sessionId),
    });
  })
);

router.put(
  '/facilitation/outcomes/:outcomeId/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ exportType: z.string(), exportId: z.string() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid facilitation export payload',
        code: 'REALTIME_FACILITATION_EXPORT_PAYLOAD_INVALID',
      });
      return;
    }
    // Verify outcome belongs to a session owned by caller's org
    const outcomeRow = await realtimePlatformService.getOutcomeWithSession(
      id.orgId,
      req.params.outcomeId
    );
    if (!outcomeRow) {
      res
        .status(404)
        .json({ error: 'Outcome not found', code: 'REALTIME_FACILITATION_OUTCOME_NOT_FOUND' });
      return;
    }
    try {
      res.json(
        await realtimePlatformService.exportOutcome(
          req.params.outcomeId,
          p.data.exportType,
          p.data.exportId
        )
      );
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Facilitation substrate is temporarily unavailable',
          code: 'REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

// ═══════════════════════════════════════════
// V4-TOOL-05: Tool Session Presence & Locks
// ═══════════════════════════════════════════

router.post(
  '/tool-sessions/:toolSessionId/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      userName: z.string().optional(),
      userColor: z.string().optional(),
      cursorState: z.record(z.string(), z.unknown()).optional(),
      activeBlockId: z.string().optional(),
      editingField: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid tool-session presence payload',
        code: 'REALTIME_TOOL_SESSION_PRESENCE_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.upsertToolPresence(id.orgId, {
        toolSessionId: req.params.toolSessionId,
        userId: id.userId,
        ...p.data,
      });
      res.status(201).json(r);
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session presence is temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/tool-sessions/:toolSessionId/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json({
        presence: await realtimePlatformService.listToolPresence(
          id.orgId,
          req.params.toolSessionId
        ),
      });
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session presence is temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_PRESENCE_READ_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/tool-sessions/:toolSessionId/heartbeat',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const cursorState = req.body.cursorState;
    try {
      res.json(
        await realtimePlatformService.heartbeatToolPresence(
          id.orgId,
          req.params.toolSessionId,
          id.userId,
          cursorState
        )
      );
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session presence is temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/tool-sessions/:toolSessionId/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(
        await realtimePlatformService.disconnectToolPresence(
          id.orgId,
          req.params.toolSessionId,
          id.userId
        )
      );
    } catch (error) {
      if (isRealtimeSubstrateUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session presence is temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/tool-sessions/:toolSessionId/locks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ blockId: z.string(), ttlMinutes: z.number().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: 'Invalid tool-session lock payload',
        code: 'REALTIME_TOOL_SESSION_LOCK_PAYLOAD_INVALID',
      });
      return;
    }
    try {
      const r = await realtimePlatformService.acquireEditLock(id.orgId, {
        toolSessionId: req.params.toolSessionId,
        blockId: p.data.blockId,
        lockedBy: id.userId,
        ttlMinutes: p.data.ttlMinutes,
      });
      if (r.acquired) {
        res.status(201).json(r);
        return;
      }
      res.status(409).json({
        ...r,
        code: 'REALTIME_TOOL_SESSION_LOCK_HELD',
      });
    } catch (error) {
      if (isToolSessionLockUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session locks are temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/tool-sessions/:toolSessionId/locks/:blockId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(
        await realtimePlatformService.releaseEditLock(
          id.orgId,
          req.params.toolSessionId,
          req.params.blockId,
          id.userId
        )
      );
    } catch (error) {
      if (isToolSessionLockUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session locks are temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/tool-sessions/:toolSessionId/locks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json({
        locks: await realtimePlatformService.listEditLocks(id.orgId, req.params.toolSessionId),
      });
    } catch (error) {
      if (isToolSessionLockUnavailableError(error)) {
        res.status(503).json({
          error: 'Tool-session locks are temporarily unavailable',
          code: 'REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
  })
);

export default router;
