/**
 * V8 PM sync bridge — governed persisted inventory, auth, conflict truth, and bounded operator recovery.
 * Namespace: /api/v8/sync (mounted by v8/index).
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requireActiveAuditsMembership } from '../../middleware/auditsStrictMembership.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { logIntegrationConnectionEvent } from '../../services/integrationConnectionLogService.js';
import {
  CONNECTORS,
  disconnectIntegration,
  getConnectedIntegrations,
  syncIntegration,
  updateIntegrationStatus,
} from '../../services/integrationHubService.js';
import { setIntegrationOwner } from '../../services/integrationOwnershipService.js';
import {
  checkRateLimit,
  getIntegrationHealth,
  getUnresolvedErrors,
  logSyncError,
  recordRequest,
  resolveError,
} from '../../services/syncGuardrailsService.js';
import {
  getActiveEscalations,
  getCredential,
  getCredentialHealth,
  getRefreshTimingPolicy,
  recordAuthEscalation,
  recordRefreshResult,
  resolveAuthEscalation,
  resolveAuthEscalationsForConnector,
  setRefreshTimingPolicy,
  storeCredential,
} from '../../services/v8/pmSyncAuthService.js';
import {
  buildGovernedExternalAuthSession,
  getGovernedExternalAuthConfigFields,
} from '../../services/v8/pmSyncExternalAuthMaterializationService.js';
import { listGovernedIntegrations } from '../../services/v8/pmSyncInventoryService.js';
import {
  executeRefreshExecution,
  storeRefreshExecutionSecret,
} from '../../services/v8/pmSyncRefreshExecutionService.js';
import {
  getConnectorHealth,
  getProviderCatalogState,
  getUnresolvedConflicts,
  listProviderCatalogStates,
  resolveConflict,
  setConnectorAuthState,
  setProviderCatalogState,
} from '../../services/v8/pmSyncTruthService.js';
import { LastRefreshResultValues, ProviderFamilyValues } from '../../types/pmSyncAuthBaseline.js';
import { ConflictResolutionPathValues, ConnectorAuthStateValues } from '../../types/pmSyncTruth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { parseMaybeJson } from '../../utils/pgFlags.js';

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

const DEFAULT_REFRESH_WINDOW_MINUTES: Partial<
  Record<(typeof ProviderFamilyValues)[number], number>
> = {
  google_workspace: 10,
  microsoft_365: 10,
  atlassian: 15,
  asana: 15,
  monday: 15,
  clickup: 15,
  linear: 15,
};

const DEFAULT_REFRESH_TOKEN_ENDPOINTS: Partial<Record<string, string>> = {
  jira: 'https://auth.atlassian.com/oauth/token',
  gmail: 'https://oauth2.googleapis.com/token',
  slack: 'https://slack.com/api/oauth.v2.access',
  asana: 'https://app.asana.com/-/oauth_token',
};

function getProviderFamilyForConnector(
  connectorId: string
): (typeof ProviderFamilyValues)[number] | null {
  return CONNECTOR_PROVIDER_FAMILY_MAP[connectorId.trim().toLowerCase()] ?? null;
}

function getDefaultRefreshTokenEndpoint(connectorId: string): string | null {
  return DEFAULT_REFRESH_TOKEN_ENDPOINTS[connectorId.trim().toLowerCase()] ?? null;
}

async function logIntegrationAudit(
  organizationId: string,
  integrationId: string | null,
  action: string,
  actorId: string,
  actorName: string,
  details: Record<string, unknown> = {}
) {
  await dbRun(
    `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
     VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?::JSONB)`,
    [organizationId, integrationId, action, actorId, actorName, JSON.stringify(details)]
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

const StoreIntegrationRefreshSecretBodySchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
  tokenEndpoint: z.string().trim().url().optional(),
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

function getConfiguredFields(configFields: string[], config: Record<string, unknown>): string[] {
  return configFields.filter((field) => {
    const value = config[field];
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  });
}

function getConnectorConfigFields(connectorId: string, baseFields: string[]): string[] {
  return getGovernedExternalAuthConfigFields(connectorId, baseFields);
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

async function handleGovernedRefreshExecutionBeforeSync({
  connectorId,
  integrationId,
  organizationId,
  actorId,
  credential,
  providerFamily,
  refreshWindowMinutes,
  tokenExpired,
}: {
  connectorId: string;
  integrationId: string;
  organizationId: string;
  actorId: string;
  credential: Awaited<ReturnType<typeof getCredential>>;
  providerFamily: (typeof ProviderFamilyValues)[number] | null;
  refreshWindowMinutes: number | null;
  tokenExpired: boolean;
}): Promise<
  { kind: 'continue' } | { kind: 'response'; status: number; body: Record<string, unknown> }
> {
  const refreshExecution = await executeRefreshExecution(connectorId, organizationId);

  if (refreshExecution.status === 'success') {
    const refreshedCredential = await storeCredential({
      connectorId,
      organizationId,
      providerAccountId: credential?.providerAccountId ?? connectorId,
      workspaceOrTenantId: credential?.workspaceOrTenantId ?? connectorId,
      scopesGranted: credential?.scopesGranted?.length ? credential.scopesGranted : ['read:sync'],
      tokenExpiresAt: refreshExecution.tokenExpiresAt ?? credential?.tokenExpiresAt ?? null,
    });
    await recordRefreshResult({
      connectorId,
      organizationId,
      result: 'success',
    });
    const connectorHealth = await getConnectorHealth(connectorId, organizationId);
    if (connectorHealth.authState !== 'healthy') {
      await setConnectorAuthState({
        connectorId,
        organizationId,
        targetState: 'healthy',
        transitionedBy: actorId,
        reason: 'refresh_execution_succeeded',
      });
    }
    await resolveAuthEscalationsForConnector(connectorId, actorId, organizationId);
    await logIntegrationAudit(
      organizationId,
      integrationId,
      'refresh_execution_succeeded',
      actorId,
      actorId,
      {
        connectorId,
        tokenEndpoint: refreshExecution.tokenEndpoint,
        previousTokenExpiresAt: credential?.tokenExpiresAt ?? null,
        tokenExpiresAt: refreshedCredential.tokenExpiresAt,
        rotatedRefreshToken: refreshExecution.rotatedRefreshToken,
      }
    );
    return { kind: 'continue' };
  }

  if (refreshExecution.status === 'missing_secret') {
    if (tokenExpired) {
      const refreshedCredential = await recordRefreshResult({
        connectorId,
        organizationId,
        result: 'credential_expired',
      });
      const escalation = await recordAuthEscalation(
        connectorId,
        organizationId,
        'credential_expired'
      );
      const connectorHealth = await getConnectorHealth(connectorId, organizationId);
      if (connectorHealth.authState !== 'degraded_reauth_needed') {
        await setConnectorAuthState({
          connectorId,
          organizationId,
          targetState: 'degraded_reauth_needed',
          transitionedBy: actorId,
          reason: 'sync_preflight_credential_expired',
        });
      }
      await logIntegrationAudit(
        organizationId,
        integrationId,
        'sync_preflight_blocked_missing_refresh_secret',
        actorId,
        actorId,
        {
          connectorId,
          credentialId: refreshedCredential.credentialId,
          escalationId: escalation.escalationId,
          tokenExpiresAt: refreshedCredential.tokenExpiresAt,
        }
      );

      return {
        kind: 'response',
        status: 409,
        body: {
          error:
            'Governed credential expired and no governed refresh secret is materialized for this connector. Re-authorize the integration or store refresh runtime secrets to resume syncing.',
          code: 'REFRESH_REAUTH_REQUIRED',
          authTransition: 'degraded_reauth_needed',
        },
      };
    }

    await logIntegrationAudit(
      organizationId,
      integrationId,
      'sync_preflight_blocked_refresh_secret_missing',
      actorId,
      actorId,
      {
        connectorId,
        providerFamily,
        tokenExpiresAt: credential?.tokenExpiresAt ?? null,
        refreshWindowMinutes,
      }
    );

    return {
      kind: 'response',
      status: 409,
      body: {
        error:
          'Governed refresh execution now exists on the active runtime path, but this connector still needs a governed refresh secret before stale auth can be refreshed automatically.',
        code: 'REFRESH_SECRET_REQUIRED',
        providerFamily,
        refreshWindowMinutes,
        tokenExpiresAt: credential?.tokenExpiresAt ?? null,
      },
    };
  }

  if (refreshExecution.status === 'transient_failure') {
    await recordRefreshResult({
      connectorId,
      organizationId,
      result: 'transient_failure',
    });
    await logIntegrationAudit(
      organizationId,
      integrationId,
      'refresh_execution_failed_transient',
      actorId,
      actorId,
      {
        connectorId,
        tokenEndpoint: refreshExecution.tokenEndpoint,
        error: refreshExecution.error,
      }
    );

    return {
      kind: 'response',
      status: 502,
      body: {
        error:
          'Governed refresh execution failed with a transient provider/runtime error. Retry the sync after the provider recovers.',
        code: 'REFRESH_RETRY_LATER',
        providerFamily,
        tokenExpiresAt: credential?.tokenExpiresAt ?? null,
      },
    };
  }

  const refreshedCredential = await recordRefreshResult({
    connectorId,
    organizationId,
    result: refreshExecution.status,
  });
  const escalation = await recordAuthEscalation(
    connectorId,
    organizationId,
    refreshExecution.status
  );
  const connectorHealth = await getConnectorHealth(connectorId, organizationId);
  if (connectorHealth.authState !== 'degraded_reauth_needed') {
    await setConnectorAuthState({
      connectorId,
      organizationId,
      targetState: 'degraded_reauth_needed',
      transitionedBy: actorId,
      reason: 'refresh_execution_auth_break',
    });
  }
  await logIntegrationAudit(
    organizationId,
    integrationId,
    'refresh_execution_failed_auth_break',
    actorId,
    actorId,
    {
      connectorId,
      credentialId: refreshedCredential.credentialId,
      escalationId: escalation.escalationId,
      tokenEndpoint: refreshExecution.tokenEndpoint,
      error: refreshExecution.error,
    }
  );

  return {
    kind: 'response',
    status: 409,
    body: {
      error:
        'Governed refresh execution determined that the provider credential now requires re-authorization before sync can continue.',
      code: 'REFRESH_REAUTH_REQUIRED',
      authTransition: 'degraded_reauth_needed',
    },
  };
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
  })
);

// ── Workflow / Sync (logical view over integrations) ─────────

router.get(
  '/workflows',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rows = await dbAll(
      `SELECT i.id, i.connector_id, i.name, i.status, i.is_paused, i.sync_schedule,
              i.scopes, i.field_mappings, i.last_sync_at, i.last_error,
              i.created_at, i.updated_at
       FROM integrations i
       WHERE i.organization_id = ? AND i.status != 'deleted'
       ORDER BY i.updated_at DESC`,
      [organizationId]
    );

    const workflows = (rows || []).map((r: Record<string, unknown>) => {
      const isPaused = r.is_paused === 1 || r.is_paused === true;
      let lifecycleState: string;
      if (isPaused) {
        lifecycleState = 'blocked';
      } else if (r.status === 'pending') {
        lifecycleState = 'draft';
      } else if (r.status === 'connected' && !r.last_error) {
        lifecycleState = 'connected';
      } else if (r.status === 'connected' && r.last_error) {
        lifecycleState = 'degraded';
      } else if (r.status === 'requires_reauth' || r.status === 'error') {
        lifecycleState = 'requires_action';
      } else {
        lifecycleState = 'draft';
      }

      let scopes: string[] = [];
      try {
        scopes = parseMaybeJson(r.scopes, []);
      } catch {
        /* */
      }

      let mode: string = 'manual';
      if (r.sync_schedule && String(r.sync_schedule) !== 'null') {
        mode = 'schedule';
      }

      return {
        workflowId: r.id,
        integrationId: r.id,
        connectorId: r.connector_id,
        name: r.name,
        lifecycleState,
        mode,
        isPaused,
        syncSchedule: r.sync_schedule || null,
        scopes,
        hasMappings:
          !!r.field_mappings &&
          String(r.field_mappings) !== '{}' &&
          String(r.field_mappings) !== 'null',
        lastSyncAt: r.last_sync_at || null,
        lastError: r.last_error || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return res.json({
      data: { workflows, count: workflows.length },
      meta: syncReadMeta(),
    });
  })
);

