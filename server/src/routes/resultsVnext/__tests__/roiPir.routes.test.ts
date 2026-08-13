/** @vitest-environment node */

/**
 * ROI-E006 API layer — route contract tests for the 8 new PIR & Learning
 * endpoints on `roi.routes.ts` (design §9) plus the new
 * `roiPerspectives.routes.ts` `GET /org/pir-outcomes` endpoint.
 *
 * Pattern precedent: `roiBenefitsRealization.routes.test.ts` (ROI-E005) —
 * supertest against a minimal Express app, middleware replaced with
 * passthroughs, only the DOMAIN modules this epic touches are mocked.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRoiCase = vi.fn();
const mockScheduleRoiCasePostInvestmentReview = vi.fn();
const mockMarkRoiCasePostInvestmentReviewDue = vi.fn();
const mockStartRoiCasePostInvestmentReview = vi.fn();
const mockUpdateRoiPostInvestmentReviewDraft = vi.fn();
const mockRecordRoiPirTeresaDraftDisposition = vi.fn();
const mockCloseRoiCase = vi.fn();
const mockListRoiPostInvestmentReviews = vi.fn();
const mockGetRoiPostInvestmentReview = vi.fn();
const mockListOrganizationRoiPirOutcomes = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-actor', organizationId: 'org-1', role: 'admin' };
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

vi.mock('../../../services/resultsVnext/roi/roiPirCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiPirCommands.js')>();
  return {
    ...actual,
    scheduleRoiCasePostInvestmentReview: (...args: unknown[]) => mockScheduleRoiCasePostInvestmentReview(...args),
    markRoiCasePostInvestmentReviewDue: (...args: unknown[]) => mockMarkRoiCasePostInvestmentReviewDue(...args),
    startRoiCasePostInvestmentReview: (...args: unknown[]) => mockStartRoiCasePostInvestmentReview(...args),
    updateRoiPostInvestmentReviewDraft: (...args: unknown[]) => mockUpdateRoiPostInvestmentReviewDraft(...args),
    recordRoiPirTeresaDraftDisposition: (...args: unknown[]) => mockRecordRoiPirTeresaDraftDisposition(...args),
    closeRoiCase: (...args: unknown[]) => mockCloseRoiCase(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiPirRepository.js', () => ({
  listRoiPostInvestmentReviews: (...args: unknown[]) => mockListRoiPostInvestmentReviews(...args),
  getRoiPostInvestmentReview: (...args: unknown[]) => mockGetRoiPostInvestmentReview(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiOrgPerspectiveRepository.js', () => ({
  listOrganizationRoiPirOutcomes: (...args: unknown[]) => mockListOrganizationRoiPirOutcomes(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: vi.fn(),
  getRoiBaseline: vi.fn(),
}));

const { RoiCaseValidationError } = await import('../../../services/resultsVnext/roi/roiCaseCommands.js');
const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');
const { RoiPirNotFoundError, RoiPirSelfCloseDeniedError, RoiPirValidationError } = await import(
  '../../../services/resultsVnext/roi/roiPirCommands.js'
);

const roiRoutes = (await import('../roi.routes.js')).default;
const roiPerspectivesRoutes = (await import('../roiPerspectives.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiPerspectivesRoutes);
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const PIR_ID = '22222222-2222-4222-8222-222222222222';

function caseFixture(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    initiativeId: 'initiative-1',
    title: 'Case title',
    ownerUserId: 'user-1',
    status: 'benefits_realization',
    currency: 'USD',
    granularity: 'monthly',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    originalApprovedSnapshotId: 'snap-1',
    latestApprovedSnapshotId: 'snap-1',
    currentForecastVersionId: null,
    currentActualSnapshotId: null,
    nextActionType: null,
    nextActionDueAt: null,
    nextReviewAt: null,
    rowVersion: 3,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function pirFixture(overrides: Record<string, unknown> = {}) {
  return {
    pirId: PIR_ID,
    caseId: CASE_ID,
    organizationId: 'org-1',
    sequenceNumber: 1,
    status: 'draft',
    startedBy: 'user-1',
    startedAt: '2026-01-01T00:00:00.000Z',
    reviewSnapshotPayload: { caseId: CASE_ID, variances: [] },
    reviewSnapshotHash: 'a'.repeat(64),
    outcome: null,
    lessonsLearned: null,
    recommendation: null,
    openVarianceWaiverReason: null,
    teresaDraftLessonsPayload: null,
    teresaDraftGeneratedAt: null,
    teresaDraftDisposition: null,
    teresaDraftDispositionBy: null,
    teresaDraftDispositionAt: null,
    finalizedBy: null,
    finalizedAt: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// PUT .../post-investment-review-schedule
// ==========================================

describe('PUT .../post-investment-review-schedule', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    mockScheduleRoiCasePostInvestmentReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 4,
      result: caseFixture({ status: 'tracking', rowVersion: 4, nextReviewAt: '2026-12-01T00:00:00.000Z' }),
    });
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-review-schedule`)
      .send({ expectedVersion: 3, nextReviewAt: '2026-12-01T00:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(response.body.case.nextReviewAt).toBe('2026-12-01T00:00:00.000Z');
    expect(mockScheduleRoiCasePostInvestmentReview).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, expectedVersion: 3, nextReviewAt: '2026-12-01T00:00:00.000Z' })
    );
  });

  it('400s when nextReviewAt is missing', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-review-schedule`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(400);
    expect(mockScheduleRoiCasePostInvestmentReview).not.toHaveBeenCalled();
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-review-schedule`)
      .send({ expectedVersion: 3, nextReviewAt: '2026-12-01T00:00:00.000Z' });
    expect(response.status).toBe(404);
  });

  it('maps RoiCaseValidationError to 409 (guard scope)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'draft' }));
    mockScheduleRoiCasePostInvestmentReview.mockRejectedValue(
      new RoiCaseValidationError('not schedulable', 'INVALID_ROI_CASE_STATUS_TRANSITION', { caseId: CASE_ID })
    );
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-review-schedule`)
      .send({ expectedVersion: 3, nextReviewAt: '2026-12-01T00:00:00.000Z' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_ROI_CASE_STATUS_TRANSITION');
  });
});

// ==========================================
// POST .../transitions/mark-pir-due
// ==========================================

describe('POST .../transitions/mark-pir-due', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'benefits_realization' }));
    mockMarkRoiCasePostInvestmentReviewDue.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 4,
      result: caseFixture({ status: 'post_investment_review_due', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/mark-pir-due`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('post_investment_review_due');
  });

  it('maps AtomicWriteConflictError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'benefits_realization' }));
    mockMarkRoiCasePostInvestmentReviewDue.mockRejectedValue(new AtomicWriteConflictError('stale', 'STALE_VERSION'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/mark-pir-due`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(409);
  });
});

// ==========================================
// POST .../transitions/start-pir
// ==========================================

describe('POST .../transitions/start-pir', () => {
  it('200s on success — result shape is { case, pir }', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review_due' }));
    mockStartRoiCasePostInvestmentReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 4,
      result: { case: caseFixture({ status: 'post_investment_review', rowVersion: 4 }), pir: pirFixture() },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-pir`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('post_investment_review');
    expect(response.body.pir.pirId).toBe(PIR_ID);
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-pir`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(mockStartRoiCasePostInvestmentReview).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../post-investment-reviews[/:pirId]
// ==========================================

describe('GET .../post-investment-reviews', () => {
  it('200s with the list', async () => {
    mockListRoiPostInvestmentReviews.mockResolvedValue([pirFixture()]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews`);
    expect(response.status).toBe(200);
    expect(response.body.postInvestmentReviews).toHaveLength(1);
  });
});

describe('GET .../post-investment-reviews/:pirId', () => {
  it('200s with the single PIR', async () => {
    mockGetRoiPostInvestmentReview.mockResolvedValue(pirFixture());
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}`
    );
    expect(response.status).toBe(200);
    expect(response.body.postInvestmentReview.pirId).toBe(PIR_ID);
  });

  it('404s when not found/not visible', async () => {
    mockGetRoiPostInvestmentReview.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}`
    );
    expect(response.status).toBe(404);
  });
});

// ==========================================
// PATCH .../post-investment-reviews/:pirId
// ==========================================

describe('PATCH .../post-investment-reviews/:pirId', () => {
  it('200s on success', async () => {
    mockUpdateRoiPostInvestmentReviewDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 2,
      result: pirFixture({ outcome: 'benefits_fully_realized', lessonsLearned: 'Lesson', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}`)
      .send({ expectedVersion: 1, outcome: 'benefits_fully_realized', lessonsLearned: 'Lesson' });
    expect(response.status).toBe(200);
    expect(response.body.postInvestmentReview.outcome).toBe('benefits_fully_realized');
    expect(mockUpdateRoiPostInvestmentReviewDraft).toHaveBeenCalledWith(
      expect.objectContaining({ pirId: PIR_ID, caseId: CASE_ID, expectedVersion: 1 })
    );
  });

  it('maps RoiPirValidationError (NOT_EDITABLE) to 409', async () => {
    mockUpdateRoiPostInvestmentReviewDraft.mockRejectedValue(
      new RoiPirValidationError('finalized', 'NOT_EDITABLE', { pirId: PIR_ID })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}`)
      .send({ expectedVersion: 1, outcome: 'benefits_fully_realized' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_EDITABLE');
  });

  it('maps RoiPirNotFoundError to 404', async () => {
    mockUpdateRoiPostInvestmentReviewDraft.mockRejectedValue(new RoiPirNotFoundError(CASE_ID));
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PIR_NOT_FOUND');
  });
});

// ==========================================
// POST .../post-investment-reviews/:pirId/teresa-draft-disposition
// ==========================================

describe('POST .../post-investment-reviews/:pirId/teresa-draft-disposition', () => {
  it("200s for 'rejected' with no finalLessonsText", async () => {
    mockRecordRoiPirTeresaDraftDisposition.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 2,
      result: pirFixture({ teresaDraftDisposition: 'rejected', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}/teresa-draft-disposition`)
      .send({ expectedVersion: 1, disposition: 'rejected' });
    expect(response.status).toBe(200);
    expect(response.body.postInvestmentReview.teresaDraftDisposition).toBe('rejected');
  });

  it("200s for 'accepted' with finalLessonsText", async () => {
    mockRecordRoiPirTeresaDraftDisposition.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: 2,
      result: pirFixture({ teresaDraftDisposition: 'accepted', lessonsLearned: 'Final text', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}/teresa-draft-disposition`)
      .send({ expectedVersion: 1, disposition: 'accepted', finalLessonsText: 'Final text' });
    expect(response.status).toBe(200);
    expect(response.body.postInvestmentReview.lessonsLearned).toBe('Final text');
  });

  it('maps RoiPirValidationError (FINAL_LESSONS_TEXT_REQUIRED) to 409', async () => {
    mockRecordRoiPirTeresaDraftDisposition.mockRejectedValue(
      new RoiPirValidationError('missing text', 'FINAL_LESSONS_TEXT_REQUIRED', { pirId: PIR_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}/teresa-draft-disposition`)
      .send({ expectedVersion: 1, disposition: 'accepted' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FINAL_LESSONS_TEXT_REQUIRED');
  });

  it('400s for an invalid disposition enum value', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/post-investment-reviews/${PIR_ID}/teresa-draft-disposition`)
      .send({ expectedVersion: 1, disposition: 'maybe' });
    expect(response.status).toBe(400);
    expect(mockRecordRoiPirTeresaDraftDisposition).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../transitions/close
// ==========================================

describe('POST .../transitions/close', () => {
  it('200s on success — result shape is { case, pir }', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-7',
      resultingVersion: 4,
      result: {
        case: caseFixture({ status: 'closed', rowVersion: 4, nextActionType: null, nextActionDueAt: null }),
        pir: pirFixture({ status: 'finalized', finalizedBy: 'user-actor' }),
      },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('closed');
    expect(response.body.pir.status).toBe('finalized');
  });

  it('D6: maps RoiPirSelfCloseDeniedError to 403', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockRejectedValue(new RoiPirSelfCloseDeniedError(CASE_ID, PIR_ID, 'user-actor'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PIR_SELF_CLOSE_DENIED');
  });

  it('maps RoiPirNotFoundError (no active draft PIR) to 404', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockRejectedValue(new RoiPirNotFoundError(CASE_ID));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PIR_NOT_FOUND');
  });

  it('AC-03: maps RoiPirValidationError (OPEN_VARIANCES_UNRESOLVED) to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockRejectedValue(
      new RoiPirValidationError('open variances', 'OPEN_VARIANCES_UNRESOLVED', { caseId: CASE_ID, openVarianceIds: ['v-1'] })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('OPEN_VARIANCES_UNRESOLVED');
  });

  it('AC-03: maps RoiPirValidationError (PIR_INCOMPLETE) to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockRejectedValue(new RoiPirValidationError('incomplete', 'PIR_INCOMPLETE', { caseId: CASE_ID }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3, openVarianceWaiverReason: 'waived' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PIR_INCOMPLETE');
  });

  it('accepts an optional openVarianceWaiverReason and forwards it', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'post_investment_review' }));
    mockCloseRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-8',
      resultingVersion: 4,
      result: { case: caseFixture({ status: 'closed' }), pir: pirFixture({ status: 'finalized' }) },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/close`)
      .send({ expectedVersion: 3, openVarianceWaiverReason: 'client accepted residual variance' });
    expect(response.status).toBe(200);
    expect(mockCloseRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ openVarianceWaiverReason: 'client accepted residual variance' })
    );
  });
});

// ==========================================
// GET .../org/pir-outcomes — mount-order regression guard
// ==========================================

describe('GET .../org/pir-outcomes', () => {
  it('200s with the org rollup, and managerId is derived from auth.userId, never client-supplied', async () => {
    mockListOrganizationRoiPirOutcomes.mockResolvedValue({
      cases: [
        {
          caseId: CASE_ID,
          initiativeId: 'initiative-1',
          title: 'Case title',
          status: 'closed',
          pirOutcome: 'benefits_fully_realized',
          benefitsRealizationPct: 100,
          finalizedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      portfolioTotals: { closedCaseCount: 1, fullyRealizedCount: 1, partiallyRealizedCount: 0, notRealizedCount: 0 },
    });
    const response = await request(createApp())
      .get('/api/vnext/results/roi/org/pir-outcomes')
      .query({ managerId: 'someone-elses-id' }); // deliberately supplied — must be ignored
    expect(response.status).toBe(200);
    expect(response.body.outcomes.cases).toHaveLength(1);
    expect(response.body.outcomes.portfolioTotals.fullyRealizedCount).toBe(1);
    expect(mockListOrganizationRoiPirOutcomes).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: 'user-actor', organizationId: 'org-1' })
    );
  });

  it('does NOT fall through to roi.routes.ts\'s /cases/:caseId family — mount-order regression guard', async () => {
    mockListOrganizationRoiPirOutcomes.mockResolvedValue({
      cases: [],
      portfolioTotals: { closedCaseCount: 0, fullyRealizedCount: 0, partiallyRealizedCount: 0, notRealizedCount: 0 },
    });
    const response = await request(createApp()).get('/api/vnext/results/roi/org/pir-outcomes');
    expect(response.status).toBe(200);
    expect(mockGetRoiCase).not.toHaveBeenCalled();
    expect(mockListOrganizationRoiPirOutcomes).toHaveBeenCalledTimes(1);
  });
});
