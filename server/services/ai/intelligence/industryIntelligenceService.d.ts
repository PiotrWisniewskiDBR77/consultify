export default IndustryIntelligenceService;
declare class IndustryIntelligenceService {
    /**
     * Get comprehensive industry context
     * @param {string} industry - Industry name
     * @param {string} subSector - Optional subsector
     * @returns {Promise<IndustryContext>}
     */
    static getIndustryContext(industry: string, subSector?: string): Promise<IndustryContext>;
    /**
     * Fetch industry trends using web search
     */
    static fetchIndustryTrends(industry: any, subSector?: null): Promise<{
        items: any;
        sources: never[];
        synthesizedInsight: null;
        confidence: number;
        isBaseline: boolean;
    } | {
        items: any[];
        sources: any;
        synthesizedInsight: any;
        confidence: number;
    }>;
    /**
     * Fetch dynamic benchmarks
     */
    static fetchBenchmarks(industry: any): Promise<any>;
    /**
     * Fetch recent industry news
     */
    static fetchRecentNews(industry: any, subSector?: null): Promise<any>;
    /**
     * Fetch competitor activity and moves
     */
    static fetchCompetitorMoves(industry: any, subSector?: null): Promise<any>;
    /**
     * Get baseline trends when API fails
     */
    static getBaselineTrends(industry: any): {
        items: any;
        sources: never[];
        synthesizedInsight: null;
        confidence: number;
        isBaseline: boolean;
    };
    /**
     * Generate digital landscape insights
     */
    static generateDigitalLandscapeInsights(industry: any): {
        maturityDistribution: {
            leaders: string;
            fastFollowers: string;
            mainstream: string;
            laggards: string;
        };
        keyTechnologies: any;
        investmentPriorities: any;
        averageMetrics: any;
    };
    /**
     * Get key technologies by industry
     */
    static getKeyTechnologiesForIndustry(industry: any): any;
    /**
     * Get investment priorities by industry
     */
    static getInvestmentPrioritiesForIndustry(industry: any): any;
    /**
     * Extract trends from search sources
     */
    static extractTrendsFromSources(sources: any, industry: any): any[];
    /**
     * Extract trend phrase from text
     */
    static extractTrendPhrase(text: any, keyword: any): any;
    /**
     * Categorize competitor move type
     */
    static categorizeCompetitorMove(text: any): "M&A" | "PRODUCT_LAUNCH" | "PARTNERSHIP" | "INVESTMENT" | "MARKET_EXPANSION" | "STRATEGIC_MOVE";
    /**
     * Calculate context confidence
     */
    static calculateContextConfidence(data: any): "LOW" | "MEDIUM" | "HIGH";
    /**
     * Get cached intelligence
     */
    static getCachedIntelligence(cacheKey: any): Promise<any>;
    /**
     * Cache intelligence data
     */
    static cacheIntelligence(cacheKey: any, data: any): Promise<any>;
    /**
     * Invalidate cache for an industry
     */
    static invalidateCache(industry: any): Promise<any>;
}
//# sourceMappingURL=industryIntelligenceService.d.ts.map