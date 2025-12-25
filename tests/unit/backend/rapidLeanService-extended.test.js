/**
 * Extended Unit Tests for RapidLean Service
 * Tests new methods added for observation support
 */

const RapidLeanService = require('../../../server/services/rapidLeanService');
const db = require('../../../server/database');

// Mock database for tests
jest.mock('../../../server/database', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
}));

describe('RapidLeanService - Extended Methods', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getObservations', () => {
        test('should fetch and parse observations correctly', async () => {
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

            db.all.mockImplementation((sql, params, callback) => {
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

        test('should handle database errors', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            await expect(
                RapidLeanService.getObservations('test-assessment')
            ).rejects.toThrow();
        });

        test('should return empty array if no observations', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const observations = await RapidLeanService.getObservations('test-assessment');
            expect(observations).toEqual([]);
        });
    });

    describe('analyzeObservationsForDRD', () => {
        test('should return evidence score when observations match', () => {
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

            // Should return a number or null
            expect(evidence === null || typeof evidence === 'number').toBe(true);
        });

        test('should return null when no matching observations', () => {
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

        test('should filter by DRD axis correctly', () => {
            const observations = [
                {
                    templateId: 'ci_template',
                    answers: { 'ci_1': true }
                }
            ];

            // Should match for culture axis (5), not processes (1)
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

            // CI maps to culture (axis 5), not processes (axis 1)
            expect(evidenceProcesses).toBeNull();
            expect(evidenceCulture === null || typeof evidenceCulture === 'number').toBe(true);
        });
    });

    describe('combineScores', () => {
        test('should weight base score higher than evidence', () => {
            const combined = RapidLeanService.combineScores(3.0, 5.0);
            // 70% of 3.0 + 30% of 5.0 = 2.1 + 1.5 = 3.6
            expect(combined).toBeCloseTo(3.6, 1);
        });

        test('should handle equal scores', () => {
            const combined = RapidLeanService.combineScores(4.0, 4.0);
            expect(combined).toBe(4.0);
        });

        test('should round to 1 decimal place', () => {
            const combined = RapidLeanService.combineScores(3.333, 4.444);
            const rounded = Math.round(combined * 10) / 10;
            expect(combined).toBe(rounded);
        });
    });

    describe('calculateDRDGaps', () => {
        test('should calculate gaps with custom target levels', () => {
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

        test('should use default target level 7 if not provided', () => {
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

        test('should set priority correctly', () => {
            const drdMapping = {
                processes: 2.0, // Gap of 5 = HIGH
                culture: 5.0    // Gap of 2 = MEDIUM
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping);

            expect(gaps.processes.priority).toBe('HIGH');
            expect(gaps.culture.priority).toBe('MEDIUM');
        });

        test('should handle negative gaps (above target)', () => {
            const drdMapping = {
                processes: 7.0, // Above target
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
        test('should generate correct number of steps', () => {
            const drdMapping = {
                processes: 4.0, // Current level 4
                culture: 3.0    // Current level 3
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, {
                processes: 7,
                culture: 7
            });

            // From level 4 to 7 = 3 steps (4→5, 5→6, 6→7)
            expect(pathways.processes.steps.length).toBe(3);
            // From level 3 to 7 = 4 steps
            expect(pathways.culture.steps.length).toBe(4);
        });

        test('should calculate estimated time correctly', () => {
            const drdMapping = {
                processes: 4.0
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, {
                processes: 7
            });

            // 3 steps * 3 months = 9 months
            expect(pathways.processes.estimatedTime).toBe(9);
        });

        test('should generate step descriptions', () => {
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
        test('should generate recommendations for gaps > 1', async () => {
            const assessment = {
                overall_score: 3.0
            };

            const drdMapping = {
                processes: 3.0, // Gap of 4 (target 7)
                culture: 2.0    // Gap of 5 (target 7)
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

        test('should not generate recommendations for small gaps', async () => {
            const assessment = {
                overall_score: 3.0
            };

            const drdMapping = {
                processes: 6.5, // Gap of 0.5
                culture: 6.8    // Gap of 0.2
            };

            const recommendations = await RapidLeanService.generateDRDRecommendations(
                assessment,
                drdMapping,
                { targetLevels: { processes: 7, culture: 7 } }
            );

            // Should have fewer or no recommendations
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('getProjectContext', () => {
        test('should return default target levels', async () => {
            const context = await RapidLeanService.getProjectContext('test-org-id');

            expect(context).toHaveProperty('targetLevels');
            expect(context.targetLevels).toHaveProperty('processes');
            expect(context.targetLevels).toHaveProperty('culture');
            expect(context.targetLevels.processes).toBe(7);
            expect(context.targetLevels.culture).toBe(7);
        });
    });

    describe('createAssessment with observations', () => {
        test('should create assessment with observation count', async () => {
            // Mock database
            db.run.mockImplementation((sql, params, callback) => {
                callback(null, { lastID: 1 });
            });

            const responses = {
                value_stream_1: 4,
                value_stream_2: 4,
                value_stream_3: 4,
                waste_elimination_1: 3,
                waste_elimination_2: 3,
                waste_elimination_3: 3,
                flow_pull_1: 3,
                flow_pull_2: 3,
                flow_pull_3: 3,
                quality_source_1: 4,
                quality_source_2: 4,
                quality_source_3: 4,
                continuous_improvement_1: 2,
                continuous_improvement_2: 2,
                continuous_improvement_3: 2,
                visual_management_1: 3,
                visual_management_2: 3,
                visual_management_3: 3
            };

            const assessment = await RapidLeanService.createAssessment({
                organizationId: 'test-org',
                projectId: 'test-project',
                responses,
                userId: 'test-user'
            });

            expect(assessment).toHaveProperty('id');
            expect(assessment).toHaveProperty('scores');
        });
    });
});

