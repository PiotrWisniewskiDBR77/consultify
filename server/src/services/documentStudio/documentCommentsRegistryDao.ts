/**
 * Consultify Document Studio — Comments Registry DAO (W5 wave5 persistence).
 *
 * Replaces the in-memory `persistedCommentStore` Map in
 * `documentCommentsService.ts` with real Postgres reads/writes.
 * Backing table: `document_comments` (migration 776).
 *
 * Design contract (mirrors `documentEditorStateRegistryDao.ts`):
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `[]` on any error and does NOT throw.
 *   - Upsert on comment_id so resolve/reopen/delete mutations are durable.
 *   - Tenant safety: every query carries `organization_id` in WHERE.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { DocumentComment, DocumentCommentAnchor } from './documentStudioTypes.js';

interface CommentRow {
  comment_id: string;
  thread_id: string;
  artifact_id: string;
  organization_id: string;
  parent_comment_id?: string | null;
  anchor_json: unknown;
  author_id: string;
  body: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolve_reason?: string | null;
  reopened_by?: string | null;
  reopened_at?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function toIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToComment(row: CommentRow): DocumentComment | null {
  const anchor = parseJson<DocumentCommentAnchor | null>(row.anchor_json, null);
  if (!anchor) return null;
  return {
    commentId: row.comment_id,
    threadId: row.thread_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    parentCommentId: row.parent_comment_id ?? undefined,
    anchor,
    authorId: row.author_id,
    body: row.body,
    status: row.status as DocumentComment['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolveReason: row.resolve_reason ?? undefined,
    reopenedBy: row.reopened_by ?? undefined,
    reopenedAt: row.reopened_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/**
 * Load all comments for a given organization. Used by the service's
 * cold-start hydration pass (once per org, lazy).
 */
export async function loadCommentsForOrg(organizationId: string): Promise<DocumentComment[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<CommentRow>(
      `SELECT * FROM document_comments
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToComment).filter((c): c is DocumentComment => c !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][CommentsDao] loadCommentsForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Upsert a comment. All mutable fields (status, body, resolved_*, reopened_*,
 * deleted_*) are updated on conflict so that resolve/reopen/soft-delete
 * mutations are durable after the first insert.
 */
export async function persistComment(comment: DocumentComment): Promise<{ ok: boolean }> {
  if (!comment?.commentId || !comment.artifactId || !comment.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_comments (
         comment_id, thread_id, artifact_id, organization_id, parent_comment_id,
         anchor_json, author_id, body, status, created_at, updated_at,
         resolved_by, resolved_at, resolve_reason,
         reopened_by, reopened_at, deleted_by, deleted_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6::jsonb, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18
       )
       ON CONFLICT (comment_id) DO UPDATE SET
         body          = EXCLUDED.body,
         status        = EXCLUDED.status,
         updated_at    = EXCLUDED.updated_at,
         resolved_by   = EXCLUDED.resolved_by,
         resolved_at   = EXCLUDED.resolved_at,
         resolve_reason = EXCLUDED.resolve_reason,
         reopened_by   = EXCLUDED.reopened_by,
         reopened_at   = EXCLUDED.reopened_at,
         deleted_by    = EXCLUDED.deleted_by,
         deleted_at    = EXCLUDED.deleted_at`,
      [
        comment.commentId,
        comment.threadId,
        comment.artifactId,
        comment.organizationId,
        comment.parentCommentId ?? null,
        JSON.stringify(comment.anchor),
        comment.authorId,
        comment.body,
        comment.status,
        comment.createdAt,
        comment.updatedAt,
        comment.resolvedBy ?? null,
        comment.resolvedAt ?? null,
        comment.resolveReason ?? null,
        comment.reopenedBy ?? null,
        comment.reopenedAt ?? null,
        comment.deletedBy ?? null,
        comment.deletedAt ?? null,
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][CommentsDao] persistComment failed', {
      commentId: comment.commentId,
      organizationId: comment.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}
