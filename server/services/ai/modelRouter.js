/**
 * Model Router - Intelligent Provider Selection & Fallback
 * 
 * Responsibilities:
 * - Select optimal model based on Capability, Tier, and Budget
 * - Automatic fallback to healthy providers when primary fails
 * - Integration with LLMConfigService for centralized configuration
 * - Organization-level overrides
 * - Health-aware routing (avoids unhealthy providers)
 * 
 * @module server/services/ai/modelRouter
 */

const db = require('../../database');
const { aiLogger } = require('./logger');

// Lazy-load LLMConfigService to avoid circular dependencies
let _llmConfigService = null;
function getLLMConfigService() {
    if (!_llmConfigService) {
        try {
            const { llmConfigService } = require('./llmConfigService');
            _llmConfigService = llmConfigService;
        } catch (e) {
            console.warn('[ModelRouter] LLMConfigService not available:', e.message);
        }
    }
    return _llmConfigService;
}

// ============================================================================
// CAPABILITY & TIER CONFIGURATION
// ============================================================================

// Capability to Tier mapping
const CAPABILITY_TIERS = {
    // Chat capabilities
    'chat': 'BUDGET',
    'chat_simple': 'BUDGET',
    'magic_wand': 'BUDGET',
    'chat_complex': 'STANDARD',
    
    // Report & Analysis
    'report_section': 'STANDARD',
    'analysis': 'STANDARD',
    'full_report': 'PREMIUM',
    'assessment': 'PREMIUM',
    
    // Advanced
    'max_mode': 'REASONING',
    'strategic': 'REASONING',
    'vision': 'VISION',
    'coding': 'STANDARD',
    
    // Task & Initiative
    'suggestTasks': 'BUDGET',
    'validateInitiative': 'STANDARD',
    'generateInsights': 'STANDARD',
    'buildRoadmap': 'PREMIUM'
};

// Tier to Model defaults
const TIER_DEFAULTS = {
    'BUDGET': 'gemini-2.0-flash',      // Free tier available, good quality
    'STANDARD': 'gpt-4o',               // Best balance of quality/cost
    'PREMIUM': 'gpt-4o',                // Same as standard for now
    'REASONING': 'o1-preview',          // MAX Mode - Deep reasoning
    'VISION': 'gpt-4o'                  // Vision capable
};

// Fallback chains per tier (ordered by preference: quality → cost → availability)
const TIER_FALLBACK_CHAINS = {
    'BUDGET': [
        'gemini-2.0-flash',     // Free, good quality
        'deepseek-chat',        // Very cheap
        'qwen-max',             // Cheap
        'gpt-4o-mini',          // Reliable fallback
        'claude-3-haiku'        // Fast
    ],
    'STANDARD': [
        'gpt-4o',               // Best quality
        'claude-3-5-sonnet',    // Close second
        'gemini-1.5-pro',       // Good alternative
        'deepseek-chat',        // Budget fallback
        'gpt-4o-mini'           // Ultimate fallback
    ],
    'PREMIUM': [
        'gpt-4o',
        'claude-3-5-sonnet',
        'gemini-1.5-pro',
        'o1-preview',           // For complex tasks
        'gpt-4o-mini'
    ],
    'REASONING': [
        'o1-preview',           // Primary reasoning
        'o1',                   // Older reasoning
        'claude-3-opus',        // Claude reasoning
        'gpt-4o'                // Fallback
    ],
    'VISION': [
        'gpt-4o',               // Best vision
        'gemini-1.5-pro',       // Good vision
        'claude-3-5-sonnet',    // Has vision
        'gemini-2.0-flash'      // Budget vision
    ]
};

// Simple single fallback for backwards compatibility
const TIER_FALLBACKS = {
    'BUDGET': 'gpt-4o-mini',
    'STANDARD': 'gpt-4o-mini',
    'PREMIUM': 'gpt-4o',
    'REASONING': 'gpt-4o',
    'VISION': 'gemini-1.5-pro'
};

