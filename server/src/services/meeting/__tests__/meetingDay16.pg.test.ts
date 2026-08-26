import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
    if (previousDemoOrg === undefined) delete process.env.DEMO_ORG_ID;
    else process.env.DEMO_ORG_ID = previousDemoOrg;
  });
});
