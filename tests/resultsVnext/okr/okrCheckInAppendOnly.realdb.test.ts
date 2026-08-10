/**
 * OKR-E004 — `recordCheckIn`/`correctCheckIn` append-only chain + composite
 * idempotency, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §7, D2-D4.
 *
 * ==========================================================================
 * THE COMPOSITE-IDEMPOTENCY PROOF (D2/D3 — the design's own flagged
 * "landmine")
 * ==========================================================================
 * `okr_vnext_checkin_occurrences` is Cycle-scoped — ONE occurrence row per
 * cadence window, SHARED by every KR in the Cycle (OKR-E001's own
 * deliberate minimal shell). This test proves the idempotency key is truly
 * the COMPOSITE `(key_result_id, cadence_occurrence_id)`, not
 * `cadence_occurrence_id` alone: two DIFFERENT KRs in the SAME Set both
 * check in against the SAME occurrence successfully (no cross-KR
 * collision), while a SECOND `recordCheckIn` for the SAME KR against the
 * SAME occurrence is rejected 409 (real per-KR-per-window idempotency).
 *
 * Also proves: `correctCheckIn` inserts a NEW row referencing the original
 * via `correction_of_checkin_id` (never mutates it); raw UPDATE/DELETE on
 * `okr_vnext_checkins` genuinely revoked from PUBLIC at the schema level,
 * proven via a fresh `NOLOGIN` role (not `has_table_privilege`, which is
 * invalid/misleading on this test's own superuser connection — the exact
 * caveat ROI-E004's own closure entry already documents).
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
const ORG_PREFIX = `okr-e004-appendonly-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e004-appendonly-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type CycleSchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type CheckInCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let generateCadenceOccurrences: CycleSchedulerModule['generateCadenceOccurrences'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let recordCheckIn: CheckInCommandsModule['recordCheckIn'];
let correctCheckIn: CheckInCommandsModule['correctCheckIn'];
let OkrCheckInAlreadyExistsForOccurrenceError: CheckInCommandsModule['OkrCheckInAlreadyExistsForOccurrenceError'];
let OkrCheckInNotFoundError: CheckInCommandsModule['OkrCheckInNotFoundError'];
let closePgPool: (() => Promise<void>) | undefined;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-12-31T00:00:00.000Z',
    reviewOpenAt: '2027-01-01T00:00:00.000Z',
    reflectionDueAt: '2027-01-03T00:00:00.000Z',
    closeAt: '2027-01-05T00:00:00.000Z',
  };
}

interface ActiveSetFixture {
  organizationId: string;
  programId: string;
  cycleId: string;
  setId: string;
  objectiveId: string;
  keyResultId1: string;
  keyResultId2: string;
  ownerId: string;
  occurrenceIds: string[];
}

/**
 * Program -> publish -> Cycle (biweekly, Jan-Dec 2026, spans "now" so both
 * closed and still-open occurrence windows exist) -> Set -> Objective ->
 * TWO KRs (kr_min_required=2 default) -> submit -> approve -> activate ->
 * materialize cadence occurrences. The full chain every check-in command
 * needs.
 */
async function buildActiveSetFixture(): Promise<ActiveSetFixture> {
  const organizationId = freshOrgId();
  const ownerId = `${organizationId}-owner`;
  const reviewerId = `${organizationId}-reviewer`;
  const approverId = `${organizationId}-approver`;

  const createdProgram = await createProgram({
    organizationId,
    name: 'Check-in fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
  });
  await publishProgram({
    programId: createdProgram.result.programId,
    organizationId,
    expectedVersion: createdProgram.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
  });
  const cycle = await createCycle({
    organizationId,
    programId: createdProgram.result.programId,
    name: 'Check-in fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
  });
  const set = await createOkrSet({
    organizationId,
    programId: createdProgram.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: ownerId,
    ownerUserId: ownerId,
    reviewerUserId: reviewerId,
    title: 'Check-in fixture Set',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-set-${randomUUID()}`,
  });
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: ownerId,
    title: 'Check-in fixture Objective',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-obj-${randomUUID()}`,
  });
  const kr1 = await createKeyResult({
    objectiveId: objective.result.objectiveId,
    organizationId,
    ownerUserId: ownerId,
    title: 'KR1',
    measurementType: 'numeric',
    direction: 'increase',
    baselineValue: 0,
    targetValue: 100,
    currentValue: 0,
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-kr1-${randomUUID()}`,
  });
  const kr2 = await createKeyResult({
    objectiveId: objective.result.objectiveId,
    organizationId,
    ownerUserId: ownerId,
    title: 'KR2',
    measurementType: 'numeric',
    direction: 'increase',
    baselineValue: 0,
    targetValue: 50,
    currentValue: 0,
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-kr2-${randomUUID()}`,
  });

  const submitted = await submitOkrSetForApproval({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: set.result.set.rowVersion,
    actorUserId: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `submit-${randomUUID()}`,
  });
  const approved = await approveOkrSet({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: submitted.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
  });
  const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: approved.resultingVersion,
    actorUserId: approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `activate-${randomUUID()}`,
  });
  expect(activated.result.status).toBe('active');

  const generated = await generateCadenceOccurrences({ organizationId, cycleId: cycle.result.cycleId });
  expect(generated.createdOccurrenceIds.length).toBeGreaterThan(0);

  return {
    organizationId,
    programId: createdProgram.result.programId,
    cycleId: cycle.result.cycleId,
    setId: set.result.set.setId,
    objectiveId: objective.result.objectiveId,
    keyResultId1: kr1.result.keyResultId,
    keyResultId2: kr2.result.keyResultId,
    ownerId,
    occurrenceIds: generated.createdOccurrenceIds,
  };
}

