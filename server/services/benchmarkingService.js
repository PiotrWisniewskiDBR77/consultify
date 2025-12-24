/**
 * Benchmarking Service
 * Industry benchmark data and comparison logic
 */

const db = require('../database');

class BenchmarkingService {
    /**
     * Industry benchmark data
     * Scores on 1-7 scale for DRD, converted from research
     */
    static INDUSTRY_BENCHMARKS = {
        MANUFACTURING: {
            drd: {
                processes: 3.8,
                dataManagement: 3.2,
                digitalProducts: 3.5,
                businessModels: 2.9,
                culture: 3.1,
                cybersecurity: 3.4
            },
            lean: 3.8,
            overall: 3.4
        },
        AUTOMOTIVE: {
            drd: {
                processes: 4.2,
                dataManagement: 3.8,
                digitalProducts: 4.0,
                businessModels: 3.4,
                culture: 3.6,
                cybersecurity: 3.9
            },
            lean: 4.2,
            overall: 3.9
        },
        HEALTHCARE: {
            drd: {
                processes: 3.1,
                dataManagement: 3.5,
                digitalProducts: 2.8,
                businessModels: 2.6,
                culture: 3.2,
                cybersecurity: 4.1
            },
            lean: 3.5,
            overall: 3.2
        },
        FINANCIAL: {
            drd: {
                processes: 4.5,
                dataManagement: 4.8,
                digitalProducts: 4.2,
                businessModels: 4.0,
                culture: 3.8,
                cybersecurity: 5.2
            },
            lean: 3.2,
            overall: 4.3
        },
        RETAIL: {
            drd: {
                processes: 3.6,
                dataManagement: 3.4,
                digitalProducts: 3.8,
                businessModels: 3.9,
                culture: 3.3,
                cybersecurity: 3.2
            },
            lean: 3.6,
            overall: 3.5
        },
        LOGISTICS: {
            drd: {
                processes: 3.9,
                dataManagement: 3.3,
                digitalProducts: 3.7,
                businessModels: 3.2,
                culture: 3.0,
                cybersecurity: 3.1
            },
            lean: 4.0,
            overall: 3.5
        },
        TECHNOLOGY: {
            drd: {
                processes: 5.1,
                dataManagement: 5.3,
                digitalProducts: 5.8,
                businessModels: 5.2,
                culture: 4.9,
                cybersecurity: 5.5
            },
            lean: 3.9,
            overall: 5.3
        },
        OTHER: {
            drd: {
                processes: 3.5,
                dataManagement: 3.3,
                digitalProducts: 3.4,
                businessModels: 3.0,
                culture: 3.1,
                cybersecurity: 3.6
            },
            lean: 3.5,
            overall: 3.4
        }
    };

    /**
     * Get benchmark for organization's industry
     * @param {string} industry - Industry type
     * @returns {Object} Benchmark data
     */
    static getBenchmark(industry) {
        const normalizedIndustry = (industry || 'OTHER').toUpperCase();
        return this.INDUSTRY_BENCHMARKS[normalizedIndustry] || this.INDUSTRY_BENCHMARKS.OTHER;
    }

    /**
     * Calculate percentile ranking
     * @param {number} score - Organization's score
     * @param {string} industry - Industry type
     * @param {string} dimension - Dimension (optional)
     * @returns {Object} Percentile data
     */
    static calculatePercentile(score, industry, dimension = 'overall') {
        const benchmark = this.getBenchmark(industry);
        const benchmarkScore = dimension === 'overall'
            ? benchmark.overall
            : benchmark.drd[dimension];

        const delta = score - benchmarkScore;
        const deltaPercentage = (delta / benchmarkScore) * 100;

        // Simplified percentile estimation
        // In production, this would query actual peer data
        let percentile;
        if (deltaPercentage > 20) percentile = 90;
        else if (deltaPercentage > 10) percentile = 75;
        else if (deltaPercentage > 0) percentile = 60;
        else if (deltaPercentage > -10) percentile = 40;
        else if (deltaPercentage > -20) percentile = 25;
        else percentile = 10;

        return {
            score,
            benchmarkScore,
            delta,
            deltaPercentage: Math.round(deltaPercentage),
            percentile,
            ranking: this.getPercentileLabel(percentile)
        };
    }

    /**
     * Get percentile label
     * @param {number} percentile - Percentile value
     * @returns {string} Label
     */
    static getPercentileLabel(percentile) {
        if (percentile >= 90) return 'Top 10%';
        if (percentile >= 75) return 'Top 25%';
        if (percentile >= 50) return 'Above Average';
        if (percentile >= 25) return 'Below Average';
        return 'Bottom 25%';
    }

    /**
     * Get peer comparison (anonymous aggregate)
     * @param {string} organizationId - Organization ID
     * @param {string} industry - Industry type
     * @returns {Promise<Object>} Peer data
     */
    static async getPeerComparison(organizationId, industry) {
        // In production, this would aggregate scores from organizations in same industry
        // For now, return benchmark data with some variance

        const benchmark = this.getBenchmark(industry);

        return {
            industry,
            peerCount: 427, // Mock data
            averageScore: benchmark.overall,
            distribution: {
                top10: benchmark.overall + 1.5,
                top25: benchmark.overall + 0.8,
                median: benchmark.overall,
                bottom25: benchmark.overall - 0.8,
                bottom10: benchmark.overall - 1.5
            }
        };
    }

    /**
     * Get multi-dimensional comparison
     * @param {Object} scores - Organization scores
     * @param {string} industry - Industry
     * @returns {Object} Comparison data
     */
    static getMultiDimensionalComparison(scores, industry) {
        const benchmark = this.getBenchmark(industry);
        const comparison = {};

        Object.keys(scores).forEach(dimension => {
            if (benchmark.drd[dimension]) {
                comparison[dimension] = {
                    yourScore: scores[dimension],
                    industryAverage: benchmark.drd[dimension],
                    delta: scores[dimension] - benchmark.drd[dimension],
                    percentile: this.calculatePercentile(scores[dimension], industry, dimension).percentile
                };
            }
        });

        return comparison;
    }
}

module.exports = BenchmarkingService;
