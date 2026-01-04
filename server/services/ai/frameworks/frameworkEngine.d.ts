export default FrameworkEngine;
declare class FrameworkEngine {
    /**
     * Apply multiple frameworks automatically based on context
     * @param {Object} assessment - Assessment data
     * @param {Object} orgProfile - Organization profile
     * @param {Object} industryContext - Industry intelligence
     * @returns {Promise<FrameworkAnalyses>}
     */
    static applyFrameworks(assessment: Object, orgProfile: Object, industryContext?: Object): Promise<FrameworkAnalyses>;
    /**
     * Apply a specific framework
     */
    static applyFramework(frameworkId: any, assessment: any, orgProfile: any, industryContext?: null): Promise<{
        frameworkId: any;
        frameworkName: any;
        result: {
            note: string;
            summary: string;
            recommendations: string[];
        };
        confidence: string;
        isStatic: boolean;
    } | {
        frameworkId: any;
        frameworkName: any;
        result: any;
        confidence: string;
        metadata: {
            assessmentId: any;
            organizationId: any;
            generatedAt: string;
        };
    }>;
    /**
     * Generate BCG Matrix for initiatives
     */
    static generateBCGMatrix(initiatives: any, orgProfile: any): Promise<{
        quadrants: {};
        initiatives: never[];
        summary?: undefined;
        portfolioBalance?: undefined;
        recommendations?: undefined;
    } | {
        quadrants: {
            STAR: never[];
            QUESTION_MARK: never[];
            CASH_COW: never[];
            DOG: never[];
        };
        initiatives: any;
        summary: {
            stars: number;
            questionMarks: number;
            cashCows: number;
            dogs: number;
        };
        portfolioBalance: string;
        recommendations: string[];
    }>;
    /**
     * Apply Porter's Five Forces analysis
     */
    static applyPortersFiveForces(orgProfile: any, industryContext: any): Promise<{
        frameworkId: string;
        frameworkName: any;
        forces: {
            competitiveRivalry: {
                score: number;
                level: string;
                rationale: string;
                digitalImpact: string;
            };
            threatNewEntrants: {
                score: number;
                level: string;
                rationale: string;
                digitalImpact: string;
            };
            supplierPower: {
                score: number;
                level: string;
                rationale: string;
                digitalImpact: string;
            };
            buyerPower: {
                score: number;
                level: string;
                rationale: string;
                digitalImpact: string;
            };
            threatSubstitutes: {
                score: number;
                level: string;
                rationale: string;
                digitalImpact: string;
            };
        };
        overallScore: number;
        industryAttractiveness: string;
        strategicImplications: string[];
        digitalDefenseStrategies: string[];
    }>;
    /**
     * Apply McKinsey 7S analysis
     */
    static apply7SAnalysis(assessment: any, orgProfile: any): Promise<{
        frameworkId: string;
        frameworkName: any;
        scores: {
            strategy: {
                score: number;
                rationale: string;
            };
            structure: {
                score: number;
                rationale: string;
            };
            systems: {
                score: any;
                rationale: string;
            };
            sharedValues: {
                score: any;
                rationale: string;
            };
            style: {
                score: number;
                rationale: string;
            };
            staff: {
                score: any;
                rationale: string;
            };
            skills: {
                score: any;
                rationale: string;
            };
        };
        alignmentScore: number;
        alignmentLevel: string;
        hardElements: {
            strategy: {
                score: number;
                rationale: string;
            };
            structure: {
                score: number;
                rationale: string;
            };
            systems: {
                score: any;
                rationale: string;
            };
        };
        softElements: {
            sharedValues: {
                score: any;
                rationale: string;
            };
            style: {
                score: number;
                rationale: string;
            };
            staff: {
                score: any;
                rationale: string;
            };
            skills: {
                score: any;
                rationale: string;
            };
        };
        keyGaps: string[];
        transformationReadiness: string;
        recommendations: any[];
    }>;
    static determineFocusArea(assessment: any): "OPERATIONS" | "PRODUCTS" | "PORTFOLIO" | "TRANSFORMATION";
    static buildPromptContext(framework: any, assessment: any, orgProfile: any, industryContext: any): {
        industry: any;
        subSector: any;
        size: any;
        growthStage: any;
        competitivePosition: any;
        competitors: any;
        markets: any;
        regulations: any;
        maturity: any;
        priorities: any;
        assessmentSummary: string;
        industryContext: string;
        findings: string;
    };
    static buildPrompt(framework: any, context: any): any;
    static summarizeAssessment(assessment: any): string;
    static extractKeyFindings(assessment: any): string;
    static assessAnalysisConfidence(result: any, context: any): "LOW" | "MEDIUM" | "HIGH";
    static synthesizeAnalyses(analyses: any): {
        keyInsights: any[];
        topRecommendations: any[];
        frameworksApplied: any;
        overallConfidence: string;
    } | null;
    static calculateStrategicValue(initiative: any): number;
    static calculateCompetitivePosition(initiative: any, orgProfile: any): number;
    static determineBCGQuadrant(strategicValue: any, competitivePosition: any): "STAR" | "QUESTION_MARK" | "CASH_COW" | "DOG";
    static getBCGRecommendation(quadrant: any): any;
    static assessPortfolioBalance(classified: any): "EMPTY" | "HEALTHY" | "WEAK" | "UNCERTAIN" | "BALANCED";
    static generateBCGRecommendations(classified: any, initiatives: any): string[];
    static assessCompetitiveRivalry(orgProfile: any, industryContext: any): {
        score: number;
        level: string;
        rationale: string;
        digitalImpact: string;
    };
    static assessNewEntrantsThreat(orgProfile: any, industryContext: any): {
        score: number;
        level: string;
        rationale: string;
        digitalImpact: string;
    };
    static assessSupplierPower(orgProfile: any, industryContext: any): {
        score: number;
        level: string;
        rationale: string;
        digitalImpact: string;
    };
    static assessBuyerPower(orgProfile: any, industryContext: any): {
        score: number;
        level: string;
        rationale: string;
        digitalImpact: string;
    };
    static assessSubstitutesThreat(orgProfile: any, industryContext: any): {
        score: number;
        level: string;
        rationale: string;
        digitalImpact: string;
    };
    static generatePorterImplications(forces: any): string[];
    static generateDigitalDefenseStrategies(forces: any): string[];
    static assess7SStrategy(assessment: any, orgProfile: any): {
        score: number;
        rationale: string;
    };
    static assess7SStructure(assessment: any, orgProfile: any): {
        score: number;
        rationale: string;
    };
    static assess7SSystems(assessment: any, orgProfile: any): {
        score: any;
        rationale: string;
    };
    static assess7SSharedValues(assessment: any, orgProfile: any): {
        score: any;
        rationale: string;
    };
    static assess7SStyle(assessment: any, orgProfile: any): {
        score: number;
        rationale: string;
    };
    static assess7SStaff(assessment: any, orgProfile: any): {
        score: any;
        rationale: string;
    };
    static assess7SSkills(assessment: any, orgProfile: any): {
        score: any;
        rationale: string;
    };
    static identify7SGaps(scores: any): string[];
    static generate7SRecommendations(scores: any): any[];
    static generateStaticAnalysis(frameworkId: any, assessment: any, orgProfile: any): {
        frameworkId: any;
        frameworkName: any;
        result: {
            note: string;
            summary: string;
            recommendations: string[];
        };
        confidence: string;
        isStatic: boolean;
    };
    static storeAnalysis(organizationId: any, assessmentId: any, frameworkType: any, analysis: any): Promise<any>;
}
//# sourceMappingURL=frameworkEngine.d.ts.map