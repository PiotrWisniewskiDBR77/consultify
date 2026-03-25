import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_PLANNING_READ_CONTRACT } from '../planning.routes.js';

const mockGetDecompositionTree = vi.fn();
const mockValidateWBSCompleteness = vi.fn();
const mockGetCriticalPath = vi.fn();
const mockGetCrossInitiativeDependencies = vi.fn();
const mockGetDecisionChainsByInitiative = vi.fn();
const mockGetPendingDecisions = vi.fn();

vi.mock('../../../services/v8/planningContinuityService.js', () => ({
  getDecompositionTree: (...args: unknown[]) => mockGetDecompositionTree(...args),
  validateWBSCompleteness: (...args: unknown[]) => mockValidateWBSCompleteness(...args),
  getCriticalPath: (...args: unknown[]) => mockGetCriticalPath(...args),
  getCrossInitiativeDependencies: (...args: unknown[]) => mockGetCrossInitiativeDependencies(...args),
  getDecisionChainsByInitiative: (...args: unknown[]) => mockGetDecisionChainsByInitiative(...args),
  getPendingDecisions: (...args: unknown[]) => mockGetPendingDecisions(...args),
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
const UID = 'user-planning-v8';
const INIT = '00000000-0000-4000-8000-000000000010';

describe('V8 Planning continuity read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetDecompositionTree.mockResolvedValue([]);
    mockValidateWBSCompleteness.mockResolvedValue({ complete: true, gaps: [] });
    mockGetCriticalPath.mockResolvedValue([]);
    mockGetCrossInitiativeDependencies.mockResolvedValue([]);
    mockGetDecisionChainsByInitiative.mockResolvedValue([]);
    mockGetPendingDecisions.mockResolvedValue([]);
  });

  it('GET /api/v8/planning/initiatives/:id/snapshot returns envelope and calls services with org + initiative', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/snapshot`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.initiativeId).toBe(INIT);
    expect(res.body.data?.decompositionTree).toEqual([]);
    expect(res.body.data?.wbsCompleteness).toEqual({ complete: true, gaps: [] });

    expect(mockGetDecompositionTree).toHaveBeenCalledWith(INIT, ORG);
    expect(mockValidateWBSCompleteness).toHaveBeenCalledWith(INIT, ORG);
    expect(mockGetCriticalPath).toHaveBeenCalledWith(INIT, ORG);
    expect(mockGetCrossInitiativeDependencies).toHaveBeenCalledWith(INIT, ORG);
    expect(mockGetDecisionChainsByInitiative).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/snapshot rejects non-UUID initiative id', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/planning/initiatives/not-a-uuid/snapshot');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PLANNING_INITIATIVE_ID_INVALID');
    expect(mockGetDecompositionTree).not.toHaveBeenCalled();
  });

  it('GET /api/v8/planning/pending-decisions returns V8 envelope and org-scoped pending chains', async () => {
    const chains = [
      {
        chainId: '00000000-0000-4000-8000-cccccccccccc',
        organizationId: ORG,
        initiativeId: INIT,
        chainType: 'sequential' as const,
        decisions: [
          {
            decisionId: 'd1',
            order: 0,
            status: 'pending' as const,
            decidedBy: null,
            decidedAt: null,
          },
        ],
        status: 'open' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        metadata: {},
      },
    ];
    mockGetPendingDecisions.mockResolvedValue(chains);

    const app = createApp();
    const res = await request(app).get('/api/v8/planning/pending-decisions');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.pendingDecisionChains).toEqual(chains);
    expect(mockGetPendingDecisions).toHaveBeenCalledWith(ORG);
  });
});