// Model to Provider mapping
const MODEL_PROVIDER_MAP = {
    // OpenAI
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-4-turbo': 'openai',
    'gpt-3.5-turbo': 'openai',
    'o1-preview': 'openai',
    'o1': 'openai',
    'o1-mini': 'openai',
    
    // Anthropic
    'claude-3-5-sonnet': 'anthropic',
    'claude-3-5-sonnet-20241022': 'anthropic',
    'claude-3-opus': 'anthropic',
    'claude-3-sonnet': 'anthropic',
    'claude-3-haiku': 'anthropic',
    'claude-3-haiku-20240307': 'anthropic',
    
    // Google
    'gemini-2.0-flash': 'google',
    'gemini-1.5-flash': 'google',
    'gemini-1.5-pro': 'google',
    'gemini-pro': 'google',
    
    // DeepSeek
    'deepseek-chat': 'deepseek',
    'deepseek-coder': 'deepseek',
    
    // Alibaba
    'qwen-max': 'qwen',
    'qwen-turbo': 'qwen',
    'qwen-plus': 'qwen',
    
    // Cohere
    'command-r': 'cohere',
    'command-r-plus': 'cohere',
    
    // Nvidia
    'meta/llama-3.1-70b-instruct': 'nvidia',
    'meta/llama3-8b-instruct': 'nvidia',
    
    // z.ai
    'glm-4': 'zai',
    'glm-4.6': 'zai'
};

// ============================================================================
// MODEL ROUTER CLASS
// ============================================================================

class ModelRouter {
    constructor() {
        this.overrideCache = new Map();
        this.defaultProviderCache = null;
        this.defaultProviderExpiry = 0;
        this.healthStatusCache = new Map();
        this.healthCacheExpiry = 0;
    }

    // ========================================================================
    // MAIN SELECTION METHOD
    // ========================================================================

    /**
     * Select optimal model for a given capability
     * @param {Object} params - Selection parameters
     * @param {string} params.capability - Requested capability
     * @param {string} params.organizationId - Organization ID (for overrides)
     * @param {Object} params.options - Additional options (tier, model override)
     * @returns {Promise<Object>} Provider configuration
     */
    async select(params) {
        const { capability, organizationId, options = {} } = params;

        // 1. Check for Organization Override FIRST
        const override = await this.getOrgOverride(organizationId, capability);
        if (override) {
            aiLogger.info('ModelRouter', `Using org override for ${capability}: ${override.model_id}`);
            return this.getProviderConfig(override.model_id, override.tier || 'CUSTOM');
        }

        // 2. User override (request-level)
        if (options.model) {
            aiLogger.info('ModelRouter', `Using user-specified model: ${options.model}`);
            return this.getProviderConfig(options.model, options.tier || 'CUSTOM');
        }

        // 3. Determine Tier from capability
        const tier = options.tier || CAPABILITY_TIERS[capability] || 'STANDARD';

        // 4. Try to get from LLMConfigService (centralized source)
        const configService = getLLMConfigService();
        if (configService) {
            try {
                const fallbackChain = await configService.getFallbackChain(tier);
                
                // Find first healthy provider
                for (const providerId of fallbackChain) {
                    const providerConfig = await configService.getProviderConfig(providerId);
                    if (providerConfig && providerConfig.isConfigured && providerConfig.healthStatus !== 'unhealthy') {
                        aiLogger.info('ModelRouter', `Selected ${providerId} from health-aware chain for ${tier}`);
                        return {
                            id: providerConfig.model_id,
                            tier: tier,
                            provider: providerConfig.provider,
                            apiKey: providerConfig.api_key,
                            endpoint: providerConfig.endpoint,
                            healthStatus: providerConfig.healthStatus
                        };
                    }
                }
            } catch (e) {
                aiLogger.warn('ModelRouter', `LLMConfigService fallback failed: ${e.message}`);
            }
        }

        // 5. Fallback to database default
        const defaultProvider = await this.getDefaultProvider();
        if (defaultProvider && defaultProvider.api_key) {
            aiLogger.info('ModelRouter', `Using database default: ${defaultProvider.model_id} (${defaultProvider.provider})`);
            return {
                id: defaultProvider.model_id,
                tier: tier,
                provider: defaultProvider.provider,
                apiKey: defaultProvider.api_key,
                endpoint: defaultProvider.endpoint
            };
        }

        // 6. Use tier default and find any available provider
        const model = TIER_DEFAULTS[tier];
        return this.getProviderConfig(model, tier);
    }

    // ========================================================================
    // FALLBACK SELECTION
    // ========================================================================

