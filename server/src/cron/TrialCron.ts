/**
 * Trial/Demo Cron Jobs
 *
 * Scheduled tasks for:
 * - Demo organization cleanup (24h expiry)
 * - Trial warning notifications (T-7 days)
 * - Trial expiration lockdown
 * - Daily usage counter resets
 *
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface DemoService {
  cleanupExpiredDemos: () => Promise<number>;
}

interface TrialService {
  sendTrialWarnings: () => Promise<number>;
  processExpiredTrials: () => Promise<number>;
}

interface Dependencies {
  db: IDatabase;
  demoService: DemoService;
  trialService: TrialService;
}

interface DailyTrialTasksResult {
  demosCleanedUp: number;
  warningsSent: number;
  trialsLocked: number;
  demoCleanupSkipped?: boolean;
}

// ==========================================
// TRIAL CRON
// ==========================================

class TrialCron {
  private deps: Partial<Dependencies>;

  constructor(deps?: Partial<Dependencies>) {
    this.deps = {
      db: deps?.db || getDatabase(),
      demoService: deps?.demoService,
      trialService: deps?.trialService,
    };
  }

  private async ensureDeps(): Promise<Dependencies> {
    if (!this.deps.demoService) {
      try {
        // T7b-1 (2026-07-19): demoService.cleanupExpiredDemos now has a REAL implementation
        // (was a dead self-import wrapper — finding_42_self_import_wrappers_services_2026-07-15).
        // The try/catch below is now genuine fail-soft, not a guaranteed-dead path.
        const loaded = await import('../services/demoService.js').then((m) => m.default || m);
        this.deps.demoService = (await Promise.resolve(loaded)) as any;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('[TrialCron] DemoService unavailable; demo cleanup disabled:', err.message);
      }
    }
    if (!this.deps.trialService) {
      const loaded = await import('../services/trialService.js').then((m) => m.default || m);
      // Support both "service object" and historical "Promise of service" exports.
      this.deps.trialService = (await Promise.resolve(loaded)) as any;
    }
    return this.deps as Dependencies;
  }

  /**
   * Run all trial/demo scheduled tasks
   * Call this from main scheduler (daily)
   */
  async runDailyTrialTasks(): Promise<DailyTrialTasksResult> {
    const deps = await this.ensureDeps();
    logger.info('[TrialCron] Starting daily trial/demo tasks...');

    try {
      let demosCleanedUp = 0;
      let demoCleanupSkipped = false;

      if (deps.demoService && typeof deps.demoService.cleanupExpiredDemos === 'function') {
        demosCleanedUp = await deps.demoService.cleanupExpiredDemos();
        logger.info(`[TrialCron] Cleaned up ${demosCleanedUp} expired demo organization(s)`);
      } else {
        demoCleanupSkipped = true;
        logger.warn('[TrialCron] DemoService unavailable; skipping demo cleanup');
      }

      if (
        !deps.trialService ||
        typeof deps.trialService.sendTrialWarnings !== 'function' ||
        typeof deps.trialService.processExpiredTrials !== 'function'
      ) {
        logger.warn('[TrialCron] TrialService unavailable; skipping daily trial tasks');
        return {
          demosCleanedUp,
          warningsSent: 0,
          trialsLocked: 0,
          demoCleanupSkipped,
        };
      }

      // 2. Send trial warning notifications (T-7 days)
      const warningsSent = await deps.trialService.sendTrialWarnings();
      logger.info(`[TrialCron] Sent ${warningsSent} trial warning notification(s)`);

      // 3. Lock expired trials
      const trialsLocked = await deps.trialService.processExpiredTrials();
      logger.info(`[TrialCron] Locked ${trialsLocked} expired trial organization(s)`);

      logger.info('[TrialCron] Daily trial/demo tasks completed successfully');

      return {
        demosCleanedUp,
        warningsSent,
        trialsLocked,
        demoCleanupSkipped,
      };
    } catch (error: unknown) {
      logger.error('[TrialCron] Error running daily trial tasks:', error);
      throw error;
    }
  }

  /**
   * Reset usage counters (optional - counters auto-reset by date)
   * This cleans up old counter records older than 30 days
   */
  async cleanupOldUsageCounters(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const result = await DbPromise.run(`DELETE FROM usage_counters WHERE counter_date < ?`, [
        cutoffDate,
      ]);

      const deleted = result.changes || 0;
      logger.info(`[TrialCron] Cleaned up ${deleted} old usage counter record(s)`);
      return deleted;
    } catch (err: any) {
      logger.error('[TrialCron] Error cleaning up usage counters:', err);
      throw err;
    }
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: TrialCron | null = null;

export function getTrialCron(deps?: Partial<Dependencies>): TrialCron {
  if (!instance) {
    instance = new TrialCron(deps);
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const runDailyTrialTasks = async (
  deps?: Partial<Dependencies>
): Promise<DailyTrialTasksResult> => {
  return getTrialCron(deps).runDailyTrialTasks();
};

export const cleanupOldUsageCounters = async (deps?: Partial<Dependencies>): Promise<number> => {
  return getTrialCron(deps).cleanupOldUsageCounters();
};

export default TrialCron;
