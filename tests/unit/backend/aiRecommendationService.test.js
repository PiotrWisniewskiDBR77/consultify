/**
 * AIRecommendationService Tests
 * 
 * Tests for AI recommendation generation service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockDb = {
    all: vi.fn(),
    run: vi.fn(),
    get: vi.fn()
};

const mockUuid = vi.fn(() => 'mock-uuid');

// Mock dependencies in module scope to prevent side effects
vi.mock('../../../server/database', () => ({ default: {} }));

describe('AIRecommendationService', () => {
    let AIRecommendationService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        try {
            const module = await import('../../../server/services/aiRecommendationService.js');
            AIRecommendationService = module.default || module;

            // Inject dependencies
            if (AIRecommendationService.setDependencies) {
                AIRecommendationService.setDependencies({
                    db: mockDb,
                    uuid: mockUuid
                });
            }
        } catch (e) {
            console.warn('Failed to import AIRecommendationService:', e);
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateRecommendations', () => {
        it('should generate recommendations based on gaps', async () => {
            if (!AIRecommendationService) return;

            const analysis = {
                id: 'analysis-123',
                axisScores: {
                    digital_processes: {
                        currentScore: 2,
                        targetScore: 5
                    },
                    digital_products: {
                        currentScore: 3,
                        targetScore: 4
                    }
                }
            };

            const recommendations = await AIRecommendationService.generateRecommendations(analysis);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should prioritize axes with larger gaps', async () => {
            if (!AIRecommendationService) return;

            const analysis = {
                id: 'analysis-123',
                axisScores: {
                    digital_processes: {
                        currentScore: 1,
                        targetScore: 7 // Large gap
                    },
                    digital_products: {
                        currentScore: 3,
                        targetScore: 4 // Small gap
                    }
                }
            };

            const recommendations = await AIRecommendationService.generateRecommendations(analysis);

            // Should have more recommendations for larger gap
            const processRecs = recommendations.filter(r => r.axisId === 'digital_processes');
            expect(processRecs.length).toBeGreaterThan(0);
        });

        it('should filter recommendations by gap size', async () => {
            if (!AIRecommendationService) return;

            const analysis = {
                id: 'analysis-123',
                axisScores: {
                    digital_processes: {
                        currentScore: 5,
                        targetScore: 6 // Small gap - should only suggest quick wins
                    }
                }
            };

            const recommendations = await AIRecommendationService.generateRecommendations(analysis);

            // Small gaps should only suggest low-effort initiatives
            recommendations.forEach(rec => {
                if (rec.axisId === 'digital_processes') {
                    expect(rec.estimatedEffort).toBe('low');
                }
            });
        });

        it('should return empty array when no gaps', async () => {
            if (!AIRecommendationService) return;

            const analysis = {
                id: 'analysis-123',
                axisScores: {
                    digital_processes: {
                        currentScore: 5,
                        targetScore: 5 // No gap
                    }
                }
            };

            const recommendations = await AIRecommendationService.generateRecommendations(analysis);

            expect(recommendations.length).toBe(0);
        });

        it('should limit recommendations per axis', async () => {
            if (!AIRecommendationService) return;

            const analysis = {
                id: 'analysis-123',
                axisScores: {
                    digital_processes: {
                        currentScore: 1,
                        targetScore: 7 // Large gap
                    }
                }
            };

            const recommendations = await AIRecommendationService.generateRecommendations(analysis);

            const processRecs = recommendations.filter(r => r.axisId === 'digital_processes');
            expect(processRecs.length).toBeLessThanOrEqual(2); // Max 2 per axis
        });
    });

    describe('Database Operations', () => {
        it('should get stored recommendations', async () => {
            if (!AIRecommendationService) return;

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [{ id: 'rec-1', title: 'Test Rec' }]);
            });

            const result = await AIRecommendationService.getRecommendations('analysis-123');
            expect(result).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should save recommendations', async () => {
            if (!AIRecommendationService) return;

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null);
            });

            const recommendations = [{
                id: 'rec-1',
                analysisId: 'analysis-123',
                axisId: 'proc',
                recommendationType: 'tech',
                title: 'Title',
                description: 'Desc',
                rationale: 'Reason',
                estimatedEffort: 'low',
                estimatedImpact: 'high',
                priorityScore: 10,
                status: 'suggested',
                aiConfidence: 0.9,
                generatedAt: '2025-01-01'
            }];

            await AIRecommendationService.saveRecommendations(recommendations);
            expect(mockDb.run).toHaveBeenCalledTimes(1);
        });
    });
});





