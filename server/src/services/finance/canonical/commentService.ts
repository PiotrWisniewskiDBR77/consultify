/**
 * Finance v3 canonical — AP-06 comments / review threads / assignments.
 *
 * Gate D, AP-06. Wraps `finance_comments` / `finance_comment_assignments`
 * (migration `20260809_finance_v3_d_ap06_comments_01_tables.sql`), per
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 6 ("komentarz do artefaktu/KPI/linii/komorki/okresu,
 * mentions, assign, resolve/reopen, blocking flag i review checklist").
 *
 * `finance_review_checklists` is a separate concern (item-per-business-
 * version, no anchor/threading) and lives in `reviewChecklistService.ts`,
 * not here.
 *
 * `anchor` reuses AP-00's `CellRef` (server/src/types/finance/CellRef.ts)
 * verbatim as the JSON payload — `null` means an artifact-level comment; see
 * the migration file header for why a KPI-specific anchor kind is
 * deliberately not modeled yet.
 *
 * Blocking comments: `is_blocking=true` + `resolved_at IS NULL` on a
 * `business_version_id` makes `artifactVersionService.approveVersion()`
 * reject with `APPROVAL_BLOCKED` (see that function's step (a3b) — the same
 * table this service writes to, read directly, no dependency on this file).
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { CellRefSchema, type CellRef } from '../../../types/finance/CellRef.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface FinanceCommentRow {
  id: string;
  organization_id: string;
  artifact_id: string;
  business_version_id: string;
  anchor: CellRef | null;
  author_id: string;
  body: string;
  mentions: string[];
  is_blocking: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceCommentAssignmentRow {
  id: string;
  comment_id: string;
  organization_id: string;
  assignee_id: string;
  due_date: string | null;
  assigned_by: string;
  assigned_at: string;
}

// node-pg returns JSONB columns already parsed and TEXT[] columns already as
// JS arrays; this helper just narrows the type at the boundary in case a
// caller reads the row from a raw `SELECT *` where `anchor` came back as a
// string (defensive — has never been observed against a real pg driver, but
// costs nothing here and matches the caution `exceptionLedgerService.ts`
// applies to its own JSONB `source_ref`/`evidence` columns).
function normalizeCommentRow(row: FinanceCommentRow): FinanceCommentRow {
  if (row && typeof row.anchor === 'string') {
    try {
      row.anchor = JSON.parse(row.anchor);
    } catch {
      /* leave as-is; caller sees the raw string if parsing ever fails */
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export interface CreateCommentParams {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  /** `null`/omitted = artifact-level comment. Non-null must be a valid CellRef (AP-00). */
  anchor?: CellRef | null;
  authorId: string;
  body: string;
  mentions?: readonly string[];
  isBlocking?: boolean;
}

export type CreateCommentResult =
  | { ok: true; comment: FinanceCommentRow }
  | { ok: false; code: 'BODY_REQUIRED' | 'INVALID_ANCHOR'; message: string };

