/**
 * Feature Flags Configuration
 * 
 * Centralized feature toggles for the application.
 * Can be overridden by environment variables.
 */

export interface FeatureFlags {
    ENABLE_ACTION_EXECUTION: boolean;
    ENABLE_ACTION_DECISIONS: boolean;
    ENABLE_METRICS_DASHBOARD: boolean;
    ENABLE_AI_COACH: boolean;
    ENABLE_HELP_SYSTEM: boolean;
}

const flags: FeatureFlags = {
    // Enable execution of AI-proposed actions (Dangerous)
    ENABLE_ACTION_EXECUTION: process.env.ENABLE_ACTION_EXECUTION === 'true' || false,

    // Enable human decision recording for AI actions
    ENABLE_ACTION_DECISIONS: process.env.ENABLE_ACTION_DECISIONS !== 'false', // Default true

    // Enable metrics dashboard
    ENABLE_METRICS_DASHBOARD: process.env.ENABLE_METRICS_DASHBOARD !== 'false', // Default true

    // Enable AI Coach guidance
    ENABLE_AI_COACH: process.env.ENABLE_AI_COACH !== 'false', // Default true

    // Enable self-serve help system
    ENABLE_HELP_SYSTEM: process.env.ENABLE_HELP_SYSTEM !== 'false' // Default true
};

export default flags;

