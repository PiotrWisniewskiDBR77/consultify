export default ReportPipeline;
declare class ReportPipeline {
    /**
     * Generate enterprise report with multi-agent pipeline
     * @param {Object} assessment - Assessment data
     * @param {Object} orgProfile - Organization profile
     * @param {Object} options - Generation options
     * @yields {Object} Progress updates
     * @returns {Promise<EnterpriseReport>}
     */
    static generateReport(assessment: Object, orgProfile: Object, options?: Object): Promise<EnterpriseReport>;
    /**
     * Gather all context needed for report generation
     */
    static gatherContext(assessment: any, orgProfile: any, options: any): Promise<{
        industry: any;
        companySize: any;
        industryContext: any;
        benchmarks: any;
        frameworkAnalyses: any;
        strategicRecommendations: StrategicRecommendations;
        assessmentScores: any;
        assessmentGaps: any;
        organizationProfile: any;
        options: any;
    }>;
    /**
     * Run a single agent in the pipeline
     */
    static runAgent(agentName: any, context: any, assessment: any, orgProfile: any): Promise<any>;
    /**
     * Build user prompt for specific agent
     */
    static buildAgentUserPrompt(agentName: any, context: any, assessment: any, orgProfile: any): string;
    /**
     * Generate static agent output when AI unavailable
     */
    static generateStaticAgentOutput(agentName: any, context: any, assessment: any, orgProfile: any): {
        keyFindings: any;
        gapAnalysis: {
            criticalGaps: any;
            gapDrivers: string[];
            correlations: string[];
        };
        benchmarkComparison: any;
        dataQualityNotes: string[];
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
        note?: undefined;
        agentName?: undefined;
    } | {
        strategicAssessment: {
            currentPositioning: string;
            targetState: string;
            transformationGap: string;
        };
        recommendations: any;
        roadmap: any;
        successMetrics: {
            metric: string;
            baseline: string;
            target: string;
            timeframe: string;
        }[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
        note?: undefined;
        agentName?: undefined;
    } | {
        validationScore: number;
        validationLevel: string;
        logicValidation: {
            score: number;
            issues: string[];
            strengths: string[];
        };
        feasibilityAssessment: {
            budgetRealism: string;
            timelineRealism: string;
            capabilityFit: string;
            concerns: string[];
        };
        riskAssessment: {
            overallRiskLevel: string;
            keyRisks: {
                risk: string;
                likelihood: string;
                impact: string;
                mitigation: string;
            }[];
        };
        recommendations: string[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
        note?: undefined;
        agentName?: undefined;
    } | {
        executiveSummary: {
            headline: string;
            keyMessage: string;
            topFindings: any;
            topRecommendations: any;
            callToAction: string;
        };
        reportSections: {
            sectionId: string;
            title: string;
            narrative: string;
            keyTakeaways: any;
            visualizationType: string;
            visualizationSpec: {
                type: string;
            };
        }[];
        appendices: {
            title: string;
            content: string;
        }[];
        keyMessageCallouts: string[];
        readingTime: number;
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        note?: undefined;
        agentName?: undefined;
    } | {
        note: string;
        agentName: any;
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
    /**
     * Assemble final report from agent outputs
     */
    static assembleReport(pipelineOutputs: any, assessment: any, orgProfile: any): Promise<{
        id: string;
        assessmentId: any;
        organizationId: any;
        executiveSummary: any;
        analysis: {
            keyFindings: any;
            gapAnalysis: any;
            benchmarkComparison: any;
            frameworkAnalyses: any;
        };
        strategy: {
            assessment: any;
            recommendations: any;
            roadmap: any;
            successMetrics: any;
        };
        validation: {
            score: any;
            level: any;
            riskAssessment: any;
            feasibility: any;
        };
        sections: any;
        appendices: any;
        keyMessages: any;
        metadata: {
            generatedAt: string;
            industry: any;
            companySize: any;
            assessmentScore: any;
            readingTime: any;
            confidence: string;
        };
    }>;
    /**
     * Calculate report confidence
     */
    static calculateReportConfidence(analystOutput: any, validatorOutput: any, context: any): "LOW" | "MEDIUM" | "HIGH";
    static initializeGeneration(generationId: any, reportId: any, organizationId: any): Promise<any>;
    static updateGenerationStatus(generationId: any, status: any, progress: any, currentAgent?: null): Promise<any>;
    static storeAgentOutput(generationId: any, field: any, output: any): Promise<any>;
    static completeGeneration(generationId: any, report: any, duration: any): Promise<any>;
    static failGeneration(generationId: any, errorMessage: any): Promise<any>;
    /**
     * Get generation status
     */
    static getGenerationStatus(generationId: any): Promise<any>;
}
//# sourceMappingURL=reportPipeline.d.ts.map