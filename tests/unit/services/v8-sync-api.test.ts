import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8SyncApi, shouldFallbackToLegacySync } from '@/services/api/v8/sync';
import { v8Get, v8Post } from '@/services/api/v8/client';

describe('V8SyncApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests sync auth health from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      summary: {
        total: 12,
        healthy: 9,
        failing: 2,
        escalated: 1,
      },
    });

    const data = await V8SyncApi.getAuthHealth();

    expect(v8Get).toHaveBeenCalledWith('/sync/auth/health');
    expect(data.summary.total).toBe(12);
    expect(data.summary.escalated).toBe(1);
  });

  it('requests governed sync integrations from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      integrations: [
        {
          id: 'int-1',
          connectorId: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'connected',
          lastSyncAt: null,
          lastError: null,
          health: 'healthy',
          errorRate: 0,
          unresolvedErrors: 0,
          lastRun: null,
          connector: {
            id: 'jira',
            name: 'Jira',
            category: 'project_management',
            capabilities: ['issues'],
            authType: 'oauth2',
          },
        },
      ],
      count: 1,
    });

    const data = await V8SyncApi.getIntegrations();

    expect(v8Get).toHaveBeenCalledWith('/sync/integrations');
    expect(data.count).toBe(1);
    expect(data.integrations[0].connectorId).toBe('jira');
  });

  it('requests governed connector catalog from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      connectors: [
        {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
          configFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
          isAvailable: true,
          isV2Ready: true,
          comingSoon: false,
        },
      ],
      count: 1,
    });

    const data = await V8SyncApi.getConnectors({ category: 'project_management' });

    expect(v8Get).toHaveBeenCalledWith('/sync/connectors', { category: 'project_management' });
    expect(data.count).toBe(1);
    expect(data.connectors[0].id).toBe('jira');
    expect(data.connectors[0].configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
  });

  it('posts connect initiation to the governed V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      integration: {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'pending',
        capabilities: ['issues'],
        authType: 'oauth2',
        configFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        scopes: ['read:issues'],
      },
      onboardingStatus: 'pending_external_auth_or_configuration',
    });

    const data = await V8SyncApi.connectIntegration('jira');

    expect(v8Post).toHaveBeenCalledWith('/sync/connectors/jira/connect', {});
    expect(data.integration.status).toBe('pending');
    expect(data.onboardingStatus).toBe('pending_external_auth_or_configuration');
    expect(data.integration.configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
  });

  it('posts pending configuration updates to the governed V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      integration: {
        id: 'int-1',
        connectorId: 'jira',
        status: 'pending',
        configuredFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        onboardingStatus: 'pending_external_auth',
      },
      externalAuth: {
        authUrl: 'https://auth.atlassian.com/authorize?state=abc',
        callbackUrl: 'https://example.com/api/sync-hub/external-auth/callback?state=abc',
        state: 'abc',
        expiresAt: '2026-03-27T19:00:00.000Z',
      },
    });

    const data = await V8SyncApi.configureIntegration('int-1', {
      config: {
        site_url: 'https://example.atlassian.net',
        cloud_id: 'cloud-123',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      },
    });

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/configure', {
      config: {
        site_url: 'https://example.atlassian.net',
        cloud_id: 'cloud-123',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      },
    });
    expect(data.integration.configuredFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
    expect(data.integration.onboardingStatus).toBe('pending_external_auth');
    expect(data.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(data.externalAuth?.state).toBe('abc');
  });

  it('posts governed reauthorization without claiming immediate recovery', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      message: 'Re-authorization initiated',
      onboardingStatus: 'pending_external_auth',
      externalAuth: {
        authUrl: 'https://auth.atlassian.com/authorize?state=reauth',
        callbackUrl: 'https://example.com/api/sync-hub/external-auth/callback?state=reauth',
        state: 'reauth',
        expiresAt: '2026-03-27T19:00:00.000Z',
      },
    });

    const data = await V8SyncApi.reauthIntegration('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/reauth', {});
    expect(data.success).toBe(true);
    expect(data.onboardingStatus).toBe('pending_external_auth');
    expect(data.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(data.externalAuth?.state).toBe('reauth');
  });

  it('posts governed credential materialization to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      credential: {
        credentialId: 'cred-1',
        connectorId: 'jira',
        organizationId: 'org-1',
        providerAccountId: 'acct-123',
        workspaceOrTenantId: 'tenant-456',
        scopesGranted: ['read:jira-work'],
        tokenExpiresAt: '2026-03-27T19:00:00.000Z',
        lastVerificationAt: '2026-03-27T18:00:00.000Z',
        lastRefreshAt: null,
        lastRefreshResult: null,
        createdAt: '2026-03-27T18:00:00.000Z',
        updatedAt: '2026-03-27T18:00:00.000Z',
      },
    });

    const data = await V8SyncApi.materializeCredential('int-1', {
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
    });

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/credential', {
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
    });
    expect(data.credential.providerAccountId).toBe('acct-123');
  });

  it('posts governed refresh secret materialization to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      refreshSecret: {
        connectorId: 'jira',
        organizationId: 'org-1',
        clientIdPresent: true,
        refreshTokenPresent: true,
        tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      },
    });

    const data = await V8SyncApi.storeRefreshSecret('int-1', {
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
    });

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/refresh-secret', {
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
    });
    expect(data.refreshSecret.connectorId).toBe('jira');
    expect(data.refreshSecret.clientIdPresent).toBe(true);
  });

  it('posts governed refresh result recording to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      credential: {
        credentialId: 'cred-1',
        connectorId: 'jira',
        organizationId: 'org-1',
        providerAccountId: 'acct-123',
        workspaceOrTenantId: 'tenant-456',
        scopesGranted: ['read:jira-work'],
        tokenExpiresAt: null,
        lastVerificationAt: '2026-03-27T18:00:00.000Z',
        lastRefreshAt: '2026-03-27T19:00:00.000Z',
        lastRefreshResult: 'credential_expired',
        createdAt: '2026-03-27T18:00:00.000Z',
        updatedAt: '2026-03-27T19:00:00.000Z',
      },
      authTransition: 'degraded_reauth_needed',
    });

    const data = await V8SyncApi.recordRefreshResult('int-1', {
      result: 'credential_expired',
    });

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/refresh-result', {
      result: 'credential_expired',
    });
    expect(data.credential.lastRefreshResult).toBe('credential_expired');
    expect(data.authTransition).toBe('degraded_reauth_needed');
  });

  it('requests governed hub health summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      summary: { total: 2, healthy: 1, degraded: 1, unhealthy: 0 },
    });

    const data = await V8SyncApi.getHubHealth();

    expect(v8Get).toHaveBeenCalledWith('/sync/health');
    expect(data.summary.degraded).toBe(1);
  });

  it('requests governed sync errors from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      errors: [
        {
          id: 'err-1',
          integrationId: 'int-1',
          errorType: 'AUTH',
          errorMessage: 'token expired',
          isRetryable: false,
          retryCount: 0,
          maxRetries: 3,
          createdAt: '2026-03-25T10:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8SyncApi.getErrors({ integrationId: 'int-1' });

    expect(v8Get).toHaveBeenCalledWith('/sync/errors', { integrationId: 'int-1' });
    expect(data.errors[0].integrationId).toBe('int-1');
  });

  it('posts sync error resolution to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8SyncApi.resolveError('err-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/errors/err-1/resolve', {});
    expect(data.success).toBe(true);
  });

  it('posts integration reauth to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, message: 'Re-authorization initiated' });

    const data = await V8SyncApi.reauthIntegration('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/reauth', {});
    expect(data.success).toBe(true);
  });

  it('posts integration disconnect to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8SyncApi.disconnectIntegration('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/disconnect', {});
    expect(data.success).toBe(true);
  });

  it('posts integration pause to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8SyncApi.pauseIntegration('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/pause', {});
    expect(data.success).toBe(true);
  });

  it('posts integration resume to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8SyncApi.resumeIntegration('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/resume', {});
    expect(data.success).toBe(true);
  });

  it('posts run-now sync to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      syncRun: {
        id: 'run-1',
        status: 'completed',
        recordsSynced: 12,
        duration: 345,
      },
      warnings: [],
    });

    const data = await V8SyncApi.runIntegrationSync('int-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/sync', {});
    expect(data.syncRun.status).toBe('completed');
    expect(data.syncRun.recordsSynced).toBe(12);
  });

  it('requests governed sync audit log from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      entries: [
        {
          id: 'audit-1',
          integration_id: 'int-1',
          action: 'sync_completed',
          actor_name: 'Ada',
          details: {},
          created_at: '2026-03-25T10:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8SyncApi.getAuditLog({ limit: 10 });

    expect(v8Get).toHaveBeenCalledWith('/sync/audit-log', { limit: '10' });
    expect(data.entries[0].action).toBe('sync_completed');
  });

  it('posts connector auth state mutation to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      record: {
        recordId: 'record-1',
        connectorId: 'jira',
        organizationId: 'org-1',
        authState: 'healthy',
        previousState: null,
        transitionedAt: '2026-03-25T13:00:00.000Z',
        transitionedBy: 'user-1',
        reason: null,
      },
    });

    const data = await V8SyncApi.setConnectorAuthState('jira', 'healthy');

    expect(v8Post).toHaveBeenCalledWith('/sync/connectors/jira/auth-state', {
      targetState: 'healthy',
      reason: null,
    });
    expect(data.record.authState).toBe('healthy');
    expect(data.record.connectorId).toBe('jira');
  });

  it('posts auth escalation resolution to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      escalation: {
        escalationId: 'esc-1',
        organizationId: 'org-1',
        connectorId: 'jira',
        reason: 'token expired',
        escalatedAt: '2026-03-25T13:00:00.000Z',
        resolvedAt: '2026-03-25T13:05:00.000Z',
        resolvedBy: 'user-1',
      },
    });

    const data = await V8SyncApi.resolveAuthEscalation('esc-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/auth/escalations/esc-1/resolve', {});
    expect(data.escalation.resolvedBy).toBe('user-1');
    expect(data.escalation.connectorId).toBe('jira');
  });

  it('requests refresh timing policy from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      policy: {
        policyId: 'policy-1',
        providerFamily: 'atlassian',
        organizationId: 'org-1',
        typicalTokenLifetimeMinutes: 120,
        refreshWindowMinutes: 15,
        maxRetryAttempts: 5,
        createdAt: '2026-03-25T13:00:00.000Z',
        updatedAt: '2026-03-25T13:05:00.000Z',
      },
    });

    const data = await V8SyncApi.getRefreshTimingPolicy('atlassian');

    expect(v8Get).toHaveBeenCalledWith('/sync/auth/policies/atlassian');
    expect(data.policy?.refreshWindowMinutes).toBe(15);
  });

  it('posts refresh timing policy mutation to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      policy: {
        policyId: 'policy-1',
        providerFamily: 'atlassian',
        organizationId: 'org-1',
        typicalTokenLifetimeMinutes: 120,
        refreshWindowMinutes: 15,
        maxRetryAttempts: 5,
        createdAt: '2026-03-25T13:00:00.000Z',
        updatedAt: '2026-03-25T13:05:00.000Z',
      },
    });

    const data = await V8SyncApi.setRefreshTimingPolicy('atlassian', {
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });

    expect(v8Post).toHaveBeenCalledWith('/sync/auth/policies/atlassian', {
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });
    expect(data.policy.maxRetryAttempts).toBe(5);
  });

  it('posts conflict resolution to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      conflict: {
        conflictId: 'conf-1',
        objectSyncStateId: 'sync-state-1',
        organizationId: 'org-1',
        conflictClass: 'field_authority_conflict',
        severity: 'degraded',
        resolutionPath: 'dismiss',
        resolutionStrategy: 'dismiss',
        resolvedAt: '2026-03-25T12:34:00.000Z',
        resolvedBy: 'user-1',
        createdAt: '2026-03-25T12:00:00.000Z',
      },
    });

    const data = await V8SyncApi.resolveConflict('conf-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/conflicts/conf-1/resolve', {
      resolutionPath: 'dismiss',
    });
    expect(data.conflict.resolutionPath).toBe('dismiss');
    expect(data.conflict.resolvedBy).toBe('user-1');
  });

  it('requests per-connector health from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      connectorId: 'salesforce',
      health: {
        healthy: true,
        syncStatus: 'synced',
        conflictCount: 0,
        lastSyncAt: '2026-03-25T10:00:00.000Z',
        authState: 'healthy',
      },
    });

    const data = await V8SyncApi.getConnectorHealth('salesforce');

    expect(v8Get).toHaveBeenCalledWith('/sync/connectors/salesforce/health');
    expect(data.health.syncStatus).toBe('synced');
    expect(data.health.authState).toBe('healthy');
  });

  it('requests run history from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      runs: [
        {
          id: 'run-1',
          integrationId: 'int-1',
          provider: 'jira',
          direction: 'pull',
          status: 'completed',
          itemsProcessed: 42,
          durationMs: 1234,
          errorSummary: null,
          triggeredBy: 'manual',
          startedAt: '2026-04-11T10:00:00.000Z',
          completedAt: '2026-04-11T10:00:01.234Z',
        },
      ],
      total: 1,
    });

    const data = await V8SyncApi.getRuns({ integrationId: 'int-1', limit: 10 });

    expect(v8Get).toHaveBeenCalledWith('/sync/runs', {
      integrationId: 'int-1',
      limit: '10',
    });
    expect(data.runs).toHaveLength(1);
    expect(data.runs[0].status).toBe('completed');
    expect(data.total).toBe(1);
  });

  it('requests mapping data for an integration from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      integrationId: 'int-1',
      connectorId: 'jira',
      fieldMappings: [{ from: 'summary', to: 'title' }],
      entityMappings: [],
      driftEvents: [],
      syncStates: [],
    });

    const data = await V8SyncApi.getMappings('int-1');

    expect(v8Get).toHaveBeenCalledWith('/sync/integrations/int-1/mappings');
    expect(data.fieldMappings).toHaveLength(1);
    expect(data.connectorId).toBe('jira');
  });

  it('saves mapping configuration for an integration', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, fieldCount: 2 });

    const data = await V8SyncApi.saveMappings('int-1', [
      { from: 'summary', to: 'title' },
      { from: 'description', to: 'body' },
    ]);

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/mappings', {
      fieldMappings: [
        { from: 'summary', to: 'title' },
        { from: 'description', to: 'body' },
      ],
    });
    expect(data.fieldCount).toBe(2);
  });

  it('requests secrets rotation status from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      secrets: [{ secretId: 's-1', connectorId: 'jira', secretKey: 'oauth_client', ageDays: 120, needsRotation: true }],
      summary: { total: 1, needsRotation: 1, healthy: 0 },
    });

    const data = await V8SyncApi.getSecretsStatus();

    expect(v8Get).toHaveBeenCalledWith('/sync/secrets/status');
    expect(data.summary.needsRotation).toBe(1);
  });

  it('rotates a secret and receives confirmation', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, secretId: 's-1', rotatedAt: '2026-04-11T12:00:00Z' });

    const data = await V8SyncApi.rotateSecret('s-1');

    expect(v8Post).toHaveBeenCalledWith('/sync/secrets/s-1/rotate', {});
    expect(data.success).toBe(true);
  });

  it('gets workflow policy for an integration', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      integrationId: 'int-1',
      workflowPolicy: 'safety_gate',
      reason: 'Pending review',
      setBy: 'admin',
      setAt: '2026-04-11T00:00:00Z',
      isPaused: true,
    });

    const data = await V8SyncApi.getWorkflowPolicy('int-1');

    expect(v8Get).toHaveBeenCalledWith('/sync/integrations/int-1/workflow-policy');
    expect(data.workflowPolicy).toBe('safety_gate');
    expect(data.isPaused).toBe(true);
  });

  it('sets workflow policy for an integration', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, policy: 'blocked', isPaused: true });

    const data = await V8SyncApi.setWorkflowPolicy('int-1', 'blocked', 'Security incident');

    expect(v8Post).toHaveBeenCalledWith('/sync/integrations/int-1/workflow-policy', {
      policy: 'blocked',
      reason: 'Security incident',
    });
    expect(data.isPaused).toBe(true);
  });

  it('falls back to legacy sync routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacySync({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacySync({ status: 500 })).toBe(false);
  });
});
