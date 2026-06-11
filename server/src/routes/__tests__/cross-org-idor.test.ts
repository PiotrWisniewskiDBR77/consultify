/**
 * Bramka A — cross-org IDOR contract tests.
 *
 * Every W1/W2/W3 security fix from Sprints 1-3 must have a corresponding
 * cross-org 403/404 test here. Tests run against mocked DB and auth — no
 * real network or DB required.
 *
 * Coverage:
 *   W3 — p04KpiRoleFromRequest ignores x-kpi-role header (v8 results route)
 *   W1 — initiativeGovernanceService cross-org returns empty / throws 404
 *   W1 — DecisionController.decide cross-org → 404
 *   W2 — admin-data.routes /user-tiers cross-org → 403; no auth → 401
 *   W2 — competency.routes POST mutations require auth → 401 / 403
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (must be declared before vi.mock factories) ──────────

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const ORG_B = 'bbb00000-0000-4000-8000-000000000002';
const USER_A = 'user-a-111';

// ── Module mocks (hoisted; must only reference top-level vars) ───────────────

vi.mock('../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'Super admin required' });
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      if (!roles.includes(req.user.role))
        return res.status(403).json({ error: 'Insufficient role' });
      next();
    },
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'Admin required' });
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess:
    () =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      next();
    },
  requireOrgRole:
    () =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      next();
    },
  validateOrgMembership: (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryFirst: (...a: unknown[]) => mockQueryFirst(...a),
  queryOne: (...a: unknown[]) => mockQueryFirst(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  query: (...a: unknown[]) => mockQueryAll(...a),
  run: (...a: unknown[]) => mockQueryRun(...a),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => mockDbAll(...a),
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

// ── Service mocks for v8 results ─────────────────────────────────────────────

vi.mock('../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: vi.fn().mockResolvedValue(null),
  getResultsKpiCatalog: vi.fn().mockResolvedValue([]),
  getResultsKpiDrawerDetail: vi.fn().mockResolvedValue(null),
  getROIPortfolioSummary: vi.fn().mockResolvedValue(null),
  getROIInitiativeDetail: vi.fn().mockResolvedValue(null),
  initiateReconciliation: vi.fn().mockResolvedValue(null),
  resolveReconciliation: vi.fn().mockResolvedValue(null),
  getKpiSignals: vi.fn().mockResolvedValue([]),
  createKpiSignal: vi.fn().mockResolvedValue(null),
  acknowledgeKpiSignal: vi.fn().mockResolvedValue(null),
  getKpiNextActions: vi.fn().mockResolvedValue([]),
  createKpiNextAction: vi.fn().mockResolvedValue(null),
  completeKpiNextAction: vi.fn().mockResolvedValue(null),
  getKpiWorkflowStatus: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: vi.fn(),
}));

vi.mock('../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: vi.fn(),
}));

vi.mock('../../services/reportBuilderService.js', () => ({
  createReport: vi.fn(),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));

vi.mock('../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn(),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ── Service mocks for decisions ───────────────────────────────────────────────

vi.mock('../../services/auditLogService.js', () => ({ default: { log: vi.fn() } }));
vi.mock('../../services/AuditEventsService.js', () => ({ default: { log: vi.fn() } }));
vi.mock('../../services/decisionPlaybookService.js', () => ({
  default: {},
  PlaybookSchema: { parse: (x: any) => x },
}));
vi.mock('../../services/communicationService.js', () => ({ default: { sync: vi.fn() } }));
vi.mock('../../services/notificationService.js', () => ({ default: { send: vi.fn() } }));

// ── Service mocks for competency ──────────────────────────────────────────────

vi.mock('../../services/competencyTaxonomyService.js', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Test' }),
  updateCategory: vi.fn().mockResolvedValue(null),
  deleteCategory: vi.fn().mockResolvedValue(null),
  getSkills: vi.fn().mockResolvedValue([]),
  createSkill: vi.fn().mockResolvedValue({ id: 'skill-1' }),
  updateSkill: vi.fn().mockResolvedValue(null),
}));

// ── App builders ─────────────────────────────────────────────────────────────

async function buildV8App(): Promise<Express> {
  const { default: v8Router } = await import('../v8/index.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

async function buildAdminDataApp(): Promise<Express> {
  const mod = await import('../admin-data.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/admin-data', mod.default);
  return app;
}

async function buildCompetencyApp(): Promise<Express> {
  const mod = await import('../competency.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/competency', mod.default);
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
// W3 — x-kpi-role header self-escalation blocked
// ═══════════════════════════════════════════════════════════════════════════

describe('W3 — x-kpi-role header is ignored; role derived from JWT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0 });
  });

  it('viewer-role user cannot write KPIs even with x-kpi-role: kpi_owner header', async () => {
    // user JWT role 'user' → p04KpiRoleFromRequest → 'viewer' (ignores header)
    mockUser = { id: USER_A, role: 'user', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/kpis')
      .set('x-kpi-role', 'kpi_owner') // W3: must be ignored
      .send({
        name: 'Escalation attempt',
        targetValue: 100,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P04_PERMISSION_DENIED');
  });

  it('admin-role user can write KPIs without x-kpi-role header (JWT role → kpi_owner)', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbRun.mockResolvedValueOnce({ lastID: 'kpi-new' });
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/kpis')
      .send({
        name: 'Legitimate KPI',
        targetValue: 50,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
      });

    // admin → kpi_owner via JWT; should NOT be 403
    expect(res.status).not.toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// W1 — initiativeGovernanceService cross-org isolation
// ═══════════════════════════════════════════════════════════════════════════

describe('W1 — initiativeGovernanceService cross-org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resource NOT in caller's org (cross-org lookup returns null/empty)
    mockQueryFirst.mockResolvedValue(null);
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0 });
  });

  it('getGoalInitiatives returns [] when goal belongs to a different org', async () => {
    const { initiativeGovernanceService } = await import(
      '../../services/initiativeGovernanceService.js'
    );
    const result = await initiativeGovernanceService.getGoalInitiatives(ORG_A, 'goal-from-org-b');
    expect(result).toEqual([]);
    // Verify org-scoped query was issued
    const scopedCall = mockQueryFirst.mock.calls.find((c) =>
      String(c?.[0]).includes('organization_id')
    );
    expect(scopedCall).toBeTruthy();
  });

  it('linkGoalToInitiative throws 404 when goal belongs to a different org', async () => {
    const { initiativeGovernanceService } = await import(
      '../../services/initiativeGovernanceService.js'
    );
    await expect(
      initiativeGovernanceService.linkGoalToInitiative(ORG_A, 'goal-from-org-b', 'init-1')
    ).rejects.toMatchObject({ status: 404 });
  });

  it('getInitiativeDecisions returns [] when initiative belongs to a different org', async () => {
    const { initiativeGovernanceService } = await import(
      '../../services/initiativeGovernanceService.js'
    );
    const result = await initiativeGovernanceService.getInitiativeDecisions(
      ORG_A,
      'init-from-org-b'
    );
    expect(result).toEqual([]);
    const scopedCall = mockQueryFirst.mock.calls.find((c) =>
      String(c?.[0]).includes('organization_id')
    );
    expect(scopedCall).toBeTruthy();
  });

  it('linkDecisionToInitiative throws 404 when initiative belongs to a different org', async () => {
    const { initiativeGovernanceService } = await import(
      '../../services/initiativeGovernanceService.js'
    );
    await expect(
      initiativeGovernanceService.linkDecisionToInitiative(ORG_A, 'init-from-org-b', 'dec-1')
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// W1 — DecisionController.decide cross-org → 404
// ═══════════════════════════════════════════════════════════════════════════

describe('W1 — DecisionController.decide cross-org decision → 404', () => {
  async function buildDecisionsApp(): Promise<Express> {
    const mod = await import('../pmo/decisions.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/decisions', mod.default);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0 });
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0 });
    // Cross-org: decision not found for caller's org
    mockQueryFirst.mockResolvedValue(null);
  });

  it('PATCH /decide returns 404 when decision belongs to a different org', async () => {
    const app = await buildDecisionsApp();
    const res = await request(app)
      .patch('/api/decisions/dec-from-org-b/decide')
      .send({ decision: 'approved', rationale: 'cross-org attempt' });

    expect(res.status).toBe(404);
    // Verify the query included organization_id scope
    const scopedQuery = mockQueryFirst.mock.calls.find((c) =>
      String(c?.[0]).includes('organization_id')
    );
    expect(scopedQuery).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// W2 — admin-data.routes /user-tiers cross-org → 403; no auth → 401
// ═══════════════════════════════════════════════════════════════════════════

describe('W2 — admin-data.routes cross-org → 403 / no-auth → 401', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0 });
  });

  it('GET /user-tiers/:orgId without auth → 401', async () => {
    mockUser = null;
    const app = await buildAdminDataApp();
    const res = await request(app).get(`/api/admin-data/user-tiers/${ORG_B}`);
    expect(res.status).toBe(401);
  });

  it('GET /user-tiers/:orgId for a different org → 403', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildAdminDataApp();
    const res = await request(app).get(`/api/admin-data/user-tiers/${ORG_B}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('GET /user-tiers/:orgId for own org → 200', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildAdminDataApp();
    const res = await request(app).get(`/api/admin-data/user-tiers/${ORG_A}`);
    expect(res.status).toBe(200);
  });

  it('super_admin can access any org user tiers (cross-org allowed)', async () => {
    mockUser = { id: USER_A, role: 'super_admin', organizationId: ORG_A, isSuperAdmin: true };
    const app = await buildAdminDataApp();
    const res = await request(app).get(`/api/admin-data/user-tiers/${ORG_B}`);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// W2 — competency.routes requires auth on mutations
// ═══════════════════════════════════════════════════════════════════════════

describe('W2 — competency.routes POST mutations require auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /competency/categories without auth → 401', async () => {
    mockUser = null;
    const app = await buildCompetencyApp();
    const res = await request(app)
      .post('/api/competency/categories')
      .send({ name: 'Unauthorized Category' });
    expect(res.status).toBe(401);
  });

  it('POST /competency/categories with viewer role → 403 (write gate)', async () => {
    mockUser = { id: USER_A, role: 'viewer', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildCompetencyApp();
    const res = await request(app)
      .post('/api/competency/categories')
      .send({ name: 'Unauthorized Write' });
    expect(res.status).toBe(403);
  });

  it('GET /competency/categories without auth → 401', async () => {
    mockUser = null;
    const app = await buildCompetencyApp();
    const res = await request(app).get('/api/competency/categories');
    expect(res.status).toBe(401);
  });

  it('POST /competency/categories with admin role → 201 (mutation allowed)', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildCompetencyApp();
    const res = await request(app)
      .post('/api/competency/categories')
      .send({ name: 'Valid Category' });
    expect(res.status).toBe(201);
  });
});
