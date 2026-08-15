/**
 * repo.ts — low-level SQL + row mapping for Meeting Core's own tables
 * (meetings' new columns, meeting_participants, meeting_note_entries,
 * meeting_outputs). Every statement here uses native pg `$1,$2,...`
 * placeholders on a caller-supplied `Pool` or `PoolClient` — nothing in this
 * file goes through DbPromise/Database.js, so importing it has zero risk of
 * touching DatabaseConfig.ts (see pgTransaction.ts docstring for why that
 * matters for test isolation).
 *
 * All functions take `organizationId` and fold it into the WHERE clause —
 * tenant isolation lives here, once, rather than being re-implemented by
 * every caller.
 */

import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { ConflictError } from './errors.js';
import { MEETING_TRANSITIONS } from './lifecycle.js';
import type {
  MeetingCoreRecord,
  MeetingLifecycleStatus,
  MeetingNoteEntryRecord,
  MeetingOutputRecord,
  MeetingParticipantRecord,
  MeetingRole,
  NoteAuthorKind,
  NoteEntryStatus,
  NoteEntryType,
  OutputKind,
  OutputStatus,
} from './types.js';

export type PgExecutor = Pool | PoolClient;

/**
 * Reverse index of lifecycle.ts's transition matrix: for a given target
 * `to` lifecycle_status, the set of `lifecycle_status` values a row must
 * currently hold for that transition to be legal. Every rule in
 * MEETING_TRANSITIONS has a distinct `to` (each reachable
 * MeetingLifecycleStatus is the target of exactly one named transition), so
 * this map is safe to build once, at module load, from the single source of
 * truth in lifecycle.ts rather than duplicating the matrix here.
 *
 * Used by setMeetingLifecycleRow() as an optimistic-concurrency guard folded
 * directly into the UPDATE's WHERE clause — see that function for why this
 * is the mechanism (DEFEKT 1 / Scenario 19).
 */
const LIFECYCLE_FROM_BY_TARGET: Partial<
  Record<MeetingLifecycleStatus, readonly MeetingLifecycleStatus[]>
> = (() => {
  const map: Partial<Record<MeetingLifecycleStatus, readonly MeetingLifecycleStatus[]>> = {};
  for (const rule of Object.values(MEETING_TRANSITIONS)) {
    map[rule.to] = rule.from;
  }
  return map;
})();

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toIsoRequired(value: unknown): string {
  return toIso(value) ?? new Date().toISOString();
}

// ==========================================
// meetings
// ==========================================

interface MeetingRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  status: string | null;
  lifecycle_status: string | null;
  closed_at: unknown;
  closed_by: string | null;
  purpose: string | null;
  expected_outcomes: string | null;
  preparation_notes: string | null;
  created_by: string;
  created_at: unknown;
  updated_at: unknown;
}

const MEETING_SELECT_COLUMNS = `
  id, organization_id, project_id, title, start_at, end_at, location, status,
  lifecycle_status, closed_at, closed_by, purpose, expected_outcomes,
  preparation_notes, created_by, created_at, updated_at
`;

function mapMeetingRow(row: MeetingRow): MeetingCoreRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location || '',
    purpose: row.purpose,
    expectedOutcomes: row.expected_outcomes,
    preparationNotes: row.preparation_notes,
    lifecycleStatus: (row.lifecycle_status as MeetingLifecycleStatus | null) || null,
    legacyStatus: row.status || 'scheduled',
    closedAt: toIso(row.closed_at),
    closedBy: row.closed_by,
    createdBy: row.created_by,
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  };
}

export interface InsertMeetingInput {
  id: string;
  organizationId: string;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  purpose: string | null;
  expectedOutcomes: string | null;
  preparationNotes: string | null;
  lifecycleStatus: MeetingLifecycleStatus;
  createdBy: string;
}

export async function insertMeetingRow(
  db: PgExecutor,
  input: InsertMeetingInput
): Promise<MeetingCoreRecord> {
  const now = new Date().toISOString();
  const result = await db.query<MeetingRow>(
    `INSERT INTO meetings (
       id, organization_id, project_id, title, start_at, end_at, location,
       attendees_json, pre_read_json, agenda_json, decisions_json, status,
       lifecycle_status, purpose, expected_outcomes, preparation_notes,
       created_by, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', '[]', '[]', '[]', 'scheduled',
       $8, $9, $10, $11, $12, $13, $14)
     RETURNING ${MEETING_SELECT_COLUMNS}`,
    [
      input.id,
      input.organizationId,
      input.projectId,
      input.title,
      input.startAt,
      input.endAt,
      input.location,
      input.lifecycleStatus,
      input.purpose,
      input.expectedOutcomes,
      input.preparationNotes,
      input.createdBy,
      now,
      now,
    ]
  );
  return mapMeetingRow(result.rows[0]);
}

