import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

export type MeetingParticipant = {
  id: string;
  organizationId: string;
  meetingId: string;
  participantKind: 'user' | 'guest';
  userId: string | null;
  email: string | null;
  displayName: string;
  role: 'organizer' | 'attendee' | 'optional';
  invitationStatus: 'invited' | 'accepted' | 'declined' | 'tentative' | 'no_response';
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'blocked_demo' | 'captured';
  respondedAt: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  meeting_id: string;
  participant_kind: MeetingParticipant['participantKind'];
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  role: MeetingParticipant['role'];
  invitation_status: MeetingParticipant['invitationStatus'];
  delivery_status: MeetingParticipant['deliveryStatus'];
  responded_at: string | null;
};

const mapParticipant = (row: ParticipantRow): MeetingParticipant => ({
  id: row.id,
  organizationId: row.organization_id,
  meetingId: row.meeting_id,
  participantKind: row.participant_kind,
  userId: row.user_id,
  email: row.email,
  displayName: row.display_name || '',
  role: row.role,
  invitationStatus: row.invitation_status,
  deliveryStatus: row.delivery_status,
  respondedAt: row.responded_at,
});

export async function listMeetingParticipants(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingParticipant[]> {
  // FIX-9 (2026-08-26, runtime acceptance addendum): DbPromise.all() defaults
  // to `fallback: true`, which swallows a "table does not exist" error and
  // resolves with `[]` — indistinguishable from "this meeting genuinely has
  // no participants". `ensureMeetingTables()` (run by the router's
  // middleware) creates `meetings` but NOT `meeting_participants` /
  // `meeting_invitation_deliveries`, which ship in a separate migration
  // (20261075) — so an environment that hasn't run that migration got a
  // silent, misleadingly-empty 200 from GET /:id/participants instead of a
  // loud failure. `fallback: false` makes a missing table surface as a
  // thrown error (500) here, consistent with the write paths below.
  const rows = await dbAll<ParticipantRow>(
    `SELECT p.*, COALESCE(NULLIF(p.email, ''), u.email) AS email,
            COALESCE(NULLIF(p.display_name, ''), u.first_name || ' ' || u.last_name, u.email, '') AS display_name
       FROM meeting_participants p
       LEFT JOIN users u ON u.id = p.user_id AND u.organization_id = p.organization_id
      WHERE p.organization_id = ? AND p.meeting_id = ?
      ORDER BY CASE p.role WHEN 'organizer' THEN 0 ELSE 1 END, p.created_at, p.id`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  return rows.map(mapParticipant);
}

export async function addMeetingParticipant(input: {
  organizationId: string;
  meetingId: string;
  invitedBy: string;
  participantKind: 'user' | 'guest';
  userId?: string;
  email?: string;
  displayName?: string;
  role?: 'attendee' | 'optional';
}): Promise<MeetingParticipant> {
  let userId: string | null = null;
  let email: string | null = null;
  let displayName = String(input.displayName || '').trim();
  if (input.participantKind === 'user') {
    const user = await dbGet<{ id: string; email: string; display_name: string }>(
      `SELECT id, email, COALESCE(first_name || ' ' || last_name, email) AS display_name
         FROM users WHERE id = ? AND organization_id = ? AND status = 'active' LIMIT 1`,
      [String(input.userId || ''), input.organizationId]
    );
    if (!user) throw new Error('PARTICIPANT_USER_NOT_FOUND');
    userId = user.id;
    displayName = displayName || user.display_name;
  } else {
    email = String(input.email || '')
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_GUEST_EMAIL');
  }
  const id = `meeting-participant-${uuidv4()}`;
  const now = new Date().toISOString();
  try {
    await dbRun(
      `INSERT INTO meeting_participants (
         id, organization_id, meeting_id, participant_kind, user_id, email, display_name,
         role, invitation_status, delivery_status, invited_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'invited', 'pending', ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.meetingId,
        input.participantKind,
        userId,
        email,
        displayName,
        input.role || 'attendee',
        input.invitedBy,
        now,
        now,
      ],
      { fallback: false }
    );
  } catch (error: unknown) {
    if (String((error as Error).message).includes('unique'))
      throw new Error('PARTICIPANT_DUPLICATE');
    throw error;
  }
  const created = await dbGet<ParticipantRow>(
    `SELECT * FROM meeting_participants WHERE id = ? AND organization_id = ?`,
    [id, input.organizationId],
    { fallback: false }
  );
  if (!created) throw new Error('PARTICIPANT_READBACK_FAILED');
  return mapParticipant(created);
}

export async function updateMeetingParticipant(input: {
  organizationId: string;
  meetingId: string;
  participantId: string;
  role?: 'attendee' | 'optional';
  invitationStatus?: MeetingParticipant['invitationStatus'];
}): Promise<MeetingParticipant | null> {
  // FIX-9: fallback:false throughout this function — a missing
  // meeting_participants table (unrun 20261075 migration) must surface as a
  // thrown error, not a misleading 404 "Participant not found" from the
  // dbGet below silently resolving null.
  const existing = await dbGet<ParticipantRow>(
    `SELECT * FROM meeting_participants WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.participantId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  if (!existing) return null;
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE meeting_participants SET role = ?, invitation_status = ?, responded_at = ?, updated_at = ?
      WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [
      input.role || existing.role,
      input.invitationStatus || existing.invitation_status,
      input.invitationStatus ? now : existing.responded_at,
      now,
      input.participantId,
      input.organizationId,
      input.meetingId,
    ],
    { fallback: false }
  );
  const updated = await dbGet<ParticipantRow>(
    `SELECT * FROM meeting_participants WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.participantId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  return updated ? mapParticipant(updated) : null;
}

export async function deleteMeetingParticipant(input: {
  organizationId: string;
  meetingId: string;
  participantId: string;
}): Promise<'deleted' | 'not_found' | 'organizer'> {
  // FIX-9: fallback:false — a missing table must surface as a thrown error,
  // not the misleading 'not_found' this dbGet would otherwise produce.
  const existing = await dbGet<ParticipantRow>(
    `SELECT * FROM meeting_participants WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.participantId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  if (!existing) return 'not_found';
  if (existing.role === 'organizer') return 'organizer';
  await dbRun(
    `DELETE FROM meeting_participants WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.participantId, input.organizationId, input.meetingId],
    { fallback: false }
  );
  return 'deleted';
}

export async function setParticipantDelivery(input: {
  participantId: string;
  organizationId: string;
  meetingId: string;
  status: MeetingParticipant['deliveryStatus'];
  error?: string | null;
}): Promise<void> {
  // FIX-9: fallback:false — a missing table must surface as a thrown error
  // instead of a silently no-op'd delivery-status write.
  await dbRun(
    `UPDATE meeting_participants SET delivery_status = ?, delivery_at = ?, delivery_error = ?, updated_at = ?
      WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [
      input.status,
      new Date().toISOString(),
      input.error || null,
      new Date().toISOString(),
      input.participantId,
      input.organizationId,
      input.meetingId,
    ],
    { fallback: false }
  );
}
