import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, transactionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
}));
vi.mock('../../../utils/queryHelpers.js', () => ({
  withPgTransaction: transactionMock,
}));

import {
  assertProposalExecutable,
  getGovernedProposalProjection,
  rebaselineGovernedProposal,
  registerGovernedProposal,
  requestProposalRevision,
  reviseGovernedProposal,
  reviewProposalScope,
  withProposalGovernanceClient,
} from '../agentProposalGovernanceService.js';

const future = () => new Date(Date.now() + 60_000).toISOString();
const proposalRow = (overrides: Record<string, unknown> = {}) => ({
  proposal_version_id: 'pv-1',
  proposal_id: 'proposal-1',
  organization_id: 'org-1',
  canonical_run_id: 'run-1',
  proposal_version: 1,
  plan_version: 7,
  context_digest: 'ctx-7',
  before_json: { status: 'draft' },
  after_json: { status: 'active' },
  approval_scopes_json: ['status', 'owner'],
  reviewer_authority_json: { status: ['reviewer-status'], owner: ['reviewer-owner'] },
  expires_at: future(),
  status: 'pending_review',
  ...overrides,
});

function configureDatabase(
  input: {
    proposal?: ReturnType<typeof proposalRow>;
    maxVersion?: number;
    reviews?: { approved: number; rejected: number; revision_requested: number };
  } = {}
) {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT * FROM v8_agent_proposal_versions'))
      return { rows: input.proposal ? [input.proposal] : [], rowCount: input.proposal ? 1 : 0 };
    if (sql.includes('MAX(proposal_version)'))
      return { rows: [{ max_version: input.maxVersion ?? 0 }], rowCount: 1 };
    if (sql.includes("COUNT(*) FILTER (WHERE decision='approved')"))
      return {
        rows: [input.reviews ?? { approved: 0, rejected: 0, revision_requested: 0 }],
        rowCount: 1,
      };
    return { rows: [], rowCount: 1 };
  });
}

