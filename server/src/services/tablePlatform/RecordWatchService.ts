/**
 * Table Platform Record Watch Service
 * Subscribe to record changes and notify watchers on updates/deletes.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import notificationInboxService from './NotificationInboxService.js';

export interface RecordWatch {
  id: string;
  record_id: string;
  table_id: string;
  user_id: string;
  created_at: string;
}

export interface ChangeEvent {
  action: 'update' | 'delete';
  recordId: string;
  tableId: string;
  actorId?: string;
  changes?: Record<string, unknown>;
}

export interface WatchNotification {
  id: string;
  record_id: string;
  table_id: string;
  user_id: string;
  event_type: string;
  actor_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

const recordWatchService = {
  async watchRecord(recordId: string, tableId: string, userId: string): Promise<RecordWatch> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `INSERT INTO tp_record_watches (record_id, table_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (record_id, user_id) DO NOTHING
         RETURNING *`,
        [recordId, tableId, userId]
      );
      if (result.rows.length === 0) {
        const existing = await db.query(
          'SELECT * FROM tp_record_watches WHERE record_id = $1 AND user_id = $2',
          [recordId, userId]
        );
        return existing.rows[0] as RecordWatch;
      }
      return result.rows[0] as RecordWatch;
    } catch (e) {
      logger.error('[RecordWatchService] watchRecord failed', {
        recordId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async unwatchRecord(recordId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'DELETE FROM tp_record_watches WHERE record_id = $1 AND user_id = $2',
        [recordId, userId]
      );
      return (result as any).rowCount > 0;
    } catch (e) {
      logger.error('[RecordWatchService] unwatchRecord failed', {
        recordId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async isWatching(recordId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT 1 FROM tp_record_watches WHERE record_id = $1 AND user_id = $2',
        [recordId, userId]
      );
      return result.rows.length > 0;
    } catch (e) {
      logger.error('[RecordWatchService] isWatching failed', {
        recordId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getWatchers(recordId: string): Promise<RecordWatch[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_record_watches WHERE record_id = $1 ORDER BY created_at ASC',
        [recordId]
      );
      return result.rows as RecordWatch[];
    } catch (e) {
      logger.error('[RecordWatchService] getWatchers failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async notifyWatchers(recordId: string, changeEvent: ChangeEvent): Promise<void> {
    const db = getDatabase();
    try {
      const watchers = await this.getWatchers(recordId);
      if (watchers.length === 0) return;

      // Resolve org_id + base_id once (best-effort) for the inbox read-model.
      let orgId: string | null = null;
      let baseId: string | null = null;
      try {
        const ctx = await db.query(
          `SELECT b.organization_id AS org_id, t.base_id AS base_id
           FROM tp_tables t
           JOIN tp_bases b ON b.id = t.base_id
           WHERE t.id = $1`,
          [changeEvent.tableId]
        );
        const row = ctx.rows[0] as { org_id?: string; base_id?: string } | undefined;
        orgId = row?.org_id ?? null;
        baseId = row?.base_id ?? null;
      } catch (ctxErr) {
        logger.warn('[RecordWatchService] failed to resolve org/base for notification', {
          recordId,
          tableId: changeEvent.tableId,
          error: (ctxErr as Error).message,
        });
      }

      for (const watcher of watchers) {
        if (watcher.user_id === changeEvent.actorId) continue;

        try {
          await db.query(
            `INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              `watch_${changeEvent.action}`,
              'record',
              recordId,
              changeEvent.actorId ?? null,
              JSON.stringify({
                table_id: changeEvent.tableId,
                notified_user: watcher.user_id,
                changes: changeEvent.changes ?? {},
              }),
            ]
          );
        } catch (notifyErr) {
          logger.warn('[RecordWatchService] failed to create notification for watcher', {
            recordId,
            userId: watcher.user_id,
            error: (notifyErr as Error).message,
          });
        }

        // Readable inbox row (best-effort; never throws to the caller).
        if (orgId) {
          await notificationInboxService.create({
            orgId,
            userId: watcher.user_id,
            type: 'record_changed',
            baseId,
            tableId: changeEvent.tableId,
            recordId,
            payload: {
              action: changeEvent.action,
              actorId: changeEvent.actorId ?? null,
              changes: changeEvent.changes ?? {},
            },
          });
        }
      }

      logger.info('[RecordWatchService] notified watchers', {
        recordId,
        watcherCount: watchers.length,
        action: changeEvent.action,
      });
    } catch (e) {
      logger.error('[RecordWatchService] notifyWatchers failed', {
        recordId,
        error: (e as Error).message,
      });
    }
  },
};

export default recordWatchService;