export async function getMeetingRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string
): Promise<MeetingCoreRecord | null> {
  const result = await db.query<MeetingRow>(
    `SELECT ${MEETING_SELECT_COLUMNS} FROM meetings WHERE id = $1 AND organization_id = $2 LIMIT 1`,
    [meetingId, organizationId]
  );
  return result.rows[0] ? mapMeetingRow(result.rows[0]) : null;
}

export async function adoptLegacyMeetingRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string
): Promise<MeetingCoreRecord | null> {
  const result = await db.query<MeetingRow>(
    `UPDATE meetings
     SET lifecycle_status = COALESCE(lifecycle_status, 'DRAFT'), updated_at = $1
     WHERE id = $2 AND organization_id = $3
     RETURNING ${MEETING_SELECT_COLUMNS}`,
    [new Date().toISOString(), meetingId, organizationId]
  );
  return result.rows[0] ? mapMeetingRow(result.rows[0]) : null;
}

export interface UpdateMeetingPrepFields {
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  purpose?: string;
  expectedOutcomes?: string;
  preparationNotes?: string;
}

export async function updateMeetingPrepRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  fields: UpdateMeetingPrepFields
): Promise<MeetingCoreRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const columnByKey: Record<keyof UpdateMeetingPrepFields, string> = {
    title: 'title',
    startAt: 'start_at',
    endAt: 'end_at',
    location: 'location',
    purpose: 'purpose',
    expectedOutcomes: 'expected_outcomes',
    preparationNotes: 'preparation_notes',
  };

  (Object.keys(fields) as (keyof UpdateMeetingPrepFields)[]).forEach((key) => {
    const value = fields[key];
    if (value === undefined) return;
    sets.push(`${columnByKey[key]} = $${idx++}`);
    params.push(value);
  });

  if (sets.length === 0) {
    return getMeetingRow(db, organizationId, meetingId);
  }

  sets.push(`updated_at = $${idx++}`);
  params.push(new Date().toISOString());
  params.push(meetingId, organizationId);

  const result = await db.query<MeetingRow>(
    `UPDATE meetings SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}
     RETURNING ${MEETING_SELECT_COLUMNS}`,
    params
  );
  return result.rows[0] ? mapMeetingRow(result.rows[0]) : null;
}

/**
 * DEFEKT 1 fix (Scenario 19 + generic lifecycle race): optimistic
 * concurrency, not a bare `WHERE id = $1 AND organization_id = $2`.
 *
 * The old UPDATE never mentioned `lifecycle_status`, so two transactions
 * that both read the row in (say) DRAFT before either committed would BOTH
 * pass the in-app `assertTransitionAllowed` check (which runs against that
 * stale read) and then BOTH succeed at the UPDATE — Postgres READ COMMITTED
 * re-evaluates a waiting UPDATE's WHERE clause against the row's latest
 * COMMITTED version once the first writer's row lock is released, but with
 * no status predicate there was nothing for that re-check to reject.
 *
 * Fix: fold the transition's legal `from` set (looked up from
 * LIFECYCLE_FROM_BY_TARGET, itself derived from lifecycle.ts's
 * MEETING_TRANSITIONS — the single source of truth for which states may
 * reach `next`) into the WHERE clause. The UPDATE statement itself becomes
 * the single arbiter: whichever writer's UPDATE actually commits first wins
 * the row lock and flips lifecycle_status; every other concurrent UPDATE on
 * the same row then blocks on that lock, and once released re-checks this
 * WHERE clause against the now-committed (already-transitioned) row — which
 * no longer matches, so it affects zero rows. `SELECT ... FOR UPDATE` before
 * the check-then-act would also close the race, but requires an extra
 * round-trip and a second statement to keep in sync with this one; folding
 * the guard into the UPDATE's own WHERE clause is one round trip and lets
 * Postgres's normal MVCC re-check do the serialization for us.
 *
 * A losing writer gets a thrown, typed `ConflictError` — never a silent
 * no-op and never a value indistinguishable from "meeting not found" (every
 * current caller already re-reads the meeting by the same id+organizationId
 * earlier in the same transaction before calling this function, so a
 * zero-row UPDATE here can only mean "someone else changed lifecycle_status
 * out from under us", not "the row doesn't exist").
 */
