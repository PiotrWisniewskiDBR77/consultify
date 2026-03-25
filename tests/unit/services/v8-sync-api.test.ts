import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8SyncApi } from '@/services/api/v8/sync';
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
});
