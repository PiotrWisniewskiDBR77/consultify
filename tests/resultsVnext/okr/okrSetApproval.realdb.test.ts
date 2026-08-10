/**
 * OKR-E002 — `approveOkrSet`: self-approval denial (both branches:
 * `submitted_by` and `created_by`), immutable snapshot insert, pointer
 * correctness (`approved_version`/`latest_approved_snapshot_id`), and
 * content-hash stability across reads — against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.5, D8/D10/D11
 * (OKR-F-005-AC-01).
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
const ORG_PREFIX = `okr-e002-approval-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e002-approval-admin-${tag}`;
const USER_OWNER = `okr-e002-approval-owner-${tag}`;
const USER_REVIEWER = `okr-e002-approval-reviewer-${tag}`;
const USER_DELEGATE = `okr-e002-approval-delegate-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type SetRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
type KpiCommandsModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let OkrSetSelfApprovalDeniedError: SetCommandsModule['OkrSetSelfApprovalDeniedError'];
let getOkrSetApprovedSnapshot: SetRepositoryModule['getOkrSetApprovedSnapshot'];
let listOkrSetApprovedSnapshots: SetRepositoryModule['listOkrSetApprovedSnapshots'];
let computeStateHash: KpiCommandsModule['computeStateHash'];
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

async function createProgramAndCycle(): Promise<{ organizationId: string; programId: string; cycleId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Approval fixture Program',
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
    name: 'Approval fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  return { organizationId, programId: created.result.programId, cycleId: cycle.result.cycleId };
}

describe('OKR-E002 approveOkrSet — self-approval denial, snapshot, pointers, hash stability (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Set approval realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_approved_snapshots LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Set schema); refusing to report a green run. ' +
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
    approveOkrSet = setCommands.approveOkrSet;
    OkrSetSelfApprovalDeniedError = setCommands.OkrSetSelfApprovalDeniedError;

    const setRepository: SetRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetRepository.js'
    );
    getOkrSetApprovedSnapshot = setRepository.getOkrSetApprovedSnapshot;
    listOkrSetApprovedSnapshots = setRepository.listOkrSetApprovedSnapshots;

    const kpiCommands: KpiCommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js'
    );
    computeStateHash = kpiCommands.computeStateHash;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(
      `UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(
      `DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
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
  // Self-approval denial — both branches (D10/D11)
  // ==========================================

  itDB('denies approval when approverId matches submitted_by (checked first)', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: `${USER_OWNER}-submitted-branch`,
      ownerUserId: `${USER_OWNER}-submitted-branch`,
      reviewerUserId: USER_REVIEWER,
      title: 'Self-approval submitted_by fixture',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-selfapprove-submitted-${randomUUID()}`,
    });
    const submitted = await submitOkrSetForApproval({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: `${USER_OWNER}-submitted-branch`,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-selfapprove-submitted-${randomUUID()}`,
    });
    expect(submitted.result.submittedBy).toBe(`${USER_OWNER}-submitted-branch`);

    let caught: unknown;
    try {
      await approveOkrSet({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        // Same user who submitted — must be denied even though this user
        // is NOT created_by (created_by = USER_ADMIN here).
        approverId: `${USER_OWNER}-submitted-branch`,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-selfapprove-submitted-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetSelfApprovalDeniedError);
    expect((caught as InstanceType<typeof OkrSetSelfApprovalDeniedError>).details.reasonField).toBe('submitted_by');

    // No snapshot row must have been written by the rejected attempt.
    const snapshots = await client.query(`SELECT snapshot_id FROM okr_vnext_approved_snapshots WHERE set_id = $1`, [
      created.result.set.setId,
    ]);
    expect(snapshots.rowCount).toBe(0);
  });

  itDB('denies approval when approverId matches created_by (submitted_by differs)', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const ownerId = `${USER_OWNER}-created-branch`;
    // created_by = ownerId (the owner creates their own Set).
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      reviewerUserId: USER_REVIEWER,
      title: 'Self-approval created_by fixture',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-selfapprove-created-${randomUUID()}`,
    });
    expect(created.result.set.createdBy).toBe(ownerId);

    // A DELEGATE submits on the owner's behalf — submitted_by = DELEGATE,
    // deliberately different from created_by.
    const submitted = await submitOkrSetForApproval({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: USER_DELEGATE,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-selfapprove-created-${randomUUID()}`,
    });
    expect(submitted.result.submittedBy).toBe(USER_DELEGATE);
    expect(submitted.result.submittedBy).not.toBe(ownerId);

    let caught: unknown;
    try {
      await approveOkrSet({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        // The creator, not the submitter — must still be denied.
        approverId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-selfapprove-created-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrSetSelfApprovalDeniedError);
    expect((caught as InstanceType<typeof OkrSetSelfApprovalDeniedError>).details.reasonField).toBe('created_by');
  });

  itDB('a genuinely different reviewer (neither submitted_by nor created_by) may approve', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const ownerId = `${USER_OWNER}-happy`;
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      reviewerUserId: USER_REVIEWER,
      title: 'Genuine reviewer fixture',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-genuine-${randomUUID()}`,
    });
    const submitted = await submitOkrSetForApproval({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-genuine-${randomUUID()}`,
    });
    const approved = await approveOkrSet({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: submitted.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-genuine-${randomUUID()}`,
    });
    expect(approved.result.set.status).toBe('approved');
  });

  // ==========================================
  // Snapshot insert, pointer correctness, content-hash stability
  // ==========================================

  itDB(
    'approveOkrSet inserts an immutable snapshot (sequence_number=1), pins approved_version/' +
      'latest_approved_snapshot_id, and the content_hash is stable across independent reads',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const ownerId = `${USER_OWNER}-snapshot`;
      const created = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        scopeType: 'individual',
        scopeId: ownerId,
        ownerUserId: ownerId,
        reviewerUserId: USER_REVIEWER,
        title: 'Snapshot pointer fixture',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-snapshot-${randomUUID()}`,
      });
      const submitted = await submitOkrSetForApproval({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-snapshot-${randomUUID()}`,
      });
      const approved = await approveOkrSet({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-snapshot-${randomUUID()}`,
      });

      expect(approved.result.snapshot.sequenceNumber).toBe(1);
      expect(approved.result.set.approvedVersion).toBe(1);
      expect(approved.result.set.latestApprovedSnapshotId).toBe(approved.result.snapshot.snapshotId);

      // D8: objectives:[] placeholder, structurally present.
      const dbRow = await client.query<{
        content_hash: string;
        snapshot_payload: { set: { setId: string }; objectives: unknown[] };
        sequence_number: number;
      }>(`SELECT content_hash, snapshot_payload, sequence_number FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`, [
        approved.result.snapshot.snapshotId,
      ]);
      expect(dbRow.rowCount).toBe(1);
      expect(dbRow.rows[0].sequence_number).toBe(1);
      expect(dbRow.rows[0].snapshot_payload.objectives).toEqual([]);
      expect(dbRow.rows[0].snapshot_payload.set.setId).toBe(created.result.set.setId);

      // Content-hash stability across TWO independent reads (repository +
      // raw SQL) — the STORED `content_hash` TEXT column must return the
      // exact same string every time, via every read path.
      //
      // NOTE (discovered while writing this test, applies to every
      // `computeStateHash` column in this program, not just OKR-E002):
      // `content_hash` is computed ONCE from the pre-insert JS object,
      // BEFORE `JSON.stringify`+INSERT. Postgres's JSONB storage does not
      // preserve original key order (verified directly:
      // `SELECT jsonb_build_object('b',1,'a',2)::text` returns
      // `{"a": 2, "b": 1}`, alphabetized) — so recomputing
      // `computeStateHash` from a value READ BACK out of a JSONB column can
      // never be expected to reproduce the original stored hash. The hash
      // is a write-time fingerprint, not a verifiable-on-every-read
      // checksum of the JSONB column's current bytes. This test proves the
      // achievable guarantee: the stored column itself never drifts.
      const readOnce = await getOkrSetApprovedSnapshot({
        userId: USER_REVIEWER,
        organizationId,
        setId: created.result.set.setId,
        snapshotId: approved.result.snapshot.snapshotId,
      });
      const readTwice = await getOkrSetApprovedSnapshot({
        userId: USER_REVIEWER,
        organizationId,
        setId: created.result.set.setId,
        snapshotId: approved.result.snapshot.snapshotId,
      });
      expect(readOnce).not.toBeNull();
      expect(readTwice).not.toBeNull();
      expect(readOnce?.contentHash).toBe(dbRow.rows[0].content_hash);
      expect(readTwice?.contentHash).toBe(dbRow.rows[0].content_hash);
      expect(readOnce?.contentHash).toBe(readTwice?.contentHash);
      // The recomputed hash of a round-tripped payload IS internally
      // consistent with itself across reads (same bytes in, same hash out,
      // twice) — even though it will not equal the original write-time
      // `content_hash` per the note above.
      const recomputedOnce = computeStateHash(readOnce?.payload as unknown as Record<string, unknown>);
      const recomputedTwice = computeStateHash(readTwice?.payload as unknown as Record<string, unknown>);
      expect(recomputedOnce).toBe(recomputedTwice);

      // listOkrSetApprovedSnapshots returns the same summary.
      const list = await listOkrSetApprovedSnapshots({ userId: USER_REVIEWER, organizationId, setId: created.result.set.setId });
      expect(list).toHaveLength(1);
      expect(list[0].snapshotId).toBe(approved.result.snapshot.snapshotId);
      expect(list[0].contentHash).toBe(dbRow.rows[0].content_hash);
    }
  );

  itDB(
    'a second approval cycle (fixture-manipulated back to "submitted") increments sequence_number to 2, ' +
      'moves latest_approved_snapshot_id, and leaves the v1 snapshot row byte-identical',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const ownerId = `${USER_OWNER}-reseq`;
      const created = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        scopeType: 'individual',
        scopeId: ownerId,
        ownerUserId: ownerId,
        reviewerUserId: USER_REVIEWER,
        title: 'Re-sequence fixture v1',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-reseq-${randomUUID()}`,
      });
      const submitted = await submitOkrSetForApproval({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-reseq-${randomUUID()}`,
      });
      const firstApproval = await approveOkrSet({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-reseq-1-${randomUUID()}`,
      });
      expect(firstApproval.result.snapshot.sequenceNumber).toBe(1);

      const v1SnapshotBefore = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`,
        [firstApproval.result.snapshot.snapshotId]
      );

      // No E002 command reopens an 'approved' Set back to 'submitted' —
      // direct fixture manipulation to exercise the sequence-number logic
      // for a second real approveOkrSet call (recordOkrSetMaterialChange
      // never touches this table; this is purely to prove the counter).
      await client.query(
        `UPDATE okr_vnext_sets SET status = 'submitted', title = $1 WHERE set_id = $2`,
        ['Re-sequence fixture v2 (title changed pre-second-approval)', created.result.set.setId]
      );

      const secondApproval = await approveOkrSet({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: firstApproval.result.set.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-reseq-2-${randomUUID()}`,
      });
      expect(secondApproval.result.snapshot.sequenceNumber).toBe(2);
      expect(secondApproval.result.set.approvedVersion).toBe(2);
      expect(secondApproval.result.set.latestApprovedSnapshotId).toBe(secondApproval.result.snapshot.snapshotId);
      expect(secondApproval.result.set.latestApprovedSnapshotId).not.toBe(firstApproval.result.snapshot.snapshotId);

      // v1's own stored row is untouched — REVOKE UPDATE/DELETE + this
      // command never targets it.
      const v1SnapshotAfter = await client.query<{ content_hash: string; snapshot_payload: unknown }>(
        `SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`,
        [firstApproval.result.snapshot.snapshotId]
      );
      expect(v1SnapshotAfter.rows[0].content_hash).toBe(v1SnapshotBefore.rows[0].content_hash);
      expect(JSON.stringify(v1SnapshotAfter.rows[0].snapshot_payload)).toBe(
        JSON.stringify(v1SnapshotBefore.rows[0].snapshot_payload)
      );

      const allSnapshots = await client.query(
        `SELECT sequence_number FROM okr_vnext_approved_snapshots WHERE set_id = $1 ORDER BY sequence_number`,
        [created.result.set.setId]
      );
      expect(allSnapshots.rows.map((r) => r.sequence_number)).toEqual([1, 2]);
    }
  );

  // ==========================================
  // REVOKE UPDATE/DELETE — DB-level immutability
  // ==========================================

  itDB('okr_vnext_approved_snapshots rejects UPDATE/DELETE from PUBLIC at the DB level', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const ownerId = `${USER_OWNER}-immutable`;
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      reviewerUserId: USER_REVIEWER,
      title: 'Immutability fixture',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-immutable-${randomUUID()}`,
    });
    const submitted = await submitOkrSetForApproval({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-immutable-${randomUUID()}`,
    });
    const approved = await approveOkrSet({
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: submitted.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-immutable-${randomUUID()}`,
    });

    const grants = await client.query<{ privilege_type: string; grantee: string }>(
      `SELECT privilege_type, grantee FROM information_schema.role_table_grants
        WHERE table_name = 'okr_vnext_approved_snapshots' AND grantee = 'PUBLIC'`
    );
    const grantedPrivileges = grants.rows.map((r) => r.privilege_type);
    expect(grantedPrivileges).not.toContain('UPDATE');
    expect(grantedPrivileges).not.toContain('DELETE');
    void approved;
  });
});
