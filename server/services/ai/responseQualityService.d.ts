export default ResponseQualityService;
declare namespace ResponseQualityService {
    export { QUALITY_LEVELS };
    export function calculateQuality({ query, response, context, sources }: object): Promise<object>;
    export function _calculateRelevance(query: any, response: any, context: any): Promise<number>;
    export function _calculateGroundedness(response: any, sources: any): Promise<number>;
    export function _calculateCompleteness(query: any, response: any): Promise<number>;
    export function _calculateCoherence(response: any): number;
    export function _getQualityLevel(score: any): string;
    export function _generateRecommendation({ relevance, groundedness, completeness, coherence, qualityLevel }: {
        relevance: any;
        groundedness: any;
        completeness: any;
        coherence: any;
        qualityLevel: any;
    }): string | null;
    export function _extractKeyTerms(text: any): any;
    export function _splitSentences(text: any): any;
    export function _logQualityMetrics(metrics: any, query: any, context: any): Promise<any>;
    export function getAggregateMetrics(organizationId: any, days?: number): Promise<any>;
    export function getQualityTrends(organizationId: any, days?: number): Promise<any>;
    export { setDependencies };
}
declare namespace QUALITY_LEVELS {
    let EXCELLENT: string;
    let GOOD: string;
    let FAIR: string;
    let POOR: string;
}
/**
 * Set dependencies (for testing)
 */
declare function setDependencies(newDeps?: {}): void;
//# sourceMappingURL=responseQualityService.d.ts.map