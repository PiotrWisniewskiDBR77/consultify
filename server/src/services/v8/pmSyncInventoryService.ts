import { all as dbAll } from '../../utils/DbPromise.js';
import { CONNECTORS } from '../integrationHubService.js';
import { getCredential } from './pmSyncAuthService.js';
import { getGovernedExternalAuthConfigFields } from './pmSyncExternalAuthMaterializationService.js';
import { getConnectorHealth } from './pmSyncTruthService.js';

interface IntegrationRow {
  id: string;
  organization_id: string;
  connector_id: string;
  name: string;
  category: string;
  status: string;
  config: string | null;
  capabilities: string | null;
  auth_type: string;
  sync_settings: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SyncRunRow {
  id: string;
  status: string;
  items_processed: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
}

export interface V8SyncIntegrationInventoryRow {
  id: string;
  connectorId: string;
  name: string;
  category: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  health: 'healthy' | 'degraded' | 'unhealthy';
  errorRate: number;
  unresolvedErrors: number;
  lastRun: SyncRunRow | null;
  configuredFields: string[];
  onboardingStatus:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'authorization_callback_received_pending_verification'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation'
    | null;
  credential: {
    providerAccountId: string;
    workspaceOrTenantId: string;
    scopesGranted: string[];
    tokenExpiresAt: string | null;
    lastVerificationAt: string | null;
    lastRefreshAt: string | null;
    lastRefreshResult:
      | 'success'
      | 'transient_failure'
      | 'credential_expired'
      | 'scope_revoked'
      | null;
  } | null;
  connector: {
    id: string;
    name: string;
    category: string;
    capabilities: string[];
    authType: string;
    configFields: string[];
  } | null;
}

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

function mapOnboardingStatus(
  status: string,
  authType: string,
  configFields: string[],
  configuredFields: string[]
):
  | 'pending_external_auth_or_configuration'
  | 'pending_external_auth'
  | 'authorization_callback_received_pending_verification'
  | 'pending_configuration'
  | 'configuration_submitted_pending_validation'
  | null {
  if (status !== 'pending') return null;

  if (authType === 'oauth2' && configuredFields.length >= configFields.length) {
    return 'pending_external_auth';
  }

  if (status === 'pending' && authType === 'oauth2' && configFields.length === 0) {
    return 'pending_external_auth';
  }

  const hasAllConfigFields =
    configFields.length === 0 || configuredFields.length >= configFields.length;

  return hasAllConfigFields
    ? 'configuration_submitted_pending_validation'
    : 'pending_configuration';
}

function mapPendingOnboardingStatusFromAuth(
  status: string,
  authState: string,
  authType: string,
  configFields: string[],
  configuredFields: string[]
):
  | 'pending_external_auth_or_configuration'
  | 'pending_external_auth'
  | 'authorization_callback_received_pending_verification'
  | 'pending_configuration'
  | 'configuration_submitted_pending_validation'
  | null {
  if (status !== 'pending') return null;

  if (authState === 'connected_pending_verification') {
    return 'authorization_callback_received_pending_verification';
  }

  const hasAllRequiredFields =
    configFields.length === 0 || configuredFields.length >= configFields.length;

  if (authType === 'oauth2') {
    return hasAllRequiredFields
      ? 'pending_external_auth'
      : 'pending_external_auth_or_configuration';
  }

  return hasAllRequiredFields
    ? 'configuration_submitted_pending_validation'
    : 'pending_configuration';
}

function mapInventoryHealth(
  status: string,
  healthy: boolean
): 'healthy' | 'degraded' | 'unhealthy' {
  if (healthy) return 'healthy';
  if (['error', 'dead_letter', 'conflict'].includes(status)) return 'unhealthy';
  return 'degraded';
}

function mapIntegrationStatus(rowStatus: string, authState: string): string {
  if (authState === 'degraded_reauth_needed') return 'requires_reauth';
  if (authState === 'disconnected' || authState === 'not_connected') return 'disconnected';
  if (authState === 'healthy' && rowStatus === 'pending') return 'connected';
  if (
    authState === 'connecting' ||
    authState === 'connected_pending_verification' ||
    rowStatus === 'pending'
  ) {
    return 'pending';
  }
  return rowStatus;
}

function mapErrorRate(status: string, healthy: boolean, conflictCount: number): number {
  if (healthy && conflictCount === 0) return 0;
  if (['error', 'dead_letter'].includes(status)) return 100;
  if (status === 'conflict' || conflictCount > 0) return 50;
  return 25;
}

/**
 * Batch-fetch the single most recent sync run for each integration in ONE query
 * instead of one `LIMIT 1` query per integration (the previous N+1 — painful on
 * staging where each round-trip is ~150ms). Uses ROW_NUMBER() to keep only the
 * latest run per integration_id; the caller maps by integration id in memory.
 */
async function loadLastRunsByIntegrationId(
  organizationId: string,
  integrationIds: string[]
): Promise<Map<string, SyncRunRow>> {
  const result = new Map<string, SyncRunRow>();
  if (integrationIds.length === 0) return result;
  const placeholders = integrationIds.map(() => '?').join(', ');
  const runRows = await dbAll<SyncRunRow & { integration_id: string }>(
    `SELECT id, integration_id, status, items_processed, duration_ms,
            started_at, completed_at, error_summary
     FROM (
       SELECT r.*,
              ROW_NUMBER() OVER (
                PARTITION BY r.integration_id
                ORDER BY r.started_at DESC
              ) AS rn
       FROM integration_sync_runs r
       WHERE r.organization_id = ?
         AND r.integration_id IN (${placeholders})
     ) ranked
     WHERE ranked.rn = 1`,
    [organizationId, ...integrationIds]
  );
  for (const run of runRows || []) {
    if (!result.has(run.integration_id)) {
      const { integration_id: _ignored, ...syncRun } = run;
      void _ignored;
      result.set(run.integration_id, syncRun as SyncRunRow);
    }
  }
  return result;
}

export async function listGovernedIntegrations(
  organizationId: string
): Promise<V8SyncIntegrationInventoryRow[]> {
  const rows = await dbAll<IntegrationRow>(
    `SELECT * FROM integrations
     WHERE organization_id = ?
     ORDER BY created_at DESC`,
    [organizationId]
  );

  // Batch the per-integration "last sync run" lookup into a single query
  // (replaces the previous one-query-per-row N+1).
  const lastRunByIntegrationId = await loadLastRunsByIntegrationId(
    organizationId,
    (rows || []).map((row) => row.id)
  );

  return Promise.all(
    (rows || []).map(async (row) => {
      const health = await getConnectorHealth(row.connector_id, organizationId);
      const lastRun = lastRunByIntegrationId.get(row.id) ?? null;
      const connector = CONNECTORS[row.connector_id];
      const credential = await getCredential(row.connector_id, organizationId);
      const capabilities = safeJsonParse<string[]>(row.capabilities, connector?.capabilities ?? []);
      const parsedConfig = safeJsonParse<Record<string, unknown>>(row.config, {});
      const connectorConfigFields = connector
        ? getConnectorConfigFields(connector.id, connector.configFields)
        : [];
      const derivedStatus = mapIntegrationStatus(row.status, health.authState);
      const derivedHealth = mapInventoryHealth(health.syncStatus, health.healthy);
      const configuredFields = connector
        ? getConfiguredFields(connectorConfigFields, parsedConfig)
        : [];
      const onboardingStatus = connector
        ? mapPendingOnboardingStatusFromAuth(
            derivedStatus,
            health.authState,
            connector.authType,
            connectorConfigFields,
            configuredFields
          )
        : null;

      return {
        id: row.id,
        connectorId: row.connector_id,
        name: row.name || connector?.name || row.connector_id,
        category: row.category || connector?.category || 'collaboration',
        status: derivedStatus,
        lastSyncAt: row.last_sync_at ?? health.lastSyncAt ?? null,
        lastError:
          row.last_error ??
          (health.conflictCount > 0
            ? `Governed sync reports ${health.conflictCount} open conflicts`
            : null),
        health: derivedHealth,
        errorRate: mapErrorRate(health.syncStatus, health.healthy, health.conflictCount),
        unresolvedErrors: health.conflictCount,
        lastRun,
        configuredFields,
        onboardingStatus,
        credential: credential
          ? {
              providerAccountId: credential.providerAccountId,
              workspaceOrTenantId: credential.workspaceOrTenantId,
              scopesGranted: credential.scopesGranted,
              tokenExpiresAt: credential.tokenExpiresAt,
              lastVerificationAt: credential.lastVerificationAt,
              lastRefreshAt: credential.lastRefreshAt,
              lastRefreshResult: credential.lastRefreshResult,
            }
          : null,
        connector: connector
          ? {
              id: connector.id,
              name: connector.name,
              category: connector.category,
              capabilities,
              authType: connector.authType,
              configFields: connectorConfigFields,
            }
          : null,
      };
    })
  );
}
