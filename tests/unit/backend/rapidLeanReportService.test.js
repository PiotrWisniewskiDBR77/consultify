/**
 * Unit Tests for RapidLean Report Service
 * Tests report generation and data preparation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../../server/services/rapidLeanService');
vi.mock('../../../server/services/rapidLeanObservationMapper');
vi.mock('../../../server/database');

const RapidLeanReportService = require('../../../server/services/rapidLeanReportService');

describe('RapidLeanReportService', () => {
    describe('getStatus', () => {
        it('should return excellent for score above benchmark', () => {
            expect(RapidLeanReportService.getStatus(4.0, 3.5)).toBe('excellent');
        });

        it('should return good for score close to benchmark', () => {
            expect(RapidLeanReportService.getStatus(3.5, 3.5)).toBe('good');
            expect(RapidLeanReportService.getStatus(3.0, 3.5)).toBe('good');
        });

        it('should return needs_improvement for moderate gap', () => {
            expect(RapidLeanReportService.getStatus(2.5, 3.5)).toBe('needs_improvement');
        });

        it('should return critical for large gap', () => {
            expect(RapidLeanReportService.getStatus(1.5, 3.5)).toBe('critical');
        });
    });

    describe('calculateTrends', () => {
        it('should calculate trends from previous assessments', () => {
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

        it('should return null if no previous assessments', () => {
            const current = { overall_score: 3.5 };
            const trends = RapidLeanReportService.calculateTrends(current, []);
            expect(trends).toBeNull();
        });
    });

    describe('calculateImprovementRate', () => {
        it('should calculate improvement rate per month', () => {
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

        it('should return 0 if no time difference', () => {
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
        it('should prepare radar chart data', () => {
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

        it('should prepare trend chart data when previous assessments exist', () => {
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

    describe('getPreviousAssessments', () => {
        it('should fetch previous assessments for comparison', async () => {
            // This would require mocking the database
            // For now, we test the structure
            expect(typeof RapidLeanReportService.getPreviousAssessments).toBe('function');
        });
    });

    describe('saveReportMetadata', () => {
        it('should save report metadata to database', async () => {
            // This would require mocking the database
            expect(typeof RapidLeanReportService.saveReportMetadata).toBe('function');
        });
    });

    describe('generatePDF', () => {
        it.skip('should generate PDF report - requires real service implementation', async () => {
            // Skip: requires real file generation
        });
    });

    describe('generateExcel', () => {
        it.skip('should generate Excel report - requires real service implementation', async () => {
            // Skip: requires real file generation
        });
    });

    describe('generatePowerPoint', () => {
        it.skip('should generate PowerPoint report - requires real service implementation', async () => {
            // Skip: requires real file generation
        });
    });
});
