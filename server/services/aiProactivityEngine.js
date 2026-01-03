/**
 * AI Proactivity Engine
 * 
 * Controls how proactive the AI behaves based on user/org settings.
 * Three modes: REACTIVE, BALANCED, PROACTIVE
 */

import BaseService from './BaseService.js';

/**
 * Proactivity Mode Definitions
 */
const PROACTIVITY_MODES = {
    REACTIVE: 'REACTIVE',
    BALANCED: 'BALANCED',
    PROACTIVE: 'PROACTIVE'
};

/**
 * Behavior flags for each mode
 */
const PROACTIVITY_BEHAVIORS = {
    REACTIVE: {
        autoSuggest: false,          // No auto-suggestions while typing
        nudges: false,               // No proactive nudges
        contextualHints: false,      // No contextual tips
        initiateConversation: false, // Never start conversation
        showRecommendations: false,  // Hide recommendation panels
        autoAnalyze: false,          // Don't auto-analyze context
        suggestNextSteps: false      // Don't suggest next steps
    },
    BALANCED: {
        autoSuggest: true,           // Show suggestions when helpful
        nudges: true,                // Show occasional nudges
        contextualHints: true,       // Show contextual tips
        initiateConversation: false, // Wait for user to start
        showRecommendations: true,   // Show recommendations
        autoAnalyze: true,           // Analyze context in background
        suggestNextSteps: true       // Suggest next steps when appropriate
    },
    BALANCED_V2: { // Legacy or alternative? Keeping original BALANCED
        autoSuggest: true,
        nudges: true,
        contextualHints: true,
        initiateConversation: false,
        showRecommendations: true,
        autoAnalyze: true,
        suggestNextSteps: true
    },
    PROACTIVE: {
        autoSuggest: true,           // Active auto-suggestions
        nudges: true,                // Frequent nudges
        contextualHints: true,       // Always show tips
        initiateConversation: true,  // Can start conversations
        showRecommendations: true,   // Prominent recommendations
        autoAnalyze: true,           // Continuous analysis
        suggestNextSteps: true       // Always suggest next steps
    }
};

/**
 * Mode descriptions for UI
 */
const PROACTIVITY_DESCRIPTIONS = {
    REACTIVE: {
        title: 'Reactive',
        shortDescription: 'AI waits for your questions',
        longDescription: 'The AI remains silent until you ask. Perfect for experienced users who prefer to work independently and only consult AI when needed.',
        icon: 'pause',
        color: 'gray',
        characteristics: [
            'Responds only when asked',
            'No automatic suggestions',
            'No proactive notifications',
            'Full user control'
        ]
    },
    BALANCED: {
        title: 'Balanced',
        shortDescription: 'AI suggests when helpful',
        longDescription: 'The AI provides suggestions and hints when it detects you might benefit from assistance, but waits for you to initiate major interactions.',
        icon: 'scale',
        color: 'purple',
        characteristics: [
            'Helpful suggestions when relevant',
            'Contextual hints appear naturally',
            'Waits for you to start conversations',
            'Recommendations in background'
        ]
    },
    PROACTIVE: {
        title: 'Proactive',
        shortDescription: 'AI actively assists',
        longDescription: 'The AI actively monitors your work and proactively offers assistance, starts conversations about potential issues, and continuously provides recommendations.',
        icon: 'zap',
        color: 'green',
        characteristics: [
            'Active suggestions and analysis',
            'Proactively starts conversations',
            'Continuous monitoring and alerts',
            'Frequent recommendations'
        ]
    }
};

/**
 * Nudge types that can be triggered
 */
const NUDGE_TYPES = {
    DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
    RISK_DETECTED: 'RISK_DETECTED',
    OPTIMIZATION_OPPORTUNITY: 'OPTIMIZATION_OPPORTUNITY',
    DOCUMENTATION_MISSING: 'DOCUMENTATION_MISSING',
    APPROVAL_NEEDED: 'APPROVAL_NEEDED',
    MILESTONE_UPCOMING: 'MILESTONE_UPCOMING',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    BUDGET_WARNING: 'BUDGET_WARNING'
};

export class AIProactivityEngine extends BaseService {
    constructor() {
        super();
        this.MODES = PROACTIVITY_MODES;
        this.BEHAVIORS = PROACTIVITY_BEHAVIORS;
        this.DESCRIPTIONS = PROACTIVITY_DESCRIPTIONS;
        this.NUDGE_TYPES = NUDGE_TYPES;
    }

