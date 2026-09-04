/**
 * LLM Configuration Service - Single Source of Truth
 *
 * Centralizes all LLM provider configuration and database sync.
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../../utils/DbPromise.js';
import { aiLogger } from './logger.js';

type ProviderDefinition = {
  id: string;
  name: string;
  envKey: string;
  envKeyAliases?: string[];
  defaultEndpoint: string;
  defaultModel: string;
  costPer1k: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  tier: string;
  requiresJWT?: boolean;
  isLocal?: boolean;
  kind?: 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL';
  provider_type?: 'direct' | 'aggregator' | 'hosted' | 'local' | 'customer_managed';
  origin_vendor?: string;
  execution_regions?: string[];
  allowed_data_classes?: Array<'no_pii' | 'pii' | 'confidential'>;
};

type ProviderRow = {
  id?: string;
  name?: string;
  provider: string;
  description?: string | null;
  api_key?: string | null;
  endpoint?: string | null;
  model_id?: string | null;
  cost_per_1k?: number | null;
  markup_multiplier?: number | null;
  is_active?: number | boolean | null;
  is_default?: number | boolean | null;
  visibility?: string | null;
  priority?: number | null;
  tier?: string | null;
  last_health_check?: string | null;
  health_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProviderConfig = ProviderRow & {
  id: string;
  rowId?: string;
  modelId?: string;
  apiKey?: string | null;
  isDefault?: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  tier: string;
  requiresJWT: boolean;
  isLocal: boolean;
  isConfigured: boolean;
  healthStatus: string;
};

const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    costPer1k: 0.03,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'PREMIUM',
    kind: 'TEXT_LLM',
    provider_type: 'direct',
    origin_vendor: 'openai',
    execution_regions: ['US', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    envKey: 'GOOGLE_API_KEY',
    envKeyAliases: ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_AI_API_KEY'],
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    costPer1k: 0.005,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'BUDGET',
    kind: 'TEXT_LLM',
    provider_type: 'direct',
    origin_vendor: 'google',
    execution_regions: ['US', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    costPer1k: 0.002,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    tier: 'BUDGET',
    kind: 'TEXT_LLM',
    provider_type: 'direct',
    origin_vendor: 'deepseek',
    execution_regions: ['US', 'SG', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
    costPer1k: 0.015,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'PREMIUM',
    kind: 'TEXT_LLM',
    provider_type: 'direct',
    origin_vendor: 'anthropic',
    execution_regions: ['US', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    envKey: 'NVIDIA_API_KEY',
    defaultEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    costPer1k: 0.005,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: false,
    tier: 'STANDARD',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    envKey: 'COHERE_API_KEY',
    defaultEndpoint: 'https://api.cohere.ai/v1/chat',
    defaultModel: 'command-r-plus',
    costPer1k: 0.003,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    tier: 'STANDARD',
  },
  qwen: {
    id: 'qwen',
    name: 'Alibaba Qwen',
    envKey: 'ALIBABA_API_KEY',
    envKeyAliases: ['QWEN_API_KEY'],
    defaultEndpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-max',
    costPer1k: 0.005,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'BUDGET',
  },
  zai: {
    id: 'zai',
    name: 'Zhipu AI (z.ai)',
    envKey: 'ZAI_API_KEY',
    defaultEndpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-plus',
    costPer1k: 0.01,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'STANDARD',
    requiresJWT: true,
    kind: 'TEXT_LLM',
    provider_type: 'direct',
    origin_vendor: 'zhipu',
    execution_regions: ['CN', 'US'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    // NOTE: provider SDK expects a base URL (not the full /chat/completions path)
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    // Use a widely available, stable default via OpenRouter.
    defaultModel: 'openai/gpt-4o',
    costPer1k: 0.008,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    tier: 'STANDARD',
    kind: 'TEXT_LLM',
    provider_type: 'aggregator',
    origin_vendor: 'openrouter',
    execution_regions: ['US', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate (Images)',
    envKey: 'REPLICATE_API_TOKEN',
    envKeyAliases: ['REPLICATE_API_KEY'],
    // Base URL for predictions API
    defaultEndpoint: 'https://api.replicate.com/v1',
    // Default is informational; actual image model used via ai_purpose_assignments.model_id
    defaultModel: 'black-forest-labs/flux-schnell',
    costPer1k: 0,
    supportsStreaming: false,
    supportsVision: false,
    supportsTools: false,
    tier: 'PREMIUM',
    kind: 'IMAGE_MODEL',
    provider_type: 'hosted',
    origin_vendor: 'replicate',
    execution_regions: ['US', 'EU'],
    allowed_data_classes: ['no_pii', 'pii'],
  },
};

const TIER_PRIORITY: Record<string, number> = {
  REASONING: 5,
  PREMIUM: 4,
  STANDARD: 3,
  BUDGET: 2,
  FREE: 1,
};

// NOTE: Some Postgres deployments may carry legacy SQLite-first schemas where boolean flags
// were stored as INTEGER (0/1). Comparing INTEGER to TRUE/FALSE breaks Postgres with:
// "operator does not exist: integer = boolean".
// This helper makes filters tolerant to both representations.
const SQL_TRUTHY_LITERALS = "('1','t','true','y','yes','on')";
function sqlIsTruthy(column: string): string {
  return `LOWER(CAST(${column} AS TEXT)) IN ${SQL_TRUTHY_LITERALS}`;
}

export const DEFAULT_FALLBACK_CHAIN = [
  'openrouter',
  'openai',
  'deepseek',
  'google',
  'anthropic',
  'qwen',
  'cohere',
  'nvidia',
];

function isPlaceholderKey(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  if (!v) return true;
  const u = v.toUpperCase();
  return (
    u.includes('YOUR_') ||
    u.includes('PLACEHOLDER') ||
    u === 'CHANGEME' ||
    u === 'REPLACE_ME' ||
    u === 'YOUR_OPENROUTER_API_KEY_HERE'
  );
}

function getEnvSyncAllowlist(): Set<string> {
  // Default: keep platform in "OpenRouter-only" mode (lowest risk).
  //
  // When migrating to multi-provider routing, enable env sync explicitly:
  // - LLM_ENV_SYNC_ALLOWLIST="openrouter,openai,anthropic,google"
  // or:
  // - LLM_MULTI_PROVIDER=1   (enables a sane default allowlist)
  const raw = String(process.env.LLM_ENV_SYNC_ALLOWLIST || '').trim();
  if (raw) {
    const items = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return new Set(items);
  }

  const multi =
    process.env.LLM_MULTI_PROVIDER === '1' ||
    process.env.LLM_MULTI_PROVIDER === 'true' ||
    process.env.LLM_MULTI_PROVIDER === 'yes';
  if (multi) {
    return new Set([
      'openrouter',
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'zai',
      'replicate',
      'ollama',
    ]);
  }

  return new Set(['openrouter']);
}

function getDisabledProviders(): Set<string> {
  const raw = String(process.env.LLM_DISABLED_PROVIDERS || process.env.AI_DISABLED_PROVIDERS || '')
    .trim()
    .toLowerCase();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export class LLMConfigService {
  private providerCache: Map<string, ProviderConfig>;
  private cacheExpiry: number;
  private cacheTTL: number;
  private healthStatus: Map<string, string>;
  private initialized: boolean;
  private llmProvidersFlagTypeCache: Partial<
    Record<'is_active' | 'is_default', 'boolean' | 'integer' | 'unknown'>
  >;
  constructor() {
    this.providerCache = new Map();
    this.cacheExpiry = 0;
    this.cacheTTL = 5 * 60 * 1000;
    this.healthStatus = new Map();
    this.initialized = false;
    this.llmProvidersFlagTypeCache = {};
  }

  private async getLlmProvidersFlagType(
    column: 'is_active' | 'is_default'
  ): Promise<'boolean' | 'integer' | 'unknown'> {
    const cached = this.llmProvidersFlagTypeCache[column];
    if (cached) return cached;

    try {
      const row = await this.getAsync<{ data_type?: string }>(
        `SELECT data_type
         FROM information_schema.columns
         WHERE table_name = 'llm_providers' AND column_name = ?`,
        [column]
      );
      const dt = String(row?.data_type || '').toLowerCase();
      const resolved = dt === 'boolean' ? 'boolean' : dt.includes('int') ? 'integer' : 'unknown';
      this.llmProvidersFlagTypeCache[column] = resolved;
      return resolved;
    } catch {
      // SQLite / limited-permission DBs may not expose information_schema; fall back to safest default.
      this.llmProvidersFlagTypeCache[column] = 'unknown';
      return 'unknown';
    }
  }

  private async coerceLlmProvidersFlagValue(
    column: 'is_active' | 'is_default',
    value: boolean
  ): Promise<boolean | number> {
    const t = await this.getLlmProvidersFlagType(column);
    if (t === 'integer') return value ? 1 : 0;
    // boolean or unknown → prefer boolean (Postgres boolean columns accept boolean; SQLite will store as 0/1 anyway)
    return value;
  }

  private getProviderCacheKey(
    row: Pick<ProviderRow, 'id' | 'provider' | 'model_id'> | Pick<ProviderConfig, 'provider' | 'id'>
  ): string {
    const provider = String(row.provider || '')
      .trim()
      .toLowerCase();
    const rawId = 'model_id' in row ? row.model_id : row.id;
    const identity = String(rawId || '').trim();
    if (provider && identity) return `${provider}::${identity.toLowerCase()}`;
    if (provider) return provider;
    return identity.toLowerCase();
  }

  private selectPreferredProviderConfig(
    providerKey: string,
    providers: ProviderConfig[]
  ): ProviderConfig | null {
    const normalizedKey = String(providerKey || '')
      .trim()
      .toLowerCase();
    if (!normalizedKey) return null;

    const direct = providers.find(
      (provider) => this.getProviderCacheKey(provider) === normalizedKey
    );
    if (direct) return direct;

    const candidates = providers
      .filter((provider) => {
        const providerName = String(provider.provider || '')
          .trim()
          .toLowerCase();
        const providerModelId = String(provider.model_id || provider.id || '')
          .trim()
          .toLowerCase();
        const rowId = String((provider as any).rowId || '')
          .trim()
          .toLowerCase();
        return (
          providerName === normalizedKey ||
          providerModelId === normalizedKey ||
          rowId === normalizedKey
        );
      })
      .sort((a, b) => {
        const defaultDelta =
          Number(Boolean(b.is_default ?? b.isDefault)) -
          Number(Boolean(a.is_default ?? a.isDefault));
        if (defaultDelta !== 0) return defaultDelta;
        const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
        if (priorityDelta !== 0) return priorityDelta;
        const activeDelta = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
        if (activeDelta !== 0) return activeDelta;
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
      });

    return candidates[0] || null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    aiLogger.info('LLMConfigService', 'Initializing...');

    try {
      await this.ensureTableExists();
      await this.syncDatabaseWithEnv();
      await this.seedTierAssignments();

      await this.runAsync(
        `CREATE INDEX IF NOT EXISTS idx_llm_logs_timestamp ON llm_logs(timestamp)`
      );
      await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_llm_logs_status ON llm_logs(status)`);

      await this.runAsync(
        `CREATE INDEX IF NOT EXISTS idx_llm_health_events_provider_timestamp ON llm_health_events(provider, timestamp)`
      );

      this.initialized = true;
      aiLogger.info('LLMConfigService', 'LLM Config Service initialized with analytics storage');
    } catch (error: unknown) {
      aiLogger.error('LLMConfigService', 'Failed to initialize service', error);
      throw error;
    }
  }

  private runAsync(sql: string, params: unknown[] = []): ReturnType<typeof DbPromise.run> {
    return DbPromise.run(sql, params, { fallback: false });
  }

  private async getAsync<T = ProviderRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    return DbPromise.get<T>(sql, params, { fallback: false });
  }

  private async allAsync<T = ProviderRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return DbPromise.all<T>(sql, params, { fallback: false });
  }

  async ensureTableExists(): Promise<void> {
    // Best-effort add enterprise columns for legacy DBs (SQLite dev / older schemas).
    const addCols = [
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'TEXT_LLM'`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'aggregator'`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS origin_vendor TEXT`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS execution_regions TEXT`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS allowed_data_classes TEXT`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS data_residency_attestation TEXT`,
      `ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS subprocessors_ref TEXT`,
    ];
    for (const stmt of addCols) {
      try {
        await this.runAsync(stmt);
      } catch {
        /* ignore */
      }
    }

    // Ensure boolean columns are correctly typed on Postgres-only deployments.
    // Older SQLite-first schemas used INTEGER 0/1, which conflicts with Postgres boolean normalization.
    try {
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_active DROP DEFAULT`
      );
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_active TYPE BOOLEAN
         USING (CASE WHEN (is_active::text) IN ('1', 't', 'true', 'y', 'yes', 'on') THEN TRUE ELSE FALSE END)`
      );
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_active SET DEFAULT TRUE`
      );
    } catch {
      /* ignore */
    }
    try {
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_default DROP DEFAULT`
      );
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_default TYPE BOOLEAN
         USING (CASE WHEN (is_default::text) IN ('1', 't', 'true', 'y', 'yes', 'on') THEN TRUE ELSE FALSE END)`
      );
      await this.runAsync(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_default SET DEFAULT FALSE`
      );
    } catch {
      /* ignore */
    }

    await this.migrateTable();
  }

  async migrateTable(): Promise<void> {
    const migrations = [
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS last_health_check TEXT',
      "ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown'",
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS last_error_category TEXT',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS last_error_http_status INTEGER',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS last_error_message TEXT',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS last_error_at TEXT',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS updated_at TEXT',
      'ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS description TEXT',
      "ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'STANDARD'",
    ];

    for (const sql of migrations) {
      try {
        await this.runAsync(sql);
      } catch (error: unknown) {
        const err = error as Error;
        if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
          aiLogger.warn('LLMConfigService', `Migration warning: ${err.message}`);
        }
      }
    }

    try {
      await this.runAsync(
        'ALTER TABLE llm_tier_assignments DROP CONSTRAINT IF EXISTS llm_tier_assignments_tier_check'
      );
      await this.runAsync(
        "ALTER TABLE llm_tier_assignments ADD CONSTRAINT llm_tier_assignments_tier_check CHECK ((tier = ANY (ARRAY['BUDGET'::text, 'STANDARD'::text, 'PREMIUM'::text, 'REASONING'::text, 'FREE'::text])))"
      );
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.warn('LLMConfigService', `Tier constraint migration warning: ${err.message}`);
    }
  }

  getApiKeyFromEnv(providerId: string): string | null {
    const definition = PROVIDER_DEFINITIONS[providerId];
    if (!definition) return null;

    let apiKey = process.env[definition.envKey];
    if (apiKey && apiKey.trim()) {
      return apiKey.trim();
    }

    if (definition.envKeyAliases) {
      for (const alias of definition.envKeyAliases) {
        apiKey = process.env[alias];
        if (apiKey && apiKey.trim()) {
          aiLogger.warn(
            'LLMConfigService',
            `Using deprecated env var ${alias} for ${providerId}. Please use ${definition.envKey}`
          );
          return apiKey.trim();
        }
      }
    }

    return null;
  }

  async syncDatabaseWithEnv(): Promise<void> {
    aiLogger.info('LLMConfigService', 'Syncing database with environment definitions...');

    const allowlist = getEnvSyncAllowlist();
    const disabledProviders = getDisabledProviders();

    for (const [providerId, definition] of Object.entries(PROVIDER_DEFINITIONS)) {
      const apiKey = this.getApiKeyFromEnv(providerId);

      const changes: Record<string, unknown> = {
        name: definition.name,
        endpoint: definition.defaultEndpoint,
        model_id: definition.defaultModel,
        cost_per_1k: definition.costPer1k,
        priority: TIER_PRIORITY[definition.tier] || 1,
        tier: definition.tier,
        ...(definition.kind ? { kind: definition.kind } : {}),
        ...(definition.provider_type ? { provider_type: definition.provider_type } : {}),
        ...(definition.origin_vendor ? { origin_vendor: definition.origin_vendor } : {}),
        ...(definition.execution_regions
          ? { execution_regions: JSON.stringify(definition.execution_regions) }
          : {}),
        ...(definition.allowed_data_classes
          ? { allowed_data_classes: JSON.stringify(definition.allowed_data_classes) }
          : {}),
      };

      const existingProvider = await this.getProviderFromDb(providerId);

      if (existingProvider) {
        if (disabledProviders.has(providerId)) {
          changes.is_active = await this.coerceLlmProvidersFlagValue('is_active', false);
        }

        const runtimeEnv = String(
          process.env.APP_ENV ||
            process.env.RAILWAY_ENVIRONMENT_NAME ||
            process.env.RAILWAY_ENVIRONMENT ||
            process.env.ENVIRONMENT ||
            process.env.NODE_ENV ||
            ''
        )
          .trim()
          .toLowerCase();
        const isProdEnv = runtimeEnv === 'production' || runtimeEnv === 'prod';
        const explicitEnvOverride = ['true', '1', 'yes', 'on'].includes(
          String(process.env.LLM_SECRETS_FROM_ENV || '')
            .trim()
            .toLowerCase()
        );
        const allowEnvSecretOverride = !isProdEnv || explicitEnvOverride;

        // In production, DB is the canonical source for secrets by default.
        // In non-prod envs (staging/dev), prefer env keys so rotating `OPENAI_API_KEY` etc.
        // immediately takes effect without manual DB edits.
        const existingKey = String(existingProvider.api_key || '').trim();
        const envKey = String(apiKey || '').trim();
        if (
          allowlist.has(providerId) &&
          envKey &&
          (allowEnvSecretOverride || !existingKey || isPlaceholderKey(existingKey))
        ) {
          changes.api_key = envKey;
        }

        const effectiveKey = String(
          (changes.api_key ?? existingProvider.api_key ?? '') || ''
        ).trim();
        if (!disabledProviders.has(providerId) && allowlist.has(providerId) && effectiveKey) {
          changes.is_active = await this.coerceLlmProvidersFlagValue('is_active', true);
        } else {
          // If a provider has no usable key (env+db empty/placeholder), keep it inactive to avoid
          // noisy health checks / circuit breaker churn.
          if (allowlist.has(providerId)) {
            const existingKeyLooksUsable = existingKey && !isPlaceholderKey(existingKey);
            const envKeyLooksUsable = envKey && !isPlaceholderKey(envKey);
            if (!existingKeyLooksUsable && !envKeyLooksUsable) {
              changes.is_active = await this.coerceLlmProvidersFlagValue('is_active', false);
            }
          }
        }

        // Only OpenRouter is auto-promoted to "default" by env sync.
        // Other providers should not silently become default (multi-default can break routing expectations).
        if (allowlist.has(providerId) && providerId === 'openrouter') {
          changes.is_default = await this.coerceLlmProvidersFlagValue('is_default', true);
        }

        await this.updateProviderInDb(providerId, changes);
        aiLogger.info('LLMConfigService', `Updated provider ${providerId} (Active: ${!!apiKey})`);
      } else {
        await this.createProviderInDb({
          id: `${providerId}-01`,
          provider: providerId,
          api_key: allowlist.has(providerId) ? apiKey || null : null,
          is_active: await this.coerceLlmProvidersFlagValue(
            'is_active',
            allowlist.has(providerId) && !!apiKey
          ),
          is_default: await this.coerceLlmProvidersFlagValue(
            'is_default',
            allowlist.has(providerId) && providerId === 'openrouter'
          ),
          ...changes,
        });
        aiLogger.info('LLMConfigService', `Created provider ${providerId} (Active: ${!!apiKey})`);
      }
    }

    // Ensure a single, deterministic default provider.
    // This repo assumes OpenRouter as the platform default, and multiple defaults can lead
    // to non-deterministic routing (SELECT ... LIMIT 1 without ORDER).
    try {
      const openrouterRow = await this.getProviderFromDb('openrouter');
      const hasOpenrouterKey =
        !!String(openrouterRow?.api_key || '').trim() ||
        !!String(this.getApiKeyFromEnv('openrouter') || '').trim();
      if (hasOpenrouterKey) {
        const notDefault = await this.coerceLlmProvidersFlagValue('is_default', false);
        const isDefault = await this.coerceLlmProvidersFlagValue('is_default', true);
        await this.runAsync('UPDATE llm_providers SET is_default = ? WHERE provider != ?', [
          notDefault,
          'openrouter',
        ]);
        await this.runAsync('UPDATE llm_providers SET is_default = ? WHERE provider = ?', [
          isDefault,
          'openrouter',
        ]);
      }
    } catch {
      // Best-effort only (DB might be initializing).
    }

    this.clearCache();
  }

  async seedTierAssignments(): Promise<void> {
    aiLogger.info('LLMConfigService', 'Seeding tier assignments for active providers...');

    const activeProviders = await this.allAsync<{ id: string; provider: string; tier: string }>(
      `SELECT id, provider, tier FROM llm_providers WHERE ${sqlIsTruthy('is_active')}`
    );

    for (const p of activeProviders || []) {
      const tier = (p.tier || 'STANDARD').toUpperCase();
      const assignmentId = `${p.id}-${tier}`;
      try {
        await this.runAsync(
          `INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (provider_id, tier) DO NOTHING`,
          [assignmentId, p.id, tier, TIER_PRIORITY[tier] || 1, 1]
        );
      } catch (err: unknown) {
        const error = err as Error;
        if (!error.message.includes('UNIQUE constraint')) {
          aiLogger.warn(
            'LLMConfigService',
            `Failed to seed tier assignment for ${p.id}: ${error.message}`
          );
        }
      }
    }
  }

  clearCache(): void {
    this.providerCache.clear();
    this.cacheExpiry = 0;
  }

  async updateProviderTier(providerId: string, tier: string): Promise<boolean> {
    if (!['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'].includes(tier)) {
      throw new Error('Invalid tier');
    }

    await this.updateProviderInDb(providerId, { tier });
    this.clearCache();
    return true;
  }

  async getProviderFromDb(providerId: string): Promise<ProviderRow | null> {
    return this.getAsync('SELECT * FROM llm_providers WHERE provider = ? LIMIT 1', [providerId]);
  }

  async getProviderById(id: string): Promise<ProviderRow | null> {
    return this.getAsync('SELECT * FROM llm_providers WHERE id = ?', [id]);
  }

  async updateProviderInDb(providerId: string, updates: Record<string, unknown>): Promise<number> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(providerId);

    const result = await this.runAsync(
      `UPDATE llm_providers SET ${setClauses.join(', ')} WHERE provider = ?`,
      values
    );
    return result.changes || 0;
  }

  async createProviderInDb(provider: ProviderRow): Promise<string | number | undefined> {
    const result = await this.runAsync(
      `INSERT INTO llm_providers 
            (id, name, provider, api_key, endpoint, model_id, cost_per_1k, is_active, is_default, priority, tier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        provider.id || uuidv4(),
        provider.name,
        provider.provider,
        provider.api_key,
        provider.endpoint,
        provider.model_id,
        provider.cost_per_1k || 0,
        provider.is_active ?? 1,
        provider.is_default ?? 0,
        provider.priority ?? 0,
        provider.tier || 'STANDARD',
      ]
    );
    return result.lastID;
  }

  async getOrganizationProviders(
    organizationId?: string
  ): Promise<Array<ProviderConfig & { is_enabled_for_org?: boolean }>> {
    const providers = await this.getAllProviders();
    if (!organizationId) return providers;

    try {
      const rows = await this.allAsync<{
        provider_id: string;
        is_enabled: number | boolean | null;
        custom_priority?: number | null;
      }>(
        'SELECT provider_id, is_enabled, custom_priority FROM organization_provider_settings WHERE organization_id = ?',
        [organizationId]
      );

      const settingsMap = new Map<string, { enabled: boolean; customPriority?: number | null }>();
      rows.forEach((row) =>
        settingsMap.set(row.provider_id, {
          enabled: row.is_enabled === true || row.is_enabled === 1,
          customPriority: row.custom_priority ?? null,
        })
      );

      return providers.map((provider) => ({
        ...provider,
        is_enabled_for_org: settingsMap.has(provider.id)
          ? settingsMap.get(provider.id)!.enabled
          : true,
        custom_priority: settingsMap.has(provider.id)
          ? settingsMap.get(provider.id)!.customPriority
          : null,
      }));
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('LLMConfigService', `Failed to get org settings: ${err.message}`);
      return providers.map((provider) => ({
        ...provider,
        is_enabled_for_org: true,
        custom_priority: null,
      }));
    }
  }

  async toggleOrganizationProvider(
    organizationId: string,
    providerId: string,
    isEnabled: boolean
  ): Promise<{ success: true }> {
    const id = `${organizationId}-${providerId}`;
    const sql = `
            INSERT INTO organization_provider_settings (id, organization_id, provider_id, is_enabled, updated_at, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(organization_id, provider_id) 
            DO UPDATE SET is_enabled = excluded.is_enabled, updated_at = CURRENT_TIMESTAMP
        `;

    await this.runAsync(sql, [id, organizationId, providerId, isEnabled ? 1 : 0]);
    return { success: true };
  }

  async getAllProviders(useCache = true): Promise<ProviderConfig[]> {
    if (useCache && this.cacheExpiry > Date.now()) {
      return Array.from(this.providerCache.values()).map((provider) => ({
        ...provider,
        healthStatus:
          this.healthStatus.get(this.getProviderCacheKey(provider)) ||
          this.healthStatus.get(provider.provider) ||
          provider.healthStatus ||
          'unknown',
      }));
    }

    const rows = await this.allAsync<ProviderRow>(
      `SELECT * FROM llm_providers WHERE ${sqlIsTruthy('is_active')} ORDER BY priority DESC, is_default DESC`
    );

    this.providerCache.clear();
    for (const row of rows || []) {
      this.providerCache.set(this.getProviderCacheKey(row), this.enrichProviderConfig(row));
    }
    this.cacheExpiry = Date.now() + this.cacheTTL;

    return Array.from(this.providerCache.values());
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    const cachedProviders =
      this.cacheExpiry > Date.now() ? Array.from(this.providerCache.values()) : [];
    if (cachedProviders.length > 0) {
      const cached = this.selectPreferredProviderConfig(providerId, cachedProviders);
      if (cached) return cached;
    }

    // Best-effort initialization so callers can use the service without
    // explicitly calling `initialize()` (e.g. during cold-start or tests).
    // If DB is unavailable, fall back to env-only config.
    try {
      await this.initialize();
      const dbProvider =
        (await this.getProviderById(providerId)) || (await this.getProviderFromDb(providerId));
      if (dbProvider) {
        const enriched = this.enrichProviderConfig(dbProvider);
        this.providerCache.set(this.getProviderCacheKey(dbProvider), enriched);
        return enriched;
      }
      const providers = await this.getAllProviders(false);
      const selected = this.selectPreferredProviderConfig(providerId, providers);
      if (selected) return selected;
    } catch (err: unknown) {
      aiLogger.warn(
        'LLMConfigService',
        `DB-backed provider config unavailable for ${providerId} (falling back to env)`,
        err
      );
    }

    const definition = PROVIDER_DEFINITIONS[providerId];
    const apiKey = this.getApiKeyFromEnv(providerId);

    if (definition && apiKey) {
      return this.enrichProviderConfig({
        provider: providerId,
        api_key: apiKey,
        endpoint: definition.defaultEndpoint,
        model_id: definition.defaultModel,
        cost_per_1k: definition.costPer1k,
      });
    }

    return null;
  }

  async getDefaultProvider(): Promise<ProviderConfig | null> {
    let row = await this.getAsync<ProviderRow>(
      `SELECT * FROM llm_providers WHERE ${sqlIsTruthy('is_default')} AND ${sqlIsTruthy('is_active')} LIMIT 1`
    );
    if (!row) {
      row = await this.getAsync<ProviderRow>(
        `SELECT * FROM llm_providers WHERE ${sqlIsTruthy('is_active')} ORDER BY priority DESC LIMIT 1`
      );
    }
    return row ? this.enrichProviderConfig(row) : null;
  }

  enrichProviderConfig(dbRow: ProviderRow): ProviderConfig {
    const definition = PROVIDER_DEFINITIONS[dbRow.provider] || ({} as ProviderDefinition);

    return {
      ...dbRow,
      rowId: dbRow.id,
      id: dbRow.model_id || dbRow.id || dbRow.provider,
      modelId: dbRow.model_id || dbRow.id || dbRow.provider,
      apiKey: dbRow.api_key,
      isDefault: Boolean(dbRow.is_default),
      supportsStreaming: definition.supportsStreaming ?? true,
      supportsVision: definition.supportsVision ?? false,
      supportsTools: definition.supportsTools ?? false,
      tier: dbRow.tier || definition.tier || 'STANDARD',
      requiresJWT: definition.requiresJWT || false,
      isLocal: definition.isLocal || false,
      isConfigured: !!dbRow.api_key,
      healthStatus:
        this.healthStatus.get(this.getProviderCacheKey(dbRow)) ||
        this.healthStatus.get(dbRow.provider) ||
        dbRow.health_status ||
        'unknown',
    };
  }

  async getFallbackChain(tier = 'STANDARD'): Promise<string[]> {
    const providers = await this.getAllProviders();
    const configured = providers.filter((provider) => provider.isConfigured && provider.is_active);

    const ordered = configured
      .sort((a, b) => {
        const healthScore: Record<string, number> = {
          healthy: 3,
          degraded: 2,
          unknown: 1,
          unhealthy: 0,
        };
        const healthDiff = (healthScore[b.healthStatus] || 1) - (healthScore[a.healthStatus] || 1);
        if (healthDiff !== 0) return healthDiff;

        if (a.tier === tier && b.tier !== tier) return -1;
        if (b.tier === tier && a.tier !== tier) return 1;

        return (b.priority || 0) - (a.priority || 0);
      })
      .map((provider) => String(provider.provider || '').toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(ordered));
  }

  async getNextFallback(
    excludeProviders: string[] = [],
    tier = 'STANDARD'
  ): Promise<ProviderConfig | null> {
    const chain = await this.getFallbackChain(tier);
    const excludeSet = new Set(excludeProviders);

    for (const providerId of chain) {
      if (!excludeSet.has(providerId)) {
        return this.getProviderConfig(providerId);
      }
    }

    return null;
  }
}

export const llmConfigService = new LLMConfigService();
export default llmConfigService;
