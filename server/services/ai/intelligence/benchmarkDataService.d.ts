export default BenchmarkDataService;
declare class BenchmarkDataService {
    /**
     * Get comprehensive benchmark data for an assessment
     * @param {string} industry - Industry name
     * @param {string} companySize - Company size category
     * @param {string} region - Optional geographic region
     * @returns {Promise<BenchmarkData>}
     */
    static getBenchmarkData(industry: string, companySize?: string, region?: string): Promise<BenchmarkData>;
    /**
     * Compare assessment scores against benchmarks
     * @param {Object} assessmentScores - Object with axis scores
     * @param {string} industry - Industry for comparison
     * @param {string} companySize - Company size
     * @returns {Promise<ComparisonResult>}
     */
    static compareWithBenchmarks(assessmentScores: Object, industry: string, companySize?: string): Promise<ComparisonResult>;
    /**
     * Get peer comparison data
     */
    static getPeerComparison(organizationId: any, assessmentScores: any, industry: any): Promise<{
        hasPeerData: boolean;
        message: string;
        fallbackBenchmarks: BenchmarkData;
        peerCount?: undefined;
        peerStats?: undefined;
        yourPosition?: undefined;
        insights?: undefined;
    } | {
        hasPeerData: boolean;
        peerCount: any;
        peerStats: {};
        yourPosition: {};
        insights: any[];
        message?: undefined;
        fallbackBenchmarks?: undefined;
    }>;
    /**
     * Build benchmark data for all axes
     */
    static buildAxisBenchmarks(industry: any, companySize: any): {};
    /**
     * Calculate overall benchmark
     */
    static calculateOverallBenchmark(axisBenchmarks: any): {
        p25: number;
        median: number;
        p75: number;
        leader: number;
    };
    /**
     * Fetch enhanced benchmarks from web
     */
    static fetchEnhancedBenchmarks(industry: any): Promise<{
        insight: any;
        sources: any;
        fetchedAt: string;
    } | null>;
    /**
     * Calculate percentile for a score
     */
    static calculatePercentile(score: any, benchmark: any): number;
    /**
     * Calculate overall percentile
     */
    static calculateOverallPercentile(scores: any, benchmarks: any): number;
    /**
     * Determine position label from percentile
     */
    static determinePosition(percentile: any): "BELOW_MEDIAN" | "LEADER" | "TOP_QUARTILE" | "ABOVE_MEDIAN" | "BOTTOM_QUARTILE";
    /**
     * Generate insight for an axis
     */
    static generateAxisInsight(axisId: any, score: any, benchmark: any, percentile: any): string;
    /**
     * Find strongest axis in comparison
     */
    static findStrongestAxis(comparison: any): null;
    /**
     * Find weakest axis in comparison
     */
    static findWeakestAxis(comparison: any): null;
    /**
     * Identify priority gaps
     */
    static identifyPriorityGaps(comparison: any): any[];
    /**
     * Generate benchmark-based recommendations
     */
    static generateBenchmarkRecommendations(comparison: any, industry: any): any[];
    /**
     * Get specific recommendation for an axis
     */
    static getRecommendationForAxis(axisId: any, gap: any, industry: any): any;
    /**
     * Fetch peer data from database
     */
    static fetchPeerData(industry: any): Promise<any>;
    /**
     * Calculate peer statistics
     */
    static calculatePeerStatistics(peerData: any): {};
    /**
     * Calculate position among peers
     */
    static calculatePeerPosition(scores: any, peerStats: any): {};
    /**
     * Generate peer comparison insights
     */
    static generatePeerInsights(positions: any, peerStats: any): any[];
    static getCachedBenchmark(cacheKey: any): Promise<any>;
    static cacheBenchmark(cacheKey: any, data: any): Promise<any>;
}
//# sourceMappingURL=benchmarkDataService.d.ts.map