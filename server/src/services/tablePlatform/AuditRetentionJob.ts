/**
 * Table Platform Audit Retention Job
 * Periodic cleanup of expired audit events and old snapshots.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export class AuditRetentionJob {
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Purge audit events older than retentionDays.
   * Preserves snapshot_created and schema_version_created events.
   */
  async purgeExpiredEvents(retentionDays: number = 90): Promise<{ deleted: number }> {
    const db = getDatabase();
    const result = await db.query(
      `DELETE FROM tp_audit_events
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       AND event_type NOT IN ('snapshot_created', 'schema_version_created')
       RETURNING id`,
      [retentionDays]
    );
    return { deleted: result.rowCount || 0 };
  }

  /**
   * Purge old snapshots, keeping the most recent N per table/base entity.
   */
  async purgeOldSnapshots(keepPerTable: number = 10): Promise<{ deleted: number }> {
    const db = getDatabase();
    const result = await db.query(
      `DELETE FROM tp_audit_events
       WHERE event_type = 'snapshot'
       AND id NOT IN (
         SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY created_at DESC) as rn
           FROM tp_audit_events WHERE event_type = 'snapshot'
         ) ranked WHERE rn <= $1
       )
       RETURNING id`,
      [keepPerTable]
    );
    return { deleted: result.rowCount || 0 };
  }

  start(): void {
    this.runAll().catch((err) =>
      logger.error('[AuditRetention] Error on initial run', { error: (err as Error).message })
    );

    this.intervalId = setInterval(
      () => {
        this.runAll().catch((err) =>
          logger.error('[AuditRetention] Error on scheduled run', { error: (err as Error).message })
        );
      },
      24 * 60 * 60 * 1000
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async runAll(): Promise<void> {
    logger.info('[AuditRetention] Starting cleanup...');
    const events = await this.purgeExpiredEvents();
    const snapshots = await this.purgeOldSnapshots();
    logger.info(`[AuditRetention] Purged ${events.deleted} events, ${snapshots.deleted} snapshots`);
  }
}

export const auditRetentionJob = new AuditRetentionJob();
