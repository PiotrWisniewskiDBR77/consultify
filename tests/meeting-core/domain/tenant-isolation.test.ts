/**
 * tenant-isolation.test.ts — a meeting created in org A must be invisible
 * and unwritable from org B, on real scratch-PG. Also proves that an
 * x-org-context-style body/param org id can never redirect ownership: every
 * meetingCore call takes organizationId as an explicit, separate argument
 * (mirroring how meeting.routes.ts always derives it from req.user, never
 * from req.body), so this test exercises the same contract the route layer
 * relies on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MeetingNotFoundError } from '../../../server/src/services/meetingCore/errors.js';
import {
  addNoteEntry,
  createMeetingCore,
  getMeetingAggregate,
  transitionMeeting,
  updateMeetingPrep,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

describe('Meeting Core — tenant isolation on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('a meeting created in org A is invisible from org B (aggregate read returns null, not the row)', async () => {
    const orgA = makeOrgId('org-a');
    const orgB = makeOrgId('org-b');
    const owner = makeUserId('owner');

    const meeting = await createMeetingCore(
      {
        organizationId: orgA,
        createdBy: owner,
        title: 'Org A only',
        startAt: '2026-03-01T09:00:00.000Z',
      },
      db.pool
    );

    const fromOwnOrg = await getMeetingAggregate(
      { organizationId: orgA, meetingId: meeting.id },
      db.pool
    );
    expect(fromOwnOrg).not.toBeNull();
    expect(fromOwnOrg?.meeting.id).toBe(meeting.id);

    const fromOtherOrg = await getMeetingAggregate(
      { organizationId: orgB, meetingId: meeting.id },
      db.pool
    );
    expect(fromOtherOrg).toBeNull();
  });

  it('org B cannot transition, edit prep, or add notes to org A meeting — every write throws MeetingNotFoundError, never a silent success', async () => {
    const orgA = makeOrgId('org-a');
    const orgB = makeOrgId('org-b');
    const owner = makeUserId('owner');
    const crossOrgActor = makeUserId('cross-actor');

    const meeting = await createMeetingCore(
      {
        organizationId: orgA,
        createdBy: owner,
        title: 'Org A protected',
        startAt: '2026-03-02T09:00:00.000Z',
      },
      db.pool
    );

    await expect(
      transitionMeeting(
        {
          organizationId: orgB,
          meetingId: meeting.id,
          actorUserId: crossOrgActor,
          transition: 'START_PREPARING',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(MeetingNotFoundError);

    await expect(
      updateMeetingPrep(
        {
          organizationId: orgB,
          meetingId: meeting.id,
          actorUserId: crossOrgActor,
          title: 'Hijacked title',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(MeetingNotFoundError);

    await expect(
      addNoteEntry(
        {
          organizationId: orgB,
          meetingId: meeting.id,
          actorUserId: crossOrgActor,
          actorKind: 'human',
          entryType: 'discussion',
          content: 'I should not be able to write this',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(MeetingNotFoundError);

    // Prove nothing leaked through despite the rejected calls: org A's
    // meeting is completely unchanged (still DRAFT, still original title,
    // zero notes).
    const untouched = await getMeetingAggregate(
      { organizationId: orgA, meetingId: meeting.id },
      db.pool
    );
    expect(untouched?.meeting.lifecycleStatus).toBe('DRAFT');
    expect(untouched?.meeting.title).toBe('Org A protected');
    expect(untouched?.notes).toEqual([]);
  });
});
