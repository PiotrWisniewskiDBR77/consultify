/**
 * OKR-E004 — day 17 instruction §O.2: `getSetCheckInSummary` (the server-
 * side, read-only per-KR check-in aggregate), against a REAL Postgres.
 *
 * Covers the DoD list from `CODEX_DAY17_RESULTS_BACKEND2_INSTRUKCJA.md`
 * §O.2: rollup/keyResults reconciliation; a Set with zero check-ins ever
 * (`neverCheckedIn === total`, `oldestCheckInAt`/`newestCheckInAt === null`
 * — never the Set's own creation date); a correction shows the superseding
 * row, not the original; a KR with no cadence configured reads `UNKNOWN`,
 * never `CURRENT`; a KR with a currently-open, not-yet-closed window reads
 * `DUE`; a KR that missed a CLOSED window reads `OVERDUE`; cross-tenant
 * isolation (repository is called with the wrong organizationId and must
 * see nothing, never another tenant's rows).
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
const ORG_PREFIX = `okr-e004-checkin-summary-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e004-checkin-summary-admin-${tag}`;
const ACCESS = { capabilities: ['*'], platformRole: null } as const;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type CheckInSchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInScheduler.js');
type CheckInCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js');
type CheckInSummaryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.js');
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
let recordCheckIn: CheckInCommandsModule['recordCheckIn'];
let correctCheckIn: CheckInCommandsModule['correctCheckIn'];
let getSetCheckInSummary: CheckInSummaryModule['getSetCheckInSummary'];
let closePgPool: (() => Promise<void>) | undefined;

interface CycleTimes {
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  activeStartAt: string;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  closeAt: string;
}

/** A single ~10-day window, fully CLOSED relative to "now" — biweekly
 * default cadence (`okrProgramCommands.ts` default `checkin_frequency`)
 * produces exactly ONE occurrence for this short a range (verified by
 * `computeCadenceWindows`'s own loop: `next = start+14d` exceeds this
 * range's end after one iteration). */
function closedSingleWindowCycleTimes(): CycleTimes {
  return {
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-01-10T00:00:00.000Z',
    reviewOpenAt: '2026-01-11T00:00:00.000Z',
    reflectionDueAt: '2026-01-12T00:00:00.000Z',
    closeAt: '2026-01-15T00:00:00.000Z',
  };
}

/** A single window spanning "now" — same one-occurrence reasoning as
 * above, but `finalUpdateDueAt` is far enough in the future that the
 * generated window's `window_end` is still `>= now()` (OPEN, not yet
 * closed). */
