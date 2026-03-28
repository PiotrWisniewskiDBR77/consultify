/**
 * V8 multiplayer read bridge — org-scoped persisted substrate only (mappings, room
 * binding resolution, surface presence rows, active locks). Delegates to
 * multiplayerHardeningService and concurrentEditingService.
 *
 * Namespace: /api/v8/multiplayer (mounted by v8/index).
 *
 * Does NOT prove websocket transport, staging realtime, or collaborative UI wiring;
 * clients must treat this as database-backed truth only.
 *
 * @module routes/v8/multiplayer.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getActiveLocks } from '../../services/v8/concurrentEditingService.js';
import {
  getPresenceBySurface,
  getResourceTypeMapping,
  getWorkspacePresence,
  resolveRoomBinding,
} from '../../services/v8/multiplayerHardeningService.js';
import {
  type Surface,
  SurfaceValues,
  type WorkspaceTool,
  WorkspaceToolValues,
} from '../../types/multiplayerHardening.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 multiplayer persisted read responses. */
export const V8_MULTIPLAYER_READ_CONTRACT = 'multiplayer_persisted_read_v1';

function multiplayerMeta() {
  return {
    version: 'v8' as const,
    contract: V8_MULTIPLAYER_READ_CONTRACT,
    /** DB-backed reads only; websocket/live sync not implied by this contract. */
    readScope: 'persisted_database' as const,
  };
}

const firstQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

function parseWorkspaceTool(raw: string | undefined): WorkspaceTool | null {
  if (!raw) return null;
  return (WorkspaceToolValues as readonly string[]).includes(raw) ? (raw as WorkspaceTool) : null;
}

function parseSurface(raw: string | undefined): Surface | null {
  if (!raw) return null;
  return (SurfaceValues as readonly string[]).includes(raw) ? (raw as Surface) : null;
}

/**
 * GET /api/v8/multiplayer/resource-mappings/:resourceType
 */
router.get(
  '/resource-mappings/:resourceType',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const resourceType = parseWorkspaceTool(
      firstParam((req.params as { resourceType?: string }).resourceType)
    );
    if (!resourceType) {
      return res.status(400).json({
        error: 'Invalid or missing resourceType',
        code: 'MULTIPLAYER_INVALID_RESOURCE_TYPE',
      });
    }

    const mapping = await getResourceTypeMapping(resourceType, organizationId);
    return res.json({
      data: { mapping, resourceType },
      meta: multiplayerMeta(),
    });
  })
);

/**
 * GET /api/v8/multiplayer/room-binding?resourceType=&resourceId=&parentResourceId=
 */
router.get(
  '/room-binding',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const resourceType = parseWorkspaceTool(firstQueryString(req.query.resourceType));
    const resourceId = firstQueryString(req.query.resourceId)?.trim();
    const parentResourceId = firstQueryString(req.query.parentResourceId)?.trim();

    if (!resourceType) {
      return res.status(400).json({
        error: 'Query resourceType is required and must be a known workspace tool',
        code: 'MULTIPLAYER_INVALID_RESOURCE_TYPE',
      });
    }
    if (!resourceId) {
      return res.status(400).json({
        error: 'Query resourceId is required',
        code: 'MULTIPLAYER_MISSING_RESOURCE_ID',
      });
    }

    const binding = await resolveRoomBinding(
      resourceType,
      resourceId,
      organizationId,
      parentResourceId || undefined
    );

    return res.json({
      data: { binding, resourceType, resourceId, parentResourceId: parentResourceId || null },
      meta: multiplayerMeta(),
    });
  })
);

/**
 * GET /api/v8/multiplayer/rooms/:roomId/presence
 */
router.get(
  '/rooms/:roomId/presence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const roomId = firstParam((req.params as { roomId?: string }).roomId)?.trim();
    if (!roomId) {
      return res.status(400).json({
        error: 'roomId is required',
        code: 'MULTIPLAYER_MISSING_ROOM_ID',
      });
    }

    const presence = await getWorkspacePresence(roomId, organizationId);
    return res.json({
      data: { roomId, presence, count: presence.length },
      meta: multiplayerMeta(),
    });
  })
);

/**
 * GET /api/v8/multiplayer/rooms/:roomId/presence/by-surface?surface=
 */
router.get(
  '/rooms/:roomId/presence/by-surface',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const roomId = firstParam((req.params as { roomId?: string }).roomId)?.trim();
    const surface = parseSurface(firstQueryString(req.query.surface));

    if (!roomId) {
      return res.status(400).json({
        error: 'roomId is required',
        code: 'MULTIPLAYER_MISSING_ROOM_ID',
      });
    }
    if (!surface) {
      return res.status(400).json({
        error: 'Query surface is required and must be a known surface',
        code: 'MULTIPLAYER_INVALID_SURFACE',
      });
    }

    const presence = await getPresenceBySurface(roomId, surface, organizationId);
    return res.json({
      data: { roomId, surface, presence, count: presence.length },
      meta: multiplayerMeta(),
    });
  })
);

/**
 * GET /api/v8/multiplayer/rooms/:roomId/locks
 */
router.get(
  '/rooms/:roomId/locks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const roomId = firstParam((req.params as { roomId?: string }).roomId)?.trim();
    if (!roomId) {
      return res.status(400).json({
        error: 'roomId is required',
        code: 'MULTIPLAYER_MISSING_ROOM_ID',
      });
    }

    const locks = await getActiveLocks(roomId, organizationId);
    return res.json({
      data: { roomId, locks, count: locks.length },
      meta: multiplayerMeta(),
    });
  })
);

export default router;
