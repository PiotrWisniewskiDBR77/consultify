import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_EXECUTION_CONTROL_READ_CONTRACT } from '../execution-control.routes.js';

const mockDetectRiskSignals = vi.fn();
const mockGetTimelineWarningsSnapshot = vi.fn();
const mockDetectDelaySignals = vi.fn();
const mockGetPersistedDelaySignals = vi.fn();
const mockGetLevelingAlerts = vi.fn();
const mockGetCapacityTimeline = vi.fn();
const mockGetPortfolioBudgetSummary = vi.fn();
const mockDetectOverspendSignals = vi.fn();

vi.mock('../../../services/riskDetectionService.js', () => ({
  detectRiskSignals: (...args: unknown[]) => mockDetectRiskSignals(...args),
}));

vi.mock('../../../services/executionControlReadService.js', () => ({
  getTimelineWarningsSnapshot: (...args: unknown[]) => mockGetTimelineWarningsSnapshot(...args),
}));

vi.mock('../../../services/delayDetectionService.js', () => ({
  detectDelaySignals: (...args: unknown[]) => mockDetectDelaySignals(...args),
  getPersistedDelaySignals: (...args: unknown[]) => mockGetPersistedDelaySignals(...args),
}));

vi.mock('../../../services/workloadCapacityService.js', () => ({
  getLevelingAlerts: (...args: unknown[]) => mockGetLevelingAlerts(...args),
  getCapacityTimeline: (...args: unknown[]) => mockGetCapacityTimeline(...args),
}));

vi.mock('../../../services/executionBudgetService.js', () => ({
  getPortfolioBudgetSummary: (...args: unknown[]) => mockGetPortfolioBudgetSummary(...args),
  detectOverspendSignals: (...args: unknown[]) => mockDetectOverspendSignals(...args),
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

const ORG = '00000000-0000-4000-8000-000000000088';
const UID = 'user-exec-control-v8';

describe('V8 execution-control read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockDetectRiskSignals.mockResolvedValue([]);
    mockGetTimelineWarningsSnapshot.mockResolvedValue({ warnings: [], total: 0 });
    mockDetectDelaySignals.mockResolvedValue([]);
    mockGetPersistedDelaySignals.mockResolvedValue([]);
    mockGetLevelingAlerts.mockResolvedValue([]);
    mockGetCapacityTimeline.mockResolvedValue([]);
    mockGetPortfolioBudgetSummary.mockResolvedValue({ totals: { planned: 0, actual: 0 } });
    mockDetectOverspendSignals.mockResolvedValue([]);
  });

  it('GET /api/v8/execution-control/risk-signals returns envelope and org-scoped detection', async () => {
    mockDetectRiskSignals.mockResolvedValue([
      {
        id: 'sig-1',
        initiativeId: '00000000-0000-4000-8000-000000000001',
        initiativeName: 'Init A',
        signalType: 'OVERDUE' as const,
        severity: 'HIGH' as const,
        title: 'Late',
        description: 'd',
        suggestedAction: 'act',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/risk-signals?projectId=p1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(mockDetectRiskSignals).toHaveBeenCalledWith(ORG, 'p1');
  });

  it('GET /api/v8/execution-control/timeline-warnings uses shared snapshot service', async () => {
    mockGetTimelineWarningsSnapshot.mockResolvedValue({
      warnings: [
        {
          initiativeId: 'i1',
          initiativeName: 'N',
          type: 'overdue' as const,
          severity: 'high' as const,
          message: 'Overdue by 3 days',
          daysOverdue: 3,
        },
      ],
      total: 1,
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/timeline-warnings');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.warnings).toHaveLength(1);
    expect(mockGetTimelineWarningsSnapshot).toHaveBeenCalledWith(ORG, undefined);
  });

  it('GET /api/v8/execution-control/delay-signals supports persisted branch', async () => {
    mockGetPersistedDelaySignals.mockResolvedValue([{ id: 'd1' }]);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/delay-signals?persisted=true');

    expect(res.status).toBe(200);
    expect(res.body.data?.source).toBe('persisted');
    expect(res.body.data?.count).toBe(1);
    expect(mockGetPersistedDelaySignals).toHaveBeenCalledWith(ORG, {
      projectId: undefined,
      severity: undefined,
      entityType: undefined,
    });
    expect(mockDetectDelaySignals).not.toHaveBeenCalled();
  });

  it('GET /api/v8/execution-control/budget/portfolio returns summary envelope', async () => {
    const summary = { byInitiative: [], rollup: {} };
    mockGetPortfolioBudgetSummary.mockResolvedValue(summary);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/budget/portfolio');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual(summary);
    expect(mockGetPortfolioBudgetSummary).toHaveBeenCalledWith(ORG, undefined);
  });
});
