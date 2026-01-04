/**
 * Model Router - Dynamic LLM Provider Selection & Fallback
 */

import * as DbPromise from '../../utils/DbPromise.ts';
import { appCache } from '../redis/CacheService.js';
import type { LLMConfigService } from './llmConfigService.js';
import { aiLogger } from './logger.js';

export const TIER_HIERARCHY = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'] as const;
export type Tier = (typeof TIER_HIERARCHY)[number] | 'VISION';

export const CAPABILITY_TIERS: Record<string, Tier> = {
    chat: 'BUDGET',
    chat_simple: 'BUDGET',
    magic_wand: 'BUDGET',
    chat_complex: 'STANDARD',
    report_section: 'STANDARD',
    analysis: 'STANDARD',
    full_report: 'PREMIUM',
    assessment: 'PREMIUM',
    max_mode: 'REASONING',
    strategic: 'REASONING',
    vision: 'VISION',
    coding: 'STANDARD',
    suggestTasks: 'BUDGET',
    validateInitiative: 'STANDARD',
    generateInsights: 'STANDARD',
    buildRoadmap: 'PREMIUM',
};

export const MODEL_PROVIDER_MAP: Record<string, string> = {
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-4-turbo': 'openai',
    'gpt-3.5-turbo': 'openai',
    'o1-preview': 'openai',
    o1: 'openai',
    'o1-mini': 'openai',
    'claude-3-5-sonnet': 'anthropic',
    'claude-3-5-sonnet-20241022': 'anthropic',
    'claude-3-opus': 'anthropic',
    'claude-3-sonnet': 'anthropic',
    'claude-3-haiku': 'anthropic',
    'claude-3-haiku-20240307': 'anthropic',
    'gemini-2.0-flash': 'google',
    'gemini-1.5-flash': 'google',
    'gemini-1.5-pro': 'google',
    'gemini-pro': 'google',
    'deepseek-chat': 'deepseek',
    'deepseek-coder': 'deepseek',
    'qwen-max': 'qwen',
    'qwen-turbo': 'qwen',
    'qwen-plus': 'qwen',
    'command-r': 'cohere',
    'command-r-plus': 'cohere',
    'meta/llama-3.1-70b-instruct': 'nvidia',
    'meta/llama3-8b-instruct': 'nvidia',
    'glm-4-plus': 'zai',
    'glm-4': 'zai',
    'glm-4.6': 'zai',
};

export const TIER_DEFAULTS: Record<string, string> = {
    BUDGET: 'gpt-4o-mini',
    STANDARD: 'gpt-4o',
    PREMIUM: 'gpt-4o',
    REASONING: 'gpt-4o',
    VISION: 'gpt-4o',
};

export const TIER_FALLBACK_CHAINS: Record<string, string[]> = {
    BUDGET: ['gpt-4o-mini', 'deepseek-chat', 'gemini-1.5-flash', 'qwen-turbo', 'glm-4-flash'],
    STANDARD: ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet', 'command-r-plus', 'qwen-max', 'glm-4-plus'],
    PREMIUM: ['gpt-4o', 'claude-3-opus', 'gemini-1.5-pro', 'meta/llama-3.1-405b-instruct', 'glm-4-plus'],
    REASONING: ['o1-preview', 'gpt-4o', 'deepseek-chat', 'claude-3-opus'],
    VISION: ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet', 'qwen-vl-max'],
};

export const TIER_FALLBACKS: Record<string, string> = {
    BUDGET: 'gpt-4o-mini',
    STANDARD: 'gpt-4o-mini',
    PREMIUM: 'gpt-4o',
    REASONING: 'gpt-4o',
    VISION: 'gemini-1.5-pro',
};

type ProviderRow = {
    id: string;
    name?: string;
    provider: string;
    model_id?: string;
    api_key?: string | null;
    endpoint?: string | null;
    markup_multiplier?: number | null;
    priority?: number | null;
    health_status?: string | null;
    is_active?: number | null;
};

type TierAssignmentRow = {
    id: string;
    tier: string;
    priority: number;
    is_active: number;
    provider_id: string;
    name?: string;
    provider?: string;
    model_id?: string;
    health_status?: string | null;
};

type OverrideRow = {
    model_id: string;
    tier?: string;
};

type ProviderConfig = {
    id: string;
    tier: string;
    provider: string;
    apiKey: string | null;
    endpoint: string | null;
    source?: string;
    healthStatus?: string | null;
    originalTier?: string;
    markupMultiplier?: number;
    raw?: ProviderRow | null;
};

type SelectParams = {
    capability?: string;
    tier?: string;
    organizationId?: string;
    options?: { tier?: string };
};

