import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

/**
 * MTG-1 rework etap 1 / DEC-596 — agenda jako oś spotkania + trwały cykl życia.
 * Warstwa serwisowa nad tabelą `meeting_agenda_items` i kolumną
 * `meetings.lifecycle_state` (migracja 20262301). Walidacja dozwolonych
 * przejść cyklu życia mieszka TUTAJ (jedno źródło prawdy), nie w trasach.
 */

export type MeetingAgendaPurpose = 'information' | 'discussion' | 'decision';

export type MeetingLifecycleState =
  | 'scheduled'
  | 'in_progress'
  | 'minutes_to_approve'
  | 'needs_actions'
  | 'closed';

export const MEETING_LIFECYCLE_STATES: readonly MeetingLifecycleState[] = Object.freeze([
  'scheduled',
  'in_progress',
  'minutes_to_approve',
  'needs_actions',
  'closed',
]);

/**
 * Dozwolone przejścia cyklu życia (makieta mtg-rework-20260917, Menu 3):
 * scheduled -> in_progress -> minutes_to_approve -> {needs_actions, closed};
 * needs_actions -> closed. `closed` jest terminalny.
 */
export const MEETING_LIFECYCLE_TRANSITIONS: Readonly<
  Record<MeetingLifecycleState, readonly MeetingLifecycleState[]>
> = {
  scheduled: ['in_progress'],
  in_progress: ['minutes_to_approve'],
  minutes_to_approve: ['needs_actions', 'closed'],
  needs_actions: ['closed'],
  closed: [],
};

export class MeetingLifecycleTransitionError extends Error {
  readonly from: MeetingLifecycleState;
  readonly to: MeetingLifecycleState;
  readonly code = 'MEETING_LIFECYCLE_TRANSITION_NOT_ALLOWED';

  constructor(from: MeetingLifecycleState, to: MeetingLifecycleState) {
    super(`Meeting lifecycle transition not allowed: ${from} -> ${to}`);
    this.name = 'MeetingLifecycleTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class MeetingAgendaError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MeetingAgendaError';
    this.code = code;
  }
}

