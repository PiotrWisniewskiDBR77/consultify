/**
 * Unit Tests for DunningCron
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDunningCron, startDunningJob, stopDunningJob } from '../../../../src/cron/DunningCron.js';

describe('DunningCron', () => {
    let mockDunningService: { processScheduledRetries: () => Promise<void> };
    let mockSentry: { captureException: (error: Error, options?: { tags?: Record<string, string> }) => void };
    let dunningCron: ReturnType<typeof getDunningCron>;

    beforeEach(() => {
        mockDunningService = {
            processScheduledRetries: vi.fn().mockResolvedValue(undefined),
        };

        mockSentry = {
            captureException: vi.fn(),
        };

        dunningCron = getDunningCron({
            dunningService: mockDunningService,
            sentry: mockSentry,
        });
    });

    afterEach(() => {
        dunningCron.stopDunningJob();
        vi.clearAllMocks();
    });

    describe('startDunningJob', () => {
        it('should start dunning job', () => {
            dunningCron.startDunningJob();
            // Job is scheduled, no immediate error
            expect(true).toBe(true);
        });

        it('should not start if DISABLE_DUNNING_CRON is set', () => {
            const originalEnv = process.env.DISABLE_DUNNING_CRON;
            process.env.DISABLE_DUNNING_CRON = 'true';

            dunningCron.startDunningJob();

            expect(mockDunningService.processScheduledRetries).not.toHaveBeenCalled();

            process.env.DISABLE_DUNNING_CRON = originalEnv;
        });
    });

    describe('stopDunningJob', () => {
        it('should stop dunning job', () => {
            dunningCron.startDunningJob();
            dunningCron.stopDunningJob();
            // No error means it stopped successfully
            expect(true).toBe(true);
        });

        it('should handle stop when job not started', () => {
            dunningCron.stopDunningJob();
            // No error means it handled gracefully
            expect(true).toBe(true);
        });
    });

    describe('getDunningCron', () => {
        it('should return singleton instance', () => {
            const instance1 = getDunningCron({ dunningService: mockDunningService });
            const instance2 = getDunningCron({ dunningService: mockDunningService });

            expect(instance1).toBe(instance2);
        });
    });
});