let _llmConfigService: LLMConfigService | null = null;

async function getLLMConfigService(): Promise<LLMConfigService | null> {
    if (!_llmConfigService) {
        try {
            const mod = await import('./llmConfigService.js');
            _llmConfigService = mod.llmConfigService as LLMConfigService;
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.warn('ModelRouter', `LLMConfigService not available: ${err.message}`);
        }
    }
    return _llmConfigService;
}

export class ModelRouter {
    // Distributed cache via Redis (appCache) used instead of local Maps
    // private overrideCache = new Map<string, { value: OverrideRow | null; expiresAt: number }>();
    // private defaultProviderCache: ProviderRow | null = null;

    private subscriptionActive = false;

    private async initSubscription() {
        if (this.subscriptionActive) return;
        this.subscriptionActive = true;

        try {
            await appCache.subscribe('router:config_update', (msg) => {
                aiLogger.info('ModelRouter', `Received invalidation message: ${msg}`);
                this.clearCache().catch((err) => aiLogger.error('ModelRouter', 'Failed to clear cache', err));
            });
        } catch (error) {
            aiLogger.error('ModelRouter', 'Failed to subscribe to updates', error);
            this.subscriptionActive = false;
        }
    }

    async select(params: SelectParams): Promise<ProviderConfig> {
        const { capability, organizationId, options = {} } = params;
        const tier = (options.tier || params.tier || CAPABILITY_TIERS[capability || ''] || 'STANDARD') as Tier;

        aiLogger.info('ModelRouter', `Selecting model for tier: ${tier}, org: ${organizationId || 'global'}`);

        const override = await this.getOrgOverride(organizationId, capability);
        if (override) {
            aiLogger.info('ModelRouter', `Using org override for ${capability}: ${override.model_id}`);
            return this.getProviderConfig(override.model_id, override.tier || tier);
        }

        const availableModels = await this.getModelsForTier(tier, organizationId);
        if (availableModels.length > 0) {
            const selectedModel = await this.selectWithRoundRobin(tier, organizationId, availableModels);
            if (selectedModel) {
                aiLogger.info(
                    'ModelRouter',
                    `Selected via round-robin: ${selectedModel.model_id} (${selectedModel.provider})`,
                );
                return {
                    id: selectedModel.model_id || selectedModel.id,
                    tier,
                    provider: selectedModel.provider,
                    apiKey: selectedModel.api_key || null,
                    endpoint: selectedModel.endpoint || null,
                    source: 'tier_assignment',
                    raw: selectedModel,
                };
            }
        }

        const configService = await getLLMConfigService();
        if (configService) {
            try {
                const fallbackChain = await configService.getFallbackChain(tier);
                for (const providerId of fallbackChain) {
                    const providerConfig = await configService.getProviderConfig(providerId);
                    if (providerConfig && providerConfig.isConfigured && providerConfig.healthStatus !== 'unhealthy') {
                        aiLogger.info('ModelRouter', `Selected ${providerId} from config service for ${tier}`);
                        return {
                            id: providerConfig.model_id || providerConfig.id,
                            tier,
                            provider: providerConfig.provider,
                            apiKey: providerConfig.api_key || null,
                            endpoint: providerConfig.endpoint || null,
                            healthStatus: providerConfig.healthStatus || null,
                        };
                    }
                }
            } catch (error: unknown) {
                const err = error as Error;
                aiLogger.warn('ModelRouter', `LLMConfigService fallback failed: ${err.message}`);
            }
        }

        const defaultProvider = await this.getDefaultProvider();
        if (defaultProvider && defaultProvider.api_key) {
            aiLogger.info(
                'ModelRouter',
                `Using database default: ${defaultProvider.model_id} (${defaultProvider.provider})`,
            );
            return {
                id: defaultProvider.model_id || defaultProvider.id,
                tier,
                provider: defaultProvider.provider,
                apiKey: defaultProvider.api_key || null,
                endpoint: defaultProvider.endpoint || null,
            };
        }

        const model = TIER_DEFAULTS[tier];
        aiLogger.warn('ModelRouter', `Using static fallback: ${model} for tier ${tier}`);
        return this.getProviderConfig(model, tier);
    }

