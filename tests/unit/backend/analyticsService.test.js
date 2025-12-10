import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sqlite3 behavior to intercept database connection
const mockDbInstance = {
    prepare: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
    finalize: vi.fn(),
    serialize: vi.fn((cb) => cb && cb()),
};

const mockStmt = {
    run: vi.fn((...args) => {
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'function') lastArg(null);
    }),
    finalize: vi.fn()
};

mockDbInstance.prepare.mockReturnValue(mockStmt);

vi.mock('sqlite3', () => {
    return {
        verbose: () => ({
            Database: vi.fn((path, cb) => {
                if (cb) cb(null);
                return mockDbInstance;
            })
        })
    };
});

// Import the service after mocking
import AnalyticsService from '../../../server/services/analyticsService';

describe('AnalyticsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.prepare.mockReturnValue(mockStmt);
    });

    describe('logUsage', () => {
        it('should log AI usage to the database', async () => {
            const userId = 'user-123';
            const action = 'chat';
            const model = 'gpt-4';
            const inputTokens = 100;
            const outputTokens = 50;
            const latencyMs = 200;
            const topic = 'coding';

            await AnalyticsService.logUsage(userId, action, model, inputTokens, outputTokens, latencyMs, topic);

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_logs'));
            expect(mockStmt.run).toHaveBeenCalledWith(
                expect.any(String), // uuid
                userId,
                action,
                model,
                inputTokens,
                outputTokens,
                latencyMs,
                topic
            );
            expect(mockStmt.finalize).toHaveBeenCalled();
        });
    });

    describe('getStats', () => {
        it('should retrieve aggregated stats', async () => {
            const mockRows = [
                { total_calls: 10, avg_latency: 150, total_tokens: 1000, model: 'gpt-4' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockRows);
            });

            const stats = await AnalyticsService.getStats('7d');
            expect(stats).toEqual(mockRows);
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [], expect.any(Function));
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(AnalyticsService.getStats()).rejects.toThrow('DB Error');
        });
    });

    describe('getTopTopics', () => {
        it('should retrieve top topics', async () => {
            const mockRows = [
                { topic: 'coding', count: 5 },
                { topic: 'marketing', count: 3 }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockRows);
            });

            const topics = await AnalyticsService.getTopTopics();
            expect(topics).toEqual(mockRows);
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT topic'), [], expect.any(Function));
        });
    });

    describe('saveMaturityScore', () => {
        it('should save maturity score', async () => {
            const orgId = 'org-1';
            const axis = 'Strategy';
            const score = 4.5;
            const industry = 'Tech';

            await AnalyticsService.saveMaturityScore(orgId, axis, score, industry);

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO maturity_scores'));
            expect(mockStmt.run).toHaveBeenCalledWith(
                expect.any(String), // uuid
                orgId,
                axis,
                score,
                industry,
                expect.any(Function)
            );
        });
    });

    describe('getIndustryBenchmarks', () => {
        it('should retrieve benchmarks', async () => {
            const mockRows = [
                { axis: 'Strategy', avg_score: 4.0, sample_size: 10 }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockRows);
            });

            const benchmarks = await AnalyticsService.getIndustryBenchmarks();
            expect(benchmarks).toEqual(mockRows);
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [], expect.any(Function));
        });

        it('should filter by industry if provided', async () => {
            const mockRows = [];
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockRows);
            });

            await AnalyticsService.getIndustryBenchmarks('Tech');
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('WHERE industry = ?'), ['Tech'], expect.any(Function));
        });
    });
});
