/**
 * Notification Service
 * FLOW-NOTIFICATION-001: Multi-channel notification system
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  message?: string;
  icon?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  category?: string;
  entityType?: string;
  entityId?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  isActionable?: boolean;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  readAt?: string;
  snoozedUntil?: string;
  checklist?: { id: string; text: string; completed: boolean }[];
  commentsCount?: number;
  activityCount?: number;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  globalEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly';
  typeSettings: Record<string, { enabled: boolean; channels: string[] }>;
}

export interface SendNotificationInput {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  message?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  isActionable?: boolean;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
}

// ==========================================
// SERVICE
// ==========================================

class NotificationService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Compute severity automatically from notification type + context
   */
  private computeSeverity(
    type: string,
    data?: Record<string, unknown>,
    explicitSeverity?: string
  ): 'INFO' | 'WARNING' | 'CRITICAL' {
    if (explicitSeverity) {
      const s = explicitSeverity.toUpperCase();
      if (s === 'CRITICAL') return 'CRITICAL';
      if (s === 'WARNING' || s === 'HIGH') return 'WARNING';
      if (s === 'INFO') return 'INFO';
    }

    const t = (type || '').toUpperCase();
    const daysOverdue = Number(data?.days_overdue || data?.daysOverdue || 0);

    // Critical severity
    if (t.includes('BLOCKED') && data?.blocking_count && Number(data.blocking_count) > 0)
      return 'CRITICAL';
    if (t === 'DECISION_OVERDUE') return 'CRITICAL';
    if (t === 'TASK_OVERDUE' && daysOverdue > 3) return 'CRITICAL';
    if (t === 'SYSTEM_ALERT') return 'CRITICAL';

    // Warning severity
    if (t === 'TASK_OVERDUE') return 'WARNING';
    if (t === 'TASK_BLOCKED') return 'WARNING';
    if (t.includes('ESCALAT')) return 'WARNING';
    if (t === 'DECISION_REQUIRED') return 'WARNING';
    if (t === 'GATE_PENDING_APPROVAL') return 'WARNING';
    if (t === 'AI_RISK_DETECTED') return 'WARNING';
    if (t === 'AI_OVERLOAD_DETECTED') return 'WARNING';
    if (t === 'AI_DEPENDENCY_CONFLICT') return 'WARNING';
    if (t === 'CLIENT_TICKET') return 'WARNING';

    // Info severity (default)
    return 'INFO';
  }

  /**
   * Compute priority from severity
   */
  private computePriority(
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    type: string
  ): 'low' | 'normal' | 'high' | 'urgent' | 'critical' {
    if (severity === 'CRITICAL') return 'critical';
    if (severity === 'WARNING') {
      const t = (type || '').toUpperCase();
      if (t.includes('OVERDUE') || t.includes('ESCALAT') || t.includes('BLOCKED')) return 'urgent';
      return 'high';
    }
    const t = (type || '').toUpperCase();
    if (t.includes('ASSIGN') || t.includes('REQUIRED')) return 'normal';
    return 'low';
  }

  /**
   * Infer category from notification type
   */
  private inferCategory(type: string): string {
    const t = (type || '').toUpperCase();
    if (t.includes('TASK')) return 'task';
    if (t.includes('DECISION') || t.includes('GATE') || t.includes('CHANGE_REQUEST'))
      return 'decision';
    if (t.includes('AI')) return 'ai';
    if (t.includes('INITIATIVE')) return 'initiative';
    if (
      t.includes('BILLING') ||
      t.includes('PAYMENT') ||
      t.includes('SUBSCRIPTION') ||
      t.includes('USAGE') ||
      t.includes('INVOICE') ||
      t.includes('LIMIT')
    )
      return 'billing';
    if (t.startsWith('DBR77_') || t.includes('DBR77')) return 'dbr77';
    if (t.includes('SYSTEM') || t.includes('ADMIN')) return 'system';
    if (t.includes('FEEDBACK') || t.includes('TICKET')) return 'feedback';
    return 'system';
  }

  /**
   * Send notification
   */
  async send(input: SendNotificationInput): Promise<string> {
    const db = await this.getDb();
    const id = `notif-${uuidv4()}`;
    const now = new Date().toISOString();

    // Get user preferences
    const prefs = await this.getPreferences(input.userId);

    // Check if globally disabled
    if (!prefs?.globalEnabled) {
      logger.debug(`[NotificationService] Notifications disabled for user ${input.userId}`);
      return id;
    }

    // Check quiet hours
    if (prefs?.quietHoursEnabled && this.isInQuietHours(prefs)) {
      logger.debug(`[NotificationService] User ${input.userId} in quiet hours`);
      // Still save notification but don't push
    }

    // Get notification type config
    const typeConfig = await this.getNotificationTypeConfig(input.type);

    // Determine channels
    let channels = typeConfig?.defaultChannels || ['in_app'];
    if (prefs?.typeSettings?.[input.type]) {
      const typePref = prefs.typeSettings[input.type];
      if (!typePref.enabled) {
        logger.debug(`[NotificationService] Type ${input.type} disabled for user ${input.userId}`);
        return id;
      }
      channels = typePref.channels;
    }

    // Auto-compute severity from type + data
    const severity = this.computeSeverity(input.type, input.data || input.metadata, input.severity);
    const priority = input.priority || this.computePriority(severity, input.type);

    // Entity Enrichment: fetch context from source entity at creation time
    let enrichedData: Record<string, unknown> = {};
    const entityType = input.relatedObjectType || input.entityType;
    const entityId = input.relatedObjectId || input.entityId;
    if (entityType && entityId) {
      try {
        enrichedData = await this.enrichEntityData(entityType, entityId);
      } catch (err) {
        logger.warn(`[NotificationService] Entity enrichment failed: ${err}`);
      }
    }

    // Merge data and metadata with enrichment (enrichment has lowest priority)
    const mergedData = { ...enrichedData, ...(input.metadata || {}), ...(input.data || {}) };

    // Save notification with all enriched fields
    await db.run(
      `INSERT INTO notifications (
                id, user_id, organization_id, type, title, body, message, icon,
                severity, priority, entity_type, entity_id,
                related_object_type, related_object_id, project_id,
                action_url, actor_id, actor_name,
                is_actionable, data, metadata, channels_sent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.organizationId,
        input.type,
        input.title,
        input.body,
        input.message || input.body,
        typeConfig?.icon || null,
        severity,
        priority,
        input.entityType || input.relatedObjectType || null,
        input.entityId || input.relatedObjectId || null,
        input.relatedObjectType || input.entityType || null,
        input.relatedObjectId || input.entityId || null,
        input.projectId || null,
        input.actionUrl || null,
        input.actorId || null,
        input.actorName || null,
        input.isActionable ? 1 : 0,
        JSON.stringify(mergedData),
        JSON.stringify(input.metadata || {}),
        JSON.stringify(channels),
        now,
      ]
    );

    // Dispatch to channels
    await this.dispatchToChannels(id, input, channels, prefs);

    logger.info(
      `[NotificationService] Sent notification ${id} type=${input.type} severity=${severity} to user=${input.userId}`
    );

    return id;
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
      type?: string;
      projectId?: string;
      severity?: string;
    }
  ): Promise<Notification[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params: (string | number)[] = [userId];

    // Exclude dismissed notifications
    query += ` AND (is_dismissed IS NULL OR is_dismissed = 0)`;

    if (options?.unreadOnly) {
      query += ` AND (read = 0 OR is_read = 0)`;
    }

    if (options?.type) {
      query += ` AND type = ?`;
      params.push(options.type);
    }

    if (options?.severity) {
      query += ` AND severity = ?`;
      params.push(options.severity);
    }

    if (options?.projectId) {
      query += ` AND (project_id = ? OR (entity_id = ? AND entity_type = 'project'))`;
      params.push(options.projectId, options.projectId);
    }

    // Exclude snoozed notifications that haven't expired
    query += ` AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))`;

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await db.all<Record<string, any>>(query, params);

    return (rows || []).map((r) => this.mapNotificationRow(r));
  }

  /**
   * Map a raw DB row to a Notification object, handling both old and new column schemas
   */
  private mapNotificationRow(r: Record<string, any>): Notification {
    // Parse data/metadata JSON safely
    let data: Record<string, unknown> = {};
    let metadata: Record<string, unknown> = {};
    try {
      data = r.data ? JSON.parse(r.data) : {};
    } catch {
      data = {};
    }
    try {
      metadata = r.metadata ? JSON.parse(r.metadata) : {};
    } catch {
      metadata = {};
    }

    // Parse checklist JSON safely
    let checklist: { id: string; text: string; completed: boolean }[] | undefined;
    try {
      checklist = r.checklist ? JSON.parse(r.checklist) : undefined;
    } catch {
      checklist = undefined;
    }

    // Determine severity: prefer explicit column, then compute from type
    const severity =
      r.severity && ['INFO', 'WARNING', 'CRITICAL'].includes(r.severity?.toUpperCase?.())
        ? (r.severity.toUpperCase() as 'INFO' | 'WARNING' | 'CRITICAL')
        : this.computeSeverity(r.type, data);

    // Related object: prefer dedicated columns, fall back to entity columns
    const relatedObjectType = r.related_object_type || r.entity_type || null;
    const relatedObjectId = r.related_object_id || r.entity_id || null;

    return {
      id: r.id,
      userId: r.user_id,
      organizationId: r.organization_id,
      type: r.type,
      title: r.title,
      body: r.body || r.message || '',
      message: r.message || r.body || '',
      icon: r.icon,
      priority: r.priority as Notification['priority'],
      severity,
      category: this.inferCategory(r.type),
      entityType: r.entity_type || null,
      entityId: r.entity_id || null,
      relatedObjectType: relatedObjectType,
      relatedObjectId: relatedObjectId,
      projectId: r.project_id || null,
      projectName: (data.projectName as string) || (data.project_name as string) || null,
      actionUrl: r.action_url,
      actorId: r.actor_id,
      actorName: r.actor_name,
      isRead: r.read === 1 || r.is_read === 1,
      isActionable: r.is_actionable === 1,
      data: { ...metadata, ...data },
      metadata,
      readAt: r.read_at,
      snoozedUntil: r.snoozed_until || null,
      checklist,
      commentsCount:
        typeof r.comments_count === 'number' ? r.comments_count : Number(r.comments_count || 0),
      activityCount:
        typeof r.activity_count === 'number' ? r.activity_count : Number(r.activity_count || 0),
      createdAt: r.created_at,
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const db = await this.getDb();

    const result = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0 AND (is_dismissed IS NULL OR is_dismissed = 0)`,
      [userId]
    );

    return result?.count || 0;
  }

  /**
   * Get notification counts for user
   */
  async getCounts(userId: string): Promise<{ unread: number }> {
    const unread = await this.getUnreadCount(userId);
    return { unread };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(`UPDATE notifications SET read = 1, read_at = ? WHERE id = ? AND user_id = ?`, [
      now,
      notificationId,
      userId,
    ]);

    await this.addActivityLogEntry(
      notificationId,
      userId,
      'marked_read',
      'Notification marked as read'
    );
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const result = await db.run(
      `UPDATE notifications SET read = 1, read_at = ? WHERE user_id = ? AND read = 0`,
      [now, userId]
    );

    return result.changes || 0;
  }

  /**
   * Dismiss notification
   */
  async dismiss(notificationId: string, userId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE notifications SET is_dismissed = 1, dismissed_at = ? WHERE id = ? AND user_id = ?`,
      [now, notificationId, userId]
    );
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    const db = await this.getDb();

    await db.run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
      notificationId,
      userId,
    ]);
  }

  /**
   * Snooze a notification until a given time
   */
  async snoozeNotification(notificationId: string, userId: string, until: string): Promise<void> {
    const db = await this.getDb();

    await db.run(`UPDATE notifications SET snoozed_until = ? WHERE id = ? AND user_id = ?`, [
      until,
      notificationId,
      userId,
    ]);

    await this.addActivityLogEntry(notificationId, userId, 'snoozed', `Snoozed until ${until}`);
  }

  /**
   * Update action checklist for a notification
   */
  async updateChecklist(
    notificationId: string,
    userId: string,
    checklist: { id: string; text: string; completed: boolean }[]
  ): Promise<void> {
    const db = await this.getDb();

    await db.run(`UPDATE notifications SET checklist = ? WHERE id = ? AND user_id = ?`, [
      JSON.stringify(checklist),
      notificationId,
      userId,
    ]);
  }

  /**
   * Get a single notification by ID
   */
  async getById(notificationId: string, userId: string): Promise<Notification | null> {
    const db = await this.getDb();

    const row = await db.get<Record<string, any>>(
      `SELECT
          n.*,
          (SELECT COUNT(1) FROM notification_comments nc WHERE nc.notification_id = n.id) as comments_count,
          (SELECT COUNT(1) FROM notification_activity_log nal WHERE nal.notification_id = n.id) as activity_count
        FROM notifications n
        WHERE n.id = ? AND n.user_id = ?`,
      [notificationId, userId]
    );

    if (!row) return null;
    return this.mapNotificationRow(row);
  }

  /**
   * Get source entity data for a notification
   */
  async getSourceEntity(
    notificationId: string,
    userId: string
  ): Promise<Record<string, any> | null> {
    const db = await this.getDb();

    const notif = await db.get<Record<string, any>>(
      `SELECT related_object_type, related_object_id, entity_type, entity_id FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (!notif) return null;

    const entityType = (notif.related_object_type || notif.entity_type || '').toLowerCase();
    const entityId = notif.related_object_id || notif.entity_id;

    if (!entityType || !entityId) return null;

    try {
      if (entityType === 'task') {
        const task = await db.get<Record<string, any>>(
          `SELECT id, title, status, priority, assigned_to, due_date, progress, description FROM tasks WHERE id = ?`,
          [entityId]
        );
        if (task) {
          return {
            type: 'task',
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            assignee: task.assigned_to,
            dueDate: task.due_date,
            progress: task.progress,
            description: task.description?.substring(0, 200),
          };
        }
      }

      if (entityType === 'decision') {
        const decision = await db.get<Record<string, any>>(
          `SELECT id, title, status, priority, assigned_to, due_date, description FROM decisions WHERE id = ?`,
          [entityId]
        );
        if (decision) {
          return {
            type: 'decision',
            id: decision.id,
            title: decision.title,
            status: decision.status,
            priority: decision.priority,
            decider: decision.assigned_to,
            dueDate: decision.due_date,
            description: decision.description?.substring(0, 200),
          };
        }
      }

      if (entityType === 'initiative') {
        const initiative = await db.get<Record<string, any>>(
          `SELECT id, title, status, owner_id, target_date FROM initiatives WHERE id = ?`,
          [entityId]
        );
        if (initiative) {
          return {
            type: 'initiative',
            id: initiative.id,
            title: initiative.title,
            status: initiative.status,
            owner: initiative.owner_id,
            targetDate: initiative.target_date,
          };
        }
      }
    } catch (error) {
      logger.warn(`[NotificationService] Failed to fetch source entity: ${error}`);
    }

    return { type: entityType, id: entityId };
  }

  /**
   * Get preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const db = await this.getDb();

    const row = await db.get<{
      user_id: string;
      global_enabled: number;
      quiet_hours_enabled: number;
      quiet_hours_start: string;
      quiet_hours_end: string;
      email_enabled: number;
      email_digest_enabled: number;
      email_digest_frequency: string;
      type_settings: string;
    }>(`SELECT * FROM notification_preferences WHERE user_id = ?`, [userId]);

    if (!row) {
      // Return defaults
      return {
        userId,
        globalEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        emailEnabled: true,
        emailDigestEnabled: false,
        emailDigestFrequency: 'daily',
        typeSettings: {},
      };
    }

    return {
      userId: row.user_id,
      globalEnabled: row.global_enabled === 1,
      quietHoursEnabled: row.quiet_hours_enabled === 1,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      emailEnabled: row.email_enabled === 1,
      emailDigestEnabled: row.email_digest_enabled === 1,
      emailDigestFrequency: row.email_digest_frequency as 'daily' | 'weekly',
      typeSettings: JSON.parse(row.type_settings || '{}'),
    };
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Check if exists
    const existing = await db.get<{ id: string }>(
      `SELECT id FROM notification_preferences WHERE user_id = ?`,
      [userId]
    );

    if (existing) {
      const fields: string[] = ['updated_at = ?'];
      const values: (string | number)[] = [now];

      if (updates.globalEnabled !== undefined) {
        fields.push('global_enabled = ?');
        values.push(updates.globalEnabled ? 1 : 0);
      }
      if (updates.quietHoursEnabled !== undefined) {
        fields.push('quiet_hours_enabled = ?');
        values.push(updates.quietHoursEnabled ? 1 : 0);
      }
      if (updates.quietHoursStart !== undefined) {
        fields.push('quiet_hours_start = ?');
        values.push(updates.quietHoursStart);
      }
      if (updates.quietHoursEnd !== undefined) {
        fields.push('quiet_hours_end = ?');
        values.push(updates.quietHoursEnd);
      }
      if (updates.emailEnabled !== undefined) {
        fields.push('email_enabled = ?');
        values.push(updates.emailEnabled ? 1 : 0);
      }
      if (updates.emailDigestEnabled !== undefined) {
        fields.push('email_digest_enabled = ?');
        values.push(updates.emailDigestEnabled ? 1 : 0);
      }
      if (updates.emailDigestFrequency !== undefined) {
        fields.push('email_digest_frequency = ?');
        values.push(updates.emailDigestFrequency);
      }
      if (updates.typeSettings !== undefined) {
        fields.push('type_settings = ?');
        values.push(JSON.stringify(updates.typeSettings));
      }

      values.push(userId);

      await db.run(
        `UPDATE notification_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
        values
      );
    } else {
      // Insert new
      await db.run(
        `INSERT INTO notification_preferences (
                    id, user_id, global_enabled, quiet_hours_enabled,
                    quiet_hours_start, quiet_hours_end, email_enabled,
                    email_digest_enabled, email_digest_frequency, type_settings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          updates.globalEnabled !== false ? 1 : 0,
          updates.quietHoursEnabled ? 1 : 0,
          updates.quietHoursStart || '22:00',
          updates.quietHoursEnd || '08:00',
          updates.emailEnabled !== false ? 1 : 0,
          updates.emailDigestEnabled ? 1 : 0,
          updates.emailDigestFrequency || 'daily',
          JSON.stringify(updates.typeSettings || {}),
        ]
      );
    }
  }

  // ==========================================
  // COMMENTS
  // ==========================================

  /**
   * Get comments for a notification
   */
  async getComments(
    notificationId: string,
    userId: string
  ): Promise<
    {
      id: string;
      notificationId: string;
      userId: string;
      user: { id: string; firstName: string; lastName: string; avatarUrl?: string };
      content: string;
      priority?: string;
      createdAt: string;
      updatedAt: string;
    }[]
  > {
    const db = await this.getDb();

    // Verify notification belongs to user
    const notif = await db.get<{ id: string }>(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (!notif) return [];

    const rows = await db.all<Record<string, any>[]>(
      `SELECT nc.id, nc.notification_id, nc.user_id, nc.content, nc.priority,
              nc.created_at, nc.updated_at,
              u.first_name, u.last_name, u.avatar_url
       FROM notification_comments nc
       LEFT JOIN users u ON u.id = nc.user_id
       WHERE nc.notification_id = ?
       ORDER BY nc.created_at ASC`,
      [notificationId]
    );

    return (rows || []).map((c: Record<string, any>) => ({
      id: c.id,
      notificationId: c.notification_id,
      userId: c.user_id,
      user: {
        id: c.user_id,
        firstName: c.first_name || 'Unknown',
        lastName: c.last_name || '',
        avatarUrl: c.avatar_url,
      },
      content: c.content,
      priority: c.priority,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  /**
   * Add a comment to a notification
   */
  async addComment(
    notificationId: string,
    userId: string,
    content: string,
    priority?: string
  ): Promise<{
    id: string;
    notificationId: string;
    userId: string;
    content: string;
    priority?: string;
    createdAt: string;
    updatedAt: string;
  }> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO notification_comments (id, notification_id, user_id, content, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, notificationId, userId, content, priority || null, now, now]
    );

    // Add activity log entry
    await this.addActivityLogEntry(notificationId, userId, 'comment_added', `Comment added`);

    return { id, notificationId, userId, content, priority, createdAt: now, updatedAt: now };
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const db = await this.getDb();

    const comment = await db.get<{ user_id: string; notification_id: string }>(
      'SELECT user_id, notification_id FROM notification_comments WHERE id = ?',
      [commentId]
    );

    if (!comment) throw new Error('Comment not found');
    if (comment.user_id !== userId) throw new Error('Unauthorized');

    await db.run('DELETE FROM notification_comments WHERE id = ?', [commentId]);

    // Add activity log entry
    await this.addActivityLogEntry(
      comment.notification_id,
      userId,
      'comment_deleted',
      'Comment deleted'
    );
  }

  // ==========================================
  // ACTIVITY LOG
  // ==========================================

  /**
   * Get activity log for a notification
   */
  async getActivityLog(
    notificationId: string,
    userId: string
  ): Promise<
    {
      id: string;
      notificationId: string;
      userId: string;
      userName?: string;
      action: string;
      description: string;
      createdAt: string;
    }[]
  > {
    const db = await this.getDb();

    // Verify notification belongs to user
    const notif = await db.get<{ id: string }>(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (!notif) return [];

    const rows = await db.all<Record<string, any>[]>(
      `SELECT nal.id, nal.notification_id, nal.user_id, nal.action, nal.description,
              nal.created_at, u.first_name, u.last_name
       FROM notification_activity_log nal
       LEFT JOIN users u ON u.id = nal.user_id
       WHERE nal.notification_id = ?
       ORDER BY nal.created_at DESC`,
      [notificationId]
    );

    return (rows || []).map((r: Record<string, any>) => ({
      id: r.id,
      notificationId: r.notification_id,
      userId: r.user_id,
      userName: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : undefined,
      action: r.action,
      description: r.description,
      createdAt: r.created_at,
    }));
  }

  /**
   * Add an activity log entry for a notification
   */
  async addActivityLogEntry(
    notificationId: string,
    userId: string,
    action: string,
    description: string
  ): Promise<void> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT INTO notification_activity_log (id, notification_id, user_id, action, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, notificationId, userId, action, description, now]
      );
    } catch (err) {
      logger.warn(`[NotificationService] Failed to add activity log: ${err}`);
    }
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Enrich notification data with context from the source entity at creation time.
   * This snapshot is stored in the notification's `data` field so the frontend
   * can display meaningful context without additional API calls.
   */
  private async enrichEntityData(
    entityType: string,
    entityId: string
  ): Promise<Record<string, unknown>> {
    const db = await this.getDb();
    const type = (entityType || '').toLowerCase();
    const result: Record<string, unknown> = {};

    try {
      if (type === 'task') {
        const task = await db.get<Record<string, any>>(
          `SELECT id, title, status, priority, assigned_to, due_date, progress FROM tasks WHERE id = ?`,
          [entityId]
        );
        if (task) {
          result.entityName = task.title;
          result.entityStatus = task.status;
          result.entityAssignee = task.assigned_to;
          result.entityDeadline = task.due_date;
          result.entityProgress = task.progress;
          result.task_title = task.title;

          // Compute days overdue
          if (task.due_date) {
            const dueDate = new Date(task.due_date);
            const now = new Date();
            const diffDays = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays > 0) {
              result.days_overdue = diffDays;
              result.daysOverdue = diffDays;
            }
          }

          // Try to get project name
          try {
            const project = await db.get<{ title: string }>(
              `SELECT title FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = ?)`,
              [entityId]
            );
            if (project) result.projectName = project.title;
          } catch {
            // ignore
          }

          // Check blocked items
          try {
            const blocked = await db.get<{ cnt: number }>(
              `SELECT COUNT(*) as cnt FROM task_dependencies WHERE blocking_task_id = ?`,
              [entityId]
            );
            if (blocked && blocked.cnt > 0) {
              result.blocking_count = blocked.cnt;
              result.blockedItems = `Blocks ${blocked.cnt} other task(s)`;
            }
          } catch {
            // ignore — table may not exist
          }

          // Build contextLine
          const parts: string[] = [];
          if (result.days_overdue && Number(result.days_overdue) > 0) {
            parts.push(`${result.days_overdue}d overdue`);
          }
          if (task.assigned_to) parts.push(task.assigned_to);
          if (result.blocking_count) parts.push(`blocks ${result.blocking_count} tasks`);
          result.contextLine =
            parts.length > 0 ? `${task.title} — ${parts.join(' · ')}` : task.title;
        }
      }

      if (type === 'decision') {
        const decision = await db.get<Record<string, any>>(
          `SELECT id, title, status, priority, assigned_to, due_date FROM decisions WHERE id = ?`,
          [entityId]
        );
        if (decision) {
          result.entityName = decision.title;
          result.entityStatus = decision.status;
          result.entityAssignee = decision.assigned_to;
          result.entityDeadline = decision.due_date;
          result.decision_title = decision.title;

          if (decision.due_date) {
            const dueDate = new Date(decision.due_date);
            const now = new Date();
            const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            result.deadline_days = Math.max(0, diffDays);
          }

          result.contextLine = decision.title;
        }
      }

      if (type === 'initiative') {
        const initiative = await db.get<Record<string, any>>(
          `SELECT id, title, status, owner_id FROM initiatives WHERE id = ?`,
          [entityId]
        );
        if (initiative) {
          result.entityName = initiative.title;
          result.entityStatus = initiative.status;
          result.contextLine = initiative.title;
        }
      }
    } catch (err) {
      logger.warn(
        `[NotificationService] enrichEntityData failed for ${entityType}/${entityId}: ${err}`
      );
    }

    return result;
  }

  private async getNotificationTypeConfig(type: string): Promise<{
    defaultChannels: string[];
    icon?: string;
  } | null> {
    const db = await this.getDb();

    const row = await db.get<{
      default_channels: string;
      icon: string;
    }>(`SELECT default_channels, icon FROM notification_types WHERE name = ?`, [type]);

    if (!row) return null;

    return {
      defaultChannels: JSON.parse(row.default_channels || '["in_app"]'),
      icon: row.icon,
    };
  }

  private isInQuietHours(prefs: NotificationPreferences): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const start = prefs.quietHoursStart;
    const end = prefs.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }

    return currentTime >= start && currentTime < end;
  }

  private async dispatchToChannels(
    notificationId: string,
    input: SendNotificationInput,
    channels: string[],
    prefs: NotificationPreferences | null
  ): Promise<void> {
    const db = await this.getDb();

    for (const channel of channels) {
      // Log delivery attempt
      const logId = uuidv4();
      let status = 'sent';

      try {
        switch (channel) {
          case 'in_app':
            // Already saved, just mark as sent
            break;
          case 'email':
            if (prefs?.emailEnabled) {
              // Would send email here
              // await emailService.send(...)
            } else {
              status = 'skipped';
            }
            break;
          case 'slack':
            // Would send Slack message here
            break;
          case 'teams':
            // Would send Teams message here
            break;
        }

        await db.run(
          `INSERT INTO notification_delivery_log (id, notification_id, channel, status, sent_at)
                     VALUES (?, ?, ?, ?, ?)`,
          [logId, notificationId, channel, status, new Date().toISOString()]
        );
      } catch (error: any) {
        await db.run(
          `INSERT INTO notification_delivery_log (id, notification_id, channel, status, error_message, failed_at)
                     VALUES (?, ?, ?, 'failed', ?, ?)`,
          [logId, notificationId, channel, error?.message, new Date().toISOString()]
        );
      }
    }
  }
}

