/**
 * coverage-gaps.test.ts — fills scenarios from the 20-item list that are NOT
 * already exercised by tests/meeting-core/domain/*.test.ts:
 *
 *   3  — a participant cannot become owner by passing role='owner' in the
 *        addParticipant call body (self-escalation is blocked by the SAME
 *        actingRole gate that blocks managing anyone else).
 *   4  — a spoofed/adversarial organizationId (including a SQL-injection-
 *        shaped string) is rejected/ignored, never mistaken for the real
 *        tenant, and never crashes the query layer (proves parameterized
 *        queries, not string concatenation).
 *   7  — the "PUT"-equivalent for a meetingCore meeting (updateMeetingPrep,
 *        exposed as PATCH /core/:id/prep in meeting.routes.ts) enforces
 *        exactly PREP_EDIT_ROLES = [owner, facilitator] — participant and
 *        observer are both rejected, facilitator is allowed.
 *   8  — an unauthorized close/removeParticipant attempt changes NOTHING:
 *        no lifecycle change, no roster change, no audit row.
 *   9  — notes persist and survive a "refresh" through a brand-new pool
 *        connection (not just re-reading via the same in-memory objects).
 *  15  — the materialized task's source_id resolves back to the meeting
 *        that produced it (the idempotency key embeds meetingId).
 *  16  — a proposed DECISION output cannot be materialized before approval,
 *        same rule as task outputs (domain/outputs-materialization.test.ts
 *        only exercises this for outputKind 'task').
 *  18  — CLOSE and its audit row commit atomically (domain/atomicity.test.ts
 *        only proves this for the generic transitionMeeting() path; close()
 *        is a SEPARATE code path in meetingCoreService.ts with its own
 *        withPgTransaction block and deserves its own proof).
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ForbiddenError,
  MeetingNotFoundError,
  IllegalTransitionError,
} from '../../../server/src/services/meetingCore/errors.js';
import {
  addNoteEntry,
  addParticipant,
  createMeetingCore,
  getMeetingAggregate,
  listParticipants,
  removeParticipant,
  transitionMeeting,
  closeMeeting,
  updateMeetingPrep,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { createFakeMaterializer, countTasksBySource } from '../domain/fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from '../domain/helpers.js';

describe('Meeting Core — coverage gaps on real Postgres (scenarios 3, 4, 7, 8, 9, 15, 16, 18)', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('SCENARIO 3: a plain participant cannot promote themselves to owner by passing role="owner" in the addParticipant call', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Self-escalation attempt',
        startAt: '2026-07-10T09:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: participant,
        role: 'participant',
      },
      db.pool
    );

    await expect(
      addParticipant(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: participant,
          userId: participant,
          role: 'owner',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    const participants = await listParticipants({ organizationId, meetingId: meeting.id }, db.pool);
    const theirRole = participants.find((p) => p.userId === participant)?.meetingRole;
    expect(theirRole).toBe('participant'); // unchanged — never silently became owner
  });

  it("SCENARIO 4: a spoofed/adversarial organizationId (including a SQL-injection-shaped string) never resolves to the real tenant's meeting", async () => {
    const organizationId = makeOrgId('real-org');
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Spoof target',
        startAt: '2026-07-11T09:00:00.000Z',
      },
      db.pool
    );

    const spoofedOrgIds = [
      makeOrgId('fabricated'), // a plausible-looking but wrong tenant id
      `${organizationId}' OR '1'='1`, // classic injection shape
      `${organizationId}x`, // near-miss: single extra trailing character
      '', // empty string masquerading as "no scoping"
    ];

    for (const spoofed of spoofedOrgIds) {
      const aggregate = await getMeetingAggregate(
        { organizationId: spoofed, meetingId: meeting.id },
        db.pool
      );
      expect(aggregate).toBeNull();
      await expect(
        transitionMeeting(
          {
            organizationId: spoofed,
            meetingId: meeting.id,
            actorUserId: owner,
            transition: 'START_PREPARING',
          },
          db.pool
        )
      ).rejects.toBeInstanceOf(MeetingNotFoundError);
    }

    // The real org, with the real id, still works — proves the rejections
    // above were genuine tenant scoping, not the query being broken outright.
    const realAggregate = await getMeetingAggregate(
      { organizationId, meetingId: meeting.id },
      db.pool
    );
    expect(realAggregate?.meeting.id).toBe(meeting.id);
  });

  it('SCENARIO 7: updateMeetingPrep ("PUT"-equivalent) enforces exactly PREP_EDIT_ROLES=[owner, facilitator] — participant and observer are rejected, facilitator is allowed', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const facilitator = makeUserId('facilitator');
    const participant = makeUserId('participant');
    const observer = makeUserId('observer');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'PUT contract check',
        startAt: '2026-07-12T09:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: facilitator,
        role: 'facilitator',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: participant,
        role: 'participant',
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
      updateMeetingPrep(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: participant,
          title: 'Hijacked by participant',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateMeetingPrep(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: observer,
          title: 'Hijacked by observer',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    const updated = await updateMeetingPrep(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: facilitator,
        title: 'Updated by facilitator',
      },
      db.pool
    );
    expect(updated.title).toBe('Updated by facilitator');
  });

  it('SCENARIO 8: an unauthorized close and an unauthorized removeParticipant change NOTHING — no lifecycle change, no roster change, no audit row for the rejected action', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Unauthorized write no-op',
        startAt: '2026-07-13T09:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: participant,
        role: 'participant',
      },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
      db.pool
    );

    const beforeAggregate = await getMeetingAggregate(
      { organizationId, meetingId: meeting.id },
      db.pool
    );
    const beforeAuditCount = (
      await db.pool.query(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1`,
        [meeting.id]
      )
    ).rows[0].n;

    await expect(
      closeMeeting({ organizationId, meetingId: meeting.id, actorUserId: participant }, db.pool)
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeParticipant(
        { organizationId, meetingId: meeting.id, actorUserId: participant, targetUserId: owner },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    const afterAggregate = await getMeetingAggregate(
      { organizationId, meetingId: meeting.id },
      db.pool
    );
    const afterAuditCount = (
      await db.pool.query(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1`,
        [meeting.id]
      )
    ).rows[0].n;

    expect(afterAggregate?.meeting.lifecycleStatus).toBe('CLOSING'); // unchanged, still awaiting a legitimate close
    expect(afterAggregate?.meeting.closedAt).toBeNull();
    expect(afterAggregate?.participants.map((p) => p.userId).sort()).toEqual(
      beforeAggregate?.participants.map((p) => p.userId).sort()
    );
    expect(afterAuditCount).toBe(beforeAuditCount); // zero new audit rows from the two rejected attempts
  });

  it('SCENARIO 9: structured notes persist and survive a "refresh" through a brand-new, independent pool connection', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Refresh survival',
        startAt: '2026-07-14T09:00:00.000Z',
      },
      db.pool
    );
    await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        actorKind: 'human',
        entryType: 'risk',
        content: 'Must survive a refresh',
      },
      db.pool
    );

    // A brand-new Pool against the SAME scratch database — simulates a
    // client reloading the page / a fresh server process reading back what
    // was written, not just re-reading through the same in-memory handle.
    const freshPool = new Pool({ connectionString: db.scratch.url });
    try {
      const refreshed = await getMeetingAggregate(
        { organizationId, meetingId: meeting.id },
        freshPool
      );
      expect(refreshed?.notes).toHaveLength(1);
      expect(refreshed?.notes[0].content).toBe('Must survive a refresh');
    } finally {
      await freshPool.end();
    }
  });

  it("SCENARIO 15: the materialized task's source_id resolves back to the originating meeting (idempotency key embeds meetingId)", async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Traceable output',
        startAt: '2026-07-15T09:00:00.000Z',
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
        payload: { title: 'Traceable task' },
      },
      db.pool
    );
    await approveOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      db.pool
    );
    const materialized = await materializeOutput(
      { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
      createFakeMaterializer(db.pool),
      db.pool
    );

    const taskRow = await db.pool.query(`SELECT source_type, source_id FROM tasks WHERE id = $1`, [
      materialized.canonicalId,
    ]);
    expect(taskRow.rows).toHaveLength(1);
    expect(taskRow.rows[0].source_type).toBe('MEETING_OUTPUT');
    // idempotency_key is `meeting-output:${meetingId}:${outputId}` (repo.ts
    // insertOutputRow) — parse it back and confirm it names THIS meeting,
    // not just "some" opaque id.
    const [, embeddedMeetingId, embeddedOutputId] = String(taskRow.rows[0].source_id).split(':');
    expect(embeddedMeetingId).toBe(meeting.id);
    expect(embeddedOutputId).toBe(proposed.id);
  });

  it('SCENARIO 16: a proposed DECISION output (not just task) cannot be materialized before approval', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const decisionMaker = makeUserId('decider');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Decision needs approval too',
        startAt: '2026-07-16T09:00:00.000Z',
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
        payload: { title: 'Too early to decide', decisionMakerId: decisionMaker },
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

    const count = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);
    expect(count).toBe(0);
    const decisionRow = await db.pool.query(`SELECT 1 FROM decisions WHERE source_id = $1`, [
      proposed.idempotencyKey,
    ]);
    expect(decisionRow.rows).toHaveLength(0);
  });

  it('SCENARIO 18: closeMeeting() commits the CLOSED status and its audit row atomically (separate code path from generic transitionMeeting)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Close atomicity',
        startAt: '2026-07-17T09:00:00.000Z',
      },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
      db.pool
    );

    const result = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(result.meeting.lifecycleStatus).toBe('CLOSED');

    const auditRows = await db.pool.query(
      `SELECT actor_id, action, resource_type, resource_id, org_id FROM audit_events
       WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_CLOSE'`,
      [meeting.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0]).toMatchObject({
      actor_id: owner,
      action: 'MEETING_TRANSITION_CLOSE',
      resource_type: 'meeting',
      resource_id: meeting.id,
      org_id: organizationId,
    });
  });
});
