/**
 * NotificationService - Enhanced notification management
 * 
 * Re-exports from existing notificationService for consistency
 * with additional helper methods for common notification patterns.
 * 
 * Supported notification types:
 * - task_assigned: When a task is assigned to user
 * - decision_pending: When a decision requires user action
 * - mention: When user is mentioned in a comment
 * - deadline: When a deadline is approaching
 * - status_change: When an entity status changes
 */

import logger from '../utils/Logger.js';
import * as DbPromise from '../utils/DbPromise.js';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface SendNotificationInput {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  actorName?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
}

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  actorName?: string | null;
  actionUrl?: string | null;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  dismissedAt?: string | null;
}

export interface NotificationPreferences {
  userId: string;
  organizationId: string;
  preferences: Record<string, unknown>;
}

// Runtime shims for type-only exports (some TS imports may not be `import type`)
export const SendNotificationInput = undefined;
export const Notification = undefined;
export const NotificationPreferences = undefined;

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function send(input: SendNotificationInput): Promise<string> {
  const id = makeId('notif');
  const now = new Date().toISOString();
  const priority: NotificationPriority = input.priority || 'normal';

  try {
    await DbPromise.run(
      `
        INSERT INTO notifications (
          id, user_id, organization_id, type, title, body,
          entity_type, entity_id, actor_name, action_url,
          priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.userId,
        input.organizationId,
        input.type,
        input.title,
        input.body,
        input.entityType || null,
        input.entityId || null,
        input.actorName || null,
        input.actionUrl || null,
        priority,
        now,
      ]
    );
  } catch (err) {
    logger.error('[notificationService] Failed to send notification', err);
  }

  return id;
}

export async function getNotifications(params: {
  userId: string;
  organizationId: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<Notification[]> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const readTruthy = "('1','true','t','TRUE','T')";

  try {
    const rows = await DbPromise.all<any>(
      `
        SELECT
          id,
          user_id as userId,
          organization_id as organizationId,
          type,
          title,
          body,
          entity_type as entityType,
          entity_id as entityId,
          actor_name as actorName,
          action_url as actionUrl,
          priority,
          CASE
            WHEN COALESCE(is_read::text, '0') IN ${readTruthy} THEN true
            ELSE false
          END as isRead,
          created_at as createdAt,
          read_at as readAt,
          dismissed_at as dismissedAt
        FROM notifications
        WHERE user_id = ? AND organization_id = ?
          ${params.unreadOnly ? `AND COALESCE(is_read::text, '0') NOT IN ${readTruthy}` : ''}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [params.userId, params.organizationId, limit, offset]
    );
    return rows || [];
  } catch (err) {
    logger.error('[notificationService] Failed to get notifications', err);
    return [];
  }
}

export async function getUnreadCount(params: {
  userId: string;
  organizationId: string;
}): Promise<number> {
  const readTruthy = "('1','true','t','TRUE','T')";
  try {
    const row = await DbPromise.get<{ count: number }>(
      `
        SELECT COUNT(*)::int as count
        FROM notifications
        WHERE user_id = ? AND organization_id = ?
          AND COALESCE(is_read::text, '0') NOT IN ${readTruthy}
      `,
      [params.userId, params.organizationId]
    );
    return Number((row as any)?.count || 0);
  } catch (err) {
    logger.error('[notificationService] Failed to get unread count', err);
    return 0;
  }
}

export async function markAsRead(params: {
  id: string;
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    try {
      // Preferred: boolean schema
      await DbPromise.run(
        `UPDATE notifications SET is_read = true, read_at = ? WHERE id = ? AND user_id = ? AND organization_id = ?`,
        [now, params.id, params.userId, params.organizationId]
      );
    } catch {
      // Back-compat: integer schema (0/1)
      await DbPromise.run(
        `UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ? AND organization_id = ?`,
        [now, params.id, params.userId, params.organizationId]
      );
    }
    return true;
  } catch (err) {
    logger.error('[notificationService] Failed to markAsRead', err);
    return false;
  }
}

export async function markAllAsRead(params: {
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    try {
      await DbPromise.run(
        `UPDATE notifications SET is_read = true, read_at = ? WHERE user_id = ? AND organization_id = ?`,
        [now, params.userId, params.organizationId]
      );
    } catch {
      await DbPromise.run(
        `UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND organization_id = ?`,
        [now, params.userId, params.organizationId]
      );
    }
    return true;
  } catch (err) {
    logger.error('[notificationService] Failed to markAllAsRead', err);
    return false;
  }
}

