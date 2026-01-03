/**
 * LLM Configuration Service - Single Source of Truth
 *
 * Centralizes all LLM provider configuration and database sync.
 */

import { v4 as uuidv4 } from 'uuid';
import { aiLogger } from './logger.js';
import * as DbPromise from '../../utils/DbPromise.js';

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
        tier: 'BUDGET'
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
        tier: 'BUDGET'
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
        tier: 'BUDGET'
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic Claude',
        envKey: 'ANTHROPIC_API_KEY',
        defaultEndpoint: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-3-5-sonnet-20241022',
        costPer1k: 0.015,
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        tier: 'PREMIUM'
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
        tier: 'STANDARD'
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
        tier: 'STANDARD'
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
        tier: 'BUDGET'
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
        requiresJWT: true
    },
    ollama: {
        id: 'ollama',
        name: 'Ollama (Local)',
        envKey: 'OLLAMA_BASE_URL',
        defaultEndpoint: 'http://localhost:11434/api/chat',
        defaultModel: 'llama2',
        costPer1k: 0,
        supportsStreaming: true,
        supportsVision: false,
        supportsTools: false,
        tier: 'FREE',
        isLocal: true
    }
};

const TIER_PRIORITY: Record<string, number> = {
    REASONING: 5,
    PREMIUM: 4,
    STANDARD: 3,
    BUDGET: 2,
    FREE: 1
};

export const DEFAULT_FALLBACK_CHAIN = ['openai', 'deepseek', 'google', 'anthropic', 'qwen', 'cohere', 'nvidia'];

export class LLMConfigService {
    private providerCache: Map<string, ProviderConfig>;
    private cacheExpiry: number;
    private cacheTTL: number;
    private healthStatus: Map<string, string>;
    private initialized: boolean;
    constructor() {
        this.providerCache = new Map();
        this.cacheExpiry = 0;
        this.cacheTTL = 5 * 60 * 1000;
        this.healthStatus = new Map();
        this.initialized = false;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        aiLogger.info('LLMConfigService', 'Initializing...');

        try {
            await this.ensureTableExists();
            await this.syncDatabaseWithEnv();

            await this.runAsync(`
                CREATE TABLE IF NOT EXISTS llm_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trace_id TEXT,
                    provider TEXT,
                    model TEXT,
                    status TEXT,
                    latency_ms INTEGER,
                    tokens_in INTEGER,
                    tokens_out INTEGER,
                    cost REAL,
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_llm_logs_timestamp ON llm_logs(timestamp)`);
            await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_llm_logs_status ON llm_logs(status)`);

            this.initialized = true;
            aiLogger.info('LLMConfigService', 'LLM Config Service initialized with analytics storage');
        } catch (error) {
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
        const sql = `
            CREATE TABLE IF NOT EXISTS llm_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                description TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                markup_multiplier REAL DEFAULT 1.0,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                visibility TEXT DEFAULT 'public',
                priority INTEGER DEFAULT 0,
                tier TEXT DEFAULT 'STANDARD',
                last_health_check TEXT,
                health_status TEXT DEFAULT 'unknown',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await this.runAsync(sql);

        const orgSettingsSql = `
            CREATE TABLE IF NOT EXISTS organization_llm_settings (
                organization_id TEXT,
                provider_id TEXT,
                is_enabled INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (organization_id, provider_id)
            )
        `;

        await this.runAsync(orgSettingsSql);
        await this.migrateTable();
    }

    async migrateTable(): Promise<void> {
        const migrations = [
            'ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 0',
            'ALTER TABLE llm_providers ADD COLUMN last_health_check TEXT',
            'ALTER TABLE llm_providers ADD COLUMN health_status TEXT DEFAULT \'unknown\'',
            'ALTER TABLE llm_providers ADD COLUMN updated_at TEXT',
            'ALTER TABLE llm_providers ADD COLUMN description TEXT',
            'ALTER TABLE llm_providers ADD COLUMN tier TEXT DEFAULT \'STANDARD\''
        ];

        for (const sql of migrations) {
            try {
                await this.runAsync(sql);
            } catch (error) {
                const err = error as Error;
                if (!err.message.includes('duplicate column')) {
                    aiLogger.warn('LLMConfigService', `Migration warning: ${err.message}`);
                }
            }
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

        const definedProviderIds = new Set(Object.keys(PROVIDER_DEFINITIONS));

        for (const [providerId, definition] of Object.entries(PROVIDER_DEFINITIONS)) {
            const apiKey = this.getApiKeyFromEnv(providerId);

            const changes: Record<string, unknown> = {
                name: definition.name,
                endpoint: definition.defaultEndpoint,
                model_id: definition.defaultModel,
                cost_per_1k: definition.costPer1k,
                priority: TIER_PRIORITY[definition.tier] || 1,
                tier: definition.tier
            };

            const existingProvider = await this.getProviderFromDb(providerId);

            if (existingProvider) {
                if (apiKey) {
                    changes.api_key = apiKey;
                    changes.is_active = 1;
                } else {
                    changes.is_active = 0;
                }

                await this.updateProviderInDb(providerId, changes);
                aiLogger.info('LLMConfigService', `Updated provider ${providerId} (Active: ${!!apiKey})`);
            } else {
                await this.createProviderInDb({
                    id: `${providerId}-01`,
                    provider: providerId,
                    api_key: apiKey || null,
                    is_active: apiKey ? 1 : 0,
                    is_default: definition.id === 'google' ? 1 : 0,
                    ...changes
                });
                aiLogger.info('LLMConfigService', `Created provider ${providerId} (Active: ${!!apiKey})`);
            }
        }

        const rows = await this.allAsync<{ provider: string }>('SELECT provider FROM llm_providers');
        for (const row of rows || []) {
            if (!definedProviderIds.has(row.provider)) {
                await this.updateProviderInDb(row.provider, { is_active: 0 });
                aiLogger.warn('LLMConfigService', `Deactivated orphan provider: ${row.provider}`);
            }
        }

        this.clearCache();
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
                provider.tier || 'STANDARD'
            ]
        );
        return result.lastID;
    }

