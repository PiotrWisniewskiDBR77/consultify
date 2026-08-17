/**
 * M13 (Inicjatywy) — MASS-ASSIGNMENT / PROTECTED-FIELD regression suite.
 *
 * Different axis from the cross-org IDOR suites (org-scope is already hardened).
 * Here we assert that — WITHIN the caller's own org — create/update handlers
 * cannot write fields the client must not control:
 *
 *   V-1  PUT /:id (generic update) must NOT write `status` directly. Status is
 *        gated by the central state machine (updateInitiativeStatus). A status
 *        CHANGE through the generic path must 400 (no DRAFT→APPROVED jump) and
 *        the stored row must keep its server-derived status. A same-value echo
 *        is tolerated (and never emits `status = ?`).
 *
 *   V-2  PUT /:id/kpis/:kpiId must pin organizationId/initiativeId/kpiId/userId
 *        from the route params + token, NOT from req.body. A body that tries to
 *        override `organizationId` (or the ids) must be ignored — the service
 *        receives the server-derived values.
 *
 * Uses the queryHelpers mock pattern (no in-process DB); same harness as
 * initiatives-crud.test.ts / cross-org-idor.test.ts.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns ────────────────────────────────────────────────────────

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockUpdateKpiAssignment = vi.fn();

const ORG = 'org-ma-1';
const VICTIM_ORG = 'org-ma-victim';
const UID = 'user-ma-1';
const INITIATIVE_ID = 'init-ma-123';
const KPI_ID = 'kpi-ma-1';

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
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/effectiveCapability.middleware.js', () => ({
  requireInitiativeCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/initiative/initiativeTransitionService.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../services/initiative/initiativeTransitionService.js')
    >();
  return {
    ...actual,
    executeInitiativeTransition: vi.fn(async () => ({
      ok: false,
      statusCode: 400,
      body: { code: 'INITIATIVE_STATUS_TRANSITION_INVALID' },
    })),
  };
});

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  // Pass-through validation so we exercise the controller-level guards directly.
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
  getInitiativeDetailRead: vi.fn().mockResolvedValue(null),
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
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: vi.fn().mockResolvedValue({ effectiveRoles: ['ADMIN'] }),
}));

vi.mock('../../services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
  listInitiativeKpiAssignments: vi.fn().mockResolvedValue([]),
  updateInitiativeKpiAssignment: (...a: unknown[]) => mockUpdateKpiAssignment(...a),
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

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG, role: 'admin' };
    next();
  });
  app.use('/api/initiatives', initiativesRoutes);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── V-1: status state-machine bypass via generic update ───────────────────────

describe('M13 mass-assignment — V-1: generic update cannot jump status', () => {
  const existingDraft = {
    id: INITIATIVE_ID,
    status: 'DRAFT',
    title: 'Reduce cycle time',
    organization_id: ORG,
  };

  it('PUT /:id with {status: APPROVED} is rejected 400 (no gate bypass)', async () => {
    mockQueryFirst.mockResolvedValue(existingDraft);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app)
      .put(`/api/initiatives/${INITIATIVE_ID}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(400);
    expect(res.body.field).toBe('status');
    expect(res.body.rule).toBe('STATUS_TRANSITION_REQUIRES_GATE');

    // The protected column must never have been written via the generic path.
    const wroteStatus = mockQueryRun.mock.calls.some(
      (call) =>
        typeof call[0] === 'string' &&
        /UPDATE initiatives SET/i.test(call[0]) &&
        /\bstatus\s*=/i.test(call[0])
    );
    expect(wroteStatus).toBe(false);
  });

  it('PATCH /:id with {status: APPROVED} routes to the gated status handler', async () => {
    // The PATCH alias delegates status payloads to updateInitiativeStatus, whose
    // transition matrix rejects DRAFT→APPROVED. Either way it must NOT 200.
    mockQueryFirst.mockResolvedValue(existingDraft);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app)
      .patch(`/api/initiatives/${INITIATIVE_ID}`)
      .send({ status: 'APPROVED' });

    expect(res.status).not.toBe(200);
    expect([400, 403]).toContain(res.status);
  });

  it('PUT /:id with a same-value status echo is tolerated and never emits status = ?', async () => {
    mockQueryFirst.mockResolvedValue(existingDraft);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app)
      .put(`/api/initiatives/${INITIATIVE_ID}`)
      .send({ status: 'DRAFT', summary: 'Refined summary' });

    expect(res.status).toBe(200);

    const updateCall = mockQueryRun.mock.calls.find(
      (call) => typeof call[0] === 'string' && /UPDATE initiatives SET/i.test(call[0])
    );
    expect(updateCall).toBeTruthy();
    // Status echo must be ignored — only the legitimate field is written.
    expect(/\bstatus\s*=/i.test(String(updateCall?.[0]))).toBe(false);
    expect(/\bsummary\s*=/i.test(String(updateCall?.[0]))).toBe(true);
  });

  it('PUT /:id with a non-status field still updates normally (200)', async () => {
    mockQueryFirst.mockResolvedValue(existingDraft);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(app)
      .put(`/api/initiatives/${INITIATIVE_ID}`)
      .send({ summary: 'New executive summary' });

    expect(res.status).toBe(200);
  });
});

// ── V-2: KPI update cannot be re-pointed via body mass-assignment ─────────────

describe('M13 mass-assignment — V-2: KPI update pins tenant/identity from server', () => {
  it('PUT /:id/kpis/:kpiId ignores body organizationId/ids (uses token + params)', async () => {
    mockUpdateKpiAssignment.mockResolvedValue({ id: KPI_ID, name: 'On-time %' });

    const res = await request(app).put(`/api/initiatives/${INITIATIVE_ID}/kpis/${KPI_ID}`).send({
      // Attacker-controlled protected fields:
      organizationId: VICTIM_ORG,
      initiativeId: 'init-someone-else',
      kpiId: 'kpi-someone-else',
      userId: 'impersonated-user',
      // Legitimate editable field:
      targetValue: 95,
    });

    expect(res.status).toBe(200);
    expect(mockUpdateKpiAssignment).toHaveBeenCalledTimes(1);

    const arg = mockUpdateKpiAssignment.mock.calls[0][0] as Record<string, unknown>;
    // Server-derived identity/tenant fields win — body values are discarded.
    expect(arg.organizationId).toBe(ORG);
    expect(arg.initiativeId).toBe(INITIATIVE_ID);
    expect(arg.kpiId).toBe(KPI_ID);
    expect(arg.userId).toBe(UID);
    // The legitimate editable field still passes through.
    expect(arg.targetValue).toBe(95);
  });
});
