export default StrategicRecommendationService;
declare class StrategicRecommendationService {
    /**
     * Generate comprehensive strategic recommendations
     * @param {Object} assessment - Assessment data with scores and gaps
     * @param {Object} orgProfile - Organization profile
     * @param {Object} frameworkAnalyses - Results from FrameworkEngine
     * @param {Object} industryContext - Industry intelligence
     * @returns {Promise<StrategicRecommendations>}
     */
    static generateRecommendations(assessment: Object, orgProfile: Object, frameworkAnalyses?: Object, industryContext?: Object): Promise<StrategicRecommendations>;
    /**
     * Generate recommendations based on assessment gaps
     */
    static generateGapBasedRecommendations(assessment: any, orgProfile: any): Promise<any[]>;
    /**
     * Generate recommendations from framework analyses
     */
    static generateFrameworkBasedRecommendations(frameworkAnalyses: any, orgProfile: any): Promise<any[]>;
    /**
     * Generate recommendations based on industry intelligence
     */
    static generateIndustryBasedRecommendations(industryContext: any, assessment: any): Promise<any[]>;
    /**
     * Generate competitive response recommendations
     */
    static generateCompetitiveRecommendations(orgProfile: any, industryContext: any): Promise<any[]>;
    /**
     * Prioritize recommendations using weighted scoring
     */
    static prioritizeRecommendations(recommendations: any, orgProfile: any): any;
    /**
     * Categorize recommendations
     */
    static categorizeRecommendations(recommendations: any): any;
    /**
     * Add investment thesis to recommendations
     */
    static addInvestmentThesis(recommendations: any): any;
    /**
     * Generate executive summary
     */
    static generateExecutiveSummary(recommendations: any, assessment: any, orgProfile: any): {
        headline: string;
        currentState: string;
        keyFindings: string[];
        topPriorities: any;
        investmentOverview: {
            totalEstimated: any;
            quickWins: any;
            strategic: any;
        };
    };
    /**
     * Generate implementation roadmap
     */
    static generateRoadmap(recommendations: any): {
        phase1: {
            name: string;
            initiatives: never[];
        };
        phase2: {
            name: string;
            initiatives: never[];
        };
        phase3: {
            name: string;
            initiatives: never[];
        };
        phase4: {
            name: string;
            initiatives: never[];
        };
    };
    /**
     * Calculate investment summary
     */
    static calculateInvestmentSummary(recommendations: any): {
        total: any;
        byTheme: {};
        byCategory: {};
        breakdown: {
            theme: string;
            amount: any;
            percentage: number;
        }[];
    };
    /**
     * Calculate overall confidence
     */
    static calculateOverallConfidence(frameworkAnalyses: any, industryContext: any): "LOW" | "MEDIUM" | "HIGH";
    static generateDescription(title: any, axisName: any, currentScore: any, targetScore: any): string;
    static titleFromStrategy(strategy: any): any;
}
//# sourceMappingURL=strategicRecommendationService.d.ts.map