    async getOrganizationProviders(organizationId?: string): Promise<Array<ProviderConfig & { is_enabled_for_org?: boolean }>> {
        const providers = await this.getAllProviders();
        if (!organizationId) return providers;

        try {
            const rows = await this.allAsync<{ provider_id: string; is_enabled: number }>(
                'SELECT provider_id, is_enabled FROM organization_llm_settings WHERE organization_id = ?',
                [organizationId]
            );

            const settingsMap = new Map<string, boolean>();
            rows.forEach(row => settingsMap.set(row.provider_id, row.is_enabled === 1));

            return providers.map(provider => ({
                ...provider,
                is_enabled_for_org: settingsMap.has(provider.id)
                    ? settingsMap.get(provider.id)
                    : true
            }));
        } catch (error) {
            const err = error as Error;
            aiLogger.error('LLMConfigService', `Failed to get org settings: ${err.message}`);
            return providers.map(provider => ({ ...provider, is_enabled_for_org: true }));
        }
    }

    async toggleOrganizationProvider(organizationId: string, providerId: string, isEnabled: boolean): Promise<{ success: true }> {
        const sql = `
            INSERT INTO organization_llm_settings (organization_id, provider_id, is_enabled, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(organization_id, provider_id) 
            DO UPDATE SET is_enabled = excluded.is_enabled
        `;

        await this.runAsync(sql, [organizationId, providerId, isEnabled ? 1 : 0]);
        return { success: true };
    }

    async getAllProviders(useCache = true): Promise<ProviderConfig[]> {
        if (useCache && this.cacheExpiry > Date.now()) {
            return Array.from(this.providerCache.values()).map(provider => ({
                ...provider,
                healthStatus: this.healthStatus.get(provider.provider) || provider.healthStatus || 'unknown'
            }));
        }

        const rows = await this.allAsync<ProviderRow>(
            'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY priority DESC, is_default DESC'
        );

        this.providerCache.clear();
        for (const row of rows || []) {
            this.providerCache.set(row.provider, this.enrichProviderConfig(row));
        }
        this.cacheExpiry = Date.now() + this.cacheTTL;

        return Array.from(this.providerCache.values());
    }

    async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
        if (this.providerCache.has(providerId) && this.cacheExpiry > Date.now()) {
            return this.providerCache.get(providerId) || null;
        }

        const dbProvider = await this.getProviderFromDb(providerId);
        if (dbProvider) {
            const enriched = this.enrichProviderConfig(dbProvider);
            this.providerCache.set(providerId, enriched);
            return enriched;
        }

        const definition = PROVIDER_DEFINITIONS[providerId];
        const apiKey = this.getApiKeyFromEnv(providerId);

        if (definition && apiKey) {
            return this.enrichProviderConfig({
                provider: providerId,
                api_key: apiKey,
                endpoint: definition.defaultEndpoint,
                model_id: definition.defaultModel,
                cost_per_1k: definition.costPer1k
            });
        }

        return null;
    }

    async getDefaultProvider(): Promise<ProviderConfig | null> {
        let row = await this.getAsync<ProviderRow>(
            'SELECT * FROM llm_providers WHERE is_default = 1 AND is_active = 1 LIMIT 1'
        );
        if (!row) {
            row = await this.getAsync<ProviderRow>(
                'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY priority DESC LIMIT 1'
            );
        }
        return row ? this.enrichProviderConfig(row) : null;
    }

    enrichProviderConfig(dbRow: ProviderRow): ProviderConfig {
        const definition = PROVIDER_DEFINITIONS[dbRow.provider] || ({} as ProviderDefinition);

        return {
            ...dbRow,
            id: dbRow.model_id || dbRow.id || dbRow.provider,
            supportsStreaming: definition.supportsStreaming ?? true,
            supportsVision: definition.supportsVision ?? false,
            supportsTools: definition.supportsTools ?? false,
            tier: dbRow.tier || definition.tier || 'STANDARD',
            requiresJWT: definition.requiresJWT || false,
            isLocal: definition.isLocal || false,
            isConfigured: !!dbRow.api_key,
            healthStatus: this.healthStatus.get(dbRow.provider) || 'unknown'
        };
    }

    async getFallbackChain(tier = 'STANDARD'): Promise<string[]> {
        const providers = await this.getAllProviders();
        const configured = providers.filter(provider => provider.isConfigured && provider.is_active);

        return configured
            .sort((a, b) => {
                const healthScore: Record<string, number> = {
                    healthy: 3,
                    degraded: 2,
                    unknown: 1,
                    unhealthy: 0
                };
                const healthDiff = (healthScore[b.healthStatus] || 1) - (healthScore[a.healthStatus] || 1);
                if (healthDiff !== 0) return healthDiff;

                if (a.tier === tier && b.tier !== tier) return -1;
                if (b.tier === tier && a.tier !== tier) return 1;

                return (b.priority || 0) - (a.priority || 0);
            })
            .map(provider => provider.provider);
    }

    async getNextFallback(excludeProviders: string[] = [], tier = 'STANDARD'): Promise<ProviderConfig | null> {
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
