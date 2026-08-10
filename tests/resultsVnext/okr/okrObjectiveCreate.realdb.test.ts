/**
 * OKR-E003 — `createObjective`: ambition_type command-layer gating (both
 * branches: policy-enabled vs. policy-disabled), server-assigned sort_order,
 * and the Set-editability guard (`assertSetEditableForUpdate`) — against a
 * REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §10.2, D-E3-3,
 * D-E3-12. Literal OKR-F-007-AC-01 proof.
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
const ORG_PREFIX = `okr-e003-objcreate-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-objcreate-admin-${tag}`;
const USER_OWNER = `okr-e003-objcreate-owner-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_CANCEL_SPEC: SetCommandsModule['OKR_SET_CANCEL_SPEC'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let OkrObjectiveValidationError: ObjectiveCommandsModule['OkrObjectiveValidationError'];
let OkrObjectiveSetNotEditableError: ObjectiveCommandsModule['OkrObjectiveSetNotEditableError'];
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

/** `committedVsAspirationalEnabled` defaults to `true` (E001 DDL) — pass
 * `false` to exercise D-E3-3's disabled branch. */
async function createProgramCycleAndDraftSet(
  ownerId: string,
  committedVsAspirationalEnabled?: boolean
): Promise<{ organizationId: string; setId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Objective-create fixture Program',
    // NOTE: createProgram merges `{...DEFAULTS, ...policyOverrides}` — an
    // explicit `committedVsAspirationalEnabled: undefined` key would
    // overwrite the DEFAULT's `true` with `undefined` (object spread keeps
    // the key even when its value is undefined), NOT fall back to the
    // default. Only include the key when a real boolean was requested.
    ...(committedVsAspirationalEnabled === undefined ? {} : { committedVsAspirationalEnabled }),
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
    name: 'Objective-create fixture Cycle',
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
    title: 'Objective-create fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  return { organizationId, setId: set.result.set.setId };
}

describe('OKR-E003 createObjective — ambition_type gating, sort_order, Set-editability guard (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR createObjective realdb tests did NOT run. This run is not evidence.');
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
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_CANCEL_SPEC = setCommands.OKR_SET_CANCEL_SPEC;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;
    OkrObjectiveValidationError = objectiveCommands.OkrObjectiveValidationError;
    OkrObjectiveSetNotEditableError = objectiveCommands.OkrObjectiveSetNotEditableError;

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
  // D-E3-3: ambition_type gating — both branches
  // ==========================================

  itDB('committed_vs_aspirational_enabled=true (default): "committed"/"aspirational" are both accepted', async () => {
    const { organizationId, setId } = await createProgramCycleAndDraftSet(`${USER_OWNER}-enabled`);

    const committed = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-enabled`,
      title: 'Committed objective',
      ambitionType: 'committed',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-obj-committed-${randomUUID()}`,
    });
    expect(committed.result.ambitionType).toBe('committed');

    const aspirational = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-enabled`,
      title: 'Aspirational objective',
      ambitionType: 'aspirational',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-obj-aspirational-${randomUUID()}`,
    });
    expect(aspirational.result.ambitionType).toBe('aspirational');
  });

  itDB(
    'committed_vs_aspirational_enabled=false: "committed"/"aspirational" both REJECTED with AMBITION_TYPE_DISABLED; "standard" still accepted',
    async () => {
      const { organizationId, setId } = await createProgramCycleAndDraftSet(`${USER_OWNER}-disabled`, false);

      let caughtCommitted: unknown;
      try {
        await createObjective({
          setId,
          organizationId,
          ownerUserId: `${USER_OWNER}-disabled`,
          title: 'Should be rejected (committed)',
          ambitionType: 'committed',
          createdBy: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `create-obj-committed-disabled-${randomUUID()}`,
        });
      } catch (err) {
        caughtCommitted = err;
      }
      expect(caughtCommitted).toBeInstanceOf(OkrObjectiveValidationError);
      expect((caughtCommitted as InstanceType<typeof OkrObjectiveValidationError>).code).toBe('AMBITION_TYPE_DISABLED');

      let caughtAspirational: unknown;
      try {
        await createObjective({
          setId,
          organizationId,
          ownerUserId: `${USER_OWNER}-disabled`,
          title: 'Should be rejected (aspirational)',
          ambitionType: 'aspirational',
          createdBy: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `create-obj-aspirational-disabled-${randomUUID()}`,
        });
      } catch (err) {
        caughtAspirational = err;
      }
      expect(caughtAspirational).toBeInstanceOf(OkrObjectiveValidationError);
      expect((caughtAspirational as InstanceType<typeof OkrObjectiveValidationError>).code).toBe('AMBITION_TYPE_DISABLED');

      const standard = await createObjective({
        setId,
        organizationId,
        ownerUserId: `${USER_OWNER}-disabled`,
        title: 'Standard objective (always allowed)',
        ambitionType: 'standard',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-obj-standard-disabled-${randomUUID()}`,
      });
      expect(standard.result.ambitionType).toBe('standard');

      // No event/row leaked from the two rejected attempts.
      const rows = await client.query(`SELECT ambition_type FROM okr_vnext_objectives WHERE set_id = $1`, [setId]);
      expect(rows.rows.map((r) => r.ambition_type)).toEqual(['standard']);
    }
  );

  // ==========================================
  // D-E3-12: server-assigned sort_order
  // ==========================================

  itDB('sort_order is server-assigned, incrementing by 1 per Objective on the same Set', async () => {
    const { organizationId, setId } = await createProgramCycleAndDraftSet(`${USER_OWNER}-sortorder`);

    const first = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-sortorder`,
      title: 'First',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-obj-sort-1-${randomUUID()}`,
    });
    const second = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-sortorder`,
      title: 'Second',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-obj-sort-2-${randomUUID()}`,
    });
    const third = await createObjective({
      setId,
      organizationId,
      ownerUserId: `${USER_OWNER}-sortorder`,
      title: 'Third',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-obj-sort-3-${randomUUID()}`,
    });
    expect(first.result.sortOrder).toBe(1);
    expect(second.result.sortOrder).toBe(2);
    expect(third.result.sortOrder).toBe(3);
  });

  // ==========================================
  // Set-editability guard
  // ==========================================

  itDB('rejects with OkrObjectiveSetNotEditableError when the Set is not draft/changes_requested', async () => {
    const { organizationId, setId } = await createProgramCycleAndDraftSet(`${USER_OWNER}-noteditable`);

    // Cancel the Set — a terminal, non-editable status.
    const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [setId]);
    await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId,
      organizationId,
      expectedVersion: setRow.rows[0].row_version,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-set-noteditable-${randomUUID()}`,
    });

    let caught: unknown;
    try {
      await createObjective({
        setId,
        organizationId,
        ownerUserId: `${USER_OWNER}-noteditable`,
        title: 'Should be rejected — Set is cancelled',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-obj-noteditable-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrObjectiveSetNotEditableError);
    expect((caught as InstanceType<typeof OkrObjectiveSetNotEditableError>).details.status).toBe('cancelled');
  });
});
