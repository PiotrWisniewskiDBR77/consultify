/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDbAll,
  mockDbGet,
  mockDbRun,
  mockGetTableColumns,
  mockListGovernedIntegrations,
  mockBuildGovernedExternalAuthSession,
  mockSetConnectorAuthState,
} = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
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
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/integrations/jiraOrgClient.js', () => ({
  createIssueFromTask: vi.fn(),
  parseJiraConfig: vi.fn(),
}));

vi.mock('../../services/integrations/communicationSyncService.js', () => ({
  dispatchProjectCommunicationEvent: vi.fn(),
}));

vi.mock('../../services/slackService.js', () => ({
  SlackServiceClass: vi.fn().mockImplementation(() => ({
    sendSystemAlert: vi.fn(),
  })),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import integrationsRoutes from '../integrations/integrations.routes.js';

describe('canonical integrations readback continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(new Set(['connector_id', 'config']));
    mockDbAll.mockResolvedValue([
      {
        id: 'int-1',
        config: JSON.stringify({ site_url: 'https://acme.atlassian.net' }),
        created_at: '2026-03-27T20:00:00.000Z',
        updated_at: '2026-03-27T20:05:00.000Z',
      },
    ]);
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
      reason: 'canonical_integrations_connect_initiated',
    });
  });

  it('GET /api/integrations exposes governed pending sync truth on canonical org surface', async () => {
    const app = express();
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app).get('/api/integrations');

    expect(res.status).toBe(200);
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith('org-1');
    expect(res.body).toEqual([
      expect.objectContaining({
        id: 'int-1',
        provider: 'jira',
        status: 'pending',
        onboarding_status: 'pending_external_auth_or_configuration',
        configured_fields: ['site_url'],
        required_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        config: { site_url: 'https://acme.atlassian.net' },
      }),
    ]);
  });

  it('POST /api/integrations/connect/:provider creates governed pending connect truth on canonical entrypoint', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app).post('/api/integrations/connect/jira').send({
      config: {
        site_url: 'https://acme.atlassian.net',
        cloud_id: 'cloud-1',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'canonical_integrations_connect_initiated',
    });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integrations'),
      expect.arrayContaining([
        'org-1',
        'jira',
        'Jira',
        'project_management',
        'pending',
      ])
    );
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
  });

  it('POST /api/integrations/:provider/connect reuses governed connect authority on alias entrypoint', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app).post('/api/integrations/jira/connect').send({
      config: {
        site_url: 'https://acme.atlassian.net',
        cloud_id: 'cloud-1',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'canonical_integrations_connect_initiated',
    });
  });
});
