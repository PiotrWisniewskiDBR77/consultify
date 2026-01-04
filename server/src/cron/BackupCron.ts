/**
 * Backup Cron Job
 * 
 * Automated daily backups at 3 AM UTC.
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
}

interface SentryConfig {
    captureException: (error: Error, options?: { tags?: Record<string, string> }) => void;
}

interface Dependencies {
    backupService: BackupService;
    sentry?: SentryConfig;
}

// ==========================================
// BACKUP CRON
// ==========================================

class BackupCron {
    private deps: Dependencies;
    private job: cron.ScheduledTask | null = null;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            backupService: deps?.backupService,
            sentry: deps?.sentry,
        };
    }

    private async ensureDeps(): Promise<Dependencies> {
        if (!this.deps.backupService) {
            this.deps.backupService = await import('../../services/backupService.js').then(m => m.default || m);
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

        // Daily at 3 AM UTC
        this.job = cron.schedule('0 3 * * *', async () => {
            const deps = await this.ensureDeps();
            logger.info('[BackupCron] Starting scheduled backup...');

            try {
                // Create backup
                const result = await deps.backupService.createBackup('full', 'scheduled');
                logger.info(`[BackupCron] Backup completed: ${result.id}`);

                // Run retention policy
                const cleanup = await deps.backupService.runRetentionPolicy();
                logger.info(`[BackupCron] Cleanup: deleted ${cleanup.deleted} old backups`);

            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error('[BackupCron] Scheduled backup failed:', err);

                // Report to Sentry if available
                if (deps.sentry) {
                    try {
                        deps.sentry.captureException(err, {
                            tags: { component: 'backup', job: 'scheduled' },
                        });
                    } catch (e: unknown) {
                        // Sentry not available
                    }
                }
            }
        }, {
            timezone: 'UTC',
        });

        logger.info('[BackupCron] Scheduled daily backup at 3:00 AM UTC');
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
        return deps.backupService.createBackup('full', reason);
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

export const triggerManualBackup = async (reason: string, deps?: Partial<Dependencies>): Promise<{ id: string }> => {
    return getBackupCron(deps).triggerManualBackup(reason);
};

export default BackupCron;




