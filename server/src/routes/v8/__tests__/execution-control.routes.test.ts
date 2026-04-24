import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_EXECUTION_CONTROL_MUTATION_CONTRACT,
  V8_EXECUTION_CONTROL_READ_CONTRACT,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
} from '../execution-control.routes.js';

const mockDetectRiskSignals = vi.fn();
const mockGetTimelineWarningsSnapshot = vi.fn();
const mockDetectDelaySignals = vi.fn();
const mockGetPersistedDelaySignals = vi.fn();
const mockPersistDelaySignals = vi.fn();
const mockGetLevelingAlerts = vi.fn();
const mockGetCapacityTimeline = vi.fn();
const mockGetInitiativeBudgetSummary = vi.fn();
const mockGetPortfolioBudgetSummary = vi.fn();
const mockDetectOverspendSignals = vi.fn();
const mockCreateBudgetEntry = vi.fn();
const mockGetExecutionControlTowerQueues = vi.fn();
const mockGetExecutionControlTowerItemDetail = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../services/riskDetectionService.js', () => ({
  detectRiskSignals: (...args: unknown[]) => mockDetectRiskSignals(...args),
}));

vi.mock('../../../services/executionControlReadService.js', () => ({
  getTimelineWarningsSnapshot: (...args: unknown[]) => mockGetTimelineWarningsSnapshot(...args),
}));

vi.mock('../../../services/delayDetectionService.js', () => ({
  detectDelaySignals: (...args: unknown[]) => mockDetectDelaySignals(...args),
  getPersistedDelaySignals: (...args: unknown[]) => mockGetPersistedDelaySignals(...args),
  persistDelaySignals: (...args: unknown[]) => mockPersistDelaySignals(...args),
}));

vi.mock('../../../services/workloadCapacityService.js', () => ({
  getLevelingAlerts: (...args: unknown[]) => mockGetLevelingAlerts(...args),
  getCapacityTimeline: (...args: unknown[]) => mockGetCapacityTimeline(...args),
}));

vi.mock('../../../services/executionBudgetService.js', () => ({
  createBudgetEntry: (...args: unknown[]) => mockCreateBudgetEntry(...args),
  getInitiativeBudgetSummary: (...args: unknown[]) => mockGetInitiativeBudgetSummary(...args),
  getPortfolioBudgetSummary: (...args: unknown[]) => mockGetPortfolioBudgetSummary(...args),
  detectOverspendSignals: (...args: unknown[]) => mockDetectOverspendSignals(...args),
}));

