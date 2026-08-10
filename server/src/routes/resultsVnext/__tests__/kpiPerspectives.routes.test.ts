/** @vitest-environment node */

/**
 * KPI-E005 Perspectives & Links — HTTP layer route contract tests.
 *
 * Pattern precedent: `kpiScorecard.routes.test.ts` / `kpiDeviation.routes.test.ts`
 * — supertest against a minimal Express app, middleware (auth/rbac/demo/
 * rate-limit) replaced with passthroughs, the DOMAIN COMMAND/REPOSITORY
 * layer mocked (not the whole DB). The command/repository layer itself
 * already has real-Postgres evidence for MOST of its functions
 * (EXECUTION_LEDGER.md §27) — this file's job is the HTTP boundary
 * `kpiPerspectives.routes.ts` itself owns: request validation, error->HTTP
 * mapping, the managerId/userId-from-token derivation, and the mount-order
 * fix (see below). The two functions this package's own repository test
 * closes a real gap for (`listInitiativeImpactsForKpi`/
 * `listKpiImpactsForInitiative` — zero prior test coverage anywhere, grepped
 * before writing this file) have their DIRECT real-Postgres evidence in
 * `tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`,
 * not here.
 *
 * KRITISCH per this package's own brief (EXECUTION_LEDGER.md §24's lesson):
 * this file mocks `kpiPerspectivesRepository.js`/`kpiInitiativeImpactRepository.js`/
 * `kpiInitiativeImpactCommands.js` wholesale — that is fine and EXPECTED for
 * an HTTP-boundary test, but it means this file alone is NOT evidence any
 * repository visibility join works on a real Postgres.
 *
 * -- MOUNT-ORDER regression guard: `kpiPerspectives.routes.ts`'s default
 * router (`GET /my`, `GET /attention`, `/initiative-impacts/*`,
 * `GET /:kpiId/initiative-impacts`) is mounted at the SAME
 * `/api/vnext/results/kpi` prefix as `kpi.routes.ts` (unlike
 * `kpiDeviation.routes.ts`/`kpiScorecard.routes.ts`, which each own a more
 * specific sub-prefix) — both routers are mounted here, in the SAME order as
 * Gateway.ts (perspectives FIRST), and a dedicated describe block asserts
 * `GET /my`/`GET /attention` resolve through THIS router, never through
 * `kpi.routes.ts`'s `GET /:kpiId` (`kpiId="my"`/`kpiId="attention"`).
 *
 * Error CLASSES (`InitiativeKpiImpactSelfApprovalDeniedError`/
 * `KpiInitiativeImpactValidationError`/`AtomicWriteConflictError`/
 * `AtomicWriteAggregateNotFoundError`) are kept REAL (via `importOriginal`
 * for the command-module mock, or a genuine unmocked import for the platform
 * module) so this file's `instanceof` checks in `handlePerspectivesRouteError`
 * are exercised against the exact same prototypes the production code
 * throws.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListMyKpis = vi.fn();
const mockListOrganizationKpiAttention = vi.fn();

const mockProposeInitiativeKpiImpact = vi.fn();
const mockCommitInitiativeKpiImpact = vi.fn();
const mockRecordReviewedAttribution = vi.fn();
const mockSupersedeInitiativeKpiImpact = vi.fn();

const mockListInitiativeImpactsForKpi = vi.fn();
const mockListKpiImpactsForInitiative = vi.fn();

// kpi.routes.ts's own dependencies — mocked the same way kpiDeviation.routes
// .test.ts does, so mounting that router alongside this one (to exercise the
// mount-order guard) doesn't require a real DB either. None of these mocks
// are expected to be CALLED by any test below — their presence only lets
// `kpi.routes.ts` import cleanly.
const mockGetKpi = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../database/PostgresDatabase.js', () => ({
  acquirePgClient: async () => ({ query: vi.fn(), release: vi.fn() }),
}));

vi.mock('../../../services/resultsVnext/kpi/kpiPerspectivesRepository.js', () => ({
  listMyKpis: (...args: unknown[]) => mockListMyKpis(...args),
  listOrganizationKpiAttention: (...args: unknown[]) => mockListOrganizationKpiAttention(...args),
}));
vi.mock('../../../services/resultsVnext/kpi/kpiInitiativeImpactRepository.js', () => ({
  listInitiativeImpactsForKpi: (...args: unknown[]) => mockListInitiativeImpactsForKpi(...args),
  listKpiImpactsForInitiative: (...args: unknown[]) => mockListKpiImpactsForInitiative(...args),
}));
vi.mock('../../../services/resultsVnext/kpi/kpiInitiativeImpactCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiInitiativeImpactCommands.js')
    >();
  return {
    ...actual,
    proposeInitiativeKpiImpact: (...args: unknown[]) => mockProposeInitiativeKpiImpact(...args),
    commitInitiativeKpiImpact: (...args: unknown[]) => mockCommitInitiativeKpiImpact(...args),
    recordReviewedAttribution: (...args: unknown[]) => mockRecordReviewedAttribution(...args),
    supersedeInitiativeKpiImpact: (...args: unknown[]) => mockSupersedeInitiativeKpiImpact(...args),
  };
});

// kpi.routes.ts's own dependencies, mocked so it imports cleanly for the
// mount-order guard test (same shape kpiDeviation.routes.test.ts uses).
vi.mock('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js')
    >();
  return {
    ...actual,
    createKpiDraft: vi.fn(),
    editDraft: vi.fn(),
    submitDefinition: vi.fn(),
    approveDefinitionVersion: vi.fn(),
    rejectDefinitionVersion: vi.fn(),
    activateKpi: vi.fn(),
    suspendKpi: vi.fn(),
    archiveKpi: vi.fn(),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiMeasurementCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiMeasurementCommands.js')
    >();
  return {
    ...actual,
    recordMeasurement: vi.fn(),
    correctMeasurement: vi.fn(),
    verifyMeasurement: vi.fn(),
    disputeMeasurement: vi.fn(),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiRepository.js', () => ({
  getKpi: (...args: unknown[]) => mockGetKpi(...args),
  listKpis: vi.fn(),
  listMeasurements: vi.fn(),
}));

const { InitiativeKpiImpactSelfApprovalDeniedError, KpiInitiativeImpactValidationError } =
  await import('../../../services/resultsVnext/kpi/kpiInitiativeImpactCommands.js');
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } = await import(
  '../../../services/resultsVnext/platform/atomicWrite.js'
);

const kpiPerspectivesRoutes = (await import('../kpiPerspectives.routes.js')).default;
const { initiativesKpiImpactsRouter } = await import('../kpiPerspectives.routes.js');
const kpiRoutes = (await import('../kpi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  // Same order as Gateway.ts — perspectives router (same prefix as
  // kpiRoutes) registered BEFORE the generic /api/vnext/results/kpi mount.
  app.use('/api/vnext/results/kpi', kpiPerspectivesRoutes);
  app.use('/api/vnext/results/kpi', kpiRoutes);
  app.use('/api/vnext/results/initiatives', initiativesKpiImpactsRouter);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const KPI_ID = '11111111-1111-4111-8111-111111111111';
const IMPACT_ID = '22222222-2222-4222-8222-222222222222';
const INITIATIVE_ID = 'initiative-abc-123';

function myKpiItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    attentionType: 'update_due',
    attentionSource: 'governed',
    priorityRank: 1,
    kpiId: KPI_ID,
    kpiCode: 'KPI-1',
    kpiStatus: 'active',
    dueAt: '2026-08-10T00:00:00.000Z',
    relatedType: 'obligation',
    relatedId: 'obligation-1',
    detail: {},
    ...overrides,
  };
}

function attentionFixture(overrides: Record<string, unknown> = {}) {
  return {
    processCoverage: [],
    ownerLoad: [],
    missingOwnership: [],
    performanceDistribution: { onTarget: 0, warning: 0, critical: 0, neutralOrMissing: 0 },
    overdueObligations: [],
    repeatedDeviations: [],
    ineffectiveCorrectiveActions: [],
    ...overrides,
  };
}

function impactFixture(overrides: Record<string, unknown> = {}) {
  return {
    impactId: IMPACT_ID,
    organizationId: 'org-1',
    kpiId: KPI_ID,
    initiativeId: INITIATIVE_ID,
    definitionVersionIdAtCommitment: null,
    status: 'proposed',
    expectedContributionValue: 5,
    expectedContributionDirection: 'increase',
    targetCompletionDate: null,
    proposedBy: 'user-1',
    proposedAt: '2026-08-09T00:00:00.000Z',
    baselineMeasurementId: null,
    baselineValueAtCommitment: null,
    baselinePeriodEnd: null,
    committedBy: null,
    committedAt: null,
    reviewedAttributionValue: null,
    reviewedAttributionMeasurementId: null,
    reviewRationale: null,
    reviewedBy: null,
    reviewedAt: null,
    supersededByImpactId: null,
    supersededAt: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// GET /my — listMyKpis — mount-order regression guard
// ==========================================

describe('GET /api/vnext/results/kpi/my — listMyKpis', () => {
  it('resolves via THIS router, not kpi.routes.ts GET /:kpiId (mount-order fix)', async () => {
    mockListMyKpis.mockResolvedValue([myKpiItemFixture()]);
    const response = await request(createApp()).get('/api/vnext/results/kpi/my');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(mockGetKpi).not.toHaveBeenCalled();
    expect(mockListMyKpis).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1' })
    );
  });

  it('passes limit/offset through to the repository', async () => {
    mockListMyKpis.mockResolvedValue([]);
    await request(createApp()).get('/api/vnext/results/kpi/my').query({ limit: '10', offset: '5' });
    expect(mockListMyKpis).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 5 })
    );
  });
});

// ==========================================
// GET /attention — listOrganizationKpiAttention — mount-order regression guard
// ==========================================

describe('GET /api/vnext/results/kpi/attention — listOrganizationKpiAttention', () => {
  it('resolves via THIS router, not kpi.routes.ts GET /:kpiId (mount-order fix)', async () => {
    mockListOrganizationKpiAttention.mockResolvedValue(attentionFixture());
    const response = await request(createApp()).get('/api/vnext/results/kpi/attention');
    expect(response.status).toBe(200);
    expect(response.body.attention.performanceDistribution.onTarget).toBe(0);
    expect(mockGetKpi).not.toHaveBeenCalled();
    // managerId derived from the token, never a client-supplied value.
    expect(mockListOrganizationKpiAttention).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: 'user-1', organizationId: 'org-1' })
    );
  });

  it('passes includeSelf/recurrenceWindowDays query filters through', async () => {
    mockListOrganizationKpiAttention.mockResolvedValue(attentionFixture());
    await request(createApp())
      .get('/api/vnext/results/kpi/attention')
      .query({ includeSelf: 'true', recurrenceWindowDays: '90' });
    expect(mockListOrganizationKpiAttention).toHaveBeenCalledWith(
      expect.objectContaining({ includeSelf: true, recurrenceWindowDays: 90 })
    );
  });
});

// ==========================================
// kpi.routes.ts's OWN GET /:kpiId still resolves for a real UUID (sanity —
// proves the mount-order fix narrows correctly and doesn't swallow every
// request under the shared prefix).
// ==========================================

describe('GET /api/vnext/results/kpi/:kpiId still resolves via kpi.routes.ts', () => {
  it('falls through to kpi.routes.ts when the path is a UUID kpiId, not "my"/"attention"', async () => {
    mockGetKpi.mockResolvedValue({ kpiId: KPI_ID, kpiCode: 'KPI-1' });
    const response = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}`);
    expect(response.status).toBe(200);
    expect(mockGetKpi).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1', kpiId: KPI_ID })
    );
    expect(mockListMyKpis).not.toHaveBeenCalled();
    expect(mockListOrganizationKpiAttention).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST /initiative-impacts — proposeInitiativeKpiImpact
// ==========================================

describe('POST /api/vnext/results/kpi/initiative-impacts — proposeInitiativeKpiImpact', () => {
  it('proposes an impact and returns 201 with outcome=applied', async () => {
    mockProposeInitiativeKpiImpact.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { impact: impactFixture() },
    });

    const response = await request(createApp())
      .post('/api/vnext/results/kpi/initiative-impacts')
      .send({
        kpiId: KPI_ID,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 5,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
      });

    expect(response.status).toBe(201);
    expect(response.body.impact.impactId).toBe(IMPACT_ID);
    expect(mockProposeInitiativeKpiImpact).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        kpiId: KPI_ID,
        initiativeId: INITIATIVE_ID,
        proposedBy: 'user-1',
      })
    );
  });

  it('400s when a required field is missing', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/kpi/initiative-impacts')
      .send({ kpiId: KPI_ID });
    expect(response.status).toBe(400);
    expect(mockProposeInitiativeKpiImpact).not.toHaveBeenCalled();
  });

  it('maps ACTIVE_IMPACT_EXISTS to 409', async () => {
    mockProposeInitiativeKpiImpact.mockRejectedValue(
      new KpiInitiativeImpactValidationError(
        `KPI ${KPI_ID} / initiative ${INITIATIVE_ID} already has an active impact`,
        'ACTIVE_IMPACT_EXISTS',
        { kpiId: KPI_ID, initiativeId: INITIATIVE_ID }
      )
    );
    const response = await request(createApp())
      .post('/api/vnext/results/kpi/initiative-impacts')
      .send({ kpiId: KPI_ID, initiativeId: INITIATIVE_ID });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ACTIVE_IMPACT_EXISTS');
  });
});

// ==========================================
// POST .../initiative-impacts/:impactId/commit — commitInitiativeKpiImpact
// ==========================================

describe('POST .../initiative-impacts/:impactId/commit — commitInitiativeKpiImpact', () => {
  it('commits the impact', async () => {
    mockCommitInitiativeKpiImpact.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-commit',
      resultingVersion: 2,
      result: { impact: impactFixture({ status: 'committed', rowVersion: 2 }) },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/commit`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.impact.status).toBe('committed');
    expect(mockCommitInitiativeKpiImpact).toHaveBeenCalledWith(
      expect.objectContaining({ impactId: IMPACT_ID, expectedVersion: 1, committedBy: 'user-1' })
    );
  });

  it('maps NOT_PROPOSED to 409', async () => {
    mockCommitInitiativeKpiImpact.mockRejectedValue(
      new KpiInitiativeImpactValidationError(
        `Impact ${IMPACT_ID} is "committed"`,
        'NOT_PROPOSED',
        { impactId: IMPACT_ID }
      )
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/commit`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_PROPOSED');
  });

  it('400s for a non-UUID impactId', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/kpi/initiative-impacts/not-a-uuid/commit')
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(400);
    expect(mockCommitInitiativeKpiImpact).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../initiative-impacts/:impactId/review — recordReviewedAttribution
// (self-approval denial -> 403)
// ==========================================

describe('POST .../initiative-impacts/:impactId/review — recordReviewedAttribution', () => {
  it('records the reviewed attribution', async () => {
    mockRecordReviewedAttribution.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-review',
      resultingVersion: 3,
      result: { impact: impactFixture({ status: 'realized_reviewed', rowVersion: 3 }) },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/review`)
      .send({
        expectedVersion: 2,
        reviewedAttributionValue: 9,
        reviewedAttributionMeasurementId: null,
        reviewRationale: 'independent review',
      });
    expect(response.status).toBe(200);
    expect(response.body.impact.status).toBe('realized_reviewed');
    expect(mockRecordReviewedAttribution).toHaveBeenCalledWith(
      expect.objectContaining({ impactId: IMPACT_ID, reviewedBy: 'user-1' })
    );
  });

  it('maps self-approval denial to 403', async () => {
    mockRecordReviewedAttribution.mockRejectedValue(
      new InitiativeKpiImpactSelfApprovalDeniedError(IMPACT_ID, 'user-1')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/review`)
      .send({
        expectedVersion: 2,
        reviewedAttributionValue: 9,
        reviewRationale: 'self review',
      });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_APPROVAL_DENIED');
  });

  it('400s when reviewRationale is missing', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/review`)
      .send({ expectedVersion: 2, reviewedAttributionValue: 9 });
    expect(response.status).toBe(400);
    expect(mockRecordReviewedAttribution).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../initiative-impacts/:impactId/supersede — supersedeInitiativeKpiImpact
// ==========================================

describe('POST .../initiative-impacts/:impactId/supersede — supersedeInitiativeKpiImpact', () => {
  it('supersedes the impact and returns both rows', async () => {
    mockSupersedeInitiativeKpiImpact.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-supersede',
      resultingVersion: 2,
      result: {
        superseded: impactFixture({ status: 'superseded', rowVersion: 2 }),
        replacement: impactFixture({ impactId: '33333333-3333-4333-8333-333333333333', status: 'proposed' }),
      },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/supersede`)
      .send({
        expectedVersion: 1,
        replacement: { expectedContributionValue: 7, expectedContributionDirection: 'increase' },
      });
    expect(response.status).toBe(200);
    expect(response.body.superseded.status).toBe('superseded');
    expect(response.body.replacement.status).toBe('proposed');
    expect(mockSupersedeInitiativeKpiImpact).toHaveBeenCalledWith(
      expect.objectContaining({
        impactId: IMPACT_ID,
        expectedVersion: 1,
        actorUserId: 'user-1',
        replacementInput: expect.objectContaining({
          expectedContributionValue: 7,
          expectedContributionDirection: 'increase',
          proposedBy: 'user-1',
        }),
      })
    );
  });

  it('returns 409 STALE_VERSION on an optimistic-concurrency conflict', async () => {
    mockSupersedeInitiativeKpiImpact.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 1,
      })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/supersede`)
      .send({ expectedVersion: 1, replacement: {} });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('returns 404 when the aggregate does not exist', async () => {
    mockSupersedeInitiativeKpiImpact.mockRejectedValue(new AtomicWriteAggregateNotFoundError());
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/initiative-impacts/${IMPACT_ID}/supersede`)
      .send({ expectedVersion: 1, replacement: {} });
    expect(response.status).toBe(404);
  });
});

// ==========================================
// GET /:kpiId/initiative-impacts — listInitiativeImpactsForKpi
// ==========================================

describe('GET /api/vnext/results/kpi/:kpiId/initiative-impacts — listInitiativeImpactsForKpi', () => {
  it('lists impacts for the KPI', async () => {
    mockListInitiativeImpactsForKpi.mockResolvedValue([impactFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/${KPI_ID}/initiative-impacts`
    );
    expect(response.status).toBe(200);
    expect(response.body.impacts).toHaveLength(1);
    expect(mockListInitiativeImpactsForKpi).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1', kpiId: KPI_ID })
    );
  });

  it('does not collide with kpi.routes.ts GET /:kpiId (mount-order / path-shape sanity)', async () => {
    mockListInitiativeImpactsForKpi.mockResolvedValue([]);
    await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}/initiative-impacts`);
    expect(mockGetKpi).not.toHaveBeenCalled();
  });

  it('passes status/limit/offset query filters through', async () => {
    mockListInitiativeImpactsForKpi.mockResolvedValue([]);
    await request(createApp())
      .get(`/api/vnext/results/kpi/${KPI_ID}/initiative-impacts`)
      .query({ status: 'committed', limit: '10', offset: '5' });
    expect(mockListInitiativeImpactsForKpi).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed', limit: 10, offset: 5 })
    );
  });
});

// ==========================================
// GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts — listKpiImpactsForInitiative
// ==========================================

describe('GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts — listKpiImpactsForInitiative', () => {
  it('lists impacts for the initiative', async () => {
    mockListKpiImpactsForInitiative.mockResolvedValue([impactFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/initiatives/${INITIATIVE_ID}/kpi-impacts`
    );
    expect(response.status).toBe(200);
    expect(response.body.impacts).toHaveLength(1);
    expect(mockListKpiImpactsForInitiative).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        initiativeId: INITIATIVE_ID,
      })
    );
  });
});
