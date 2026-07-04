/**
 * Table Platform Record Comment Service
 * CRUD for threaded comments on individual records.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { tablePlatformRealtime } from './RealtimeService.js';

export interface RecordComment {
  id: string;
  record_id: string;
  table_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  parent_id: string | null;
  mentions?: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resolve @mention tokens (each may be a raw user id, an email, or a
 * "First Last" display-name fragment — the FE mention picker currently
 * inserts the display name, see RowDetailPanel.tsx) to actual user ids,
 * scoped to the organization that owns `tableId` (tp_tables -> tp_bases ->
 * organization_id, the same join RealtimeService uses for org-gating).
 * Unresolvable tokens are silently dropped — never throws.
 */
async function resolveMentionUserIds(tableId: string, mentions: string[]): Promise<string[]> {
  if (mentions.length === 0) return [];
  const db = getDatabase();
  try {
    const orgRow = await db.query(
      `SELECT b.organization_id AS org_id
       FROM tp_tables t
       JOIN tp_bases b ON t.base_id = b.id
       WHERE t.id = $1`,
      [tableId]
    );
    const organizationId = (orgRow.rows[0] as { org_id?: string } | undefined)?.org_id;
    if (!organizationId) return [];

    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1`,
      [organizationId]
    );

    const members = result.rows as Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>;

    const resolved = new Set<string>();
    for (const raw of mentions) {
      const token = String(raw || '').trim();
      if (!token) continue;
      const lower = token.toLowerCase();
      const match = members.find((m) => {
        if (m.id === token) return true;
        if (m.email && m.email.toLowerCase() === lower) return true;
        const fullName = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim().toLowerCase();
        if (fullName && fullName === lower) return true;
        if (m.first_name && m.first_name.toLowerCase() === lower) return true;
        return false;
      });
      if (match) resolved.add(match.id);
    }
    return Array.from(resolved);
  } catch (e) {
    logger.warn('[RecordCommentService] resolveMentionUserIds failed (fail-soft)', {
      tableId,
      error: (e as Error).message,
    });
    return [];
  }
}

/**
 * Deliver @mention notifications: one tp_audit_events row per resolved
 * mentioned user (event_type='mention'), plus a realtime push to that user's
 * room. Fail-soft — a delivery failure must never affect the comment that
 * was already persisted.
 */
async function deliverMentionNotifications(
  recordId: string,
  tableId: string,
  authorId: string,
  authorName: string | null,
  commentId: string,
  content: string,
  mentionedUserIds: string[]
): Promise<void> {
  if (mentionedUserIds.length === 0) return;
  const db = getDatabase();
  for (const userId of mentionedUserIds) {
    if (userId === authorId) continue; // don't notify yourself
    try {
      const metadata = {
        table_id: tableId,
        notified_user: userId,
        comment_id: commentId,
        author_id: authorId,
        author_name: authorName,
        excerpt: content.slice(0, 280),
      };
      const inserted = await db.query(
        `INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, metadata, notified_user_id)
         VALUES ('mention', 'record', $1, $2, $3, $4)
         RETURNING id, created_at`,
        [recordId, authorId, JSON.stringify(metadata), userId]
      );

      try {
        const row = inserted.rows[0] as { id?: string; created_at?: string } | undefined;
        tablePlatformRealtime.notifyUser(userId, {
          id: row?.id,
          eventType: 'mention',
          entityType: 'record',
          entityId: recordId,
          actorId: authorId,
          metadata,
          createdAt: row?.created_at,
        });
      } catch (emitErr) {
        logger.warn('[RecordCommentService] mention realtime emit failed (notification saved)', {
          recordId,
          userId,
          error: (emitErr as Error).message,
        });
      }
    } catch (notifyErr) {
      logger.warn('[RecordCommentService] failed to create mention notification', {
        recordId,
        userId,
        error: (notifyErr as Error).message,
      });
    }
  }
}

const recordCommentService = {
  async addComment(
    recordId: string,
    tableId: string,
    authorId: string,
    authorName: string | undefined,
    content: string,
    parentId?: string,
    mentions?: string[]
  ): Promise<RecordComment> {
    const db = getDatabase();
    try {
      const mentionPayload = Array.isArray(mentions) && mentions.length > 0 ? mentions : [];
      const result = await db.query(
        `INSERT INTO tp_record_comments (record_id, table_id, author_id, author_name, content, parent_id, mentions)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          recordId,
          tableId,
          authorId,
          authorName ?? null,
          content,
          parentId ?? null,
          JSON.stringify(mentionPayload),
        ]
      );
      const comment = result.rows[0] as RecordComment;

      // @mention delivery — fail-soft (own try/catch below), awaited so the
      // notification row is guaranteed to exist by the time addComment
      // resolves. Never throws: a delivery failure never invalidates the
      // comment write above, which already succeeded by this point.
      if (mentionPayload.length > 0) {
        try {
          const userIds = await resolveMentionUserIds(tableId, mentionPayload);
          await deliverMentionNotifications(
            recordId,
            tableId,
            authorId,
            authorName ?? null,
            comment.id,
            content,
            userIds
          );
        } catch (err) {
          logger.warn('[RecordCommentService] mention delivery failed', {
            recordId,
            error: (err as Error).message,
          });
        }
      }

      return comment;
    } catch (e) {
      logger.error('[RecordCommentService] addComment failed', {
        recordId,
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listComments(
    recordId: string,
    limit = 50,
    offset = 0
  ): Promise<{ comments: RecordComment[]; total: number }> {
    const db = getDatabase();
    try {
      const countResult = await db.query(
        'SELECT COUNT(*) AS total FROM tp_record_comments WHERE record_id = $1',
        [recordId]
      );
      const total = parseInt(String((countResult.rows[0] as any).total), 10);

      const result = await db.query(
        `SELECT * FROM tp_record_comments
         WHERE record_id = $1
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3`,
        [recordId, limit, offset]
      );
      return { comments: result.rows as RecordComment[], total };
    } catch (e) {
      logger.error('[RecordCommentService] listComments failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updateComment(
    commentId: string,
    authorId: string,
    content: string
  ): Promise<RecordComment | null> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `UPDATE tp_record_comments
         SET content = $2, updated_at = NOW()
         WHERE id = $1 AND author_id = $3
         RETURNING *`,
        [commentId, content, authorId]
      );
      return (result.rows[0] as RecordComment) ?? null;
    } catch (e) {
      logger.error('[RecordCommentService] updateComment failed', {
        commentId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteComment(commentId: string, authorId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'DELETE FROM tp_record_comments WHERE id = $1 AND author_id = $2',
        [commentId, authorId]
      );
      return (result as any).rowCount > 0;
    } catch (e) {
      logger.error('[RecordCommentService] deleteComment failed', {
        commentId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getCommentCount(recordId: string): Promise<number> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT COUNT(*) AS cnt FROM tp_record_comments WHERE record_id = $1',
        [recordId]
      );
      return parseInt(String((result.rows[0] as any).cnt), 10);
    } catch (e) {
      logger.error('[RecordCommentService] getCommentCount failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default recordCommentService;
