import { v8Get } from './client';

export interface V8SyncCredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

export interface V8SyncAuthEscalation {
  escalationId: string;
  organizationId: string;
  connectorId: string;
  reason: string | null;
  escalatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface V8SyncConflictRecord {
  conflictId: string;
  objectSyncStateId: string;
  organizationId: string;
  conflictClass: string;
  severity: string;
  resolutionPath: string | null;
  resolutionStrategy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface V8SyncConnectorHealthSummary {
  healthy: boolean;
  syncStatus: string;
  conflictCount: number;
  lastSyncAt: string | null;
  authState: string;
}

export interface V8SyncRunSummary {
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
  lastRun: V8SyncRunSummary | null;
  connector: {
    id: string;
    name: string;
    category: string;
    capabilities: string[];
    authType: string;
  } | null;
}

export const V8SyncApi = {
  getIntegrations: () =>
    v8Get<{ integrations: V8SyncIntegrationInventoryRow[]; count: number }>('/sync/integrations'),
  getAuthHealth: () => v8Get<{ summary: V8SyncCredentialHealthSummary }>('/sync/auth/health'),
  getAuthEscalations: () =>
    v8Get<{ escalations: V8SyncAuthEscalation[]; count: number }>('/sync/auth/escalations'),
  getConnectorHealth: (connectorId: string) =>
    v8Get<{ connectorId: string; health: V8SyncConnectorHealthSummary }>(
      `/sync/connectors/${encodeURIComponent(connectorId)}/health`,
    ),
  getConflicts: (limit = 10) =>
    v8Get<{ conflicts: V8SyncConflictRecord[]; count: number }>('/sync/conflicts', {
      limit: String(limit),
    }),
};
