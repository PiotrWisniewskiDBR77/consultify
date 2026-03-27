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
  getCredential,
  getCredentialHealth,
  getRefreshTimingPolicy,
  recordAuthEscalation,
  recordRefreshResult,
  resolveAuthEscalation,
  setRefreshTimingPolicy,
  storeCredential,
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
import { issueSyncExternalAuthSession } from '../../services/syncExternalAuthSessionService.js';
import {
  checkRateLimit,
  getIntegrationHealth,
  getUnresolvedErrors,
  logSyncError,
  recordRequest,
  resolveError,
} from '../../services/syncGuardrailsService.js';
import { ConflictResolutionPathValues, ConnectorAuthStateValues } from '../../types/pmSyncTruth.js';
import { LastRefreshResultValues, ProviderFamilyValues } from '../../types/pmSyncAuthBaseline.js';
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

function buildExternalAuthCallbackUrl(req: AuthRequest, state: string): string {
  return `${req.protocol}://${req.get('host')}/api/sync-hub/external-auth/callback?state=${encodeURIComponent(state)}`;
}

const CONNECTOR_PROVIDER_FAMILY_MAP: Partial<
  Record<string, (typeof ProviderFamilyValues)[number]>
> = {
  jira: 'atlassian',
  gmail: 'google_workspace',
  slack: 'google_workspace',
  teams: 'microsoft_365',
  dynamics_365: 'microsoft_365',
  powerbi: 'microsoft_365',
  azure_devops: 'microsoft_365',
  asana: 'asana',
  monday: 'monday',
};

const DEFAULT_REFRESH_WINDOW_MINUTES: Partial<Record<(typeof ProviderFamilyValues)[number], number>> = {
  google_workspace: 10,
  microsoft_365: 10,
  atlassian: 15,
  asana: 15,
  monday: 15,
  clickup: 15,
  linear: 15,
};

function getProviderFamilyForConnector(connectorId: string): (typeof ProviderFamilyValues)[number] | null {
  return CONNECTOR_PROVIDER_FAMILY_MAP[connectorId.trim().toLowerCase()] ?? null;
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

const InitiateConnectorConnectionBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  displayName: z.string().trim().min(1).optional(),
});

const ConfigurePendingIntegrationBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).default({}),
});

const StoreIntegrationCredentialBodySchema = z.object({
  providerAccountId: z.string().trim().min(1),
  workspaceOrTenantId: z.string().trim().min(1),
  scopesGranted: z.array(z.string().trim().min(1)).min(1),
  tokenExpiresAt: z.string().trim().min(1).nullable().optional(),
});

