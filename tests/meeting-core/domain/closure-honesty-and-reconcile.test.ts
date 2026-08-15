/**
 * closure-honesty-and-reconcile.test.ts — proves the two closure-honesty
 * defects the adversarial reviewer confirmed empirically are actually fixed,
 * on real Postgres:
 *
 *  DEFEKT 1 (closure lies by omission): closeMeeting() used to report only
 *  PROPOSED (as `unresolvedOutputs`) and MATERIALIZATION_FAILED (as
 *  `failedOutputs`) — an APPROVED-but-never-materialized output and a
 *  crashed-mid-materialize MATERIALIZING output were both invisible, so a
 *  meeting with a stuck or abandoned output could close looking completely
 *  clean. This file proves the fixed shape: PROPOSED+APPROVED ->
 *  unresolvedOutputs, MATERIALIZATION_FAILED -> failedOutputs, MATERIALIZING
 *  -> its own `materializingOutputs` bucket — never folded together, never
 *  dropped.
 *
 *  DEFEKT 2 (no way out of MATERIALIZING): before reconcileMaterializingOutput
 *  existed, a row claimed by markOutputMaterializingRow but never confirmed
 *  (simulated crash) had no path forward — materializeOutput()'s atomic claim
 *  only accepts APPROVED|MATERIALIZATION_FAILED, on purpose (see repo.ts), so
 *  a bare retry threw ConflictError forever. This file proves
 *  reconcileMaterializingOutput() correctly resolves both outcomes: MATERIALIZED
 *  when the target was actually created before the crash, MATERIALIZATION_FAILED
 *  (with a retryable reason) when it wasn't — and that the FAILED branch really
 *  is retryable through the normal materializeOutput() path afterward.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ForbiddenError,
  IllegalTransitionError,
} from '../../../server/src/services/meetingCore/errors.js';
import {
  addParticipant,
  closeMeeting,
  createMeetingCore,
  transitionMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
  reconcileMaterializingOutput,
  rejectOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { TERESA_ACTOR_ID } from '../../../server/src/services/meetingCore/types.js';
import { countTasksBySource, createFakeMaterializer } from './fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

/** Directly flips a meeting_output row to MATERIALIZING, bypassing the saga — simulates a process that claimed the row (markOutputMaterializingRow) and then crashed before confirming anything. */
async function simulateCrashIntoMaterializing(db: DomainTestDb, outputId: string): Promise<void> {
  const result = await db.pool.query(
    `UPDATE meeting_outputs SET status = 'MATERIALIZING', updated_at = now() WHERE id = $1`,
    [outputId]
  );
  expect(result.rowCount).toBe(1); // sanity: the row we meant to mutate actually exists
}

/** Walks a freshly-created (DRAFT) meeting through the lifecycle up to CLOSING, the only state closeMeeting() accepts. */
async function walkToClosing(
  db: DomainTestDb,
  organizationId: string,
  meetingId: string,
  owner: string
): Promise<void> {
  await transitionMeeting(
    { organizationId, meetingId, actorUserId: owner, transition: 'START_PREPARING' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId, actorUserId: owner, transition: 'MARK_READY' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId, actorUserId: owner, transition: 'START_LIVE' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId, actorUserId: owner, transition: 'START_CLOSING' },
    db.pool
  );
}

