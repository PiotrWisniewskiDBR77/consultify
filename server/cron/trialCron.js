/**
 * Trial/Demo Cron Jobs
 * 
 * Scheduled tasks for:
 * - Demo organization cleanup (24h expiry)
 * - Trial warning notifications (T-7 days)
 * - Trial expiration lockdown
 * - Daily usage counter resets
 */

const DemoService = require('../services/demoService');
const TrialService = require('../services/trialService');

/**
 * Run all trial/demo scheduled tasks
 * Call this from main scheduler (daily)
 */
const runDailyTrialTasks = async () => {
    console.log('[TrialCron] Starting daily trial/demo tasks...');

    try {
        // 1. Cleanup expired demo organizations
        const demosCleanedUp = await DemoService.cleanupExpiredDemos();
        console.log(`[TrialCron] Cleaned up ${demosCleanedUp} expired demo organization(s)`);

        // 2. Send trial warning notifications (T-7 days)
        const warningsSent = await TrialService.sendTrialWarnings();
        console.log(`[TrialCron] Sent ${warningsSent} trial warning notification(s)`);

        // 3. Lock expired trials
        const trialsLocked = await TrialService.processExpiredTrials();
        console.log(`[TrialCron] Locked ${trialsLocked} expired trial organization(s)`);

        console.log('[TrialCron] Daily trial/demo tasks completed successfully');

        return {
            demosCleanedUp,
            warningsSent,
            trialsLocked
        };
    } catch (error) {
        console.error('[TrialCron] Error running daily trial tasks:', error);
        throw error;
    }
};

/**
 * Reset usage counters (optional - counters auto-reset by date)
 * This cleans up old counter records older than 30 days
 */
const cleanupOldUsageCounters = async () => {
    const db = require('../database');
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM usage_counters WHERE counter_date < ?`,
            [cutoffDate],
            function (err) {
                if (err) return reject(err);
                console.log(`[TrialCron] Cleaned up ${this.changes} old usage counter record(s)`);
                resolve(this.changes);
            }
        );
    });
};

module.exports = {
    runDailyTrialTasks,
    cleanupOldUsageCounters
};