const RecordIntegrationRefreshResultBodySchema = z.object({
  result: z.enum(LastRefreshResultValues),
});

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getConfiguredFields(
  configFields: string[],
  config: Record<string, unknown>,
): string[] {
  return configFields.filter((field) => {
    const value = config[field];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

function getPendingOnboardingStatus(
  authType: string,
  configFields: string[],
  configuredFields: string[],
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
        configFields: c.configFields,
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
  '/connectors/:connectorId/connect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const connectorId =
      typeof req.params.connectorId === 'string' ? req.params.connectorId.trim().toLowerCase() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';

    if (!connectorId) {
      return res.status(400).json({ error: 'connectorId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const parsedBody = InitiateConnectorConnectionBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid connection payload',
        code: 'INVALID_BODY',
      });
    }

    const connector = CONNECTORS[connectorId];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }

    const integrationId = `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const integrationName = parsedBody.data.displayName?.trim() || connector.name;
    const scopes = connector.capabilities.map((capability) => `read:${capability}`);

    await dbRun(
      `INSERT INTO integrations (
         id, organization_id, connector_id, name, category,
         status, config, capabilities, auth_type, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        integrationId,
        organizationId,
        connector.id,
        integrationName,
        connector.category,
        'pending',
        JSON.stringify(parsedBody.data.config ?? {}),
        JSON.stringify(scopes),
        connector.authType,
      ],
    );

    await logIntegrationAudit(organizationId, integrationId, 'connect_initiated', actorId, actorId, {
      connectorId: connector.id,
      authType: connector.authType,
    });

    return res.status(201).json({
      data: {
        integration: {
          id: integrationId,
          connectorId: connector.id,
          name: integrationName,
          category: connector.category,
          status: 'pending' as const,
          capabilities: connector.capabilities,
          authType: connector.authType,
          configFields: connector.configFields,
          scopes,
        },
        onboardingStatus: 'pending_external_auth_or_configuration' as const,
      },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/configure',
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

    const parsedBody = ConfigurePendingIntegrationBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid configuration payload',
        code: 'INVALID_BODY',
      });
    }

    const rows = await dbAll<{
      id: string;
      connector_id: string;
      config: string | null;
      status: string;
    }>(
      `SELECT id, connector_id, config, status
       FROM integrations
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [integrationId, organizationId],
    );
    const integration = rows[0];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }

    const currentConfig = safeJsonParse<Record<string, unknown>>(integration.config, {});
    const nextConfig = { ...currentConfig };
    for (const field of connector.configFields) {
      if (Object.prototype.hasOwnProperty.call(parsedBody.data.config, field)) {
        nextConfig[field] = parsedBody.data.config[field];
      }
    }

    const configuredFields = getConfiguredFields(connector.configFields, nextConfig);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connector.configFields,
      configuredFields,
    );

    await dbRun(
      `UPDATE integrations
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(nextConfig), integrationId, organizationId],
    );
    await logIntegrationAudit(organizationId, integrationId, 'configuration_updated', actorId, actorId, {
      connectorId: connector.id,
      configuredFields,
      status: integration.status,
    });

    let externalAuth:
      | {
          callbackUrl: string;
          state: string;
          expiresAt: string;
        }
      | undefined;

    if (connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth') {
      await setConnectorAuthState({
        connectorId: connector.id,
        organizationId,
        targetState: 'connecting',
        transitionedBy: actorId,
        reason: 'external_auth_prepared',
      });
      const session = issueSyncExternalAuthSession({
        integrationId,
        organizationId,
        connectorId: connector.id,
        mode: 'connect',
      });
      externalAuth = {
        callbackUrl: buildExternalAuthCallbackUrl(req, session.state),
        state: session.state,
        expiresAt: new Date(session.expiresAt).toISOString(),
      };
    }

    return res.json({
      data: {
        integration: {
          id: integrationId,
          connectorId: connector.id,
          status: integration.status,
          configuredFields,
          onboardingStatus,
        },
        externalAuth,
      },
      meta: syncMutationMeta(),
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

    const integrationRows = await dbAll<{ connector_id: string; config: string | null }>(
      `SELECT connector_id, config
       FROM integrations
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [integrationId, organizationId],
    );
    const integration = integrationRows[0];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }

    const config = safeJsonParse<Record<string, unknown>>(integration.config, {});
    const configuredFields = getConfiguredFields(connector.configFields, config);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connector.configFields,
      configuredFields,
    );

    await updateIntegrationStatus(integrationId, 'pending');
    await setConnectorAuthState({
      connectorId: connector.id,
      organizationId,
      targetState: 'connecting',
      transitionedBy: actorId,
      reason: 'reauth_started',
    });

    await logIntegrationAudit(organizationId, integrationId, 'reauth_started', actorId, actorId, {
      connectorId: connector.id,
      onboardingStatus,
    });

    const session = issueSyncExternalAuthSession({
      integrationId,
      organizationId,
      connectorId: connector.id,
      mode: 'reauth',
    });

    return res.json({
      data: {
        success: true as const,
        message: 'Re-authorization initiated',
        onboardingStatus,
        externalAuth: {
          callbackUrl: buildExternalAuthCallbackUrl(req, session.state),
          state: session.state,
          expiresAt: new Date(session.expiresAt).toISOString(),
        },
      },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/credential',
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

    const parsedBody = StoreIntegrationCredentialBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid credential payload',
        code: 'INVALID_BODY',
      });
    }

    const rows = await dbAll<{
      id: string;
      connector_id: string;
      status: string;
    }>(
      `SELECT id, connector_id, status
       FROM integrations
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [integrationId, organizationId],
    );
    const integration = rows[0];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }
    if (connector.authType !== 'oauth2') {
      return res.status(409).json({
        error: 'Credential materialization is only supported for governed oauth2 connectors',
        code: 'CREDENTIAL_UNSUPPORTED',
      });
    }

    const credential = await storeCredential({
      connectorId: connector.id,
      organizationId,
      providerAccountId: parsedBody.data.providerAccountId,
      workspaceOrTenantId: parsedBody.data.workspaceOrTenantId,
      scopesGranted: parsedBody.data.scopesGranted,
      tokenExpiresAt: parsedBody.data.tokenExpiresAt ?? null,
    });

    await logIntegrationAudit(organizationId, integrationId, 'credential_materialized', actorId, actorId, {
      connectorId: connector.id,
      providerAccountId: credential.providerAccountId,
      workspaceOrTenantId: credential.workspaceOrTenantId,
      scopesGranted: credential.scopesGranted,
    });

    const refreshedCredential = await getCredential(connector.id, organizationId);

    return res.json({
      data: {
        credential: refreshedCredential ?? credential,
      },
      meta: syncMutationMeta(),
    });
  }),
);

