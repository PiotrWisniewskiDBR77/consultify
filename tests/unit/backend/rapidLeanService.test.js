/**
 * Unit Tests for RapidLean Service
 * Testing weighted scoring algorithm and benchmark comparison
 */

const RapidLeanService = require('../../server/services/rapidLeanService');

describe('RapidLeanService', () => {
    describe('calculateScores', () => {
        test('should calculate weighted average correctly', () => {
            const responses = {
                value_stream_1: 5,
                value_stream_2: 4,
                value_stream_3: 5,
                waste_elimination_1: 3,
                waste_elimination_2: 3,
                waste_elimination_3: 4,
                flow_pull_1: 3,
                flow_pull_2: 3,
                flow_pull_3: 3,
                quality_source_1: 4,
                quality_source_2: 4,
                quality_source_3: 4,
                continuous_improvement_1: 2,
                continuous_improvement_2: 3,
                continuous_improvement_3: 2,
                visual_management_1: 3,
                visual_management_2: 3,
                visual_management_3: 4
            };

            const scores = RapidLeanService.calculateScores(responses);

            expect(scores.value_stream_score).toBeCloseTo(4.67, 1);
            expect(scores.waste_elimination_score).toBeCloseTo(3.33, 1);
            expect(scores.overall_score).toBeGreaterThan(0);
            expect(scores.overall_score).toBeLessThanOrEqual(5);
        });

        test('should handle all 1s (minimum scores)', () => {
            const responses = {};
            for (let i = 1; i <= 18; i++) {
                responses[`question_${i}`] = 1;
            }

            const scores = RapidLeanService.calculateScores(responses);
            expect(scores.overall_score).toBe(1);
        });

        test('should handle all 5s (maximum scores)', () => {
            const responses = {
                value_stream_1: 5, value_stream_2: 5, value_stream_3: 5,
                waste_elimination_1: 5, waste_elimination_2: 5, waste_elimination_3: 5,
                flow_pull_1: 5, flow_pull_2: 5, flow_pull_3: 5,
                quality_source_1: 5, quality_source_2: 5, quality_source_3: 5,
                continuous_improvement_1: 5, continuous_improvement_2: 5, continuous_improvement_3: 5,
                visual_management_1: 5, visual_management_2: 5, visual_management_3: 5
            };

            const scores = RapidLeanService.calculateScores(responses);
            expect(scores.overall_score).toBe(5);
        });
    });

    describe('identifyTopGaps', () => {
        test('should identify lowest scoring dimensions', () => {
            const scores = {
                value_stream_score: 4.5,
                waste_elimination_score: 2.0,
                flow_pull_score: 3.5,
                quality_source_score: 4.0,
                continuous_improvement_score: 1.5,
                visual_management_score: 3.0
            };

            const gaps = RapidLeanService.identifyTopGaps(scores, 3.5);

            expect(gaps).toContain('continuous_improvement');
            expect(gaps).toContain('waste_elimination');
            expect(gaps.length).toBeLessThanOrEqual(3);
        });
    });

    describe('mapToDRD', () => {
        test('should map Lean dimensions to DRD axes', async () => {
            const leanAssessment = {
                value_stream_score: 3.5,
                waste_elimination_score: 3.0,
                flow_pull_score: 4.0,
                quality_source_score: 3.5,
                continuous_improvement_score: 3.0,
                visual_management_score: 3.5
            };

            const drdMapping = await RapidLeanService.mapToDRD(leanAssessment);

            expect(drdMapping).toHaveProperty('processes');
            expect(drdMapping).toHaveProperty('culture');
            expect(drdMapping.processes).toBeGreaterThan(0);
        });

        test('should enhance mapping with observations', async () => {
            const leanAssessment = {
                value_stream_score: 3.5,
                waste_elimination_score: 3.0,
                flow_pull_score: 4.0,
                quality_source_score: 3.5,
                continuous_improvement_score: 3.0,
                visual_management_score: 3.5
            };

            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: { 'vs_1': true, 'vs_2': true }
                }
            ];

            const drdMapping = await RapidLeanService.mapToDRD(leanAssessment, observations);

            expect(drdMapping).toHaveProperty('processes');
            expect(drdMapping.processes).toBeGreaterThan(0);
        });
    });

    describe('convertScaleToDRD', () => {
        test('should convert 1-5 scale to 1-7 scale correctly', () => {
            expect(RapidLeanService.convertScaleToDRD(1)).toBe(1);
            expect(RapidLeanService.convertScaleToDRD(3)).toBeCloseTo(4, 0.5);
            expect(RapidLeanService.convertScaleToDRD(5)).toBe(7);
        });
    });

    describe('calculateDRDGaps', () => {
        test('should calculate gaps correctly', () => {
            const drdMapping = {
                processes: 4.0,
                culture: 3.0
            };

            const gaps = RapidLeanService.calculateDRDGaps(drdMapping, { processes: 7, culture: 7 });

            expect(gaps.processes.gap).toBe(3);
            expect(gaps.culture.gap).toBe(4);
            expect(gaps.processes.priority).toBe('HIGH');
        });
    });

    describe('generatePathways', () => {
        test('should generate pathways to target levels', () => {
            const drdMapping = {
                processes: 4.0,
                culture: 3.0
            };

            const pathways = RapidLeanService.generatePathways(drdMapping, { processes: 7, culture: 7 });

            expect(pathways.processes.steps.length).toBeGreaterThan(0);
            expect(pathways.culture.steps.length).toBeGreaterThan(0);
            expect(pathways.processes.estimatedTime).toBeGreaterThan(0);
        });
    });
});
