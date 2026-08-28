import { v4 as uuidv4 } from 'uuid';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import { parseRRule } from '../v8/recurrenceEngine.js';
import { getMeeting, type MeetingRecord } from '../meetingService.js';

export type MeetingOccurrenceScope = 'this' | 'this_and_following' | 'all';
export type MeetingOccurrenceChanges = Partial<
  Pick<MeetingRecord, 'title' | 'startAt' | 'endAt' | 'location' | 'timezone' | 'recurrenceRule'>
>;

function recurrenceUntilBefore(recurrenceId: string): string {
  const before = new Date(new Date(recurrenceId).getTime() - 1000);
  return before
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function withUntil(rule: string, recurrenceId: string): string {
  const segments = rule
    .replace(/^RRULE:/i, '')
    .split(';')
    .filter((part) => !part.toUpperCase().startsWith('UNTIL='));
  return [...segments, `UNTIL=${recurrenceUntilBefore(recurrenceId)}`].join(';');
}

export async function editMeetingOccurrence(input: {
  organizationId: string;
  meetingId: string;
  recurrenceId: string;
  scope: MeetingOccurrenceScope;
  changes: MeetingOccurrenceChanges;
  actorId: string;
  cancel?: boolean;
}): Promise<{ meeting: MeetingRecord; splitMeeting: MeetingRecord | null; replayed: boolean }> {
  const master = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!master || !master.recurrenceRule || master.recurrenceParentId)
    throw new Error('RECURRENCE_NOT_FOUND');
  if (!parseRRule(master.recurrenceRule)) throw new Error('INVALID_RECURRENCE_RULE');
  // Property narrowing (`master.recurrenceRule` is non-null after the guard above)
  // is NOT carried into the `withPgTransaction` callback below — only narrowing of
  // the `const` binding itself is. Capture the narrowed value once, here.
  const masterRecurrenceRule: string = master.recurrenceRule;
  const cutover = new Date(input.recurrenceId);
  if (!Number.isFinite(cutover.getTime()) || /[\r\n]/.test(input.recurrenceId))
    throw new Error('INVALID_RECURRENCE_ID');
  const now = new Date().toISOString();
  const changes = input.changes || {};
  let replayed = false;
  let resultMeetingId = master.id;
  let splitMeetingId: string | null = null;

  await withPgTransaction(async (query) => {
    if (input.scope === 'all') {
      // FIX-1 (day19-fixes): cancelling the WHOLE series has no per-occurrence
      // exception row to anchor on (the series has no bounded occurrence
      // list without expanding the RRULE, which is out of reach here without
      // touching the licensed `recurrenceEngine`). We reuse the SAME
      // `recurrence_status` column the 'this' branch already uses for a
      // single occurrence exception, but apply it to the MASTER row itself
      // — it is always NULL for a master otherwise, so this is a pure,
      // additive state addition, not a repurposing of live data. This is a
      // REAL, persisted state change (readable independently of this
      // function), so the caller's CANCEL send after this call is honest —
      // never a DELETE on the series.
      await query(
        `UPDATE meetings SET title=$1, start_at=$2, end_at=$3, location=$4, timezone=$5,
          recurrence_rule=$6, recurrence_status=CASE WHEN $7::boolean THEN 'cancelled' ELSE recurrence_status END,
          invitation_sequence=COALESCE(invitation_sequence,0)+1, updated_at=$8
         WHERE id=$9 AND organization_id=$10`,
        [
          changes.title ?? master.title,
          changes.startAt ?? master.startAt,
          changes.endAt ?? master.endAt,
          changes.location ?? master.location,
          changes.timezone ?? master.timezone,
          changes.recurrenceRule ?? master.recurrenceRule,
          Boolean(input.cancel),
          now,
          master.id,
          input.organizationId,
        ]
      );
      return;
    }
    if (input.scope === 'this') {
      const existing = await query<{ id: string }>(
        `SELECT id FROM meetings WHERE recurrence_parent_id=$1 AND recurrence_exception_at=$2 AND organization_id=$3`,
        [master.id, cutover.toISOString(), input.organizationId]
      );
      if (existing.rows[0]) {
        resultMeetingId = existing.rows[0].id;
        replayed = true;
        return;
      }
      resultMeetingId = `meeting-occurrence-${uuidv4()}`;
      await query(
        `INSERT INTO meetings (id,organization_id,project_id,title,start_at,end_at,location,attendees_json,pre_read_json,agenda_json,decisions_json,status,created_by,created_at,updated_at,timezone,recurrence_rule,recurrence_parent_id,recurrence_exception_at,recurrence_status,invitation_sequence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,NULL,$16,$17,$18,$19)`,
        [
          resultMeetingId,
          input.organizationId,
          master.projectId,
          changes.title ?? master.title,
          changes.startAt ?? cutover.toISOString(),
          changes.endAt ?? master.endAt,
          changes.location ?? master.location,
          JSON.stringify(master.attendees),
          JSON.stringify(master.preRead),
          JSON.stringify(master.agenda),
          JSON.stringify(master.decisions),
          master.status,
          input.actorId,
          now,
          changes.timezone ?? master.timezone,
          master.id,
          cutover.toISOString(),
          input.cancel ? 'cancelled' : 'modified',
          master.invitationSequence + 1,
        ]
      );
      return;
    }
    const oldRule = withUntil(masterRecurrenceRule, cutover.toISOString());
    splitMeetingId = `meeting-series-${uuidv4()}`;
    await query(
      `UPDATE meetings SET recurrence_rule=$1, invitation_sequence=COALESCE(invitation_sequence,0)+1, updated_at=$2 WHERE id=$3 AND organization_id=$4`,
      [oldRule, now, master.id, input.organizationId]
    );
    // FIX-1 (day19-fixes): 'this_and_following' cancellation must not leave
    // the split-off portion of the series as a live, active master (that was
    // the bug — a brand-new ACTIVE master got created, then a CANCEL send
    // went out for a meeting that still very much existed). The split row is
    // still created (it is the real, addressable identity for "cutover
    // onward", and future exception rows on/after cutover are reparented to
    // it below regardless of cancel), but it is marked
    // `recurrence_status='cancelled'` up front when cancelling — same column,
    // same meaning the 'this' branch already gives it, just applied at the
    // series root instead of a single occurrence. No DELETE anywhere.
    await query(
      `INSERT INTO meetings (id,organization_id,project_id,title,start_at,end_at,location,attendees_json,pre_read_json,agenda_json,decisions_json,status,created_by,created_at,updated_at,timezone,recurrence_rule,recurrence_parent_id,recurrence_status,split_from_meeting_id,invitation_sequence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,$16,NULL,$17,$18,$19)`,
      [
        splitMeetingId,
        input.organizationId,
        master.projectId,
        changes.title ?? master.title,
        changes.startAt ?? cutover.toISOString(),
        changes.endAt ?? master.endAt,
        changes.location ?? master.location,
        JSON.stringify(master.attendees),
        JSON.stringify(master.preRead),
        JSON.stringify(master.agenda),
        JSON.stringify(master.decisions),
        master.status,
        input.actorId,
        now,
        changes.timezone ?? master.timezone,
        changes.recurrenceRule ?? master.recurrenceRule,
        input.cancel ? 'cancelled' : null,
        master.id,
        master.invitationSequence + 1,
      ]
    );
    await query(
      `UPDATE meetings SET recurrence_parent_id=$1 WHERE organization_id=$2 AND recurrence_parent_id=$3 AND recurrence_exception_at >= $4`,
      [splitMeetingId, input.organizationId, master.id, cutover.toISOString()]
    );
    resultMeetingId = splitMeetingId;
  });
  const meeting = await getMeeting({
    organizationId: input.organizationId,
    meetingId: resultMeetingId,
  });
  if (!meeting) throw new Error('OCCURRENCE_READBACK_FAILED');
  const splitMeeting = splitMeetingId ? meeting : null;
  return { meeting, splitMeeting, replayed };
}