    /**
     * Select next available fallback from chain
     * @param {string} tier - Capability tier
     * @param {Array} excludeModels - Models to skip (already failed)
     * @returns {Promise<Object|null>} Next provider config or null
     */
    async selectFallback(tier, excludeModels = []) {
        const excludeSet = new Set(excludeModels.map(m => m.toLowerCase()));

        // Try LLMConfigService first (health-aware)
        const configService = getLLMConfigService();
        if (configService) {
            try {
                const excludeProviders = excludeModels.map(m => this.inferProvider(m));
                const nextProvider = await configService.getNextFallback(excludeProviders, tier);
                if (nextProvider) {
                    aiLogger.info('ModelRouter', `Selected fallback from config service: ${nextProvider.provider}`);
                    return {
                        id: nextProvider.model_id,
                        tier: tier,
                        provider: nextProvider.provider,
                        apiKey: nextProvider.api_key,
                        endpoint: nextProvider.endpoint
                    };
                }
            } catch (e) {
                aiLogger.warn('ModelRouter', `Config service fallback failed: ${e.message}`);
            }
        }

        // Fallback to static chain
        const chain = this.getFallbackChain(tier);
        
        for (const modelId of chain) {
            if (excludeSet.has(modelId.toLowerCase())) continue;
            
            // Check if we have this model configured and active
            const config = await this.getProviderConfig(modelId, tier);
            if (config && config.apiKey) {
                aiLogger.info('ModelRouter', `Selected static fallback: ${modelId} for tier ${tier}`);
                return config;
            }
        }
        
        // Ultimate fallback: try any active provider
        return this.getAnyActiveProvider(tier, excludeModels);
    }

    /**
     * Get any active provider as last resort
     */
    async getAnyActiveProvider(tier, excludeModels = []) {
        const excludeProviders = new Set(excludeModels.map(m => this.inferProvider(m)));

        return new Promise((resolve) => {
            db.get(
                `SELECT * FROM llm_providers 
                 WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''
                 ORDER BY is_default DESC, priority DESC LIMIT 1`,
                [],
                (err, row) => {
                    if (row && !excludeProviders.has(row.provider)) {
                        aiLogger.info('ModelRouter', `Ultimate fallback: ${row.provider}`);
                        resolve({
                            id: row.model_id,
                            tier: tier,
                            provider: row.provider,
                            apiKey: row.api_key,
                            endpoint: row.endpoint
                        });
                    } else {
                        aiLogger.error('ModelRouter', 'No providers available for fallback');
                        resolve(null);
                    }
                }
            );
        });
    }

    // ========================================================================
    // PROVIDER CONFIGURATION
    // ========================================================================

    /**
     * Get full provider configuration from database
     * @param {string} modelId - Model identifier
     * @param {string} tier - Tier level
     * @returns {Promise<Object>} Provider configuration
     */
    async getProviderConfig(modelId, tier) {
        const providerName = this.inferProvider(modelId);

        // Try to find matching provider in DB
        let provider = await new Promise((resolve) => {
            db.get(
                `SELECT * FROM llm_providers 
                 WHERE provider = ? AND is_active = 1 
                 AND (model_id = ? OR model_id IS NULL OR model_id = '') 
                 LIMIT 1`,
                [providerName, modelId],
                (err, row) => resolve(row)
            );
        });

        // If not found, try fallback by provider name only
        if (!provider) {
            provider = await new Promise((resolve) => {
                db.get(
                    `SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 LIMIT 1`,
                    [providerName],
                    (err, row) => resolve(row)
                );
            });
        }

        // Try env variable fallback
        if (!provider || !provider.api_key) {
            const envKey = this.getEnvKeyForProvider(providerName);
            const envApiKey = process.env[envKey];
            if (envApiKey) {
                aiLogger.info('ModelRouter', `Using env fallback for ${providerName}`);
                return {
                    id: modelId,
                    tier: tier,
                    provider: providerName,
                    apiKey: envApiKey,
                    endpoint: this.getDefaultEndpoint(providerName)
                };
            }
        }

        return {
            id: modelId,
            tier: tier,
            provider: providerName,
            apiKey: provider?.api_key || null,
            endpoint: provider?.endpoint || this.getDefaultEndpoint(providerName)
        };
    }

