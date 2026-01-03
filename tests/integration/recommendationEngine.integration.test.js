import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory';
import RecommendationEngine from '../../server/ai/recommendationEngine';

// Mock AIPipeline
const mockGenerateInitiatives = vi.fn();

vi.mock('../../server/services/ai/aiPipeline', () => ({
    aiPipeline: {
        generateInitiatives: (...args) => mockGenerateInitiatives(...args)
    }
}));

describe('RecommendationEngine Integration', () => {
    let db;

    beforeAll(async () => {
        db = await TestDatabaseFactory.create();

        // Inject DB and Mock Pipeline
        RecommendationEngine.setDependencies({
            db: db,
            aiPipeline: {
                generateInitiatives: mockGenerateInitiatives
            }
        });
    });

    afterAll(async () => {
        if (db && db.destroy) {
            await db.destroy();
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate deterministic recommendations from signals', async () => {
        const signals = [{
            type: 'USER_AT_RISK',
            entity_id: 'user-1',
            evidence: { task_load: 10 }
        }];

        const recommendations = await RecommendationEngine.generateRecommendations(signals);

        expect(recommendations).toHaveLength(2);
        expect(recommendations[0].title).toBe('Schedule Onboarding Review');
        expect(mockGenerateInitiatives).not.toHaveBeenCalled();
    });

    it('should delegate to AIPipeline for context-based generation', async () => {
        const context = {
            summary: 'High workload detected',
            data: { some: 'data' },
            userId: 'user-123'
        };

        const mockResponse = [{ title: 'AI Generated Initiative', impact: 'high' }];
        mockGenerateInitiatives.mockResolvedValue(mockResponse);

        const recommendations = await RecommendationEngine.generateRecommendations(context);

        expect(mockGenerateInitiatives).toHaveBeenCalledWith(
            expect.objectContaining({
                summary: 'High workload detected',
                details: context
            }),
            'user-123'
        );
        expect(recommendations).toEqual(mockResponse);
    });

    it('should handle AIPipeline errors gracefully', async () => {
        const context = { summary: 'Error test', data: {} };
        mockGenerateInitiatives.mockRejectedValue(new Error('AI Failure'));

        await expect(RecommendationEngine.generateRecommendations(context))
            .rejects.toThrow('AI Failure');
    });

    it('should use request coalescing (caching) for identical contexts', async () => {
        const context = { summary: 'Cache test', id: 1, data: {} };
        const mockResponse = [{ title: 'Cached Init' }];

        // Mock slow response
        mockGenerateInitiatives.mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 10));
            return mockResponse;
        });

        const p1 = RecommendationEngine.generateRecommendations(context);
        const p2 = RecommendationEngine.generateRecommendations(context);

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(r1).toBe(r2); // Same object reference due to cache
        expect(mockGenerateInitiatives).toHaveBeenCalledTimes(1);
    });
});
