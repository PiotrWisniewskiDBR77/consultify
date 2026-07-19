/**
 * Report Builder Comments Service
 *
 * Handles comment CRUD, threading, and status management for report review workflow.
 * Provides gate check functions for workflow transitions.
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type CommentType =
  | 'FEEDBACK'
  | 'SUGGESTION'
  | 'QUESTION'
  | 'APPROVAL'
  | 'REJECTION'
  | 'CHANGE_REQUEST';
export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'WONT_FIX';
export type CommentPriority = 'low' | 'normal' | 'high' | 'critical';
export type AnchorType = 'section' | 'fragment';

export interface CommentAnchor {
  type: AnchorType;
  rangeStart?: number;
  rangeEnd?: number;
  quote?: string;
  contentHash?: string;
}

export interface CommentRecord {
  id: string;
  reportId: string;
  sectionKey: string | null;
  anchorType: AnchorType;
  rangeStart: number | null;
  rangeEnd: number | null;
  quote: string | null;
  contentHash: string | null;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  commentType: CommentType;
  content: string;
  aiResponse: string | null;
  aiSuggestedEdits: string[] | null;
  aiProcessedAt: string | null;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  parentCommentId: string | null;
  threadPosition: number;
  priority: CommentPriority;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentParams {
  reportId: string;
  sectionKey?: string;
  anchor?: CommentAnchor;
  userId: string;
  userName?: string;
  userAvatar?: string;
  commentType?: CommentType;
  content: string;
  parentCommentId?: string;
  priority?: CommentPriority;
  tags?: string[];
}

export interface UpdateCommentParams {
  content?: string;
  commentType?: CommentType;
  status?: CommentStatus;
  resolvedBy?: string;
  resolutionNotes?: string;
  priority?: CommentPriority;
  tags?: string[];
  aiResponse?: string;
  aiSuggestedEdits?: string[];
}

export interface CommentFilters {
  sectionKey?: string;
  status?: CommentStatus | CommentStatus[];
  commentType?: CommentType;
  userId?: string;
  parentOnly?: boolean;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

const db: IDatabase = getDatabase();

function queryRun(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastID?: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number; lastID?: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function mapRowToComment(row: any): CommentRecord {
  return {
    id: row.id,
    reportId: row.report_id,
    sectionKey: row.section_key,
    anchorType: row.anchor_type || 'section',
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    quote: row.quote,
    contentHash: row.content_hash,
    userId: row.user_id,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    commentType: row.comment_type || 'FEEDBACK',
    content: row.content,
    aiResponse: row.ai_response,
    aiSuggestedEdits: row.ai_suggested_edits ? JSON.parse(row.ai_suggested_edits) : null,
    aiProcessedAt: row.ai_processed_at,
    status: row.status || 'OPEN',
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    parentCommentId: row.parent_comment_id,
    threadPosition: row.thread_position || 0,
    priority: row.priority || 'normal',
    tags: row.tags ? JSON.parse(row.tags) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// ACTIVITY LOGGING
// ==========================================

async function logCommentActivity(
  commentId: string,
  reportId: string,
  actionType: string,
  actionBy: string,
  oldValue?: unknown,
  newValue?: unknown,
  metadata?: unknown
): Promise<void> {
  await queryRun(
    `
    INSERT INTO report_builder_comment_activity (id, comment_id, report_id, action_type, action_by, action_at, old_value, new_value, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      uuidv4(),
      commentId,
      reportId,
      actionType,
      actionBy,
      new Date().toISOString(),
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

// ==========================================
// CORE CRUD OPERATIONS
// ==========================================

/**
 * Create a new comment
 */
export async function createComment(params: CreateCommentParams): Promise<CommentRecord> {
  const {
    reportId,
    sectionKey,
    anchor,
    userId,
    userName,
    userAvatar,
    commentType = 'FEEDBACK',
    content,
    parentCommentId,
    priority = 'normal',
    tags,
  } = params;

  const commentId = uuidv4();
  const now = new Date().toISOString();

  // Calculate thread position if this is a reply
  let threadPosition = 0;
  if (parentCommentId) {
    const maxPos = await queryOne<{ maxPos: number }>(
      `SELECT COALESCE(MAX(thread_position), 0) as "maxPos" FROM report_builder_comments WHERE parent_comment_id = ?`,
      [parentCommentId]
    );
    threadPosition = (maxPos?.maxPos || 0) + 1;
  }

  await queryRun(
    `
    INSERT INTO report_builder_comments (
      id, report_id, section_key, anchor_type, range_start, range_end, quote, content_hash,
      user_id, user_name, user_avatar, comment_type, content, status, parent_comment_id,
      thread_position, priority, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)
  `,
    [
      commentId,
      reportId,
      sectionKey || null,
      anchor?.type || 'section',
      anchor?.rangeStart ?? null,
      anchor?.rangeEnd ?? null,
      anchor?.quote || null,
      anchor?.contentHash || null,
      userId,
      userName || null,
      userAvatar || null,
      commentType,
      content,
      parentCommentId || null,
      threadPosition,
      priority,
      tags ? JSON.stringify(tags) : null,
      now,
      now,
    ]
  );

  await logCommentActivity(commentId, reportId, 'CREATED', userId, null, {
    commentType,
    content,
    sectionKey,
  });

  logger.info('[ReportBuilderComments] Comment created', {
    commentId,
    reportId,
    sectionKey,
    userId,
  });

  const comment = await getComment(commentId);
  if (!comment) throw new Error('Failed to create comment');
  return comment;
}

