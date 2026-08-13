/** @vitest-environment node */

/**
 * ROI-E003 API layer — route contract tests for the 8 new Decision &
 * Approved endpoints (design §7).
 *
 * Pattern precedent: `roi.routes.test.ts` (ROI-E001) / `roiEconomicModel.
 * routes.test.ts` (ROI-E002) — supertest against a minimal Express app,
 * middleware (auth/rbac/demo/rate-limit) replaced with passthroughs, the
 * DOMAIN SERVICE layer mocked (not the whole DB). This file's job is the
 * HTTP boundary `roi.routes.ts` itself owns for the NEW routes: request
 * validation, error->HTTP mapping (including the NEW
 * `RoiSelfApprovalDeniedError -> 403` branch, checked FIRST), and the
 * "load the case first (includeArchived:true) to 404 before invoking the
 * command" plumbing every write route in this router already follows.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRoiCase = vi.fn();

const mockSubmitRoiCaseForApproval = vi.fn();
const mockApproveRoiCase = vi.fn();
const mockRejectRoiCase = vi.fn();
const mockRequestChangesOnRoiCase = vi.fn();
const mockReopenApprovedRoiCaseForRevision = vi.fn();
const mockReopenRejectedRoiCase = vi.fn();

const mockListRoiApprovalSnapshots = vi.fn();
const mockGetRoiApprovalSnapshot = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-approver', organizationId: 'org-1', role: 'admin' };
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
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCaseCommands.js')>();
  return {
    ...actual,
    reopenRejectedRoiCase: (...args: unknown[]) => mockReopenRejectedRoiCase(...args),
  };
});

vi.mock('../../../services/resultsVnext/roi/roiCaseApprovalCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCaseApprovalCommands.js')>();
  return {
    ...actual,
    submitRoiCaseForApproval: (...args: unknown[]) => mockSubmitRoiCaseForApproval(...args),
    approveRoiCase: (...args: unknown[]) => mockApproveRoiCase(...args),
    rejectRoiCase: (...args: unknown[]) => mockRejectRoiCase(...args),
    requestChangesOnRoiCase: (...args: unknown[]) => mockRequestChangesOnRoiCase(...args),
    reopenApprovedRoiCaseForRevision: (...args: unknown[]) => mockReopenApprovedRoiCaseForRevision(...args),
  };
});

vi.mock('../../../services/resultsVnext/roi/roiApprovalSnapshotRepository.js', () => ({
  listRoiApprovalSnapshots: (...args: unknown[]) => mockListRoiApprovalSnapshots(...args),
  getRoiApprovalSnapshot: (...args: unknown[]) => mockGetRoiApprovalSnapshot(...args),
}));

vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: vi.fn(),
  getRoiBaseline: vi.fn(),
}));

// RN-G5: every write route in this file now resolves an access context via
// resolveEffectiveAccess before calling its (mocked) command — mocked here
// so this suite never touches the real DB layer that function reads
// through (queryHelpers.js's getDatabase()). Defaults to the wildcard: this
// file tests the HTTP boundary (validation, error mapping, the
// getRoiCase-then-command plumbing), not authorization — the guard's own
// ALLOW/DENY logic has dedicated coverage in commandCapabilityGuard.test.ts
// and the RN-G5 real-Postgres security tests.
vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'], platformRole: null })),
  hasEffectiveCapability: (access: { capabilities: string[] }, capability: string) =>
    access.capabilities.includes('*') || access.capabilities.includes(capability),
}));

const { RoiSelfApprovalDeniedError } = await import('../../../services/resultsVnext/roi/roiCaseApprovalCommands.js');
const { RoiCaseValidationError, RoiCaseNotReadyForReviewError } = await import(
  '../../../services/resultsVnext/roi/roiCaseCommands.js'
);
const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');

const roiRoutes = (await import('../roi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = '33333333-3333-4333-8333-333333333333';

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
    decisionCalculationRunId: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
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

function snapshotSummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: SNAPSHOT_ID,
    caseId: CASE_ID,
    sequenceNumber: 1,
    approvedBy: 'user-approver',
    approvedAt: '2026-01-05T00:00:00.000Z',
    contentHash: 'abc123hash',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// POST .../transitions/submit-for-approval
// ==========================================

describe('POST .../transitions/submit-for-approval', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'ready_for_review' }));
    mockSubmitRoiCaseForApproval.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 2,
      result: caseFixture({ status: 'submitted_for_approval', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/submit-for-approval`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('submitted_for_approval');
  });

  it('maps RoiCaseNotReadyForReviewError to 409 (AC-01)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'ready_for_review' }));
    mockSubmitRoiCaseForApproval.mockRejectedValue(new RoiCaseNotReadyForReviewError(CASE_ID, 'calculation_run_stale'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/submit-for-approval`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_READY_FOR_REVIEW');
    expect(response.body.details.reason).toBe('calculation_run_stale');
  });

  it('404s when the case does not exist, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/submit-for-approval`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockSubmitRoiCaseForApproval).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../transitions/approve
// ==========================================

describe('POST .../transitions/approve', () => {
  it('200s on success — approver identity from auth.userId, not the body', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    mockApproveRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 3,
      result: { case: caseFixture({ status: 'approved', rowVersion: 3 }), snapshot: snapshotSummaryFixture() },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/approve`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('approved');
    expect(response.body.snapshot.snapshotId).toBe(SNAPSHOT_ID);
    expect(mockApproveRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, approverId: 'user-approver', expectedVersion: 2 })
    );
  });

  it('maps RoiSelfApprovalDeniedError to 403, checked FIRST ahead of the generic 409 branches', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    mockApproveRoiCase.mockRejectedValue(new RoiSelfApprovalDeniedError(CASE_ID, 'user-approver', 'submitted_by'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/approve`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_APPROVAL_DENIED');
    expect(response.body.details.reasonField).toBe('submitted_by');
  });

  it('maps STALE_VERSION to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    mockApproveRoiCase.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 2,
      })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/approve`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('404s when the case does not exist, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/approve`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockApproveRoiCase).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../transitions/reject
// ==========================================

describe('POST .../transitions/reject', () => {
  it('200s on success, rejectionReason required by the schema', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    mockRejectRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 3,
      result: caseFixture({ status: 'rejected', rowVersion: 3, rejectedBy: 'user-approver', rejectionReason: 'Numbers do not add up' }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reject`)
      .send({ expectedVersion: 2, rejectionReason: 'Numbers do not add up' });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('rejected');
    expect(mockRejectRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ rejectedBy: 'user-approver', rejectionReason: 'Numbers do not add up' })
    );
  });

  it('400s when rejectionReason is missing (Zod validation)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reject`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(400);
    expect(mockRejectRoiCase).not.toHaveBeenCalled();
  });

  it('maps RoiCaseValidationError (NOT_SUBMITTED_FOR_APPROVAL) to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'draft' }));
    mockRejectRoiCase.mockRejectedValue(
      new RoiCaseValidationError('ROI case is "draft" — only submitted may be rejected', 'NOT_SUBMITTED_FOR_APPROVAL', {
        caseId: CASE_ID,
        status: 'draft',
      })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reject`)
      .send({ expectedVersion: 1, rejectionReason: 'reason' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_SUBMITTED_FOR_APPROVAL');
  });
});

// ==========================================
// POST .../transitions/request-changes
// ==========================================

describe('POST .../transitions/request-changes', () => {
  it('200s on success, changeRequestNotes required by the schema', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    mockRequestChangesOnRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 3,
      result: caseFixture({
        status: 'changes_requested',
        rowVersion: 3,
        changesRequestedBy: 'user-approver',
        changesRequestedReason: 'Please re-verify',
      }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/request-changes`)
      .send({ expectedVersion: 2, changeRequestNotes: 'Please re-verify' });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('changes_requested');
    expect(mockRequestChangesOnRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'user-approver', changeRequestNotes: 'Please re-verify' })
    );
  });

  it('400s when changeRequestNotes is missing (Zod validation)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'submitted_for_approval' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/request-changes`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(400);
    expect(mockRequestChangesOnRoiCase).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../transitions/reopen-for-revision
// ==========================================

describe('POST .../transitions/reopen-for-revision', () => {
  it('200s on success, reason REQUIRED (unlike every other transition)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockReopenApprovedRoiCaseForRevision.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 4,
      result: caseFixture({ status: 'modeling', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reopen-for-revision`)
      .send({ expectedVersion: 3, reason: 'Baseline needs revision' });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('modeling');
  });

  it('400s when reason is missing (Zod validation — reason is required here, unlike other transitions)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reopen-for-revision`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(400);
    expect(mockReopenApprovedRoiCaseForRevision).not.toHaveBeenCalled();
  });

  it('maps RoiCaseValidationError (INVALID_ROI_CASE_STATUS_TRANSITION) to 409 when case is not approved', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    mockReopenApprovedRoiCaseForRevision.mockRejectedValue(
      new RoiCaseValidationError('only approved may be reopened', 'INVALID_ROI_CASE_STATUS_TRANSITION', {
        caseId: CASE_ID,
        currentStatus: 'tracking',
      })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reopen-for-revision`)
      .send({ expectedVersion: 5, reason: 'Trying anyway' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_ROI_CASE_STATUS_TRANSITION');
  });
});

// ==========================================
// POST .../transitions/reopen-after-rejection
// ==========================================

describe('POST .../transitions/reopen-after-rejection', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'rejected' }));
    mockReopenRejectedRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: 4,
      result: caseFixture({ status: 'modeling', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reopen-after-rejection`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('modeling');
  });

  it('404s when the case does not exist, without calling the command', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/reopen-after-rejection`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(mockReopenRejectedRoiCase).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../approval-snapshots ; GET .../approval-snapshots/:snapshotId
// ==========================================

describe('GET .../approval-snapshots', () => {
  it('200s with a list of summaries', async () => {
    mockListRoiApprovalSnapshots.mockResolvedValue([snapshotSummaryFixture()]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/approval-snapshots`);
    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0].snapshotId).toBe(SNAPSHOT_ID);
  });

  it('200s with an empty list when the reader can see nothing', async () => {
    mockListRoiApprovalSnapshots.mockResolvedValue([]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/approval-snapshots`);
    expect(response.status).toBe(200);
    expect(response.body.snapshots).toEqual([]);
  });
});

describe('GET .../approval-snapshots/:snapshotId', () => {
  it('200s with the full redacted detail', async () => {
    mockGetRoiApprovalSnapshot.mockResolvedValue({
      snapshotId: SNAPSHOT_ID,
      caseId: CASE_ID,
      sequenceNumber: 1,
      decisionCalculationRunId: 'run-1',
      approvedBy: 'user-approver',
      approvedAt: '2026-01-05T00:00:00.000Z',
      contentHash: 'abc123hash',
      createdAt: '2026-01-05T00:00:00.000Z',
      payload: { benefitEvidenceLinks: [{ kpiId: 'kpi-1', kpiDetails: null }] },
    });
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/approval-snapshots/${SNAPSHOT_ID}`
    );
    expect(response.status).toBe(200);
    expect(response.body.snapshot.snapshotId).toBe(SNAPSHOT_ID);
    expect(response.body.snapshot.contentHash).toBe('abc123hash');
  });

  it('404s when the snapshot is not found/visible — non-distinguishing between the two', async () => {
    mockGetRoiApprovalSnapshot.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/approval-snapshots/${SNAPSHOT_ID}`
    );
    expect(response.status).toBe(404);
  });

  it('400s on a malformed snapshotId (Zod uuid validation)', async () => {
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/approval-snapshots/not-a-uuid`);
    expect(response.status).toBe(400);
    expect(mockGetRoiApprovalSnapshot).not.toHaveBeenCalled();
  });
});