describe('OKR-E004 recordCheckIn/correctCheckIn append-only + composite idempotency (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E004 append-only realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_checkins LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E004 checkin schema); refusing to report a green run. ' +
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

    const cycleScheduler: CycleSchedulerModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js'
    );
    generateCadenceOccurrences = cycleScheduler.generateCadenceOccurrences;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    submitOkrSetForApproval = setCommands.submitOkrSetForApproval;
    approveOkrSet = setCommands.approveOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_ACTIVATE_SPEC = setCommands.OKR_SET_ACTIVATE_SPEC;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;

    const checkInCommands: CheckInCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js'
    );
    recordCheckIn = checkInCommands.recordCheckIn;
    correctCheckIn = checkInCommands.correctCheckIn;
    OkrCheckInAlreadyExistsForOccurrenceError = checkInCommands.OkrCheckInAlreadyExistsForOccurrenceError;
    OkrCheckInNotFoundError = checkInCommands.OkrCheckInNotFoundError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(`DELETE FROM okr_vnext_checkins WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [
      orgLike,
    ]);
    await client.query(
      `UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    await client.query(
      `DELETE FROM okr_vnext_approved_snapshots WHERE set_id IN (SELECT set_id FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
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
  // D2/D3 — the composite-idempotency landmine
  // ==========================================

  itDB(
    'composite (key_result_id, cadence_occurrence_id) idempotency: two DIFFERENT KRs check into the SAME occurrence without colliding',
    async () => {
      const fx = await buildActiveSetFixture();
      const occurrenceId = fx.occurrenceIds[0]!;

      const outcome1 = await recordCheckIn({
        keyResultId: fx.keyResultId1,
        organizationId: fx.organizationId,
        cadenceOccurrenceId: occurrenceId,
        newValue: 10,
        note: 'KR1 first check-in',
        submittedBy: fx.ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `checkin-kr1-${randomUUID()}`,
      });
      expect(outcome1.outcome).toBe('applied');

      const outcome2 = await recordCheckIn({
        keyResultId: fx.keyResultId2,
        organizationId: fx.organizationId,
        cadenceOccurrenceId: occurrenceId,
        newValue: 5,
        note: 'KR2 first check-in, SAME occurrence as KR1',
        submittedBy: fx.ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `checkin-kr2-${randomUUID()}`,
      });
      expect(outcome2.outcome).toBe('applied');
      expect(outcome2.result.checkIn.keyResultId).toBe(fx.keyResultId2);
      expect(outcome2.result.checkIn.cadenceOccurrenceId).toBe(occurrenceId);
    }
  );

  itDB(
    'a second recordCheckIn for the SAME (KR, occurrence) pair is REJECTED 409, never auto-converted to a correction (D4)',
    async () => {
      const fx = await buildActiveSetFixture();
      const occurrenceId = fx.occurrenceIds[0]!;

      const first = await recordCheckIn({
        keyResultId: fx.keyResultId1,
        organizationId: fx.organizationId,
        cadenceOccurrenceId: occurrenceId,
        newValue: 10,
        note: 'first',
        submittedBy: fx.ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `checkin-first-${randomUUID()}`,
      });
      expect(first.outcome).toBe('applied');

      let caught: unknown;
      try {
        await recordCheckIn({
          keyResultId: fx.keyResultId1,
          organizationId: fx.organizationId,
          cadenceOccurrenceId: occurrenceId,
          newValue: 20,
          note: 'duplicate attempt — must be rejected, not silently converted',
          submittedBy: fx.ownerId,
          actorEffectiveRole: 'member',
          idempotencyKey: `checkin-duplicate-${randomUUID()}`,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(OkrCheckInAlreadyExistsForOccurrenceError);
      expect((caught as InstanceType<typeof OkrCheckInAlreadyExistsForOccurrenceError>).details.existingCheckInId).toBe(
        first.result.checkIn.checkInId
      );

      // Exactly ONE original row exists — the rejected attempt left no trace.
      const rows = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM okr_vnext_checkins
          WHERE key_result_id = $1 AND cadence_occurrence_id = $2 AND correction_of_checkin_id IS NULL`,
        [fx.keyResultId1, occurrenceId]
      );
      expect(rows.rows[0]!.count).toBe('1');

      // The transaction is NOT left poisoned (25P02) by the SAVEPOINT
      // dance — a SUBSEQUENT, legitimate command against the SAME
      // connection pool still works.
      const otherOccurrence = fx.occurrenceIds[1];
      if (otherOccurrence) {
        const next = await recordCheckIn({
          keyResultId: fx.keyResultId1,
          organizationId: fx.organizationId,
          cadenceOccurrenceId: otherOccurrence,
          newValue: 15,
          note: 'proves the pool is not poisoned after the 23505/SAVEPOINT dance',
          submittedBy: fx.ownerId,
          actorEffectiveRole: 'member',
          idempotencyKey: `checkin-after-poison-check-${randomUUID()}`,
        });
        expect(next.outcome).toBe('applied');
      }
    }
  );

  // ==========================================
  // Append-only correction chain
  // ==========================================

  itDB('correctCheckIn inserts a NEW row referencing the original via correction_of_checkin_id — never mutates it', async () => {
    const fx = await buildActiveSetFixture();
    const occurrenceId = fx.occurrenceIds[0]!;

    const original = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 10,
      note: 'original value',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-orig-${randomUUID()}`,
    });
    expect(original.result.checkIn.newValue).toBe('10');
    expect(original.result.checkIn.correctionOfCheckInId).toBeNull();

    const corrected = await correctCheckIn({
      checkInId: original.result.checkIn.checkInId,
      organizationId: fx.organizationId,
      newValue: 25,
      correctionReason: 'Corrected after data entry error',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `correct-${randomUUID()}`,
    });
    expect(corrected.outcome).toBe('applied');
    expect(corrected.result.superseding.checkInId).not.toBe(original.result.checkIn.checkInId);
    expect(corrected.result.superseding.correctionOfCheckInId).toBe(original.result.checkIn.checkInId);
    expect(corrected.result.superseding.newValue).toBe('25');
    expect(corrected.result.superseding.correctionReason).toBe('Corrected after data entry error');

    // The ORIGINAL row's own new_value is untouched — proven by a direct,
    // fresh re-read from the DB (not from in-memory state).
    const originalReread = await client.query<{ new_value: string }>(
      `SELECT new_value FROM okr_vnext_checkins WHERE checkin_id = $1`,
      [original.result.checkIn.checkInId]
    );
    expect(originalReread.rows[0]!.new_value).toBe('10');

    // Full chain: exactly 2 rows for this (KR, occurrence).
    const chain = await client.query<{ checkin_id: string; correction_of_checkin_id: string | null }>(
      `SELECT checkin_id, correction_of_checkin_id FROM okr_vnext_checkins
        WHERE key_result_id = $1 AND cadence_occurrence_id = $2 ORDER BY submitted_at`,
      [fx.keyResultId1, occurrenceId]
    );
    expect(chain.rows).toHaveLength(2);
    expect(chain.rows[0]!.checkin_id).toBe(original.result.checkIn.checkInId);
    expect(chain.rows[1]!.checkin_id).toBe(corrected.result.superseding.checkInId);
  });

  itDB('correctCheckIn against a nonexistent checkin_id throws OkrCheckInNotFoundError', async () => {
    const fx = await buildActiveSetFixture();
    let caught: unknown;
    try {
      await correctCheckIn({
        checkInId: randomUUID(),
        organizationId: fx.organizationId,
        newValue: 1,
        correctionReason: 'n/a',
        submittedBy: fx.ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `correct-missing-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrCheckInNotFoundError);
  });

  // ==========================================
  // Raw UPDATE/DELETE genuinely revoked from PUBLIC (fresh NOLOGIN role,
  // NOT has_table_privilege — invalid on this test's own superuser
  // connection, per ROI-E004's own closure-entry caveat)
  // ==========================================

  itDB('raw UPDATE/DELETE on okr_vnext_checkins is genuinely revoked from PUBLIC at the schema level', async () => {
    const lowPrivRole = `okr_e004_lowpriv_${randomUUID().replace(/-/g, '_')}`;
    await client.query(`CREATE ROLE ${lowPrivRole} NOLOGIN`);
    try {
      await client.query(`SET ROLE ${lowPrivRole}`);
      try {
        await expect(
          client.query(`UPDATE okr_vnext_checkins SET note = 'tampered' WHERE checkin_id = gen_random_uuid()`)
        ).rejects.toThrow(/permission denied/i);
        await expect(client.query(`DELETE FROM okr_vnext_checkins WHERE checkin_id = gen_random_uuid()`)).rejects.toThrow(
          /permission denied/i
        );
      } finally {
        await client.query('RESET ROLE');
      }
    } finally {
      await client.query(`DROP ROLE ${lowPrivRole}`);
    }
  });
});
