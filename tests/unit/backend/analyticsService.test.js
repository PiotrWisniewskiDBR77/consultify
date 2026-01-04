import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import AnalyticsService from '../../../server/src/services/analyticsService.js';

/**
 * Unit tests for AnalyticsService
 */
describe('AnalyticsService', () => {
    let mockDb;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        mockUuid = vi.fn(() => 'test-uuid-123');

        AnalyticsService.setDependencies({
            db: mockDb,
            uuidv4: mockUuid
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
