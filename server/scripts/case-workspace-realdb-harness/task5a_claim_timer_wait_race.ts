#!/usr/bin/env tsx
/**
 * Case Workspace real-DB harness — Task 5(a).
 *
 * Fires two GENUINELY CONCURRENT (Promise.all, same tick) claimTimerWait()
 * calls (server/src/services/caseWorkspace/waitSubscriptionService.ts)
 * against the SAME wait row, against a REAL Postgres (not a mock/simulated
 * race) — and asserts exactly one succeeds ('claimed') while the other
 * observes 'active_elsewhere'.
 *
 * REQUIRED environment (same gate as server/src/services/caseWorkspace/
 * __tests__/caseCoreService.pg.test.ts's own header):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *     npx tsx server/scripts/case-workspace-realdb-harness/task5a_claim_timer_wait_race.ts
 */
import { randomUUID } from 'node:crypto';

import { makeControlPool, seedOrgAndProject, seedMemberedUser, seedCaseCore, teardownAll } from './harnessFixtures.js';

async function main() {
  if (process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false') {
    console.error('Refusing to run: requires RUN_DB_TESTS=1 and MOCK_DB=false (real Postgres, not the mock).');
    process.exit(1);
  }

  // Import AFTER the env gate above and AFTER process.env is fully set by
  // the shell invoking this script — module-level code in Database.ts reads
  // process.env at call time (not import time), but we still import late to
  // mirror the .pg.test.ts convention exactly.
  const { claimTimerWait } = await import('../../src/services/caseWorkspace/waitSubscriptionService.js');

  const pool = makeControlPool();
  let orgId = '';
  let projectId = '';
  let userId = '';
  let caseId = '';
  let waitId = '';

  try {
    const fixture = await seedOrgAndProject(pool, 'task5a');
    orgId = fixture.orgId;
    projectId = fixture.projectId;
    userId = await seedMemberedUser(pool, orgId, 'task5a');
    caseId = await seedCaseCore(pool, fixture, userId, 'task5a');

    waitId = `cwwait-harness-${randomUUID()}`;
    // Direct INSERT — createWait() itself is not the code under test here
    // (claimTimerWait is), so the row is seeded directly, TIMER/ACTIVE,
    // never claimed (claim_owner_token IS NULL), matching the state
    // claimTimerWait's WHERE guard requires to be claimable.
    await pool.query(
      `INSERT INTO case_workspace_waits (
         wait_id, organization_id, project_id, case_id, wait_type, status,
         correlation_key, claim_fencing_token, version, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'TIMER', 'ACTIVE', $5, 0, 1, NOW()::text, NOW()::text)`,
      [waitId, orgId, projectId, caseId, `task5a-correlation-${randomUUID()}`]
    );

    console.log(`Fixture ready: orgId=${orgId} caseId=${caseId} waitId=${waitId}`);
    console.log('Firing two concurrent claimTimerWait() calls via Promise.all...');

    const [resultA, resultB] = await Promise.all([
      claimTimerWait(waitId),
      claimTimerWait(waitId),
    ]);

    console.log('Result A:', JSON.stringify(resultA));
    console.log('Result B:', JSON.stringify(resultB));

    const outcomes = [resultA.outcome, resultB.outcome].sort();
    const exactlyOneClaimed = outcomes.filter((o) => o === 'claimed').length === 1;
    const otherIsActiveElsewhere = outcomes.includes('active_elsewhere');

    // Independently verify against the live row (not just trusting the
    // function's return values) — the claim_fencing_token must have
    // incremented exactly once (0 -> 1), not twice (0 -> 2), which would
    // indicate both calls' UPDATE matched the WHERE guard (a lost race).
    const rowRes = await pool.query(
      `SELECT claim_owner_token, claim_fencing_token, status FROM case_workspace_waits WHERE wait_id = $1`,
      [waitId]
    );
    const row = rowRes.rows[0];
    console.log('Live row after race:', JSON.stringify(row));
    const fencingIncrementedExactlyOnce = Number(row.claim_fencing_token) === 1;

    const pass = exactlyOneClaimed && otherIsActiveElsewhere && fencingIncrementedExactlyOnce;
    console.log(`exactlyOneClaimed=${exactlyOneClaimed} otherIsActiveElsewhere=${otherIsActiveElsewhere} fencingIncrementedExactlyOnce=${fencingIncrementedExactlyOnce}`);
    console.log(pass ? 'Task 5(a): PASS — exactly one claimTimerWait() call succeeded under real Postgres concurrency.' : 'Task 5(a): FAIL — see outcomes above.');
    process.exitCode = pass ? 0 : 1;
  } finally {
    await pool.query(`DELETE FROM case_workspace_waits WHERE wait_id = $1`, [waitId]).catch(() => undefined);
    await teardownAll(pool, {
      orgIds: [orgId],
      projectIds: [projectId],
      userIds: [userId],
      caseIds: [caseId],
    });
    await pool.end();
    console.log('Fixture torn down.');
  }
}

main().catch((err) => {
  console.error('task5a_claim_timer_wait_race.ts CRASHED:', err);
  process.exit(1);
});