export async function setMeetingLifecycleRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  next: MeetingLifecycleStatus
): Promise<MeetingCoreRecord> {
  const fromStatuses = LIFECYCLE_FROM_BY_TARGET[next];
  const result = await db.query<MeetingRow>(
    `UPDATE meetings SET lifecycle_status = $1, updated_at = $2
     WHERE id = $3 AND organization_id = $4
       AND ($5::text[] IS NULL OR lifecycle_status = ANY($5::text[]))
     RETURNING ${MEETING_SELECT_COLUMNS}`,
    [
      next,
      new Date().toISOString(),
      meetingId,
      organizationId,
      fromStatuses ? [...fromStatuses] : null,
    ]
  );
  if (result.rowCount === 0) {
    throw new ConflictError(
      `setMeetingLifecycleRow: lost the optimistic-concurrency race transitioning meeting ${meetingId} to '${next}' — another writer already moved lifecycle_status out of [${(fromStatuses ?? []).join(', ')}] (or the meeting does not exist).`
    );
  }
  return mapMeetingRow(result.rows[0]);
}

/**
 * DEFEKT 1 fix, CLOSE's specific case: `setMeetingClosedRow` only ever
 * performs the single named CLOSE transition (CLOSING -> CLOSED — see
 * lifecycle.ts's MEETING_TRANSITIONS.CLOSE), so its guard is the literal
 * `lifecycle_status = 'CLOSING'` rather than a derived set. Same mechanism
 * and same reasoning as setMeetingLifecycleRow above: the UPDATE's WHERE
 * clause is the single arbiter, so a second closer's UPDATE (once it's
 * unblocked by the first closer's COMMIT) re-checks against the
 * already-CLOSED row, matches zero rows, and never gets the chance to
 * silently overwrite `closed_by`/`closed_at`.
 */
export async function setMeetingClosedRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  closedBy: string
): Promise<MeetingCoreRecord> {
  const now = new Date().toISOString();
  // `closed_at` (timestamptz) and `updated_at` (text, in the scratch schema)
  // are different column types — reusing one placeholder for both makes
  // Postgres reject the query with "inconsistent types deduced for
  // parameter $1". Two separate placeholders (same JS value) sidestep that.
  const result = await db.query<MeetingRow>(
    `UPDATE meetings SET lifecycle_status = 'CLOSED', closed_at = $1, closed_by = $2, updated_at = $3
     WHERE id = $4 AND organization_id = $5 AND lifecycle_status = 'CLOSING'
     RETURNING ${MEETING_SELECT_COLUMNS}`,
    [now, closedBy, now, meetingId, organizationId]
  );
  if (result.rowCount === 0) {
    throw new ConflictError(
      `setMeetingClosedRow: lost the optimistic-concurrency race closing meeting ${meetingId} — another writer already moved lifecycle_status away from CLOSING (or the meeting does not exist).`
    );
  }
  return mapMeetingRow(result.rows[0]);
}

// ==========================================
// meeting_participants
// ==========================================

interface ParticipantRow {
  id: string;
  meeting_id: string;
  organization_id: string;
  user_id: string;
  meeting_role: string;
  invited_by: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function mapParticipantRow(row: ParticipantRow): MeetingParticipantRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    meetingRole: row.meeting_role as MeetingRole,
    invitedBy: row.invited_by,
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  };
}

/**
 * Idempotent upsert: re-inviting an existing participant updates their role
 * (e.g. promoting a participant to facilitator) instead of throwing on the
 * UNIQUE(meeting_id, user_id) constraint.
 */
export async function upsertParticipantRow(
  db: PgExecutor,
  input: {
    meetingId: string;
    organizationId: string;
    userId: string;
    role: MeetingRole;
    invitedBy: string | null;
  }
): Promise<MeetingParticipantRecord> {
  const id = `mp-${randomUUID()}`;
  const now = new Date().toISOString();
  const result = await db.query<ParticipantRow>(
    `INSERT INTO meeting_participants (
       id, meeting_id, organization_id, user_id, meeting_role, invited_by, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (meeting_id, user_id)
     DO UPDATE SET meeting_role = EXCLUDED.meeting_role, updated_at = $7
     RETURNING id, meeting_id, organization_id, user_id, meeting_role, invited_by, created_at, updated_at`,
    [id, input.meetingId, input.organizationId, input.userId, input.role, input.invitedBy, now]
  );
  return mapParticipantRow(result.rows[0]);
}

