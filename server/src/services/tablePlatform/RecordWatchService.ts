/**
 * Table Platform Record Watch Service
 * Subscribe to record changes and notify watchers on updates/deletes.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { tablePlatformRealtime } from './RealtimeService.js';

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

      for (const watcher of watchers) {
        if (watcher.user_id === changeEvent.actorId) continue;

        try {
          const eventType = `watch_${changeEvent.action}`;
          const metadata = {
            table_id: changeEvent.tableId,
            notified_user: watcher.user_id,
            changes: changeEvent.changes ?? {},
          };
          const inserted = await db.query(
            `INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, metadata, notified_user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, created_at`,
            [
              eventType,
              'record',
              recordId,
              changeEvent.actorId ?? null,
              JSON.stringify(metadata),
              watcher.user_id,
            ]
          );

          // Realtime push to the watcher's user-room. Fail-soft: emit errors
          // must never roll back or block the notification write above —
          // the row already landed and is readable via the inbox endpoint
          // even if no socket is currently connected for this user.
          try {
            const row = inserted.rows[0] as { id?: string; created_at?: string } | undefined;
            tablePlatformRealtime.notifyUser(watcher.user_id, {
              id: row?.id,
              eventType,
              entityType: 'record',
              entityId: recordId,
              actorId: changeEvent.actorId ?? null,
              metadata,
              createdAt: row?.created_at,
            });
          } catch (emitErr) {
            logger.warn('[RecordWatchService] realtime emit failed (notification still saved)', {
              recordId,
              userId: watcher.user_id,
              error: (emitErr as Error).message,
            });
          }
        } catch (notifyErr) {
          logger.warn('[RecordWatchService] failed to create notification for watcher', {
            recordId,
            userId: watcher.user_id,
            error: (notifyErr as Error).message,
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
