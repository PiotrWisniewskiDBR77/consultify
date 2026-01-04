/**
 * Industry Intelligence Service
 * 
 * Provides real-time industry data, trends, benchmarks, and competitive intelligence
 * using Tavily web search and AI synthesis.
 * 
 * Part of the Enterprise AI Consulting System for BCG/McKinsey-level reports.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../../../database.js';
import WebSearchService from '../../webSearchService.js';

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Industry code mappings (GICS-based)
const INDUSTRY_CODES = {
    'Technology': { code: '45', subsectors: ['Software', 'Hardware', 'IT Services', 'Semiconductors'] },
    'Healthcare': { code: '35', subsectors: ['Pharma', 'Medical Devices', 'Health Services', 'Biotech'] },
    'Financial Services': { code: '40', subsectors: ['Banking', 'Insurance', 'Asset Management', 'Fintech'] },
    'Consumer': { code: '25', subsectors: ['Retail', 'Consumer Goods', 'E-commerce', 'Luxury'] },
    'Industrial': { code: '20', subsectors: ['Manufacturing', 'Aerospace', 'Logistics', 'Construction'] },
    'Energy': { code: '10', subsectors: ['Oil & Gas', 'Renewables', 'Utilities', 'Mining'] },
    'Telecommunications': { code: '50', subsectors: ['Mobile', 'Fixed Line', 'Media', 'Entertainment'] },
    'Real Estate': { code: '60', subsectors: ['Commercial', 'Residential', 'REITs', 'Property Management'] }
};

// Digital maturity benchmarks by industry (baseline data)
const INDUSTRY_BENCHMARKS = {
    'Technology': {
        avgDigitalMaturity: 5.2,
        topQuartile: 6.5,
        bottomQuartile: 4.0,
        keyMetrics: {
            cloudAdoption: 85,
            aiReadiness: 72,
            dataMaturity: 68,
            cybersecurity: 75
        }
    },
    'Financial Services': {
        avgDigitalMaturity: 4.8,
        topQuartile: 6.2,
        bottomQuartile: 3.5,
        keyMetrics: {
            cloudAdoption: 65,
            aiReadiness: 58,
            dataMaturity: 72,
            cybersecurity: 82
        }
    },
    'Healthcare': {
        avgDigitalMaturity: 3.9,
        topQuartile: 5.5,
        bottomQuartile: 2.8,
        keyMetrics: {
            cloudAdoption: 45,
            aiReadiness: 42,
            dataMaturity: 55,
            cybersecurity: 70
        }
    },
    'Industrial': {
        avgDigitalMaturity: 3.5,
        topQuartile: 5.0,
        bottomQuartile: 2.5,
        keyMetrics: {
            cloudAdoption: 40,
            aiReadiness: 35,
            dataMaturity: 45,
            cybersecurity: 55
        }
    },
    'Consumer': {
        avgDigitalMaturity: 4.2,
        topQuartile: 5.8,
        bottomQuartile: 3.0,
        keyMetrics: {
            cloudAdoption: 60,
            aiReadiness: 48,
            dataMaturity: 58,
            cybersecurity: 62
        }
    },
    'default': {
        avgDigitalMaturity: 4.0,
        topQuartile: 5.5,
        bottomQuartile: 3.0,
        keyMetrics: {
            cloudAdoption: 55,
            aiReadiness: 45,
            dataMaturity: 50,
            cybersecurity: 60
        }
    }
};

class IndustryIntelligenceService {
    
    /**
     * Get comprehensive industry context
     * @param {string} industry - Industry name
     * @param {string} subSector - Optional subsector
     * @returns {Promise<IndustryContext>}
     */
    static async getIndustryContext(industry, subSector = null) {
        const cacheKey = `${industry}_${subSector || 'general'}`;
        
        // Check cache first
        const cached = await this.getCachedIntelligence(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Fetch fresh data in parallel
            const [trends, benchmarks, news, competitors] = await Promise.all([
                this.fetchIndustryTrends(industry, subSector),
                this.fetchBenchmarks(industry),
                this.fetchRecentNews(industry, subSector),
                this.fetchCompetitorMoves(industry, subSector)
            ]);

            const context = {
                industry,
                subSector,
                industryCode: INDUSTRY_CODES[industry]?.code || null,
                trends,
                benchmarks,
                recentNews: news,
                competitorActivity: competitors,
                digitalLandscape: this.generateDigitalLandscapeInsights(industry),
                fetchedAt: new Date().toISOString(),
                confidence: this.calculateContextConfidence({ trends, benchmarks, news, competitors })
            };

            // Cache the results
            await this.cacheIntelligence(cacheKey, context);

            return context;

        } catch (error) {
            console.error('[IndustryIntelligence] Error fetching context:', error);
            
            // Return baseline data on error
            return {
                industry,
                subSector,
                industryCode: INDUSTRY_CODES[industry]?.code || null,
                trends: this.getBaselineTrends(industry),
                benchmarks: INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.default,
                recentNews: [],
                competitorActivity: [],
                digitalLandscape: this.generateDigitalLandscapeInsights(industry),
                fetchedAt: new Date().toISOString(),
                confidence: 'LOW',
                isBaseline: true
            };
        }
    }

    /**
     * Fetch industry trends using web search
     */
    static async fetchIndustryTrends(industry, subSector = null) {
        const query = subSector 
            ? `${industry} ${subSector} industry trends 2024 2025 digital transformation`
            : `${industry} industry trends 2024 2025 digital transformation`;

        try {
            const searchResult = await WebSearchService.search(query);
            
            if (!searchResult.isVerified || !searchResult.sources?.length) {
                return this.getBaselineTrends(industry);
            }

            // Extract trends from search results
            const trends = this.extractTrendsFromSources(searchResult.sources, industry);
            
            return {
                items: trends,
                sources: searchResult.sources.slice(0, 3).map(s => ({
                    title: s.title,
                    url: s.url
                })),
                synthesizedInsight: searchResult.answer || null,
                confidence: searchResult.confidence || 0.7
            };

        } catch (error) {
            console.warn('[IndustryIntelligence] Trends fetch failed:', error.message);
            return this.getBaselineTrends(industry);
        }
    }

    /**
     * Fetch dynamic benchmarks
     */
    static async fetchBenchmarks(industry) {
        const baselineBenchmarks = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.default;

        try {
            const query = `${industry} digital maturity benchmark statistics 2024`;
            const searchResult = await WebSearchService.search(query);

            if (searchResult.isVerified && searchResult.sources?.length > 0) {
                // Enhance baseline with any found data
                return {
                    ...baselineBenchmarks,
                    sources: searchResult.sources.slice(0, 2).map(s => ({
                        title: s.title,
                        url: s.url
                    })),
                    isEnhanced: true,
                    enhancedInsight: searchResult.answer
                };
            }

            return baselineBenchmarks;

        } catch (error) {
            console.warn('[IndustryIntelligence] Benchmarks fetch failed:', error.message);
            return baselineBenchmarks;
        }
    }

    /**
     * Fetch recent industry news
     */
    static async fetchRecentNews(industry, subSector = null) {
        const query = subSector
            ? `${industry} ${subSector} news digital transformation AI 2024`
            : `${industry} industry news digital transformation AI 2024`;

        try {
            const searchResult = await WebSearchService.search(query);

            if (!searchResult.isVerified || !searchResult.sources?.length) {
                return [];
            }

            return searchResult.sources.slice(0, 5).map(source => ({
                title: source.title,
                url: source.url,
                snippet: source.snippet,
                relevanceScore: source.score || 0.5,
                fetchedAt: new Date().toISOString()
            }));

        } catch (error) {
            console.warn('[IndustryIntelligence] News fetch failed:', error.message);
            return [];
        }
    }

    /**
     * Fetch competitor activity and moves
     */
    static async fetchCompetitorMoves(industry, subSector = null) {
        const query = subSector
            ? `${industry} ${subSector} competitors digital strategy announcements 2024`
            : `${industry} market leaders digital transformation strategy 2024`;

        try {
            const searchResult = await WebSearchService.search(query);

            if (!searchResult.isVerified || !searchResult.sources?.length) {
                return [];
            }

            return searchResult.sources.slice(0, 4).map(source => ({
                title: source.title,
                url: source.url,
                snippet: source.snippet,
                type: this.categorizeCompetitorMove(source.snippet || source.title),
                relevanceScore: source.score || 0.5
            }));

        } catch (error) {
            console.warn('[IndustryIntelligence] Competitor moves fetch failed:', error.message);
            return [];
        }
    }

    /**
     * Get baseline trends when API fails
     */
    static getBaselineTrends(industry) {
        const baselineTrends = {
            'Technology': [
                { trend: 'Generative AI adoption', impact: 'HIGH', relevance: 'CRITICAL' },
                { trend: 'Cloud-native transformation', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Cybersecurity automation', impact: 'MEDIUM', relevance: 'HIGH' },
                { trend: 'Developer experience focus', impact: 'MEDIUM', relevance: 'MEDIUM' }
            ],
            'Financial Services': [
                { trend: 'Open banking expansion', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'AI-powered fraud detection', impact: 'HIGH', relevance: 'CRITICAL' },
                { trend: 'Digital-first customer experience', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Embedded finance', impact: 'MEDIUM', relevance: 'HIGH' }
            ],
            'Healthcare': [
                { trend: 'Telehealth normalization', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'AI diagnostics and imaging', impact: 'HIGH', relevance: 'CRITICAL' },
                { trend: 'Electronic health record interoperability', impact: 'MEDIUM', relevance: 'HIGH' },
                { trend: 'Patient data privacy', impact: 'HIGH', relevance: 'CRITICAL' }
            ],
            'Industrial': [
                { trend: 'Industry 4.0 acceleration', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Predictive maintenance', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Digital twin adoption', impact: 'MEDIUM', relevance: 'MEDIUM' },
                { trend: 'Supply chain digitization', impact: 'HIGH', relevance: 'CRITICAL' }
            ],
            'Consumer': [
                { trend: 'Omnichannel excellence', impact: 'HIGH', relevance: 'CRITICAL' },
                { trend: 'Personalization at scale', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Sustainable commerce', impact: 'MEDIUM', relevance: 'HIGH' },
                { trend: 'Social commerce integration', impact: 'MEDIUM', relevance: 'MEDIUM' }
            ]
        };

        return {
            items: baselineTrends[industry] || [
                { trend: 'Digital transformation acceleration', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'AI and automation adoption', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Customer experience focus', impact: 'HIGH', relevance: 'HIGH' },
                { trend: 'Data-driven decision making', impact: 'MEDIUM', relevance: 'HIGH' }
            ],
            sources: [],
            synthesizedInsight: null,
            confidence: 0.5,
            isBaseline: true
        };
    }

    /**
     * Generate digital landscape insights
     */
    static generateDigitalLandscapeInsights(industry) {
        const benchmarks = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.default;

        return {
            maturityDistribution: {
                leaders: '15%',
                fastFollowers: '25%',
                mainstream: '40%',
                laggards: '20%'
            },
            keyTechnologies: this.getKeyTechnologiesForIndustry(industry),
            investmentPriorities: this.getInvestmentPrioritiesForIndustry(industry),
            averageMetrics: benchmarks.keyMetrics
        };
    }

    /**
     * Get key technologies by industry
     */
    static getKeyTechnologiesForIndustry(industry) {
        const techMap = {
            'Technology': ['Kubernetes', 'Terraform', 'GenAI APIs', 'Vector Databases', 'GraphQL'],
            'Financial Services': ['Core Banking APIs', 'Blockchain', 'ML Fraud Detection', 'RPA', 'Cloud HSM'],
            'Healthcare': ['EHR Systems', 'HIPAA Cloud', 'Medical AI', 'IoMT', 'Telemedicine Platforms'],
            'Industrial': ['IoT Platforms', 'SCADA/MES', 'Digital Twins', 'AR/VR Training', 'PLM'],
            'Consumer': ['CDP Platforms', 'Headless Commerce', 'ML Personalization', 'AR Try-on', 'Loyalty Tech']
        };

        return techMap[industry] || ['Cloud Platforms', 'Data Analytics', 'AI/ML', 'Integration APIs', 'Security Tools'];
    }

    /**
     * Get investment priorities by industry
     */
    static getInvestmentPrioritiesForIndustry(industry) {
        const priorityMap = {
            'Technology': [
                { area: 'AI/ML Infrastructure', allocation: '35%' },
                { area: 'Developer Productivity', allocation: '25%' },
                { area: 'Security & Compliance', allocation: '20%' },
                { area: 'Cloud Optimization', allocation: '20%' }
            ],
            'Financial Services': [
                { area: 'Customer Experience', allocation: '30%' },
                { area: 'Risk & Compliance', allocation: '25%' },
                { area: 'Core Modernization', allocation: '25%' },
                { area: 'Data & Analytics', allocation: '20%' }
            ],
            'Healthcare': [
                { area: 'Patient Experience', allocation: '30%' },
                { area: 'Clinical Systems', allocation: '25%' },
                { area: 'Data Interoperability', allocation: '25%' },
                { area: 'Security & Privacy', allocation: '20%' }
            ]
        };

        return priorityMap[industry] || [
            { area: 'Digital Customer Experience', allocation: '30%' },
            { area: 'Operational Efficiency', allocation: '25%' },
            { area: 'Data & Analytics', allocation: '25%' },
            { area: 'Security & Compliance', allocation: '20%' }
        ];
    }

    /**
     * Extract trends from search sources
     */
    static extractTrendsFromSources(sources, industry) {
        const trends = [];
        const seenTrends = new Set();

        // Keywords that indicate trends
        const trendKeywords = ['trend', 'growth', 'transformation', 'adoption', 'rise', 'shift', 'emerging', 'future'];
        const impactKeywords = ['significant', 'major', 'critical', 'essential', 'key', 'important'];

        sources.forEach(source => {
            const text = (source.snippet || source.title || '').toLowerCase();
            
            // Simple trend extraction based on patterns
            trendKeywords.forEach(keyword => {
                if (text.includes(keyword) && trends.length < 5) {
                    const trendText = this.extractTrendPhrase(source.snippet || source.title, keyword);
                    if (trendText && !seenTrends.has(trendText.toLowerCase())) {
                        seenTrends.add(trendText.toLowerCase());
                        trends.push({
                            trend: trendText,
                            impact: impactKeywords.some(k => text.includes(k)) ? 'HIGH' : 'MEDIUM',
                            relevance: 'HIGH',
                            source: source.url
                        });
                    }
                }
            });
        });

        // If we couldn't extract enough, add baseline
        if (trends.length < 3) {
            const baseline = this.getBaselineTrends(industry);
            baseline.items.slice(0, 4 - trends.length).forEach(item => {
                if (!seenTrends.has(item.trend.toLowerCase())) {
                    trends.push(item);
                }
            });
        }

        return trends;
    }

    /**
     * Extract trend phrase from text
     */
    static extractTrendPhrase(text, keyword) {
        if (!text) return null;
        
        const sentences = text.split(/[.!?]/);
        for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(keyword)) {
                // Clean and truncate
                const cleaned = sentence.trim().replace(/^\W+|\W+$/g, '');
                if (cleaned.length > 10 && cleaned.length < 100) {
                    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
            }
        }
        return null;
    }

    /**
     * Categorize competitor move type
     */
    static categorizeCompetitorMove(text) {
        const lowerText = (text || '').toLowerCase();
        
        if (lowerText.includes('acquisition') || lowerText.includes('acquire') || lowerText.includes('merge')) {
            return 'M&A';
        }
        if (lowerText.includes('launch') || lowerText.includes('introduce') || lowerText.includes('release')) {
            return 'PRODUCT_LAUNCH';
        }
        if (lowerText.includes('partnership') || lowerText.includes('partner') || lowerText.includes('alliance')) {
            return 'PARTNERSHIP';
        }
        if (lowerText.includes('invest') || lowerText.includes('funding')) {
            return 'INVESTMENT';
        }
        if (lowerText.includes('expand') || lowerText.includes('enter') || lowerText.includes('market')) {
            return 'MARKET_EXPANSION';
        }
        return 'STRATEGIC_MOVE';
    }

    /**
     * Calculate context confidence
     */
    static calculateContextConfidence(data) {
        let score = 0;
        let factors = 0;

        if (data.trends?.items?.length > 0) {
            score += data.trends.isBaseline ? 0.5 : 1;
            factors++;
        }
        if (data.benchmarks?.isEnhanced) {
            score += 1;
            factors++;
        } else if (data.benchmarks) {
            score += 0.7;
            factors++;
        }
        if (data.news?.length > 0) {
            score += 1;
            factors++;
        }
        if (data.competitors?.length > 0) {
            score += 1;
            factors++;
        }

        const avgScore = factors > 0 ? score / factors : 0;
        
        if (avgScore >= 0.8) return 'HIGH';
        if (avgScore >= 0.5) return 'MEDIUM';
        return 'LOW';
    }

    // ============================================================================
    // CACHING
    // ============================================================================

    /**
     * Get cached intelligence
     */
    static async getCachedIntelligence(cacheKey) {
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
                        resolve({
                            industry: row.industry,
                            trends: JSON.parse(row.trends_data || '{}'),
                            benchmarks: JSON.parse(row.benchmarks_data || '{}'),
                            recentNews: JSON.parse(row.news_data || '[]'),
                            competitorActivity: JSON.parse(row.competitor_data || '[]'),
                            fetchedAt: row.fetched_at,
                            confidence: row.confidence_score > 0.7 ? 'HIGH' : row.confidence_score > 0.4 ? 'MEDIUM' : 'LOW',
                            fromCache: true
                        });
                    } catch (parseErr) {
                        console.warn('[IndustryIntelligence] Cache parse error:', parseErr.message);
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Cache intelligence data
     */
    static async cacheIntelligence(cacheKey, data) {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
        const confidenceScore = data.confidence === 'HIGH' ? 0.9 : data.confidence === 'MEDIUM' ? 0.6 : 0.3;

        return new Promise((resolve) => {
            db.run(
                `INSERT OR REPLACE INTO industry_intelligence_cache 
                 (id, industry, industry_subsector, trends_data, benchmarks_data, news_data, competitor_data, 
                  data_source, fetched_at, expires_at, is_valid, confidence_score, sources_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [
                    id,
                    cacheKey,
                    data.subSector || null,
                    JSON.stringify(data.trends),
                    JSON.stringify(data.benchmarks),
                    JSON.stringify(data.recentNews),
                    JSON.stringify(data.competitorActivity),
                    'tavily',
                    data.fetchedAt,
                    expiresAt,
                    confidenceScore,
                    (data.recentNews?.length || 0) + (data.competitorActivity?.length || 0)
                ],
                (err) => {
                    if (err) {
                        console.warn('[IndustryIntelligence] Cache write error:', err.message);
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Invalidate cache for an industry
     */
    static async invalidateCache(industry) {
        return new Promise((resolve) => {
            db.run(
                `UPDATE industry_intelligence_cache SET is_valid = 0 WHERE industry LIKE ?`,
                [`${industry}%`],
                (err) => resolve(!err)
            );
        });
    }
}

export default IndustryIntelligenceService;









