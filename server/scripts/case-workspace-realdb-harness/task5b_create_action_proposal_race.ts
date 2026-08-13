#!/usr/bin/env tsx
/**
 * Case Workspace real-DB harness — Task 5(b).
 *
 * Fires two GENUINELY CONCURRENT (Promise.all, same tick) createActionProposal()
 * calls (server/src/services/caseWorkspace/proposalApprovalService.ts) with an
 * IDENTICAL idempotencyKey (same case, same payloadDigest) against a REAL
 * Postgres, and asserts exactly one case_workspace_action_proposals row lands
 * and both calls return the identical actionProposalId.
 *
 * REQUIRED environment (same gate as caseCoreService.pg.test.ts's own header):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *     npx tsx server/scripts/case-workspace-realdb-harness/task5b_create_action_proposal_race.ts
 */
import { randomUUID } from 'node:crypto';

import {
  makeControlPool,
  seedOrgAndProject,
  seedMemberedUser,
  seedCaseCore,
  seedExecutionRun,
  teardownAll,
} from './harnessFixtures.js';

async function main() {
  if (process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false') {
    console.error('Refusing to run: requires RUN_DB_TESTS=1 and MOCK_DB=false (real Postgres, not the mock).');
    process.exit(1);
  }

  const { createActionProposal } = await import(
    '../../src/services/caseWorkspace/proposalApprovalService.js'
  );

  const pool = makeControlPool();
  let orgId = '';
  let projectId = '';
  let userId = '';
  let caseId = '';
  let runId = '';

  try {
    const fixture = await seedOrgAndProject(pool, 'task5b');
    orgId = fixture.orgId;
    projectId = fixture.projectId;
    userId = await seedMemberedUser(pool, orgId, 'task5b');
    caseId = await seedCaseCore(pool, fixture, userId, 'task5b');
    runId = await seedExecutionRun(pool, orgId, userId, 'task5b');

    const idempotencyKey = `task5b-idem-${randomUUID()}`;
    const payloadDigest = `sha256:task5b-digest-${randomUUID()}`;
    const nodeRunId = `cwharness-noderun-task5b-${randomUUID()}`;

    const input = {
      caseId,
      runId,
      nodeRunId,
      payloadDigest,
      policySnapshotRef: 'harness://policy-snapshot/task5b',
      previewRef: 'harness://preview/task5b',
      effectClass: 'SAFE_ADDITIVE' as const,
      proposerType: 'AGENT' as const,
      createdByActorId: userId,
      idempotencyKey,
    };

    console.log(`Fixture ready: orgId=${orgId} caseId=${caseId} runId=${runId} idempotencyKey=${idempotencyKey}`);
    console.log('Firing two concurrent createActionProposal() calls via Promise.all (identical idempotencyKey+payloadDigest)...');

    const [resultA, resultB] = await Promise.all([
      createActionProposal(input),
      createActionProposal(input),
    ]);

    console.log('Result A actionProposalId:', resultA.actionProposalId);
    console.log('Result B actionProposalId:', resultB.actionProposalId);

    const sameResult = resultA.actionProposalId === resultB.actionProposalId;

    // Independently verify against the live table (not just trusting the
    // function's return values): exactly one row for (case_id, idempotency_key).
    const rowsRes = await pool.query(
      `SELECT action_proposal_id, payload_digest FROM case_workspace_action_proposals
        WHERE case_id = $1 AND idempotency_key = $2`,
      [caseId, idempotencyKey]
    );
    console.log('Live rows for (case_id, idempotency_key):', JSON.stringify(rowsRes.rows));
    const exactlyOneRow = rowsRes.rows.length === 1;
    const rowMatchesReturnedId = rowsRes.rows[0]?.action_proposal_id === resultA.actionProposalId;

    const pass = sameResult && exactlyOneRow && rowMatchesReturnedId;
    console.log(`sameResult=${sameResult} exactlyOneRow=${exactlyOneRow} rowMatchesReturnedId=${rowMatchesReturnedId}`);
    console.log(pass ? 'Task 5(b): PASS — exactly one case_workspace_action_proposals row landed, both concurrent calls returned the same result.' : 'Task 5(b): FAIL — see rows above.');
    process.exitCode = pass ? 0 : 1;
  } finally {
    await teardownAll(pool, {
      orgIds: [orgId],
      projectIds: [projectId],
      userIds: [userId],
      caseIds: [caseId],
      runIds: [runId],
    });
    await pool.end();
    console.log('Fixture torn down.');
  }
}

main().catch((err) => {
  console.error('task5b_create_action_proposal_race.ts CRASHED:', err);
  process.exit(1);
});