export async function createComment(params: CreateCommentParams): Promise<CreateCommentResult> {
  if (!params.body || !params.body.trim()) {
    return { ok: false, code: 'BODY_REQUIRED', message: 'Comment body must be non-empty' };
  }
  let anchor: CellRef | null = null;
  if (params.anchor != null) {
    const parsed = CellRefSchema.safeParse(params.anchor);
    if (!parsed.success) {
      return { ok: false, code: 'INVALID_ANCHOR', message: `anchor is not a valid CellRef: ${parsed.error.message}` };
    }
    anchor = parsed.data;
  }

  const id = uuidv4();
  const comment = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceCommentRow>(
      `INSERT INTO finance_comments (
         id, organization_id, artifact_id, business_version_id, anchor,
         author_id, body, mentions, is_blocking, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        id,
        params.organizationId,
        params.artifactId,
        params.businessVersionId,
        anchor ? JSON.stringify(anchor) : null,
        params.authorId,
        params.body,
        Array.from(params.mentions ?? []),
        params.isBlocking ?? false,
        params.authorId,
      ]
    )
  );
  if (!comment) throw new Error('finance_comments insert returned no row');
  return { ok: true, comment: normalizeCommentRow(comment) };
}

// ---------------------------------------------------------------------------
// resolve / reopen
// ---------------------------------------------------------------------------

export type ResolveCommentResult =
  | { ok: true; comment: FinanceCommentRow }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_RESOLVED'; message: string };

export async function resolveComment(
  organizationId: string,
  commentId: string,
  resolvedBy: string
): Promise<ResolveCommentResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceCommentRow>(
      `SELECT * FROM finance_comments WHERE id = ? AND organization_id = ?`,
      [commentId, organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Comment not found' };
    if (current.resolved_at) return { ok: false, code: 'ALREADY_RESOLVED', message: 'Comment is already resolved' };

    const updated = await tx.queryOne<FinanceCommentRow>(
      `UPDATE finance_comments SET resolved_by = ?, resolved_at = now()
        WHERE id = ? AND organization_id = ? RETURNING *`,
      [resolvedBy, commentId, organizationId]
    );
    if (!updated) throw new Error('finance_comments resolve update returned no row');
    return { ok: true, comment: normalizeCommentRow(updated) };
  });
}

export type ReopenCommentResult =
  | { ok: true; comment: FinanceCommentRow }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_RESOLVED'; message: string };

/** Clears resolved_by/resolved_at, putting the comment back into the "open" state (unresolved_at IS NULL). */
export async function reopenComment(organizationId: string, commentId: string): Promise<ReopenCommentResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceCommentRow>(
      `SELECT * FROM finance_comments WHERE id = ? AND organization_id = ?`,
      [commentId, organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Comment not found' };
    if (!current.resolved_at) return { ok: false, code: 'NOT_RESOLVED', message: 'Comment is not resolved' };

    const updated = await tx.queryOne<FinanceCommentRow>(
      `UPDATE finance_comments SET resolved_by = NULL, resolved_at = NULL
        WHERE id = ? AND organization_id = ? RETURNING *`,
      [commentId, organizationId]
    );
    if (!updated) throw new Error('finance_comments reopen update returned no row');
    return { ok: true, comment: normalizeCommentRow(updated) };
  });
}

// ---------------------------------------------------------------------------
// assign
// ---------------------------------------------------------------------------

export interface AssignCommentParams {
  organizationId: string;
  commentId: string;
  assigneeId: string;
  assignedBy: string;
  dueDate?: string | null; // 'YYYY-MM-DD'
}

export type AssignCommentResult =
  | { ok: true; assignment: FinanceCommentAssignmentRow }
  | { ok: false; code: 'NOT_FOUND'; message: string };

/** Every call INSERTs a new row (append semantics — see migration file header); the latest row by assigned_at is the current assignee. */
export async function assignComment(params: AssignCommentParams): Promise<AssignCommentResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const comment = await tx.queryOne<{ id: string }>(
      `SELECT id FROM finance_comments WHERE id = ? AND organization_id = ?`,
      [params.commentId, params.organizationId]
    );
    if (!comment) return { ok: false, code: 'NOT_FOUND', message: 'Comment not found' };

    const assignment = await tx.queryOne<FinanceCommentAssignmentRow>(
      `INSERT INTO finance_comment_assignments (
         id, comment_id, organization_id, assignee_id, due_date, assigned_by
       ) VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [uuidv4(), params.commentId, params.organizationId, params.assigneeId, params.dueDate ?? null, params.assignedBy]
    );
    if (!assignment) throw new Error('finance_comment_assignments insert returned no row');
    return { ok: true, assignment };
  });
}

export async function getCurrentAssignment(
  organizationId: string,
  commentId: string
): Promise<FinanceCommentAssignmentRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceCommentAssignmentRow>(
      `SELECT * FROM finance_comment_assignments
        WHERE organization_id = ? AND comment_id = ?
        ORDER BY assigned_at DESC LIMIT 1`,
      [organizationId, commentId]
    )
  );
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