// Export singleton
const notificationService = new NotificationService();
export default notificationService;

// Named exports
export const send = (input: SendNotificationInput) => notificationService.send(input);
export const getNotifications = (
  userId: string,
  options?: Parameters<typeof notificationService.getNotifications>[1]
) => notificationService.getNotifications(userId, options);
export const getUnreadCount = (userId: string) => notificationService.getUnreadCount(userId);
export const markAsRead = (notificationId: string, userId: string) =>
  notificationService.markAsRead(notificationId, userId);
export const markAllAsRead = (userId: string) => notificationService.markAllAsRead(userId);
export const dismiss = (notificationId: string, userId: string) =>
  notificationService.dismiss(notificationId, userId);
export const deleteNotification = (notificationId: string, userId: string) =>
  notificationService.delete(notificationId, userId);
export const getCounts = (userId: string) => notificationService.getCounts(userId);
export const getPreferences = (userId: string) => notificationService.getPreferences(userId);
export const updatePreferences = (userId: string, updates: Partial<NotificationPreferences>) =>
  notificationService.updatePreferences(userId, updates);
export const snoozeNotification = (notificationId: string, userId: string, until: string) =>
  notificationService.snoozeNotification(notificationId, userId, until);
export const updateChecklist = (
  notificationId: string,
  userId: string,
  checklist: { id: string; text: string; completed: boolean }[]
) => notificationService.updateChecklist(notificationId, userId, checklist);
export const getById = (notificationId: string, userId: string) =>
  notificationService.getById(notificationId, userId);
export const getSourceEntity = (notificationId: string, userId: string) =>
  notificationService.getSourceEntity(notificationId, userId);
export const getComments = (notificationId: string, userId: string) =>
  notificationService.getComments(notificationId, userId);
export const addComment = (
  notificationId: string,
  userId: string,
  content: string,
  priority?: string
) => notificationService.addComment(notificationId, userId, content, priority);
export const deleteComment = (commentId: string, userId: string) =>
  notificationService.deleteComment(commentId, userId);
export const getActivityLog = (notificationId: string, userId: string) =>
  notificationService.getActivityLog(notificationId, userId);
