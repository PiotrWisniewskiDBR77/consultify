/**
 * RES-10 — Initiatives Goals vs Results Scorecards ownership separation.
 *
 * Mounts BOTH contracts in one Express app (the "mounted Results and
 * Initiatives in one flow" requirement) and proves, with the DB layer
 * mocked at the service boundary:
 *
 *  1. service/route ownership parity — each route delegates to its OWN
 *     owner service and stamps the matching `ownerDomain`.
 *  2. a single flow exercising both domains never cross-reads: creating/
 *     reading a goal never touches the scorecard service and vice versa.
 *  3. negative control — swapping which endpoint answers an identical id
 *     never returns the other owner's shape, even when the ids collide.
 *
 * DB is mocked at the service module boundary (`initiativeGovernanceService`
 * for goals, `kpiScorecardService` for scorecards) rather than at the SQL
 * layer, so this test is agnostic to the two services using different query
 * helpers (queryHelpers vs DbPromise) — it only asserts the HTTP contract.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGoals = vi.fn();
const mockGetGoal = vi.fn();
const mockCreateGoal = vi.fn();
const mockUpdateGoal = vi.fn();
const mockGetGoalRollup = vi.fn();
const mockLinkGoalToInitiative = vi.fn();
const mockGetGoalInitiatives = vi.fn();
const mockUnlinkGoalFromInitiative = vi.fn();

vi.mock('../../../services/initiativeGovernanceService.js', () => ({
  initiativeGovernanceService: {
    getGoals: (...args: unknown[]) => mockGetGoals(...args),
    getGoal: (...args: unknown[]) => mockGetGoal(...args),
    createGoal: (...args: unknown[]) => mockCreateGoal(...args),
    updateGoal: (...args: unknown[]) => mockUpdateGoal(...args),
    getGoalRollup: (...args: unknown[]) => mockGetGoalRollup(...args),
    linkGoalToInitiative: (...args: unknown[]) => mockLinkGoalToInitiative(...args),
    getGoalInitiatives: (...args: unknown[]) => mockGetGoalInitiatives(...args),
    unlinkGoalFromInitiative: (...args: unknown[]) => mockUnlinkGoalFromInitiative(...args),
  },
}));

const mockListScorecards = vi.fn();
const mockGetScorecard = vi.fn();
const mockGetScorecardKpis = vi.fn();
const mockCreateScorecard = vi.fn();
const mockUpdateScorecard = vi.fn();
const mockAddKpiToScorecard = vi.fn();
const mockRemoveKpiFromScorecard = vi.fn();

vi.mock('../../../services/results/kpiScorecardService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/results/kpiScorecardService.js')
  >('../../../services/results/kpiScorecardService.js');
  return {
    ...actual,
    listScorecards: (...args: unknown[]) => mockListScorecards(...args),
    getScorecard: (...args: unknown[]) => mockGetScorecard(...args),
    getScorecardKpis: (...args: unknown[]) => mockGetScorecardKpis(...args),
    createScorecard: (...args: unknown[]) => mockCreateScorecard(...args),
    updateScorecard: (...args: unknown[]) => mockUpdateScorecard(...args),
    addKpiToScorecard: (...args: unknown[]) => mockAddKpiToScorecard(...args),
    removeKpiFromScorecard: (...args: unknown[]) => mockRemoveKpiFromScorecard(...args),
  };
});

// results.routes.ts pulls in a wide surface of Results service modules at
// import time. Mock only what a bare import + the scorecard routes touch;
// everything else in this file is exercised by the pre-existing
// results.routes.test.ts, not here.
vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: vi.fn(),
  getReconciliationOverview: vi.fn(),
  getResultsKpiCatalog: vi.fn(),
  getResultsKpiDrawerDetail: vi.fn(),
  getROIPortfolioSummary: vi.fn(),
  getROIInitiativeDetail: vi.fn(),
}));
vi.mock('../../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: vi.fn(),
  getKpiReportSnapshot: vi.fn(),
  ResultsKpiReportSnapshotError: class extends Error {},
}));
vi.mock('../../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: vi.fn(),
}));
vi.mock('../../../services/reportBuilderService.js', () => ({
  createReport: vi.fn(),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token provided' });
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token provided' });
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import verifyToken from '../../../middleware/auth.middleware.js';
import { attachV8Context } from '../../../middleware/v8Auth.middleware.js';
import { RESULTS_SCORECARD_OWNER_DOMAIN } from '../../../services/results/kpiScorecardService.js';
import { INITIATIVE_GOALS_OWNER_DOMAIN } from '../../initiative-governance.routes.js';
import initiativeGovernanceRoutes from '../../initiative-governance.routes.js';
import resultsRoutes from '../results.routes.js';

function createCombinedApp(): Express {
  const app = express();
  app.use(express.json());
  // Mirrors real mounting: initiative-governance.routes.ts applies its own
  // verifyToken internally; v8/results.routes.ts relies on v8/index.ts to
  // apply verifyToken + attachV8Context before mounting it — replicate both here.
  app.use('/api/initiatives-v4', initiativeGovernanceRoutes);
  app.use('/api/v8/results', verifyToken, attachV8Context, resultsRoutes);
  return app;
}

const ORG_A = 'org-A';
const UID = 'user-A';

describe('RES-10 — Initiatives Goals vs Results Scorecards ownership separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, organizationId: ORG_A };
  });

  // ── 1. service/route ownership parity ──────────────────────────────────

  it('GET /api/initiatives-v4/goals delegates to initiativeGovernanceService and stamps ownerDomain:initiatives', async () => {
    mockGetGoals.mockResolvedValue([{ id: 'goal-1', goal_type: 'objective', title: 'Goal 1' }]);
    const app = createCombinedApp();

    const res = await request(app).get('/api/initiatives-v4/goals');

    expect(res.status).toBe(200);
    expect(res.body.ownerDomain).toBe('initiatives');
    expect(res.body.ownerDomain).toBe(INITIATIVE_GOALS_OWNER_DOMAIN);
    expect(res.body.goals).toEqual([{ id: 'goal-1', goal_type: 'objective', title: 'Goal 1' }]);
    expect(mockGetGoals).toHaveBeenCalledWith(ORG_A, undefined);
    // Ownership parity: the Results scorecard service was never touched.
    expect(mockListScorecards).not.toHaveBeenCalled();
    expect(mockGetScorecard).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/scorecards delegates to kpiScorecardService and stamps ownerDomain:results', async () => {
    mockListScorecards.mockResolvedValue([
      {
        id: 'card-1',
        organizationId: ORG_A,
        name: 'Finance Q1',
        department: 'Finance',
        periodLabel: 'Q1 2026',
        periodStart: null,
        periodEnd: null,
        status: 'active',
        kpiCount: 3,
        onTargetCount: 2,
      },
    ]);
    const app = createCombinedApp();

    const res = await request(app).get('/api/v8/results/scorecards');

    expect(res.status).toBe(200);
    expect(res.body.data.ownerDomain).toBe('results');
    expect(res.body.data.ownerDomain).toBe(RESULTS_SCORECARD_OWNER_DOMAIN);
    expect(res.body.data.scorecards).toHaveLength(1);
    expect(res.body.data.scorecards[0].name).toBe('Finance Q1');
    expect(mockListScorecards).toHaveBeenCalledWith(ORG_A, { userId: UID, isAdmin: false });
    // Ownership parity: the Initiatives goals service was never touched.
    expect(mockGetGoals).not.toHaveBeenCalled();
    expect(mockGetGoal).not.toHaveBeenCalled();
  });

  // ── 2. one flow exercising both domains, no cross-reads ────────────────

  it('a single flow creating a goal then a scorecard never mixes the two contracts', async () => {
    const app = createCombinedApp();

    mockCreateGoal.mockResolvedValue({ id: 'goal-flow-1' });
    const createGoalRes = await request(app)
      .post('/api/initiatives-v4/goals')
      .send({ title: 'Reduce churn' });
    expect(createGoalRes.status).toBe(201);
    expect(createGoalRes.body).toMatchObject({ id: 'goal-flow-1', ownerDomain: 'initiatives' });
    expect(mockCreateScorecard).not.toHaveBeenCalled();

    mockGetGoals.mockResolvedValue([
      { id: 'goal-flow-1', goal_type: 'objective', title: 'Reduce churn' },
    ]);
    const listGoalsRes = await request(app).get('/api/initiatives-v4/goals');
    expect(listGoalsRes.body.ownerDomain).toBe('initiatives');
    expect(listGoalsRes.body.goals.map((g: any) => g.id)).toEqual(['goal-flow-1']);

    mockCreateScorecard.mockResolvedValue({
      id: 'card-flow-1',
      organizationId: ORG_A,
      name: 'Board Q1',
      department: 'Board',
      periodLabel: 'Q1 2026',
      periodStart: null,
      periodEnd: null,
      status: 'active',
      kpiCount: 0,
      onTargetCount: 0,
    });
    const createCardRes = await request(app)
      .post('/api/v8/results/scorecards')
      .send({ name: 'Board Q1', department: 'Board' });
    expect(createCardRes.status).toBe(201);
    expect(createCardRes.body.data).toMatchObject({ ownerDomain: 'results' });
    expect(createCardRes.body.data.scorecard.id).toBe('card-flow-1');
    // Creating the scorecard must not have touched the goals service at all.
    expect(mockCreateGoal).toHaveBeenCalledTimes(1); // only the earlier goal create
    expect(mockUpdateGoal).not.toHaveBeenCalled();
    expect(mockGetGoal).not.toHaveBeenCalled();

    mockListScorecards.mockResolvedValue([
      {
        id: 'card-flow-1',
        organizationId: ORG_A,
        name: 'Board Q1',
        department: 'Board',
        periodLabel: 'Q1 2026',
        periodStart: null,
        periodEnd: null,
        status: 'active',
        kpiCount: 0,
        onTargetCount: 0,
      },
    ]);
    const listCardsRes = await request(app).get('/api/v8/results/scorecards');
    expect(listCardsRes.body.data.ownerDomain).toBe('results');
    // The goal created earlier must never surface through the scorecard list.
    expect(listCardsRes.body.data.scorecards.map((s: any) => s.id)).toEqual(['card-flow-1']);
    expect(JSON.stringify(listCardsRes.body)).not.toMatch(/goal-flow-1/);
  });

  // ── 3. negative control — swapping the endpoint never returns the other owner's shape ──

  it('negative control: an id shared by both a goal and a scorecard never leaks the other owner through the wrong endpoint', async () => {
    const SHARED_ID = 'shared-id-42';
    const app = createCombinedApp();

    mockGetGoal.mockResolvedValue({
      id: SHARED_ID,
      organization_id: ORG_A,
      goal_type: 'objective',
      title: 'Shared-id goal',
      progress: 40,
    });
    const goalRes = await request(app).get(`/api/initiatives-v4/goals/${SHARED_ID}`);
    expect(goalRes.status).toBe(200);
    expect(goalRes.body.ownerDomain).toBe('initiatives');
    expect(goalRes.body.goal_type).toBe('objective');
    // Scorecard-only fields must never appear on a goal response.
    expect(goalRes.body).not.toHaveProperty('kpiCount');
    expect(goalRes.body).not.toHaveProperty('department');
    expect(mockGetScorecardKpis).not.toHaveBeenCalled();
    expect(mockGetScorecard).not.toHaveBeenCalled();

    mockGetScorecardKpis.mockResolvedValue({
      scorecard: { id: SHARED_ID, name: 'Shared-id card' },
      kpis: [],
    });
    const cardRes = await request(app).get(`/api/v8/results/scorecards/${SHARED_ID}/kpis`);
    expect(cardRes.status).toBe(200);
    expect(cardRes.body.data.ownerDomain).toBe('results');
    expect(cardRes.body.data.scorecard.name).toBe('Shared-id card');
    // Goal-only fields must never appear on a scorecard response.
    expect(cardRes.body.data).not.toHaveProperty('goal_type');
    expect(cardRes.body.data).not.toHaveProperty('progress');
    expect(mockGetGoal).toHaveBeenCalledTimes(1); // only the earlier goal fetch
  });

  it('negative control: a scorecard id that does not exist for this org is 404, never falls back to a goal with the same id', async () => {
    const SHARED_ID = 'shared-id-99';
    mockGetScorecard.mockResolvedValue(null); // not this org's scorecard
    mockGetScorecardKpis.mockResolvedValue(null);
    mockGetGoal.mockResolvedValue({
      id: SHARED_ID,
      organization_id: ORG_A,
      goal_type: 'objective',
      title: 'A real goal with the colliding id',
    });
    const app = createCombinedApp();

    const res = await request(app).get(`/api/v8/results/scorecards/${SHARED_ID}/kpis`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/A real goal with the colliding id/);
    expect(mockGetGoal).not.toHaveBeenCalled();
  });
});
