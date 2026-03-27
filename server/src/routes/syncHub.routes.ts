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
import {
  connectIntegration,
  CONNECTORS,
  disconnectIntegration,
  getConnectedIntegrations,
  getSyncHistory,
  syncIntegration,
  updateIntegrationStatus,
} from '../services/integrationHubService.js';
import {
  checkRateLimit,
  getIntegrationHealth,
  getUnresolvedErrors,
  logSyncError,
  recordRequest,
  resolveError,
} from '../services/syncGuardrailsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

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

    // Add availability status and "coming soon" flag
    const catalog = connectors.map((c) => {
      const isV2Ready = ['slack', 'jira', 'gmail', 'asana', 'teams'].includes(c.id);
      return {
        ...c,
        isAvailable: true,
        isV2Ready,
        comingSoon: !isV2Ready,
      };
    });

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

    const result = await connectIntegration(orgId, connectorId, config);

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

    await updateIntegrationStatus(result.id, 'connected');

    const actorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || userId;
    await logAudit(orgId, result.id, 'connected', userId, actorName, { connectorId, displayName });

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
    await disconnectIntegration(intId);

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

    return res.json({ success: true, message: 'Re-authorization initiated' });
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

      return res.status(500).json({ error: errorMsg, syncRunId: runId });
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
