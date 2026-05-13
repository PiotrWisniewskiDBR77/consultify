import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Flags = vi.fn();
const mockGetAllOrgFlags = vi.fn();
const mockSetV8OrgFlag = vi.fn();
const mockGetPlatformHealth = vi.fn();
const mockGetCrossDomainIntegrity = vi.fn();
const mockGetPlatformMetrics = vi.fn();
const mockGetDomainReadiness = vi.fn();
const mockGetShadowStats = vi.fn();
const mockGetRecentComparisons = vi.fn();
const mockGetShadowPromotionReadiness = vi.fn();
const mockGetV8MetricsSnapshot = vi.fn();

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: (...args: unknown[]) => mockGetV8Flags(...args),
  getAllOrgFlags: (...args: unknown[]) => mockGetAllOrgFlags(...args),
  setV8OrgFlag: (...args: unknown[]) => mockSetV8OrgFlag(...args),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: (...args: unknown[]) => mockGetPlatformHealth(...args),
  getCrossDomainIntegrity: (...args: unknown[]) => mockGetCrossDomainIntegrity(...args),
  getPlatformMetrics: (...args: unknown[]) => mockGetPlatformMetrics(...args),
  getDomainReadiness: (...args: unknown[]) => mockGetDomainReadiness(...args),
}));

vi.mock('../../../services/v8/shadowModeService.js', () => ({
  getShadowStats: (...args: unknown[]) => mockGetShadowStats(...args),
  getRecentComparisons: (...args: unknown[]) => mockGetRecentComparisons(...args),
  getShadowPromotionReadiness: (...args: unknown[]) => mockGetShadowPromotionReadiness(...args),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: (...args: unknown[]) => mockGetV8MetricsSnapshot(...args),
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

const ORG = 'org-admin-v8';
const UID = 'user-admin-v8';

describe('V8 admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'SUPERADMIN', organizationId: ORG, isSuperAdmin: true };

    mockGetV8Flags.mockResolvedValue({ v8_enabled: true, prompt_os_enabled: true });
    mockGetAllOrgFlags.mockResolvedValue([{ organizationId: ORG, v8_enabled: true }]);
    mockSetV8OrgFlag.mockResolvedValue(undefined);

    mockGetPlatformHealth.mockResolvedValue({ overall: 'healthy' });
    mockGetCrossDomainIntegrity.mockResolvedValue({ driftCount: 0 });
    mockGetPlatformMetrics.mockResolvedValue({ successRate: 0.99 });
    mockGetDomainReadiness.mockResolvedValue([{ domain: 'prompt-os', status: 'ready' }]);

    mockGetShadowStats.mockResolvedValue({ comparedRequests: 12, mismatchRate: 0 });
    mockGetRecentComparisons.mockResolvedValue([{ comparisonId: 'cmp-1' }]);
    mockGetShadowPromotionReadiness.mockResolvedValue({ ready: true, blockers: [] });

    mockGetV8MetricsSnapshot.mockReturnValue({
      requests: 12,
      errors: 1,
      avgLatencyMs: 142,
      uptime: 9999,
    });
  });

  it('GET /api/v8/admin/flags returns org-scoped flags without requiring the org gate', async () => {
    const res = await request(createApp()).get('/api/v8/admin/flags');

    expect(res.status).toBe(200);
    expect(res.body.data.v8_enabled).toBe(true);
    expect(res.body.meta).toEqual({ version: 'v8' });
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(mockGetV8Flags).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/admin/flags/all requires superadmin and returns all org flags', async () => {
    const res = await request(createApp()).get('/api/v8/admin/flags/all');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(mockGetAllOrgFlags).toHaveBeenCalled();
  });

  it('PUT /api/v8/admin/flags/:module updates an org flag and returns refreshed flags', async () => {
    const res = await request(createApp())
      .put('/api/v8/admin/flags/prompt_os_enabled')
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(mockSetV8OrgFlag).toHaveBeenCalledWith(ORG, 'prompt_os_enabled', false, UID);
    expect(mockGetV8Flags).toHaveBeenCalledWith(ORG);
    expect(res.body.meta.updated).toBe('prompt_os_enabled');
  });

  it('GET /api/v8/admin/health returns platform health envelope for superadmin', async () => {
    const res = await request(createApp()).get('/api/v8/admin/health');

    expect(res.status).toBe(200);
    expect(res.body.data.health.overall).toBe('healthy');
    expect(res.body.data.integrity.driftCount).toBe(0);
    expect(mockGetPlatformHealth).toHaveBeenCalledWith(ORG);
    expect(mockGetDomainReadiness).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/admin/metrics returns the V8 metrics snapshot', async () => {
    const res = await request(createApp()).get('/api/v8/admin/metrics');

    expect(res.status).toBe(200);
    expect(res.body.data.requests).toBe(12);
    expect(res.body.data.avgLatencyMs).toBe(142);
    expect(mockGetV8MetricsSnapshot).toHaveBeenCalled();
  });

  it('GET /api/v8/admin/shadow/* routes return superadmin shadow diagnostics', async () => {
    const app = createApp();

    const [statsRes, comparisonsRes, readinessRes] = await Promise.all([
      request(app).get('/api/v8/admin/shadow/stats'),
      request(app).get('/api/v8/admin/shadow/comparisons?limit=25'),
      request(app).get('/api/v8/admin/shadow/promotion-readiness'),
    ]);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.comparedRequests).toBe(12);
    expect(comparisonsRes.status).toBe(200);
    expect(comparisonsRes.body.meta.count).toBe(1);
    expect(readinessRes.status).toBe(200);
    expect(readinessRes.body.data.ready).toBe(true);
    expect(mockGetShadowStats).toHaveBeenCalledWith(ORG);
    expect(mockGetRecentComparisons).toHaveBeenCalledWith(ORG, 25);
    expect(mockGetShadowPromotionReadiness).toHaveBeenCalledWith(ORG);
  });

  it('blocks protected admin diagnostics for non-superadmin users', async () => {
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp()).get('/api/v8/admin/health');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Super admin access required');
  });
});
