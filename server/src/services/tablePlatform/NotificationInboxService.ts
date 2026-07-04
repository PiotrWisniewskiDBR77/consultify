/**
 * Table Platform Notification Inbox Service (P7).
 *
 * Read-model over record-watch / mention events. Writers (RecordWatchService,
 * RecordCommentService) INSERT rows here; users READ their own inbox via the
 * table-platform routes.
 *
 * CRITICAL: every read/mutation is BOTH org-scoped AND user-scoped. A user may
 * only ever see or mutate notifications addressed to themselves. This is the
 * IDOR guard — do not relax the `user_id = $userId` predicate.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export type NotificationType = 'record_changed' | 'mention' | 'watch';

export interface TpNotification {
  id: string;
  org_id: string;
  user_id: string;
  base_id: string | null;
  table_id: string | null;
  record_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  orgId: string;
  userId: string;
  type: NotificationType;
  baseId?: string | null;
  tableId?: string | null;
  recordId?: string | null;
  payload?: Record<string, unknown>;
}

export interface ListOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListResult {
  notifications: TpNotification[];
  total: number;
  unreadCount: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit as number)) return DEFAULT_LIMIT;
  const n = Math.floor(limit as number);
  if (n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function clampOffset(offset?: number): number {
  if (!Number.isFinite(offset as number)) return 0;
  const n = Math.floor(offset as number);
  return n < 0 ? 0 : n;
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function mapRow(row: Record<string, unknown>): TpNotification {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    user_id: String(row.user_id),
    base_id: (row.base_id as string | null) ?? null,
    table_id: (row.table_id as string | null) ?? null,
    record_id: (row.record_id as string | null) ?? null,
    type: String(row.type),
    payload: parsePayload(row.payload),
    read_at: (row.read_at as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

const notificationInboxService = {
  /**
   * Insert one notification. Silently no-ops (logs warn) on missing required
   * identifiers so a notification failure never breaks the parent mutation.
   */
  async create(input: CreateNotificationInput): Promise<TpNotification | null> {
    const { orgId, userId, type } = input;
    if (!orgId || !userId || !type) {
      logger.warn('[NotificationInboxService] create skipped: missing org/user/type', {
        orgId,
        userId,
        type,
      });
      return null;
    }
    const db = getDatabase();
    try {
      const result = await db.query(
        `INSERT INTO tp_notifications
           (org_id, user_id, base_id, table_id, record_id, type, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          orgId,
          userId,
          input.baseId ?? null,
          input.tableId ?? null,
          input.recordId ?? null,
          type,
          JSON.stringify(input.payload ?? {}),
        ]
      );
      return result.rows.length ? mapRow(result.rows[0] as Record<string, unknown>) : null;
    } catch (e) {
      logger.error('[NotificationInboxService] create failed', {
        orgId,
        userId,
        type,
        error: (e as Error).message,
      });
      return null;
    }
  },

  /**
   * List a single user's notifications within their org. Returns the page plus
   * total (matching the filter) and unreadCount (always the full unread total,
   * regardless of the unreadOnly / paging filter).
   */
  async listForUser(orgId: string, userId: string, opts: ListOptions = {}): Promise<ListResult> {
    if (!orgId || !userId) {
      return { notifications: [], total: 0, unreadCount: 0 };
    }
    const db = getDatabase();
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const unreadOnly = opts.unreadOnly === true;

    try {
      const filterSql = unreadOnly ? 'AND read_at IS NULL' : '';

      const listResult = await db.query(
        `SELECT * FROM tp_notifications
         WHERE org_id = $1 AND user_id = $2 ${filterSql}
         ORDER BY read_at IS NULL DESC, created_at DESC
         LIMIT $3 OFFSET $4`,
        [orgId, userId, limit, offset]
      );

      const totalResult = await db.query(
        `SELECT COUNT(*)::text AS total FROM tp_notifications
         WHERE org_id = $1 AND user_id = $2 ${filterSql}`,
        [orgId, userId]
      );
      const total = parseInt(String((totalResult.rows[0] as { total?: string })?.total ?? '0'), 10);

      const unreadResult = await db.query(
        `SELECT COUNT(*)::text AS cnt FROM tp_notifications
         WHERE org_id = $1 AND user_id = $2 AND read_at IS NULL`,
        [orgId, userId]
      );
      const unreadCount = parseInt(
        String((unreadResult.rows[0] as { cnt?: string })?.cnt ?? '0'),
        10
      );

      return {
        notifications: (listResult.rows as Record<string, unknown>[]).map(mapRow),
        total,
        unreadCount,
      };
    } catch (e) {
      logger.error('[NotificationInboxService] listForUser failed', {
        orgId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getUnreadCount(orgId: string, userId: string): Promise<number> {
    if (!orgId || !userId) return 0;
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT COUNT(*)::text AS cnt FROM tp_notifications
         WHERE org_id = $1 AND user_id = $2 AND read_at IS NULL`,
        [orgId, userId]
      );
      return parseInt(String((result.rows[0] as { cnt?: string })?.cnt ?? '0'), 10);
    } catch (e) {
      logger.error('[NotificationInboxService] getUnreadCount failed', {
        orgId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  /**
   * Mark a single notification read. Scoped to (id, org, user) so a user can
   * only ever mark their OWN notification read (IDOR guard). Returns false if
   * no row matched — either it doesn't exist or belongs to someone else.
   */
  async markRead(notificationId: string, orgId: string, userId: string): Promise<boolean> {
    if (!notificationId || !orgId || !userId) return false;
    const db = getDatabase();
    try {
      const result = await db.query(
        `UPDATE tp_notifications
         SET read_at = now()
         WHERE id = $1 AND org_id = $2 AND user_id = $3 AND read_at IS NULL`,
        [notificationId, orgId, userId]
      );
      if (((result as { rowCount?: number }).rowCount ?? 0) > 0) return true;

      // Distinguish "already read (still yours)" from "not yours / missing".
      const exists = await db.query(
        `SELECT 1 FROM tp_notifications WHERE id = $1 AND org_id = $2 AND user_id = $3`,
        [notificationId, orgId, userId]
      );
      return exists.rows.length > 0;
    } catch (e) {
      logger.error('[NotificationInboxService] markRead failed', {
        notificationId,
        orgId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  /**
   * Mark every unread notification for this user read. Returns the number of
   * rows flipped. Org + user scoped.
   */
  async markAllRead(orgId: string, userId: string): Promise<number> {
    if (!orgId || !userId) return 0;
    const db = getDatabase();
    try {
      const result = await db.query(
        `UPDATE tp_notifications
         SET read_at = now()
         WHERE org_id = $1 AND user_id = $2 AND read_at IS NULL`,
        [orgId, userId]
      );
      return (result as { rowCount?: number }).rowCount ?? 0;
    } catch (e) {
      logger.error('[NotificationInboxService] markAllRead failed', {
        orgId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default notificationInboxService;
