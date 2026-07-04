/**
 * Table Platform Record Comment Service
 * CRUD for threaded comments on individual records.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import notificationInboxService from './NotificationInboxService.js';

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

      // Fan out 'mention' notifications to mentioned users (excluding the
      // author). Best-effort: a notification failure never fails the comment.
      if (mentionPayload.length > 0) {
        void this.notifyMentions(recordId, tableId, authorId, mentionPayload).catch((err) => {
          logger.warn('[RecordCommentService] notifyMentions failed', {
            recordId,
            error: (err as Error).message,
          });
        });
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

  /**
   * Insert 'mention' inbox rows for each mentioned user (excluding the author).
   * Resolves org_id + base_id from the table. Best-effort; swallows errors.
   */
  async notifyMentions(
    recordId: string,
    tableId: string,
    authorId: string,
    mentions: string[]
  ): Promise<void> {
    const db = getDatabase();
    let orgId: string | null = null;
    let baseId: string | null = null;
    try {
      const ctx = await db.query(
        `SELECT b.organization_id AS org_id, t.base_id AS base_id
         FROM tp_tables t
         JOIN tp_bases b ON b.id = t.base_id
         WHERE t.id = $1`,
        [tableId]
      );
      const row = ctx.rows[0] as { org_id?: string; base_id?: string } | undefined;
      orgId = row?.org_id ?? null;
      baseId = row?.base_id ?? null;
    } catch (e) {
      logger.warn('[RecordCommentService] failed to resolve org/base for mention', {
        recordId,
        tableId,
        error: (e as Error).message,
      });
    }
    if (!orgId) return;

    const seen = new Set<string>();
    for (const mention of mentions) {
      const userId = String(mention).trim();
      if (!userId || userId === authorId || seen.has(userId)) continue;
      seen.add(userId);
      await notificationInboxService.create({
        orgId,
        userId,
        type: 'mention',
        baseId,
        tableId,
        recordId,
        payload: { actorId: authorId },
      });
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
