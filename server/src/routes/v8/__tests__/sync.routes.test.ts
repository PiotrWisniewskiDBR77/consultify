import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_SYNC_RUNTIME_MUTATION_CONTRACT, V8_SYNC_RUNTIME_READ_CONTRACT } from '../sync.routes.js';

const mockGetCredentialHealth = vi.fn();
const mockGetActiveEscalations = vi.fn();
const mockGetConnectorHealth = vi.fn();
const mockSetConnectorAuthState = vi.fn();
const mockGetUnresolvedConflicts = vi.fn();
const mockListGovernedIntegrations = vi.fn();
const mockResolveConflict = vi.fn();

vi.mock('../../../services/v8/pmSyncAuthService.js', () => ({
  getCredentialHealth: (...args: unknown[]) => mockGetCredentialHealth(...args),
  getActiveEscalations: (...args: unknown[]) => mockGetActiveEscalations(...args),
}));

vi.mock('../../../services/v8/pmSyncTruthService.js', () => ({
  getConnectorHealth: (...args: unknown[]) => mockGetConnectorHealth(...args),
  setConnectorAuthState: (...args: unknown[]) => mockSetConnectorAuthState(...args),
  getUnresolvedConflicts: (...args: unknown[]) => mockGetUnresolvedConflicts(...args),
  resolveConflict: (...args: unknown[]) => mockResolveConflict(...args),
}));

vi.mock('../../../services/v8/pmSyncInventoryService.js', () => ({
  listGovernedIntegrations: (...args: unknown[]) => mockListGovernedIntegrations(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

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
    mockGetCredentialHealth.mockResolvedValue({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 0,
    });
    mockGetActiveEscalations.mockResolvedValue([]);
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
