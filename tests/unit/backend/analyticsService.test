import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';
import AnalyticsService from '../../../server/src/services/analyticsService.js';

/**
 * Unit tests for AnalyticsService - Business Intelligence & Analytics
 * HIGH PRIORITY - Must have 85%+ coverage for enterprise reporting
 */
describe('AnalyticsService', () => {
    let mocks;

    beforeEach(() => {
        mocks = setupStandardTest();

        AnalyticsService.setDependencies({
            db: mocks.db,
            uuidv4: mocks.uuid
        });
    });

    describe('logUsage', () => {
        it('should log AI usage to the database without errors', async () => {
            const userId = 'test-user-' + Date.now();
            const action = 'chat';
            const model = 'gpt-4-test';
            const inputTokens = 100;
            const outputTokens = 50;
            const latencyMs = 200;
            const topic = 'integration-test';

            // Should not throw
            await expect(
                AnalyticsService.logUsage(userId, action, model, inputTokens, outputTokens, latencyMs, topic)
            ).resolves.not.toThrow();
        });
    });

    describe('getStats', () => {
        it('should retrieve aggregated stats from real database', async () => {
            const stats = await AnalyticsService.getStats('7d');

            expect(Array.isArray(stats)).toBe(true);
        });
    });

    describe('getTopTopics', () => {
        it('should retrieve top topics from real database', async () => {
            const topics = await AnalyticsService.getTopTopics();

            expect(Array.isArray(topics)).toBe(true);
        });
    });

    describe('saveMaturityScore', () => {
        it('should save maturity score without errors', async () => {
            const orgId = 'test-org-' + Date.now();
            const axis = 'Strategy';
            const score = 4.5;
            const industry = 'Technology';

            await expect(
                AnalyticsService.saveMaturityScore(orgId, axis, score, industry)
            ).resolves.not.toThrow();
        });
    });

    describe('getIndustryBenchmarks', () => {
        it('should retrieve industry benchmarks from real database', async () => {
            const benchmarks = await AnalyticsService.getIndustryBenchmarks();

            expect(Array.isArray(benchmarks)).toBe(true);
        });
    });
});