// ── Mappings (preview / validate / drift) ────────────────────

router.get(
  '/mappings/overview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const integrations = await dbAll(
      `SELECT id, name, connector_id, field_mappings, status, last_sync_at
       FROM integrations WHERE organization_id = ? AND status NOT IN ('deleted', 'disconnected')
       ORDER BY name ASC`,
      [organizationId]
    );

    const driftCounts = await dbAll(
      `SELECT connector_id, COUNT(*) as cnt
       FROM v8_schema_drift_events
       WHERE organization_id = ? AND resolved_at IS NULL
       GROUP BY connector_id`,
      [organizationId]
    );
    const driftMap = new Map(
      (driftCounts || []).map((d: Record<string, unknown>) => [d.connector_id, Number(d.cnt)])
    );

    const mappingCounts = await dbAll(
      `SELECT integration_id, COUNT(*) as cnt
       FROM integration_sync_mappings
       WHERE organization_id = ?
       GROUP BY integration_id`,
      [organizationId]
    );
    const mappingMap = new Map(
      (mappingCounts || []).map((m: Record<string, unknown>) => [m.integration_id, Number(m.cnt)])
    );

    const items = (integrations || []).map((i: Record<string, unknown>) => {
      let fmCount = 0;
      try {
        fmCount = JSON.parse(String(i.field_mappings || '[]')).length;
      } catch {
        /* */
      }
      return {
        integrationId: i.id,
        name: i.name,
        connectorId: i.connector_id,
        status: i.status,
        lastSyncAt: i.last_sync_at,
        fieldMappingCount: fmCount,
        entityMappingCount: mappingMap.get(i.id) || 0,
        openDriftCount: driftMap.get(i.connector_id) || 0,
      };
    });

    return res.json({
      data: { integrations: items },
      meta: syncReadMeta(),
    });
  })
);

