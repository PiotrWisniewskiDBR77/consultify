/**
 * OKR-E003 — `cancelObjective`: guarded status transition, and the literal
 * §-IO item 8 / D-E3-8 no-cascade proof — a KeyResult in an "on_track" or
 * "at_risk" (non-cancelled) state SURVIVES its parent Objective's
 * cancellation, never auto-cancelled — against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §10.4. This is
 * exactly the legacy `okr_objectives.parent_id` cascade-rollup pattern this
 * program exists to unwind (plan §3.2) — the test below is the concrete,
 * checkable proof that OKR-E003 does NOT reproduce it.
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
const ORG_PREFIX = `okr-e003-objlife-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-objlife-admin-${tag}`;
const USER_OWNER = `okr-e003-objlife-owner-${tag}`;

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
let createObjective: ObjectiveCommandsModule['createObjective'];
let cancelObjective: ObjectiveCommandsModule['cancelObjective'];
let OkrObjectiveValidationError: ObjectiveCommandsModule['OkrObjectiveValidationError'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let updateKeyResult: KeyResultCommandsModule['updateKeyResult'];
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

async function createProgramCycleAndSet(ownerId: string): Promise<{ organizationId: string; setId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Objective-lifecycle fixture Program',
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
    name: 'Objective-lifecycle fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  const set = await createOkrSet({
    organizationId,
    programId: created.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: ownerId,
    ownerUserId: ownerId,
    title: 'Objective-lifecycle fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  return { organizationId, setId: set.result.set.setId };
}

describe('OKR-E003 cancelObjective — guarded transition, NO cascade to child KeyResults (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Objective lifecycle realdb tests did NOT run. This run is not evidence.');
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
    cancelObjective = objectiveCommands.cancelObjective;
    OkrObjectiveValidationError = objectiveCommands.OkrObjectiveValidationError;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;
    updateKeyResult = keyResultCommands.updateKeyResult;

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
  // §-IO item 8 / D-E3-8: the literal no-cascade proof
  // ==========================================

  itDB(
    'a KeyResult in "on_track" status SURVIVES its parent Objective\'s cancellation — no cascade, not even a side-effect field change',
    async () => {
      const ownerId = `${USER_OWNER}-nocascade-ontrack`;
      const { organizationId, setId } = await createProgramCycleAndSet(ownerId);
      const objective = await createObjective({
        setId,
        organizationId,
        ownerUserId: ownerId,
        title: 'No-cascade fixture Objective',
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-${randomUUID()}`,
      });
      const keyResult = await createKeyResult({
        objectiveId: objective.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: 'Survives-cancellation fixture KR',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-${randomUUID()}`,
      });
      // Move the KR to "on_track" — an explicit, owner-declared non-default
      // status (§-IO item 9) — before cancelling the parent.
      const onTrack = await updateKeyResult({
        keyResultId: keyResult.result.keyResultId,
        organizationId,
        expectedVersion: keyResult.result.rowVersion,
        status: 'on_track',
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `update-kr-ontrack-${randomUUID()}`,
      });
      expect(onTrack.result.status).toBe('on_track');

      const beforeCancelRow = await client.query(
        `SELECT status, row_version, progress, updated_at FROM okr_vnext_key_results WHERE key_result_id = $1`,
        [keyResult.result.keyResultId]
      );

      // NOTE: the Objective's own row_version is NOT still 1 here —
      // recomputeObjectiveRollup bumps it on every KR create/update (both
      // createKeyResult above and the updateKeyResult status-change just
      // above ran a rollup recompute). Re-read the CURRENT version rather
      // than relying on the stale value captured at createObjective time.
      const objectiveRowVersion = await client.query<{ row_version: number }>(
        `SELECT row_version FROM okr_vnext_objectives WHERE objective_id = $1`,
        [objective.result.objectiveId]
      );
      const cancelled = await cancelObjective({
        objectiveId: objective.result.objectiveId,
        organizationId,
        expectedVersion: objectiveRowVersion.rows[0].row_version,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `cancel-obj-${randomUUID()}`,
      });
      expect(cancelled.result.status).toBe('cancelled');

      // The KR row is completely untouched — same status, same
      // row_version, same updated_at. Not merely "not cancelled" but
      // provably not written to AT ALL by cancelObjective.
      const afterCancelRow = await client.query(
        `SELECT status, row_version, progress, updated_at FROM okr_vnext_key_results WHERE key_result_id = $1`,
        [keyResult.result.keyResultId]
      );
      expect(afterCancelRow.rows[0].status).toBe('on_track');
      expect(afterCancelRow.rows[0].status).not.toBe('cancelled');
      expect(afterCancelRow.rows[0].row_version).toBe(beforeCancelRow.rows[0].row_version);
      expect(afterCancelRow.rows[0].updated_at.getTime()).toBe(beforeCancelRow.rows[0].updated_at.getTime());
    }
  );

  itDB(
    'a KeyResult in "at_risk" status also SURVIVES cancellation — the no-cascade guarantee is not status-specific',
    async () => {
      const ownerId = `${USER_OWNER}-nocascade-atrisk`;
      const { organizationId, setId } = await createProgramCycleAndSet(ownerId);
      const objective = await createObjective({
        setId,
        organizationId,
        ownerUserId: ownerId,
        title: 'No-cascade at_risk fixture Objective',
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-${randomUUID()}`,
      });
      const keyResult = await createKeyResult({
        objectiveId: objective.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: 'At-risk survives-cancellation fixture KR',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 1,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-${randomUUID()}`,
      });
      const atRisk = await updateKeyResult({
        keyResultId: keyResult.result.keyResultId,
        organizationId,
        expectedVersion: keyResult.result.rowVersion,
        status: 'at_risk',
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `update-kr-atrisk-${randomUUID()}`,
      });
      expect(atRisk.result.status).toBe('at_risk');

      const objectiveRowVersion = await client.query<{ row_version: number }>(
        `SELECT row_version FROM okr_vnext_objectives WHERE objective_id = $1`,
        [objective.result.objectiveId]
      );
      await cancelObjective({
        objectiveId: objective.result.objectiveId,
        organizationId,
        expectedVersion: objectiveRowVersion.rows[0].row_version,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `cancel-obj-atrisk-${randomUUID()}`,
      });

      const krAfter = await client.query(`SELECT status FROM okr_vnext_key_results WHERE key_result_id = $1`, [
        keyResult.result.keyResultId,
      ]);
      expect(krAfter.rows[0].status).toBe('at_risk');
    }
  );

  // ==========================================
  // Guarded transition
  // ==========================================

  itDB('cancelObjective rejects from an already-"cancelled" Objective', async () => {
    const ownerId = `${USER_OWNER}-doublecancel`;
    const { organizationId, setId } = await createProgramCycleAndSet(ownerId);
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: ownerId,
      title: 'Double-cancel fixture Objective',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    const firstCancel = await cancelObjective({
      objectiveId: objective.result.objectiveId,
      organizationId,
      expectedVersion: objective.result.rowVersion,
      actorUserId: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `cancel-obj-1-${randomUUID()}`,
    });
    expect(firstCancel.result.status).toBe('cancelled');

    let caught: unknown;
    try {
      await cancelObjective({
        objectiveId: objective.result.objectiveId,
        organizationId,
        expectedVersion: firstCancel.result.rowVersion,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `cancel-obj-2-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrObjectiveValidationError);
    expect((caught as InstanceType<typeof OkrObjectiveValidationError>).code).toBe('INVALID_TRANSITION');
  });
});
