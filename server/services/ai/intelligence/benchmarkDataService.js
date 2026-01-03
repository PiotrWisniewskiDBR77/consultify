/**
 * Benchmark Data Service
 * 
 * Provides dynamic benchmarking capabilities for digital maturity assessments.
 * Combines static industry benchmarks with dynamic web-sourced data.
 * 
 * Part of the Enterprise AI Consulting System for BCG/McKinsey-level reports.
 */

import { v4 as uuidv4 } from 'uuid';
const db = require('../../../database');
const WebSearchService = require('../../webSearchService');
const IndustryIntelligenceService = require('./industryIntelligenceService');

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Comprehensive benchmark definitions by DRD axis
const DRD_AXIS_BENCHMARKS = {
    processes: {
        name: 'Digital Processes',
        benchmarks: {
            Technology: { p25: 3.5, median: 4.5, p75: 5.5, leader: 6.5 },
            'Financial Services': { p25: 3.0, median: 4.2, p75: 5.3, leader: 6.2 },
            Healthcare: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 },
            Industrial: { p25: 2.0, median: 3.2, p75: 4.3, leader: 5.2 },
            Consumer: { p25: 2.8, median: 3.8, p75: 4.8, leader: 5.8 },
            default: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 }
        }
    },
    digitalProducts: {
        name: 'Digital Products',
        benchmarks: {
            Technology: { p25: 4.0, median: 5.0, p75: 6.0, leader: 6.8 },
            'Financial Services': { p25: 3.0, median: 4.0, p75: 5.2, leader: 6.0 },
            Healthcare: { p25: 2.0, median: 3.0, p75: 4.2, leader: 5.2 },
            Industrial: { p25: 1.8, median: 2.8, p75: 4.0, leader: 5.0 },
            Consumer: { p25: 3.2, median: 4.2, p75: 5.2, leader: 6.2 },
            default: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 }
        }
    },
    businessModels: {
        name: 'Digital Business Models',
        benchmarks: {
            Technology: { p25: 3.8, median: 4.8, p75: 5.8, leader: 6.5 },
            'Financial Services': { p25: 2.8, median: 3.8, p75: 5.0, leader: 6.0 },
            Healthcare: { p25: 2.0, median: 3.0, p75: 4.0, leader: 5.0 },
            Industrial: { p25: 1.5, median: 2.5, p75: 3.5, leader: 4.5 },
            Consumer: { p25: 3.0, median: 4.0, p75: 5.0, leader: 6.0 },
            default: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 }
        }
    },
    dataManagement: {
        name: 'Data Management',
        benchmarks: {
            Technology: { p25: 3.5, median: 4.5, p75: 5.5, leader: 6.3 },
            'Financial Services': { p25: 3.2, median: 4.3, p75: 5.5, leader: 6.3 },
            Healthcare: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 },
            Industrial: { p25: 2.0, median: 3.0, p75: 4.0, leader: 5.0 },
            Consumer: { p25: 2.8, median: 3.8, p75: 4.8, leader: 5.8 },
            default: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 }
        }
    },
    culture: {
        name: 'Culture of Transformation',
        benchmarks: {
            Technology: { p25: 3.5, median: 4.3, p75: 5.3, leader: 6.2 },
            'Financial Services': { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 },
            Healthcare: { p25: 2.2, median: 3.2, p75: 4.2, leader: 5.2 },
            Industrial: { p25: 2.0, median: 3.0, p75: 4.0, leader: 5.0 },
            Consumer: { p25: 2.8, median: 3.8, p75: 4.8, leader: 5.8 },
            default: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 }
        }
    },
    cybersecurity: {
        name: 'Cybersecurity',
        benchmarks: {
            Technology: { p25: 4.0, median: 5.0, p75: 6.0, leader: 6.7 },
            'Financial Services': { p25: 4.0, median: 5.2, p75: 6.2, leader: 6.8 },
            Healthcare: { p25: 3.0, median: 4.0, p75: 5.0, leader: 6.0 },
            Industrial: { p25: 2.5, median: 3.5, p75: 4.5, leader: 5.5 },
            Consumer: { p25: 2.8, median: 3.8, p75: 4.8, leader: 5.8 },
            default: { p25: 3.0, median: 4.0, p75: 5.0, leader: 6.0 }
        }
    },
    aiMaturity: {
        name: 'AI Maturity',
        benchmarks: {
            Technology: { p25: 3.0, median: 4.2, p75: 5.5, leader: 6.5 },
            'Financial Services': { p25: 2.5, median: 3.5, p75: 4.8, leader: 6.0 },
            Healthcare: { p25: 2.0, median: 3.0, p75: 4.0, leader: 5.2 },
            Industrial: { p25: 1.5, median: 2.5, p75: 3.8, leader: 5.0 },
            Consumer: { p25: 2.0, median: 3.2, p75: 4.5, leader: 5.8 },
            default: { p25: 2.0, median: 3.0, p75: 4.0, leader: 5.5 }
        }
    }
};

