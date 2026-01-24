import cron from 'node-cron';

import AIMemoryMetricsService from '../src/services/ai/aiMemoryMetricsService.js';
import { learningSystem } from '../src/services/ai/learningSystem.js'; // Check if file exists
import AICostControlService from '../src/services/aiCostControlService.js';
import AIMemoryManager from '../src/services/aiMemoryManager.js';
import FeedbackService from '../src/services/feedbackService.js';
import MetricsAggregator from '../src/services/metricsAggregator.js';
import ReportEmailService from '../src/services/reportEmailService.js';
import RetentionPolicyService from '../src/services/retentionPolicyService.js';
import ScheduledReportsService from '../src/services/scheduledReportsService.js';
import SLAService from '../src/services/slaService.js';
import StorageReconciliationService from '../src/services/storageReconciliationService.js';
import TrialCron from './trialCron.js'; // Assuming JS usage for legacy or TS if Vitest resolves

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
      MetricsAggregator.buildDailySnapshots().catch((err: any) => {
        console.error('[Scheduler] Metrics Snapshot Generation failed:', err.message);
      });
    });

    // 6. SLA Check & Escalation - Run every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      console.log('[Scheduler] Running SLA Check & Escalation');
      SLAService.runSlaCheck().catch((err: any) => {
        console.error('[Scheduler] SLA Check failed:', err.message);
      });
    });

    // 8. AI Monthly Budget Reset - Run on the 1st of every month at midnight
    cron.schedule('0 0 1 * *', () => {
      console.log('[Scheduler] Running Monthly AI Budget Reset');
      AICostControlService.resetMonthlyUsage()
        .then((result: any) => {
          console.log(`[Scheduler] AI Monthly Budget Reset completed. Count: ${result.resetCount}`);
        })
        .catch((err: any) => {
          console.error('[Scheduler] AI Monthly Budget Reset failed:', err.message);
        });
    });

    // 9. Scheduled Management Reports - Run every hour at minute 0
    cron.schedule('0 * * * *', () => {
      console.log('[Scheduler] Checking Scheduled Management Reports');
      ScheduledReportsService.processScheduledReports()
        .then((result: any) => {
          if (result.processed > 0) {
            console.log(`[Scheduler] Processed ${result.processed} scheduled report(s)`);
          }
        })
        .catch((err: any) => {
          console.error('[Scheduler] Scheduled Reports processing failed:', err.message);
        });
    });

    // 10. Scheduled Emails - Run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
      ReportEmailService.processScheduledEmails().catch((err: any) => {
        console.error('[Scheduler] Scheduled Emails processing failed:', err.message);
      });
    });

    // ============================================================
    // AI SELF-LEARNING SYSTEM JOBS
    // ============================================================

    // 11. AI Pattern Extraction - Run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('[Scheduler] Running AI Pattern Extraction');
      try {
        const ls = await learningSystem;
        const result = await ls.extractAllPatterns();
        console.log(
          `[Scheduler] AI Pattern Extraction completed: ${result.patternsExtracted} patterns from ${result.recordsProcessed} records`
        );
      } catch (err: any) {
        console.error('[Scheduler] AI Pattern Extraction failed:', err.message);
      }
    });

    // 12. AI Learning Consolidation - Run daily at 4:30 AM
    cron.schedule('30 4 * * *', async () => {
      console.log('[Scheduler] Running AI Learning Consolidation');
      try {
        const ls = await learningSystem;
        const result = await ls.consolidateLearnings();
        console.log(
          `[Scheduler] AI Learning Consolidation completed: ${result.strategiesCreated} strategies created`
        );
      } catch (err: any) {
        console.error('[Scheduler] AI Learning Consolidation failed:', err.message);
      }
    });

    // 13. AI Learning Data Cleanup - Run weekly on Monday at 5:00 AM
    cron.schedule('0 5 * * 1', async () => {
      console.log('[Scheduler] Running AI Learning Data Cleanup');
      try {
        const ls = await learningSystem;
        const result = await ls.cleanupOldData();
        console.log(
          `[Scheduler] AI Learning Cleanup completed: ${result.deleted} old records deleted`
        );
      } catch (err: any) {
        console.error('[Scheduler] AI Learning Cleanup failed:', err.message);
      }
    });

    // 14. AI Memory Cleanup - Run weekly on Sunday at 2:00 AM
    // Cleans up old project memory, partial responses, and feedback
    cron.schedule('0 2 * * 0', async () => {
      console.log('[Scheduler] Running AI Memory Cleanup Cycle');
      try {
        const result = await AIMemoryManager.runCleanupCycle();
        console.log(`[Scheduler] AI Memory Cleanup completed:`, {
          projectMemory: result.projectMemory?.deleted || 0,
          partialResponses: result.partialResponses?.deleted || 0,
          feedback: result.feedback?.deleted || 0,
          duration: `${result.duration}ms`,
        });
      } catch (err: any) {
        console.error('[Scheduler] AI Memory Cleanup failed:', err.message);
      }
    });

    // 15. Partial Response Cleanup - Run every hour
    // More frequent cleanup for streaming partial responses
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await AIMemoryManager.cleanupPartialResponses(1); // 1 hour
        if (result.deleted && result.deleted > 0) {
          console.log(`[Scheduler] Partial Response Cleanup: ${result.deleted} entries removed`);
        }
      } catch (err) {
        // Silent fail - not critical
      }
    });

    // 16. Feedback Learning Consolidation - Run daily at 4:00 AM
    // Consolidates user feedback into global AI strategies
    cron.schedule('0 4 * * *', async () => {
      console.log('[Scheduler] Running Feedback Learning Consolidation');
      try {
        const result = await FeedbackService.consolidateLearning();
        console.log(`[Scheduler] Feedback Consolidation completed:`, result);
      } catch (err: any) {
        console.error('[Scheduler] Feedback Consolidation failed:', err.message);
      }
    });

    // 17. AI Memory Metrics Aggregation - Run daily at 1:00 AM
    // Aggregates hourly memory metrics into daily summaries
    cron.schedule('0 1 * * *', async () => {
      console.log('[Scheduler] Running AI Memory Metrics Aggregation');
      try {
        const result = (await (AIMemoryMetricsService as any).aggregateDailyMetrics()) as {
          aggregated: number;
          date: string;
        };
        console.log(
          `[Scheduler] Memory Metrics Aggregation completed: ${result.aggregated} organizations for ${result.date}`
        );
      } catch (err: any) {
        console.error('[Scheduler] Memory Metrics Aggregation failed:', err.message);
      }
    });

    console.log(
      '[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM), SLA (Every 10min), Notifications (Every 10min), AI Budget (Monthly 1st), Scheduled Reports (Hourly), Scheduled Emails (Every 15min), AI Pattern Extraction (Every 6h), AI Consolidation (Daily 4:30AM), AI Cleanup (Weekly Mon 5AM), AI Memory Cleanup (Weekly Sun 2AM), Partial Response Cleanup (Hourly), Feedback Consolidation (Daily 4AM)'
    );
  },
};

export default Scheduler;

// Export init function for compatibility
export const init = Scheduler.init;

// Export getScheduler function for compatibility
export const getScheduler = () => Scheduler;
