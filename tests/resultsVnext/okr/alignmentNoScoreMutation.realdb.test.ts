/**
 * OKR-E005 — no-score-inheritance structural proof, Layers 3+4 of 4
 * (design §B): the literal AC-01 behavioral evidence, against a REAL
 * Postgres.
 *
 * D09/OKR-F-015 (the defining constraint of this epic): "brak FK/roll-up
 * inheritance". Layer 3 — create two Objectives with known, non-null
 * `progress`/`confidence`/`updated_at`/`row_version` (via a real KeyResult
 * under each, so the values are engine-computed, not hand-set). Run, in
 * separate cases: `proposeAlignment` -> `acceptAlignment`;
 * `proposeAlignment` -> `rejectAlignment`; `proposeAlignment` ->
 * `acceptAlignment` -> `removeAlignment`. After EVERY SINGLE command,
 * re-`SELECT *` BOTH the source and target Objective rows and assert
 * FULL-ROW EQUALITY (not just the two named columns — this catches an
 * accidental touch of ANY other Objective column too).
 *
 * Layer 4 — DB introspection: query `information_schema.triggers` for
 * `event_object_table = 'okr_vnext_objectives'` and assert no trigger
 * references `okr_vnext_alignments` — scoped this way (not "zero triggers
 * total") so the assertion never spuriously breaks if a future, unrelated
 * feature adds an `updated_at`-touch trigger to `okr_vnext_objectives` for a
 * reason that has nothing to do with alignment.
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
const ORG_PREFIX = `okr-e005-noscore-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-noscore-admin-${tag}`;
const USER_A = `okr-e005-noscore-owner-a-${tag}`;
const USER_B = `okr-e005-noscore-owner-b-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type AlignmentCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let acceptAlignment: AlignmentCommandsModule['acceptAlignment'];
let rejectAlignment: AlignmentCommandsModule['rejectAlignment'];
let removeAlignment: AlignmentCommandsModule['removeAlignment'];
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

describe('OKR-E005 — no-score-inheritance behavioral proof, Layers 3+4 of 4 (real Postgres)', () => {
  let organizationId: string;
  let setId: string;
  let cycleId: string;

  /** Creates a fresh Objective (owned by `ownerUserId`) with one numeric
   * KeyResult (target 10, current `currentValue`) so `progress`/
   * `confidence` are engine-computed and non-null, distinguishable per
   * fixture pair. */
  async function makeObjectiveWithKnownProgress(ownerUserId: string, title: string, currentValue: number): Promise<string> {
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId,
      title,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId,
      title: `${title} KR`,
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-${randomUUID()}`,
    });
    return objective.result.objectiveId;
  }

  async function selectObjectiveRow(objectiveId: string): Promise<Record<string, unknown>> {
    const result = await client.query(`SELECT * FROM okr_vnext_objectives WHERE objective_id = $1`, [objectiveId]);
    const row = result.rows[0];
    expect(row, `objective ${objectiveId} not found`).toBeDefined();
    return row as Record<string, unknown>;
  }

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E005 no-score-inheritance realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_alignments LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Alignment schema); refusing to report a green run. ' +
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

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    acceptAlignment = alignmentCommands.acceptAlignment;
    rejectAlignment = alignmentCommands.rejectAlignment;
    removeAlignment = alignmentCommands.removeAlignment;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'No-score-inheritance fixture Program',
      // Default objectiveRollupModel is 'none' (createProgram's own
      // default, okrProgramCommands.ts) — that would leave every
      // Objective's `progress` permanently `not_calculable`/NULL regardless
      // of KeyResult values, which would make this fixture's own
      // "progress is non-null and known" precondition vacuous. Pinned to
      // 'equal_average' so the fixture Objectives actually get a real,
      // engine-computed progress value to prove is never mutated.
      objectiveRollupModel: 'equal_average',
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
      name: 'No-score-inheritance fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });
    cycleId = cycle.result.cycleId;
    const set = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_ADMIN,
      title: 'No-score-inheritance fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_alignments WHERE organization_id LIKE $1`, [orgLike]);
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

  // ==========================================
  // Layer 3 — propose -> accept
  // ==========================================

  itDB('propose -> accept: source and target Objective rows are byte-identical before and after EVERY command', async () => {
    const sourceId = await makeObjectiveWithKnownProgress(USER_A, 'Accept-path source', 5);
    const targetId = await makeObjectiveWithKnownProgress(USER_B, 'Accept-path target', 7);

    const sourceBefore = await selectObjectiveRow(sourceId);
    const targetBefore = await selectObjectiveRow(targetId);
    expect(sourceBefore.progress).not.toBeNull();
    expect(targetBefore.progress).not.toBeNull();

    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: sourceId,
      targetObjectiveId: targetId,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });

    expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
    expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);

    await acceptAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `accept-${randomUUID()}`,
    });

    expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
    expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);
  });

  // ==========================================
  // Layer 3 — propose -> reject
  // ==========================================

  itDB('propose -> reject: source and target Objective rows are byte-identical before and after EVERY command', async () => {
    const sourceId = await makeObjectiveWithKnownProgress(USER_A, 'Reject-path source', 3);
    const targetId = await makeObjectiveWithKnownProgress(USER_B, 'Reject-path target', 9);

    const sourceBefore = await selectObjectiveRow(sourceId);
    const targetBefore = await selectObjectiveRow(targetId);

    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: sourceId,
      targetObjectiveId: targetId,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });

    expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
    expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);

    await rejectAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      responseReason: 'not a good fit',
      idempotencyKey: `reject-${randomUUID()}`,
    });

    expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
    expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);
  });

  // ==========================================
  // Layer 3 — propose -> accept -> remove
  // ==========================================

  itDB(
    'propose -> accept -> remove: source and target Objective rows are byte-identical before and after EVERY command',
    async () => {
      const sourceId = await makeObjectiveWithKnownProgress(USER_A, 'Remove-path source', 2);
      const targetId = await makeObjectiveWithKnownProgress(USER_B, 'Remove-path target', 6);

      const sourceBefore = await selectObjectiveRow(sourceId);
      const targetBefore = await selectObjectiveRow(targetId);

      const propose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: sourceId,
        targetObjectiveId: targetId,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-${randomUUID()}`,
      });
      expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
      expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);

      const accept = await acceptAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: propose.result.alignment.rowVersion,
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-${randomUUID()}`,
      });
      expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
      expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);

      await removeAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: accept.result.rowVersion,
        actorUserId: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `remove-${randomUUID()}`,
      });
      expect(await selectObjectiveRow(sourceId)).toEqual(sourceBefore);
      expect(await selectObjectiveRow(targetId)).toEqual(targetBefore);
    }
  );

  // ==========================================
  // Layer 4 — DB trigger introspection
  // ==========================================

  itDB(
    'Layer 4: information_schema.triggers has no trigger on okr_vnext_objectives (or okr_vnext_key_results) referencing okr_vnext_alignments',
    async () => {
      const result = await client.query<{ trigger_name: string; event_object_table: string; action_statement: string }>(
        `SELECT trigger_name, event_object_table, action_statement
           FROM information_schema.triggers
          WHERE event_object_table IN ('okr_vnext_objectives', 'okr_vnext_key_results')`
      );
      const alignmentRelatedTriggers = result.rows.filter(
        (row) =>
          /alignment/i.test(row.trigger_name) || /okr_vnext_alignments/i.test(row.action_statement)
      );
      expect(
        alignmentRelatedTriggers,
        `found alignment-related trigger(s) on Objective/KeyResult tables: ${JSON.stringify(alignmentRelatedTriggers)}`
      ).toEqual([]);
    }
  );

  itDB('Layer 4 (stronger): okr_vnext_objectives and okr_vnext_key_results have ZERO triggers at all today', async () => {
    // Stronger than the scoped check above, but a SEPARATE assertion (not
    // the primary one) — per design §B Layer 4's own reasoning, this one IS
    // allowed to break in the future if an unrelated feature adds an
    // updated_at-touch trigger; the scoped assertion above is the one that
    // must never spuriously fail.
    const result = await client.query<{ trigger_name: string }>(
      `SELECT trigger_name FROM information_schema.triggers
        WHERE event_object_table IN ('okr_vnext_objectives', 'okr_vnext_key_results')`
    );
    expect(result.rows).toEqual([]);
  });
});
