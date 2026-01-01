/**
 * AIRecommendationService Tests
 * 
 * Tests for AI recommendation generation service.
 */

const { initTestDb, cleanTables } = require('../../helpers/dbHelper.cjs');
const AIRecommendationService = require('../../../server/services/aiRecommendationService');

describe('AIRecommendationService', () => {
    beforeAll(async () => {
        await initTestDb();
    });

    afterEach(async () => {
        await cleanTables([]);
    });

    describe('generateRecommendations', () => {
        it('should generate recommendations based on gaps', async () => {
            const analysis = {
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
            const analysis = {
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
            const analysis = {
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
            const analysis = {
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
            const analysis = {
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
});

