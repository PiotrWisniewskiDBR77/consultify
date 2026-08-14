/**
 * M13 (Inicjatywy) — Initiative CRUD route smoke tests.
 *
 * Uses the queryHelpers mock pattern (no in-process DB); same approach as
 * cross-org-idor.test.ts. Covers create → read → list → update → 404-for-unknown.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ────────────────────

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockGetInitiativeDetailRead = vi.fn();

const ORG = 'org-crud-1';
const UID = 'user-crud-1';
const INITIATIVE_ID = 'init-test-123';

// ── Module mocks ──────────────────────────────────────────────────────────────

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
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/requestOrganization.js', () => ({
  requireRequestOrganizationId: (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return orgId;
  },
  resolveRequestOrganizationId: (req: any) => req.user?.organizationId ?? null,
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../../services/v8/planningPortfolioReadService.js', () => ({
  getInitiativeDetailRead: (...a: unknown[]) => mockGetInitiativeDetailRead(...a),
  getPortfolioData: vi.fn().mockResolvedValue(null),
  getPortfolioRead: vi.fn().mockResolvedValue(null),
  getPortfolioRollups: vi.fn().mockResolvedValue([]),
  getPortfolioDependencies: vi.fn().mockResolvedValue([]),
  getInitiativeTaskDependenciesRead: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/ActivityService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/notificationService.js', () => ({
  default: {
    notifyOwnerAssigned: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: vi.fn().mockResolvedValue({ effectiveRoles: ['user'] }),
}));

vi.mock('../../services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
  listInitiativeKpiAssignments: vi.fn().mockResolvedValue([]),
  updateInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
  deleteInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/initiative/initiativeWizardService.js', () => ({
  createWizardSession: vi.fn().mockResolvedValue({ id: 'wizard-1' }),
  evaluateShortlistGateForSession: vi.fn().mockResolvedValue(null),
  generateCandidates: vi.fn().mockResolvedValue([]),
  getWizardSession: vi.fn().mockResolvedValue(null),
  listCandidates: vi.fn().mockResolvedValue([]),
  listWizardAuditEvents: vi.fn().mockResolvedValue([]),
  recordShortlistDraftsCreated: vi.fn().mockResolvedValue(undefined),
  recordShortlistGateBlocked: vi.fn().mockResolvedValue(undefined),
  triageCandidate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/initiativeGenerationService.js', () => ({
  default: { generate: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/initiativeSectionTypeService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/initiativeSimilarityService.js', () => ({
  checkSimilarInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/initiativeTemplateService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../services/workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn().mockResolvedValue([]),
  getInitiativeCapacity: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/blueprintService.js', () => ({
  default: { apply: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../services/raidScoringService.js', () => ({
  calculateRiskScore: vi.fn().mockReturnValue(0),
  categorizeScore: vi.fn().mockReturnValue('LOW'),
  DEFAULT_THRESHOLDS: { low: 30, medium: 60, high: 80 },
}));

vi.mock('../../services/staffingPlanService.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  },
  syncInitiativeCapacity: vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

import initiativesRoutes from '../pmo/initiatives.routes.js';

let app: Express;
// Initiative creation requires a non-pilot role (ADMIN/OWNER). The USER/GUEST
// band is the pilot tier, blocked from create server-side to match the FE
// (isPilotParticipantRole). Default the CRUD persistence tests to an authorized
// creator; the pilot-block is asserted explicitly in its own test below.
let currentRole = 'admin';

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG, role: currentRole };
    next();
  });
  app.use('/api/initiatives', initiativesRoutes);
});

afterEach(() => {
  vi.clearAllMocks();
  currentRole = 'admin';
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('initiatives CRUD routes', () => {
  it('POST / creates an initiative (200)', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1, lastID: 1 });

    const res = await request(app)
      .post('/api/initiatives')
      .send({
        projectId: 'project-crud-1',
        title: 'Reduce cycle time',
        description: 'Lean kaizen',
        priority: 'HIGH',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
  });

  it('POST / is blocked (403) for the pilot USER/GUEST band', async () => {
    currentRole = 'user';
    mockQueryRun.mockResolvedValue({ changes: 1, lastID: 1 });

    const res = await request(app)
      .post('/api/initiatives')
      .send({ title: 'Pilot tries to create', priority: 'HIGH' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INITIATIVE_PILOT_WRITE_FORBIDDEN');
  });

  it('POST / is ALLOWED for delivery/staff roles (PROJECT_MANAGER) — not a pilot respondent', async () => {
    currentRole = 'project_manager';
    mockQueryRun.mockResolvedValue({ changes: 1, lastID: 1 });

    const res = await request(app)
      .post('/api/initiatives')
      .send({
        projectId: 'project-crud-1',
        title: 'PM creates an initiative',
        priority: 'HIGH',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
  });

  it('GET /:id returns 200 when initiative exists', async () => {
    const fixture = {
      id: INITIATIVE_ID,
      title: 'Reduce cycle time',
      organization_id: ORG,
      status: 'DRAFT',
    };
    mockGetInitiativeDetailRead.mockResolvedValue(fixture);

    const res = await request(app).get(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(INITIATIVE_ID);
  });

  it('GET / lists initiatives for the org (200)', async () => {
    mockGetTableColumns.mockResolvedValue([]);
    mockQueryAll.mockResolvedValue([
      { id: INITIATIVE_ID, title: 'Reduce cycle time', organization_id: ORG },
    ]);

    const res = await request(app).get('/api/initiatives');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /:id updates initiative fields (200)', async () => {
    const existing = {
      id: INITIATIVE_ID,
      status: 'DRAFT',
      title: 'Reduce cycle time',
      organization_id: ORG,
    };
    mockQueryFirst.mockResolvedValue(existing);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    // Non-status field update through the generic PUT path. (Status changes are
    // gated and rejected here — covered in the mass-assignment regression suite.)
    const res = await request(app)
      .put(`/api/initiatives/${INITIATIVE_ID}`)
      .send({ summary: 'Updated executive summary' });

    expect(res.status).toBe(200);
  });

  it('GET /:id returns 404 for unknown ID', async () => {
    mockGetInitiativeDetailRead.mockResolvedValue(null);

    const res = await request(app).get('/api/initiatives/non-existent-id-xyz');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/initiatives/:id — hard delete (owner/org-scope)', () => {
  const OTHER_USER = 'user-someone-else';

  it('owner (non-admin) can delete their initiative (200) + runs the final DELETE', async () => {
    currentRole = 'project_manager'; // passes write-guard, NOT an admin
    // Org-scoped queryOne resolves an initiative owned by the caller.
    mockQueryFirst.mockResolvedValue({
      id: INITIATIVE_ID,
      owner_business_id: UID,
      owner_execution_id: UID,
      sponsor_id: UID,
      created_by: UID,
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).delete(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.initiativeId).toBe(INITIATIVE_ID);
    // The hard DELETE FROM initiatives ran with the org guard in the WHERE clause.
    const ranInitiativeDelete = mockQueryRun.mock.calls.some(
      ([sql, params]) =>
        /DELETE FROM initiatives/i.test(String(sql)) &&
        Array.isArray(params) &&
        params.includes(INITIATIVE_ID) &&
        params.includes(ORG)
    );
    expect(ranInitiativeDelete).toBe(true);
  });

  it('returns 404 for an initiative in another org (no existence leak)', async () => {
    // Org-scoped read misses → handler cannot distinguish "missing" from "foreign org".
    mockQueryFirst.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 0 });

    const res = await request(app).delete(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(404);
    // Crucially: no DELETE was attempted against the row.
    const attemptedDelete = mockQueryRun.mock.calls.some(([sql]) =>
      /DELETE FROM initiatives/i.test(String(sql))
    );
    expect(attemptedDelete).toBe(false);
  });

  it('returns 403 for a non-owner, non-admin caller (object-level authz)', async () => {
    currentRole = 'project_manager';
    mockQueryFirst.mockResolvedValue({
      id: INITIATIVE_ID,
      owner_business_id: OTHER_USER,
      owner_execution_id: OTHER_USER,
      sponsor_id: OTHER_USER,
      created_by: OTHER_USER,
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).delete(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INITIATIVE_DELETE_FORBIDDEN');
    const attemptedDelete = mockQueryRun.mock.calls.some(([sql]) =>
      /DELETE FROM initiatives/i.test(String(sql))
    );
    expect(attemptedDelete).toBe(false);
  });

  it('an org admin can delete an initiative they do not own (200)', async () => {
    currentRole = 'admin';
    mockQueryFirst.mockResolvedValue({
      id: INITIATIVE_ID,
      owner_business_id: OTHER_USER,
      owner_execution_id: OTHER_USER,
      sponsor_id: OTHER_USER,
      created_by: OTHER_USER,
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).delete(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('the org OWNER can delete an initiative they do not own (200) — R3 golden-path fix', async () => {
    // Regression: OWNER outranks ADMIN but does not contain the substring
    // 'ADMIN', so the old `.includes('ADMIN')` check 403'd org owners.
    currentRole = 'OWNER';
    mockQueryFirst.mockResolvedValue({
      id: INITIATIVE_ID,
      owner_business_id: OTHER_USER,
      owner_execution_id: OTHER_USER,
      sponsor_id: OTHER_USER,
      created_by: OTHER_USER,
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app).delete(`/api/initiatives/${INITIATIVE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
