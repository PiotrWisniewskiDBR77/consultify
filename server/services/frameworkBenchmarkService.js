/**
 * Framework Benchmark Service
 * 
 * Provides industry benchmarks and percentile rankings for multi-framework assessments.
 */

// ============================================
// BENCHMARK DATA
// ============================================

/**
 * Industry benchmarks by framework and sector
 * Data based on public reports and aggregated assessments
 */
const BENCHMARK_DATA = {
    SIRI: {
        // By industry sector
        'manufacturing_discrete': {
            overall: 2.8,
            buildingBlocks: { PROCESS: 2.9, TECHNOLOGY: 2.5, ORGANIZATION: 3.0 },
            percentiles: { p25: 2.0, p50: 2.8, p75: 3.5, p90: 4.2 },
            sampleSize: 450,
            lastUpdated: '2024-Q4',
        },
        'manufacturing_process': {
            overall: 2.6,
            buildingBlocks: { PROCESS: 2.8, TECHNOLOGY: 2.3, ORGANIZATION: 2.7 },
            percentiles: { p25: 1.8, p50: 2.6, p75: 3.3, p90: 4.0 },
            sampleSize: 320,
            lastUpdated: '2024-Q4',
        },
        'automotive': {
            overall: 3.2,
            buildingBlocks: { PROCESS: 3.4, TECHNOLOGY: 3.1, ORGANIZATION: 3.1 },
            percentiles: { p25: 2.5, p50: 3.2, p75: 3.9, p90: 4.5 },
            sampleSize: 180,
            lastUpdated: '2024-Q4',
        },
        'aerospace': {
            overall: 3.0,
            buildingBlocks: { PROCESS: 3.2, TECHNOLOGY: 2.8, ORGANIZATION: 3.0 },
            percentiles: { p25: 2.3, p50: 3.0, p75: 3.7, p90: 4.3 },
            sampleSize: 95,
            lastUpdated: '2024-Q4',
        },
        'electronics': {
            overall: 3.4,
            buildingBlocks: { PROCESS: 3.3, TECHNOLOGY: 3.5, ORGANIZATION: 3.4 },
            percentiles: { p25: 2.7, p50: 3.4, p75: 4.1, p90: 4.6 },
            sampleSize: 210,
            lastUpdated: '2024-Q4',
        },
        '_global': {
            overall: 2.9,
            buildingBlocks: { PROCESS: 3.0, TECHNOLOGY: 2.7, ORGANIZATION: 3.0 },
            percentiles: { p25: 2.1, p50: 2.9, p75: 3.6, p90: 4.3 },
            sampleSize: 1500,
            lastUpdated: '2024-Q4',
        },
    },
    ADMA: {
        'manufacturing_discrete': {
            overall: 2.5,
            pillars: { 
                strategy: 2.8, 
                smart_products: 2.3, 
                smart_operations: 2.6, 
                smart_supply: 2.4, 
                data_driven: 2.2 
            },
            percentiles: { p25: 1.8, p50: 2.5, p75: 3.2, p90: 3.9 },
            sampleSize: 380,
            lastUpdated: '2024-Q4',
        },
        'manufacturing_process': {
            overall: 2.3,
            pillars: { 
                strategy: 2.5, 
                smart_products: 2.0, 
                smart_operations: 2.5, 
                smart_supply: 2.3, 
                data_driven: 2.0 
            },
            percentiles: { p25: 1.6, p50: 2.3, p75: 3.0, p90: 3.7 },
            sampleSize: 290,
            lastUpdated: '2024-Q4',
        },
        '_global': {
            overall: 2.4,
            pillars: { 
                strategy: 2.6, 
                smart_products: 2.2, 
                smart_operations: 2.5, 
                smart_supply: 2.3, 
                data_driven: 2.1 
            },
            percentiles: { p25: 1.7, p50: 2.4, p75: 3.1, p90: 3.8 },
            sampleSize: 1200,
            lastUpdated: '2024-Q4',
        },
    },
    CMMI: {
        'software': {
            overall: 2.8,
            categories: { DOING: 2.9, MANAGING: 2.7, ENABLING: 2.8 },
            percentiles: { p25: 2.0, p50: 2.8, p75: 3.5, p90: 4.2 },
            sampleSize: 2500,
            lastUpdated: '2024-Q4',
        },
        'it_services': {
            overall: 2.5,
            categories: { DOING: 2.6, MANAGING: 2.4, ENABLING: 2.5 },
            percentiles: { p25: 1.8, p50: 2.5, p75: 3.2, p90: 3.9 },
            sampleSize: 1800,
            lastUpdated: '2024-Q4',
        },
        'defense': {
            overall: 3.2,
            categories: { DOING: 3.3, MANAGING: 3.1, ENABLING: 3.2 },
            percentiles: { p25: 2.5, p50: 3.2, p75: 3.9, p90: 4.5 },
            sampleSize: 450,
            lastUpdated: '2024-Q4',
        },
        '_global': {
            overall: 2.7,
            categories: { DOING: 2.8, MANAGING: 2.6, ENABLING: 2.7 },
            percentiles: { p25: 1.9, p50: 2.7, p75: 3.4, p90: 4.1 },
            sampleSize: 5000,
            lastUpdated: '2024-Q4',
        },
    },
    LEAN: {
        'manufacturing_discrete': {
            overall: 2.8,
            phases: { MEASURE: 3.0, OPTIMIZE: 2.9, AUTOMATE: 2.5 },
            percentiles: { p25: 2.0, p50: 2.8, p75: 3.5, p90: 4.2 },
            automationPotential: { high: 25, medium: 45, low: 30 },
            sampleSize: 280,
            lastUpdated: '2024-Q4',
        },
        'manufacturing_process': {
            overall: 2.6,
            phases: { MEASURE: 2.8, OPTIMIZE: 2.7, AUTOMATE: 2.3 },
            percentiles: { p25: 1.8, p50: 2.6, p75: 3.3, p90: 4.0 },
            automationPotential: { high: 20, medium: 40, low: 40 },
            sampleSize: 220,
            lastUpdated: '2024-Q4',
        },
        '_global': {
            overall: 2.7,
            phases: { MEASURE: 2.9, OPTIMIZE: 2.8, AUTOMATE: 2.4 },
            percentiles: { p25: 1.9, p50: 2.7, p75: 3.4, p90: 4.1 },
            automationPotential: { high: 22, medium: 43, low: 35 },
            sampleSize: 600,
            lastUpdated: '2024-Q4',
        },
    },
};

