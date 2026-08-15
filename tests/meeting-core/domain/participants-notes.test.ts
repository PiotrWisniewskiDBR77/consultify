/**
 * participants-notes.test.ts — meeting-scoped roles and structured notes on
 * real scratch-PG: Teresa is auto-seeded, observers can't write, a human
 * can't author as Teresa (no fake "Current User" / no impersonation), and
 * removing participants is gated the same way adding them is.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ForbiddenError,
  ValidationError,
} from '../../../server/src/services/meetingCore/errors.js';
import {
  addNoteEntry,
  addParticipant,
  archiveNoteEntry,
  createMeetingCore,
  listNoteEntries,
  listParticipants,
  removeParticipant,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import { TERESA_ACTOR_ID } from '../../../server/src/services/meetingCore/types.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

describe('Meeting Core — participants & structured notes on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('creating a meeting auto-seeds the owner and the reserved Teresa participant', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Roster check',
        startAt: '2026-04-01T09:00:00.000Z',
      },
      db.pool
    );
    const participants = await listParticipants({ organizationId, meetingId: meeting.id }, db.pool);
    const roles = participants.map((p) => ({ userId: p.userId, role: p.meetingRole }));
    expect(roles).toContainEqual({ userId: owner, role: 'owner' });
    expect(roles).toContainEqual({ userId: TERESA_ACTOR_ID, role: 'teresa' });
    expect(participants).toHaveLength(2);
  });

  it('an observer cannot add note entries (read-only role)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const observer = makeUserId('observer');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Observer check',
        startAt: '2026-04-02T09:00:00.000Z',
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
      addNoteEntry(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: observer,
          actorKind: 'human',
          entryType: 'discussion',
          content: 'observers should not be able to post this',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('a human author cannot claim actorKind "system", and cannot use the reserved Teresa id', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'No impersonation',
        startAt: '2026-04-03T09:00:00.000Z',
      },
      db.pool
    );

    await expect(
      addNoteEntry(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          actorKind: 'system',
          entryType: 'discussion',
          content: 'a human pretending to be the system',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      addNoteEntry(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: TERESA_ACTOR_ID,
          actorKind: 'human',
          entryType: 'discussion',
          content: 'someone claiming to be a human using the Teresa id',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('Teresa can author a genuine system note; a real participant authors as themselves — no fake shared "Current User"', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Authorship check',
        startAt: '2026-04-04T09:00:00.000Z',
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

    const teresaNote = await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: TERESA_ACTOR_ID,
        actorKind: 'system',
        entryType: 'insight',
        content: 'Teresa-authored insight',
      },
      db.pool
    );
    const humanNote = await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: participant,
        actorKind: 'human',
        entryType: 'question',
        content: 'Participant-authored question',
      },
      db.pool
    );

    expect(teresaNote.authorUserId).toBe(TERESA_ACTOR_ID);
    expect(teresaNote.authorKind).toBe('system');
    expect(humanNote.authorUserId).toBe(participant);
    expect(humanNote.authorKind).toBe('human');

    const notes = await listNoteEntries({ organizationId, meetingId: meeting.id }, db.pool);
    expect(notes.map((n) => n.authorUserId).sort()).toEqual([TERESA_ACTOR_ID, participant].sort());
  });

  it('a plain participant cannot add or remove other participants (only owner/facilitator can)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');
    const outsider = makeUserId('outsider');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Participant mgmt gate',
        startAt: '2026-04-05T09:00:00.000Z',
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
          userId: outsider,
          role: 'observer',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      removeParticipant(
        { organizationId, meetingId: meeting.id, actorUserId: participant, targetUserId: owner },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('archives a note tenant-scoped and only through an owner or facilitator', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const participant = makeUserId('participant');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Archive note gate',
        startAt: '2026-04-05T10:00:00.000Z',
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
    const note = await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: participant,
        actorKind: 'human',
        entryType: 'discussion',
        content: 'Archive after review',
      },
      db.pool
    );

    await expect(
      archiveNoteEntry(
        { organizationId, meetingId: meeting.id, noteId: note.id, actorUserId: participant },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    const archived = await archiveNoteEntry(
      { organizationId, meetingId: meeting.id, noteId: note.id, actorUserId: owner },
      db.pool
    );
    expect(archived.status).toBe('archived');
    const readback = await listNoteEntries({ organizationId, meetingId: meeting.id }, db.pool);
    expect(readback.find((item) => item.id === note.id)?.status).toBe('archived');
  });

  it('cannot manually add a participant with the reserved "teresa" role, and cannot remove the Teresa participant', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const someone = makeUserId('someone');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Teresa is reserved',
        startAt: '2026-04-06T09:00:00.000Z',
      },
      db.pool
    );

    await expect(
      addParticipant(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          userId: someone,
          role: 'teresa' as any,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      removeParticipant(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          targetUserId: TERESA_ACTOR_ID,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