export function isMeetingLifecycleState(value: unknown): value is MeetingLifecycleState {
  return typeof value === 'string' && (MEETING_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export function assertLifecycleTransition(
  from: MeetingLifecycleState,
  to: MeetingLifecycleState
): void {
  const allowed = MEETING_LIFECYCLE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new MeetingLifecycleTransitionError(from, to);
  }
}

export interface MeetingAgendaItem {
  id: string;
  organizationId: string;
  meetingId: string;
  position: number;
  title: string;
  durationMinutes: number;
  purpose: MeetingAgendaPurpose;
  leadUserId: string | null;
  preRead: string[];
  initiativeId: string | null;
  decisionId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

type AgendaRow = {
  id: string;
  organization_id: string;
  meeting_id: string;
  position: number | string;
  title: string;
  duration_minutes: number | string;
  purpose: string | null;
  lead_user_id: string | null;
  pre_read_json: string | null;
  initiative_id: string | null;
  decision_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

function mapAgendaItem(row: AgendaRow): MeetingAgendaItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    meetingId: row.meeting_id,
    position: Number(row.position || 0),
    title: row.title,
    durationMinutes: Number(row.duration_minutes || 0),
    purpose:
      row.purpose === 'discussion' || row.purpose === 'decision' ? row.purpose : 'information',
    leadUserId: row.lead_user_id || null,
    preRead: safeJsonArray(row.pre_read_json),
    initiativeId: row.initiative_id || null,
    decisionId: row.decision_id || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMeetingAgendaItems(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingAgendaItem[]> {
  const rows = await dbAll<AgendaRow>(
    `SELECT * FROM meeting_agenda_items
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY position ASC, id ASC`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  return (rows || []).map(mapAgendaItem);
}

export async function getMeetingAgendaItem(input: {
  organizationId: string;
  itemId: string;
}): Promise<MeetingAgendaItem | null> {
  const row = await dbGet<AgendaRow>(
    `SELECT * FROM meeting_agenda_items WHERE organization_id = ? AND id = ? LIMIT 1`,
    [input.organizationId, input.itemId],
    { fallback: false }
  );
  return row ? mapAgendaItem(row) : null;
}

export async function createMeetingAgendaItem(input: {
  organizationId: string;
  meetingId: string;
  title: string;
  durationMinutes?: number;
  purpose?: MeetingAgendaPurpose;
  leadUserId?: string | null;
  preRead?: string[];
  initiativeId?: string | null;
  decisionId?: string | null;
  notes?: string;
  position?: number;
}): Promise<MeetingAgendaItem> {
  const now = new Date().toISOString();
  const existing = await dbGet<{ max_position: number | string | null }>(
    `SELECT MAX(position) AS max_position FROM meeting_agenda_items
     WHERE organization_id = ? AND meeting_id = ?`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  const position =
    input.position !== undefined
      ? Number(input.position)
      : Number(existing?.max_position || 0) + 1;
  const id = uuidv4();
  await dbRun(
    `INSERT INTO meeting_agenda_items (
       id, organization_id, meeting_id, position, title, duration_minutes,
       purpose, lead_user_id, pre_read_json, initiative_id, decision_id,
       notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.meetingId,
      position,
      input.title,
      input.durationMinutes !== undefined ? Number(input.durationMinutes) : 15,
      input.purpose || 'information',
      input.leadUserId || null,
      JSON.stringify(input.preRead || []),
      input.initiativeId || null,
      input.decisionId || null,
      input.notes || '',
      now,
      now,
    ],
    { fallback: false }
  );
  const created = await getMeetingAgendaItem({
    organizationId: input.organizationId,
    itemId: id,
  });
  if (!created) throw new MeetingAgendaError('MEETING_AGENDA_INSERT_UNREADABLE');
  return created;
}

export async function updateMeetingAgendaItem(input: {
  organizationId: string;
  itemId: string;
  title?: string;
  durationMinutes?: number;
  purpose?: MeetingAgendaPurpose;
  leadUserId?: string | null;
  preRead?: string[];
  initiativeId?: string | null;
  decisionId?: string | null;
  notes?: string;
  position?: number;
}): Promise<MeetingAgendaItem | null> {
  const current = await getMeetingAgendaItem({
    organizationId: input.organizationId,
    itemId: input.itemId,
  });
  if (!current) return null;

  const now = new Date().toISOString();
  await dbRun(
    `UPDATE meeting_agenda_items SET
       title = ?, duration_minutes = ?, purpose = ?, lead_user_id = ?,
       pre_read_json = ?, initiative_id = ?, decision_id = ?, notes = ?,
       position = ?, updated_at = ?
     WHERE organization_id = ? AND id = ?`,
    [
      input.title !== undefined ? input.title : current.title,
      input.durationMinutes !== undefined ? Number(input.durationMinutes) : current.durationMinutes,
      input.purpose !== undefined ? input.purpose : current.purpose,
      input.leadUserId !== undefined ? input.leadUserId : current.leadUserId,
      JSON.stringify(input.preRead !== undefined ? input.preRead : current.preRead),
      input.initiativeId !== undefined ? input.initiativeId : current.initiativeId,
      input.decisionId !== undefined ? input.decisionId : current.decisionId,
      input.notes !== undefined ? input.notes : current.notes,
      input.position !== undefined ? Number(input.position) : current.position,
      now,
      input.organizationId,
      input.itemId,
    ],
    { fallback: false }
  );
  return getMeetingAgendaItem({ organizationId: input.organizationId, itemId: input.itemId });
}

export async function deleteMeetingAgendaItem(input: {
  organizationId: string;
  itemId: string;
}): Promise<boolean> {
  const existing = await dbGet<{ meeting_id: string }>(
    `SELECT meeting_id FROM meeting_agenda_items
     WHERE organization_id = ? AND id = ? LIMIT 1`,
    [input.organizationId, input.itemId],
    { fallback: false }
  );
  const result = await dbRun(
    `DELETE FROM meeting_agenda_items WHERE organization_id = ? AND id = ?`,
    [input.organizationId, input.itemId],
    { fallback: false }
  );
  const changed = (result as { changes?: number } | null)?.changes;
  const deleted = typeof changed === 'number' ? changed > 0 : true;
  if (!deleted || !existing) return deleted;

  // P3 (KANAL Wpis 48): numeracja punktów jest osią agendy w karcie, więc po
  // usunięciu zamykamy luki (1,2,4 -> 1,2,3) w tej samej kolejności, w której
  // lista czyta punkty.
  const remaining = await dbAll<{ id: string }>(
    `SELECT id FROM meeting_agenda_items
     WHERE organization_id = ? AND meeting_id = ?
     ORDER BY position ASC, id ASC`,
    [input.organizationId, existing.meeting_id],
    { fallback: false }
  );
  for (let index = 0; index < (remaining || []).length; index += 1) {
    await dbRun(
      `UPDATE meeting_agenda_items SET position = ?, updated_at = ?
       WHERE organization_id = ? AND id = ?`,
      [index + 1, new Date().toISOString(), input.organizationId, remaining![index].id],
      { fallback: false }
    );
  }
  return deleted;
}

/**
 * Zmiana stanu cyklu życia spotkania. Czyta bieżący stan (NULL traktuje jak
 * `scheduled`, czyli stan sprzed backfillu), waliduje przejście przez
 * `assertLifecycleTransition` i zapisuje nowy stan. Rzuca
 * `MeetingLifecycleTransitionError` na niedozwolonym przejściu.
 */
export async function setMeetingLifecycle(input: {
  organizationId: string;
  meetingId: string;
  nextState: MeetingLifecycleState;
}): Promise<MeetingLifecycleState> {
  const row = await dbGet<{ lifecycle_state: string | null }>(
    `SELECT lifecycle_state FROM meetings WHERE organization_id = ? AND id = ? LIMIT 1`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  if (!row) throw new MeetingAgendaError('MEETING_NOT_FOUND');
  const from = isMeetingLifecycleState(row.lifecycle_state) ? row.lifecycle_state : 'scheduled';
  assertLifecycleTransition(from, input.nextState);
  await dbRun(
    `UPDATE meetings SET lifecycle_state = ?, updated_at = ? WHERE organization_id = ? AND id = ?`,
    [input.nextState, new Date().toISOString(), input.organizationId, input.meetingId],
    { fallback: false }
  );
  return input.nextState;
}

export async function getMeetingLifecycle(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingLifecycleState | null> {
  const row = await dbGet<{ lifecycle_state: string | null }>(
    `SELECT lifecycle_state FROM meetings WHERE organization_id = ? AND id = ? LIMIT 1`,
    [input.organizationId, input.meetingId],
    { fallback: false }
  );
  if (!row) return null;
  return isMeetingLifecycleState(row.lifecycle_state) ? row.lifecycle_state : 'scheduled';
}