    async getAISettingsService() {
        if (!this._aiSettingsService) {
            const { default: aiSettingsService } = await import('./aiSettingsService.js');
            this._aiSettingsService = aiSettingsService;
        }
        return this._aiSettingsService;
    }

    /**
     * Get behavior flags for a given mode
     */
    getBehaviors(mode) {
        return PROACTIVITY_BEHAVIORS[mode] || PROACTIVITY_BEHAVIORS.BALANCED;
    }

    /**
     * Get mode description for UI
     */
    getModeDescription(mode) {
        return PROACTIVITY_DESCRIPTIONS[mode] || PROACTIVITY_DESCRIPTIONS.BALANCED;
    }

    /**
     * Get all modes with descriptions for UI
     */
    getAllModes() {
        return Object.entries(PROACTIVITY_MODES).map(([key, value]) => ({
            id: value,
            ...PROACTIVITY_DESCRIPTIONS[key],
            behaviors: PROACTIVITY_BEHAVIORS[key]
        }));
    }

    /**
     * Get effective proactivity for a user
     */
    async getEffectiveProactivity(userId, organizationId) {
        const aiSettingsService = await this.getAISettingsService();
        const settings = await aiSettingsService.getEffectiveSettings(userId, organizationId);
        return {
            mode: settings.proactivityMode,
            behaviors: settings.proactivityBehavior,
            description: PROACTIVITY_DESCRIPTIONS[settings.proactivityMode]
        };
    }

    /**
     * Check if a specific behavior is enabled
     */
    async isBehaviorEnabled(userId, organizationId, behaviorKey) {
        const { behaviors } = await this.getEffectiveProactivity(userId, organizationId);
        return behaviors[behaviorKey] || false;
    }

    /**
     * Check if nudges are enabled
     */
    async areNudgesEnabled(userId, organizationId) {
        return this.isBehaviorEnabled(userId, organizationId, 'nudges');
    }

    /**
     * Check if auto-suggestions are enabled
     */
    async areAutoSuggestionsEnabled(userId, organizationId) {
        return this.isBehaviorEnabled(userId, organizationId, 'autoSuggest');
    }

    /**
     * Check if AI can initiate conversations
     */
    async canInitiateConversation(userId, organizationId) {
        return this.isBehaviorEnabled(userId, organizationId, 'initiateConversation');
    }

    /**
     * Determine if a nudge should be shown based on type and user settings
     */
    async shouldShowNudge(userId, organizationId, nudgeType, urgency = 'normal') {
        const { mode, behaviors } = await this.getEffectiveProactivity(userId, organizationId);

        if (!behaviors.nudges) return false;

        // In BALANCED mode, only show high-urgency nudges
        if (mode === 'BALANCED' && urgency !== 'high') {
            // Still show critical nudges
            const criticalNudges = [NUDGE_TYPES.RISK_DETECTED, NUDGE_TYPES.BUDGET_WARNING];
            if (!criticalNudges.includes(nudgeType)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get prompt modifier based on proactivity mode
     */
    getProactivityPromptModifier(mode) {
        const modifiers = {
            REACTIVE: `
You are in REACTIVE mode. Important guidelines:
- Only provide information when explicitly asked
- Do not offer unsolicited suggestions or analysis
- Keep responses focused strictly on the question asked
- Do not mention additional features, next steps, or recommendations unless specifically requested
- Wait for the user to guide the conversation`,

            BALANCED: `
You are in BALANCED mode. Guidelines:
- Provide helpful suggestions when they add clear value
- Offer contextual hints when relevant to the current task
- Include one or two related recommendations if highly relevant
- Let the user lead the conversation direction
- Be helpful but not overwhelming`,

            PROACTIVE: `
You are in PROACTIVE mode. Guidelines:
- Actively identify opportunities to help
- Offer comprehensive suggestions and recommendations
- Point out potential issues or optimizations proactively
- Suggest next steps and related actions
- Provide rich, detailed responses with actionable insights
- Feel free to anticipate user needs and offer relevant information`
        };

        return modifiers[mode] || modifiers.BALANCED;
    }

    /**
     * Calculate engagement score based on user's recent interactions
     * Used to potentially adjust proactivity
     */
    async calculateEngagementScore(userId, organizationId) {
        // This would query recent activity - placeholder implementation
        // Could be used to dynamically adjust proactivity within bounds
        return {
            score: 0.5, // 0-1 scale
            recentInteractions: 0,
            lastInteractionAt: null,
            suggestModeChange: null
        };
    }
}

const aiProactivityEngine = new AIProactivityEngine();
export default aiProactivityEngine;
