/**
 * P03-B §7.2 — Integration tests: write→refresh→summary/detail agree.
 * Tests the 4 intervention endpoints + mandatory readback + baseline-variance + health.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_EXECUTION_CONTROL_MUTATION_CONTRACT,
  V8_EXECUTION_CONTROL_READ_CONTRACT,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
} from '../execution-control.routes.js';

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class {} },
    calendar: () => ({}),
  },
}));

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
  getExecutionControlTowerQueues: (...args: unknown[]) => mockGetExecutionControlTowerQueues(...args),
  getExecutionControlTowerItemDetail: (...args: unknown[]) => mockGetExecutionControlTowerItemDetail(...args),
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

let mockUser: { id: string; role: string; organizationId: string; isSuperAdmin: boolean } | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => {
  const mw = (req: any, res: any, next: () => void) => {
    if (!mockUser) { res.status(401).json({ error: 'No token' }); return; }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  };
  return {
    default: mw,
    verifyToken: mw,
    requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
    isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-p03-test';

const EMPTY_TOWER = {
  generatedAt: '2026-03-31T00:00:00.000Z',
  contract: 'execution_control_tower_v1',
  queues: { late: [], at_risk: [], blocked: [], overloaded: [], stale: [] },
  counts: { late: 0, at_risk: 0, blocked: 0, overloaded: 0, stale: 0 },
};

describe('P03-B §7.2 — intervention write→refresh→agree', () => {
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
    mockCreateBudgetEntry.mockResolvedValue('be-1');
    mockGetExecutionControlTowerQueues.mockResolvedValue(EMPTY_TOWER);
    mockGetExecutionControlTowerItemDetail.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('POST /interventions/reassign updates task and returns readback', async () => {
    mockDbAll.mockResolvedValueOnce([{ assignee_id: 'old-user' }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/reassign')
      .send({ entityType: 'TASK', entityId: 't1', newOwnerId: 'new-user', reason: 'Rebalance' });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('reassign');
    expect(res.body.data?.readback).toBeDefined();
    expect(res.body.data?.readback?.queues).toBeDefined();
    expect(mockDbRun).toHaveBeenCalled();
    expect(mockGetExecutionControlTowerQueues).toHaveBeenCalledWith(ORG, expect.any(Object));
  });

  it('POST /interventions/reassign updates initiative owner and returns readback', async () => {
    mockDbAll.mockResolvedValueOnce([{ owner_execution_id: 'old-owner' }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/reassign')
      .send({ entityType: 'INITIATIVE', entityId: 'i1', newOwnerId: 'new-owner' });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('reassign');
    expect(res.body.data?.readback?.queues).toBeDefined();
  });

  it('POST /interventions/smooth moves task dates and returns readback', async () => {
    mockDbAll.mockResolvedValueOnce([{ due_date: '2026-04-01', estimated_hours: 8 }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/smooth')
      .send({ entityType: 'TASK', entityId: 't1', forecastEndDate: '2026-04-15', allocatedHours: 12 });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('smooth');
    expect(res.body.data?.readback).toBeDefined();
  });

  it('POST /interventions/replan updates initiative forecast and returns readback', async () => {
    mockDbAll.mockResolvedValueOnce([{ planned_start_date: '2026-03-01', planned_end_date: '2026-04-01' }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/replan')
      .send({
        entityType: 'INITIATIVE',
        entityId: 'i1',
        forecastEndDate: '2026-05-01',
        reason: 'Scope expanded',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('replan');
    expect(res.body.data?.readback?.queues).toBeDefined();
  });

  it('POST /interventions/escalate creates RAID item and returns readback', async () => {
    mockDbAll.mockResolvedValueOnce([{ initiative_id: 'i1' }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/escalate')
      .send({
        entityType: 'TASK',
        entityId: 't1',
        escalationType: 'RISK',
        title: 'Vendor delay risk',
        description: 'Vendor may miss deadline',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.action).toBe('escalate');
    expect(res.body.data?.raidItemId).toBeDefined();
    expect(res.body.data?.readback).toBeDefined();
  });

  it('POST /interventions/reassign returns 404 when entity not found', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/execution-control/interventions/reassign')
      .send({ entityType: 'TASK', entityId: 'missing', newOwnerId: 'u1' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EXECUTION_ENTITY_NOT_FOUND');
  });

  it('GET /baseline-variance/:id returns variance when baseline exists', async () => {
    mockDbAll.mockResolvedValueOnce([{
      planned_start_date: '2026-03-01',
      planned_end_date: '2026-04-01',
      start_date: '2026-03-05',
      actual_end_date: null,
      progress: 40,
    }]);
    mockDbAll.mockResolvedValueOnce([]);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/baseline-variance/i1');

    expect(res.status).toBe(200);
    expect(res.body.data?.posture).toBe('baseline_available');
    expect(res.body.data?.variance?.startDays).toBe(4);
    expect(res.body.data?.degradedNote).toBeNull();
  });

  it('GET /baseline-variance/:id returns missing_baseline posture when no dates', async () => {
    mockDbAll.mockResolvedValueOnce([{
      planned_start_date: null,
      planned_end_date: null,
      start_date: null,
      actual_end_date: null,
      progress: 0,
    }]);

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/baseline-variance/i2');

    expect(res.status).toBe(200);
    expect(res.body.data?.posture).toBe('missing_baseline');
    expect(res.body.data?.variance).toBeNull();
    expect(res.body.data?.degradedNote).toContain('Missing baseline');
  });

  it('GET /control-tower/health reports degraded posture signals', async () => {
    mockGetExecutionControlTowerQueues.mockResolvedValueOnce({
      ...EMPTY_TOWER,
      queues: {
        ...EMPTY_TOWER.queues,
        at_risk: [
          {
            entityType: 'INITIATIVE',
            entityId: 'i-no-baseline',
            name: 'No baseline',
            why: [{ kind: 'baseline_forecast', detail: 'Missing baseline: brak planned_end_date' }],
            whatNext: [],
            affectsNext: [],
          },
        ],
        overloaded: [
          {
            entityType: 'TASK',
            entityId: 't-no-est',
            name: 'No estimate',
            why: [{ kind: 'estimate', detail: 'Brak wiarygodnego estimated_hours' }],
            whatNext: [],
            affectsNext: [],
          },
        ],
        stale: [
          {
            entityType: 'INITIATIVE',
            entityId: 'i-stale',
            name: 'Stale',
            why: [{ kind: 'stale', detail: 'Brak ruchu' }],
            whatNext: [],
            affectsNext: [],
          },
        ],
      },
      counts: { late: 0, at_risk: 1, blocked: 0, overloaded: 1, stale: 1 },
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/execution-control/control-tower/health');

    expect(res.status).toBe(200);
    expect(res.body.data?.healthy).toBe(false);
    expect(res.body.data?.posture).toBe('degraded_warning');
    expect(res.body.data?.degradedSignals).toHaveLength(3);
    expect(res.body.data?.degradedSignals.map((s: any) => s.type)).toEqual(
      expect.arrayContaining(['missing_baseline', 'missing_estimate', 'stale_data'])
    );
  });
});