router.get(
  '/integrations/:integrationId/mappings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';

    const fieldMappingsRow = await dbGet(
      `SELECT field_mappings, connector_id FROM integrations WHERE id = ? AND organization_id = ?`,
      [integrationId, organizationId]
    );
    if (!fieldMappingsRow) {
      return res.status(404).json({ error: 'Integration not found', code: 'NOT_FOUND' });
    }

    const fm = fieldMappingsRow as Record<string, unknown>;
    let fieldMappings: unknown[] = [];
    try {
      fieldMappings = JSON.parse(String(fm.field_mappings || '[]'));
    } catch {
      /* */
    }

    const entityMappings = await dbAll(
      `SELECT id, local_type, local_id, external_type, external_id, sync_status, last_synced_at, metadata
       FROM integration_sync_mappings
       WHERE integration_id = ? AND organization_id = ?
       ORDER BY last_synced_at DESC`,
      [integrationId, organizationId]
    );

    const driftEvents = await dbAll(
      `SELECT drift_id, connector_id, drift_type, affected_fields, detected_at, resolved_at
       FROM v8_schema_drift_events
       WHERE connector_id = ? AND organization_id = ?
       ORDER BY detected_at DESC LIMIT 20`,
      [fm.connector_id, organizationId]
    );

    const syncStates = await dbAll(
      `SELECT object_sync_state_id, object_type, object_id, sync_status, error_class, last_synced_at
       FROM v8_business_object_sync_states
       WHERE connector_id = ? AND organization_id = ?
       ORDER BY last_synced_at DESC LIMIT 50`,
      [fm.connector_id, organizationId]
    );

    return res.json({
      data: {
        integrationId,
        connectorId: fm.connector_id,
        fieldMappings,
        entityMappings: (entityMappings || []).map((m: Record<string, unknown>) => ({
          id: m.id,
          localType: m.local_type,
          localId: m.local_id,
          externalType: m.external_type,
          externalId: m.external_id,
          syncStatus: m.sync_status,
          lastSyncedAt: m.last_synced_at,
        })),
        driftEvents: (driftEvents || []).map((d: Record<string, unknown>) => ({
          driftId: d.drift_id,
          driftType: d.drift_type,
          affectedFields: d.affected_fields,
          detectedAt: d.detected_at,
          resolvedAt: d.resolved_at,
        })),
        syncStates: (syncStates || []).map((s: Record<string, unknown>) => ({
          id: s.object_sync_state_id,
          objectType: s.object_type,
          objectId: s.object_id,
          syncStatus: s.sync_status,
          errorClass: s.error_class,
          lastSyncedAt: s.last_synced_at,
        })),
      },
      meta: syncReadMeta(),
    });
  })
);

router.post(
  '/integrations/:integrationId/mappings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const { fieldMappings } = req.body as { fieldMappings: unknown[] };

    if (!Array.isArray(fieldMappings)) {
      return res
        .status(400)
        .json({ error: 'fieldMappings must be an array', code: 'INVALID_PARAM' });
    }

    const existing = await dbGet(
      `SELECT field_mappings FROM integrations WHERE id = ? AND organization_id = ?`,
      [integrationId, organizationId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Integration not found', code: 'NOT_FOUND' });
    }

    await dbRun(
      `UPDATE integrations SET field_mappings = ?::JSONB, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(fieldMappings), integrationId]
    );

    await dbRun(
      `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'mapping_changed', ?, 'user', ?::JSONB)`,
      [organizationId, integrationId, userId, JSON.stringify({ fieldCount: fieldMappings.length })]
    );

    return res.json({
      data: { success: true, fieldCount: fieldMappings.length },
      meta: syncMutationMeta(),
    });
  })
);

router.get(
  '/connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const category = firstQueryString(req.query.category);
    let connectors = Object.values(CONNECTORS);
    if (category) {
      connectors = connectors.filter((c) => c.category === category);
    }

    const catalog = connectors.map((c) => ({
      ...c,
      configFields: getConnectorConfigFields(c.id, c.configFields),
      isAvailable: true,
      isV2Ready: true,
      comingSoon: false,
    }));

    return res.json({
      data: { connectors: catalog, count: catalog.length },
      meta: syncReadMeta(),
    });
  })
);

// ── Provider Catalog State (§2.3.3A) ────────────────────────────

const ProviderLifecycleStateValues = [
  'draft',
  'connected',
  'degraded',
  'requires_action',
  'recovered',
  'blocked',
] as const;

const SetProviderStateBodySchema = z.object({
  targetState: z.enum(ProviderLifecycleStateValues),
  reason: z.string().trim().nullable().optional(),
  incidentDescription: z.string().trim().nullable().optional(),
  expectedRecoveryAt: z.string().trim().nullable().optional(),
});

router.get(
  '/providers/states',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const states = await listProviderCatalogStates(organizationId);
    return res.json({
      data: { states, count: states.length },
      meta: syncReadMeta(),
    });
  })
);

router.get(
  '/providers/:providerId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const providerId =
      typeof req.params.providerId === 'string' ? req.params.providerId.trim().toLowerCase() : '';
    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required', code: 'INVALID_PARAM' });
    }

    const state = await getProviderCatalogState(providerId, organizationId);
    return res.json({
      data: {
        providerId,
        state: state ?? {
          lifecycleState: 'connected',
          reason: 'default — no explicit state recorded',
        },
      },
      meta: syncReadMeta(),
    });
  })
);

router.post(
  '/providers/:providerId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const providerId =
      typeof req.params.providerId === 'string' ? req.params.providerId.trim().toLowerCase() : '';
    const actorId =
      typeof req.user?.id === 'string' && req.user.id.trim()
        ? req.user.id.trim()
        : typeof req.userId === 'string' && req.userId.trim()
          ? req.userId.trim()
          : '';

    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required', code: 'INVALID_PARAM' });
    }
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const parsed = SetProviderStateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid provider state payload',
        code: 'INVALID_BODY',
      });
    }

    try {
      const state = await setProviderCatalogState({
        providerId,
        organizationId,
        targetState: parsed.data.targetState,
        transitionedBy: actorId,
        reason: parsed.data.reason ?? null,
        incidentDescription: parsed.data.incidentDescription ?? null,
        expectedRecoveryAt: parsed.data.expectedRecoveryAt ?? null,
      });

      await logIntegrationAudit(organizationId, null, `provider_state_changed`, actorId, actorId, {
        providerId,
        targetState: parsed.data.targetState,
        previousState: state.previousState,
        reason: parsed.data.reason,
      });

      return res.json({
        data: { state },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to update provider state';
      if (rawMessage.includes('Invalid provider state transition')) {
        return res.status(409).json({
          error: 'Invalid provider state transition',
          code: 'INVALID_PROVIDER_STATE_TRANSITION',
        });
      }
      throw error;
    }
  })
);

// ── Connector Connection ────────────────────────────────────────

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
    const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);

    const integrationId = `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const integrationName = parsedBody.data.displayName?.trim() || connector.name;
    const scopes = connector.capabilities.map((capability) => `read:${capability}`);

    await dbRun(
      `INSERT INTO integrations (
         id, organization_id, connector_id, name, category,
         status, config, capabilities, auth_type, connected_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
        actorId,
      ]
    );
    await setIntegrationOwner({ integrationId, organizationId, ownerUserId: actorId });
    await logIntegrationConnectionEvent({
      organizationId,
      userId: actorId,
      integrationId,
      connectorId: connector.id,
      eventType: 'connect_initiated',
      metadata: { authType: connector.authType },
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    await logIntegrationAudit(
      organizationId,
      integrationId,
      'connect_initiated',
      actorId,
      actorId,
      {
        connectorId: connector.id,
        authType: connector.authType,
      }
    );

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
          configFields: connectorConfigFields,
          scopes,
        },
        onboardingStatus: 'pending_external_auth_or_configuration' as const,
      },
      meta: syncMutationMeta(),
    });
  })
);

router.post(
  '/integrations/:integrationId/configure',
  requireActiveAuditsMembership,
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
      [integrationId, organizationId]
    );
    const integration = rows[0];
    if (!integration) {
      return res
        .status(404)
        .json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }
    const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);

    const currentConfig = safeJsonParse<Record<string, unknown>>(integration.config, {});
    const nextConfig = { ...currentConfig };
    for (const field of connectorConfigFields) {
      if (Object.prototype.hasOwnProperty.call(parsedBody.data.config, field)) {
        nextConfig[field] = parsedBody.data.config[field];
      }
    }

    const configuredFields = getConfiguredFields(connectorConfigFields, nextConfig);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connectorConfigFields,
      configuredFields
    );

    // SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: the approved-provider
    // guard MUST be consulted before any write below (pending-config save,
    // audit log, connector auth-state transition, or connection-event log).
    // `buildGovernedExternalAuthSession` runs `requireApprovedGovernedConnector`
    // as its very first step and throws (fail closed) when the connector is
    // not registry-approved. Calling it here — before the UPDATE and every
    // write that follows — means a denied connector leaves no state behind:
    // no updated config row, no audit entry, no 'connecting' transition, no
    // consent URL.
    const requiresGovernedExternalAuth =
      connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth';
    let preparedExternalAuth: ReturnType<typeof buildGovernedExternalAuthSession> | null = null;
    if (requiresGovernedExternalAuth) {
      try {
        preparedExternalAuth = buildGovernedExternalAuthSession(req, {
          integrationId,
          organizationId,
          connectorId: connector.id,
          mode: 'connect',
          config: nextConfig,
        });
      } catch (error) {
        return res.status(403).json({
          error:
            error instanceof Error
              ? error.message
              : 'Governed external auth provider is not approved',
          code: 'GOVERNED_EXTERNAL_AUTH_NOT_APPROVED',
        });
      }
    }

    await dbRun(
      `UPDATE integrations
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(nextConfig), integrationId, organizationId]
    );
    await logIntegrationAudit(
      organizationId,
      integrationId,
      'configuration_updated',
      actorId,
      actorId,
      {
        connectorId: connector.id,
        configuredFields,
        status: integration.status,
      }
    );

    let externalAuth:
      | {
          authUrl: string;
          callbackUrl: string;
          state: string;
          expiresAt: string;
        }
      | undefined;

    if (requiresGovernedExternalAuth && preparedExternalAuth) {
      await setConnectorAuthState({
        connectorId: connector.id,
        organizationId,
        targetState: 'connecting',
        transitionedBy: actorId,
        reason: 'external_auth_prepared',
      });
      externalAuth = preparedExternalAuth;
      await logIntegrationConnectionEvent({
        organizationId,
        userId: actorId,
        integrationId,
        connectorId: connector.id,
        eventType: 'external_auth_prepared',
        metadata: {
          mode: 'connect',
          expiresAt: externalAuth.expiresAt,
          callbackUrl: externalAuth.callbackUrl,
        },
        ipAddress: typeof req.ip === 'string' ? req.ip : null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });
    }

    await logIntegrationConnectionEvent({
      organizationId,
      userId: actorId,
      integrationId,
      connectorId: connector.id,
      eventType: 'configuration_submitted',
      metadata: { configuredFields, onboardingStatus },
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

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
  })
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
  })
);

