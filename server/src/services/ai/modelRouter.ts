/**
 * Model Router - Dynamic LLM Provider Selection & Fallback
 */

import * as DbPromise from '../../utils/DbPromise.js';
import { appCache } from '../redis/CacheService.js';
import type { LLMConfigService } from './llmConfigService.js';
import { aiLogger } from './logger.js';
import { modelMeetsRequirements, type ModelRequirements } from './modelCapabilities.js';

export const TIER_HIERARCHY = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'] as const;
export type Tier = (typeof TIER_HIERARCHY)[number] | 'VISION';

export const CAPABILITY_TIERS: Record<string, Tier> = {
  chat: 'BUDGET',
  chat_simple: 'BUDGET',
  magic_wand: 'BUDGET',
  chat_confirm: 'BUDGET',
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
  // OpenRouter is our single stable provider; model ids are routed through it.
  // (We keep this map mainly for legacy non-namespaced ids.)
  'gpt-4o': 'openrouter',
  'gpt-4o-mini': 'openrouter',
  'o1-preview': 'openrouter',
  'o1-mini': 'openrouter',
  'claude-3-5-sonnet': 'openrouter',
  'claude-3-5-sonnet-20241022': 'openrouter',
  'claude-3-haiku': 'openrouter',
  'gemini-2.0-flash': 'openrouter',
};

export const TIER_DEFAULTS: Record<string, string> = {
  BUDGET: 'openai/gpt-4o-mini',
  STANDARD: 'openai/gpt-4o',
  PREMIUM: 'anthropic/claude-3.5-sonnet',
  REASONING: 'openai/o1-mini',
  VISION: 'openai/gpt-4o',
};

