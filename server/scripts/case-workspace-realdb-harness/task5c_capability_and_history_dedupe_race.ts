#!/usr/bin/env tsx
/**
 * Case Workspace real-DB harness — Task 5(c).
 *
 * Two sub-races, both fired as genuinely concurrent (Promise.all) pairs
 * against a REAL Postgres:
 *
 *   (c1) capabilityRegistryService.recordIdempotencyKeyCheck() — two
 *        concurrent calls with the identical (capabilityRegistryId,
 *        idempotencyKey, requestPayload) must land exactly one
 *        case_workspace_capability_idempotency_keys row and both calls must
 *        report isDuplicate consistently (one false + one true, OR both
 *        agreeing on recordedAt — whichever the implementation actually
 *        does under a true race is asserted against the LIVE row, not
 *        assumed).
 *
 *   (c2) caseHistoryService.appendCaseHistoryEvent() — two concurrent calls
 *        with the identical dedupeKey must land exactly one
 *        case_workspace_history_events row, and both calls must return the
 *        SAME eventId.
 *
 * REQUIRED environment (same gate as caseCoreService.pg.test.ts's own header):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *     npx tsx server/scripts/case-workspace-realdb-harness/task5c_capability_and_history_dedupe_race.ts
 */
import { randomUUID } from 'node:crypto';

import {
  makeControlPool,
  seedOrgAndProject,
  seedMemberedUser,
  seedCaseCore,
  seedCapability,
  teardownAll,
} from './harnessFixtures.js';

async function runCapabilityIdempotencyRace(pool: any, orgId: string, adminUserId: string): Promise<boolean> {
  const { recordIdempotencyKeyCheck } = await import(
    '../../src/services/caseWorkspace/capabilityRegistryService.js'
  );

  const capabilityRegistryId = await seedCapability(pool, 'task5c');
  try {
    const idempotencyKey = `task5c-cap-idem-${randomUUID()}`;
    const requestPayload = { harness: 'task5c', nonce: randomUUID() };

    console.log(`(c1) capabilityRegistryId=${capabilityRegistryId} idempotencyKey=${idempotencyKey}`);
    console.log('(c1) Firing two concurrent recordIdempotencyKeyCheck() calls via Promise.all...');

    const [resultA, resultB] = await Promise.all([
      recordIdempotencyKeyCheck(
        { capabilityRegistryId, idempotencyKey, requestPayload, actorId: adminUserId },
        orgId
      ),
      recordIdempotencyKeyCheck(
        { capabilityRegistryId, idempotencyKey, requestPayload, actorId: adminUserId },
        orgId
      ),
    ]);

    console.log('(c1) Result A:', JSON.stringify(resultA));
    console.log('(c1) Result B:', JSON.stringify(resultB));

    const isDuplicateFlags = [resultA.isDuplicate, resultB.isDuplicate].sort();
    // Under a genuine race, exactly one call's INSERT wins the
    // ON CONFLICT (capability_registry_id, idempotency_key) DO NOTHING —
    // that call sees isDuplicate=false, the other (which finds 0 rows
    // returned and falls through to the SELECT) sees isDuplicate=true.
    const exactlyOneWinner = isDuplicateFlags[0] === false && isDuplicateFlags[1] === true;

    const rowsRes = await pool.query(
      `SELECT idempotency_record_id, request_digest FROM case_workspace_capability_idempotency_keys
        WHERE capability_registry_id = $1 AND idempotency_key = $2`,
      [capabilityRegistryId, idempotencyKey]
    );
    console.log('(c1) Live rows:', JSON.stringify(rowsRes.rows));
    const exactlyOneRow = rowsRes.rows.length === 1;
    const bothRecordedAtMatch = resultA.recordedAt === resultB.recordedAt;

    const pass = exactlyOneWinner && exactlyOneRow && bothRecordedAtMatch;
    console.log(`(c1) exactlyOneWinner=${exactlyOneWinner} exactlyOneRow=${exactlyOneRow} bothRecordedAtMatch=${bothRecordedAtMatch}`);
    console.log(pass ? '(c1) PASS' : '(c1) FAIL');
    return pass;
  } finally {
    await teardownAll(pool, { capabilityIds: [capabilityRegistryId] });
  }
}

