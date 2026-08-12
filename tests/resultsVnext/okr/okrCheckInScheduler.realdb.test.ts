/**
 * OKR-E004 — `generateCadenceOccurrencesAndSeedCheckInObligations` /
 * `detectAndFlagMissedCheckIns`, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §8.
 *
 * Covers: obligation seeding only for ACTIVE Sets, idempotent seeding
 * (two-call, no duplicate obligations — mirrors OKR-E001's own scheduler
 * test shape); `detectAndFlagMissedCheckIns` recomputing `attention_state`
 * to `'watch'` for a Set with a KR that missed a CLOSED cadence window
 * (AC-011's literal "brak check-in -> stale/attention" satisfied
 * independent of any check-in activity), two-call idempotency (no
 * double-escalation, same result both times), and
 * `obligationsStillOpen`'s count.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program.
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
const ORG_PREFIX = `okr-e004-scheduler-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e004-scheduler-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type CheckInSchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInScheduler.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let generateCadenceOccurrencesAndSeedCheckInObligations: CheckInSchedulerModule['generateCadenceOccurrencesAndSeedCheckInObligations'];
let detectAndFlagMissedCheckIns: CheckInSchedulerModule['detectAndFlagMissedCheckIns'];
let closePgPool: (() => Promise<void>) | undefined;

/** Cycle entirely in the PAST relative to "now" (2026-08-10 in this
 * environment) — every biweekly window it generates is already closed,
 * guaranteeing a KR that never checks in registers as stale. */
