export class AIProactivityEngine extends BaseService {
    MODES: {
        REACTIVE: string;
        BALANCED: string;
        PROACTIVE: string;
    };
    BEHAVIORS: {
        REACTIVE: {
            autoSuggest: boolean;
            nudges: boolean;
            contextualHints: boolean;
            initiateConversation: boolean;
            showRecommendations: boolean;
            autoAnalyze: boolean;
            suggestNextSteps: boolean;
        };
        BALANCED: {
            autoSuggest: boolean;
            nudges: boolean;
            contextualHints: boolean;
            initiateConversation: boolean;
            showRecommendations: boolean;
            autoAnalyze: boolean;
            suggestNextSteps: boolean;
        };
        BALANCED_V2: {
            autoSuggest: boolean;
            nudges: boolean;
            contextualHints: boolean;
            initiateConversation: boolean;
            showRecommendations: boolean;
            autoAnalyze: boolean;
            suggestNextSteps: boolean;
        };
        PROACTIVE: {
            autoSuggest: boolean;
            nudges: boolean;
            contextualHints: boolean;
            initiateConversation: boolean;
            showRecommendations: boolean;
            autoAnalyze: boolean;
            suggestNextSteps: boolean;
        };
    };
    DESCRIPTIONS: {
        REACTIVE: {
            title: string;
            shortDescription: string;
            longDescription: string;
            icon: string;
            color: string;
            characteristics: string[];
        };
        BALANCED: {
            title: string;
            shortDescription: string;
            longDescription: string;
            icon: string;
            color: string;
            characteristics: string[];
        };
        PROACTIVE: {
            title: string;
            shortDescription: string;
            longDescription: string;
            icon: string;
            color: string;
            characteristics: string[];
        };
    };
    NUDGE_TYPES: {
        DEADLINE_APPROACHING: string;
        RISK_DETECTED: string;
        OPTIMIZATION_OPPORTUNITY: string;
        DOCUMENTATION_MISSING: string;
        APPROVAL_NEEDED: string;
        MILESTONE_UPCOMING: string;
        RESOURCE_CONFLICT: string;
        BUDGET_WARNING: string;
    };
    getAISettingsService(): Promise<import("./aiSettingsService.js").AISettingsService>;
    _aiSettingsService: import("./aiSettingsService.js").AISettingsService | undefined;
    /**
     * Get behavior flags for a given mode
     */
    getBehaviors(mode: any): any;
    /**
     * Get mode description for UI
     */
    getModeDescription(mode: any): any;
    /**
     * Get all modes with descriptions for UI
     */
    getAllModes(): any[];
    /**
     * Get effective proactivity for a user
     */
    getEffectiveProactivity(userId: any, organizationId: any): Promise<{
        mode: string;
        behaviors: any;
        description: any;
    }>;
    /**
     * Check if a specific behavior is enabled
     */
    isBehaviorEnabled(userId: any, organizationId: any, behaviorKey: any): Promise<any>;
    /**
     * Check if nudges are enabled
     */
    areNudgesEnabled(userId: any, organizationId: any): Promise<any>;
    /**
     * Check if auto-suggestions are enabled
     */
    areAutoSuggestionsEnabled(userId: any, organizationId: any): Promise<any>;
    /**
     * Check if AI can initiate conversations
     */
    canInitiateConversation(userId: any, organizationId: any): Promise<any>;
    /**
     * Determine if a nudge should be shown based on type and user settings
     */
    shouldShowNudge(userId: any, organizationId: any, nudgeType: any, urgency?: string): Promise<boolean>;
    /**
     * Get prompt modifier based on proactivity mode
     */
    getProactivityPromptModifier(mode: any): any;
    /**
     * Calculate engagement score based on user's recent interactions
     * Used to potentially adjust proactivity
     */
    calculateEngagementScore(userId: any, organizationId: any): Promise<{
        score: number;
        recentInteractions: number;
        lastInteractionAt: null;
        suggestModeChange: null;
    }>;
}
export default aiProactivityEngine;
import BaseService from './BaseService.js';
declare const aiProactivityEngine: AIProactivityEngine;
//# sourceMappingURL=aiProactivityEngine.d.ts.map