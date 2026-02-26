/**
 * Integrations Routes
 * API endpoints for third-party integrations management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

type IntegrationProviderRow = {
  id: string;
  name: string;
  display_name?: string | null;
  category?: string | null;
  description?: string | null;
  auth_type?: string | null;
  is_active?: number | boolean | null;
  is_beta?: number | boolean | null;
  is_enterprise_only?: number | boolean | null;
  documentation_url?: string | null;
  setup_guide_url?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

function boolish(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return fallback;
}

async function tryGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set();
  }
}

async function connectIntegrationRow(input: {
  orgId: string;
  userId: string;
  provider: string;
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { orgId, userId, provider, name, type, config } = input;
  const id = uuidv4();
  const cols = await tryGetColumns('integrations');

  // New integrations system schema
  if (cols.has('provider_id') && cols.has('settings') && cols.has('auth_type')) {
    const providerKey = String(provider || '')
      .trim()
      .toLowerCase();
    const providerRow = await dbGet<{ id: string; auth_type?: string }>(
      `SELECT id, auth_type FROM integration_providers WHERE name = ? LIMIT 1`,
      [providerKey]
    );
    const providerId = providerRow?.id || (providerKey.startsWith('int-') ? providerKey : null);
    if (!providerId) return { success: false, error: `Unknown provider: ${provider}` };

    const inferredAuthType =
      config && ((config as any).webhookUrl || (config as any).webhook_url || (config as any).incomingWebhookUrl)
        ? 'webhook'
        : providerRow?.auth_type || 'oauth2';

    const runResult = await dbRun(
      `
      INSERT INTO integrations (id, organization_id, provider_id, auth_type, settings, status, connected_by)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `,
      [id, orgId, providerId, inferredAuthType, JSON.stringify(config || {}), userId || 'system']
    );
    if (!(runResult as any)?.success) {
      return { success: false, error: (runResult as any)?.error || 'Failed to connect integration' };
    }
    return { success: true, id };
  }

  // Legacy schema
  if (cols.has('provider') && cols.has('status') && cols.has('config')) {
    const runResult = await dbRun(
      `
      INSERT INTO integrations (id, organization_id, name, provider, type, status, config)
      VALUES (?, ?, ?, ?, ?, 'connected', ?)
    `,
      [id, orgId, name || provider, provider, type || 'standard', JSON.stringify(config || {})]
    );
    if (!(runResult as any)?.success) {
      return { success: false, error: (runResult as any)?.error || 'Failed to connect integration' };
    }
    return { success: true, id };
  }

  // Minimal schema (SQLite)
  const integrationType = String(provider || type || name || 'integration');
  const runResult = await dbRun(
    `
      INSERT INTO integrations (id, organization_id, type, config, is_active)
      VALUES (?, ?, ?, ?, 1)
    `,
    [id, orgId, integrationType, JSON.stringify(config || {})]
  );
  if (!(runResult as any)?.success) {
    return { success: false, error: (runResult as any)?.error || 'Failed to connect integration' };
  }
  return { success: true, id };
}

router.get(
  '/providers',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const cols = await tryGetColumns('integration_providers');
    if (!cols.size) return res.json({ providers: [] });

    const select = [
      'id',
      'name',
      cols.has('display_name') ? 'display_name' : null,
      cols.has('category') ? 'category' : null,
      cols.has('description') ? 'description' : null,
      cols.has('auth_type') ? 'auth_type' : null,
      cols.has('is_active') ? 'is_active' : null,
      cols.has('is_beta') ? 'is_beta' : null,
      cols.has('is_enterprise_only') ? 'is_enterprise_only' : null,
      cols.has('documentation_url') ? 'documentation_url' : null,
      cols.has('setup_guide_url') ? 'setup_guide_url' : null,
      cols.has('sort_order') ? 'sort_order' : null,
      cols.has('created_at') ? 'created_at' : null,
    ]
      .filter(Boolean)
      .join(', ');

    const orderBy = cols.has('sort_order')
      ? 'ORDER BY sort_order ASC, display_name ASC'
      : cols.has('display_name')
        ? 'ORDER BY display_name ASC'
        : 'ORDER BY name ASC';

    const rows = await dbAll<IntegrationProviderRow[]>(`SELECT ${select} FROM integration_providers ${orderBy}`);

    const providers = (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name || r.name,
      category: r.category || 'other',
      description: r.description || null,
      authType: r.auth_type || 'oauth2',
      isActive: boolish(r.is_active, true),
      isBeta: boolish(r.is_beta, false),
      isEnterpriseOnly: boolish(r.is_enterprise_only, false),
      documentationUrl: r.documentation_url || null,
      setupGuideUrl: r.setup_guide_url || null,
      sortOrder: r.sort_order ?? 0,
      createdAt: r.created_at || null,
    }));

    return res.json({ providers });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.json([]);

    const cols = await getTableColumns('integrations');

    // New integrations system schema (FLOW-INTEGRATION-001): provider_id/settings/status/etc.
    if (cols.has('provider_id') && cols.has('settings')) {
      const rows = await dbAll<
        {
          id: string;
          provider_id: string;
          auth_type: string;
          status: string;
          settings: string | null;
          notification_settings: string | null;
          last_sync_at?: string | null;
          last_error?: string | null;
          error_count?: number | null;
          connected_at: string | null;
          updated_at: string | null;
          provider_name?: string | null;
          provider_display_name?: string | null;
        }[]
      >(
        `
        SELECT
          i.id,
          i.provider_id,
          i.auth_type,
          i.status,
          i.settings,
          i.notification_settings,
          i.last_sync_at,
          i.last_error,
          i.error_count,
          i.connected_at,
          i.updated_at,
          p.name as provider_name,
          p.display_name as provider_display_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.organization_id = ?
        ORDER BY i.connected_at DESC
      `,
        [orgId]
      );

      const integrations = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.provider_display_name || r.provider_name || r.provider_id,
        provider: r.provider_name || r.provider_id,
        type: r.auth_type || 'standard',
        status: r.status,
        config: r.settings,
        last_synced_at: r.last_sync_at || null,
        last_error: r.last_error || null,
        error_count: r.error_count || 0,
        created_at: r.connected_at || r.updated_at || null,
      }));

      return res.json(integrations);
    }

    // Legacy schema: name/provider/status/config/last_synced_at
    if (cols.has('provider') && cols.has('status') && cols.has('config')) {
      const rows = await dbAll<any[]>(
        `
        SELECT id, name, provider, type, status, config, last_synced_at, created_at
        FROM integrations
        WHERE organization_id = ?
        ORDER BY created_at DESC
      `,
        [orgId]
      );
      return res.json(rows || []);
    }

    // Minimal schema (SQLite): (id, organization_id, type, config, is_active, created_at)
    const rows = await dbAll<
      {
        id: string;
        organization_id: string;
        type: string;
        config: string | null;
        is_active: number;
        created_at: string;
      }[]
    >(
      `
        SELECT id, organization_id, type, config, is_active, created_at
        FROM integrations
        WHERE organization_id = ?
        ORDER BY created_at DESC
      `,
      [orgId]
    );

    const integrations = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.type,
      provider: r.type,
      type: r.type,
      status: r.is_active ? 'connected' : 'disabled',
      config: r.config,
      last_synced_at: null,
      created_at: r.created_at,
    }));

    return res.json(integrations);
  })
);

router.get(
  '/available',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Legacy helper endpoint used by some UIs.
    // Prefer `/providers` which returns the canonical DB-backed providers list.
    const cols = await tryGetColumns('integration_providers');
    if (!cols.size) return res.json([]);
    const rows = await dbAll<IntegrationProviderRow[]>(
      `SELECT id, name, display_name, category, is_active FROM integration_providers ORDER BY sort_order, display_name`
    );
    return res.json(
      (rows || []).map((r) => ({
        id: r.name,
        name: r.display_name || r.name,
        category: r.category || 'other',
        status: boolish(r.is_active, true) ? 'available' : 'disabled',
      }))
    );
  })
);

router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { name, provider, type, config } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await connectIntegrationRow({
      orgId,
      userId: req.user?.id || 'system',
      provider,
      name,
      type,
      config,
    });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to connect' });
    logger.info(`[Integrations] Connected ${provider} for org ${orgId}`);
    return res.status(201).json({ success: true, id: result.id });
  })
);

// Canonical connect endpoint (docs/flows): POST /api/integrations/connect/:provider
router.post(
  '/connect/:provider',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = String(req.params.provider || '').trim();
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const { config, name, type } = req.body || {};
    const result = await connectIntegrationRow({
      orgId,
      userId: req.user?.id || 'system',
      provider,
      name,
      type,
      config: (config || {}) as Record<string, unknown>,
    });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to connect' });
    return res.status(201).json({ success: true, id: result.id });
  })
);

// Alias used by some UIs: POST /api/integrations/:provider/connect
router.post(
  '/:provider/connect',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = String(req.params.provider || '').trim();
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const { config, name, type } = req.body || {};
    const result = await connectIntegrationRow({
      orgId,
      userId: req.user?.id || 'system',
      provider,
      name,
      type,
      config: (config || {}) as Record<string, unknown>,
    });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to connect' });
    return res.status(201).json({ success: true, id: result.id });
  })
);

router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    await dbRun('DELETE FROM integrations WHERE id = ? AND organization_id = ?', [id, orgId]);
    res.json({ success: true });
  })
);

// Canonical disconnect endpoint (non-destructive when supported): POST /api/integrations/:id/disconnect
router.post(
  '/:id/disconnect',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const cols = await tryGetColumns('integrations');
    const now = new Date().toISOString();

    if (cols.has('status')) {
      await dbRun(
        `UPDATE integrations SET status = 'disconnected', disconnected_at = ?, disconnected_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [now, req.user?.id || 'system', now, id, orgId]
      );
      return res.json({ success: true });
    }

    if (cols.has('is_active')) {
      await dbRun(`UPDATE integrations SET is_active = 0 WHERE id = ? AND organization_id = ?`, [
        id,
        orgId,
      ]);
      return res.json({ success: true });
    }

    await dbRun('DELETE FROM integrations WHERE id = ? AND organization_id = ?', [id, orgId]);
    return res.json({ success: true });
  })
);

// Toggle enabled/paused (used by health dashboard UIs)
router.put(
  '/:id/toggle',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const enabled = !!req.body?.enabled;
    const cols = await tryGetColumns('integrations');
    const now = new Date().toISOString();

    if (cols.has('status')) {
      await dbRun(`UPDATE integrations SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`, [
        enabled ? 'active' : 'paused',
        now,
        id,
        orgId,
      ]);
      return res.json({ success: true });
    }

    if (cols.has('is_active')) {
      await dbRun(`UPDATE integrations SET is_active = ? WHERE id = ? AND organization_id = ?`, [
        enabled ? 1 : 0,
        id,
        orgId,
      ]);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Toggle not supported in current schema' });
  })
);

// Update integration settings/config (for channel mappings, webhook URLs, etc.)
router.put(
  '/:id/settings',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = (req.body?.settings || req.body?.config || req.body || {}) as Record<string, unknown>;
    const cols = await tryGetColumns('integrations');
    const now = new Date().toISOString();

    if (cols.has('settings')) {
      await dbRun(
        `UPDATE integrations SET settings = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [JSON.stringify(settings), now, id, orgId]
      );
      return res.json({ success: true });
    }

    if (cols.has('config')) {
      await dbRun(
        `UPDATE integrations SET config = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [JSON.stringify(settings), now, id, orgId]
      );
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Settings update not supported in current schema' });
  })
);

// Sync logs: GET /api/integrations/:id/logs
router.get(
  '/:id/logs',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const cols = await tryGetColumns('integration_sync_log');
    if (!cols.size) return res.json({ logs: [] });

    const hasNewCols = cols.has('items_processed') || cols.has('trigger_type');
    const rows = await dbAll<any[]>(
      hasNewCols
        ? `SELECT id, status, sync_type, direction, trigger_type, items_processed, items_created, items_updated, items_failed, error_summary, error_details, started_at, completed_at, duration_ms
           FROM integration_sync_log WHERE integration_id = ? ORDER BY started_at DESC LIMIT 50`
        : `SELECT id, status, sync_type, direction, items_synced, items_failed, error_details, started_at, completed_at, duration_ms
           FROM integration_sync_log WHERE integration_id = ? ORDER BY started_at DESC LIMIT 50`,
      [id]
    );

    const logs = (rows || []).map((r) =>
      hasNewCols
        ? {
            id: r.id,
            status: r.status,
            syncType: r.sync_type,
            direction: r.direction,
            triggerType: r.trigger_type,
            itemsProcessed: r.items_processed ?? 0,
            itemsCreated: r.items_created ?? 0,
            itemsUpdated: r.items_updated ?? 0,
            itemsFailed: r.items_failed ?? 0,
            errorSummary: r.error_summary ?? null,
            errorDetails: r.error_details ? (() => {
              try {
                return JSON.parse(r.error_details);
              } catch {
                return r.error_details;
              }
            })() : null,
            startedAt: r.started_at,
            completedAt: r.completed_at,
            durationMs: r.duration_ms ?? 0,
          }
        : {
            id: r.id,
            status: r.status,
            syncType: r.sync_type,
            direction: r.direction,
            itemsProcessed: r.items_synced ?? 0,
            itemsFailed: r.items_failed ?? 0,
            errorDetails: r.error_details ? (() => {
              try {
                return JSON.parse(r.error_details);
              } catch {
                return r.error_details;
              }
            })() : null,
            startedAt: r.started_at,
            completedAt: r.completed_at,
            durationMs: r.duration_ms ?? 0,
          }
    );

    return res.json({ logs });
  })
);

router.post(
  '/:id/sync',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const startedAt = new Date();
    const startedIso = startedAt.toISOString();

    const logCols = await tryGetColumns('integration_sync_log');
    const intCols = await tryGetColumns('integrations');

    // Record a minimal sync run entry (foundation task: real logs, even if connector is stubbed).
    if (logCols.size) {
      const logId = `log-${uuidv4()}`;
      const completedIso = new Date().toISOString();
      const durationMs = Math.max(0, Date.now() - startedAt.getTime());

      if (logCols.has('items_processed')) {
        await dbRun(
          `INSERT INTO integration_sync_log (
             id, integration_id, sync_type, direction, trigger_type,
             status, items_processed, items_created, items_updated, items_failed,
             error_summary, error_details, started_at, completed_at, duration_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            id,
            'single_item',
            'bidirectional',
            'manual',
            'success',
            0,
            0,
            0,
            0,
            null,
            null,
            startedIso,
            completedIso,
            durationMs,
          ]
        );
      } else {
        await dbRun(
          `INSERT INTO integration_sync_log (
             id, integration_id, sync_type, direction,
             status, items_synced, items_failed, error_details,
             started_at, completed_at, duration_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [logId, id, 'single_item', 'bidirectional', 'success', 0, 0, null, startedIso, completedIso, durationMs]
        );
      }
    }

    // Update last_sync_at when supported.
    if (intCols.has('last_sync_at')) {
      await dbRun(`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`, [
        startedIso,
        startedIso,
        id,
        orgId,
      ]);
    } else if (intCols.has('last_synced_at')) {
      await dbRun(`UPDATE integrations SET last_synced_at = ? WHERE id = ? AND organization_id = ?`, [
        startedIso,
        id,
        orgId,
      ]);
    }

    logger.info(`[Integrations] Sync requested for integration ${id} (logged)`);
    return res.json({ success: true, message: 'Sync initiated' });
  })
);

export default router;
