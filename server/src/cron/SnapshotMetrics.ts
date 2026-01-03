/**
 * Metrics Snapshot Cron Job
 * Runs every hour at minute 0 to save metrics snapshots
 * 
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import * as cron from 'node-cron';
import logger from '../utils/Logger.js';




// ==========================================
// TYPES
// ==========================================

interface MetricsPersistenceService {
    saveSnapshot: (reset?: boolean) => Promise<void>;
}

interface Dependencies {
    metricsPersistenceService: MetricsPersistenceService;
}

// ==========================================
// SNAPSHOT METRICS CRON
// ==========================================

class SnapshotMetricsCron {
    private deps: Dependencies;
    private job: cron.ScheduledTask | null = null;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            metricsPersistenceService: deps?.metricsPersistenceService,
        };
    }

    private async ensureDeps(): Promise<Dependencies> {
        if (!this.deps.metricsPersistenceService) {
            this.deps.metricsPersistenceService = await import('../../services/metricsPersistenceService.js').then(m => m.default || m);
        }
        return this.deps as Dependencies;
    }

    /**
     * Initialize the metrics snapshot cron job
     * Runs every hour at minute 0
     */
    init(): void {
        // Schedule task for top of every hour
        this.job = cron.schedule('0 * * * *', async () => {
            const deps = await this.ensureDeps();
            logger.info('[Cron] Running scheduled metrics snapshot...');
            try {
                await deps.metricsPersistenceService.saveSnapshot(true); // Save and reset
            } catch (err) {
                logger.error('[Cron] Metrics snapshot failed:', err);
            }
        });

        logger.info('[Cron] Metrics snapshot job scheduled (Hourly).');
    }

    /**
     * Stop the cron job
     */
    stop(): void {
        if (this.job) {
            this.job.stop();
            this.job = null;
            logger.info('[Cron] Metrics snapshot job stopped');
        }
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: SnapshotMetricsCron | null = null;

export function getSnapshotMetricsCron(deps?: Partial<Dependencies>): SnapshotMetricsCron {
    if (!instance) {
        instance = new SnapshotMetricsCron(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const initMetricsSnapshotJob = (deps?: Partial<Dependencies>): void => {
    getSnapshotMetricsCron(deps).init();
};

export default SnapshotMetricsCron;