export async function dismiss(params: {
  id: string;
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  try {
    await DbPromise.run(
      `UPDATE notifications SET dismissed_at = ? WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [new Date().toISOString(), params.id, params.userId, params.organizationId]
    );
    return true;
  } catch (err) {
    logger.error('[notificationService] Failed to dismiss', err);
    return false;
  }
}

export async function deleteNotification(params: {
  id: string;
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  try {
    await DbPromise.run(
      `DELETE FROM notifications WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [params.id, params.userId, params.organizationId]
    );
    return true;
  } catch (err) {
    logger.error('[notificationService] Failed to deleteNotification', err);
    return false;
  }
}

export async function getCounts(params: {
  userId: string;
  organizationId: string;
}): Promise<{ total: number; unread: number }> {
  try {
    const totalRow = await DbPromise.get<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ? AND organization_id = ?`,
      [params.userId, params.organizationId]
    );
    const unread = await getUnreadCount(params);
    return { total: Number((totalRow as any)?.count || 0), unread };
  } catch (err) {
    logger.error('[notificationService] Failed to getCounts', err);
    return { total: 0, unread: 0 };
  }
}

export async function getPreferences(params: {
  userId: string;
  organizationId: string;
}): Promise<NotificationPreferences> {
  return { userId: params.userId, organizationId: params.organizationId, preferences: {} };
}

export async function updatePreferences(params: {
  userId: string;
  organizationId: string;
  preferences: Record<string, unknown>;
}): Promise<NotificationPreferences> {
  return { userId: params.userId, organizationId: params.organizationId, preferences: params.preferences };
}

// Back-compat: some modules import default or `{ notificationService }`
export const notificationService = {
  send,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismiss,
  deleteNotification,
  getCounts,
  getPreferences,
  updatePreferences,
};

export default notificationService;

// ==========================================
// HELPER METHODS FOR COMMON PATTERNS
// ==========================================

/**
 * Send task assigned notification
 */
export const sendTaskAssigned = async (params: {
  userId: string;
  organizationId: string;
  taskId: string;
  taskTitle: string;
  projectName?: string;
  assignerName?: string;
}): Promise<string> => {
  return send({
    userId: params.userId,
    organizationId: params.organizationId,
    type: 'task_assigned',
    title: 'New Task Assigned',
    body: `You have been assigned: "${params.taskTitle}"${params.projectName ? ` in ${params.projectName}` : ''}`,
    entityType: 'task',
    entityId: params.taskId,
    actorName: params.assignerName,
    actionUrl: `/my-work/tasks/${params.taskId}`,
    priority: 'normal',
  });
};

/**
 * Send decision pending notification
 */
export const sendDecisionPending = async (params: {
  userId: string;
  organizationId: string;
  decisionId: string;
  decisionTitle: string;
  dueDate?: string;
  requesterName?: string;
}): Promise<string> => {
  const isOverdue = params.dueDate && new Date(params.dueDate) < new Date();
  
  return send({
    userId: params.userId,
    organizationId: params.organizationId,
    type: 'decision_needed',
    title: isOverdue ? 'Decision Overdue' : 'Decision Required',
    body: `Your input is needed on: "${params.decisionTitle}"`,
    entityType: 'decision',
    entityId: params.decisionId,
    actorName: params.requesterName,
    actionUrl: `/decisions/${params.decisionId}`,
    priority: isOverdue ? 'high' : 'normal',
  });
};

/**
 * Send mention notification
 */
export const sendMention = async (params: {
  userId: string;
  organizationId: string;
  mentionedBy: string;
  entityType: 'task' | 'decision' | 'initiative' | 'comment';
  entityId: string;
  entityTitle: string;
  commentPreview?: string;
}): Promise<string> => {
  return send({
    userId: params.userId,
    organizationId: params.organizationId,
    type: 'task_comment', // Using existing type for mentions in comments
    title: `${params.mentionedBy} mentioned you`,
    body: params.commentPreview 
      ? `"${params.commentPreview.slice(0, 100)}${params.commentPreview.length > 100 ? '...' : ''}"`
      : `In ${params.entityType}: "${params.entityTitle}"`,
    entityType: params.entityType,
    entityId: params.entityId,
    actorName: params.mentionedBy,
    priority: 'normal',
  });
};

/**
 * Send deadline approaching notification
 */
export const sendDeadlineApproaching = async (params: {
  userId: string;
  organizationId: string;
  entityType: 'task' | 'initiative' | 'decision';
  entityId: string;
  entityTitle: string;
  dueDate: string;
  daysRemaining: number;
}): Promise<string> => {
  const isUrgent = params.daysRemaining <= 1;
  
  return send({
    userId: params.userId,
    organizationId: params.organizationId,
    type: params.entityType === 'task' ? 'task_due_soon' : 'initiative_status_change',
    title: isUrgent ? 'Deadline Tomorrow!' : 'Deadline Approaching',
    body: `"${params.entityTitle}" is due ${params.daysRemaining === 0 ? 'today' : params.daysRemaining === 1 ? 'tomorrow' : `in ${params.daysRemaining} days`}`,
    entityType: params.entityType,
    entityId: params.entityId,
    priority: isUrgent ? 'high' : 'normal',
  });
};

/**
 * Send status change notification
 */
export const sendStatusChange = async (params: {
  userId: string;
  organizationId: string;
  entityType: 'task' | 'initiative' | 'decision';
  entityId: string;
  entityTitle: string;
  oldStatus: string;
  newStatus: string;
  changedBy?: string;
}): Promise<string> => {
  return send({
    userId: params.userId,
    organizationId: params.organizationId,
    type: params.entityType === 'initiative' ? 'initiative_status_change' : 'task_completed',
    title: 'Status Updated',
    body: `"${params.entityTitle}" status changed: ${params.oldStatus} → ${params.newStatus}`,
    entityType: params.entityType,
    entityId: params.entityId,
    actorName: params.changedBy,
    priority: 'low',
  });
};

/**
 * Batch send notifications to multiple users
 */
export const sendToMany = async (
  userIds: string[],
  notification: Omit<SendNotificationInput, 'userId'>
): Promise<string[]> => {
  const results = await Promise.all(
    userIds.map(userId =>
      send({
        ...notification,
        userId,
      })
    )
  );
  return results;
};
