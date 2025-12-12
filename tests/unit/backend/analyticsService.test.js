import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for AnalyticsService
 * Uses real database - production-ready tests
 */
describe('AnalyticsService - Integration', () => {
    let AnalyticsService;

    beforeAll(async () => {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);

        // Ensure DB is initialized
        const db = require('../../../server/database.js');
        await db.initPromise;

        // Clear any mock flags
        delete process.env.MOCK_DB;

        // Import the real service (no mocks)
        const mod = await import('../../../server/services/analyticsService.js');
        AnalyticsService = mod.default;
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
