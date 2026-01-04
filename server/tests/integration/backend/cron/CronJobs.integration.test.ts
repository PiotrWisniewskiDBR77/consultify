/**
 * Cron Jobs Integration Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.7: Rozszerzenie testów dla Cron Jobs - 80%+ coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getBackupCron,
    getBillingCron,
    getCleanupRevokedTokensCron,
    getDunningCron,
    getHealthCheckJob,
    getSnapshotMetricsCron,
    getTrialCron,
    initScheduler,
} from '../../../../src/cron/index.js';

describe('Cron Jobs Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Cleanup if needed
    });

    describe('Scheduler Initialization', () => {
        it('should initialize scheduler without errors', () => {
            expect(() => {
                initScheduler();
            }).not.toThrow();
        });

        it('should return scheduler instance', () => {
            const scheduler = initScheduler();
            expect(scheduler).toBeDefined();
        });
    });

    describe('Billing Cron', () => {
        it('should get billing cron instance', () => {
            const cron = getBillingCron();
            expect(cron).toBeDefined();
        });

        it('should have required methods', () => {
            const cron = getBillingCron();
            expect(cron).toHaveProperty('start');
            expect(cron).toHaveProperty('stop');
        });
    });

    describe('Snapshot Metrics Cron', () => {
        it('should get snapshot metrics cron instance', () => {
            const cron = getSnapshotMetricsCron();
            expect(cron).toBeDefined();
        });
    });

    describe('Dunning Cron', () => {
        it('should get dunning cron instance', () => {
            const cron = getDunningCron();
            expect(cron).toBeDefined();
        });
    });

    describe('Backup Cron', () => {
        it('should get backup cron instance', () => {
            const cron = getBackupCron();
            expect(cron).toBeDefined();
        });
    });

    describe('Trial Cron', () => {
        it('should get trial cron instance', () => {
            const cron = getTrialCron();
            expect(cron).toBeDefined();
        });
    });

    describe('Health Check Job', () => {
        it('should get health check job instance', () => {
            const job = getHealthCheckJob();
            expect(job).toBeDefined();
        });
    });

    describe('Cleanup Revoked Tokens Cron', () => {
        it('should get cleanup revoked tokens cron instance', () => {
            const cron = getCleanupRevokedTokensCron();
            expect(cron).toBeDefined();
        });
    });
});