// Company size adjustments
const SIZE_ADJUSTMENTS = {
    STARTUP: { multiplier: 0.85, label: 'Startups typically lower baseline, but higher agility' },
    SMB: { multiplier: 0.92, label: 'SMBs typically 8% below enterprise median' },
    MID_MARKET: { multiplier: 1.0, label: 'Mid-market at industry median' },
    ENTERPRISE: { multiplier: 1.08, label: 'Enterprises typically 8% above median' }
};

class BenchmarkDataService {

    /**
     * Get comprehensive benchmark data for an assessment
     * @param {string} industry - Industry name
     * @param {string} companySize - Company size category
     * @param {string} region - Optional geographic region
     * @returns {Promise<BenchmarkData>}
     */
    static async getBenchmarkData(industry, companySize = 'MID_MARKET', region = null) {
        const cacheKey = `benchmark_${industry}_${companySize}_${region || 'global'}`;

        // Check cache
        const cached = await this.getCachedBenchmark(cacheKey);
        if (cached) {
            return cached;
        }

        // Build benchmark data
        const axisBenchmarks = this.buildAxisBenchmarks(industry, companySize);
        const overallBenchmark = this.calculateOverallBenchmark(axisBenchmarks);
        
        // Try to enhance with web data
        let enhancedData = null;
        try {
            enhancedData = await this.fetchEnhancedBenchmarks(industry);
        } catch (error) {
            console.warn('[BenchmarkDataService] Enhanced data fetch failed:', error.message);
        }

        const benchmarkData = {
            industry,
            companySize,
            region: region || 'global',
            axisBenchmarks,
            overallBenchmark,
            sizeAdjustment: SIZE_ADJUSTMENTS[companySize] || SIZE_ADJUSTMENTS.MID_MARKET,
            enhanced: enhancedData,
            generatedAt: new Date().toISOString(),
            confidence: enhancedData ? 'HIGH' : 'MEDIUM'
        };

        // Cache the result
        await this.cacheBenchmark(cacheKey, benchmarkData);

        return benchmarkData;
    }

    /**
     * Compare assessment scores against benchmarks
     * @param {Object} assessmentScores - Object with axis scores
     * @param {string} industry - Industry for comparison
     * @param {string} companySize - Company size
     * @returns {Promise<ComparisonResult>}
     */
    static async compareWithBenchmarks(assessmentScores, industry, companySize = 'MID_MARKET') {
        const benchmarks = await this.getBenchmarkData(industry, companySize);
        const comparison = {};
        let totalDeviation = 0;
        let axisCount = 0;

        Object.keys(assessmentScores).forEach(axisId => {
            const score = assessmentScores[axisId];
            const axisBenchmark = benchmarks.axisBenchmarks[axisId];

            if (axisBenchmark) {
                const median = axisBenchmark.adjusted?.median || axisBenchmark.raw.median;
                const deviation = score - median;
                const percentile = this.calculatePercentile(score, axisBenchmark);

                comparison[axisId] = {
                    score,
                    benchmark: axisBenchmark,
                    deviation: Math.round(deviation * 10) / 10,
                    percentile,
                    position: this.determinePosition(percentile),
                    gap: Math.round((axisBenchmark.raw.leader - score) * 10) / 10,
                    insight: this.generateAxisInsight(axisId, score, axisBenchmark, percentile)
                };

                totalDeviation += deviation;
                axisCount++;
            }
        });

        const avgDeviation = axisCount > 0 ? totalDeviation / axisCount : 0;
        const overallPercentile = this.calculateOverallPercentile(assessmentScores, benchmarks);

        return {
            comparison,
            summary: {
                avgDeviation: Math.round(avgDeviation * 10) / 10,
                overallPercentile,
                overallPosition: this.determinePosition(overallPercentile),
                strongestAxis: this.findStrongestAxis(comparison),
                weakestAxis: this.findWeakestAxis(comparison),
                priorityGaps: this.identifyPriorityGaps(comparison)
            },
            recommendations: this.generateBenchmarkRecommendations(comparison, industry),
            benchmarkMeta: {
                industry: benchmarks.industry,
                companySize: benchmarks.companySize,
                confidence: benchmarks.confidence,
                generatedAt: benchmarks.generatedAt
            }
        };
    }

