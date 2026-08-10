/** @vitest-environment node */

/**
 * KPI-E004 Scorecards — HTTP layer route contract tests.
 *
 * Pattern precedent: `kpiDeviation.routes.test.ts` (this file's sibling) —
 * supertest against a minimal Express app, middleware (auth/rbac/demo/
 * rate-limit) replaced with passthroughs, the DOMAIN COMMAND/REPOSITORY
 * layer mocked (not the whole DB). The command/repository layer itself
 * already has real-Postgres evidence (EXECUTION_LEDGER.md §23:
 * `scorecardCommands.test.ts` + `scorecardPublishNonLeak.realdb.test.ts`) —
 * this file's job is the HTTP boundary `kpiScorecard.routes.ts` itself
 * owns: request validation, error->HTTP mapping, the mount-order fix, and
 * the local `loadVisibleScorecard` helper (`GET /:scorecardId`, since the
 * repository has no single-row `getScorecard` — see that route's own doc
 * comment).
 *
 * KRITISCH per this package's own brief (EXECUTION_LEDGER.md §24's lesson —
 * "testy przeszły" != "działa" because `kpi.routes.test.ts`/
 * `kpiDeviation.routes.test.ts` mocked the WHOLE repository module and so
 * never exercised the real visibility JOIN): this file mocks
 * `kpiScorecardRepository.js` wholesale, same as every other *.routes.test.ts
 * in this directory — that is fine and EXPECTED for an HTTP-boundary test,
 * but it means this file alone is NOT evidence the repository's visibility
 * join works on a real Postgres. That evidence lives in a SEPARATE,
 * repository-level realDB test — see
 * `tests/resultsVnext/kpi/kpiScorecardRepositoryRoutesRealdb.test.ts`, this
 * package's own addition closing the gap `scorecardPublishNonLeak.realdb
 * .test.ts` (§23) left for `listScorecards`/`listScorecardItems`/
 * `getScorecardStatusDistribution`/`listReviewSnapshots` (only
 * `getPublishedSnapshot` had real-Postgres coverage before this package).
 *
 * Error CLASSES (`KpiScorecardValidationError`/`AtomicWriteConflictError`/
 * `AtomicWriteAggregateNotFoundError`/`KpiNoActiveVisibilityPolicyError`) are
 * kept REAL (either via `importOriginal` for the command-module mock, or a
 * genuine unmocked import for the other two modules — neither has
 * DB-touching side effects at import time) so this file's `instanceof`
 * checks in `handleScorecardRouteError` are exercised against the exact
 * same prototypes the production code throws.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateScorecard = vi.fn();
const mockAddScorecardItem = vi.fn();
const mockRemoveScorecardItem = vi.fn();
const mockReorderScorecardItems = vi.fn();
const mockActivateScorecard = vi.fn();
const mockSuspendScorecard = vi.fn();
const mockArchiveScorecard = vi.fn();
const mockCreateReviewSnapshot = vi.fn();
const mockPublishReviewSnapshot = vi.fn();

const mockListScorecards = vi.fn();
const mockListScorecardItems = vi.fn();
const mockGetScorecardStatusDistribution = vi.fn();
const mockGetPublishedSnapshot = vi.fn();
const mockListReviewSnapshots = vi.fn();

const mockDbQuery = vi.fn();
const mockDbRelease = vi.fn();

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
  acquirePgClient: async () => ({ query: mockDbQuery, release: mockDbRelease }),
}));

// Backs `loadVisibleScorecard` (this router's own local helper for
// `GET /:scorecardId` — see kpiScorecard.routes.ts's file header). Neutered
// to a no-op CTE (VISIBILITY_CTE_PARAM_COUNT=0, empty values) so the fake
// `mockDbQuery` below can pattern-match on SQL text alone, same convention
// `scorecardCommands.test.ts` documents for why it mocks this same module.
vi.mock('../../../services/resultsVnext/platform/visibilityScopedQuery.js', () => ({
  VISIBILITY_CTE_PARAM_COUNT: 0,
  wrapWithVisibilityScope: async (baseQuerySql: string) => ({ sql: baseQuerySql, values: [] }),
}));

vi.mock('../../../services/resultsVnext/kpi/kpiScorecardCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiScorecardCommands.js')
    >();
  return {
    ...actual,
    createScorecard: (...args: unknown[]) => mockCreateScorecard(...args),
    addScorecardItem: (...args: unknown[]) => mockAddScorecardItem(...args),
    removeScorecardItem: (...args: unknown[]) => mockRemoveScorecardItem(...args),
    reorderScorecardItems: (...args: unknown[]) => mockReorderScorecardItems(...args),
    activateScorecard: (...args: unknown[]) => mockActivateScorecard(...args),
    suspendScorecard: (...args: unknown[]) => mockSuspendScorecard(...args),
    archiveScorecard: (...args: unknown[]) => mockArchiveScorecard(...args),
    createReviewSnapshot: (...args: unknown[]) => mockCreateReviewSnapshot(...args),
    publishReviewSnapshot: (...args: unknown[]) => mockPublishReviewSnapshot(...args),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiScorecardRepository.js', () => ({
  listScorecards: (...args: unknown[]) => mockListScorecards(...args),
  listScorecardItems: (...args: unknown[]) => mockListScorecardItems(...args),
  getScorecardStatusDistribution: (...args: unknown[]) =>
    mockGetScorecardStatusDistribution(...args),
  getPublishedSnapshot: (...args: unknown[]) => mockGetPublishedSnapshot(...args),
  listReviewSnapshots: (...args: unknown[]) => mockListReviewSnapshots(...args),
}));

const { KpiScorecardValidationError } =
  await import('../../../services/resultsVnext/kpi/kpiScorecardCommands.js');
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } =
  await import('../../../services/resultsVnext/platform/atomicWrite.js');
const { KpiNoActiveVisibilityPolicyError } =
  await import('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js');

const kpiScorecardRoutes = (await import('../kpiScorecard.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/kpi/scorecards', kpiScorecardRoutes);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const SCORECARD_ID = '11111111-1111-4111-8111-111111111111';
const KPI_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const SNAPSHOT_ID = '44444444-4444-4444-8444-444444444444';

function scorecardFixture(overrides: Record<string, unknown> = {}) {
  return {
    scorecardId: SCORECARD_ID,
    organizationId: 'org-1',
    name: 'Executive Scorecard',
    description: null,
    scopeType: 'team',
    scopeId: null,
    ownerUserId: 'user-1',
    reviewFrequency: 'monthly',
    lifecycleStatus: 'draft',
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function scorecardRowFixture(overrides: Record<string, unknown> = {}) {
  return {
    scorecard_id: SCORECARD_ID,
    organization_id: 'org-1',
    name: 'Executive Scorecard',
    description: null,
    scope_type: 'team',
    scope_id: null,
    owner_user_id: 'user-1',
    review_frequency: 'monthly',
    lifecycle_status: 'draft',
    row_version: 1,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function itemFixture(overrides: Record<string, unknown> = {}) {
  return {
    itemId: ITEM_ID,
    scorecardId: SCORECARD_ID,
    kpiId: KPI_ID,
    role: 'supporting',
    sortOrder: 0,
    displayConfig: null,
    addedBy: 'user-1',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function snapshotFixture(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: SNAPSHOT_ID,
    scorecardId: SCORECARD_ID,
    organizationId: 'org-1',
    reviewPeriodStart: '2026-01-01T00:00:00.000Z',
    reviewPeriodEnd: '2026-01-31T00:00:00.000Z',
    snapshotPayload: null,
    status: 'draft',
    contentHash: null,
    publishedBy: null,
    publishedAt: null,
    supersededBySnapshotId: null,
    supersededAt: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Wires `mockDbQuery` for kpiScorecard.routes.ts's own local
 * `loadVisibleScorecard` (`GET /:scorecardId`) — same dispatch-by-SQL-
 * substring shape as kpiDeviation.routes.test.ts's `configureDb`. */
