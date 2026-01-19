/**
 * Dunning Cron Job
 *
 * Processes scheduled dunning actions:
 * - Payment retries
 * - Stage advancement
 * - Suspension enforcement
 *
 * Runs every hour.
 */

import cron from 'node-cron';

import DunningService from '../src/services/dunningService.js';

let dunningJob: cron.ScheduledTask | null = null;

/**
 * Start the dunning cron job
 */
function startDunningJob() {
  if (process.env.DISABLE_DUNNING_CRON === 'true') {
    console.log('[DunningCron] Disabled via environment variable');
    return;
  }

  // Every hour at minute 30
  dunningJob = cron.schedule(
    '30 * * * *',
    async () => {
      console.log('[DunningCron] Starting scheduled dunning processing...');

      try {
        await DunningService.processScheduledRetries();
      } catch (error) {
        console.error('[DunningCron] Processing failed:', error);

        // Report to Sentry if available
        try {
          const { captureException } = await import('../config/sentry.js');
          captureException(error as Error, {
            tags: { component: 'dunning', job: 'scheduled' },
          });
        } catch (e) {
          // Sentry not available
        }
      }
    },
    {
      timezone: 'UTC',
    }
  );

  console.log('[DunningCron] Scheduled hourly dunning processing at :30');
}

/**
 * Stop the dunning cron job
 */
function stopDunningJob() {
  if (dunningJob) {
    dunningJob.stop();
    dunningJob = null;
    console.log('[DunningCron] Stopped');
  }
}

export default {
  startDunningJob,
  stopDunningJob,
};
