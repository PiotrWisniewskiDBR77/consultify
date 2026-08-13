/**
 * RN-G6-SRV — against a REAL Postgres:
 *
 *   TASK 1 (D08/B2, docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md
 *   §OQ-UI-C): `okr_vnext_sets.overall_progress_reason`/
 *   `overall_confidence_reason` and `okr_vnext_checkins.calculated_progress_reason`
 *   (server/migrations/20260831_rvn_okr_not_calculable_reason.sql) — proving
 *   the computed reason ACTUALLY reaches the column, not just the pure
 *   calculator (already covered by okrSetRollupCalculator.test.ts).
 *
 *   TASK 3: `POST /objectives/:objectiveId/reflection/teresa-draft-disposition`
 *   (okr.routes.ts) — the route itself is a thin wrapper over the already
 *   fully-tested `recordOkrReflectionTeresaDraftDisposition`
 *   (okrReflectionTeresaDraft.realdb.test.ts covers the command in depth);
 *   this file proves the NEW code the route itself adds: the
 *   existingObjective 404 pre-check (D06 generic denial, reusing
 *   `getObjective`) and the capability gate, called exactly the way the
 *   route calls them.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — if no database is configured, every scenario below is a
 * silent no-op and this file reports green; that is NOT evidence the
 * behavior works. If a database IS configured but unreachable, `beforeAll`
 * throws so this run is never silently green.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  type OkrE007Fixture,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `rn-g6-srv-reason-org-${tag}`;
// ux_okr_vnext_programs_one_active_per_org allows only ONE active Program
// per organization_id — the "empty Set" scenario below creates its OWN
// Program (deliberately never submitted/approved, so it cannot reuse the
// shared E007 fixture's Set), so it needs its own organization_id, distinct
// from ORG_ID (which `buildActiveOkrSetFixture` already publishes a Program
// into during `beforeAll`).
const EMPTY_SET_ORG_ID = `rn-g6-srv-reason-emptyset-org-${tag}`;
const STRANGER_ORG_ID = `rn-g6-srv-reason-stranger-org-${tag}`;
const USER_ADMIN = `rn-g6-srv-reason-admin-${tag}`;
const USER_OWNER = `rn-g6-srv-reason-owner-${tag}`;
const USER_REVIEWER = `rn-g6-srv-reason-reviewer-${tag}`;
const USER_STRANGER = `rn-g6-srv-reason-stranger-${tag}`;

let client: Client;
let reachable = false;
let fixture: OkrE007Fixture;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type CycleSchedulerModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type CheckInCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js');
type SetRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
type ObjectiveRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveRepository.js');
type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let baseCycleTimesFn: () => Record<string, string>;
let generateCadenceOccurrences: CycleSchedulerModule['generateCadenceOccurrences'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let resolveOkrCyclePinnedPolicySnapshot: ObjectiveCommandsModule['resolveOkrCyclePinnedPolicySnapshot'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let recordCheckIn: CheckInCommandsModule['recordCheckIn'];
let applySetRollupUpdate: CheckInCommandsModule['applySetRollupUpdate'];
let getOkrSet: SetRepositoryModule['getOkrSet'];
let getObjective: ObjectiveRepositoryModule['getObjective'];
let recordOkrReflectionTeresaDraft: ReflectionCommandsModule['recordOkrReflectionTeresaDraft'];
let recordOkrReflectionTeresaDraftDisposition: ReflectionCommandsModule['recordOkrReflectionTeresaDraftDisposition'];
let CommandCapabilityDeniedErrorCtor: typeof import('../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js').CommandCapabilityDeniedError;
let AtomicWriteConflictErrorCtor: typeof import('../../../server/src/services/resultsVnext/platform/atomicWrite.js').AtomicWriteConflictError;
let acquirePgClient: () => Promise<import('pg').PoolClient>;
let closePgPool: (() => Promise<void>) | undefined;

const WILDCARD_ACCESS = { capabilities: ['*'], platformRole: null } as const;

describe('RN-G6-SRV — OKR Set/Check-in not_calculable reason persistence + Teresa draft disposition route (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — RN-G6-SRV OKR reason/teresa-disposition tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT overall_progress_reason, overall_confidence_reason FROM okr_vnext_sets LIMIT 0');
      await client.query('SELECT calculated_progress_reason FROM okr_vnext_checkins LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the RN-G6-SRV not_calculable-reason columns); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;
    const cycleCommands: CycleCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
    createCycle = cycleCommands.createCycle;
    const cycleScheduler: CycleSchedulerModule = await import('../../../server/src/services/resultsVnext/okr/okrCycleScheduler.js');
    generateCadenceOccurrences = cycleScheduler.generateCadenceOccurrences;
    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    createOkrSet = setCommands.createOkrSet;
    const objectiveCommands: ObjectiveCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
    createObjective = objectiveCommands.createObjective;
    resolveOkrCyclePinnedPolicySnapshot = objectiveCommands.resolveOkrCyclePinnedPolicySnapshot;
    const keyResultCommands: KeyResultCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
    createKeyResult = keyResultCommands.createKeyResult;
    const checkInCommands: CheckInCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrCheckInCommands.js');
    recordCheckIn = checkInCommands.recordCheckIn;
    applySetRollupUpdate = checkInCommands.applySetRollupUpdate;
    const setRepository: SetRepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
    getOkrSet = setRepository.getOkrSet;
    const objectiveRepository: ObjectiveRepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrObjectiveRepository.js');
    getObjective = objectiveRepository.getObjective;
    const reflectionCommands: ReflectionCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
    recordOkrReflectionTeresaDraft = reflectionCommands.recordOkrReflectionTeresaDraft;
    recordOkrReflectionTeresaDraftDisposition = reflectionCommands.recordOkrReflectionTeresaDraftDisposition;

    const capabilityGuardModule = await import('../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js');
    CommandCapabilityDeniedErrorCtor = capabilityGuardModule.CommandCapabilityDeniedError;
    const atomicWriteModule = await import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
    AtomicWriteConflictErrorCtor = atomicWriteModule.AtomicWriteConflictError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    acquirePgClient = (pgModule as unknown as { acquirePgClient: () => Promise<import('pg').PoolClient> }).acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    baseCycleTimesFn = () => ({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      draftOpenAt: '2025-12-15T00:00:00.000Z',
      submissionDueAt: '2025-12-28T00:00:00.000Z',
      activeStartAt: '2026-01-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-12-31T00:00:00.000Z',
      reviewOpenAt: '2027-01-01T00:00:00.000Z',
      reflectionDueAt: '2027-01-03T00:00:00.000Z',
      closeAt: '2027-01-05T00:00:00.000Z',
    });

    fixture = await buildActiveOkrSetFixture({
      organizationId: ORG_ID,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
    });
  }, 60_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_ID}%`;
    await client.query(`DELETE FROM okr_vnext_checkins WHERE organization_id LIKE $1`, [orgLike]);
    await cleanupOkrE007Fixture(client, ORG_ID);
    const emptySetOrgLike = `${EMPTY_SET_ORG_ID}%`;
    await client.query(`DELETE FROM okr_vnext_checkins WHERE organization_id LIKE $1`, [emptySetOrgLike]);
    await cleanupOkrE007Fixture(client, EMPTY_SET_ORG_ID);
    await client.end();
    if (closePgPool) await closePgPool();
  });

  // ==========================================
  // TASK 1a — a freshly-created Set with ZERO objectives: applySetRollupUpdate
  // (the exact function recordCheckIn/correctCheckIn/the scheduler all
  // share) persists a `not_calculable:`-prefixed reason on BOTH new columns.
  // ==========================================

  it('fresh Set, zero objectives: overall_progress_reason/overall_confidence_reason both persist with a not_calculable: prefix', async () => {
    if (!reachable) return;

    const program = await createProgram({
      organizationId: EMPTY_SET_ORG_ID,
      name: 'RN-G6-SRV empty-set reason fixture Program',
      // createProgram's own default is objectiveRollupModel: 'none' (a
      // deliberate non-rollup — see okrProgressEngine.ts) — explicit here
      // so the SECOND half of this test (after adding a real Objective/KR)
      // actually exercises a real numeric rollup instead of asserting
      // against another intentional not-computed case.
      objectiveRollupModel: 'equal_average',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `rn-g6-srv-empty-program-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });
    await publishProgram({
      programId: program.result.programId,
      organizationId: EMPTY_SET_ORG_ID,
      expectedVersion: program.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `rn-g6-srv-empty-publish-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });
    const cycle = await createCycle({
      organizationId: EMPTY_SET_ORG_ID,
      programId: program.result.programId,
      name: 'RN-G6-SRV empty-set reason fixture Cycle',
      ...baseCycleTimesFn(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `rn-g6-srv-empty-cycle-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });
    const set = await createOkrSet({
      organizationId: EMPTY_SET_ORG_ID,
      programId: program.result.programId,
      cycleId: cycle.result.cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      title: 'RN-G6-SRV empty-set reason fixture Set',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `rn-g6-srv-empty-set-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });
    const setId = set.result.set.setId;

    // Zero objectives ever created under this Set — deliberately never
    // submitted/approved/activated (cancelObjective is blocked once a Set
    // leaves draft/changes_requested, so "zero non-cancelled objectives"
    // cannot be reached on an ACTIVE Set through the normal lifecycle;
    // calling applySetRollupUpdate directly on the still-draft Set is the
    // only way to reach objectiveCount===0 against a real row, and it
    // exercises the exact same UPDATE statement the command/scheduler use).
    const pgClient = await acquirePgClient();
    try {
      const setRowResult = await pgClient.query(`SELECT * FROM okr_vnext_sets WHERE set_id = $1`, [setId]);
      const setRow = setRowResult.rows[0];
      const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(pgClient, setId, EMPTY_SET_ORG_ID);
      await applySetRollupUpdate(pgClient, setRow, EMPTY_SET_ORG_ID, USER_ADMIN, snapshot);
    } finally {
      pgClient.release();
    }

    const readBack = await client.query(
      `SELECT overall_progress, overall_confidence, overall_progress_reason, overall_confidence_reason
         FROM okr_vnext_sets WHERE set_id = $1`,
      [setId]
    );
    const row = readBack.rows[0];
    expect(row.overall_progress).toBeNull();
    expect(row.overall_confidence).toBeNull();
    expect(row.overall_progress_reason).toMatch(/^not_calculable:/);
    expect(row.overall_confidence_reason).toMatch(/^not_calculable:/);

    // Now add a real Objective + KR with a calculable current value to the
    // SAME set (still draft, so createObjective/createKeyResult are legal),
    // recompute, and prove the reason flips to a real (non not_calculable)
    // derivation — "po rollupie realną wartość".
    const objective = await createObjective({
      setId,
      organizationId: EMPTY_SET_ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'RN-G6-SRV empty-set reason fixture Objective',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `rn-g6-srv-empty-obj-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId: EMPTY_SET_ORG_ID,
      ownerUserId: USER_OWNER,
      title: 'RN-G6-SRV empty-set reason fixture KR',
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `rn-g6-srv-empty-kr-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });

    const pgClient2 = await acquirePgClient();
    try {
      const setRowResult = await pgClient2.query(`SELECT * FROM okr_vnext_sets WHERE set_id = $1`, [setId]);
      const setRow = setRowResult.rows[0];
      const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(pgClient2, setId, EMPTY_SET_ORG_ID);
      await applySetRollupUpdate(pgClient2, setRow, EMPTY_SET_ORG_ID, USER_ADMIN, snapshot);
    } finally {
      pgClient2.release();
    }

    const readBack2 = await client.query(
      `SELECT overall_progress, overall_progress_reason FROM okr_vnext_sets WHERE set_id = $1`,
      [setId]
    );
    const row2 = readBack2.rows[0];
    expect(row2.overall_progress).not.toBeNull();
    expect(row2.overall_progress_reason).not.toMatch(/^not_calculable:/);
    expect(row2.overall_progress_reason).toMatch(/^set_rollup\(/);
  });

  // ==========================================
  // TASK 1b — a real recordCheckIn on the E007 fixture's active Set: proves
  // (i) the check-in's OWN calculated_progress_reason is persisted, (ii) the
  // Set-level reason columns are updated in the SAME transaction with a
  // real (non-not_calculable) derivation, and (iii) `getOkrSet` — the exact
  // repository function `GET /sets/:setId` calls — returns both new fields
  // on the DTO ("GET zwraca nowe pole").
  // ==========================================

  it('recordCheckIn persists calculated_progress_reason on the check-in row and a real reason on the Set; getOkrSet surfaces it', async () => {
    if (!reachable) return;

    const krResult = await client.query(
      `SELECT key_result_id, direction FROM okr_vnext_key_results WHERE objective_id = $1 LIMIT 1`,
      [fixture.objectiveIds[0]]
    );
    const keyResultId = krResult.rows[0].key_result_id as string;

    const generated = await generateCadenceOccurrences({ organizationId: fixture.organizationId, cycleId: fixture.cycleId });
    expect(generated.createdOccurrenceIds.length).toBeGreaterThan(0);
    const cadenceOccurrenceId = generated.createdOccurrenceIds[0];

    const outcome = await recordCheckIn({
      keyResultId,
      organizationId: fixture.organizationId,
      cadenceOccurrenceId,
      newValue: 7,
      note: 'RN-G6-SRV reason persistence probe',
      submittedBy: fixture.ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `rn-g6-srv-checkin-reason-${randomUUID()}`,
      access: WILDCARD_ACCESS,
    });

    expect(outcome.outcome).toBe('applied');
    const { checkIn, set } = outcome.result;

    // (i) check-in's own reason, returned by the command...
    expect(checkIn.calculatedProgressReason).not.toBeNull();
    expect(typeof checkIn.calculatedProgressReason).toBe('string');
    expect(checkIn.calculatedProgressReason).toMatch(/^reach:/);

    // ...and independently re-read straight off the row via raw SQL — the
    // literal "dociera na drut" proof, not trusting the in-process DTO.
    const checkinRow = await client.query(
      `SELECT calculated_progress, calculated_progress_reason FROM okr_vnext_checkins WHERE checkin_id = $1`,
      [checkIn.checkInId]
    );
    expect(checkinRow.rows[0].calculated_progress_reason).toBe(checkIn.calculatedProgressReason);
    expect(checkinRow.rows[0].calculated_progress).not.toBeNull();

    // (ii) Set-level reason, from the SAME command outcome...
    expect(set.overallProgressReason).not.toBeNull();
    expect(set.overallProgressReason).not.toMatch(/^not_calculable:/);
    expect(set.overallConfidenceReason).not.toBeNull();

    // ...re-read via raw SQL...
    const setRow = await client.query(
      `SELECT overall_progress_reason, overall_confidence_reason FROM okr_vnext_sets WHERE set_id = $1`,
      [set.setId]
    );
    expect(setRow.rows[0].overall_progress_reason).toBe(set.overallProgressReason);
    expect(setRow.rows[0].overall_confidence_reason).toBe(set.overallConfidenceReason);

    // (iii) and via the EXACT function `GET /api/vnext/results/okr/sets/:setId`
    // calls (okr.routes.ts's getOkrSet import) — proving the field is on
    // the wire the route would actually serve, not just in the DB.
    const viaRoute = await getOkrSet({ userId: fixture.ownerUserId, organizationId: fixture.organizationId, setId: set.setId });
    expect(viaRoute).not.toBeNull();
    expect(viaRoute?.overallProgressReason).toBe(set.overallProgressReason);
    expect(viaRoute?.overallConfidenceReason).toBe(set.overallConfidenceReason);
  });

  // ==========================================
  // TASK 3 — POST .../objectives/:objectiveId/reflection/teresa-draft-disposition
  // route wiring: the route's own new code is (a) the existingObjective
  // D06 pre-check via `getObjective` and (b) passing the body through to
  // `recordOkrReflectionTeresaDraftDisposition` — both called here exactly
  // as the route calls them. The command itself (CAS, status guard,
  // narrative-field isolation) already has dedicated coverage in
  // okrReflectionTeresaDraft.realdb.test.ts and is not re-proven here.
  // ==========================================

  describe('Task 3 — recordOkrReflectionTeresaDraftDisposition route wiring', () => {
    it('getObjective (the route\'s D06 pre-check) finds the real objective for its owner', async () => {
      if (!reachable) return;
      const objective = await getObjective({
        userId: fixture.ownerUserId,
        organizationId: fixture.organizationId,
        objectiveId: fixture.objectiveIds[1],
      });
      expect(objective).not.toBeNull();
    });

    it('getObjective returns null (generic 404, D06) for a random objectiveId — the route never distinguishes "not found" from "not visible"', async () => {
      if (!reachable) return;
      const objective = await getObjective({
        userId: fixture.ownerUserId,
        organizationId: fixture.organizationId,
        objectiveId: randomUUID(),
      });
      expect(objective).toBeNull();
    });

    it('getObjective returns null for a caller in a DIFFERENT organization — cross-org isolation, same generic 404 the route serves', async () => {
      if (!reachable) return;
      const objective = await getObjective({
        userId: USER_STRANGER,
        organizationId: STRANGER_ORG_ID,
        objectiveId: fixture.objectiveIds[1],
      });
      expect(objective).toBeNull();
    });

    it('records disposition end-to-end (create draft, then dispose) — narrative fields stay untouched, mirroring the command\'s own contract', async () => {
      if (!reachable) return;
      const objectiveId = fixture.objectiveIds[1];
      const drafted = await recordOkrReflectionTeresaDraft({
        objectiveId,
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        draftPayload: { whatWorked: 'draft text', why: 'draft reason' },
        actorUserId: fixture.ownerUserId,
        actorEffectiveRole: 'member',
        idempotencyKey: `rn-g6-srv-teresa-draft-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      expect(drafted.outcome).toBe('applied');

      const disposed = await recordOkrReflectionTeresaDraftDisposition({
        objectiveId,
        organizationId: fixture.organizationId,
        expectedVersion: drafted.resultingVersion,
        disposition: 'accepted',
        actorUserId: fixture.ownerUserId,
        actorEffectiveRole: 'member',
        idempotencyKey: `rn-g6-srv-teresa-disposition-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      expect(disposed.outcome).toBe('applied');
      expect(disposed.result.teresaDraftDisposition).toBe('accepted');
      expect(disposed.result.teresaDraftDispositionBy).toBe(fixture.ownerUserId);
      expect(disposed.result.whatWorked).toBeNull();
      expect(disposed.result.why).toBeNull();
    });

    it('capability gate: a non-owner actor with no wildcard/admin capability is denied (CommandCapabilityDeniedError) — maps to the route\'s generic 403', async () => {
      if (!reachable) return;
      const objectiveId = fixture.objectiveIds[0];
      const drafted = await recordOkrReflectionTeresaDraft({
        objectiveId,
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        draftPayload: { whatWorked: 'draft text 2' },
        actorUserId: fixture.ownerUserId,
        actorEffectiveRole: 'member',
        idempotencyKey: `rn-g6-srv-teresa-draft-cap-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      expect(drafted.outcome).toBe('applied');

      await expect(
        recordOkrReflectionTeresaDraftDisposition({
          objectiveId,
          organizationId: fixture.organizationId,
          expectedVersion: drafted.resultingVersion,
          disposition: 'accepted',
          actorUserId: USER_STRANGER,
          actorEffectiveRole: 'member',
          idempotencyKey: `rn-g6-srv-teresa-disposition-denied-${randomUUID()}`,
          access: { capabilities: [], platformRole: null },
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedErrorCtor);
    });

    it('stale expectedVersion is rejected with AtomicWriteConflictError — same CAS guarantee the route inherits', async () => {
      if (!reachable) return;
      const objectiveId = fixture.objectiveIds[0];
      // Reuses the draft created by the previous test (still status='draft',
      // no disposition recorded yet — the previous test's disposition call
      // was denied before ever writing).
      await expect(
        recordOkrReflectionTeresaDraftDisposition({
          objectiveId,
          organizationId: fixture.organizationId,
          expectedVersion: 999,
          disposition: 'rejected',
          actorUserId: fixture.ownerUserId,
          actorEffectiveRole: 'member',
          idempotencyKey: `rn-g6-srv-teresa-disposition-stale-${randomUUID()}`,
          access: WILDCARD_ACCESS,
        })
      ).rejects.toBeInstanceOf(AtomicWriteConflictErrorCtor);
    });
  });
});