export async function listParticipantRows(
  db: PgExecutor,
  organizationId: string,
  meetingId: string
): Promise<MeetingParticipantRecord[]> {
  const result = await db.query<ParticipantRow>(
    `SELECT id, meeting_id, organization_id, user_id, meeting_role, invited_by, created_at, updated_at
     FROM meeting_participants WHERE meeting_id = $1 AND organization_id = $2
     ORDER BY created_at ASC`,
    [meetingId, organizationId]
  );
  return result.rows.map(mapParticipantRow);
}

export async function getParticipantRoleRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  userId: string
): Promise<MeetingRole | null> {
  const result = await db.query<{ meeting_role: string }>(
    `SELECT meeting_role FROM meeting_participants
     WHERE meeting_id = $1 AND organization_id = $2 AND user_id = $3 LIMIT 1`,
    [meetingId, organizationId, userId]
  );
  return (result.rows[0]?.meeting_role as MeetingRole | undefined) || null;
}

export async function removeParticipantRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  userId: string
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM meeting_participants WHERE meeting_id = $1 AND organization_id = $2 AND user_id = $3`,
    [meetingId, organizationId, userId]
  );
  return (result.rowCount || 0) > 0;
}

// ==========================================
// meeting_note_entries
// ==========================================

interface NoteRow {
  id: string;
  meeting_id: string;
  organization_id: string;
  entry_type: string;
  content: string;
  author_user_id: string;
  author_kind: string;
  status: string;
  created_at: unknown;
  updated_at: unknown;
}

function mapNoteRow(row: NoteRow): MeetingNoteEntryRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    organizationId: row.organization_id,
    entryType: row.entry_type as NoteEntryType,
    content: row.content,
    authorUserId: row.author_user_id,
    authorKind: row.author_kind as NoteAuthorKind,
    status: row.status as NoteEntryStatus,
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  };
}

export async function insertNoteRow(
  db: PgExecutor,
  input: {
    meetingId: string;
    organizationId: string;
    entryType: NoteEntryType;
    content: string;
    authorUserId: string;
    authorKind: NoteAuthorKind;
  }
): Promise<MeetingNoteEntryRecord> {
  const id = `mne-${randomUUID()}`;
  const now = new Date().toISOString();
  const result = await db.query<NoteRow>(
    `INSERT INTO meeting_note_entries (
       id, meeting_id, organization_id, entry_type, content, author_user_id, author_kind, status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8)
     RETURNING id, meeting_id, organization_id, entry_type, content, author_user_id, author_kind, status, created_at, updated_at`,
    [
      id,
      input.meetingId,
      input.organizationId,
      input.entryType,
      input.content,
      input.authorUserId,
      input.authorKind,
      now,
    ]
  );
  return mapNoteRow(result.rows[0]);
}

export async function listNoteRows(
  db: PgExecutor,
  organizationId: string,
  meetingId: string
): Promise<MeetingNoteEntryRecord[]> {
  const result = await db.query<NoteRow>(
    `SELECT id, meeting_id, organization_id, entry_type, content, author_user_id, author_kind, status, created_at, updated_at
     FROM meeting_note_entries WHERE meeting_id = $1 AND organization_id = $2
     ORDER BY created_at ASC`,
    [meetingId, organizationId]
  );
  return result.rows.map(mapNoteRow);
}

export async function archiveNoteRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  noteId: string
): Promise<MeetingNoteEntryRecord | null> {
  const result = await db.query<NoteRow>(
    `UPDATE meeting_note_entries
     SET status = 'archived', updated_at = $1
     WHERE id = $2 AND meeting_id = $3 AND organization_id = $4 AND status = 'active'
     RETURNING id, meeting_id, organization_id, entry_type, content, author_user_id, author_kind, status, created_at, updated_at`,
    [new Date().toISOString(), noteId, meetingId, organizationId]
  );
  return result.rows[0] ? mapNoteRow(result.rows[0]) : null;
}

// ==========================================
// meeting_outputs
// ==========================================

interface OutputRow {
  id: string;
  meeting_id: string;
  organization_id: string;
  source_note_entry_id: string | null;
  output_kind: string;
  proposed_payload_json: string;
  status: string;
  canonical_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  proposed_by: string;
  proposed_by_kind: string;
  reviewed_by: string | null;
  reviewed_at: unknown;
  materialized_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const OUTPUT_SELECT_COLUMNS = `
  id, meeting_id, organization_id, source_note_entry_id, output_kind,
  proposed_payload_json, status, canonical_id, idempotency_key,
  failure_reason, proposed_by, proposed_by_kind, reviewed_by, reviewed_at,
  materialized_at, created_at, updated_at
