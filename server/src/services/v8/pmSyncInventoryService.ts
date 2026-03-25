import { all as dbAll } from '../../utils/DbPromise.js';
import { CONNECTORS } from '../integrationHubService.js';
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
  connector: {
    id: string;
    name: string;
    category: string;
    capabilities: string[];
    authType: string;
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

function mapInventoryHealth(status: string, healthy: boolean): 'healthy' | 'degraded' | 'unhealthy' {
  if (healthy) return 'healthy';
  if (['error', 'dead_letter', 'conflict'].includes(status)) return 'unhealthy';
  return 'degraded';
}

function mapIntegrationStatus(rowStatus: string, authState: string): string {
  if (authState === 'degraded_reauth_needed') return 'requires_reauth';
  if (authState === 'connecting' || rowStatus === 'pending') return 'pending';
  if (authState === 'disconnected' || authState === 'not_connected') return 'disconnected';
  return rowStatus;
}

function mapErrorRate(status: string, healthy: boolean, conflictCount: number): number {
  if (healthy && conflictCount === 0) return 0;
  if (['error', 'dead_letter'].includes(status)) return 100;
  if (status === 'conflict' || conflictCount > 0) return 50;
  return 25;
}

export async function listGovernedIntegrations(
  organizationId: string,
): Promise<V8SyncIntegrationInventoryRow[]> {
  const rows = await dbAll<IntegrationRow>(
    `SELECT * FROM integrations
     WHERE organization_id = ?
     ORDER BY created_at DESC`,
    [organizationId],
  );

  return Promise.all(
    (rows || []).map(async (row) => {
      const health = await getConnectorHealth(row.connector_id, organizationId);
      const lastRunRows = await dbAll<SyncRunRow>(
        `SELECT id, status, items_processed, duration_ms, started_at, completed_at, error_summary
         FROM integration_sync_runs
         WHERE integration_id = ?
         ORDER BY started_at DESC
         LIMIT 1`,
        [row.id],
      );
      const connector = CONNECTORS[row.connector_id];
      const capabilities = safeJsonParse<string[]>(row.capabilities, connector?.capabilities ?? []);
      const derivedStatus = mapIntegrationStatus(row.status, health.authState);
      const derivedHealth = mapInventoryHealth(health.syncStatus, health.healthy);

      return {
        id: row.id,
        connectorId: row.connector_id,
        name: row.name || connector?.name || row.connector_id,
        category: row.category || connector?.category || 'collaboration',
        status: derivedStatus,
        lastSyncAt: row.last_sync_at ?? health.lastSyncAt ?? null,
        lastError:
          row.last_error ??
          (health.conflictCount > 0 ? `Governed sync reports ${health.conflictCount} open conflicts` : null),
        health: derivedHealth,
        errorRate: mapErrorRate(health.syncStatus, health.healthy, health.conflictCount),
        unresolvedErrors: health.conflictCount,
        lastRun: lastRunRows[0] ?? null,
        connector: connector
          ? {
              id: connector.id,
              name: connector.name,
              category: connector.category,
              capabilities,
              authType: connector.authType,
            }
          : null,
      };
    }),
  );
}
