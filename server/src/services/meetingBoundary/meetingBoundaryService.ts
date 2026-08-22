/**
 * Lane C (closure) — MTG-BVP-001: Meeting boundary service.
 *
 * The ONE place `meeting.routes.ts` goes to turn an AI-generated meeting note
 * into a governed, human-approved "material" — instead of the old
 * `generate-notes` path that (a) discarded the note content once the HTTP
 * response was sent and (b) auto-persisted extracted decisions/action items
 * with `persist !== false` (i.e. default ON, no approval step). See
 * `server/migrations/20260912_claude_c_meeting_boundary.sql` for the schema
 * this is built on and WHY it exists.
 *
 * Governance itself (proposal / human-approval invariant / exactly-one
 * receipt) is NOT reimplemented here — it is delegated entirely to
 * `artifactHandoff/handoffSpineService.ts`, already built, migrated and
 * tested for exactly this purpose. This file only:
 *   1. durably stores the raw note content the instant it is generated
 *      (`meeting_notes`, with its own idempotency-guarded insert so a
 *      retried generate-notes call cannot create a second note row);
 *   2. proposes that note as a `targetKind: 'material'` handoff, using the
 *      SAME idempotency key for both the note row and the proposal so a
 *      replay is a replay at both layers;
 *   3. orchestrates approve/reject + materialize as ONE decision call, and
 *      mirrors the resulting state onto the note row for cheap reads.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: it never writes into
 * `meetings.decisions_json` / `meeting_follow_ups` (Meeting's legacy
 * read-only output tables; the mounted direct writers are retired) and it
 * NEVER writes into `tasks`, `decisions`, or `materials` (foreign owner
 * tables Lane C does not own the lifecycle of). Meeting PROPOSES; the
 * consuming lane decides what, if anything, gets materialized into its own
 * tables. See the "CROSS-LANE CONTRACT" note on `decideMeetingNote` below.
 *
 * ── WHY WRITES HERE USE `withPgTransaction`, NOT `DbPromise` ─────────────
 * Same reasoning as `handoffSpineService.ts`'s header: the note insert needs
 * a SAVEPOINT around a unique-index race (two concurrent/retried calls for
 * the SAME idempotency key), and `DbPromise.run`/`get` check out a
 * DIFFERENT pooled connection per call with a fallback:true default that
 * has previously masked failed writes (see CLAUDE.md session history —
 * M15/M09 acceptance findings). Plain reads that are not race-sensitive
 * (`getMeetingNote`, `listMeetingNotesForMeeting`) use `DbPromise` for
 * consistency with the rest of `meetingService.ts`.
 */

import { createHash, randomUUID } from 'crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  approveProposal,
  createProposal,
  type HandoffProposal,
  type HandoffReceipt,
  HandoffSpineError,
  materializeProposal,
  rejectProposal,
} from '../artifactHandoff/handoffSpineService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeetingNoteSource = 'ai' | 'heuristic';
export type MeetingNoteStatus = 'proposed' | 'approved' | 'rejected';

export interface MeetingNoteDecision {
  decision: string;
  decidedBy?: string;
  rationale?: string;
}

