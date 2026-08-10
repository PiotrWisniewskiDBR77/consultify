/**
 * OKR-E003 — `okrObjectiveRepository.ts`: Objective/KeyResult visibility is
 * inherited entirely through the parent Set's own `'okr_set'` visibility
 * row (design §13, no independent resource_type) — the mandatory `::text`
 * cast on every join against `rvn_platform_resource_visibility.resource_id`
 * (TEXT) vs. `okr_vnext_objectives.set_id`/`okr_vnext_key_results.set_id`
 * (UUID), against a REAL Postgres.
 *
 * This exact cast has already been missed 7 times in one KPI epic — this
 * program's single most-repeated real bug — hence a dedicated regression
 * test, mirroring `okrSetVisibilityJoin.realdb.test.ts` (E002)'s own
 * rationale.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §13.
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
const ORG_PREFIX = `okr-e003-objvis-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-objvis-admin-${tag}`;
const USER_OWNER = `okr-e003-objvis-owner-${tag}`;
const USER_STRANGER = `okr-e003-objvis-stranger-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type ObjectiveRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let listObjectivesForSet: ObjectiveRepositoryModule['listObjectivesForSet'];
let getObjective: ObjectiveRepositoryModule['getObjective'];
let getKeyResult: ObjectiveRepositoryModule['getKeyResult'];
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

describe('OKR-E003 Objective/KeyResult visibility-join — ::text cast forces real join execution (real Postgres)', () => {
  let organizationId: string;
  let setId: string;
  let objectiveId: string;
  let keyResultId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Objective visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_objectives LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Objective schema); refusing to report a green run. ' +
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

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;

    const objectiveRepository: ObjectiveRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveRepository.js'
    );
    listObjectivesForSet = objectiveRepository.listObjectivesForSet;
    getObjective = objectiveRepository.getObjective;
    getKeyResult = objectiveRepository.getKeyResult;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    // One fixture Program (OPEN_ORG visibility, the default) -> Cycle ->
    // draft Set (owned by USER_OWNER) -> one Objective -> one KeyResult.
    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'Objective-visibility fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
    });
    await publishProgram({
      programId: program.result.programId,
      organizationId,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
    });
    const cycle = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Objective-visibility fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });
    const set = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'Objective-visibility fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: USER_OWNER,
      title: 'Objective-visibility fixture Objective',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    objectiveId = objective.result.objectiveId;
    const keyResult = await createKeyResult({
      objectiveId,
      organizationId,
      ownerUserId: USER_OWNER,
      title: 'Objective-visibility fixture KeyResult',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-${randomUUID()}`,
    });
    keyResultId = keyResult.result.keyResultId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1`, [orgLike]);
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

  itDB('listObjectivesForSet: a visible caller (OPEN_ORG default) sees the Objective with its nested KeyResult', async () => {
    const objectives = await listObjectivesForSet({ userId: USER_STRANGER, organizationId, setId });
    expect(objectives).toHaveLength(1);
    expect(objectives[0].objectiveId).toBe(objectiveId);
    expect(objectives[0].keyResults).toHaveLength(1);
    expect(objectives[0].keyResults[0].keyResultId).toBe(keyResultId);
  });

  itDB('getObjective: real join executes and returns the Objective (not silently empty from a mismatched TEXT/UUID compare)', async () => {
    const objective = await getObjective({ userId: USER_STRANGER, organizationId, objectiveId });
    expect(objective).not.toBeNull();
    expect(objective?.objectiveId).toBe(objectiveId);
    expect(objective?.keyResults).toHaveLength(1);
  });

  itDB('getKeyResult: real join executes and returns the KeyResult via its own set_id-inherited visibility', async () => {
    const keyResult = await getKeyResult({ userId: USER_STRANGER, organizationId, keyResultId });
    expect(keyResult).not.toBeNull();
    expect(keyResult?.keyResultId).toBe(keyResultId);
  });

  itDB(
    'direct proof: the visibility CTE join predicate is TEXT=TEXT (::text cast present) — removing it would compare TEXT against UUID and fail to plan/execute',
    async () => {
      // okr_vnext_objectives.set_id / okr_vnext_key_results.set_id are UUID;
      // rvn_platform_resource_visibility.resource_id is TEXT. A join
      // predicate WITHOUT the cast (`vr.resource_id = o.set_id`, no
      // `::text`) is a type mismatch Postgres rejects outright — proving
      // the repository's actual queries (already exercised by the three
      // tests above returning non-null/non-empty results) MUST be using
      // the cast, since a bare-UUID comparison would have thrown, not
      // silently returned zero rows.
      await expect(
        client.query(
          `SELECT o.objective_id
             FROM okr_vnext_objectives o
             JOIN rvn_platform_resource_visibility rv
               ON rv.resource_type = 'okr_set' AND rv.resource_id = o.set_id
            WHERE o.objective_id = $1`,
          [objectiveId]
        )
      ).rejects.toThrow(/operator does not exist|cannot be matched/i);

      // The ::text-cast version executes cleanly and finds the row.
      const casted = await client.query(
        `SELECT o.objective_id
           FROM okr_vnext_objectives o
           JOIN rvn_platform_resource_visibility rv
             ON rv.resource_type = 'okr_set' AND rv.resource_id = o.set_id::text
          WHERE o.objective_id = $1`,
        [objectiveId]
      );
      expect(casted.rowCount).toBe(1);
    }
  );

  itDB('a caller with no visibility into the Set sees an empty list / null detail (not an error)', async () => {
    // No RESTRICTED_ACL/PRIVATE fixture built here (OPEN_ORG is this
    // Program's default) — this asserts the "wrong org" shape instead,
    // the one universally-guaranteed negative case regardless of
    // visibility_mode.
    const wrongOrgObjectives = await listObjectivesForSet({
      userId: USER_STRANGER,
      organizationId: `${organizationId}-does-not-exist`,
      setId,
    });
    expect(wrongOrgObjectives).toEqual([]);

    const wrongOrgObjective = await getObjective({
      userId: USER_STRANGER,
      organizationId: `${organizationId}-does-not-exist`,
      objectiveId,
    });
    expect(wrongOrgObjective).toBeNull();
  });
});
