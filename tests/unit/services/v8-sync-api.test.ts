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

  it('falls back to legacy sync routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacySync({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacySync({ status: 500 })).toBe(false);
  });
});
