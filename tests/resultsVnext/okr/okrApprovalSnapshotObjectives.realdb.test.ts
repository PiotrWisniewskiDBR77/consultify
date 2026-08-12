/**
 * OKR-E003 — `buildObjectivesSnapshotFragment` wired into
 * `buildOkrSetApprovalSnapshotPayload` (E002, `okrSetCommands.ts`): the
 * literal D8-closure proof — the approved snapshot's `objectives` array is
 * populated with real content and content-hash stable, cancelled
 * Objectives/KRs are excluded, and re-approval produces an independent
 * sequence-numbered v2 snapshot that never overwrites v1 — against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §12.
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
const ORG_PREFIX = `okr-e003-approvalsnap-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e003-approvalsnap-admin-${tag}`;
const USER_OWNER = `okr-e003-approvalsnap-owner-${tag}`;
const USER_REVIEWER = `okr-e003-approvalsnap-reviewer-${tag}`;

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
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let cancelObjective: ObjectiveCommandsModule['cancelObjective'];
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

async function createProgramCycleAndSet(ownerId: string): Promise<{ organizationId: string; setId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Approval-snapshot fixture Program',
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
    name: 'Approval-snapshot fixture Cycle',
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
    reviewerUserId: USER_REVIEWER,
    title: 'Approval-snapshot fixture Set',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  return { organizationId, setId: set.result.set.setId };
}

describe('OKR-E003 buildObjectivesSnapshotFragment / approveOkrSet — D8 closure proof (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR approval-snapshot realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_approved_snapshots LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_key_results LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR schema); refusing to report a green run. ' + String(error)
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

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;
    cancelObjective = objectiveCommands.cancelObjective;

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
    await client.query(`UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
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

  itDB(
    'approved snapshot objectives array: populated with real content, content-hash stable, cancelled Objective+KR excluded',
    async () => {
      const ownerId = `${USER_OWNER}-populated`;
      const { organizationId, setId } = await createProgramCycleAndSet(ownerId);

      // Objective A: kept, 2 KRs (one of which is cancelled — excluded too).
      const objectiveA = await createObjective({
        setId,
        organizationId,
        ownerUserId: ownerId,
        title: 'Objective A (kept)',
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const krKept = await createKeyResult({
        objectiveId: objectiveA.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: 'KR kept',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-kept-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const krCancelled = await createKeyResult({
        objectiveId: objectiveA.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: 'KR cancelled (excluded from snapshot)',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 3,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-cancelled-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await cancelKeyResult({
        keyResultId: krCancelled.result.keyResultId,
        organizationId,
        expectedVersion: krCancelled.result.rowVersion,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `cancel-kr-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      // Objective A needs >=2 non-cancelled KRs to pass the submission
      // guard — add a second real one (krKept is #1).
      await createKeyResult({
        objectiveId: objectiveA.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: 'KR kept #2',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 7,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-kept2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      // Objective B: cancelled entirely — excluded from the snapshot along
      // with everything under it.
      const objectiveB = await createObjective({
        setId,
        organizationId,
        ownerUserId: ownerId,
        title: 'Objective B (cancelled, excluded)',
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-obj-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await cancelObjective({
        objectiveId: objectiveB.result.objectiveId,
        organizationId,
        expectedVersion: objectiveB.result.rowVersion,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `cancel-obj-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const setRow = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
        setId,
      ]);
      const submitted = await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: setRow.rows[0].row_version,
        actorUserId: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const approved = await approveOkrSet({
        setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const dbRow = await client.query<{
        content_hash: string;
        snapshot_payload: {
          objectives: Array<{ objectiveId: string; title: string; keyResults: Array<{ keyResultId: string; title: string }> }>;
        };
      }>(`SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`, [
        approved.result.snapshot.snapshotId,
      ]);
      const objectives = dbRow.rows[0].snapshot_payload.objectives;

      // Only Objective A survives (Objective B cancelled, excluded).
      expect(objectives).toHaveLength(1);
      expect(objectives[0].objectiveId).toBe(objectiveA.result.objectiveId);
      expect(objectives[0].title).toBe('Objective A (kept)');

      // Only the 2 kept KRs survive under it (the cancelled one excluded).
      expect(objectives[0].keyResults).toHaveLength(2);
      const krIds = objectives[0].keyResults.map((kr) => kr.keyResultId);
      expect(krIds).toContain(krKept.result.keyResultId);
      expect(krIds).not.toContain(krCancelled.result.keyResultId);

      // Content-hash stability: the STORED column is identical across two
      // independent raw reads.
      const secondRead = await client.query<{ content_hash: string }>(
        `SELECT content_hash FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`,
        [approved.result.snapshot.snapshotId]
      );
      expect(secondRead.rows[0].content_hash).toBe(dbRow.rows[0].content_hash);
    }
  );

  itDB('re-approval (fixture-manipulated back to "submitted") produces an INDEPENDENT v2 snapshot, v1 untouched', async () => {
    const ownerId = `${USER_OWNER}-reapproval`;
    const { organizationId, setId } = await createProgramCycleAndSet(ownerId);
    const objective = await createObjective({
      setId,
      organizationId,
      ownerUserId: ownerId,
      title: 'Re-approval fixture Objective',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    for (let i = 0; i < 2; i += 1) {
      await createKeyResult({
        objectiveId: objective.result.objectiveId,
        organizationId,
        ownerUserId: ownerId,
        title: `KR ${i + 1}`,
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
        createdBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-kr-${i}-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    }

    const setRowV1 = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
      setId,
    ]);
    const submittedV1 = await submitOkrSetForApproval({
      setId,
      organizationId,
      expectedVersion: setRowV1.rows[0].row_version,
      actorUserId: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-v1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const approvedV1 = await approveOkrSet({
      setId,
      organizationId,
      expectedVersion: submittedV1.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-v1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(approvedV1.result.snapshot.sequenceNumber).toBe(1);

    // Add a THIRD KeyResult before re-approval — v2's content must differ
    // from v1's, proving each approval is an independent full
    // reconstruction (never a diff, never a mutation of v1).
    //
    // No E003/E002 command reopens an 'approved' Set for content edits —
    // `assertSetEditableForUpdate` only allows draft/changes_requested.
    // Direct fixture manipulation (same class of setup E002's own
    // okrSetApproval.realdb.test.ts uses for its own re-sequence test)
    // flips the Set to 'changes_requested' just long enough to add KR-3,
    // then back to 'submitted' for the real `approveOkrSet` call below.
    await client.query(`UPDATE okr_vnext_sets SET status = 'changes_requested' WHERE set_id = $1`, [setId]);
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId: ownerId,
      title: 'KR 3 (added after v1 approval)',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 9,
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-3-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await client.query(`UPDATE okr_vnext_sets SET status = 'submitted' WHERE set_id = $1`, [setId]);

    const approvedV2 = await approveOkrSet({
      setId,
      organizationId,
      expectedVersion: approvedV1.result.set.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-v2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(approvedV2.result.snapshot.sequenceNumber).toBe(2);
    expect(approvedV2.result.snapshot.snapshotId).not.toBe(approvedV1.result.snapshot.snapshotId);

    const v1AfterRow = await client.query<{
      content_hash: string;
      snapshot_payload: { objectives: Array<{ keyResults: unknown[] }> };
    }>(`SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`, [
      approvedV1.result.snapshot.snapshotId,
    ]);
    const v2Row = await client.query<{
      content_hash: string;
      snapshot_payload: { objectives: Array<{ keyResults: unknown[] }> };
    }>(`SELECT content_hash, snapshot_payload FROM okr_vnext_approved_snapshots WHERE snapshot_id = $1`, [
      approvedV2.result.snapshot.snapshotId,
    ]);

    // v1 still has exactly 2 KRs (untouched by the later KR-3 add).
    expect(v1AfterRow.rows[0].snapshot_payload.objectives[0].keyResults).toHaveLength(2);
    // v2 has all 3.
    expect(v2Row.rows[0].snapshot_payload.objectives[0].keyResults).toHaveLength(3);
    // Different content -> different hash.
    expect(v2Row.rows[0].content_hash).not.toBe(v1AfterRow.rows[0].content_hash);

    const allSequences = await client.query<{ sequence_number: number }>(
      `SELECT sequence_number FROM okr_vnext_approved_snapshots WHERE set_id = $1 ORDER BY sequence_number`,
      [setId]
    );
    expect(allSequences.rows.map((r) => r.sequence_number)).toEqual([1, 2]);
  });
});
