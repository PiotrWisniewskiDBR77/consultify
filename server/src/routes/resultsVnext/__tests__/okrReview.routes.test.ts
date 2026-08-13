/** @vitest-environment node */

/**
 * OKR-E007 API layer — route contract tests for the 11 new Review &
 * Learning endpoints on `okr.routes.ts` (design §6).
 *
 * Pattern precedent: `roiPir.routes.test.ts` (ROI-E006, the closest
 * structural sibling) — supertest against a minimal Express app,
 * middleware replaced with passthroughs, only the modules THIS epic's
 * routes touch are mocked (via `importOriginal` + spread, so specs/error
 * classes the router imports stay real). RBAC itself is covered elsewhere
 * (`okrRbacGuard.test.ts` against real middleware) — mocked to a
 * passthrough here so this file focuses purely on the HTTP boundary
 * `okr.routes.ts` itself owns: request validation, error->HTTP mapping,
 * and the "pre-fetch via getOkrSet/getObjective to 404 before invoking the
 * command" plumbing.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOkrSet = vi.fn();
const mockGetOkrSetApprovedSnapshot = vi.fn();
const mockListOkrSetApprovedSnapshots = vi.fn();
const mockListOkrSets = vi.fn();

const mockCloseOkrSet = vi.fn();
const mockRunOkrSetLifecycleTransition = vi.fn();

const mockGetObjective = vi.fn();

const mockFinalScoreOkrSet = vi.fn();
const mockRecordObjectiveReflection = vi.fn();

const mockSubmitOkrSetSelfReview = vi.fn();
const mockSubmitOkrSetForManagerReview = vi.fn();
const mockApproveOkrSetManagerReview = vi.fn();
const mockRequestChangesOnOkrSetManagerReview = vi.fn();
const mockRecordOkrSetReviewComment = vi.fn();
const mockListOkrSetReviews = vi.fn();

const mockCarryForwardOkrSet = vi.fn();
const mockGetOkrSetHistory = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-actor', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: (..._roles: string[]) => (_req: any, _res: any, next: () => void) => next(),
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

vi.mock('../../../services/resultsVnext/okr/okrSetCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/okr/okrSetCommands.js')>();
  return {
    ...actual,
    closeOkrSet: (...args: unknown[]) => mockCloseOkrSet(...args),
    runOkrSetLifecycleTransition: (...args: unknown[]) => mockRunOkrSetLifecycleTransition(...args),
  };
});
vi.mock('../../../services/resultsVnext/okr/okrSetRepository.js', () => ({
  getOkrSet: (...args: unknown[]) => mockGetOkrSet(...args),
  listOkrSets: (...args: unknown[]) => mockListOkrSets(...args),
  listOkrSetApprovedSnapshots: (...args: unknown[]) => mockListOkrSetApprovedSnapshots(...args),
  getOkrSetApprovedSnapshot: (...args: unknown[]) => mockGetOkrSetApprovedSnapshot(...args),
}));
vi.mock('../../../services/resultsVnext/okr/okrObjectiveRepository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/okr/okrObjectiveRepository.js')>();
  return {
    ...actual,
    getObjective: (...args: unknown[]) => mockGetObjective(...args),
  };
});
vi.mock('../../../services/resultsVnext/okr/okrReflectionCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/okr/okrReflectionCommands.js')>();
  return {
    ...actual,
    finalScoreOkrSet: (...args: unknown[]) => mockFinalScoreOkrSet(...args),
    recordObjectiveReflection: (...args: unknown[]) => mockRecordObjectiveReflection(...args),
  };
});
vi.mock('../../../services/resultsVnext/okr/okrReviewCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/okr/okrReviewCommands.js')>();
  return {
    ...actual,
    submitOkrSetSelfReview: (...args: unknown[]) => mockSubmitOkrSetSelfReview(...args),
    submitOkrSetForManagerReview: (...args: unknown[]) => mockSubmitOkrSetForManagerReview(...args),
    approveOkrSetManagerReview: (...args: unknown[]) => mockApproveOkrSetManagerReview(...args),
    requestChangesOnOkrSetManagerReview: (...args: unknown[]) => mockRequestChangesOnOkrSetManagerReview(...args),
    recordOkrSetReviewComment: (...args: unknown[]) => mockRecordOkrSetReviewComment(...args),
    listOkrSetReviews: (...args: unknown[]) => mockListOkrSetReviews(...args),
  };
});
vi.mock('../../../services/resultsVnext/okr/okrCarryForwardCommands.js', () => ({
  carryForwardOkrSet: (...args: unknown[]) => mockCarryForwardOkrSet(...args),
}));
vi.mock('../../../services/resultsVnext/okr/okrSetHistoryRepository.js', () => ({
  getOkrSetHistory: (...args: unknown[]) => mockGetOkrSetHistory(...args),
}));

const { OkrSetValidationError } = await import('../../../services/resultsVnext/okr/okrSetCommands.js');
const {
  OkrManagerReviewSelfApprovalDeniedError,
  OkrSetManagerReviewRequiredError,
  OkrSetSelfReviewRequiredError,
} = await import('../../../services/resultsVnext/okr/okrReviewCommands.js');
const { OkrSetReflectionRequiredError } = await import('../../../services/resultsVnext/okr/okrReflectionCommands.js');
const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');

const okrRoutes = (await import('../okr.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/okr', okrRoutes);
  return app;
}

const SET_ID = '11111111-1111-4111-8111-111111111111';
const OBJECTIVE_ID = '22222222-2222-4222-8222-222222222222';

function setFixture(overrides: Record<string, unknown> = {}) {
  return {
    setId: SET_ID,
    organizationId: 'org-1',
    programId: 'program-1',
    cycleId: 'cycle-1',
    scopeType: 'individual',
    scopeId: 'user-1',
    ownerUserId: 'user-1',
    reviewerUserId: 'user-2',
    title: 'Set title',
    status: 'active',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-1',
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 3,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function reflectionFixture(overrides: Record<string, unknown> = {}) {
  return {
    reflectionId: 'refl-1',
    setId: SET_ID,
    objectiveId: OBJECTIVE_ID,
    organizationId: 'org-1',
    status: 'draft',
    finalScore: null,
    scoringModelUnsupported: false,
    finalScorePayload: null,
    scoringPolicyVersionId: null,
    scoredBy: null,
    scoredAt: null,
    whatWorked: null,
    whatDidNotWork: null,
    why: null,
    learning: null,
    nextCycleChange: null,
    disposition: null,
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

function reviewFixture(overrides: Record<string, unknown> = {}) {
  return {
    reviewId: 'review-1',
    setId: SET_ID,
    organizationId: 'org-1',
    reviewType: 'manager',
    reviewerUserId: 'user-2',
    status: 'submitted',
    outcome: null,
    comments: [],
    reviewedSetVersion: 3,
    submittedBy: 'user-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
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
// POST .../sets/:setId/open-review
// ==========================================

describe('POST .../sets/:setId/open-review', () => {
  it('200s on success (reuses runOkrSetLifecycleTransition with OKR_SET_OPEN_REVIEW_SPEC)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    mockRunOkrSetLifecycleTransition.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 4,
      result: setFixture({ status: 'review', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/open-review`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('review');
    expect(mockRunOkrSetLifecycleTransition).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'okr_set.review_opened' }),
      expect.objectContaining({ setId: SET_ID, expectedVersion: 3 })
    );
  });

  it('404s when the Set does not exist', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/open-review`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(mockRunOkrSetLifecycleTransition).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../sets/:setId/final-score
// ==========================================

describe('POST .../sets/:setId/final-score', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'review' }));
    mockFinalScoreOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 4,
      result: { set: setFixture({ status: 'review', rowVersion: 4 }), scoredObjectives: [{ objectiveId: OBJECTIVE_ID, finalScore: 0.5, scoringModelUnsupported: false }] },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/final-score`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.scoredObjectives).toHaveLength(1);
  });

  it('maps OkrSetValidationError(NOT_IN_REVIEW) to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    mockFinalScoreOkrSet.mockRejectedValue(
      new OkrSetValidationError('not in review', 'NOT_IN_REVIEW', { setId: SET_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/final-score`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_IN_REVIEW');
  });
});

// ==========================================
// POST .../objectives/:objectiveId/reflection
// ==========================================

describe('POST .../objectives/:objectiveId/reflection', () => {
  it('200s on success (create path, expectedVersion=0)', async () => {
    mockGetObjective.mockResolvedValue({ objectiveId: OBJECTIVE_ID, setId: SET_ID, keyResults: [] });
    mockRecordObjectiveReflection.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 1,
      result: reflectionFixture({ whatWorked: 'shipped early' }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/reflection`)
      .send({ setId: SET_ID, expectedVersion: 0, whatWorked: 'shipped early' });
    expect(response.status).toBe(200);
    expect(response.body.reflection.whatWorked).toBe('shipped early');
    expect(mockRecordObjectiveReflection).toHaveBeenCalledWith(
      expect.objectContaining({ objectiveId: OBJECTIVE_ID, setId: SET_ID, expectedVersion: 0 })
    );
  });

  it('404s when the Objective does not exist', async () => {
    mockGetObjective.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/reflection`)
      .send({ setId: SET_ID, expectedVersion: 0 });
    expect(response.status).toBe(404);
    expect(mockRecordObjectiveReflection).not.toHaveBeenCalled();
  });

  it('400s when setId is missing from the body', async () => {
    mockGetObjective.mockResolvedValue({ objectiveId: OBJECTIVE_ID, setId: SET_ID, keyResults: [] });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/reflection`)
      .send({ expectedVersion: 0 });
    expect(response.status).toBe(400);
    expect(mockRecordObjectiveReflection).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../sets/:setId/reviews/self/submit
// ==========================================

describe('POST .../sets/:setId/reviews/self/submit', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockSubmitOkrSetSelfReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 1,
      result: reviewFixture({ reviewType: 'self' }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/self/submit`)
      .send({ expectedVersion: 0 });
    expect(response.status).toBe(200);
    expect(response.body.review.reviewType).toBe('self');
  });
});

// ==========================================
// POST .../sets/:setId/reviews/manager/submit
// ==========================================

describe('POST .../sets/:setId/reviews/manager/submit', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockSubmitOkrSetForManagerReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 1,
      result: reviewFixture(),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/submit`)
      .send({ expectedVersion: 0 });
    expect(response.status).toBe(200);
    expect(response.body.review.status).toBe('submitted');
  });
});

// ==========================================
// POST .../sets/:setId/reviews/manager/approve
// ==========================================

describe('POST .../sets/:setId/reviews/manager/approve', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockApproveOkrSetManagerReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: 2,
      result: reviewFixture({ status: 'approved', decidedBy: 'user-2' }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/approve`)
      .send({ expectedVersion: 1, outcome: 'looks good' });
    expect(response.status).toBe(200);
    expect(response.body.review.status).toBe('approved');
  });

  it('maps OkrManagerReviewSelfApprovalDeniedError to 403 (D6 — never a SelfReviewDenied* class)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockApproveOkrSetManagerReview.mockRejectedValue(
      new OkrManagerReviewSelfApprovalDeniedError(SET_ID, 'user-1', 'owner_user_id')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/approve`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('MANAGER_REVIEW_SELF_APPROVAL_DENIED');
  });

  it('maps AtomicWriteConflictError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockApproveOkrSetManagerReview.mockRejectedValue(new AtomicWriteConflictError('stale', 'STALE_VERSION'));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/approve`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
  });
});

// ==========================================
// POST .../sets/:setId/reviews/manager/request-changes
// ==========================================

describe('POST .../sets/:setId/reviews/manager/request-changes', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockRequestChangesOnOkrSetManagerReview.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-7',
      resultingVersion: 2,
      result: reviewFixture({ status: 'changes_requested' }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/request-changes`)
      .send({ expectedVersion: 1, changeRequestNotes: 'needs more detail' });
    expect(response.status).toBe(200);
    expect(response.body.review.status).toBe('changes_requested');
  });
});

// ==========================================
// POST .../sets/:setId/reviews/:reviewType/comments
// ==========================================

describe('POST .../sets/:setId/reviews/:reviewType/comments', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockRecordOkrSetReviewComment.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-8',
      resultingVersion: 2,
      result: reviewFixture({ comments: [{ level: 'set', targetId: SET_ID, text: 'note', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'user-1' }] }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/manager/comments`)
      .send({ expectedVersion: 1, level: 'set', targetId: SET_ID, text: 'note' });
    expect(response.status).toBe(200);
    expect(response.body.review.comments).toHaveLength(1);
  });

  it('400s on an invalid reviewType param', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/reviews/bogus/comments`)
      .send({ expectedVersion: 1, level: 'set', targetId: SET_ID, text: 'note' });
    expect(response.status).toBe(400);
    expect(mockRecordOkrSetReviewComment).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../sets/:setId/reviews
// ==========================================

describe('GET .../sets/:setId/reviews', () => {
  it('200s with the list', async () => {
    mockListOkrSetReviews.mockResolvedValue([reviewFixture(), reviewFixture({ reviewType: 'self', reviewId: 'review-2' })]);
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/reviews`);
    expect(response.status).toBe(200);
    expect(response.body.reviews).toHaveLength(2);
  });
});

// ==========================================
// POST .../sets/:setId/close
// ==========================================

describe('POST .../sets/:setId/close', () => {
  it('200s on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'review' }));
    mockCloseOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-9',
      resultingVersion: 4,
      result: { set: setFixture({ status: 'closed', rowVersion: 4 }) },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('closed');
  });

  it('maps OkrSetManagerReviewRequiredError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'review' }));
    mockCloseOkrSet.mockRejectedValue(new OkrSetManagerReviewRequiredError(SET_ID));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('MANAGER_REVIEW_REQUIRED');
  });

  it('maps OkrSetSelfReviewRequiredError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'review' }));
    mockCloseOkrSet.mockRejectedValue(new OkrSetSelfReviewRequiredError(SET_ID));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SELF_REVIEW_REQUIRED');
  });

  it('maps OkrSetReflectionRequiredError to 409, carrying missingObjectiveIds', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'review' }));
    mockCloseOkrSet.mockRejectedValue(new OkrSetReflectionRequiredError(SET_ID, [OBJECTIVE_ID]));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('REFLECTION_REQUIRED');
    expect(response.body.missingObjectiveIds).toEqual([OBJECTIVE_ID]);
  });

  it('404s when the Set does not exist', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/close`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(mockCloseOkrSet).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../sets/:setId/carry-forward
// ==========================================

describe('POST .../sets/:setId/carry-forward', () => {
  it('201s when a new carried Set was created', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'closed' }));
    mockCarryForwardOkrSet.mockResolvedValue({
      sourceSet: setFixture({ status: 'closed' }),
      carriedSet: setFixture({ setId: 'carried-set-1', status: 'draft', cycleId: '33333333-3333-4333-8333-333333333333', carriedFromSetId: SET_ID }),
      created: true,
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/carry-forward`)
      .send({ targetCycleId: '33333333-3333-4333-8333-333333333333' });
    expect(response.status).toBe(201);
    expect(response.body.carriedSet.carriedFromSetId).toBe(SET_ID);
    expect(response.body.created).toBe(true);
  });

  it('200s when dedupe reused an existing carried Set (created=false)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'closed' }));
    mockCarryForwardOkrSet.mockResolvedValue({
      sourceSet: setFixture({ status: 'closed' }),
      carriedSet: setFixture({ setId: 'carried-set-1', status: 'draft', cycleId: '33333333-3333-4333-8333-333333333333' }),
      created: false,
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/carry-forward`)
      .send({ targetCycleId: '33333333-3333-4333-8333-333333333333' });
    expect(response.status).toBe(200);
    expect(response.body.created).toBe(false);
  });

  it('maps OkrSetValidationError(SOURCE_NOT_CLOSED) to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    mockCarryForwardOkrSet.mockRejectedValue(
      new OkrSetValidationError('source not closed', 'SOURCE_NOT_CLOSED', { setId: SET_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/carry-forward`)
      .send({ targetCycleId: '33333333-3333-4333-8333-333333333333' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SOURCE_NOT_CLOSED');
  });

  it('404s when the Set does not exist', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/carry-forward`)
      .send({ targetCycleId: '33333333-3333-4333-8333-333333333333' });
    expect(response.status).toBe(404);
    expect(mockCarryForwardOkrSet).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../sets/:setId/history
// ==========================================

describe('GET .../sets/:setId/history', () => {
  it('200s with the merged entries + nextCursor', async () => {
    mockGetOkrSetHistory.mockResolvedValue({
      entries: [{ kind: 'event', eventId: 'evt-1', sequence: '1', eventType: 'okr_set.created', actorUserId: 'user-1', actorEffectiveRole: 'member', occurredAt: '2026-01-01T00:00:00.000Z', reason: null, payload: {} }],
      nextCursor: null,
    });
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/history`);
    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.nextCursor).toBeNull();
  });

  it('passes cursor/limit query params through', async () => {
    mockGetOkrSetHistory.mockResolvedValue({ entries: [], nextCursor: null });
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/history?cursor=42&limit=10`);
    expect(response.status).toBe(200);
    expect(mockGetOkrSetHistory).toHaveBeenCalledWith(
      expect.objectContaining({ setId: SET_ID, cursor: '42', limit: 10 })
    );
  });
});