router.post(
  '/integrations/:integrationId/reauth',
  requireActiveAuditsMembership,
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
      [integrationId, organizationId]
    );
    const integration = integrationRows[0];
    if (!integration) {
      return res
        .status(404)
        .json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }
    const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);

    const config = safeJsonParse<Record<string, unknown>>(integration.config, {});
    const configuredFields = getConfiguredFields(connectorConfigFields, config);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connectorConfigFields,
      configuredFields
    );

    // SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: the approved-provider
    // guard MUST be consulted before any write below (the reauth audit entry,
    // the integration status flip back to 'pending', or the connector
    // auth-state transition). `buildGovernedExternalAuthSession` runs
    // `requireApprovedGovernedConnector` as its very first step and throws
    // (fail closed) when the connector is not registry-approved. Calling it
    // here — before the first write — means a denied connector leaves no
    // state behind.
    const requiresGovernedExternalAuth =
      connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth';
    let preparedExternalAuth: ReturnType<typeof buildGovernedExternalAuthSession> | null = null;
    if (requiresGovernedExternalAuth) {
      try {
        preparedExternalAuth = buildGovernedExternalAuthSession(req, {
          integrationId,
          organizationId,
          connectorId: connector.id,
          mode: 'reauth',
          config,
        });
      } catch (error) {
        return res.status(403).json({
          error:
            error instanceof Error
              ? error.message
              : 'Governed external auth provider is not approved',
          code: 'GOVERNED_EXTERNAL_AUTH_NOT_APPROVED',
        });
      }
    }

    await logIntegrationAudit(organizationId, integrationId, 'reauth_started', actorId, actorId, {
      connectorId: connector.id,
      onboardingStatus,
    });
    let externalAuth:
      | {
          authUrl: string;
          callbackUrl: string;
          state: string;
          expiresAt: string;
        }
      | undefined;
    if (requiresGovernedExternalAuth && preparedExternalAuth) {
      await updateIntegrationStatus(integrationId, 'pending');
      await setConnectorAuthState({
        connectorId: connector.id,
        organizationId,
        targetState: 'connecting',
        transitionedBy: actorId,
        reason: 'reauth_started',
      });
      externalAuth = preparedExternalAuth;
    }

    return res.json({
      data: {
        success: true as const,
        message: 'Re-authorization initiated',
        onboardingStatus,
        externalAuth,
      },
      meta: syncMutationMeta(),
    });
  })
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
      [integrationId, organizationId]
    );
    const integration = rows[0];
    if (!integration) {
      return res
        .status(404)
        .json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
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

    await logIntegrationAudit(
      organizationId,
      integrationId,
      'credential_materialized',
      actorId,
      actorId,
      {
        connectorId: connector.id,
        providerAccountId: credential.providerAccountId,
        workspaceOrTenantId: credential.workspaceOrTenantId,
        scopesGranted: credential.scopesGranted,
      }
    );

    const refreshedCredential = await getCredential(connector.id, organizationId);

    return res.json({
      data: {
        credential: refreshedCredential ?? credential,
      },
      meta: syncMutationMeta(),
    });
  })
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
      [integrationId, organizationId]
    );
    const integration = rows[0];
    if (!integration) {
      return res
        .status(404)
        .json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
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
    let authTransition: {
      targetState: 'healthy' | 'degraded_reauth_needed';
      reason: string;
    } | null = null;

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
    let resolvedEscalationCount = 0;
    if (['credential_expired', 'scope_revoked'].includes(parsedBody.data.result)) {
      const escalation = await recordAuthEscalation(
        connector.id,
        organizationId,
        parsedBody.data.result
      );
      escalationId = escalation.escalationId;
    } else if (parsedBody.data.result === 'success') {
      const resolvedEscalations = await resolveAuthEscalationsForConnector(
        connector.id,
        actorId,
        organizationId
      );
      resolvedEscalationCount = resolvedEscalations.length;
    }

    await logIntegrationAudit(
      organizationId,
      integrationId,
      'refresh_result_recorded',
      actorId,
      actorId,
      {
        connectorId: connector.id,
        result: parsedBody.data.result,
        authTransition: authTransition?.targetState ?? null,
        escalationId,
        resolvedEscalationCount,
      }
    );

    return res.json({
      data: {
        credential,
        authTransition: authTransition?.targetState ?? null,
      },
      meta: syncMutationMeta(),
    });
  })
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
      [integrationId, organizationId]
    );
    await logIntegrationAudit(organizationId, integrationId, 'paused', actorId, actorId, {});

    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  })
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
      [integrationId, organizationId]
    );
    await logIntegrationAudit(organizationId, integrationId, 'resumed', actorId, actorId, {});

    return res.json({
      data: { success: true as const },
      meta: syncMutationMeta(),
    });
  })
);

