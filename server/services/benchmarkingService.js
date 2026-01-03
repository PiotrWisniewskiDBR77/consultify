/**
 * Global Benchmarking Service
 * 
 * Provides comprehensive benchmarking capabilities:
 * - Industry benchmark database
 * - Digital Transformation Index
 * - Cross-organization comparisons
 * - Trend analysis
 * - Best practice library
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



// Benchmark categories
const BENCHMARK_CATEGORIES = {
    MATURITY: 'maturity',
    PERFORMANCE: 'performance',
    INVESTMENT: 'investment',
    OUTCOMES: 'outcomes',
    ADOPTION: 'adoption'
};

// Company size segments
const SIZE_SEGMENTS = {
    SMALL: { min: 1, max: 50, label: 'Small (1-50)' },
    MEDIUM: { min: 51, max: 500, label: 'Medium (51-500)' },
    LARGE: { min: 501, max: 5000, label: 'Large (501-5000)' },
    ENTERPRISE: { min: 5001, max: Infinity, label: 'Enterprise (5000+)' }
};

// Regions
const REGIONS = {
    NORTH_AMERICA: 'north_america',
    EUROPE: 'europe',
    ASIA_PACIFIC: 'asia_pacific',
    LATIN_AMERICA: 'latin_america',
    MIDDLE_EAST_AFRICA: 'middle_east_africa'
};

const BenchmarkingService = {
    BENCHMARK_CATEGORIES,
    SIZE_SEGMENTS,
    REGIONS,

    /**
     * Calculate Digital Transformation Index (DTI) for an organization
     */
    calculateDTI: async (organizationId) => {
        // Get organization data
        const orgData = await BenchmarkingService.getOrganizationData(organizationId);
        if (!orgData) return null;

        // Calculate component scores (0-100)
        const components = {
            strategyVision: await BenchmarkingService.assessStrategyVision(orgData),
            digitalCapabilities: await BenchmarkingService.assessDigitalCapabilities(orgData),
            dataAnalytics: await BenchmarkingService.assessDataAnalytics(orgData),
            operationalExcellence: await BenchmarkingService.assessOperationalExcellence(orgData),
            customerExperience: await BenchmarkingService.assessCustomerExperience(orgData),
            cultureInnovation: await BenchmarkingService.assessCultureInnovation(orgData)
        };

        // Weighted average for overall DTI
        const weights = {
            strategyVision: 0.15,
            digitalCapabilities: 0.20,
            dataAnalytics: 0.20,
            operationalExcellence: 0.15,
            customerExperience: 0.15,
            cultureInnovation: 0.15
        };

        let overallDTI = 0;
        for (const [component, score] of Object.entries(components)) {
            overallDTI += score * weights[component];
        }

        const dti = {
            organizationId,
            overallScore: Math.round(overallDTI),
            components,
            percentile: await BenchmarkingService.calculatePercentile(orgData.industry, overallDTI),
            tier: BenchmarkingService.getDTITier(overallDTI),
            calculatedAt: new Date().toISOString()
        };

        // Store DTI calculation
        await BenchmarkingService.storeDTI(organizationId, dti);

        return dti;
    },

    /**
     * Get organization data for benchmarking
     */
    getOrganizationData: async (organizationId) => {
        return new Promise((resolve) => {
            db.get(`
                SELECT o.*, 
                    (SELECT COUNT(*) FROM projects WHERE organization_id = o.id) as project_count,
                    (SELECT AVG(progress) FROM projects WHERE organization_id = o.id) as avg_project_progress
                FROM organizations o
                WHERE o.id = ?
            `, [organizationId], (err, row) => {
                resolve(row);
            });
        });
    },

    // Assessment functions (simplified - would be more comprehensive in production)
    assessStrategyVision: async (orgData) => {
        // Score based on available indicators
        let score = 50; // Base score
        if (orgData.project_count > 5) score += 20;
        if (orgData.avg_project_progress > 50) score += 15;
        return Math.min(score, 100);
    },

    assessDigitalCapabilities: async (orgData) => {
        let score = 50;
        if (orgData.project_count > 10) score += 25;
        return Math.min(score, 100);
    },

    assessDataAnalytics: async (orgData) => {
        return 55; // Placeholder
    },

    assessOperationalExcellence: async (orgData) => {
        let score = 50;
        if (orgData.avg_project_progress > 60) score += 20;
        return Math.min(score, 100);
    },

    assessCustomerExperience: async (orgData) => {
        return 60; // Placeholder
    },

    assessCultureInnovation: async (orgData) => {
        return 55; // Placeholder
    },

    /**
     * Calculate percentile ranking
     */
    calculatePercentile: async (industry, score) => {
        return new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as lower_count
                FROM dti_scores
                WHERE industry = ? AND overall_score < ?
            `, [industry, score], (err, row) => {
                if (err || !row) return resolve(50);
                
                db.get(`
                    SELECT COUNT(*) as total
                    FROM dti_scores
                    WHERE industry = ?
                `, [industry], (err, totalRow) => {
                    if (!totalRow || totalRow.total === 0) return resolve(50);
                    resolve(Math.round((row.lower_count / totalRow.total) * 100));
                });
            });
        });
    },

    /**
     * Get DTI tier
     */
    getDTITier: (score) => {
        if (score >= 80) return { tier: 'Leader', description: 'Digital transformation leader' };
        if (score >= 60) return { tier: 'Advancer', description: 'Making significant digital progress' };
        if (score >= 40) return { tier: 'Explorer', description: 'Building digital foundations' };
        return { tier: 'Beginner', description: 'Starting digital journey' };
    },

    /**
     * Store DTI calculation
     */
    storeDTI: async (organizationId, dti) => {
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO dti_scores (id, organization_id, overall_score, components, percentile, tier, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                uuidv4(),
                organizationId,
                dti.overallScore,
                JSON.stringify(dti.components),
                dti.percentile,
                dti.tier.tier
            ], resolve);
        });
    },

    /**
     * Get industry benchmarks
     */
    getIndustryBenchmarks: async (industry, segment = null) => {
        return new Promise((resolve) => {
            let sql = `
                SELECT 
                    AVG(overall_score) as avg_dti,
                    MIN(overall_score) as min_dti,
                    MAX(overall_score) as max_dti,
                    COUNT(*) as sample_size
                FROM dti_scores ds
                JOIN organizations o ON ds.organization_id = o.id
                WHERE o.industry = ?
            `;
            const params = [industry];

            db.get(sql, params, (err, row) => {
                if (err || !row || row.sample_size === 0) {
                    // Return default benchmarks
                    return resolve({
                        industry,
                        avgDTI: 55,
                        minDTI: 25,
                        maxDTI: 85,
                        sampleSize: 0,
                        isDefault: true
                    });
                }

                resolve({
                    industry,
                    avgDTI: Math.round(row.avg_dti),
                    minDTI: Math.round(row.min_dti),
                    maxDTI: Math.round(row.max_dti),
                    sampleSize: row.sample_size,
                    isDefault: false
                });
            });
        });
    },

    /**
     * Get benchmark comparison
     */
    getBenchmarkComparison: async (organizationId) => {
        const dti = await BenchmarkingService.calculateDTI(organizationId);
        if (!dti) return null;

        const orgData = await BenchmarkingService.getOrganizationData(organizationId);
        const industryBenchmarks = await BenchmarkingService.getIndustryBenchmarks(orgData.industry);

        return {
            organization: {
                id: organizationId,
                score: dti.overallScore,
                components: dti.components,
                tier: dti.tier
            },
            industry: industryBenchmarks,
            comparison: {
                vsIndustryAvg: dti.overallScore - industryBenchmarks.avgDTI,
                percentile: dti.percentile,
                ranking: dti.overallScore >= industryBenchmarks.avgDTI ? 'Above Average' : 'Below Average'
            },
            recommendations: await BenchmarkingService.getImprovementRecommendations(dti, industryBenchmarks)
        };
    },

    /**
     * Get improvement recommendations
     */
    getImprovementRecommendations: async (dti, benchmarks) => {
        const recommendations = [];
        const { components } = dti;

        // Find weakest components
        const componentScores = Object.entries(components)
            .map(([name, score]) => ({ name, score }))
            .sort((a, b) => a.score - b.score);

        const weakest = componentScores.slice(0, 2);

        for (const weak of weakest) {
            recommendations.push({
                area: weak.name,
                currentScore: weak.score,
                targetScore: Math.min(weak.score + 20, 100),
                priority: weak.score < 40 ? 'high' : 'medium',
                actions: BenchmarkingService.getActionsForComponent(weak.name)
            });
        }

        return recommendations;
    },

    /**
     * Get improvement actions for component
     */
    getActionsForComponent: (componentName) => {
        const actionMap = {
            strategyVision: [
                'Develop comprehensive digital transformation roadmap',
                'Align digital initiatives with business strategy',
                'Establish digital governance framework'
            ],
            digitalCapabilities: [
                'Invest in cloud infrastructure',
                'Build API and integration capabilities',
                'Modernize legacy systems'
            ],
            dataAnalytics: [
                'Implement enterprise data platform',
                'Develop analytics competency center',
                'Deploy AI/ML capabilities'
            ],
            operationalExcellence: [
                'Automate key business processes',
                'Implement DevOps practices',
                'Optimize operational workflows'
            ],
            customerExperience: [
                'Develop omnichannel customer platform',
                'Implement personalization capabilities',
                'Create unified customer view'
            ],
            cultureInnovation: [
                'Foster digital-first mindset',
                'Establish innovation programs',
                'Invest in digital skills training'
            ]
        };

        return actionMap[componentName] || ['Develop improvement plan'];
    },

    /**
     * Submit anonymous benchmark data
     */
    submitBenchmarkData: async (data) => {
        const benchmarkId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO benchmark_submissions (
                    id, industry, size_segment, region, scores, metrics, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                benchmarkId,
                data.industry,
                data.sizeSegment,
                data.region,
                JSON.stringify(data.scores || {}),
                JSON.stringify(data.metrics || {})
            ], function(err) {
                if (err) return reject(err);
                resolve({ id: benchmarkId, success: true });
            });
        });
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS dti_scores (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        overall_score INTEGER,
                        components TEXT,
                        percentile INTEGER,
                        tier TEXT,
                        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS benchmark_submissions (
                        id TEXT PRIMARY KEY,
                        industry TEXT,
                        size_segment TEXT,
                        region TEXT,
                        scores TEXT,
                        metrics TEXT,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                db.run(`CREATE INDEX IF NOT EXISTS idx_dti_org ON dti_scores(organization_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_bench_industry ON benchmark_submissions(industry)`);

                resolve();
            });
        });
    }
};

export default BenchmarkingService;
