// @ts-nocheck
/**
 * Scheduler
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/cron/scheduler.js (CommonJS) to TypeScript (ES Modules)
 */

import cron from 'node-cron';

let learningSystem: any;
let aiMemoryMetricsService: any;
let aiCostControlService: any;
let slaService: any;
let taskAssignmentService: any;
let decisionEscalationChainService: any;
let storageReconciliationService: any;
let aiMemoryManager: any;
let feedbackService: any;

import logger from '../utils/Logger.js';
import * as trialCron from './TrialCron.js';

/**
 * The body of scheduled job 43 (audit independence detector sweep), exported so
 * the flag gate and the single-claim behaviour can be exercised directly
 * against a real database. Registering it through `cron.schedule` below means
 * the scheduled path and the tested path are the same function, rather than a
 * test asserting against a re-implementation of the guard.
 *
 * DEFAULT-OFF: with AUDIT_INDEPENDENCE_DETECTOR_CRON_ENABLED unset, this
 * returns before the dynamic import, so nothing is loaded, no connection is
 * taken and no lease is claimed. Enabling the flag changes only whether the
 * scan runs — it grants no access, alters no policy, mutates no audit data and
 * adds no UI.
 */
export async function runAuditIndependenceSchedulerTick(): Promise<void> {
  if (process.env.AUDIT_INDEPENDENCE_DETECTOR_CRON_ENABLED !== 'true') return;
  try {
    const { runTick } = await import('../jobs/auditIndependenceDetectorJob.js');
    const result = await runTick();
    if (
      result.claimed &&
      (result.withViolations > 0 || result.errors > 0 || result.cycleWrapped || !result.progressRecorded)
    ) {
      logger.warn('[Scheduler] Audit independence scan tick', {
        scanned: result.scanned,
        withViolations: result.withViolations,
        totalViolations: result.totalViolations,
        errors: result.errors,
        cycleWrapped: result.cycleWrapped,
        progressRecorded: result.progressRecorded,
        cyclesCompletedBefore: result.cyclesCompletedBefore,
      });
    }
  } catch (err: any) {
    logger.error('[Scheduler] Audit independence detector tick failed:', err?.message || err);
  }
}