// ── Per-workflow policy gate (blocked / paused / safety_gate) ─

router.get(
  '/integrations/:integrationId/workflow-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    try {
      const row = await dbGet(
        `SELECT workflow_policy, workflow_policy_reason, workflow_policy_set_by, workflow_policy_set_at, is_paused
         FROM integrations WHERE id = ? AND organization_id = ?`,
        [integrationId, organizationId]
      );
      if (!row) {
        return res.status(404).json({
          error: 'Integration not found',
          code: 'SYNC_WORKFLOW_POLICY_INTEGRATION_NOT_FOUND',
        });
      }
      const r = row as Record<string, unknown>;
      return res.json({
        data: {
          integrationId,
          workflowPolicy: r.workflow_policy || 'active',
          reason: r.workflow_policy_reason || null,
          setBy: r.workflow_policy_set_by || null,
          setAt: r.workflow_policy_set_at || null,
          isPaused: !!r.is_paused,
        },
        meta: syncReadMeta(),
      });
    } catch {
      return res.status(503).json({
        error: 'Failed to read workflow policy',
        code: 'SYNC_WORKFLOW_POLICY_READ_FAILED',
      });
    }
  })
);

router.post(
  '/integrations/:integrationId/workflow-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const integrationId =
      typeof req.params.integrationId === 'string' ? req.params.integrationId.trim() : '';
    const { policy, reason } = req.body as { policy: string; reason?: string };

    const VALID_POLICIES = ['active', 'paused', 'blocked', 'safety_gate'];
    if (!policy || !VALID_POLICIES.includes(policy)) {
      return res.status(400).json({
        error: `policy must be one of: ${VALID_POLICIES.join(', ')}`,
        code: 'SYNC_WORKFLOW_POLICY_INVALID',
      });
    }

    try {
      const existing = await dbGet(
        `SELECT id FROM integrations WHERE id = ? AND organization_id = ?`,
        [integrationId, organizationId]
      );
      if (!existing) {
        return res.status(404).json({
          error: 'Integration not found',
          code: 'SYNC_WORKFLOW_POLICY_INTEGRATION_NOT_FOUND',
        });
      }

      const isPaused = policy === 'paused' || policy === 'blocked' || policy === 'safety_gate';
      await dbRun(
        `UPDATE integrations
         SET workflow_policy = ?,
             workflow_policy_reason = ?,
             workflow_policy_set_by = ?,
             workflow_policy_set_at = NOW(),
             is_paused = ?,
             paused_at = CASE WHEN ? THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = ? AND organization_id = ?`,
        [policy, reason || null, userId, isPaused, isPaused, integrationId, organizationId]
      );

      await logIntegrationAudit(
        organizationId,
        integrationId,
        `workflow_policy_${policy}`,
        userId,
        userId,
        {
          policy,
          reason: reason || null,
        }
      );

      return res.json({
        data: { success: true, policy, isPaused },
        meta: syncMutationMeta(),
      });
    } catch {
      return res.status(503).json({
        error: 'Failed to update workflow policy',
        code: 'SYNC_WORKFLOW_POLICY_UPDATE_FAILED',
      });
    }
  })
);