    /**
     * Get peer comparison data
     */
    static async getPeerComparison(organizationId, assessmentScores, industry) {
        // Get anonymized peer data from database
        const peerData = await this.fetchPeerData(industry);
        
        if (!peerData || peerData.length < 5) {
            return {
                hasPeerData: false,
                message: 'Insufficient peer data for comparison',
                fallbackBenchmarks: await this.getBenchmarkData(industry)
            };
        }

        // Calculate peer statistics
        const peerStats = this.calculatePeerStatistics(peerData);
        const yourPosition = this.calculatePeerPosition(assessmentScores, peerStats);

        return {
            hasPeerData: true,
            peerCount: peerData.length,
            peerStats,
            yourPosition,
            insights: this.generatePeerInsights(yourPosition, peerStats)
        };
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    /**
     * Build benchmark data for all axes
     */
    static buildAxisBenchmarks(industry, companySize) {
        const result = {};
        const sizeAdj = SIZE_ADJUSTMENTS[companySize] || SIZE_ADJUSTMENTS.MID_MARKET;

        Object.keys(DRD_AXIS_BENCHMARKS).forEach(axisId => {
            const axisDef = DRD_AXIS_BENCHMARKS[axisId];
            const raw = axisDef.benchmarks[industry] || axisDef.benchmarks.default;

            result[axisId] = {
                name: axisDef.name,
                raw: { ...raw },
                adjusted: {
                    p25: Math.round(raw.p25 * sizeAdj.multiplier * 10) / 10,
                    median: Math.round(raw.median * sizeAdj.multiplier * 10) / 10,
                    p75: Math.round(raw.p75 * sizeAdj.multiplier * 10) / 10,
                    leader: raw.leader // Leader benchmark not adjusted
                },
                sizeNote: sizeAdj.label
            };
        });

        return result;
    }

    /**
     * Calculate overall benchmark
     */
    static calculateOverallBenchmark(axisBenchmarks) {
        const axes = Object.values(axisBenchmarks);
        if (axes.length === 0) return { p25: 3, median: 4, p75: 5, leader: 6 };

        return {
            p25: Math.round(axes.reduce((sum, a) => sum + a.raw.p25, 0) / axes.length * 10) / 10,
            median: Math.round(axes.reduce((sum, a) => sum + a.raw.median, 0) / axes.length * 10) / 10,
            p75: Math.round(axes.reduce((sum, a) => sum + a.raw.p75, 0) / axes.length * 10) / 10,
            leader: Math.round(axes.reduce((sum, a) => sum + a.raw.leader, 0) / axes.length * 10) / 10
        };
    }

    /**
     * Fetch enhanced benchmarks from web
     */
    static async fetchEnhancedBenchmarks(industry) {
        const query = `${industry} digital maturity benchmark statistics percentile 2024`;
        
        const result = await WebSearchService.search(query);
        
        if (!result.isVerified || !result.sources?.length) {
            return null;
        }

        return {
            insight: result.answer,
            sources: result.sources.slice(0, 2).map(s => ({
                title: s.title,
                url: s.url
            })),
            fetchedAt: new Date().toISOString()
        };
    }

    /**
     * Calculate percentile for a score
     */
    static calculatePercentile(score, benchmark) {
        const { p25, median, p75, leader } = benchmark.raw;

        if (score <= p25) {
            return Math.round((score / p25) * 25);
        } else if (score <= median) {
            return 25 + Math.round(((score - p25) / (median - p25)) * 25);
        } else if (score <= p75) {
            return 50 + Math.round(((score - median) / (p75 - median)) * 25);
        } else if (score <= leader) {
            return 75 + Math.round(((score - p75) / (leader - p75)) * 20);
        } else {
            return 95 + Math.min(5, Math.round((score - leader) * 2));
        }
    }

    /**
     * Calculate overall percentile
     */
    static calculateOverallPercentile(scores, benchmarks) {
        const percentiles = [];
        Object.keys(scores).forEach(axisId => {
            const benchmark = benchmarks.axisBenchmarks[axisId];
            if (benchmark) {
                percentiles.push(this.calculatePercentile(scores[axisId], benchmark));
            }
        });
        
        return percentiles.length > 0 
            ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
            : 50;
    }

    /**
     * Determine position label from percentile
     */
    static determinePosition(percentile) {
        if (percentile >= 90) return 'LEADER';
        if (percentile >= 75) return 'TOP_QUARTILE';
        if (percentile >= 50) return 'ABOVE_MEDIAN';
        if (percentile >= 25) return 'BELOW_MEDIAN';
        return 'BOTTOM_QUARTILE';
    }

    /**
     * Generate insight for an axis
     */
    static generateAxisInsight(axisId, score, benchmark, percentile) {
        const position = this.determinePosition(percentile);
        const gap = benchmark.raw.leader - score;
        
        const axisNames = {
            processes: 'process digitalization',
            digitalProducts: 'digital products',
            businessModels: 'digital business models',
            dataManagement: 'data management',
            culture: 'transformation culture',
            cybersecurity: 'cybersecurity',
            aiMaturity: 'AI maturity'
        };

        const axisName = axisNames[axisId] || axisId;

        if (position === 'LEADER') {
            return `Exceptional ${axisName} - among industry leaders (P${percentile})`;
        } else if (position === 'TOP_QUARTILE') {
            return `Strong ${axisName} performance in top quartile (P${percentile}). ${Math.round(gap * 10) / 10} points from leader benchmark.`;
        } else if (position === 'ABOVE_MEDIAN') {
            return `${axisName} above industry median (P${percentile}). Opportunity to reach top quartile with focused investment.`;
        } else if (position === 'BELOW_MEDIAN') {
            return `${axisName} below industry median (P${percentile}). Priority area for improvement to reach competitive parity.`;
        } else {
            return `Significant gap in ${axisName} (P${percentile}). Critical priority requiring immediate attention.`;
        }
    }

    /**
     * Find strongest axis in comparison
     */
    static findStrongestAxis(comparison) {
        let strongest = null;
        let highestPercentile = -1;

        Object.entries(comparison).forEach(([axisId, data]) => {
            if (data.percentile > highestPercentile) {
                highestPercentile = data.percentile;
                strongest = { axisId, ...data };
            }
        });

        return strongest;
    }

    /**
     * Find weakest axis in comparison
     */
    static findWeakestAxis(comparison) {
        let weakest = null;
        let lowestPercentile = 101;

        Object.entries(comparison).forEach(([axisId, data]) => {
            if (data.percentile < lowestPercentile) {
                lowestPercentile = data.percentile;
                weakest = { axisId, ...data };
            }
        });

        return weakest;
    }

    /**
     * Identify priority gaps
     */
    static identifyPriorityGaps(comparison) {
        const gaps = [];

        Object.entries(comparison).forEach(([axisId, data]) => {
            if (data.percentile < 50 || data.gap > 2) {
                gaps.push({
                    axisId,
                    axisName: data.benchmark.name,
                    currentScore: data.score,
                    gap: data.gap,
                    percentile: data.percentile,
                    priority: data.percentile < 25 ? 'CRITICAL' : data.percentile < 50 ? 'HIGH' : 'MEDIUM'
                });
            }
        });

        return gaps.sort((a, b) => a.percentile - b.percentile);
    }

    /**
     * Generate benchmark-based recommendations
     */
    static generateBenchmarkRecommendations(comparison, industry) {
        const recommendations = [];
        const gaps = this.identifyPriorityGaps(comparison);

        gaps.slice(0, 3).forEach(gap => {
            recommendations.push({
                area: gap.axisName,
                priority: gap.priority,
                recommendation: this.getRecommendationForAxis(gap.axisId, gap.gap, industry),
                expectedImpact: `Move from P${gap.percentile} to P${Math.min(75, gap.percentile + 25)}`,
                effortLevel: gap.gap > 2 ? 'HIGH' : gap.gap > 1 ? 'MEDIUM' : 'LOW'
            });
        });

        return recommendations;
    }

    /**
     * Get specific recommendation for an axis
     */
    static getRecommendationForAxis(axisId, gap, industry) {
        const recommendations = {
            processes: [
                'Implement end-to-end process automation for core workflows',
                'Deploy BPM platform with real-time monitoring',
                'Establish process mining capability for continuous optimization'
            ],
            digitalProducts: [
                'Launch customer-facing digital self-service portal',
                'Develop mobile-first product experience',
                'Implement product analytics for data-driven improvements'
            ],
            businessModels: [
                'Explore platform or subscription business models',
                'Develop digital revenue streams',
                'Create ecosystem partnerships for value expansion'
            ],
            dataManagement: [
                'Establish enterprise data governance framework',
                'Implement modern data platform (lake/warehouse)',
                'Deploy real-time analytics capabilities'
            ],
            culture: [
                'Launch digital upskilling program for all employees',
                'Establish agile ways of working across organization',
                'Create innovation program with dedicated time/budget'
            ],
            cybersecurity: [
                'Implement Zero Trust security architecture',
                'Deploy security automation and SOAR platform',
                'Establish security-by-design in all digital initiatives'
            ],
            aiMaturity: [
                'Build foundational ML/AI capabilities with pilot use cases',
                'Establish AI Center of Excellence',
                'Implement MLOps for scalable AI deployment'
            ]
        };

        const axisRecs = recommendations[axisId] || recommendations.processes;
        const index = gap > 2 ? 0 : gap > 1 ? 1 : 2;
        return axisRecs[index];
    }

    /**
     * Fetch peer data from database
     */
    static async fetchPeerData(industry) {
        return new Promise((resolve) => {
            db.all(
                `SELECT ma.scores_json FROM maturity_assessments ma
                 JOIN organization_profiles op ON ma.organization_id = op.organization_id
                 WHERE op.industry = ? AND ma.status = 'COMPLETED'
                 ORDER BY ma.created_at DESC
                 LIMIT 50`,
                [industry],
                (err, rows) => {
                    if (err) {
                        console.warn('[BenchmarkDataService] Peer data fetch error:', err.message);
                        resolve([]);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Calculate peer statistics
     */
    static calculatePeerStatistics(peerData) {
        // Parse scores and calculate statistics
        const axisScores = {};

        peerData.forEach(row => {
            try {
                const scores = JSON.parse(row.scores_json || '{}');
                Object.entries(scores).forEach(([axis, score]) => {
                    if (!axisScores[axis]) axisScores[axis] = [];
                    axisScores[axis].push(score);
                });
            } catch {
                // Skip invalid rows
            }
        });

        const stats = {};
        Object.entries(axisScores).forEach(([axis, scores]) => {
            if (scores.length > 0) {
                scores.sort((a, b) => a - b);
                stats[axis] = {
                    min: scores[0],
                    p25: scores[Math.floor(scores.length * 0.25)],
                    median: scores[Math.floor(scores.length * 0.5)],
                    p75: scores[Math.floor(scores.length * 0.75)],
                    max: scores[scores.length - 1],
                    count: scores.length
                };
            }
        });

        return stats;
    }

    /**
     * Calculate position among peers
     */
    static calculatePeerPosition(scores, peerStats) {
        const positions = {};

        Object.entries(scores).forEach(([axis, score]) => {
            const stats = peerStats[axis];
            if (stats) {
                let percentile;
                if (score <= stats.p25) percentile = 25;
                else if (score <= stats.median) percentile = 50;
                else if (score <= stats.p75) percentile = 75;
                else percentile = 90;

                positions[axis] = {
                    score,
                    peerMedian: stats.median,
                    percentile,
                    deviation: Math.round((score - stats.median) * 10) / 10
                };
            }
        });

        return positions;
    }

    /**
     * Generate peer comparison insights
     */
    static generatePeerInsights(positions, peerStats) {
        const insights = [];
        
        Object.entries(positions).forEach(([axis, pos]) => {
            if (pos.percentile >= 75) {
                insights.push({
                    type: 'STRENGTH',
                    axis,
                    message: `Top quartile performance in ${axis} among peers`
                });
            } else if (pos.percentile <= 25) {
                insights.push({
                    type: 'GAP',
                    axis,
                    message: `Below peer median in ${axis} - priority improvement area`
                });
            }
        });

        return insights;
    }

    // ============================================================================
    // CACHING
    // ============================================================================

    static async getCachedBenchmark(cacheKey) {
        return new Promise((resolve) => {
            db.get(
                `SELECT * FROM industry_intelligence_cache 
                 WHERE industry = ? AND is_valid = 1 AND expires_at > datetime('now')`,
                [cacheKey],
                (err, row) => {
                    if (err || !row) {
                        resolve(null);
                        return;
                    }
                    try {
                        resolve(JSON.parse(row.benchmarks_data));
                    } catch {
                        resolve(null);
                    }
                }
            );
        });
    }

    static async cacheBenchmark(cacheKey, data) {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

        return new Promise((resolve) => {
            db.run(
                `INSERT OR REPLACE INTO industry_intelligence_cache 
                 (id, industry, benchmarks_data, fetched_at, expires_at, is_valid, confidence_score)
                 VALUES (?, ?, ?, ?, ?, 1, ?)`,
                [id, cacheKey, JSON.stringify(data), new Date().toISOString(), expiresAt, 0.8],
                (err) => resolve(!err)
            );
        });
    }
}

export default BenchmarkDataService;








