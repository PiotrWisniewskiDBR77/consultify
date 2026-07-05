/**
 * Realtime Platform Routes
 * V4-ENT-06, V4-IDEA-03, V4-TOOL-04, V4-TOOL-05
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
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
      res.json(await realtimePlatformService.updatePhase(req.params.sessionId, p.data.phase));
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