export async function getComment(organizationId: string, commentId: string): Promise<FinanceCommentRow | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceCommentRow>(`SELECT * FROM finance_comments WHERE id = ? AND organization_id = ?`, [
      commentId,
      organizationId,
    ])
  );
  return row ? normalizeCommentRow(row) : null;
}

export interface ListCommentsOptions {
  /** Only unresolved (resolved_at IS NULL) rows. */
  unresolvedOnly?: boolean;
  /** Only is_blocking=true rows. */
  blockingOnly?: boolean;
}

function buildListFilters(opts: ListCommentsOptions | undefined, startIndex: number): { clause: string; extra: unknown[] } {
  const clauses: string[] = [];
  if (opts?.unresolvedOnly) clauses.push('resolved_at IS NULL');
  if (opts?.blockingOnly) clauses.push('is_blocking = true');
  void startIndex; // reserved for callers that need positional param offsets; unused today (no param-bearing filters yet)
  return { clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', extra: [] };
}

export async function listByArtifact(
  organizationId: string,
  artifactId: string,
  opts?: ListCommentsOptions
): Promise<FinanceCommentRow[]> {
  const { clause } = buildListFilters(opts, 0);
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceCommentRow>(
      `SELECT * FROM finance_comments WHERE organization_id = ? AND artifact_id = ?${clause} ORDER BY created_at DESC`,
      [organizationId, artifactId]
    )
  );
  return rows.map(normalizeCommentRow);
}

export async function listByBusinessVersion(
  organizationId: string,
  businessVersionId: string,
  opts?: ListCommentsOptions
): Promise<FinanceCommentRow[]> {
  const { clause } = buildListFilters(opts, 0);
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceCommentRow>(
      `SELECT * FROM finance_comments WHERE organization_id = ? AND business_version_id = ?${clause} ORDER BY created_at DESC`,
      [organizationId, businessVersionId]
    )
  );
  return rows.map(normalizeCommentRow);
}

/** Comments anchored to a specific cell — exact-match containment on the CellRef JSON (row+column+table+version). */
export async function listByCell(organizationId: string, businessVersionId: string, cellRef: CellRef): Promise<FinanceCommentRow[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceCommentRow>(
      `SELECT * FROM finance_comments
        WHERE organization_id = ? AND business_version_id = ? AND anchor @> ?::jsonb
        ORDER BY created_at DESC`,
      [organizationId, businessVersionId, JSON.stringify(cellRef)]
    )
  );
  return rows.map(normalizeCommentRow);
}

export async function listMentioning(organizationId: string, userId: string): Promise<FinanceCommentRow[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceCommentRow>(
      `SELECT * FROM finance_comments WHERE organization_id = ? AND ? = ANY(mentions) ORDER BY created_at DESC`,
      [organizationId, userId]
    )
  );
  return rows.map(normalizeCommentRow);
}

/**
 * Same predicate `artifactVersionService.approveVersion()` step (a3b) runs.
 * Exposed here so callers (UI "can I approve?" preflight, tests) can ask the
 * same question without duplicating SQL — approveVersion() itself does NOT
 * call this function (it inlines the identical query inside its own
 * transaction, same reasoning as why it does not call
 * `exceptionLedgerService` for the SECURITY-exception check either: the
 * check must run on the SAME pinned connection/transaction as the rest of
 * the atomic approve, not a separate round-trip).
 */
export async function hasUnresolvedBlockingComments(organizationId: string, businessVersionId: string): Promise<boolean> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ id: string }>(
      `SELECT id FROM finance_comments
        WHERE organization_id = ? AND business_version_id = ? AND is_blocking = true AND resolved_at IS NULL
        LIMIT 1`,
      [organizationId, businessVersionId]
    )
  );
  return !!row;
}
