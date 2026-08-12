/**
 * OKR-E004 — Check-in visibility-join regression, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §10: "Mandatory
 * `::text` cast, restated explicitly per the standing warning both OKR-E001
 * and OKR-E002 give this exact bug its own paragraph over ... this epic's
 * realDB test suite must include an explicit
 * `okrCheckInVisibilityJoin.realdb.test.ts` proving the cast is present,
 * mirroring `okrSetVisibilityJoin.realdb.test.ts`'s own shape."
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_checkins.set_id` is UUID — `okrCheckInRepository.ts`'s
 * `listCheckIns`/`getCheckIn` join `vr.resource_id = c.set_id::text`. This
 * test proves that cast executes against real rows (Postgres 42883
 * "operator does not exist: text = uuid" would fire on the very first row
 * otherwise) AND that visibility is genuinely enforced (RESTRICTED_ACL
 * grantee sees the check-in, an outsider gets neither a leak nor a crash —
 * an empty list / null instead).
 *
 * Uses lightweight direct-SQL fixture rows (mirrors
 * `okrSetVisibilityJoin.realdb.test.ts`'s own `insertFixtureSet`/
 * `insertSetVisibility`/`grantAcl` helpers) rather than driving the full
 * Program->Cycle->Set->Objective->KeyResult->submit->approve->activate
 * command chain — visibility inheritance via `set_id` is what this file
 * tests, not command-layer lifecycle correctness (covered elsewhere).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e004-vis-join-org-${tag}`;
const USER_GRANTEE = `okr-e004-vis-join-grantee-${tag}`;
const USER_OUTSIDER = `okr-e004-vis-join-outsider-${tag}`;
const USER_ADMIN = `okr-e004-vis-join-admin-${tag}`;

let client: Client;
let reachable = false;
let programId: string;
let cycleId: string;
let policyId: string;
let policyVersionId: string;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type CheckInRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let listCheckIns: CheckInRepositoryModule['listCheckIns'];
let getCheckIn: CheckInRepositoryModule['getCheckIn'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
  };
}

interface CheckInFixtureIds {
  setId: string;
  objectiveId: string;
  keyResultId: string;
  occurrenceId: string;
  checkInId: string;
}

let fixtureOccurrenceCounter = 0;

/** Direct-SQL fixture: one Set/Objective/KeyResult/Occurrence/CheckIn row,
 * bypassing the command layer (visibility-join behavior, not lifecycle
 * correctness, is under test here). */
async function insertFixtureCheckIn(ownerUserId: string): Promise<CheckInFixtureIds> {
  const setId = randomUUID();
  const objectiveId = randomUUID();
  const keyResultId = randomUUID();
  const occurrenceId = randomUUID();
  const checkInId = randomUUID();
  // (cycle_id, window_start) is UNIQUE — every fixture in this file shares
  // one module-level Cycle, so each call needs its own distinct window.
  fixtureOccurrenceCounter += 1;
  const windowStart = new Date(Date.UTC(2026, 0, 1 + fixtureOccurrenceCounter * 14)).toISOString().slice(0, 10);
  const windowEnd = new Date(Date.UTC(2026, 0, 1 + fixtureOccurrenceCounter * 14 + 13)).toISOString().slice(0, 10);

  await client.query(
    `INSERT INTO okr_vnext_sets
       (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'individual', $5, $6, 'Visibility-join fixture Set', $6)`,
    [setId, ORG_ID, programId, cycleId, setId, ownerUserId]
  );
  await client.query(
    `INSERT INTO okr_vnext_objectives (objective_id, set_id, organization_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'Visibility-join fixture Objective', $4)`,
    [objectiveId, setId, ORG_ID, ownerUserId]
  );
  await client.query(
    `INSERT INTO okr_vnext_key_results
       (key_result_id, objective_id, set_id, organization_id, owner_user_id, title,
        measurement_type, direction, target_value, current_value,
        progress_calc_policy_version_id, created_by)
     VALUES ($1, $2, $3, $4, $5, 'Visibility-join fixture KR', 'numeric', 'reach', 10, 5, $6, $5)`,
    [keyResultId, objectiveId, setId, ORG_ID, ownerUserId, policyVersionId]
  );
  await client.query(
    `INSERT INTO okr_vnext_checkin_occurrences (cadence_occurrence_id, organization_id, cycle_id, window_start, window_end)
     VALUES ($1, $2, $3, $4, $5)`,
    [occurrenceId, ORG_ID, cycleId, windowStart, windowEnd]
  );
  await client.query(
    `INSERT INTO okr_vnext_checkins
       (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id, new_value, note, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, 7, 'Visibility-join fixture check-in', $7)`,
    [checkInId, ORG_ID, keyResultId, objectiveId, setId, occurrenceId, ownerUserId]
  );

  return { setId, objectiveId, keyResultId, occurrenceId, checkInId };
}

async function insertSetVisibility(setId: string, mode: string, ownerUserId: string | null): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('okr_set', $1, $2, $3, $4, $5)`,
    [setId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function grantAcl(setId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('okr_set', $1, 'user', $2, 'contribute', $3)`,
    [setId, granteeUserId, grantedBy]
  );
}

