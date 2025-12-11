const cron = require('node-cron');
const RetentionPolicyService = require('../services/retentionPolicyService');
const StorageReconciliationService = require('../services/storageReconciliationService');

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

        console.log('[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM)');
    }
};

module.exports = Scheduler;
