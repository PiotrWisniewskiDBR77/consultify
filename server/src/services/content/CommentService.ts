import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase, RunResult } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';
import { flagOn } from '../../utils/pgFlags.js';

export interface CommentRecord {
  id: string;
  content_id: string;
  content_type: string;
  user_id: string;
  comment_text: string;
  parent_comment_id?: string | null;
  thread_id: string;
  position_ref?: string | null;
  mentioned_user_ids?: string | null;
  is_resolved: number;
  resolved_by?: string | null;
  resolved_at?: string | null;
  is_edited: number;
  edited_at?: string | null;
  created_at?: string;
  updated_at?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  contentId: string;
  contentType: string;
  userId: string;
  commentText: string;
  parentCommentId?: string | null;
  threadId: string;
  positionRef?: string | null;
  mentionedUserIds: string[];
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  isEdited: boolean;
  editedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  } | null;
  replies?: Comment[];
}

export interface CreateCommentData {
  contentId: string;
  contentType: string;
  userId: string;
  commentText: string;
  parentCommentId?: string | null;
  positionRef?: string | null;
  mentionedUserIds?: string[];
}

export interface GetContentCommentsOptions {
  includeResolved?: boolean;
}

export interface CommentServiceDependencies {
  db: IDatabase;
  uuidv4: () => string;
}

export class CommentService {
  private deps: CommentServiceDependencies;

  constructor(deps?: Partial<CommentServiceDependencies>) {
    this.deps = {
      db: deps?.db ?? getDatabase(),
      uuidv4: deps?.uuidv4 ?? uuidv4,
    };
  }

  private _isMissingCommentsTableError(error: unknown): boolean {
    const message = String((error as any)?.message || error || '').toLowerCase();
    const code = String((error as any)?.code || '');
    return (
      code === '42P01' ||
      message.includes('relation "content_comments" does not exist') ||
      message.includes('no such table: content_comments')
    );
  }

  private _commentsUnavailableError(): Error {
    const err = new Error('Content comments are not available in this environment yet.');
    (err as any).code = 'CONTENT_COMMENTS_UNAVAILABLE';
    (err as any).statusCode = 503;
    return err;
  }

