import { v8Get, v8Post } from './client';

export interface V8SyncCredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

export type V8SyncProviderFamily =
  | 'google_workspace'
  | 'microsoft_365'
  | 'atlassian'
  | 'asana'
  | 'monday'
  | 'clickup'
  | 'linear';

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

export interface V8SyncWorkflowRecord {
  workflowId: string;
  integrationId: string;
  connectorId: string;
  name: string;
  lifecycleState: 'draft' | 'connected' | 'degraded' | 'requires_action' | 'recovered' | 'blocked';
  mode: 'manual' | 'schedule' | 'webhook';
  isPaused: boolean;
  syncSchedule: string | null;
  scopes: string[];
  hasMappings: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface V8SyncRunRecord {
  id: string;
  integrationId: string;
  provider: string;
  direction: string;
  status: string;
  lifecycleState: 'draft' | 'connected' | 'degraded' | 'requires_action';
  canReplay: boolean;
  itemsProcessed: number | null;
  durationMs: number | null;
  errorSummary: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
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

export interface V8SyncRefreshTimingPolicy {
  policyId: string;
  providerFamily: V8SyncProviderFamily;
  organizationId: string;
  typicalTokenLifetimeMinutes: number;
  refreshWindowMinutes: number;
  maxRetryAttempts: number;
  createdAt: string;
  updatedAt: string;
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
  configuredFields: string[];
  onboardingStatus:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'authorization_callback_received_pending_verification'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation'
    | null;
  credential: V8SyncConnectionCredentialRef | null;
  connector: {
    id: string;
    name: string;
    category: string;
    capabilities: string[];
    authType: string;
    configFields: string[];
  } | null;
}

export interface V8SyncConnectionCredentialRef {
  credentialId: string;
  connectorId: string;
  organizationId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface V8SyncCatalogConnector {
  id: string;
  name: string;
  category: string;
  capabilities: string[];
  authType: string;
  configFields: string[];
  isAvailable: boolean;
  isV2Ready: boolean;
  comingSoon: boolean;
}

export interface V8SyncInitiatedIntegration {
  id: string;
  connectorId: string;
  name: string;
  category: string;
  status: 'pending';
  capabilities: string[];
  authType: string;
  configFields: string[];
  scopes: string[];
}

export interface V8SyncConfiguredIntegration {
  id: string;
  connectorId: string;
  status: string;
  configuredFields: string[];
  onboardingStatus:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'authorization_callback_received_pending_verification'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation';
}

export interface V8SyncExternalAuthSession {
  authUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
}

export interface V8SyncRefreshSecretRef {
  connectorId: string;
  organizationId: string;
  clientIdPresent: boolean;
  refreshTokenPresent: boolean;
  tokenEndpoint: string;
}

export interface V8SyncHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

export interface V8SyncErrorItem {
  id: string;
  integrationId: string;
  errorType: string;
  errorMessage: string;
  isRetryable: boolean;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export interface V8SyncAuditEntry {
  id: string;
  integration_id: string;
  action: string;
  actor_name: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface V8SyncTriggeredRun {
  id: string;
  status: string;
  recordsSynced: number;
  duration: number;
}

export interface V8SyncMappingData {
  integrationId: string;
  connectorId: string;
  fieldMappings: unknown[];
  entityMappings: {
    id: string;
    localType: string;
    localId: string;
    externalType: string;
    externalId: string;
    syncStatus: string;
    lastSyncedAt: string | null;
  }[];
  driftEvents: {
    driftId: string;
    driftType: string;
    affectedFields: string;
    detectedAt: string;
    resolvedAt: string | null;
  }[];
  syncStates: {
    id: string;
    objectType: string;
    objectId: string;
    syncStatus: string;
    errorClass: string | null;
    lastSyncedAt: string | null;
  }[];
}

export interface V8SyncSecretsStatusData {
  secrets: {
    secretId: string;
    connectorId: string | null;
    secretKey: string;
    lastRotatedAt: string;
    ageDays: number;
    needsRotation: boolean;
    rotationThresholdDays: number;
  }[];
  summary: {
    total: number;
    needsRotation: number;
    healthy: number;
  };
}

export interface V8SyncWorkflowPolicyData {
  integrationId: string;
  workflowPolicy: 'active' | 'paused' | 'blocked' | 'safety_gate';
  reason: string | null;
  setBy: string | null;
  setAt: string | null;
  isPaused: boolean;
}

export const shouldFallbackToLegacySync = (error: any) => {
  const status = Number(error?.status);
  // V8 sync endpoints live under `/api/v8/*` and are gated by org-level V8 enablement.
  // In admin surfaces we still want the legacy `/api/sync-hub/*` to work even when V8 is disabled.
  // `v8OrgGate` returns 404 with code `V8_ORG_DISABLED` when V8 is not enabled for an org.
  if (status === 404 && String(error?.data?.code || '') === 'V8_ORG_DISABLED') return true;
  return [400, 404, 405, 501].includes(status);
};

export const V8SyncApi = {
  getIntegrations: () =>
    v8Get<{ integrations: V8SyncIntegrationInventoryRow[]; count: number }>('/sync/integrations'),
  getWorkflows: () =>
    v8Get<{ workflows: V8SyncWorkflowRecord[]; count: number }>('/sync/workflows'),
  getConnectors: (params?: { category?: string }) =>
    v8Get<{ connectors: V8SyncCatalogConnector[]; count: number }>(
      '/sync/connectors',
      params?.category ? { category: params.category } : undefined
    ),
  connectIntegration: (
    connectorId: string,
    payload?: { config?: Record<string, unknown>; displayName?: string }
  ) =>
    v8Post<{
      integration: V8SyncInitiatedIntegration;
      onboardingStatus: 'pending_external_auth_or_configuration';
      externalAuth?: V8SyncExternalAuthSession;
    }>(`/sync/connectors/${encodeURIComponent(connectorId)}/connect`, payload ?? {}),
  configureIntegration: (integrationId: string, payload: { config?: Record<string, unknown> }) =>
    v8Post<{
      integration: V8SyncConfiguredIntegration;
      externalAuth?: V8SyncExternalAuthSession;
    }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/configure`,
      payload ?? { config: {} }
    ),
  getHubHealth: () => v8Get<{ summary: V8SyncHealthSummary }>('/sync/health'),
  getErrors: (params?: { integrationId?: string }) =>
    v8Get<{ errors: V8SyncErrorItem[]; count: number }>(
      '/sync/errors',
      params?.integrationId ? { integrationId: params.integrationId } : undefined
    ),
  resolveError: (errorId: string) =>
    v8Post<{ success: true }>(`/sync/errors/${encodeURIComponent(errorId)}/resolve`, {}),
  reauthIntegration: (integrationId: string) =>
    v8Post<{
      success: true;
      message: string;
      onboardingStatus:
        | 'pending_external_auth_or_configuration'
        | 'pending_external_auth'
        | 'authorization_callback_received_pending_verification'
        | 'pending_configuration'
        | 'configuration_submitted_pending_validation';
      externalAuth?: V8SyncExternalAuthSession;
    }>(`/sync/integrations/${encodeURIComponent(integrationId)}/reauth`, {}),
  materializeCredential: (
    integrationId: string,
    payload: {
      providerAccountId: string;
      workspaceOrTenantId: string;
      scopesGranted: string[];
      tokenExpiresAt?: string | null;
    }
  ) =>
    v8Post<{ credential: V8SyncConnectionCredentialRef }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/credential`,
      payload
    ),
  storeRefreshSecret: (
    integrationId: string,
    payload: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      tokenEndpoint?: string;
    }
  ) =>
    v8Post<{ refreshSecret: V8SyncRefreshSecretRef }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/refresh-secret`,
      payload
    ),
  recordRefreshResult: (
    integrationId: string,
    payload: { result: 'success' | 'transient_failure' | 'credential_expired' | 'scope_revoked' }
  ) =>
    v8Post<{
      credential: V8SyncConnectionCredentialRef;
      authTransition: 'healthy' | 'degraded_reauth_needed' | null;
    }>(`/sync/integrations/${encodeURIComponent(integrationId)}/refresh-result`, payload),
  disconnectIntegration: (integrationId: string) =>
    v8Post<{ success: true }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/disconnect`,
      {}
    ),
  pauseIntegration: (integrationId: string) =>
    v8Post<{ success: true }>(`/sync/integrations/${encodeURIComponent(integrationId)}/pause`, {}),
  resumeIntegration: (integrationId: string) =>
    v8Post<{ success: true }>(`/sync/integrations/${encodeURIComponent(integrationId)}/resume`, {}),
  runIntegrationSync: (integrationId: string) =>
    v8Post<{ success: true; syncRun: V8SyncTriggeredRun; warnings?: string[] }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/sync`,
      {}
    ),
  getAuditLog: (params?: { integrationId?: string; limit?: number }) =>
    v8Get<{ entries: V8SyncAuditEntry[]; count: number }>('/sync/audit-log', {
      ...(params?.integrationId ? { integrationId: params.integrationId } : {}),
      ...(typeof params?.limit === 'number' ? { limit: String(params.limit) } : {}),
    }),
  getAuthHealth: () => v8Get<{ summary: V8SyncCredentialHealthSummary }>('/sync/auth/health'),
  getAuthEscalations: () =>
    v8Get<{ escalations: V8SyncAuthEscalation[]; count: number }>('/sync/auth/escalations'),
  getRefreshTimingPolicy: (providerFamily: V8SyncProviderFamily) =>
    v8Get<{ policy: V8SyncRefreshTimingPolicy | null }>(
      `/sync/auth/policies/${encodeURIComponent(providerFamily)}`
    ),
  setRefreshTimingPolicy: (
    providerFamily: V8SyncProviderFamily,
    payload: Pick<
      V8SyncRefreshTimingPolicy,
      'typicalTokenLifetimeMinutes' | 'refreshWindowMinutes' | 'maxRetryAttempts'
    >
  ) =>
    v8Post<{ policy: V8SyncRefreshTimingPolicy }>(
      `/sync/auth/policies/${encodeURIComponent(providerFamily)}`,
      payload
    ),
  resolveAuthEscalation: (escalationId: string) =>
    v8Post<{ escalation: V8SyncAuthEscalation }>(
      `/sync/auth/escalations/${encodeURIComponent(escalationId)}/resolve`,
      {}
    ),
  setConnectorAuthState: (
    connectorId: string,
    targetState: V8SyncConnectorAuthState,
    reason?: string | null
  ) =>
    v8Post<{ record: V8SyncConnectorAuthRecord }>(
      `/sync/connectors/${encodeURIComponent(connectorId)}/auth-state`,
      { targetState, reason: reason ?? null }
    ),
  resolveConflict: (conflictId: string, resolutionPath: V8SyncConflictResolutionPath = 'dismiss') =>
    v8Post<{ conflict: V8SyncConflictRecord }>(
      `/sync/conflicts/${encodeURIComponent(conflictId)}/resolve`,
      { resolutionPath }
    ),
  getConnectorHealth: (connectorId: string) =>
    v8Get<{ connectorId: string; health: V8SyncConnectorHealthSummary }>(
      `/sync/connectors/${encodeURIComponent(connectorId)}/health`
    ),
  getConflicts: (limit = 10) =>
    v8Get<{ conflicts: V8SyncConflictRecord[]; count: number }>('/sync/conflicts', {
      limit: String(limit),
    }),
  replayRun: (runId: string) =>
    v8Post<{ replayRunId: string; originalRunId: string; status: string }>(
      `/sync/runs/${encodeURIComponent(runId)}/replay`,
      {}
    ),
  getRuns: (params?: {
    integrationId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) =>
    v8Get<{ runs: V8SyncRunRecord[]; total: number }>('/sync/runs', {
      ...(params?.integrationId ? { integrationId: params.integrationId } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(typeof params?.limit === 'number' ? { limit: String(params.limit) } : {}),
      ...(typeof params?.offset === 'number' ? { offset: String(params.offset) } : {}),
    }),

  getMappings: (integrationId: string) =>
    v8Get<V8SyncMappingData>(`/sync/integrations/${encodeURIComponent(integrationId)}/mappings`),

  saveMappings: (integrationId: string, fieldMappings: unknown[]) =>
    v8Post<{ success: true; fieldCount: number }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/mappings`,
      { fieldMappings }
    ),

  getSecretsStatus: () => v8Get<V8SyncSecretsStatusData>('/sync/secrets/status'),

  rotateSecret: (secretId: string) =>
    v8Post<{ success: true; secretId: string; rotatedAt: string }>(
      `/sync/secrets/${encodeURIComponent(secretId)}/rotate`,
      {}
    ),

  getWorkflowPolicy: (integrationId: string) =>
    v8Get<V8SyncWorkflowPolicyData>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/workflow-policy`
    ),

  setWorkflowPolicy: (integrationId: string, policy: string, reason?: string) =>
    v8Post<{ success: true; policy: string; isPaused: boolean }>(
      `/sync/integrations/${encodeURIComponent(integrationId)}/workflow-policy`,
      { policy, reason }
    ),
};
