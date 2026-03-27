/**
 * @vitest-environment node
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_SYNC_RUNTIME_MUTATION_CONTRACT, V8_SYNC_RUNTIME_READ_CONTRACT } from '../sync.routes.js';

const mockGetCredentialHealth = vi.fn();
const mockGetActiveEscalations = vi.fn();
const mockResolveAuthEscalation = vi.fn();
const mockGetRefreshTimingPolicy = vi.fn();
const mockSetRefreshTimingPolicy = vi.fn();
const mockGetCredential = vi.fn();
const mockRecordAuthEscalation = vi.fn();
const mockRecordRefreshResult = vi.fn();
const mockResolveAuthEscalationsForConnector = vi.fn();
const mockStoreCredential = vi.fn();
const mockGetConnectorHealth = vi.fn();
const mockGetIntegrationHealth = vi.fn();
const mockGetUnresolvedErrors = vi.fn();
const mockResolveError = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockRecordRequest = vi.fn();
const mockLogSyncError = vi.fn();
const mockSetConnectorAuthState = vi.fn();
const mockGetUnresolvedConflicts = vi.fn();
const mockListGovernedIntegrations = vi.fn();
const mockResolveConflict = vi.fn();
const mockGetConnectedIntegrations = vi.fn();
const mockSyncIntegration = vi.fn();
const mockUpdateIntegrationStatus = vi.fn();
const mockDisconnectIntegration = vi.fn();
const mockStoreRefreshExecutionSecret = vi.fn();
const mockExecuteRefreshExecution = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../services/v8/pmSyncAuthService.js', () => ({
  getCredentialHealth: (...args: unknown[]) => mockGetCredentialHealth(...args),
  getActiveEscalations: (...args: unknown[]) => mockGetActiveEscalations(...args),
  resolveAuthEscalation: (...args: unknown[]) => mockResolveAuthEscalation(...args),
  getRefreshTimingPolicy: (...args: unknown[]) => mockGetRefreshTimingPolicy(...args),
  setRefreshTimingPolicy: (...args: unknown[]) => mockSetRefreshTimingPolicy(...args),
  getCredential: (...args: unknown[]) => mockGetCredential(...args),
  recordAuthEscalation: (...args: unknown[]) => mockRecordAuthEscalation(...args),
  recordRefreshResult: (...args: unknown[]) => mockRecordRefreshResult(...args),
  resolveAuthEscalationsForConnector: (...args: unknown[]) => mockResolveAuthEscalationsForConnector(...args),
  storeCredential: (...args: unknown[]) => mockStoreCredential(...args),
}));

vi.mock('../../../services/v8/pmSyncTruthService.js', () => ({
  getConnectorHealth: (...args: unknown[]) => mockGetConnectorHealth(...args),
  setConnectorAuthState: (...args: unknown[]) => mockSetConnectorAuthState(...args),
  getUnresolvedConflicts: (...args: unknown[]) => mockGetUnresolvedConflicts(...args),
  resolveConflict: (...args: unknown[]) => mockResolveConflict(...args),
}));

vi.mock('../../../services/syncGuardrailsService.js', async () => {
  const actual = await vi.importActual<any>('../../../services/syncGuardrailsService.js');
  return {
    ...actual,
    getIntegrationHealth: (...args: unknown[]) => mockGetIntegrationHealth(...args),
    getUnresolvedErrors: (...args: unknown[]) => mockGetUnresolvedErrors(...args),
    resolveError: (...args: unknown[]) => mockResolveError(...args),
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
    recordRequest: (...args: unknown[]) => mockRecordRequest(...args),
    logSyncError: (...args: unknown[]) => mockLogSyncError(...args),
  };
});

vi.mock('../../../services/v8/pmSyncInventoryService.js', () => ({
  listGovernedIntegrations: (...args: unknown[]) => mockListGovernedIntegrations(...args),
}));

vi.mock('../../../services/v8/pmSyncRefreshExecutionService.js', () => ({
  storeRefreshExecutionSecret: (...args: unknown[]) => mockStoreRefreshExecutionSecret(...args),
  executeRefreshExecution: (...args: unknown[]) => mockExecuteRefreshExecution(...args),
}));

vi.mock('../../../services/integrationHubService.js', async () => {
  const actual = await vi.importActual<any>('../../../services/integrationHubService.js');
  return {
    ...actual,
    getConnectedIntegrations: (...args: unknown[]) => mockGetConnectedIntegrations(...args),
    disconnectIntegration: (...args: unknown[]) => mockDisconnectIntegration(...args),
    syncIntegration: (...args: unknown[]) => mockSyncIntegration(...args),
    updateIntegrationStatus: (...args: unknown[]) => mockUpdateIntegrationStatus(...args),
  };
});

vi.mock('../../../utils/DbPromise.js', async () => {
  const actual = await vi.importActual<any>('../../../utils/DbPromise.js');
  return {
    ...actual,
    all: (...args: unknown[]) => mockDbAll(...args),
    run: (...args: unknown[]) => mockDbRun(...args),
  };
});

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../config/Config.js', async () => {
  const actual = await vi.importActual<any>('../../../config/Config.js');
  return {
    default: {
      ...actual.default,
      GOOGLE_CLIENT_ID: actual.default.GOOGLE_CLIENT_ID || 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: actual.default.GOOGLE_CLIENT_SECRET || 'test-google-client-secret',
      MICROSOFT_CLIENT_ID: actual.default.MICROSOFT_CLIENT_ID || 'test-microsoft-client-id',
      MICROSOFT_CLIENT_SECRET:
        actual.default.MICROSOFT_CLIENT_SECRET || 'test-microsoft-client-secret',
    },
  };
});

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-sync-v8';
const CONNECTOR = 'conn-jira-1';

describe('V8 sync read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetCredential.mockResolvedValue(null);
    mockRecordAuthEscalation.mockResolvedValue({
      escalationId: 'esc-auth-1',
      organizationId: ORG,
      connectorId: 'jira',
      reason: 'credential_expired',
      escalatedAt: '2026-03-27T19:00:00.000Z',
      resolvedAt: null,
      resolvedBy: null,
    });
    mockResolveAuthEscalationsForConnector.mockResolvedValue([]);
    mockRecordRefreshResult.mockResolvedValue(null);
    mockGetCredentialHealth.mockResolvedValue({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 0,
    });
    mockGetActiveEscalations.mockResolvedValue([]);
    mockResolveAuthEscalation.mockResolvedValue({
      escalationId: 'esc-1',
      organizationId: ORG,
      connectorId: CONNECTOR,
      reason: 'token expired',
      escalatedAt: '2025-01-02T00:00:00.000Z',
      resolvedAt: '2025-01-03T00:00:00.000Z',
      resolvedBy: UID,
    });
    mockGetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
    });
    mockSetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
    });
    mockStoreRefreshExecutionSecret.mockResolvedValue({
      connectorId: 'jira',
      organizationId: ORG,
      clientId: 'client-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'missing_secret',
      reason: 'Governed refresh secret has not been materialized for this connector yet.',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'synced',
      conflictCount: 0,
      lastSyncAt: '2025-01-01T00:00:00.000Z',
      authState: 'healthy',
    });
    mockSetConnectorAuthState.mockResolvedValue({
      recordId: 'record-1',
      connectorId: 'jira',
      organizationId: ORG,
      authState: 'healthy',
      previousState: null,
      transitionedAt: '2025-01-03T00:00:00.000Z',
      transitionedBy: UID,
      reason: null,
    });
    mockGetUnresolvedConflicts.mockResolvedValue([]);
    mockGetIntegrationHealth.mockResolvedValue({ status: 'healthy', errorRate: 0 });
    mockResolveError.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      warnings: [],
      reason: null,
      retryAfterMs: null,
    });
    mockRecordRequest.mockResolvedValue(undefined);
    mockLogSyncError.mockResolvedValue(undefined);
    mockListGovernedIntegrations.mockResolvedValue([]);
    mockResolveConflict.mockResolvedValue({
      conflictId: 'conf-1',
      objectSyncStateId: 'sync-state-1',
      organizationId: ORG,
      conflictClass: 'field_authority_conflict',
      severity: 'degraded',
      resolutionPath: 'dismiss',
      resolutionStrategy: 'dismiss',
      resolvedAt: '2025-01-03T00:00:00.000Z',
      resolvedBy: UID,
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    mockGetConnectedIntegrations.mockResolvedValue([]);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockSyncIntegration.mockResolvedValue({ recordsSynced: 12, duration: 345 });
    mockUpdateIntegrationStatus.mockResolvedValue({ success: true });
    mockDisconnectIntegration.mockResolvedValue({ success: true });
  });

  it('GET /api/v8/sync/integrations returns governed inventory envelope', async () => {
    mockListGovernedIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'connected',
        lastSyncAt: '2025-01-02T00:00:00.000Z',
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
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/integrations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.integrations?.[0]?.connectorId).toBe('jira');
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/auth/health returns credential rollup', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/health');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 0,
    });
    expect(mockGetCredentialHealth).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/connectors returns governed catalog envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/connectors').query({ category: 'project_management' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBeGreaterThan(0);
    expect(res.body.data?.connectors?.[0]?.category).toBe('project_management');
    expect(res.body.data?.connectors?.[0]?.configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
  });

  it('POST /api/v8/sync/connectors/:connectorId/connect creates a governed pending integration', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/connectors/jira/connect').send({});

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.integration?.connectorId).toBe('jira');
    expect(res.body.data?.integration?.status).toBe('pending');
    expect(res.body.data?.onboardingStatus).toBe('pending_external_auth_or_configuration');
    expect(res.body.data?.integration?.configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integrations'),
      expect.arrayContaining([ORG, 'jira', 'Jira', 'project_management', 'pending', 'oauth2']),
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, expect.any(String), 'connect_initiated', UID, UID]),
    );
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure saves pending setup fields on the governed seam', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-pending-1',
        connector_id: 'jira',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-pending-1/configure')
      .send({
        config: {
          site_url: 'https://example.atlassian.net',
          cloud_id: 'cloud-123',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.integration?.configuredFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain('/api/sync-hub/external-auth/callback?state=');
    expect(res.body.data?.externalAuth?.state).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE integrations'),
      [
        '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123","client_id":"jira-client-id","client_secret":"jira-client-secret"}',
        'int-pending-1',
        ORG,
      ],
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, 'int-pending-1', 'configuration_updated', UID, UID]),
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Gmail provider auth URL', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-gmail-1',
        connector_id: 'gmail',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-gmail-1/configure').send({
      config: {
        domain: 'acme.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['domain']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth?',
    );
    expect(res.body.data?.externalAuth?.authUrl).toContain('access_type=offline');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state=',
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'gmail',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Teams provider auth URL', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-teams-1',
        connector_id: 'teams',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-teams-1/configure').send({
      config: {
        tenant_id: 'tenant-123',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['tenant_id']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain(
      'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize?',
    );
    expect(res.body.data?.externalAuth?.authUrl).toContain('response_mode=query');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state=',
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'teams',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('GET /api/v8/sync/health returns governed hub health summary', async () => {
    mockGetConnectedIntegrations.mockResolvedValue([{ id: 'int-1' }, { id: 'int-2' }]);
    mockGetIntegrationHealth
      .mockResolvedValueOnce({ status: 'healthy', errorRate: 0 })
      .mockResolvedValueOnce({ status: 'degraded', errorRate: 20 });

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/health');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual({
      total: 2,
      healthy: 1,
      degraded: 1,
      unhealthy: 0,
    });
    expect(mockGetConnectedIntegrations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/errors returns governed sync error envelope', async () => {
    mockGetUnresolvedErrors.mockResolvedValue([
      {
        id: 'err-1',
        integrationId: 'int-1',
        errorType: 'AUTH',
        errorMessage: 'token expired',
        isRetryable: false,
        retryCount: 0,
        maxRetries: 3,
        createdAt: '2025-01-02T00:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/errors');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.errors?.[0]?.integrationId).toBe('int-1');
  });

  it('POST /api/v8/sync/errors/:errorId/resolve resolves a governed sync error', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/errors/err-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockResolveError).toHaveBeenCalledWith('err-1');
  });

  it('POST /api/v8/sync/integrations/:integrationId/pause pauses an integration through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/pause').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledWith(expect.stringContaining('is_paused = TRUE'), ['int-1', ORG]);
  });

  it('POST /api/v8/sync/integrations/:integrationId/reauth starts a governed reauth flow', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        connector_id: 'jira',
        config:
          '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123","client_id":"jira-client-id","client_secret":"jira-client-secret"}',
      },
    ]);
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/reauth').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain('/api/sync-hub/external-auth/callback?state=');
    expect(mockUpdateIntegrationStatus).toHaveBeenCalledWith('int-1', 'pending');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'reauth_started',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/credential stores governed credential baseline', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockStoreCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/credential').send({
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.credential?.providerAccountId).toBe('acct-123');
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
    });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, 'int-1', 'credential_materialized', UID, UID]),
    );
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-result records auth-break refresh outcome', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: null,
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/refresh-result').send({
      result: 'credential_expired',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.credential?.lastRefreshResult).toBe('credential_expired');
    expect(res.body.data?.authTransition).toBe('degraded_reauth_needed');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'degraded_reauth_needed',
      transitionedBy: UID,
      reason: 'refresh_auth_break',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-result resolves active escalations after success', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: null,
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'success',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: false,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'degraded_reauth_needed',
    });
    mockResolveAuthEscalationsForConnector.mockResolvedValue([
      {
        escalationId: 'esc-auth-1',
        organizationId: ORG,
        connectorId: 'jira',
        reason: 'credential_expired',
        escalatedAt: '2026-03-27T18:00:00.000Z',
        resolvedAt: '2026-03-27T19:00:00.000Z',
        resolvedBy: UID,
      },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/refresh-result').send({
      result: 'success',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.authTransition).toBe('healthy');
    expect(mockResolveAuthEscalationsForConnector).toHaveBeenCalledWith('jira', UID, ORG);
  });

  it('POST /api/v8/sync/integrations/:integrationId/disconnect disconnects through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/disconnect').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDisconnectIntegration).toHaveBeenCalledWith('int-1');
  });

  it('POST /api/v8/sync/integrations/:integrationId/resume resumes an integration through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/resume').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('is_paused = FALSE'),
      ['int-1', ORG],
    );
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync triggers a governed sync run', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.syncRun?.status).toBe('completed');
    expect(mockCheckRateLimit).toHaveBeenCalledWith(ORG, 'int-1', 'jira');
    expect(mockRecordRequest).toHaveBeenCalledWith(ORG, 'int-1', 'jira');
    expect(mockSyncIntegration).toHaveBeenCalledWith('int-1', {});
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync blocks expired governed credentials before sync starts', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2020-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2020-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_REAUTH_REQUIRED');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'degraded_reauth_needed',
      transitionedBy: UID,
      reason: 'sync_preflight_credential_expired',
    });
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync blocks refresh-window credentials before fake runtime sync', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockGetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_SECRET_REQUIRED');
    expect(res.body.refreshWindowMinutes).toBe(15);
    expect(mockGetRefreshTimingPolicy).toHaveBeenCalledWith('atlassian', ORG);
    expect(mockExecuteRefreshExecution).toHaveBeenCalledWith('jira', ORG);
    expect(mockRecordRefreshResult).not.toHaveBeenCalled();
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-secret stores governed refresh material', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'int-1', connector_id: 'jira', status: 'connected' }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-1/refresh-secret')
      .send({
        clientId: 'client-1',
        clientSecret: 'secret-1',
        refreshToken: 'refresh-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.refreshSecret?.clientIdPresent).toBe(true);
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync executes real governed refresh before continuing runtime sync', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'success',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      rotatedRefreshToken: true,
    });
    mockStoreCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockSyncIntegration.mockResolvedValue({
      recordsSynced: 12,
      duration: 321,
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(200);
    expect(mockExecuteRefreshExecution).toHaveBeenCalledWith('jira', ORG);
    expect(mockStoreCredential).toHaveBeenCalled();
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'success',
    });
    expect(mockSyncIntegration).toHaveBeenCalledWith('int-1', {});
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync turns refresh auth break into governed reauth truth', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'credential_expired',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      error: 'invalid_grant',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_REAUTH_REQUIRED');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync preserves rate-limit guardrails', async () => {
    mockDbAll.mockResolvedValueOnce([{ connector_id: 'jira', is_paused: false, status: 'connected' }]);
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      warnings: ['backoff'],
      reason: 'Too many requests',
      retryAfterMs: 1500,
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('GET /api/v8/sync/audit-log returns governed audit envelope', async () => {
    mockDbAll.mockResolvedValue([
      {
        id: 'audit-1',
        integration_id: 'int-1',
        action: 'sync_completed',
        actor_name: 'Ada',
        details: {},
        created_at: '2025-01-02T00:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/audit-log').query({ limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.entries?.[0]?.action).toBe('sync_completed');
  });

  it('GET /api/v8/sync/auth/escalations returns list envelope', async () => {
    mockGetActiveEscalations.mockResolvedValue([
      {
        escalationId: 'e1',
        organizationId: ORG,
        connectorId: CONNECTOR,
        reason: 'degraded',
        escalatedAt: '2025-01-02T00:00:00.000Z',
        resolvedAt: null,
        resolvedBy: null,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/escalations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(mockGetActiveEscalations).toHaveBeenCalledWith(ORG);
  });

  it('POST /api/v8/sync/auth/escalations/:id/resolve resolves a governed auth escalation', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/auth/escalations/esc-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.escalation?.resolvedBy).toBe(UID);
    expect(mockResolveAuthEscalation).toHaveBeenCalledWith('esc-1', UID, ORG);
  });

  it('GET /api/v8/sync/auth/policies/:providerFamily returns provider refresh policy', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/policies/atlassian');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.policy?.providerFamily).toBe('atlassian');
    expect(mockGetRefreshTimingPolicy).toHaveBeenCalledWith('atlassian', ORG);
  });

  it('POST /api/v8/sync/auth/policies/:providerFamily upserts provider refresh policy', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/auth/policies/atlassian').send({
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.policy?.maxRetryAttempts).toBe(5);
    expect(mockSetRefreshTimingPolicy).toHaveBeenCalledWith({
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });
  });

  it('GET /api/v8/sync/connectors/:id/health delegates to pmSyncTruthService', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/v8/sync/connectors/${encodeURIComponent(CONNECTOR)}/health`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.connectorId).toBe(CONNECTOR);
    expect(res.body.data?.health?.healthy).toBe(true);
    expect(mockGetConnectorHealth).toHaveBeenCalledWith(CONNECTOR, ORG);
  });

  it('GET /api/v8/sync/connectors/:id/health rejects blank connectorId', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/connectors/%20/health');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAM');
    expect(mockGetConnectorHealth).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/connectors/:id/auth-state updates governed auth state', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/connectors/jira/auth-state')
      .send({ targetState: 'healthy' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.record?.authState).toBe('healthy');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'healthy',
      transitionedBy: UID,
      reason: null,
    });
    expect(mockResolveAuthEscalationsForConnector).toHaveBeenCalledWith('jira', UID, ORG);
  });

  it('POST /api/v8/sync/connectors/:id/auth-state rejects invalid target state', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/connectors/jira/auth-state')
      .send({ targetState: 'not-real' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
  });

  it('GET /api/v8/sync/conflicts passes limit to service', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/conflicts?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(mockGetUnresolvedConflicts).toHaveBeenCalledWith(ORG, 10);
  });

  it('GET /api/v8/sync/conflicts omits limit when not provided', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/conflicts');

    expect(res.status).toBe(200);
    expect(mockGetUnresolvedConflicts).toHaveBeenCalledWith(ORG, undefined);
  });

  it('POST /api/v8/sync/conflicts/:id/resolve resolves a governed conflict', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/conflicts/conf-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.conflict?.resolutionPath).toBe('dismiss');
    expect(mockResolveConflict).toHaveBeenCalledWith('conf-1', 'dismiss', UID, ORG);
  });

  it('POST /api/v8/sync/conflicts/:id/resolve rejects invalid resolution path', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/conflicts/conf-1/resolve')
      .send({ resolutionPath: 'not_real' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockResolveConflict).not.toHaveBeenCalled();
  });
});