router.post(
  '/integrations/:integrationId/refresh-secret',
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

    const parsedBody = StoreIntegrationRefreshSecretBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues[0]?.message ?? 'Invalid refresh secret payload',
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
      [integrationId, organizationId]
    );
    const integration = rows[0];
    if (!integration) {
      return res
        .status(404)
        .json({ error: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' });
    }

    const connector = CONNECTORS[integration.connector_id];
    if (!connector) {
      return res.status(404).json({ error: 'Unknown connector', code: 'CONNECTOR_NOT_FOUND' });
    }
    if (connector.authType !== 'oauth2') {
      return res.status(409).json({
        error: 'Refresh secret materialization is only supported for governed oauth2 connectors',
        code: 'REFRESH_SECRET_UNSUPPORTED',
      });
    }

    const tokenEndpoint =
      parsedBody.data.tokenEndpoint ?? getDefaultRefreshTokenEndpoint(connector.id) ?? null;
    if (!tokenEndpoint) {
      return res.status(400).json({
        error: 'tokenEndpoint is required for this connector',
        code: 'TOKEN_ENDPOINT_REQUIRED',
      });
    }

    try {
      const storedSecret = await storeRefreshExecutionSecret({
        connectorId: connector.id,
        organizationId,
        clientId: parsedBody.data.clientId,
        clientSecret: parsedBody.data.clientSecret,
        refreshToken: parsedBody.data.refreshToken,
        tokenEndpoint,
      });

      await logIntegrationAudit(
        organizationId,
        integrationId,
        'refresh_secret_materialized',
        actorId,
        actorId,
        {
          connectorId: connector.id,
          tokenEndpoint: storedSecret.tokenEndpoint,
          clientIdPresent: true,
          refreshTokenPresent: true,
        }
      );

      return res.json({
        data: {
          refreshSecret: {
            connectorId: storedSecret.connectorId,
            organizationId: storedSecret.organizationId,
            clientIdPresent: true,
            refreshTokenPresent: true,
            tokenEndpoint: storedSecret.tokenEndpoint,
          },
        },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to materialize governed refresh secret';
      const code = message.includes('storage is unavailable')
        ? 'REFRESH_SECRET_STORAGE_UNAVAILABLE'
        : 'REFRESH_SECRET_MATERIALIZATION_FAILED';
      return res.status(409).json({ error: message, code });
    }
  })
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
      [integrationId, organizationId]
    )) || []) as Array<{ connector_id: string; is_paused: boolean; status: string }>;

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found', code: 'NOT_FOUND' });
    }
    if (integration[0].is_paused) {
      return res.status(400).json({ error: 'Integration is paused', code: 'INTEGRATION_PAUSED' });
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
      const tokenExpiresAtMs = credential?.tokenExpiresAt
        ? Date.parse(credential.tokenExpiresAt)
        : NaN;

      if (Number.isFinite(tokenExpiresAtMs)) {
        const now = Date.now();
        const providerFamily = getProviderFamilyForConnector(connector.id);
        const policy = providerFamily
          ? await getRefreshTimingPolicy(providerFamily, organizationId)
          : null;
        const refreshWindowMinutes =
          policy?.refreshWindowMinutes ??
          (providerFamily ? (DEFAULT_REFRESH_WINDOW_MINUTES[providerFamily] ?? null) : null);
        const tokenExpired = tokenExpiresAtMs <= now;
        let insideRefreshWindow =
          typeof refreshWindowMinutes === 'number' &&
          tokenExpiresAtMs - refreshWindowMinutes * 60 * 1000 <= now;

        if (tokenExpired || insideRefreshWindow) {
          const refreshGate = await handleGovernedRefreshExecutionBeforeSync({
            connectorId: connector.id,
            integrationId,
            organizationId,
            actorId,
            credential,
            providerFamily,
            refreshWindowMinutes,
            tokenExpired,
          });

          if (refreshGate.kind === 'response') {
            return res.status(refreshGate.status).json(refreshGate.body);
          }

          insideRefreshWindow = false;
        }

        if (typeof refreshWindowMinutes === 'number' && insideRefreshWindow) {
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
            }
          );

          return res.status(409).json({
            error:
              'Governed refresh execution could not be completed before sync started, so stale auth is still blocked on the active runtime path.',
            code: 'REFRESH_SECRET_REQUIRED',
            providerFamily,
            refreshWindowMinutes,
            tokenExpiresAt: credential?.tokenExpiresAt ?? null,
          });
        }
      }
    }

    const rateCheck = await checkRateLimit(
      organizationId,
      integrationId,
      integration[0].connector_id
    );
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
      [runId, organizationId, integrationId, integration[0].connector_id]
    );

    await recordRequest(organizationId, integrationId, integration[0].connector_id);

    try {
      const result = await syncIntegration(integrationId, {});
      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'completed', items_processed = ?, duration_ms = ?, completed_at = NOW()
         WHERE id = ?`,
        [result.recordsSynced, result.duration, runId]
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
        [errorMessage, Date.now() - startedAt.getTime(), runId]
      );
      await logSyncError(organizationId, integrationId, error as Error, runId);
      logger.error('[v8/sync] sync failed', {
        err: error,
        correlationId: (req as any).correlationId,
        syncRunId: runId,
      });

      return res.status(500).json({ error: 'Sync failed', syncRunId: runId, code: 'SYNC_FAILED' });
    }
  })
);

// ── Error Posture (§2.3.8 traceability) ─────────────────────────

router.get(
  '/error-posture',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const posture = [
      {
        scenario: 'Reauth required (consent revoked / invalid_grant)',
        object: 'connection',
        state: 'requires_action',
        owner: 'tenant',
        nextAction: 'Initiate reauth flow via POST /integrations/:id/reauth',
        errorClassification: 'AUTH',
      },
      {
        scenario: 'Rate limit (429 / vendor throttling)',
        object: 'run',
        state: 'degraded (recoverable)',
        owner: 'platform',
        nextAction: 'Wait/backoff — automatic retry with exponential delay',
        errorClassification: 'RATE_LIMIT',
      },
      {
        scenario: 'Permission revoked / scopes reduced (403)',
        object: 'connection',
        state: 'requires_action',
        owner: 'tenant + platform policy visibility',
        nextAction: 'Reauth/consent with corrected scopes',
        errorClassification: 'AUTH',
      },
      {
        scenario: 'Mapping drift / schema change',
        object: 'workflow',
        state: 'requires_action',
        owner: 'tenant',
        nextAction: 'Review mapping + verify/test before re-enable',
        errorClassification: 'VALIDATION',
      },
      {
        scenario: 'Run failed (transient timeout / network)',
        object: 'run',
        state: 'degraded (recoverable)',
        owner: 'platform',
        nextAction: 'Auto-retry with backoff',
        errorClassification: 'NETWORK',
      },
      {
        scenario: 'Run failed (permanent validation / bad config)',
        object: 'run',
        state: 'requires_action',
        owner: 'tenant',
        nextAction: 'Fix config/mapping, replay run',
        errorClassification: 'VALIDATION',
      },
      {
        scenario: 'Provider outage',
        object: 'provider_catalog_item',
        state: 'degraded',
        owner: 'platform',
        nextAction: 'Platform incident + comms; POST /providers/:id/status',
        errorClassification: 'PROVIDER',
      },
      {
        scenario: 'Webhook delivery failure (410/401/invalid endpoint)',
        object: 'workflow',
        state: 'degraded → requires_action (if persistent)',
        owner: 'tenant + platform',
        nextAction: 'Retry/backoff; deactivate after 5 consecutive failures',
        errorClassification: 'NETWORK',
      },
      {
        scenario: 'Org policy blocks provider',
        object: 'connection',
        state: 'blocked',
        owner: 'platform + tenant admin',
        nextAction: 'Unblock/policy change or disconnect',
        errorClassification: 'AUTH',
      },
    ];

    return res.json({
      data: {
        posture,
        count: posture.length,
        contractReference: '§2.3.8',
      },
      meta: syncReadMeta(),
    });
  })
);

// ── Run History ──────────────────────────────────────────────────

router.get(
  '/runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId = firstQueryString(req.query.integrationId);
    const status = firstQueryString(req.query.status);
    const limit = Math.min(parseInt(firstQueryString(req.query.limit) || '50', 10), 200);
    const offset = parseInt(firstQueryString(req.query.offset) || '0', 10);

    let query = `SELECT * FROM integration_sync_runs WHERE organization_id = ?`;
    const params: unknown[] = [organizationId];

    if (integrationId) {
      query += ` AND integration_id = ?`;
      params.push(integrationId);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    query += ` ORDER BY started_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const runs = await dbAll(query, params);

    const countQuery = integrationId
      ? `SELECT COUNT(*) as total FROM integration_sync_runs WHERE organization_id = ? AND integration_id = ?`
      : `SELECT COUNT(*) as total FROM integration_sync_runs WHERE organization_id = ?`;
    const countParams = integrationId ? [organizationId, integrationId] : [organizationId];
    const countRow = await dbGet(countQuery, countParams);

    return res.json({
      data: {
        runs: (runs || []).map((r: Record<string, unknown>) => {
          let lifecycleState: string;
          const retryCount = Number(r.retry_count || 0);
          if (r.status === 'running') lifecycleState = 'connected';
          else if (r.status === 'completed') lifecycleState = 'connected';
          else if (r.status === 'failed' && retryCount > 0 && retryCount < 3)
            lifecycleState = 'degraded';
          else if (r.status === 'failed') lifecycleState = 'requires_action';
          else if (r.status === 'partial') lifecycleState = 'degraded';
          else lifecycleState = 'draft';

          const canReplay = r.status === 'failed';

          return {
            id: r.id,
            integrationId: r.integration_id,
            provider: r.provider,
            direction: r.direction,
            status: r.status,
            lifecycleState,
            canReplay,
            itemsProcessed: r.items_processed,
            durationMs: r.duration_ms,
            errorSummary: r.error_summary,
            triggeredBy: r.triggered_by,
            startedAt: r.started_at,
            completedAt: r.completed_at,
          };
        }),
        total: (countRow as Record<string, unknown>)?.total ?? 0,
      },
      meta: syncReadMeta(),
    });
  })
);

