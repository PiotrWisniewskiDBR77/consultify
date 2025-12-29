/**
 * Model Router
 * Responsibility: Select the optimal model based on Capability, Tier, and Budget
 * Now with Organization Override support and Multi-Provider Fallback
 */

const db = require('../../database');

// Capability to Tier mapping
const CAPABILITY_TIERS = {
    'chat': 'BUDGET',
    'chat_simple': 'BUDGET',
    'magic_wand': 'BUDGET',
    'chat_complex': 'STANDARD',
    'report_section': 'STANDARD',
    'analysis': 'STANDARD',
    'full_report': 'PREMIUM',
    'assessment': 'PREMIUM',
    'max_mode': 'REASONING',
    'strategic': 'REASONING',
    'vision': 'PREMIUM',
    'coding': 'STANDARD'
};

// Tier to Model defaults - DeepSeek for BUDGET tier
const TIER_DEFAULTS = {
    'BUDGET': 'deepseek-chat',
    'STANDARD': 'gpt-4o',
    'PREMIUM': 'gpt-4o',
    'REASONING': 'o1-preview'  // MAX Mode - Deep reasoning
};

// Fallback chains per tier (ordered by preference)
const TIER_FALLBACK_CHAINS = {
    'BUDGET': ['deepseek-chat', 'qwen-turbo', 'gpt-4o-mini', 'gemini-1.5-flash'],
    'STANDARD': ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'deepseek-chat'],
    'PREMIUM': ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'o1-preview'],
    'REASONING': ['o1-preview', 'o1', 'claude-3-opus', 'gpt-4o'],
    'VISION': ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet']
};

// Fallback if primary model unavailable (simple single fallback for backwards compat)
const TIER_FALLBACKS = {
    'BUDGET': 'gpt-4o-mini',
    'STANDARD': 'gpt-4o-mini',
    'PREMIUM': 'gpt-4o',
    'REASONING': 'gpt-4o'
};

class ModelRouter {
    constructor() {
        this.hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
        this.hasOpenAI = !!process.env.OPENAI_API_KEY;
        this.overrideCache = new Map(); // Simple cache for overrides
    }

    async select(params) {
        const { capability, organizationId, options } = params;

        // 1. Check for Organization Override FIRST
        const override = await this.getOrgOverride(organizationId, capability);
        if (override) {
            console.log(`[ModelRouter] Using org override for ${capability}: ${override.model_id}`);
            return this.getProviderConfig(override.model_id, override.tier || 'CUSTOM');
        }

        // 2. Determine Tier from capability
        let tier = options?.tier || CAPABILITY_TIERS[capability] || 'STANDARD';

        // 3. Select Model based on Tier
        let model = TIER_DEFAULTS[tier];

        // 4. Fallback if DeepSeek not available and it's BUDGET tier
        if (tier === 'BUDGET' && !this.hasDeepSeek && this.hasOpenAI) {
            model = TIER_FALLBACKS[tier];
            console.log(`[ModelRouter] DeepSeek unavailable, falling back to ${model}`);
        }

        // 5. User Override (request-level)
        if (options?.model) {
            model = options.model;
        }

        // 6. Final fallback
        if (!model) model = 'gpt-4o';

        return this.getProviderConfig(model, tier);
    }

    /**
     * Get full provider configuration from database
     */
    async getProviderConfig(modelId, tier) {
        const providerName = this.inferProvider(modelId);

        // Try to find matching provider in DB
        let provider = await new Promise((resolve) => {
            db.get(
                "SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 AND (model_id = ? OR model_id IS NULL OR model_id = '') LIMIT 1",
                [providerName, modelId],
                (err, row) => resolve(row)
            );
        });

        // If not found, try fallback by provider name only
        if (!provider) {
            provider = await new Promise((resolve) => {
                db.get(
                    "SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 LIMIT 1",
                    [providerName],
                    (err, row) => resolve(row)
                );
            });
        }

        return {
            id: modelId,
            tier: tier,
            provider: providerName,
            apiKey: provider?.api_key || null,
            endpoint: provider?.endpoint || null
        };
    }

    /**
     * Get organization-level model override from database
     */
    async getOrgOverride(organizationId, capability) {
        if (!organizationId || !capability) return null;
        if (!db || !db.get) return null;

        // Check cache first (5 minute TTL)
        const cacheKey = `${organizationId}:${capability}`;
        const cached = this.overrideCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.value;
        }

        return new Promise((resolve) => {
            db.get(
                `SELECT * FROM ai_model_overrides WHERE organization_id = ? AND capability = ?`,
                [organizationId, capability],
                (err, row) => {
                    // Cache the result (even if null)
                    this.overrideCache.set(cacheKey, {
                        value: row || null,
                        expiresAt: Date.now() + 5 * 60 * 1000 // 5 min TTL
                    });
                    resolve(err ? null : row);
                }
            );
        });
    }

    /**
     * Clear override cache (call when admin updates overrides)
     */
    clearCache() {
        this.overrideCache.clear();
    }

    /**
     * Get fallback chain for a tier
     */
    getFallbackChain(tier) {
        return TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS['STANDARD'];
    }

    /**
     * Select next available fallback from chain
     * @param {string} tier - Capability tier
     * @param {Array} excludeModels - Models to skip (already failed)
     */
    async selectFallback(tier, excludeModels = []) {
        const chain = this.getFallbackChain(tier);
        
        for (const modelId of chain) {
            if (excludeModels.includes(modelId)) continue;
            
            // Check if we have this model configured and active
            const config = await this.getProviderConfig(modelId, tier);
            if (config && config.apiKey) {
                console.log(`[ModelRouter] Selected fallback: ${modelId} for tier ${tier}`);
                return config;
            }
        }
        
        // No fallback available
        console.warn(`[ModelRouter] No fallback available for tier ${tier}`);
        return null;
    }

    inferProvider(modelId) {
        if (!modelId) return 'openai';
        if (modelId.startsWith('deepseek')) return 'deepseek';
        if (modelId.startsWith('gpt')) return 'openai';
        if (modelId.startsWith('claude')) return 'anthropic';
        if (modelId.startsWith('gemini')) return 'gemini'; // Match DB 'gemini'
        if (modelId.startsWith('o1')) return 'openai';
        return 'openai';
    }
}

module.exports = { ModelRouter, CAPABILITY_TIERS, TIER_DEFAULTS, TIER_FALLBACK_CHAINS };