function configureDb(options: { scorecardRow?: Record<string, unknown> | null }): void {
  mockDbQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM rvn_kpi_scorecards sc')) {
      return options.scorecardRow
        ? { rows: [options.scorecardRow], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  configureDb({ scorecardRow: null });
});

// ==========================================
// POST / — createScorecard
// ==========================================

describe('POST /api/vnext/results/kpi/scorecards — createScorecard', () => {
  it('creates a scorecard and returns 201 with outcome=applied', async () => {
    mockCreateScorecard.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { scorecard: scorecardFixture() },
    });

    const response = await request(createApp())
      .post('/api/vnext/results/kpi/scorecards')
      .send({ name: 'Executive Scorecard', scopeType: 'team', reviewFrequency: 'monthly' });

    expect(response.status).toBe(201);
    expect(response.body.scorecard.scorecardId).toBe(SCORECARD_ID);
    expect(mockCreateScorecard).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        name: 'Executive Scorecard',
        scopeType: 'team',
        reviewFrequency: 'monthly',
        createdBy: 'user-1',
      })
    );
  });

  it('400s when a required field is missing', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/kpi/scorecards')
      .send({ name: 'Missing scopeType/reviewFrequency' });
    expect(response.status).toBe(400);
    expect(mockCreateScorecard).not.toHaveBeenCalled();
  });

  it('maps KpiNoActiveVisibilityPolicyError to 409', async () => {
    mockCreateScorecard.mockRejectedValue(new KpiNoActiveVisibilityPolicyError('org-1', 'kpi'));

    const response = await request(createApp())
      .post('/api/vnext/results/kpi/scorecards')
      .send({ name: 'No policy org', scopeType: 'team', reviewFrequency: 'monthly' });

    expect(response.status).toBe(409);
  });
});

