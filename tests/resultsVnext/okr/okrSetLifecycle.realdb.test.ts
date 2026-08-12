/**
 * OKR-E002 — Set lifecycle: submission eligibility guard (D7), the full
 * draft -> submitted -> approved -> active pipeline (activateOkrSet reusing
 * the repurposed `okr_set.published` event, D9), requestChangesOnOkrSet,
 * cancel from every non-terminal state, and D3's real partial-unique-index
 * behavior ("cancelled frees the slot, closed does not") — against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.4/§4.6/§4.7,
 * D3/D9/D15.
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
const ORG_PREFIX = `okr-e002-setlife-org-${tag}`;
function freshOrgId(): string {
  return `${ORG_PREFIX}-${randomUUID()}`;
}
const USER_ADMIN = `okr-e002-setlife-admin-${tag}`;
const USER_OWNER = `okr-e002-setlife-owner-${tag}`;
const USER_REVIEWER = `okr-e002-setlife-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let requestChangesOnOkrSet: SetCommandsModule['requestChangesOnOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let OKR_SET_CANCEL_SPEC: SetCommandsModule['OKR_SET_CANCEL_SPEC'];
let OkrSetNotReadyForSubmissionError: SetCommandsModule['OkrSetNotReadyForSubmissionError'];
let OkrSetValidationError: SetCommandsModule['OkrSetValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

type ObjectiveCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];

/**
 * OKR-E003: `submitOkrSetForApproval` now also requires
 * `hasSufficientKeyResultCoverage` (>=2 non-cancelled KRs per non-cancelled
 * Objective) — this fixture helper gives a draft Set exactly that minimum
 * so this file's pre-existing lifecycle-focused assertions keep exercising
 * submit/approve/activate/cancel, not blocked earlier by the new
 * submission guard.
 */