describe('OKR-E004 Check-in visibility-join regression — TEXT/UUID cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E004 check-in visibility-join tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_checkins LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id))`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E004 checkin schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const checkInRepository: CheckInRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCheckInRepository.js'
    );
    listCheckIns = checkInRepository.listCheckIns;
    getCheckIn = checkInRepository.getCheckIn;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Check-in visibility-join fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    programId = created.result.programId;
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'Check-in visibility-join fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    cycleId = cycle.result.cycleId;

    const policyRow = await client.query<{ policy_id: string }>(
      `SELECT policy_id FROM rvn_platform_visibility_policies WHERE organization_id = $1 AND domain = 'okr' AND is_active = true`,
      [ORG_ID]
    );
    policyId = policyRow.rows[0]!.policy_id;

    const policyVersionRow = await client.query<{ policy_version_id: string }>(
      `SELECT policy_version_id FROM okr_vnext_program_policy_versions WHERE program_id = $1`,
      [programId]
    );
    policyVersionId = policyVersionRow.rows[0]!.policy_version_id;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_ID}%`;
    await client.query(`DELETE FROM okr_vnext_checkins WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'okr_set'
          AND resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('OPEN_ORG: every org member sees the check-in via listCheckIns/getCheckIn, no ACL/ownership needed', async () => {
    const fx = await insertFixtureCheckIn(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'OPEN_ORG', USER_GRANTEE);

    const outsiderList = await listCheckIns({ userId: USER_OUTSIDER, organizationId: ORG_ID, keyResultId: fx.keyResultId });
    expect(outsiderList.map((c) => c.checkInId)).toContain(fx.checkInId);

    const outsiderGet = await getCheckIn({ userId: USER_OUTSIDER, organizationId: ORG_ID, checkInId: fx.checkInId });
    expect(outsiderGet).not.toBeNull();
    expect(outsiderGet?.checkInId).toBe(fx.checkInId);
  });

  itDB(
    'RESTRICTED_ACL: visible to its ACL grantee, invisible to an outsider — proves the ' +
      '`vr.resource_id = c.set_id::text` join executes against real rows instead of throwing 42883 (text = uuid) ' +
      'or silently matching nothing',
    async () => {
      const fx = await insertFixtureCheckIn(USER_GRANTEE);
      await insertSetVisibility(fx.setId, 'RESTRICTED_ACL', USER_GRANTEE);
      await grantAcl(fx.setId, USER_GRANTEE, USER_GRANTEE);

      const granteeList = await listCheckIns({ userId: USER_GRANTEE, organizationId: ORG_ID, keyResultId: fx.keyResultId });
      expect(granteeList.map((c) => c.checkInId)).toContain(fx.checkInId);

      const granteeGet = await getCheckIn({ userId: USER_GRANTEE, organizationId: ORG_ID, checkInId: fx.checkInId });
      expect(granteeGet).not.toBeNull();
      expect(granteeGet?.checkInId).toBe(fx.checkInId);

      // Outsider: excluded from listing, null on direct get — NOT a thrown
      // 42883 (which would fail the whole call) and NOT a false-positive
      // leak.
      const outsiderList = await listCheckIns({ userId: USER_OUTSIDER, organizationId: ORG_ID, keyResultId: fx.keyResultId });
      expect(outsiderList.map((c) => c.checkInId)).not.toContain(fx.checkInId);

      const outsiderGet = await getCheckIn({ userId: USER_OUTSIDER, organizationId: ORG_ID, checkInId: fx.checkInId });
      expect(outsiderGet).toBeNull();
    }
  );

  itDB('PRIVATE: visible only to the owner, invisible to a grantee-less outsider', async () => {
    const fx = await insertFixtureCheckIn(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'PRIVATE', USER_GRANTEE);

    const ownerGet = await getCheckIn({ userId: USER_GRANTEE, organizationId: ORG_ID, checkInId: fx.checkInId });
    expect(ownerGet).not.toBeNull();

    const outsiderGet = await getCheckIn({ userId: USER_OUTSIDER, organizationId: ORG_ID, checkInId: fx.checkInId });
    expect(outsiderGet).toBeNull();
  });

  itDB('listCheckIns currentOnly=false returns superseded rows too; currentOnly=true (default) excludes them', async () => {
    const fx = await insertFixtureCheckIn(USER_GRANTEE);
    await insertSetVisibility(fx.setId, 'OPEN_ORG', USER_GRANTEE);

    const correctionId = randomUUID();
    await client.query(
      `INSERT INTO okr_vnext_checkins
         (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id, new_value, note,
          correction_of_checkin_id, correction_reason, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, 9, 'corrected value', $7, 'fixed a typo', $8)`,
      [correctionId, ORG_ID, fx.keyResultId, fx.objectiveId, fx.setId, fx.occurrenceId, fx.checkInId, USER_GRANTEE]
    );

    const currentOnly = await listCheckIns({ userId: USER_GRANTEE, organizationId: ORG_ID, keyResultId: fx.keyResultId });
    expect(currentOnly.map((c) => c.checkInId)).toContain(correctionId);
    expect(currentOnly.map((c) => c.checkInId)).not.toContain(fx.checkInId);

    const fullHistory = await listCheckIns({
      userId: USER_GRANTEE,
      organizationId: ORG_ID,
      keyResultId: fx.keyResultId,
      currentOnly: false,
    });
    expect(fullHistory.map((c) => c.checkInId)).toEqual(expect.arrayContaining([fx.checkInId, correctionId]));
  });
});
