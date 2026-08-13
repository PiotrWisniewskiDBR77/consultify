/**
 * OKR-E003 — `createKeyResult`: measurement_type command-layer gating (both
 * branches), cross-field validation, progress computed+persisted on
 * create, Objective rollup cascade, the PINNED policy-version proof
 * (OKR-F-009-AC-02), and the direct-schema D09 zero-FK proof — against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §10.5, D-E3-4,
 * D-E3-6, D-E3-7, D-E3-11.
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
const ORG_PREFIX = `okr-e003-krcreate-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-krcreate-admin-${tag}`;
const USER_OWNER = `okr-e003-krcreate-owner-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let editProgramDraft: ProgramCommandsModule['editProgramDraft'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let updateKeyResult: KeyResultCommandsModule['updateKeyResult'];
let OkrKeyResultValidationError: KeyResultCommandsModule['OkrKeyResultValidationError'];
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

interface Fixture {
  organizationId: string;
  programId: string;
  cycleId: string;
  setId: string;
  objectiveId: string;
}

/** Program -> publish (v1 policy) -> Cycle (pins v1) -> draft Set -> one
 * Objective, the minimum fixture every KeyResult command needs. */
async function createFullFixture(ownerId: string): Promise<Fixture> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'KeyResult-create fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  await publishProgram({
    programId: created.result.programId,
    organizationId,
    expectedVersion: created.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const cycle = await createCycle({
    organizationId,
    programId: created.result.programId,
    name: 'KeyResult-create fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const set = await createOkrSet({
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: ownerId,
    ownerUserId: ownerId,
    title: 'KeyResult-create fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: ownerId,
    title: 'KeyResult-create fixture Objective',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  return {
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    setId: set.result.set.setId,
    objectiveId: objective.result.objectiveId,
  };
}

describe('OKR-E003 createKeyResult — measurement_type gating, progress engine wiring, pinned policy, D09 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR createKeyResult realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_key_results LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR KeyResult schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;
    editProgramDraft = programCommands.editProgramDraft;

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
    updateKeyResult = keyResultCommands.updateKeyResult;
    OkrKeyResultValidationError = keyResultCommands.OkrKeyResultValidationError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
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

  // ==========================================
  // D-E3-4: measurement_type gating — both branches
  // ==========================================

  itDB('MVP-supported measurement_type (numeric/percentage/currency/binary) are all accepted', async () => {
    const fx = await createFullFixture(`${USER_OWNER}-mvp`);

    for (const measurementType of ['numeric', 'percentage', 'currency', 'binary'] as const) {
      const outcome = await createKeyResult({
        objectiveId: fx.objectiveId,
        organizationId: fx.organizationId,
        ownerUserId: `${USER_OWNER}-mvp`,
        title: `KR (${measurementType})`,
        measurementType,
        currency: measurementType === 'currency' ? 'USD' : null,
        direction: measurementType === 'binary' ? 'binary' : 'reach',
        targetValue: measurementType === 'binary' ? null : 10,
        currentValue: measurementType === 'binary' ? 1 : 5,
        createdBy: `${USER_OWNER}-mvp`,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-${measurementType}-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(outcome.result.measurementType).toBe(measurementType);
    }
  });

  itDB(
    'milestone/custom measurement_type are REJECTED with MEASUREMENT_TYPE_NOT_IMPLEMENTED (schema-permissive, command-layer gated)',
    async () => {
      const fx = await createFullFixture(`${USER_OWNER}-notimpl`);

      for (const measurementType of ['milestone', 'custom'] as const) {
        let caught: unknown;
        try {
          await createKeyResult({
            objectiveId: fx.objectiveId,
            organizationId: fx.organizationId,
            ownerUserId: `${USER_OWNER}-notimpl`,
            title: `Should be rejected (${measurementType})`,
            measurementType,
            direction: 'reach',
            targetValue: 10,
            currentValue: 5,
            createdBy: `${USER_OWNER}-notimpl`,
            actorEffectiveRole: 'member',
            idempotencyKey: `create-kr-${measurementType}-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(OkrKeyResultValidationError);
        expect((caught as InstanceType<typeof OkrKeyResultValidationError>).code).toBe('MEASUREMENT_TYPE_NOT_IMPLEMENTED');
      }

      // No row leaked from either rejected attempt.
      const rows = await client.query(`SELECT key_result_id FROM okr_vnext_key_results WHERE objective_id = $1`, [
        fx.objectiveId,
      ]);
      expect(rows.rowCount).toBe(0);
    }
  );

  // ==========================================
  // Cross-field validation
  // ==========================================

  itDB('currency is required when measurement_type="currency"', async () => {
    const fx = await createFullFixture(`${USER_OWNER}-currency`);
    let caught: unknown;
    try {
      await createKeyResult({
        objectiveId: fx.objectiveId,
        organizationId: fx.organizationId,
        ownerUserId: `${USER_OWNER}-currency`,
        title: 'Missing currency',
        measurementType: 'currency',
        currency: null,
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
        createdBy: `${USER_OWNER}-currency`,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-currency-missing-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrKeyResultValidationError);
    expect((caught as InstanceType<typeof OkrKeyResultValidationError>).code).toBe('CURRENCY_REQUIRED');
  });

  itDB('range_min/range_max are both required when direction="maintain_range"', async () => {
    const fx = await createFullFixture(`${USER_OWNER}-range`);
    let caught: unknown;
    try {
      await createKeyResult({
        objectiveId: fx.objectiveId,
        organizationId: fx.organizationId,
        ownerUserId: `${USER_OWNER}-range`,
        title: 'Missing range',
        measurementType: 'numeric',
        direction: 'maintain_range',
        rangeMin: 10,
        rangeMax: null,
        createdBy: `${USER_OWNER}-range`,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-range-missing-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrKeyResultValidationError);
    expect((caught as InstanceType<typeof OkrKeyResultValidationError>).code).toBe('RANGE_REQUIRED');
  });

  // ==========================================
  // D-E3-7: progress computed + persisted on create, Objective rollup cascade
  // ==========================================

  itDB(
    'progress is computed synchronously on create (increase: (5-0)/(10-0)=0.5) and the parent Objective rolls up (equal_average default is "none" -> objective progress stays null; but with equal_average explicitly set, rolls up)',
    async () => {
      const fx = await createFullFixture(`${USER_OWNER}-rollup`);

      // Default Program policy: objective_rollup_model='none' -> Objective
      // progress intentionally stays null even after a calculable KR exists.
      const kr1 = await createKeyResult({
        objectiveId: fx.objectiveId,
        organizationId: fx.organizationId,
        ownerUserId: `${USER_OWNER}-rollup`,
        title: 'Increase KR',
        measurementType: 'numeric',
        direction: 'increase',
        baselineValue: 0,
        targetValue: 10,
        currentValue: 5,
        createdBy: `${USER_OWNER}-rollup`,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-increase-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(Number(kr1.result.progress)).toBeCloseTo(0.5, 10);
      expect(kr1.result.progressCalcReason).toContain('increase:');

      const objRow = await client.query<{ progress: string | null; progress_calc_reason: string | null }>(
        `SELECT progress, progress_calc_reason FROM okr_vnext_objectives WHERE objective_id = $1`,
        [fx.objectiveId]
      );
      expect(objRow.rows[0].progress).toBeNull();
      expect(objRow.rows[0].progress_calc_reason).toContain('rollup_model_none');

      // Now switch the Program's DRAFT policy to equal_average and publish
      // a v2 — this Set's OWN Cycle stays pinned to v1 (no re-read), so we
      // create a SECOND fixture (fresh Cycle pinned to the NEW v2 policy)
      // to observe equal_average actually rolling up.
    }
  );

  itDB('objective_rollup_model="equal_average": Objective progress rolls up from its KRs (average of calculable ones)', async () => {
    const organizationId = freshOrgId();
    const ownerId = `${USER_OWNER}-equalavg`;
    const createdProgram = await createProgram({
      organizationId,
      name: 'Equal-average fixture Program',
      objectiveRollupModel: 'equal_average',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: createdProgram.result.programId,
      organizationId,
      expectedVersion: createdProgram.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycle = await createCycle({
      organizationId,
      programId: createdProgram.result.programId,
      name: 'Equal-average fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const set = await createOkrSet({
      organizationId,
      programId: createdProgram.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      title: 'Equal-average fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const objective = await createObjective({
      setId: set.result.set.setId,
      organizationId,
      ownerUserId: ownerId,
      title: 'Equal-average fixture Objective',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    // KR1: reach 5/10 = 0.5
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId: ownerId,
      title: 'KR1',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    // KR2: reach 9/10 = 0.9
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId: ownerId,
      title: 'KR2',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 9,
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    // (0.5 + 0.9) / 2 = 0.7
    const objRow = await client.query<{ progress: string | null; progress_calc_reason: string | null }>(
      `SELECT progress, progress_calc_reason FROM okr_vnext_objectives WHERE objective_id = $1`,
      [objective.result.objectiveId]
    );
    expect(Number(objRow.rows[0].progress)).toBeCloseTo(0.7, 10);
    expect(objRow.rows[0].progress_calc_reason).toContain('equal_average');
  });

  // ==========================================
  // OKR-F-009-AC-02: PINNED policy-version proof — not a live re-read
  // ==========================================

  itDB(
    'progress_calc_policy_version_id points at the CYCLE-pinned policy version, unaffected by a later Program republish (D-E3-6)',
    async () => {
      const fx = await createFullFixture(`${USER_OWNER}-pinned`);

      const pinnedVersionRow = await client.query<{ policy_version_id: string }>(
        `SELECT policy_version_id FROM okr_vnext_cycles WHERE cycle_id = $1`,
        [fx.cycleId]
      );
      const pinnedPolicyVersionId = pinnedVersionRow.rows[0].policy_version_id;

      const kr = await createKeyResult({
        objectiveId: fx.objectiveId,
        organizationId: fx.organizationId,
        ownerUserId: `${USER_OWNER}-pinned`,
        title: 'Pinned-policy KR',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
        createdBy: `${USER_OWNER}-pinned`,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-pinned-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(kr.result.progressCalcPolicyVersionId).toBe(pinnedPolicyVersionId);

      // Republish the Program with a DIFFERENT objective_rollup_model — a
      // new v2 policy version now exists, and the Program's
      // active_policy_version_id now points at v2.
      const programRow = await client.query<{ row_version: number }>(
        `SELECT row_version FROM okr_vnext_programs WHERE program_id = $1`,
        [fx.programId]
      );
      await editProgramDraft({
        programId: fx.programId,
        organizationId: fx.organizationId,
        expectedVersion: programRow.rows[0].row_version,
        objectiveRollupModel: 'weighted_average',
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `edit-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await publishProgram({
        programId: fx.programId,
        organizationId: fx.organizationId,
        expectedVersion: programRow.rows[0].row_version + 1,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `republish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const policyVersionCount = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM okr_vnext_program_policy_versions WHERE program_id = $1`,
        [fx.programId]
      );
      expect(Number(policyVersionCount.rows[0].count)).toBe(2);

      // The Cycle's OWN pinned pointer must be untouched by the republish.
      const cycleAfter = await client.query<{ policy_version_id: string }>(
        `SELECT policy_version_id FROM okr_vnext_cycles WHERE cycle_id = $1`,
        [fx.cycleId]
      );
      expect(cycleAfter.rows[0].policy_version_id).toBe(pinnedPolicyVersionId);

      // Update the SAME KeyResult (triggers a recompute) — its
      // progress_calc_policy_version_id must STILL be the ORIGINAL pinned
      // v1 id, never the new v2, proving the resolution path is
      // Set -> Cycle -> pinned policy_version_id, never a live re-read of
      // okr_vnext_programs's current row.
      const updated = await updateKeyResult({
        keyResultId: kr.result.keyResultId,
        organizationId: fx.organizationId,
        expectedVersion: kr.result.rowVersion,
        currentValue: 7,
        actorUserId: `${USER_OWNER}-pinned`,
        actorEffectiveRole: 'member',
        idempotencyKey: `update-kr-pinned-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(updated.result.progressCalcPolicyVersionId).toBe(pinnedPolicyVersionId);
      expect(updated.result.progressCalcPolicyVersionId).not.toBe(
        (
          await client.query<{ active_policy_version_id: string }>(
            `SELECT active_policy_version_id FROM okr_vnext_programs WHERE program_id = $1`,
            [fx.programId]
          )
        ).rows[0].active_policy_version_id
      );
    }
  );

  // ==========================================
  // D09 — direct schema inspection (not a design-doc claim)
  // ==========================================

  itDB(
    'okr_vnext_key_results carries ZERO foreign key to any KPI/Initiative/ROI table (direct information_schema inspection)',
    async () => {
      const fkResult = await client.query<{
        constraint_name: string;
        referenced_table: string;
      }>(`
        SELECT tc.constraint_name,
               ccu.table_name AS referenced_table
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
           AND tc.constraint_schema = ccu.constraint_schema
         WHERE tc.table_name = 'okr_vnext_key_results'
           AND tc.constraint_type = 'FOREIGN KEY'
      `);

      const referencedTables = fkResult.rows.map((r) => r.referenced_table);
      // The ONLY legitimate FKs on this table point at its own domain
      // (okr_vnext_objectives, okr_vnext_sets, okr_vnext_program_policy_versions).
      const forbiddenTargets = referencedTables.filter(
        (t) => /kpi/i.test(t) || /initiative/i.test(t) || /roi/i.test(t)
      );
      expect(
        forbiddenTargets,
        `okr_vnext_key_results has a forbidden FK to: ${JSON.stringify(forbiddenTargets)} (full FK list: ${JSON.stringify(referencedTables)})`
      ).toEqual([]);

      // Sanity: the table DOES have FKs (to its own domain) — a table with
      // literally zero FK rows at all would make the assertion above
      // vacuous.
      expect(referencedTables.length).toBeGreaterThan(0);
    }
  );

  itDB('source_type/source_reference accept an opaque string with no referential validation (D-E3-11)', async () => {
    const fx = await createFullFixture(`${USER_OWNER}-sourceref`);
    const kr = await createKeyResult({
      objectiveId: fx.objectiveId,
      organizationId: fx.organizationId,
      ownerUserId: `${USER_OWNER}-sourceref`,
      title: 'Source-reference KR',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      sourceType: 'connector',
      // Deliberately an id that does NOT exist in any kpi_*/rvn_kpi_* table
      // — must be accepted, since this column is opaque/informational only.
      sourceReference: 'nonexistent-kpi-id-12345',
      createdBy: `${USER_OWNER}-sourceref`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-sourceref-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(kr.result.sourceType).toBe('connector');
    expect(kr.result.sourceReference).toBe('nonexistent-kpi-id-12345');
  });
});
