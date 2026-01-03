/**
 * Health Check Cron Job
 * Monitors database connectivity and sends alerts on failure.
 * 
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import * as cron from 'node-cron';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';
import * as DbPromise from '../utils/DbPromise.js';




// ==========================================
// TYPES
// ==========================================

interface EmailService {
    sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
}

interface Dependencies {
    db: IDatabase;
    emailService: EmailService;
    alertEmail: string;
    alertThreshold: number;
}

// ==========================================
// HEALTH CHECK CRON
// ==========================================

class HealthCheckJob {
    private deps: Dependencies;
    private job: cron.ScheduledTask | null = null;
    private isSystemHealthy = true; // Track previous state to avoid spamming
    private consecutiveFailures = 0;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            db: deps?.db || getDatabase(),
            emailService: deps?.emailService || await import('../../services/emailService.js').then(m => m.default || m),
            alertEmail: deps?.alertEmail || 'piotr.wisniewski@dbr77.com',
            alertThreshold: deps?.alertThreshold || 1, // Send alert immediately on first confirmed failure
        };
    }

    /**
     * Start the health check cron job
     * Runs every minute
     */
    startHealthCheck(): void {
        // Run every minute: * * * * *
        this.job = cron.schedule('* * * * *', async () => {
            const start = Date.now();
            
            try {
                await DbPromise.get('SELECT 1', []);

                // SUCCESS
                if (!this.isSystemHealthy) {
                    // System just came UP
                    logger.info('[HEALTH CHECK] RECOVERED');
                    await this.deps.emailService.sendEmail(
                        this.deps.alertEmail,
                        'RESOLVED: System Database Recovered',
                        `
                        <h1>System Recovered</h1>
                        <p>The Consultify database is back online.</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        `
                    );
                    this.isSystemHealthy = true;
                    this.consecutiveFailures = 0;
                }
            } catch (err) {
                // FAILURE
                this.consecutiveFailures++;
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[HEALTH CHECK] FAILED (Consecutive: ${this.consecutiveFailures}) - ${error.message}`);

                if (this.isSystemHealthy) {
                    this.isSystemHealthy = false;
                    // System just went DOWN
                    await this.deps.emailService.sendEmail(
                        this.deps.alertEmail,
                        'CRITICAL ALERT: System Database Down',
                        `
                        <h1>System Alert</h1>
                        <p>The Consultify database is unreachable.</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        <p>Please investigate immediately.</p>
                        `
                    );
                }
            }
        });

        logger.info('[Scheduler] Health Check Job started (every minute)');
    }

    /**
     * Stop the health check cron job
     */
    stopHealthCheck(): void {
        if (this.job) {
            this.job.stop();
            this.job = null;
            logger.info('[Scheduler] Health Check Job stopped');
        }
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: HealthCheckJob | null = null;

export function getHealthCheckJob(deps?: Partial<Dependencies>): HealthCheckJob {
    if (!instance) {
        instance = new HealthCheckJob(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const startHealthCheck = (deps?: Partial<Dependencies>): void => {
    getHealthCheckJob(deps).startHealthCheck();
};

export default HealthCheckJob;

