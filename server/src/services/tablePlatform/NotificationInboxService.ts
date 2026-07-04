/**
 * Table Platform Notification Inbox Service
 *
 * Read-side for notifications that RecordWatchService (watch_update/watch_delete)
 * and RecordCommentService (@mentions) write into `tp_audit_events`. Both
 * producers were write-only before this service existed — rows landed in
 * tp_audit_events with the recipient buried in `metadata.notified_user` (or not
 * recorded at all for mentions) and nothing ever read them back per-user.
 *
 * This service reads rows scoped by the first-class `notified_user_id` column
 * (migration 039_tp_notifications_inbox.sql) rather than reaching into
 * `metadata` JSON, so the inbox query can use a plain indexed WHERE clause.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface InboxNotification {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

function parseMetadata(val: unknown): Record<string, unknown> {
  if (val == null) return {};
  if (typeof val === 'object') return val as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(val));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mapRow(row: Record<string, any>): InboxNotification {
  return {
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id ?? null,
    metadata: parseMetadata(row.metadata),
    read: row.read_at != null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

const notificationInboxService = {
  /**
   * List notifications addressed to `userId` (notified_user_id = userId),
   * newest first. Paginated the same way as other table-platform list
   * endpoints (limit/offset + total count).
   */
  async listForUser(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<{ notifications: InboxNotification[]; total: number; unread: number }> {
    const db = getDatabase();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    try {
      const unreadFilter = options?.unreadOnly ? ' AND read_at IS NULL' : '';

      const [rowsResult, totalResult, unreadResult] = await Promise.all([
        db.query(
          `SELECT id, event_type, entity_type, entity_id, actor_id, metadata, read_at, created_at
           FROM tp_audit_events
           WHERE notified_user_id = $1${unreadFilter}
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        ),
        db.query(
          `SELECT COUNT(*) AS total FROM tp_audit_events WHERE notified_user_id = $1${unreadFilter}`,
          [userId]
        ),
        db.query(
          `SELECT COUNT(*) AS unread FROM tp_audit_events WHERE notified_user_id = $1 AND read_at IS NULL`,
          [userId]
        ),
      ]);

      const total = parseInt(String((totalResult.rows[0] as any)?.total ?? '0'), 10);
      const unread = parseInt(String((unreadResult.rows[0] as any)?.unread ?? '0'), 10);

      return {
        notifications: rowsResult.rows.map((r: any) => mapRow(r)),
        total,
        unread,
      };
    } catch (e) {
      logger.error('[NotificationInboxService] listForUser failed', {
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT COUNT(*) AS unread FROM tp_audit_events WHERE notified_user_id = $1 AND read_at IS NULL`,
        [userId]
      );
      return parseInt(String((result.rows[0] as any)?.unread ?? '0'), 10);
    } catch (e) {
      logger.error('[NotificationInboxService] getUnreadCount failed', {
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  /**
   * Mark a single notification as read. Scoped to `notified_user_id = userId`
   * so a user cannot mark someone else's notification as read. Returns false
   * if no matching row was found (wrong id, wrong owner, or already-deleted).
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `UPDATE tp_audit_events
         SET read_at = NOW()
         WHERE id = $1 AND notified_user_id = $2 AND read_at IS NULL
         RETURNING id`,
        [notificationId, userId]
      );
      if (result.rows.length > 0) return true;

      // Idempotent: if it exists and already belongs to the user (just already
      // read), treat as success rather than a 404.
      const existing = await db.query(
        `SELECT id FROM tp_audit_events WHERE id = $1 AND notified_user_id = $2`,
        [notificationId, userId]
      );
      return existing.rows.length > 0;
    } catch (e) {
      logger.error('[NotificationInboxService] markAsRead failed', {
        notificationId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async markAllAsRead(userId: string): Promise<number> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `UPDATE tp_audit_events SET read_at = NOW() WHERE notified_user_id = $1 AND read_at IS NULL`,
        [userId]
      );
      return (result as any).rowCount ?? 0;
    } catch (e) {
      logger.error('[NotificationInboxService] markAllAsRead failed', {
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default notificationInboxService;
