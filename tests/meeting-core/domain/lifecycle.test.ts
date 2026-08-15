/**
 * lifecycle.test.ts — DRAFT->CLOSED happy path on REAL scratch-PG, plus
 * illegal-transition and role-forbidden rejections.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  addParticipant,
  adoptLegacyMeetingCore,
  createMeetingCore,
  listParticipants,
  transitionMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import { closeMeeting } from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  ForbiddenError,
  IllegalTransitionError,
} from '../../../server/src/services/meetingCore/errors.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

describe('Meeting Core lifecycle — DRAFT to CLOSED on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('walks DRAFT -> PREPARING -> READY -> LIVE -> CLOSING -> CLOSED as owner', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');

    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Q1 planning',
        startAt: '2026-02-01T10:00:00.000Z',
      },
      db.pool
    );
    expect(meeting.lifecycleStatus).toBe('DRAFT');

    const preparing = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    expect(preparing.lifecycleStatus).toBe('PREPARING');

    const ready = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
      db.pool
    );
    expect(ready.lifecycleStatus).toBe('READY');

    const live = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
      db.pool
    );
    expect(live.lifecycleStatus).toBe('LIVE');

    const closing = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
      db.pool
    );
    expect(closing.lifecycleStatus).toBe('CLOSING');

    const closeResult = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(closeResult.meeting.lifecycleStatus).toBe('CLOSED');
    expect(closeResult.meeting.closedAt).not.toBeNull();
    expect(closeResult.meeting.closedBy).toBe(owner);
    expect(closeResult.unresolvedOutputs).toEqual([]);
    expect(closeResult.failedOutputs).toEqual([]);
    expect(closeResult.materializingOutputs).toEqual([]);

    // The legacy `status` column (scheduled/completed) — read by My Work
    // calendar — must be untouched by the lifecycle machine.
    expect(closeResult.meeting.legacyStatus).toBe('scheduled');
  });

  it('adopts a legacy meeting in place, seeds governance roles once, and rejects a foreign actor', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const foreignActor = makeUserId('foreign');
    const meetingId = `legacy-${makeUserId('meeting')}`;

    await db.pool.query(
      `INSERT INTO meetings
         (id, organization_id, title, start_at, end_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
      [
        meetingId,
        organizationId,
        'Legacy meeting',
        '2026-02-01T10:00:00.000Z',
        '2026-02-01T11:00:00.000Z',
        owner,
      ]
    );

    const adopted = await adoptLegacyMeetingCore(
      { organizationId, meetingId, actorUserId: owner },
      db.pool
    );
    expect(adopted.id).toBe(meetingId);
    expect(adopted.lifecycleStatus).toBe('DRAFT');

    const replay = await adoptLegacyMeetingCore(
      { organizationId, meetingId, actorUserId: owner },
      db.pool
    );
    expect(replay.id).toBe(meetingId);
    expect(replay.lifecycleStatus).toBe('DRAFT');

    const participants = await listParticipants(
      { organizationId, meetingId, actorUserId: owner },
      db.pool
    );
    expect(participants).toHaveLength(2);
    expect(participants.map((participant) => participant.meetingRole).sort()).toEqual([
      'owner',
      'teresa',
    ]);

    await expect(
      adoptLegacyMeetingCore({ organizationId, meetingId, actorUserId: foreignActor }, db.pool)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects an out-of-order transition (DRAFT -> LIVE) with IllegalTransitionError, and leaves lifecycle_status unchanged', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Skip-ahead attempt',
        startAt: '2026-02-02T10:00:00.000Z',
      },
      db.pool
    );

    await expect(
      transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const stillDraft = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    expect(stillDraft.lifecycleStatus).toBe('PREPARING');
  });

  it('never lets CLOSED go back to LIVE — CLOSE again / any transition on a CLOSED meeting throws', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Closed already',
        startAt: '2026-02-03T10:00:00.000Z',
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
    const closed = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner },
      db.pool
    );
    expect(closed.meeting.lifecycleStatus).toBe('CLOSED');

    await expect(
      closeMeeting({ organizationId, meetingId: meeting.id, actorUserId: owner }, db.pool)
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(
      transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it('a plain participant (not owner/facilitator) cannot drive transitions', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const plainMember = makeUserId('member');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Role check',
        startAt: '2026-02-04T10:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: owner,
        userId: plainMember,
        role: 'participant',
      },
      db.pool
    );

    await expect(
      transitionMeeting(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: plainMember,
          transition: 'START_PREPARING',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('only owner (not facilitator) may CANCEL', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const facilitator = makeUserId('facilitator');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Cancel role check',
        startAt: '2026-02-05T10:00:00.000Z',
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

    await expect(
      transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: facilitator, transition: 'CANCEL' },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    const cancelled = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'CANCEL' },
      db.pool
    );
    expect(cancelled.lifecycleStatus).toBe('CANCELLED');
  });
});
