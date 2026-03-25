/**
 * V8 read-only PM sync bridge — persisted connector/auth/conflict truth (no live provider calls).
 * Namespace: /api/v8/sync (mounted by v8/index).
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getActiveEscalations,
  getCredentialHealth,
} from '../../services/v8/pmSyncAuthService.js';
import {
  getConnectorHealth,
  getUnresolvedConflicts,
} from '../../services/v8/pmSyncTruthService.js';
import { listGovernedIntegrations } from '../../services/v8/pmSyncInventoryService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 sync read responses. */
export const V8_SYNC_RUNTIME_READ_CONTRACT = 'sync_runtime_read_v1';

function syncReadMeta() {
  return { version: 'v8' as const, contract: V8_SYNC_RUNTIME_READ_CONTRACT };
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

export default router;
