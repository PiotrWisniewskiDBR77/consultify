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
  requireOrgAccess: () => (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
  requireOrgRole: () => (req: any, res: any, next: () => void) => {
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
  // RES-003A: v8/finance-intelligence.routes.ts (loaded transitively by
  // buildV8App() via v8/index.js) imports aiRateLimiter. It was missing from
  // this mock, so any full-suite run threw an uncaught "No aiRateLimiter
  // export" error the first time a v8-app test executed — pre-existing
  // breakage unrelated to RES-003A, but it corrupted shared mock state for
  // every test that ran afterward in the same file. Purely additive no-op
  // mock; does not change what any test asserts.
  aiRateLimiter: (_req: any, _res: any, next: () => void) => next(),
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

// RES-02: canonical KPI definition writer — create/update/archive now
// delegate here from both /api/benefits/kpis and /api/v8/results/kpis
// instead of running inline SQL. Keep the real error classes (importActual)
// so route `instanceof` checks against thrown errors still work.
const mockCreateKpiDefinition = vi.fn();
const mockUpdateKpiDefinition = vi.fn();
const mockArchiveKpiDefinition = vi.fn();
const mockGetCurrentKpiDefinition = vi.fn();
vi.mock('../../services/results/kpiDefinitionService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/results/kpiDefinitionService.js')
  >('../../services/results/kpiDefinitionService.js');
  return {
    ...actual,
    createDefinition: (...args: unknown[]) => mockCreateKpiDefinition(...args),
    updateDefinition: (...args: unknown[]) => mockUpdateKpiDefinition(...args),
    archiveDefinition: (...args: unknown[]) => mockArchiveKpiDefinition(...args),
    getCurrentDefinition: (...args: unknown[]) => mockGetCurrentKpiDefinition(...args),
  };
});

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

async function buildBenefitsApp(): Promise<Express> {
  const mod = await import('../benefits.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/benefits', mod.default);
  return app;
}

