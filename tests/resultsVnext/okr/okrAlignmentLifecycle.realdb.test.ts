/**
 * OKR-E005 — Alignment lifecycle transitions
 * (`proposed -> accepted | rejected`, `proposed|accepted -> removed`),
 * against a REAL Postgres: full status/timestamp bookkeeping, invalid
 * transitions rejected, the dedup-slot-freed-on-reject/removed contract
 * (design §A: "a fresh proposal is allowed after a prior one was rejected
 * or removed"), `removeAlignment`'s either-endpoint-Owner authority
 * (design §J item 5), and CAS/not-found behavior via the shared
 * `executeAtomicCommand` helper.
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §A/§H.
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
const ORG_PREFIX = `okr-e005-lifecycle-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e005-lifecycle-admin-${tag}`;
const USER_A = `okr-e005-lifecycle-owner-a-${tag}`;
const USER_B = `okr-e005-lifecycle-owner-b-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type AlignmentCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type AtomicWriteModule = typeof import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let acceptAlignment: AlignmentCommandsModule['acceptAlignment'];
let rejectAlignment: AlignmentCommandsModule['rejectAlignment'];
let removeAlignment: AlignmentCommandsModule['removeAlignment'];
let OkrAlignmentValidationError: AlignmentCommandsModule['OkrAlignmentValidationError'];
let OkrAlignmentNotOwnerError: AlignmentCommandsModule['OkrAlignmentNotOwnerError'];
let AtomicWriteConflictError: AtomicWriteModule['AtomicWriteConflictError'];
let AtomicWriteAggregateNotFoundError: AtomicWriteModule['AtomicWriteAggregateNotFoundError'];
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

describe('OKR-E005 — Alignment lifecycle transitions (real Postgres)', () => {
  let organizationId: string;
  let setId: string;

  async function makeObjective(ownerUserId: string, title: string): Promise<string> {
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId,
      title,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
    });
    return objective.result.objectiveId;
  }

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Alignment lifecycle realdb tests did NOT run. This run is not evidence.');
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

    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    proposeAlignment = alignmentCommands.proposeAlignment;
    acceptAlignment = alignmentCommands.acceptAlignment;
    rejectAlignment = alignmentCommands.rejectAlignment;
    removeAlignment = alignmentCommands.removeAlignment;
    OkrAlignmentValidationError = alignmentCommands.OkrAlignmentValidationError;
    OkrAlignmentNotOwnerError = alignmentCommands.OkrAlignmentNotOwnerError;

    const atomicWrite: AtomicWriteModule = await import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
    AtomicWriteConflictError = atomicWrite.AtomicWriteConflictError;
    AtomicWriteAggregateNotFoundError = atomicWrite.AtomicWriteAggregateNotFoundError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    if (!reachable) return;

    organizationId = freshOrgId();
    const program = await createProgram({
      organizationId,
      name: 'Alignment-lifecycle fixture Program',
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
      name: 'Alignment-lifecycle fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
    });
    const set = await createOkrSet({
      organizationId,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'company',
      scopeId: organizationId,
      ownerUserId: USER_ADMIN,
      title: 'Alignment-lifecycle fixture Set',
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

  itDB('propose -> accept: status becomes accepted, responded_by/responded_at set, row_version advances', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A1');
    const b = await makeObjective(USER_B, 'Lifecycle B1');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    expect(propose.result.alignment.status).toBe('proposed');
    expect(propose.result.alignment.rowVersion).toBe(1);

    const accept = await acceptAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `accept-${randomUUID()}`,
    });
    expect(accept.result.status).toBe('accepted');
    expect(accept.result.respondedBy).toBe(USER_B);
    expect(accept.result.respondedAt).not.toBeNull();
    expect(accept.result.rowVersion).toBe(2);
  });

  itDB('propose -> reject: status becomes rejected, response_reason recorded', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A2');
    const b = await makeObjective(USER_B, 'Lifecycle B2');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    const reject = await rejectAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      responseReason: 'wrong scope',
      idempotencyKey: `reject-${randomUUID()}`,
    });
    expect(reject.result.status).toBe('rejected');
    expect(reject.result.responseReason).toBe('wrong scope');
    expect(reject.result.respondedBy).toBe(USER_B);
  });

  itDB('propose -> remove: withdrawing an unanswered proposal (proposed -> removed) is allowed', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A3');
    const b = await makeObjective(USER_B, 'Lifecycle B3');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    const remove = await removeAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_A, // source Owner withdraws their own unanswered proposal
      actorEffectiveRole: 'member',
      idempotencyKey: `remove-${randomUUID()}`,
    });
    expect(remove.result.status).toBe('removed');
    expect(remove.result.removedBy).toBe(USER_A);
  });

  itDB('propose -> accept -> remove: the TARGET Owner may also remove an already-accepted edge (either-endpoint authority)', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A4');
    const b = await makeObjective(USER_B, 'Lifecycle B4');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    const accept = await acceptAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `accept-${randomUUID()}`,
    });
    const remove = await removeAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: accept.result.rowVersion,
      actorUserId: USER_B, // TARGET Owner removes
      actorEffectiveRole: 'member',
      idempotencyKey: `remove-${randomUUID()}`,
    });
    expect(remove.result.status).toBe('removed');
    expect(remove.result.removedBy).toBe(USER_B);
  });

  itDB('removeAlignment rejects a caller who is neither the source nor target Owner (OkrAlignmentNotOwnerError, NOT_OWNER)', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A5');
    const b = await makeObjective(USER_B, 'Lifecycle B5');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    try {
      await removeAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: propose.result.alignment.rowVersion,
        actorUserId: USER_ADMIN, // neither source nor target owner
        actorEffectiveRole: 'admin',
        idempotencyKey: `remove-${randomUUID()}`,
      });
      expect.unreachable('expected removeAlignment to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OkrAlignmentNotOwnerError);
      expect((err as InstanceType<typeof OkrAlignmentNotOwnerError>).code).toBe('NOT_OWNER');
    }
  });

  itDB('invalid transitions are rejected: accepting an already-accepted alignment throws NOT_PROPOSED', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A6');
    const b = await makeObjective(USER_B, 'Lifecycle B6');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    const accept = await acceptAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `accept-${randomUUID()}`,
    });
    try {
      await acceptAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: accept.result.rowVersion,
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-again-${randomUUID()}`,
      });
      expect.unreachable('expected acceptAlignment to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OkrAlignmentValidationError);
      expect((err as InstanceType<typeof OkrAlignmentValidationError>).code).toBe('NOT_PROPOSED');
    }
  });

  itDB('invalid transitions are rejected: removing an already-rejected alignment throws NOT_REMOVABLE', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A7');
    const b = await makeObjective(USER_B, 'Lifecycle B7');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    const reject = await rejectAlignment({
      alignmentId: propose.result.alignment.alignmentId,
      organizationId,
      expectedVersion: propose.result.alignment.rowVersion,
      actorUserId: USER_B,
      actorEffectiveRole: 'member',
      idempotencyKey: `reject-${randomUUID()}`,
    });
    try {
      await removeAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: reject.result.rowVersion,
        actorUserId: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `remove-rejected-${randomUUID()}`,
      });
      expect.unreachable('expected removeAlignment to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OkrAlignmentValidationError);
      expect((err as InstanceType<typeof OkrAlignmentValidationError>).code).toBe('NOT_REMOVABLE');
    }
  });

  itDB('CAS: a stale expectedVersion is rejected with AtomicWriteConflictError (409 STALE_VERSION)', async () => {
    const a = await makeObjective(USER_A, 'Lifecycle A8');
    const b = await makeObjective(USER_B, 'Lifecycle B8');
    const propose = await proposeAlignment({
      organizationId,
      sourceObjectiveId: a,
      targetObjectiveId: b,
      proposedBy: USER_A,
      actorEffectiveRole: 'member',
      idempotencyKey: `propose-${randomUUID()}`,
    });
    await expect(
      acceptAlignment({
        alignmentId: propose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: propose.result.alignment.rowVersion + 99, // stale/wrong
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-stale-${randomUUID()}`,
      })
    ).rejects.toThrow(AtomicWriteConflictError);
  });

  itDB('accepting a nonexistent alignmentId throws AtomicWriteAggregateNotFoundError (404)', async () => {
    await expect(
      acceptAlignment({
        alignmentId: randomUUID(),
        organizationId,
        expectedVersion: 1,
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-missing-${randomUUID()}`,
      })
    ).rejects.toThrow(AtomicWriteAggregateNotFoundError);
  });

  itDB(
    'dedup-slot freed on REJECT (design §A): after a proposal is rejected, a fresh propose for the SAME (source, target) succeeds as a NEW row',
    async () => {
      const a = await makeObjective(USER_A, 'Lifecycle A9');
      const b = await makeObjective(USER_B, 'Lifecycle B9');

      const firstPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-1-${randomUUID()}`,
      });
      expect(firstPropose.result.created).toBe(true);

      await rejectAlignment({
        alignmentId: firstPropose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: firstPropose.result.alignment.rowVersion,
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `reject-${randomUUID()}`,
      });

      const secondPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-2-${randomUUID()}`,
      });
      expect(secondPropose.result.created).toBe(true);
      expect(secondPropose.result.alignment.alignmentId).not.toBe(firstPropose.result.alignment.alignmentId);
      expect(secondPropose.result.alignment.status).toBe('proposed');
    }
  );

  itDB(
    'dedup-slot freed on REMOVE (design §A): after an accepted edge is removed, a fresh propose for the SAME (source, target) succeeds as a NEW row',
    async () => {
      const a = await makeObjective(USER_A, 'Lifecycle A10');
      const b = await makeObjective(USER_B, 'Lifecycle B10');

      const firstPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-1-${randomUUID()}`,
      });
      const firstAccept = await acceptAlignment({
        alignmentId: firstPropose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: firstPropose.result.alignment.rowVersion,
        actorUserId: USER_B,
        actorEffectiveRole: 'member',
        idempotencyKey: `accept-${randomUUID()}`,
      });
      await removeAlignment({
        alignmentId: firstPropose.result.alignment.alignmentId,
        organizationId,
        expectedVersion: firstAccept.result.rowVersion,
        actorUserId: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `remove-${randomUUID()}`,
      });

      const secondPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-2-${randomUUID()}`,
      });
      expect(secondPropose.result.created).toBe(true);
      expect(secondPropose.result.alignment.alignmentId).not.toBe(firstPropose.result.alignment.alignmentId);
    }
  );

  itDB(
    'while a proposal is still LIVE (proposed/accepted), a duplicate propose for the same pair never creates a second row (D3 dedupe, not just the race case)',
    async () => {
      const a = await makeObjective(USER_A, 'Lifecycle A11');
      const b = await makeObjective(USER_B, 'Lifecycle B11');

      const firstPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-1-${randomUUID()}`,
      });
      expect(firstPropose.result.created).toBe(true);

      const secondPropose = await proposeAlignment({
        organizationId,
        sourceObjectiveId: a,
        targetObjectiveId: b,
        proposedBy: USER_A,
        actorEffectiveRole: 'member',
        idempotencyKey: `propose-2-${randomUUID()}`,
      });
      expect(secondPropose.result.created).toBe(false);
      expect(secondPropose.result.alignment.alignmentId).toBe(firstPropose.result.alignment.alignmentId);
    }
  );
});
