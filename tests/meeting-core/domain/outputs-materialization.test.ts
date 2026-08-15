/**
 * outputs-materialization.test.ts — the output-approval saga on real
 * scratch-PG: PROPOSED -> APPROVED -> MATERIALIZED, idempotent re-runs,
 * recovery-by-source-lookup after a simulated partial failure, and honest
 * MATERIALIZATION_FAILED reporting (never silently "looks done").
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ConflictError,
  ForbiddenError,
  IllegalTransitionError,
} from '../../../server/src/services/meetingCore/errors.js';
import {
  addParticipant,
  createMeetingCore,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
  rejectOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { TERESA_ACTOR_ID } from '../../../server/src/services/meetingCore/types.js';
import { countTasksBySource, createFakeMaterializer } from './fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

describe('Meeting Core — output materialization saga on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('happy path: Teresa proposes a task, owner approves, materialize creates exactly one task row keyed by idempotency_key', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      { organizationId, createdBy: owner, title: 'Task saga', startAt: '2026-06-01T09:00:00.000Z' },
      db.pool
    );

    const proposed = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: TERESA_ACTOR_ID,
        actorKind: 'system',
        outputKind: 'task',
        payload: { title: 'Follow up with client', description: 'from Teresa' },
      },
      db.pool
    );
    expect(proposed.status).toBe('PROPOSED');
    expect(proposed.proposedByKind).toBe('system');

    const approved = await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedBy).toBe(owner);

    const materializer = createFakeMaterializer(db.pool);
    const materialized = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );
    expect(materialized.status).toBe('MATERIALIZED');
    expect(materialized.canonicalId).toBeTruthy();

    const count = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);
    expect(count).toBe(1);
  });

  it('materializing an already-MATERIALIZED output is a pure no-op — same canonicalId, no second target row', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Idempotent re-run',
        startAt: '2026-06-02T09:00:00.000Z',
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
        payload: { title: 'Re-run me' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    const materializer = createFakeMaterializer(db.pool);
    const first = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );
    const second = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );

    expect(second.status).toBe('MATERIALIZED');
    expect(second.canonicalId).toBe(first.canonicalId);
    const count = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);
    expect(count).toBe(1);
  });

  it('proposal Idempotency-Key replays the same output and rejects a different payload', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Proposal replay',
        startAt: '2026-06-02T10:00:00.000Z',
      },
      db.pool
    );
    const input = {
      organizationId,
      meetingId: meeting.id,
      actorUserId: owner,
      actorKind: 'human' as const,
      outputKind: 'task' as const,
      payload: { title: 'One durable task', nested: { priority: 'high' } },
      requestIdempotencyKey: 'proposal-replay-0001',
    };

    const first = await proposeOutput(input, db.pool);
    const replay = await proposeOutput(
      { ...input, payload: { nested: { priority: 'high' }, title: 'One durable task' } },
      db.pool
    );
    expect(replay.id).toBe(first.id);

    await expect(
      proposeOutput({ ...input, payload: { title: 'A different task' } }, db.pool)
    ).rejects.toBeInstanceOf(ConflictError);
    const count = await db.pool.query(
      `SELECT COUNT(*)::int AS count FROM meeting_outputs
       WHERE organization_id = $1 AND meeting_id = $2`,
      [organizationId, meeting.id]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('recovery: if a target row already exists for this idempotency_key (simulating a prior attempt that created it but never confirmed), materialize recovers it instead of creating a duplicate — even when the materializer would throw on createTask', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Recovery path',
        startAt: '2026-06-03T09:00:00.000Z',
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
        payload: { title: 'Recovered task' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    // Simulate: a prior materialize attempt successfully created the target
    // task (source_id = idempotency_key) but died before confirming back
    // onto meeting_outputs (which is still APPROVED, canonical_id NULL).
    const preExistingId = `task-recovered-${proposed.id}`;
    await db.pool.query(
      `INSERT INTO tasks (id, organization_id, title, status, created_by, source_type, source_id)
       VALUES ($1, $2, $3, 'todo', $4, 'MEETING_OUTPUT', $5)`,
      [preExistingId, organizationId, 'Recovered task', owner, proposed.idempotencyKey]
    );

    // failTaskOnAttempt: 1 — if the saga incorrectly tried to create a NEW
    // task instead of recovering the existing one, this test would fail
    // loudly (thrown error surfaces as MATERIALIZATION_FAILED, not
    // MATERIALIZED with the recovered id).
    const materializer = createFakeMaterializer(db.pool, { failTaskOnAttempt: 1 });
    const materialized = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );

    expect(materialized.status).toBe('MATERIALIZED');
    expect(materialized.canonicalId).toBe(preExistingId);
    const count = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);
    expect(count).toBe(1); // still exactly one — no duplicate created
  });

  it('honest failure: a target-creation error is persisted as MATERIALIZATION_FAILED with a reason, never silently reported as done; a retry after the transient failure succeeds', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Honest failure',
        startAt: '2026-06-04T09:00:00.000Z',
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
        payload: { title: 'Will fail once' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    const materializer = createFakeMaterializer(db.pool, { failTaskOnAttempt: 1 });

    const failed = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );
    expect(failed.status).toBe('MATERIALIZATION_FAILED');
    expect(failed.failureReason).toContain('simulated createTask failure');
    expect(failed.canonicalId).toBeNull();

    // Nothing was created on the failed attempt.
    expect(await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey)).toBe(0);

    // Retry with the SAME materializer instance (its internal attempt
    // counter has moved past the failure trigger) — succeeds this time.
    const retried = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );
    expect(retried.status).toBe('MATERIALIZED');
    expect(retried.canonicalId).toBeTruthy();
    expect(await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey)).toBe(1);
  });

  it('decision outputs materialize through the decision path with decisionMakerId from the payload', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const decisionMaker = makeUserId('decider');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Decision saga',
        startAt: '2026-06-05T09:00:00.000Z',
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
        payload: { title: 'Approve the budget?', decisionMakerId: decisionMaker },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );

    const materializer = createFakeMaterializer(db.pool);
    const materialized = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      materializer,
      db.pool
    );
    expect(materialized.status).toBe('MATERIALIZED');

    const row = await db.pool.query(`SELECT * FROM decisions WHERE id = $1`, [
      materialized.canonicalId,
    ]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      title: 'Approve the budget?',
      decision_maker_id: decisionMaker,
      source_type: 'MEETING_OUTPUT',
      source_id: proposed.idempotencyKey,
    });
  });

  it('cannot materialize a PROPOSED output (must be APPROVED first)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Not approved yet',
        startAt: '2026-06-06T09:00:00.000Z',
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
        payload: { title: 'Too early' },
      },
      db.pool
    );

    await expect(
      materializeOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it('Teresa cannot approve or reject outputs on behalf of a human', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'No Teresa approval',
        startAt: '2026-06-07T09:00:00.000Z',
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
        payload: { title: 'Needs a human' },
      },
      db.pool
    );

    await expect(
      approveOutput(
        {
          organizationId,
          meetingId: meeting.id,
          outputId: proposed.id,
          actorUserId: TERESA_ACTOR_ID,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      rejectOutput(
        {
          organizationId,
          meetingId: meeting.id,
          outputId: proposed.id,
          actorUserId: TERESA_ACTOR_ID,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('an observer cannot propose outputs', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const observer = makeUserId('observer');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Observer cannot propose',
        startAt: '2026-06-08T09:00:00.000Z',
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

    await expect(
      proposeOutput(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: observer,
          actorKind: 'human',
          outputKind: 'task',
          payload: { title: 'Should be blocked' },
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('reject moves PROPOSED -> REJECTED and a subsequent materialize attempt is refused', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Rejected output',
        startAt: '2026-06-09T09:00:00.000Z',
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
        payload: { title: 'Not going to happen' },
      },
      db.pool
    );
    const rejected = await rejectOutput(
      {
        organizationId,
        meetingId: meeting.id,
        outputId: proposed.id,
        actorUserId: owner,
        reason: 'out of scope',
      },
      db.pool
    );
    expect(rejected.status).toBe('REJECTED');

    await expect(
      materializeOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);
  });
});
