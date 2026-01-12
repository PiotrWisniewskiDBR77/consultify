declare namespace _default {
    export { QualityChecker };
    export { QualityChecker as QualityCheckerService };
    export { qualityChecker };
    export { QUALITY_THRESHOLDS };
}
export default _default;
export class QualityChecker {
    checksPerformed: number;
    failedChecks: number;
    /**
     * Run full quality check on AI response
     * @param {Object} response - AI response to check
     * @param {Object} context - Original context/request
     * @param {Object} options - Check options
     */
    check(response: Object, context: Object, options?: Object): Promise<{
        passed: boolean;
        overallScore: number;
        checks: {
            hallucinationRisk: {
                score: number;
                passed: boolean;
                issues: ({
                    pattern: string;
                    match: any;
                    riskLevel: string;
                    count?: undefined;
                } | {
                    pattern: string;
                    count: any;
                    riskLevel: string;
                    match?: undefined;
                })[];
                riskLevel: string;
            };
            citationCompliance: {
                score: number;
                passed: boolean;
                hasCitations: boolean;
                needsCitation: boolean;
                issues: {
                    type: string;
                    pattern: string;
                }[];
            };
            relevance: {
                score: number;
                passed: boolean;
                note: string;
                overlapCount?: undefined;
                queryKeywords?: undefined;
                matchedKeywords?: undefined;
            } | {
                score: number;
                passed: boolean;
                overlapCount: any;
                queryKeywords: any;
                matchedKeywords: any;
                note?: undefined;
            };
            lengthAppropriate: {
                score: number;
                passed: boolean;
                note: string;
                ratio?: undefined;
                responseLength?: undefined;
                contextLength?: undefined;
                issues?: undefined;
            } | {
                score: number;
                passed: boolean;
                ratio: number;
                responseLength: any;
                contextLength: any;
                issues: string[];
                note?: undefined;
            };
            structureValid: {
                score: number;
                passed: boolean;
                issues: string[];
            };
            languageQuality: {
                score: number;
                passed: boolean;
                issues: string[];
            };
        };
        scores: {};
        warnings: {
            level: string;
            message: string;
            action: string;
        }[];
        suggestions: string[];
        metadata: {
            checkDuration: number;
            strictMode: any;
            capability: any;
        };
    } | {
        passed: boolean;
        overallScore: number;
        checks: {
            hallucinationRisk: {
                score: number;
                passed: boolean;
            };
            citationCompliance: {
                score: number;
                passed: boolean;
            };
            relevance: {
                score: number;
                passed: boolean;
            };
            lengthAppropriate: {
                score: number;
                passed: boolean;
            };
            structureValid: {
                score: number;
                passed: boolean;
            };
            languageQuality: {
                score: number;
                passed: boolean;
            };
        };
        scores: {
            hallucination: number;
            citation: number;
            relevance: number;
            length: number;
            structure: number;
            language: number;
        };
        warnings: string[];
        suggestions: string[];
        metadata: {
            checkDuration: number;
            strictMode: any;
            capability: any;
        };
    }>;
    /**
     * Check for potential hallucinations
     */
    checkHallucination(content: any): {
        score: number;
        passed: boolean;
        issues: ({
            pattern: string;
            match: any;
            riskLevel: string;
            count?: undefined;
        } | {
            pattern: string;
            count: any;
            riskLevel: string;
            match?: undefined;
        })[];
        riskLevel: string;
    };
    /**
     * Check citation compliance
     */
    checkCitations(content: any, context: any): {
        score: number;
        passed: boolean;
        hasCitations: boolean;
        needsCitation: boolean;
        issues: {
            type: string;
            pattern: string;
        }[];
    };
    /**
     * Check response relevance to context
     */
    checkRelevance(content: any, context: any): {
        score: number;
        passed: boolean;
        note: string;
        overlapCount?: undefined;
        queryKeywords?: undefined;
        matchedKeywords?: undefined;
    } | {
        score: number;
        passed: boolean;
        overlapCount: any;
        queryKeywords: any;
        matchedKeywords: any;
        note?: undefined;
    };
    /**
     * Check response length appropriateness
     */
    checkLength(content: any, context: any): {
        score: number;
        passed: boolean;
        note: string;
        ratio?: undefined;
        responseLength?: undefined;
        contextLength?: undefined;
        issues?: undefined;
    } | {
        score: number;
        passed: boolean;
        ratio: number;
        responseLength: any;
        contextLength: any;
        issues: string[];
        note?: undefined;
    };
    /**
     * Check response structure validity
     */
    checkStructure(content: any, capability: any): {
        score: number;
        passed: boolean;
        issues: string[];
    };
    /**
     * Check language quality
     */
    checkLanguageQuality(content: any): {
        score: number;
        passed: boolean;
        issues: string[];
    };
    /**
     * Collect warnings from all checks
     */
    collectWarnings(checks: any): {
        level: string;
        message: string;
        action: string;
    }[];
    /**
     * Generate improvement suggestions
     */
    generateSuggestions(checks: any): string[];
    /**
     * Extract keywords from text
     */
    extractKeywords(text: any): any;
    /**
     * Calculate overall score from individual check scores
     * @param {Object} scores - Individual check scores
     * @returns {number} - Overall score
     */
    calculateOverallScore(scores: Object): number;
    /**
     * Get warnings based on scores
     * @param {Object} scores - Individual check scores
     * @returns {Array<string>} - List of warnings
     */
    getWarnings(scores: Object): Array<string>;
    /**
     * Get quality check statistics
     */
    getStats(): {
        totalChecks: number;
        failedChecks: number;
        passRate: string | number;
    };
}
export const qualityChecker: QualityChecker;
export namespace QUALITY_THRESHOLDS {
    let MIN_ACCURACY: number;
    let MIN_RELEVANCE: number;
    let MAX_HALLUCINATION_RISK: number;
    let MIN_LENGTH_RATIO: number;
    let MAX_LENGTH_RATIO: number;
}
//# sourceMappingURL=qualityChecker.d.ts.map