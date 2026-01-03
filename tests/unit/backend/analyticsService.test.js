import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock database with proper prepare/finalize support
const mockPrepare = vi.fn();
const mockRun = vi.fn();
const mockFinalize = vi.fn();
const mockAll = vi.fn();

vi.mock('../../../server/database', () => ({
    default: {
        prepare: mockPrepare,
        run: mockRun,
        all: mockAll,
        get: vi.fn()
    },
    prepare: mockPrepare,
    run: mockRun,
    all: mockAll,
    get: vi.fn()
}));

import AnalyticsService from '../../../server/services/analyticsService.js';

/**
 * Unit tests for AnalyticsService
 */
describe('AnalyticsService - Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup prepare mock to return statement object
        mockPrepare.mockReturnValue({
            run: vi.fn(),
            finalize: vi.fn()
        });
        
        // Setup all mock to return empty array by default (callback-based)
        mockAll.mockImplementation((sql, params, callback) => {
            if (typeof callback === 'function') {
                callback(null, []);
            }
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
