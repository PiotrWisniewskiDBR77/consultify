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
  getRefreshTimingPolicy,
  resolveAuthEscalation,
  setRefreshTimingPolicy,
} from '../../services/v8/pmSyncAuthService.js';
import {
  getConnectorHealth,
  setConnectorAuthState,
  getUnresolvedConflicts,
  resolveConflict,
} from '../../services/v8/pmSyncTruthService.js';
import {
  CONNECTORS,
  getConnectedIntegrations,
  disconnectIntegration,
  syncIntegration,
  updateIntegrationStatus,
} from '../../services/integrationHubService.js';
import {
  checkRateLimit,
  getIntegrationHealth,
  getUnresolvedErrors,
  logSyncError,
  recordRequest,
  resolveError,
} from '../../services/syncGuardrailsService.js';
import { ConflictResolutionPathValues, ConnectorAuthStateValues } from '../../types/pmSyncTruth.js';
import { ProviderFamilyValues } from '../../types/pmSyncAuthBaseline.js';
import { listGovernedIntegrations } from '../../services/v8/pmSyncInventoryService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

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

async function logIntegrationAudit(
  organizationId: string,
  integrationId: string | null,
  action: string,
  actorId: string,
  actorName: string,
  details: Record<string, unknown> = {},
) {
  await dbRun(
    `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
     VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?::JSONB)`,
    [organizationId, integrationId, action, actorId, actorName, JSON.stringify(details)],
  );
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

function parsePositiveInt(raw: unknown, fallback: number): number {
  const s = firstQueryString(raw);
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

const ResolveConflictBodySchema = z.object({
  resolutionPath: z.enum(ConflictResolutionPathValues).default('dismiss'),
});

const SetConnectorAuthStateBodySchema = z.object({
  targetState: z.enum(ConnectorAuthStateValues),
  reason: z.string().trim().nullable().optional(),
});

const RefreshTimingPolicyBodySchema = z.object({
  typicalTokenLifetimeMinutes: z.number().int().positive(),
  refreshWindowMinutes: z.number().int().positive(),
  maxRetryAttempts: z.number().int().min(1),
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
  '/connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const category = firstQueryString(req.query.category);
    let connectors = Object.values(CONNECTORS);
    if (category) {
      connectors = connectors.filter((c) => c.category === category);
    }

    const catalog = connectors.map((c) => {
      const isV2Ready = ['slack', 'jira', 'gmail', 'asana', 'teams'].includes(c.id);
      return {
        ...c,
        isAvailable: true,
        isV2Ready,
        comingSoon: !isV2Ready,
      };
    });

    return res.json({
      data: { connectors: catalog, count: catalog.length },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await disconnectIntegration(integrationId);
    await logIntegrationAudit(organizationId, integrationId, 'disconnected', actorId, actorId, {});

    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/reauth',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await updateIntegrationStatus(integrationId, 'pending');
    setTimeout(async () => {
      try {
        await updateIntegrationStatus(integrationId, 'connected');
        await dbRun(`UPDATE integrations SET error_count = 0, last_healthy_at = NOW() WHERE id = ?`, [
          integrationId,
        ]);
      } catch {
        /* non-blocking */
      }
    }, 2000);

    await logIntegrationAudit(organizationId, integrationId, 'reauth_started', actorId, actorId, {});

    return res.json({
      data: { success: true as const, message: 'Re-authorization initiated' },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/pause',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await dbRun(
      `UPDATE integrations SET is_paused = TRUE, paused_at = NOW(), updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [integrationId, organizationId],
    );
    await logIntegrationAudit(organizationId, integrationId, 'paused', actorId, actorId, {});

    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/resume',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await dbRun(
      `UPDATE integrations SET is_paused = FALSE, paused_at = NULL, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [integrationId, organizationId],
    );
    await logIntegrationAudit(organizationId, integrationId, 'resumed', actorId, actorId, {});

    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/sync',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const integration = ((await dbAll(
      `SELECT connector_id, is_paused, status FROM integrations WHERE id = ? AND organization_id = ?`,
      [integrationId, organizationId],
    )) || []) as Array<{ connector_id: string; is_paused: boolean; status: string }>;

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found', code: 'NOT_FOUND' });
    }
    if (integration[0].is_paused) {
      return res
        .status(400)
        .json({ error: 'Integration is paused', code: 'INTEGRATION_PAUSED' });
    }
    if (integration[0].status === 'disconnected') {
      return res
        .status(400)
        .json({ error: 'Integration is disconnected', code: 'INTEGRATION_DISCONNECTED' });
    }

    const rateCheck = await checkRateLimit(organizationId, integrationId, integration[0].connector_id);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limited',
        reason: rateCheck.reason,
        retryAfterMs: rateCheck.retryAfterMs,
        warnings: rateCheck.warnings,
        code: 'RATE_LIMITED',
      });
    }

    const runId = `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date();
    await dbRun(
      `INSERT INTO integration_sync_runs
         (id, organization_id, integration_id, provider, direction, status, started_at, triggered_by)
       VALUES (?, ?, ?, ?, 'pull', 'running', NOW(), 'manual')`,
      [runId, organizationId, integrationId, integration[0].connector_id],
    );

    await recordRequest(organizationId, integrationId, integration[0].connector_id);

    try {
      const result = await syncIntegration(integrationId, {});
      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'completed', items_processed = ?, duration_ms = ?, completed_at = NOW()
         WHERE id = ?`,
        [result.recordsSynced, result.duration, runId],
      );
      await dbRun(`UPDATE integrations SET last_healthy_at = NOW(), error_count = 0 WHERE id = ?`, [
        integrationId,
      ]);
      await logIntegrationAudit(organizationId, integrationId, 'sync_completed', actorId, actorId, {
        syncRunId: runId,
        recordsSynced: result.recordsSynced,
        duration: result.duration,
      });

      return res.json({
        data: {
          success: true as const,
          syncRun: {
            id: runId,
            status: 'completed',
            recordsSynced: result.recordsSynced,
            duration: result.duration,
          },
          warnings: rateCheck.warnings,
        },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const errorMessage = (error as Error).message || 'Sync failed';
      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'failed', error_summary = ?, duration_ms = ?, completed_at = NOW()
         WHERE id = ?`,
        [errorMessage, Date.now() - startedAt.getTime(), runId],
      );
      await logSyncError(organizationId, integrationId, error as Error, runId);

      return res.status(500).json({ error: errorMessage, syncRunId: runId, code: 'SYNC_FAILED' });
    }
  }),
);

router.get(
  '/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrations = await getConnectedIntegrations(organizationId);
    const healthChecks = await Promise.all(integrations.map((int) => getIntegrationHealth(organizationId, int.id)));
    const summary = {
      total: healthChecks.length,
      healthy: healthChecks.filter((h) => h.status === 'healthy').length,
      degraded: healthChecks.filter((h) => h.status === 'degraded').length,
      unhealthy: healthChecks.filter((h) => h.status === 'unhealthy').length,
    };

    return res.json({
      data: { summary },
      meta: syncReadMeta(),
    });
  }),
);

router.get(
  '/errors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId = firstQueryString(req.query.integrationId);
    const errors = await getUnresolvedErrors(organizationId, integrationId || undefined);
    return res.json({
      data: {
        errors: (errors || []).map((error) => ({
          id: error.id,
          integrationId: error.integrationId,
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          isRetryable: error.isRetryable,
          retryCount: error.retryCount,
          maxRetries: error.maxRetries,
          createdAt: error.createdAt,
        })),
        count: errors.length,
      },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/errors/:errorId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errorId = typeof req.params.errorId === 'string' ? req.params.errorId.trim() : '';
    if (!errorId) {
      return res.status(400).json({
        error: 'errorId is required',
        code: 'INVALID_PARAM',
      });
    }

    await resolveError(errorId);
    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  }),
);

router.get(
  '/audit-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId = firstQueryString(req.query.integrationId);
    const limit = parsePositiveInt(req.query.limit, 50);

    let query = `
      SELECT id, integration_id, action, actor_id, actor_name, details, created_at
      FROM integration_audit_log
      WHERE organization_id = ?
    `;
    const params: unknown[] = [organizationId];

    if (integrationId) {
      query += ' AND integration_id = ?';
      params.push(integrationId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const entries = ((await dbAll(query, params)) || []) as Array<Record<string, unknown>>;
    return res.json({
      data: { entries, count: entries.length },
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
  '/auth/policies/:providerFamily',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const parsed = z.enum(ProviderFamilyValues).safeParse(req.params.providerFamily);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid provider family',
        code: 'INVALID_PARAM',
      });
    }

    const policy = await getRefreshTimingPolicy(parsed.data, organizationId);
    return res.json({
      data: { policy },
      meta: syncReadMeta(),
    });
  }),
);

router.post(
  '/auth/policies/:providerFamily',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const parsedFamily = z.enum(ProviderFamilyValues).safeParse(req.params.providerFamily);
    if (!parsedFamily.success) {
      return res.status(400).json({
        error: parsedFamily.error.issues[0]?.message ?? 'Invalid provider family',
        code: 'INVALID_PARAM',
      });
    }

    const parsedBody = RefreshTimingPolicyBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid refresh timing payload',
        code: 'INVALID_BODY',
      });
    }

    const policy = await setRefreshTimingPolicy({
      providerFamily: parsedFamily.data,
      organizationId,
      typicalTokenLifetimeMinutes: parsedBody.data.typicalTokenLifetimeMinutes,
      refreshWindowMinutes: parsedBody.data.refreshWindowMinutes,
      maxRetryAttempts: parsedBody.data.maxRetryAttempts,
    });

    return res.json({
      data: { policy },
      meta: syncMutationMeta(),
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
