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

import { v4 as uuidv4 } from 'uuid';
import * as DbPromise from '../utils/DbPromise.js';

export const TREND_CATEGORIES = {
    TECHNOLOGY: 'technology',
    METHODOLOGY: 'methodology',
    MARKET: 'market',
    REGULATORY: 'regulatory',
    TALENT: 'talent',
    CUSTOMER: 'customer'
} as const;

export const TREND_MATURITY = {
    EMERGING: 'emerging',
    GROWING: 'growing',
    MAINSTREAM: 'mainstream',
    DECLINING: 'declining'
} as const;

export const IMPACT_LEVELS = {
    TRANSFORMATIONAL: 'transformational',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
} as const;

type TrendCategory = typeof TREND_CATEGORIES[keyof typeof TREND_CATEGORIES];
type TrendMaturity = typeof TREND_MATURITY[keyof typeof TREND_MATURITY];
type ImpactLevel = typeof IMPACT_LEVELS[keyof typeof IMPACT_LEVELS];

type TrendRecord = {
    id?: string;
    name: string;
    category: TrendCategory;
    maturity: TrendMaturity;
    impact: ImpactLevel;
    description: string;
    industry?: string;
    relevanceScore?: number;
    insights?: string[];
    sources?: string[];
};

type StoredTrendRow = {
    id: string;
    name: string;
    category: string;
    maturity: string;
    impact: string | null;
    description: string | null;
    industry: string | null;
    relevance_score: number | null;
    insights: string | null;
    sources: string | null;
};

type StoredTrend = Omit<StoredTrendRow, 'insights' | 'sources'> & {
    insights: string[];
    sources: string[];
};

type TrendOptions = {
    limit?: number;
    category?: TrendCategory;
    maturity?: TrendMaturity;
};

type BenchmarkRow = {
    name: string;
    attributes?: string | null;
};

type AssessmentData = {
    overallScore?: number;
};

const parseJsonArray = (value: string | null | undefined): string[] => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const parseJsonObject = (value: string | null | undefined): Record<string, unknown> => {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const CompetitiveIntelligenceService = {
    TREND_CATEGORIES,
    TREND_MATURITY,
    IMPACT_LEVELS,

    getIndustryTrends: async (industry: string | null, options: TrendOptions = {}): Promise<StoredTrend[]> => {
        const storedTrends = await CompetitiveIntelligenceService.getStoredTrends(industry, options);

        if (storedTrends.length < 5) {
            await CompetitiveIntelligenceService.generateIndustryTrends(industry || 'global');
            return CompetitiveIntelligenceService.getStoredTrends(industry, options);
        }

        return storedTrends;
    },

    getStoredTrends: async (industry: string | null, options: TrendOptions = {}): Promise<StoredTrend[]> => {
        const { limit = 10, category, maturity } = options;
        let sql = 'SELECT * FROM market_trends WHERE 1=1';
        const params: Array<string | number> = [];

        if (industry) {
            sql += ' AND (industry = ? OR industry = \'global\')';
            params.push(industry);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (maturity) {
            sql += ' AND maturity = ?';
            params.push(maturity);
        }

        sql += ' ORDER BY relevance_score DESC LIMIT ?';
        params.push(limit);

        const rows = await DbPromise.all<StoredTrendRow>(sql, params);
        return (rows || []).map((row) => ({
            ...row,
            insights: parseJsonArray(row.insights),
            sources: parseJsonArray(row.sources)
        }));
    },

    generateIndustryTrends: async (industry: string): Promise<number> => {
        const globalTrends: TrendRecord[] = [
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

        const industryTrends: Record<string, TrendRecord[]> = {
            Manufacturing: [
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
                        'Banking-as-a-service market growing 30%+ annually',
                        'Non-banks capturing financial margins',
                        'Regulatory frameworks evolving'
                    ]
                }
            ],
            Retail: [
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

        const trendsToStore = [...globalTrends, ...(industryTrends[industry] || [])];

        for (const trend of trendsToStore) {
            await CompetitiveIntelligenceService.storeTrend({
                ...trend,
                industry: trend.category === TREND_CATEGORIES.MARKET ? industry : 'global'
            });
        }

        return trendsToStore.length;
    },

    storeTrend: async (trend: TrendRecord): Promise<TrendRecord> => {
        await DbPromise.run(
            `
                INSERT OR REPLACE INTO market_trends (
                    id, name, category, maturity, impact, description,
                    industry, relevance_score, insights, sources, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [
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
            ],
            { fallback: false }
        );

        return trend;
    },

    getTechnologyRadar: async (industry: string | null = null): Promise<{
        adopt: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
        trial: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
        assess: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
        hold: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
    }> => {
        const trends = await CompetitiveIntelligenceService.getStoredTrends(industry, {
            category: TREND_CATEGORIES.TECHNOLOGY,
            limit: 50
        });

        const radar = {
            adopt: [],
            trial: [],
            assess: [],
            hold: []
        } as {
            adopt: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
            trial: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
            assess: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
            hold: Array<{ name: string; description: string | null; impact: string | null; relevanceScore: number | null }>;
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
                    if ((trend.relevance_score || 0) >= 80) radar.trial.push(item);
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

    getMaturityBenchmark: async (
        organizationId: string,
        assessmentData: AssessmentData
    ): Promise<{
        industry: string;
        organizationScore: number;
        benchmarks: Record<string, Record<string, unknown>>;
        gaps: Array<{ area: string; description: string; recommendation: string }>;
        strengths: Array<unknown>;
    }> => {
        const org = await DbPromise.get<{ industry?: string }>(
            'SELECT industry FROM organizations WHERE id = ?',
            [organizationId]
        );

        const industry = org?.industry || 'Unknown';

        const benchmarks = await DbPromise.all<BenchmarkRow>(
            `
                SELECT * FROM recognized_patterns
                WHERE industry = ? AND type = 'industry_benchmark'
            `,
            [industry]
        );

        const comparison = {
            industry,
            organizationScore: assessmentData?.overallScore || 0,
            benchmarks: {} as Record<string, Record<string, unknown>>,
            gaps: [] as Array<{ area: string; description: string; recommendation: string }>,
            strengths: [] as Array<unknown>
        };

        for (const benchmark of benchmarks) {
            const attributes = parseJsonObject(benchmark.attributes);
            if (benchmark.name) {
                comparison.benchmarks[benchmark.name] = attributes;
            }
        }

        if (assessmentData?.overallScore !== undefined && assessmentData.overallScore < 3) {
            comparison.gaps.push({
                area: 'Overall Maturity',
                description: 'Below industry average',
                recommendation: 'Focus on foundational capabilities'
            });
        }

        return comparison;
    },

    getCompetitiveLandscape: async (industry: string): Promise<{
        industry: string;
        topTrends: StoredTrend[];
        technologyRadar: { adoptCount: number; trialCount: number; assessCount: number; holdCount: number };
        keyInsights: string[];
        lastUpdated: string;
    }> => {
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
            keyInsights: trends.slice(0, 3).flatMap((trend) => trend.insights || []),
            lastUpdated: new Date().toISOString()
        };
    },

    initialize: async (): Promise<void> => {
        await DbPromise.run(
            `
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
            `,
            [],
            { fallback: false }
        );
        await DbPromise.run('CREATE INDEX IF NOT EXISTS idx_mt_industry ON market_trends(industry)', [], { fallback: false });
        await DbPromise.run('CREATE INDEX IF NOT EXISTS idx_mt_category ON market_trends(category)', [], { fallback: false });
    }
};

export default CompetitiveIntelligenceService;
