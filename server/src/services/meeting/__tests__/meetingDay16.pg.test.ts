import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as emailService from '../../emailService.js';
import {
  addMeetingParticipant,
  deleteMeetingParticipant,
  listMeetingParticipants,
  updateMeetingParticipant,
} from '../meetingDay16Service.js';
import { sendMeetingInvitations } from '../meetingInvitationService.js';

const enabled = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const org = 'day16-meetings-org';
const otherOrg = 'day16-meetings-other';
const owner = 'day16-meetings-owner';
const member = 'day16-meetings-member';
const meeting = 'day16-meetings-record';

suite('Meetings day16 participants and safe invitation delivery (real PG)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // FIX-6 (P2 guardrails, 2026-08-26): spy on the real emailService.send
  // (not a mock replacement — it stays wired to its real implementation) so
  // the 'captured' and 'blocked_demo' tests below can assert the mailer was
  // never invoked, not just that the reported status string was the
  // expected one. A future regression that accidentally started calling
  // sendEmail for either of these guarded paths would fail these tests even
  // if the returned status still happened to look right.
  const emailSendSpy = vi.spyOn(emailService, 'send');

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, now()), ($3, $4, now())
       ON CONFLICT (id) DO NOTHING`,
      [org, 'Day16 Meetings', otherOrg, 'Day16 Meetings Other']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1,$2,$3,'Owner','Meetings','ADMIN','active'),
              ($4,$2,$5,'Member','Meetings','MEMBER','active')
       ON CONFLICT (id) DO NOTHING`,
      [owner, org, 'day16-owner@example.invalid', member, 'day16-member@example.invalid']
    );
    await pool.query(
      `INSERT INTO meetings (
         id, organization_id, title, start_at, end_at, created_by, timezone,
         recurrence_rule, attendees_json
       ) VALUES ($1,$2,'Operating review','2026-08-26T08:00:00.000Z',
                 '2026-08-26T09:00:00.000Z',$3,'Europe/Warsaw',
                 'FREQ=WEEKLY;COUNT=4','[]')
       ON CONFLICT (id) DO NOTHING`,
      [meeting, org, owner]
    );
    await pool.query(
      `INSERT INTO meeting_participants (
         id, organization_id, meeting_id, participant_kind, user_id, role,
         invitation_status, delivery_status, invited_by, created_at, updated_at
       ) VALUES ($1,$2,$3,'user',$4,'organizer','accepted','pending',$4,now()::text,now()::text)
       ON CONFLICT DO NOTHING`,
      [`${meeting}-organizer`, org, meeting, owner]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id IN ($1,$2)`, [
      org,
      otherOrg,
    ]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id IN ($1,$2)`, [
      org,
      otherOrg,
    ]);
    await pool.query(`DELETE FROM meetings WHERE id = $1`, [meeting]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [owner, member]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, otherOrg]);
    await pool.end();
  });

  afterEach(() => {
    emailSendSpy.mockClear();
  });

  it('adds an active user from the same organization and reads it back', async () => {
    const participant = await addMeetingParticipant({
      organizationId: org,
      meetingId: meeting,
      invitedBy: owner,
      participantKind: 'user',
      userId: member,
    });
    expect(participant.userId).toBe(member);
    expect(
      (await listMeetingParticipants({ organizationId: org, meetingId: meeting })).map((p) => p.id)
    ).toContain(participant.id);
  });

  it('adds a valid guest and rejects an invalid email', async () => {
    const guest = await addMeetingParticipant({
      organizationId: org,
      meetingId: meeting,
      invitedBy: owner,
      participantKind: 'guest',
      email: 'guest@example.invalid',
      displayName: 'External Guest',
    });
    expect(guest.email).toBe('guest@example.invalid');
    await expect(
      addMeetingParticipant({
        organizationId: org,
        meetingId: meeting,
        invitedBy: owner,
        participantKind: 'guest',
        email: 'not-an-email',
      })
    ).rejects.toThrow('INVALID_GUEST_EMAIL');
  });

  it('rejects a user from a different tenant', async () => {
    await expect(
      addMeetingParticipant({
        organizationId: otherOrg,
        meetingId: meeting,
        invitedBy: owner,
        participantKind: 'user',
        userId: member,
      })
    ).rejects.toThrow('PARTICIPANT_USER_NOT_FOUND');
  });

  it('does not allow deleting the organizer', async () => {
    await expect(
      deleteMeetingParticipant({
        organizationId: org,
        meetingId: meeting,
        participantId: `${meeting}-organizer`,
      })
    ).resolves.toBe('organizer');
  });

  it('persists a participant response', async () => {
    const participant = (
      await listMeetingParticipants({ organizationId: org, meetingId: meeting })
    ).find((item) => item.userId === member)!;
    const updated = await updateMeetingParticipant({
      organizationId: org,
      meetingId: meeting,
      participantId: participant.id,
      invitationStatus: 'accepted',
    });
    expect(updated?.invitationStatus).toBe('accepted');
    expect(updated?.respondedAt).toBeTruthy();
  });

  it('captures invitations without touching SMTP in test/dev', async () => {
    const previousLive = process.env.MEETING_INVITES_LIVE;
    delete process.env.MEETING_INVITES_LIVE;
    const deliveries = await sendMeetingInvitations({
      organizationId: org,
      meetingId: meeting,
      actorId: owner,
    });
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.every((item) => item.status === 'captured')).toBe(true);
    // FIX-6: proof, not inference — the mailer itself was never invoked.
    expect(emailSendSpy).not.toHaveBeenCalled();
    if (previousLive === undefined) delete process.env.MEETING_INVITES_LIVE;
    else process.env.MEETING_INVITES_LIVE = previousLive;
  });

  it('blocks the protected demo organization before the mailer', async () => {
    const previousDemoOrg = process.env.DEMO_ORG_ID;
    process.env.DEMO_ORG_ID = org;
    const deliveries = await sendMeetingInvitations({
      organizationId: org,
      meetingId: meeting,
      actorId: owner,
    });
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.every((item) => item.status === 'blocked_demo')).toBe(true);
    // FIX-6: proof, not inference — the mailer itself was never invoked.
    expect(emailSendSpy).not.toHaveBeenCalled();
    if (previousDemoOrg === undefined) delete process.env.DEMO_ORG_ID;
    else process.env.DEMO_ORG_ID = previousDemoOrg;
  });

  // FIX-9 (2026-08-26, runtime acceptance addendum): DbPromise's default
  // `fallback: true` swallowed a "table does not exist" error into an empty
  // array/null — a missing meeting_participants table (unrun 20261075
  // migration) looked exactly like "this meeting has zero participants"
  // instead of a hard failure. listMeetingParticipants() (and the other
  // day16 participant/delivery functions) now pass `fallback: false`.
  //
  // This must be the LAST test in the file: it temporarily renames the real
  // table out of existence to prove the missing-table case actually throws,
  // then renames it back in a finally so every earlier test's fixtures (and
  // any other suite sharing this database) are unaffected. A rename (not
  // DROP+recreate) is used specifically so the exact schema/indexes/
  // constraints are preserved with certainty across the round-trip.
  it('FIX-9: surfaces a missing meeting_participants table as a thrown error, not an empty list', async () => {
    await pool.query('ALTER TABLE meeting_participants RENAME TO meeting_participants_fix9_missing');
    try {
      await expect(
        listMeetingParticipants({ organizationId: org, meetingId: meeting })
      ).rejects.toThrow();
    } finally {
      await pool.query(
        'ALTER TABLE meeting_participants_fix9_missing RENAME TO meeting_participants'
      );
    }
    // Prove the rename-back actually worked and the table is usable again —
    // otherwise a failure in the finally block could go unnoticed.
    await expect(
      listMeetingParticipants({ organizationId: org, meetingId: meeting })
    ).resolves.toBeInstanceOf(Array);
  });
});
