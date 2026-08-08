import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const db = {
  all(sql: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) {
    void pool.query(adaptQuery(sql), params).then((r) => cb(null, r.rows), (error) => cb(error as Error, []));
  },
  get(sql: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) {
    void pool.query(adaptQuery(sql), params).then((r) => cb(null, r.rows[0] ?? null), (error) => cb(error as Error, null));
  },
  run(sql: string, params: unknown[], cb: (error: Error | null) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (r) => cb.call({ changes: r.rowCount ?? 0 }, null),
      (e) => cb.call({ changes: 0 }, e)
    );
  },
  serialize(cb: () => void) {
    cb();
  },
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;

const future = () => new Date(Date.now() + 60_000).toISOString();

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_agent_proposal_governance.sql', import.meta.url),
        'utf8'
      )
    )
  );
  const service = await import('../services/v8/agentProposalGovernanceService.js');
  const initial = await service.registerGovernedProposal({
    proposalId: 'proposal-a05',
    organizationId: 'org-a05',
    canonicalRunId: 'run-a05',
    planVersion: 3,
    contextDigest: 'ctx-a05-v1',
    before: { status: 'draft', owner: null },
    after: { status: 'active', owner: 'temporary-owner' },
    approvalScopes: ['status', 'owner'],
    reviewerAuthorityByScope: {
      status: ['reviewer-status-a05'],
      owner: ['reviewer-owner-a05'],
    },
    expiresAt: future(),
    actorUserId: 'author-a05',
  });

  await assert.rejects(
    () =>
      service.assertProposalExecutable({
        proposalVersionId: initial.proposalVersionId,
        organizationId: 'org-other',
        planVersion: 3,
        contextDigest: 'ctx-a05-v1',
      }),
    /governed_proposal_not_found/
  );
  await assert.rejects(
    () =>
      service.reviewProposalScope({
        proposalVersionId: initial.proposalVersionId,
        organizationId: 'org-a05',
        scopeKey: 'owner',
        decision: 'approved',
        reason: 'Attempt outside assigned scope',
        actorUserId: 'reviewer-status-a05',
      }),
    /proposal_reviewer_not_authorized/
  );

  const revisionRequested = await service.requestProposalRevision({
    proposalVersionId: initial.proposalVersionId,
    organizationId: 'org-a05',
    scopeKey: 'owner',
    reason: 'Replace temporary owner with the accountable owner',
    actorUserId: 'reviewer-owner-a05',
  });
  assert.equal(revisionRequested.status, 'revision_requested');
  const revised = await service.reviseGovernedProposal({
    proposalVersionId: initial.proposalVersionId,
    organizationId: 'org-a05',
    after: { status: 'active', owner: 'owner-a05' },
    expiresAt: future(),
    actorUserId: 'author-a05',
    reason: 'Accountable owner supplied',
  });
  assert.equal(revised.proposalVersion, 2);

  const partial = await service.reviewProposalScope({
    proposalVersionId: revised.proposalVersionId,
    organizationId: 'org-a05',
    scopeKey: 'status',
    decision: 'approved',
    reason: 'Status transition reviewed',
    actorUserId: 'reviewer-status-a05',
  });
  assert.equal(partial.status, 'partially_approved');
  const approved = await service.reviewProposalScope({
    proposalVersionId: revised.proposalVersionId,
    organizationId: 'org-a05',
    scopeKey: 'owner',
    decision: 'approved',
    reason: 'Owner assignment reviewed',
    actorUserId: 'reviewer-owner-a05',
  });
  assert.equal(approved.status, 'approved');
  assert.deepEqual(
    await service.assertProposalExecutable({
      proposalVersionId: revised.proposalVersionId,
      organizationId: 'org-a05',
      planVersion: 3,
      contextDigest: 'ctx-a05-v1',
    }),
    { executable: true, status: 'approved', reason: null }
  );

  const invalidated = await service.assertProposalExecutable({
    proposalVersionId: revised.proposalVersionId,
    organizationId: 'org-a05',
    planVersion: 4,
    contextDigest: 'ctx-a05-v2',
  });
  assert.deepEqual(invalidated, {
    executable: false,
    status: 'invalidated',
    reason: 'plan_version_changed',
  });
  const rebased = await service.rebaselineGovernedProposal({
    proposalVersionId: revised.proposalVersionId,
    organizationId: 'org-a05',
    planVersion: 4,
    contextDigest: 'ctx-a05-v2',
    expiresAt: future(),
    actorUserId: 'author-a05',
    reason: 'Rebaseline after accepted plan and evidence update',
  });
  assert.equal(rebased.proposalVersion, 3);
  assert.deepEqual(
    await service.assertProposalExecutable({
      proposalVersionId: rebased.proposalVersionId,
      organizationId: 'org-a05',
      planVersion: 4,
      contextDigest: 'ctx-a05-v2',
    }),
    { executable: false, status: 'pending_review', reason: 'proposal_pending_review' }
  );

  const rejectedProposal = await service.registerGovernedProposal({
    proposalId: 'proposal-a05-reject',
    organizationId: 'org-a05',
    canonicalRunId: 'run-a05',
    planVersion: 4,
    contextDigest: 'ctx-a05-v2',
    before: { budget: 100 },
    after: { budget: 500 },
    approvalScopes: ['budget'],
    reviewerAuthorityByScope: { budget: ['reviewer-budget-a05'] },
    expiresAt: future(),
    actorUserId: 'author-a05',
  });
  const rejected = await service.rejectProposalScope({
    proposalVersionId: rejectedProposal.proposalVersionId,
    organizationId: 'org-a05',
    scopeKey: 'budget',
    reason: 'Budget evidence is insufficient',
    actorUserId: 'reviewer-budget-a05',
  });
  assert.equal(rejected.status, 'rejected');

  const versions = await pool.query(
    `SELECT proposal_version, status, revision_kind, supersedes_proposal_version_id,
            reviewer_authority_json, before_json, after_json
       FROM v8_agent_proposal_versions
      WHERE proposal_id='proposal-a05' ORDER BY proposal_version`
  );
  assert.equal(versions.rows.length, 3);
  assert.deepEqual(
    versions.rows.map((row) => row.status),
    ['superseded', 'superseded', 'pending_review']
  );
  assert.deepEqual(
    versions.rows.map((row) => row.revision_kind),
    ['initial', 'revision', 'rebaseline']
  );
  assert.equal(versions.rows[1].after_json.owner, 'owner-a05');
  assert.deepEqual(versions.rows[2].reviewer_authority_json.owner, ['reviewer-owner-a05']);
  const eventRows = await pool.query(
    `SELECT event_type FROM v8_agent_proposal_governance_events
      WHERE organization_id='org-a05' ORDER BY created_at, event_id`
  );
  const eventTypes = eventRows.rows.map((row) => row.event_type);
  for (const required of [
    'registered',
    'revision_requested',
    'revised',
    'scope_approved',
    'invalidated',
    'rebaselined',
    'scope_rejected',
  ]) {
    assert.ok(eventTypes.includes(required), `missing governance event ${required}`);
  }

  console.log(
    JSON.stringify({
      proof: 'A05_REALDB_GREEN',
      beforeAfter: true,
      tenantIsolationFailClosed: true,
      reviewerAuthorityPerScope: true,
      unauthorizedReviewDenied: true,
      partialApproval: true,
      reject: true,
      requestRevisionAndRevise: true,
      exactVersionExecutable: true,
      planChangeInvalidated: true,
      rebaselineResetsApproval: true,
      durableVersions: versions.rows.length,
      durableGovernanceEvents: eventRows.rows.length,
    })
  );
}

main().finally(() => pool.end());
