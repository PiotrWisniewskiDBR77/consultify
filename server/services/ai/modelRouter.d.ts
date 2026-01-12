declare namespace _default {
    export { ModelRouter };
    export { modelRouter };
    export { CAPABILITY_TIERS };
    export { TIER_DEFAULTS };
    export { TIER_FALLBACK_CHAINS };
    export { TIER_FALLBACKS };
    export { MODEL_PROVIDER_MAP };
    export { TIER_HIERARCHY };
}
export default _default;
export class ModelRouter {
    overrideCache: Map<any, any>;
    defaultProviderCache: any;
    defaultProviderExpiry: number;
    healthStatusCache: Map<any, any>;
    healthCacheExpiry: number;
    tierAssignmentsCache: Map<any, any>;
    tierCacheExpiry: number;
    /**
     * Select optimal model for a given tier or capability
     * User only selects a tier - system handles provider/model selection
     *
     * @param {Object} params - Selection parameters
     * @param {string} params.capability - Requested capability (optional)
     * @param {string} params.tier - User-selected tier (BUDGET, STANDARD, PREMIUM, REASONING)
     * @param {string} params.organizationId - Organization ID (for provider filtering)
     * @param {Object} params.options - Additional options
     * @returns {Promise<Object>} Provider configuration
     */
    select(params: {
        capability: string;
        tier: string;
        organizationId: string;
        options: Object;
    }): Promise<Object>;
    /**
     * Get all models assigned to a tier, filtered by organization settings
     * @param {string} tier - The tier to get models for
     * @param {string} organizationId - Organization ID for filtering
     * @returns {Promise<Array>} Array of available models
     */
    getModelsForTier(tier: string, organizationId: string): Promise<any[]>;
    /**
     * Get all tier assignments (for UI display)
     * @returns {Promise<Object>} Tier assignments grouped by tier
     */
    getAllTierAssignments(): Promise<Object>;
    /**
     * Select a model using round-robin within a tier
     * @param {string} tier - The tier
     * @param {string} organizationId - Organization ID
     * @param {Array} availableModels - List of available models
     * @returns {Promise<Object|null>} Selected model or null
     */
    selectWithRoundRobin(tier: string, organizationId: string, availableModels: any[]): Promise<Object | null>;
    /**
     * Get the last used provider for a tier
     */
    getLastUsedProvider(tier: any, organizationId: any): Promise<any>;
    /**
     * Update the last used provider for a tier
     */
    updateLastUsedProvider(tier: any, organizationId: any, providerId: any): Promise<any>;
    /**
     * Select next available fallback, potentially from a lower tier
     * @param {string} tier - Original tier
     * @param {Array} excludeModels - Models to skip (already failed)
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object|null>} Next provider config or null
     */
    selectFallback(tier: string, excludeModels?: any[], organizationId?: string): Promise<Object | null>;
    /**
     * Get any active provider as last resort
     */
    getAnyActiveProvider(tier: any, excludeModels?: any[]): Promise<any>;
    /**
     * Assign a model to a tier (or update existing assignment)
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier to assign to
     * @param {number} priority - Priority within tier (lower = higher priority)
     * @returns {Promise<Object>} Assignment result
     */
    assignModelToTier(providerId: string, tier: string, priority?: number): Promise<Object>;
    /**
     * Remove a model from a tier
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier to remove from
     */
    removeModelFromTier(providerId: string, tier: string): Promise<any>;
    /**
     * Update priority of a model within a tier
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier
     * @param {number} priority - New priority
     */
    updateTierPriority(providerId: string, tier: string, priority: number): Promise<any>;
    /**
     * Enable/disable a provider for an organization
     * @param {string} organizationId - Organization ID
     * @param {string} providerId - Provider ID
     * @param {boolean} isEnabled - Whether to enable or disable
     */
    setOrgProviderEnabled(organizationId: string, providerId: string, isEnabled: boolean): Promise<any>;
    /**
     * Get organization's provider settings
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} Provider settings
     */
    getOrgProviderSettings(organizationId: string): Promise<any[]>;
    /**
     * Get full provider configuration from database
     */
    getProviderConfig(modelId: any, tier: any): Promise<{
        id: any;
        tier: any;
        provider: any;
        apiKey: any;
        endpoint: any;
        source: string;
        markupMultiplier: any;
        raw: any;
    }>;
    /**
     * Get default provider from database (with cache)
     */
    getDefaultProvider(): Promise<any>;
    /**
     * Get organization-level model override
     */
    getOrgOverride(organizationId: any, capability: any): Promise<any>;
    /**
     * Get fallback chain for a tier (static fallback)
     */
    getFallbackChain(tier: any): any;
    /**
     * Infer provider from model ID
     */
    inferProvider(modelId: any): any;
    /**
     * Get environment variable name for a provider
     */
    getEnvKeyForProvider(provider: any): any;
    /**
     * Get default endpoint for a provider
     */
    getDefaultEndpoint(provider: any): any;
    /**
     * Clear all caches
     */
    clearCache(): void;
    /**
     * Check if a provider has a valid configuration
     */
    isProviderConfigured(providerId: any): Promise<boolean>;
    /**
     * Get all configured providers
     */
    getConfiguredProviders(): Promise<any>;
    /**
     * Legacy alias for select method
     * @deprecated Use select() instead
     */
    route(capabilityOrUserId: any, intentOrCapability: any): Promise<{
        providerConfig: any;
        orgId: any;
        sourceType: any;
        model: any;
    }>;
}
export const modelRouter: ModelRouter;
export namespace CAPABILITY_TIERS {
    let chat: string;
    let chat_simple: string;
    let magic_wand: string;
    let chat_complex: string;
    let report_section: string;
    let analysis: string;
    let full_report: string;
    let assessment: string;
    let max_mode: string;
    let strategic: string;
    let vision: string;
    let coding: string;
    let suggestTasks: string;
    let validateInitiative: string;
    let generateInsights: string;
    let buildRoadmap: string;
}
export namespace TIER_DEFAULTS {
    let BUDGET: string;
    let STANDARD: string;
    let PREMIUM: string;
    let REASONING: string;
    let VISION: string;
}
export namespace TIER_FALLBACK_CHAINS {
    let BUDGET_1: string[];
    export { BUDGET_1 as BUDGET };
    let STANDARD_1: string[];
    export { STANDARD_1 as STANDARD };
    let PREMIUM_1: string[];
    export { PREMIUM_1 as PREMIUM };
    let REASONING_1: string[];
    export { REASONING_1 as REASONING };
    let VISION_1: string[];
    export { VISION_1 as VISION };
}
export namespace TIER_FALLBACKS {
    let BUDGET_2: string;
    export { BUDGET_2 as BUDGET };
    let STANDARD_2: string;
    export { STANDARD_2 as STANDARD };
    let PREMIUM_2: string;
    export { PREMIUM_2 as PREMIUM };
    let REASONING_2: string;
    export { REASONING_2 as REASONING };
    let VISION_2: string;
    export { VISION_2 as VISION };
}
export const MODEL_PROVIDER_MAP: {
    'gpt-4o': string;
    'gpt-4o-mini': string;
    'gpt-4-turbo': string;
    'gpt-3.5-turbo': string;
    'o1-preview': string;
    o1: string;
    'o1-mini': string;
    'claude-3-5-sonnet': string;
    'claude-3-5-sonnet-20241022': string;
    'claude-3-opus': string;
    'claude-3-sonnet': string;
    'claude-3-haiku': string;
    'claude-3-haiku-20240307': string;
    'gemini-2.0-flash': string;
    'gemini-1.5-flash': string;
    'gemini-1.5-pro': string;
    'gemini-pro': string;
    'deepseek-chat': string;
    'deepseek-coder': string;
    'qwen-max': string;
    'qwen-turbo': string;
    'qwen-plus': string;
    'command-r': string;
    'command-r-plus': string;
    'meta/llama-3.1-70b-instruct': string;
    'meta/llama3-8b-instruct': string;
    'glm-4-plus': string;
    'glm-4': string;
    'glm-4.6': string;
};
export const TIER_HIERARCHY: string[];
//# sourceMappingURL=modelRouter.d.ts.map