function openSingleWindowCycleTimes(): CycleTimes {
  return {
    startDate: '2026-08-20',
    endDate: '2026-08-30',
    draftOpenAt: '2026-08-01T00:00:00.000Z',
    submissionDueAt: '2026-08-10T00:00:00.000Z',
    activeStartAt: '2026-08-20T00:00:00.000Z',
    finalUpdateDueAt: '2026-08-30T00:00:00.000Z',
    reviewOpenAt: '2026-08-31T00:00:00.000Z',
    reflectionDueAt: '2026-09-01T00:00:00.000Z',
    closeAt: '2026-09-05T00:00:00.000Z',
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
 * approve -> activate. Deliberately does NOT generate occurrences itself —
 * callers opt in via `generateCadenceOccurrencesAndSeedCheckInObligations`
 * (or don't, for the `NO_CADENCE_CONFIGURED` case). */
async function buildActiveSetFixture(cycleTimes: CycleTimes): Promise<ActiveSetFixture> {
  const organizationId = freshOrgId();
  const ownerId = `${organizationId}-owner`;
  const reviewerId = `${organizationId}-reviewer`;
  const approverId = `${organizationId}-approver`;

  const createdProgram = await createProgram({
    organizationId,
    name: 'CheckIn summary fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
    access: ACCESS,
  });
  await publishProgram({
    programId: createdProgram.result.programId,
    organizationId,
    expectedVersion: createdProgram.result.rowVersion,
    actorUserId: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
    access: ACCESS,
  });
  const cycle = await createCycle({
    organizationId,
    programId: createdProgram.result.programId,
    name: 'CheckIn summary fixture Cycle',
    ...cycleTimes,
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
    access: ACCESS,
  });
  const set = await createOkrSet({
    organizationId,
    programId: createdProgram.result.programId,
    cycleId: cycle.result.cycleId,
    scopeType: 'individual',
    scopeId: ownerId,
    ownerUserId: ownerId,
    reviewerUserId: reviewerId,
    title: 'CheckIn summary fixture Set',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-set-${randomUUID()}`,
    access: ACCESS,
  });
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: ownerId,
    title: 'CheckIn summary fixture Objective',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-obj-${randomUUID()}`,
    access: ACCESS,
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
    access: ACCESS,
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
    access: ACCESS,
  });

  const submitted = await submitOkrSetForApproval({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: set.result.set.rowVersion,
    actorUserId: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `submit-${randomUUID()}`,
    access: ACCESS,
  });
  const approved = await approveOkrSet({
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: submitted.resultingVersion,
    approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `approve-${randomUUID()}`,
    access: ACCESS,
  });
  const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
    setId: set.result.set.setId,
    organizationId,
    expectedVersion: approved.resultingVersion,
    actorUserId: approverId,
    actorEffectiveRole: 'admin',
    idempotencyKey: `activate-${randomUUID()}`,
    access: ACCESS,
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

async function generateSingleOccurrence(organizationId: string, cycleId: string): Promise<string> {
  const result = await generateCadenceOccurrencesAndSeedCheckInObligations({ organizationId, cycleId });
  expect(result.occurrencesCreated).toBe(1);
  const row = await client.query<{ cadence_occurrence_id: string }>(
    `SELECT cadence_occurrence_id FROM okr_vnext_checkin_occurrences WHERE organization_id = $1 AND cycle_id = $2`,
    [organizationId, cycleId]
  );
  return row.rows[0]!.cadence_occurrence_id;
}

describe('OKR-E004 §O.2 — getSetCheckInSummary (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E004 §O.2 check-in summary realdb tests did NOT run. This run is not evidence.');
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

    const checkInCommands: CheckInCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js'
    );
    recordCheckIn = checkInCommands.recordCheckIn;
    correctCheckIn = checkInCommands.correctCheckIn;

    const checkInSummary: CheckInSummaryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.js'
    );
    getSetCheckInSummary = checkInSummary.getSetCheckInSummary;

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

  itDB('a KR with no cadence generated at all reads UNKNOWN, never CURRENT — and rollup reconciles', async () => {
    const fx = await buildActiveSetFixture(closedSingleWindowCycleTimes());
    // Deliberately no generateCadenceOccurrencesAndSeedCheckInObligations call.

    const summary = await getSetCheckInSummary({ setId: fx.setId, organizationId: fx.organizationId });

    expect(summary.setId).toBe(fx.setId);
    expect(summary.keyResults).toHaveLength(2);
    for (const kr of summary.keyResults) {
      expect(kr.staleness).toBe('UNKNOWN');
      expect(kr.stalenessReason).toBe('NO_CADENCE_CONFIGURED');
      expect(kr.lastCheckIn).toBeNull();
      expect(kr.nextExpectedAt).toBeNull();
    }
    // Reconciliation (§O.2 DoD): rollup computed from the SAME list.
    expect(summary.rollup.total).toBe(summary.keyResults.length);
    expect(summary.rollup.withCheckIn).toBe(0);
    expect(summary.rollup.neverCheckedIn).toBe(summary.rollup.total);
    expect(summary.rollup.overdue).toBe(0);
    // "Never checked in" means null, NEVER the Set's own creation date.
    expect(summary.rollup.oldestCheckInAt).toBeNull();
    expect(summary.rollup.newestCheckInAt).toBeNull();
  });

  itDB('a KR that missed a CLOSED window reads OVERDUE; a KR checked into that same window reads CURRENT', async () => {
    const fx = await buildActiveSetFixture(closedSingleWindowCycleTimes());
    const occurrenceId = await generateSingleOccurrence(fx.organizationId, fx.cycleId);

    const checkIn = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 10,
      note: 'first check-in',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-kr1-${randomUUID()}`,
      access: ACCESS,
    });

    const summary = await getSetCheckInSummary({ setId: fx.setId, organizationId: fx.organizationId });
    expect(summary.keyResults).toHaveLength(2);

    const kr1Summary = summary.keyResults.find((kr) => kr.keyResultId === fx.keyResultId1)!;
    expect(kr1Summary.staleness).toBe('CURRENT');
    expect(kr1Summary.stalenessReason).toBeNull();
    expect(kr1Summary.lastCheckIn).not.toBeNull();
    expect(kr1Summary.lastCheckIn!.checkInId).toBe(checkIn.result.checkIn.checkInId);
    expect(kr1Summary.nextExpectedAt).toBeNull();

    const kr2Summary = summary.keyResults.find((kr) => kr.keyResultId === fx.keyResultId2)!;
    expect(kr2Summary.staleness).toBe('OVERDUE');
    expect(kr2Summary.stalenessReason).toBe('NO_CHECKIN_YET');
    expect(kr2Summary.lastCheckIn).toBeNull();
    expect(kr2Summary.nextExpectedAt).toBeNull();

    // Rollup reconciliation against this exact list.
    expect(summary.rollup.total).toBe(2);
    expect(summary.rollup.withCheckIn).toBe(1);
    expect(summary.rollup.overdue).toBe(1);
    expect(summary.rollup.neverCheckedIn).toBe(1);
    expect(summary.rollup.oldestCheckInAt).toBe(kr1Summary.lastCheckIn!.recordedAt);
    expect(summary.rollup.newestCheckInAt).toBe(kr1Summary.lastCheckIn!.recordedAt);
  });

  itDB('a correction supersedes the original — the summary shows the correcting row, not the original', async () => {
    const fx = await buildActiveSetFixture(closedSingleWindowCycleTimes());
    const occurrenceId = await generateSingleOccurrence(fx.organizationId, fx.cycleId);

    const original = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 10,
      note: 'original',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-original-${randomUUID()}`,
      access: ACCESS,
    });

    const beforeCorrection = await getSetCheckInSummary({ setId: fx.setId, organizationId: fx.organizationId });
    const kr1Before = beforeCorrection.keyResults.find((kr) => kr.keyResultId === fx.keyResultId1)!;
    expect(kr1Before.lastCheckIn!.checkInId).toBe(original.result.checkIn.checkInId);

    const correction = await correctCheckIn({
      checkInId: original.result.checkIn.checkInId,
      organizationId: fx.organizationId,
      newValue: 20,
      correctionReason: 'fixing the recorded value',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `correct-${randomUUID()}`,
      access: ACCESS,
    });
    expect(correction.result.superseding.checkInId).not.toBe(original.result.checkIn.checkInId);

    const afterCorrection = await getSetCheckInSummary({ setId: fx.setId, organizationId: fx.organizationId });
    const kr1After = afterCorrection.keyResults.find((kr) => kr.keyResultId === fx.keyResultId1)!;
    expect(kr1After.lastCheckIn!.checkInId).toBe(correction.result.superseding.checkInId);
    expect(kr1After.staleness).toBe('CURRENT');
    // Exactly one KR still has a check-in; the Set-wide rollup count does
    // not double-count the superseded original.
    expect(afterCorrection.rollup.withCheckIn).toBe(1);
  });

  itDB('a KR with an OPEN, not-yet-closed window and no check-in reads DUE, with nextExpectedAt set', async () => {
    const fx = await buildActiveSetFixture(openSingleWindowCycleTimes());
    await generateSingleOccurrence(fx.organizationId, fx.cycleId);

    const summary = await getSetCheckInSummary({ setId: fx.setId, organizationId: fx.organizationId });
    for (const kr of summary.keyResults) {
      expect(kr.staleness).toBe('DUE');
      expect(kr.stalenessReason).toBe('NO_CHECKIN_YET');
      expect(kr.lastCheckIn).toBeNull();
      expect(kr.nextExpectedAt).not.toBeNull();
    }
    expect(summary.rollup.overdue).toBe(0);
    expect(summary.rollup.neverCheckedIn).toBe(2);
  });

  itDB('cross-tenant isolation: a foreign organizationId sees zero key results, never another tenant\'s rows', async () => {
    const fx = await buildActiveSetFixture(closedSingleWindowCycleTimes());
    await generateSingleOccurrence(fx.organizationId, fx.cycleId);

    const foreignOrgId = freshOrgId();
    const summary = await getSetCheckInSummary({ setId: fx.setId, organizationId: foreignOrgId });

    expect(summary.keyResults).toEqual([]);
    expect(summary.rollup).toEqual({
      total: 0,
      withCheckIn: 0,
      overdue: 0,
      neverCheckedIn: 0,
      oldestCheckInAt: null,
      newestCheckInAt: null,
    });
  });
});
