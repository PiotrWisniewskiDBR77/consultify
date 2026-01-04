declare const _default: ReportContentGenerator;
export default _default;
declare class ReportContentGenerator {
    cache: Map<any, any>;
    /**
     * Generate executive summary narrative
     */
    generateExecutiveSummary(assessment: any, orgContext: any, metrics: any): Promise<any>;
    /**
     * Generate narrative for specific axis
     */
    generateAxisNarrative(axis: any, scores: any, orgContext: any): Promise<any>;
    /**
     * Generate strategic recommendations
     */
    generateRecommendations(gaps: any, priorities: any, orgContext: any): Promise<{
        generated: boolean;
        count: number;
        recommendations: any;
    } | {
        generated: boolean;
        generatedAt: string;
        count: any;
        recommendations: any;
    }>;
    /**
     * Generate transformation roadmap narrative
     */
    generateTransformationRoadmap(metrics: any, orgContext: any): Promise<{
        generated: boolean;
        totalDuration: string;
        phases: {
            name: string;
            duration: string;
            objectives: string[];
            successMetrics: string[];
            risks: string[];
            resources: string[];
        }[];
    } | {
        generated: boolean;
        generatedAt: string;
        totalDuration: any;
        phases: any;
    }>;
    /**
     * Regenerate specific section based on user feedback
     */
    regenerateSection(sectionType: any, currentContent: any, feedback: any, context: any): Promise<any>;
    /**
     * Generate comment response
     */
    generateCommentResponse(comment: any, sectionContent: any, context: any): Promise<any>;
    /**
     * Build context string from organization data
     */
    _buildContextString(context: any): string;
    /**
     * Fill template with variables
     */
    _fillTemplate(template: any, variables: any): any;
    /**
     * Parse JSON response from AI
     */
    _parseJSONResponse(response: any): any;
    /**
     * Get maturity label for percentage
     */
    _getMaturityLabel(percentage: any): "Leading" | "Optimized" | "Standardized" | "Emerging" | "Ad-hoc";
    _generateFallbackExecutiveSummary(metrics: any): {
        generated: boolean;
        verdict: string;
        keyFindings: string[];
        strategicImplications: string;
        immediateActions: string[];
    };
    _generateFallbackAxisNarrative(axis: any, scores: any): {
        axis: any;
        generated: boolean;
        currentState: string;
        strengths: string[];
        gaps: string[];
        recommendations: string[];
    };
    _generateFallbackRecommendations(gaps: any): {
        generated: boolean;
        count: number;
        recommendations: any;
    };
    _generateFallbackRoadmap(metrics: any): {
        generated: boolean;
        totalDuration: string;
        phases: {
            name: string;
            duration: string;
            objectives: string[];
            successMetrics: string[];
            risks: string[];
            resources: string[];
        }[];
    };
}
//# sourceMappingURL=reportContentGenerator.d.ts.map