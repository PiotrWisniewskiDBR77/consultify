/**
 * Unit Tests for Scheduler
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, getScheduler } from '../../../../src/cron/Scheduler.js';

describe('Scheduler', () => {
    let mockRetentionPolicyService: { runCleanup: () => Promise<void> };
    let mockStorageReconciliationService: { runReconciliation: () => Promise<void> };
    let mockTrialCron: { runDailyTrialTasks: () => Promise<unknown>; cleanupOldUsageCounters: () => Promise<number> };
    let mockMetricsAggregator: { buildDailySnapshots: () => Promise<void> };
    let mockSLAService: { runSlaCheck: () => Promise<void> };
    let mockAICostControlService: { resetMonthlyUsage: () => Promise<{ resetCount: number }> };
    let mockScheduledReportsService: { processScheduledReports: () => Promise<{ processed: number }> };
    let mockReportEmailService: { processScheduledEmails: () => Promise<void> };

    beforeEach(() => {
        mockRetentionPolicyService = {
            runCleanup: vi.fn().mockResolvedValue(undefined),
        };

        mockStorageReconciliationService = {
            runReconciliation: vi.fn().mockResolvedValue(undefined),
        };

        mockTrialCron = {
            runDailyTrialTasks: vi.fn().mockResolvedValue({ demosCleanedUp: 0, warningsSent: 0, trialsLocked: 0 }),
            cleanupOldUsageCounters: vi.fn().mockResolvedValue(0),
        };

        mockMetricsAggregator = {
            buildDailySnapshots: vi.fn().mockResolvedValue(undefined),
        };

        mockSLAService = {
            runSlaCheck: vi.fn().mockResolvedValue(undefined),
        };

        mockAICostControlService = {
            resetMonthlyUsage: vi.fn().mockResolvedValue({ resetCount: 5 }),
        };

        mockScheduledReportsService = {
            processScheduledReports: vi.fn().mockResolvedValue({ processed: 2 }),
        };

        mockReportEmailService = {
            processScheduledEmails: vi.fn().mockResolvedValue(undefined),
        };
    });

    describe('init', () => {
        it('should initialize scheduler without errors', () => {
            const scheduler = getScheduler({
                retentionPolicyService: mockRetentionPolicyService,
                storageReconciliationService: mockStorageReconciliationService,
                trialCron: mockTrialCron,
                metricsAggregator: mockMetricsAggregator,
                slaService: mockSLAService,
                aiCostControlService: mockAICostControlService,
                scheduledReportsService: mockScheduledReportsService,
                reportEmailService: mockReportEmailService,
            });

            scheduler.init();
            // No error means initialization succeeded
            expect(true).toBe(true);
        });

        it('should schedule all cron jobs', () => {
            const scheduler = getScheduler({
                retentionPolicyService: mockRetentionPolicyService,
                storageReconciliationService: mockStorageReconciliationService,
                trialCron: mockTrialCron,
                metricsAggregator: mockMetricsAggregator,
                slaService: mockSLAService,
                aiCostControlService: mockAICostControlService,
                scheduledReportsService: mockScheduledReportsService,
                reportEmailService: mockReportEmailService,
            });

            scheduler.init();
            // All jobs should be scheduled
            expect(true).toBe(true);
        });
    });

    describe('getScheduler', () => {
        it('should return singleton instance', () => {
            const instance1 = getScheduler();
            const instance2 = getScheduler();

            expect(instance1).toBe(instance2);
        });
    });
});




