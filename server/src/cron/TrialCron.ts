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
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

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
    private deps: Dependencies;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            db: deps?.db || getDatabase(),
            demoService: deps?.demoService || require('../../services/demoService.js'),
            trialService: deps?.trialService || require('../../services/trialService.js'),
        };
    }

    /**
     * Run all trial/demo scheduled tasks
     * Call this from main scheduler (daily)
     */
    async runDailyTrialTasks(): Promise<DailyTrialTasksResult> {
        logger.info('[TrialCron] Starting daily trial/demo tasks...');

        try {
            // 1. Cleanup expired demo organizations
            const demosCleanedUp = await this.deps.demoService.cleanupExpiredDemos();
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
        } catch (error) {
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

        return new Promise((resolve, reject) => {
            const dbResult = this.deps.db.run(
                `DELETE FROM usage_counters WHERE counter_date < ?`,
                [cutoffDate],
                function (err) {
                    if (err) {
                        logger.error('[TrialCron] Error cleaning up usage counters:', err);
                        reject(err);
                    } else {
                        // In SQLite, db.run() returns the database object, and 'this' in the callback refers to it
                        // The database object has a 'changes' property
                        const deleted = (this as { changes?: number }).changes || 0;
                        logger.info(`[TrialCron] Cleaned up ${deleted} old usage counter record(s)`);
                        resolve(deleted);
                    }
                }
            );
            
            // Fallback: if db.run() returns a Promise, handle it
            if (dbResult && typeof (dbResult as Promise<{ changes: number }>).then === 'function') {
                (dbResult as Promise<{ changes: number }>).then((result) => {
                    const deleted = result.changes || 0;
                    logger.info(`[TrialCron] Cleaned up ${deleted} old usage counter record(s)`);
                    resolve(deleted);
                }).catch((err) => {
                    logger.error('[TrialCron] Error cleaning up usage counters:', err);
                    reject(err);
                });
            }
        });
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

