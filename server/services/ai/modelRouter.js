/**
 * Model Router - Dynamic LLM Provider Selection & Fallback
 * 
 * NEW ARCHITECTURE (v2):
 * - Models can be assigned to multiple tiers (many-to-many)
 * - Admin enables/disables providers for their organization
 * - Round-robin selection within each tier
 * - Cross-tier fallback when all models in a tier fail
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
// TIER CONFIGURATION
// ============================================================================

// Tier hierarchy for fallback (higher index = better tier)
const TIER_HIERARCHY = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];

// Capability to Tier mapping (used when user doesn't explicitly select a tier)
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

// Model to Provider mapping (for inferring provider from model ID)
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
    'glm-4-plus': 'zai',
    'glm-4': 'zai',
    'glm-4.6': 'zai'
};

// Static fallback defaults (used when DB is empty)
const TIER_DEFAULTS = {
    'BUDGET': 'gpt-4o-mini',
    'STANDARD': 'gpt-4o',
    'PREMIUM': 'gpt-4o',
    'REASONING': 'gpt-4o',
    'VISION': 'gpt-4o'
};

// Static fallback chains (used when DB is empty)
const TIER_FALLBACK_CHAINS = {
    'BUDGET': ['gpt-4o-mini', 'deepseek-chat', 'gemini-1.5-flash', 'qwen-turbo', 'glm-4-flash'],
    'STANDARD': ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet', 'command-r-plus', 'qwen-max', 'glm-4-plus'],
    'PREMIUM': ['gpt-4o', 'claude-3-opus', 'gemini-1.5-pro', 'meta/llama-3.1-405b-instruct', 'glm-4-plus'],
    'REASONING': ['o1-preview', 'gpt-4o', 'deepseek-chat', 'claude-3-opus'],
    'VISION': ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet', 'qwen-vl-max']
};

const TIER_FALLBACKS = {
    'BUDGET': 'gpt-4o-mini',
    'STANDARD': 'gpt-4o-mini',
    'PREMIUM': 'gpt-4o',
    'REASONING': 'gpt-4o',
    'VISION': 'gemini-1.5-pro'
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
        this.tierAssignmentsCache = new Map();
        this.tierCacheExpiry = 0;
    }

    // ========================================================================
    // MAIN SELECTION METHOD (v2 - Dynamic Tier-Based)
    // ========================================================================

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
    async select(params) {
        const { capability, organizationId, options = {} } = params;

        // 1. Determine the tier (user selection or capability mapping)
        const tier = options.tier || params.tier || CAPABILITY_TIERS[capability] || 'STANDARD';
        
        aiLogger.info('ModelRouter', `Selecting model for tier: ${tier}, org: ${organizationId || 'global'}`);

        // 2. Check for Organization Override (specific capability override)
        const override = await this.getOrgOverride(organizationId, capability);
        if (override) {
            aiLogger.info('ModelRouter', `Using org override for ${capability}: ${override.model_id}`);
            return this.getProviderConfig(override.model_id, override.tier || tier);
        }

        // 3. Get available models for this tier (filtered by org settings)
        const availableModels = await this.getModelsForTier(tier, organizationId);
        
        if (availableModels.length > 0) {
            // 4. Select model using round-robin within the tier
            const selectedModel = await this.selectWithRoundRobin(tier, organizationId, availableModels);
            
            if (selectedModel) {
                aiLogger.info('ModelRouter', `Selected via round-robin: ${selectedModel.model_id} (${selectedModel.provider})`);
                return {
                    id: selectedModel.model_id,
                    tier: tier,
                    provider: selectedModel.provider,
                    apiKey: selectedModel.api_key,
                    endpoint: selectedModel.endpoint,
                    source: 'tier_assignment',
                    raw: selectedModel
                };
            }
        }

        // 5. Fallback: Try LLMConfigService
        const configService = getLLMConfigService();
        if (configService) {
            try {
                const fallbackChain = await configService.getFallbackChain(tier);
                for (const providerId of fallbackChain) {
                    const providerConfig = await configService.getProviderConfig(providerId);
                    if (providerConfig && providerConfig.isConfigured && providerConfig.healthStatus !== 'unhealthy') {
                        aiLogger.info('ModelRouter', `Selected ${providerId} from config service for ${tier}`);
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

        // 6. Fallback to database default
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

        // 7. Ultimate fallback: Use static defaults
        const model = TIER_DEFAULTS[tier];
        aiLogger.warn('ModelRouter', `Using static fallback: ${model} for tier ${tier}`);
        return this.getProviderConfig(model, tier);
    }

    // ========================================================================
    // TIER-BASED MODEL RETRIEVAL
    // ========================================================================

    /**
     * Get all models assigned to a tier, filtered by organization settings
     * @param {string} tier - The tier to get models for
     * @param {string} organizationId - Organization ID for filtering
     * @returns {Promise<Array>} Array of available models
     */
    async getModelsForTier(tier, organizationId) {
        return new Promise((resolve) => {
            let query;
            let params;

            if (organizationId) {
                // Get models for tier, filtered by org-enabled providers
                query = `
                    SELECT p.*, mta.priority as tier_priority
                    FROM llm_providers p
                    INNER JOIN model_tier_assignments mta ON p.id = mta.provider_id
                    LEFT JOIN organization_provider_settings ops ON p.id = ops.provider_id AND ops.organization_id = ?
                    WHERE mta.tier = ?
                      AND mta.is_active = 1
                      AND p.is_active = 1
                      AND p.api_key IS NOT NULL
                      AND p.api_key != ''
                      AND (ops.is_enabled IS NULL OR ops.is_enabled = 1)
                      AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                    ORDER BY COALESCE(ops.custom_priority, mta.priority), p.priority
                `;
                params = [organizationId, tier];
            } else {
                // Global: Get all models for tier
                query = `
                    SELECT p.*, mta.priority as tier_priority
                    FROM llm_providers p
                    INNER JOIN model_tier_assignments mta ON p.id = mta.provider_id
                    WHERE mta.tier = ?
                      AND mta.is_active = 1
                      AND p.is_active = 1
                      AND p.api_key IS NOT NULL
                      AND p.api_key != ''
                      AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                    ORDER BY mta.priority, p.priority
                `;
                params = [tier];
            }

            db.all(query, params, (err, rows) => {
                if (err) {
                    aiLogger.error('ModelRouter', `Failed to get models for tier ${tier}: ${err.message}`);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get all tier assignments (for UI display)
     * @returns {Promise<Object>} Tier assignments grouped by tier
     */
    async getAllTierAssignments() {
        return new Promise((resolve) => {
            const query = `
                SELECT 
                    mta.id,
                    mta.tier,
                    mta.priority,
                    mta.is_active,
                    p.id as provider_id,
                    p.name,
                    p.provider,
                    p.model_id,
                    p.health_status
                FROM model_tier_assignments mta
                INNER JOIN llm_providers p ON mta.provider_id = p.id
                WHERE p.is_active = 1
                ORDER BY mta.tier, mta.priority
            `;

            db.all(query, [], (err, rows) => {
                if (err) {
                    aiLogger.error('ModelRouter', `Failed to get tier assignments: ${err.message}`);
                    resolve({});
                } else {
                    // Group by tier
                    const grouped = {};
                    for (const row of (rows || [])) {
                        if (!grouped[row.tier]) {
                            grouped[row.tier] = [];
                        }
                        grouped[row.tier].push(row);
                    }
                    resolve(grouped);
                }
            });
        });
    }

    // ========================================================================
    // ROUND-ROBIN SELECTION
    // ========================================================================

    /**
     * Select a model using round-robin within a tier
     * @param {string} tier - The tier
     * @param {string} organizationId - Organization ID
     * @param {Array} availableModels - List of available models
     * @returns {Promise<Object|null>} Selected model or null
     */
    async selectWithRoundRobin(tier, organizationId, availableModels) {
        if (!availableModels || availableModels.length === 0) {
            return null;
        }

        if (availableModels.length === 1) {
            return availableModels[0];
        }

        // Get last used provider for this tier/org combo
        const lastUsed = await this.getLastUsedProvider(tier, organizationId);
        
        // Find the index of the last used provider
        let lastIndex = -1;
        if (lastUsed) {
            lastIndex = availableModels.findIndex(m => m.id === lastUsed);
        }

        // Select next provider in round-robin fashion
        const nextIndex = (lastIndex + 1) % availableModels.length;
        const selectedModel = availableModels[nextIndex];

        // Update round-robin state
        await this.updateLastUsedProvider(tier, organizationId, selectedModel.id);

        aiLogger.info('ModelRouter', `Round-robin selected: ${selectedModel.name} (index ${nextIndex}/${availableModels.length})`);
        return selectedModel;
    }

    /**
     * Get the last used provider for a tier
     */
    async getLastUsedProvider(tier, organizationId) {
        return new Promise((resolve) => {
            const query = `
                SELECT last_provider_id 
                FROM tier_round_robin_state 
                WHERE tier = ? AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
            `;
            db.get(query, [tier, organizationId, organizationId], (err, row) => {
                resolve(row?.last_provider_id || null);
            });
        });
    }

    /**
     * Update the last used provider for a tier
     */
    async updateLastUsedProvider(tier, organizationId, providerId) {
        return new Promise((resolve) => {
            const id = `${organizationId || 'global'}-${tier}`;
            const query = `
                INSERT OR REPLACE INTO tier_round_robin_state (id, organization_id, tier, last_provider_id, last_used_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            db.run(query, [id, organizationId, tier, providerId], (err) => {
                if (err) {
                    aiLogger.warn('ModelRouter', `Failed to update round-robin state: ${err.message}`);
                }
                resolve();
            });
        });
    }

    // ========================================================================
    // CROSS-TIER FALLBACK
    // ========================================================================

    /**
     * Select next available fallback, potentially from a lower tier
     * @param {string} tier - Original tier
     * @param {Array} excludeModels - Models to skip (already failed)
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object|null>} Next provider config or null
     */
    async selectFallback(tier, excludeModels = [], organizationId = null) {
        const excludeSet = new Set(excludeModels.map(m => m.toLowerCase()));

        // 1. First try remaining models in the same tier
        const sameTierModels = await this.getModelsForTier(tier, organizationId);
        for (const model of sameTierModels) {
            if (!excludeSet.has(model.model_id.toLowerCase())) {
                aiLogger.info('ModelRouter', `Fallback within tier ${tier}: ${model.model_id}`);
                return {
                    id: model.model_id,
                    tier: tier,
                    provider: model.provider,
                    apiKey: model.api_key,
                    endpoint: model.endpoint,
                    source: 'fallback_same_tier'
                };
            }
        }

        // 2. Try lower tiers (cross-tier fallback)
        const tierIndex = TIER_HIERARCHY.indexOf(tier);
        for (let i = tierIndex - 1; i >= 0; i--) {
            const fallbackTier = TIER_HIERARCHY[i];
            const fallbackModels = await this.getModelsForTier(fallbackTier, organizationId);
            
            for (const model of fallbackModels) {
                if (!excludeSet.has(model.model_id.toLowerCase())) {
                    aiLogger.info('ModelRouter', `Cross-tier fallback from ${tier} to ${fallbackTier}: ${model.model_id}`);
                    return {
                        id: model.model_id,
                        tier: fallbackTier,
                        provider: model.provider,
                        apiKey: model.api_key,
                        endpoint: model.endpoint,
                        source: 'fallback_lower_tier',
                        originalTier: tier
                    };
                }
            }
        }

        // 3. Try LLMConfigService
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

        // 4. Ultimate fallback: any active provider
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
    // TIER ASSIGNMENT MANAGEMENT (SuperAdmin)
    // ========================================================================

    /**
     * Assign a model to a tier (or update existing assignment)
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier to assign to
     * @param {number} priority - Priority within tier (lower = higher priority)
     * @returns {Promise<Object>} Assignment result
     */
    async assignModelToTier(providerId, tier, priority = 0) {
        return new Promise((resolve, reject) => {
            const id = `${providerId}-${tier}`;
            const query = `
                INSERT OR REPLACE INTO model_tier_assignments (id, provider_id, tier, priority, is_active, updated_at)
                VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            `;
            db.run(query, [id, providerId, tier, priority], function(err) {
                if (err) {
                    aiLogger.error('ModelRouter', `Failed to assign model to tier: ${err.message}`);
                    reject(err);
                } else {
                    aiLogger.info('ModelRouter', `Assigned provider ${providerId} to tier ${tier} with priority ${priority}`);
                    resolve({ id, providerId, tier, priority });
                }
            });
        });
    }

    /**
     * Remove a model from a tier
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier to remove from
     */
    async removeModelFromTier(providerId, tier) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM model_tier_assignments WHERE provider_id = ? AND tier = ?`;
            db.run(query, [providerId, tier], function(err) {
                if (err) {
                    reject(err);
                } else {
                    aiLogger.info('ModelRouter', `Removed provider ${providerId} from tier ${tier}`);
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Update priority of a model within a tier
     * @param {string} providerId - LLM provider ID
     * @param {string} tier - Tier
     * @param {number} priority - New priority
     */
    async updateTierPriority(providerId, tier, priority) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE model_tier_assignments 
                SET priority = ?, updated_at = CURRENT_TIMESTAMP
                WHERE provider_id = ? AND tier = ?
            `;
            db.run(query, [priority, providerId, tier], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    // ========================================================================
    // ORGANIZATION PROVIDER SETTINGS (Admin)
    // ========================================================================

    /**
     * Enable/disable a provider for an organization
     * @param {string} organizationId - Organization ID
     * @param {string} providerId - Provider ID
     * @param {boolean} isEnabled - Whether to enable or disable
     */
    async setOrgProviderEnabled(organizationId, providerId, isEnabled) {
        return new Promise((resolve, reject) => {
            const id = `${organizationId}-${providerId}`;
            const query = `
                INSERT OR REPLACE INTO organization_provider_settings 
                (id, organization_id, provider_id, is_enabled, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            db.run(query, [id, organizationId, providerId, isEnabled ? 1 : 0], function(err) {
                if (err) {
                    reject(err);
                } else {
                    aiLogger.info('ModelRouter', `Set provider ${providerId} enabled=${isEnabled} for org ${organizationId}`);
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Get organization's provider settings
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} Provider settings
     */
    async getOrgProviderSettings(organizationId) {
        return new Promise((resolve) => {
            const query = `
                SELECT 
                    p.*,
                    COALESCE(ops.is_enabled, 1) as is_enabled_for_org,
                    ops.custom_priority
                FROM llm_providers p
                LEFT JOIN organization_provider_settings ops 
                    ON p.id = ops.provider_id AND ops.organization_id = ?
                WHERE p.is_active = 1
                ORDER BY p.priority
            `;
            db.all(query, [organizationId], (err, rows) => {
                resolve(rows || []);
            });
        });
    }

    // ========================================================================
    // PROVIDER CONFIGURATION
    // ========================================================================

    /**
     * Get full provider configuration from database
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
                    endpoint: this.getDefaultEndpoint(providerName),
                    source: 'platform',
                    markupMultiplier: 1.0,
                    raw: null
                };
            }
        }

        return {
            id: provider?.model_id || modelId,
            tier: tier,
            provider: providerName,
            apiKey: provider?.api_key || null,
            endpoint: provider?.endpoint || this.getDefaultEndpoint(providerName),
            source: provider?.api_key ? 'organization' : 'platform',
            markupMultiplier: provider?.markup_multiplier || 1.0,
            raw: provider
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
     * Get fallback chain for a tier (static fallback)
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
        this.tierAssignmentsCache.clear();
        this.tierCacheExpiry = 0;
    }

    /**
     * Check if a provider has a valid configuration
     */
    async isProviderConfigured(providerId) {
        const config = await this.getProviderConfig(
            TIER_DEFAULTS['STANDARD'],
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

    /**
     * Legacy alias for select method
     * @deprecated Use select() instead
     */
    async route(capabilityOrUserId, intentOrCapability) {
        let params = {};

        if (typeof capabilityOrUserId === 'object') {
            params = capabilityOrUserId;
        } else {
            params = {
                capability: intentOrCapability || 'chat',
                userId: capabilityOrUserId
            };
        }

        params.options = params.options || {};

        const result = await this.select(params);

        return {
            providerConfig: result.raw || {
                model_id: result.id,
                provider: result.provider,
                markup_multiplier: result.markupMultiplier
            },
            orgId: params.organizationId,
            sourceType: result.source || 'platform',
            model: result.id
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instance
const modelRouter = new ModelRouter();

module.exports = {
    ModelRouter,
    modelRouter,
    CAPABILITY_TIERS,
    TIER_DEFAULTS,
    TIER_FALLBACK_CHAINS,
    TIER_FALLBACKS,
    MODEL_PROVIDER_MAP,
    TIER_HIERARCHY
};
