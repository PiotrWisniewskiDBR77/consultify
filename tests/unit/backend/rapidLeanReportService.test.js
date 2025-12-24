/**
 * Unit Tests for RapidLean Report Service
 * Tests report generation and data preparation
 */

const RapidLeanReportService = require('../../../server/services/rapidLeanReportService');
const RapidLeanService = require('../../../server/services/rapidLeanService');

// Mock dependencies
jest.mock('../../../server/services/rapidLeanService');
jest.mock('../../../server/services/rapidLeanObservationMapper');
jest.mock('../../../server/database');

describe('RapidLeanReportService', () => {
    describe('getStatus', () => {
        test('should return excellent for score above benchmark', () => {
            expect(RapidLeanReportService.getStatus(4.0, 3.5)).toBe('excellent');
        });

        test('should return good for score close to benchmark', () => {
            expect(RapidLeanReportService.getStatus(3.5, 3.5)).toBe('good');
            expect(RapidLeanReportService.getStatus(3.0, 3.5)).toBe('good');
        });

        test('should return needs_improvement for moderate gap', () => {
            expect(RapidLeanReportService.getStatus(2.5, 3.5)).toBe('needs_improvement');
        });

        test('should return critical for large gap', () => {
            expect(RapidLeanReportService.getStatus(1.5, 3.5)).toBe('critical');
        });
    });

    describe('calculateTrends', () => {
        test('should calculate trends from previous assessments', () => {
            const current = {
                overall_score: 3.5,
                value_stream_score: 3.7,
                waste_elimination_score: 3.0,
                flow_pull_score: 3.5,
                quality_source_score: 4.0,
                continuous_improvement_score: 2.5,
                visual_management_score: 3.8,
                created_at: '2024-01-15T10:00:00Z'
            };

            const previous = [
                {
                    overall_score: 3.0,
                    value_stream_score: 3.0,
                    waste_elimination_score: 2.5,
                    flow_pull_score: 3.0,
                    quality_source_score: 3.5,
                    continuous_improvement_score: 2.0,
                    visual_management_score: 3.5,
                    created_at: '2024-01-01T10:00:00Z'
                }
            ];

            const trends = RapidLeanReportService.calculateTrends(current, previous);

            expect(trends).toHaveProperty('overallTrend');
            expect(trends).toHaveProperty('dimensionTrends');
            expect(trends.overallTrend).toBe(0.5);
            expect(trends.dimensionTrends.value_stream).toBe(0.7);
        });

        test('should return null if no previous assessments', () => {
            const current = { overall_score: 3.5 };
            const trends = RapidLeanReportService.calculateTrends(current, []);
            expect(trends).toBeNull();
        });
    });

    describe('calculateImprovementRate', () => {
        test('should calculate improvement rate per month', () => {
            const current = {
                overall_score: 3.5,
                created_at: '2024-02-15T10:00:00Z'
            };

            const previous = [
                {
                    overall_score: 3.0,
                    created_at: '2024-01-15T10:00:00Z'
                }
            ];

            const rate = RapidLeanReportService.calculateImprovementRate(current, previous);
            expect(rate).toBeGreaterThan(0);
        });

        test('should return 0 if no time difference', () => {
            const current = {
                overall_score: 3.5,
                created_at: '2024-01-15T10:00:00Z'
            };

            const previous = [
                {
                    overall_score: 3.0,
                    created_at: '2024-01-15T10:00:00Z'
                }
            ];

            const rate = RapidLeanReportService.calculateImprovementRate(current, previous);
            expect(rate).toBe(0);
        });
    });

    describe('prepareChartsData', () => {
        test('should prepare radar chart data', () => {
            const assessment = {
                value_stream_score: 3.7,
                waste_elimination_score: 3.0,
                flow_pull_score: 3.5,
                quality_source_score: 4.0,
                continuous_improvement_score: 2.5,
                visual_management_score: 3.8,
                industry_benchmark: 3.5
            };

            const charts = RapidLeanReportService.prepareChartsData(assessment, []);

            expect(charts).toHaveProperty('radarChart');
            expect(charts.radarChart.dimensions).toHaveLength(6);
            expect(charts.radarChart.currentScores).toHaveLength(6);
            expect(charts.radarChart.benchmark).toHaveLength(6);
        });

        test('should prepare trend chart data when previous assessments exist', () => {
            const assessment = {
                overall_score: 3.5,
                created_at: '2024-02-15T10:00:00Z'
            };

            const previous = [
                {
                    overall_score: 3.0,
                    created_at: '2024-01-15T10:00:00Z'
                }
            ];

            const charts = RapidLeanReportService.prepareChartsData(assessment, previous);

            expect(charts).toHaveProperty('trendChart');
            expect(charts.trendChart.dates).toHaveLength(2);
            expect(charts.trendChart.scores).toHaveLength(2);
        });
    });
});