async function runHistoryDedupeRace(pool: any, orgId: string, projectId: string, caseId: string, actorId: string): Promise<boolean> {
  const { appendCaseHistoryEvent } = await import('../../src/services/caseWorkspace/caseHistoryService.js');

  const dedupeKey = `task5c-history-dedupe-${randomUUID()}`;
  const occurredAt = new Date().toISOString();

  console.log(`(c2) caseId=${caseId} dedupeKey=${dedupeKey}`);
  console.log('(c2) Firing two concurrent appendCaseHistoryEvent() calls via Promise.all...');

  const input = {
    organizationId: orgId,
    projectId,
    caseId,
    eventType: 'HARNESS_TASK5C_MARKER',
    actorId,
    occurredAt,
    summary: 'task5c dedupe race marker event',
    dedupeKey,
  };

  const [resultA, resultB] = await Promise.all([
    appendCaseHistoryEvent(input),
    appendCaseHistoryEvent(input),
  ]);

  console.log('(c2) Result A eventId:', resultA.eventId);
  console.log('(c2) Result B eventId:', resultB.eventId);

  const sameEventId = resultA.eventId === resultB.eventId;

  const rowsRes = await pool.query(
    `SELECT event_id FROM case_workspace_history_events WHERE dedupe_key = $1`,
    [dedupeKey]
  );
  console.log('(c2) Live rows:', JSON.stringify(rowsRes.rows));
  const exactlyOneRow = rowsRes.rows.length === 1;
  const rowMatches = rowsRes.rows[0]?.event_id === resultA.eventId;

  const pass = sameEventId && exactlyOneRow && rowMatches;
  console.log(`(c2) sameEventId=${sameEventId} exactlyOneRow=${exactlyOneRow} rowMatches=${rowMatches}`);
  console.log(pass ? '(c2) PASS' : '(c2) FAIL');
  return pass;
}

async function main() {
  if (process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false') {
    console.error('Refusing to run: requires RUN_DB_TESTS=1 and MOCK_DB=false (real Postgres, not the mock).');
    process.exit(1);
  }

  const pool = makeControlPool();
  let orgId = '';
  let projectId = '';
  let userId = '';
  let caseId = '';

  try {
    const fixture = await seedOrgAndProject(pool, 'task5c');
    orgId = fixture.orgId;
    projectId = fixture.projectId;
    // ADMIN role: recordIdempotencyKeyCheck only requires requireOrgMember
    // (not requireOrgRole), but registering the fixture capability directly
    // sidesteps registerCapability's own ADMIN requirement anyway — MEMBER
    // is enough for recordIdempotencyKeyCheck itself. Kept as MEMBER to
    // exercise the actual minimum requirement, not an over-privileged actor.
    userId = await seedMemberedUser(pool, orgId, 'task5c', 'MEMBER');
    caseId = await seedCaseCore(pool, fixture, userId, 'task5c');

    const c1Pass = await runCapabilityIdempotencyRace(pool, orgId, userId);
    const c2Pass = await runHistoryDedupeRace(pool, orgId, projectId, caseId, userId);

    const overallPass = c1Pass && c2Pass;
    console.log(`Task 5(c): ${overallPass ? 'PASS' : 'FAIL'} — (c1 recordIdempotencyKeyCheck)=${c1Pass ? 'PASS' : 'FAIL'}, (c2 appendCaseHistoryEvent dedupe_key)=${c2Pass ? 'PASS' : 'FAIL'}`);
    process.exitCode = overallPass ? 0 : 1;
  } finally {
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
  console.error('task5c_capability_and_history_dedupe_race.ts CRASHED:', err);
  process.exit(1);
});