vi.mock('../../../services/v8ExecutionControlTowerService.js', () => ({
  getExecutionControlTowerQueues: (...args: unknown[]) =>
    mockGetExecutionControlTowerQueues(...args),
  getExecutionControlTowerItemDetail: (...args: unknown[]) =>
    mockGetExecutionControlTowerItemDetail(...args),
  V8_EXECUTION_CONTROL_TOWER_CONTRACT: 'execution_control_tower_v1',
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
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
    mockPersistDelaySignals.mockResolvedValue({ persisted: 0, alertsSent: 0 });
    mockGetLevelingAlerts.mockResolvedValue([]);
    mockGetCapacityTimeline.mockResolvedValue([]);
    mockGetInitiativeBudgetSummary.mockResolvedValue(null);
    mockGetPortfolioBudgetSummary.mockResolvedValue({ totals: { planned: 0, actual: 0 } });
    mockDetectOverspendSignals.mockResolvedValue([]);
    mockCreateBudgetEntry.mockResolvedValue('budget-entry-1');
    mockGetExecutionControlTowerQueues.mockResolvedValue({
      generatedAt: '2026-03-31T00:00:00.000Z',
      contract: 'execution_control_tower_v1',
      queues: {
        late: [],
        at_risk: [],
        blocked: [],
        overloaded: [],
        stale: [],
      },
      counts: { late: 0, at_risk: 0, blocked: 0, overloaded: 0, stale: 0 },
    });
    mockGetExecutionControlTowerItemDetail.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
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

  it('GET /api/v8/execution-control/control-tower/queues returns tower contract envelope', async () => {
    mockGetExecutionControlTowerQueues.mockResolvedValue({
      generatedAt: '2026-03-31T12:00:00.000Z',
      contract: 'execution_control_tower_v1',
      projectId: 'p1',
      queues: {
        late: [
          {
            entityType: 'INITIATIVE' as const,
            entityId: 'i-late',
            name: 'Late initiative',
            initiativeId: 'i-late',
            projectId: 'p1',
            severity: 'warning' as const,
            why: [{ kind: 'baseline_forecast' as const, detail: 'Past end' }],
            whatNext: [],
            affectsNext: [],
          },
        ],
        at_risk: [],
        blocked: [],
        overloaded: [],
        stale: [],
      },
      counts: { late: 1, at_risk: 0, blocked: 0, overloaded: 0, stale: 0 },
    });

    const app = createApp();
    const res = await request(app).get(
      '/api/v8/execution-control/control-tower/queues?projectId=p1&queue=late'
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_TOWER_CONTRACT);
    expect(res.body.data?.counts?.late).toBe(1);
    expect(mockGetExecutionControlTowerQueues).toHaveBeenCalledWith(ORG, {
      projectId: 'p1',
      queue: 'late',
    });
  });

  it('GET /api/v8/execution-control/control-tower/items/:entityType/:entityId returns merged drill-down', async () => {
    mockGetExecutionControlTowerItemDetail.mockResolvedValue({
      entityType: 'INITIATIVE' as const,
      entityId: 'i1',
      inQueues: ['late', 'blocked'] as const,
      contract: 'execution_control_tower_v1',
      item: {
        entityType: 'INITIATIVE' as const,
        entityId: 'i1',
        name: 'N',
        why: [],
        whatNext: [],
        affectsNext: [],
      },
    });

    const app = createApp();
    const res = await request(app).get(
      '/api/v8/execution-control/control-tower/items/INITIATIVE/i1?projectId=p1'
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_TOWER_CONTRACT);
    expect(res.body.data?.inQueues).toEqual(['late', 'blocked']);
    expect(mockGetExecutionControlTowerItemDetail).toHaveBeenCalledWith(
      ORG,
      'INITIATIVE',
      'i1',
      'p1'
    );
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

  it('GET /api/v8/execution-control/budget/initiative/:id returns summary envelope', async () => {
    const summary = {
      initiativeId: 'init-1',
      initiativeName: 'Initiative A',
      currency: 'USD',
      planned: { total: 1000, capex: 800, opex: 200 },
      actual: { total: 600, capex: 500, opex: 100 },
      variance: { total: -400, percent: 60 },
      burnRate: 60,
      forecast: { total: 950, isOverBudget: false },
      status: 'GREEN',
    };
    mockGetInitiativeBudgetSummary.mockResolvedValue(summary);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/budget/initiative/init-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual(summary);
    expect(mockGetInitiativeBudgetSummary).toHaveBeenCalledWith(ORG, 'init-1');
  });

  it('GET /api/v8/execution-control/capacity/leveling-alerts returns org-scoped alerts', async () => {
    mockGetLevelingAlerts.mockResolvedValue([
      {
        userId: 'u1',
        name: 'Alex',
        capacityHours: 40,
        allocatedHours: 52,
        overloadHours: 12,
        severity: 'critical',
        suggestion: 'Reassign 12h of work or extend deadlines',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/capacity/leveling-alerts');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.alerts).toHaveLength(1);
    expect(mockGetLevelingAlerts).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/execution-control/capacity/timeline returns org-scoped weeks', async () => {
    mockGetCapacityTimeline.mockResolvedValue([
      {
        weekStart: '2026-03-23',
        capacityHours: 40,
        allocatedHours: 28,
        availableHours: 12,
      },
    ]);

    const app = createApp();
    const res = await request(app).get(
      '/api/v8/execution-control/capacity/timeline?initiativeId=init-1'
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.weeks).toHaveLength(1);
    expect(mockGetCapacityTimeline).toHaveBeenCalledWith(ORG, 'init-1');
  });

  it('POST /api/v8/execution-control/risk-signals/dismiss persists org-scoped dismiss rows', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/risk-signals/dismiss')
      .send({ signalId: 'sig-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.signalId).toBe('sig-1');
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('PATCH /api/v8/execution-control/raid/:id/mitigation updates org-scoped mitigation fields', async () => {
    const app = createApp();
    const res = await request(app).patch('/api/v8/execution-control/raid/raid-1/mitigation').send({
      raidItemId: 'raid-1',
      mitigationPlan: 'Mitigate vendor dependency',
      mitigationStatus: 'IN_PROGRESS',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.raidItemId).toBe('raid-1');
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE raid_items SET'),
      expect.arrayContaining(['Mitigate vendor dependency', 'IN_PROGRESS', 'raid-1', ORG])
    );
  });

  it('POST /api/v8/execution-control/delay-signals/detect persists detected rows', async () => {
    mockDetectDelaySignals.mockResolvedValue([{ id: 'delay-1' }]);
    mockPersistDelaySignals.mockResolvedValue({ persisted: 1, alertsSent: 0 });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/delay-signals/detect')
      .send({ projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.detected).toBe(1);
    expect(mockDetectDelaySignals).toHaveBeenCalledWith(ORG, 'proj-1');
    expect(mockPersistDelaySignals).toHaveBeenCalledWith(ORG, [{ id: 'delay-1' }]);
  });

  it('POST /api/v8/execution-control/delay-signals/dismiss updates org-scoped dismiss state', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/delay-signals/dismiss').send({
      signalId: 'delay-1',
      entityType: 'INITIATIVE',
      entityId: 'init-1',
      deviationType: 'OVERDUE',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.signalId).toBe('delay-1');
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('POST /api/v8/execution-control/timeline-update updates org-scoped initiative fields', async () => {
    mockDbAll.mockResolvedValue([{ current_value: '2026-03-31' }]);

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/timeline-update').send({
      initiativeId: 'init-1',
      field: 'planned_end_date',
      value: '2026-04-15',
      reason: 'Rebased',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.oldValue).toBe('2026-03-31');
    expect(res.body.data?.newValue).toBe('2026-04-15');
    expect(mockDbAll).toHaveBeenCalled();
    expect(mockDbRun).toHaveBeenCalledTimes(2);
  });

  it('POST /api/v8/execution-control/budget/entries delegates to the budget service', async () => {
    mockCreateBudgetEntry.mockResolvedValue('be-1');

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/budget/entries').send({
      initiativeId: 'init-1',
      entryType: 'ACTUAL',
      costType: 'CAPEX',
      amount: 1200,
      periodMonth: 3,
      periodYear: 2026,
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
    expect(res.body.data?.id).toBe('be-1');
    expect(mockCreateBudgetEntry).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({
        initiativeId: 'init-1',
        entryType: 'ACTUAL',
        costType: 'CAPEX',
        amount: 1200,
        createdBy: UID,
      })
    );
  });
});
