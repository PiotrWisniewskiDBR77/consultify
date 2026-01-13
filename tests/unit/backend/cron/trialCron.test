/**
 * Trial Cron Job Tests
 * ETAP 6: Testy dla trial cron jobs (80%+ coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Removed createRequire

describe('TrialCron', () => {
    let TrialCron;
    let mockDemoService;
    let mockTrialService;

    beforeEach(async () => { // Async beforeEach
        vi.resetModules();

        mockDemoService = {
            cleanupExpiredDemos: vi.fn().mockResolvedValue(3)
        };

        mockTrialService = {
            sendTrialWarnings: vi.fn().mockResolvedValue(5),
            processExpiredTrials: vi.fn().mockResolvedValue(2)
        };

        vi.doMock('../../../../server/services/demoService', () => ({
            default: mockDemoService
        }));

        vi.doMock('../../../../server/src/services/trialService.ts', () => ({
            default: mockTrialService
        }));

        const module = await import('../../../../server/cron/trialCron.ts');
        TrialCron = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../../server/services/demoService');
        vi.doUnmock('../../../../server/services/trialService');
    });

    describe('runDailyTrialTasks', () => {
        it('should run all daily trial tasks successfully', async () => {
            const result = await TrialCron.runDailyTrialTasks();

            expect(mockDemoService.cleanupExpiredDemos).toHaveBeenCalled();
            expect(mockTrialService.sendTrialWarnings).toHaveBeenCalled();
            expect(mockTrialService.processExpiredTrials).toHaveBeenCalled();
            expect(result.demosCleanedUp).toBe(3);
            expect(result.warningsSent).toBe(5);
            expect(result.trialsLocked).toBe(2);
        });

        it('should handle errors and throw', async () => {
            mockDemoService.cleanupExpiredDemos.mockRejectedValue(new Error('Cleanup failed'));

            await expect(TrialCron.runDailyTrialTasks()).rejects.toThrow('Cleanup failed');
        });
    });

    describe('cleanupOldUsageCounters', () => {
        it('should cleanup old usage counters', async () => {
            const result = await TrialCron.cleanupOldUsageCounters();

            expect(result).toBeDefined();
        });
    });
});










