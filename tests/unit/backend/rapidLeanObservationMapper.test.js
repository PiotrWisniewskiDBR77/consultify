/**
 * Unit Tests for RapidLean Observation Mapper
 * Tests mapping of production floor observations to RapidLean questionnaire responses
 */

const RapidLeanObservationMapper = require('../../../server/services/rapidLeanObservationMapper');

describe('RapidLeanObservationMapper', () => {
    describe('mapObservationsToResponses', () => {
        test('should map value stream observations to RapidLean responses', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: {
                        'vs_1': true,
                        'vs_2': true,
                        'vs_4': true
                    }
                }
            ];

            const responses = RapidLeanObservationMapper.mapObservationsToResponses(observations);

            expect(responses.value_stream_1).toBeDefined();
            expect(responses.value_stream_2).toBeDefined();
            expect(responses.value_stream_3).toBeDefined();
        });

        test('should map waste elimination observations correctly', () => {
            const observations = [
                {
                    templateId: 'waste_template',
                    answers: {
                        'waste_1': false, // No transportation waste = good
                        'waste_2': false, // No inventory waste = good
                        'waste_7': false  // No defects = good
                    }
                }
            ];

            const responses = RapidLeanObservationMapper.mapObservationsToResponses(observations);

            expect(responses.waste_elimination_1).toBeGreaterThanOrEqual(2);
            expect(responses.waste_elimination_3).toBeGreaterThanOrEqual(2);
        });

        test('should handle multiple observations for same dimension', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: { 'vs_1': true, 'vs_2': true }
                },
                {
                    templateId: 'value_stream_template',
                    answers: { 'vs_1': false, 'vs_2': false }
                }
            ];

            const responses = RapidLeanObservationMapper.mapObservationsToResponses(observations);

            // Should average multiple observations
            expect(responses.value_stream_1).toBeDefined();
            expect(responses.value_stream_2).toBeDefined();
        });

        test('should ensure all 18 questions have scores', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: { 'vs_1': true }
                }
            ];

            const responses = RapidLeanObservationMapper.mapObservationsToResponses(observations);

            const allQuestionIds = RapidLeanObservationMapper.getAllQuestionIds();
            allQuestionIds.forEach(qId => {
                expect(responses[qId]).toBeDefined();
                expect(typeof responses[qId]).toBe('number');
                expect(responses[qId]).toBeGreaterThanOrEqual(1);
                expect(responses[qId]).toBeLessThanOrEqual(5);
            });
        });
    });

    describe('getDimensionFromTemplate', () => {
        test('should correctly identify dimension from template ID', () => {
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('value_stream_template')).toBe('value_stream');
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('waste_template')).toBe('waste_elimination');
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('flow_pull_template')).toBe('flow_pull');
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('quality_template')).toBe('quality_source');
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('ci_template')).toBe('continuous_improvement');
            expect(RapidLeanObservationMapper.getDimensionFromTemplate('visual_template')).toBe('visual_management');
        });
    });

    describe('mapToQuestionId', () => {
        test('should map observation items to RapidLean question IDs', () => {
            expect(RapidLeanObservationMapper.mapToQuestionId('value_stream', 'vs_1')).toBe('value_stream_1');
            expect(RapidLeanObservationMapper.mapToQuestionId('waste_elimination', 'waste_1')).toBe('waste_elimination_1');
            expect(RapidLeanObservationMapper.mapToQuestionId('flow_pull', 'flow_1')).toBe('flow_pull_1');
            expect(RapidLeanObservationMapper.mapToQuestionId('quality_source', 'qual_1')).toBe('quality_source_1');
            expect(RapidLeanObservationMapper.mapToQuestionId('continuous_improvement', 'ci_1')).toBe('continuous_improvement_1');
            expect(RapidLeanObservationMapper.mapToQuestionId('visual_management', 'vis_1')).toBe('visual_management_1');
        });

        test('should return null for unknown mappings', () => {
            expect(RapidLeanObservationMapper.mapToQuestionId('unknown_dimension', 'unknown_item')).toBeNull();
        });
    });

    describe('extractKeyFindings', () => {
        test('should extract key findings from observation', () => {
            const observation = {
                answers: {
                    'vs_1': true,
                    'vs_2': false,
                    'vs_4': true
                }
            };

            const findings = RapidLeanObservationMapper.extractKeyFindings(observation);

            expect(findings).toBeInstanceOf(Array);
            expect(findings.length).toBeGreaterThan(0);
        });
    });

    describe('generateObservationReport', () => {
        test('should generate comprehensive report structure', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    location: 'Production Line A',
                    timestamp: '2024-01-15T10:00:00Z',
                    answers: { 'vs_1': true },
                    photos: ['photo1.jpg'],
                    notes: 'Test observation'
                }
            ];

            const assessment = {
                overall_score: 3.5,
                value_stream_score: 3.7,
                waste_elimination_score: 3.0,
                flow_pull_score: 3.5,
                quality_source_score: 4.0,
                continuous_improvement_score: 2.5,
                visual_management_score: 3.8,
                ai_recommendations: []
            };

            const report = RapidLeanObservationMapper.generateObservationReport(observations, assessment);

            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('observations');
            expect(report).toHaveProperty('assessment');
            expect(report).toHaveProperty('insights');
            expect(report.summary.totalObservations).toBe(1);
            expect(report.observations.length).toBe(1);
        });
    });

    describe('generateInsights', () => {
        test('should identify strengths and weaknesses', () => {
            const observations = [
                {
                    templateId: 'value_stream_template',
                    answers: {
                        'vs_1': true,
                        'vs_2': true,
                        'vs_4': true
                    }
                },
                {
                    templateId: 'waste_template',
                    answers: {
                        'waste_1': true,
                        'waste_2': true,
                        'waste_7': true
                    }
                }
            ];

            const assessment = {
                overall_score: 3.0,
                value_stream_score: 4.0,
                waste_elimination_score: 2.0
            };

            const insights = RapidLeanObservationMapper.generateInsights(observations, assessment);

            expect(insights).toHaveProperty('strengths');
            expect(insights).toHaveProperty('weaknesses');
            expect(insights).toHaveProperty('opportunities');
        });
    });
});