/**
 * Get a single comment by ID
 */
export async function getComment(commentId: string): Promise<CommentRecord | null> {
  const row = await queryOne<any>(`SELECT * FROM report_builder_comments WHERE id = ?`, [
    commentId,
  ]);
  return row ? mapRowToComment(row) : null;
}

/**
 * List comments for a report with filters
 */
export async function listComments(
  reportId: string,
  filters?: CommentFilters
): Promise<CommentRecord[]> {
  let sql = `SELECT * FROM report_builder_comments WHERE report_id = ?`;
  const params: unknown[] = [reportId];

  if (filters?.sectionKey !== undefined) {
    if (filters.sectionKey === null) {
      sql += ` AND section_key IS NULL`;
    } else {
      sql += ` AND section_key = ?`;
      params.push(filters.sectionKey);
    }
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      sql += ` AND status IN (${filters.status.map(() => '?').join(', ')})`;
      params.push(...filters.status);
    } else {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
  }

  if (filters?.commentType) {
    sql += ` AND comment_type = ?`;
    params.push(filters.commentType);
  }

  if (filters?.userId) {
    sql += ` AND user_id = ?`;
    params.push(filters.userId);
  }

  if (filters?.parentOnly) {
    sql += ` AND parent_comment_id IS NULL`;
  }

  sql += ` ORDER BY created_at ASC`;

  const rows = await queryAll<any>(sql, params);
  return rows.map(mapRowToComment);
}

/**
 * Get comments grouped by section
 */