export interface MeetingNoteActionItem {
  task: string;
  owner?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface MeetingNoteRecord {
  id: string;
  organizationId: string;
  meetingId: string;
  source: MeetingNoteSource;
  language: string;
  transcriptHash: string;
  summary: string;
  keyPoints: string[];
  decisions: MeetingNoteDecision[];
  actionItems: MeetingNoteActionItem[];
  status: MeetingNoteStatus;
  proposalId: string | null;
  proposalState: 'pending' | 'approved' | 'rejected' | 'materialized' | 'failed' | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  receiptId: string | null;
  targetKind: string | null;
  targetRecordId: string | null;
  materializedAt: string | null;
  idempotencyKey: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteRow {
  id: string;
  organization_id: string;
  meeting_id: string;
  source: string;
  language: string;
  transcript_hash: string;
  summary: string;
  key_points_json: string;
  decisions_json: string;
  action_items_json: string;
  status: string;
  proposal_id: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  proposal_state?: string | null;
  decided_by?: string | null;
  decided_at?: Date | string | null;
  decision_reason?: string | null;
  receipt_id?: string | null;
  receipt_target_kind?: string | null;
  target_record_id?: string | null;
  materialized_at?: Date | string | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function parseJsonArray<T>(value: string): T[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapNoteRow(row: NoteRow): MeetingNoteRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    meetingId: row.meeting_id,
    source: row.source === 'ai' ? 'ai' : 'heuristic',
    language: row.language,
    transcriptHash: row.transcript_hash,
    summary: row.summary || '',
    keyPoints: parseJsonArray<string>(row.key_points_json),
    decisions: parseJsonArray<MeetingNoteDecision>(row.decisions_json),
    actionItems: parseJsonArray<MeetingNoteActionItem>(row.action_items_json),
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'proposed',
    proposalId: row.proposal_id,
    proposalState: ['pending', 'approved', 'rejected', 'materialized', 'failed'].includes(
      String(row.proposal_state)
    )
      ? (row.proposal_state as MeetingNoteRecord['proposalState'])
      : null,
    decidedBy: row.decided_by || null,
    decidedAt: row.decided_at ? toIso(row.decided_at) : null,
    decisionReason: row.decision_reason || null,
    receiptId: row.receipt_id || null,
    targetKind: row.receipt_target_kind || null,
    targetRecordId: row.target_record_id || null,
    materializedAt: row.materialized_at ? toIso(row.materialized_at) : null,
    idempotencyKey: row.idempotency_key,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

class MeetingBoundaryError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MeetingBoundaryError';
  }
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MeetingBoundaryError(`${field} is required`, 'INVALID_ARGUMENT');
  }
  return value;
}

interface PgDriverError {
  code?: string;
  constraint?: string;
}

/** Same idiom as `handoffSpineService.ts`'s `isUniqueViolationOn`. */
function isUniqueViolationOn(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const pgErr = err as PgDriverError;
  return pgErr.code === '23505' && pgErr.constraint === constraintName;
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

export async function ensureMeetingBoundaryTables(): Promise<void> {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id                 TEXT PRIMARY KEY,
      organization_id    TEXT NOT NULL,
      meeting_id         TEXT NOT NULL,
      source             TEXT NOT NULL DEFAULT 'heuristic',
      language           TEXT NOT NULL DEFAULT 'en',
      transcript_hash    TEXT NOT NULL,
      summary            TEXT NOT NULL DEFAULT '',
      key_points_json    TEXT NOT NULL DEFAULT '[]',
      decisions_json     TEXT NOT NULL DEFAULT '[]',
      action_items_json  TEXT NOT NULL DEFAULT '[]',
      status             TEXT NOT NULL DEFAULT 'proposed',
      proposal_id        TEXT,
      idempotency_key    TEXT,
      created_by         TEXT NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await dbRun(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_notes_org_meeting_idem
      ON meeting_notes (organization_id, meeting_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);
  await dbRun(`
    CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting
      ON meeting_notes (organization_id, meeting_id, created_at DESC)
  `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_meeting_notes_proposal ON meeting_notes (proposal_id)`
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getMeetingNote(input: {
  organizationId: string;
  meetingId: string;
  noteId: string;
}): Promise<MeetingNoteRecord | null> {
  await ensureMeetingBoundaryTables();
  const row = await dbGet<NoteRow>(
    `SELECT n.*,
            p.state AS proposal_state, p.decided_by, p.decided_at, p.decision_reason,
            r.receipt_id, r.target_kind AS receipt_target_kind,
            r.target_record_id, r.materialized_at
       FROM meeting_notes n
       LEFT JOIN artifact_handoff_proposals p
         ON p.proposal_id = n.proposal_id AND p.organization_id = n.organization_id
       LEFT JOIN artifact_handoff_receipts r
         ON r.proposal_id = n.proposal_id AND r.organization_id = n.organization_id
      WHERE n.id = ? AND n.organization_id = ? AND n.meeting_id = ? LIMIT 1`,
    [input.noteId, input.organizationId, input.meetingId]
  );
  return row ? mapNoteRow(row) : null;
}

export async function listMeetingNotesForMeeting(input: {
  organizationId: string;
  meetingId: string;
}): Promise<MeetingNoteRecord[]> {
  await ensureMeetingBoundaryTables();
  const rows = await dbAll<NoteRow>(
    `SELECT n.*,
            p.state AS proposal_state, p.decided_by, p.decided_at, p.decision_reason,
            r.receipt_id, r.target_kind AS receipt_target_kind,
            r.target_record_id, r.materialized_at
       FROM meeting_notes n
       LEFT JOIN artifact_handoff_proposals p
         ON p.proposal_id = n.proposal_id AND p.organization_id = n.organization_id
       LEFT JOIN artifact_handoff_receipts r
         ON r.proposal_id = n.proposal_id AND r.organization_id = n.organization_id
      WHERE n.organization_id = ? AND n.meeting_id = ?
      ORDER BY n.created_at DESC`,
    [input.organizationId, input.meetingId]
  );
  return (rows || []).map(mapNoteRow);
}

// ---------------------------------------------------------------------------
// proposeMeetingNote — durable storage + governed proposal, ONE call
// ---------------------------------------------------------------------------

const NOTE_IDEM_INDEX = 'idx_meeting_notes_org_meeting_idem';

export interface ProposeMeetingNoteInput {
  organizationId: string;
  meetingId: string;
  createdBy: string;
  source: MeetingNoteSource;
  language: string;
  transcript: string;
  summary: string;
  keyPoints: string[];
  decisions: MeetingNoteDecision[];
  actionItems: MeetingNoteActionItem[];
  /** Optional caller-supplied key. When omitted, a deterministic key is
   * derived from (meetingId, transcript hash, language) so an accidental
   * client retry of the SAME transcript is still deduplicated. */
  idempotencyKey?: string | null;
}

export interface ProposeMeetingNoteResult {
  note: MeetingNoteRecord;
  proposal: HandoffProposal;
  /** True if EITHER the note row OR the proposal already existed for this
   * idempotency key — i.e. this call did not create anything new. */
  replayed: boolean;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function proposeMeetingNote(
  input: ProposeMeetingNoteInput
): Promise<ProposeMeetingNoteResult> {
  await ensureMeetingBoundaryTables();
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const meetingId = requireNonEmpty(input.meetingId, 'meetingId');
  const createdBy = requireNonEmpty(input.createdBy, 'createdBy');
  const transcript = requireNonEmpty(input.transcript, 'transcript');
  const language = (input.language || 'en').trim() || 'en';
  const source: MeetingNoteSource = input.source === 'ai' ? 'ai' : 'heuristic';

  const transcriptHash = sha256Hex(transcript);
  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim()
      ? input.idempotencyKey.trim()
      : `${meetingId}:${transcriptHash}:${language}`;

  const summary = input.summary || '';
  const keyPointsJson = JSON.stringify(input.keyPoints || []);
  const decisionsJson = JSON.stringify(input.decisions || []);
  const actionItemsJson = JSON.stringify(input.actionItems || []);

  const { note, isNew } = await withPgTransaction(async (query) => {
    const noteId = `meeting-note-${randomUUID()}`;
    await query('SAVEPOINT meeting_note_insert');
    try {
      const inserted = await query<NoteRow>(
        `INSERT INTO meeting_notes (
           id, organization_id, meeting_id, source, language, transcript_hash,
           summary, key_points_json, decisions_json, action_items_json,
           status, proposal_id, idempotency_key, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'proposed', NULL, $11, $12, NOW(), NOW())
         RETURNING *`,
        [
          noteId,
          organizationId,
          meetingId,
          source,
          language,
          transcriptHash,
          summary,
          keyPointsJson,
          decisionsJson,
          actionItemsJson,
          idempotencyKey,
          createdBy,
        ]
      );
      return { note: mapNoteRow(inserted.rows[0]), isNew: true };
    } catch (err) {
      if (isUniqueViolationOn(err, NOTE_IDEM_INDEX)) {
        await query('ROLLBACK TO SAVEPOINT meeting_note_insert');
        const existing = await query<NoteRow>(
          `SELECT * FROM meeting_notes
             WHERE organization_id = $1 AND meeting_id = $2 AND idempotency_key = $3`,
          [organizationId, meetingId, idempotencyKey]
        );
        if (!existing.rows[0]) {
          // Unreachable in practice — the unique-violation proves a row
          // exists. Fail closed rather than fabricate a result.
          throw err;
        }
        const replay = mapNoteRow(existing.rows[0]);
        // The source text + language are the caller-owned request payload.
        // Generated fields may legitimately vary across an LLM retry, so the
        // first durable proposal stays authoritative for identical source.
        const changedPayload =
          replay.transcriptHash !== transcriptHash || replay.language !== language;
        if (changedPayload) {
          throw new MeetingBoundaryError(
            'idempotencyKey was already used with different meeting-note content',
            'IDEMPOTENCY_CONFLICT'
          );
        }
        return { note: replay, isNew: false };
      }
      throw err;
    }
  });

  // Proposal creation/lookup is delegated to the spine, which manages its
  // own transaction and its own idempotency dedup on the SAME key. This is
  // deliberately a SEPARATE transaction from the note insert above — see
  // the file header for the accepted tradeoff (a crash between the two
  // steps can leave an orphan note with no proposal_id; the idempotency key
  // makes a subsequent retry converge on the SAME note + a fresh proposal
  // attempt, never a duplicate).
  const { proposal, replayed: proposalReplayed } = await createProposal({
    organizationId,
    producerKind: 'meeting',
    producerRecordId: meetingId,
    targetKind: 'material',
    payload: {
      noteId: note.id,
      source,
      language,
      transcriptHash,
      summary,
      keyPoints: input.keyPoints || [],
      decisions: input.decisions || [],
      actionItems: input.actionItems || [],
    },
    createdBy,
    idempotencyKey,
  });

  let finalNote = note;
  if (note.proposalId !== proposal.proposalId) {
    finalNote = await withPgTransaction(async (query) => {
      const updated = await query<NoteRow>(
        `UPDATE meeting_notes SET proposal_id = $1, updated_at = NOW()
           WHERE id = $2 AND organization_id = $3
           RETURNING *`,
        [proposal.proposalId, note.id, organizationId]
      );
      return updated.rows[0] ? mapNoteRow(updated.rows[0]) : note;
    });
  }

  return { note: finalNote, proposal, replayed: !isNew || proposalReplayed };
}

/**
 * Read-only command replay probe used before note generation. It prevents a
 * network retry from invoking the AI provider again after the first durable
 * note+proposal already committed. An orphan note without a proposal is not a
 * completed replay and deliberately falls through to the normal convergence
 * path in `proposeMeetingNote`.
 */
export async function findMeetingNoteReplay(input: {
  organizationId: string;
  meetingId: string;
  transcript: string;
  language?: string;
  idempotencyKey?: string | null;
}): Promise<{ note: MeetingNoteRecord; proposal: HandoffProposal } | null> {
  await ensureMeetingBoundaryTables();
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const meetingId = requireNonEmpty(input.meetingId, 'meetingId');
  const transcript = requireNonEmpty(input.transcript, 'transcript');
  const language = (input.language || 'en').trim() || 'en';
  const transcriptHash = sha256Hex(transcript);
  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim()
      ? input.idempotencyKey.trim()
      : `${meetingId}:${transcriptHash}:${language}`;
  const note = await withPgTransaction(async (query) => {
    const existing = await query<NoteRow>(
      `SELECT * FROM meeting_notes
         WHERE organization_id = $1 AND meeting_id = $2 AND idempotency_key = $3`,
      [organizationId, meetingId, idempotencyKey]
    );
    return existing.rows[0] ? mapNoteRow(existing.rows[0]) : null;
  });
  if (!note) return null;
  if (note.transcriptHash !== transcriptHash || note.language !== language) {
    throw new MeetingBoundaryError(
      'idempotencyKey was already used with different meeting-note content',
      'IDEMPOTENCY_CONFLICT'
    );
  }
  if (!note.proposalId) return null;
  return { note, proposal: await readHandoffProposal(organizationId, note.proposalId) };
}

// ---------------------------------------------------------------------------
// decideMeetingNote — human approve/reject, then exactly-one materialize
// ---------------------------------------------------------------------------

export interface DecideMeetingNoteInput {
  organizationId: string;
  meetingId: string;
  noteId: string;
  decidedBy: string;
  action: 'approve' | 'reject';
  reason?: string | null;
}

export interface DecideMeetingNoteResult {
  note: MeetingNoteRecord;
  proposal: HandoffProposal;
  /** Present only when `action === 'approve'` — the exactly-one materialize
   * receipt. `null` for a reject decision (nothing is materialized). */
  receipt: HandoffReceipt | null;
  replayed: boolean;
}

/**
 * CROSS-LANE CONTRACT: on approval this materializes the note itself as the
 * ONE governed "material" output (`targetKind: 'material'`,
 * `targetRecordId: note.id` — the note row IS the produced artifact; its
 * `status` flips to 'approved' and it becomes the durable, approved minutes
 * record). The decisions/action items carried inside the note's payload are
 * NOT separately materialized into `tasks`/`decisions` — those target kinds
 * do not exist in `handoffSpineService`'s `TARGET_KINDS`, and Lane C does
 * not own that lifecycle (see `handoffSpineService.ts` + the migration
 * header). A consumer that wants to turn an approved note's decisions/action
 * items into real task/decision rows reads the approved
 * `artifact_handoff_proposals` row (`payload_json`) and its
 * `artifact_handoff_receipts` row via `producer_kind = 'meeting'` and does
 * so in ITS OWN service, under ITS OWN governance — this function
 * deliberately stops at "approved + materialized as a meeting material".
 */
export async function decideMeetingNote(
  input: DecideMeetingNoteInput
): Promise<DecideMeetingNoteResult | null> {
  await ensureMeetingBoundaryTables();
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const meetingId = requireNonEmpty(input.meetingId, 'meetingId');
  const noteId = requireNonEmpty(input.noteId, 'noteId');
  const decidedBy = requireNonEmpty(input.decidedBy, 'decidedBy');

  const note = await getMeetingNote({ organizationId, meetingId, noteId });
  if (!note || !note.proposalId) return null;

  if (input.action === 'reject') {
    const proposal = await rejectProposal({
      organizationId,
      proposalId: note.proposalId,
      decidedBy,
      reason: input.reason,
    });
    const updated = await setNoteStatus(note.id, organizationId, 'rejected');
    return { note: updated || note, proposal, receipt: null, replayed: false };
  }

  // approve + materialize as ONE call. A SECOND (sequential, or losing side
  // of a concurrent race) call for the SAME note reaches this with the
  // proposal ALREADY 'materialized' — past 'approved' — so `approveProposal`
  // itself throws INVALID_STATE_TRANSITION (its CAS only treats "already in
  // the TARGET state" as an idempotent replay, and the target state here is
  // 'approved', not 'materialized'). That is expected, not an error: the
  // idempotent replay for "approve a note that is already fully decided"
  // is `materializeProposal`'s OWN replay branch below (state ===
  // 'materialized' -> return the existing receipt), so this swallows ONLY
  // that specific transition and lets `materializeProposal` decide the
  // outcome — any other rejection (e.g. the proposal was already REJECTED)
  // still surfaces from `approveProposal` untouched.
  try {
    await approveProposal({
      organizationId,
      proposalId: note.proposalId,
      decidedBy,
      reason: input.reason,
    });
  } catch (err) {
    if (!(err instanceof HandoffSpineError && err.code === 'INVALID_STATE_TRANSITION')) {
      throw err;
    }
  }
  const { receipt, replayed } = await materializeProposal({
    organizationId,
    proposalId: note.proposalId,
    targetRecordId: note.id,
    materializedBy: decidedBy,
    outputPayload: {
      noteId: note.id,
      summary: note.summary,
      keyPoints: note.keyPoints,
      decisions: note.decisions,
      actionItems: note.actionItems,
    },
  });
  // Read the proposal fresh rather than trust `approveProposal`'s return
  // value: on the replay path above it may not have been called at all (or
  // may have thrown), and even on the happy path its result predates the
  // materialize call that just ran — the DB row is the only accurate source
  // for the FINAL state ('materialized').
  const proposal = await readHandoffProposal(organizationId, note.proposalId);
  const updated = await setNoteStatus(note.id, organizationId, 'approved');
  return { note: updated || note, proposal, receipt, replayed };
}

interface RawProposalRow {
  proposal_id: string;
  organization_id: string;
  producer_kind: string;
  producer_record_id: string;
  source_content_hash: string;
  source_version: number;
  contract_version: string;
  target_kind: string;
  payload_json: string;
  state: string;
  created_by: string;
  created_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_reason: string | null;
  self_approved: boolean;
  idempotency_key: string | null;
  updated_at: Date | string;
}

/**
 * Plain, read-only lookup against `artifact_handoff_proposals` — the spine
 * (`handoffSpineService.ts`, out of Lane C's editable-file set for this
 * task) exposes create/approve/reject/materialize but no bare getter, and
 * this file needs the FINAL post-materialize state, which none of those
 * calls return. Reads only; never writes through this path.
 */
async function readHandoffProposal(
  organizationId: string,
  proposalId: string
): Promise<HandoffProposal> {
  return withPgTransaction(async (query) => {
    const rows = await query<RawProposalRow>(
      `SELECT * FROM artifact_handoff_proposals WHERE proposal_id = $1 AND organization_id = $2`,
      [proposalId, organizationId]
    );
    const row = rows.rows[0];
    if (!row) {
      throw new MeetingBoundaryError('proposal not found', 'NOT_FOUND');
    }
    return {
      proposalId: row.proposal_id,
      organizationId: row.organization_id,
      producerKind: row.producer_kind as HandoffProposal['producerKind'],
      producerRecordId: row.producer_record_id,
      sourceContentHash: row.source_content_hash,
      sourceVersion: Number(row.source_version),
      contractVersion: row.contract_version,
      targetKind: row.target_kind as HandoffProposal['targetKind'],
      payload: (() => {
        try {
          return typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : null;
        } catch {
          return null;
        }
      })(),
      state: row.state as HandoffProposal['state'],
      createdBy: row.created_by,
      createdAt: toIso(row.created_at),
      decidedBy: row.decided_by,
      decidedAt: row.decided_at === null ? null : toIso(row.decided_at),
      decisionReason: row.decision_reason,
      selfApproved: Boolean(row.self_approved),
      idempotencyKey: row.idempotency_key,
      updatedAt: toIso(row.updated_at),
    };
  });
}

async function setNoteStatus(
  noteId: string,
  organizationId: string,
  status: MeetingNoteStatus
): Promise<MeetingNoteRecord | null> {
  return withPgTransaction(async (query) => {
    const updated = await query<NoteRow>(
      `UPDATE meeting_notes SET status = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3
         RETURNING *`,
      [status, noteId, organizationId]
    );
    return updated.rows[0] ? mapNoteRow(updated.rows[0]) : null;
  });
}

export { HandoffSpineError, MeetingBoundaryError };
