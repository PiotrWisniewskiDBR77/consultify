/**
 * Scheduler
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/cron/scheduler.js (CommonJS) to TypeScript (ES Modules)
 */

import cron from 'node-cron';

import kls from '../services/ai/learningSystem.js';
import aiCostControlService from '../services/aiCostControlService.js';
import slaService from '../services/slaService.js';
import storageReconciliationService from '../services/storageReconciliationService.js';
import * as trialCron from './TrialCron.js';
const { learningSystem } = kls;
import aiMemoryMetricsService from '../services/ai/aiMemoryMetricsService.js';
import aiMemoryManager from '../services/aiMemoryManager.js';
import feedbackService from '../services/feedbackService.js';

const Scheduler = {
    jobs: [] as cron.ScheduledTask[],
    init: (): void => {
        console.log('[Scheduler] Initializing Cron Jobs...');

        // 1. Retention Policy Cleanup - Run every day at 3:00 AM
        const job1 = cron.schedule('0 3 * * *', () => {
            console.log('[Scheduler] Running Daily Retention Cleanup');
            // retentionPolicyService.runCleanup();
        });
        this.jobs.push(job1);

        // 2. Storage Reconciliation - Run every Sunday at 4:00 AM
        const job2 = cron.schedule('0 4 * * 0', () => {
            console.log('[Scheduler] Running Weekly Storage Reconciliation Audit');
            storageReconciliationService.runReconciliation();
        });
        this.jobs.push(job2);

        // 3. Trial/Demo Daily Tasks - Run every day at 2:30 AM
        const job3 = cron.schedule('30 2 * * *', () => {
            console.log('[Scheduler] Running Daily Trial/Demo Tasks');
            trialCron.runDailyTrialTasks();
        });
        this.jobs.push(job3);

        // 4. Usage Counter Cleanup - Run weekly on Sunday at 2:00 AM
        const job4 = cron.schedule('0 2 * * 0', () => {
            console.log('[Scheduler] Running Weekly Usage Counter Cleanup');
            trialCron.cleanupOldUsageCounters();
        });
        this.jobs.push(job4);

        // 5. Metrics Snapshot Generation - Run every day at 2:45 AM
        const job5 = cron.schedule('45 2 * * *', () => {
            console.log('[Scheduler] Running Daily Metrics Snapshot Generation');
            // metricsAggregator.buildDailySnapshots().catch((err: Error) => {
            //     console.error('[Scheduler] Metrics Snapshot Generation failed:', err.message);
            // });
        });
        this.jobs.push(job5);

        // 6. SLA Check & Escalation - Run every 10 minutes
        const job6 = cron.schedule('*/10 * * * *', () => {
            console.log('[Scheduler] Running SLA Check & Escalation');
            slaService.runSlaCheck().catch((err: Error) => {
                console.error('[Scheduler] SLA Check failed:', err.message);
            });
        });
        this.jobs.push(job6);

        // 8. AI Monthly Budget Reset - Run on the 1st of every month at midnight
        const job8 = cron.schedule('0 0 1 * *', () => {
            console.log('[Scheduler] Running Monthly AI Budget Reset');
            aiCostControlService
                .resetMonthlyUsage()
                .then((result: { resetCount: number }) => {
                    console.log(`[Scheduler] AI Monthly Budget Reset completed. Count: ${result.resetCount}`);
                })
                .catch((err: Error) => {
                    console.error('[Scheduler] AI Monthly Budget Reset failed:', err.message);
                });
        });
        this.jobs.push(job8);

        // 9. Scheduled Management Reports - Run every hour at minute 0
        const job9 = cron.schedule('0 * * * *', () => {
            console.log('[Scheduler] Checking Scheduled Management Reports');
            // scheduledReportsService.processScheduledReports().then((result: { processed: number }) => {
            //     if (result.processed > 0) {
            //         console.log(`[Scheduler] Processed ${result.processed} scheduled report(s)`);
            //     }
            // }).catch((err: Error) => {
            //     console.error('[Scheduler] Scheduled Reports processing failed:', err.message);
            // });
        });
        this.jobs.push(job9);

        // 10. Scheduled Emails - Run every 15 minutes
        const job10 = cron.schedule('*/15 * * * *', () => {
            // reportEmailService.processScheduledEmails().catch((err: Error) => {
            //     console.error('[Scheduler] Scheduled Emails processing failed:', err.message);
            // });
        });
        this.jobs.push(job10);

        // ============================================================
        // AI SELF-LEARNING SYSTEM JOBS
        // ============================================================

        // 11. AI Pattern Extraction - Run every 6 hours
        const job11 = cron.schedule('0 */6 * * *', async () => {
            console.log('[Scheduler] Running AI Pattern Extraction');
            try {
                const result = await learningSystem.extractAllPatterns();
                console.log(
                    `[Scheduler] AI Pattern Extraction completed: ${result.patternsExtracted} patterns from ${result.recordsProcessed} records`,
                );
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] AI Pattern Extraction failed:', error.message);
            }
        });
        this.jobs.push(job11);

        // 12. AI Learning Consolidation - Run daily at 4:30 AM
        const job12 = cron.schedule('30 4 * * *', async () => {
            console.log('[Scheduler] Running AI Learning Consolidation');
            try {
                const result = await learningSystem.consolidateLearnings();
                console.log(
                    `[Scheduler] AI Learning Consolidation completed: ${result.strategiesCreated} strategies created`,
                );
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] AI Learning Consolidation failed:', error.message);
            }
        });
        this.jobs.push(job12);

        // 13. AI Learning Data Cleanup - Run weekly on Monday at 5:00 AM
        const job13 = cron.schedule('0 5 * * 1', async () => {
            console.log('[Scheduler] Running AI Learning Data Cleanup');
            try {
                const result = await learningSystem.cleanupOldData();
                console.log(`[Scheduler] AI Learning Cleanup completed: ${result.deleted} old records deleted`);
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] AI Learning Cleanup failed:', error.message);
            }
        });
        this.jobs.push(job13);

        // 14. AI Memory Cleanup - Run weekly on Sunday at 2:00 AM
        // Cleans up old project memory, partial responses, and feedback
        const job14 = cron.schedule('0 2 * * 0', async () => {
            console.log('[Scheduler] Running AI Memory Cleanup Cycle');
            try {
                const result = await aiMemoryManager.runCleanupCycle();
                console.log(`[Scheduler] AI Memory Cleanup completed:`, {
                    projectMemory: result.projectMemory?.deleted || 0,
                    partialResponses: result.partialResponses?.deleted || 0,
                    feedback: result.feedback?.deleted || 0,
                    duration: `${result.duration}ms`,
                });
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] AI Memory Cleanup failed:', error.message);
            }
        });
        this.jobs.push(job14);

        // 15. Partial Response Cleanup - Run every hour
        // More frequent cleanup for streaming partial responses
        const job15 = cron.schedule('0 * * * *', async () => {
            try {
                const result = await aiMemoryManager.cleanupPartialResponses(1); // 1 hour
                if (result.deleted > 0) {
                    console.log(`[Scheduler] Partial Response Cleanup: ${result.deleted} entries removed`);
                }
            } catch (err: unknown) {
                // Silent fail - not critical
            }
        });
        this.jobs.push(job15);

        // 16. Feedback Learning Consolidation - Run daily at 4:00 AM
        // Consolidates user feedback into global AI strategies
        const job16 = cron.schedule('0 4 * * *', async () => {
            console.log('[Scheduler] Running Feedback Learning Consolidation');
            try {
                const result = await feedbackService.consolidateLearning();
                console.log(`[Scheduler] Feedback Consolidation completed:`, result);
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] Feedback Consolidation failed:', error.message);
            }
        });
        this.jobs.push(job16);

        // 17. AI Memory Metrics Aggregation - Run daily at 1:00 AM
        // Aggregates hourly memory metrics into daily summaries
        const job17 = cron.schedule('0 1 * * *', async () => {
            console.log('[Scheduler] Running AI Memory Metrics Aggregation');
            try {
                const result = await aiMemoryMetricsService.aggregateDailyMetrics();
                console.log(
                    `[Scheduler] Memory Metrics Aggregation completed: ${result.aggregated} organizations for ${result.date}`,
                );
            } catch (err: unknown) {
                const error = err as Error;
                console.error('[Scheduler] Memory Metrics Aggregation failed:', error.message);
            }
        });
        this.jobs.push(job17);

        console.log(
            '[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM), SLA (Every 10min), Notifications (Every 10min), AI Budget (Monthly 1st), Scheduled Reports (Hourly), Scheduled Emails (Every 15min), AI Pattern Extraction (Every 6h), AI Consolidation (Daily 4:30AM), AI Cleanup (Weekly Mon 5AM), AI Memory Cleanup (Weekly Sun 2AM), Partial Response Cleanup (Hourly), Feedback Consolidation (Daily 4AM)',
        );
    },
    stop: (): void => {
        console.log('[Scheduler] Stopping all cron jobs...');
        this.jobs.forEach((job) => {
            job.stop();
        });
        this.jobs = [];
        console.log('[Scheduler] All cron jobs stopped');
    },
};

export default Scheduler;

