import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { ensureMeetingBoundaryTables } from './meetingBoundary/meetingBoundaryService.js';

export type MeetingStatus = 'scheduled' | 'completed';
export type FollowUpStatus = 'open' | 'done';

export interface MeetingFollowUp {
  id: string;
  title: string;
  owner: string;
  status: FollowUpStatus;
}

export interface MeetingDecisionRecord {
  id: string;
  organizationId: string;
  meetingId: string;
  statement: string;
  rationale: string;
  decidedBy: string | null;
  decidedAt: string | null;
  status: 'recorded' | 'superseded';
  sourceKind: 'manual' | 'note' | 'legacy';
  sourceNoteId: string | null;
  sourceIndex: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingFollowUpRecord extends MeetingFollowUp {
  organizationId: string | null;
  meetingId: string;
  ownerUserId: string | null;
  dueAt: string | null;
  sourceKind: 'manual' | 'note' | 'legacy';
  sourceNoteId: string | null;
  sourceIndex: number | null;
}

export interface MeetingRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
  recurrenceExceptionAt: string | null;
  recurrenceStatus: 'modified' | 'cancelled' | null;
  splitFromMeetingId: string | null;
  invitationSequence: number;
  location: string;
  attendees: string[];
  preRead: string[];
  agenda: string[];
  decisions: string[];
  followUps: MeetingFollowUp[];
  status: MeetingStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

type MeetingRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  timezone?: string | null;
  recurrence_rule?: string | null;
  recurrence_parent_id?: string | null;
  recurrence_exception_at?: string | null;
  recurrence_status?: string | null;
  split_from_meeting_id?: string | null;
  invitation_sequence?: number | null;
  location: string | null;
  attendees_json: string | null;
  pre_read_json: string | null;
  agenda_json: string | null;
  decisions_json: string | null;
  status: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type FollowUpRow = {
  id: string;
  meeting_id: string;
  title: string;
  owner: string | null;
  status: string | null;
};

function safeJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function mapMeeting(row: MeetingRow, followUps: MeetingFollowUp[]): MeetingRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone || null,
    recurrenceRule: row.recurrence_rule || null,
    recurrenceParentId: row.recurrence_parent_id || null,
    recurrenceExceptionAt: row.recurrence_exception_at || null,
    recurrenceStatus:
      row.recurrence_status === 'modified' || row.recurrence_status === 'cancelled'
        ? row.recurrence_status
        : null,
    splitFromMeetingId: row.split_from_meeting_id || null,
    invitationSequence: Number(row.invitation_sequence || 0),
    location: row.location || '',
    attendees: safeJsonArray(row.attendees_json),
    preRead: safeJsonArray(row.pre_read_json),
    agenda: safeJsonArray(row.agenda_json),
    decisions: safeJsonArray(row.decisions_json),
    followUps,
    status: row.status === 'completed' ? 'completed' : 'scheduled',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureMeetingTables(): Promise<void> {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      location TEXT DEFAULT '',
      attendees_json TEXT DEFAULT '[]',
      pre_read_json TEXT DEFAULT '[]',
      agenda_json TEXT DEFAULT '[]',
      decisions_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'scheduled',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await dbRun(`
    CREATE TABLE IF NOT EXISTS meeting_follow_ups (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      title TEXT NOT NULL,
      owner TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id, start_at)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id, start_at)`);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_meeting ON meeting_follow_ups(meeting_id)`
  );
}

async function getFollowUpsForMeetings(
  meetingIds: string[]
): Promise<Record<string, MeetingFollowUp[]>> {
  if (meetingIds.length === 0) return {};
  const placeholders = meetingIds.map(() => '?').join(', ');
  const rows = await dbAll<FollowUpRow>(
    `SELECT id, meeting_id, title, owner, status
     FROM meeting_follow_ups
     WHERE meeting_id IN (${placeholders})
     ORDER BY created_at ASC`,
    meetingIds
  );
  const out: Record<string, MeetingFollowUp[]> = {};
  for (const row of rows || []) {
    if (!out[row.meeting_id]) out[row.meeting_id] = [];
    out[row.meeting_id].push({
      id: row.id,
      title: row.title,
      owner: row.owner || '',
      status: row.status === 'done' ? 'done' : 'open',
    });
  }
  return out;
}

export async function listMeetings(input: {
  organizationId: string;
  projectId?: string | null;
}): Promise<MeetingRecord[]> {
  await ensureMeetingTables();
  const rows = await dbAll<MeetingRow>(
    input.projectId
      ? `SELECT * FROM meetings WHERE organization_id = ? AND project_id = ? ORDER BY start_at ASC`
      : `SELECT * FROM meetings WHERE organization_id = ? ORDER BY start_at ASC`,
    input.projectId ? [input.organizationId, input.projectId] : [input.organizationId]
  );
  const meetingIds = (rows || []).map((row) => row.id);
  const followUps = await getFollowUpsForMeetings(meetingIds);
  return (rows || []).map((row) => mapMeeting(row, followUps[row.id] || []));
}

export async function getMeeting(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  const row = await dbGet<MeetingRow>(
    `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1`,
    [input.meetingId, input.organizationId]
  );
  if (!row) return null;
  const followUps = await getFollowUpsForMeetings([row.id]);
  return mapMeeting(row, followUps[row.id] || []);
}

export async function createMeeting(input: {
  organizationId: string;
  createdBy: string;
  projectId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  timezone?: string | null;
  recurrenceRule?: string | null;
  location?: string | null;
  attendees?: string[];
  preRead?: string[];
  agenda?: string[];
  decisions?: string[];
}): Promise<MeetingRecord> {
  await ensureMeetingTables();
  const id = `meeting-${uuidv4()}`;
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO meetings (
      id, organization_id, project_id, title, start_at, end_at, location,
      attendees_json, pre_read_json, agenda_json, decisions_json, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.projectId || null,
      input.title.trim(),
      input.startAt,
      input.endAt || input.startAt,
      String(input.location || '').trim(),
      JSON.stringify(input.attendees || []),
      JSON.stringify(input.preRead || []),
      JSON.stringify(input.agenda || []),
      JSON.stringify(input.decisions || []),
      input.createdBy,
      now,
      now,
    ]
  );
  if (input.timezone || input.recurrenceRule) {
    await dbRun(
      `UPDATE meetings SET timezone = ?, recurrence_rule = ?
       WHERE id = ? AND organization_id = ?`,
      [input.timezone || null, input.recurrenceRule || null, id, input.organizationId]
    );
  }
  const created = await getMeeting({ organizationId: input.organizationId, meetingId: id });
  if (!created) throw new Error('Failed to create meeting');
  return created;
}

export async function updateMeeting(input: {
  organizationId: string;
  meetingId: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string | null;
  recurrenceRule?: string | null;
  location?: string | null;
  attendees?: string[];
  preRead?: string[];
  agenda?: string[];
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  const existing = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (typeof input.title === 'string' && input.title.trim()) {
    sets.push('title = ?');
    params.push(input.title.trim());
  }
  if (typeof input.startAt === 'string' && input.startAt.trim()) {
    sets.push('start_at = ?');
    params.push(input.startAt.trim());
  }
  if (typeof input.endAt === 'string') {
    sets.push('end_at = ?');
    params.push(input.endAt.trim() || existing.startAt);
  }
  if (input.timezone !== undefined) {
    sets.push('timezone = ?');
    params.push(input.timezone || null);
  }
  if (input.recurrenceRule !== undefined) {
    sets.push('recurrence_rule = ?');
    params.push(input.recurrenceRule || null);
  }
  if (input.location !== undefined) {
    sets.push('location = ?');
    params.push(String(input.location || '').trim());
  }
  if (Array.isArray(input.attendees)) {
    sets.push('attendees_json = ?');
    params.push(JSON.stringify(input.attendees.map((x) => String(x || '').trim()).filter(Boolean)));
  }
  if (Array.isArray(input.preRead)) {
    sets.push('pre_read_json = ?');
    params.push(JSON.stringify(input.preRead.map((x) => String(x || '').trim()).filter(Boolean)));
  }
  if (Array.isArray(input.agenda)) {
    sets.push('agenda_json = ?');
    params.push(JSON.stringify(input.agenda.map((x) => String(x || '').trim()).filter(Boolean)));
  }

  if (sets.length === 0) return existing;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(input.meetingId, input.organizationId);

  await dbRun(
    `UPDATE meetings SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );
  return getMeeting({ organizationId: input.organizationId, meetingId: input.meetingId });
}

