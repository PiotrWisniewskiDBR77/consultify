/**
 * Dunning Cron Job
 * 
 * Processes scheduled dunning actions:
 * - Payment retries
 * - Stage advancement
 * - Suspension enforcement
 * 
 * Runs every hour.
 * 
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import * as cron from 'node-cron';
import logger from '../utils/Logger.js';




// ==========================================
// TYPES
// ==========================================

interface DunningService {
    processScheduledRetries: () => Promise<void>;
}

interface SentryConfig {
    captureException: (error: Error, options?: { tags?: Record<string, string> }) => void;
}

interface Dependencies {
    dunningService: DunningService;
    sentry?: SentryConfig;
}

// ==========================================
// DUNNING CRON
// ==========================================

class DunningCron {
    private deps: Dependencies;
    private job: cron.ScheduledTask | null = null;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            dunningService: deps?.dunningService || await import('../../services/dunningService.js').then(m => m.default || m),
            sentry: deps?.sentry,
        };
    }

    /**
     * Start the dunning cron job
     */
    startDunningJob(): void {
        if (process.env.DISABLE_DUNNING_CRON === 'true') {
            logger.info('[DunningCron] Disabled via environment variable');
            return;
        }

        // Every hour at minute 30
        this.job = cron.schedule('30 * * * *', async () => {
            logger.info('[DunningCron] Starting scheduled dunning processing...');

            try {
                await this.deps.dunningService.processScheduledRetries();
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error('[DunningCron] Processing failed:', err);

                // Report to Sentry if available
                if (this.deps.sentry) {
                    try {
                        this.deps.sentry.captureException(err, {
                            tags: { component: 'dunning', job: 'scheduled' },
                        });
                    } catch (e) {
                        // Sentry not available
                    }
                }
            }
        }, {
            timezone: 'UTC',
        });

        logger.info('[DunningCron] Scheduled hourly dunning processing at :30');
    }

    /**
     * Stop the dunning cron job
     */
    stopDunningJob(): void {
        if (this.job) {
            this.job.stop();
            this.job = null;
            logger.info('[DunningCron] Stopped');
        }
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: DunningCron | null = null;

export function getDunningCron(deps?: Partial<Dependencies>): DunningCron {
    if (!instance) {
        instance = new DunningCron(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const startDunningJob = (deps?: Partial<Dependencies>): void => {
    getDunningCron(deps).startDunningJob();
};

export const stopDunningJob = (deps?: Partial<Dependencies>): void => {
    getDunningCron(deps).stopDunningJob();
};

export default DunningCron;

