// AI Recommendation Engine Unit Tests
// Tests the AI recommendation engine for intelligent suggestions

const { mockDb, mockAIPipeline } = vi.hoisted(() => {
    return {
        mockDb: {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        },
        mockAIPipeline: {
            generateInitiatives: vi.fn(),
            analyzeContext: vi.fn()
        }
    };
});

vi.mock('../../../server/database', () => mockDb);
vi.mock('../../../server/src/services/ai/aiPipeline', () => ({ aiPipeline: mockAIPipeline }));

const AIRecommendationEngine = require('../../../server/ai/recommendationEngine');

describe('AIRecommendationEngine', () => {
    // Engine is now a singleton object
    const engine = AIRecommendationEngine;

    beforeEach(() => {
        vi.resetAllMocks(); // Clear call history
        // Inject mocks into the singleton
        engine.setDependencies({
            db: mockDb,
            aiPipeline: mockAIPipeline
        });
        engine.clearCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateRecommendations', () => {
        it('should generate recommendations for project context', async () => {
            const context = {
                projectId: 'proj-123',
                type: 'implementation',
                currentPhase: 'planning',
                constraints: ['budget_limit', 'timeline_tight']
            };

            const mockRecommendations = [
                {
                    id: 'rec-1',
                    type: 'action',
                    title: 'Optimize resource allocation',
                    description: 'Consider reallocating 20% of budget to critical path items',
                    confidence: 0.85,
                    impact: 'high',
                    effort: 'medium'
                }
            ];

            mockAIPipeline.generateInitiatives.mockResolvedValue(mockRecommendations);

            const result = await engine.generateRecommendations(context);

            expect(result).toEqual(mockRecommendations);
            // Verify correct mapping to pipeline input
            expect(mockAIPipeline.generateInitiatives).toHaveBeenCalled();
        });

        it('should handle different recommendation types', async () => {
            const contexts = [
                { type: 'risk_management', projectId: 'proj-1' },
                { type: 'resource_planning', projectId: 'proj-2' },
                { type: 'quality_assurance', projectId: 'proj-3' }
            ];

            for (const context of contexts) {
                mockAIPipeline.generateInitiatives.mockResolvedValue([]);

                const result = await engine.generateRecommendations(context);

                expect(Array.isArray(result)).toBe(true);
                expect(mockAIPipeline.generateInitiatives).toHaveBeenCalledWith(
                    expect.objectContaining({
                        details: context
                    }),
                    null // Since we didn't pass userId in context, it defaults to null
                );
            }
        });

        it('should validate context parameters', async () => {
            const invalidContexts = [
                null,
                undefined,
                {},
                { type: 'invalid_type' } // Assuming this should fail if no projectId
            ];

            for (const context of invalidContexts) {
                await expect(engine.generateRecommendations(context)).rejects.toThrow('Invalid context');
            }
        });
    });

    describe('prioritizeRecommendations', () => {
        it('should prioritize recommendations by impact and confidence', () => {
            const recommendations = [
                { id: 'rec-1', impact: 'low', confidence: 0.9, effort: 'low' },
                { id: 'rec-2', impact: 'high', confidence: 0.7, effort: 'high' },
                { id: 'rec-3', impact: 'medium', confidence: 0.8, effort: 'medium' }
            ];

            const prioritized = engine.prioritizeRecommendations(recommendations);

            // High impact should come first despite lower confidence
            expect(prioritized[0].id).toBe('rec-2');
            expect(prioritized[1].id).toBe('rec-3');
            expect(prioritized[2].id).toBe('rec-1');
        });

        it('should consider effort in prioritization', () => {
            const recommendations = [
                { id: 'rec-1', impact: 'high', confidence: 0.8, effort: 'high' },
                { id: 'rec-2', impact: 'high', confidence: 0.8, effort: 'low' }
            ];

            const prioritized = engine.prioritizeRecommendations(recommendations);

            // Lower effort should be prioritized for same impact/confidence
            expect(prioritized[0].id).toBe('rec-2');
            expect(prioritized[1].id).toBe('rec-1');
        });
    });

    describe('filterRecommendations', () => {
        it('should filter recommendations by criteria', () => {
            const recommendations = [
                { id: 'rec-1', type: 'action', impact: 'high', tags: ['urgent', 'planning'] },
                { id: 'rec-2', type: 'alert', impact: 'medium', tags: ['monitoring'] },
                { id: 'rec-3', type: 'action', impact: 'low', tags: ['planning'] }
            ];

            const filters = {
                type: 'action',
                impact: 'high',
                tags: ['planning']
            };

            const filtered = engine.filterRecommendations(recommendations, filters);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe('rec-1');
        });

        it('should handle multiple filter criteria', () => {
            const recommendations = [
                { id: 'rec-1', type: 'action', impact: 'high', confidence: 0.9 },
                { id: 'rec-2', type: 'action', impact: 'medium', confidence: 0.7 },
                { id: 'rec-3', type: 'alert', impact: 'high', confidence: 0.8 }
            ];

            const filters = {
                type: 'action',
                minConfidence: 0.8
            };

            const filtered = engine.filterRecommendations(recommendations, filters);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe('rec-1');
        });
    });

    describe('storeRecommendations', () => {
        it('should store recommendations in database', async () => {
            const recommendations = [
                {
                    id: 'rec-1',
                    type: 'action',
                    title: 'Test recommendation',
                    context: { projectId: 'proj-123' }
                }
            ];

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.storeRecommendations(recommendations, 'user-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle bulk storage efficiently', async () => {
            const recommendations = Array(100).fill().map((_, i) => ({
                id: `rec-${i}`,
                type: 'action',
                title: `Recommendation ${i}`,
                context: { projectId: 'proj-123' }
            }));

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.storeRecommendations(recommendations, 'user-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledTimes(100);
        });
    });

    describe('getRecommendationHistory', () => {
        it('should retrieve recommendation history', async () => {
            const mockHistory = [
                { id: 1, recommendationId: 'rec-1', action: 'viewed', timestamp: '2024-01-01' },
                { id: 2, recommendationId: 'rec-1', action: 'implemented', timestamp: '2024-01-02' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockHistory);
            });

            const result = await engine.getRecommendationHistory('rec-1');

            expect(result).toEqual(mockHistory);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter by date range', async () => {
            const mockHistory = [
                { id: 1, timestamp: '2024-01-15', action: 'viewed' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockHistory);
            });

            const result = await engine.getRecommendationHistory('rec-1', {
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            });

            expect(result).toEqual(mockHistory);
        });
    });

    describe('trackRecommendationUsage', () => {
        it('should track recommendation interactions', async () => {
            const interaction = {
                recommendationId: 'rec-1',
                action: 'implemented',
                userId: 'user-123',
                context: { projectId: 'proj-123' }
            };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.trackRecommendationUsage(interaction);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should track different interaction types', async () => {
            const interactions = [
                { recommendationId: 'rec-1', action: 'viewed' },
                { recommendationId: 'rec-1', action: 'dismissed' },
                { recommendationId: 'rec-1', action: 'implemented' },
                { recommendationId: 'rec-1', action: 'modified' }
            ];

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            for (const interaction of interactions) {
                const result = await engine.trackRecommendationUsage(interaction);
                expect(result).toBe(true);
            }

            expect(mockDb.run).toHaveBeenCalledTimes(4);
        });
    });

    describe('calculateRecommendationROI', () => {
        it('should calculate ROI for implemented recommendations', () => {
            const recommendation = {
                effort: 'medium', // Assume 2 weeks effort
                impact: 'high',   // Assume $100k benefit
                implemented: true
            };

            const roi = engine.calculateRecommendationROI(recommendation);

            expect(roi).toBeDefined();
            expect(typeof roi).toBe('number');
            expect(roi).toBeGreaterThan(0);
        });

        it('should handle different effort and impact levels', () => {
            const scenarios = [
                { effort: 'low', impact: 'low', expected: 2.0 },
                { effort: 'medium', impact: 'medium', expected: 1.5 },
                { effort: 'high', impact: 'high', expected: 1.0 }
            ];

            for (const scenario of scenarios) {
                const recommendation = {
                    effort: scenario.effort,
                    impact: scenario.impact,
                    implemented: true
                };

                const roi = engine.calculateRecommendationROI(recommendation);
                expect(roi).toBeCloseTo(scenario.expected, 1);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle AI service failures gracefully', async () => {
            mockAIPipeline.generateInitiatives.mockRejectedValue(new Error('AI service unavailable'));

            const context = { projectId: 'proj-123', type: 'planning' };

            await expect(engine.generateRecommendations(context)).rejects.toThrow('AI service unavailable');
        });

        it('should validate recommendation data', () => {
            const invalidRecommendations = [
                null,
                undefined,
                {},
                { type: 'invalid' },
                { title: '', type: 'action' }
            ];

            for (const rec of invalidRecommendations) {
                expect(() => engine.validateRecommendation(rec)).toThrow();
            }
        });

        it('should handle database errors', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, new Error('Database error'));
            });

            const recommendations = [{ id: 'rec-1', type: 'action' }];

            await expect(engine.storeRecommendations(recommendations, 'user-123')).rejects.toThrow('Database error');
        });
    });

    describe('Performance', () => {
        it('should cache recommendation results', async () => {
            const context = { projectId: 'proj-123', type: 'planning' };
            const mockResult = [{ id: 'rec-1', type: 'action' }];

            mockAIPipeline.generateInitiatives
                .mockResolvedValueOnce(mockResult)
                .mockResolvedValueOnce([]); // Should not be called

            // First call
            await engine.generateRecommendations(context);

            // Second call with same context - should use cache
            const result = await engine.generateRecommendations(context);

            expect(result).toEqual(mockResult);
            expect(mockAIPipeline.generateInitiatives).toHaveBeenCalledTimes(1);
        });

        it('should handle concurrent requests efficiently', async () => {
            const context = { projectId: 'proj-123', type: 'planning' };
            const mockResult = [{ id: 'rec-1', type: 'action' }];

            mockAIPipeline.generateInitiatives.mockResolvedValue(mockResult);

            // Simulate concurrent requests
            const promises = Array(10).fill().map(() =>
                engine.generateRecommendations(context)
            );

            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result).toEqual(mockResult);
            });

            // AI service should only be called once due to caching
            expect(mockAIPipeline.generateInitiatives).toHaveBeenCalledTimes(1);
        });
    });
});












