/**
 * Integrations Routes
 * API endpoints for third-party integrations management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { requireActiveAuditsMembership } from '../../middleware/auditsStrictMembership.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { CONNECTORS } from '../../services/integrationHubService.js';
import { dispatchProjectCommunicationEvent } from '../../services/integrations/communicationSyncService.js';
import { createIssueFromTask, parseJiraConfig } from '../../services/integrations/jiraOrgClient.js';
import { SlackServiceClass } from '../../services/slackService.js';
import {
  buildGovernedExternalAuthSession,
  getGovernedExternalAuthConfigFields,
} from '../../services/v8/pmSyncExternalAuthMaterializationService.js';
import { listGovernedIntegrations } from '../../services/v8/pmSyncInventoryService.js';
import { setConnectorAuthState } from '../../services/v8/pmSyncTruthService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

const CONNECTOR_ALIAS_MAP: Record<string, string> = {
  microsoft_teams: 'teams',
  google_workspace: 'gmail',
  google: 'gmail',
};

type ConnectorSchemaIntegrationRow = {
  id: string;
  config: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

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

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function extractWebhookUrl(cfg: Record<string, unknown>): string | null {
  const candidates = [
    (cfg as any).webhookUrl,
    (cfg as any).webhook_url,
    (cfg as any).incomingWebhookUrl,
    (cfg as any).incoming_webhook_url,
    (cfg as any)?.webhook?.url,
    (cfg as any)?.incoming_webhook?.url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

type SyncScope = 'read_only' | 'bidirectional';

function resolveSyncScope(
  provider: string | null | undefined,
  cfg?: Record<string, unknown>
): SyncScope {
  const explicit = String((cfg as any)?.syncScope || (cfg as any)?.sync_scope || '')
    .trim()
    .toLowerCase();
  if (explicit === 'bidirectional') return 'bidirectional';
  if (explicit === 'read_only' || explicit === 'readonly') return 'read_only';

  const providerKey = String(provider || '')
    .trim()
    .toLowerCase();
  return ['jira', 'asana', 'monday', 'trello'].includes(providerKey)
    ? 'bidirectional'
    : 'read_only';
}

function syncScopeLabel(scope: SyncScope): string {
  return scope === 'bidirectional' ? 'Bidirectional sync' : 'Read-only sync';
}

async function tryGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set();
  }
}

function normalizeConnectorId(provider: string): string {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  return CONNECTOR_ALIAS_MAP[normalized] || normalized;
}

function getConfiguredFields(configFields: string[], config: Record<string, unknown>): string[] {
  return configFields.filter((field) => {
    const value = config[field];
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  });
}

function getPendingOnboardingStatus(
  authType: string,
  configFields: string[],
  configuredFields: string[]
) {
  const hasAllRequiredFields =
    configFields.length === 0 || configuredFields.length >= configFields.length;

  if (authType === 'oauth2') {
    return hasAllRequiredFields
      ? ('pending_external_auth' as const)
      : ('pending_external_auth_or_configuration' as const);
  }

  return hasAllRequiredFields
    ? ('configuration_submitted_pending_validation' as const)
    : ('pending_configuration' as const);
}

function getConnectorConfigFields(connectorId: string, baseFields: string[]): string[] {
  return getGovernedExternalAuthConfigFields(connectorId, baseFields);
}

async function connectGovernedConnectorIntegration(input: {
  req: Request;
  organizationId: string;
  actorId: string;
  provider: string;
  name?: string;
  config?: Record<string, unknown>;
}): Promise<{
  success: true;
  id: string;
  onboardingStatus:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation';
  authUrl: string | null;
}> {
  const connectorId = normalizeConnectorId(input.provider);
  const connector = CONNECTORS[connectorId];
  if (!connector) {
    throw new Error(`Unknown connector: ${input.provider}`);
  }
  const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);

  const integrationId = uuidv4();
  const integrationName = input.name?.trim() || connector.name;
  const config = input.config || {};
  const configuredFields = getConfiguredFields(connectorConfigFields, config);
  const onboardingStatus = getPendingOnboardingStatus(
    connector.authType,
    connectorConfigFields,
    configuredFields
  );
  const scopes = connector.capabilities.map((capability) => `read:${capability}`);

  // Approved-provider guard MUST run before any write (integration row insert,
  // connector auth-state transition, or audit entry). `buildGovernedExternalAuthSession`
  // calls the registry-approval check (`requireApprovedGovernedConnector`) as its
  // very first step and throws synchronously when the connector is not approved
  // (SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002); by computing the session
  // here — before the INSERT and the auth-state transition below — a denied
  // provider leaves no state behind. `integrationId` is a locally generated UUID,
  // not a database read, so it is safe to use before the row exists.
  let authUrl: string | null = null;
  let governedAuthSession: ReturnType<typeof buildGovernedExternalAuthSession> | null = null;
  const requiresGovernedExternalAuth =
    connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth';

  if (requiresGovernedExternalAuth) {
    governedAuthSession = buildGovernedExternalAuthSession(input.req, {
      integrationId,
      organizationId: input.organizationId,
      connectorId: connector.id,
      mode: 'connect',
      config,
    });
    authUrl = governedAuthSession.authUrl;
  }

  await dbRun(
    `INSERT INTO integrations (
      id, organization_id, connector_id, name, category,
      status, config, capabilities, auth_type, connected_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      integrationId,
      input.organizationId,
      connector.id,
      integrationName,
      connector.category,
      'pending',
      JSON.stringify(config),
      JSON.stringify(scopes),
      connector.authType,
      // Required immutable audit identity (server/migrations/256_integrations_system.sql:
      // connected_by TEXT NOT NULL, no default). Bound only from the verified actor —
      // never from req.body — see the actorId guard at both call sites below.
      input.actorId,
    ]
  );

  if (requiresGovernedExternalAuth) {
    await setConnectorAuthState({
      connectorId: connector.id,
      organizationId: input.organizationId,
      targetState: 'connecting',
      transitionedBy: input.actorId,
      reason: 'canonical_integrations_connect_initiated',
    });
  }

  return {
    success: true,
    id: integrationId,
    onboardingStatus,
    authUrl,
  };
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
      config &&
      ((config as any).webhookUrl ||
        (config as any).webhook_url ||
        (config as any).incomingWebhookUrl)
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
      return {
        success: false,
        error: (runResult as any)?.error || 'Failed to connect integration',
      };
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
      return {
        success: false,
        error: (runResult as any)?.error || 'Failed to connect integration',
      };
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

    const rows = await dbAll<IntegrationProviderRow>(
      `SELECT ${select} FROM integration_providers ${orderBy}`
    );

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

// Send a test message through a connected integration (Slack/Teams webhook-based).
router.post(
  '/test/:provider',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = String(req.params.provider || '')
      .trim()
      .toLowerCase();
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const cols = await tryGetColumns('integrations');

    // Try find integration row (new schema)
    if (cols.has('provider_id') && cols.has('settings')) {
      const row = await dbGet<{
        id: string;
        settings: string | null;
        provider_id: string | null;
        provider_name?: string | null;
        provider_display_name?: string | null;
      }>(
        `
        SELECT i.id, i.settings, i.provider_id, p.name as provider_name, p.display_name as provider_display_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.organization_id = ?
          AND (p.name = ? OR i.provider_id = ?)
          AND (i.status IS NULL OR i.status IN ('active','connected'))
        ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
        LIMIT 1
      `,
        [orgId, provider, provider]
      );

      const cfg = parseJsonObject(row?.settings || null);
      const webhookUrl = extractWebhookUrl(cfg);
      if (!row?.id) return res.status(404).json({ error: 'Integration not connected' });
      if (!webhookUrl)
        return res.status(400).json({ error: 'Missing webhookUrl in integration settings' });

      if (provider === 'slack') {
        const slack = new SlackServiceClass({ webhookUrl });
        await slack.sendSystemAlert(
          'Integrations test',
          'Slack webhook test from Consultify',
          'INFO'
        );
        return res.json({ success: true });
      }

      if (provider === 'microsoft_teams' || provider === 'teams') {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Teams webhook test from Consultify' }),
        });
        return res.json({ success: true });
      }

      return res.status(400).json({ error: 'Test not implemented for this provider' });
    }

    return res.status(400).json({ error: 'Integrations schema not supported for test' });
  })
);

router.post(
  '/communications/dispatch',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const eventType = String(req.body?.eventType || '').trim() as
      | 'decision_required'
      | 'gate_pending'
      | 'task_due'
      | 'risk_alert'
      | 'blocker_detected';
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const deepLink = req.body?.deepLink ? String(req.body.deepLink) : null;

    if (!eventType || !title || !body) {
      return res.status(400).json({ error: 'eventType, title, and body are required' });
    }

    const deliveries = await dispatchProjectCommunicationEvent({
      organizationId: orgId,
      projectId,
      eventType,
      title,
      body,
      deepLink,
      severity: 'normal',
    });

    return res.json({
      success: deliveries.some((item) => item.success),
      deliveries,
    });
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

    if (cols.has('connector_id') && cols.has('config')) {
      const governedIntegrations = await listGovernedIntegrations(orgId);
      const rawRows = await dbAll<ConnectorSchemaIntegrationRow>(
        `SELECT id, config, created_at, updated_at
         FROM integrations
         WHERE organization_id = ?
         ORDER BY created_at DESC`,
        [orgId]
      );
      const rawById = new Map(rawRows.map((row) => [row.id, row]));

      return res.json(
        governedIntegrations.map((integration) => {
          const raw = rawById.get(integration.id);
          const config = parseJsonObject(raw?.config || null);
          const syncScope = resolveSyncScope(integration.connectorId, config);

          return {
            id: integration.id,
            name: integration.name,
            provider: integration.connectorId,
            type: integration.connector?.authType || 'standard',
            status: integration.status,
            config,
            sync_scope: syncScope,
            sync_scope_label: syncScopeLabel(syncScope),
            last_synced_at: integration.lastSyncAt,
            last_error: integration.lastError,
            error_count: integration.unresolvedErrors,
            created_at: raw?.created_at || raw?.updated_at || null,
            onboarding_status: integration.onboardingStatus,
            configured_fields: integration.configuredFields,
            required_fields: integration.connector?.configFields || [],
          };
        })
      );
    }

    // New integrations system schema (FLOW-INTEGRATION-001): provider_id/settings/status/etc.
    if (cols.has('provider_id') && cols.has('settings')) {
      const rows = await dbAll<{
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
      }>(
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

      const integrations = (rows || []).map((r: any) => {
        const settings = parseJsonObject(r.settings || null);
        const syncScope = resolveSyncScope(r.provider_name || r.provider_id, settings);
        return {
          id: r.id,
          name: r.provider_display_name || r.provider_name || r.provider_id,
          provider: r.provider_name || r.provider_id,
          type: r.auth_type || 'standard',
          status: r.status,
          config: settings,
          sync_scope: syncScope,
          sync_scope_label: syncScopeLabel(syncScope),
          last_synced_at: r.last_sync_at || null,
          last_error: r.last_error || null,
          error_count: r.error_count || 0,
          created_at: r.connected_at || r.updated_at || null,
        };
      });

      return res.json(integrations);
    }

    // Legacy schema: name/provider/status/config/last_synced_at
    if (cols.has('provider') && cols.has('status') && cols.has('config')) {
      const rows = await dbAll<any>(
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
    const rows = await dbAll<{
      id: string;
      organization_id: string;
      type: string;
      config: string | null;
      is_active: number;
      created_at: string;
    }>(
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
    const rows = await dbAll<IntegrationProviderRow>(
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
    if (!result.success)
      return res.status(400).json({ error: result.error || 'Failed to connect' });
    logger.info(`[Integrations] Connected ${provider} for org ${orgId}`);
    return res.status(201).json({ success: true, id: result.id });
  })
);

// Canonical connect endpoint (docs/flows): POST /api/integrations/connect/:provider
router.post(
  '/connect/:provider',
  verifyToken,
  // Authoritative ACTIVE same-tenant membership wall (SET-MVP-OAUTH-001 /
  // AMD-SET-OAUTH-APPROVED-OUT-002). No platform-role exemption: an
  // unmembered SUPERADMIN is denied here, not just a wrong-role member.
  requireActiveAuditsMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = String(req.params.provider || '').trim();
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const cols = await tryGetColumns('integrations');
    if (cols.has('connector_id') && cols.has('config')) {
      // connected_by is a required immutable audit identity (NOT NULL, no
      // default — server/migrations/256_integrations_system.sql). It must come
      // only from the verified token, never a synthetic fallback and never
      // req.body. Fail closed rather than writing a placeholder identity.
      const actorId = req.user?.id;
      if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const result = await connectGovernedConnectorIntegration({
          req,
          organizationId: orgId,
          actorId,
          provider,
          name: req.body?.name,
          config: (req.body?.config || {}) as Record<string, unknown>,
        });
        return res.status(201).json(result);
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : 'Failed to connect';
        if (rawMessage.includes('Unknown connector:')) {
          return res.status(404).json({ error: 'Unknown connector' });
        }
        throw error;
      }
    }

    const { config, name, type } = req.body || {};
    const result = await connectIntegrationRow({
      orgId,
      userId: req.user?.id || 'system',
      provider,
      name,
      type,
      config: (config || {}) as Record<string, unknown>,
    });
    if (!result.success)
      return res.status(400).json({ error: result.error || 'Failed to connect' });
    return res.status(201).json({ success: true, id: result.id });
  })
);

// Alias used by some UIs: POST /api/integrations/:provider/connect
router.post(
  '/:provider/connect',
  verifyToken,
  // Authoritative ACTIVE same-tenant membership wall (SET-MVP-OAUTH-001 /
  // AMD-SET-OAUTH-APPROVED-OUT-002). No platform-role exemption: an
  // unmembered SUPERADMIN is denied here, not just a wrong-role member.
  requireActiveAuditsMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const provider = String(req.params.provider || '').trim();
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const cols = await tryGetColumns('integrations');
    if (cols.has('connector_id') && cols.has('config')) {
      // connected_by is a required immutable audit identity (NOT NULL, no
      // default — server/migrations/256_integrations_system.sql). It must come
      // only from the verified token, never a synthetic fallback and never
      // req.body. Fail closed rather than writing a placeholder identity.
      const actorId = req.user?.id;
      if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const result = await connectGovernedConnectorIntegration({
          req,
          organizationId: orgId,
          actorId,
          provider,
          name: req.body?.name,
          config: (req.body?.config || {}) as Record<string, unknown>,
        });
        return res.status(201).json(result);
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : 'Failed to connect';
        if (rawMessage.includes('Unknown connector:')) {
          return res.status(404).json({ error: 'Unknown connector' });
        }
        throw error;
      }
    }

    const { config, name, type } = req.body || {};
    const result = await connectIntegrationRow({
      orgId,
      userId: req.user?.id || 'system',
      provider,
      name,
      type,
      config: (config || {}) as Record<string, unknown>,
    });
    if (!result.success)
      return res.status(400).json({ error: result.error || 'Failed to connect' });
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
      await dbRun(
        `UPDATE integrations SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [enabled ? 'active' : 'paused', now, id, orgId]
      );
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

    const settings = (req.body?.settings || req.body?.config || req.body || {}) as Record<
      string,
      unknown
    >;
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
    const rows = await dbAll<any>(
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
            syncScope:
              String(r.direction || '').toLowerCase() === 'bidirectional'
                ? 'bidirectional'
                : 'read_only',
            syncScopeLabel:
              String(r.direction || '').toLowerCase() === 'bidirectional'
                ? 'Bidirectional sync'
                : 'Read-only sync',
            triggerType: r.trigger_type,
            itemsProcessed: r.items_processed ?? 0,
            itemsCreated: r.items_created ?? 0,
            itemsUpdated: r.items_updated ?? 0,
            itemsFailed: r.items_failed ?? 0,
            errorSummary: r.error_summary ?? null,
            errorDetails: r.error_details
              ? (() => {
                  try {
                    return JSON.parse(r.error_details);
                  } catch {
                    return r.error_details;
                  }
                })()
              : null,
            startedAt: r.started_at,
            completedAt: r.completed_at,
            durationMs: r.duration_ms ?? 0,
          }
        : {
            id: r.id,
            status: r.status,
            syncType: r.sync_type,
            direction: r.direction,
            syncScope:
              String(r.direction || '').toLowerCase() === 'bidirectional'
                ? 'bidirectional'
                : 'read_only',
            syncScopeLabel:
              String(r.direction || '').toLowerCase() === 'bidirectional'
                ? 'Bidirectional sync'
                : 'Read-only sync',
            itemsProcessed: r.items_synced ?? 0,
            itemsFailed: r.items_failed ?? 0,
            errorDetails: r.error_details
              ? (() => {
                  try {
                    return JSON.parse(r.error_details);
                  } catch {
                    return r.error_details;
                  }
                })()
              : null,
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

    // Determine provider + settings (new schema only for now).
    let providerName: string | null = null;
    let settingsRaw: string | null = null;
    try {
      const row = await dbGet<{
        provider_id?: string | null;
        settings?: string | null;
        provider_name?: string | null;
      }>(
        `
        SELECT i.provider_id, i.settings, p.name as provider_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.id = ? AND i.organization_id = ?
        LIMIT 1
      `,
        [id, orgId]
      );
      providerName = String(row?.provider_name || row?.provider_id || '').trim() || null;
      settingsRaw = row?.settings || null;
    } catch {
      // ignore
    }

    const settings = parseJsonObject(settingsRaw);
    const scope = resolveSyncScope(providerName, settings);
    let status: 'success' | 'partial' | 'failed' = 'success';
    let itemsProcessed = 0;
    let itemsCreated = 0;
    const itemsUpdated = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    // Provider-specific sync (M03: Jira push)
    if (providerName === 'jira') {
      const cfg = parseJiraConfig(settings);
      if (!cfg) {
        status = 'failed';
        errors.push('Missing Jira config fields (baseUrl/email/apiToken/projectKey)');
      } else {
        // Push tasks without mapping -> create Jira issues + write mappings.
        const mapCols = await tryGetColumns('integration_sync_mappings');
        if (!mapCols.size) {
          status = 'failed';
          errors.push('integration_sync_mappings table missing');
        } else {
          const tasks = await dbAll<{
            id: string;
            title: string;
            description: string | null;
            status: string | null;
          }>(
            `SELECT id, title, description, status FROM tasks WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200`,
            [orgId]
          );
          for (const t of tasks || []) {
            itemsProcessed++;
            try {
              const existing = await dbGet<{ id: string }>(
                `SELECT id FROM integration_sync_mappings WHERE integration_id = ? AND local_type = 'task' AND local_id = ? LIMIT 1`,
                [id, t.id]
              );
              if (existing?.id) continue;

              const created = await createIssueFromTask({
                config: cfg,
                task: { id: t.id, title: t.title, description: t.description, status: t.status },
                deepLinkUrl: null,
              });

              const mappingId = `sync-${uuidv4()}`;
              const now = new Date().toISOString();
              await dbRun(
                `INSERT INTO integration_sync_mappings (
                   id, integration_id,
                   local_type, local_id,
                   external_type, external_id, external_url,
                   sync_status, created_at, updated_at, metadata
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)`,
                [
                  mappingId,
                  id,
                  'task',
                  t.id,
                  'issue',
                  created.id,
                  created.browseUrl,
                  now,
                  now,
                  JSON.stringify({ key: created.key }),
                ]
              );
              itemsCreated++;
            } catch (e: any) {
              itemsFailed++;
              status = status === 'success' ? 'partial' : status;
              errors.push(e?.message || 'Failed to sync task to Jira');
            }
          }
        }
      }
    }

    // Record sync run entry (real log with counts).
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
            scope === 'bidirectional' ? 'bidirectional' : 'read_only',
            'manual',
            status,
            itemsProcessed,
            itemsCreated,
            itemsUpdated,
            itemsFailed,
            errors.length ? 'sync_errors' : null,
            errors.length ? JSON.stringify(errors.slice(0, 50)) : null,
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
          [
            logId,
            id,
            'single_item',
            scope === 'bidirectional' ? 'bidirectional' : 'read_only',
            status,
            itemsProcessed,
            itemsFailed,
            errors.length ? JSON.stringify(errors.slice(0, 50)) : null,
            startedIso,
            completedIso,
            durationMs,
          ]
        );
      }
    }

    // Update last_sync_at when supported.
    if (intCols.has('last_sync_at')) {
      await dbRun(
        `UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [startedIso, startedIso, id, orgId]
      );
    } else if (intCols.has('last_synced_at')) {
      await dbRun(
        `UPDATE integrations SET last_synced_at = ? WHERE id = ? AND organization_id = ?`,
        [startedIso, id, orgId]
      );
    }

    logger.info(`[Integrations] Sync requested for integration ${id} (logged)`, {
      providerName,
      status,
      itemsProcessed,
      itemsCreated,
      itemsFailed,
    });
    return res.json({
      success: status !== 'failed',
      status,
      syncScope: scope,
      syncScopeLabel: syncScopeLabel(scope),
      message: status === 'failed' ? 'Sync failed' : 'Sync completed',
      counts: { itemsProcessed, itemsCreated, itemsUpdated, itemsFailed },
      errors: errors.slice(0, 5),
    });
  })
);

export default router;