export const Scheduler = {
  jobs: [] as cron.ScheduledTask[],
  async init(): Promise<void> {
    logger.info('[Scheduler] Initializing Cron Jobs...');

    // Resolve lazy services
    const [ls_p, amms_p, accs_p, slas_p, tass_p, decs_p, amm_p, fs_p] = await Promise.all([
      import('../services/ai/learningSystem.js').then(
        (m) => (m as any).learningSystem || (m as any).default
      ),
      import('../services/ai/aiMemoryMetricsService.js').then((m) => m.default),
      import('../services/aiCostControlService.js').then((m) => m.default),
      import('../services/slaService.js').then((m) => m.default),
      import('../services/taskAssignmentService.js').then((m) => m.default),
      import('../services/decisionEscalationChainService.js').then((m) => m.default),
      // import('../services/storageReconciliationService').then((m) => m.default),
      import('../services/aiMemoryManager.js').then((m) => m.default),
      import('../services/feedbackService.js').then((m) => m.default),
    ]);

    learningSystem = ls_p;
    aiMemoryMetricsService = amms_p;
    aiCostControlService = accs_p;
    slaService = slas_p;
    taskAssignmentService = tass_p;
    decisionEscalationChainService = decs_p;
    // storageReconciliationService = await srs_p;
    aiMemoryManager = amm_p;
    feedbackService = fs_p;

    // 1. Retention Policy Cleanup - Run every day at 3:00 AM
    const job1 = cron.schedule('0 3 * * *', () => {
      logger.info('[Scheduler] Running Daily Retention Cleanup');
      // retentionPolicyService.runCleanup();
    });
    this.jobs.push(job1);

    // // 2. Storage Reconciliation - Run every Sunday at 4:00 AM
    // const job2 = cron.schedule('0 4 * * 0', () => {
    //     logger.info('[Scheduler] Running Weekly Storage Reconciliation Audit');
    //     storageReconciliationService.runReconciliation();
    // });
    // this.jobs.push(job2);

    // 3. Trial/Demo Daily Tasks - Run every day at 2:30 AM
    const job3 = cron.schedule('30 2 * * *', () => {
      logger.info('[Scheduler] Running Daily Trial/Demo Tasks');
      trialCron.runDailyTrialTasks().catch((err: any) => {
        logger.error('[Scheduler] Daily Trial/Demo Tasks failed:', err?.message || err);
      });
    });
    this.jobs.push(job3);

    // 4. Usage Counter Cleanup - Run weekly on Sunday at 2:00 AM
    const job4 = cron.schedule('0 2 * * 0', () => {
      logger.info('[Scheduler] Running Weekly Usage Counter Cleanup');
      trialCron.cleanupOldUsageCounters().catch((err: any) => {
        logger.error('[Scheduler] Weekly Usage Counter Cleanup failed:', err?.message || err);
      });
    });
    this.jobs.push(job4);

    // 5. Metrics Snapshot Generation - Run every day at 2:45 AM
    const job5 = cron.schedule('45 2 * * *', () => {
      logger.info('[Scheduler] Running Daily Metrics Snapshot Generation');
      // metricsAggregator.buildDailySnapshots().catch((err: Error) => {
      //     logger.error('[Scheduler] Metrics Snapshot Generation failed:', err.message);
      // });
    });
    this.jobs.push(job5);

    // 6. SLA Check & Escalation - Run every 10 minutes
    const job6 = cron.schedule('*/10 * * * *', () => {
      logger.info('[Scheduler] Running SLA Check & Escalation');
      slaService.runSlaCheck().catch((err: Error) => {
        logger.error('[Scheduler] SLA Check failed:', err.message);
      });
    });
    this.jobs.push(job6);

    // 7. Task Overdue Reminders (assignee/owner/backup) - Run every 30 minutes
    const job7 = cron.schedule('*/30 * * * *', () => {
      logger.info('[Scheduler] Running Task Overdue Stakeholder Notifications');
      taskAssignmentService
        .checkAndNotifyOverdueStakeholders({ limit: 200 })
        .catch((err: Error) => {
          logger.error('[Scheduler] Task Overdue Notification job failed:', err.message);
        });
    });
    this.jobs.push(job7);

    // 7b. Decision Auto-Escalation - Run every 15 minutes
    const job7b = cron.schedule('*/15 * * * *', () => {
      logger.info('[Scheduler] Running Decision Auto-Escalation');
      decisionEscalationChainService.checkAndEscalateOverdue({ limit: 100 }).catch((err: Error) => {
        logger.error('[Scheduler] Decision Auto-Escalation job failed:', err.message);
      });
    });
    this.jobs.push(job7b);

    // 7c. Initiative Auto-Start by timeline - Run every 5 minutes
    const job7c = cron.schedule('*/5 * * * *', async () => {
      try {
        const { autoStartScheduledInitiatives } = await import('../jobs/initiativeAutoStartJob.js');
        const result = await autoStartScheduledInitiatives({ limit: 200 });
        if (result.started > 0) {
          logger.info('[Scheduler] Initiative Auto-Start completed', result);
        }
      } catch (err: any) {
        logger.error('[Scheduler] Initiative Auto-Start job failed:', err?.message || err);
      }
    });
    this.jobs.push(job7c);

    // 8. AI Monthly Budget Reset - Run on the 1st of every month at midnight
    const job8 = cron.schedule('0 0 1 * *', () => {
      logger.info('[Scheduler] Running Monthly AI Budget Reset');
      aiCostControlService
        .resetMonthlyUsage()
        .then((result: { resetCount: number }) => {
          logger.info(`[Scheduler] AI Monthly Budget Reset completed. Count: ${result.resetCount}`);
        })
        .catch((err: Error) => {
          logger.error('[Scheduler] AI Monthly Budget Reset failed:', err.message);
        });
    });
    this.jobs.push(job8);

    // 9. Scheduled Management Reports - Run every hour at minute 0
    const job9 = cron.schedule('0 * * * *', async () => {
      logger.info('[Scheduler] Checking Scheduled Management Reports');
      try {
        const { processScheduledReports } = await import('./ReportGenerationCron.js');
        const result = await processScheduledReports();
        if (result.processed > 0) {
          logger.info(
            `[Scheduler] Processed ${result.processed} scheduled report(s): ${result.successful} successful, ${result.failed} failed`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Scheduled Reports processing failed:', err.message);
      }
    });
    this.jobs.push(job9);

    // 9b. Report Schedules (new system) - Run every hour at minute 30
    const job9b = cron.schedule('30 * * * *', async () => {
      logger.info('[Scheduler] Checking Report Schedules');
      try {
        const { processScheduledReports } = await import('./ReportGenerationJob.js');
        const result = await processScheduledReports();
        if (result.processed > 0) {
          logger.info(
            `[Scheduler] Processed ${result.processed} report schedule(s): ${result.successful} successful, ${result.failed} failed`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Report Schedules processing failed:', err.message);
      }
    });
    this.jobs.push(job9b);

    // 10. Scheduled Emails - Run every 15 minutes
    const job10 = cron.schedule('*/15 * * * *', async () => {
      try {
        const { processPartnerOutreachDueMessages } =
          await import('../services/partnerOutreachService.js');
        await processPartnerOutreachDueMessages({ limit: 100 });
      } catch (err: any) {
        logger.error('[Scheduler] Partner outreach processing failed:', err?.message || err);
      }
    });
    this.jobs.push(job10);

    // ============================================================
    // AI SELF-LEARNING SYSTEM JOBS
    // ============================================================

    // 11. AI Pattern Extraction - Run every 6 hours
    const job11 = cron.schedule('0 */6 * * *', async () => {
      logger.info('[Scheduler] Running AI Pattern Extraction');
      try {
        const result = await learningSystem.extractAllPatterns();
        logger.info(
          `[Scheduler] AI Pattern Extraction completed: ${result.patternsExtracted} patterns from ${result.recordsProcessed} records`
        );
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] AI Pattern Extraction failed:', error.message);
      }
    });
    this.jobs.push(job11);

    // 12. AI Learning Consolidation - Run daily at 4:30 AM
    const job12 = cron.schedule('30 4 * * *', async () => {
      logger.info('[Scheduler] Running AI Learning Consolidation');
      try {
        const result = await learningSystem.consolidateLearnings();
        logger.info(
          `[Scheduler] AI Learning Consolidation completed: ${result.strategiesCreated} strategies created`
        );
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] AI Learning Consolidation failed:', error.message);
      }
    });
    this.jobs.push(job12);

    // 12b. AI Market (OpenRouter) sync - Run every 6 hours (offset from pattern extraction)
    const job12b = cron.schedule('15 */6 * * *', async () => {
      if (process.env.DISABLE_AI_MARKET_SYNC === 'true') return;
      logger.info('[Scheduler] Running AI Market sync (OpenRouter)');
      try {
        const { syncOpenRouterMarket } = await import('../services/ai/openRouterMarketService.js');
        const result = await syncOpenRouterMarket();
        if (!result.success) {
          logger.warn('[Scheduler] AI Market sync failed', { error: result.error });
        } else {
          logger.info('[Scheduler] AI Market sync completed', {
            snapshotId: result.snapshotId,
            insertedInboxItems: result.insertedInboxItems,
            limited: result.limited,
          });
        }
      } catch (err: any) {
        logger.error('[Scheduler] AI Market sync job failed:', err?.message || err);
      }
    });
    this.jobs.push(job12b);

    // 12c. AI Cost budget alerts (80/90/100%) - Run every hour
    const job12c = cron.schedule('5 * * * *', async () => {
      if (process.env.DISABLE_AI_COST_ALERTS === 'true') return;
      try {
        const { runAiCostBudgetAlerts } = await import('../services/ai/aiCostAlertsService.js');
        const result = await runAiCostBudgetAlerts();
        if (result.sent > 0) {
          logger.warn('[Scheduler] AI cost budget alerts sent', result);
        }
      } catch (err: any) {
        logger.error('[Scheduler] AI cost alerts job failed:', err?.message || err);
      }
    });
    this.jobs.push(job12c);

    // 13. AI Learning Data Cleanup - Run weekly on Monday at 5:00 AM
    const job13 = cron.schedule('0 5 * * 1', async () => {
      logger.info('[Scheduler] Running AI Learning Data Cleanup');
      try {
        const result = await learningSystem.cleanupOldData();
        logger.info(
          `[Scheduler] AI Learning Cleanup completed: ${result.deleted} old records deleted`
        );
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] AI Learning Cleanup failed:', error.message);
      }
    });
    this.jobs.push(job13);

    // 14. AI Memory Cleanup - Run weekly on Sunday at 2:00 AM
    // Cleans up old project memory, partial responses, and feedback
    const job14 = cron.schedule('0 2 * * 0', async () => {
      logger.info('[Scheduler] Running AI Memory Cleanup Cycle');
      try {
        const result = await aiMemoryManager.runCleanupCycle();
        logger.info(`[Scheduler] AI Memory Cleanup completed:`, {
          projectMemory: result.projectMemory?.deleted || 0,
          partialResponses: result.partialResponses?.deleted || 0,
          feedback: result.feedback?.deleted || 0,
          duration: `${result.duration}ms`,
        });
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] AI Memory Cleanup failed:', error.message);
      }
    });
    this.jobs.push(job14);

    // 15. Partial Response Cleanup - Run every hour
    // More frequent cleanup for streaming partial responses
    const job15 = cron.schedule('0 * * * *', async () => {
      try {
        const result = await aiMemoryManager.cleanupPartialResponses(1); // 1 hour
        if (result.deleted > 0) {
          logger.info(`[Scheduler] Partial Response Cleanup: ${result.deleted} entries removed`);
        }
      } catch (err: any) {
        // Silent fail - not critical
      }
    });
    this.jobs.push(job15);

    // 16. Feedback Learning Consolidation - Run daily at 4:00 AM
    // Consolidates user feedback into global AI strategies
    const job16 = cron.schedule('0 4 * * *', async () => {
      logger.info('[Scheduler] Running Feedback Learning Consolidation');
      try {
        const result = await feedbackService.consolidateLearning();
        logger.info(`[Scheduler] Feedback Consolidation completed:`, result);
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] Feedback Consolidation failed:', error.message);
      }
    });
    this.jobs.push(job16);

    // 17. AI Memory Metrics Aggregation - Run daily at 1:00 AM
    // Aggregates hourly memory metrics into daily summaries
    const job17 = cron.schedule('0 1 * * *', async () => {
      logger.info('[Scheduler] Running AI Memory Metrics Aggregation');
      try {
        const result = await aiMemoryMetricsService.aggregateDailyMetrics();
        logger.info(
          `[Scheduler] Memory Metrics Aggregation completed: ${result.aggregated} organizations for ${result.date}`
        );
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] Memory Metrics Aggregation failed:', error.message);
      }
    });
    this.jobs.push(job17);

    // 18. Memory Cleanup - Run every 6 hours
    // Cleans up old data, invalidates stale cache, and prevents memory leaks
    const job18 = cron.schedule('0 */6 * * *', async () => {
      logger.info('[Scheduler] Running Memory Cleanup');
      try {
        const { runMemoryCleanup } = await import('./MemoryCleanupJob.js');
        const result = await runMemoryCleanup();
        logger.info(
          `[Scheduler] Memory Cleanup completed: ${result.itemsCleaned} items cleaned, ${(result.memoryFreed / 1024 / 1024).toFixed(2)} MB freed`
        );
      } catch (err: any) {
        const error = err as Error;
        logger.error('[Scheduler] Memory Cleanup failed:', error.message);
      }
    });
    this.jobs.push(job18);

    // GAP-BILLING-002: Webhook Retry Queue Processing - Run every 5 minutes
    const job19 = cron.schedule('*/5 * * * *', async () => {
      try {
        const webhookRetryService = (await import('../services/webhookRetryService.js')).default;
        await webhookRetryService.processRetryQueue();
      } catch (err) {
        logger.error('[Scheduler] Webhook retry processing failed:', err);
      }
    });
    this.jobs.push(job19);

    // GAP-BILLING-002: Webhook Retry Cleanup - Run weekly on Sunday at 5:00 AM
    const job20 = cron.schedule('0 5 * * 0', async () => {
      try {
        const webhookRetryService = (await import('../services/webhookRetryService.js')).default;
        const cleaned = await webhookRetryService.cleanup(30);
        if (cleaned > 0) {
          logger.info(`[Scheduler] Cleaned up ${cleaned} old webhook retry records`);
        }
      } catch (err) {
        logger.error('[Scheduler] Webhook retry cleanup failed:', err);
      }
    });
    this.jobs.push(job20);

    // GAP-AI-004: Auto Recovery Probes - Run every 2 minutes
    const job21 = cron.schedule('*/2 * * * *', async () => {
      try {
        const CircuitBreakerService = (await import('../services/circuitBreakerService.js'))
          .default;
        const result = await CircuitBreakerService.runAutoRecoveryProbes();
        if (result.recovered > 0) {
          logger.info(`[Scheduler] Auto recovery probes: ${result.recovered} circuits recovered`);
        }
      } catch (err) {
        logger.error('[Scheduler] Auto recovery probes failed:', err);
      }
    });
    this.jobs.push(job21);

    // GAP-INVOICE-005: Invoice Reminders - Run daily at 9:00 AM
    const job22 = cron.schedule('0 9 * * *', async () => {
      try {
        const InvoiceReminderCron = (await import('./InvoiceReminderCron.js')).default;
        const result = await InvoiceReminderCron.runInvoiceReminders();
        if (result.reminders_sent > 0) {
          logger.info(`[Scheduler] Invoice reminders: sent ${result.reminders_sent} reminders`);
        }
      } catch (err) {
        logger.error('[Scheduler] Invoice reminders failed:', err);
      }
    });
    this.jobs.push(job22);

    // FLOW-DECISION-001: Process expired decisions - Run every hour
    const job23 = cron.schedule('0 * * * *', async () => {
      try {
        const decisionService = (await import('../services/decisionService.js')).default;
        const result = await decisionService.processExpiredDecisions();
        if (result.escalated > 0 || result.expired > 0) {
          logger.info(
            `[Scheduler] Decisions: ${result.escalated} escalated, ${result.expired} expired`
          );
        }
      } catch (err) {
        logger.error('[Scheduler] Decision processing failed:', err);
      }
    });
    this.jobs.push(job23);

    // EXECUTION: Process recurring tasks - Run daily at 1:00 AM
    const job24 = cron.schedule('0 1 * * *', async () => {
      logger.info('[Scheduler] Running Recurring Tasks Processing');
      try {
        const { processRecurringTasks } = await import('./RecurringTasksCron.js');
        const result = await processRecurringTasks();
        logger.info(
          `[Scheduler] Recurring tasks: ${result.created} created, ${result.skipped} skipped, ${result.deactivated} deactivated`
        );
      } catch (err) {
        logger.error('[Scheduler] Recurring tasks processing failed:', err);
      }
    });
    this.jobs.push(job24);

    // MYWORK: Daily Digest Emails - Run every hour to check for users with matching delivery time
    const job25 = cron.schedule('0 * * * *', async () => {
      logger.info('[Scheduler] Processing Daily Digest Emails');
      try {
        const { processDailyDigests } = await import('./DailyDigestCron.js');
        const result = await processDailyDigests();
        if (result.sent > 0 || result.failed > 0) {
          logger.info(
            `[Scheduler] Daily digests: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`
          );
        }
      } catch (err) {
        logger.error('[Scheduler] Daily digest processing failed:', err);
      }
    });
    this.jobs.push(job25);

    // MYWORK: Weekly Digest Emails - Run every Monday at 8:00 AM UTC
    const job26 = cron.schedule('0 8 * * 1', async () => {
      logger.info('[Scheduler] Processing Weekly Digest Emails');
      try {
        const { processWeeklyDigests } = await import('./DailyDigestCron.js');
        const result = await processWeeklyDigests();
        logger.info(
          `[Scheduler] Weekly digests: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`
        );
      } catch (err) {
        logger.error('[Scheduler] Weekly digest processing failed:', err);
      }
    });
    this.jobs.push(job26);

    const job27 = cron.schedule('30 5 * * *', async () => {
      logger.info('[Scheduler] Job 27: Core Docs drift check + reindex');
      try {
        const { coreDocsService } = await import('../services/ai/coreDocsService.js');
        const drift = await coreDocsService.detectDrift();
        if (drift.stale > 0 || drift.missing > 0) {
          logger.info(
            `[Scheduler] Core docs drift: ${drift.stale} stale, ${drift.missing} missing — reindexing`
          );
          await coreDocsService.ingestAll();
        } else {
          logger.info(`[Scheduler] Core docs up to date (${drift.upToDate}/${drift.totalDocs})`);
        }
      } catch (err: any) {
        logger.error('[Scheduler] Core docs reindex failed:', err?.message);
      }
    });
    this.jobs.push(job27);

    // 28. P02 Calendar Sync — Run every 5 minutes
    const job28 = cron.schedule('*/5 * * * *', async () => {
      try {
        const { syncAllSources } = await import('../services/v8/calendarSyncRuntime.js');
        await syncAllSources();
      } catch (err: any) {
        logger.error('[Scheduler] Calendar sync tick failed:', err?.message);
      }
    });
    this.jobs.push(job28);

    // 29. Organization Context Worker - Run every 30 seconds when enabled.
    // Off by default: requires ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true.
    // Honest degraded UI: when disabled, queue summary surfaces 'scheduler_disabled'.
    const job29 = cron.schedule('*/30 * * * * *', async () => {
      if (String(process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED || '').toLowerCase() !== 'true') {
        return;
      }
      try {
        const limit = Math.max(1, Math.min(Number(process.env.ORG_CONTEXT_WORKER_LIMIT || 5), 25));
        const contextDocumentService = (
          await import('../services/organizationContext/ContextDocumentService.js')
        ).default;
        const result = await contextDocumentService.processConfiguredContextDocumentWorkerTick({
          limit,
        });
        if (
          !result.skipped &&
          (result.processed > 0 ||
            result.retried > 0 ||
            result.deadLettered > 0 ||
            (result.errors && result.errors.length > 0))
        ) {
          logger.info('[Scheduler] Organization context worker tick completed', {
            processed: result.processed,
            retried: result.retried,
            deadLettered: result.deadLettered,
            errors: (result.errors || []).length,
          });
        }
      } catch (err: any) {
        logger.error('[Scheduler] Organization context worker tick failed:', err?.message || err);
      }
    });
    this.jobs.push(job29);

    // OPS-OBS-001: persist alert transitions every 30 seconds. The durable
    // service serializes each alert kind with an advisory transaction lock,
    // so multiple replicas converge on one incident/event chain. Opt-out is
    // reserved for emergency rollback; production defaults to durable state.
    const job29a = cron.schedule('*/30 * * * * *', async () => {
      if (process.env.OPERATIONAL_ALERT_LEDGER_ENABLED === 'false') return;
      try {
        const { persistCurrentOperationalAlerts } =
          await import('../services/operationalAlertIncidentCron.js');
        await persistCurrentOperationalAlerts();
      } catch (err: any) {
        logger.error('[Scheduler] Durable operational alert tick failed:', err?.message || err);
      }
    });
    this.jobs.push(job29a);

    // 30. Organization Context External Queue Consumer - Run every 30 seconds when external queue configured.
    // Off by default: requires ORG_CONTEXT_QUEUE_BACKEND=external + scheduler enabled + pull URL set.
    const job30 = cron.schedule('*/30 * * * * *', async () => {
      if (String(process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED || '').toLowerCase() !== 'true') {
        return;
      }
      const backend = String(process.env.ORG_CONTEXT_QUEUE_BACKEND || '').toLowerCase();
      if (backend !== 'external' && backend !== 'external_queue') {
        return;
      }
      if (!process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL) {
        return;
      }
      try {
        const limit = Math.max(1, Math.min(Number(process.env.ORG_CONTEXT_WORKER_LIMIT || 5), 25));
        const contextDocumentService = (
          await import('../services/organizationContext/ContextDocumentService.js')
        ).default;
        const result = await contextDocumentService.processExternalContextQueueConsumerTick({
          limit,
        });
        if (
          !result.skipped &&
          ((result.pulledMessages || 0) > 0 || (result.errors && result.errors.length > 0))
        ) {
          logger.info('[Scheduler] Organization context external queue consumer tick', {
            pulled: result.pulledMessages || 0,
            acked: result.ackedMessages || 0,
            backoff: result.backoffMessages || 0,
            processed: result.processed,
            errors: (result.errors || []).length,
          });
        }
      } catch (err: any) {
        logger.error(
          '[Scheduler] Organization context external queue consumer failed:',
          err?.message || err
        );
      }
    });
    this.jobs.push(job30);

    // 31. Organization Context Retention Purge - Run daily at 3:30 AM.
    // Honest degradation: only purges documents whose org has retention TTL configured.
    const job31 = cron.schedule('30 3 * * *', async () => {
      try {
        const contextDocumentService = (
          await import('../services/organizationContext/ContextDocumentService.js')
        ).default;
        if (typeof (contextDocumentService as any).purgeExpiredContextDocuments !== 'function') {
          return;
        }
        const result = await (contextDocumentService as any).purgeExpiredContextDocuments({
          batchLimit: 200,
        });
        if (result && (result.softDeleted > 0 || result.hardDeleted > 0)) {
          logger.info('[Scheduler] Organization context retention purge completed', result);
        }
      } catch (err: any) {
        logger.error(
          '[Scheduler] Organization context retention purge failed:',
          err?.message || err
        );
      }
    });
    this.jobs.push(job31);

    // 32. Interview reminder + escalation — Run hourly.
    // I1 fix: interviewReminderJob implements the advertised 48h/24h/2h
    // reminder + post-deadline auto-escalation, but was never registered in
    // the scheduler (the job header said "run via npx ts-node"). Without this
    // the entire automatic-reminder feature was dormant — assignees got the
    // initial notification and nothing else; overdue assignments never
    // escalated to the manager.
    const job32 = cron.schedule('0 * * * *', async () => {
      try {
        const { runJob } = await import('../jobs/interviewReminderJob.js');
        const result = await runJob();
        if (result.reminders.sent > 0 || result.escalations.escalated > 0) {
          logger.info(
            `[Scheduler] Interview reminders: ${result.reminders.sent} sent, ${result.escalations.escalated} escalated`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Interview reminder job failed:', err?.message || err);
      }
    });
    this.jobs.push(job32);

    // 33. Initiative due-date breach scan (M13/R4-E3) — daily 6AM.
    // Behavioural change → behind a flag (default OFF, safe for live clients).
    const job33 = cron.schedule('0 6 * * *', async () => {
      if (process.env.INITIATIVE_DUE_BREACH_CRON_ENABLED !== 'true') return;
      try {
        const { runDueBreachScan } = await import('./InitiativeDueBreachCron.js');
        const result = await runDueBreachScan();
        if (result.notified > 0 || result.errors > 0) {
          logger.info(
            `[Scheduler] Initiative due-breach: scanned=${result.scanned} notified=${result.notified} skipped=${result.skipped} errors=${result.errors}`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Initiative due-breach scan failed:', err?.message || err);
      }
    });
    this.jobs.push(job33);

    // 34. M14/F6 execution report cadence scan (detect due reports) — daily 6:15AM.
    // Behavioural → behind a flag (default OFF, safe for live clients).
    const job34 = cron.schedule('15 6 * * *', async () => {
      if (process.env.EXECUTION_REPORT_CADENCE_CRON_ENABLED !== 'true') return;
      try {
        const { runReportCadenceScan } = await import('./ExecutionReportCron.js');
        const r = await runReportCadenceScan();
        if (r.due > 0 || r.errors > 0) {
          logger.info(
            `[Scheduler] Execution report cadence: orgs=${r.orgs} due=${r.due} errors=${r.errors}`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Execution report cadence scan failed:', err?.message || err);
      }
    });
    this.jobs.push(job34);

    // 35. M14/F6 execution report distribution (send queued) — every 30min.
    // Behavioural → behind a flag (default OFF, safe for live clients).
    const job35 = cron.schedule('*/30 * * * *', async () => {
      if (process.env.EXECUTION_REPORT_DISTRIBUTION_CRON_ENABLED !== 'true') return;
      try {
        const { runReportDistributionScan } = await import('./ExecutionReportCron.js');
        const r = await runReportDistributionScan();
        if (r.sent > 0 || r.failed > 0 || r.errors > 0) {
          logger.info(
            `[Scheduler] Execution report distribution: orgs=${r.orgs} sent=${r.sent} failed=${r.failed} errors=${r.errors}`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Execution report distribution scan failed:', err?.message || err);
      }
    });
    this.jobs.push(job35);

    // 36. Initiative candidate auto-scan (R5) — proactive inbox, every 30min.
    // Behavioural + spends LLM tokens → behind a flag (default OFF, safe for live).
    const job36 = cron.schedule('*/30 * * * *', async () => {
      if (process.env.INITIATIVE_CANDIDATE_SCAN_CRON_ENABLED !== 'true') return;
      try {
        const { runCandidateScan } = await import('./InitiativeCandidateScanCron.js');
        const r = await runCandidateScan();
        if (r.created > 0 || r.errors > 0) {
          logger.info(
            `[Scheduler] Initiative candidate scan: orgs=${r.orgs} created=${r.created} errors=${r.errors}`
          );
        }
      } catch (err: any) {
        logger.error('[Scheduler] Initiative candidate scan failed:', err?.message || err);
      }
    });
    this.jobs.push(job36);

    // 37. Idea Map Auto-Snapshots (M06 F0.5) — every N minutes (default 15).
    // Snapshots changed idea maps into my_idea_map_snapshots (the SnapshotHistory
    // canon) with an `auto:`-prefixed label; prunes old auto snapshots (default
    // keep 20 per map), never touches manual snapshots.
    // Config: IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN, IDEA_MAP_AUTO_SNAPSHOT_RETENTION,
    // DISABLE_IDEA_MAP_AUTO_SNAPSHOTS=true to turn off.
    const { autoSnapshotCronExpression } = await import('../jobs/ideaMapAutoSnapshotJob.js');
    const job37 = cron.schedule(autoSnapshotCronExpression(), async () => {
      if (process.env.DISABLE_IDEA_MAP_AUTO_SNAPSHOTS === 'true') return;
      try {
        const { runIdeaMapAutoSnapshots } = await import('../jobs/ideaMapAutoSnapshotJob.js');
        const result = await runIdeaMapAutoSnapshots();
        if (result.snapshotted > 0 || result.pruned > 0 || result.errors > 0) {
          logger.info('[Scheduler] Idea map auto-snapshots completed', result);
        }
      } catch (err: any) {
        logger.error('[Scheduler] Idea map auto-snapshot job failed:', err?.message || err);
      }
    });
    this.jobs.push(job37);

    // 38. Agent Plan Scheduler (Fala 1 flow, 2026-07-26) — every 2 min:
    // dispatches 'scheduled' plans whose scheduled_at has passed (Harmonogram)
    // and auto-resumes 'wait_until' pause steps whose resumeAt has passed
    // (Odczekaj). See server/src/jobs/agentPlanSchedulerJob.ts header.
    const job38 = cron.schedule('*/2 * * * *', async () => {
      if (process.env.ENABLE_AI_TASKS_WORKER !== 'true') return;
      try {
        const { runAgentPlanScheduler } = await import('../jobs/agentPlanSchedulerJob.js');
        await runAgentPlanScheduler();
      } catch (err: any) {
        logger.error('[Scheduler] Agent plan scheduler job failed:', err?.message || err);
      }
    });
    this.jobs.push(job38);

    // 39. MAT-010 Artifact Lineage Reconciliation — Run every 5 minutes.
    // Production recovery trigger for the durable lineage outbox: replays
    // durable PENDING markers (single-write-failure case) and runs the
    // deterministic backfill scan (double-failure case on `created`).
    // Default ON — this is a data-durability safety net, not a behavioral
    // change to any live surface. Set ARTIFACT_LINEAGE_RECONCILE_CRON_ENABLED=false
    // to disable. See server/src/jobs/artifactLineageReconciliationJob.ts.
    const job39 = cron.schedule('*/5 * * * *', async () => {
      if (process.env.ARTIFACT_LINEAGE_RECONCILE_CRON_ENABLED === 'false') return;
      try {
        const { runArtifactLineageReconciliationTick } =
          await import('../jobs/artifactLineageReconciliationJob.js');
        await runArtifactLineageReconciliationTick();
      } catch (err: any) {
        logger.error(
          '[Scheduler] Artifact lineage reconciliation tick failed:',
          err?.message || err
        );
      }
    });
    this.jobs.push(job39);

    // 40. Durable Agent schedule worker — DB leases protect overlapping ticks
    // and allow the next process to recover work after a worker restart.
    const job40 = cron.schedule('* * * * *', async () => {
      if (process.env.AGENT_SCHEDULE_CRON_ENABLED === 'false') return;
      try {
        const { runWave8AgentScheduleTick } = await import('../jobs/wave8AgentScheduleJob.js');
        await runWave8AgentScheduleTick();
      } catch (err: any) {
        logger.error('[Scheduler] Durable Agent schedule tick failed:', err?.message || err);
      }
    });
    this.jobs.push(job40);

    const job41 = cron.schedule('* * * * *', async () => {
      if (process.env.RECOVERY_EXPERIMENT_CRON_ENABLED === 'false') return;
      try {
        const { runRecoveryExperimentRemeasurementTick } =
          await import('../jobs/recoveryExperimentRemeasurementJob.js');
        await runRecoveryExperimentRemeasurementTick();
      } catch (err: any) {
        logger.error(
          '[Scheduler] Recovery experiment remeasurement tick failed:',
          err?.message || err
        );
      }
    });
    this.jobs.push(job41);

    // 42. Finance v3 compute job queue — lease reaper (WP-B04 ADR §5.3, EM-1
    // closeout). Run every minute: the W9 fault matrix measured that an
    // abandoned job (worker crash/OOM/deploy after claim(), before
    // completeJobSuccess()/failJob()) stayed `running` FOREVER — claim()
    // only looks at status='queued', so the row became permanently
    // unreachable. reapExpiredLeases() (server/src/services/finance/canonical/
    // computeJobService.ts) requeues it (with backoff) or dead-letters it
    // (DLQ, raising an EM-6 exception-ledger entry) once its lease is past
    // `lease_expires_at` with no heartbeat (EM-2) having renewed it.
    // Default ON — this is a pure data-recovery safety net (nothing it does
    // is reachable unless a lease has ALREADY expired), same category as
    // job39 (artifact lineage reconciliation). Set
    // COMPUTE_JOB_REAPER_CRON_ENABLED=false to disable.
    const job42 = cron.schedule('* * * * *', async () => {
      if (process.env.COMPUTE_JOB_REAPER_CRON_ENABLED === 'false') return;
      try {
        const { reapExpiredLeases } =
          await import('../services/finance/canonical/computeJobService.js');
        const reaped = await reapExpiredLeases({ batchSize: 100 });
        if (reaped.length > 0) {
          logger.warn('[Scheduler] Compute job lease reaper reclaimed abandoned jobs', {
            count: reaped.length,
            requeued: reaped.filter((r) => r.outcome === 'requeued').length,
            deadLettered: reaped.filter((r) => r.outcome === 'dead_lettered').length,
          });
        }
      } catch (err: any) {
        logger.error('[Scheduler] Compute job lease reaper tick failed:', err?.message || err);
      }
    });
    this.jobs.push(job42);

    // 43. Audit independence detector sweep (AUD-POL-001 / AMD-AUD-RIGHTS-001)
    // — one bounded, cursor-checkpointed, fenced tick every 15min. Read-only:
    // it walks audit_programs via a durable cursor (see
    // services/audits/independenceScanCursor.ts) and logs any
    // segregation-of-duties violation that bypassed the write-time guards in
    // permissions.ts.
    //
    // DEFAULT-OFF, like the other new-behaviour crons above. Enabling the flag
    // changes ONLY whether the scan runs — it grants no access, alters no
    // policy, mutates no audit data, and adds no UI. Until it is enabled in a
    // real deployment and observed running, do not describe the detector as
    // "operationalized" or "deployed"; "implemented, gated off" is the honest
    // description (see the job file's header).
    const job43 = cron.schedule('*/15 * * * *', runAuditIndependenceSchedulerTick);
    this.jobs.push(job43);

    logger.info(
      '[Scheduler] Jobs scheduled: Retention (Daily 3AM), Reconciliation (Weekly Sun 4AM), Trial/Demo (Daily 2:30AM), Metrics (Daily 2:45AM), SLA (Every 10min), Notifications (Every 10min), AI Budget (Monthly 1st), Scheduled Reports (Hourly), Scheduled Emails (Every 15min), AI Pattern Extraction (Every 6h), AI Consolidation (Daily 4:30AM), AI Cleanup (Weekly Mon 5AM), AI Memory Cleanup (Weekly Sun 2AM), Partial Response Cleanup (Hourly), Feedback Consolidation (Daily 4AM), Memory Cleanup (Every 6h), Webhook Retry (Every 5min), Auto Recovery (Every 2min), Invoice Reminders (Daily 9AM), Interview Reminders (Hourly), Idea Map Auto-Snapshots (Every 15min default), Agent Plan Scheduler (Every 2min), Artifact Lineage Reconciliation (Every 5min), Compute Job Lease Reaper (Every 1min), Audit Independence Detector Sweep (Every 15min tick, default-off)'
    );
  },
  stop(): void {
    logger.info('[Scheduler] Stopping all cron jobs...');
    this.jobs.forEach((job) => {
      job.stop();
    });
    this.jobs = [];
    logger.info('[Scheduler] All cron jobs stopped');
  },
};

export const getScheduler = () => Scheduler;
export const init = () => Scheduler.init();

export default Scheduler;