router.post(
  '/integrations/:integrationId/refresh-result',
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

    const parsedBody = RecordIntegrationRefreshResultBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid refresh result payload',
        code: 'INVALID_BODY',
      });
    }

    const rows = await dbAll<{
      id: string;
      connector_id: string;
      status: string;
    }>(
      `SELECT id, connector_id, status
       FROM integrations
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [integrationId, organizationId],
    );
    const integration = rows[0];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }
    if (connector.authType !== 'oauth2') {
      return res.status(409).json({
        error: 'Refresh-result continuity is only supported for governed oauth2 connectors',
        code: 'REFRESH_RESULT_UNSUPPORTED',
      });
    }

    const credential = await recordRefreshResult({
      connectorId: connector.id,
      organizationId,
      result: parsedBody.data.result,
    });

    const connectorHealth = await getConnectorHealth(connector.id, organizationId);
    let authTransition:
      | {
          targetState: 'healthy' | 'degraded_reauth_needed';
          reason: string;
        }
      | null = null;

    if (parsedBody.data.result === 'success' && connectorHealth.authState !== 'healthy') {
      authTransition = {
        targetState: 'healthy',
        reason: 'refresh_succeeded',
      };
    } else if (
      ['credential_expired', 'scope_revoked'].includes(parsedBody.data.result) &&
      connectorHealth.authState !== 'degraded_reauth_needed'
    ) {
      authTransition = {
        targetState: 'degraded_reauth_needed',
        reason: 'refresh_auth_break',
      };
    }

    if (authTransition) {
      await setConnectorAuthState({
        connectorId: connector.id,
        organizationId,
        targetState: authTransition.targetState,
        transitionedBy: actorId,
        reason: authTransition.reason,
      });
    }

    let escalationId: string | null = null;
    if (['credential_expired', 'scope_revoked'].includes(parsedBody.data.result)) {
      const escalation = await recordAuthEscalation(connector.id, organizationId, parsedBody.data.result);
      escalationId = escalation.escalationId;
    }

    await logIntegrationAudit(organizationId, integrationId, 'refresh_result_recorded', actorId, actorId, {
      connectorId: connector.id,
      result: parsedBody.data.result,
      authTransition: authTransition?.targetState ?? null,
      escalationId,
    });

    return res.json({
      data: {
        credential,
        authTransition: authTransition?.targetState ?? null,
      },
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

    const connector = CONNECTORS[integration[0].connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }

    if (connector.authType === 'oauth2') {
      const credential = await getCredential(connector.id, organizationId);
      const tokenExpiresAtMs = credential?.tokenExpiresAt ? Date.parse(credential.tokenExpiresAt) : NaN;

      if (Number.isFinite(tokenExpiresAtMs)) {
        const now = Date.now();

        if (tokenExpiresAtMs <= now) {
          const refreshedCredential = await recordRefreshResult({
            connectorId: connector.id,
            organizationId,
            result: 'credential_expired',
          });
          const escalation = await recordAuthEscalation(
            connector.id,
            organizationId,
            'credential_expired',
          );
          const connectorHealth = await getConnectorHealth(connector.id, organizationId);

          if (connectorHealth.authState !== 'degraded_reauth_needed') {
            await setConnectorAuthState({
              connectorId: connector.id,
              organizationId,
              targetState: 'degraded_reauth_needed',
              transitionedBy: actorId,
              reason: 'sync_preflight_credential_expired',
            });
          }

          await logIntegrationAudit(
            organizationId,
            integrationId,
            'sync_preflight_blocked_credential_expired',
            actorId,
            actorId,
            {
              connectorId: connector.id,
              credentialId: refreshedCredential.credentialId,
              escalationId: escalation.escalationId,
              tokenExpiresAt: refreshedCredential.tokenExpiresAt,
            },
          );

          return res.status(409).json({
            error:
              'Governed credential expired before sync could start. Re-authorize the integration to resume syncing.',
            code: 'REFRESH_REAUTH_REQUIRED',
            authTransition: 'degraded_reauth_needed',
          });
        }

        const providerFamily = getProviderFamilyForConnector(connector.id);
        const policy = providerFamily ? await getRefreshTimingPolicy(providerFamily, organizationId) : null;
        const refreshWindowMinutes =
          policy?.refreshWindowMinutes ??
          (providerFamily ? DEFAULT_REFRESH_WINDOW_MINUTES[providerFamily] ?? null : null);

        if (
          typeof refreshWindowMinutes === 'number' &&
          tokenExpiresAtMs - refreshWindowMinutes * 60 * 1000 <= now
        ) {
          await logIntegrationAudit(
            organizationId,
            integrationId,
            'sync_preflight_blocked_refresh_window',
            actorId,
            actorId,
            {
              connectorId: connector.id,
              providerFamily,
              tokenExpiresAt: credential?.tokenExpiresAt ?? null,
              refreshWindowMinutes,
            },
          );

          return res.status(409).json({
            error:
              'Governed token refresh execution is not wired on the active runtime path yet. This credential is already inside the refresh window, so sync is blocked before stale auth is used.',
            code: 'REFRESH_EXECUTION_REQUIRED',
            providerFamily,
            refreshWindowMinutes,
            tokenExpiresAt: credential?.tokenExpiresAt ?? null,
          });
        }
      }
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
