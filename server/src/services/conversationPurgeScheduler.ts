/**
 * Conversation Purge Scheduler
 *
 * Automatically hard-deletes conversations that have been soft-deleted
 * past the grace window. Writes audit trail before purging.
 *
 * Config via environment:
 *   PURGE_GRACE_DAYS   – days after soft-delete before hard purge (default: 30)
 *   PURGE_INTERVAL_MS  – scheduler tick interval in ms (default: 3600000 = 1h)
 *   PURGE_BATCH_SIZE   – max conversations purged per tick (default: 100)
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const GRACE_DAYS = parseInt(process.env.PURGE_GRACE_DAYS || '30', 10);
const INTERVAL_MS = parseInt(process.env.PURGE_INTERVAL_MS || '3600000', 10);
const BATCH_SIZE = parseInt(process.env.PURGE_BATCH_SIZE || '100', 10);

let timer: ReturnType<typeof setInterval> | null = null;

async function purgeExpiredConversations(): Promise<number> {
  try {
    const rows = (await dbAll(
      `SELECT c.id, c.user_id, c.organization_id, c.title, c.deleted_at,
              (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.deleted_at IS NOT NULL
         AND c.deleted_at < NOW() - INTERVAL '${GRACE_DAYS} days'
       LIMIT $1`,
      [BATCH_SIZE]
    )) as Array<{
      id: string;
      user_id: string;
      organization_id: string | null;
      title: string | null;
      deleted_at: string;
      message_count: number;
    }>;

    if (!rows || rows.length === 0) return 0;

    let purged = 0;
    for (const row of rows) {
      try {
        const titleHash = row.title
          ? Buffer.from(row.title).toString('base64').slice(0, 64)
          : null;

        await dbRun(
          `INSERT INTO conversation_purge_audit (id, conversation_id, purged_by_user_id, organization_id, message_count, title_hash, purged_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), row.id, row.user_id, row.organization_id, row.message_count, titleHash, new Date().toISOString()]
        );

        await dbRun('DELETE FROM conversation_messages WHERE conversation_id = $1', [row.id]);
        await dbRun('DELETE FROM conversations WHERE id = $1', [row.id]);
        purged++;
      } catch (err) {
        logger.error(`[PurgeScheduler] Failed to purge conversation ${row.id}:`, err as Error);
      }
    }

    if (purged > 0) {
      logger.info(`[PurgeScheduler] Purged ${purged} conversations past ${GRACE_DAYS}-day grace window`);
    }
    return purged;
  } catch (err) {
    logger.error('[PurgeScheduler] Tick failed:', err as Error);
    return 0;
  }
}

export function startPurgeScheduler(): void {
  if (timer) return;

  logger.info(`[PurgeScheduler] Starting — grace=${GRACE_DAYS}d, interval=${INTERVAL_MS}ms, batch=${BATCH_SIZE}`);

  setTimeout(() => {
    void purgeExpiredConversations();
  }, 30_000);

  timer = setInterval(() => {
    void purgeExpiredConversations();
  }, INTERVAL_MS);
}

export function stopPurgeScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('[PurgeScheduler] Stopped');
  }
}

export default { startPurgeScheduler, stopPurgeScheduler };
