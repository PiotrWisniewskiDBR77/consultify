/**
 * Main Cron Scheduler
 * Initializes and schedules all cron jobs
 * 
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import * as cron from 'node-cron';
import logger from '../utils/Logger.js';
import { createRequire } from 'module';
import { runDailyTrialTasks, cleanupOldUsageCounters } from './TrialCron.js';

const require = createRequire(import.meta.url);

// ==========================================
// TYPES
// ==========================================

interface RetentionPolicyService {
    runCleanup: () => Promise<void>;
}

interface StorageReconciliationService {
    runReconciliation: () => Promise<void>;
}

interface MetricsAggregator {
    buildDailySnapshots: () => Promise<void>;
}

interface SLAService {
    runSlaCheck: () => Promise<void>;
}

interface AICostControlService {
    resetMonthlyUsage: () => Promise<{ resetCount: number }>;
}

interface ScheduledReportsService {
    processScheduledReports: () => Promise<{ processed: number }>;
}

interface ReportEmailService {
    processScheduledEmails: () => Promise<void>;
}

interface LearningSystem {
    extractAllPatterns: () => Promise<{ patternsExtracted: number; recordsProcessed: number }>;
    consolidateLearnings: () => Promise<{ strategiesCreated: number }>;
    cleanupOldData: () => Promise<{ deleted: number }>;
}

interface AIMemoryManager {
    runCleanupCycle: () => Promise<{
        projectMemory?: { deleted: number };
        partialResponses?: { deleted: number };
        feedback?: { deleted: number };
        duration: number;
    }>;
    cleanupPartialResponses: (hours: number) => Promise<{ deleted: number }>;
}

interface FeedbackService {
    consolidateLearning: () => Promise<unknown>;
}

interface AIMemoryMetricsService {
    aggregateDailyMetrics: () => Promise<{ aggregated: number; date: string }>;
}

interface Dependencies {
    retentionPolicyService: RetentionPolicyService;
    storageReconciliationService: StorageReconciliationService;
    metricsAggregator: MetricsAggregator;
    slaService: SLAService;
    aiCostControlService: AICostControlService;
    scheduledReportsService: ScheduledReportsService;
    reportEmailService: ReportEmailService;
    learningSystem: LearningSystem;
    aiMemoryManager: AIMemoryManager;
    feedbackService: FeedbackService;
    aiMemoryMetricsService: AIMemoryMetricsService;
}

// ==========================================
// SCHEDULER
// ==========================================

class Scheduler {
    private deps: Dependencies;
    private jobs: cron.ScheduledTask[] = [];

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            retentionPolicyService: deps?.retentionPolicyService || require('../../services/retentionPolicyService.js'),
            storageReconciliationService: deps?.storageReconciliationService || require('../../services/storageReconciliationService.js'),
            metricsAggregator: deps?.metricsAggregator || require('../../services/metricsAggregator.js'),
            slaService: deps?.slaService || require('../../services/slaService.js'),
            aiCostControlService: deps?.aiCostControlService || require('../../services/aiCostControlService.js'),
            scheduledReportsService: deps?.scheduledReportsService || require('../../services/scheduledReportsService.js'),
            reportEmailService: deps?.reportEmailService || require('../../services/reportEmailService.js'),
            learningSystem: deps?.learningSystem || require('../../services/ai/learningSystem.js').learningSystem,
            aiMemoryManager: deps?.aiMemoryManager || require('../../services/aiMemoryManager.js'),
            feedbackService: deps?.feedbackService || require('../../services/feedbackService.js'),
            aiMemoryMetricsService: deps?.aiMemoryMetricsService || require('../../services/ai/aiMemoryMetricsService.js'),
        };
    }

    /**
     * Initialize all cron jobs
     */
    init(): void {
        logger.info('[Scheduler] Initializing Cron Jobs...');

        // 1. Retention Policy Cleanup - Run every day at 3:00 AM
        this.jobs.push(
            cron.schedule('0 3 * * *', async () => {
                logger.info('[Scheduler] Running Daily Retention Cleanup');
                try {
                    await this.deps.retentionPolicyService.runCleanup();
                } catch (err) {
                    logger.error('[Scheduler] Retention Cleanup failed:', err);
                }
            })
        );

        // 2. Storage Reconciliation - Run every Sunday at 4:00 AM
        this.jobs.push(
            cron.schedule('0 4 * * 0', async () => {
                logger.info('[Scheduler] Running Weekly Storage Reconciliation Audit');
                try {
                    await this.deps.storageReconciliationService.runReconciliation();
                } catch (err) {
                    logger.error('[Scheduler] Storage Reconciliation failed:', err);
                }
            })
        );

        // 3. Trial/Demo Daily Tasks - Run every day at 2:30 AM
        this.jobs.push(
            cron.schedule('30 2 * * *', async () => {
                logger.info('[Scheduler] Running Daily Trial/Demo Tasks');
                try {
                    await runDailyTrialTasks();
                } catch (err) {
                    logger.error('[Scheduler] Trial/Demo Tasks failed:', err);
                }
            })
        );

        // 4. Usage Counter Cleanup - Run weekly on Sunday at 2:00 AM
        this.jobs.push(
            cron.schedule('0 2 * * 0', async () => {
                logger.info('[Scheduler] Running Weekly Usage Counter Cleanup');
                try {
                    await cleanupOldUsageCounters();
                } catch (err) {
                    logger.error('[Scheduler] Usage Counter Cleanup failed:', err);
                }
            })
        );

        // 5. Metrics Snapshot Generation - Run every day at 2:45 AM
        this.jobs.push(
            cron.schedule('45 2 * * *', async () => {
                logger.info('[Scheduler] Running Daily Metrics Snapshot Generation');
                try {
                    await this.deps.metricsAggregator.buildDailySnapshots();
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] Metrics Snapshot Generation failed:', error.message);
                }
            })
        );

        // 6. SLA Check & Escalation - Run every 10 minutes
        this.jobs.push(
            cron.schedule('*/10 * * * *', async () => {
                logger.info('[Scheduler] Running SLA Check & Escalation');
                try {
                    await this.deps.slaService.runSlaCheck();
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] SLA Check failed:', error.message);
                }
            })
        );

        // 8. AI Monthly Budget Reset - Run on the 1st of every month at midnight
        this.jobs.push(
            cron.schedule('0 0 1 * *', async () => {
                logger.info('[Scheduler] Running Monthly AI Budget Reset');
                try {
                    const result = await this.deps.aiCostControlService.resetMonthlyUsage();
                    logger.info(`[Scheduler] AI Monthly Budget Reset completed. Count: ${result.resetCount}`);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] AI Monthly Budget Reset failed:', error.message);
                }
            })
        );

        // 9. Scheduled Management Reports - Run every hour at minute 0
        this.jobs.push(
            cron.schedule('0 * * * *', async () => {
                logger.info('[Scheduler] Checking Scheduled Management Reports');
                try {
                    const result = await this.deps.scheduledReportsService.processScheduledReports();
                    if (result.processed > 0) {
                        logger.info(`[Scheduler] Processed ${result.processed} scheduled report(s)`);
                    }
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] Scheduled Reports processing failed:', error.message);
                }
            })
        );

        // 10. Scheduled Emails - Run every 15 minutes
        this.jobs.push(
            cron.schedule('*/15 * * * *', async () => {
                try {
                    await this.deps.reportEmailService.processScheduledEmails();
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] Scheduled Emails processing failed:', error.message);
                }
            })
        );

        // ============================================================
        // AI SELF-LEARNING SYSTEM JOBS
        // ============================================================

        // 11. AI Pattern Extraction - Run every 6 hours
        this.jobs.push(
            cron.schedule('0 */6 * * *', async () => {
                logger.info('[Scheduler] Running AI Pattern Extraction');
                try {
                    const result = await this.deps.learningSystem.extractAllPatterns();
                    logger.info(`[Scheduler] AI Pattern Extraction completed: ${result.patternsExtracted} patterns from ${result.recordsProcessed} records`);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] AI Pattern Extraction failed:', error.message);
                }
            })
        );

        // 12. AI Learning Consolidation - Run daily at 4:30 AM
        this.jobs.push(
            cron.schedule('30 4 * * *', async () => {
                logger.info('[Scheduler] Running AI Learning Consolidation');
                try {
                    const result = await this.deps.learningSystem.consolidateLearnings();
                    logger.info(`[Scheduler] AI Learning Consolidation completed: ${result.strategiesCreated} strategies created`);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] AI Learning Consolidation failed:', error.message);
                }
            })
        );

        // 13. AI Learning Data Cleanup - Run weekly on Monday at 5:00 AM
        this.jobs.push(
            cron.schedule('0 5 * * 1', async () => {
                logger.info('[Scheduler] Running AI Learning Data Cleanup');
                try {
                    const result = await this.deps.learningSystem.cleanupOldData();
                    logger.info(`[Scheduler] AI Learning Cleanup completed: ${result.deleted} old records deleted`);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] AI Learning Cleanup failed:', error.message);
                }
            })
        );

        // 14. AI Memory Cleanup - Run weekly on Sunday at 2:00 AM
        // Cleans up old project memory, partial responses, and feedback
        this.jobs.push(
            cron.schedule('0 2 * * 0', async () => {
                logger.info('[Scheduler] Running AI Memory Cleanup Cycle');
                try {
                    const result = await this.deps.aiMemoryManager.runCleanupCycle();
                    logger.info('[Scheduler] AI Memory Cleanup completed:', {
                        projectMemory: result.projectMemory?.deleted || 0,
                        partialResponses: result.partialResponses?.deleted || 0,
                        feedback: result.feedback?.deleted || 0,
                        duration: `${result.duration}ms`,
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] AI Memory Cleanup failed:', error.message);
                }
            })
        );

        // 15. Partial Response Cleanup - Run every hour
        // More frequent cleanup for streaming partial responses
        this.jobs.push(
            cron.schedule('0 * * * *', async () => {
                try {
                    const result = await this.deps.aiMemoryManager.cleanupPartialResponses(1); // 1 hour
                    if (result.deleted > 0) {
                        logger.info(`[Scheduler] Partial Response Cleanup: ${result.deleted} entries removed`);
                    }
                } catch (err) {
                    // Silent fail - not critical
                }
            })
        );

        // 16. Feedback Learning Consolidation - Run daily at 4:00 AM
        // Consolidates user feedback into global AI strategies
        this.jobs.push(
            cron.schedule('0 4 * * *', async () => {
                logger.info('[Scheduler] Running Feedback Learning Consolidation');
                try {
                    const result = await this.deps.feedbackService.consolidateLearning();
                    logger.info('[Scheduler] Feedback Consolidation completed:', result);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] Feedback Consolidation failed:', error.message);
                }
            })
        );

        // 17. AI Memory Metrics Aggregation - Run daily at 1:00 AM
        // Aggregates hourly memory metrics into daily summaries
        this.jobs.push(
            cron.schedule('0 1 * * *', async () => {
                logger.info('[Scheduler] Running AI Memory Metrics Aggregation');
                try {
                    const result = await this.deps.aiMemoryMetricsService.aggregateDailyMetrics();
                    logger.info(`[Scheduler] Memory Metrics Aggregation completed: ${result.aggregated} organizations for ${result.date}`);
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error('[Scheduler] Memory Metrics Aggregation failed:', error.message);
                }
            })
        );

        logger.info('[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM), SLA (Every 10min), Notifications (Every 10min), AI Budget (Monthly 1st), Scheduled Reports (Hourly), Scheduled Emails (Every 15min), AI Pattern Extraction (Every 6h), AI Consolidation (Daily 4:30AM), AI Cleanup (Weekly Mon 5AM), AI Memory Cleanup (Weekly Sun 2AM), Partial Response Cleanup (Hourly), Feedback Consolidation (Daily 4AM)');
    }

    /**
     * Stop all cron jobs
     */
    stop(): void {
        this.jobs.forEach((job) => job.stop());
        this.jobs = [];
        logger.info('[Scheduler] All cron jobs stopped');
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: Scheduler | null = null;

export function getScheduler(deps?: Partial<Dependencies>): Scheduler {
    if (!instance) {
        instance = new Scheduler(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const init = (deps?: Partial<Dependencies>): void => {
    getScheduler(deps).init();
};

export default Scheduler;

