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

        // 6. SLA Check & Escalation - Run every 10 minutes
        cron.schedule('*/10 * * * *', () => {
            console.log('[Scheduler] Running SLA Check & Escalation');
            const SLAService = require('../services/slaService');
            SLAService.runSlaCheck().catch(err => {
                console.error('[Scheduler] SLA Check failed:', err.message);
            });
        });

        // 8. AI Monthly Budget Reset - Run on the 1st of every month at midnight
        cron.schedule('0 0 1 * *', () => {
            console.log('[Scheduler] Running Monthly AI Budget Reset');
            const AICostControlService = require('../services/aiCostControlService');
            AICostControlService.resetMonthlyUsage().then(result => {
                console.log(`[Scheduler] AI Monthly Budget Reset completed. Count: ${result.resetCount}`);
            }).catch(err => {
                console.error('[Scheduler] AI Monthly Budget Reset failed:', err.message);
            });
        });

        // 9. Scheduled Management Reports - Run every hour at minute 0
        cron.schedule('0 * * * *', () => {
            console.log('[Scheduler] Checking Scheduled Management Reports');
            const ScheduledReportsService = require('../services/scheduledReportsService');
            ScheduledReportsService.processScheduledReports().then(result => {
                if (result.processed > 0) {
                    console.log(`[Scheduler] Processed ${result.processed} scheduled report(s)`);
                }
            }).catch(err => {
                console.error('[Scheduler] Scheduled Reports processing failed:', err.message);
            });
        });

        // 10. Scheduled Emails - Run every 15 minutes
        cron.schedule('*/15 * * * *', () => {
            const ReportEmailService = require('../services/reportEmailService');
            ReportEmailService.processScheduledEmails().catch(err => {
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
                const { learningSystem } = require('../services/ai/learningSystem');
                const result = await learningSystem.extractAllPatterns();
                console.log(`[Scheduler] AI Pattern Extraction completed: ${result.patternsExtracted} patterns from ${result.recordsProcessed} records`);
            } catch (err) {
                console.error('[Scheduler] AI Pattern Extraction failed:', err.message);
            }
        });

        // 12. AI Learning Consolidation - Run daily at 4:30 AM
        cron.schedule('30 4 * * *', async () => {
            console.log('[Scheduler] Running AI Learning Consolidation');
            try {
                const { learningSystem } = require('../services/ai/learningSystem');
                const result = await learningSystem.consolidateLearnings();
                console.log(`[Scheduler] AI Learning Consolidation completed: ${result.strategiesCreated} strategies created`);
            } catch (err) {
                console.error('[Scheduler] AI Learning Consolidation failed:', err.message);
            }
        });

        // 13. AI Learning Data Cleanup - Run weekly on Monday at 5:00 AM
        cron.schedule('0 5 * * 1', async () => {
            console.log('[Scheduler] Running AI Learning Data Cleanup');
            try {
                const { learningSystem } = require('../services/ai/learningSystem');
                const result = await learningSystem.cleanupOldData();
                console.log(`[Scheduler] AI Learning Cleanup completed: ${result.deleted} old records deleted`);
            } catch (err) {
                console.error('[Scheduler] AI Learning Cleanup failed:', err.message);
            }
        });

        // 14. AI Memory Cleanup - Run weekly on Sunday at 2:00 AM
        // Cleans up old project memory, partial responses, and feedback
        cron.schedule('0 2 * * 0', async () => {
            console.log('[Scheduler] Running AI Memory Cleanup Cycle');
            try {
                const AIMemoryManager = require('../services/aiMemoryManager');
                const result = await AIMemoryManager.runCleanupCycle();
                console.log(`[Scheduler] AI Memory Cleanup completed:`, {
                    projectMemory: result.projectMemory?.deleted || 0,
                    partialResponses: result.partialResponses?.deleted || 0,
                    feedback: result.feedback?.deleted || 0,
                    duration: `${result.duration}ms`
                });
            } catch (err) {
                console.error('[Scheduler] AI Memory Cleanup failed:', err.message);
            }
        });

        // 15. Partial Response Cleanup - Run every hour
        // More frequent cleanup for streaming partial responses
        cron.schedule('0 * * * *', async () => {
            try {
                const AIMemoryManager = require('../services/aiMemoryManager');
                const result = await AIMemoryManager.cleanupPartialResponses(1); // 1 hour
                if (result.deleted > 0) {
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
                const FeedbackService = require('../services/feedbackService');
                const result = await FeedbackService.consolidateLearning();
                console.log(`[Scheduler] Feedback Consolidation completed:`, result);
            } catch (err) {
                console.error('[Scheduler] Feedback Consolidation failed:', err.message);
            }
        });

        // 17. AI Memory Metrics Aggregation - Run daily at 1:00 AM
        // Aggregates hourly memory metrics into daily summaries
        cron.schedule('0 1 * * *', async () => {
            console.log('[Scheduler] Running AI Memory Metrics Aggregation');
            try {
                const AIMemoryMetricsService = require('../services/ai/aiMemoryMetricsService');
                const result = await AIMemoryMetricsService.aggregateDailyMetrics();
                console.log(`[Scheduler] Memory Metrics Aggregation completed: ${result.aggregated} organizations for ${result.date}`);
            } catch (err) {
                console.error('[Scheduler] Memory Metrics Aggregation failed:', err.message);
            }
        });

        console.log('[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM), SLA (Every 10min), Notifications (Every 10min), AI Budget (Monthly 1st), Scheduled Reports (Hourly), Scheduled Emails (Every 15min), AI Pattern Extraction (Every 6h), AI Consolidation (Daily 4:30AM), AI Cleanup (Weekly Mon 5AM), AI Memory Cleanup (Weekly Sun 2AM), Partial Response Cleanup (Hourly), Feedback Consolidation (Daily 4AM)');

    }
};

module.exports = Scheduler;
