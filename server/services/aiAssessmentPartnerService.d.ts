declare namespace _default {
    export { AIAssessmentPartnerService };
    export { aiAssessmentPartner };
    export { DRD_AXES };
    export { AI_PARTNER_CONFIG };
}
export default _default;
export class AIAssessmentPartnerService {
    genAI: Object | GoogleGenerativeAI | null;
    model: any;
    initializeAI(): void;
    /**
     * Dependency Injection for Testing
     * Allows injecting a mock AI client to prevent real API calls
     * @param {Object} mockClient - The mock GoogleGenerativeAI client
     */
    injectAIClient(mockClient: Object): void;
    _injected: boolean | undefined;
    /**
     * Generate contextual guidance for assessment
     */
    getAssessmentGuidance(axisId: any, currentScore: any, targetScore: any, context?: {}): Promise<{
        error: string;
        axisId?: undefined;
        guidance?: undefined;
        mode?: undefined;
        context?: undefined;
    } | {
        axisId: any;
        guidance: any;
        mode: string;
        context: {
            currentLevel: any;
            targetLevel: any;
            gap: number;
        };
        error?: undefined;
    } | {
        axisId: any;
        guidance: string;
        mode: string;
        context: {
            currentLevel: any;
            targetLevel: any;
            gap: number;
        };
        error: any;
    }>;
    /**
     * Validate score consistency across axes
     */
    validateScoreConsistency(assessment: any, organizationContext?: {}): Promise<{
        hasInconsistencies: boolean;
        inconsistencies: {
            type: string;
            axes: string[];
            message: string;
            suggestion: string;
        }[];
        overallAssessment: string;
    }>;
    /**
     * Generate gap analysis between current and target
     */
    generateGapAnalysis(axisId: any, currentScore: any, targetScore: any, justification?: string): Promise<{
        error: string;
        axisId?: undefined;
        axisName?: undefined;
        currentScore?: undefined;
        targetScore?: undefined;
        gap?: undefined;
        gapSeverity?: undefined;
        currentDescription?: undefined;
        targetDescription?: undefined;
        pathway?: undefined;
        estimatedTotalMonths?: undefined;
        aiRecommendations?: undefined;
    } | {
        axisId: any;
        axisName: any;
        currentScore: any;
        targetScore: any;
        gap: number;
        gapSeverity: string;
        currentDescription: any;
        targetDescription: any;
        pathway: {
            level: any;
            description: any;
            estimatedMonths: number;
            keyActivities: any;
        }[];
        estimatedTotalMonths: number;
        aiRecommendations: any;
        error?: undefined;
    }>;
    /**
     * Generate proactive insights based on assessment data
     */
    generateProactiveInsights(assessment: any, organizationContext?: {}): Promise<{
        insights: never[];
        message: string;
        summary?: undefined;
    } | {
        insights: ({
            type: string;
            priority: string;
            title: string;
            description: string;
            axis: string;
            gap?: undefined;
            axes?: undefined;
            data?: undefined;
        } | {
            type: string;
            priority: string;
            title: string;
            description: string;
            axis: string;
            gap: number;
            axes?: undefined;
            data?: undefined;
        } | {
            type: string;
            priority: string;
            title: string;
            description: string;
            axes: string[];
            axis?: undefined;
            gap?: undefined;
            data?: undefined;
        } | {
            type: string;
            priority: string;
            title: string;
            description: string;
            data: {
                avgActual: number;
                avgTarget: number;
                overallGap: number;
            };
            axis?: undefined;
            gap?: undefined;
            axes?: undefined;
        })[];
        summary: {
            axesAssessed: number;
            averageMaturity: string;
            averageTarget: string;
            overallGap: string;
        };
        message?: undefined;
    }>;
    /**
     * Ask clarifying question about a score
     */
    askClarifyingQuestion(axisId: any, score: any, context?: {}): Promise<{
        question: string;
        axisId?: undefined;
        axisName?: undefined;
        score?: undefined;
        levelContext?: undefined;
        mode?: undefined;
    } | {
        axisId: any;
        axisName: any;
        score: any;
        question: string;
        levelContext: {
            current: any;
            next: any;
            previous: any;
        };
        mode: string;
    }>;
    _buildGuidancePrompt(axis: any, axisId: any, currentScore: any, targetScore: any, context: any): string;
    _getFallbackGuidance(axisId: any, currentScore: any, targetScore: any): string;
    _estimateLevelTransition(axisId: any, fromLevel: any, toLevel: any): number;
    _getKeyActivities(axisId: any, level: any): any;
    /**
     * Suggest justification text based on axis and score
     */
    suggestJustification(axisId: any, score: any, context?: {}): Promise<{
        error: string;
        axisId?: undefined;
        score?: undefined;
        suggestion?: undefined;
        mode?: undefined;
    } | {
        axisId: any;
        score: any;
        suggestion: any;
        mode: string;
        error?: undefined;
    } | {
        axisId: any;
        score: any;
        suggestion: string;
        mode: string;
        error: any;
    }>;
    /**
     * Suggest evidence/proof for a given score
     */
    suggestEvidence(axisId: any, score: any, context?: {}): Promise<{
        error: string;
        axisId?: undefined;
        score?: undefined;
        evidence?: undefined;
        mode?: undefined;
    } | {
        axisId: any;
        score: any;
        evidence: any;
        mode: string;
        error?: undefined;
    } | {
        axisId: any;
        score: any;
        evidence: string[];
        mode: string;
        error: any;
    }>;
    /**
     * Suggest target score based on current score and ambition level
     */
    suggestTargetScore(axisId: any, currentScore: any, ambitionLevel?: string, context?: {}): Promise<{
        error: string;
        axisId?: undefined;
        currentScore?: undefined;
        suggestedTarget?: undefined;
        ambitionLevel?: undefined;
        reasoning?: undefined;
        timeEstimate?: undefined;
    } | {
        axisId: any;
        currentScore: any;
        suggestedTarget: number;
        ambitionLevel: string;
        reasoning: string;
        timeEstimate: string;
        error?: undefined;
    }>;
    /**
     * Correct and improve justification text
     */
    correctJustificationLanguage(text: any, targetLanguage?: string): Promise<{
        error: string;
        correctedText?: undefined;
        mode?: undefined;
        originalText?: undefined;
        language?: undefined;
    } | {
        correctedText: any;
        mode: string;
        error?: undefined;
        originalText?: undefined;
        language?: undefined;
    } | {
        originalText: any;
        correctedText: any;
        language: string;
        mode: string;
        error?: undefined;
    } | {
        originalText: any;
        correctedText: any;
        mode: string;
        error: any;
        language?: undefined;
    }>;
    /**
     * Autocomplete partial justification text
     */
    autocompleteJustification(partialText: any, axisId: any, score: any, context?: {}): Promise<{
        error: string;
        completion?: undefined;
        mode?: undefined;
        partialText?: undefined;
        fullText?: undefined;
    } | {
        completion: string;
        mode: string;
        partialText: any;
        error?: undefined;
        fullText?: undefined;
    } | {
        partialText: any;
        completion: any;
        fullText: string;
        mode: string;
        error?: undefined;
    } | {
        partialText: any;
        completion: string;
        mode: string;
        error: any;
        fullText?: undefined;
    }>;
    /**
     * Generate executive summary from assessment
     */
    generateExecutiveSummary(assessment: any, options?: {}): Promise<{
        summary: string;
        metrics: {
            averageMaturity: any;
            averageTarget: any;
            overallGap: string;
        };
        topStrengths: any[];
        priorityGaps: any[];
        mode: string;
    } | {
        error: string;
        summary?: undefined;
        metrics?: undefined;
        topStrengths?: undefined;
        priorityGaps?: undefined;
        mode?: undefined;
    } | {
        summary: any;
        metrics: {
            averageMaturity: string;
            averageTarget: string;
            overallGap: string;
            axesAssessed: number;
        };
        topStrengths: any[];
        priorityGaps: any[];
        mode: string;
        error?: undefined;
    }>;
    /**
     * Generate stakeholder-specific view
     */
    generateStakeholderView(assessment: any, stakeholderRole: any, options?: {}): Promise<{
        error: string;
        stakeholderRole?: undefined;
        view?: undefined;
        focusAreas?: undefined;
        mode?: undefined;
    } | {
        stakeholderRole: any;
        view: any;
        focusAreas: any;
        mode: string;
        error?: undefined;
    } | {
        stakeholderRole: any;
        view: string;
        mode: string;
        error: any;
        focusAreas?: undefined;
    }>;
    /**
     * Generate benchmark commentary
     */
    generateBenchmarkCommentary(assessment: any, benchmarks: any, options?: {}): Promise<{
        commentary: string;
        mode: string;
        summary?: undefined;
        detailedComparison?: undefined;
        error?: undefined;
    } | {
        commentary: any;
        summary: {
            axesAboveIndustry: number;
            axesBelowIndustry: number;
            axesAtIndustry: number;
        };
        detailedComparison: {
            axis: string;
            name: any;
            actual: any;
            benchmark: any;
            vsIndustry: number | null;
        }[];
        mode: string;
        error?: undefined;
    } | {
        commentary: string;
        mode: string;
        error: any;
        summary?: undefined;
        detailedComparison?: undefined;
    }>;
    /**
     * Generate initiatives from gap analysis
     */
    generateInitiativesFromGaps(gapAnalysis: any, constraints?: {}): Promise<{
        initiatives: any;
        mode: string;
    } | {
        error: string;
        initiatives?: undefined;
        basedOnGaps?: undefined;
        mode?: undefined;
    } | {
        initiatives: any;
        basedOnGaps: any[];
        mode: string;
        error?: undefined;
    }>;
    /**
     * Prioritize initiatives based on criteria
     */
    prioritizeInitiatives(initiatives: any, criteria?: {}): Promise<{
        error: string;
        prioritizedList?: undefined;
        mode?: undefined;
        criteria?: undefined;
    } | {
        prioritizedList: any;
        mode: string;
        error?: undefined;
        criteria?: undefined;
    } | {
        prioritizedList: any;
        criteria: {};
        mode: string;
        error?: undefined;
    } | {
        prioritizedList: any;
        mode: string;
        error: any;
        criteria?: undefined;
    }>;
    /**
     * Estimate ROI for an initiative
     */
    estimateInitiativeROI(initiative: any, context?: {}): Promise<{
        error: string;
        initiative?: undefined;
        estimate?: undefined;
        mode?: undefined;
    } | {
        initiative: any;
        estimate: any;
        mode: string;
        error?: undefined;
    }>;
    _getFallbackJustification(axisId: any, score: any): string;
    _getFallbackEvidence(axisId: any, score: any): string[];
    _getTargetReasoning(axisId: any, current: any, target: any, ambitionLevel: any): string;
    _estimateTotalTime(axisId: any, current: any, target: any): string;
    _getFallbackExecutiveSummary(scores: any, avgActual: any, avgTarget: any): {
        summary: string;
        metrics: {
            averageMaturity: any;
            averageTarget: any;
            overallGap: string;
        };
        topStrengths: any[];
        priorityGaps: any[];
        mode: string;
    };
    _getFallbackInitiatives(gaps: any): {
        initiatives: any;
        mode: string;
    };
    _getFallbackROI(initiative: any): {
        initiative: any;
        estimate: {
            estimatedCost: string;
            estimatedBenefitYear1: string;
            estimatedBenefitYear3: string;
            paybackPeriod: string;
            roiPercentage3Years: string;
            confidenceLevel: string;
            assumptions: string[];
            risks: string[];
        };
        mode: string;
    };
}
export const aiAssessmentPartner: AIAssessmentPartnerService;
export namespace DRD_AXES {
    namespace processes {
        let name: string;
        let description: string;
        let levels: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
    }
    namespace digitalProducts {
        let name_1: string;
        export { name_1 as name };
        let description_1: string;
        export { description_1 as description };
        let levels_1: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_1 as levels };
    }
    namespace businessModels {
        let name_2: string;
        export { name_2 as name };
        let description_2: string;
        export { description_2 as description };
        let levels_2: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_2 as levels };
    }
    namespace dataManagement {
        let name_3: string;
        export { name_3 as name };
        let description_3: string;
        export { description_3 as description };
        let levels_3: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_3 as levels };
    }
    namespace culture {
        let name_4: string;
        export { name_4 as name };
        let description_4: string;
        export { description_4 as description };
        let levels_4: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_4 as levels };
    }
    namespace cybersecurity {
        let name_5: string;
        export { name_5 as name };
        let description_5: string;
        export { description_5 as description };
        let levels_5: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_5 as levels };
    }
    namespace aiMaturity {
        let name_6: string;
        export { name_6 as name };
        let description_6: string;
        export { description_6 as description };
        let levels_6: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
        };
        export { levels_6 as levels };
    }
}
export namespace AI_PARTNER_CONFIG {
    let mode: string;
    let allowed: string[];
    let blocked: string[];
    namespace tone {
        let style: string;
        let formality: string;
        let length: string;
        let language: string;
    }
}
import { GoogleGenerativeAI } from '@google/generative-ai';
//# sourceMappingURL=aiAssessmentPartnerService.d.ts.map