import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockCreateActionProposal = vi.fn();
const mockGetActionProposal = vi.fn();
const mockRecordApprovalDecision = vi.fn();
const mockListActionProposalsForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/proposalApprovalService.js', () => ({
  createActionProposal: (...args: unknown[]) => mockCreateActionProposal(...args),
  submitActionProposalForReview: vi.fn(),
  recordApprovalDecision: (...args: unknown[]) => mockRecordApprovalDecision(...args),
  transitionProposalToExecuting: vi.fn(),
  transitionProposalToExecuted: vi.fn(),
  transitionProposalToFailed: vi.fn(),
  retryProposalFromFailed: vi.fn(),
  markProposalAudited: vi.fn(),
  revokeApprovedProposal: vi.fn(),
  getActionProposal: (...args: unknown[]) => mockGetActionProposal(...args),
  listActionProposalsForCase: (...args: unknown[]) => mockListActionProposalsForCase(...args),
  listActionProposalsForRun: vi.fn(),
  listDecisionsForProposal: vi.fn(),
}));

import actionProposalsRoutes from '../actionProposals.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

const VALID_PROPOSAL_BODY = {
  runId: 'run-1',
  nodeRunId: 'node-1',
  payloadDigest: 'sha256:abc',
  policySnapshotRef: 'policy-1',
  effectClass: 'SAFE_ADDITIVE',
  previewRef: 'preview-1',
  proposerType: 'HUMAN',
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', actionProposalsRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace action-proposal routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('requires an Idempotency-Key (header or body) to create a proposal', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/proposals')
      .send(VALID_PROPOSAL_BODY);
    expect(res.status).toBe(400);
    expect(mockCreateActionProposal).not.toHaveBeenCalled();
  });

  it('threads an Idempotency-Key header into createActionProposal.idempotencyKey', async () => {
    mockCreateActionProposal.mockResolvedValue({ actionProposalId: 'cwprop-1', caseId: 'case-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/proposals')
      .set('Idempotency-Key', 'idem-1')
      .send(VALID_PROPOSAL_BODY);
    expect(res.status).toBe(201);
    expect(mockCreateActionProposal).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'idem-1', caseId: 'case-1', createdByActorId: USER })
    );
  });

  it('rejects an invalid effectClass with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/proposals')
      .set('Idempotency-Key', 'idem-1')
      .send({ ...VALID_PROPOSAL_BODY, effectClass: 'NOT_A_CLASS' });
    expect(res.status).toBe(400);
  });

  it('resolves the owning caseId via getActionProposal before authorizing a decision, and 404s when missing', async () => {
    mockGetActionProposal.mockResolvedValue(null);
    const res = await request(createApp())
      .post('/api/v8/case-workspace/proposals/cwprop-missing/decision')
      .set('Idempotency-Key', 'idem-2')
      .send({
        proposalVersion: 1,
        payloadDigest: 'sha256:abc',
        decision: 'APPROVE',
        source: 'BUTTON',
        authenticationAssurance: 'mfa',
        approvalChannelPolicy: 'standard',
        policyVersion: 'v1',
        expectedVersion: 1,
      });
    expect(res.status).toBe(404);
    expect(mockRecordApprovalDecision).not.toHaveBeenCalled();
  });

  it('maps self_approval_forbidden to 403', async () => {
    mockGetActionProposal.mockResolvedValue({ actionProposalId: 'cwprop-1', caseId: 'case-1' });
    mockRecordApprovalDecision.mockRejectedValue(new Error('self_approval_forbidden'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/proposals/cwprop-1/decision')
      .set('Idempotency-Key', 'idem-3')
      .send({
        proposalVersion: 1,
        payloadDigest: 'sha256:abc',
        decision: 'APPROVE',
        source: 'BUTTON',
        authenticationAssurance: 'mfa',
        approvalChannelPolicy: 'standard',
        policyVersion: 'v1',
        expectedVersion: 1,
      });
    expect(res.status).toBe(403);
  });

  it('maps proposal_stale to 409', async () => {
    mockGetActionProposal.mockResolvedValue({ actionProposalId: 'cwprop-1', caseId: 'case-1' });
    mockRecordApprovalDecision.mockRejectedValue(new Error('proposal_stale'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/proposals/cwprop-1/decision')
      .set('Idempotency-Key', 'idem-4')
      .send({
        proposalVersion: 1,
        payloadDigest: 'sha256:abc',
        decision: 'APPROVE',
        source: 'BUTTON',
        authenticationAssurance: 'mfa',
        approvalChannelPolicy: 'standard',
        policyVersion: 'v1',
        expectedVersion: 1,
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROPOSAL_STALE');
  });

  it('checks case access before listing proposals for a case', async () => {
    mockListActionProposalsForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/proposals');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