// ── Health ───────────────────────────────────────────────────────

router.get(
  '/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const filter = firstQueryString(req.query.filter);
    const integrations = await getConnectedIntegrations(organizationId);
    const healthChecks = await Promise.all(
      integrations.map(async (int) => {
        const health = await getIntegrationHealth(organizationId, int.id);
        const lastRunRow = await dbGet(
          `SELECT * FROM integration_sync_runs WHERE organization_id = ? AND integration_id = ? ORDER BY started_at DESC LIMIT 1`,
          [organizationId, int.id]
        );
        const isPaused =
          (int as unknown as Record<string, unknown>).is_paused === 1 ||
          (int as unknown as Record<string, unknown>).is_paused === true;

        let lifecycleState: string;
        if (isPaused) lifecycleState = 'blocked';
        else if (health.status === 'healthy') lifecycleState = 'connected';
        else if (health.status === 'degraded') lifecycleState = 'degraded';
        else lifecycleState = 'requires_action';

        const ownerType = ['degraded', 'requires_action'].includes(lifecycleState)
          ? 'tenant'
          : 'platform';

        return {
          integrationId: int.id,
          connectorId: (int as unknown as Record<string, unknown>).connector_id,
          providerFamily:
            (int as unknown as Record<string, unknown>).category ||
            (int as unknown as Record<string, unknown>).connector_id,
          name:
            (int as unknown as Record<string, unknown>).name ||
            (int as unknown as Record<string, unknown>).connector_id,
          healthStatus: health.status,
          lifecycleState,
          reason: (int as unknown as Record<string, unknown>).last_error || null,
          nextAction:
            lifecycleState === 'requires_action'
              ? 'reauth_or_fix_config'
              : lifecycleState === 'degraded'
                ? 'monitor_or_retry'
                : lifecycleState === 'blocked'
                  ? 'resume_or_unblock'
                  : 'none',
          owner: ownerType,
          lastRunAt: lastRunRow ? (lastRunRow as Record<string, unknown>).started_at : null,
          lastRunStatus: lastRunRow ? (lastRunRow as Record<string, unknown>).status : null,
          isPaused,
        };
      })
    );

    let filtered = healthChecks;
    if (filter === 'requires_action') {
      filtered = healthChecks.filter((h) => h.lifecycleState === 'requires_action');
    } else if (filter === 'degraded') {
      filtered = healthChecks.filter((h) => h.lifecycleState === 'degraded');
    } else if (filter === 'blocked') {
      filtered = healthChecks.filter((h) => h.lifecycleState === 'blocked');
    }

    const summary = {
      total: healthChecks.length,
      healthy: healthChecks.filter((h) => h.healthStatus === 'healthy').length,
      degraded: healthChecks.filter((h) => h.healthStatus === 'degraded').length,
      unhealthy: healthChecks.filter((h) => h.healthStatus === 'unhealthy').length,
    };

    return res.json({
      data: { summary, integrations: filtered },
      meta: syncReadMeta(),
    });
  })
);

router.get(
  '/errors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const integrationId = firstQueryString(req.query.integrationId);
    const errors = await getUnresolvedErrors(organizationId, integrationId || undefined);

    const integrationNames: Record<string, string> = {};
    for (const error of errors || []) {
      if (error.integrationId && !integrationNames[error.integrationId]) {
        const row = await dbGet(`SELECT name, connector_id FROM integrations WHERE id = ?`, [
          error.integrationId,
        ]);
        integrationNames[error.integrationId] = row
          ? String(
              (row as Record<string, unknown>).name ||
                (row as Record<string, unknown>).connector_id ||
                'Unknown'
            )
          : 'Unknown';
      }
    }

    return res.json({
      data: {
        errors: (errors || []).map((error) => {
          const ownerType =
            error.errorType === 'AUTH' || error.errorType === 'VALIDATION' ? 'tenant' : 'platform';
          return {
            id: error.id,
            integrationId: error.integrationId,
            integrationName: integrationNames[error.integrationId] || 'Unknown',
            errorType: error.errorType,
            errorMessage: error.errorMessage,
            isRetryable: error.isRetryable,
            retryCount: error.retryCount,
            maxRetries: error.maxRetries,
            owner: ownerType,
            nextAction: ownerType === 'tenant' ? 'reauth_or_fix_config' : 'auto_retry',
            firstSeen: error.createdAt,
            createdAt: error.createdAt,
          };
        }),
        count: errors.length,
      },
      meta: syncReadMeta(),
    });
  })
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
  })
);

// ── Run replay ──────────────────────────────────────────────────

router.post(
  '/runs/:runId/replay',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const runId = typeof req.params.runId === 'string' ? req.params.runId.trim() : '';
    if (!runId) {
      return res.status(400).json({ error: 'runId is required', code: 'INVALID_PARAM' });
    }

    const originalRun = await dbGet(
      `SELECT * FROM integration_sync_runs WHERE id = ? AND organization_id = ?`,
      [runId, organizationId]
    );
    if (!originalRun) {
      return res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
    }
    const orig = originalRun as Record<string, unknown>;

    if (orig.status !== 'failed') {
      return res.status(400).json({
        error: 'Only failed runs can be replayed',
        code: 'REPLAY_NOT_ALLOWED',
      });
    }

    const replayRunId = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await dbRun(
      `INSERT INTO integration_sync_runs
         (id, organization_id, integration_id, provider, direction, status, started_at, triggered_by)
       VALUES (?, ?, ?, ?, ?, 'running', NOW(), ?)`,
      [
        replayRunId,
        organizationId,
        orig.integration_id,
        orig.provider,
        orig.direction || 'pull',
        `replay:${userId}`,
      ]
    );

    await dbRun(
      `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'run_replayed', ?, ?, ?::JSONB)`,
      [
        organizationId,
        orig.integration_id,
        userId,
        'user',
        JSON.stringify({ originalRunId: runId, replayRunId }),
      ]
    );

    try {
      const integration = await dbAll(
        `SELECT * FROM integrations WHERE id = ? AND organization_id = ?`,
        [orig.integration_id, organizationId]
      );
      if (integration && integration.length > 0) {
        const config = integration[0].config ? JSON.parse(String(integration[0].config)) : {};
        const result = await syncIntegration(String(orig.integration_id), config);
        await dbRun(
          `UPDATE integration_sync_runs
           SET status = 'completed', items_processed = ?, duration_ms = ?, completed_at = NOW()
           WHERE id = ?`,
          [result.recordsSynced, result.duration, replayRunId]
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await dbRun(
        `UPDATE integration_sync_runs
         SET status = 'failed', error_summary = ?, completed_at = NOW()
         WHERE id = ?`,
        [errorMessage, replayRunId]
      );
    }

    return res.json({
      data: { replayRunId, originalRunId: runId, status: 'initiated' },
      meta: syncMutationMeta(),
    });
  })
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
  })
);

// ── Secrets rotation ────────────────────────────────────────────

