/**
 * INI-MVP-GATE-001 — route-level coverage for
 * `POST /:id/lifecycle-gate-decisions` (`server/src/routes/pmo/initiatives.routes.ts`).
 *
 * The pg test (`server/src/services/initiative/__tests__/ini-mvp-gate-001-
 * lifecycle-gate-writer.pg.test.ts`) proves the SERVICE layer
 * (`recordInitiativeLifecycleGateDecision`, `hasApprovedGateDecision`)
 * against a real Postgres. It never constructs the Express app or issues an
 * HTTP request, so it proves nothing about the 148 lines of NEW route code:
 * whether the route is actually reachable, the Zod/`validateBody` contract,
 * that `organizationId`/`humanActorUserId` truly come from the authenticated
 * session and not the body, the fail-closed capability mapping (including
 * that an unresolvable access context or an unexpected throw becomes 403,
 * never 500), and the mapping from the service's typed error to an HTTP
 * status. This file closes exactly that gap.
 *
 * Follows the established route-test idiom used elsewhere in this repo
 * (`server/src/routes/__tests__/initiatives-crud.test.ts`) — mounted here
 * under `services/initiative/__tests__/`, alongside the pg test above,
 * because that is lane B's leased new-file root; nothing about the idiom
 * itself changes. Mount the REAL router on a minimal Express
 * app, stub `req.user`, mock out DB/service dependencies, drive it with
 * supertest. Two deliberate departures from that idiom, both load-bearing
 * for what this file needs to prove:
 *
 * 1. `middleware/validation.middleware.js` is left UNMOCKED — the real
 *    `validateBody` + the route's real Zod schema must run, because the
 *    "malformed payload rejected" and "body-injected organizationId ignored"
 *    claims are properties of that real middleware (it replaces `req.body`
 *    with `result.data`, so unknown keys never survive to reach the
 *    handler), not something a stub could demonstrate.
 * 2. `services/initiative/initiativeGovernanceGuard.js` and
 *    `services/initiative/initiativeLifecycleGateDecisionService.js` are
 *    PARTIAL mocks (`importOriginal` + override), not full replacements —
 *    `evaluateInitiativeGateAccess` defaults to the REAL implementation
 *    (only `resolveInitiativeAccessContext`, its own DB dependency, is
 *    mocked) so the real fail-closed role-allowlist logic is exercised, and
 *    `InitiativeLifecycleGateDecisionError`/`INITIATIVE_LIFECYCLE_GATE_
 *    DOMAINS` stay real so `instanceof` checks and the Zod enum are genuine.
 *
 * This is a bounded handler-contract test. The production router now places
 * the legacy surface behind `requireCanonicalInitiativeExecutionWriter`, so
 * mounted writes correctly return `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`.
 * That cutover is proved by the middleware's own regression suite; here the
 * middleware is bypassed deliberately so the retained compatibility handler's
 * validation, auth derivation and error mapping stay testable without making
 * a false mounted-reachability claim.
 *
 * Router double-mount: `server/src/Gateway.ts` mounts the SAME
 * `initiativesRoutes` router at both `/api/initiatives` (line 657) and
 * `/api/pmo/initiatives` (line 1106). This suite replicates both mounts on
 * one app and exercises the route through each prefix at least once.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories; vitest hoists
//    vi.mock calls, but factories only RUN lazily on first import, by which
//    point these `const` bindings already exist — same pattern already
//    proven in initiatives-crud.test.ts) ─────────────────────────────────

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockGetInitiativeDetailRead = vi.fn();
const mockResolveAccessContext = vi.fn();
const mockRecordDecision = vi.fn();
const mockEvaluateGateAccess = vi.fn();
const mockProposeEarly = vi.fn();
const mockExecuteEarly = vi.fn();

const ORG = 'org-gate-route-1';
const OTHER_ORG_BODY_CLAIM = 'evil-org-injected-via-body';
const UID = 'user-gate-route-1';
const OTHER_USER_BODY_CLAIM = 'evil-user-injected-via-body';
const INITIATIVE_ID = 'initiative-gate-route-1';

// ── Module mocks (full replacements — router-load prerequisites, same set
//    proven sufficient by initiatives-crud.test.ts) ─────────────────────────

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/executionSpineLegacyReadOnly.middleware.js', () => ({
  requireCanonicalInitiativeExecutionWriter: (_req: any, _res: any, next: () => void) => next(),
}));

// `middleware/validation.middleware.js` is DELIBERATELY NOT mocked — see
// file-header note (1).

vi.mock('../../../utils/requestOrganization.js', () => ({
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

vi.mock('../../v8/planningPortfolioReadService.js', () => ({
  getInitiativeDetailRead: (...a: unknown[]) => mockGetInitiativeDetailRead(...a),
  getPortfolioData: vi.fn().mockResolvedValue(null),
  getPortfolioRead: vi.fn().mockResolvedValue(null),
  getPortfolioRollups: vi.fn().mockResolvedValue([]),
  getPortfolioDependencies: vi.fn().mockResolvedValue([]),
  getInitiativeTaskDependenciesRead: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../ActivityService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../notificationService.js', () => ({
  default: {
    notifyOwnerAssigned: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

// Controllable per-test (unlike the crud test's fixed resolved value) — the
// governance-gate tests below need to swing this between an allowed role, a
// denied role, and a rejection (DB unreachable).
vi.mock('../initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: (...a: unknown[]) => mockResolveAccessContext(...a),
}));

vi.mock('../initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
  listInitiativeKpiAssignments: vi.fn().mockResolvedValue([]),
  updateInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
  deleteInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../v8/transformationInitiativeTransitionAdapterService.js', () => ({
  proposeEarlyInitiativeTransition: (...a: unknown[]) => mockProposeEarly(...a),
  executeApprovedEarlyInitiativeTransition: (...a: unknown[]) => mockExecuteEarly(...a),
}));

vi.mock('../initiativeWizardService.js', () => ({
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

vi.mock('../../initiativeGenerationService.js', () => ({
  default: { generate: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../initiativeSectionTypeService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../initiativeSimilarityService.js', () => ({
  checkSimilarInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../initiativeTemplateService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn().mockResolvedValue([]),
  getInitiativeCapacity: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../blueprintService.js', () => ({
  default: { apply: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../raidScoringService.js', () => ({
  calculateRiskScore: vi.fn().mockReturnValue(0),
  categorizeScore: vi.fn().mockReturnValue('LOW'),
  DEFAULT_THRESHOLDS: { low: 30, medium: 60, high: 80 },
}));

vi.mock('../../staffingPlanService.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  },
  syncInitiativeCapacity: vi.fn().mockResolvedValue(undefined),
}));

// `queryHelpers` needs `withPgTransaction` too (the CRUD test's mock doesn't
// export it — the route under test is the only route in this file that
// calls it). It just invokes the callback with a stub client; the callback
// is `recordInitiativeLifecycleGateDecision`, itself mocked below and never
// really touches `client.query`.
const stubPgClient = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
vi.mock('../../../utils/queryHelpers.js', () => ({
  queryFirst: (...a: unknown[]) => mockQueryFirst(...a),
  queryOne: (...a: unknown[]) => mockQueryFirst(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  query: (...a: unknown[]) => mockQueryAll(...a),
  run: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
  withPgTransaction: async (fn: (client: unknown) => Promise<unknown>) => fn(stubPgClient),
}));

// PARTIAL mock — keep `InitiativeLifecycleGateDecisionError` and
// `INITIATIVE_LIFECYCLE_GATE_DOMAINS` REAL (the route's Zod schema and its
// `instanceof` error mapping must be genuine), override only the writer.
vi.mock('../initiativeLifecycleGateDecisionService.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../initiativeLifecycleGateDecisionService.js')
  >();
  return {
    ...actual,
    recordInitiativeLifecycleGateDecision: (...a: unknown[]) => mockRecordDecision(...a),
  };
});

// PARTIAL mock — `requireInitiativeWriteAccess` (used by OTHER routes in the
// same router) stays REAL; only `evaluateInitiativeGateAccess` is
// intercepted, and even then it defaults (in `beforeEach` below) to
// delegating to the REAL implementation, so most tests exercise the actual
// fail-closed allowlist logic. Only the "handler's own catch" test below
// overrides it to reject directly.
vi.mock('../initiativeGovernanceGuard.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../initiativeGovernanceGuard.js')
  >();
  return {
    ...actual,
    evaluateInitiativeGateAccess: (...a: unknown[]) => mockEvaluateGateAccess(...a),
  };
});

// ── App setup — replicates Gateway.ts's real double-mount of the SAME
//    router at both `/api/initiatives` and `/api/pmo/initiatives`
//    (Gateway.ts:657, Gateway.ts:1106) ──────────────────────────────────────

import initiativesRoutes from '../../../routes/pmo/initiatives.routes.js';

let app: Express;
let currentUserRole = 'admin';

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG, role: currentUserRole };
    next();
  });
  app.use('/api/pmo/initiatives', initiativesRoutes);
  app.use('/api/initiatives', initiativesRoutes);
});

beforeEach(async () => {
  // Default: delegate to the REAL evaluateInitiativeGateAccess so the actual
  // fail-closed allowlist logic runs unless a specific test overrides it.
  const actualGuard = await vi.importActual<
    typeof import('../initiativeGovernanceGuard.js')
  >('../initiativeGovernanceGuard.js');
  mockEvaluateGateAccess.mockImplementation(actualGuard.evaluateInitiativeGateAccess);
  mockResolveAccessContext.mockResolvedValue({ effectiveRoles: ['PMO'] });
  currentUserRole = 'admin';
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Fixtures ─────────────────────────────────────────────────────────────

const validBody = (overrides: Record<string, unknown> = {}) => ({
  transformationCaseId: 'case-gate-route-1',
  pmoDomain: 'SCHEDULE_MILESTONES',
  decisionStatus: 'approved',
  sourceDigest: 'a'.repeat(64),
  sourceCaseVersion: 3,
  baselineRefs: ['milestone:route-test-1'],
  a05ProposalVersionId: 'proposal-route-1',
  a05ApprovalReceiptRef: 'review-route-1',
  humanAuthorityRef: 'schedule_lock',
  rationale: 'Route-level test: human reviewed the exact schedule baseline.',
  deadlineAt: '2099-01-01T00:00:00.000Z',
  idempotencyKey: 'route-test:schedule:go-1',
  ...overrides,
});

const decisionFixture = (overrides: Record<string, unknown> = {}) => ({
  decisionId: 'decision-route-1',
  organizationId: ORG,
  initiativeId: INITIATIVE_ID,
  transformationCaseId: 'case-gate-route-1',
  pmoDomain: 'SCHEDULE_MILESTONES',
  version: 1,
  decisionStatus: 'approved',
  sourceDigest: 'a'.repeat(64),
  sourceCaseVersion: 3,
  baselineRefs: ['milestone:route-test-1'],
  a05ProposalVersionId: 'proposal-route-1',
  a05ApprovalReceiptRef: 'review-route-1',
  humanActorUserId: UID,
  humanAuthorityRef: 'schedule_lock',
  rationale: 'Route-level test: human reviewed the exact schedule baseline.',
  deadlineAt: '2099-01-01T00:00:00.000Z',
  idempotencyKey: 'route-test:schedule:go-1',
  inputDigest: 'b'.repeat(64),
  supersedesDecisionId: null,
  decidedAt: '2026-08-16T00:00:00.000Z',
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('two-phase early governed lifecycle routes', () => {
  it('derives proposer identity from session and creates only a pending proposal', async () => {
    mockProposeEarly.mockResolvedValue({
      proposalVersionId: 'pv-early-1',
      scopeKey: 'initiative_lifecycle:governance_decision_making',
      targetStatus: 'PROMOTED',
    });
    const res = await request(app)
      .post(`/api/initiatives/${INITIATIVE_ID}/lifecycle-transition-proposals`)
      .send({
        transformationCaseId: 'case-early-1',
        reviewerUserId: 'distinct-reviewer',
        targetStatus: 'PROMOTED',
        reason: 'Explicit proposer action',
        proposerUserId: 'forged-proposer',
        organizationId: 'forged-org',
      });
    expect(res.status).toBe(201);
    expect(mockProposeEarly).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, proposerUserId: UID, reviewerUserId: 'distinct-reviewer' })
    );
  });

  it('rejects self-review and does not execute', async () => {
    mockProposeEarly.mockRejectedValue(new Error('initiative_lifecycle_self_review_denied'));
    const res = await request(app)
      .post(`/api/initiatives/${INITIATIVE_ID}/lifecycle-transition-proposals`)
      .send({
        transformationCaseId: 'case-early-1',
        reviewerUserId: UID,
        targetStatus: 'PROMOTED',
        reason: 'Self review must fail',
      });
    expect(res.status).toBe(409);
    expect(mockExecuteEarly).not.toHaveBeenCalled();
  });

  it('execute consumes only the proposal id and derives reviewer identity from session', async () => {
    mockExecuteEarly.mockResolvedValue({
      gateDecisionId: 'gate-early-1',
      idempotentReplay: false,
      transition: { ok: true, id: INITIATIVE_ID, status: 'PROMOTED' },
    });
    const res = await request(app)
      .post(`/api/initiatives/${INITIATIVE_ID}/lifecycle-transition-executions`)
      .send({ proposalVersionId: 'pv-early-1', reason: 'Distinct reviewer approved through A05' });
    expect(res.status).toBe(201);
    expect(mockExecuteEarly).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, initiativeId: INITIATIVE_ID, reviewerUserId: UID })
    );
  });
});

describe('POST /:id/lifecycle-gate-decisions — retained handler contract at both prefixes', () => {
  it.each(['/api/pmo/initiatives', '/api/initiatives'])(
    'retains its bounded handler at %s/:id/lifecycle-gate-decisions (201 in middleware-isolated unit)',
    async (prefix) => {
      mockRecordDecision.mockResolvedValue({
        decision: decisionFixture(),
        idempotentReplay: false,
      });

      const res = await request(app)
        .post(`${prefix}/${INITIATIVE_ID}/lifecycle-gate-decisions`)
        .send(validBody());

      expect(res.status).toBe(201);
      expect(res.status).not.toBe(404);
    }
  );
});

describe('POST /:id/lifecycle-gate-decisions — happy path', () => {
  it('records a GO decision and returns 201 with the decision + idempotentReplay:false', async () => {
    mockRecordDecision.mockResolvedValue({
      decision: decisionFixture(),
      idempotentReplay: false,
    });

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.idempotentReplay).toBe(false);
    expect(res.body.decision.decisionId).toBe('decision-route-1');

    // Tenant scope came from req.user, not the body (which didn't even try
    // to forge it in this test) — pinned here as the baseline the next test
    // contrasts against.
    expect(mockRecordDecision).toHaveBeenCalledTimes(1);
    const [, input] = mockRecordDecision.mock.calls[0];
    expect(input.organizationId).toBe(ORG);
    expect(input.humanActorUserId).toBe(UID);
    expect(input.initiativeId).toBe(INITIATIVE_ID);
  });

  it('ignores a body-injected organizationId/humanActorUserId — validateBody strips undeclared keys, and the handler sources both from req.user regardless', async () => {
    mockRecordDecision.mockResolvedValue({
      decision: decisionFixture(),
      idempotentReplay: false,
    });

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(
        validBody({
          organizationId: OTHER_ORG_BODY_CLAIM,
          humanActorUserId: OTHER_USER_BODY_CLAIM,
        })
      );

    expect(res.status).toBe(201);
    expect(mockRecordDecision).toHaveBeenCalledTimes(1);
    const [, input] = mockRecordDecision.mock.calls[0];
    // The forged values never reached the service call — real req.user won.
    expect(input.organizationId).toBe(ORG);
    expect(input.organizationId).not.toBe(OTHER_ORG_BODY_CLAIM);
    expect(input.humanActorUserId).toBe(UID);
    expect(input.humanActorUserId).not.toBe(OTHER_USER_BODY_CLAIM);
  });
});

describe('POST /:id/lifecycle-gate-decisions — malformed payload (real validateBody + real Zod schema)', () => {
  it('rejects a payload missing a required field with 400 and never reaches the service', async () => {
    const { rationale: _drop, ...missingRationale } = validBody();

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(missingRationale);

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });

  it('rejects an invalid pmoDomain enum value with 400', async () => {
    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody({ pmoDomain: 'NOT_A_REAL_DOMAIN' }));

    expect(res.status).toBe(400);
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });

  it('rejects a sourceDigest that is not a 64-char hex string with 400', async () => {
    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody({ sourceDigest: 'not-a-hex-digest' }));

    expect(res.status).toBe(400);
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });
});

describe('POST /:id/lifecycle-gate-decisions — fail-closed governance gate', () => {
  it('denies with 403 for an authenticated but unpermitted role (real evaluateInitiativeGateAccess, real GATE_PERMITTED_ROLES)', async () => {
    currentUserRole = 'user'; // USER band — not ADMIN, so the short-circuit does not apply
    mockResolveAccessContext.mockResolvedValue({ effectiveRoles: ['TEAM_MEMBER'] });

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INITIATIVE_GATE_ROLE_REQUIRED');
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });

  it('denies with 403 (not 500) when the access context cannot be resolved — the GUARD\'s own fail-closed catch', async () => {
    currentUserRole = 'user';
    mockResolveAccessContext.mockRejectedValue(new Error('resolveInitiativeAccessContext: db unreachable'));

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(500);
    expect(res.body.code).toBe('INITIATIVE_GATE_ROLE_REQUIRED');
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });

  it('denies with 403 (not 500) when evaluateInitiativeGateAccess itself throws — the ROUTE HANDLER\'s own fail-closed catch, decoupled from the guard', async () => {
    currentUserRole = 'user';
    // Bypasses the real guard entirely for this call — proves the route's
    // OWN try/catch around the evaluateInitiativeGateAccess call, not the
    // guard's internal one (covered by the previous test).
    mockEvaluateGateAccess.mockRejectedValueOnce(new Error('totally unexpected failure'));

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(500);
    expect(res.body.code).toBe('INITIATIVE_GATE_DECISION_ACCESS_CHECK_FAILED');
    expect(mockRecordDecision).not.toHaveBeenCalled();
  });

  it('allows an ADMIN-band caller without ever calling resolveInitiativeAccessContext (technical override short-circuit)', async () => {
    currentUserRole = 'admin';
    mockRecordDecision.mockResolvedValue({
      decision: decisionFixture(),
      idempotentReplay: false,
    });

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(mockResolveAccessContext).not.toHaveBeenCalled();
  });
});

describe('POST /:id/lifecycle-gate-decisions — idempotent replay status-code mapping', () => {
  it('maps a fresh write to 201 and a replay of the SAME idempotency key to 200 with the SAME decision — never a second row', async () => {
    const idempotencyKey = 'route-test:replay:key-1';
    const fixture = decisionFixture({ decisionId: 'decision-replay-1', idempotencyKey });

    mockRecordDecision.mockResolvedValueOnce({ decision: fixture, idempotentReplay: false });
    const first = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody({ idempotencyKey }));
    expect(first.status).toBe(201);
    expect(first.body.decision.decisionId).toBe('decision-replay-1');

    // The service layer (proven in the pg test) is what actually guarantees
    // "same idempotency key -> same row"; here we prove the ROUTE correctly
    // reflects whatever the service reports (200 vs 201, same decisionId)
    // rather than always claiming 201 or minting a fresh id client-side.
    mockRecordDecision.mockResolvedValueOnce({ decision: fixture, idempotentReplay: true });
    const retry = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody({ idempotencyKey }));
    expect(retry.status).toBe(200);
    expect(retry.body.idempotentReplay).toBe(true);
    expect(retry.body.decision.decisionId).toBe(first.body.decision.decisionId);

    expect(mockRecordDecision).toHaveBeenCalledTimes(2);
    const firstKey = mockRecordDecision.mock.calls[0][1].idempotencyKey;
    const secondKey = mockRecordDecision.mock.calls[1][1].idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });
});

describe('POST /:id/lifecycle-gate-decisions — typed service error -> HTTP status mapping', () => {
  it('maps InitiativeLifecycleGateDecisionError(409, IDEMPOTENCY_CONFLICT) to a 409 response, not a generic 500', async () => {
    const { InitiativeLifecycleGateDecisionError } = await vi.importActual<
      typeof import('../initiativeLifecycleGateDecisionService.js')
    >('../initiativeLifecycleGateDecisionService.js');

    mockRecordDecision.mockRejectedValueOnce(
      new InitiativeLifecycleGateDecisionError(
        'INITIATIVE_GATE_DECISION_IDEMPOTENCY_CONFLICT',
        409,
        'Idempotency-Key payload conflict'
      )
    );

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INITIATIVE_GATE_DECISION_IDEMPOTENCY_CONFLICT');
  });

  it('maps an untyped/unexpected service error to a generic 500 via failInitiative500 (no raw error leakage)', async () => {
    mockRecordDecision.mockRejectedValueOnce(new Error('unexpected db driver failure: 08006'));

    const res = await request(app)
      .post(`/api/pmo/initiatives/${INITIATIVE_ID}/lifecycle-gate-decisions`)
      .send(validBody());

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INITIATIVE_GATE_DECISION_WRITE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('08006');
  });
});
