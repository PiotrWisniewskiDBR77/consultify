/**
 * Backup Cron Job
 *
 * Automated encrypted backups every 15 minutes (internal-beta RPO gate).
 * Also runs retention policy cleanup.
 *
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import * as cron from 'node-cron';

import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface BackupService {
  createBackup: (type: 'full' | 'incremental', reason: string) => Promise<{ id: string }>;
  runRetentionPolicy: () => Promise<{ deleted: number }>;
  getBackupStatus: () => Promise<{
    total: number;
    lastBackup: string | null;
    nextBackup: string | null;
    failed: number;
    expired: number;
  }>;
}

interface SentryConfig {
  captureException: (
    error: Error,
    options?: { tags?: Record<string, string>; extra?: Record<string, any> }
  ) => void;
}

interface Dependencies {
  backupService: BackupService;
  sentry: SentryConfig;
}

// ==========================================
// BACKUP CRON
// ==========================================

class BackupCron {
  private deps: any;
  private job: cron.ScheduledTask | null = null;
  private backupJob: NodeJS.Timeout | null = null as NodeJS.Timeout | null;
  private successCount = 0;
  private failureCount = 0;
  private lastBackupTime: Date | null = null;
  private lastError: Error | null = null;

  constructor(deps?: Partial<Dependencies>) {
    this.deps = deps || {};
  }

  private async ensureDeps(): Promise<Dependencies> {
    if (!this.deps.backupService) {
      // T7b-2 (2026-07-19): backupService now has a REAL implementation (logical JSON export
      // + manifest) — was a dead self-import wrapper (finding_42_self_import_wrappers_services_2026-07-15).
      this.deps.backupService = await import('../services/backupService.js').then(
        (m) => m.default || m
      );
    }
    return this.deps as Dependencies;
  }

  /**
   * Start the backup cron job
   */
  startBackupJob(): void {
    if (process.env.DISABLE_BACKUP_CRON === 'true') {
      logger.info('[BackupCron] Disabled via environment variable');
      return;
    }

    // Every 15 minutes: maximum scheduled RPO is 15 minutes.
    this.job = cron.schedule(
      '*/15 * * * *',
      async () => {
        const deps = await this.ensureDeps();
        logger.info('[BackupCron] Starting scheduled backup...');

        try {
          const startTime = Date.now();

          // Create backup
          const result = await deps.backupService.createBackup('incremental', 'scheduled-rpo-15m');
          const duration = Date.now() - startTime;

          this.successCount++;
          this.lastBackupTime = new Date();
          this.lastError = null;

          logger.info(`[BackupCron] Backup completed: ${result.id} (${duration}ms)`);

          // Run retention policy
          const cleanup = await deps.backupService.runRetentionPolicy();
          logger.info(`[BackupCron] Cleanup: deleted ${cleanup.deleted} old backups`);

          // Log metrics
          logger.info(
            `[BackupCron] Metrics: success=${this.successCount}, failures=${this.failureCount}`
          );
        } catch (error: any) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.failureCount++;
          this.lastError = err;

          logger.error('[BackupCron] Scheduled backup failed:', err);

          // Report to Sentry if available
          if (deps.sentry) {
            try {
              deps.sentry.captureException(err, {
                tags: {
                  component: 'backup',
                  job: 'scheduled',
                  failureCount: String(this.failureCount),
                },
                extra: {
                  successCount: this.successCount,
                  lastBackupTime: this.lastBackupTime?.toISOString() || null,
                },
              });
            } catch (e: unknown) {
              // Sentry not available
            }
          }

          // Alert if multiple consecutive failures
          if (this.failureCount >= 3) {
            logger.error(
              `[BackupCron] CRITICAL: ${this.failureCount} consecutive backup failures. Manual intervention required.`
            );
          }
        }
      },
      {
        timezone: 'UTC',
      }
    );

    logger.info('[BackupCron] Scheduled encrypted backup every 15 minutes');
  }

  /**
   * Stop the backup cron job
   */
  stopBackupJob(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('[BackupCron] Stopped');
    }
  }

  /**
   * Trigger manual backup
   */
  async triggerManualBackup(reason = 'manual'): Promise<{ id: string }> {
    const deps = await this.ensureDeps();
    logger.info(`[BackupCron] Manual backup triggered: ${reason}`);

    try {
      const result = await deps.backupService.createBackup('full', reason);
      this.successCount++;
      this.lastBackupTime = new Date();
      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.failureCount++;
      this.lastError = err;

      // Report to Sentry
      if (deps.sentry) {
        try {
          deps.sentry.captureException(err, {
            tags: { component: 'backup', job: 'manual', reason },
          });
        } catch (e: unknown) {
          // Sentry not available
        }
      }

      throw err;
    }
  }

  /**
   * Get backup metrics
   */
  getMetrics(): {
    successCount: number;
    failureCount: number;
    lastBackupTime: Date | null;
    lastError: string | null;
  } {
    return {
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastBackupTime: this.lastBackupTime,
      lastError: this.lastError?.message || null,
    };
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: BackupCron | null = null;

export function getBackupCron(deps?: Partial<Dependencies>): BackupCron {
  if (!instance) {
    instance = new BackupCron(deps);
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const startBackupJob = (deps?: Partial<Dependencies>): void => {
  getBackupCron(deps).startBackupJob();
};

export const stopBackupJob = (deps?: Partial<Dependencies>): void => {
  getBackupCron(deps).stopBackupJob();
};

export const triggerManualBackup = async (
  reason: string,
  deps?: Partial<Dependencies>
): Promise<{ id: string }> => {
  return getBackupCron(deps).triggerManualBackup(reason);
};

export default BackupCron;
