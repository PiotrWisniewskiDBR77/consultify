declare const _default: PremiumReportAIService;
export default _default;
declare class PremiumReportAIService {
    /**
     * System prompt for McKinsey-grade content
     */
    getSystemPrompt(): string;
    /**
     * Generate Executive Summary
     */
    generateExecutiveSummary(assessmentId: any, options?: {}): Promise<{
        content: any;
        keyInsights: any[];
        metrics: {
            overallMaturity: string;
            targetMaturity: string;
            totalGapPoints: any;
            estimatedROI: string;
        };
    }>;
    /**
     * Generate Gap Analysis section
     */
    generateGapAnalysis(assessmentId: any, options?: {}): Promise<{
        content: any;
        criticalGaps: any[];
        moderateGaps: any[];
    }>;
    /**
     * Generate Strategic Recommendations
     */
    generateRecommendations(assessmentId: any, options?: {}): Promise<{
        content: any;
        recommendations: {
            title: any;
            description: any;
            priority: string;
        }[];
    }>;
    /**
     * Generate Transformation Roadmap
     */
    generateRoadmap(assessmentId: any, options?: {}): Promise<{
        content: any;
        phases: {
            number: number;
            title: any;
            content: any;
        }[];
    }>;
    /**
     * Generate ROI Analysis
     */
    generateROIAnalysis(assessmentId: any, options?: {}): Promise<{
        content: any;
    }>;
    /**
     * Generate custom section based on prompt
     */
    generateCustomSection(assessmentId: any, customPrompt: any, options?: {}): Promise<{
        content: any;
    }>;
    /**
     * Get assessment data for AI context
     */
    getAssessmentData(assessmentId: any): Promise<{
        id: any;
        name: any;
        organizationName: any;
        axes: any;
        avgActual: number;
        avgTarget: number;
        totalGap: any;
        metrics: {
            overallMaturity: string;
            targetMaturity: string;
            totalGapPoints: any;
            estimatedROI: string;
        };
    }>;
    /**
     * Extract key insights from generated text
     */
    extractKeyInsights(text: any): any[];
    /**
     * Parse recommendations from generated text
     */
    parseRecommendations(text: any): {
        title: any;
        description: any;
        priority: string;
    }[];
    /**
     * Parse roadmap phases from generated text
     */
    parseRoadmapPhases(text: any): {
        number: number;
        title: any;
        content: any;
    }[];
}
//# sourceMappingURL=premiumReportAIService.d.ts.map