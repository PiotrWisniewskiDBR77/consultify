/**
 * Artifact Approval Routes (HP-7) — integration tests.
 *
 * Mocks auth.middleware.js (per-request org/user via headers, same pattern as
 * tests/integration/routes/organization-context.routes.test.ts) and the real
 * artifactApprovalService.ts module (not the DB) to prove the ROUTING layer:
 * org scoping, actor identity from req.user (never the body), status-code
 * mapping (service `.status` -> HTTP status, since the shared errorHandler
 * only understands `.statusCode`), and the submit->review->approve/reject
 * cycle end to end through supertest.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getArtifactApprovalStatus = vi.fn();
const submitForReview = vi.fn();
const acknowledgeReview = vi.fn();
const approveArtifact = vi.fn();
const rejectArtifact = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual('../../../server/src/middleware/auth.middleware.js')) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      const orgId = req.headers['x-test-org'] || 'org-1';
      const userId = req.headers['x-test-user'] || 'user-1';
      const role = req.headers['x-test-role'] || 'member';
      req.user = { id: userId, organizationId: orgId, role };
      req.userId = userId;
      req.organizationId = orgId;
      next();
    },
  };
});

vi.mock('../../../server/src/services/artifactApprovalService.js', () => ({
  default: {
    ARTIFACT_STATES: {
      DRAFT: 'draft',
      REVIEW: 'review',
      APPROVED: 'approved',
      REJECTED: 'rejected',
    },
    getArtifactApprovalStatus: (...args: any[]) => getArtifactApprovalStatus(...args),
    submitForReview: (...args: any[]) => submitForReview(...args),
    acknowledgeReview: (...args: any[]) => acknowledgeReview(...args),
    approveArtifact: (...args: any[]) => approveArtifact(...args),
    rejectArtifact: (...args: any[]) => rejectArtifact(...args),
  },
}));

const { default: artifactApprovalsRouter } = await import(
  '../../../server/src/routes/artifactApprovals.routes.ts'
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-approvals', artifactApprovalsRouter);
  return app;
}

function makeError(message: string, status: number) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

describe('Artifact approval routes (HP-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // GET .../approval-state
  // ==========================================

  it('reads approval state org-scoped from req.user, not from params/body', async () => {
    getArtifactApprovalStatus.mockResolvedValue({ state: 'draft', assignment: null });

    const res = await request(makeApp())
      .get('/api/artifact-approvals/insight/insight-1/approval-state')
      .set('x-test-org', 'org-42');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'draft', assignment: null });
    expect(getArtifactApprovalStatus).toHaveBeenCalledWith('org-42', 'insight', 'insight-1');
  });

  // ==========================================
  // Full lifecycle: submit -> review -> approve -> approved
  // ==========================================

  it('drives submit -> review -> approve -> approved end to end', async () => {
    const app = makeApp();

    submitForReview.mockResolvedValue({
      id: 'assign-1',
      status: 'PENDING',
      assignment_kind: 'artifact',
      artifact_type: 'decision',
      artifact_id: 'decision-1',
    });

    const submitRes = await request(app)
      .post('/api/artifact-approvals/decision/decision-1/approval/submit')
      .set('x-test-user', 'author-1')
      .send({ assignedToUserId: 'reviewer-1' });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.state).toBe('review');
    expect(submitForReview).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        artifactType: 'decision',
        artifactId: 'decision-1',
        assignedToUserId: 'reviewer-1',
        submittedBy: 'author-1', // actor identity from req.user, not body
      })
    );

    approveArtifact.mockResolvedValue({
      id: 'assign-1',
      status: 'DONE',
      assignment_kind: 'artifact',
      artifact_type: 'decision',
      artifact_id: 'decision-1',
    });

    const approveRes = await request(app)
      .post('/api/artifact-approvals/decision/decision-1/approval/approve')
      .set('x-test-user', 'reviewer-1');

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.state).toBe('approved');
    expect(approveArtifact).toHaveBeenCalledWith({
      orgId: 'org-1',
      artifactType: 'decision',
      artifactId: 'decision-1',
      approvedByUserId: 'reviewer-1', // approver = req.user.id, never body-supplied
    });
  });

  // ==========================================
  // reject -> resubmit
  // ==========================================

  it('rejects then allows resubmission (reject does not permanently block the artifact)', async () => {
    const app = makeApp();

    rejectArtifact.mockResolvedValue({
      id: 'assign-1',
      status: 'REJECTED',
      assignment_kind: 'artifact',
      artifact_type: 'deck',
      artifact_id: 'deck-1',
    });

    const rejectRes = await request(app)
      .post('/api/artifact-approvals/deck/deck-1/approval/reject')
      .set('x-test-user', 'reviewer-1')
      .send({ reason: 'Missing evidence' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.state).toBe('rejected');
    expect(rejectArtifact).toHaveBeenCalledWith({
      orgId: 'org-1',
      artifactType: 'deck',
      artifactId: 'deck-1',
      rejectedByUserId: 'reviewer-1',
      reason: 'Missing evidence',
    });

    submitForReview.mockResolvedValue({
      id: 'assign-2',
      status: 'PENDING',
      assignment_kind: 'artifact',
      artifact_type: 'deck',
      artifact_id: 'deck-1',
    });

    const resubmitRes = await request(app)
      .post('/api/artifact-approvals/deck/deck-1/approval/submit')
      .set('x-test-user', 'author-1')
      .send({ assignedToUserId: 'reviewer-2' });

    expect(resubmitRes.status).toBe(201);
    expect(resubmitRes.body.state).toBe('review');
  });

  // ==========================================
  // Cross-org isolation
  // ==========================================

  it('scopes every call by the caller org, never a client-supplied org', async () => {
    getArtifactApprovalStatus.mockResolvedValue({ state: 'draft', assignment: null });

    await request(makeApp())
      .get('/api/artifact-approvals/insight/shared-artifact-id/approval-state')
      .set('x-test-org', 'org-a');
    expect(getArtifactApprovalStatus).toHaveBeenLastCalledWith(
      'org-a',
      'insight',
      'shared-artifact-id'
    );

    await request(makeApp())
      .get('/api/artifact-approvals/insight/shared-artifact-id/approval-state')
      .set('x-test-org', 'org-b');
    expect(getArtifactApprovalStatus).toHaveBeenLastCalledWith(
      'org-b',
      'insight',
      'shared-artifact-id'
    );

    // The route never reads an org id from the request body/query — only
    // from req.user (set by verifyToken from the token's own org claim) —
    // so a client cannot widen its own scope by passing a different org.
    submitForReview.mockResolvedValue({
      id: 'assign-x',
      status: 'PENDING',
      assignment_kind: 'artifact',
      artifact_type: 'insight',
      artifact_id: 'shared-artifact-id',
    });
    await request(makeApp())
      .post('/api/artifact-approvals/insight/shared-artifact-id/approval/submit')
      .set('x-test-org', 'org-a')
      .send({ assignedToUserId: 'reviewer-1', orgId: 'org-b' });
    expect(submitForReview).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-a' })
    );
  });

  // ==========================================
  // Error mapping: service `.status` -> HTTP status (not the generic 500 the
  // shared errorHandler would produce, since it only reads `.statusCode`)
  // ==========================================

  it('maps a 409 from submitForReview (active review already exists) to HTTP 409', async () => {
    submitForReview.mockRejectedValue(makeError('Artifact already has an active review', 409));

    const res = await request(makeApp())
      .post('/api/artifact-approvals/insight/insight-1/approval/submit')
      .send({ assignedToUserId: 'reviewer-1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/active review/i);
  });

  it('maps a 404 from approveArtifact (no active review) to HTTP 404', async () => {
    approveArtifact.mockRejectedValue(makeError('No active review found for this artifact', 404));

    const res = await request(makeApp()).post(
      '/api/artifact-approvals/insight/insight-1/approval/approve'
    );

    expect(res.status).toBe(404);
  });

  it('400s submit when assignedToUserId is missing from the body', async () => {
    const res = await request(makeApp())
      .post('/api/artifact-approvals/insight/insight-1/approval/submit')
      .send({});

    expect(res.status).toBe(400);
    expect(submitForReview).not.toHaveBeenCalled();
  });
});