  async createComment(data: CreateCommentData): Promise<Comment> {
    const {
      contentId,
      contentType,
      userId,
      commentText,
      parentCommentId = null,
      positionRef = null,
      mentionedUserIds = [],
    } = data;

    if (!contentId || !contentType || !userId || !commentText) {
      throw new Error('contentId, contentType, userId, and commentText are required');
    }

    const id = `cmt-${this.deps.uuidv4()}`;
    const now = new Date().toISOString();

    let threadId = id;
    if (parentCommentId) {
      const parent = await this.getCommentById(parentCommentId);
      threadId = parent?.threadId || parentCommentId;
    }

    try {
      await this.deps.db.run(
        `INSERT INTO content_comments (
                  id, content_id, content_type, user_id, comment_text,
                  parent_comment_id, thread_id, position_ref, mentioned_user_ids,
                  is_resolved, is_edited, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        [
          id,
          contentId,
          contentType,
          userId,
          commentText,
          parentCommentId,
          threadId,
          positionRef,
          JSON.stringify(mentionedUserIds),
          now,
          now,
        ]
      );
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        logger.warn('[CommentService] content_comments table missing; create rejected gracefully', {
          contentId,
          contentType,
        });
        throw this._commentsUnavailableError();
      }
      throw error;
    }

    // Fetch to return complete object including user details if available
    const created = await this.getCommentById(id);
    if (!created) {
      // Fallback if fetch fails (unlikely)
      return {
        id,
        contentId,
        contentType,
        userId,
        commentText,
        parentCommentId,
        threadId,
        positionRef,
        mentionedUserIds,
        isResolved: false,
        resolvedBy: null,
        resolvedAt: null,
        isEdited: false,
        editedAt: null,
        createdAt: now,
        updatedAt: now,
        user: null, // Will be null as we just created it and might not have joined user info yet if not fetched
      };
    }
    return created;
  }

  async getCommentById(id: string): Promise<Comment | null> {
    let row: CommentRecord | null;
    try {
      row = (await this.deps.db.get<CommentRecord>(
        `SELECT cc.*, u.first_name, u.last_name, u.avatar_url as avatar
               FROM content_comments cc
               LEFT JOIN users u ON cc.user_id = u.id
               WHERE cc.id = ?`,
        [id]
      )) as CommentRecord | null;
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        logger.warn('[CommentService] content_comments table missing; returning null comment', {
          id,
        });
        return null;
      }
      throw error;
    }

    if (!row) return null;
    return this._mapCommentRow(row);
  }

  async getContentComments(
    contentId: string,
    contentType: string,
    options: GetContentCommentsOptions = {}
  ): Promise<Comment[]> {
    const { includeResolved = true } = options;
    const conditions: string[] = ['cc.content_id = ?', 'cc.content_type = ?'];
    const params: unknown[] = [contentId, contentType];

    if (!includeResolved) {
      conditions.push('cc.is_resolved = 0');
    }

    let rows: CommentRecord[];
    try {
      rows = (await this.deps.db.all<CommentRecord>(
        `SELECT cc.*, u.first_name, u.last_name, u.avatar_url as avatar
               FROM content_comments cc
               LEFT JOIN users u ON cc.user_id = u.id
               WHERE ${conditions.join(' AND ')}
               ORDER BY cc.created_at ASC`,
        params
      )) as CommentRecord[];
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        logger.warn('[CommentService] content_comments table missing; returning empty comments', {
          contentId,
          contentType,
        });
        return [];
      }
      throw error;
    }

    const comments = (rows || []).map((row) => this._mapCommentRow(row));

    // Build threaded structure
    const rootComments = comments.filter((c) => !c.parentCommentId);
    const getReplies = (parentId: string): Comment[] => {
      return comments
        .filter((c) => c.parentCommentId === parentId)
        .map((c) => ({
          ...c,
          replies: getReplies(c.id),
        }));
    };

    return rootComments.map((c) => ({
      ...c,
      replies: getReplies(c.id),
    }));
  }

  async updateComment(id: string, commentText: string, userId: string): Promise<Comment> {
    const comment = await this.getCommentById(id);

    if (!comment) {
      throw new Error(`Comment ${id} not found`);
    }

    if (comment.userId !== userId) {
      throw new Error('Can only edit your own comments');
    }

    const now = new Date().toISOString();

    let result: RunResult;
    try {
      result = (await this.deps.db.run(
        `UPDATE content_comments SET comment_text = ?, is_edited = 1, edited_at = ?, updated_at = ? WHERE id = ?`,
        [commentText, now, now, id]
      )) as RunResult;
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        throw this._commentsUnavailableError();
      }
      throw error;
    }

    if (result.changes === 0) {
      throw new Error(`Comment ${id} not found`);
    }

    const updated = await this.getCommentById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated comment');
    }
    return updated;
  }

  async resolveComment(id: string, userId: string): Promise<Comment> {
    const now = new Date().toISOString();

    let result: RunResult;
    try {
      result = (await this.deps.db.run(
        `UPDATE content_comments SET is_resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
        [userId, now, now, id]
      )) as RunResult;
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        throw this._commentsUnavailableError();
      }
      throw error;
    }

    if (result.changes === 0) {
      throw new Error(`Comment ${id} not found`);
    }

    const updated = await this.getCommentById(id);
    if (!updated) {
      throw new Error('Failed to retrieve resolved comment');
    }
    return updated;
  }

  async deleteComment(id: string): Promise<boolean> {
    // Recursive deletion (or cascade via DB)
    // Since sqlite foreign key ON DELETE CASCADE is set for parent_comment_id in DDL?
    // Let's check DDL from 047_content_module_enterprise.sql
    // FOREIGN KEY (parent_comment_id) REFERENCES content_comments(id) ON DELETE CASCADE
    // Yes, so deleting parent deletes children.

    let result: RunResult;
    try {
      result = (await this.deps.db.run('DELETE FROM content_comments WHERE id = ?', [
        id,
      ])) as RunResult;
    } catch (error) {
      if (this._isMissingCommentsTableError(error)) {
        logger.warn(
          '[CommentService] content_comments table missing; delete treated as not found',
          {
            id,
          }
        );
        return false;
      }
      throw error;
    }
    return result.changes > 0;
  }

  private _mapCommentRow(row: CommentRecord): Comment {
    return {
      id: row.id,
      contentId: row.content_id,
      contentType: row.content_type,
      userId: row.user_id,
      commentText: row.comment_text,
      parentCommentId: row.parent_comment_id ?? null,
      threadId: row.thread_id,
      positionRef: row.position_ref ?? null,
      isResolved: flagOn(row.is_resolved),
      resolvedBy: row.resolved_by ?? null,
      resolvedAt: row.resolved_at ?? null,
      mentionedUserIds: row.mentioned_user_ids
        ? (JSON.parse(row.mentioned_user_ids) as string[])
        : [],
      isEdited: flagOn(row.is_edited),
      editedAt: row.edited_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: row.first_name
        ? {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name || '',
            avatar: row.avatar ?? null,
          }
        : null,
    };
  }
}