`;

function mapOutputRow(row: OutputRow): MeetingOutputRecord {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.proposed_payload_json || '{}');
    if (parsed && typeof parsed === 'object') payload = parsed;
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    meetingId: row.meeting_id,
    organizationId: row.organization_id,
    sourceNoteEntryId: row.source_note_entry_id,
    outputKind: row.output_kind as OutputKind,
    proposedPayload: payload,
    status: row.status as OutputStatus,
    canonicalId: row.canonical_id,
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    proposedBy: row.proposed_by,
    proposedByKind: row.proposed_by_kind as NoteAuthorKind,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    materializedAt: toIso(row.materialized_at),
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  };
}

export async function insertOutputRow(
  db: PgExecutor,
  input: {
    meetingId: string;
    organizationId: string;
    sourceNoteEntryId: string | null;
    outputKind: OutputKind;
    proposedPayload: Record<string, unknown>;
    proposedBy: string;
    proposedByKind: NoteAuthorKind;
    idempotencyKey?: string;
  }
): Promise<MeetingOutputRecord | null> {
  const id = `mo-${randomUUID()}`;
  // HTTP proposals supply a client-derived, meeting-scoped key. Internal
  // callers retain the legacy output-id-derived fallback for compatibility.
  const idempotencyKey = input.idempotencyKey || `meeting-output:${input.meetingId}:${id}`;
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `INSERT INTO meeting_outputs (
       id, meeting_id, organization_id, source_note_entry_id, output_kind,
       proposed_payload_json, status, idempotency_key, proposed_by,
       proposed_by_kind, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'PROPOSED', $7, $8, $9, $10, $10)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [
      id,
      input.meetingId,
      input.organizationId,
      input.sourceNoteEntryId,
      input.outputKind,
      JSON.stringify(input.proposedPayload || {}),
      idempotencyKey,
      input.proposedBy,
      input.proposedByKind,
      now,
    ]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

export async function getOutputByIdempotencyKeyRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  idempotencyKey: string
): Promise<MeetingOutputRecord | null> {
  const result = await db.query<OutputRow>(
    `SELECT ${OUTPUT_SELECT_COLUMNS} FROM meeting_outputs
     WHERE organization_id = $1 AND meeting_id = $2 AND idempotency_key = $3
     LIMIT 1`,
    [organizationId, meetingId, idempotencyKey]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

export async function getOutputRow(
  db: PgExecutor,
  organizationId: string,
  meetingId: string,
  outputId: string
): Promise<MeetingOutputRecord | null> {
  const result = await db.query<OutputRow>(
    `SELECT ${OUTPUT_SELECT_COLUMNS} FROM meeting_outputs
     WHERE id = $1 AND meeting_id = $2 AND organization_id = $3 LIMIT 1`,
    [outputId, meetingId, organizationId]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

export async function listOutputRows(
  db: PgExecutor,
  organizationId: string,
  meetingId: string
): Promise<MeetingOutputRecord[]> {
  const result = await db.query<OutputRow>(
    `SELECT ${OUTPUT_SELECT_COLUMNS} FROM meeting_outputs
     WHERE meeting_id = $1 AND organization_id = $2
     ORDER BY created_at ASC`,
    [meetingId, organizationId]
  );
  return result.rows.map(mapOutputRow);
}

export async function setOutputReviewedRow(
  db: PgExecutor,
  outputId: string,
  next: 'APPROVED' | 'REJECTED',
  reviewedBy: string
): Promise<MeetingOutputRecord> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs SET status = $1, reviewed_by = $2, reviewed_at = $3, updated_at = $3
     WHERE id = $4
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [next, reviewedBy, now, outputId]
  );
  return mapOutputRow(result.rows[0]);
}

/**
 * DEFEKT 2 fix: atomic "claim" for the materialize saga (see outputs.ts's
 * materializeOutput() for the full sequence). Before this existed, N
 * concurrent materializeOutput() calls on the same APPROVED output all read
 * the same status, all passed the in-app APPROVED/MATERIALIZATION_FAILED
 * check, and all ran the recovery lookup (findTaskBySource) before anyone
 * had created anything — so the lookup found nothing for every one of them
 * and every one proceeded to create its own target row. That lookup-before-
 * create sequence only ever protected SEQUENTIAL retries.
 *
 * This UPDATE closes that window the same way setMeetingLifecycleRow closes
 * Scenario 19: the WHERE clause (`status IN ('APPROVED',
 * 'MATERIALIZATION_FAILED')`) is checked and applied atomically by Postgres,
 * so only the first UPDATE to actually commit can flip the row into the
 * transient 'MATERIALIZING' status. Every other concurrent UPDATE on the
 * same row blocks on that row's lock, then — once released — re-checks this
 * same WHERE clause against the now-committed row (status is already
 * 'MATERIALIZING', which is in neither allowed value) and matches zero rows.
 *
 * Returns null (never throws) on a lost race — materializeOutput() treats
 * that as "someone else is already handling this" and reports a clear,
 * typed outcome to the loser instead of quietly duplicating the work; see
 * that function for exactly what the loser gets back.
 */
export async function markOutputMaterializingRow(
  db: PgExecutor,
  outputId: string
): Promise<MeetingOutputRecord | null> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs
     SET status = 'MATERIALIZING', updated_at = $1
     WHERE id = $2 AND status IN ('APPROVED', 'MATERIALIZATION_FAILED')
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [now, outputId]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

/**
 * Reconciliation finish-writes (DEFEKT 2 fix — see reconcileMaterializingOutput
 * in outputs.ts for the full sequence). These are the ONLY way a row ever
 * leaves the transient MATERIALIZING status that markOutputMaterializingRow
 * above puts it into — deliberately NOT by widening that function's
 * accepted-from set (which stays APPROVED | MATERIALIZATION_FAILED only, to
 * protect the concurrency fix from commit e51e57a4be), but as a separate,
 * explicit, human-gated operation with its own atomic guard.
 *
 * Both functions guard on `WHERE status = 'MATERIALIZING'` for the exact
 * same reason markOutputMaterializingRow guards on its own accepted set: two
 * concurrent reconcile attempts on the same row must not both apply. The
 * first UPDATE to commit wins the row lock and resolves the row; every other
 * concurrent UPDATE blocks, then re-checks this WHERE clause against the
 * now-resolved (MATERIALIZED or MATERIALIZATION_FAILED) row and matches zero
 * rows. Returns null (never throws) on a lost race — the caller in
 * outputs.ts re-reads and reports a clear, typed outcome instead of quietly
 * double-applying.
 */
export async function markOutputMaterializedFromMaterializingRow(
  db: PgExecutor,
  outputId: string,
  canonicalId: string
): Promise<MeetingOutputRecord | null> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs
     SET status = 'MATERIALIZED', canonical_id = $1, materialized_at = $2, failure_reason = NULL, updated_at = $2
     WHERE id = $3 AND status = 'MATERIALIZING'
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [canonicalId, now, outputId]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

export async function markOutputFailedFromMaterializingRow(
  db: PgExecutor,
  outputId: string,
  reason: string
): Promise<MeetingOutputRecord | null> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs
     SET status = 'MATERIALIZATION_FAILED', failure_reason = $1, updated_at = $2
     WHERE id = $3 AND status = 'MATERIALIZING'
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [reason, now, outputId]
  );
  return result.rows[0] ? mapOutputRow(result.rows[0]) : null;
}

export async function markOutputMaterializedRow(
  db: PgExecutor,
  outputId: string,
  canonicalId: string
): Promise<MeetingOutputRecord> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs
     SET status = 'MATERIALIZED', canonical_id = $1, materialized_at = $2, failure_reason = NULL, updated_at = $2
     WHERE id = $3
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [canonicalId, now, outputId]
  );
  return mapOutputRow(result.rows[0]);
}

export async function markOutputFailedRow(
  db: PgExecutor,
  outputId: string,
  reason: string
): Promise<MeetingOutputRecord> {
  const now = new Date().toISOString();
  const result = await db.query<OutputRow>(
    `UPDATE meeting_outputs
     SET status = 'MATERIALIZATION_FAILED', failure_reason = $1, updated_at = $2
     WHERE id = $3
     RETURNING ${OUTPUT_SELECT_COLUMNS}`,
    [reason, now, outputId]
  );
  return mapOutputRow(result.rows[0]);
}
