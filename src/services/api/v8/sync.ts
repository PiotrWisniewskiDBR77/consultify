import { v8Get, v8Post } from './client';

export interface V8SyncCredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

export type V8SyncConnectorAuthState =
  | 'not_connected'
  | 'connecting'
  | 'connected_pending_verification'
  | 'healthy'
  | 'degraded_reauth_needed'
  | 'degraded_scope_limited'
  | 'suspended'
  | 'disconnected';

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

export interface V8SyncConnectorAuthRecord {
  recordId: string;
  connectorId: string;
  organizationId: string;
  authState: V8SyncConnectorAuthState;
  previousState: V8SyncConnectorAuthState | null;
  transitionedAt: string;
  transitionedBy: string;
  reason: string | null;
}

export type V8SyncConflictResolutionPath =
  | 'auto_resolve_by_authority'
  | 'manual_review'
  | 'remap'
  | 'replay_after_fix'
  | 'dismiss'
  | 'escalate';

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
  resolveAuthEscalation: (escalationId: string) =>
    v8Post<{ escalation: V8SyncAuthEscalation }>(
      `/sync/auth/escalations/${encodeURIComponent(escalationId)}/resolve`,
      {},
    ),
  setConnectorAuthState: (
    connectorId: string,
    targetState: V8SyncConnectorAuthState,
    reason?: string | null,
  ) =>
    v8Post<{ record: V8SyncConnectorAuthRecord }>(
      `/sync/connectors/${encodeURIComponent(connectorId)}/auth-state`,
      { targetState, reason: reason ?? null },
    ),
  resolveConflict: (conflictId: string, resolutionPath: V8SyncConflictResolutionPath = 'dismiss') =>
    v8Post<{ conflict: V8SyncConflictRecord }>(
      `/sync/conflicts/${encodeURIComponent(conflictId)}/resolve`,
      { resolutionPath },
    ),
  getConnectorHealth: (connectorId: string) =>
    v8Get<{ connectorId: string; health: V8SyncConnectorHealthSummary }>(
      `/sync/connectors/${encodeURIComponent(connectorId)}/health`,
    ),
  getConflicts: (limit = 10) =>
    v8Get<{ conflicts: V8SyncConflictRecord[]; count: number }>('/sync/conflicts', {
      limit: String(limit),
    }),
};
