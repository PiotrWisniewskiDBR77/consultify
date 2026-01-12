export default ProactiveSuggestionsService;
declare namespace ProactiveSuggestionsService {
    export { SUGGESTION_TYPES };
    export { CONTEXT_TRIGGERS };
    export function generateSuggestions(context: object): Promise<any[]>;
    export function _getScreenBasedSuggestions(screenContext: any, projectId: any): Promise<any[]>;
    export function _getProjectStateSuggestions(projectId: any, organizationId: any): Promise<any>;
    export function _getQuerySuggestions(query: any, userId: any, projectId: any): Promise<{
        type: string;
        title: string;
        description: string;
        action: {
            type: string;
            prompt: any;
        };
        priority: number;
    }[]>;
    export function _getPatternBasedSuggestions(userId: any, organizationId: any, recentActions: any): Promise<{
        type: string;
        title: string;
        description: string;
        action: {
            type: string;
            prompt: string;
        };
        priority: number;
        trigger: string;
    }[]>;
    export function _getTimeBasedSuggestions(projectId: any, organizationId: any): Promise<any>;
    export function _findSimilarPastQueries(query: any, userId: any, projectId: any): Promise<any>;
    export function recordSuggestionShown(suggestionId: any, userId: any, context: any): Promise<any>;
    export function recordSuggestionAction(suggestionId: any, userId: any, action: any, feedback?: null): Promise<any>;
    export function getSuggestionMetrics(organizationId: any, days?: number): Promise<any>;
    export { setDependencies };
}
declare namespace SUGGESTION_TYPES {
    let QUICK_ACTION: string;
    let DID_YOU_MEAN: string;
    let NEXT_STEP: string;
    let INSIGHT: string;
    let WARNING: string;
    let OPTIMIZATION: string;
    let LEARNING: string;
}
declare namespace CONTEXT_TRIGGERS {
    let NEW_PROJECT: string;
    let PHASE_CHANGE: string;
    let DEADLINE_APPROACHING: string;
    let RISK_DETECTED: string;
    let PATTERN_DETECTED: string;
    let USER_IDLE: string;
    let REPEATED_QUERY: string;
}
/**
 * Set dependencies (for testing)
 */
declare function setDependencies(newDeps?: {}): void;
//# sourceMappingURL=proactiveSuggestionsService.d.ts.map