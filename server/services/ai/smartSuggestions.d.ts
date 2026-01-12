declare namespace _default {
    export { getSuggestions };
    export { getCachedSuggestions };
    export { invalidateCache };
    export { checkAssessmentStatus };
    export { checkLowMaturityAreas };
    export { checkStaleInitiatives };
    export { checkRoadmapStatus };
    export { generateContextSuggestions };
    export { checkOnboardingStatus };
}
export default _default;
/**
 * Get smart suggestions for a user/project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID (optional)
 * @param {object} conversationContext - Recent conversation context
 * @returns {Promise<Array>} Array of suggestions
 */
export function getSuggestions(userId: string, projectId: string, conversationContext?: object): Promise<any[]>;
export function getCachedSuggestions(userId: any, projectId: any, conversationContext: any): Promise<any[]>;
/**
 * Invalidate cache for a user/project (call after state changes)
 */
export function invalidateCache(userId: any, projectId: any): void;
/**
 * Check for incomplete assessments
 */
export function checkAssessmentStatus(userId: any, projectId: any): Promise<({
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        view: string;
        data: {
            assessmentId: any;
        };
    };
} | {
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        view: string;
        data?: undefined;
    };
})[]>;
/**
 * Check for low maturity areas that need attention
 */
export function checkLowMaturityAreas(userId: any, projectId: any): Promise<{
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        prompt: string;
    };
}[]>;
/**
 * Check for stale initiatives that need updates
 */
export function checkStaleInitiatives(userId: any, projectId: any): Promise<{
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        view: string;
        data: {
            initiativeId: any;
        };
    };
}[]>;
/**
 * Check for missing or incomplete roadmap
 */
export function checkRoadmapStatus(userId: any, projectId: any): Promise<{
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        view: string;
    };
}[]>;
/**
 * Generate suggestions based on conversation context
 */
export function generateContextSuggestions(conversationContext: any): {
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        prompt: string;
    };
}[];
/**
 * Check onboarding status for new users
 */
export function checkOnboardingStatus(userId: any): Promise<{
    id: string;
    type: string;
    text: string;
    priority: number;
    context: string[];
    action: {
        type: string;
        view: string;
    };
}[]>;
//# sourceMappingURL=smartSuggestions.d.ts.map