    async getModelsForTier(tier: Tier, organizationId?: string): Promise<ProviderRow[]> {
        let query: string;
        let params: unknown[];

        if (organizationId) {
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

        try {
            return await DbPromise.all<ProviderRow>(query, params, { fallback: false });
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.error('ModelRouter', `Failed to get models for tier ${tier}: ${err.message}`);
            return [];
        }
    }

    async getAllTierAssignments(): Promise<Record<string, TierAssignmentRow[]>> {
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

        try {
            const rows = await DbPromise.all<TierAssignmentRow>(query, [], { fallback: false });
            const grouped: Record<string, TierAssignmentRow[]> = {};
            for (const row of rows || []) {
                if (!grouped[row.tier]) {
                    grouped[row.tier] = [];
                }
                grouped[row.tier].push(row);
            }
            return grouped;
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.error('ModelRouter', `Failed to get tier assignments: ${err.message}`);
            return {};
        }
    }

    async selectWithRoundRobin(
        tier: Tier,
        organizationId: string | undefined,
        availableModels: ProviderRow[],
    ): Promise<ProviderRow | null> {
        if (!availableModels || availableModels.length === 0) {
            return null;
        }
        if (availableModels.length === 1) {
            return availableModels[0];
        }

        const lastUsed = await this.getLastUsedProvider(tier, organizationId);
        const lastIndex = lastUsed ? availableModels.findIndex((model) => model.id === lastUsed) : -1;

        const nextIndex = (lastIndex + 1) % availableModels.length;
        const selectedModel = availableModels[nextIndex];

        await this.updateLastUsedProvider(tier, organizationId, selectedModel.id);

        aiLogger.info(
            'ModelRouter',
            `Round-robin selected: ${selectedModel.name} (index ${nextIndex}/${availableModels.length})`,
        );
        return selectedModel;
    }

    async getLastUsedProvider(tier: Tier, organizationId?: string): Promise<string | null> {
        const query = `
            SELECT last_provider_id 
            FROM tier_round_robin_state 
            WHERE tier = ? AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
        `;
        const row = await DbPromise.get<{ last_provider_id?: string }>(query, [tier, organizationId, organizationId], {
            fallback: true,
        });
        return row?.last_provider_id || null;
    }

    async updateLastUsedProvider(tier: Tier, organizationId: string | undefined, providerId: string): Promise<void> {
        const id = `${organizationId || 'global'}-${tier}`;
        const query = `
            INSERT OR REPLACE INTO tier_round_robin_state (id, organization_id, tier, last_provider_id, last_used_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        try {
            await DbPromise.run(query, [id, organizationId, tier, providerId], { fallback: true });
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.warn('ModelRouter', `Failed to update round-robin state: ${err.message}`);
        }
    }

    async selectFallback(
        tier: Tier,
        excludeModels: string[] = [],
        organizationId: string | null = null,
    ): Promise<ProviderConfig | null> {
        const excludeSet = new Set(excludeModels.map((model) => model.toLowerCase()));

        const sameTierModels = await this.getModelsForTier(tier, organizationId || undefined);
        for (const model of sameTierModels) {
            if (!excludeSet.has((model.model_id || '').toLowerCase())) {
                aiLogger.info('ModelRouter', `Fallback within tier ${tier}: ${model.model_id}`);
                return {
                    id: model.model_id || model.id,
                    tier,
                    provider: model.provider,
                    apiKey: model.api_key || null,
                    endpoint: model.endpoint || null,
                    source: 'fallback_same_tier',
                };
            }
        }

        const tierIndex = TIER_HIERARCHY.indexOf(tier as (typeof TIER_HIERARCHY)[number]);
        for (let i = tierIndex - 1; i >= 0; i--) {
            const fallbackTier = TIER_HIERARCHY[i];
            const fallbackModels = await this.getModelsForTier(fallbackTier, organizationId || undefined);

            for (const model of fallbackModels) {
                if (!excludeSet.has((model.model_id || '').toLowerCase())) {
                    aiLogger.info(
                        'ModelRouter',
                        `Cross-tier fallback from ${tier} to ${fallbackTier}: ${model.model_id}`,
                    );
                    return {
                        id: model.model_id || model.id,
                        tier: fallbackTier,
                        provider: model.provider,
                        apiKey: model.api_key || null,
                        endpoint: model.endpoint || null,
                        source: 'fallback_lower_tier',
                        originalTier: tier,
                    };
                }
            }
        }

        const configService = await getLLMConfigService();
        if (configService) {
            try {
                const excludeProviders = excludeModels.map((model) => this.inferProvider(model));
                const nextProvider = await configService.getNextFallback(excludeProviders, tier);
                if (nextProvider) {
                    aiLogger.info('ModelRouter', `Selected fallback from config service: ${nextProvider.provider}`);
                    return {
                        id: nextProvider.model_id || nextProvider.id,
                        tier,
                        provider: nextProvider.provider,
                        apiKey: nextProvider.api_key || null,
                        endpoint: nextProvider.endpoint || null,
                    };
                }
            } catch (error: unknown) {
                const err = error as Error;
                aiLogger.warn('ModelRouter', `Config service fallback failed: ${err.message}`);
            }
        }

        return this.getAnyActiveProvider(tier, excludeModels);
    }

    async getAnyActiveProvider(tier: Tier, excludeModels: string[] = []): Promise<ProviderConfig | null> {
        const excludeProviders = new Set(excludeModels.map((model) => this.inferProvider(model)));

        const row = await DbPromise.get<ProviderRow>(
            `SELECT * FROM llm_providers 
             WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''
             ORDER BY is_default DESC, priority DESC LIMIT 1`,
            [],
            { fallback: true },
        );

        if (row && !excludeProviders.has(row.provider)) {
            aiLogger.info('ModelRouter', `Ultimate fallback: ${row.provider}`);
            return {
                id: row.model_id || row.id,
                tier,
                provider: row.provider,
                apiKey: row.api_key || null,
                endpoint: row.endpoint || null,
            };
        }

        aiLogger.error('ModelRouter', 'No providers available for fallback');
        return null;
    }

    async assignModelToTier(
        providerId: string,
        tier: Tier,
        priority = 0,
    ): Promise<{ id: string; providerId: string; tier: Tier; priority: number }> {
        const id = `${providerId}-${tier}`;
        const query = `
            INSERT OR REPLACE INTO model_tier_assignments (id, provider_id, tier, priority, is_active, updated_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        `;
        await DbPromise.run(query, [id, providerId, tier, priority], { fallback: false });
        aiLogger.info('ModelRouter', `Assigned provider ${providerId} to tier ${tier} with priority ${priority}`);
        return { id, providerId, tier, priority };
    }

    async removeModelFromTier(providerId: string, tier: Tier): Promise<{ success: true }> {
        const query = `DELETE FROM model_tier_assignments WHERE provider_id = ? AND tier = ?`;
        await DbPromise.run(query, [providerId, tier], { fallback: false });
        aiLogger.info('ModelRouter', `Removed provider ${providerId} from tier ${tier}`);
        return { success: true };
    }

    async updateTierPriority(providerId: string, tier: Tier, priority: number): Promise<{ success: true }> {
        const query = `
            UPDATE model_tier_assignments 
            SET priority = ?, updated_at = CURRENT_TIMESTAMP
            WHERE provider_id = ? AND tier = ?
        `;
        await DbPromise.run(query, [priority, providerId, tier], { fallback: false });
        return { success: true };
    }

    async setOrgProviderEnabled(
        organizationId: string,
        providerId: string,
        isEnabled: boolean,
    ): Promise<{ success: true }> {
        const id = `${organizationId}-${providerId}`;
        const query = `
            INSERT OR REPLACE INTO organization_provider_settings 
            (id, organization_id, provider_id, is_enabled, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        await DbPromise.run(query, [id, organizationId, providerId, isEnabled ? 1 : 0], { fallback: false });
        aiLogger.info('ModelRouter', `Set provider ${providerId} enabled=${isEnabled} for org ${organizationId}`);
        return { success: true };
    }

    async getOrgProviderSettings(
        organizationId: string,
    ): Promise<Array<ProviderRow & { is_enabled_for_org: number; custom_priority?: number }>> {
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
        return DbPromise.all(query, [organizationId], { fallback: true });
    }

    async getProviderConfig(modelId: string, tier: Tier): Promise<ProviderConfig> {
        const providerName = this.inferProvider(modelId);

        let provider = await DbPromise.get<ProviderRow>(
            `SELECT * FROM llm_providers 
             WHERE provider = ? AND is_active = 1 
             AND (model_id = ? OR model_id IS NULL OR model_id = '') 
             LIMIT 1`,
            [providerName, modelId],
            { fallback: true },
        );

        if (!provider) {
            provider = await DbPromise.get<ProviderRow>(
                `SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 LIMIT 1`,
                [providerName],
                { fallback: true },
            );
        }

        if (!provider || !provider.api_key) {
            const envKey = this.getEnvKeyForProvider(providerName);
            const envApiKey = process.env[envKey];
            if (envApiKey) {
                aiLogger.info('ModelRouter', `Using env fallback for ${providerName}`);
                return {
                    id: modelId,
                    tier,
                    provider: providerName,
                    apiKey: envApiKey,
                    endpoint: this.getDefaultEndpoint(providerName),
                    source: 'platform',
                    markupMultiplier: 1.0,
                    raw: null,
                };
            }
        }

        return {
            id: provider?.model_id || modelId,
            tier,
            provider: providerName,
            apiKey: provider?.api_key || null,
            endpoint: provider?.endpoint || this.getDefaultEndpoint(providerName),
            source: provider?.api_key ? 'organization' : 'platform',
            markupMultiplier: provider?.markup_multiplier || 1.0,
            raw: provider || null,
        };
    }

    async getDefaultProvider(): Promise<ProviderRow | null> {
        const CACHE_KEY = 'router:default_provider';

        try {
            const cached = await appCache.get<ProviderRow>(CACHE_KEY);
            if (cached) return cached;
        } catch (err) {
            /* ignore */
        }

        const row = await DbPromise.get<ProviderRow>(
            'SELECT * FROM llm_providers WHERE is_default = 1 AND is_active = 1 LIMIT 1',
            [],
            { fallback: true },
        );

        if (row) {
            await appCache.set(CACHE_KEY, row, 300); // 5 mins
        }
        return row || null;
    }

    async getOrgOverride(organizationId?: string, capability?: string): Promise<OverrideRow | null> {
        if (!organizationId || !capability) return null;

        const CACHE_KEY = `router:override:${organizationId}:${capability}`;

        try {
            const cached = await appCache.get<OverrideRow>(CACHE_KEY);
            if (cached) return cached;
        } catch (err) {
            /* ignore */
        }

        const row = await DbPromise.get<OverrideRow>(
            `SELECT * FROM ai_model_overrides WHERE organization_id = ? AND capability = ?`,
            [organizationId, capability],
            { fallback: true },
        );

        await appCache.set(CACHE_KEY, row || null, 300); // 5 mins

        return row || null;
    }

    getFallbackChain(tier: Tier): string[] {
        return TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS.STANDARD;
    }

    inferProvider(modelId?: string): string {
        if (!modelId) return 'openai';

        const mapped = MODEL_PROVIDER_MAP[modelId];
        if (mapped) return mapped;

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

    getEnvKeyForProvider(provider: string): string {
        const envKeys: Record<string, string> = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            google: 'GOOGLE_API_KEY',
            gemini: 'GOOGLE_API_KEY',
            deepseek: 'DEEPSEEK_API_KEY',
            cohere: 'COHERE_API_KEY',
            nvidia: 'NVIDIA_API_KEY',
            qwen: 'ALIBABA_API_KEY',
            zai: 'ZAI_API_KEY',
        };
        return envKeys[provider] || `${provider.toUpperCase()}_API_KEY`;
    }

    getDefaultEndpoint(provider: string): string | null {
        const endpoints: Record<string, string> = {
            openai: 'https://api.openai.com/v1/chat/completions',
            anthropic: 'https://api.anthropic.com/v1/messages',
            google: 'https://generativelanguage.googleapis.com/v1beta',
            gemini: 'https://generativelanguage.googleapis.com/v1beta',
            deepseek: 'https://api.deepseek.com/chat/completions',
            cohere: 'https://api.cohere.ai/v1/chat',
            nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
            qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
            zai: 'https://api.z.ai/api/paas/v4/chat/completions',
        };
        return endpoints[provider] || null;
    }

    async clearCache(): Promise<void> {
        // Redis cache invalidation
        await appCache.delPattern('router:*');
        aiLogger.info('ModelRouter', 'Cache cleared via pattern match router:*');
    }

    async isProviderConfigured(_providerId: string): Promise<boolean> {
        const config = await this.getProviderConfig(TIER_DEFAULTS.STANDARD, 'STANDARD');
        return !!config?.apiKey;
    }

    async getConfiguredProviders(): Promise<ProviderRow[]> {
        return DbPromise.all(
            `SELECT * FROM llm_providers 
             WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''
             ORDER BY priority DESC, is_default DESC`,
            [],
            { fallback: true },
        );
    }

    async route(
        capabilityOrUserId: string | SelectParams,
        intentOrCapability?: string,
    ): Promise<{
        providerConfig: ProviderRow | { model_id: string; provider: string; markup_multiplier?: number };
        orgId?: string;
        sourceType?: string;
        model: string;
    }> {
        let params: SelectParams = {};

        if (typeof capabilityOrUserId === 'object') {
            params = capabilityOrUserId;
        } else {
            params = {
                capability: intentOrCapability || 'chat',
            };
        }

        params.options = params.options || {};

        const result = await this.select(params);

        return {
            providerConfig: result.raw || {
                model_id: result.id,
                provider: result.provider,
                markup_multiplier: result.markupMultiplier,
            },
            orgId: params.organizationId,
            sourceType: result.source || 'platform',
            model: result.id,
        };
    }
}

export const modelRouter = new ModelRouter();

export default modelRouter;