export async function deleteMeeting(input: {
  organizationId: string;
  meetingId: string;
}): Promise<boolean> {
  await ensureMeetingTables();
  const existing = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!existing) return false;

  // FIX-M-4 (DEC-58 sceptyk, 2026-08-25): deleting a meeting used to leave
  // orphaned governed-note records behind — `meeting_notes`
  // (meetingBoundaryService.ts, the durable minutes/proposals shown on the
  // Protokół tab) and their `artifact_handoff_proposals` /
  // `artifact_handoff_receipts` rows (handoffSpineService.ts,
  // producer_kind = 'meeting', producer_record_id = this meeting's id) had
  // no FK/cascade tying them to `meetings`. Clean up the full governed-note
  // trail before removing the meeting itself. Receipts reference proposals
  // with `ON DELETE RESTRICT` (20260912_claude_c_handoff_spine.sql), so
  // receipts must be deleted first or the proposal delete below would fail.
  await ensureMeetingBoundaryTables();
  await dbRun(
    `DELETE FROM artifact_handoff_receipts WHERE proposal_id IN (
       SELECT proposal_id FROM artifact_handoff_proposals
       WHERE organization_id = ? AND producer_kind = 'meeting' AND producer_record_id = ?
     )`,
    [input.organizationId, input.meetingId]
  );
  await dbRun(
    `DELETE FROM artifact_handoff_proposals
       WHERE organization_id = ? AND producer_kind = 'meeting' AND producer_record_id = ?`,
    [input.organizationId, input.meetingId]
  );
  await dbRun(`DELETE FROM meeting_notes WHERE organization_id = ? AND meeting_id = ?`, [
    input.organizationId,
    input.meetingId,
  ]);
  await dbRun(`DELETE FROM meeting_follow_ups WHERE meeting_id = ?`, [input.meetingId]);
  await dbRun(`DELETE FROM meetings WHERE id = ? AND organization_id = ?`, [
    input.meetingId,
    input.organizationId,
  ]);
  return true;
}

