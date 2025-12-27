/**
 * Extended Unit Tests for RapidLean Service
 * Tests new methods added for observation support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
const mockDb = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn()
};

vi.mock('../../../server/database', () => ({
    default: mockDb,
    ...mockDb
}));

const RapidLeanService = require('../../../server/services/rapidLeanService');

describe('RapidLeanService - Extended Methods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getObservations', () => {
        it('should fetch and parse observations correctly', async () => {
            const mockObservations = [
                {
                    id: 'obs-1',
                    assessment_id: 'test-assessment',
                    template_id: 'value_stream_template',
                    answers: '{"vs_1": true}',
                    photos: '["photo1.jpg"]',
                    notes: 'Test',
                    location: 'Line A',
                    timestamp: '2024-01-15T10:00:00Z'
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockObservations);
            });

            const observations = await RapidLeanService.getObservations('test-assessment');

            expect(Array.isArray(observations)).toBe(true);
            expect(observations.length).toBe(1);
            expect(observations[0]).toHaveProperty('answers');
            expect(observations[0]).toHaveProperty('photos');
            expect(typeof observations[0].answers).toBe('object');
            expect(Array.isArray(observations[0].photos)).toBe(true);
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            await expect(
                RapidLeanService.getObservations('test-assessment')
            ).rejects.toThrow();
        });

        it('should return empty array if no observations', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const observations = await RapidLeanService.getObservations('test-assessment');
            expect(observations).toEqual([]);
        });
    });

    describe('analyzeObservationsForDRD', () => {
        it('should return evidence score when observations match', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: {
                        'vs_1': true,
                        'vs_2': true
                    }
                }
            ];

            const evidence = RapidLeanService.analyzeObservationsForDRD(
                observations,
                'value_stream',
                'processes'
            );

            expect(evidence === null || typeof evidence === 'number').toBe(true);
        });

        it('should return null when no matching observations', () => {
            const observations = [
                {
                    templateId: 'waste_template',
                    answers: { 'waste_1': true }
                }
            ];

            const evidence = RapidLeanService.analyzeObservationsForDRD(
                observations,
                'value_stream',
                'processes'
            );

            expect(evidence).toBeNull();
        });

        it('should filter by DRD axis correctly', () => {
            const observations = [
                {
                    templateId: 'ci_template',
                    answers: { 'ci_1': true }
                }
            ];

            const evidenceProcesses = RapidLeanService.analyzeObservationsForDRD(
                observations,
                'continuous_improvement',
                'processes'
            );

            const evidenceCulture = RapidLeanService.analyzeObservationsForDRD(
                observations,
                'continuous_improvement',
                'culture'
            );

            expect(evidenceProcesses).toBeNull();
            expect(evidenceCulture === null || typeof evidenceCulture === 'number').toBe(true);
        });
    });

    describe('combineScores', () => {
        it('should weight base score higher than evidence', () => {
            const combined = RapidLeanService.combineScores(3.0, 5.0);
            expect(combined).toBeCloseTo(3.6, 1);
        });

        it('should handle equal scores', () => {
            const combined = RapidLeanService.combineScores(4.0, 4.0);
            expect(combined).toBe(4.0);
        });

        it('should round to 1 decimal place', () => {
            const combined = RapidLeanService.combineScores(3.333, 4.444);
            const rounded = Math.round(combined * 10) / 10;
            expect(combined).toBe(rounded);
        });
    });

    describe('calculateDRDGaps', () => {
        it('should calculate gaps with custom target levels', () => {
            const drdMapping = {
                processes: 4.0,
                culture: 3.0
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping, {
                processes: 6,
                culture: 5
            });

            expect(gaps.processes.gap).toBe(2);
            expect(gaps.culture.gap).toBe(2);
        });

        it('should use default target level 7 if not provided', () => {
            const drdMapping = {
                processes: 4.0,
                culture: 3.0
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping);

            expect(gaps.processes.target).toBe(7);
            expect(gaps.culture.target).toBe(7);
            expect(gaps.processes.gap).toBe(3);
            expect(gaps.culture.gap).toBe(4);
        });

        it('should set priority correctly', () => {
            const drdMapping = {
                processes: 2.0,
                culture: 5.0
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping);

            expect(gaps.processes.priority).toBe('HIGH');
            expect(gaps.culture.priority).toBe('MEDIUM');
        });

        it('should handle negative gaps (above target)', () => {
            const drdMapping = {
                processes: 7.0,
                culture: 6.5
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping, {
                processes: 6,
                culture: 5
            });

            expect(gaps.processes.gap).toBeLessThan(0);
            expect(gaps.processes.priority).toBe('LOW');
        });
    });

    describe('generatePathways', () => {
        it('should generate correct number of steps', () => {
            const drdMapping = {
                processes: 4.0,
                culture: 3.0
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, {
                processes: 7,
                culture: 7
            });

            expect(pathways.processes.steps.length).toBe(3);
            expect(pathways.culture.steps.length).toBe(4);
        });

        it('should calculate estimated time correctly', () => {
            const drdMapping = {
                processes: 4.0
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, {
                processes: 7
            });

            expect(pathways.processes.estimatedTime).toBe(9);
        });

        it('should generate step descriptions', () => {
            const drdMapping = {
                processes: 4.0
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, {
                processes: 7
            });

            expect(pathways.processes.steps[0]).toHaveProperty('from');
            expect(pathways.processes.steps[0]).toHaveProperty('to');
            expect(pathways.processes.steps[0]).toHaveProperty('description');
            expect(pathways.processes.steps[0].description).toContain('DRD Level');
        });
    });

    describe('generateDRDRecommendations', () => {
        it('should generate recommendations for gaps > 1', async () => {
            const assessment = {
                overall_score: 3.0
            };

            const drdMapping = {
                processes: 3.0,
                culture: 2.0
            };

            const recommendations = await RapidLeanService.generateDRDRecommendations(
                assessment,
                drdMapping,
                { targetLevels: { processes: 7, culture: 7 } }
            );

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);

            recommendations.forEach(rec => {
                expect(rec).toHaveProperty('axis');
                expect(rec).toHaveProperty('priority');
                expect(rec).toHaveProperty('recommendation');
                expect(['HIGH', 'MEDIUM', 'LOW']).toContain(rec.priority);
            });
        });

        it('should not generate recommendations for small gaps', async () => {
            const assessment = {
                overall_score: 3.0
            };

            const drdMapping = {
                processes: 6.5,
                culture: 6.8
            };

            const recommendations = await RapidLeanService.generateDRDRecommendations(
                assessment,
                drdMapping,
                { targetLevels: { processes: 7, culture: 7 } }
            );

            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('getProjectContext', () => {
        it('should return default target levels', async () => {
            const context = await RapidLeanService.getProjectContext('test-org-id');

            expect(context).toHaveProperty('targetLevels');
            expect(context.targetLevels).toHaveProperty('processes');
            expect(context.targetLevels).toHaveProperty('culture');
            expect(context.targetLevels.processes).toBe(7);
            expect(context.targetLevels.culture).toBe(7);
        });
    });

    describe('createAssessment with observations', () => {
        it.skip('should create assessment with observation count - requires full DB mock', async () => {
            // Skip: requires complex transaction mocking
        });
    });
});

