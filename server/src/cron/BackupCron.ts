/**
 * Backup Cron Job
 *
 * Automated encrypted backups every 15 minutes (internal-beta RPO gate).
 * Also runs retention policy cleanup.
 *
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface BackupService {
  createBackup: (
    type: 'full',
    reason: string,
    options?: { actorId?: string; organizationId?: string; tables?: string[] }
  ) => Promise<{ id: string; [key: string]: unknown }>;
  runRetentionPolicy: () => Promise<{ deleted: number }>;
  reconcileUnboundBackup: (backupId: string, error: string) => Promise<void>;
  claimBackupRun: (input: {
    scheduleName: string;
    scheduledFor: string;
  }) => Promise<{ claimed: boolean; receiptId?: string; leaseToken?: string; fence?: number }>;
  finishBackupRun: (input: {
    receiptId: string;
    leaseToken: string;
    fence: number;
    status: 'COMPLETED' | 'FAILED';
    backupId?: string;
    error?: string;
  }) => Promise<{ status: 'COMPLETED' | 'FAILED' | 'MISSED'; rpoSeconds: number | null }>;
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
  private running = false;
  private idleWaiters: Array<() => void> = [];
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

  async runBackupTick(input: {
    scheduleName: 'internal-beta-15m' | 'manual';
    scheduledFor: string;
    reason?: string;
    type?: 'full';
    options?: { organizationId?: string; actorId?: string; tables?: string[] };
  }): Promise<{ claimed: boolean; backupId?: string; backup?: { id: string; [key: string]: unknown } }> {
    const deps = await this.ensureDeps();
    const claim = await deps.backupService.claimBackupRun(input);
    if (!claim.claimed || !claim.receiptId || !claim.leaseToken || !claim.fence) return { claimed: false };
    if (this.running) {
      await deps.backupService.finishBackupRun({
        receiptId: claim.receiptId, leaseToken: claim.leaseToken, fence: claim.fence,
        status: 'FAILED', error: 'BACKUP_SKIPPED_OVERLAP',
      });
      logger.warn('[BackupCron] Scheduled tick skipped: previous backup is still running');
      return { claimed: false };
    }
    this.running = true;
    const startTime = Date.now();
    let createdBackupId: string | undefined;
    try {
      const scheduled = input.scheduleName === 'internal-beta-15m';
      if (input.type && input.type !== 'full') throw new Error('BACKUP_INCREMENTAL_NOT_IMPLEMENTED');
      const result = await deps.backupService.createBackup(
        'full',
        input.reason || (scheduled ? 'scheduled-rpo-15m' : 'manual'),
        {
          organizationId: input.options?.organizationId,
          tables: input.options?.tables,
          actorId: input.options?.actorId || (scheduled ? 'backup-cron' : 'manual-backup'),
        }
      );
      createdBackupId = result.id;
      const durationMs = Date.now() - startTime;
      const receipt = await deps.backupService.finishBackupRun({
        receiptId: claim.receiptId,
        leaseToken: claim.leaseToken,
        fence: claim.fence,
        status: 'COMPLETED',
        backupId: result.id,
      });
      if (receipt.status === 'MISSED') {
        this.failureCount++;
        this.lastError = new Error('BACKUP_RPO_THRESHOLD_EXCEEDED');
      } else {
        this.successCount++;
        this.failureCount = 0;
        this.lastError = null;
      }
      this.lastBackupTime = new Date();
      try {
        const cleanup = await deps.backupService.runRetentionPolicy();
        logger.info(
          `[BackupCron] Backup completed: ${result.id} (${durationMs}ms); retention deleted ${cleanup.deleted}`
        );
      } catch (error) {
        logger.warn('[BackupCron] Backup completed but retention cleanup failed', error);
      }
      return { claimed: true, backupId: result.id, backup: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.failureCount++;
      this.lastError = err;
      if (createdBackupId) {
        await deps.backupService.reconcileUnboundBackup(createdBackupId, err.message);
      }
      await deps.backupService.finishBackupRun({
        receiptId: claim.receiptId, leaseToken: claim.leaseToken, fence: claim.fence,
        status: 'FAILED', error: err.message,
      }).catch((receiptError) => logger.error('[BackupCron] Failed receipt could not be finalized', receiptError));
      logger.error('[BackupCron] Scheduled backup failed:', err);
      try {
        deps.sentry?.captureException(err, {
          tags: { component: 'backup', job: input.scheduleName, failureCount: String(this.failureCount) },
          extra: { successCount: this.successCount, lastBackupTime: this.lastBackupTime?.toISOString() || null },
        });
      } catch {
        // Observability is non-fatal after the durable FAILED receipt is written.
      }
      if (this.failureCount >= 3) {
        logger.error(`[BackupCron] CRITICAL: ${this.failureCount} consecutive backup failures.`);
      }
      return { claimed: true };
    } finally {
      this.running = false;
      this.idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }

  async waitForIdle(): Promise<void> {
    if (!this.running) return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  /**
   * Trigger manual backup
   */
  async triggerManualBackup(
    reason = 'manual',
    options: {
    type?: 'full';
      organizationId?: string;
      actorId?: string;
      tables?: string[];
    } = {}
  ): Promise<{ id: string; [key: string]: unknown }> {
    const result = await this.runBackupTick({
      scheduleName: 'manual',
      scheduledFor: new Date().toISOString(),
      reason,
      type: options.type || 'full',
      options,
    });
    if (!result.claimed || !result.backupId) throw new Error('BACKUP_RUN_NOT_CLAIMED');
    return result.backup || { id: result.backupId };
  }

  /**
   * Get backup metrics
   */
  getMetrics(): {
    successCount: number;
    failureCount: number;
    lastBackupTime: Date | null;
    lastError: string | null;
    running: boolean;
  } {
    return {
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastBackupTime: this.lastBackupTime,
      lastError: this.lastError?.message || null,
      running: this.running,
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

/** Scheduler is the only lifecycle authority; this export is the shared tick body. */
export const runBackupTick = async (
  input: {
    scheduleName: 'internal-beta-15m' | 'manual';
    scheduledFor: string;
    reason?: string;
      type?: 'full';
    options?: { organizationId?: string; actorId?: string; tables?: string[] };
  },
  deps?: Partial<Dependencies>
) => getBackupCron(deps).runBackupTick(input);

export const waitForBackupIdle = (deps?: Partial<Dependencies>): Promise<void> =>
  getBackupCron(deps).waitForIdle();

/** @deprecated Scheduler.init() is the only supported lifecycle authority. */
export const startBackupJob = (): never => {
  throw new Error('BACKUP_LIFECYCLE_OWNED_BY_SCHEDULER');
};

/** @deprecated Use Scheduler.stop(), which awaits the shared coordinator. */
export const stopBackupJob = (deps?: Partial<Dependencies>): Promise<void> =>
  waitForBackupIdle(deps);

export const triggerManualBackup = async (
  reason: string,
  options?: { type?: 'full'; organizationId?: string; actorId?: string; tables?: string[] },
  deps?: Partial<Dependencies>
): Promise<{ id: string; [key: string]: unknown }> => {
  return getBackupCron(deps).triggerManualBackup(reason, options);
};

export default BackupCron;
