/**
 * Notification Service
 * FLOW-NOTIFICATION-001: Multi-channel notification system
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { send as sendEmail } from './emailService.js';
import { SlackServiceClass } from './slackService.js';

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
  channels?: string[];
  recipientEmail?: string;
  recipientEmails?: string[];
  bypassPreferences?: boolean;
  bypassQuietHours?: boolean;
}

// ==========================================
// SERVICE
// ==========================================

class NotificationService {
  private db: IDatabase | null = null;
  private notificationsCols: Set<string> | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async getNotificationsCols(): Promise<Set<string>> {
    if (!this.notificationsCols) {
      this.notificationsCols = await getTableColumns('notifications');
    }
    return this.notificationsCols;
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
    const bypassPreferences = Boolean(input.bypassPreferences);
    const bypassQuietHours = Boolean(input.bypassQuietHours);

    // Get user preferences
    const prefs = await this.getPreferences(input.userId);

    // Check if globally disabled
    if (!bypassPreferences && !prefs?.globalEnabled) {
      logger.debug(`[NotificationService] Notifications disabled for user ${input.userId}`);
      return id;
    }

    // Check quiet hours
    if (!bypassQuietHours && prefs?.quietHoursEnabled && this.isInQuietHours(prefs)) {
      logger.debug(`[NotificationService] User ${input.userId} in quiet hours`);
      // Still save notification but don't push
    }

    // Get notification type config
    const typeConfig = await this.getNotificationTypeConfig(input.type);

    // Determine channels
    let channels =
      Array.isArray(input.channels) && input.channels.length > 0
        ? Array.from(new Set(input.channels))
        : typeConfig?.defaultChannels || ['in_app'];
    if (!bypassPreferences && prefs?.typeSettings) {
      const key =
        Object.keys(prefs.typeSettings).find(
          (k) => String(k || '').toLowerCase() === String(input.type || '').toLowerCase()
        ) || null;
      const typePref = key ? prefs.typeSettings[key] : null;
      if (typePref) {
        if (!typePref.enabled) {
          logger.debug(
            `[NotificationService] Type ${input.type} disabled for user ${input.userId}`
          );
          return id;
        }
        channels = typePref.channels;
      }
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

    const cols = await this.getNotificationsCols();
    // Schema compatibility: build INSERT based on existing columns.
    // Different deployments may have partial/legacy schemas (e.g. no `body`).
    const insertCols: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, value: unknown) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      values.push(value);
    };

    add('id', id);
    add('user_id', input.userId);
    add('organization_id', input.organizationId);
    add('type', input.type);
    add('title', input.title);
    add('body', input.body);
    add('message', input.message || input.body || input.title);
    add('icon', typeConfig?.icon || null);
    add('severity', severity);
    add('priority', priority);
    add('entity_type', input.entityType || input.relatedObjectType || null);
    add('entity_id', input.entityId || input.relatedObjectId || null);
    add('related_object_type', input.relatedObjectType || input.entityType || null);
    add('related_object_id', input.relatedObjectId || input.entityId || null);
    add('project_id', input.projectId || null);
    add('action_url', input.actionUrl || null);
    add('actor_id', input.actorId || null);
    add('actor_name', input.actorName || null);
    add('is_actionable', input.isActionable ? 1 : 0);
    add('data', JSON.stringify(mergedData));
    add('metadata', JSON.stringify(input.metadata || {}));
    add('channels_sent', JSON.stringify(channels));
    add('created_at', now);
    // read flag differs between schemas
    add('read', 0);
    add('is_read', 0);

    if (insertCols.length === 0) {
      throw new Error('Notifications table schema is incompatible (no insertable columns)');
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    await db.run(
      `INSERT INTO notifications (${insertCols.join(', ')}) VALUES (${placeholders})`,
      values
    );

    // Dispatch to channels
    await this.dispatchToChannels(id, input, channels, prefs, {
      bypassPreferences,
      bypassQuietHours,
    });

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
    const cols = await this.getNotificationsCols();

    const needsOrgJoin = !cols.has('organization_id');
    let query = needsOrgJoin
      ? `SELECT n.*, u.organization_id as organization_id FROM notifications n LEFT JOIN users u ON n.user_id = u.id WHERE n.user_id = ?`
      : `SELECT * FROM notifications WHERE user_id = ?`;
    const params: (string | number)[] = [userId];

    // Exclude dismissed notifications (only if supported)
    if (cols.has('is_dismissed')) {
      query += ` AND (is_dismissed IS NULL OR is_dismissed = 0)`;
    }

    if (options?.unreadOnly) {
      if (cols.has('read') && cols.has('is_read')) query += ` AND (read = 0 OR is_read = 0)`;
      else if (cols.has('read')) query += ` AND read = 0`;
      else if (cols.has('is_read')) query += ` AND is_read = 0`;
    }

    if (options?.type) {
      query += ` AND type = ?`;
      params.push(options.type);
    }

    if (options?.severity) {
      if (cols.has('severity')) {
        query += ` AND severity = ?`;
        params.push(options.severity);
      }
    }

    if (options?.projectId) {
      if (cols.has('project_id') || (cols.has('entity_id') && cols.has('entity_type'))) {
        query += ` AND (project_id = ? OR (entity_id = ? AND entity_type = 'project'))`;
        params.push(options.projectId, options.projectId);
      }
    }

    // Exclude snoozed notifications that haven't expired
    if (cols.has('snoozed_until')) {
      query += ` AND (
        snoozed_until IS NULL
        OR CAST(snoozed_until AS TEXT) = ''
        OR CAST(snoozed_until AS TEXT) < CAST(CURRENT_TIMESTAMP AS TEXT)
      )`;
    }

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
    const projectName =
      (data.projectName as string | null | undefined) ||
      (data.project_name as string | null | undefined) ||
      undefined;

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
      projectName,
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
    const cols = await this.getNotificationsCols();

    const dismissedFilter = cols.has('is_dismissed')
      ? ' AND (is_dismissed IS NULL OR is_dismissed = 0)'
      : '';
    const readFilter = cols.has('read') ? 'read = 0' : cols.has('is_read') ? 'is_read = 0' : '1=1';
    const result = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND ${readFilter}${dismissedFilter}`,
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
    const cols = await this.getNotificationsCols();

    if (cols.has('is_dismissed')) {
      await db.run(
        `UPDATE notifications SET is_dismissed = 1, dismissed_at = ? WHERE id = ? AND user_id = ?`,
        [now, notificationId, userId]
      );
      return;
    }

    // Legacy minimal schema: approximate dismiss by marking as read (or delete)
    if (cols.has('read')) {
      await db.run(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`, [
        notificationId,
        userId,
      ]);
      return;
    }

    await db.run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
      notificationId,
      userId,
    ]);
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
   * Update editable "worksheet" drafts for NotificationDetailView (persisted in notifications.data JSON)
   */
  async updateWorksheetDraft(
    notificationId: string,
    userId: string,
    draft: {
      description?: string;
      whyImportant?: string;
      blocked?: string;
      expectedAction?: string;
    }
  ): Promise<void> {
    const db = await this.getDb();
    const row = await db.get<{ data?: string }>(
      `SELECT data FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    if (!row) {
      throw new Error('Notification not found');
    }

    let dataObj: Record<string, unknown> = {};
    try {
      dataObj = row.data ? JSON.parse(row.data) : {};
    } catch {
      dataObj = {};
    }

    const prevWorksheet =
      dataObj.worksheet &&
      typeof dataObj.worksheet === 'object' &&
      !Array.isArray(dataObj.worksheet)
        ? (dataObj.worksheet as Record<string, unknown>)
        : {};

    const nextWorksheet = {
      ...prevWorksheet,
      ...(draft.description !== undefined ? { description: draft.description } : {}),
      ...(draft.whyImportant !== undefined ? { whyImportant: draft.whyImportant } : {}),
      ...(draft.blocked !== undefined ? { blocked: draft.blocked } : {}),
      ...(draft.expectedAction !== undefined ? { expectedAction: draft.expectedAction } : {}),
      updatedAt: new Date().toISOString(),
    };

    dataObj = { ...dataObj, worksheet: nextWorksheet };

    await db.run(`UPDATE notifications SET data = ? WHERE id = ? AND user_id = ?`, [
      JSON.stringify(dataObj),
      notificationId,
      userId,
    ]);

    await this.addActivityLogEntry(
      notificationId,
      userId,
      'worksheet_updated',
      'Notification worksheet updated'
    );
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
          `SELECT id, title, status, priority, assigned_to, deadline, description FROM decisions WHERE id = ?`,
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
            dueDate: decision.deadline,
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

    let row:
      | {
          user_id: string;
          global_enabled: number;
          quiet_hours_enabled: number;
          quiet_hours_start: string;
          quiet_hours_end: string;
          email_enabled: number;
          email_digest_enabled: number;
          email_digest_frequency: string;
          type_settings: string;
        }
      | undefined;

    try {
      row = await db.get(`SELECT * FROM notification_preferences WHERE user_id = ?`, [userId]);
    } catch (error: any) {
      // Some production databases predate the optional notification preference
      // table. Missing preferences must not prevent delivery of the notification
      // itself; use the same defaults as a user without a preference row.
      if (error?.code !== '42P01') throw error;
      logger.warn(
        '[NotificationService] notification_preferences table missing; using defaults'
      );
    }

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
          `SELECT id, title, status, priority, assigned_to, deadline FROM decisions WHERE id = ?`,
          [entityId]
        );
        if (decision) {
          result.entityName = decision.title;
          result.entityStatus = decision.status;
          result.entityAssignee = decision.assigned_to;
          result.entityDeadline = decision.deadline;
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
    }>(`SELECT default_channels, icon FROM notification_types WHERE lower(name) = lower(?)`, [
      type,
    ]);

    if (!row) return null;

    return {
      defaultChannels: (() => {
        try {
          const parsed = JSON.parse(row.default_channels || '["in_app"]');
          return Array.isArray(parsed) ? parsed : ['in_app'];
        } catch {
          return ['in_app'];
        }
      })(),
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
    prefs: NotificationPreferences | null,
    options?: {
      bypassPreferences?: boolean;
      bypassQuietHours?: boolean;
    }
  ): Promise<void> {
    const db = await this.getDb();
    const bypassPreferences = Boolean(options?.bypassPreferences);

    const severity = this.computeSeverity(input.type, input.data || input.metadata, input.severity);
    const slackWebhookUrl = await this.getSlackWebhookUrlForOrg(
      input.organizationId,
      input.projectId
    );
    const slackService = slackWebhookUrl
      ? new SlackServiceClass({ webhookUrl: slackWebhookUrl })
      : null;
    const teamsWebhookUrl = await this.getTeamsWebhookUrlForOrg(
      input.organizationId,
      input.projectId
    );

    if (this.shouldAutoSlack(input.type)) {
      if (slackService) {
        logger.debug('[NotificationService] Slack dispatch enabled', {
          type: input.type,
          organizationId: input.organizationId,
        });
      } else {
        logger.warn('[NotificationService] Slack dispatch skipped (no webhook configured)', {
          type: input.type,
          organizationId: input.organizationId,
        });
      }
    }

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
            if (!bypassPreferences && prefs && !prefs.emailEnabled) {
              status = 'skipped';
              break;
            }
            {
              const recipients = await this.resolveNotificationEmailRecipients(input);
              if (recipients.length === 0) {
                status = 'skipped';
                break;
              }
              const subject = `[${severity}] ${input.title}`;
              const html = this.renderEmailNotification(input, severity);
              for (const recipient of recipients) {
                await sendEmail({
                  to: recipient,
                  subject,
                  html,
                });
              }
            }
            break;
          case 'slack':
            if (!slackService) {
              status = 'skipped';
              break;
            }
            await this.sendSlackNotification(slackService, input, severity);
            break;
          case 'teams':
            if (!teamsWebhookUrl) {
              status = 'skipped';
              break;
            }
            await this.sendTeamsNotification(teamsWebhookUrl, input, severity);
            break;
        }

        try {
          await db.run(
            `INSERT INTO notification_delivery_log (id, notification_id, channel, status, sent_at)
                       VALUES (?, ?, ?, ?, ?)`,
            [logId, notificationId, channel, status, new Date().toISOString()]
          );
        } catch {
          // Non-critical: delivery log table may not exist in some schemas
        }
      } catch (error: any) {
        try {
          await db.run(
            `INSERT INTO notification_delivery_log (id, notification_id, channel, status, error_message, failed_at)
                       VALUES (?, ?, ?, 'failed', ?, ?)`,
            [logId, notificationId, channel, error?.message, new Date().toISOString()]
          );
        } catch {
          // ignore
        }
      }
    }

    // Some notification types are expected to always notify Slack (ops/product),
    // even if the notification_types table doesn't include 'slack' in channels.
    // This matches usage in feedback routes ("Triggers Slack via NotificationService").
    if (
      slackService &&
      !channels.includes('slack') &&
      !Array.isArray(input.channels) &&
      this.shouldAutoSlack(input.type)
    ) {
      try {
        await this.sendSlackNotification(slackService, input, severity);
      } catch (e) {
        logger.warn('[NotificationService] Auto-Slack dispatch failed:', e);
      }
    }
  }

  private shouldAutoSlack(type: string): boolean {
    const t = String(type || '').toUpperCase();
    return (
      t === 'CLIENT_TICKET' ||
      t === 'USER_FEEDBACK' ||
      t === 'FEATURE_REQUEST' ||
      t === 'LOW_PULSE_ALERT' ||
      t === 'SYSTEM_ALERT' ||
      t.startsWith('ADMIN_') ||
      (t.includes('AI_') && (t.includes('ALERT') || t.includes('RISK') || t.includes('OVERLOAD')))
    );
  }

  private async resolveNotificationEmailRecipients(
    input: SendNotificationInput
  ): Promise<string[]> {
    const metadataRecipientEmails = Array.isArray(input.metadata?.recipientEmails)
      ? (input.metadata.recipientEmails as unknown[]).map((email) => String(email))
      : [];
    const explicit = [
      ...(Array.isArray(input.recipientEmails) ? input.recipientEmails : []),
      typeof input.recipientEmail === 'string' ? input.recipientEmail : '',
      typeof input.metadata?.recipientEmail === 'string'
        ? String(input.metadata.recipientEmail)
        : '',
      ...metadataRecipientEmails,
    ]
      .map((email) =>
        String(email || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

    if (explicit.length > 0) {
      return Array.from(new Set(explicit));
    }

    try {
      const db = await this.getDb();
      const row = await db.get<{ email?: string | null }>(
        `SELECT email FROM users WHERE id = ? LIMIT 1`,
        [input.userId]
      );
      const email = String(row?.email || '')
        .trim()
        .toLowerCase();
      return email ? [email] : [];
    } catch (error) {
      logger.warn('[NotificationService] Failed to resolve notification recipient email:', error);
      return [];
    }
  }

  private renderEmailNotification(
    input: SendNotificationInput,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ): string {
    const actionUrl = input.actionUrl
      ? `<p><strong>Action:</strong> <a href="${String(input.actionUrl)}">${String(input.actionUrl)}</a></p>`
      : '';
    const metadataHtml =
      input.metadata && Object.keys(input.metadata).length > 0
        ? `<pre>${JSON.stringify(input.metadata, null, 2)}</pre>`
        : '';
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 8px;">${this.escapeHtml(input.title)}</h2>
        <p><strong>Severity:</strong> ${severity}</p>
        <p>${this.escapeHtml(input.body || input.message || input.title)}</p>
        ${actionUrl}
        ${metadataHtml}
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async getSlackWebhookUrlForOrg(
    organizationId: string,
    projectId?: string
  ): Promise<string | null> {
    const decodeHtmlEntities = (value: string): string =>
      value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#96;/g, '`')
        .replace(/&#x2F;/g, '/')
        .replace(/&#x3D;/g, '=');

    const pickMappedWebhook = (cfg: any): string | null => {
      if (!projectId) return null;
      const list =
        cfg?.channelMappings ||
        cfg?.channel_mappings ||
        cfg?.projectMappings ||
        cfg?.project_mappings ||
        [];
      if (!Array.isArray(list)) return null;
      const match = list.find(
        (m: any) => String(m?.projectId || m?.project_id || '') === String(projectId)
      );
      const raw =
        match?.webhookUrl ||
        match?.webhook_url ||
        match?.incomingWebhookUrl ||
        match?.incoming_webhook_url ||
        null;
      return typeof raw === 'string' && raw.trim() ? decodeHtmlEntities(raw).trim() : null;
    };

    // 1) Org-level integration config (legacy schema)
    try {
      const db = await this.getDb();
      const row = await db.get<{ config?: string }>(
        `SELECT config FROM integrations
         WHERE organization_id = ? AND provider = 'slack' AND status = 'connected'
         ORDER BY created_at DESC
         LIMIT 1`,
        [organizationId]
      );
      if (row?.config) {
        try {
          const cfg = JSON.parse(String(row.config || '{}'));
          const mapped = pickMappedWebhook(cfg);
          if (mapped) return mapped;
          const candidates = [
            cfg.webhookUrl,
            cfg.webhook_url,
            cfg.incomingWebhookUrl,
            cfg.incoming_webhook_url,
            cfg?.webhook?.url,
            cfg?.incoming_webhook?.url,
          ]
            .map((x) => (typeof x === 'string' ? decodeHtmlEntities(x).trim() : ''))
            .filter(Boolean);
          if (candidates.length > 0) return candidates[0];
        } catch {
          // ignore invalid JSON config
        }
      }
    } catch {
      // ignore (schema may differ between deployments)
    }

    // 1a) New integrations system schema: integrations(provider_id/settings/status) + integration_providers(name='slack')
    try {
      const db = await this.getDb();
      const row = await db.get<{
        settings?: string | null;
        notification_settings?: string | null;
        provider_id?: string | null;
        provider_name?: string | null;
        status?: string | null;
      }>(
        `
        SELECT
          i.settings,
          i.notification_settings,
          i.provider_id,
          i.status,
          p.name as provider_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.organization_id = ?
          AND (p.name = 'slack' OR i.provider_id = 'int-slack' OR i.provider_id = 'slack')
          AND (i.status IS NULL OR i.status IN ('active', 'connected'))
        ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
        LIMIT 1
      `,
        [organizationId]
      );

      const parseCandidates = (raw?: string | null): string[] => {
        if (!raw) return [];
        try {
          const cfg = JSON.parse(String(raw || '{}'));
          const mapped = pickMappedWebhook(cfg);
          if (mapped) return [mapped];
          return [
            cfg.webhookUrl,
            cfg.webhook_url,
            cfg.incomingWebhookUrl,
            cfg.incoming_webhook_url,
            cfg?.webhook?.url,
            cfg?.incoming_webhook?.url,
            cfg?.incoming_webhook,
            cfg?.webhook,
          ]
            .map((x) => (typeof x === 'string' ? decodeHtmlEntities(x).trim() : ''))
            .filter(Boolean);
        } catch {
          return [];
        }
      };

      const candidates = [
        ...parseCandidates(row?.settings || null),
        ...parseCandidates(row?.notification_settings || null),
      ];
      if (candidates.length > 0) return candidates[0];
    } catch {
      // ignore
    }

    // 1b) Minimal SQLite schema: integrations(type, config, is_active)
    try {
      const db = await this.getDb();
      const row = await db.get<{ type?: string; config?: string; is_active?: number }>(
        `SELECT type, config, is_active FROM integrations
         WHERE organization_id = ? AND is_active = 1
         ORDER BY created_at DESC
         LIMIT 5`,
        [organizationId]
      );
      if (row) {
        const t = String(row.type || '').toLowerCase();
        if (t.includes('slack') && row.config) {
          try {
            const cfg = JSON.parse(String(row.config || '{}'));
            const candidates = [
              cfg.webhookUrl,
              cfg.webhook_url,
              cfg.incomingWebhookUrl,
              cfg.incoming_webhook_url,
              cfg?.webhook?.url,
              cfg?.incoming_webhook?.url,
            ]
              .map((x) => (typeof x === 'string' ? decodeHtmlEntities(x).trim() : ''))
              .filter(Boolean);
            if (candidates.length > 0) return candidates[0];
          } catch {
            // ignore invalid JSON
          }
        }
      }
    } catch {
      // ignore
    }

    // 2) Global env fallback
    const envName = String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const envUrl = process.env[`SLACK_WEBHOOK_URL_${envName}`] || process.env.SLACK_WEBHOOK_URL;
    if (envUrl && String(envUrl).trim()) return String(envUrl).trim();
    return null;
  }

  private async getTeamsWebhookUrlForOrg(
    organizationId: string,
    projectId?: string
  ): Promise<string | null> {
    const decodeHtmlEntities = (value: string): string =>
      value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#96;/g, '`')
        .replace(/&#x2F;/g, '/')
        .replace(/&#x3D;/g, '=');

    const pickMappedWebhook = (cfg: any): string | null => {
      if (!projectId) return null;
      const list =
        cfg?.channelMappings ||
        cfg?.channel_mappings ||
        cfg?.projectMappings ||
        cfg?.project_mappings ||
        [];
      if (!Array.isArray(list)) return null;
      const match = list.find(
        (m: any) => String(m?.projectId || m?.project_id || '') === String(projectId)
      );
      const raw =
        match?.webhookUrl ||
        match?.webhook_url ||
        match?.incomingWebhookUrl ||
        match?.incoming_webhook_url ||
        null;
      return typeof raw === 'string' && raw.trim() ? decodeHtmlEntities(raw).trim() : null;
    };

    // 1) New integrations system schema (preferred): integrations(provider_id/settings/status) + integration_providers(name='microsoft_teams')
    try {
      const db = await this.getDb();
      const row = await db.get<{
        settings?: string | null;
        notification_settings?: string | null;
        provider_id?: string | null;
        status?: string | null;
        provider_name?: string | null;
      }>(
        `
        SELECT
          i.settings,
          i.notification_settings,
          i.provider_id,
          i.status,
          p.name as provider_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.organization_id = ?
          AND (p.name = 'microsoft_teams' OR p.name = 'teams' OR i.provider_id IN ('int-teams', 'teams', 'microsoft_teams'))
          AND (i.status IS NULL OR i.status IN ('active', 'connected'))
        ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
        LIMIT 1
      `,
        [organizationId]
      );

      const parseCandidates = (raw?: string | null): string[] => {
        if (!raw) return [];
        try {
          const cfg = JSON.parse(String(raw || '{}'));
          const mapped = pickMappedWebhook(cfg);
          if (mapped) return [mapped];
          return [
            cfg.webhookUrl,
            cfg.webhook_url,
            cfg.incomingWebhookUrl,
            cfg.incoming_webhook_url,
            cfg?.webhook?.url,
            cfg?.incoming_webhook?.url,
            cfg?.incoming_webhook,
            cfg?.webhook,
          ]
            .map((x) => (typeof x === 'string' ? decodeHtmlEntities(x).trim() : ''))
            .filter(Boolean);
        } catch {
          return [];
        }
      };

      const candidates = [
        ...parseCandidates(row?.settings || null),
        ...parseCandidates(row?.notification_settings || null),
      ];
      if (candidates.length > 0) return candidates[0];
    } catch {
      // ignore
    }

    // 2) Legacy schema fallback: integrations(provider/config/status)
    try {
      const db = await this.getDb();
      const row = await db.get<{ config?: string }>(
        `SELECT config FROM integrations
         WHERE organization_id = ? AND (provider = 'teams' OR provider = 'microsoft_teams') AND status IN ('connected', 'active')
         ORDER BY created_at DESC
         LIMIT 1`,
        [organizationId]
      );
      if (row?.config) {
        try {
          const cfg = JSON.parse(String(row.config || '{}'));
          const mapped = pickMappedWebhook(cfg);
          if (mapped) return mapped;
          const candidates = [
            cfg.webhookUrl,
            cfg.webhook_url,
            cfg.incomingWebhookUrl,
            cfg.incoming_webhook_url,
            cfg?.webhook?.url,
            cfg?.incoming_webhook?.url,
          ]
            .map((x) => (typeof x === 'string' ? decodeHtmlEntities(x).trim() : ''))
            .filter(Boolean);
          if (candidates.length > 0) return candidates[0];
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    // 3) Env fallback
    const envUrl = process.env.TEAMS_WEBHOOK_URL;
    if (envUrl && String(envUrl).trim()) return String(envUrl).trim();
    return null;
  }

  private async sendSlackNotification(
    slackService: SlackServiceClass,
    input: SendNotificationInput,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ): Promise<void> {
    const t = String(input.type || '').toUpperCase();
    const userEmail =
      (typeof input.metadata?.userEmail === 'string' && input.metadata.userEmail) ||
      (typeof input.data?.userEmail === 'string' && (input.data.userEmail as string)) ||
      undefined;

    // Feedback-style notifications
    if (t === 'USER_FEEDBACK' || t === 'FEATURE_REQUEST' || t === 'LOW_PULSE_ALERT') {
      const rawKind =
        (typeof input.metadata?.feedbackType === 'string' && input.metadata.feedbackType) ||
        (typeof input.data?.feedbackType === 'string' && (input.data.feedbackType as string)) ||
        '';
      const kind = String(rawKind || input.title || '').toUpperCase();
      const mappedType =
        kind.includes('BUG') || kind.includes('ERROR')
          ? 'BUG'
          : t === 'FEATURE_REQUEST'
            ? 'FEATURE'
            : 'IMPROVEMENT';

      await slackService.sendNewFeedbackAlert({
        type: mappedType as any,
        userEmail,
        message: input.body || input.message || input.title,
      });
      return;
    }

    // Generic system alert fallback
    await slackService.sendSystemAlert(
      `${input.type}: ${input.title}`,
      input.body || input.message || input.title,
      severity
    );
  }

  private async sendTeamsNotification(
    webhookUrl: string,
    input: SendNotificationInput,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ): Promise<void> {
    try {
      const prefix =
        severity === 'CRITICAL' ? '[CRITICAL]' : severity === 'WARNING' ? '[WARN]' : '[INFO]';
      const title = `${prefix} ${input.type}: ${input.title}`.trim();
      const body = input.body || input.message || '';
      const actionUrl = input.actionUrl;

      // Microsoft Teams Incoming Webhook accepts a simple "text" payload.
      // (We can upgrade to Adaptive Cards later without breaking this contract.)
      const text = actionUrl ? `${title}\n\n${body}\n\n${actionUrl}` : `${title}\n\n${body}`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      logger.warn('[NotificationService] Teams dispatch failed:', err);
      throw err;
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
export const updateWorksheetDraft = (
  notificationId: string,
  userId: string,
  draft: {
    description?: string;
    whyImportant?: string;
    blocked?: string;
    expectedAction?: string;
  }
) => notificationService.updateWorksheetDraft(notificationId, userId, draft);
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