// Region modifiers
const REGION_MODIFIERS = {
    'APAC': { SIRI: 1.1, ADMA: 0.95, CMMI: 1.05, LEAN: 1.0 },
    'Europe': { SIRI: 1.0, ADMA: 1.05, CMMI: 1.0, LEAN: 1.05 },
    'North America': { SIRI: 0.95, ADMA: 1.0, CMMI: 1.1, LEAN: 1.0 },
    'South America': { SIRI: 0.85, ADMA: 0.9, CMMI: 0.9, LEAN: 0.9 },
    '_global': { SIRI: 1.0, ADMA: 1.0, CMMI: 1.0, LEAN: 1.0 },
};

// Company size modifiers
const SIZE_MODIFIERS = {
    'small': 0.85,      // < 50 employees
    'medium': 0.95,     // 50-250 employees
    'large': 1.05,      // 250-1000 employees
    'enterprise': 1.15, // > 1000 employees
};

// ============================================
// SERVICE CLASS
// ============================================

class FrameworkBenchmarkService {
    /**
     * Get benchmark data for a framework and industry
     * @param {string} framework - Framework ID
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options (region, size)
     * @returns {Object} Benchmark data
     */
    static getBenchmark(framework, industry, options = {}) {
        const { region = '_global', companySize = 'medium' } = options;
        
        const frameworkData = BENCHMARK_DATA[framework];
        if (!frameworkData) {
            return null;
        }
        
        const industryData = frameworkData[industry] || frameworkData['_global'];
        if (!industryData) {
            return null;
        }
        
        // Apply modifiers
        const regionMod = REGION_MODIFIERS[region]?.[framework] || 1.0;
        const sizeMod = SIZE_MODIFIERS[companySize] || 1.0;
        const modifier = (regionMod + sizeMod) / 2;
        
        // Apply modifiers to percentiles
        const adjustedPercentiles = {};
        Object.entries(industryData.percentiles).forEach(([key, value]) => {
            adjustedPercentiles[key] = Math.min(5, value * modifier);
        });
        
        return {
            ...industryData,
            percentiles: adjustedPercentiles,
            adjustedOverall: Math.min(5, industryData.overall * modifier),
            modifiers: { region: regionMod, size: sizeMod, combined: modifier },
        };
    }

    /**
     * Calculate percentile rank for a score
     * @param {string} framework - Framework ID
     * @param {number} score - Assessment score
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options
     * @returns {Object} Percentile information
     */
    static calculatePercentile(framework, score, industry, options = {}) {
        const benchmark = this.getBenchmark(framework, industry, options);
        if (!benchmark) {
            return { percentile: 50, label: 'Average' };
        }
        
        const { percentiles } = benchmark;
        
        let percentile;
        if (score <= percentiles.p25) {
            percentile = Math.round((score / percentiles.p25) * 25);
        } else if (score <= percentiles.p50) {
            percentile = 25 + Math.round(((score - percentiles.p25) / (percentiles.p50 - percentiles.p25)) * 25);
        } else if (score <= percentiles.p75) {
            percentile = 50 + Math.round(((score - percentiles.p50) / (percentiles.p75 - percentiles.p50)) * 25);
        } else if (score <= percentiles.p90) {
            percentile = 75 + Math.round(((score - percentiles.p75) / (percentiles.p90 - percentiles.p75)) * 15);
        } else {
            percentile = 90 + Math.round(((score - percentiles.p90) / (5 - percentiles.p90)) * 10);
        }
        
        percentile = Math.min(99, Math.max(1, percentile));
        
        const label = this.getPercentileLabel(percentile);
        
        return {
            percentile,
            label,
            industryAverage: benchmark.adjustedOverall || benchmark.overall,
            gapToAverage: score - (benchmark.adjustedOverall || benchmark.overall),
            betterThan: `${percentile}% of ${industry.replace(/_/g, ' ')} organizations`,
        };
    }

