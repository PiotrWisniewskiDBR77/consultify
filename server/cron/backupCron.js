/**
 * Backup Cron Job
 * 
 * Automated daily backups at 3 AM UTC.
 * Also runs retention policy cleanup.
 */

const cron = require('node-cron');
const BackupService = require('../services/backupService');

let backupJob = null;

/**
 * Start the backup cron job
 */
function startBackupJob() {
    if (process.env.DISABLE_BACKUP_CRON === 'true') {
        console.log('[BackupCron] Disabled via environment variable');
        return;
    }

    // Daily at 3 AM UTC
    backupJob = cron.schedule('0 3 * * *', async () => {
        console.log('[BackupCron] Starting scheduled backup...');

        try {
            // Create backup
            const result = await BackupService.createBackup('full', 'scheduled');
            console.log(`[BackupCron] Backup completed: ${result.id}`);

            // Run retention policy
            const cleanup = await BackupService.runRetentionPolicy();
            console.log(`[BackupCron] Cleanup: deleted ${cleanup.deleted} old backups`);

        } catch (error) {
            console.error('[BackupCron] Scheduled backup failed:', error);

            // Report to Sentry if available
            try {
                const { captureException } = require('../config/sentry');
                captureException(error, {
                    tags: { component: 'backup', job: 'scheduled' }
                });
            } catch (e) {
                // Sentry not available
            }
        }
    }, {
        timezone: 'UTC'
    });

    console.log('[BackupCron] Scheduled daily backup at 3:00 AM UTC');
}

/**
 * Stop the backup cron job
 */
function stopBackupJob() {
    if (backupJob) {
        backupJob.stop();
        backupJob = null;
        console.log('[BackupCron] Stopped');
    }
}

/**
 * Trigger manual backup
 */
async function triggerManualBackup(reason = 'manual') {
    console.log(`[BackupCron] Manual backup triggered: ${reason}`);
    return BackupService.createBackup('full', reason);
}

module.exports = {
    startBackupJob,
    stopBackupJob,
    triggerManualBackup,
};
