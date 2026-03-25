/**
 * V8 PM sync bridge — governed persisted inventory, auth, conflict truth, and bounded operator recovery.
 * Namespace: /api/v8/sync (mounted by v8/index).
 */

import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getActiveEscalations,
  getCredentialHealth,
  resolveAuthEscalation,
} from '../../services/v8/pmSyncAuthService.js';
import {
  getConnectorHealth,
  setConnectorAuthState,
  getUnresolvedConflicts,
  resolveConflict,
} from '../../services/v8/pmSyncTruthService.js';
import { ConflictResolutionPathValues, ConnectorAuthStateValues } from '../../types/pmSyncTruth.js';
import { listGovernedIntegrations } from '../../services/v8/pmSyncInventoryService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 sync read responses. */
export const V8_SYNC_RUNTIME_READ_CONTRACT = 'sync_runtime_read_v1';
export const V8_SYNC_RUNTIME_MUTATION_CONTRACT = 'sync_runtime_mutation_v1';

function syncReadMeta() {
  return { version: 'v8' as const, contract: V8_SYNC_RUNTIME_READ_CONTRACT };
}

function syncMutationMeta() {
  return { version: 'v8' as const, contract: V8_SYNC_RUNTIME_MUTATION_CONTRACT };
}

const firstQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

function parseConflictLimit(raw: unknown): number | undefined {
  const s = firstQueryString(raw);
  if (s === undefined || s === '') return undefined;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

const ResolveConflictBodySchema = z.object({
  resolutionPath: z.enum(ConflictResolutionPathValues).default('dismiss'),
});

const SetConnectorAuthStateBodySchema = z.object({
  targetState: z.enum(ConnectorAuthStateValues),
  reason: z.string().trim().nullable().optional(),
});

router.get(
  '/integrations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrations = await listGovernedIntegrations(organizationId);
    return res.json({
      data: { integrations, count: integrations.length },
      meta: syncReadMeta(),
    });
  }),
);

router.get(
  '/auth/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const summary = await getCredentialHealth(organizationId);
    return res.json({
      data: { summary },
      meta: syncReadMeta(),
    });
  }),
);

router.get(
  '/auth/escalations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const escalations = await getActiveEscalations(organizationId);
    return res.json({
      data: { escalations, count: escalations.length },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/auth/escalations/:escalationId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const escalationId = typeof req.params.escalationId === 'string' ? req.params.escalationId.trim() : '';
    const resolvedBy =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';

    if (!escalationId) {
      return res.status(400).json({
        error: 'escalationId is required',
        code: 'INVALID_PARAM',
      });
    }

    if (!resolvedBy) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      const escalation = await resolveAuthEscalation(escalationId, resolvedBy, organizationId);
      return res.json({
        data: { escalation },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve auth escalation';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message, code: 'AUTH_ESCALATION_NOT_FOUND' });
      }
      if (message.includes('already resolved')) {
        return res.status(409).json({ error: message, code: 'AUTH_ESCALATION_ALREADY_RESOLVED' });
      }
      throw error;
    }
  }),
);

router.get(
  '/connectors/:connectorId/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const connectorId = typeof req.params.connectorId === 'string' ? req.params.connectorId.trim() : '';
    if (!connectorId) {
      return res.status(400).json({
        error: 'connectorId is required',
        code: 'INVALID_PARAM',
      });
    }
    const health = await getConnectorHealth(connectorId, organizationId);
    return res.json({
      data: { connectorId, health },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/connectors/:connectorId/auth-state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const connectorId = typeof req.params.connectorId === 'string' ? req.params.connectorId.trim() : '';
    const transitionedBy =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';

    if (!connectorId) {
      return res.status(400).json({
        error: 'connectorId is required',
        code: 'INVALID_PARAM',
      });
    }

    if (!transitionedBy) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }

    const parsed = SetConnectorAuthStateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid auth state payload',
        code: 'INVALID_BODY',
      });
    }

    try {
      const record = await setConnectorAuthState({
        connectorId,
        organizationId,
        targetState: parsed.data.targetState,
        transitionedBy,
        reason: parsed.data.reason ?? null,
      });
      return res.json({
        data: { record },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update auth state';
      if (message.includes('Invalid auth state transition')) {
        return res.status(409).json({ error: message, code: 'INVALID_AUTH_TRANSITION' });
      }
      throw error;
    }
  }),
);

router.get(
  '/conflicts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const limit = parseConflictLimit(req.query.limit);
    const conflicts = await getUnresolvedConflicts(organizationId, limit);
    return res.json({
      data: { conflicts, count: conflicts.length },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/conflicts/:conflictId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const conflictId = typeof req.params.conflictId === 'string' ? req.params.conflictId.trim() : '';
    const resolvedBy =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';

    if (!conflictId) {
      return res.status(400).json({
        error: 'conflictId is required',
        code: 'INVALID_PARAM',
      });
    }

    if (!resolvedBy) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }

    const parsed = ResolveConflictBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid resolution payload',
        code: 'INVALID_BODY',
      });
    }

    try {
      const conflict = await resolveConflict(
        conflictId,
        parsed.data.resolutionPath,
        resolvedBy,
        organizationId,
      );
      return res.json({
        data: { conflict },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve conflict';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message, code: 'CONFLICT_NOT_FOUND' });
      }
      if (message.includes('already resolved')) {
        return res.status(409).json({ error: message, code: 'CONFLICT_ALREADY_RESOLVED' });
      }
      throw error;
    }
  }),
);

export default router;