async function addSufficientKeyResultCoverage(setId: string, organizationId: string, ownerUserId: string): Promise<void> {
  const objective = await createObjective({
    setId,
    organizationId,
    ownerUserId,
    title: 'Lifecycle fixture Objective',
    createdBy: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `fixture-objective-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  for (let i = 0; i < 2; i += 1) {
    await createKeyResult({
      objectiveId: objective.result.objectiveId,
      organizationId,
      ownerUserId,
      title: `Lifecycle fixture KR ${i + 1}`,
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: 10,
      currentValue: 5,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `fixture-kr-${i}-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  }
}

function baseCycleTimes(): {
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  activeStartAt: string;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  closeAt: string;
} {
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

/** Creates + publishes a fresh Program (also authors the domain='okr'
 * visibility policy), opens a Cycle under it — the minimum fixture every
 * Set command needs (program_id/cycle_id FK NOT NULL). */
async function createProgramAndCycle(): Promise<{ organizationId: string; programId: string; cycleId: string }> {
  const organizationId = freshOrgId();
  const created = await createProgram({
    organizationId,
    name: 'Set-lifecycle fixture Program',
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  const published = await publishProgram({
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
    name: 'Set-lifecycle fixture Cycle',
    ...baseCycleTimes(),
    createdBy: USER_ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
  void published;
  return { organizationId, programId: created.result.programId, cycleId: cycle.result.cycleId };
}

describe('OKR-E002 Set lifecycle — submission guard, full pipeline, cancel, D3 uniqueness (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR Set lifecycle realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
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
    requestChangesOnOkrSet = setCommands.requestChangesOnOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_ACTIVATE_SPEC = setCommands.OKR_SET_ACTIVATE_SPEC;
    OKR_SET_CANCEL_SPEC = setCommands.OKR_SET_CANCEL_SPEC;
    OkrSetNotReadyForSubmissionError = setCommands.OkrSetNotReadyForSubmissionError;
    OkrSetValidationError = setCommands.OkrSetValidationError;

    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    createObjective = objectiveCommands.createObjective;

    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    createKeyResult = keyResultCommands.createKeyResult;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_PREFIX}%`;
    await client.query(
      `DELETE FROM okr_vnext_set_versions WHERE set_id IN (SELECT set_id FROM okr_vnext_sets WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(
      `UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id LIKE $1`,
      [orgLike]
    );
    // OKR-E003: okr_vnext_key_results/okr_vnext_objectives REFERENCE
    // okr_vnext_sets — must be deleted before the Set rows below, or the
    // FK constraint blocks the DELETE.
    await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id LIKE $1`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id LIKE $1)`, [orgLike]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1 AND resource_type = 'okr_set'`, [orgLike]);
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
  // submitOkrSetForApproval — D7 eligibility guard
  // ==========================================

  itDB('submitOkrSetForApproval rejects with OkrSetNotReadyForSubmissionError when no reviewer is assigned', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'No-reviewer fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-no-reviewer-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(created.result.set.reviewerUserId).toBeNull();

    await expect(
      submitOkrSetForApproval({
        setId: created.result.set.setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-no-reviewer-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toBeInstanceOf(OkrSetNotReadyForSubmissionError);
  });

  // ==========================================
  // Full pipeline: draft -> submitted -> approved -> active
  // ==========================================

  itDB(
    'full pipeline draft -> submitted -> approved -> active, activateOkrSet emits the repurposed okr_set.published event, ' +
      'out-of-order activate from draft is rejected',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const created = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        scopeType: 'individual',
        scopeId: USER_OWNER,
        ownerUserId: USER_OWNER,
        reviewerUserId: USER_REVIEWER,
        title: 'Full pipeline fixture Set',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-pipeline-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const setId = created.result.set.setId;

      // Out-of-order: cannot activate directly from 'draft'.
      await expect(
        runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
          setId,
          organizationId,
          expectedVersion: created.result.set.rowVersion,
          actorUserId: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `activate-out-of-order-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrSetValidationError);

      await addSufficientKeyResultCoverage(setId, organizationId, USER_OWNER);
      const submitted = await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(submitted.result.status).toBe('submitted');
      expect(submitted.result.submittedBy).toBe(USER_OWNER);

      const approved = await approveOkrSet({
        setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        approverId: USER_REVIEWER,
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(approved.result.set.status).toBe('approved');
      expect(approved.result.set.approvedBy).toBe(USER_REVIEWER);
      expect(approved.result.set.approvedVersion).toBe(1);
      expect(approved.result.snapshot.sequenceNumber).toBe(1);

      const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
        setId,
        organizationId,
        expectedVersion: approved.result.set.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `activate-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(activated.result.status).toBe('active');

      // D9: activateOkrSet's event reuses the pre-existing 'okr_set.published'
      // key — verify a row with exactly that event_type was written, not a
      // second/duplicate key.
      const publishedEvents = await client.query<{ event_type: string; aggregate_id: string }>(
        `SELECT event_type, aggregate_id FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'okr_set.published'`,
        [organizationId, setId]
      );
      expect(publishedEvents.rowCount).toBe(1);

      // Terminal-for-this-epic transitions: activating again must reject.
      await expect(
        runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
          setId,
          organizationId,
          expectedVersion: activated.result.rowVersion,
          actorUserId: USER_ADMIN,
          actorEffectiveRole: 'admin',
          idempotencyKey: `activate-again-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrSetValidationError);
    }
  );

  // ==========================================
  // requestChangesOnOkrSet
  // ==========================================

  itDB(
    'requestChangesOnOkrSet: submitted -> changes_requested -> resubmit -> submitted; ' +
      'rejected from draft (NOT_SUBMITTED)',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const created = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        scopeType: 'individual',
        scopeId: USER_OWNER,
        ownerUserId: USER_OWNER,
        reviewerUserId: USER_REVIEWER,
        title: 'Request-changes fixture Set',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-changes-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const setId = created.result.set.setId;

      await expect(
        requestChangesOnOkrSet({
          setId,
          organizationId,
          expectedVersion: created.result.set.rowVersion,
          actorUserId: USER_REVIEWER,
          changeRequestNotes: 'too early',
          actorEffectiveRole: 'member',
          idempotencyKey: `request-changes-from-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
      ).rejects.toBeInstanceOf(OkrSetValidationError);

      await addSufficientKeyResultCoverage(setId, organizationId, USER_OWNER);
      const submitted = await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: created.result.set.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-for-changes-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const changesRequested = await requestChangesOnOkrSet({
        setId,
        organizationId,
        expectedVersion: submitted.result.rowVersion,
        actorUserId: USER_REVIEWER,
        changeRequestNotes: 'please add a reviewer note',
        actorEffectiveRole: 'member',
        idempotencyKey: `request-changes-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(changesRequested.result.status).toBe('changes_requested');
      expect(changesRequested.result.changesRequestedReason).toBe('please add a reviewer note');

      const resubmitted = await submitOkrSetForApproval({
        setId,
        organizationId,
        expectedVersion: changesRequested.result.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `resubmit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(resubmitted.result.status).toBe('submitted');
    }
  );

  // ==========================================
  // cancelOkrSet — from every non-terminal state
  // ==========================================

  itDB('cancel from "draft"', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();
    const created = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: USER_OWNER,
      ownerUserId: USER_OWNER,
      title: 'Cancel-from-draft fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-cancel-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelled = await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId: created.result.set.setId,
      organizationId,
      expectedVersion: created.result.set.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelled.result.status).toBe('cancelled');
  });

  itDB('cancel from "submitted", "approved", and "active"', async () => {
    const { organizationId, programId, cycleId } = await createProgramAndCycle();

    // submitted
    const s1 = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: `${USER_OWNER}-s1`,
      ownerUserId: `${USER_OWNER}-s1`,
      reviewerUserId: USER_REVIEWER,
      title: 'Cancel-from-submitted fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-cancel-submitted-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await addSufficientKeyResultCoverage(s1.result.set.setId, organizationId, `${USER_OWNER}-s1`);
    const submitted1 = await submitOkrSetForApproval({
      setId: s1.result.set.setId,
      organizationId,
      expectedVersion: s1.result.set.rowVersion,
      actorUserId: `${USER_OWNER}-s1`,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-cancel-submitted-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelledFromSubmitted = await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId: s1.result.set.setId,
      organizationId,
      expectedVersion: submitted1.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-submitted-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelledFromSubmitted.result.status).toBe('cancelled');

    // approved
    const s2 = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: `${USER_OWNER}-s2`,
      ownerUserId: `${USER_OWNER}-s2`,
      reviewerUserId: USER_REVIEWER,
      title: 'Cancel-from-approved fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-cancel-approved-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await addSufficientKeyResultCoverage(s2.result.set.setId, organizationId, `${USER_OWNER}-s2`);
    const submitted2 = await submitOkrSetForApproval({
      setId: s2.result.set.setId,
      organizationId,
      expectedVersion: s2.result.set.rowVersion,
      actorUserId: `${USER_OWNER}-s2`,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-cancel-approved-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const approved2 = await approveOkrSet({
      setId: s2.result.set.setId,
      organizationId,
      expectedVersion: submitted2.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-cancel-approved-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelledFromApproved = await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId: s2.result.set.setId,
      organizationId,
      expectedVersion: approved2.result.set.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-approved-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelledFromApproved.result.status).toBe('cancelled');

    // active
    const s3 = await createOkrSet({
      organizationId,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: `${USER_OWNER}-s3`,
      ownerUserId: `${USER_OWNER}-s3`,
      reviewerUserId: USER_REVIEWER,
      title: 'Cancel-from-active fixture Set',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-set-cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await addSufficientKeyResultCoverage(s3.result.set.setId, organizationId, `${USER_OWNER}-s3`);
    const submitted3 = await submitOkrSetForApproval({
      setId: s3.result.set.setId,
      organizationId,
      expectedVersion: s3.result.set.rowVersion,
      actorUserId: `${USER_OWNER}-s3`,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const approved3 = await approveOkrSet({
      setId: s3.result.set.setId,
      organizationId,
      expectedVersion: submitted3.result.rowVersion,
      approverId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const active3 = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
      setId: s3.result.set.setId,
      organizationId,
      expectedVersion: approved3.result.set.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `activate-cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const cancelledFromActive = await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
      setId: s3.result.set.setId,
      organizationId,
      expectedVersion: active3.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `cancel-active-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(cancelledFromActive.result.status).toBe('cancelled');
  });

  // ==========================================
  // D3 — real partial-unique-index behavior
  // ==========================================

  itDB(
    'D3: cancelling a Set frees its (org,program,cycle,scope,owner) slot for a brand-new Set',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const ownerId = `${USER_OWNER}-d3-cancel`;
      const tuple = { scopeType: 'individual' as const, scopeId: ownerId, ownerUserId: ownerId };

      const first = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        ...tuple,
        title: 'D3 cancel-frees-slot fixture Set A',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-d3-cancel-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(first.result.created).toBe(true);

      const cancelledFirst = await runOkrSetLifecycleTransition(OKR_SET_CANCEL_SPEC, {
        setId: first.result.set.setId,
        organizationId,
        expectedVersion: first.result.set.rowVersion,
        actorUserId: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `cancel-set-d3-a-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(cancelledFirst.result.status).toBe('cancelled');

      // Same exact tuple, brand-new attempt — must create a NEW Set, not
      // return the cancelled one.
      const second = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        ...tuple,
        title: 'D3 cancel-frees-slot fixture Set B',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-d3-cancel-b-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(second.result.created).toBe(true);
      expect(second.result.set.setId).not.toBe(first.result.set.setId);
      expect(second.result.set.status).toBe('draft');
    }
  );

  itDB(
    'D3: a "closed" Set (direct fixture manipulation — no E002 command reaches "closed") ' +
      'still occupies its slot; a same-tuple create returns it (created:false), never a new row',
    async () => {
      const { organizationId, programId, cycleId } = await createProgramAndCycle();
      const ownerId = `${USER_OWNER}-d3-closed`;
      const tuple = { scopeType: 'individual' as const, scopeId: ownerId, ownerUserId: ownerId };

      const first = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        ...tuple,
        title: 'D3 closed-does-not-free fixture Set',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-d3-closed-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(first.result.created).toBe(true);

      // No E002 command reaches 'closed' — direct fixture manipulation,
      // same class of setup OKR-E001's own realdb tests use for
      // 'suspended' Program.
      await client.query(`UPDATE okr_vnext_sets SET status = 'closed' WHERE set_id = $1`, [first.result.set.setId]);

      const second = await createOkrSet({
        organizationId,
        programId,
        cycleId,
        ...tuple,
        title: 'D3 closed-does-not-free fixture Set — attempted duplicate',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `create-set-d3-closed-dup-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(second.result.created).toBe(false);
      expect(second.result.set.setId).toBe(first.result.set.setId);
      expect(second.result.set.status).toBe('closed');

      const rows = await client.query(
        `SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1 AND scope_id = $2`,
        [organizationId, ownerId]
      );
      expect(rows.rowCount).toBe(1);
    }
  );
});
