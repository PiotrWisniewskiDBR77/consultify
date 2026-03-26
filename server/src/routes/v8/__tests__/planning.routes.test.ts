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
const mockGetPortfolioRead = vi.fn();
const mockGetInitiativeDetailRead = vi.fn();
const mockGetInitiativeTaskDependenciesRead = vi.fn();
const mockGetInitiativeWatchersRead = vi.fn();
const mockGetInitiativeStakeholdersRead = vi.fn();
const mockGetInitiativeGateRolesRead = vi.fn();
const mockGetInitiativeStatusHistoryRead = vi.fn();
const mockGetInitiativeHistoryRead = vi.fn();
const mockGetInitiativeCommentsRead = vi.fn();
const mockGetInitiativeGateReadinessRead = vi.fn();
const mockGetInitiativeResourcesRead = vi.fn();
const mockGetInitiativeKpisRead = vi.fn();
const mockGetInitiativeBudgetItemsRead = vi.fn();
const mockGetInitiativeToolsRead = vi.fn();
const mockGetInitiativeIntangibleAssetsRead = vi.fn();
const mockGetInitiativeRaidRead = vi.fn();

vi.mock('../../../services/v8/planningContinuityService.js', () => ({
  getDecompositionTree: (...args: unknown[]) => mockGetDecompositionTree(...args),
  validateWBSCompleteness: (...args: unknown[]) => mockValidateWBSCompleteness(...args),
  getCriticalPath: (...args: unknown[]) => mockGetCriticalPath(...args),
  getCrossInitiativeDependencies: (...args: unknown[]) => mockGetCrossInitiativeDependencies(...args),
  getDecisionChainsByInitiative: (...args: unknown[]) => mockGetDecisionChainsByInitiative(...args),
  getPendingDecisions: (...args: unknown[]) => mockGetPendingDecisions(...args),
}));

