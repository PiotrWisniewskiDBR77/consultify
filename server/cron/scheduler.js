const cron = require('node-cron');
const RetentionPolicyService = require('../services/retentionPolicyService');
const StorageReconciliationService = require('../services/storageReconciliationService');
const TrialCron = require('./trialCron');

const Scheduler = {
    init: () => {
        console.log('[Scheduler] Initializing Cron Jobs...');

        // 1. Retention Policy Cleanup - Run every day at 3:00 AM
        cron.schedule('0 3 * * *', () => {
            console.log('[Scheduler] Running Daily Retention Cleanup');
            RetentionPolicyService.runCleanup();
        });

        // 2. Storage Reconciliation - Run every Sunday at 4:00 AM
        cron.schedule('0 4 * * 0', () => {
            console.log('[Scheduler] Running Weekly Storage Reconciliation Audit');
            StorageReconciliationService.runReconciliation();
        });

        // 3. Trial/Demo Daily Tasks - Run every day at 2:30 AM
        cron.schedule('30 2 * * *', () => {
            console.log('[Scheduler] Running Daily Trial/Demo Tasks');
            TrialCron.runDailyTrialTasks();
        });

        // 4. Usage Counter Cleanup - Run weekly on Sunday at 2:00 AM
        cron.schedule('0 2 * * 0', () => {
            console.log('[Scheduler] Running Weekly Usage Counter Cleanup');
            TrialCron.cleanupOldUsageCounters();
        });

        // 5. Metrics Snapshot Generation - Run every day at 2:45 AM
        cron.schedule('45 2 * * *', () => {
            console.log('[Scheduler] Running Daily Metrics Snapshot Generation');
            const MetricsAggregator = require('../services/metricsAggregator');
            MetricsAggregator.buildDailySnapshots().catch(err => {
                console.error('[Scheduler] Metrics Snapshot Generation failed:', err.message);
            });
        });

        console.log('[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM)');
    }
};

module.exports = Scheduler;
