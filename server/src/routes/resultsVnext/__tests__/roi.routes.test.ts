/** @vitest-environment node */

/**
 * ROI-E001 API layer — route contract tests.
 *
 * Pattern precedent: `kpi.routes.test.ts` — supertest against a minimal
 * Express app, middleware (auth/rbac/demo/rate-limit) replaced with
 * passthroughs, the DOMAIN SERVICE layer mocked (not the whole DB). This
 * file's job is the HTTP boundary `roi.routes.ts` itself owns: request
 * validation, error->HTTP mapping, and the "load the case first
 * (includeArchived:true) to 404 before invoking the command" plumbing.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateRoiCase = vi.fn();
const mockUpdateRoiCaseDetails = vi.fn();
const mockArchiveRoiCase = vi.fn();
const mockStartModeling = vi.fn();
const mockMarkReadyForReview = vi.fn();

const mockCaptureOrUpdateBaseline = vi.fn();

const mockGetRoiCase = vi.fn();
const mockListRoiCases = vi.fn();
const mockGetRoiBaseline = vi.fn();

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

vi.mock('../../../services/resultsVnext/roi/roiCaseCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCaseCommands.js')>();
  return {
    ...actual,
    createRoiCase: (...args: unknown[]) => mockCreateRoiCase(...args),
    updateRoiCaseDetails: (...args: unknown[]) => mockUpdateRoiCaseDetails(...args),
    archiveRoiCase: (...args: unknown[]) => mockArchiveRoiCase(...args),
    startModeling: (...args: unknown[]) => mockStartModeling(...args),
    markReadyForReview: (...args: unknown[]) => mockMarkReadyForReview(...args),
  };
});

vi.mock('../../../services/resultsVnext/roi/roiBaselineCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/roi/roiBaselineCommands.js')>();
  return {
    ...actual,
    captureOrUpdateBaseline: (...args: unknown[]) => mockCaptureOrUpdateBaseline(...args),
  };
});

vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: (...args: unknown[]) => mockListRoiCases(...args),
  getRoiBaseline: (...args: unknown[]) => mockGetRoiBaseline(...args),
}));

const { RoiCaseNoActiveVisibilityPolicyError, RoiCaseNotReadyForReviewError, RoiCaseValidationError } =
  await import('../../../services/resultsVnext/roi/roiCaseCommands.js');
const { RoiBaselineFrozenError } = await import('../../../services/resultsVnext/roi/roiBaselineCommands.js');
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } =
  await import('../../../services/resultsVnext/platform/atomicWrite.js');

const roiRoutes = (await import('../roi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const BASELINE_ID = '22222222-2222-4222-8222-222222222222';

function caseFixture(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    initiativeId: 'initiative-1',
    title: 'Case title',
    ownerUserId: 'user-1',
    status: 'draft',
    currency: 'USD',
    granularity: 'monthly',
    analysisStart: null,
    analysisEnd: null,
    originalApprovedSnapshotId: null,
    latestApprovedSnapshotId: null,
    currentForecastVersionId: null,
    currentActualSnapshotId: null,
    nextActionType: null,
    nextActionDueAt: null,
    nextReviewAt: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    archivedAt: null,
    archivedBy: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baselineFixture(overrides: Record<string, unknown> = {}) {
  return {
    baselineId: BASELINE_ID,
    caseId: CASE_ID,
    organizationId: 'org-1',
    baselinePeriodStart: null,
    baselinePeriodEnd: null,
    currentMeasuredValue: null,
    currentMeasuredUnit: null,
    currentMeasuredAsOf: null,
    bauProjectionMethod: 'flat',
    bauGrowthRatePct: null,
    bauReferenceValue: null,
    interventionComparisonNotes: null,
    source: null,
    confidence: null,
    ownerUserId: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// create -> get roundtrip
// ==========================================

describe('POST /api/vnext/results/roi/cases + GET /cases/:caseId — create -> get roundtrip', () => {
  it('creates a ROI case and the same id is fetchable via GET', async () => {
    const roiCase = caseFixture();
    const baseline = baselineFixture();
    mockCreateRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { case: roiCase, baseline, created: true },
    });
    mockGetRoiCase.mockResolvedValue(roiCase);

    const createResponse = await request(createApp()).post('/api/vnext/results/roi/cases').send({
      initiativeId: 'initiative-1',
      title: 'Case title',
      ownerUserId: 'user-1',
      currency: 'USD',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.case.caseId).toBe(CASE_ID);
    expect(createResponse.body.created).toBe(true);
    expect(mockCreateRoiCase).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateRoiCase.mock.calls[0][0];
    expect(createArgs.organizationId).toBe('org-1');
    expect(createArgs.createdBy).toBe('user-1');
    expect(typeof createArgs.idempotencyKey).toBe('string');
    expect(createArgs.idempotencyKey.length).toBeGreaterThan(0);

    const getResponse = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.case.caseId).toBe(CASE_ID);
    expect(mockGetRoiCase).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      caseId: CASE_ID,
      includeArchived: true,
    });
  });

  it('returns 200 (not 201) when AC-02 returned a pre-existing case (created:false)', async () => {
    const roiCase = caseFixture();
    mockCreateRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { case: roiCase, baseline: baselineFixture(), created: false },
    });

    const response = await request(createApp()).post('/api/vnext/results/roi/cases').send({
      initiativeId: 'initiative-1',
      title: 'Case title',
      ownerUserId: 'user-1',
      currency: 'USD',
    });

    expect(response.status).toBe(200);
    expect(response.body.created).toBe(false);
  });

  it('404s GET for a case the repository does not return (not found / not visible)', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/roi/cases')
      .send({ initiativeId: 'initiative-1' });
    expect(response.status).toBe(400);
    expect(mockCreateRoiCase).not.toHaveBeenCalled();
  });

  it('maps RoiCaseNoActiveVisibilityPolicyError to 409', async () => {
    mockCreateRoiCase.mockRejectedValue(
      new RoiCaseNoActiveVisibilityPolicyError('org-1', 'roi')
    );
    const response = await request(createApp()).post('/api/vnext/results/roi/cases').send({
      initiativeId: 'initiative-1',
      title: 'Case title',
      ownerUserId: 'user-1',
      currency: 'USD',
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NO_ACTIVE_VISIBILITY_POLICY');
  });
});

// ==========================================
// GET /cases — list
// ==========================================

describe('GET /api/vnext/results/roi/cases — listRoiCases', () => {
  it('passes status/includeArchived/limit/offset through to the repository', async () => {
    mockListRoiCases.mockResolvedValue([caseFixture()]);
    const response = await request(createApp()).get(
      '/api/vnext/results/roi/cases?status=modeling&includeArchived=true&limit=10&offset=5'
    );
    expect(response.status).toBe(200);
    expect(response.body.cases).toHaveLength(1);
    expect(mockListRoiCases).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      status: 'modeling',
      includeArchived: true,
      limit: 10,
      offset: 5,
    });
  });
});

// ==========================================
// PATCH /cases/:caseId — updateRoiCaseDetails
// ==========================================

describe('PATCH /api/vnext/results/roi/cases/:caseId — updateRoiCaseDetails', () => {
  it('404s when the case does not exist/is not visible, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(404);
    expect(mockUpdateRoiCaseDetails).not.toHaveBeenCalled();
  });

  it('updates details and maps STALE_VERSION to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockUpdateRoiCaseDetails.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 1,
      })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('maps RoiCaseValidationError (NOT_EDITABLE) to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockUpdateRoiCaseDetails.mockRejectedValue(
      new RoiCaseValidationError('not editable', 'NOT_EDITABLE', { caseId: CASE_ID })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_EDITABLE');
  });
});

// ==========================================
// POST /cases/:caseId/archive — archiveRoiCase
// ==========================================

describe('POST /api/vnext/results/roi/cases/:caseId/archive — archiveRoiCase', () => {
  it('archives a case regardless of status (no status guard at the HTTP layer)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockArchiveRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: caseFixture({ archivedAt: '2026-02-01T00:00:00.000Z', archivedBy: 'user-1', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/archive`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.case.archivedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('looks up the case with includeArchived:true so re-archiving an already-archived case is not a false 404', async () => {
    mockGetRoiCase.mockResolvedValue(
      caseFixture({ archivedAt: '2026-02-01T00:00:00.000Z', archivedBy: 'user-1' })
    );
    mockArchiveRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 2,
      result: caseFixture({ archivedAt: '2026-02-01T00:00:00.000Z', archivedBy: 'user-1', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/archive`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(mockGetRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, includeArchived: true })
    );
  });
});

// ==========================================
// transitions: start-modeling / ready-for-review
// ==========================================

describe('POST .../transitions/start-modeling | ready-for-review', () => {
  it('startModeling: 200 on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockStartModeling.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 2,
      result: caseFixture({ status: 'modeling', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-modeling`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('modeling');
  });

  it('markReadyForReview: maps RoiCaseNotReadyForReviewError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'modeling' }));
    mockMarkReadyForReview.mockRejectedValue(
      new RoiCaseNotReadyForReviewError(CASE_ID, 'baseline_measured_value_missing')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/ready-for-review`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_READY_FOR_REVIEW');
    expect(response.body.details.reason).toBe('baseline_measured_value_missing');
  });

  it('404s when the case does not exist, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-modeling`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockStartModeling).not.toHaveBeenCalled();
  });

  it('maps AtomicWriteAggregateNotFoundError to 404', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockStartModeling.mockRejectedValue(new AtomicWriteAggregateNotFoundError());
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-modeling`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
  });
});

// ==========================================
// baseline: GET + PUT
// ==========================================

describe('GET/PUT .../cases/:caseId/baseline', () => {
  it('GET returns the baseline', async () => {
    mockGetRoiBaseline.mockResolvedValue(baselineFixture());
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/baseline`);
    expect(response.status).toBe(200);
    expect(response.body.baseline.baselineId).toBe(BASELINE_ID);
  });

  it('GET 404s when the baseline is not found/visible', async () => {
    mockGetRoiBaseline.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/baseline`);
    expect(response.status).toBe(404);
  });

  it('PUT captures/updates the baseline', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockCaptureOrUpdateBaseline.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 2,
      result: baselineFixture({ currentMeasuredValue: 42, rowVersion: 2 }),
    });
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/baseline`)
      .send({ expectedVersion: 1, currentMeasuredValue: 42 });
    expect(response.status).toBe(200);
    expect(response.body.baseline.currentMeasuredValue).toBe(42);
    expect(mockCaptureOrUpdateBaseline).toHaveBeenCalledTimes(1);
    expect(mockCaptureOrUpdateBaseline.mock.calls[0][0].actorId).toBe('user-1');
  });

  it('PUT maps RoiBaselineFrozenError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockCaptureOrUpdateBaseline.mockRejectedValue(
      new RoiBaselineFrozenError(CASE_ID, BASELINE_ID)
    );
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/baseline`)
      .send({ expectedVersion: 1, currentMeasuredValue: 42 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('BASELINE_FROZEN');
  });

  it('PUT 404s when the parent case does not exist, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/baseline`)
      .send({ expectedVersion: 1, currentMeasuredValue: 42 });
    expect(response.status).toBe(404);
    expect(mockCaptureOrUpdateBaseline).not.toHaveBeenCalled();
  });
});
