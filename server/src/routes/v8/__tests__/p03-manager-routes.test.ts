/**
 * P03 — Manager cockpit routes: problems, actions, analysis, decisions, execution, AI.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_EXECUTION_CONTROL_MUTATION_CONTRACT,
  V8_EXECUTION_CONTROL_READ_CONTRACT,
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
const mockDbGet = vi.fn();

const mockGetManagerProblems = vi.fn();
const mockExecuteManagerProblemAction = vi.fn();
const mockApplyManagerSuggestion = vi.fn();
const mockAnalyzeLane = vi.fn();
const mockGetAiRecommendation = vi.fn();
const mockGetAiTriage = vi.fn();
const mockGetAiManageAll = vi.fn();

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
  get: (...args: unknown[]) => mockDbGet(...args),
}));
vi.mock('../../../middleware/permission.middleware.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAnyPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
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

vi.mock('../../../services/v8/managerProblemsService.js', () => ({
  getManagerProblems: (...args: unknown[]) => mockGetManagerProblems(...args),
}));
vi.mock('../../../services/v8/managerActionExecutionService.js', () => ({
  executeManagerProblemAction: (...args: unknown[]) => mockExecuteManagerProblemAction(...args),
  applyManagerSuggestion: (...args: unknown[]) => mockApplyManagerSuggestion(...args),
}));
vi.mock('../../../services/v8/managerLaneAnalysisService.js', () => ({
  analyzeLane: (...args: unknown[]) => mockAnalyzeLane(...args),
}));
vi.mock('../../../services/v8/managerAiService.js', () => ({
  getAiRecommendation: (...args: unknown[]) => mockGetAiRecommendation(...args),
  getAiTriage: (...args: unknown[]) => mockGetAiTriage(...args),
  getAiManageAll: (...args: unknown[]) => mockGetAiManageAll(...args),
}));

let mockUser: { id: string; role: string; organizationId: string; isSuperAdmin: boolean } | null =
  null;

vi.mock('../../../middleware/auth.middleware.js', () => {
  const mw = (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token' });
      return;
    }
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
const LANE_BASE = '/api/v8/execution-control/manager/lanes/action-queue';

const EMPTY_TOWER = {
  generatedAt: '2026-03-31T00:00:00.000Z',
  contract: 'execution_control_tower_v1',
  queues: { late: [], at_risk: [], blocked: [], overloaded: [], stale: [] },
  counts: { late: 0, at_risk: 0, blocked: 0, overloaded: 0, stale: 0 },
};

describe('P03 — manager cockpit routes', () => {
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
    mockDbGet.mockResolvedValue(null);

    mockGetManagerProblems.mockResolvedValue([
      { id: 'p1', severity: 'warning', title: 'Test', actions: [] },
    ]);
    mockExecuteManagerProblemAction.mockResolvedValue({
      success: true,
      message: 'Done',
      changedCount: 1,
      changedEntities: [{ entityType: 'TASK', entityId: 't1' }],
    });
    mockApplyManagerSuggestion.mockResolvedValue({
      success: true,
      message: 'Done',
      changedCount: 1,
      changedEntities: [{ entityType: 'TASK', entityId: 't1' }],
    });
    mockAnalyzeLane.mockResolvedValue({
      observations: [],
      insights: [],
      effects: [],
      suggestions: [],
      decisions: [],
      executionPlan: [],
      severity: 'ok',
      confidence: 'high',
      lastRefreshed: '2026-04-11T00:00:00Z',
    });
    mockGetAiRecommendation.mockResolvedValue({
      problemId: 'p1',
      diagnosis: 'Test',
      recommendation: 'Fix',
      steps: [],
      confidence: 90,
      reasoning: 'Because',
      alternativeApproach: 'Or',
    });
    mockGetAiTriage.mockResolvedValue({
      clusters: [],
      topPriority: [],
      executiveSummary: 'OK',
    });
    mockGetAiManageAll.mockResolvedValue({
      laneId: 'action-queue',
      executiveSummary: 'Plan',
      clusters: [],
      quickWins: [],
      escalationNeeded: [],
    });
  });

  it('GET .../problems returns 200 with problems array', async () => {
    const app = createApp();
    const res = await request(app).get(`${LANE_BASE}/problems`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.problems)).toBe(true);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
  });

  it('POST .../problem-actions/execute returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`${LANE_BASE}/problem-actions/execute`)
      .send({ problemId: 'p1', actionId: 'reassign' });
    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_MUTATION_CONTRACT);
  });

  it('POST .../suggestions/apply returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`${LANE_BASE}/suggestions/apply`)
      .send({ suggestionId: 'sug-1' });
    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
  });

  it('GET .../analysis returns 200 with analysis object', async () => {
    const app = createApp();
    const res = await request(app).get(`${LANE_BASE}/analysis`);
    expect(res.status).toBe(200);
    expect(res.body.data?.severity).toBe('ok');
    expect(Array.isArray(res.body.data?.observations)).toBe(true);
    expect(res.body.meta?.contract).toBe(V8_EXECUTION_CONTROL_READ_CONTRACT);
  });

  it('POST .../decisions returns 200', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const app = createApp();
    const res = await request(app)
      .post(`${LANE_BASE}/decisions`)
      .send({ suggestionId: 'sug-1', state: 'accepted', notes: 'OK' });
    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.decisionId).toBeDefined();
  });

  it('POST .../execute returns 200', async () => {
    // decision lookup must resolve so the route doesn't 404
    mockDbGet.mockResolvedValueOnce({ id: 'dec-1' });
    const app = createApp();
    const res = await request(app).post(`${LANE_BASE}/execute`).send({ decisionId: 'dec-1' });
    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.planId).toBeDefined();
  });

  it('GET .../verification returns 200', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const app = createApp();
    const res = await request(app).get(`${LANE_BASE}/verification`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.plans)).toBe(true);
  });

  it('POST .../ai/recommend returns 200', async () => {
    const app = createApp();
    const res = await request(app).post(`${LANE_BASE}/ai/recommend`).send({ problemId: 'p1' });
    expect(res.status).toBe(200);
    expect(res.body.data?.problemId).toBe('p1');
    expect(res.body.data?.diagnosis).toBe('Test');
  });

  it('POST .../ai/triage returns 200', async () => {
    const app = createApp();
    const res = await request(app).post(`${LANE_BASE}/ai/triage`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data?.executiveSummary).toBe('OK');
    expect(Array.isArray(res.body.data?.clusters)).toBe(true);
  });

  it('POST .../ai/manage-all returns 200', async () => {
    const app = createApp();
    const res = await request(app).post(`${LANE_BASE}/ai/manage-all`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data?.executiveSummary).toBe('Plan');
    expect(Array.isArray(res.body.data?.clusters)).toBe(true);
  });
});
