const cron = require('node-cron');
const metricsPersistenceService = require('../services/metricsPersistenceService');

/**
 * Initializes the metrics snapshot cron job.
 * Runs every hour at minute 0.
 */
const initMetricsSnapshotJob = () => {
    // Schedule task for top of every hour
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Running scheduled metrics snapshot...');
        await metricsPersistenceService.saveSnapshot(true); // Save and reset
    });

    console.log('[Cron] Metrics snapshot job scheduled (Hourly).');
};

module.exports = initMetricsSnapshotJob;