describe('Meeting Core — closure honesty (DEFEKT 1) and MATERIALIZING reconcile (DEFEKT 2) on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('DEFEKT 1: closeMeeting reports PROPOSED+APPROVED as unresolvedOutputs, MATERIALIZATION_FAILED as failedOutputs, and MATERIALIZING as its own materializingOutputs bucket — never merged, never dropped', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Honest closure',
        startAt: '2026-06-20T09:00:00.000Z',
      },
      db.pool
    );

    // One output in every reachable status.
    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Still proposed' },
      },
      db.pool
    );

    const approvedOnly = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Approved, never materialized' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: approvedOnly.id, actorUserId: owner },
      db.pool
    );

    const rejected = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Rejected' },
      },
      db.pool
    );
    await rejectOutput(
      { organizationId, meetingId: meeting.id, outputId: rejected.id, actorUserId: owner },
      db.pool
    );

    const materialized = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Fully materialized' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: materialized.id, actorUserId: owner },
      db.pool
    );
    await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: materialized.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );

    const failed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Materialization failed' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: failed.id, actorUserId: owner },
      db.pool
    );
    await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: failed.id, actorUserId: owner },
      createFakeMaterializer(db.pool, { failTaskOnAttempt: 1 }),
      db.pool
    );

    const stuck = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Crashed mid-materialize' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: stuck.id, actorUserId: owner },
      db.pool
    );
    await simulateCrashIntoMaterializing(db, stuck.id);

    await walkToClosing(db, organizationId, meeting.id, owner);
    const result = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(result.meeting.lifecycleStatus).toBe('CLOSED');

    expect(result.unresolvedOutputs.map((o) => o.id).sort()).toEqual(
      [approvedOnly.id, proposed.id].sort()
    );
    expect(result.failedOutputs.map((o) => o.id)).toEqual([failed.id]);
    expect(result.failedOutputs[0].failureReason).toContain('simulated createTask failure');
    expect(result.materializingOutputs.map((o) => o.id)).toEqual([stuck.id]);

    // Fully resolved outputs (REJECTED, MATERIALIZED) appear in NONE of the three buckets.
    const allReportedIds = new Set([
      ...result.unresolvedOutputs.map((o) => o.id),
      ...result.failedOutputs.map((o) => o.id),
      ...result.materializingOutputs.map((o) => o.id),
    ]);
    expect(allReportedIds.has(rejected.id)).toBe(false);
    expect(allReportedIds.has(materialized.id)).toBe(false);
  });

  it('DEFEKT 2: reconcile resolves a stuck MATERIALIZING output to MATERIALIZED when the target was actually created before the crash', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Reconcile — target exists',
        startAt: '2026-06-21T09:00:00.000Z',
      },
      db.pool
    );
    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Task created before crash' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    // Simulate: the crashed process actually finished creating the target
    // (task.source_id = idempotency_key) but died before confirming
    // meeting_outputs -> MATERIALIZED.
    const preExistingId = `task-crashed-but-created-${proposed.id}`;
    await db.pool.query(
      `INSERT INTO tasks (id, organization_id, title, status, created_by, source_type, source_id)
       VALUES ($1, $2, $3, 'todo', $4, 'MEETING_OUTPUT', $5)`,
      [preExistingId, organizationId, 'Task created before crash', owner, proposed.idempotencyKey]
    );
    await simulateCrashIntoMaterializing(db, proposed.id);

    // Confirm it is genuinely stuck first: closeMeeting must report it as materializing.
    await walkToClosing(db, organizationId, meeting.id, owner);
    const beforeReconcile = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(beforeReconcile.materializingOutputs.map((o) => o.id)).toEqual([proposed.id]);

    const reconciled = await reconcileMaterializingOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );
    expect(reconciled.status).toBe('MATERIALIZED');
    expect(reconciled.canonicalId).toBe(preExistingId);
    expect(await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey)).toBe(1); // recovered, not duplicated

    const auditRows = await db.pool.query(
      `SELECT actor_id, action FROM audit_events WHERE resource_type = 'meeting_output' AND resource_id = $1 AND action = 'MEETING_OUTPUT_RECONCILED_MATERIALIZED'`,
      [proposed.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0].actor_id).toBe(owner);
  });

  it('DEFEKT 2: reconcile resolves a stuck MATERIALIZING output to MATERIALIZATION_FAILED (with a retryable reason) when the target was never created, and a subsequent materializeOutput() retry then succeeds', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Reconcile — target missing',
        startAt: '2026-06-22T09:00:00.000Z',
      },
      db.pool
    );
    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Never actually created' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );
    await simulateCrashIntoMaterializing(db, proposed.id);

    const reconciled = await reconcileMaterializingOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );
    expect(reconciled.status).toBe('MATERIALIZATION_FAILED');
    expect(reconciled.canonicalId).toBeNull();
    expect(reconciled.failureReason).toContain('Reconciled from stuck MATERIALIZING');
    expect(reconciled.failureReason).toContain('Safe to retry');

    const auditRows = await db.pool.query(
      `SELECT actor_id, action FROM audit_events WHERE resource_type = 'meeting_output' AND resource_id = $1 AND action = 'MEETING_OUTPUT_RECONCILED_FAILED'`,
      [proposed.id]
    );
    expect(auditRows.rows).toHaveLength(1);

    // Prove reconcile did not orphan the output: markOutputMaterializingRow's
    // accepted set (APPROVED | MATERIALIZATION_FAILED) still includes
    // MATERIALIZATION_FAILED, so the normal retry path works.
    const retried = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );
    expect(retried.status).toBe('MATERIALIZED');
    expect(await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey)).toBe(1);
  });

  it('reconcile refuses anything that is not currently MATERIALIZING (PROPOSED, APPROVED, and already-MATERIALIZED all rejected with IllegalTransitionError)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Reconcile wrong states',
        startAt: '2026-06-23T09:00:00.000Z',
      },
      db.pool
    );

    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Still proposed' },
      },
      db.pool
    );
    await expect(
      reconcileMaterializingOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const approved = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Approved but not claimed' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: approved.id, actorUserId: owner },
      db.pool
    );
    await expect(
      reconcileMaterializingOutput(
        { organizationId, meetingId: meeting.id, outputId: approved.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const done = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Already materialized' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: done.id, actorUserId: owner },
      db.pool
    );
    await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: done.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );
    await expect(
      reconcileMaterializingOutput(
        { organizationId, meetingId: meeting.id, outputId: done.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it('reconcile is gated to the same human roles as approve/reject — Teresa and an observer are both refused', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const observer = makeUserId('observer');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Reconcile role gate',
        startAt: '2026-06-24T09:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: observer,
        role: 'observer',
      },
      db.pool
    );

    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Stuck for role test' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );
    await simulateCrashIntoMaterializing(db, proposed.id);

    await expect(
      reconcileMaterializingOutput(
        {
          organizationId,
          meetingId: meeting.id,
          outputId: proposed.id,
          actorUserId: TERESA_ACTOR_ID,
        },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      reconcileMaterializingOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: observer },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Still genuinely stuck after both refusals — neither rejected attempt changed anything.
    await walkToClosing(db, organizationId, meeting.id, owner);
    const stillStuck = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(stillStuck.materializingOutputs.map((o) => o.id)).toEqual([proposed.id]);
  });

  it('decision-kind outputs reconcile through the decision lookup path, not the task one', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const decisionMaker = makeUserId('decider');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Reconcile a decision',
        startAt: '2026-06-25T09:00:00.000Z',
      },
      db.pool
    );
    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        outputKind: 'decision',
        payload: { title: 'Reconciled decision', decisionMakerId: decisionMaker },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    const preExistingId = `decision-crashed-but-created-${proposed.id}`;
    await db.pool.query(
      `INSERT INTO decisions (id, organization_id, title, type, decision_maker_id, created_by, source_type, source_id)
       VALUES ($1, $2, $3, 'APPROVAL', $4, $5, 'MEETING_OUTPUT', $6)`,
      [
        preExistingId,
        organizationId,
        'Reconciled decision',
        decisionMaker,
        owner,
        proposed.idempotencyKey,
      ]
    );
    await simulateCrashIntoMaterializing(db, proposed.id);

    const reconciled = await reconcileMaterializingOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );
    expect(reconciled.status).toBe('MATERIALIZED');
    expect(reconciled.canonicalId).toBe(preExistingId);
  });
});
