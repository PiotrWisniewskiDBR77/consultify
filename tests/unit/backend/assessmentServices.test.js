/**
 * Comprehensive Test Suite for Assessment Services
 */

const ExternalAssessmentService = require('../../server/services/externalAssessmentService');
const GenericReportService = require('../../server/services/genericReportService');
const BenchmarkingService = require('../../server/services/benchmarkingService');

describe('ExternalAssessmentService', () => {
    describe('normalizeScore', () => {
        test('should convert 1-5 scale to 1-7 scale correctly', () => {
            expect(ExternalAssessmentService.normalizeScore(1, 1, 5)).toBeCloseTo(1, 2);
            expect(ExternalAssessmentService.normalizeScore(3, 1, 5)).toBeCloseTo(4, 2);
            expect(ExternalAssessmentService.normalizeScore(5, 1, 5)).toBeCloseTo(7, 2);
        });

        test('should handle edge cases', () => {
            expect(ExternalAssessmentService.normalizeScore(2.5, 1, 5)).toBeCloseTo(3.5, 2);
            expect(ExternalAssessmentService.normalizeScore(1, 1, 7)).toBe(1);
            expect(ExternalAssessmentService.normalizeScore(7, 1, 7)).toBe(7);
        });
    });

    describe('mapSIRIToDRD', () => {
        test('should map SIRI dimensions to DRD axes', () => {
            const siriScores = {
                technology: 4.0,
                process: 3.5,
                organization: 3.0
            };

            const drdMapping = ExternalAssessmentService.mapSIRIToDRD(siriScores);

            expect(drdMapping).toHaveProperty('processes');
            expect(drdMapping).toHaveProperty('digitalProducts');
            expect(drdMapping.processes).toBeGreaterThan(0);
            expect(drdMapping.processes).toBeLessThanOrEqual(7);
        });
    });

    describe('calculateMappingConfidence', () => {
        test('should return confidence score between 0 and 1', () => {
            const rawScores = { dim1: 4, dim2: 3, dim3: 5 };
            const normalizedScores = { proc: 4.2, data: 3.8 };

            const confidence = ExternalAssessmentService.calculateMappingConfidence(
                rawScores,
                normalizedScores,
                'SIRI'
            );

            expect(confidence).toBeGreaterThanOrEqual(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });
    });
});

describe('GenericReportService', () => {
    describe('extractTags', () => {
        test('should extract relevant tags from text', () => {
            const text = 'ISO 9001 quality management system audit report';
            const tags = GenericReportService.extractTags(text);

            expect(Array.isArray(tags)).toBe(true);
            expect(tags).toContain('ISO');
            expect(tags).toContain('quality');
        });

        test('should limit number of tags', () => {
            const longText = 'ISO 9001 quality management system security compliance audit governance risk assessment framework';
            const tags = GenericReportService.extractTags(longText, 5);

            expect(tags.length).toBeLessThanOrEqual(5);
        });
    });

    describe('generateAISummary', () => {
        test('should return placeholder for missing AI service', async () => {
            const text = 'Sample audit report content';
            const summary = await GenericReportService.generateAISummary(text);

            expect(typeof summary).toBe('string');
            expect(summary.length).toBeGreaterThan(0);
        });
    });
});

describe('BenchmarkingService', () => {
    describe('getBenchmark', () => {
        test('should return benchmark for known industry', () => {
            const benchmark = BenchmarkingService.getBenchmark('MANUFACTURING');

            expect(benchmark).toHaveProperty('drd');
            expect(benchmark).toHaveProperty('lean');
            expect(benchmark).toHaveProperty('overall');
        });

        test('should return OTHER benchmark for unknown industry', () => {
            const benchmark = BenchmarkingService.getBenchmark('UNKNOWN_INDUSTRY');

            expect(benchmark).toEqual(BenchmarkingService.INDUSTRY_BENCHMARKS.OTHER);
        });

        test('should handle case insensitivity', () => {
            const benchmark1 = BenchmarkingService.getBenchmark('manufacturing');
            const benchmark2 = BenchmarkingService.getBenchmark('MANUFACTURING');

            expect(benchmark1).toEqual(benchmark2);
        });
    });

    describe('calculatePercentile', () => {
        test('should calculate percentile correctly', () => {
            const result = BenchmarkingService.calculatePercentile(4.5, 'MANUFACTURING');

            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('benchmarkScore');
            expect(result).toHaveProperty('delta');
            expect(result).toHaveProperty('percentile');
            expect(result).toHaveProperty('ranking');
        });

        test('should handle scores above benchmark', () => {
            const result = BenchmarkingService.calculatePercentile(5.0, 'MANUFACTURING', 'overall');

            expect(result.delta).toBeGreaterThan(0);
            expect(result.percentile).toBeGreaterThanOrEqual(50);
        });

        test('should handle scores below benchmark', () => {
            const result = BenchmarkingService.calculatePercentile(2.5, 'TECHNOLOGY', 'overall');

            expect(result.delta).toBeLessThan(0);
            expect(result.percentile).toBeLessThan(50);
        });
    });

    describe('getPercentileLabel', () => {
        test('should return correct labels for percentiles', () => {
            expect(BenchmarkingService.getPercentileLabel(95)).toBe('Top 10%');
            expect(BenchmarkingService.getPercentileLabel(80)).toBe('Top 25%');
            expect(BenchmarkingService.getPercentileLabel(60)).toBe('Above Average');
            expect(BenchmarkingService.getPercentileLabel(40)).toBe('Below Average');
            expect(BenchmarkingService.getPercentileLabel(20)).toBe('Bottom 25%');
        });
    });
});

describe('Integration: Full Assessment Flow', () => {
    test('should process complete assessment workflow', async () => {
        // 1. Create RapidLean assessment
        const leanResponses = {
            value_stream_1: 4,
            value_stream_2: 4,
            value_stream_3: 5,
            waste_elimination_1: 3,
            waste_elimination_2: 3,
            waste_elimination_3: 3
        };

        // 2. Normalize external assessment
        const siriScore = 3.5;
        const normalizedScore = ExternalAssessmentService.normalizeScore(siriScore, 1, 5);
        expect(normalizedScore).toBeCloseTo(4.75, 1);

        // 3. Get benchmark comparison
        const benchmark = BenchmarkingService.getBenchmark('MANUFACTURING');
        expect(benchmark.overall).toBeGreaterThan(0);

        // 4. Calculate percentile
        const percentile = BenchmarkingService.calculatePercentile(normalizedScore, 'MANUFACTURING');
        expect(percentile.percentile).toBeGreaterThan(0);
    });
});