export async function updateMeetingStatus(input: {
  organizationId: string;
  meetingId: string;
  status: MeetingStatus;
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  await dbRun(
    `UPDATE meetings SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
    [input.status, new Date().toISOString(), input.meetingId, input.organizationId]
  );
  return getMeeting({ organizationId: input.organizationId, meetingId: input.meetingId });
}

export async function addMeetingFollowUp(input: {
  organizationId: string;
  meetingId: string;
  title: string;
  owner?: string | null;
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  const meeting = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!meeting) return null;
  await dbRun(
    `INSERT INTO meeting_follow_ups (id, meeting_id, title, owner, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?)`,
    [
      `meeting-fu-${uuidv4()}`,
      input.meetingId,
      input.title.trim(),
      String(input.owner || '').trim(),
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );
  await dbRun(`UPDATE meetings SET updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    input.meetingId,
  ]);
  return getMeeting({ organizationId: input.organizationId, meetingId: input.meetingId });
}

export async function addMeetingDecision(input: {
  organizationId: string;
  meetingId: string;
  decision: string;
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  const meeting = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!meeting) return null;
  const decisions = [...meeting.decisions, input.decision.trim()].filter(Boolean);
  await dbRun(`UPDATE meetings SET decisions_json = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify(decisions),
    new Date().toISOString(),
    input.meetingId,
  ]);
  return getMeeting({ organizationId: input.organizationId, meetingId: input.meetingId });
}

export async function updateMeetingFollowUpStatus(input: {
  organizationId: string;
  meetingId: string;
  followUpId: string;
  status: FollowUpStatus;
}): Promise<MeetingRecord | null> {
  await ensureMeetingTables();
  const meeting = await getMeeting({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
  });
  if (!meeting) return null;
  // M12-F01: the UPDATE below matches 0 rows for an unknown follow-up id (or one
  // that belongs to a different meeting) and `dbRun` defaults to fallback:true,
  // so it cannot report that. Without this guard the route answered 200 + the
  // full meeting for an action that changed nothing — a false success the UI
  // rendered as an ordinary state refresh. The follow-up list is the authority.
  if (!meeting.followUps.some((item) => item.id === input.followUpId)) return null;
  await dbRun(
    `UPDATE meeting_follow_ups SET status = ?, updated_at = ?
     WHERE id = ? AND meeting_id = ?`,
    [input.status, new Date().toISOString(), input.followUpId, input.meetingId]
  );
  await dbRun(`UPDATE meetings SET updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    input.meetingId,
  ]);
  return getMeeting({ organizationId: input.organizationId, meetingId: input.meetingId });
}

