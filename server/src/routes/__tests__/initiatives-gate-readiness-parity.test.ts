/**
 * INI-04 — route/service parity.
 *
 * The `capabilities` block is served by TWO independent call sites the UI
 * actually uses:
 *   - ROUTE:   GET /api/initiatives/:id/gate-readiness-check
 *              (mounted express router → InitiativeController.getGateReadinessCheck,
 *               the pmo fallback endpoint `initiativeWriteTruth.ts` reads when the
 *               v8 endpoint is unavailable)
 *   - SERVICE: planningPortfolioReadService.getInitiativeGateReadinessRead
 *              (what GET /api/v8/planning/initiatives/:id/gate-readiness-check
 *               calls — the endpoint the UI prefers)
 *
 * Before INI-04 each hand-rolled its own topBar/cards/ai/ctaBar rules. This
 * test drives BOTH with the exact same mocked DB state (same initiative row,
 * same role resolution, same RACI/gate-role assignments) and asserts they
 * return a byte-identical `capabilities` contract — proving the shared matrix
 * is actually wired into both, not just available for either to opt into.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockGetInitiativeDetailRead = vi.fn();
const mockGetBlockingReadinessItems = vi.fn();

const ORG = 'org-parity-1';
const UID = 'user-parity-1';
const INITIATIVE_ID = 'init-parity-1';

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
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
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

// PARTIAL mock: `pmo/initiatives.routes.js` only needs a couple of these read
// helpers stubbed to load, but `getInitiativeGateReadinessRead` itself must
// stay REAL — it is the SERVICE side of the parity assertion below.
vi.mock('../../services/v8/planningPortfolioReadService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/v8/planningPortfolioReadService.js')>();
  return {
    ...actual,
    getInitiativeDetailRead: (...a: unknown[]) => mockGetInitiativeDetailRead(...a),
    getPortfolioData: vi.fn().mockResolvedValue(null),
    getPortfolioRead: vi.fn().mockResolvedValue(null),
    getPortfolioRollups: vi.fn().mockResolvedValue([]),
    getPortfolioDependencies: vi.fn().mockResolvedValue([]),
    getInitiativeTaskDependenciesRead: vi.fn().mockResolvedValue([]),
  };
});

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
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

// INI-04: role RESOLUTION stays real (initiativeAccessResolver.js is NOT
// mocked) — only its DB reads are, via queryHelpers above. This is the point
// of the test: both call sites must resolve roles and capabilities through
// the same live code, not through two independently-stubbed shortcuts.
vi.mock('../../services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: (...a: unknown[]) => mockGetBlockingReadinessItems(...a),
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

// ── Shared fixture: ONE initiative + ONE RACI-Accountable stakeholder, no
// owner/sponsor/project — so the only source of capability is the RACI row,
// exercising the exact input BOTH read paths must now honor identically.
const INITIATIVE_ROW = {
  id: INITIATIVE_ID,
  organization_id: ORG,
  project_id: null,
  status: 'DRAFT',
  name: 'Parity fixture initiative',
  title: 'Parity fixture initiative',
  owner_business_id: null,
  owner_execution_id: null,
  sponsor_id: null,
  planned_start_date: null,
  planned_end_date: null,
  scope: null,
  objectives: null,
  summary: null,
  problem_statement: null,
  baseline_version: 0,
  progress: 0,
};

function installSharedFixture() {
  mockQueryFirst.mockReset();
  mockQueryAll.mockReset();
  mockGetBlockingReadinessItems.mockReset();
  mockGetBlockingReadinessItems.mockResolvedValue([]);

  mockQueryFirst.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT * FROM initiatives WHERE id = ? AND organization_id = ?')) {
      return params[0] === INITIATIVE_ID && params[1] === ORG ? INITIATIVE_ROW : null;
    }
    if (sql.includes('SELECT id, project_id as "projectId"') && sql.includes('FROM initiatives')) {
      return params[0] === INITIATIVE_ID ? { id: INITIATIVE_ID, projectId: null } : null;
    }
    if (sql.includes('SELECT role FROM users WHERE id = ?')) {
      return { role: 'TEAM_MEMBER' };
    }
    if (sql.includes('SELECT owner_business_id, owner_execution_id, sponsor_id')) {
      return { owner_business_id: null, owner_execution_id: null, sponsor_id: null };
    }
    return null;
  });

  mockQueryAll.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM initiative_gate_roles WHERE initiative_id = ?')) {
      return [];
    }
    if (sql.includes('FROM initiative_stakeholders s') && sql.includes('raci_type')) {
      // The RACI row: this user is Accountable on this initiative.
      return params[0] === INITIATIVE_ID && params[1] === UID ? [{ raciType: 'A' }] : [];
    }
    return [];
  });
}

// Real service — this IS the function the v8 route delegates to. Imported
// directly rather than through the v8 router to avoid mounting its unrelated
// planningContinuityService dependency tree.
import { getInitiativeGateReadinessRead } from '../../services/v8/planningPortfolioReadService.js';
import initiativesRoutes from '../pmo/initiatives.routes.js';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG, role: 'user' };
    next();
  });
  app.use('/api/initiatives', initiativesRoutes);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('INI-04 route/service parity — gate-readiness-check', () => {
  it('pmo ROUTE and v8 SERVICE agree on capabilities for a RACI-Accountable, ownerless initiative', async () => {
    installSharedFixture();

    const routeRes = await request(app).get(
      `/api/initiatives/${INITIATIVE_ID}/gate-readiness-check`
    );
    expect(routeRes.status).toBe(200);

    installSharedFixture();
    const serviceResult = await getInitiativeGateReadinessRead(INITIATIVE_ID, ORG, UID, 'user');

    expect(serviceResult).not.toBeNull();
    expect(routeRes.body.capabilities).toEqual((serviceResult as any).capabilities);

    // Pin the actual outcome, not just "they agree with each other" — RACI
    // Accountable must be a real EDIT grant on both sides.
    expect(routeRes.body.capabilities.topBar.canEditOwner).toBe(true);
    expect((serviceResult as any).capabilities.topBar.canEditOwner).toBe(true);
  });

  it('pmo ROUTE and v8 SERVICE agree when the role profile grants NOTHING (fail-closed parity)', async () => {
    mockQueryFirst.mockReset();
    mockQueryAll.mockReset();
    mockGetBlockingReadinessItems.mockReset();
    mockGetBlockingReadinessItems.mockResolvedValue([]);
    mockQueryFirst.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT * FROM initiatives WHERE id = ? AND organization_id = ?')) {
        return params[0] === INITIATIVE_ID && params[1] === ORG ? INITIATIVE_ROW : null;
      }
      if (
        sql.includes('SELECT id, project_id as "projectId"') &&
        sql.includes('FROM initiatives')
      ) {
        return { id: INITIATIVE_ID, projectId: null };
      }
      if (sql.includes('SELECT role FROM users WHERE id = ?')) return { role: 'TEAM_MEMBER' };
      if (sql.includes('SELECT owner_business_id, owner_execution_id, sponsor_id')) {
        return { owner_business_id: null, owner_execution_id: null, sponsor_id: null };
      }
      return null;
    });
    mockQueryAll.mockResolvedValue([]); // no gate roles, no RACI — nobody granted anything

    const routeRes = await request(app).get(
      `/api/initiatives/${INITIATIVE_ID}/gate-readiness-check`
    );
    const serviceResult = await getInitiativeGateReadinessRead(INITIATIVE_ID, ORG, UID, 'user');

    expect(routeRes.body.capabilities).toEqual((serviceResult as any).capabilities);
    expect(routeRes.body.capabilities.topBar).toEqual({
      canEditPriority: false,
      canEditOwner: false,
      canEditTargetDate: false,
    });
    expect(routeRes.body.capabilities.cards.canEditCards).toBe(false);
  });
});