// ==========================================
// GET / — listScorecards
// ==========================================

describe('GET /api/vnext/results/kpi/scorecards — listScorecards', () => {
  it('resolves via THIS router, not kpi.routes.ts (mount-order sanity)', async () => {
    mockListScorecards.mockResolvedValue([scorecardFixture()]);
    const response = await request(createApp()).get('/api/vnext/results/kpi/scorecards');
    expect(response.status).toBe(200);
    expect(response.body.scorecards).toHaveLength(1);
    expect(mockListScorecards).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1' })
    );
  });

  it('passes query filters through to the repository', async () => {
    mockListScorecards.mockResolvedValue([]);
    await request(createApp())
      .get('/api/vnext/results/kpi/scorecards')
      .query({ lifecycleStatus: 'active', ownerUserId: 'user-2', limit: '10', offset: '5' });
    expect(mockListScorecards).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleStatus: 'active',
        ownerUserId: 'user-2',
        limit: 10,
        offset: 5,
      })
    );
  });
});

// ==========================================
// GET /:scorecardId — getScorecard (local loadVisibleScorecard helper)
// ==========================================

describe('GET /api/vnext/results/kpi/scorecards/:scorecardId — getScorecard', () => {
  it('200s with the scorecard when the local visibility-scoped read finds a row', async () => {
    configureDb({ scorecardRow: scorecardRowFixture() });
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}`
    );
    expect(response.status).toBe(200);
    expect(response.body.scorecard.scorecardId).toBe(SCORECARD_ID);
    expect(response.body.scorecard.lifecycleStatus).toBe('draft');
  });

  it('404s when the row is not found (or not visible)', async () => {
    configureDb({ scorecardRow: null });
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}`
    );
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s for a non-UUID scorecardId instead of hitting the DB', async () => {
    const response = await request(createApp()).get('/api/vnext/results/kpi/scorecards/not-a-uuid');
    expect(response.status).toBe(400);
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});

// ==========================================
// items: list / add / remove / reorder
// ==========================================