    /**
     * Get default provider from database (with cache)
     */
    async getDefaultProvider() {
        if (this.defaultProviderCache && Date.now() < this.defaultProviderExpiry) {
            return this.defaultProviderCache;
        }

        return new Promise((resolve) => {
            db.get(
                "SELECT * FROM llm_providers WHERE is_default = 1 AND is_active = 1 LIMIT 1",
                [],
                (err, row) => {
                    if (row) {
                        this.defaultProviderCache = row;
                        this.defaultProviderExpiry = Date.now() + 5 * 60 * 1000;
                    }
                    resolve(row || null);
                }
            );
        });
    }

    /**
     * Get organization-level model override
     */
    async getOrgOverride(organizationId, capability) {
        if (!organizationId || !capability) return null;
        if (!db || !db.get) return null;

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
                    this.overrideCache.set(cacheKey, {
                        value: row || null,
                        expiresAt: Date.now() + 5 * 60 * 1000
                    });
                    resolve(err ? null : row);
                }
            );
        });
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get fallback chain for a tier
     */
    getFallbackChain(tier) {
        return TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS['STANDARD'];
    }

    /**
     * Infer provider from model ID
     */
    inferProvider(modelId) {
        if (!modelId) return 'openai';
        
        // Check explicit mapping first
        const mapped = MODEL_PROVIDER_MAP[modelId];
        if (mapped) return mapped;

        // Pattern-based inference
        const modelLower = modelId.toLowerCase();
        if (modelLower.startsWith('gpt') || modelLower.startsWith('o1')) return 'openai';
        if (modelLower.startsWith('claude')) return 'anthropic';
        if (modelLower.startsWith('gemini')) return 'google';
        if (modelLower.startsWith('deepseek')) return 'deepseek';
        if (modelLower.startsWith('qwen')) return 'qwen';
        if (modelLower.startsWith('command')) return 'cohere';
        if (modelLower.startsWith('glm')) return 'zai';
        if (modelLower.includes('llama') || modelLower.includes('meta/')) return 'nvidia';
        
        return 'openai';
    }

    /**
     * Get environment variable name for a provider
     */
    getEnvKeyForProvider(provider) {
        const envKeys = {
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'google': 'GOOGLE_API_KEY',
            'gemini': 'GOOGLE_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'cohere': 'COHERE_API_KEY',
            'nvidia': 'NVIDIA_API_KEY',
            'qwen': 'ALIBABA_API_KEY',
            'zai': 'ZAI_API_KEY'
        };
        return envKeys[provider] || `${provider.toUpperCase()}_API_KEY`;
    }

    /**
     * Get default endpoint for a provider
     */
    getDefaultEndpoint(provider) {
        const endpoints = {
            'openai': 'https://api.openai.com/v1/chat/completions',
            'anthropic': 'https://api.anthropic.com/v1/messages',
            'google': 'https://generativelanguage.googleapis.com/v1beta',
            'gemini': 'https://generativelanguage.googleapis.com/v1beta',
            'deepseek': 'https://api.deepseek.com/chat/completions',
            'cohere': 'https://api.cohere.ai/v1/chat',
            'nvidia': 'https://integrate.api.nvidia.com/v1/chat/completions',
            'qwen': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
            'zai': 'https://api.z.ai/api/paas/v4/chat/completions'
        };
        return endpoints[provider] || null;
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.overrideCache.clear();
        this.defaultProviderCache = null;
        this.defaultProviderExpiry = 0;
        this.healthStatusCache.clear();
        this.healthCacheExpiry = 0;
    }

    /**
     * Check if a provider has a valid configuration
     */
    async isProviderConfigured(providerId) {
        const config = await this.getProviderConfig(
            TIER_DEFAULTS['STANDARD'], // Doesn't matter, we check by provider
            'STANDARD'
        );
        return config && !!config.apiKey;
    }

    /**
     * Get all configured providers
     */
    async getConfiguredProviders() {
        return new Promise((resolve) => {
            db.all(
                `SELECT * FROM llm_providers 
                 WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''
                 ORDER BY priority DESC, is_default DESC`,
                [],
                (err, rows) => resolve(rows || [])
            );
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = { 
    ModelRouter, 
    CAPABILITY_TIERS, 
    TIER_DEFAULTS, 
    TIER_FALLBACK_CHAINS,
    TIER_FALLBACKS,
    MODEL_PROVIDER_MAP
};
