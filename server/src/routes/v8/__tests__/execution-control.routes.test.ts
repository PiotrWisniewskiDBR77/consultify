import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_EXECUTION_CONTROL_MUTATION_CONTRACT,
  V8_EXECUTION_CONTROL_READ_CONTRACT,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
  default as executionControlRoutes,
} from '../execution-control.routes.js';

const mockDetectRiskSignals = vi.fn();
const mockGetTimelineWarningsSnapshot = vi.fn();
const mockDetectDelaySignals = vi.fn();
const mockGetPersistedDelaySignals = vi.fn();
const mockPersistDelaySignals = vi.fn();
const mockGetOverloadAlerts = vi.fn();
const mockGetCapacityTimeline = vi.fn();
const mockGetInitiativeBudgetSummary = vi.fn();
const mockGetPortfolioBudgetSummary = vi.fn();
const mockDetectOverspendSignals = vi.fn();
const mockCreateBudgetEntry = vi.fn();
const mockGetExecutionControlTowerQueues = vi.fn();
const mockGetExecutionControlTowerItemDetail = vi.fn();
const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
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
  getOverloadAlerts: (...args: unknown[]) => mockGetOverloadAlerts(...args),
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
  get: (...args: unknown[]) => mockDbGet(...args),
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

// The /manager surface is gated by requirePermission('manage_workstreams'),
// which otherwise hits PermissionService/DB. Pass through in tests — these tests
// validate handler-level same-org integrity, not the permission gate itself.
vi.mock('../../../middleware/permission.middleware.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAnyPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAllPermissions: () => (_req: unknown, _res: unknown, next: () => void) => next(),
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

function createApp(options: { productionBoundary?: boolean } = {}): Express {
  const app = express();
  app.use(express.json());
  if (options.productionBoundary) {
    app.use('/api/v8', v8Router);
  } else {
    // Handler characterization remains useful below the production boundary:
    // it proves the compatibility implementation remains tenant-safe while
    // the mounted V8 router is structurally read-only for mutations.
    app.use('/api/v8/execution-control', (req: any, _res, next) => {
      req.user = mockUser;
      req.userId = mockUser?.id;
      req.userRole = mockUser?.role;
      req.organizationId = mockUser?.organizationId;
      req.can = () => true;
      req.v8Context = {
        organizationId: mockUser?.organizationId,
        userId: mockUser?.id,
        userRole: mockUser?.role,
        isSuperAdmin: mockUser?.isSuperAdmin,
      };
      next();
    });
    app.use('/api/v8/execution-control', executionControlRoutes);
  }
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
    mockGetOverloadAlerts.mockResolvedValue([]);
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
    mockDbGet.mockResolvedValue({ id: 'init-1' });
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('mounted production boundary keeps reads and retires legacy mutations', async () => {
    const app = createApp({ productionBoundary: true });

    const read = await request(app).get('/api/v8/execution-control/risk-signals');
    expect(read.status).toBe(200);

    const mutation = await request(app)
      .post('/api/v8/execution-control/risk-signals/dismiss')
      .send({ signalId: 'sig-retired' });
    expect(mutation.status).toBe(409);
    expect(mutation.body).toMatchObject({
      code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      canonicalWriter: '/api/initiatives/runtime-v1',
    });
    expect(mockDbRun).not.toHaveBeenCalled();
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
      overloadWindow: 'week',
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
    // ★ #77 wiring fix (2026-07-19): route now calls getOverloadAlerts (hours-based,
    // matches the ExecutionHub.tsx V8ExecutionCapacityAlert contract) instead of
    // getLevelingAlerts (allocation%-based `{overloaded,underutilized,unfilledRoles}`
    // object — never an array, which silently emptied capacityAlerts app-wide).
    mockGetOverloadAlerts.mockResolvedValue([
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
    expect(mockGetOverloadAlerts).toHaveBeenCalledWith(ORG, 'week');
  });

  it('GET /api/v8/execution-control/capacity/timeline returns org-scoped weeks mapped to hours contract', async () => {
    // ★ #77 wiring fix (2026-07-19): getCapacityTimeline() (real service) returns
    // {weekStart, totalCapacity, totalAllocated, utilizationPercent} — the route
    // maps these to {capacityHours, allocatedHours, availableHours} because that's
    // what the ONLY frontend consumer (ExecutionHub.tsx GovernedCapacityWeek /
    // V8ExecutionCapacityWeek + ReportDocumentView "4-week horizon" table) reads.
    mockGetCapacityTimeline.mockResolvedValue([
      {
        weekStart: '2026-03-23',
        totalCapacity: 40,
        totalAllocated: 28,
        utilizationPercent: 70,
      },
    ]);

    const app = createApp();
    const res = await request(app).get(
      '/api/v8/execution-control/capacity/timeline?initiativeId=init-1'
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
    expect(res.body.data?.weeks).toHaveLength(1);
    expect(res.body.data?.weeks[0]).toEqual({
      weekStart: '2026-03-23',
      capacityHours: 40,
      allocatedHours: 28,
      availableHours: 12,
      utilizationPercent: 70,
    });
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetCapacityTimeline).toHaveBeenCalledWith(ORG, 'init-1');
  });

  it('GET /api/v8/execution-control/capacity/timeline returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get(
      '/api/v8/execution-control/capacity/timeline?initiativeId=missing-init'
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetCapacityTimeline).not.toHaveBeenCalled();
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

  // L-03: the dismiss UPSERT must guard the ON CONFLICT DO UPDATE with the
  // existing row's organization_id, so a cross-org id collision is a no-op
  // rather than dismissing another org's risk alert.
  it('POST /api/v8/execution-control/risk-signals/dismiss org-guards the ON CONFLICT DO UPDATE', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/risk-signals/dismiss')
      .send({ signalId: 'overdue-cross-org-id' });

    expect(res.status).toBe(200);
    const [sql, params] = mockDbRun.mock.calls[0];
    expect(String(sql)).toContain('ON CONFLICT (id) DO UPDATE');
    // org guard present in the conflict update + bound as the final param
    expect(String(sql)).toMatch(/WHERE\s+risk_signal_alerts\.organization_id\s*=\s*\?/);
    expect(params[params.length - 1]).toBe(ORG);
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

  // L-03: delay-signal dismiss first UPDATEs org-scoped (WHERE organization_id),
  // and only on a no-row fallback runs the INSERT … ON CONFLICT. That fallback
  // must also org-guard its DO UPDATE so a cross-org id collision is a no-op.
  it('POST /api/v8/execution-control/delay-signals/dismiss org-scopes the UPDATE and org-guards the ON CONFLICT fallback', async () => {
    // Force the fallback INSERT … ON CONFLICT path (UPDATE matched no org row).
    mockDbRun
      .mockResolvedValueOnce({ changes: 0 }) // UPDATE delay_signals … WHERE org → no-op
      .mockResolvedValueOnce({ changes: 1 }); // INSERT … ON CONFLICT fallback
    mockDbAll.mockResolvedValueOnce([{ entity_name: 'Initiative A' }]);

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/delay-signals/dismiss').send({
      signalId: 'overdue-cross-org-id',
      entityType: 'INITIATIVE',
      entityId: 'init-x',
      deviationType: 'OVERDUE',
    });

    expect(res.status).toBe(200);

    // 1st call: org-scoped UPDATE
    const [updateSql, updateParams] = mockDbRun.mock.calls[0];
    expect(String(updateSql)).toMatch(/UPDATE delay_signals/);
    expect(String(updateSql)).toMatch(/WHERE id = \? AND organization_id = \?/);
    expect(updateParams).toEqual(expect.arrayContaining([ORG]));

    // 2nd call: ON CONFLICT fallback with org-guarded DO UPDATE
    const [insertSql, insertParams] = mockDbRun.mock.calls[1];
    expect(String(insertSql)).toContain('ON CONFLICT (id)');
    expect(String(insertSql)).toMatch(/WHERE\s+delay_signals\.organization_id\s*=\s*\?/);
    expect(insertParams[insertParams.length - 1]).toBe(ORG);
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

  // Mass-assignment guard: the handler must NOT forward client-supplied protected
  // fields (created_by impersonation, organization_id override, row id) toward the
  // budget service. The route now passes only schema-validated fields plus the
  // server-derived createdBy / initiativeId — so the spread vector is closed.
  it('POST /api/v8/execution-control/budget/entries drops client-supplied protected fields', async () => {
    mockCreateBudgetEntry.mockResolvedValue('be-2');

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/budget/entries').send({
      initiativeId: 'init-1',
      entryType: 'ACTUAL',
      costType: 'CAPEX',
      amount: 1200,
      // Attacker-controlled protected fields — must be ignored by the route.
      createdBy: 'attacker-impersonated-user',
      organizationId: 'org-victim',
      organization_id: 'org-victim',
      id: 'be-forced-id',
      created_by: 'attacker-impersonated-user',
    });

    expect(res.status).toBe(200);
    expect(mockCreateBudgetEntry).toHaveBeenCalledTimes(1);
    const [orgArg, dataArg] = mockCreateBudgetEntry.mock.calls[0];
    // org is server-derived from the v8 context, never the body.
    expect(orgArg).toBe(ORG);
    // createdBy is always the authenticated caller, never the body value.
    expect(dataArg.createdBy).toBe(UID);
    // No protected/unknown column smuggled through the spread.
    expect(dataArg).not.toHaveProperty('organizationId');
    expect(dataArg).not.toHaveProperty('organization_id');
    expect(dataArg).not.toHaveProperty('id');
    expect(dataArg).not.toHaveProperty('created_by');
  });

  it('POST /api/v8/execution-control/budget/entries returns 404 when initiative is outside org scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/budget/entries').send({
      initiativeId: 'missing-init',
      entryType: 'ACTUAL',
      costType: 'CAPEX',
      amount: 500,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockCreateBudgetEntry).not.toHaveBeenCalled();
  });

  // Wave-4 IDOR: the INITIATIVE↔INITIATIVE dependency link branch previously
  // inserted from/to initiative ids (from the request body) without verifying
  // those initiatives belong to the caller's org — only the TASK branch did.
  // A foreign-org initiative id must now yield 403 and perform NO write.
  it('POST /api/v8/execution-control/interventions/dependency org-guards INITIATIVE link (foreign id → 403, no write)', async () => {
    // Both initiative org-ownership lookups resolve to a DIFFERENT org.
    mockDbGet
      .mockResolvedValueOnce({ organization_id: 'other-org-aaaa' })
      .mockResolvedValueOnce({ organization_id: 'other-org-bbbb' });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/dependency').send({
      action: 'link',
      fromEntityType: 'INITIATIVE',
      fromEntityId: 'init-foreign-from',
      toEntityType: 'INITIATIVE',
      toEntityId: 'init-foreign-to',
      semantics: 'blocking',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXECUTION_INITIATIVE_ORG_MISMATCH');
    // No INSERT into initiative_dependencies should have run.
    const ran = mockDbRun.mock.calls.some((c) => String(c[0]).includes('initiative_dependencies'));
    expect(ran).toBe(false);
  });

  it('POST /api/v8/execution-control/interventions/dependency returns 403 when one initiative is missing', async () => {
    // from-initiative belongs to caller org, to-initiative does not exist.
    mockDbGet.mockResolvedValueOnce({ organization_id: ORG }).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/dependency').send({
      action: 'link',
      fromEntityType: 'INITIATIVE',
      fromEntityId: 'init-mine',
      toEntityType: 'INITIATIVE',
      toEntityId: 'init-missing',
      semantics: 'blocking',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXECUTION_INITIATIVE_ORG_MISMATCH');
  });

  it('POST /api/v8/execution-control/interventions/dependency links INITIATIVE pair within same org', async () => {
    // Both initiatives belong to the caller's org → write proceeds.
    mockDbGet
      .mockResolvedValueOnce({ organization_id: ORG })
      .mockResolvedValueOnce({ organization_id: ORG });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/dependency').send({
      action: 'link',
      fromEntityType: 'INITIATIVE',
      fromEntityId: 'init-a',
      toEntityType: 'INITIATIVE',
      toEntityId: 'init-b',
      semantics: 'blocking',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    const inserted = mockDbRun.mock.calls.some((c) =>
      String(c[0]).includes('INSERT OR IGNORE INTO initiative_dependencies')
    );
    expect(inserted).toBe(true);
  });

  // M14 same-org integrity: PATCH /raid/:id/mitigation must verify the RAID item
  // exists in the caller's org before the org-scoped UPDATE — a bad/foreign id
  // returns 404 and performs NO write.
  it('PATCH /api/v8/execution-control/raid/:id/mitigation returns 404 for unknown/foreign RAID id (no write)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .patch('/api/v8/execution-control/raid/raid-foreign/mitigation')
      .send({ raidItemId: 'raid-foreign', mitigationStatus: 'IN_PROGRESS' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EXECUTION_RAID_NOT_FOUND');
    const ran = mockDbRun.mock.calls.some((c) => String(c[0]).includes('UPDATE raid_items'));
    expect(ran).toBe(false);
  });

  // M14 same-org integrity: POST /interventions/escalate INITIATIVE branch must
  // verify the initiative exists in the caller's org before inserting the raid_items
  // row — an unknown/foreign initiative id returns 404 and performs NO write.
  it('POST /api/v8/execution-control/interventions/escalate INITIATIVE returns 404 for unknown/foreign id (no write)', async () => {
    // Existence lookup (dbAll) returns no in-org initiative.
    mockDbAll.mockResolvedValueOnce([]);
    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/escalate').send({
      entityType: 'INITIATIVE',
      entityId: 'init-foreign',
      escalationType: 'RISK',
      title: 'Escalate',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EXECUTION_ENTITY_NOT_FOUND');
    const ran = mockDbRun.mock.calls.some((c) => String(c[0]).includes('INSERT INTO raid_items'));
    expect(ran).toBe(false);
  });

  // M14 same-org integrity: escalate TASK branch returns 404 for unknown/foreign
  // task id (was previously a silent escalate-against-null).
  it('POST /api/v8/execution-control/interventions/escalate TASK returns 404 for unknown/foreign id (no write)', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/escalate').send({
      entityType: 'TASK',
      entityId: 'task-foreign',
      escalationType: 'ISSUE',
      title: 'Escalate task',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EXECUTION_ENTITY_NOT_FOUND');
    const ran = mockDbRun.mock.calls.some((c) => String(c[0]).includes('INSERT INTO raid_items'));
    expect(ran).toBe(false);
  });

  // M14 same-org integrity: valid in-org INITIATIVE escalation proceeds to write.
  it('POST /api/v8/execution-control/interventions/escalate INITIATIVE succeeds for in-org id', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'init-1' }]);
    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/interventions/escalate').send({
      entityType: 'INITIATIVE',
      entityId: 'init-1',
      escalationType: 'RISK',
      title: 'Escalate',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('escalate');
    expect(res.body.data?.raidItemId).toBeTruthy();
    const ran = mockDbRun.mock.calls.some((c) => String(c[0]).includes('INSERT INTO raid_items'));
    expect(ran).toBe(true);
  });

  // M14 same-org integrity: POST /manager/lanes/:laneId/execute must verify the
  // referenced decision exists in the caller's org before creating an execution
  // plan — an unknown/foreign decisionId returns 404 and performs NO plan INSERT.
  it('POST /api/v8/execution-control/manager/lanes/:laneId/execute returns 404 for unknown/foreign decisionId (no write)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/manager/lanes/decisions/execute')
      .send({ decisionId: 'ldec-foreign' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MANAGER_DECISION_NOT_FOUND');
    const ran = mockDbRun.mock.calls.some((c) =>
      String(c[0]).includes('INSERT INTO v8_lane_execution_plans')
    );
    expect(ran).toBe(false);
  });

  // M14 same-org integrity: valid in-org decision proceeds to plan creation.
  it('POST /api/v8/execution-control/manager/lanes/:laneId/execute succeeds for in-org decision', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'ldec-1' });
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/manager/lanes/decisions/execute')
      .send({ decisionId: 'ldec-1' });

    expect(res.status).toBe(200);
    expect(res.body.data?.planId).toBeTruthy();
    const ran = mockDbRun.mock.calls.some((c) =>
      String(c[0]).includes('INSERT INTO v8_lane_execution_plans')
    );
    expect(ran).toBe(true);
  });
});
