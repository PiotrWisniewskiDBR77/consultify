/**
 * OKR-E005 — OKR-F-016-AC-01's cycle/org compatibility boundary, against a
 * REAL Postgres: cross-Cycle rejection (command-layer pre-check AND the
 * real DB `CHECK (source_cycle_id = target_cycle_id)`, exercised directly
 * to prove it is a REAL constraint, not just app-code validation) and
 * cross-organization rejection (enforced by strict `organization_id`
 * scoping on every lookup, per design §C).
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §C.
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
const ORG_PREFIX = `okr-e005-bound-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-bound-admin-${tag}`;
const USER_OWNER = `okr-e005-bound-owner-${tag}`;

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
let createObjective: ObjectiveCommandsModule['createObjective'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let OkrAlignmentCycleMismatchError: AlignmentCommandsModule['OkrAlignmentCycleMismatchError'];
let OkrObjectiveNotFoundError: ObjectiveCommandsModule['OkrObjectiveNotFoundError'];
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

describe('OKR-E005 — cycle/org compatibility boundary (real Postgres)', () => {
  let organizationId: string;
  let secondOrganizationId: string;
  let cycleOneId: string;
  let cycleTwoId: string;
  let setInCycleOne: string;
  let setInCycleTwo: string;
  let objectiveInCycleOne: string;
  let objectiveInCycleTwo: string;
  let objectiveInSecondOrg: string;

  const orgLikeAll = () => `${ORG_PREFIX}%`;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Alignment cycle-boundary realdb tests did NOT run. This run is not evidence.');
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
    OkrObjectiveNotFoundError = objectiveCommands.OkrObjectiveNotFoundError;

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    OkrAlignmentCycleMismatchError = alignmentCommands.OkrAlignmentCycleMismatchError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    secondOrganizationId = freshOrgId();

    // --- org #1: one Program, TWO Cycles, one Set + one Objective per Cycle.
    const program = await createProgram({
      organizationId,
      name: 'Cycle-boundary fixture Program',
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

    const cycleOne = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Cycle-boundary fixture Cycle One',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-one-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    cycleOneId = cycleOne.result.cycleId;

    const cycleTwo = await createCycle({
      organizationId,
      programId: program.result.programId,
      name: 'Cycle-boundary fixture Cycle Two',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      draftOpenAt: '2026-03-15T00:00:00.000Z',
      submissionDueAt: '2026-03-28T00:00:00.000Z',
      activeStartAt: '2026-04-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-06-20T00:00:00.000Z',
      reviewOpenAt: '2026-06-21T00:00:00.000Z',
      reflectionDueAt: '2026-06-25T00:00:00.000Z',
      closeAt: '2026-06-30T00:00:00.000Z',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-two-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    cycleTwoId = cycleTwo.result.cycleId;

    const setOne = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycleOneId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_OWNER,
      title: 'Cycle-boundary fixture Set One',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-one-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    setInCycleOne = setOne.result.set.setId;

    const setTwo = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycleTwoId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_OWNER,
      title: 'Cycle-boundary fixture Set Two',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-two-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    setInCycleTwo = setTwo.result.set.setId;

    const objOne = await createObjective({
      setId: setInCycleOne,
      organizationId,
      ownerUserId: USER_OWNER,
      title: 'Objective in Cycle One',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-one-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveInCycleOne = objOne.result.objectiveId;

    const objTwo = await createObjective({
      setId: setInCycleTwo,
      organizationId,
      ownerUserId: USER_OWNER,
      title: 'Objective in Cycle Two',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-two-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveInCycleTwo = objTwo.result.objectiveId;

    // --- org #2: a completely separate Program/Cycle/Set/Objective, for
    // the cross-org test.
    const programTwo = await createProgram({
      organizationId: secondOrganizationId,
      name: 'Cycle-boundary fixture Program (second org)',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-org2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await publishProgram({
      programId: programTwo.result.programId,
      organizationId: secondOrganizationId,
      expectedVersion: programTwo.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-org2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cycleOrg2 = await createCycle({
      organizationId: secondOrganizationId,
      programId: programTwo.result.programId,
      name: 'Cycle-boundary fixture Cycle (second org)',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-org2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const setOrg2 = await createOkrSet({
      organizationId: secondOrganizationId,
      programId: programTwo.result.programId,
      cycleId: cycleOrg2.result.cycleId,
      scopeType: 'company',
      scopeId: secondOrganizationId,
      ownerUserId: USER_OWNER,
      title: 'Cycle-boundary fixture Set (second org)',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-org2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const objOrg2 = await createObjective({
      setId: setOrg2.result.set.setId,
      organizationId: secondOrganizationId,
      ownerUserId: USER_OWNER,
      title: 'Objective in second org',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-org2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    objectiveInSecondOrg = objOrg2.result.objectiveId;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const orgLike of [orgLikeAll()]) {
      await client.query(`DELETE FROM okr_vnext_alignments WHERE organization_id LIKE $1`, [orgLike]);
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
    }
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

  itDB(
    'command-layer pre-check rejects cross-Cycle alignment with OkrAlignmentCycleMismatchError before any INSERT is attempted',
    async () => {
      await expect(
        proposeAlignment({
          organizationId,
          sourceObjectiveId: objectiveInCycleOne,
          targetObjectiveId: objectiveInCycleTwo,
          proposedBy: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-cross-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toThrow(OkrAlignmentCycleMismatchError);

      const rows = await client.query(
        `SELECT alignment_id FROM okr_vnext_alignments WHERE organization_id = $1 AND source_objective_id = $2 AND target_objective_id = $3`,
        [organizationId, objectiveInCycleOne, objectiveInCycleTwo]
      );
      expect(rows.rowCount).toBe(0);
    }
  );

  itDB(
    'the REAL DB CHECK (source_cycle_id = target_cycle_id) rejects a mismatched row even bypassing the command layer entirely (direct INSERT)',
    async () => {
      await expect(
        client.query(
          `INSERT INTO okr_vnext_alignments
             (organization_id, source_objective_id, target_objective_id,
              source_cycle_id, target_cycle_id, proposed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [organizationId, objectiveInCycleOne, objectiveInCycleTwo, cycleOneId, cycleTwoId, USER_OWNER]
        )
      ).rejects.toThrow(/violates check constraint/i);
    }
  );

  itDB(
    'a SAME-Cycle alignment (both Objectives in Cycle One) is accepted by both the command layer and the DB CHECK',
    async () => {
      const objThree = await createObjective({
        setId: setInCycleOne,
        organizationId,
        ownerUserId: USER_OWNER,
        title: 'Second Objective in Cycle One',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-three-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const outcome = await proposeAlignment({
        organizationId,
        sourceObjectiveId: objectiveInCycleOne,
        targetObjectiveId: objThree.result.objectiveId,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-same-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(outcome.result.created).toBe(true);
      expect(outcome.result.alignment.sourceCycleId).toBe(cycleOneId);
      expect(outcome.result.alignment.targetCycleId).toBe(cycleOneId);
    }
  );

  itDB(
    'cross-organization alignment is rejected: an Objective from a different org is simply not found under the caller\'s organizationId scope (OkrObjectiveNotFoundError)',
    async () => {
      await expect(
        proposeAlignment({
          organizationId, // org #1 — objectiveInSecondOrg does not exist under this scope
          sourceObjectiveId: objectiveInCycleOne,
          targetObjectiveId: objectiveInSecondOrg,
          proposedBy: USER_OWNER,
          actorEffectiveRole: 'member',
          idempotencyKey: `propose-cross-org-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toThrow(OkrObjectiveNotFoundError);

      const rows = await client.query(
        `SELECT alignment_id FROM okr_vnext_alignments WHERE source_objective_id = $1 AND target_objective_id = $2`,
        [objectiveInCycleOne, objectiveInSecondOrg]
      );
      expect(rows.rowCount).toBe(0);
    }
  );
});