router.get(
  '/secrets/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const secrets = await dbAll(
      `SELECT id, connector_id, secret_key, rotated_at, created_at
       FROM integration_secrets
       WHERE organization_id = ?
       ORDER BY rotated_at DESC NULLS LAST`,
      [organizationId]
    );

    const now = Date.now();
    const ROTATION_THRESHOLD_DAYS = 90;

    const items = (secrets || []).map((s: Record<string, unknown>) => {
      const rotatedAt = s.rotated_at
        ? new Date(String(s.rotated_at)).getTime()
        : new Date(String(s.created_at)).getTime();
      const ageDays = Math.floor((now - rotatedAt) / (1000 * 60 * 60 * 24));
      const needsRotation = ageDays > ROTATION_THRESHOLD_DAYS;

      return {
        secretId: s.id,
        connectorId: s.connector_id,
        secretKey: s.secret_key,
        lastRotatedAt: s.rotated_at || s.created_at,
        ageDays,
        needsRotation,
        rotationThresholdDays: ROTATION_THRESHOLD_DAYS,
      };
    });

    return res.json({
      data: {
        secrets: items,
        summary: {
          total: items.length,
          needsRotation: items.filter((i) => i.needsRotation).length,
          healthy: items.filter((i) => !i.needsRotation).length,
        },
      },
      meta: syncReadMeta(),
    });
  })
);

router.post(
  '/secrets/:secretId/rotate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const secretId = typeof req.params.secretId === 'string' ? req.params.secretId.trim() : '';

    const existing = await dbGet(
      `SELECT id, connector_id, secret_key FROM integration_secrets WHERE id = ? AND organization_id = ?`,
      [secretId, organizationId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Secret not found', code: 'NOT_FOUND' });
    }

    await dbRun(`UPDATE integration_secrets SET rotated_at = NOW() WHERE id = ?`, [secretId]);

    const ex = existing as Record<string, unknown>;
    await dbRun(
      `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
       VALUES (gen_random_uuid()::TEXT, ?, NULL, 'secret_rotated', ?, 'user', ?::JSONB)`,
      [
        organizationId,
        userId,
        JSON.stringify({ secretId, connectorId: ex.connector_id, secretKey: ex.secret_key }),
      ]
    );

    return res.json({
      data: { success: true, secretId, rotatedAt: new Date().toISOString() },
      meta: syncMutationMeta(),
    });
  })
);

// ── Inbound webhook receiver ────────────────────────────────────

router.post(
  '/webhooks/inbound/:registrationId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const registrationId =
      typeof req.params.registrationId === 'string' ? req.params.registrationId.trim() : '';

    const reg = await dbGet(
      `SELECT registration_id, integration_id, organization_id, secret_key, event_types, is_active, direction
       FROM v8_webhook_registrations
       WHERE registration_id = ?`,
      [registrationId]
    );

    if (!reg) {
      return res.status(404).json({ error: 'Webhook registration not found' });
    }

    const r = reg as Record<string, unknown>;

    if (!r.is_active) {
      return res.status(410).json({ error: 'Webhook registration is inactive' });
    }
    if (r.direction !== 'inbound') {
      return res.status(400).json({ error: 'Registration is not an inbound webhook' });
    }

    if (r.secret_key) {
      const signature = req.headers['x-webhook-signature'] as string | undefined;
      if (!signature) {
        return res.status(401).json({ error: 'Missing x-webhook-signature header' });
      }
      const crypto = await import('crypto');
      const rawBody = JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha256', String(r.secret_key))
        .update(rawBody)
        .digest('hex');
      if (signature !== expected) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const { eventType, payload } = req.body as { eventType?: string; payload?: unknown };
    const resolvedEventType = eventType || 'generic';

    let allowedTypes: string[] = [];
    try {
      allowedTypes = JSON.parse(String(r.event_types || '[]'));
    } catch {
      /* */
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(resolvedEventType)) {
      return res.status(422).json({ error: `Event type '${resolvedEventType}' is not registered` });
    }

    const crypto2 = await import('crypto');
    const payloadHash = crypto2
      .createHash('sha256')
      .update(JSON.stringify(payload || {}))
      .digest('hex');

    const existingDelivery = await dbGet(
      `SELECT delivery_id FROM v8_webhook_deliveries
       WHERE registration_id = ? AND payload_hash = ? AND status = 'delivered'
       LIMIT 1`,
      [registrationId, payloadHash]
    );
    if (existingDelivery) {
      return res.json({ data: { accepted: true, deduplicated: true } });
    }

    await dbRun(
      `INSERT INTO v8_webhook_deliveries (delivery_id, registration_id, organization_id, event_type, payload_hash, status, attempt_count, completed_at)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, 'delivered', 1, NOW())`,
      [registrationId, r.organization_id, resolvedEventType, payloadHash]
    );

    await dbRun(
      `UPDATE v8_webhook_registrations SET last_delivery_at = NOW(), consecutive_failures = 0 WHERE registration_id = ?`,
      [registrationId]
    );

    await dbRun(
      `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'webhook_received', 'system', 'webhook', ?::JSONB)`,
      [
        r.organization_id,
        r.integration_id,
        JSON.stringify({ registrationId, eventType: resolvedEventType }),
      ]
    );

    return res.json({
      data: { accepted: true, deduplicated: false, eventType: resolvedEventType },
    });
  })
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
  })
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
  })
);

router.post(
  '/auth/escalations/:escalationId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const escalationId =
      typeof req.params.escalationId === 'string' ? req.params.escalationId.trim() : '';
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
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to resolve auth escalation';
      if (rawMessage.includes('not found')) {
        return res
          .status(404)
          .json({ error: 'Auth escalation not found', code: 'AUTH_ESCALATION_NOT_FOUND' });
      }
      if (rawMessage.includes('already resolved')) {
        return res.status(409).json({
          error: 'Auth escalation already resolved',
          code: 'AUTH_ESCALATION_ALREADY_RESOLVED',
        });
      }
      throw error;
    }
  })
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
  })
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
  })
);

router.get(
  '/connectors/:connectorId/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const connectorId =
      typeof req.params.connectorId === 'string' ? req.params.connectorId.trim() : '';
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
  })
);

router.post(
  '/connectors/:connectorId/auth-state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const connectorId =
      typeof req.params.connectorId === 'string' ? req.params.connectorId.trim() : '';
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
      if (parsed.data.targetState === 'healthy') {
        await resolveAuthEscalationsForConnector(connectorId, transitionedBy, organizationId);
      }
      return res.json({
        data: { record },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to update auth state';
      if (rawMessage.includes('Invalid auth state transition')) {
        return res
          .status(409)
          .json({ error: 'Invalid auth state transition', code: 'INVALID_AUTH_TRANSITION' });
      }
      throw error;
    }
  })
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
  })
);

router.post(
  '/conflicts/:conflictId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const conflictId =
      typeof req.params.conflictId === 'string' ? req.params.conflictId.trim() : '';
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
        organizationId
      );
      return res.json({
        data: { conflict },
        meta: syncMutationMeta(),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to resolve conflict';
      if (rawMessage.includes('not found')) {
        return res.status(404).json({ error: 'Conflict not found', code: 'CONFLICT_NOT_FOUND' });
      }
      if (rawMessage.includes('already resolved')) {
        return res
          .status(409)
          .json({ error: 'Conflict already resolved', code: 'CONFLICT_ALREADY_RESOLVED' });
      }
      throw error;
    }
  })
);

export default router;
