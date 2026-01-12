declare namespace _default {
    export { AIAssessmentFormHelper };
    export { aiAssessmentFormHelper };
    export { FIELD_TYPES };
    export { VALIDATION_RULES };
}
export default _default;
export class AIAssessmentFormHelper {
    aiPartner: import("./aiAssessmentPartnerService.js").AIAssessmentPartnerService;
    /**
     * Get AI suggestion for any form field
     */
    getFieldSuggestion(fieldType: any, context?: {}): Promise<{
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
    } | {
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
    } | {
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
    } | {
        error: string;
        suggestion?: undefined;
        prompts?: undefined;
    } | {
        suggestion: string;
        prompts: string[];
        error?: undefined;
    } | {
        suggestedPriority: string;
        reasoning: string;
    }>;
    /**
     * Validate field value with AI-powered feedback
     */
    validateFieldValue(fieldType: any, value: any, context?: {}): Promise<{
        isValid: boolean;
        errors: never[];
        warnings: never[];
    }>;
    /**
     * Autocomplete partial text input
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
    } | {
        completion: string;
        message: string;
    }>;
    /**
     * Fill missing fields in assessment with AI suggestions
     */
    fillMissingFields(assessment: any, fillStrategy?: string): Promise<{
        filledFields: {};
        strategy: string;
        axesProcessed: number;
        mode: string;
    }>;
    /**
     * Review and improve all justifications
     */
    reviewAllJustifications(assessment: any, options?: {}): Promise<{
        reviews: {
            qualityScore: number;
            issues: string[];
            improvements: string[];
            suggestedImprovement: any;
            axisId: string;
            axisName: any;
        }[];
        summary: {
            totalReviewed: number;
            needsImprovement: number;
            averageQuality: string;
            overallAssessment: string;
        };
    }>;
    /**
     * Get contextual help for current form state
     */
    getContextualHelp(formState: any, context?: {}): Promise<{
        tips: never[];
        warnings: never[];
        nextSteps: never[];
    }>;
    /**
     * Get quick action buttons for current context
     */
    getQuickActions(formState: any): ({
        id: string;
        label: string;
        icon: string;
        action: string;
        primary?: undefined;
    } | {
        id: string;
        label: string;
        icon: string;
        action: string;
        primary: boolean;
    })[];
    _basicValidation(fieldType: any, value: any): {
        isValid: boolean;
        errors: never[];
        warnings: never[];
    };
    _validateJustification(text: any, axisId: any, score: any): Promise<{
        warnings: string[];
        suggestions: string[];
    }>;
    _reviewSingleJustification(axisId: any, score: any, justification: any, options?: {}): Promise<{
        qualityScore: number;
        issues: string[];
        improvements: string[];
        suggestedImprovement: any;
    }>;
    _getLevelKeywords(axisId: any, score: any): any;
    _suggestNotes(axisId: any, score: any, context: any): Promise<{
        error: string;
        suggestion?: undefined;
        prompts?: undefined;
    } | {
        suggestion: string;
        prompts: string[];
        error?: undefined;
    }>;
    _suggestPriority(axisId: any, score: any, context: any): Promise<{
        suggestedPriority: string;
        reasoning: string;
    }>;
}
export const aiAssessmentFormHelper: AIAssessmentFormHelper;
export namespace FIELD_TYPES {
    let JUSTIFICATION: string;
    let EVIDENCE: string;
    let TARGET_SCORE: string;
    let ACTUAL_SCORE: string;
    let NOTES: string;
    let PRIORITY: string;
}
export namespace VALIDATION_RULES {
    namespace justification {
        let minLength: number;
        let maxLength: number;
        let required: boolean;
    }
    namespace evidence {
        export let minItems: number;
        export let maxItems: number;
        let required_1: boolean;
        export { required_1 as required };
    }
    namespace score {
        export let min: number;
        export let max: number;
        let required_2: boolean;
        export { required_2 as required };
    }
}
//# sourceMappingURL=aiAssessmentFormHelper.d.ts.map