describe('agentProposalGovernanceService', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockReset().mockImplementation(async (fn) => fn({ query: queryMock }));
    configureDatabase();
  });

  it('builds a tenant-scoped projection with reviews and audit lineage', async () => {
    const row = proposalRow();
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT * FROM v8_agent_proposal_versions')) {
        expect(params).toEqual(['pv-1', 'org-1']);
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM v8_agent_proposal_scope_reviews')) {
        expect(sql).toContain('p.organization_id=?');
        expect(params).toEqual(['pv-1', 'org-1']);
        return {
          rows: [
            {
              review_id: 'review-1',
              scope_key: 'status',
              decision: 'approved',
              reason: 'Accepted',
              reviewed_by_user_id: 'reviewer-status',
              reviewed_at: '2026-08-07T10:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM v8_agent_proposal_governance_events')) {
        expect(sql).toContain('organization_id=?');
        expect(params).toEqual(['pv-1', 'org-1']);
        return {
          rows: [
            {
              event_id: 'event-1',
              event_type: 'scope_approved',
              scope_key: 'status',
              actor_user_id: 'reviewer-status',
              reason: 'Accepted',
              detail_json: { decision: 'approved' },
              created_at: '2026-08-07T10:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const projection = await getGovernedProposalProjection({
      proposalVersionId: 'pv-1',
      organizationId: 'org-1',
    });
    expect(projection).toMatchObject({
      proposalVersionId: 'pv-1',
      proposalId: 'proposal-1',
      before: { status: 'draft' },
      after: { status: 'active' },
      reviews: [{ reviewId: 'review-1', scopeKey: 'status', decision: 'approved' }],
      events: [{ eventId: 'event-1', eventType: 'scope_approved' }],
    });
  });

  it('registers exact authority and serializes proposal versions on one pinned client', async () => {
    configureDatabase({ maxVersion: 1 });
    const result = await registerGovernedProposal({
      proposalId: 'proposal-1',
      organizationId: 'org-1',
      canonicalRunId: 'run-1',
      planVersion: 7,
      contextDigest: 'ctx-7',
      before: { status: 'draft' },
      after: { status: 'active' },
      approvalScopes: ['status', 'owner'],
      reviewerAuthorityByScope: {
        status: ['reviewer-status'],
        owner: ['reviewer-owner'],
      },
      expiresAt: future(),
      actorUserId: 'author-1',
    });
    expect(result.proposalVersion).toBe(2);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(
      queryMock.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO v8_agent_proposal_versions')
      )?.[1]
    ).toContain(JSON.stringify({ status: ['reviewer-status'], owner: ['reviewer-owner'] }));
  });

  it('propagates durable mutation failure instead of reporting registration success', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('MAX(proposal_version)')) return { rows: [{ max_version: 0 }], rowCount: 1 };
      if (sql.includes('INSERT INTO v8_agent_proposal_versions')) throw new Error('insert_failed');
      return { rows: [], rowCount: 1 };
    });
    await expect(
      registerGovernedProposal({
        proposalId: 'proposal-1',
        organizationId: 'org-1',
        canonicalRunId: 'run-1',
        planVersion: 7,
        contextDigest: 'ctx-7',
        before: { status: 'draft' },
        after: { status: 'active' },
        approvalScopes: ['status'],
        reviewerAuthorityByScope: { status: ['reviewer-status'] },
        expiresAt: future(),
        actorUserId: 'author-1',
      })
    ).rejects.toThrow('insert_failed');
  });

  it('fails closed when a reviewer lacks authority for the requested scope', async () => {
    configureDatabase({ proposal: proposalRow() });
    await expect(
      reviewProposalScope({
        proposalVersionId: 'pv-1',
        organizationId: 'org-1',
        scopeKey: 'status',
        decision: 'approved',
        reason: 'I reviewed it',
        actorUserId: 'reviewer-owner',
      })
    ).rejects.toThrow('proposal_reviewer_not_authorized');
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('scope_reviews'))).toBe(false);
  });

  it('supports partial approval and exact per-scope reviewer authority', async () => {
    configureDatabase({
      proposal: proposalRow(),
      reviews: { approved: 1, rejected: 0, revision_requested: 0 },
    });
    const partial = await reviewProposalScope({
      proposalVersionId: 'pv-1',
      organizationId: 'org-1',
      scopeKey: 'status',
      decision: 'approved',
      reason: 'Status reviewed',
      actorUserId: 'reviewer-status',
    });
    expect(partial.status).toBe('partially_approved');
    expect(queryMock.mock.calls.find(([sql]) => sql.includes('SET status=?'))?.[1]).toEqual([
      'partially_approved',
      expect.any(String),
      'pv-1',
      'org-1',
    ]);
  });

  it('distinguishes a revision request from terminal rejection', async () => {
    configureDatabase({
      proposal: proposalRow(),
      reviews: { approved: 0, rejected: 0, revision_requested: 1 },
    });
    expect(
      (
        await requestProposalRevision({
          proposalVersionId: 'pv-1',
          organizationId: 'org-1',
          scopeKey: 'owner',
          reason: 'Provide a named owner',
          actorUserId: 'reviewer-owner',
        })
      ).status
    ).toBe('revision_requested');
    expect(queryMock.mock.calls.some(([, params]) => params?.includes('revision_requested'))).toBe(
      true
    );
  });

  it('reuses a caller-owned pinned client without opening a nested transaction', async () => {
    configureDatabase({ maxVersion: 4 });
    const pinnedClient = { query: queryMock };
    const result = await withProposalGovernanceClient(pinnedClient, () =>
      registerGovernedProposal({
        proposalId: 'proposal-external-tx',
        organizationId: 'org-1',
        canonicalRunId: 'run-1',
        planVersion: 9,
        contextDigest: 'ctx-9',
        before: { status: 'draft' },
        after: { status: 'active' },
        approvalScopes: ['status'],
        reviewerAuthorityByScope: { status: ['reviewer-status'] },
        expiresAt: future(),
        actorUserId: 'author-1',
      })
    );
    expect(result.proposalVersion).toBe(5);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls.map(([sql]) => sql)).toEqual([
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.stringContaining('MAX(proposal_version)'),
      expect.stringContaining('INSERT INTO v8_agent_proposal_versions'),
      expect.stringContaining('INSERT INTO v8_agent_proposal_governance_events'),
    ]);
  });

  it('creates a clean new version after revision and supersedes atomically', async () => {
    configureDatabase({ proposal: proposalRow({ status: 'revision_requested' }), maxVersion: 1 });
    const revised = await reviseGovernedProposal({
      proposalVersionId: 'pv-1',
      organizationId: 'org-1',
      after: { status: 'active', owner: 'owner-1' },
      expiresAt: future(),
      actorUserId: 'author-1',
      reason: 'Named owner supplied',
    });
    expect(revised.proposalVersion).toBe(2);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls.some(([, params]) => params?.includes('revision'))).toBe(true);
    expect(queryMock.mock.calls.some(([sql]) => sql.includes("status='superseded'"))).toBe(true);
  });

  it('rebaselines only stale authority and resets approval for the new pair', async () => {
    configureDatabase({ proposal: proposalRow({ status: 'invalidated' }), maxVersion: 2 });
    const rebased = await rebaselineGovernedProposal({
      proposalVersionId: 'pv-1',
      organizationId: 'org-1',
      planVersion: 8,
      contextDigest: 'ctx-8',
      expiresAt: future(),
      actorUserId: 'author-1',
      reason: 'Plan and evidence changed',
    });
    expect(rebased).toMatchObject({ proposalVersion: 3, status: 'pending_review' });
    const insertParams = queryMock.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO v8_agent_proposal_versions')
    )?.[1];
    expect(insertParams).toEqual(expect.arrayContaining([8, 'ctx-8', 'rebaseline']));
  });

  it('invalidates approval on exact plan drift inside the same transaction', async () => {
    configureDatabase({ proposal: proposalRow({ status: 'approved' }) });
    expect(
      await assertProposalExecutable({
        proposalVersionId: 'pv-1',
        organizationId: 'org-1',
        planVersion: 8,
        contextDigest: 'ctx-7',
      })
    ).toEqual({ executable: false, status: 'invalidated', reason: 'plan_version_changed' });
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(
      queryMock.mock.calls.some(([, params]) => params?.includes('plan_version_changed'))
    ).toBe(true);
  });

  it.each(['revision_requested', 'rejected', 'invalidated'])(
    'keeps non-approved status %s non-executable when exact plan and context still match',
    async (status) => {
      configureDatabase({ proposal: proposalRow({ status }) });
      await expect(
        assertProposalExecutable({
          proposalVersionId: 'pv-1',
          organizationId: 'org-1',
          planVersion: 7,
          contextDigest: 'ctx-7',
        })
      ).resolves.toEqual({ executable: false, status, reason: `proposal_${status}` });
    }
  );
});