vi.mock('../../../services/v8/planningPortfolioReadService.js', () => ({
  getPortfolioRead: (...args: unknown[]) => mockGetPortfolioRead(...args),
  getInitiativeDetailRead: (...args: unknown[]) => mockGetInitiativeDetailRead(...args),
  getInitiativeTaskDependenciesRead: (...args: unknown[]) => mockGetInitiativeTaskDependenciesRead(...args),
  getInitiativeWatchersRead: (...args: unknown[]) => mockGetInitiativeWatchersRead(...args),
  getInitiativeStakeholdersRead: (...args: unknown[]) => mockGetInitiativeStakeholdersRead(...args),
  getInitiativeGateRolesRead: (...args: unknown[]) => mockGetInitiativeGateRolesRead(...args),
  getInitiativeStatusHistoryRead: (...args: unknown[]) => mockGetInitiativeStatusHistoryRead(...args),
  getInitiativeHistoryRead: (...args: unknown[]) => mockGetInitiativeHistoryRead(...args),
  getInitiativeCommentsRead: (...args: unknown[]) => mockGetInitiativeCommentsRead(...args),
  getInitiativeGateReadinessRead: (...args: unknown[]) => mockGetInitiativeGateReadinessRead(...args),
  getInitiativeResourcesRead: (...args: unknown[]) => mockGetInitiativeResourcesRead(...args),
  getInitiativeKpisRead: (...args: unknown[]) => mockGetInitiativeKpisRead(...args),
  getInitiativeBudgetItemsRead: (...args: unknown[]) => mockGetInitiativeBudgetItemsRead(...args),
  getInitiativeToolsRead: (...args: unknown[]) => mockGetInitiativeToolsRead(...args),
  getInitiativeIntangibleAssetsRead: (...args: unknown[]) => mockGetInitiativeIntangibleAssetsRead(...args),
  getInitiativeRaidRead: (...args: unknown[]) => mockGetInitiativeRaidRead(...args),
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
    mockGetPortfolioRead.mockResolvedValue({ initiatives: [], stats: { total: 0, byStatus: {}, avgProgress: 0 } });
    mockGetInitiativeDetailRead.mockResolvedValue({ id: INIT, name: 'Initiative V8' });
    mockGetInitiativeTaskDependenciesRead.mockResolvedValue([]);
    mockGetInitiativeWatchersRead.mockResolvedValue([]);
    mockGetInitiativeStakeholdersRead.mockResolvedValue([]);
    mockGetInitiativeGateRolesRead.mockResolvedValue([]);
    mockGetInitiativeStatusHistoryRead.mockResolvedValue([]);
    mockGetInitiativeHistoryRead.mockResolvedValue([]);
    mockGetInitiativeCommentsRead.mockResolvedValue([]);
    mockGetInitiativeGateReadinessRead.mockResolvedValue({
      currentStatus: 'PLANNING',
      userRoles: ['PMO'],
      availableTransitions: [],
      readiness: [],
      allBlocking: true,
      allWarnings: true,
    });
    mockGetInitiativeResourcesRead.mockResolvedValue([]);
    mockGetInitiativeKpisRead.mockResolvedValue([]);
    mockGetInitiativeBudgetItemsRead.mockResolvedValue([]);
    mockGetInitiativeToolsRead.mockResolvedValue([]);
    mockGetInitiativeIntangibleAssetsRead.mockResolvedValue([]);
    mockGetInitiativeRaidRead.mockResolvedValue([]);
  });

  it('GET /api/v8/planning/initiatives/portfolio returns V8 envelope and forwards filters', async () => {
    mockGetPortfolioRead.mockResolvedValue({
      initiatives: [{ id: INIT, name: 'Initiative V8' }],
      stats: {
        total: 1,
        byStatus: { EXECUTING: 1 },
        executing: 1,
        approved: 0,
        review: 0,
        blockedCount: 0,
        done: 0,
        totalBudget: 10,
        totalValue: 20,
        avgProgress: 50,
      },
    });

    const app = createApp();
    const res = await request(app).get(
      '/api/v8/planning/initiatives/portfolio?projectId=proj-1&status=executing&priority=high&search=alpha'
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.initiatives?.[0]?.id).toBe(INIT);
    expect(mockGetPortfolioRead).toHaveBeenCalledWith(ORG, {
      projectId: 'proj-1',
      programId: undefined,
      statuses: undefined,
      status: ['executing'],
      priority: ['high'],
      search: 'alpha',
    });
  });

  it('GET /api/v8/planning/initiatives/:id returns V8 envelope and org-scoped initiative detail', async () => {
    const app = createApp();
    const res = await request(app)
      .get(`/api/v8/planning/initiatives/${INIT}`)
      .set('Accept-Language', 'pl-PL');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.initiative?.id).toBe(INIT);
    expect(mockGetInitiativeDetailRead).toHaveBeenCalledWith(INIT, ORG, 'pl');
  });

  it('GET /api/v8/planning/initiatives/:id/task-dependencies returns V8 envelope and org-scoped dependencies', async () => {
    mockGetInitiativeTaskDependenciesRead.mockResolvedValue([
      {
        id: 'dep-1',
        sourceTaskId: 'task-2',
        taskId: 'task-1',
        taskTitle: 'Define scope',
        dependencyType: 'FS',
        lagDays: 0,
        direction: 'predecessor',
      },
    ]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/task-dependencies`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.dependencies?.[0]?.id).toBe('dep-1');
    expect(mockGetInitiativeTaskDependenciesRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/watchers returns V8 envelope and org-scoped watchers', async () => {
    mockGetInitiativeWatchersRead.mockResolvedValue([{ id: 'watch-1', userId: 'user-1' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/watchers`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.watchers?.[0]?.id).toBe('watch-1');
    expect(mockGetInitiativeWatchersRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/stakeholders returns V8 envelope and org-scoped stakeholders', async () => {
    mockGetInitiativeStakeholdersRead.mockResolvedValue([{ id: 'stake-1', userId: 'user-2' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/stakeholders`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.stakeholders?.[0]?.id).toBe('stake-1');
    expect(mockGetInitiativeStakeholdersRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/gate-roles returns V8 envelope and org-scoped roles', async () => {
    mockGetInitiativeGateRolesRead.mockResolvedValue([{ id: 'role-1', gateRole: 'PROJECT_SPONSOR' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/gate-roles`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.roles?.[0]?.id).toBe('role-1');
    expect(mockGetInitiativeGateRolesRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/status-history returns V8 envelope and org-scoped history', async () => {
    mockGetInitiativeStatusHistoryRead.mockResolvedValue([{ id: 'hist-1', fromStatus: 'DRAFT', toStatus: 'REVIEW' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/status-history`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.history?.[0]?.id).toBe('hist-1');
    expect(mockGetInitiativeStatusHistoryRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/history returns V8 envelope and org-scoped activity history', async () => {
    mockGetInitiativeHistoryRead.mockResolvedValue([{ id: 'evt-1', eventType: 'status_changed' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/history`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.events?.[0]?.id).toBe('evt-1');
    expect(mockGetInitiativeHistoryRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/comments returns V8 envelope and org-scoped comments', async () => {
    mockGetInitiativeCommentsRead.mockResolvedValue([{ id: 'comment-1', content: 'Looks good' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.comments?.[0]?.id).toBe('comment-1');
    expect(mockGetInitiativeCommentsRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/gate-readiness-check returns V8 envelope and org-scoped readiness', async () => {
    mockGetInitiativeGateReadinessRead.mockResolvedValue({
      currentStatus: 'PLANNING',
      userRoles: ['PMO'],
      availableTransitions: [],
      readiness: [{ key: 'scope', label: 'Scope defined', pass: true, severity: 'warning' }],
      allBlocking: true,
      allWarnings: true,
    });

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/gate-readiness-check`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.readiness?.currentStatus).toBe('PLANNING');
    expect(mockGetInitiativeGateReadinessRead).toHaveBeenCalledWith(INIT, ORG, UID);
  });

  it('GET /api/v8/planning/initiatives/:id/resources returns V8 envelope and org-scoped resources', async () => {
    mockGetInitiativeResourcesRead.mockResolvedValue([{ id: 'res-1', role: 'Engineer' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/resources`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.resources?.[0]?.id).toBe('res-1');
    expect(mockGetInitiativeResourcesRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/kpis returns V8 envelope and org-scoped kpis', async () => {
    mockGetInitiativeKpisRead.mockResolvedValue([{ id: 'kpi-1', name: 'Revenue uplift' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/kpis`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.kpis?.[0]?.id).toBe('kpi-1');
    expect(mockGetInitiativeKpisRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/budget-items returns V8 envelope and org-scoped budget items', async () => {
    mockGetInitiativeBudgetItemsRead.mockResolvedValue([{ id: 'budget-1', category: 'software' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/budget-items`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.budgetItems?.[0]?.id).toBe('budget-1');
    expect(mockGetInitiativeBudgetItemsRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/tools returns V8 envelope and org-scoped tools', async () => {
    mockGetInitiativeToolsRead.mockResolvedValue([{ id: 'tool-1', name: 'Notion' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/tools`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.tools?.[0]?.id).toBe('tool-1');
    expect(mockGetInitiativeToolsRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/intangible-assets returns V8 envelope and org-scoped intangible assets', async () => {
    mockGetInitiativeIntangibleAssetsRead.mockResolvedValue([{ id: 'ia-1', name: 'Enablement pack' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/intangible-assets`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.intangibleAssets?.[0]?.id).toBe('ia-1');
    expect(mockGetInitiativeIntangibleAssetsRead).toHaveBeenCalledWith(INIT, ORG);
  });

  it('GET /api/v8/planning/initiatives/:id/raid returns V8 envelope and org-scoped raid items', async () => {
    mockGetInitiativeRaidRead.mockResolvedValue([{ id: 'raid-1', type: 'risk', title: 'Vendor risk' }]);

    const app = createApp();
    const res = await request(app).get(`/api/v8/planning/initiatives/${INIT}/raid?limit=25`);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_PLANNING_READ_CONTRACT);
    expect(res.body.data?.items?.[0]?.id).toBe('raid-1');
    expect(mockGetInitiativeRaidRead).toHaveBeenCalledWith(INIT, ORG, 25);
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

  it('GET /api/v8/planning/initiatives/:id/snapshot accepts tenant initiative ids that are not UUIDs', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/planning/initiatives/init-adma-07/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.data?.initiativeId).toBe('init-adma-07');
    expect(mockGetDecompositionTree).toHaveBeenCalledWith('init-adma-07', ORG);
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