async function buildResultsEnterpriseApp(): Promise<Express> {
  const mod = await import('../results-enterprise.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/results-v4', mod.default);
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
    const res = await request(app).post('/api/v8/results/kpis').send({
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
// W1 — benefits KPI time-series write is org-scoped (M15 P0 / L-11, 91c8245559)
// ═══════════════════════════════════════════════════════════════════════════

describe('W1 — POST /benefits/kpis/:kpiId/time-series cannot mutate a foreign org KPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue(null);
    // PRAGMA table_info(initiative_kpis) → current_value column exists,
    // so the route reaches the org-scoped UPDATE branch.
    mockDbAll.mockResolvedValue([{ name: 'current_value' }]);
    mockDbRun.mockResolvedValue({ changes: 0, lastID: 'ts-1' });
  });

  // SEC-3 (L-04) wave 6: org-scoping the inserted column was not enough — a foreign-org
  // kpiId still got a measurement (+ a deviation case) recorded under the caller's org.
  // The route now verifies parent-KPI ownership and 404s before any write.

  it('→ 404 for a foreign-org KPI (no INSERT, no UPDATE)', async () => {
    // Parent-KPI ownership SELECT returns null → not owned by the caller's org.
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildBenefitsApp();

    const res = await request(app)
      .post('/api/benefits/kpis/kpi-from-org-b/time-series')
      .send({ value: 999, periodStart: '2026-01-15', source: 'manual' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');

    // Ownership SELECT ran org-scoped against the caller's org.
    const ownershipCall = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+initiative_kpis/i.test(String(c?.[0])) &&
        /COALESCE\(k\.organization_id,\s*i\.organization_id\)\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(ownershipCall?.[1]).toEqual(['kpi-from-org-b', ORG_A]);

    // Neither the time-series INSERT nor the current_value UPDATE may run.
    const insertCall = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_time_series/i.test(String(c?.[0]))
    );
    expect(insertCall).toBeFalsy();
    const updateCall = mockDbRun.mock.calls.find((c) =>
      /UPDATE\s+initiative_kpis/i.test(String(c?.[0]))
    );
    expect(updateCall).toBeFalsy();
  });

  it('→ 200 with org-scoped INSERT + UPDATE when the KPI is owned', async () => {
    // Parent-KPI ownership SELECT resolves → owned by the caller's org.
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbGet.mockResolvedValue({ id: 'kpi-owned', measurement_frequency: 'MONTHLY' });
    const app = await buildBenefitsApp();

    const res = await request(app)
      .post('/api/benefits/kpis/kpi-owned/time-series')
      .send({ value: 999, periodStart: '2026-01-15', source: 'manual' });

    expect(res.status).toBe(200);

    // INSERT writes the caller's org (3rd positional in the VALUES list).
    const insertCall = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_time_series/i.test(String(c?.[0]))
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[1]?.[2]).toBe(ORG_A);

    // current_value UPDATE is org-scoped: [value, kpiId, orgId] — never the target's org.
    const updateCall = mockDbRun.mock.calls.find(
      (c) =>
        /UPDATE\s+initiative_kpis/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[1]).toEqual([999, 'kpi-owned', ORG_A]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L-04 / SEC-3 — benefits ROI + deviation writes verify parent ownership
// (mirrors the already-fixed v8 router; legacy /api/benefits/* was unscoped)
// ═══════════════════════════════════════════════════════════════════════════

describe('L-04 / SEC-3 — benefits ROI / deviation writes reject foreign-org parent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbAll.mockResolvedValue([]);
    // Default: parent lookup (org-scoped SELECT) returns null → foreign-org / not found.
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0, lastID: 'x' });
  });

  it('PUT /benefits/roi/:initiativeId/assumptions → 404 for a foreign-org initiative (no UPSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .put('/api/benefits/roi/init-from-org-b/assumptions')
      .send({ capex: 1000, expectedRoiPercent: 50 });

    expect(res.status).toBe(404);
    // Parent ownership SELECT was org-scoped against the caller's org…
    const ownershipCall = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+initiatives/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(ownershipCall).toBeTruthy();
    expect(ownershipCall?.[1]).toEqual(['init-from-org-b', ORG_A]);
    // …and no INSERT/UPSERT into roi_assumptions ran (the cross-org write is blocked).
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+roi_assumptions/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
  });

  it('PUT /benefits/roi/:initiativeId/assumptions → 200 + UPSERT when the initiative is owned', async () => {
    mockDbGet.mockResolvedValue({ id: 'init-owned' });
    const app = await buildBenefitsApp();
    const res = await request(app)
      .put('/api/benefits/roi/init-owned/assumptions')
      .send({ capex: 1000, expectedRoiPercent: 50 });

    expect(res.status).toBe(200);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+roi_assumptions/i.test(String(c?.[0]))
    );
    expect(upsert).toBeTruthy();
    // organization_id param (3rd positional) is the caller's org.
    expect(upsert?.[1]?.[2]).toBe(ORG_A);
  });

  it('POST /benefits/roi/:initiativeId/realized → 404 for a foreign-org initiative (no INSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/roi/init-from-org-b/realized')
      .send({ periodMonth: '2026-01', realizedSavings: 500 });

    expect(res.status).toBe(404);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+roi_realized_values/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /benefits/deviation-cases/:caseId/actions → 404 for a foreign-org case (no INSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/deviation-cases/case-from-org-b/actions')
      .send({ title: 'cross-org action attempt' });

    expect(res.status).toBe(404);
    // The org-scoped case lookup ran with the caller's org…
    const caseLookup = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+kpi_deviation_cases/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(caseLookup).toBeTruthy();
    expect(caseLookup?.[1]).toEqual(['case-from-org-b', ORG_A]);
    // …and no action row was inserted into the foreign org's case.
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-3 (wave 4) — remaining M15 Results cross-org write holes
// ═══════════════════════════════════════════════════════════════════════════

describe('SEC-3 wave 4 — M15 Results endpoints reject cross-org writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0, lastID: 'x' });
    mockQueryFirst.mockResolvedValue(null);
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0, changes: 0 });
  });

  // ── HOLE-1: benefits POST /kpi-mappings (UNIQUE(initiative_id,kpi_id) is global) ──

  it('POST /benefits/kpi-mappings → 404 for a foreign-org initiative (no UPSERT)', async () => {
    // Parent initiative lookup returns null → not owned.
    mockDbGet.mockResolvedValue(null);
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/kpi-mappings')
      .send({ initiativeId: 'init-from-org-b', kpiId: 'kpi-x', impactWeight: 1 });

    expect(res.status).toBe(404);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+initiative_kpi_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
    // Ownership SELECT ran org-scoped against the caller's org.
    const ownershipCall = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+initiatives/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(ownershipCall?.[1]).toEqual(['init-from-org-b', ORG_A]);
  });

  it('POST /benefits/kpi-mappings → 404 when initiative owned but KPI is foreign-org', async () => {
    // 1st get (initiative) → owned; 2nd get (kpi) → null (foreign).
    mockDbGet.mockResolvedValueOnce({ id: 'init-owned' }).mockResolvedValueOnce(null);
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/kpi-mappings')
      .send({ initiativeId: 'init-owned', kpiId: 'kpi-from-org-b', impactWeight: 1 });

    expect(res.status).toBe(404);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+initiative_kpi_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
  });

  it('POST /benefits/kpi-mappings → 200 + UPSERT when both parents are owned', async () => {
    mockDbGet
      .mockResolvedValueOnce({ id: 'init-owned' })
      .mockResolvedValueOnce({ id: 'kpi-owned' });
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/kpi-mappings')
      .send({ initiativeId: 'init-owned', kpiId: 'kpi-owned', impactWeight: 1 });

    expect(res.status).toBe(200);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+initiative_kpi_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeTruthy();
    // organization_id param (4th positional) is the caller's org.
    expect(upsert?.[1]?.[3]).toBe(ORG_A);
  });

  // ── Input validation: malformed body must not corrupt benefits rows ──

  it('POST /benefits/attribution/:kpiId/snapshot → 400 when period bounds are missing (no INSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/attribution/kpi-x/snapshot')
      .send({ periodStart: '2026-01-01' }); // periodEnd missing

    expect(res.status).toBe(400);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_attribution_snapshots/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /benefits/financial/statement-lines → 400 when identity fields are missing (no INSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/financial/statement-lines')
      .send({ lineName: 'Revenue' }); // statementType + lineCode missing

    expect(res.status).toBe(400);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+financial_statement_lines/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /benefits/financial/kpi-mappings → 400 when key fields are missing (no UPSERT)', async () => {
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/financial/kpi-mappings')
      .send({ kpiId: 'kpi-x' }); // statementLineId + direction missing

    expect(res.status).toBe(400);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_financial_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
  });

  it('POST /benefits/financial/kpi-mappings → 200 + UPSERT with a numeric multiplier fallback', async () => {
    // Both parent lookups owned: 1st get (KPI ownership) → owned; 2nd (statement line) → owned.
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-x' }).mockResolvedValueOnce({ id: 'line-x' });
    const app = await buildBenefitsApp();
    const res = await request(app).post('/api/benefits/financial/kpi-mappings').send({
      kpiId: 'kpi-x',
      statementLineId: 'line-x',
      direction: 'positive',
      multiplier: 'not-a-number',
    });

    expect(res.status).toBe(200);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_financial_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeTruthy();
    // multiplier (7th positional) falls back to 1.0 rather than persisting NaN/junk.
    expect(upsert?.[1]?.[6]).toBe(1.0);
  });

  // ── SEC-3 wave 6: cross-parent ownership 404s on the financial linkage routes ──

  it('POST /benefits/financial/kpi-mappings → 404 when the KPI is foreign-org (no UPSERT)', async () => {
    // KPI ownership SELECT returns null → not owned.
    mockDbGet.mockResolvedValue(null);
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/financial/kpi-mappings')
      .send({ kpiId: 'kpi-from-org-b', statementLineId: 'line-x', direction: 'positive' });

    expect(res.status).toBe(404);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_financial_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
  });

  it('POST /benefits/financial/kpi-mappings → 404 when KPI owned but statement line is foreign-org (no UPSERT)', async () => {
    // 1st get (KPI) → owned; 2nd get (statement line) → null (foreign / unknown).
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-owned' }).mockResolvedValueOnce(null);
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/financial/kpi-mappings')
      .send({ kpiId: 'kpi-owned', statementLineId: 'line-from-org-b', direction: 'positive' });

    expect(res.status).toBe(404);
    const upsert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_financial_mappings/i.test(String(c?.[0]))
    );
    expect(upsert).toBeFalsy();
  });

  it('POST /benefits/financial/statement-lines → 404 when parentLineId is foreign-org (no INSERT)', async () => {
    // Parent-line ownership SELECT returns null → neither owned nor a shared system line.
    mockDbGet.mockResolvedValue(null);
    const app = await buildBenefitsApp();
    const res = await request(app).post('/api/benefits/financial/statement-lines').send({
      statementType: 'PL',
      lineCode: 'REV',
      lineName: 'Revenue',
      parentLineId: 'line-from-org-b',
    });

    expect(res.status).toBe(404);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+financial_statement_lines/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /benefits/attribution/:kpiId/snapshot → 404 for a foreign-org KPI (no INSERT)', async () => {
    // Parent-KPI ownership SELECT returns null → not owned.
    mockDbGet.mockResolvedValue(null);
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/attribution/kpi-from-org-b/snapshot')
      .send({ periodStart: '2026-01-01', periodEnd: '2026-03-31' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_attribution_snapshots/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  // ── HOLE-2: v8 POST /results/kpis/:kpiId/time-series current_value UPDATE org-scope ──

  it('v8 POST /results/kpis/:kpiId/time-series current_value UPDATE is org-scoped', async () => {
    // PRAGMA table_info(initiative_kpis) → current_value present → reaches the UPDATE branch.
    mockDbAll.mockResolvedValue([{ name: 'current_value' }]);
    // KPI ownership precheck → owned (else the route 404s before any write).
    mockDbGet.mockResolvedValue({ id: 'kpi-from-org-b' });
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/kpis/kpi-from-org-b/time-series')
      .send({ value: 777, periodStart: '2026-03-01', source: 'manual' });

    expect(res.status).toBe(201);
    const updateCall = mockDbRun.mock.calls.find(
      (c) =>
        /UPDATE\s+initiative_kpis/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(updateCall).toBeTruthy();
    // Param order: [value, kpiId, orgId] — never the target's org.
    expect(updateCall?.[1]).toEqual([777, 'kpi-from-org-b', ORG_A]);
  });

  // ── HOLE-3: v8 POST /results/workflow/kpi/:kpiId/next-action ──

  it('v8 next-action → 403 for a viewer-role user (RBAC gate)', async () => {
    mockUser = { id: USER_A, role: 'user', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-x/next-action')
      .send({ title: 'x', sourceType: 'manual', sourceRef: 'case-x' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('v8 next-action → 404 when the KPI is foreign-org (no INSERT)', async () => {
    // KPI ownership lookup returns null.
    mockDbGet.mockResolvedValue(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-from-org-b/next-action')
      .send({ title: 'x', sourceType: 'signal', sourceRef: 'case-x' });

    expect(res.status).toBe(404);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('v8 next-action → 404 when sourceRef is a foreign-org deviation case used as a signal (no INSERT)', async () => {
    // 1st get (KPI ownership) → owned; 2nd (v8_kpi_signals org-scoped) → null;
    // 3rd (kpi_deviation_cases org-scoped) → null. A foreign-org case is invisible to
    // both org-scoped lookups, so the signal-ref guard rejects it before any INSERT.
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-owned' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'x', sourceType: 'signal', sourceRef: 'case-from-org-b' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_SIGNAL_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('v8 next-action → 404 when a manual sourceRef collides with a foreign-org deviation case (no INSERT)', async () => {
    // manual has no backing table, so it skips straight to the defense-in-depth
    // existing-case collision check: 1st (KPI) → owned; 2nd (unscoped existing-case) → ORG_B.
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-owned' })
      .mockResolvedValueOnce({ id: 'case-from-org-b', organization_id: ORG_B });
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'x', sourceType: 'manual', sourceRef: 'case-from-org-b' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_DEVIATION_CASE_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  // ── HOLE-3b: v8 next-action sourceRef cross-table validation (wave-5 follow-up) ──

  it('v8 next-action → 404 when signal sourceRef does not exist in the caller org (no INSERT)', async () => {
    // 1st get (KPI ownership) → owned; 2nd (v8_kpi_signals) → null;
    // 3rd (kpi_deviation_cases org-scoped) → null → neither backing row exists.
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-owned' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'x', sourceType: 'signal', sourceRef: 'signal-does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_SIGNAL_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
    // The signal lookup ran org-scoped against the caller's org.
    const signalLookup = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+v8_kpi_signals/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(signalLookup?.[1]).toEqual(['signal-does-not-exist', ORG_A]);
  });

  it('v8 next-action → 404 when report sourceRef does not exist in the caller org (no INSERT)', async () => {
    // 1st get (KPI ownership) → owned; 2nd (results_kpi_report_snapshots) → null.
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-owned' }).mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'x', sourceType: 'report', sourceRef: 'report-from-org-b' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_REPORT_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('v8 next-action → 404 when reconciliation sourceRef does not exist in the caller org (no INSERT)', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-owned' }).mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'x', sourceType: 'reconciliation', sourceRef: 'recon-from-org-b' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_RECONCILIATION_NOT_FOUND');
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('v8 next-action → 200 + INSERT when signal sourceRef is owned by the caller org', async () => {
    // 1st (KPI ownership) → owned; 2nd (v8_kpi_signals org-scoped) → owned signal;
    // 3rd (existingCase collision check) → null (not a deviation case id).
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-owned' })
      .mockResolvedValueOnce({ id: 'signal-owned' })
      .mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'fix it', sourceType: 'signal', sourceRef: 'signal-owned' });

    expect(res.status).toBe(200);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeTruthy();
    // case_id (2nd positional) is the validated, owned sourceRef.
    expect(insert?.[1]?.[1]).toBe('signal-owned');
  });

  it('v8 next-action → 200 + INSERT for a manual sourceRef (no backing table to validate)', async () => {
    // 1st (KPI ownership) → owned; 2nd (existingCase collision check) → null.
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-owned' }).mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/workflow/kpi/kpi-owned/next-action')
      .send({ title: 'manual followup', sourceType: 'manual', sourceRef: 'free-form-ref' });

    expect(res.status).toBe(200);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_deviation_actions/i.test(String(c?.[0]))
    );
    expect(insert).toBeTruthy();
  });

  // ── HOLE-4: results-v4 connector ingest (resultsEnterpriseService) ──

  it('POST /results-v4/kpi-connectors/:id/ingest → 404 for a foreign-org connector (no time-series write)', async () => {
    // Connector ownership lookup (queryOne → mockQueryFirst) returns null.
    mockQueryFirst.mockResolvedValue(null);
    const app = await buildResultsEnterpriseApp();
    const res = await request(app)
      .post('/api/results-v4/kpi-connectors/conn-from-org-b/ingest')
      .send({ kpiId: 'kpi-x', value: 5, period: '2026-01' });

    expect(res.status).toBe(404);
    const tsInsert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_time_series/i.test(String(c?.[0]))
    );
    expect(tsInsert).toBeFalsy();
    // No cross-org current_value overwrite either.
    const kpiUpdate = mockQueryRun.mock.calls.find((c) =>
      /UPDATE\s+initiative_kpis\s+SET\s+current_value/i.test(String(c?.[0]))
    );
    expect(kpiUpdate).toBeFalsy();
  });

  it('connector ingest current_value UPDATE is org-scoped when the connector is owned', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'conn-owned' });
    const app = await buildResultsEnterpriseApp();
    const res = await request(app)
      .post('/api/results-v4/kpi-connectors/conn-owned/ingest')
      .send({ kpiId: 'kpi-x', value: 5, period: '2026-01' });

    expect(res.status).toBe(201);
    const kpiUpdate = mockQueryRun.mock.calls.find((c) =>
      /UPDATE\s+initiative_kpis\s+SET\s+current_value/i.test(String(c?.[0]))
    );
    expect(kpiUpdate).toBeTruthy();
    expect(/AND\s+organization_id\s*=\s*\?/i.test(String(kpiUpdate?.[0]))).toBe(true);
    // Param order: [value, kpiId, orgId].
    expect(kpiUpdate?.[1]).toEqual([5, 'kpi-x', ORG_A]);
  });

  // ── RESPONSE-LEAK: GET /results-v4/kpi-connectors must not return raw secrets ──

  it('GET /results-v4/kpi-connectors redacts secret-bearing config keys (no credential leak)', async () => {
    // The stored connector config holds credentials in a free-form blob. The GET
    // response must replace each secret with the "__set__" placeholder (mirroring
    // mcp.routes redactProviderConfig) while leaving non-secret operational config
    // (baseUrl, defaultValue, staticPayloads) intact.
    mockQueryAll.mockResolvedValue([
      {
        id: 'conn-1',
        connector_name: 'IRIS prod',
        connector_type: 'api',
        config: JSON.stringify({
          baseUrl: 'https://iris.example.com',
          apiKey: 'sk-live-SUPERSECRET',
          token: 'bearer-abc-123',
          password: 'hunter2',
          client_secret: 'cs-zzz',
          defaultValue: 42,
          headers: { Authorization: 'Bearer leak-me', 'X-Api-Token': 'tok-leak' },
        }),
        target_kpi_ids: JSON.stringify(['kpi-1']),
        schedule_cron: null,
        last_run_at: null,
        last_run_status: null,
        last_run_message: null,
        next_run_at: null,
        is_active: 1,
      },
    ]);
    const app = await buildResultsEnterpriseApp();
    const res = await request(app).get('/api/results-v4/kpi-connectors');

    expect(res.status).toBe(200);
    const cfg = res.body?.connectors?.[0]?.config ?? {};
    const serialized = JSON.stringify(res.body);
    // No raw secret value anywhere in the payload.
    expect(serialized).not.toContain('sk-live-SUPERSECRET');
    expect(serialized).not.toContain('bearer-abc-123');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('cs-zzz');
    expect(serialized).not.toContain('Bearer leak-me');
    expect(serialized).not.toContain('tok-leak');
    // Secret keys carry the placeholder; non-secret config survives untouched.
    expect(cfg.apiKey).toBe('__set__');
    expect(cfg.token).toBe('__set__');
    expect(cfg.password).toBe('__set__');
    expect(cfg.client_secret).toBe('__set__');
    // All auth-header values are redacted (headers commonly carry bearer tokens).
    expect(cfg.headers?.Authorization).toBe('__set__');
    expect(cfg.headers?.['X-Api-Token']).toBe('__set__');
    expect(cfg.baseUrl).toBe('https://iris.example.com');
    expect(cfg.defaultValue).toBe(42);
  });

  // ── SEC-3: results-v4 ROI evidence parent-ownership precheck ──

  it('POST /results-v4/roi-evidence → 404 for a foreign-org initiative (no roi_evidence INSERT)', async () => {
    // Parent ownership lookup (queryOne → mockQueryFirst) returns null → not owned.
    mockQueryFirst.mockResolvedValue(null);
    const app = await buildResultsEnterpriseApp();
    const res = await request(app)
      .post('/api/results-v4/roi-evidence')
      .send({ initiativeId: 'init-from-org-b', value: 1000, period: '2026-01' });

    expect(res.status).toBe(404);
    // The parent SELECT ran org-scoped against the caller's org.
    const ownershipCall = mockQueryFirst.mock.calls.find((c) =>
      /FROM\s+initiatives\s+WHERE\s+id\s*=\s*\?\s+AND\s+organization_id\s*=\s*\?/i.test(
        String(c?.[0])
      )
    );
    expect(ownershipCall?.[1]).toEqual(['init-from-org-b', ORG_A]);
    // No evidence row was written.
    const insert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+roi_evidence/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /results-v4/roi-evidence → 201 + org-scoped INSERT when every parent is owned', async () => {
    // Each parent ownership SELECT resolves under the caller's org.
    mockQueryFirst.mockResolvedValue({ id: 'owned' });
    const app = await buildResultsEnterpriseApp();
    const res = await request(app).post('/api/results-v4/roi-evidence').send({
      initiativeId: 'init-owned',
      benefitId: 'benefit-owned',
      financeModelId: 'model-owned',
      value: 1000,
      period: '2026-01',
    });

    expect(res.status).toBe(201);
    const insert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+roi_evidence/i.test(String(c?.[0]))
    );
    expect(insert).toBeTruthy();
    // organization_id is the 2nd column param (id, organization_id, …).
    expect(insert?.[1]?.[1]).toBe(ORG_A);
    // All three parents were ownership-checked (initiatives, benefits, financial_models).
    const tables = mockQueryFirst.mock.calls
      .map((c) => String(c?.[0]).match(/FROM\s+(initiatives|benefits|financial_models)\s/i)?.[1])
      .filter(Boolean);
    expect(tables).toEqual(expect.arrayContaining(['initiatives', 'benefits', 'financial_models']));
  });

  // ── SEC-3: results-v4 wallboard-alert parent-ownership precheck ──

  it('POST /results-v4/wallboards/:id/alerts → 404 for a foreign-org wallboard (no alert INSERT)', async () => {
    // Wallboard ownership lookup returns null → not owned.
    mockQueryFirst.mockResolvedValue(null);
    const app = await buildResultsEnterpriseApp();
    const res = await request(app)
      .post('/api/results-v4/wallboards/wb-from-org-b/alerts')
      .send({ kpiId: 'kpi-x', thresholdValue: 10, currentValue: 5 });

    expect(res.status).toBe(404);
    const ownershipCall = mockQueryFirst.mock.calls.find((c) =>
      /FROM\s+kpi_wallboards\s+WHERE\s+id\s*=\s*\?\s+AND\s+organization_id\s*=\s*\?/i.test(
        String(c?.[0])
      )
    );
    expect(ownershipCall?.[1]).toEqual(['wb-from-org-b', ORG_A]);
    const insert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_wallboard_alerts/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /results-v4/wallboards/:id/alerts → 201 + org-scoped INSERT when the wallboard is owned', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'wb-owned' });
    const app = await buildResultsEnterpriseApp();
    const res = await request(app)
      .post('/api/results-v4/wallboards/wb-owned/alerts')
      .send({ kpiId: 'kpi-x', thresholdValue: 10, currentValue: 5 });

    expect(res.status).toBe(201);
    const insert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_wallboard_alerts/i.test(String(c?.[0]))
    );
    expect(insert).toBeTruthy();
    // organization_id is the 2nd column param (id, organization_id, wallboard_id, …).
    expect(insert?.[1]?.[1]).toBe(ORG_A);
    expect(insert?.[1]?.[2]).toBe('wb-owned');
  });

  // ── HOLE-5: benefits IRIS refresh current_value UPDATE org-scope (static guard) ──

  it('benefits IRIS refresh current_value UPDATE carries an org filter (source guard)', async () => {
    // Static guarantee: the only current_value UPDATE in benefits.routes is org-scoped.
    const fs = await import('node:fs');
    const nodePath = await import('node:path');
    // Resolve from repo root (cwd) — `new URL(..., import.meta.url)` is unreliable under the
    // vitest transform ("not a valid instance of Location") and crashed before this assertion ran.
    const path = nodePath.resolve(process.cwd(), 'server/src/routes/benefits.routes.ts');
    const src = fs.readFileSync(path, 'utf8');
    const updates = src.match(/UPDATE initiative_kpis SET current_value[\s\S]*?WHERE[^\n]*/g) || [];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(/organization_id\s*=\s*\?/.test(u)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-3 (wave 6 follow-up) — v8 results writes referencing a parent id now precheck
// org-ownership (404 before write). p04AssertKpiPermission is a role gate only — these
// service-backed writes (time-series, signals, next-actions, reconciliations) previously
// stored a foreign-org kpiId/signalId under the caller's org.
// ═══════════════════════════════════════════════════════════════════════════

describe('SEC-3 wave 6 follow-up — v8 results parent-ownership prechecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0, lastID: 'x' });
    mockQueryFirst.mockResolvedValue(null);
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0, changes: 0 });
  });

  it('POST /v8/results/kpis/:kpiId/time-series → 404 for a foreign-org KPI (no INSERT)', async () => {
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/kpis/kpi-from-org-b/time-series')
      .send({ value: 5, periodStart: '2026-01-15', source: 'manual' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    const ownershipCall = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+initiative_kpis/i.test(String(c?.[0])) &&
        /COALESCE\(k\.organization_id/i.test(String(c?.[0]))
    );
    expect(ownershipCall?.[1]).toEqual(['kpi-from-org-b', ORG_A]);
    const insert = mockDbRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+kpi_time_series/i.test(String(c?.[0]))
    );
    expect(insert).toBeFalsy();
  });

  it('POST /v8/results/signals → 404 for a foreign-org KPI (no signal write)', async () => {
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/signals')
      .send({ kpiId: 'kpi-from-org-b', signalType: 'deviation', severity: 'high' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    const ownershipCall = mockDbGet.mock.calls.find(
      (c) =>
        /FROM\s+initiative_kpis/i.test(String(c?.[0])) &&
        /COALESCE\(k\.organization_id/i.test(String(c?.[0]))
    );
    expect(ownershipCall?.[1]).toEqual(['kpi-from-org-b', ORG_A]);
  });

  it('POST /v8/results/next-actions → 404 for a foreign-org KPI (no action write)', async () => {
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/next-actions')
      .send({ signalId: 'sig-x', kpiId: 'kpi-from-org-b', actionType: 'investigate' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
  });

  it('POST /v8/results/next-actions → 404 when KPI owned but signalId is foreign-org', async () => {
    // 1st get (KPI) → owned; 2nd get (v8_kpi_signals org-scoped) → null.
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-owned' }).mockResolvedValueOnce(null);
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/next-actions')
      .send({ signalId: 'sig-from-org-b', kpiId: 'kpi-owned', actionType: 'investigate' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_SIGNAL_NOT_FOUND');
  });

  it('POST /v8/results/reconciliations → 404 for a foreign-org KPI (no reconciliation write)', async () => {
    const app = await buildV8App();
    const res = await request(app)
      .post('/api/v8/results/reconciliations')
      .send({ kpiId: 'kpi-from-org-b', financeRef: 'finance:x' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
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
    const { initiativeGovernanceService } =
      await import('../../services/initiativeGovernanceService.js');
    const result = await initiativeGovernanceService.getGoalInitiatives(ORG_A, 'goal-from-org-b');
    expect(result).toEqual([]);
    // Verify org-scoped query was issued
    const scopedCall = mockQueryFirst.mock.calls.find((c) =>
      String(c?.[0]).includes('organization_id')
    );
    expect(scopedCall).toBeTruthy();
  });

  it('linkGoalToInitiative throws 404 when goal belongs to a different org', async () => {
    const { initiativeGovernanceService } =
      await import('../../services/initiativeGovernanceService.js');
    await expect(
      initiativeGovernanceService.linkGoalToInitiative(ORG_A, 'goal-from-org-b', 'init-1')
    ).rejects.toMatchObject({ status: 404 });
  });

  it('getInitiativeDecisions returns [] when initiative belongs to a different org', async () => {
    const { initiativeGovernanceService } =
      await import('../../services/initiativeGovernanceService.js');
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
    const { initiativeGovernanceService } =
      await import('../../services/initiativeGovernanceService.js');
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

// ═══════════════════════════════════════════════════════════════════════════
// M15 mass-assignment — PUT /kpis/:kpiId cannot edit definition/targets on a
// finalized/locked KPI (state-machine bypass). Within the caller's OWN org, a
// kpi_owner could otherwise mass-assign baseline_value/target_value/direction on
// a KPI that has moved into benefits_realization/review/locked, corrupting the
// reconciliation baseline. The guard returns 409 with code RESULTS_KPI_EDIT_LOCKED
// BEFORE any UPDATE runs; an unlocked KPI still updates normally.
// ═══════════════════════════════════════════════════════════════════════════

describe('M15 — PUT /benefits/kpis/:kpiId is blocked on a locked KPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('→ 409 RESULTS_KPI_EDIT_LOCKED when the owned KPI is in benefits_realization; no update runs', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    // Ownership+status SELECT: owned by caller org, but locked.
    mockDbGet.mockResolvedValue({ id: 'kpi-locked', status: 'benefits_realization' });
    const app = await buildBenefitsApp();

    const res = await request(app)
      .put('/api/benefits/kpis/kpi-locked')
      .send({ targetValue: 999, baselineValue: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESULTS_KPI_EDIT_LOCKED');

    // The locked guard must short-circuit before kpiDefinitionService is
    // ever reached (RES-02: the write moved from inline SQL to the
    // canonical service, but the lock-status guard still runs first).
    expect(mockGetCurrentKpiDefinition).not.toHaveBeenCalled();
    expect(mockUpdateKpiDefinition).not.toHaveBeenCalled();
  });

  it('→ 200 and a canonical update runs when the owned KPI is in an unlocked (active) status', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbGet.mockResolvedValue({ id: 'kpi-active', status: 'active' });
    mockGetCurrentKpiDefinition.mockResolvedValue({
      id: 'kpi-active',
      currentDefinitionVersion: 1,
    });
    mockUpdateKpiDefinition.mockResolvedValue({ id: 'kpi-active', currentDefinitionVersion: 2 });
    const app = await buildBenefitsApp();

    const res = await request(app).put('/api/benefits/kpis/kpi-active').send({ targetValue: 999 });

    expect(res.status).toBe(200);
    expect(mockUpdateKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        kpiId: 'kpi-active',
        expectedVersion: 1,
        targetValue: 999,
      })
    );
  });
});

describe('M15 — PUT /v8/results/kpis/:kpiId is blocked on a locked KPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('→ 409 RESULTS_KPI_EDIT_LOCKED when the owned KPI is locked; no canonical update runs', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    // 1st dbGet: PUT ownership lookup (owned). 2nd dbGet: findKpiEditLockViolation
    // status lookup (locked).
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-locked' })
      .mockResolvedValueOnce({ status: 'locked' });
    const app = await buildV8App();

    const res = await request(app)
      .put('/api/v8/results/kpis/kpi-locked')
      .send({ targetValue: 999, baselineValue: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESULTS_KPI_EDIT_LOCKED');

    // The locked guard must short-circuit before kpiDefinitionService is
    // ever reached (RES-02: the write moved from inline SQL to the
    // canonical service, but the lock-status guard still runs first).
    expect(mockGetCurrentKpiDefinition).not.toHaveBeenCalled();
    expect(mockUpdateKpiDefinition).not.toHaveBeenCalled();
  });

  it('→ 200 and a canonical update runs when the owned KPI is unlocked', async () => {
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockDbGet
      .mockResolvedValueOnce({ id: 'kpi-active' })
      .mockResolvedValueOnce({ status: 'active' });
    mockGetCurrentKpiDefinition.mockResolvedValue({
      id: 'kpi-active',
      currentDefinitionVersion: 1,
    });
    mockUpdateKpiDefinition.mockResolvedValue({ id: 'kpi-active', currentDefinitionVersion: 2 });
    const app = await buildV8App();

    const res = await request(app)
      .put('/api/v8/results/kpis/kpi-active')
      .send({ targetValue: 999 });

    expect(res.status).toBe(200);
    expect(mockUpdateKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        kpiId: 'kpi-active',
        expectedVersion: 1,
        targetValue: 999,
      })
    );
  });
});

describe('RES-02 — expectedVersion CAS fails closed on a garbage token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
  });

  it('PUT /benefits/kpis/:kpiId → a valid client expectedVersion is used as-is, not re-derived', async () => {
    mockDbGet.mockResolvedValue({ id: 'kpi-active', status: 'active' });
    // Self-read would report version 9 — the client's own value (5) must win.
    mockGetCurrentKpiDefinition.mockResolvedValue({
      id: 'kpi-active',
      currentDefinitionVersion: 9,
    });
    mockUpdateKpiDefinition.mockResolvedValue({ id: 'kpi-active', currentDefinitionVersion: 6 });
    const app = await buildBenefitsApp();

    const res = await request(app)
      .put('/api/benefits/kpis/kpi-active')
      .send({ targetValue: 999, expectedVersion: 5 });

    expect(res.status).toBe(200);
    expect(mockUpdateKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ kpiId: 'kpi-active', expectedVersion: 5 })
    );
  });

  it.each([['not-a-number'], [0], [-1], [1.5], [null]])(
    'PUT /benefits/kpis/:kpiId → expectedVersion %p is rejected with 400, no writer call',
    async (badValue) => {
      const app = await buildBenefitsApp();

      const res = await request(app)
        .put('/api/benefits/kpis/kpi-active')
        .send({ targetValue: 999, expectedVersion: badValue });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('RESULTS_KPI_INVALID_EXPECTED_VERSION');
      expect(mockGetCurrentKpiDefinition).not.toHaveBeenCalled();
      expect(mockUpdateKpiDefinition).not.toHaveBeenCalled();
      // Validation fails closed before even the ownership lookup runs.
      expect(mockDbGet).not.toHaveBeenCalled();
    }
  );

  it('PUT /v8/results/kpis/:kpiId → a valid client expectedVersion is used as-is, not re-derived', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-active' }).mockResolvedValueOnce({
      status: 'active',
    });
    mockGetCurrentKpiDefinition.mockResolvedValue({
      id: 'kpi-active',
      currentDefinitionVersion: 9,
    });
    mockUpdateKpiDefinition.mockResolvedValue({ id: 'kpi-active', currentDefinitionVersion: 6 });
    const app = await buildV8App();

    const res = await request(app)
      .put('/api/v8/results/kpis/kpi-active')
      .send({ targetValue: 999, expectedVersion: 5 });

    expect(res.status).toBe(200);
    expect(mockUpdateKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ kpiId: 'kpi-active', expectedVersion: 5 })
    );
  });

  it.each([['not-a-number'], [0], [-1], [1.5], [null]])(
    'PUT /v8/results/kpis/:kpiId → expectedVersion %p is rejected with 400, no writer call',
    async (badValue) => {
      const app = await buildV8App();

      const res = await request(app)
        .put('/api/v8/results/kpis/kpi-active')
        .send({ targetValue: 999, expectedVersion: badValue });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('RESULTS_KPI_INVALID_EXPECTED_VERSION');
      expect(mockGetCurrentKpiDefinition).not.toHaveBeenCalled();
      expect(mockUpdateKpiDefinition).not.toHaveBeenCalled();
      // Validation fails closed before even the ownership lookup runs.
      expect(mockDbGet).not.toHaveBeenCalled();
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// RES-003A — legacy /api/benefits router: real assertKpiPermission checks.
//
// Every SEC-3/L-04 test above proves cross-org isolation on /api/benefits, but
// none of them ever set mockUser.role to anything other than 'admin' — so the
// 21 mutating routes on this router had NO role gate at all until the
// assertKpiPermission(req, res, action) calls were added (see
// server/src/routes/benefits.routes.ts + server/src/services/results/
// kpiPermissions.ts). This block is the fail-closed proof: a 'viewer' (JWT
// role 'user') and, on kpi_owner-only actions, a 'finance_owner' (JWT role
// 'manager') must be rejected with 403/P04_PERMISSION_DENIED BEFORE any
// dbGet/dbAll/dbRun call happens — the gate is deliberately the first line of
// every handler, so a denial must leave the DB mocks completely untouched.
// A closing regression-shield section proves the same gate does NOT block an
// 'admin' (kpi_owner) on the 9 of those 21 routes that had no prior test
// coverage at all (deviation-case actions, IRIS refresh/search, time-series
// delete) — the risk this whole plan hinges on (RES-003A brief): kpi_owner
// must keep working everywhere on this router.
// ═══════════════════════════════════════════════════════════════════════════

type BenefitsHttpMethod = 'get' | 'post' | 'put' | 'delete';

interface BenefitsPermissionRoute {
  method: BenefitsHttpMethod;
  path: string;
  body: Record<string, unknown>;
  action: string;
  /** true when KPI_PERMISSION_MATRIX[action] === ['kpi_owner'] only (no finance_owner). */
  kpiOwnerOnly: boolean;
}

// The 21 mutating /api/benefits routes gated in benefits.routes.ts (RES-003A),
// with the exact action passed to assertKpiPermission and whether the action
// excludes 'finance_owner' in KPI_PERMISSION_MATRIX (kpiWorkflowCanon.ts).
const RES003A_BENEFITS_ROUTES: BenefitsPermissionRoute[] = [
  {
    method: 'post',
    path: '/kpis',
    body: {
      name: 'RES-003A perm test KPI',
      targetValue: 100,
      measurementFrequency: 'MONTHLY',
      direction: 'HIGHER_IS_BETTER',
    },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'put',
    path: '/kpis/kpi-x',
    body: { targetValue: 999 },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  { method: 'delete', path: '/kpis/kpi-x', body: {}, action: 'delete_kpi', kpiOwnerOnly: true },
  {
    method: 'post',
    path: '/kpis/kpi-x/time-series',
    body: { value: 1, periodStart: '2026-01-01' },
    action: 'record_measurement',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/deviation-cases/case-x/acknowledge',
    body: {},
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'put',
    path: '/deviation-cases/case-x/rca',
    body: { rcaText: 'root cause' },
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/deviation-cases/case-x/actions',
    body: { title: 'Fix it' },
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'put',
    path: '/deviation-cases/case-x/actions/action-x',
    body: { status: 'DONE' },
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/deviation-cases/case-x/resolve',
    body: {},
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/deviation-cases/case-x/close',
    body: { evidenceText: 'proof' },
    action: 'manage_deviation',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/kpis/kpi-x/refresh/iris',
    body: {},
    action: 'record_measurement',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/iris/assets/search',
    body: { q: 'engine' },
    action: 'record_measurement',
    kpiOwnerOnly: false,
  },
  {
    method: 'delete',
    path: '/kpis/kpi-x/time-series/ts-x',
    body: {},
    action: 'delete_kpi',
    kpiOwnerOnly: true,
  },
  {
    method: 'post',
    path: '/kpi-mappings',
    body: { initiativeId: 'init-x', kpiId: 'kpi-x' },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'delete',
    path: '/kpi-mappings/mapping-x',
    body: {},
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'put',
    path: '/roi/init-x/assumptions',
    body: { capex: 1000 },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'post',
    path: '/roi/init-x/realized',
    body: { periodMonth: '2026-01' },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'post',
    path: '/attribution/kpi-x/snapshot',
    body: { periodStart: '2026-01-01', periodEnd: '2026-03-31' },
    action: 'create_report',
    kpiOwnerOnly: false,
  },
  {
    method: 'post',
    path: '/financial/statement-lines',
    body: { statementType: 'PL', lineCode: 'REV', lineName: 'Revenue' },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'post',
    path: '/financial/kpi-mappings',
    body: { kpiId: 'kpi-x', statementLineId: 'line-x', direction: 'positive' },
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
  {
    method: 'delete',
    path: '/financial/kpi-mappings/mapping-x',
    body: {},
    action: 'edit_definition',
    kpiOwnerOnly: true,
  },
];

function sendBenefitsRequest(
  app: Express,
  route: Pick<BenefitsPermissionRoute, 'method' | 'path' | 'body'>
) {
  const agent = request(app) as unknown as Record<
    BenefitsHttpMethod,
    (url: string) => ReturnType<typeof request>
  >;
  return agent[route.method](`/api/benefits${route.path}`).send(route.body);
}

describe('RES-003A — /api/benefits real permission checks (fail-closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 0, lastID: 'x' });
  });

  // ── Flagged W3-analog: legacy router also ignores x-kpi-role self-escalation ──

  it('legacy /api/benefits ignores x-kpi-role header self-escalation (viewer stays denied)', async () => {
    mockUser = { id: USER_A, role: 'user', organizationId: ORG_A, isSuperAdmin: false };
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/kpis')
      .set('x-kpi-role', 'kpi_owner') // must be ignored — role is derived from the JWT only
      .send({
        name: 'Escalation attempt',
        targetValue: 100,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    // RES-02: the write moved from inline SQL to kpiDefinitionService — the
    // permission gate must still block BEFORE the canonical service is ever
    // reached.
    expect(mockCreateKpiDefinition).not.toHaveBeenCalled();
  });

  // ── 401: no authenticated user on a representative route ──

  it('POST /benefits/kpis → 401 when no user is authenticated', async () => {
    mockUser = null;
    const app = await buildBenefitsApp();
    const res = await request(app)
      .post('/api/benefits/kpis')
      .send({ name: 'Unauthed attempt', targetValue: 1, direction: 'HIGHER_IS_BETTER' });

    expect(res.status).toBe(401);
  });

  // ── 403 for viewer (JWT role 'user') on every one of the 21 gated routes ──

  describe.each(RES003A_BENEFITS_ROUTES)(
    '$method /benefits$path (action=$action)',
    (route) => {
      it('→ 403 for viewer role; no dbGet/dbAll/dbRun call happens (gate is the first line)', async () => {
        mockUser = { id: USER_A, role: 'user', organizationId: ORG_A, isSuperAdmin: false };
        const app = await buildBenefitsApp();
        const res = await sendBenefitsRequest(app, route);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('P04_PERMISSION_DENIED');
        expect(mockDbGet).not.toHaveBeenCalled();
        expect(mockDbAll).not.toHaveBeenCalled();
        expect(mockDbRun).not.toHaveBeenCalled();
      });

      if (route.kpiOwnerOnly) {
        it('→ 403 for finance_owner (JWT role "manager"); action is kpi_owner-only', async () => {
          mockUser = { id: USER_A, role: 'manager', organizationId: ORG_A, isSuperAdmin: false };
          const app = await buildBenefitsApp();
          const res = await sendBenefitsRequest(app, route);

          expect(res.status).toBe(403);
          expect(res.body.code).toBe('P04_PERMISSION_DENIED');
          expect(mockDbGet).not.toHaveBeenCalled();
          expect(mockDbAll).not.toHaveBeenCalled();
          expect(mockDbRun).not.toHaveBeenCalled();
        });
      }
    }
  );

  // ── Regression shield: admin (kpi_owner) is NOT blocked by the new gate on ──
  // ── the 9 of the 21 routes that had zero prior test coverage. ──

  describe('regression shield — admin (kpi_owner) passes the new gate on previously-untested routes', () => {
    beforeEach(() => {
      mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    });

    it('POST /benefits/deviation-cases/:caseId/acknowledge → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app).post('/api/benefits/deviation-cases/case-x/acknowledge').send({});

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });

    it('PUT /benefits/deviation-cases/:caseId/rca → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app)
        .put('/api/benefits/deviation-cases/case-x/rca')
        .send({ rcaText: 'root cause' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });

    it('POST /benefits/deviation-cases/:caseId/actions → not 403 (404, case not found — existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app)
        .post('/api/benefits/deviation-cases/case-x/actions')
        .send({ title: 'Fix it' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });

    it('PUT /benefits/deviation-cases/:caseId/actions/:actionId → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app)
        .put('/api/benefits/deviation-cases/case-x/actions/action-x')
        .send({ status: 'DONE' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });

    it('POST /benefits/deviation-cases/:caseId/resolve → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app).post('/api/benefits/deviation-cases/case-x/resolve').send({});

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });

    it('POST /benefits/deviation-cases/:caseId/close → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app)
        .post('/api/benefits/deviation-cases/case-x/close')
        .send({ evidenceText: 'proof' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });

    it('POST /benefits/kpis/:kpiId/refresh/iris → not 403 (404, provider not configured — existing logic runs)', async () => {
      // PRAGMA table_info(mcp_providers) → non-empty, so the route proceeds past the
      // 503 "not_configured" short-circuit and reaches the provider lookup, which
      // 404s (no IRIS provider mocked) instead of being blocked by the gate.
      mockDbAll.mockResolvedValueOnce([{ name: 'id' }]);
      const app = await buildBenefitsApp();
      const res = await request(app).post('/api/benefits/kpis/kpi-x/refresh/iris').send({});

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });

    it('POST /benefits/iris/assets/search → not 403 (404, provider not configured — existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app)
        .post('/api/benefits/iris/assets/search')
        .send({ q: 'engine' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });

    it('DELETE /benefits/kpis/:kpiId/time-series/:tsId → not 403 (200, existing logic runs)', async () => {
      const app = await buildBenefitsApp();
      const res = await request(app).delete('/api/benefits/kpis/kpi-x/time-series/ts-x');

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });
  });
});
