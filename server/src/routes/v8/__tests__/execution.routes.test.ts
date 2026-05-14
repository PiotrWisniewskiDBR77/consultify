import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRunsByOrg = vi.fn();
const mockGetActiveRuns = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../../services/v8/executionSpineService.js', () => ({
  getRunsByOrg: (...args: unknown[]) => mockGetRunsByOrg(...args),
  getActiveRuns: (...args: unknown[]) => mockGetActiveRuns(...args),
}));

vi.mock('../../../services/v8/artifactRegistryService.js', () => ({
  listArtifactsForUserByExecutionRunId: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/toolGovernanceService.js', () => ({
  getToolUsageByRun: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
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

const ORG = '00000000-0000-4000-8000-000000000066';
const UID = 'user-exec-v8';

describe('V8 execution routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetRunsByOrg.mockResolvedValue([]);
    mockGetActiveRuns.mockResolvedValue([]);
    mockDbGet.mockResolvedValue({ id: 'init-1' });
  });

  it('GET /api/v8/execution/runs forwards initiativeId scope', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/execution/runs')
      .query({ initiativeId: 'init-1', state: 'drafting', limit: 25 });

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetRunsByOrg).toHaveBeenCalledWith(ORG, 'drafting', 25, 'init-1');
  });

  it('GET /api/v8/execution/runs active=true forwards initiativeId scope', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/execution/runs')
      .query({ active: 'true', initiativeId: 'init-1' });

    expect(res.status).toBe(200);
    expect(mockGetActiveRuns).toHaveBeenCalledWith(ORG, 'init-1');
  });

  it('GET /api/v8/execution/runs returns 404 when initiativeId is invalid', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/v8/execution/runs').query({ initiativeId: 'unknown' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetRunsByOrg).not.toHaveBeenCalled();
    expect(mockGetActiveRuns).not.toHaveBeenCalled();
  });
});