export const TIER_FALLBACK_CHAINS: Record<string, string[]> = {
  // OpenRouter-only fallbacks (all are OpenRouter model ids)
  BUDGET: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku'],
  STANDARD: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
  PREMIUM: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o'],
  REASONING: ['openai/o1-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
  VISION: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
};

export const TIER_FALLBACKS: Record<string, string> = {
  BUDGET: 'openai/gpt-4o-mini',
  STANDARD: 'openai/gpt-4o-mini',
  PREMIUM: 'anthropic/claude-3.5-sonnet',
  REASONING: 'openai/o1-mini',
  VISION: 'openai/gpt-4o',
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
  requirements?: ModelRequirements;
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
        this.clearCache().catch((err) =>
          aiLogger.error('ModelRouter', 'Failed to clear cache', err)
        );
      });
    } catch (error) {
      aiLogger.error('ModelRouter', 'Failed to subscribe to updates', error);
      this.subscriptionActive = false;
    }
  }

  async select(params: SelectParams): Promise<ProviderConfig> {
    const { capability, organizationId, options = {}, requirements } = params;
    const tier = (options.tier ||
      params.tier ||
      CAPABILITY_TIERS[capability || ''] ||
      'STANDARD') as Tier;

    aiLogger.info(
      'ModelRouter',
      `Selecting model for tier: ${tier}, org: ${organizationId || 'global'}`
    );

    const override = await this.getOrgOverride(organizationId, capability);
    if (override) {
      if (modelMeetsRequirements(override.model_id, requirements)) {
        aiLogger.info('ModelRouter', `Using org override for ${capability}: ${override.model_id}`);
        return this.getProviderConfig(override.model_id, (override.tier || tier) as Tier);
      }
      aiLogger.warn(
        'ModelRouter',
        `Org override model does not meet requirements (${capability}): ${override.model_id}`
      );
    }

    const availableModelsRaw = await this.getModelsForTier(tier, organizationId);
    const availableModelsFilteredByProvider = availableModelsRaw.filter(
      (m) => String(m.provider || '').toLowerCase() === 'openrouter'
    );
    const availableModels = requirements
      ? availableModelsFilteredByProvider.filter((m) =>
          modelMeetsRequirements(String((m as any).model_id || m.id || ''), requirements)
        )
      : availableModelsFilteredByProvider;

    if (availableModels.length > 0) {
      const selectedModel = await this.selectWithRoundRobin(tier, organizationId, availableModels);
      if (selectedModel) {
        aiLogger.info(
          'ModelRouter',
          `Selected via round-robin: ${selectedModel.model_id} (${selectedModel.provider})`
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
          if (
            providerConfig &&
            providerConfig.isConfigured &&
            providerConfig.healthStatus !== 'unhealthy' &&
            modelMeetsRequirements(
              String(providerConfig.model_id || providerConfig.id || ''),
              requirements
            )
          ) {
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
    if (
      defaultProvider &&
      String(defaultProvider.provider || '').toLowerCase() === 'openrouter' &&
      defaultProvider.api_key &&
      modelMeetsRequirements(
        String(defaultProvider.model_id || defaultProvider.id || ''),
        requirements
      )
    ) {
      aiLogger.info(
        'ModelRouter',
        `Using database default: ${defaultProvider.model_id} (${defaultProvider.provider})`
      );
      return {
        id: defaultProvider.model_id || defaultProvider.id,
        tier,
        provider: defaultProvider.provider,
        apiKey: defaultProvider.api_key || null,
        endpoint: defaultProvider.endpoint || null,
      };
    }

    // Static fallback (OpenRouter-only)
    const staticCandidates = [TIER_DEFAULTS[tier], ...(TIER_FALLBACK_CHAINS[tier] || [])];
    const staticPick = staticCandidates.find((m) =>
      modelMeetsRequirements(String(m || ''), requirements)
    );
    if (!staticPick) {
      throw new Error(
        `No model satisfies requirements for tier ${tier} (capability=${capability || 'n/a'})`
      );
    }
    aiLogger.warn('ModelRouter', `Using static fallback: ${staticPick} for tier ${tier}`);
    return this.getProviderConfig(staticPick, tier);
  }

  async getModelsForTier(tier: Tier, organizationId?: string): Promise<ProviderRow[]> {
    let query: string;
    let params: unknown[];

    if (organizationId) {
      query = `
                SELECT p.*, mta.priority as tier_priority
                FROM llm_providers p
                INNER JOIN llm_tier_assignments mta ON p.id = mta.provider_id
                LEFT JOIN organization_provider_settings ops ON p.id = ops.provider_id AND ops.organization_id = ?
                WHERE mta.tier = ?
                  AND mta.is_active = true
                  AND p.is_active = 1
                  AND p.api_key IS NOT NULL
                  AND p.api_key != ''
                  AND (ops.is_enabled IS NULL OR ops.is_enabled = 1)
                  AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                ORDER BY COALESCE(ops.custom_priority, mta.priority), p.cost_per_1k, p.priority
            `;
      params = [organizationId, tier];
    } else {
      query = `
                SELECT p.*, mta.priority as tier_priority
                FROM llm_providers p
                INNER JOIN llm_tier_assignments mta ON p.id = mta.provider_id
                WHERE mta.tier = ?
                  AND mta.is_active = true
                  AND p.is_active = 1
                  AND p.api_key IS NOT NULL
                  AND p.api_key != ''
                  AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                ORDER BY mta.priority, p.cost_per_1k, p.priority
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
            FROM llm_tier_assignments mta
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
    availableModels: ProviderRow[]
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
      `Round-robin selected: ${selectedModel.name} (index ${nextIndex}/${availableModels.length})`
    );
    return selectedModel;
  }

  async getLastUsedProvider(tier: Tier, organizationId?: string): Promise<string | null> {
    // Split queries: Postgres can't infer type of "$3 IS NULL" when $3 is null
    const query =
      organizationId == null
        ? `SELECT last_provider_id FROM tier_round_robin_state WHERE tier = ? AND organization_id IS NULL`
        : `SELECT last_provider_id FROM tier_round_robin_state WHERE tier = ? AND organization_id = ?`;
    const params = organizationId == null ? [tier] : [tier, organizationId];
    const row = await DbPromise.get<{ last_provider_id?: string }>(query, params, {
      fallback: true,
    });
    return row?.last_provider_id || null;
  }

  async updateLastUsedProvider(
    tier: Tier,
    organizationId: string | undefined,
    providerId: string
  ): Promise<void> {
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
    organizationId: string | null = null
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
            `Cross-tier fallback from ${tier} to ${fallbackTier}: ${model.model_id}`
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
          aiLogger.info(
            'ModelRouter',
            `Selected fallback from config service: ${nextProvider.provider}`
          );
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

  async getAnyActiveProvider(
    tier: Tier,
    excludeModels: string[] = []
  ): Promise<ProviderConfig | null> {
    const excludeProviders = new Set(excludeModels.map((model) => this.inferProvider(model)));

    const row = await DbPromise.get<ProviderRow>(
      `SELECT * FROM llm_providers 
             WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''
             ORDER BY is_default DESC, priority DESC LIMIT 1`,
      [],
      { fallback: true }
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
    priority = 0
  ): Promise<{ id: string; providerId: string; tier: Tier; priority: number }> {
    const id = `${providerId}-${tier}`;
    const query = `
            INSERT OR REPLACE INTO llm_tier_assignments (id, provider_id, tier, priority, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
    await DbPromise.run(query, [id, providerId, tier, priority, 1], { fallback: false });
    aiLogger.info(
      'ModelRouter',
      `Assigned provider ${providerId} to tier ${tier} with priority ${priority}`
    );
    return { id, providerId, tier, priority };
  }

  async removeModelFromTier(providerId: string, tier: Tier): Promise<{ success: true }> {
    const query = `DELETE FROM llm_tier_assignments WHERE provider_id = ? AND tier = ?`;
    await DbPromise.run(query, [providerId, tier], { fallback: false });
    aiLogger.info('ModelRouter', `Removed provider ${providerId} from tier ${tier}`);
    return { success: true };
  }

  async updateTierPriority(
    providerId: string,
    tier: Tier,
    priority: number
  ): Promise<{ success: true }> {
    const query = `
            UPDATE llm_tier_assignments 
            SET priority = ?, updated_at = CURRENT_TIMESTAMP
            WHERE provider_id = ? AND tier = ?
        `;
    await DbPromise.run(query, [priority, providerId, tier], { fallback: false });
    return { success: true };
  }

  async setOrgProviderEnabled(
    organizationId: string,
    providerId: string,
    isEnabled: boolean
  ): Promise<{ success: true }> {
    const id = `${organizationId}-${providerId}`;
    const query = `
            INSERT OR REPLACE INTO organization_provider_settings 
            (id, organization_id, provider_id, is_enabled, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
    await DbPromise.run(query, [id, organizationId, providerId, isEnabled ? 1 : 0], {
      fallback: false,
    });
    aiLogger.info(
      'ModelRouter',
      `Set provider ${providerId} enabled=${isEnabled} for org ${organizationId}`
    );
    return { success: true };
  }

  async getOrgProviderSettings(
    organizationId: string
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

    const normalizeOpenRouterModelId = (id: string): string => {
      const raw = String(id || '').trim();
      if (!raw) return raw;
      if (raw.includes('/') && !raw.includes('://')) return raw;
      const lower = raw.toLowerCase();
      if (lower === 'gpt-4o') return 'openai/gpt-4o';
      if (lower === 'gpt-4o-mini') return 'openai/gpt-4o-mini';
      if (lower === 'o1-preview') return 'openai/o1-preview';
      if (lower === 'o1-mini' || lower === 'o1') return 'openai/o1-mini';
      if (lower.startsWith('claude')) return `anthropic/${raw}`;
      if (lower.startsWith('gemini')) return `google/${raw}`;
      return raw;
    };

    const requestedModelId = providerName === 'openrouter' ? normalizeOpenRouterModelId(modelId) : modelId;

    let provider = await DbPromise.get<ProviderRow>(
      `SELECT * FROM llm_providers 
             WHERE provider = ? AND is_active = 1 
             AND (model_id = ? OR model_id IS NULL OR model_id = '') 
             LIMIT 1`,
      [providerName, requestedModelId],
      { fallback: true }
    );

    if (!provider) {
      provider = await DbPromise.get<ProviderRow>(
        `SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 LIMIT 1`,
        [providerName],
        { fallback: true }
      );
    }

    if (!provider || !provider.api_key) {
      const envKey = this.getEnvKeyForProvider(providerName);
      const envApiKey = process.env[envKey];
      if (envApiKey) {
        aiLogger.info('ModelRouter', `Using env fallback for ${providerName}`);
        return {
          id: requestedModelId,
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
      id:
        providerName === 'openrouter'
          ? normalizeOpenRouterModelId(String(provider?.model_id || requestedModelId))
          : (provider?.model_id || requestedModelId),
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
      { fallback: true }
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
      { fallback: true }
    );

    await appCache.set(CACHE_KEY, row || null, 300); // 5 mins

    return row || null;
  }

  getFallbackChain(tier: Tier): string[] {
    return TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS.STANDARD;
  }

  inferProvider(modelId?: string): string {
    if (!modelId) return 'openrouter';

    // OpenRouter uses namespaced model IDs like "openai/gpt-4o".
    // Treat any "org/model" id as OpenRouter unless it is a URL.
    if (modelId.includes('/') && !modelId.includes('://')) {
      return 'openrouter';
    }

    const mapped = MODEL_PROVIDER_MAP[modelId];
    if (mapped) return mapped;

    const modelLower = modelId.toLowerCase();
    if (
      modelLower.startsWith('gpt') ||
      modelLower.startsWith('o1') ||
      modelLower.startsWith('claude') ||
      modelLower.startsWith('gemini')
    ) {
      return 'openrouter';
    }

    return 'openrouter';
  }

  getEnvKeyForProvider(provider: string): string {
    const envKeys: Record<string, string> = {
      openrouter: 'OPENROUTER_API_KEY',
    };
    return envKeys[provider] || `${provider.toUpperCase()}_API_KEY`;
  }

  getDefaultEndpoint(provider: string): string | null {
    const endpoints: Record<string, string> = {
      // Base URL (not the /chat/completions path) — matches our llmService OpenRouter client usage.
      openrouter: 'https://openrouter.ai/api/v1',
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
      { fallback: true }
    );
  }

  async route(
    capabilityOrUserId: string | SelectParams,
    intentOrCapability?: string
  ): Promise<{
    providerConfig:
      | ProviderRow
      | { model_id: string; provider: string; markup_multiplier?: number };
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