type DecisionRecordRow = {
  id: string;
  organization_id: string;
  meeting_id: string;
  statement: string;
  rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
  status: string | null;
  source_kind: string | null;
  source_note_id: string | null;
  source_index: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type FollowUpRecordRow = FollowUpRow & {
  organization_id: string | null;
  owner_user_id: string | null;
  due_at: string | null;
  source_kind: string | null;
  source_note_id: string | null;
  source_index: number | null;
};

function mapDecisionRecord(row: DecisionRecordRow): MeetingDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    meetingId: row.meeting_id,
    statement: row.statement,
    rationale: row.rationale || '',
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    status: row.status === 'superseded' ? 'superseded' : 'recorded',
    sourceKind:
      row.source_kind === 'note' || row.source_kind === 'legacy' ? row.source_kind : 'manual',
    sourceNoteId: row.source_note_id,
    sourceIndex: row.source_index,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFollowUpRecord(row: FollowUpRecordRow): MeetingFollowUpRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    meetingId: row.meeting_id,
    title: row.title,
    owner: row.owner || '',
    ownerUserId: row.owner_user_id,
    dueAt: row.due_at,
    status: row.status === 'done' ? 'done' : 'open',
    sourceKind:
      row.source_kind === 'note' || row.source_kind === 'legacy' ? row.source_kind : 'manual',
    sourceNoteId: row.source_note_id,
    sourceIndex: row.source_index,
  };
}

export async function listMeetingDecisionRecords(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingDecisionRecord[]> {
  const rows = await dbAll<DecisionRecordRow>(
    `SELECT * FROM meeting_decisions
     WHERE organization_id = ? AND meeting_id = ? ORDER BY created_at ASC, id ASC`,
    [input.organizationId, input.meetingId]
  );
  return (rows || []).map(mapDecisionRecord);
}

export async function getMeetingDecisionRecord(input: {
  organizationId: string;
  meetingId: string;
  decisionId: string;
}): Promise<MeetingDecisionRecord | null> {
  const row = await dbGet<DecisionRecordRow>(
    `SELECT * FROM meeting_decisions
     WHERE id = ? AND organization_id = ? AND meeting_id = ? LIMIT 1`,
    [input.decisionId, input.organizationId, input.meetingId]
  );
  return row ? mapDecisionRecord(row) : null;
}

export async function createMeetingDecisionRecord(input: {
  organizationId: string;
  meetingId: string;
  statement: string;
  rationale?: string;
  decidedBy?: string | null;
  createdBy: string;
}): Promise<MeetingDecisionRecord> {
  const id = `meeting-decision-${uuidv4()}`;
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO meeting_decisions (
       id, organization_id, meeting_id, statement, rationale, decided_by,
       decided_at, status, source_kind, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded', 'manual', ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.meetingId,
      input.statement.trim(),
      String(input.rationale || '').trim(),
      input.decidedBy || null,
      now,
      input.createdBy,
      now,
      now,
    ]
  );
  const created = await getMeetingDecisionRecord({ ...input, decisionId: id });
  if (!created) throw new Error('Failed to read back meeting decision');
  return created;
}