    /**
     * Get label for percentile
     */
    static getPercentileLabel(percentile) {
        if (percentile >= 90) return 'Industry Leader';
        if (percentile >= 75) return 'Above Average';
        if (percentile >= 50) return 'Average';
        if (percentile >= 25) return 'Below Average';
        return 'Laggard';
    }

    /**
     * Compare assessment to benchmark with detailed breakdown
     * @param {string} framework - Framework ID
     * @param {Object} scoreResult - Score calculation result
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options
     * @returns {Object} Comparison data
     */
    static compareToIndustry(framework, scoreResult, industry, options = {}) {
        const benchmark = this.getBenchmark(framework, industry, options);
        if (!benchmark) {
            return null;
        }
        
        const overall = this.calculatePercentile(
            framework, 
            scoreResult.overall, 
            industry, 
            options
        );
        
        const categoryComparison = {};
        const categories = scoreResult.categories || {};
        
        // Compare each category
        if (framework === 'SIRI' && benchmark.buildingBlocks) {
            Object.entries(categories).forEach(([catId, score]) => {
                const benchmarkScore = benchmark.buildingBlocks[catId];
                categoryComparison[catId] = {
                    score,
                    benchmark: benchmarkScore,
                    gap: score - benchmarkScore,
                    status: score >= benchmarkScore ? 'above' : 'below',
                };
            });
        } else if (framework === 'ADMA' && benchmark.pillars) {
            Object.entries(categories).forEach(([catId, score]) => {
                const benchmarkScore = benchmark.pillars[catId];
                categoryComparison[catId] = {
                    score,
                    benchmark: benchmarkScore,
                    gap: score - benchmarkScore,
                    status: score >= benchmarkScore ? 'above' : 'below',
                };
            });
        } else if (framework === 'CMMI' && benchmark.categories) {
            Object.entries(categories).forEach(([catId, score]) => {
                const benchmarkScore = benchmark.categories[catId];
                categoryComparison[catId] = {
                    score,
                    benchmark: benchmarkScore,
                    gap: score - benchmarkScore,
                    status: score >= benchmarkScore ? 'above' : 'below',
                };
            });
        } else if (framework === 'LEAN' && benchmark.phases) {
            Object.entries(categories).forEach(([catId, score]) => {
                const benchmarkScore = benchmark.phases[catId];
                categoryComparison[catId] = {
                    score,
                    benchmark: benchmarkScore,
                    gap: score - benchmarkScore,
                    status: score >= benchmarkScore ? 'above' : 'below',
                };
            });
        }
        
        // Identify strengths and weaknesses
        const strengths = Object.entries(categoryComparison)
            .filter(([, data]) => data.gap > 0.5)
            .map(([id, data]) => ({ id, gap: data.gap }))
            .sort((a, b) => b.gap - a.gap);
            
        const weaknesses = Object.entries(categoryComparison)
            .filter(([, data]) => data.gap < -0.5)
            .map(([id, data]) => ({ id, gap: data.gap }))
            .sort((a, b) => a.gap - b.gap);
        
        return {
            overall,
            categoryComparison,
            strengths,
            weaknesses,
            benchmark: {
                industry,
                sampleSize: benchmark.sampleSize,
                lastUpdated: benchmark.lastUpdated,
            },
        };
    }

    /**
     * Get industry list for a framework
     * @param {string} framework - Framework ID
     * @returns {Array} Available industries
     */
    static getAvailableIndustries(framework) {
        const frameworkData = BENCHMARK_DATA[framework];
        if (!frameworkData) return [];
        
        return Object.keys(frameworkData)
            .filter(k => k !== '_global')
            .map(id => ({
                id,
                name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                sampleSize: frameworkData[id].sampleSize,
            }));
    }

    /**
     * Get regional comparison
     * @param {string} framework - Framework ID
     * @param {number} score - Assessment score
     * @param {string} industry - Industry sector
     * @returns {Object} Regional comparison
     */
    static getRegionalComparison(framework, score, industry) {
        const regions = ['APAC', 'Europe', 'North America', 'South America'];
        const comparisons = {};
        
        regions.forEach(region => {
            const percentile = this.calculatePercentile(framework, score, industry, { region });
            comparisons[region] = percentile;
        });
        
        return comparisons;
    }
}

export {
FrameworkBenchmarkService,
    BENCHMARK_DATA,
    REGION_MODIFIERS,
    SIZE_MODIFIERS,
};

export default {
    FrameworkBenchmarkService,
    BENCHMARK_DATA,
    REGION_MODIFIERS,
    SIZE_MODIFIERS,
};