describe('scorecard items', () => {
  it('GET .../items lists items via the repository', async () => {
    mockListScorecardItems.mockResolvedValue([itemFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`
    );
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(mockListScorecardItems).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      scorecardId: SCORECARD_ID,
    });
  });

  it('POST .../items adds an item and returns 201', async () => {
    mockAddScorecardItem.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-add',
      resultingVersion: 2,
      result: { scorecard: scorecardFixture({ rowVersion: 2 }), item: itemFixture() },
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`)
      .send({ expectedVersion: 1, kpiId: KPI_ID });

    expect(response.status).toBe(201);
    expect(response.body.item.kpiId).toBe(KPI_ID);
    expect(mockAddScorecardItem).toHaveBeenCalledWith(
      expect.objectContaining({ scorecardId: SCORECARD_ID, expectedVersion: 1, kpiId: KPI_ID })
    );
  });

  it('POST .../items maps ITEM_ALREADY_EXISTS to 409', async () => {
    mockAddScorecardItem.mockRejectedValue(
      new KpiScorecardValidationError(
        `KPI ${KPI_ID} is already a member of scorecard ${SCORECARD_ID}`,
        'ITEM_ALREADY_EXISTS',
        { scorecardId: SCORECARD_ID, kpiId: KPI_ID }
      )
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`)
      .send({ expectedVersion: 1, kpiId: KPI_ID });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ITEM_ALREADY_EXISTS');
  });

  it('DELETE .../items/:itemId removes an item', async () => {
    mockRemoveScorecardItem.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-remove',
      resultingVersion: 3,
      result: { scorecard: scorecardFixture({ rowVersion: 3 }), removedItemId: ITEM_ID },
    });

    const response = await request(createApp())
      .delete(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items/${ITEM_ID}`)
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(200);
    expect(response.body.removedItemId).toBe(ITEM_ID);
    expect(mockRemoveScorecardItem).toHaveBeenCalledWith(
      expect.objectContaining({ scorecardId: SCORECARD_ID, itemId: ITEM_ID, expectedVersion: 2 })
    );
  });

  it('PATCH .../items/reorder reorders items', async () => {
    mockReorderScorecardItems.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-reorder',
      resultingVersion: 4,
      result: {
        scorecard: scorecardFixture({ rowVersion: 4 }),
        items: [itemFixture({ sortOrder: 1 })],
      },
    });

    const response = await request(createApp())
      .patch(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items/reorder`)
      .send({ expectedVersion: 3, items: [{ itemId: ITEM_ID, sortOrder: 1 }] });

    expect(response.status).toBe(200);
    expect(response.body.items[0].sortOrder).toBe(1);
    expect(mockReorderScorecardItems).toHaveBeenCalledWith(
      expect.objectContaining({
        scorecardId: SCORECARD_ID,
        expectedVersion: 3,
        items: [{ itemId: ITEM_ID, sortOrder: 1 }],
      })
    );
  });

  it('400s reorder when items array is empty', async () => {
    const response = await request(createApp())
      .patch(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items/reorder`)
      .send({ expectedVersion: 3, items: [] });
    expect(response.status).toBe(400);
    expect(mockReorderScorecardItems).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../status — getScorecardStatusDistribution
// ==========================================

describe('GET .../status — getScorecardStatusDistribution', () => {
  it('returns the distribution', async () => {
    mockGetScorecardStatusDistribution.mockResolvedValue({
      safe: 1,
      warning: 0,
      critical: 0,
      missing: 0,
      totalVisible: 1,
    });
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/status`
    );
    expect(response.status).toBe(200);
    expect(response.body.distribution.totalVisible).toBe(1);
    expect(mockGetScorecardStatusDistribution).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        scorecardId: SCORECARD_ID,
      })
    );
  });
});

// ==========================================
// lifecycle: activate / suspend / archive
// ==========================================

describe('POST .../activate | .../suspend | .../archive', () => {
  it('activates the scorecard', async () => {
    mockActivateScorecard.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-activate',
      resultingVersion: 2,
      result: scorecardFixture({ lifecycleStatus: 'active', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.scorecard.lifecycleStatus).toBe('active');
  });

  it('maps NO_MEMBERS to 409 on activate', async () => {
    mockActivateScorecard.mockRejectedValue(
      new KpiScorecardValidationError(
        `Scorecard ${SCORECARD_ID} has no members — cannot activate`,
        'NO_MEMBERS',
        { scorecardId: SCORECARD_ID }
      )
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NO_MEMBERS');
  });

  it('suspends the scorecard', async () => {
    mockSuspendScorecard.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-suspend',
      resultingVersion: 3,
      result: scorecardFixture({ lifecycleStatus: 'suspended', rowVersion: 3 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/suspend`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(200);
    expect(response.body.scorecard.lifecycleStatus).toBe('suspended');
  });

  it('archives the scorecard', async () => {
    mockArchiveScorecard.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-archive',
      resultingVersion: 4,
      result: scorecardFixture({ lifecycleStatus: 'archived', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/archive`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.scorecard.lifecycleStatus).toBe('archived');
  });
});

// ==========================================
// review-snapshots: create / list / published / publish
// ==========================================

describe('review snapshots', () => {
  it('POST .../review-snapshots creates a draft snapshot (201)', async () => {
    mockCreateReviewSnapshot.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-snap',
      resultingVersion: 1,
      result: snapshotFixture(),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots`)
      .send({
        reviewPeriodStart: '2026-01-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-01-31T00:00:00.000Z',
      });
    expect(response.status).toBe(201);
    expect(response.body.snapshot.snapshotId).toBe(SNAPSHOT_ID);
    expect(mockCreateReviewSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ scorecardId: SCORECARD_ID, createdBy: 'user-1' })
    );
  });

  it('GET .../review-snapshots lists snapshot history', async () => {
    mockListReviewSnapshots.mockResolvedValue([snapshotFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots`
    );
    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(mockListReviewSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        scorecardId: SCORECARD_ID,
      })
    );
  });

  it('GET .../review-snapshots/published returns the current published snapshot', async () => {
    mockGetPublishedSnapshot.mockResolvedValue(
      snapshotFixture({
        status: 'published',
        snapshotPayload: {
          items: [],
          statusCounts: { safe: 0, warning: 0, critical: 0, missing: 0 },
        },
      })
    );
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots/published`
    );
    expect(response.status).toBe(200);
    expect(response.body.snapshot.status).toBe('published');
    expect(mockGetPublishedSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      scorecardId: SCORECARD_ID,
    });
  });

  it('GET .../review-snapshots/published 404s when there is none', async () => {
    mockGetPublishedSnapshot.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots/published`
    );
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('POST .../review-snapshots/:snapshotId/publish publishes the snapshot', async () => {
    mockPublishReviewSnapshot.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-publish',
      resultingVersion: 2,
      result: {
        snapshotId: SNAPSHOT_ID,
        scorecardId: SCORECARD_ID,
        status: 'published',
        contentHash: 'hash-1',
        publishedAt: '2026-02-01T00:00:00.000Z',
        supersededSnapshotId: null,
        items: [],
        statusCounts: { safe: 0, warning: 0, critical: 0, missing: 0 },
      },
    });
    const response = await request(createApp())
      .post(
        `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots/${SNAPSHOT_ID}/publish`
      )
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.snapshot.status).toBe('published');
    expect(mockPublishReviewSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: SNAPSHOT_ID,
        scorecardId: SCORECARD_ID,
        expectedVersion: 1,
        publishedBy: 'user-1',
      })
    );
  });

  it('maps NOT_A_DRAFT to 409 on publish', async () => {
    mockPublishReviewSnapshot.mockRejectedValue(
      new KpiScorecardValidationError(
        `Snapshot ${SNAPSHOT_ID} is "published" — only a draft snapshot may be published`,
        'NOT_A_DRAFT',
        { snapshotId: SNAPSHOT_ID, status: 'published' }
      )
    );
    const response = await request(createApp())
      .post(
        `/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots/${SNAPSHOT_ID}/publish`
      )
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_A_DRAFT');
  });
});

// ==========================================
// STALE_VERSION -> 409 / aggregate not found -> 404 (shared error mapper)
// ==========================================

describe('optimistic-concurrency and not-found error mapping', () => {
  it('returns 409 STALE_VERSION when the command reports an optimistic-concurrency conflict', async () => {
    mockAddScorecardItem.mockRejectedValue(
      new AtomicWriteConflictError(
        'Aggregate was modified since it was last read',
        'STALE_VERSION',
        {
          currentVersion: 3,
          expectedVersion: 1,
        }
      )
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`)
      .send({ expectedVersion: 1, kpiId: KPI_ID });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
    expect(response.body.currentVersion).toBe(3);
  });

  it('returns 404 when the command reports the aggregate does not exist', async () => {
    mockAddScorecardItem.mockRejectedValue(new AtomicWriteAggregateNotFoundError());
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`)
      .send({ expectedVersion: 1, kpiId: KPI_ID });
    expect(response.status).toBe(404);
  });
});
