/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDbAll,
  mockDbGet,
  mockDbRun,
  mockDisconnectIntegration,
  mockUpdateIntegrationStatus,
  mockGetTableColumns,
  mockListGovernedIntegrations,
  mockBuildGovernedExternalAuthSession,
  mockSetConnectorAuthState,
} = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
  mockDisconnectIntegration: vi.fn(),
  mockUpdateIntegrationStatus: vi.fn(),
  mockGetTableColumns: vi.fn(),
  mockListGovernedIntegrations: vi.fn(),
  mockBuildGovernedExternalAuthSession: vi.fn(),
  mockSetConnectorAuthState: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../services/v8/pmSyncInventoryService.js', () => ({
  listGovernedIntegrations: (...args: unknown[]) => mockListGovernedIntegrations(...args),
}));

vi.mock('../../services/v8/pmSyncExternalAuthMaterializationService.js', () => ({
  buildGovernedExternalAuthSession: (...args: unknown[]) =>
    mockBuildGovernedExternalAuthSession(...args),
  getGovernedExternalAuthConfigFields: (connectorId: string, baseFields: string[]) =>
    connectorId === 'jira' ? [...baseFields, 'client_id', 'client_secret'] : baseFields,
}));

vi.mock('../../services/v8/pmSyncTruthService.js', () => ({
  setConnectorAuthState: (...args: unknown[]) => mockSetConnectorAuthState(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../services/gdprService.js', () => ({
  createAccountDeletionRequest: vi.fn(),
  createDataExportRequest: vi.fn(),
}));

vi.mock('../../services/integrationHubService.js', async () => {
  const actual = await vi.importActual<any>('../../services/integrationHubService.js');
  return {
    ...actual,
    disconnectIntegration: (...args: unknown[]) => mockDisconnectIntegration(...args),
    updateIntegrationStatus: (...args: unknown[]) => mockUpdateIntegrationStatus(...args),
  };
});

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import settingsRoutes from '../settings.routes.js';

describe('settings integrations authority continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(undefined);
    mockGetTableColumns.mockImplementation(async (table: string) => {
      if (table === 'integrations') {
        return new Set(['connector_id', 'config']);
      }
      if (table === 'integration_sync_log') {
        return new Set([
          'items_processed',
          'trigger_type',
          'items_created',
          'items_updated',
          'items_failed',
          'error_summary',
          'error_details',
        ]);
      }
      return new Set();
    });
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM integrations')) {
        return [
          {
            id: 'int-1',
            connector_id: 'jira',
            config: JSON.stringify({ site_url: 'https://acme.atlassian.net' }),
            created_at: '2026-03-27T20:00:00.000Z',
            updated_at: '2026-03-27T20:05:00.000Z',
          },
        ];
      }
      return [];
    });
    mockListGovernedIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'pending',
        lastSyncAt: null,
        lastError: null,
        health: 'degraded',
        errorRate: 25,
        unresolvedErrors: 0,
        lastRun: null,
        configuredFields: ['site_url'],
        onboardingStatus: 'pending_external_auth_or_configuration',
        credential: null,
        connector: {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
          configFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        },
      },
    ]);
    mockBuildGovernedExternalAuthSession.mockReturnValue({
      authUrl: 'https://auth.atlassian.com/authorize?state=state-1',
      callbackUrl: 'https://example.test/api/sync-hub/external-auth/callback?state=state-1',
      state: 'state-1',
      expiresAt: '2026-03-27T20:11:00.000Z',
    });
    mockSetConnectorAuthState.mockResolvedValue({
      recordId: 'auth-1',
      connectorId: 'jira',
      organizationId: 'org-1',
      authState: 'connecting',
      previousState: null,
      transitionedAt: '2026-03-27T20:10:00.000Z',
      transitionedBy: 'user-1',
      reason: 'settings_integrations_connect_initiated',
    });
    mockDisconnectIntegration.mockResolvedValue({ success: true });
    mockUpdateIntegrationStatus.mockResolvedValue({ success: true });
  });

  it('GET /api/settings/integrations exposes governed pending sync truth on the settings surface', async () => {
    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).get('/api/settings/integrations');

    expect(res.status).toBe(200);
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith('org-1');
    expect(res.body.integrations).toEqual([
      expect.objectContaining({
        id: 'int-1',
        provider: 'jira',
        status: 'pending',
        onboardingStatus: 'pending_external_auth_or_configuration',
        configuredFields: ['site_url'],
        requiredFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        config: { site_url: 'https://acme.atlassian.net' },
      }),
    ]);
    expect(res.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'jira',
          isConnected: false,
          connection: expect.objectContaining({
            provider: 'jira',
            status: 'pending',
          }),
        }),
      ])
    );
    expect(res.body.connectedCount).toBe(0);
  });

  it('POST /api/settings/integrations/:provider/connect reuses governed connect initiation authority', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRoutes);

    const res = await request(app)
      .post('/api/settings/integrations/jira/connect')
      .send({
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'settings_integrations_connect_initiated',
    });
    expect(mockBuildGovernedExternalAuthSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        connectorId: 'jira',
        organizationId: 'org-1',
        mode: 'connect',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      })
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integrations'),
      expect.arrayContaining(['org-1', 'jira', 'Jira', 'project_management', 'pending'])
    );
  });

  it('DELETE /api/settings/integrations/:provider reuses governed disconnect authority', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'int-1' }]);
    mockDbGet.mockResolvedValueOnce({
      preferences_data: JSON.stringify([
        {
          id: 'jira-user-1',
          userId: 'user-1',
          provider: 'jira',
          providerName: 'Jira',
          status: 'active',
          config: {},
          capabilities: ['sync'],
          createdAt: '2026-03-27T20:00:00.000Z',
          updatedAt: '2026-03-27T20:05:00.000Z',
        },
      ]),
    });

    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).delete('/api/settings/integrations/jira');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDisconnectIntegration).toHaveBeenCalledWith('int-1');
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO user_preferences'),
      ['user-1', 'settings:integrations', '[]'],
      { fallback: false }
    );
  });

  it('GET /api/settings/integrations/:provider/status exposes governed status truth on the settings surface', async () => {
    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).get('/api/settings/integrations/jira/status');

    expect(res.status).toBe(200);
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith('org-1');
    expect(res.body.status).toEqual(
      expect.objectContaining({
        id: 'int-1',
        provider: 'jira',
        status: 'pending',
        onboardingStatus: 'pending_external_auth_or_configuration',
        isConnected: false,
      })
    );
  });

  it('PUT /api/settings/integrations/:provider/config reuses governed configuration authority', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).put('/api/settings/integrations/jira/config').send({
      config: {
        cloud_id: 'cloud-1',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
        ignored_field: 'should-not-persist',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(res.body.integration).toEqual(
      expect.objectContaining({
        id: 'int-1',
        provider: 'jira',
        status: 'pending',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
        configuredFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        requiredFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
      })
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE integrations'),
      [
        JSON.stringify({
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        }),
        'int-1',
        'org-1',
      ]
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'settings_integrations_configured',
    });
    expect(mockBuildGovernedExternalAuthSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'jira',
        mode: 'connect',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      })
    );
  });

  it('POST /api/settings/integrations/:provider/refresh reuses governed reauthorization authority', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM integrations')) {
        return [
          {
            id: 'int-1',
            connector_id: 'jira',
            config: JSON.stringify({
              site_url: 'https://acme.atlassian.net',
              cloud_id: 'cloud-1',
              client_id: 'jira-client-id',
              client_secret: 'jira-client-secret',
            }),
            created_at: '2026-03-27T20:00:00.000Z',
            updated_at: '2026-03-27T20:05:00.000Z',
          },
        ];
      }
      return [];
    });

    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).post('/api/settings/integrations/jira/refresh');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Re-authorization initiated',
      onboardingStatus: 'pending_external_auth',
      authUrl: 'https://auth.atlassian.com/authorize?state=state-1',
    });
    expect(mockUpdateIntegrationStatus).toHaveBeenCalledWith('int-1', 'pending');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'settings_integrations_refresh_started',
    });
    expect(mockBuildGovernedExternalAuthSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'jira',
        mode: 'reauth',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      })
    );
  });

  it('GET /api/settings/integrations/:provider/logs returns canonical sync logs for the effective governed integration', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM integrations')) {
        return [
          {
            id: 'int-1',
            connector_id: 'jira',
            config: JSON.stringify({ site_url: 'https://acme.atlassian.net' }),
            created_at: '2026-03-27T20:00:00.000Z',
            updated_at: '2026-03-27T20:05:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM integration_sync_log')) {
        return [
          {
            id: 'log-1',
            status: 'success',
            sync_type: 'issues',
            direction: 'bidirectional',
            trigger_type: 'manual',
            items_processed: 12,
            items_created: 3,
            items_updated: 8,
            items_failed: 1,
            error_summary: null,
            error_details: JSON.stringify({ failedIds: ['ISSUE-9'] }),
            started_at: '2026-03-27T20:10:00.000Z',
            completed_at: '2026-03-27T20:10:30.000Z',
            duration_ms: 30000,
          },
        ];
      }
      return [];
    });

    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).get('/api/settings/integrations/jira/logs?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([
      {
        id: 'log-1',
        status: 'success',
        syncType: 'issues',
        direction: 'bidirectional',
        syncScope: 'bidirectional',
        syncScopeLabel: 'Bidirectional sync',
        triggerType: 'manual',
        itemsProcessed: 12,
        itemsCreated: 3,
        itemsUpdated: 8,
        itemsFailed: 1,
        errorSummary: null,
        errorDetails: { failedIds: ['ISSUE-9'] },
        startedAt: '2026-03-27T20:10:00.000Z',
        completedAt: '2026-03-27T20:10:30.000Z',
        durationMs: 30000,
      },
    ]);
  });

  it('GET /api/settings/integrations/:provider/logs returns 404 when the provider is absent from effective settings', async () => {
    const app = express();
    app.use('/api/settings', settingsRoutes);

    const res = await request(app).get('/api/settings/integrations/notion/logs');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      logs: [],
      error: 'Integration not connected',
    });
  });

  it('POST /api/settings/integrations/:provider/test uses governed status truth instead of stubbed success', async () => {
    const app = express();
    app.use('/api/settings', settingsRoutes);

    const pendingRes = await request(app).post('/api/settings/integrations/jira/test');

    expect(pendingRes.status).toBe(409);
    expect(pendingRes.body).toEqual({
      success: false,
      error: 'Integration is not fully connected yet',
    });

    mockListGovernedIntegrations.mockResolvedValueOnce([
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
        configuredFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        onboardingStatus: null,
        credential: {
          providerAccountId: 'acct-1',
          workspaceOrTenantId: 'tenant-1',
          scopesGranted: ['read:jira-work'],
          tokenExpiresAt: null,
          lastVerificationAt: null,
          lastRefreshAt: null,
          lastRefreshResult: null,
        },
        connector: {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
          configFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        },
      },
    ]);

    const activeRes = await request(app).post('/api/settings/integrations/jira/test');

    expect(activeRes.status).toBe(200);
    expect(activeRes.body).toEqual({ success: true });
  });
});
