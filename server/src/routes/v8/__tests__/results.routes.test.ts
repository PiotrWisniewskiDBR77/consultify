import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_RESULTS_READ_CONTRACT } from '../results.routes.js';

const mockGetResultsDashboard = vi.fn();

vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
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
const UID = 'user-results-v8';

describe('V8 results read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetResultsDashboard.mockResolvedValue({
      organizationId: ORG,
      kpiScorecard: {
        organizationId: ORG,
        totalKpis: 0,
        byStatus: {},
        byCategory: {},
        averageTargetAchievementRate: null,
      },
      activeDeviationsCount: 0,
      roiDashboard: {
        organizationId: ORG,
        totalEntries: 0,
        totalRealized: 0,
        projectedFromKpiTargets: 0,
        overallRealizationRate: null,
        byInitiative: [],
      },
      reconciliationHealth: {
        organizationId: ORG,
        total: 0,
        byStatus: {},
        unresolvedCount: 0,
        averageResolutionHours: null,
      },
      recentReviewPacks: [],
    });
  });

  it('GET /api/v8/results/dashboard returns envelope and delegates to getResultsDashboard', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.snapshot?.organizationId).toBe(ORG);
    expect(mockGetResultsDashboard).toHaveBeenCalledWith(ORG);
  });
});