export async function getCommentsBySection(
  reportId: string
): Promise<Record<string, CommentRecord[]>> {
  const comments = await listComments(reportId);
  const grouped: Record<string, CommentRecord[]> = { _report: [] };

  for (const comment of comments) {
    const key = comment.sectionKey || '_report';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(comment);
  }

  return grouped;
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  userId: string,
  updates: UpdateCommentParams
): Promise<CommentRecord | null> {
  const existing = await getComment(commentId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    params.push(updates.content);
  }
  if (updates.commentType !== undefined) {
    setClauses.push('comment_type = ?');
    params.push(updates.commentType);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
    if (['RESOLVED', 'DISMISSED', 'WONT_FIX'].includes(updates.status)) {
      setClauses.push('resolved_by = ?', 'resolved_at = ?');
      params.push(updates.resolvedBy || userId, now);
    }
  }
  if (updates.resolutionNotes !== undefined) {
    setClauses.push('resolution_notes = ?');
    params.push(updates.resolutionNotes);
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.aiResponse !== undefined) {
    setClauses.push('ai_response = ?');
    params.push(updates.aiResponse);
  }
  if (updates.aiSuggestedEdits !== undefined) {
    setClauses.push('ai_suggested_edits = ?', 'ai_processed_at = ?');
    params.push(JSON.stringify(updates.aiSuggestedEdits), now);
  }

  params.push(commentId);

  await queryRun(
    `UPDATE report_builder_comments SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );

  // Log status changes specifically
  if (updates.status && updates.status !== existing.status) {
    await logCommentActivity(
      commentId,
      existing.reportId,
      'STATUS_CHANGED',
      userId,
      { status: existing.status },
      { status: updates.status, resolutionNotes: updates.resolutionNotes }
    );
  }

  logger.info('[ReportBuilderComments] Comment updated', {
    commentId,
    updates: Object.keys(updates),
  });

  return getComment(commentId);
}

/**
 * Delete a comment (and its replies via CASCADE)
 */
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const existing = await getComment(commentId);
  if (!existing) return false;

  await logCommentActivity(commentId, existing.reportId, 'DELETED', userId, existing, null);

  const result = await queryRun(`DELETE FROM report_builder_comments WHERE id = ?`, [commentId]);

  logger.info('[ReportBuilderComments] Comment deleted', { commentId, userId });

  return result.changes > 0;
}

/**
 * Resolve multiple comments at once (e.g., after applying AI suggestions)
 */
export async function resolveComments(
  commentIds: string[],
  userId: string,
  resolutionNotes?: string
): Promise<number> {
  if (commentIds.length === 0) return 0;

  const now = new Date().toISOString();
  const placeholders = commentIds.map(() => '?').join(', ');

  const result = await queryRun(
    `
    UPDATE report_builder_comments 
    SET status = 'RESOLVED', resolved_by = ?, resolved_at = ?, resolution_notes = ?, updated_at = ?
    WHERE id IN (${placeholders}) AND status IN ('OPEN', 'IN_PROGRESS')
  `,
    [userId, now, resolutionNotes || 'Resolved', now, ...commentIds]
  );

  logger.info('[ReportBuilderComments] Bulk resolve', { count: result.changes, commentIds });

  return result.changes;
}

// ==========================================
// GATE CHECK FUNCTIONS (critical for workflow)
// ==========================================

/**
 * Count open comments for a report (OPEN or IN_PROGRESS)
 * This is the primary gate check for approval
 */
export async function countOpenComments(reportId: string): Promise<number> {
  const result = await queryOne<{ count: number }>(
    `
    SELECT COUNT(*) as count FROM report_builder_comments 
    WHERE report_id = ? AND status IN ('OPEN', 'IN_PROGRESS')
  `,
    [reportId]
  );
  return result?.count || 0;
}

/**
 * Count open comments by section
 */
export async function countOpenCommentsBySection(
  reportId: string
): Promise<Record<string, number>> {
  const rows = await queryAll<{ section_key: string | null; count: number }>(
    `
    SELECT section_key, COUNT(*) as count FROM report_builder_comments 
    WHERE report_id = ? AND status IN ('OPEN', 'IN_PROGRESS')
    GROUP BY section_key
  `,
    [reportId]
  );

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.section_key || '_report'] = row.count;
  }
  return result;
}

/**
 * Check if report can be approved (no open comments)
 */
export async function canApproveReport(
  reportId: string
): Promise<{ canApprove: boolean; openCount: number; blockers: string[] }> {
  const openCount = await countOpenComments(reportId);
  const blockers: string[] = [];

  if (openCount > 0) {
    blockers.push(`${openCount} open comment(s) must be resolved before approval`);
  }

  return {
    canApprove: blockers.length === 0,
    openCount,
    blockers,
  };
}

/**
 * Get comment summary for a report (for UI display)
 */
export async function getCommentSummary(reportId: string): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
  bySection: Record<string, { total: number; open: number }>;
}> {
  const statusCounts = await queryAll<{ status: string; count: number }>(
    `
    SELECT status, COUNT(*) as count FROM report_builder_comments 
    WHERE report_id = ?
    GROUP BY status
  `,
    [reportId]
  );

  const sectionCounts = await queryAll<{
    section_key: string | null;
    status: string;
    count: number;
  }>(
    `
    SELECT section_key, status, COUNT(*) as count FROM report_builder_comments 
    WHERE report_id = ?
    GROUP BY section_key, status
  `,
    [reportId]
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    byStatus[row.status] = row.count;
  }

  const bySection: Record<string, { total: number; open: number }> = {};
  for (const row of sectionCounts) {
    const key = row.section_key || '_report';
    if (!bySection[key]) bySection[key] = { total: 0, open: 0 };
    bySection[key].total += row.count;
    if (row.status === 'OPEN' || row.status === 'IN_PROGRESS') {
      bySection[key].open += row.count;
    }
  }

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    open: byStatus['OPEN'] || 0,
    inProgress: byStatus['IN_PROGRESS'] || 0,
    resolved: byStatus['RESOLVED'] || 0,
    dismissed: (byStatus['DISMISSED'] || 0) + (byStatus['WONT_FIX'] || 0),
    bySection,
  };
}

// ==========================================
// ANCHOR HELPERS
// ==========================================

/**
 * Create content hash for anchor drift detection
 */
export function createContentHash(content: string): string {
  return hashContent(content);
}

/**
 * Try to find anchor position in updated content
 * Returns updated anchor or null if not found
 */
export function findAnchorInContent(
  anchor: CommentAnchor,
  newContent: string
): CommentAnchor | null {
  if (anchor.type !== 'fragment' || !anchor.quote) return anchor;

  // Check if content hash matches (no drift)
  const newHash = hashContent(newContent);
  if (anchor.contentHash === newHash) {
    return anchor;
  }

  // Try to find quote in new content
  const quoteIndex = newContent.indexOf(anchor.quote);
  if (quoteIndex >= 0) {
    return {
      ...anchor,
      rangeStart: quoteIndex,
      rangeEnd: quoteIndex + anchor.quote.length,
      contentHash: newHash,
    };
  }

  // Quote not found - anchor is orphaned
  return null;
}

// ==========================================
// EXPORTS
// ==========================================

const ReportBuilderCommentsService = {
  // CRUD
  createComment,
  getComment,
  listComments,
  getCommentsBySection,
  updateComment,
  deleteComment,
  resolveComments,
  // Gate checks
  countOpenComments,
  countOpenCommentsBySection,
  canApproveReport,
  getCommentSummary,
  // Anchors
  createContentHash,
  findAnchorInContent,
};

export default ReportBuilderCommentsService;
