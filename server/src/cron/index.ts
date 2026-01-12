/**
 * Cron Jobs Index
 * Central export for all cron jobs
 *
 * Enterprise SaaS Architecture - TypeScript Backend
 */

export {
    default as BackupCron,
    getBackupCron,
    startBackupJob,
    stopBackupJob,
    triggerManualBackup,
} from './BackupCron.js';
export {
    default as BillingCron,
    calculateMonthlyUsage,
    checkAndTriggerAlerts,
    generatePayAsYouGoInvoices,
    getBillingCron,
    resetMonthlyBudgets,
    updateSeatCounts,
} from './BillingCron.js';
export {
    cleanupRevokedTokens,
    default as CleanupRevokedTokensCron,
    getCleanupRevokedTokensCron,
    startCleanupJob,
    stopCleanupJob,
} from './CleanupRevokedTokens.js';
export { default as DunningCron, getDunningCron, startDunningJob, stopDunningJob } from './DunningCron.js';
export { getHealthCheckJob, default as HealthCheckJob, startHealthCheck } from './HealthCheckJob.js';
import Scheduler from './Scheduler.js';
export { default as Scheduler } from './Scheduler.js';
export const initScheduler = () => Scheduler.init();
export const getScheduler = () => Scheduler;
export { getSnapshotMetricsCron, initMetricsSnapshotJob, default as SnapshotMetricsCron } from './SnapshotMetrics.js';
export { cleanupOldUsageCounters, getTrialCron, runDailyTrialTasks, default as TrialCron } from './TrialCron.js';