function pastCycleTimes() {
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

interface ActiveSetFixture {
  organizationId: string;
  cycleId: string;
  setId: string;
  keyResultId1: string;
  keyResultId2: string;
  ownerId: string;
}

/** Program -> publish -> Cycle -> Set -> Objective -> 2 KRs -> submit ->
 * approve -> activate. Deliberately does NOT call generateCadenceOccurrences
 * itself — that is exactly what
 * `generateCadenceOccurrencesAndSeedCheckInObligations` is under test for. */
async function buildActiveSetFixtureNoOccurrences(): Promise<ActiveSetFixture> {
  const organizationId = freshOrgId();
  const ownerId = `${organizationId}-owner`;
  const reviewerId = `${organizationId}-reviewer`;
  const approverId = `${organizationId}-approver`;

  const createdProgram = await createProgram({
    organizationId,
    name: 'Scheduler fixture Program',
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
    name: 'Scheduler fixture Cycle',
    ...pastCycleTimes(),
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
    reviewerUserId: reviewerId,
    title: 'Scheduler fixture Set',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: ownerId,
    title: 'Scheduler fixture Objective',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
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
        access: { capabilities: ['*'], platformRole: null },
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
        access: { capabilities: ['*'], platformRole: null },
});

  const submitted = await submitOkrSetForApproval({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: set.result.set.rowVersion,
    actorUserId: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `submit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const approved = await approveOkrSet({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: submitted.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
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

  return {
    organizationId,
    cycleId: cycle.result.cycleId,
    setId: set.result.set.setId,
    keyResultId1: kr1.result.keyResultId,
    keyResultId2: kr2.result.keyResultId,
    ownerId,
  };
}

describe('OKR-E004 check-in obligation seeding + missed-cadence scheduler (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E004 scheduler realdb tests did NOT run. This run is not evidence.');
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

    const checkInScheduler: CheckInSchedulerModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCheckInScheduler.js'
    );
    generateCadenceOccurrencesAndSeedCheckInObligations = checkInScheduler.generateCadenceOccurrencesAndSeedCheckInObligations;
    detectAndFlagMissedCheckIns = checkInScheduler.detectAndFlagMissedCheckIns;

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
  // Obligation seeding
  // ==========================================

  itDB('seeds a check_in obligation per (KR, newly-created occurrence) pair for an ACTIVE Set only', async () => {
    const fx = await buildActiveSetFixtureNoOccurrences();

    const result = await generateCadenceOccurrencesAndSeedCheckInObligations({
      organizationId: fx.organizationId,
      cycleId: fx.cycleId,
    });
    expect(result.occurrencesCreated).toBeGreaterThan(0);
    // 2 KRs * N occurrences.
    expect(result.obligationsSeeded).toBe(result.occurrencesCreated * 2);

    const obligationRows = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rvn_platform_obligations
        WHERE organization_id = $1 AND obligation_type = 'check_in' AND status = 'open'`,
      [fx.organizationId]
    );
    expect(Number(obligationRows.rows[0]!.count)).toBe(result.occurrencesCreated * 2);
  });

  itDB('two-call idempotency: re-running seeding for the SAME Cycle creates zero new occurrences and zero new obligations', async () => {
    const fx = await buildActiveSetFixtureNoOccurrences();

    const first = await generateCadenceOccurrencesAndSeedCheckInObligations({
      organizationId: fx.organizationId,
      cycleId: fx.cycleId,
    });
    expect(first.occurrencesCreated).toBeGreaterThan(0);

    const second = await generateCadenceOccurrencesAndSeedCheckInObligations({
      organizationId: fx.organizationId,
      cycleId: fx.cycleId,
    });
    expect(second.occurrencesCreated).toBe(0);
    expect(second.obligationsSeeded).toBe(0);

    const totalObligations = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rvn_platform_obligations
        WHERE organization_id = $1 AND obligation_type = 'check_in'`,
      [fx.organizationId]
    );
    expect(Number(totalObligations.rows[0]!.count)).toBe(first.obligationsSeeded);
  });

  // ==========================================
  // detectAndFlagMissedCheckIns — AC-011's independent staleness detection
  // ==========================================

  itDB(
    'a Set whose KRs never check in over a fully-closed Cycle is flagged attention_state="watch" by detectAndFlagMissedCheckIns, with never a fabricated progress value',
    async () => {
      const fx = await buildActiveSetFixtureNoOccurrences();
      await generateCadenceOccurrencesAndSeedCheckInObligations({ organizationId: fx.organizationId, cycleId: fx.cycleId });

      const beforeRow = await client.query<{ attention_state: string; overall_progress: string | null }>(
        `SELECT attention_state, overall_progress FROM okr_vnext_sets WHERE set_id = $1`,
        [fx.setId]
      );
      expect(beforeRow.rows[0]!.attention_state).toBe('none'); // E002's own creation default, untouched yet

      const result = await detectAndFlagMissedCheckIns({ organizationId: fx.organizationId, cycleId: fx.cycleId });
      expect(result.setsReassessed).toBe(1);
      expect(result.obligationsStillOpen).toBeGreaterThan(0);

      const afterRow = await client.query<{ attention_state: string; overall_progress: string | null }>(
        `SELECT attention_state, overall_progress FROM okr_vnext_sets WHERE set_id = $1`,
        [fx.setId]
      );
      expect(afterRow.rows[0]!.attention_state).toBe('watch');
      // This fixture's Program uses the DEFAULT objective_rollup_model
      // ('none') and no KR has ever been checked into (no recordCheckIn
      // call anywhere in this test) — the Objective's own `progress` was
      // therefore NEVER computed by anything, and 'none' itself is a
      // deliberate non-rollup policy choice besides. AC-011's literal
      // requirement is exactly this: `overall_progress` stays NULL, never
      // a fabricated 0, even while `attention_state` independently and
      // correctly escalates to 'watch'. The two columns are governed by
      // completely different logic (D8/D9's own split) — proving one
      // moves without dragging the other into a fabricated value IS the
      // test.
      expect(afterRow.rows[0]!.overall_progress).toBeNull();
    }
  );

  itDB('detectAndFlagMissedCheckIns is idempotent — a second call reassesses the same Set with the same result', async () => {
    const fx = await buildActiveSetFixtureNoOccurrences();
    await generateCadenceOccurrencesAndSeedCheckInObligations({ organizationId: fx.organizationId, cycleId: fx.cycleId });

    const first = await detectAndFlagMissedCheckIns({ organizationId: fx.organizationId, cycleId: fx.cycleId });
    const second = await detectAndFlagMissedCheckIns({ organizationId: fx.organizationId, cycleId: fx.cycleId });

    expect(second.setsReassessed).toBe(first.setsReassessed);
    expect(second.obligationsStillOpen).toBe(first.obligationsStillOpen);

    const setRow = await client.query<{ attention_state: string }>(`SELECT attention_state FROM okr_vnext_sets WHERE set_id = $1`, [
      fx.setId,
    ]);
    expect(setRow.rows[0]!.attention_state).toBe('watch');
  });

  itDB('detectAndFlagMissedCheckIns only reassesses ACTIVE Sets — a draft Set in the Cycle is left untouched', async () => {
    const fx = await buildActiveSetFixtureNoOccurrences();
    await generateCadenceOccurrencesAndSeedCheckInObligations({ organizationId: fx.organizationId, cycleId: fx.cycleId });

    // A second, still-DRAFT Set in the SAME Cycle/org.
    const draftOwnerId = `${fx.organizationId}-draft-owner`;
    await client.query(
      `INSERT INTO okr_vnext_sets (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, created_by)
       SELECT gen_random_uuid(), organization_id, program_id, $2, 'individual', $1, $1, 'Still-draft Set', $1
         FROM okr_vnext_sets WHERE set_id = $3`,
      [draftOwnerId, fx.cycleId, fx.setId]
    );

    const result = await detectAndFlagMissedCheckIns({ organizationId: fx.organizationId, cycleId: fx.cycleId });
    // Only the ONE active Set from the fixture, not the draft one.
    expect(result.setsReassessed).toBe(1);
  });
});
