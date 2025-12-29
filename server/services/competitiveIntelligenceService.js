/**
 * Competitive Intelligence Service
 * 
 * Provides market and competitive insights including:
 * - Industry trend monitoring
 * - Competitor analysis
 * - Market positioning
 * - Technology radar
 * - Benchmark comparisons
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Trend categories
const TREND_CATEGORIES = {
    TECHNOLOGY: 'technology',
    METHODOLOGY: 'methodology',
    MARKET: 'market',
    REGULATORY: 'regulatory',
    TALENT: 'talent',
    CUSTOMER: 'customer'
};

// Trend maturity levels
const TREND_MATURITY = {
    EMERGING: 'emerging',       // Early stage, high uncertainty
    GROWING: 'growing',         // Gaining traction
    MAINSTREAM: 'mainstream',   // Widely adopted
    DECLINING: 'declining'      // Past peak
};

// Impact levels
const IMPACT_LEVELS = {
    TRANSFORMATIONAL: 'transformational',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

const CompetitiveIntelligenceService = {
    TREND_CATEGORIES,
    TREND_MATURITY,
    IMPACT_LEVELS,

    /**
     * Get market trends for an industry
     */
    getIndustryTrends: async (industry, options = {}) => {
        const { limit = 10, category, maturity } = options;

        // Get stored trends
        const storedTrends = await CompetitiveIntelligenceService.getStoredTrends(industry, options);

        // Enrich with analysis if needed
        if (storedTrends.length < 5) {
            await CompetitiveIntelligenceService.generateIndustryTrends(industry);
            return CompetitiveIntelligenceService.getStoredTrends(industry, options);
        }

        return storedTrends;
    },

    /**
     * Get stored trends from database
     */
    getStoredTrends: async (industry, options = {}) => {
        const { limit = 10, category, maturity } = options;

        return new Promise((resolve) => {
            let sql = `SELECT * FROM market_trends WHERE 1=1`;
            const params = [];

            if (industry) {
                sql += ` AND (industry = ? OR industry = 'global')`;
                params.push(industry);
            }

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (maturity) {
                sql += ` AND maturity = ?`;
                params.push(maturity);
            }

            sql += ` ORDER BY relevance_score DESC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) return resolve([]);
                resolve((rows || []).map(r => ({
                    ...r,
                    insights: JSON.parse(r.insights || '[]'),
                    sources: JSON.parse(r.sources || '[]')
                })));
            });
        });
    },

    /**
     * Generate trends for an industry (seed data)
     */
    generateIndustryTrends: async (industry) => {
        // Default trends applicable to most industries
        const globalTrends = [
            {
                name: 'Generative AI Adoption',
                category: TREND_CATEGORIES.TECHNOLOGY,
                maturity: TREND_MATURITY.GROWING,
                impact: IMPACT_LEVELS.TRANSFORMATIONAL,
                description: 'Rapid adoption of generative AI tools for content creation, coding assistance, and process automation.',
                relevanceScore: 95,
                insights: [
                    '40% of enterprises experimenting with GenAI',
                    'Expected to impact 300M+ jobs globally',
                    'Key use cases: content, code, customer service'
                ]
            },
            {
                name: 'Sustainable Digital Transformation',
                category: TREND_CATEGORIES.MARKET,
                maturity: TREND_MATURITY.MAINSTREAM,
                impact: IMPACT_LEVELS.HIGH,
                description: 'Integration of sustainability goals into digital transformation initiatives.',
                relevanceScore: 85,
                insights: [
                    'ESG considerations in technology decisions',
                    'Green IT becoming competitive advantage',
                    'Carbon footprint tracking in supply chains'
                ]
            },
            {
                name: 'Data Mesh Architecture',
                category: TREND_CATEGORIES.TECHNOLOGY,
                maturity: TREND_MATURITY.GROWING,
                impact: IMPACT_LEVELS.HIGH,
                description: 'Decentralized data architecture for scalable data management.',
                relevanceScore: 75,
                insights: [
                    'Domain-oriented data ownership',
                    'Self-serve data infrastructure',
                    'Alternative to centralized data lakes'
                ]
            },
            {
                name: 'Composable Enterprise',
                category: TREND_CATEGORIES.METHODOLOGY,
                maturity: TREND_MATURITY.EMERGING,
                impact: IMPACT_LEVELS.HIGH,
                description: 'Building organizations from interchangeable business capabilities.',
                relevanceScore: 70,
                insights: [
                    'Modular business architecture',
                    'API-first strategies',
                    'Packaged business capabilities (PBCs)'
                ]
            },
            {
                name: 'Cybersecurity Mesh',
                category: TREND_CATEGORIES.TECHNOLOGY,
                maturity: TREND_MATURITY.GROWING,
                impact: IMPACT_LEVELS.HIGH,
                description: 'Distributed security approach for hybrid and multi-cloud environments.',
                relevanceScore: 80,
                insights: [
                    'Zero-trust architecture adoption',
                    'Identity-first security',
                    'Response to remote work expansion'
                ]
            },
            {
                name: 'Talent Experience Platforms',
                category: TREND_CATEGORIES.TALENT,
                maturity: TREND_MATURITY.GROWING,
                impact: IMPACT_LEVELS.MEDIUM,
                description: 'Integrated platforms for employee experience and development.',
                relevanceScore: 65,
                insights: [
                    'Skills-based organizations emerging',
                    'Internal talent marketplaces',
                    'AI-driven learning paths'
                ]
            },
            {
                name: 'Hyperautomation',
                category: TREND_CATEGORIES.TECHNOLOGY,
                maturity: TREND_MATURITY.MAINSTREAM,
                impact: IMPACT_LEVELS.HIGH,
                description: 'End-to-end automation using multiple technologies (RPA, AI, ML).',
                relevanceScore: 85,
                insights: [
                    'Process mining driving automation discovery',
                    'Low-code/no-code platforms accelerating adoption',
                    '25%+ cost reduction in mature implementations'
                ]
            },
            {
                name: 'Industry Cloud Platforms',
                category: TREND_CATEGORIES.TECHNOLOGY,
                maturity: TREND_MATURITY.GROWING,
                impact: IMPACT_LEVELS.HIGH,
                description: 'Vertical-specific cloud solutions with pre-built industry capabilities.',
                relevanceScore: 75,
                insights: [
                    'Faster time-to-value for industry solutions',
                    'Pre-configured compliance',
                    'Major cloud vendors expanding industry offerings'
                ]
            }
        ];

        // Industry-specific additions
        const industryTrends = {
            'Manufacturing': [
                {
                    name: 'Smart Factory / Industry 4.0',
                    category: TREND_CATEGORIES.TECHNOLOGY,
                    maturity: TREND_MATURITY.MAINSTREAM,
                    impact: IMPACT_LEVELS.TRANSFORMATIONAL,
                    description: 'Connected, intelligent manufacturing with IoT, AI, and digital twins.',
                    relevanceScore: 95,
                    insights: [
                        'Digital twin adoption accelerating',
                        'Predictive maintenance reducing downtime by 30%+',
                        'Supply chain visibility critical post-pandemic'
                    ]
                }
            ],
            'Financial Services': [
                {
                    name: 'Embedded Finance',
                    category: TREND_CATEGORIES.MARKET,
                    maturity: TREND_MATURITY.GROWING,
                    impact: IMPACT_LEVELS.TRANSFORMATIONAL,
                    description: 'Financial services integrated into non-financial platforms.',
                    relevanceScore: 90,
                    insights: [
                        'Banking-as-a-Service (BaaS) growing rapidly',
                        'Non-banks becoming financial providers',
                        'API-driven financial infrastructure'
                    ]
                }
            ],
            'Healthcare': [
                {
                    name: 'Digital Health Ecosystems',
                    category: TREND_CATEGORIES.MARKET,
                    maturity: TREND_MATURITY.GROWING,
                    impact: IMPACT_LEVELS.TRANSFORMATIONAL,
                    description: 'Connected health platforms integrating care across providers.',
                    relevanceScore: 90,
                    insights: [
                        'Telehealth now standard offering',
                        'Patient data portability increasing',
                        'AI diagnostics gaining regulatory approval'
                    ]
                }
            ],
            'Retail': [
                {
                    name: 'Unified Commerce',
                    category: TREND_CATEGORIES.MARKET,
                    maturity: TREND_MATURITY.MAINSTREAM,
                    impact: IMPACT_LEVELS.HIGH,
                    description: 'Seamless customer experience across all channels and touchpoints.',
                    relevanceScore: 90,
                    insights: [
                        'Real-time inventory visibility essential',
                        'Buy online, pickup/return anywhere expectations',
                        'Personalization driving loyalty'
                    ]
                }
            ]
        };

        // Store trends
        const trendsToStore = [...globalTrends, ...(industryTrends[industry] || [])];

        for (const trend of trendsToStore) {
            await CompetitiveIntelligenceService.storeTrend({
                ...trend,
                industry: trend.category === TREND_CATEGORIES.MARKET ? industry : 'global'
            });
        }

        return trendsToStore.length;
    },

    /**
     * Store a trend
     */
    storeTrend: async (trend) => {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO market_trends (
                    id, name, category, maturity, impact, description,
                    industry, relevance_score, insights, sources, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                trend.id || uuidv4(),
                trend.name,
                trend.category,
                trend.maturity,
                trend.impact,
                trend.description,
                trend.industry || 'global',
                trend.relevanceScore || 50,
                JSON.stringify(trend.insights || []),
                JSON.stringify(trend.sources || [])
            ], function(err) {
                if (err) return reject(err);
                resolve(trend);
            });
        });
    },

    /**
     * Get technology radar data
     */
    getTechnologyRadar: async (industry = null) => {
        // Organize trends by maturity into radar format
        const trends = await CompetitiveIntelligenceService.getStoredTrends(industry, {
            category: TREND_CATEGORIES.TECHNOLOGY,
            limit: 50
        });

        const radar = {
            adopt: [],      // Ready for production
            trial: [],      // Worth pursuing
            assess: [],     // Worth exploring
            hold: []        // Proceed with caution
        };

        for (const trend of trends) {
            const item = {
                name: trend.name,
                description: trend.description,
                impact: trend.impact,
                relevanceScore: trend.relevance_score
            };

            switch (trend.maturity) {
                case TREND_MATURITY.MAINSTREAM:
                    radar.adopt.push(item);
                    break;
                case TREND_MATURITY.GROWING:
                    if (trend.relevance_score >= 80) radar.trial.push(item);
                    else radar.assess.push(item);
                    break;
                case TREND_MATURITY.EMERGING:
                    radar.assess.push(item);
                    break;
                case TREND_MATURITY.DECLINING:
                    radar.hold.push(item);
                    break;
            }
        }

        return radar;
    },

    /**
     * Compare organization maturity against industry benchmarks
     */
    getMaturityBenchmark: async (organizationId, assessmentData) => {
        // Get organization industry
        const org = await new Promise((resolve) => {
            db.get(`SELECT industry FROM organizations WHERE id = ?`, [organizationId], (err, row) => {
                resolve(row);
            });
        });

        const industry = org?.industry || 'Unknown';

        // Get industry benchmarks from patterns
        const benchmarks = await new Promise((resolve) => {
            db.all(`
                SELECT * FROM recognized_patterns
                WHERE industry = ? AND type = 'industry_benchmark'
            `, [industry], (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    attributes: JSON.parse(r.attributes || '{}')
                })));
            });
        });

        // Compare assessment data with benchmarks
        const comparison = {
            industry,
            organizationScore: assessmentData?.overallScore || 0,
            benchmarks: {},
            gaps: [],
            strengths: []
        };

        for (const benchmark of benchmarks) {
            if (benchmark.attributes) {
                comparison.benchmarks[benchmark.name] = benchmark.attributes;
            }
        }

        // Simple gap analysis
        if (assessmentData) {
            // This would compare actual assessment axes with industry benchmarks
            // Simplified implementation
            if (assessmentData.overallScore < 3) {
                comparison.gaps.push({
                    area: 'Overall Maturity',
                    description: 'Below industry average',
                    recommendation: 'Focus on foundational capabilities'
                });
            }
        }

        return comparison;
    },

    /**
     * Get competitive landscape summary
     */
    getCompetitiveLandscape: async (industry) => {
        const trends = await CompetitiveIntelligenceService.getStoredTrends(industry, { limit: 20 });
        const radar = await CompetitiveIntelligenceService.getTechnologyRadar(industry);

        return {
            industry,
            topTrends: trends.slice(0, 5),
            technologyRadar: {
                adoptCount: radar.adopt.length,
                trialCount: radar.trial.length,
                assessCount: radar.assess.length,
                holdCount: radar.hold.length
            },
            keyInsights: trends.slice(0, 3).flatMap(t => t.insights || []),
            lastUpdated: new Date().toISOString()
        };
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS market_trends (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    maturity TEXT NOT NULL,
                    impact TEXT,
                    description TEXT,
                    industry TEXT,
                    relevance_score INTEGER,
                    insights TEXT,
                    sources TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
                db.run(`CREATE INDEX IF NOT EXISTS idx_mt_industry ON market_trends(industry)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_mt_category ON market_trends(category)`);
                resolve();
            });
        });
    }
};

module.exports = CompetitiveIntelligenceService;

