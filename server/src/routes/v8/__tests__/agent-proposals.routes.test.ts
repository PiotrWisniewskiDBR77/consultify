import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProjection = vi.fn();
const reviewScope = vi.fn();
const rejectScope = vi.fn();
const requestRevision = vi.fn();
const reviseProposal = vi.fn();
const rebaselineProposal = vi.fn();

vi.mock('../../../services/v8/agentProposalGovernanceService.js', () => ({
  getGovernedProposalProjection: getProjection,
  reviewProposalScope: reviewScope,
  rejectProposalScope: rejectScope,
  requestProposalRevision: requestRevision,
  reviseGovernedProposal: reviseProposal,
  rebaselineGovernedProposal: rebaselineProposal,
}));

async function appFor(authenticated = true) {
  const { default: router } = await import('../agent-proposals.routes.js');
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      (req as any).v8Context = {
        organizationId: 'org-authenticated',
        userId: 'reviewer-authenticated',
        userRole: 'CONSULTANT',
        isSuperAdmin: false,
      };
      next();
    });
  }
  app.use('/api/v8/agent-proposals', router);
  return app;
}

describe('generic agent proposal governance routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails closed without authenticated V8 context', async () => {
    const response = await request(await appFor(false)).get('/api/v8/agent-proposals/pv-1');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(getProjection).not.toHaveBeenCalled();
  });

  it('reads only through the authenticated tenant projection', async () => {
    getProjection.mockResolvedValue({ proposalVersionId: 'pv-1', status: 'pending_review' });
    const response = await request(await appFor()).get('/api/v8/agent-proposals/pv-1');
    expect(response.status).toBe(200);
    expect(getProjection).toHaveBeenCalledWith({
      proposalVersionId: 'pv-1',
      organizationId: 'org-authenticated',
    });
  });

  it('does not disclose a cross-tenant proposal', async () => {
    getProjection.mockRejectedValue(new Error('governed_proposal_not_found'));
    const response = await request(await appFor()).get('/api/v8/agent-proposals/foreign-pv');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'GOVERNED_PROPOSAL_NOT_FOUND' });
  });

  it('uses authenticated tenant and actor for scope approval and ignores forged body identity', async () => {
    reviewScope.mockResolvedValue({ proposalVersionId: 'pv-1', status: 'partially_approved' });
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/scopes/finance/review')
      .send({
        decision: 'approved',
        reason: 'Financial owner approved',
        organizationId: 'org-attacker',
        actorUserId: 'attacker',
      });
    expect(response.status).toBe(200);
    expect(reviewScope).toHaveBeenCalledWith({
      proposalVersionId: 'pv-1',
      scopeKey: 'finance',
      decision: 'approved',
      reason: 'Financial owner approved',
      organizationId: 'org-authenticated',
      actorUserId: 'reviewer-authenticated',
    });
  });

  it.each([
    ['reject', rejectScope],
    ['request-revision', requestRevision],
  ])('exposes the explicit %s scope decision', async (path, service) => {
    service.mockResolvedValue({ proposalVersionId: 'pv-1' });
    const response = await request(await appFor())
      .post(`/api/v8/agent-proposals/pv-1/scopes/operations/${path}`)
      .send({ reason: 'Scope owner decision' });
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledWith({
      proposalVersionId: 'pv-1',
      scopeKey: 'operations',
      reason: 'Scope owner decision',
      organizationId: 'org-authenticated',
      actorUserId: 'reviewer-authenticated',
    });
  });

  it('maps reviewer authority denial to 403 without exposing internals', async () => {
    reviewScope.mockRejectedValue(new Error('proposal_reviewer_not_authorized'));
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/scopes/finance/review')
      .send({ decision: 'approved', reason: 'Attempt' });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: 'PROPOSAL_REVIEWER_NOT_AUTHORIZED' });
  });

  it('revises with authenticated identity and validates the payload', async () => {
    reviseProposal.mockResolvedValue({ proposalVersionId: 'pv-2', proposalVersion: 2 });
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/revise')
      .send({
        after: { amount: 42 },
        expiresAt,
        reason: 'Address reviewer feedback',
        organizationId: 'foreign',
      });
    expect(response.status).toBe(201);
    expect(reviseProposal).toHaveBeenCalledWith({
      proposalVersionId: 'pv-1',
      after: { amount: 42 },
      expiresAt,
      reason: 'Address reviewer feedback',
      organizationId: 'org-authenticated',
      actorUserId: 'reviewer-authenticated',
    });
  });

  it('rebaselines exact plan/context through the authenticated tenant', async () => {
    rebaselineProposal.mockResolvedValue({ proposalVersionId: 'pv-2', proposalVersion: 2 });
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/rebaseline')
      .send({
        planVersion: 4,
        contextDigest: 'digest-v4',
        expiresAt,
        reason: 'Plan v4 accepted',
      });
    expect(response.status).toBe(201);
    expect(rebaselineProposal).toHaveBeenCalledWith({
      proposalVersionId: 'pv-1',
      planVersion: 4,
      contextDigest: 'digest-v4',
      expiresAt,
      reason: 'Plan v4 accepted',
      organizationId: 'org-authenticated',
      actorUserId: 'reviewer-authenticated',
    });
  });

  it('rejects malformed decisions before the governance service', async () => {
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/scopes/finance/review')
      .send({ decision: 'execute', reason: '' });
    expect(response.status).toBe(400);
    expect(reviewScope).not.toHaveBeenCalled();
  });

  it('maps unknown failures to a stable fail-closed response', async () => {
    rebaselineProposal.mockRejectedValue(new Error('database connection details must not leak'));
    const response = await request(await appFor())
      .post('/api/v8/agent-proposals/pv-1/rebaseline')
      .send({
        planVersion: 2,
        contextDigest: 'digest-v2',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        reason: 'New baseline',
      });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'PROPOSAL_GOVERNANCE_FAILED' });
  });
});
