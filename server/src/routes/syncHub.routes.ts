/**
 * Sync Hub Routes (T086 + T008)
 *
 * Unified API for the Integration Sync Hub:
 *  - List connected integrations with health status
 *  - Connect / disconnect / reauth / pause / resume
 *  - Sync runs history & trigger
 *  - Audit log
 *  - Guardrails (rate limits, errors, health)
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { logIntegrationConnectionEvent } from '../services/integrationConnectionLogService.js';
import {
  connectIntegration,
  CONNECTORS,
  disconnectIntegration,
  getConnectedIntegrations,
  getSyncHistory,
  syncIntegration,
  updateIntegrationStatus,
} from '../services/integrationHubService.js';
import { setIntegrationOwner } from '../services/integrationOwnershipService.js';
import { consumeSyncExternalAuthSession } from '../services/syncExternalAuthSessionService.js';
import {
  checkRateLimit,
  getIntegrationHealth,
  getUnresolvedErrors,
  logSyncError,
  recordRequest,
  resolveError,
} from '../services/syncGuardrailsService.js';
import {
  materializeGovernedExternalAuthCallback,
  shouldMaterializeCallbackDrivenAuth,
} from '../services/v8/pmSyncExternalAuthMaterializationService.js';
import { setConnectorAuthState } from '../services/v8/pmSyncTruthService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader(
    'X-Deprecated',
    'This endpoint is deprecated. Use /api/v8/sync equivalents instead.'
  );
  res.setHeader('Sunset', '2026-09-01');
  next();
});

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; firstName?: string; lastName?: string };
}

// ── Helpers ────────────────────────────────────────────────────

async function logAudit(
  orgId: string,
  integrationId: string | null,
  action: string,
  actorId: string,
  actorName: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await dbRun(
    `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
     VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?::JSONB)`,
    [orgId, integrationId, action, actorId, actorName, JSON.stringify(details)]
  );
}

function renderExternalAuthCallbackHtml(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { max-width: 480px; padding: 24px; border: 1px solid #334155; border-radius: 16px; background: rgba(15,23,42,0.95); box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; line-height: 1.5; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ================================================================
// T086: List all integrations with status + health
// ================================================================

router.get(
  '/integrations',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const integrations = await getConnectedIntegrations(orgId);

    const enriched = await Promise.all(
      integrations.map(async (int) => {
        const health = await getIntegrationHealth(orgId, int.id);
        const errors = await getUnresolvedErrors(orgId, int.id);

        // Fetch last sync run
        const lastRun = ((await dbAll(
          `SELECT id, status, items_processed, duration_ms, started_at, completed_at, error_summary
           FROM integration_sync_runs
           WHERE integration_id = ? ORDER BY started_at DESC LIMIT 1`,
          [int.id]
        )) || []) as Array<{
          id: string;
          status: string;
          items_processed: number;
          duration_ms: number;
          started_at: string;
          completed_at: string;
          error_summary: string;
        }>;

        return {
          ...int,
          health: health.status,
          errorRate: health.errorRate,
          unresolvedErrors: errors.length,
          lastRun: lastRun[0] || null,
          connector: CONNECTORS[int.connectorId] || null,
        };
      })
    );

    return res.json({ integrations: enriched, count: enriched.length });
  })
);

// ================================================================
// T086: Available connectors catalog
// ================================================================

router.get(
  '/connectors',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { category } = req.query;
    let connectors = Object.values(CONNECTORS);
    if (category) {
      connectors = connectors.filter((c) => c.category === String(category));
    }

    const catalog = connectors.map((c) => ({
      ...c,
      isAvailable: true,
      isV2Ready: true,
      comingSoon: false,
    }));

    return res.json({ connectors: catalog });
  })
);

// ================================================================
// T086: Connect integration
// ================================================================

const ConnectSchema = z.object({
  connectorId: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
  displayName: z.string().optional(),
});

router.get(
  '/external-auth/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!state) {
      return res
        .status(400)
        .send(
          renderExternalAuthCallbackHtml(
            'Authorization callback failed',
            'The authorization callback is missing a valid state token.'
          )
        );
    }

    const session = consumeSyncExternalAuthSession(state);
    if (!session) {
      return res
        .status(400)
        .send(
          renderExternalAuthCallbackHtml(
            'Authorization callback expired',
            'The external authorization session is no longer valid. Start the sync authorization flow again from Consultify.'
          )
        );
    }

    await logIntegrationConnectionEvent({
      organizationId: session.organizationId,
      userId: null,
      integrationId: session.integrationId,
      connectorId: session.connectorId,
      eventType: 'external_auth_callback_received',
      metadata: { mode: session.mode, hasCode: Boolean(code) },
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    let callbackMaterialization: {
      credentialStored: true;
      refreshSecretStored: boolean;
      tokenExpiresAt: string | null;
      scopesGranted: string[];
    } | null = null;
    if (shouldMaterializeCallbackDrivenAuth(session.connectorId)) {
      if (!code) {
        return res
          .status(400)
          .send(
            renderExternalAuthCallbackHtml(
              'Authorization callback failed',
              'The provider callback did not include an authorization code. Start the governed authorization flow again from Consultify.'
            )
          );
      }

      const integrationRows = await dbAll<{ config: string | null }>(
        `SELECT config
         FROM integrations
         WHERE id = ? AND organization_id = ?
         LIMIT 1`,
        [session.integrationId, session.organizationId]
      );
      const integration = integrationRows[0];
      if (!integration) {
        return res
          .status(404)
          .send(
            renderExternalAuthCallbackHtml(
              'Authorization callback failed',
              'The governed integration no longer exists. Start the sync authorization flow again from Consultify.'
            )
          );
      }

      try {
        callbackMaterialization = await materializeGovernedExternalAuthCallback({
          req,
          session,
          config: safeJsonParse<Record<string, unknown>>(integration.config, {}),
          code,
        });
      } catch (error) {
        await logAudit(
          session.organizationId,
          session.integrationId,
          'external_auth_callback_materialization_failed',
          'external_auth_callback',
          'external_auth_callback',
          {
            connectorId: session.connectorId,
            mode: session.mode,
            error:
              error instanceof Error ? error.message : 'Unknown callback materialization error',
          }
        );
        return res
          .status(502)
          .send(
            renderExternalAuthCallbackHtml(
              'Authorization callback failed',
              'Consultify could not exchange the provider authorization code into governed sync credentials. Start the authorization flow again after checking the connector OAuth app configuration.'
            )
          );
      }
    }

    await setConnectorAuthState({
      connectorId: session.connectorId,
      organizationId: session.organizationId,
      targetState: 'connected_pending_verification',
      transitionedBy: 'external_auth_callback',
      reason: 'external_auth_callback_received',
    });
    await logAudit(
      session.organizationId,
      session.integrationId,
      'external_auth_callback_received',
      'external_auth_callback',
      'external_auth_callback',
      {
        connectorId: session.connectorId,
        mode: session.mode,
        callbackMaterialized: Boolean(callbackMaterialization),
        refreshSecretStored: callbackMaterialization?.refreshSecretStored ?? false,
        tokenExpiresAt: callbackMaterialization?.tokenExpiresAt ?? null,
        scopesGranted: callbackMaterialization?.scopesGranted ?? [],
      }
    );

    return res
      .status(200)
      .send(
        renderExternalAuthCallbackHtml(
          'Authorization callback received',
          callbackMaterialization
            ? 'Consultify exchanged the provider authorization into governed sync credential truth and stored the governed refresh material. Verification is still pending before sync controls become available.'
            : 'Consultify recorded the external authorization return. Verification is still pending before sync controls become available.'
        )
      );
  })
);

router.post(
  '/connect',
  verifyToken,
  isAuthenticated,
  validateBody(ConnectSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { connectorId, config = {}, displayName } = req.body;
    const connector = CONNECTORS[connectorId];
    if (!connector) return res.status(400).json({ error: 'Unknown connector' });

    // RED-SYNC (2026-07-19): integrationHubService.connectIntegration() throws
    // a plain Error (not an HTTP-aware error) when a connector-specific
    // required config field is missing (e.g. `domain` for gmail/outlook).
    // Before this fix that propagated to the generic Express error handler
    // as an uncaught 500 for what is really a 400 (bad/incomplete request
    // body) — reachable by any authed user who omits a connector's required
    // config field.
    let result: Awaited<ReturnType<typeof connectIntegration>>;
    try {
      result = await connectIntegration(orgId, connectorId, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid connector configuration';
      if (/^Missing required field:|^Unknown connector:/.test(message)) {
        return res.status(400).json({ error: message });
      }
      throw error;
    }
    await setIntegrationOwner({
      integrationId: result.id,
      organizationId: orgId,
      ownerUserId: userId,
    });
    await logIntegrationConnectionEvent({
      organizationId: orgId,
      userId,
      integrationId: result.id,
      connectorId,
      eventType: 'connect_initiated',
      metadata: { displayName: displayName || null },
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    if (displayName) {
      await dbRun(`UPDATE integrations SET display_name = ? WHERE id = ?`, [
        displayName,
        result.id,
      ]);
    }

    const scopes = connector.capabilities.map((c: string) => `read:${c}`);
    await dbRun(`UPDATE integrations SET scopes = ?::JSONB WHERE id = ?`, [
      JSON.stringify(scopes),
      result.id,
    ]);

    await updateIntegrationStatus(result.id, 'pending');

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, result.id, 'connect_initiated', userId, actorName, {
      connectorId,
      displayName,
    });

    return res.json({ success: true, integration: result });
  })
);

// ================================================================
// T086: Disconnect integration
// ================================================================

router.post(
  '/disconnect/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);
    const integration = (await dbAll(
      `SELECT connector_id FROM integrations WHERE id = ? AND organization_id = ?`,
      [intId, orgId]
    )) as Array<{ connector_id: string }> | null;
    const connectorId = integration?.[0]?.connector_id || 'unknown';
    await disconnectIntegration(intId);
    await logIntegrationConnectionEvent({
      organizationId: orgId,
      userId,
      integrationId: intId,
      connectorId,
      eventType: 'disconnect_requested',
      metadata: {},
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, intId, 'disconnected', userId, actorName, {});

    return res.json({ success: true });
  })
);

// ================================================================
// T086: Reauth integration
// ================================================================

router.post(
  '/reauth/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);
    await updateIntegrationStatus(intId, 'pending');

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, intId, 'reauth_started', userId, actorName, {});

    const integration = (await dbAll(
      `SELECT connector_id FROM integrations WHERE id = ? AND organization_id = ?`,
      [intId, orgId]
    )) as Array<{ connector_id: string }> | null;
    const connectorId = integration?.[0]?.connector_id;
    await logIntegrationConnectionEvent({
      organizationId: orgId,
      userId,
      integrationId: intId,
      connectorId: connectorId || 'unknown',
      eventType: 'reauth_started',
      metadata: {},
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    let refreshResult: { success: boolean; error?: string } = { success: false };

    if (connectorId) {
      try {
        const { getRefreshExecutionSecret, executeRefreshExecution } =
          await import('../services/v8/pmSyncRefreshExecutionService.js');
        const secret = await getRefreshExecutionSecret(connectorId, orgId);
        if (secret) {
          const tokenResult = await executeRefreshExecution(connectorId, orgId);
          if (tokenResult.status === 'success') {
            await updateIntegrationStatus(intId, 'connected');
            await setConnectorAuthState({
              connectorId,
              organizationId: orgId,
              targetState: 'healthy',
              transitionedBy: `reauth:${userId}`,
              reason: 'token_refresh_success',
            });
            refreshResult = { success: true };
          } else {
            refreshResult = {
              success: false,
              error:
                'error' in tokenResult
                  ? tokenResult.error || 'Token refresh failed'
                  : 'Token refresh failed',
            };
          }
        } else {
          refreshResult = {
            success: false,
            error: 'No refresh secret stored — manual OAuth required',
          };
        }
      } catch (err) {
        refreshResult = { success: false, ...mapAppErrorResponse((err as Error), req, 'error') };
      }
    }

    if (!refreshResult.success) {
      await updateIntegrationStatus(intId, 'requires_reauth', refreshResult.error);
    }

    await logAudit(
      orgId,
      intId,
      refreshResult.success ? 'reauth_completed' : 'reauth_failed',
      userId,
      actorName,
      {
        refreshResult,
      }
    );

    return res.json({
      success: refreshResult.success,
      message: refreshResult.success
        ? 'Re-authorization completed'
        : 'Re-authorization requires manual OAuth',
      requiresManualOAuth: !refreshResult.success,
      error: refreshResult.error,
    });
  })
);

// ================================================================
// T086: Pause / Resume integration
// ================================================================

router.post(
  '/pause/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);
    await dbRun(
      `UPDATE integrations SET is_paused = TRUE, paused_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [intId]
    );

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, intId, 'paused', userId, actorName, {});

    return res.json({ success: true });
  })
);

router.post(
  '/resume/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);
    await dbRun(
      `UPDATE integrations SET is_paused = FALSE, paused_at = NULL, updated_at = NOW() WHERE id = ?`,
      [intId]
    );

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, intId, 'resumed', userId, actorName, {});

    return res.json({ success: true });
  })
);

// ================================================================
// T086: Run sync now
// ================================================================

router.post(
  '/sync/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);

    // T008: Check guardrails before sync
    const integration = ((await dbAll(
      `SELECT connector_id, is_paused, status FROM integrations WHERE id = ? AND organization_id = ?`,
      [intId, orgId]
    )) || []) as Array<{ connector_id: string; is_paused: boolean; status: string }>;

    if (!integration.length) return res.status(404).json({ error: 'Integration not found' });
    if (integration[0].is_paused) return res.status(400).json({ error: 'Integration is paused' });
    if (integration[0].status === 'disconnected')
      return res.status(400).json({ error: 'Integration is disconnected' });

    const rateCheck = await checkRateLimit(orgId, intId, integration[0].connector_id);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limited',
        reason: rateCheck.reason,
        retryAfterMs: rateCheck.retryAfterMs,
        warnings: rateCheck.warnings,
      });
    }

    // Create sync run record
    const runId = `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date();
    await dbRun(
      `INSERT INTO integration_sync_runs
         (id, organization_id, integration_id, provider, direction, status, started_at, triggered_by)
       VALUES (?, ?, ?, ?, 'pull', 'running', NOW(), 'manual')`,
      [runId, orgId, intId, integration[0].connector_id]
    );

    await recordRequest(orgId, intId, integration[0].connector_id);

    try {
      const result = await syncIntegration(intId, {});

      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'completed', items_processed = ?, duration_ms = ?, completed_at = NOW()
         WHERE id = ?`,
        [result.recordsSynced, result.duration, runId]
      );

      await dbRun(`UPDATE integrations SET last_healthy_at = NOW(), error_count = 0 WHERE id = ?`, [
        intId,
      ]);

      const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
      await logAudit(orgId, intId, 'sync_completed', userId, actorName, {
        syncRunId: runId,
        recordsSynced: result.recordsSynced,
        duration: result.duration,
      });

      return res.json({
        success: true,
        syncRun: {
          id: runId,
          status: 'completed',
          recordsSynced: result.recordsSynced,
          duration: result.duration,
        },
        warnings: rateCheck.warnings,
      });
    } catch (err) {
      const errorMsg = (err as Error).message || 'Sync failed';
      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'failed', error_summary = ?, duration_ms = ?, completed_at = NOW()
         WHERE id = ?`,
        [errorMsg, Date.now() - startedAt.getTime(), runId]
      );

      await logSyncError(orgId, intId, err as Error, runId);
      logger.error('[syncHub] sync failed', {
        err,
        correlationId: (req as any).correlationId,
        syncRunId: runId,
      });

      return res
        .status(500)
        .json({ error: 'Sync failed', code: 'SYNC_HUB_SYNC_FAILED', syncRunId: runId });
    }
  })
);

// ================================================================
// T086: Sync runs history
// ================================================================

router.get(
  '/sync-runs/:integrationId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const intId = String(req.params.integrationId);
    const { limit = '20' } = req.query;

    const runs = ((await dbAll(
      `SELECT id, provider, direction, status, items_processed, items_created, items_updated,
              items_failed, error_summary, duration_ms, started_at, completed_at, triggered_by
       FROM integration_sync_runs
       WHERE integration_id = ? AND organization_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
      [intId, orgId, Math.min(parseInt(String(limit), 10) || 20, 50)]
    )) || []) as Array<Record<string, unknown>>;

    return res.json({ runs, count: runs.length });
  })
);

// ================================================================
// T086: Audit log
// ================================================================

router.get(
  '/audit-log',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { integrationId, limit = '50' } = req.query;
    let query = `
      SELECT id, integration_id, action, actor_id, actor_name, details, created_at
      FROM integration_audit_log
      WHERE organization_id = ?
    `;
    const params: unknown[] = [orgId];

    if (integrationId) {
      query += ' AND integration_id = ?';
      params.push(String(integrationId));
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(parseInt(String(limit), 10) || 50, 200));

    const entries = ((await dbAll(query, params)) || []) as Array<Record<string, unknown>>;
    return res.json({ entries, count: entries.length });
  })
);

// ================================================================
// T008: Guardrails — errors & health
// ================================================================

router.get(
  '/health',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const integrations = await getConnectedIntegrations(orgId);
    const healthChecks = await Promise.all(
      integrations.map((int) => getIntegrationHealth(orgId, int.id))
    );

    const healthy = healthChecks.filter((h) => h.status === 'healthy').length;
    const degraded = healthChecks.filter((h) => h.status === 'degraded').length;
    const unhealthy = healthChecks.filter((h) => h.status === 'unhealthy').length;

    return res.json({
      summary: { total: healthChecks.length, healthy, degraded, unhealthy },
      integrations: healthChecks,
    });
  })
);

router.get(
  '/errors',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { integrationId } = req.query;
    const errors = await getUnresolvedErrors(
      orgId,
      integrationId ? String(integrationId) : undefined
    );
    return res.json({ errors, count: errors.length });
  })
);

router.post(
  '/errors/:errorId/resolve',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    await resolveError(String(req.params.errorId));
    return res.json({ success: true });
  })
);

export default router;