export async function updateMeetingDecisionRecord(input: {
  organizationId: string;
  meetingId: string;
  decisionId: string;
  statement?: string;
  rationale?: string;
  status?: 'recorded' | 'superseded';
}): Promise<MeetingDecisionRecord | null> {
  const existing = await getMeetingDecisionRecord(input);
  if (!existing) return null;
  await dbRun(
    `UPDATE meeting_decisions SET statement = ?, rationale = ?, status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [
      input.statement?.trim() || existing.statement,
      input.rationale === undefined ? existing.rationale : input.rationale.trim(),
      input.status || existing.status,
      new Date().toISOString(),
      input.decisionId,
      input.organizationId,
      input.meetingId,
    ]
  );
  return getMeetingDecisionRecord(input);
}

export async function deleteMeetingDecisionRecord(input: {
  organizationId: string;
  meetingId: string;
  decisionId: string;
}): Promise<boolean> {
  if (!(await getMeetingDecisionRecord(input))) return false;
  await dbRun(
    `DELETE FROM meeting_decisions WHERE id = ? AND organization_id = ? AND meeting_id = ?`,
    [input.decisionId, input.organizationId, input.meetingId]
  );
  return (await getMeetingDecisionRecord(input)) === null;
}

export async function listMeetingFollowUpRecords(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingFollowUpRecord[]> {
  const rows = await dbAll<FollowUpRecordRow>(
    `SELECT id, meeting_id, organization_id, title, owner, owner_user_id, due_at,
            status, source_kind, source_note_id, source_index
     FROM meeting_follow_ups
     WHERE meeting_id = ? AND (organization_id = ? OR organization_id IS NULL)
     ORDER BY created_at ASC, id ASC`,
    [input.meetingId, input.organizationId]
  );
  return (rows || []).map(mapFollowUpRecord);
}

export async function getMeetingFollowUpRecord(input: {
  organizationId: string;
  meetingId: string;
  followUpId: string;
}): Promise<MeetingFollowUpRecord | null> {
  const row = await dbGet<FollowUpRecordRow>(
    `SELECT id, meeting_id, organization_id, title, owner, owner_user_id, due_at,
            status, source_kind, source_note_id, source_index
     FROM meeting_follow_ups
     WHERE id = ? AND meeting_id = ? AND (organization_id = ? OR organization_id IS NULL)
     LIMIT 1`,
    [input.followUpId, input.meetingId, input.organizationId]
  );
  return row ? mapFollowUpRecord(row) : null;
}

export async function createMeetingFollowUpRecord(input: {
  organizationId: string;
  meetingId: string;
  title: string;
  owner?: string;
  ownerUserId?: string | null;
  dueAt?: string | null;
}): Promise<MeetingFollowUpRecord> {
  const id = `meeting-fu-${uuidv4()}`;
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO meeting_follow_ups (
       id, meeting_id, organization_id, title, owner, owner_user_id, due_at,
       status, source_kind, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'manual', ?, ?)`,
    [
      id,
      input.meetingId,
      input.organizationId,
      input.title.trim(),
      String(input.owner || '').trim(),
      input.ownerUserId || null,
      input.dueAt || null,
      now,
      now,
    ]
  );
  const created = await getMeetingFollowUpRecord({ ...input, followUpId: id });
  if (!created) throw new Error('Failed to read back meeting follow-up');
  return created;
}

export async function updateMeetingFollowUpRecord(input: {
  organizationId: string;
  meetingId: string;
  followUpId: string;
  title?: string;
  owner?: string;
  ownerUserId?: string | null;
  dueAt?: string | null;
  status?: FollowUpStatus;
}): Promise<MeetingFollowUpRecord | null> {
  const existing = await getMeetingFollowUpRecord(input);
  if (!existing) return null;
  await dbRun(
    `UPDATE meeting_follow_ups
     SET title = ?, owner = ?, owner_user_id = ?, due_at = ?, status = ?, updated_at = ?
     WHERE id = ? AND meeting_id = ? AND (organization_id = ? OR organization_id IS NULL)`,
    [
      input.title?.trim() || existing.title,
      input.owner === undefined ? existing.owner : input.owner.trim(),
      input.ownerUserId === undefined ? existing.ownerUserId : input.ownerUserId,
      input.dueAt === undefined ? existing.dueAt : input.dueAt,
      input.status || existing.status,
      new Date().toISOString(),
      input.followUpId,
      input.meetingId,
      input.organizationId,
    ]
  );
  return getMeetingFollowUpRecord(input);
}

export async function deleteMeetingFollowUpRecord(input: {
  organizationId: string;
  meetingId: string;
  followUpId: string;
}): Promise<boolean> {
  if (!(await getMeetingFollowUpRecord(input))) return false;
  await dbRun(
    `DELETE FROM meeting_follow_ups
     WHERE id = ? AND meeting_id = ? AND (organization_id = ? OR organization_id IS NULL)`,
    [input.followUpId, input.meetingId, input.organizationId]
  );
  return (await getMeetingFollowUpRecord(input)) === null;
}
