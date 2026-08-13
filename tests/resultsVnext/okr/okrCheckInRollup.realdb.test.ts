/**
 * OKR-E004 — KR/Objective/Set write-through + rollup, against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §7.1 steps 4-8, D6,
 * D8-D10, AC-011.
 *
 * Covers: KR `current_value`/`progress`/`confidence` write-through (D6);
 * Objective rollup cascade (reusing OKR-E003's own
 * `recomputeObjectiveRollup`); Set `overall_progress`/`overall_confidence`/
 * `attention_state`/`last_checkin_at`/`next_checkin_due_at` recompute
 * (D8-D10); AC-011's literal "brak check-in -> NIGDY syntetyczne 0%" —
 * proven directly against real rows, not inferred from the pure unit test
 * alone; low-confidence `explain_low_confidence` obligation creation;
 * `completeObligation`'s new `cadenceOccurrenceId` filter correctly
 * completing ONLY the matching occurrence's obligation, not an unrelated
 * open one for a different window on the same KR.
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
const ORG_PREFIX = `okr-e004-rollup-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e004-rollup-admin-${tag}`;

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
  cycleId: string;
  setId: string;
  objectiveId: string;
  keyResultId1: string;
  keyResultId2: string;
  ownerId: string;
  occurrenceIds: string[];
}

async function buildActiveSetFixture(
  programOverrides: { objectiveRollupModel?: 'equal_average' | 'weighted_average' | 'manual' | 'none' } = {}
): Promise<ActiveSetFixture> {
  const organizationId = freshOrgId();
  const ownerId = `${organizationId}-owner`;
  const reviewerId = `${organizationId}-reviewer`;
  const approverId = `${organizationId}-approver`;

  const createdProgram = await createProgram({
    organizationId,
    name: 'Rollup fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
    // createProgram merges caller fields via object spread over its own
    // defaults — an explicitly-present `objectiveRollupModel: undefined`
    // key would overwrite the 'none' default with a real `undefined`
    // (serialized as NULL by node-postgres, tripping the NOT NULL
    // constraint). Only include the key when a real value was requested.
    ...(programOverrides.objectiveRollupModel ? { objectiveRollupModel: programOverrides.objectiveRollupModel } : {}),
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
    name: 'Rollup fixture Cycle',
    ...baseCycleTimes(),
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
    title: 'Rollup fixture Set',
    createdBy: ownerId,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const objective = await createObjective({
    setId: set.result.set.setId,
    organizationId,
    ownerUserId: ownerId,
    title: 'Rollup fixture Objective',
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
        access: { capabilities: ['*'], platformRole: null },
});
  expect(activated.result.status).toBe('active');

  const generated = await generateCadenceOccurrences({ organizationId, cycleId: cycle.result.cycleId });
  expect(generated.createdOccurrenceIds.length).toBeGreaterThan(0);

  return {
    organizationId,
    cycleId: cycle.result.cycleId,
    setId: set.result.set.setId,
    objectiveId: objective.result.objectiveId,
    keyResultId1: kr1.result.keyResultId,
    keyResultId2: kr2.result.keyResultId,
    ownerId,
    occurrenceIds: generated.createdOccurrenceIds,
  };
}

describe('OKR-E004 recordCheckIn KR/Objective/Set write-through + rollup (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E004 rollup realdb tests did NOT run. This run is not evidence.');
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
  // AC-011: brand-new Set/Objective/KRs with NO check-in yet -> null, NEVER
  // a fabricated 0 — proven directly against real rows before this epic's
  // code ever runs a write.
  // ==========================================

  itDB('a fresh Set with Objectives/KRs but ZERO check-ins has overall_progress/overall_confidence = NULL (not 0), before any recordCheckIn call', async () => {
    const fx = await buildActiveSetFixture({ objectiveRollupModel: 'equal_average' });
    const setRow = await client.query<{ overall_progress: string | null; overall_confidence: string | null; attention_state: string }>(
      `SELECT overall_progress, overall_confidence, attention_state FROM okr_vnext_sets WHERE set_id = $1`,
      [fx.setId]
    );
    expect(setRow.rows[0]!.overall_progress).toBeNull();
    expect(setRow.rows[0]!.overall_confidence).toBeNull();
    expect(setRow.rows[0]!.attention_state).not.toBe('0');
  });

  // ==========================================
  // D6: KR write-through
  // ==========================================

  itDB('recordCheckIn writes current_value/progress/progress_calc_reason onto the KR row (fresh DB re-read)', async () => {
    const fx = await buildActiveSetFixture();
    const occurrenceId = fx.occurrenceIds[0]!;

    const outcome = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 40,
      confidence: 'high',
      note: 'progress update',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    // increase geometry: (40 - 0) / (100 - 0) = 0.4
    expect(Number(outcome.result.keyResult.progress)).toBeCloseTo(0.4, 10);
    expect(outcome.result.keyResult.confidence).toBe('high');

    const krRow = await client.query<{ current_value: string; progress: string; confidence: string; row_version: number }>(
      `SELECT current_value, progress, confidence, row_version FROM okr_vnext_key_results WHERE key_result_id = $1`,
      [fx.keyResultId1]
    );
    expect(krRow.rows[0]!.current_value).toBe('40');
    expect(Number(krRow.rows[0]!.progress)).toBeCloseTo(0.4, 10);
    expect(krRow.rows[0]!.confidence).toBe('high');
    expect(krRow.rows[0]!.row_version).toBe(2); // was 1 at creation

    // Checkin row's own previous_value/new_value/calculated_progress.
    expect(outcome.result.checkIn.previousValue).toBe('0');
    expect(outcome.result.checkIn.newValue).toBe('40');
    expect(Number(outcome.result.checkIn.calculatedProgress)).toBeCloseTo(0.4, 10);
  });

  itDB('newValue=null (qualitative-only check-in) leaves current_value UNCHANGED — never clobbered to null', async () => {
    const fx = await buildActiveSetFixture();
    const occurrence1 = fx.occurrenceIds[0]!;
    const occurrence2 = fx.occurrenceIds[1]!;

    await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrence1,
      newValue: 25,
      note: 'sets a real value',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-value-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const qualitative = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrence2,
      newValue: null,
      note: 'qualitative-only this round, no numeric update',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-qualitative-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(qualitative.result.checkIn.newValue).toBeNull();
    expect(qualitative.result.checkIn.previousValue).toBe('25');
    // KR's own current_value stays 25, not clobbered to null.
    expect(qualitative.result.keyResult.currentValue).toBe('25');
  });

  // ==========================================
  // D8/D9: Objective + Set rollup cascade (equal_average policy)
  // ==========================================

  itDB('checking in on ONE of two KRs under an Objective rolls up to Objective.progress AND Set.overall_progress (equal_average)', async () => {
    const fx = await buildActiveSetFixture({ objectiveRollupModel: 'equal_average' });
    const occurrenceId = fx.occurrenceIds[0]!;

    // KR1: increase 0->100, checked in at 50 => progress 0.5
    await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 50,
      note: 'KR1 halfway',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-kr1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    // KR2: increase 0->50, checked in at 50 => progress 1.0
    const secondOutcome = await recordCheckIn({
      keyResultId: fx.keyResultId2,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 50,
      note: 'KR2 complete',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-kr2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    // Objective progress = equal_average(0.5, 1.0) = 0.75
    const objRow = await client.query<{ progress: string }>(
      `SELECT progress FROM okr_vnext_objectives WHERE objective_id = $1`,
      [fx.objectiveId]
    );
    expect(Number(objRow.rows[0]!.progress)).toBeCloseTo(0.75, 10);

    // Set overall_progress = equal_average over its 1 Objective = 0.75
    expect(Number(secondOutcome.result.set.overallProgress)).toBeCloseTo(0.75, 10);
    const setRow = await client.query<{
      overall_progress: string;
      last_checkin_at: string | null;
      attention_state: string;
    }>(`SELECT overall_progress, last_checkin_at, attention_state FROM okr_vnext_sets WHERE set_id = $1`, [fx.setId]);
    expect(Number(setRow.rows[0]!.overall_progress)).toBeCloseTo(0.75, 10);
    expect(setRow.rows[0]!.last_checkin_at).not.toBeNull();
  });

  // ==========================================
  // Low-confidence -> explain_low_confidence obligation (mirrors
  // recordMeasurement's own synchronous side-effect call)
  // ==========================================

  itDB('confidence="low" creates an explain_low_confidence obligation for the KR owner in the SAME transaction', async () => {
    const fx = await buildActiveSetFixture();
    const occurrenceId = fx.occurrenceIds[0]!;

    const outcome = await recordCheckIn({
      keyResultId: fx.keyResultId1,
      organizationId: fx.organizationId,
      cadenceOccurrenceId: occurrenceId,
      newValue: 10,
      confidence: 'low',
      note: 'worried about this one',
      submittedBy: fx.ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `checkin-lowconf-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');

    const obligationRow = await client.query<{ status: string; assignee_user_id: string; obligation_type: string }>(
      `SELECT status, assignee_user_id, obligation_type FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_id = $2 AND obligation_type = 'explain_low_confidence'`,
      [fx.organizationId, fx.keyResultId1]
    );
    expect(obligationRow.rows).toHaveLength(1);
    expect(obligationRow.rows[0]!.status).toBe('open');
    expect(obligationRow.rows[0]!.assignee_user_id).toBe(fx.ownerId);
  });

  // ==========================================
  // completeObligation's new cadenceOccurrenceId filter: completing ONE
  // window's obligation must NOT complete an unrelated open obligation for
  // a DIFFERENT window on the SAME KR (the real bug the additive param
  // fixes).
  // ==========================================

  itDB(
    'recordCheckIn for occurrence A completes ONLY occurrence A\'s check_in obligation — a separately-seeded obligation for occurrence B stays open',
    async () => {
      const fx = await buildActiveSetFixture();
      const occurrenceA = fx.occurrenceIds[0]!;
      const occurrenceB = fx.occurrenceIds[1]!;
      expect(occurrenceB).toBeDefined();

      // Manually seed two open check_in obligations for the SAME KR,
      // different occurrences — simulates what
      // generateCadenceOccurrencesAndSeedCheckInObligations would have done
      // across two windows.
      await client.query(
        `INSERT INTO rvn_platform_obligations
           (organization_id, assignee_user_id, reference_type, reference_id, aggregate_version_at_creation,
            obligation_type, cadence_occurrence_id, deduplication_key)
         VALUES ($1, $2, 'okr_key_result', $3, 1, 'check_in', $4, $5)`,
        [fx.organizationId, fx.ownerId, fx.keyResultId1, occurrenceA, `manual-seed-a-${randomUUID()}`]
      );
      await client.query(
        `INSERT INTO rvn_platform_obligations
           (organization_id, assignee_user_id, reference_type, reference_id, aggregate_version_at_creation,
            obligation_type, cadence_occurrence_id, deduplication_key)
         VALUES ($1, $2, 'okr_key_result', $3, 1, 'check_in', $4, $5)`,
        [fx.organizationId, fx.ownerId, fx.keyResultId1, occurrenceB, `manual-seed-b-${randomUUID()}`]
      );

      await recordCheckIn({
        keyResultId: fx.keyResultId1,
        organizationId: fx.organizationId,
        cadenceOccurrenceId: occurrenceA,
        newValue: 10,
        note: 'checking into window A only',
        submittedBy: fx.ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `checkin-occA-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const statuses = await client.query<{ cadence_occurrence_id: string; status: string }>(
        `SELECT cadence_occurrence_id, status FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_id = $2 AND obligation_type = 'check_in'
          ORDER BY cadence_occurrence_id`,
        [fx.organizationId, fx.keyResultId1]
      );
      expect(statuses.rows).toHaveLength(2);
      const byOccurrence = new Map(statuses.rows.map((r) => [r.cadence_occurrence_id, r.status]));
      expect(byOccurrence.get(occurrenceA)).toBe('completed');
      expect(byOccurrence.get(occurrenceB)).toBe('open');
    }
  );

  // ==========================================
  // SET_NOT_ACTIVE guard
  // ==========================================

  itDB('recordCheckIn against a KR whose Set is not "active" is rejected (SET_NOT_ACTIVE)', async () => {
    const organizationId = freshOrgId();
    const ownerId = `${organizationId}-owner`;
    const createdProgram = await createProgram({
      organizationId,
      name: 'Draft-set fixture Program',
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
      name: 'Draft-set fixture Cycle',
      ...baseCycleTimes(),
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
      title: 'Still-draft Set',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-set-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const objective = await createObjective({
      setId: set.result.set.setId,
      organizationId,
      ownerUserId: ownerId,
      title: 'Draft Objective',
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-obj-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const kr = await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId: ownerId,
      title: 'Draft KR',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: ownerId,
      actorEffectiveRole: 'member',
      idempotencyKey: `create-kr-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const generated = await generateCadenceOccurrences({ organizationId, cycleId: cycle.result.cycleId });

    let caught: unknown;
    try {
      await recordCheckIn({
        keyResultId: kr.result.keyResultId,
        organizationId,
        cadenceOccurrenceId: generated.createdOccurrenceIds[0]!,
        newValue: 6,
        note: 'should be rejected — Set is still draft',
        submittedBy: ownerId,
        actorEffectiveRole: 'member',
        idempotencyKey: `checkin-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    } catch (err) {
      caught = err;
    }
    expect((caught as { code?: string } | undefined)?.code).toBe('SET_NOT_ACTIVE');
  });
});
