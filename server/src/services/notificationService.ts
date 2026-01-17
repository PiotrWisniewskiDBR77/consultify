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
  icon?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  readAt?: string;
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
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
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

    // Save notification
    await db.run(
      `INSERT INTO notifications (
                id, user_id, organization_id, type, title, body, icon,
                priority, entity_type, entity_id, action_url,
                actor_id, actor_name, metadata, channels_sent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.organizationId,
        input.type,
        input.title,
        input.body,
        typeConfig?.icon || null,
        input.priority || 'normal',
        input.entityType || null,
        input.entityId || null,
        input.actionUrl || null,
        input.actorId || null,
        input.actorName || null,
        JSON.stringify(input.metadata || {}),
        JSON.stringify(channels),
        now,
      ]
    );

    // Dispatch to channels
    await this.dispatchToChannels(id, input, channels, prefs);

    logger.info(
      `[NotificationService] Sent notification ${id} type=${input.type} to user=${input.userId}`
    );

    return id;
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean; type?: string; projectId?: string }
  ): Promise<Notification[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params: (string | number)[] = [userId];

    if (options?.unreadOnly) {
      query += ` AND read = 0`;
    }

    if (options?.type) {
      query += ` AND type = ?`;
      params.push(options.type);
    }

    if (options?.projectId) {
      query += ` AND entity_id = ? AND entity_type = 'project'`;
      params.push(options.projectId);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await db.all<{
      id: string;
      user_id: string;
      organization_id: string;
      type: string;
      title: string;
      body: string;
      icon: string;
      priority: string;
      entity_type: string;
      entity_id: string;
      action_url: string;
      actor_id: string;
      actor_name: string;
      read: number;
      read_at: string;
      created_at: string;
    }>(query, params);

    return (rows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      organizationId: r.organization_id,
      type: r.type,
      title: r.title,
      body: r.body,
      icon: r.icon,
      priority: r.priority as Notification['priority'],
      entityType: r.entity_type,
      entityId: r.entity_id,
      actionUrl: r.action_url,
      actorId: r.actor_id,
      actorName: r.actor_name,
      isRead: r.read === 1,
      readAt: r.read_at,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const db = await this.getDb();

    const result = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
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
  // PRIVATE HELPERS
  // ==========================================

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
