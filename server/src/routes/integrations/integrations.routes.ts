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
        last_synced_at: null,
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
    res.json([
      { id: 'slack', name: 'Slack', category: 'communication', status: 'available' },
      { id: 'teams', name: 'Microsoft Teams', category: 'communication', status: 'available' },
      { id: 'jira', name: 'Jira', category: 'project_management', status: 'available' },
      { id: 'github', name: 'GitHub', category: 'development', status: 'available' },
      { id: 'google_calendar', name: 'Google Calendar', category: 'calendar', status: 'available' },
      { id: 'outlook', name: 'Outlook Calendar', category: 'calendar', status: 'available' },
      { id: 'stripe', name: 'Stripe', category: 'billing', status: 'available' },
      { id: 'salesforce', name: 'Salesforce', category: 'crm', status: 'coming_soon' },
      { id: 'hubspot', name: 'HubSpot', category: 'crm', status: 'coming_soon' },
    ]);
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
    const id = uuidv4();

    const cols = await getTableColumns('integrations');

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
      if (!providerId) return res.status(400).json({ error: `Unknown provider: ${provider}` });

      const inferredAuthType =
        config && (config.webhookUrl || config.webhook_url || config.incomingWebhookUrl)
          ? 'webhook'
          : providerRow?.auth_type || 'oauth2';

      // Insert required fields. Let timestamps default.
      const runResult = await dbRun(
        `
        INSERT INTO integrations (id, organization_id, provider_id, auth_type, settings, status, connected_by)
        VALUES (?, ?, ?, ?, ?, 'active', ?)
      `,
        [
          id,
          orgId,
          providerId,
          inferredAuthType,
          JSON.stringify(config || {}),
          req.user?.id || 'system',
        ]
      );
      if (!(runResult as any)?.success) {
        return res
          .status(500)
          .json({ error: (runResult as any)?.error || 'Failed to connect integration' });
      }
      logger.info(`[Integrations] Connected ${providerId} for org ${orgId}`);
      return res.status(201).json({ success: true, id });
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
        return res
          .status(500)
          .json({ error: (runResult as any)?.error || 'Failed to connect integration' });
      }
      logger.info(`[Integrations] Connected ${provider} for org ${orgId}`);
      return res.status(201).json({ success: true, id });
    }

    // Minimal schema
    const integrationType = String(provider || type || name || 'integration');
    const runResult = await dbRun(
      `
        INSERT INTO integrations (id, organization_id, type, config, is_active)
        VALUES (?, ?, ?, ?, 1)
      `,
      [id, orgId, integrationType, JSON.stringify(config || {})]
    );
    if (!(runResult as any)?.success) {
      return res
        .status(500)
        .json({ error: (runResult as any)?.error || 'Failed to connect integration' });
    }
    logger.info(`[Integrations] Connected ${integrationType} for org ${orgId}`);
    return res.status(201).json({ success: true, id });
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

router.post(
  '/:id/sync',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Minimal schema doesn't track sync timestamps; keep endpoint for compatibility.
    const { id } = req.params;
    logger.info(`[Integrations] Sync requested for integration ${id} (noop for minimal schema)`);
    res.json({ success: true, message: 'Sync initiated' });
  })
);

export default router;
