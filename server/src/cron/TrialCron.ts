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

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';
import * as DbPromise from '../utils/DbPromise.js';




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
            this.deps.demoService = await import('../services/demoService.js').then(m => m.default || m);
        }
        if (!this.deps.trialService) {
            this.deps.trialService = await import('../services/trialService.js').then(m => m.default || m);
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
            // 1. Cleanup expired demo organizations
            const demosCleanedUp = await deps.demoService.cleanupExpiredDemos();
            logger.info(`[TrialCron] Cleaned up ${demosCleanedUp} expired demo organization(s)`);

            // 2. Send trial warning notifications (T-7 days)
            const warningsSent = await this.deps.trialService.sendTrialWarnings();
            logger.info(`[TrialCron] Sent ${warningsSent} trial warning notification(s)`);

            // 3. Lock expired trials
            const trialsLocked = await this.deps.trialService.processExpiredTrials();
            logger.info(`[TrialCron] Locked ${trialsLocked} expired trial organization(s)`);

            logger.info('[TrialCron] Daily trial/demo tasks completed successfully');

            return {
                demosCleanedUp,
                warningsSent,
                trialsLocked,
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
            const result = await DbPromise.run(
                `DELETE FROM usage_counters WHERE counter_date < ?`,
                [cutoffDate]
            );

            const deleted = result.changes || 0;
            logger.info(`[TrialCron] Cleaned up ${deleted} old usage counter record(s)`);
            return deleted;
        } catch (err: unknown) {
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

export const runDailyTrialTasks = async (deps?: Partial<Dependencies>): Promise<DailyTrialTasksResult> => {
    return getTrialCron(deps).runDailyTrialTasks();
};

export const cleanupOldUsageCounters = async (deps?: Partial<Dependencies>): Promise<number> => {
    return getTrialCron(deps).cleanupOldUsageCounters();
};

export default TrialCron;

