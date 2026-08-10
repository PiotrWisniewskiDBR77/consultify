/**
 * OKR-E003 — `hasSufficientKeyResultCoverage` wired into
 * `submitOkrSetForApproval` (E002, `okrSetCommands.ts`): literal
 * OKR-F-008-AC-02 proof — submission is blocked when ANY non-cancelled
 * Objective has fewer than `kr_min_required` non-cancelled KeyResults,
 * enforced PER-OBJECTIVE (D-E3-5, §-IO item 3), no company/BU/team
 * special-casing (§-IO item 6) — against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §11.
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
const ORG_PREFIX = `okr-e003-krcoverage-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-krcoverage-admin-${tag}`;
const USER_OWNER = `okr-e003-krcoverage-owner-${tag}`;
const USER_REVIEWER = `okr-e003-krcoverage-reviewer-${tag}`;

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
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let OkrSetNotReadyForSubmissionError: SetCommandsModule['OkrSetNotReadyForSubmissionError'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let hasSufficientKeyResultCoverage: ObjectiveCommandsModule['hasSufficientKeyResultCoverage'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let cancelKeyResult: KeyResultCommandsModule['cancelKeyResult'];
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

async function createProgramCycleAndSet(
  ownerId: string,
  scopeType: 'company' | 'business_unit' | 'team' | 'individual' = 'individual',
  scopeId?: string
): Promise<{ organizationId: string; setId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'KR-coverage fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
  });
  await publishProgram({
    programId: created.result.programId,
    organizationId,
    expectedVersion: created.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
  });
  const cycle = await createCycle({
    organizationId,
    programId: created.result.programId,
    name: 'KR-coverage fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  const set = await createOkrSet({
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType,
    scopeId: scopeId ?? ownerId,
    ownerUserId: ownerId,
    reviewerUserId: USER_REVIEWER,
    title: 'KR-coverage fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  return { organizationId, setId: set.result.set.setId };
}

async function addKeyResults(objectiveId: string, organizationId: string, ownerId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await createKeyResult({
      objectiveId,
      organizationId,
      ownerUserId: ownerId,
      title: `Coverage fixture KR ${i + 1}`,
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-${i}-${randomUUID()}`,
    });
  }
}

describe('OKR-E003 hasSufficientKeyResultCoverage / submitOkrSetForApproval — OKR-F-008-AC-02 (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR KR-coverage realdb tests did NOT run. This run is not evidence.');
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

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    submitOkrSetForApproval = setCommands.submitOkrSetForApproval;
    OkrSetNotReadyForSubmissionError = setCommands.OkrSetNotReadyForSubmissionError;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;
    hasSufficientKeyResultCoverage = objectiveCommands.hasSufficientKeyResultCoverage;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;
    cancelKeyResult = keyResultCommands.cancelKeyResult;

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

  itDB('a Set with zero Objectives is blocked with reason "no_objectives"', async () => {
    const { organizationId, setId } = await createProgramCycleAndSet(`${USER_OWNER}-noobj`);
    const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
      setId,
    ]);

    let caught: unknown;
    try {
      await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: setRow.rows[0].row_version,
        actorUserId: `${USER_OWNER}-noobj`,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-noobj-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetNotReadyForSubmissionError);
    expect((caught as InstanceType<typeof OkrSetNotReadyForSubmissionError>).details.reason).toBe('no_objectives');
  });

  itDB('an Objective with 0 or 1 KRs blocks submission ("insufficient_key_results"); 2 KRs allows it (default kr_min_required=2)', async () => {
    const { organizationId, setId } = await createProgramCycleAndSet(`${USER_OWNER}-below`);
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-below`,
      title: 'Below-minimum fixture Objective',
      createdBy: `${USER_OWNER}-below`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    const setRow = () => client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [setId]);

    // 0 KRs.
    let caught0: unknown;
    try {
      await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: (await setRow()).rows[0].row_version,
        actorUserId: `${USER_OWNER}-below`,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-0kr-${randomUUID()}`,
      });
    } catch (err) {
      caught0 = err;
    }
    expect(caught0).toBeInstanceOf(OkrSetNotReadyForSubmissionError);
    expect((caught0 as InstanceType<typeof OkrSetNotReadyForSubmissionError>).details.reason).toBe('insufficient_key_results');
    // OkrSetNotReadyForSubmissionError spreads krCoverage.details directly
    // into its own `.details` (extraDetails param, not a nested `.details.details`).
    const details0 = (caught0 as InstanceType<typeof OkrSetNotReadyForSubmissionError>).details as unknown as {
      objectivesBelowMinimum: Array<{ objectiveId: string; title: string; krCount: number; required: number }>;
    };
    expect(details0.objectivesBelowMinimum).toEqual([{ objectiveId: objective.result.objectiveId, title: 'Below-minimum fixture Objective', krCount: 0, required: 2 }]);

    // 1 KR — still below.
    await addKeyResults(objective.result.objectiveId, organizationId, `${USER_OWNER}-below`, 1);
    let caught1: unknown;
    try {
      await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: (await setRow()).rows[0].row_version,
        actorUserId: `${USER_OWNER}-below`,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-1kr-${randomUUID()}`,
      });
    } catch (err) {
      caught1 = err;
    }
    expect(caught1).toBeInstanceOf(OkrSetNotReadyForSubmissionError);

    // 2 KRs — meets the default kr_min_required=2, submission succeeds.
    await addKeyResults(objective.result.objectiveId, organizationId, `${USER_OWNER}-below`, 1);
    const submitted = await submitOkrSetForApproval({
      setId,
      organizationId,
      expectedVersion: (await setRow()).rows[0].row_version,
      actorUserId: `${USER_OWNER}-below`,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-2kr-${randomUUID()}`,
    });
    expect(submitted.result.status).toBe('submitted');
  });

  itDB('enforced PER-OBJECTIVE: one Objective at 2 KRs + one Objective at 1 KR still blocks the whole Set', async () => {
    const { organizationId, setId } = await createProgramCycleAndSet(`${USER_OWNER}-perobj`);
    const objectiveA = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-perobj`,
      title: 'Objective A (sufficient)',
      createdBy: `${USER_OWNER}-perobj`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-a-${randomUUID()}`,
    });
    const objectiveB = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-perobj`,
      title: 'Objective B (insufficient)',
      createdBy: `${USER_OWNER}-perobj`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-b-${randomUUID()}`,
    });
    await addKeyResults(objectiveA.result.objectiveId, organizationId, `${USER_OWNER}-perobj`, 2);
    await addKeyResults(objectiveB.result.objectiveId, organizationId, `${USER_OWNER}-perobj`, 1);

    const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
      setId,
    ]);
    let caught: unknown;
    try {
      await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: setRow.rows[0].row_version,
        actorUserId: `${USER_OWNER}-perobj`,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-perobj-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetNotReadyForSubmissionError);
    const details = (caught as InstanceType<typeof OkrSetNotReadyForSubmissionError>).details as unknown as {
      objectivesBelowMinimum: Array<{ objectiveId: string }>;
    };
    expect(details.objectivesBelowMinimum.map((o) => o.objectiveId)).toEqual([objectiveB.result.objectiveId]);
  });

  itDB('a cancelled KeyResult does not count toward coverage — cancelling below the minimum drops an Objective below 2', async () => {
    const { organizationId, setId } = await createProgramCycleAndSet(`${USER_OWNER}-cancelkr`);
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-cancelkr`,
      title: 'Cancel-KR fixture Objective',
      createdBy: `${USER_OWNER}-cancelkr`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    const kr1 = await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId: `${USER_OWNER}-cancelkr`,
      title: 'KR1',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: `${USER_OWNER}-cancelkr`,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr1-${randomUUID()}`,
    });
    await addKeyResults(objective.result.objectiveId, organizationId, `${USER_OWNER}-cancelkr`, 1);

    // Direct repository-function check (not just the route-level guard via
    // submitOkrSetForApproval) — 2 non-cancelled KRs -> eligible.
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    const pgClient = await (pgModule as unknown as { acquirePgClient: () => Promise<import('pg').PoolClient> }).acquirePgClient();
    let coverageBefore: Awaited<ReturnType<typeof hasSufficientKeyResultCoverage>>;
    try {
      coverageBefore = await hasSufficientKeyResultCoverage(pgClient, setId, organizationId, 2);
    } finally {
      pgClient.release();
    }
    expect(coverageBefore.eligible).toBe(true);

    await cancelKeyResult({
      keyResultId: kr1.result.keyResultId,
      organizationId,
      expectedVersion: kr1.result.rowVersion,
      actorUserId: `${USER_OWNER}-cancelkr`,
      actorEffectiveRole: 'member',
      idempotencyKey: `cancel-kr1-${randomUUID()}`,
    });

    const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
      setId,
    ]);
    let caught: unknown;
    try {
      await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: setRow.rows[0].row_version,
        actorUserId: `${USER_OWNER}-cancelkr`,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-after-cancel-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetNotReadyForSubmissionError);
  });

  itDB('§-IO item 6: no company/BU/team special-casing — the rule applies identically across all 4 scope types', async () => {
    for (const scopeType of ['company', 'business_unit', 'team', 'individual'] as const) {
      const ownerId = `${USER_OWNER}-scope-${scopeType}`;
      const scopeId = scopeType === 'company' ? undefined : `${scopeType}-scope-${randomUUID()}`;
      const { organizationId, setId } = await createProgramCycleAndSet(ownerId, scopeType, scopeType === 'company' ? undefined : scopeId);
      // 'company' scope_id must equal organizationId per D4 — createOkrSet's
      // own contract; re-derive it the same way if scopeId was left undefined.
      const objective = await createObjective({
        setId,
        organizationId,
        ownerUserId: ownerId,
        title: `Scope fixture Objective (${scopeType})`,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-${scopeType}-${randomUUID()}`,
      });
      await addKeyResults(objective.result.objectiveId, organizationId, ownerId, 1);

      const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
        setId,
      ]);
      let caught: unknown;
      try {
        await submitOkrSetForApproval({
          setId,
          organizationId,
          expectedVersion: setRow.rows[0].row_version,
          actorUserId: ownerId,
          actorEffectiveRole: 'member',
          idempotencyKey: `submit-scope-${scopeType}-${randomUUID()}`,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught, `scope_type=${scopeType} should be blocked at 1 KR, same as every other scope`).toBeInstanceOf(
        OkrSetNotReadyForSubmissionError
      );
    }
  });
});
