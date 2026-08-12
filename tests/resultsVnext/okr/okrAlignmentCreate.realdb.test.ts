/**
 * OKR-E005 — `proposeAlignment`: self-loop rejection, source-Owner
 * enforcement, propose-time target-visibility check, and the D3-shaped
 * dedupe-slot race, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §A/§E.
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
const ORG_PREFIX = `okr-e005-create-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-create-admin-${tag}`;
const USER_A = `okr-e005-create-owner-a-${tag}`;
const USER_B = `okr-e005-create-owner-b-${tag}`;
const USER_D = `okr-e005-create-owner-d-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type AlignmentCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let narrowOkrSetVisibility: SetCommandsModule['narrowOkrSetVisibility'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let OkrAlignmentValidationError: AlignmentCommandsModule['OkrAlignmentValidationError'];
let OkrAlignmentNotOwnerError: AlignmentCommandsModule['OkrAlignmentNotOwnerError'];
let OkrAlignmentVisibilityDeniedError: AlignmentCommandsModule['OkrAlignmentVisibilityDeniedError'];
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

describe('OKR-E005 — proposeAlignment: self-loop / owner / visibility / dedupe-race (real Postgres)', () => {
  let organizationId: string;
  let setId: string;
  let restrictedSetId: string;
  let objectiveA: string;
  let objectiveB: string;
  let objectiveDRestricted: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Alignment create realdb tests did NOT run. This run is not evidence.');
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
    narrowOkrSetVisibility = setCommands.narrowOkrSetVisibility;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    OkrAlignmentValidationError = alignmentCommands.OkrAlignmentValidationError;
    OkrAlignmentNotOwnerError = alignmentCommands.OkrAlignmentNotOwnerError;
    OkrAlignmentVisibilityDeniedError = alignmentCommands.OkrAlignmentVisibilityDeniedError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'Alignment-create fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: program.result.programId,
      organizationId,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycle = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Alignment-create fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const set = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_ADMIN,
      title: 'Alignment-create fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    setId = set.result.set.setId;

    const objA = await createObjective({
      setId,
      organizationId,
      ownerUserId: USER_A,
      title: 'Objective A (source)',
      createdBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveA = objA.result.objectiveId;

    const objB = await createObjective({
      setId,
      organizationId,
      ownerUserId: USER_B,
      title: 'Objective B (target)',
      createdBy: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveB = objB.result.objectiveId;

    // Second Set, same Cycle, narrowed to RESTRICTED_ACL with no grant to
    // USER_A — proves the propose-time target-visibility check (design §E).
    const restrictedSet = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_D,
      ownerUserId: USER_D,
      title: 'Alignment-create fixture restricted Set',
      createdBy: USER_D,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-restricted-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    restrictedSetId = restrictedSet.result.set.setId;
    await narrowOkrSetVisibility({
      setId: restrictedSetId,
      organizationId,
      expectedVersion: restrictedSet.result.set.rowVersion,
      visibilityMode: 'RESTRICTED_ACL',
      actorUserId: USER_D,
      actorEffectiveRole: 'member',
      idempotencyKey: `narrow-restricted-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const objD = await createObjective({
      setId: restrictedSetId,
      organizationId,
      ownerUserId: USER_D,
      title: 'Objective D (restricted target)',
      createdBy: USER_D,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-d-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveDRestricted = objD.result.objectiveId;
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

  itDB('rejects a self-loop (source === target) with OkrAlignmentValidationError code SELF_LOOP', async () => {
    await expect(
      proposeAlignment({
        organizationId,
        sourceObjectiveId: objectiveA,
        targetObjectiveId: objectiveA,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-self-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrAlignmentValidationError);

    try {
      await proposeAlignment({
        organizationId,
        sourceObjectiveId: objectiveA,
        targetObjectiveId: objectiveA,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-self-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect.unreachable('expected proposeAlignment to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OkrAlignmentValidationError);
      expect((err as InstanceType<typeof OkrAlignmentValidationError>).code).toBe('SELF_LOOP');
    }
  });

  itDB(
    'rejects a proposer who is not the SOURCE Objective\'s Owner with OkrAlignmentNotOwnerError code NOT_SOURCE_OWNER',
    async () => {
      try {
        await proposeAlignment({
          organizationId,
          sourceObjectiveId: objectiveA,
          targetObjectiveId: objectiveB,
          proposedBy: USER_B, // B is NOT A's owner
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-not-owner-${randomUUID()}`,
        });
        expect.unreachable('expected proposeAlignment to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(OkrAlignmentNotOwnerError);
        expect((err as InstanceType<typeof OkrAlignmentNotOwnerError>).code).toBe('NOT_SOURCE_OWNER');
      }
    }
  );

  itDB(
    'rejects a propose whose TARGET is not visible to the proposer with OkrAlignmentVisibilityDeniedError (design §E)',
    async () => {
      try {
        await proposeAlignment({
          organizationId,
          sourceObjectiveId: objectiveA,
          targetObjectiveId: objectiveDRestricted,
          proposedBy: USER_A, // has no ACL grant on the RESTRICTED_ACL Set D lives in
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-no-vis-${randomUUID()}`,
        });
        expect.unreachable('expected proposeAlignment to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(OkrAlignmentVisibilityDeniedError);
      }

      // Sanity: no alignment row was left behind by the rejected attempt.
      const rows = await client.query(
        `SELECT alignment_id FROM okr_vnext_alignments WHERE organization_id = $1 AND source_objective_id = $2 AND target_objective_id = $3`,
        [organizationId, objectiveA, objectiveDRestricted]
      );
      expect(rows.rowCount).toBe(0);
    }
  );

  itDB(
    'D3-shaped dedupe-slot race: two concurrent proposeAlignment calls for the SAME (source, target) resolve to the SAME alignment row, only one created:true',
    async () => {
      const [first, second] = await Promise.all([
        proposeAlignment({
          organizationId,
          sourceObjectiveId: objectiveA,
          targetObjectiveId: objectiveB,
          proposedBy: USER_A,
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-race-1-${randomUUID()}`,
        }),
        proposeAlignment({
          organizationId,
          sourceObjectiveId: objectiveA,
          targetObjectiveId: objectiveB,
          proposedBy: USER_A,
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-race-2-${randomUUID()}`,
        }),
      ]);

      expect(first.result.alignment.alignmentId).toBe(second.result.alignment.alignmentId);
      const createdFlags = [first.result.created, second.result.created].sort();
      expect(createdFlags).toEqual([false, true]);

      const rows = await client.query(
        `SELECT alignment_id FROM okr_vnext_alignments
          WHERE organization_id = $1 AND source_objective_id = $2 AND target_objective_id = $3
            AND status IN ('proposed','accepted')`,
        [organizationId, objectiveA, objectiveB]
      );
      expect(rows.rowCount).toBe(1);
    }
  );
});
