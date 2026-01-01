/**
 * LLM Configuration Service - Single Source of Truth
 * 
 * Centralizes all LLM provider configuration, eliminating scattered
 * process.env references and multiple configuration sources.
 * 
 * Features:
 * - Unified environment variable naming
 * - Database synchronization
 * - Provider health tracking
 * - Automatic fallback configuration
 * - Startup validation
 * 
 * @module server/services/ai/llmConfigService
 */

const db = require('../../database');
const { aiLogger } = require('./logger');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// PROVIDER DEFINITIONS - Single Source of Truth
// ============================================================================

/**
 * Canonical provider definitions with unified environment variable names
 * This is THE authoritative list of all supported providers
 */
const PROVIDER_DEFINITIONS = {
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
        tier: 'PREMIUM'
    },
    google: {
        id: 'google',
        name: 'Google Gemini',
        envKey: 'GOOGLE_API_KEY',
        // Legacy aliases for backward compatibility
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
        // Legacy alias
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
        defaultModel: 'glm-4',
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

// Tier priority for fallback selection (higher = better)
const TIER_PRIORITY = {
    'PREMIUM': 4,
    'STANDARD': 3,
    'BUDGET': 2,
    'FREE': 1
};

// Default fallback chain
const DEFAULT_FALLBACK_CHAIN = ['google', 'deepseek', 'openai', 'anthropic', 'qwen', 'cohere', 'nvidia'];

// ============================================================================
// LLM CONFIG SERVICE CLASS
// ============================================================================

class LLMConfigService {
    constructor() {
        this.providerCache = new Map();
        this.cacheExpiry = 0;
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.healthStatus = new Map();
        this.initialized = false;
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the service - should be called on server startup
     */
    async initialize() {
        if (this.initialized) return;

        aiLogger.info('LLMConfigService', 'Initializing...');

        // Assign DB instance
        this.db = db;

        try {
            // Ensure database table exists
            await this.ensureTableExists();

            // Sync environment variables with database
            await this.syncDatabaseWithEnv();

            // Create LLM logs table for analytics
            await this.runAsync(`
                CREATE TABLE IF NOT EXISTS llm_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trace_id TEXT,
                    provider TEXT,
                    model TEXT,
                    status TEXT, -- 'success', 'error'
                    latency_ms INTEGER,
                    tokens_in INTEGER,
                    tokens_out INTEGER,
                    cost REAL,
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Index for faster analytics
            await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_llm_logs_timestamp ON llm_logs(timestamp)`);
            await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_llm_logs_status ON llm_logs(status)`);

            this.initialized = true;
            aiLogger.info('LLMConfigService', 'LLM Config Service initialized with analytics storage');
        } catch (error) {
            aiLogger.error('LLMConfigService', 'Failed to initialize service', error);
            throw error;
        }
    }

    // Database Promise Wrappers
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    allAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Ensure llm_providers and organization_llm_settings tables exist
     */
    async ensureTableExists() {
        return new Promise((resolve, reject) => {
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
                    last_health_check TEXT,
                    health_status TEXT DEFAULT 'unknown',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `;

            db.run(sql, (err) => {
                if (err) {
                    aiLogger.error('LLMConfigService', `Table creation failed: ${err.message}`);
                    reject(err);
                } else {
                    // Create organization settings table
                    const orgSettingsSql = `
                        CREATE TABLE IF NOT EXISTS organization_llm_settings (
                            organization_id TEXT,
                            provider_id TEXT,
                            is_enabled INTEGER DEFAULT 1,
                            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (organization_id, provider_id)
                        )
                    `;

                    db.run(orgSettingsSql, (err2) => {
                        if (err2) {
                            aiLogger.error('LLMConfigService', `Org settings table creation failed: ${err2.message}`);
                            reject(err2);
                        } else {
                            // Run migrations
                            this.migrateTable().then(resolve).catch(resolve);
                        }
                    });
                }
            });
        });
    }

    /**
     * Migrate table to add new columns
     */
    async migrateTable() {
        const migrations = [
            'ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 0',
            'ALTER TABLE llm_providers ADD COLUMN last_health_check TEXT',
            'ALTER TABLE llm_providers ADD COLUMN health_status TEXT DEFAULT \'unknown\'',
            'ALTER TABLE llm_providers ADD COLUMN updated_at TEXT',
            'ALTER TABLE llm_providers ADD COLUMN description TEXT'
        ];

        for (const sql of migrations) {
            await new Promise((resolve) => {
                db.run(sql, (err) => {
                    if (err) aiLogger.warn('LLMConfigService', `Migration warning (might be expected): ${err.message}`);
                    resolve();
                });
            });
        }
    }

    // ========================================================================
    // ENVIRONMENT VARIABLE HANDLING
    // ========================================================================

    /**
     * Get API key from environment, checking all aliases
     * @param {string} providerId - Provider identifier
     * @returns {string|null} API key or null
     */
    getApiKeyFromEnv(providerId) {
        const definition = PROVIDER_DEFINITIONS[providerId];
        if (!definition) return null;

        // Check primary env key
        let apiKey = process.env[definition.envKey];
        if (apiKey && apiKey.trim()) {
            return apiKey.trim();
        }

        // Check aliases for backward compatibility
        if (definition.envKeyAliases) {
            for (const alias of definition.envKeyAliases) {
                apiKey = process.env[alias];
                if (apiKey && apiKey.trim()) {
                    aiLogger.warn('LLMConfigService',
                        `Using deprecated env var ${alias} for ${providerId}. Please use ${definition.envKey}`);
                    return apiKey.trim();
                }
            }
        }

        return null;
    }

    /**
     * Sync database providers with environment variables and code definitions
     * Enforces active/inactive state based on env vars
     */
    async syncDatabaseWithEnv() {
        aiLogger.info('LLMConfigService', 'Syncing database with environment definitions...');

        const definedProviderIds = new Set(Object.keys(PROVIDER_DEFINITIONS));

        // 1. Upsert Defined Providers
        for (const [providerId, definition] of Object.entries(PROVIDER_DEFINITIONS)) {
            const apiKey = this.getApiKeyFromEnv(providerId);

            // Common updates from code definition (Code is Truth for these fields)
            const changes = {
                name: definition.name,
                endpoint: definition.defaultEndpoint,
                model_id: definition.defaultModel,
                cost_per_1k: definition.costPer1k,
                priority: TIER_PRIORITY[definition.tier] || 1
            };

            // Check if provider exists in database
            const existingProvider = await this.getProviderFromDb(providerId);

            if (existingProvider) {
                // If we have an ENV key, strictly enforce it and activate
                if (apiKey) {
                    changes.api_key = apiKey;
                    changes.is_active = 1;
                } else {
                    // Strict Sync: If definition exists but no Env Key, deactivate.
                    changes.is_active = 0;
                }

                await this.updateProviderInDb(providerId, changes);
                aiLogger.info('LLMConfigService', `Updated provider ${providerId} (Active: ${!!apiKey})`);
            } else {
                // Create new provider
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

        // 2. Deactivate Oprhans (Providers in DB but not in Code)
        await new Promise((resolve) => {
            db.all('SELECT provider FROM llm_providers', [], async (err, rows) => {
                if (err || !rows) return resolve();

                for (const row of rows) {
                    if (!definedProviderIds.has(row.provider)) {
                        // This is an orphan (e.g., removed provider type)
                        await this.updateProviderInDb(row.provider, { is_active: 0 });
                        aiLogger.warn('LLMConfigService', `Deactivated orphan provider: ${row.provider}`);
                    }
                }
                resolve();
            });
        });

        // Clear cache after sync
        this.clearCache();
    }

    // ========================================================================
    // DATABASE OPERATIONS
    // ========================================================================

    /**
     * Get provider from database by provider type
     */
    async getProviderFromDb(providerId) {
        return new Promise((resolve) => {
            db.get(
                'SELECT * FROM llm_providers WHERE provider = ? LIMIT 1',
                [providerId],
                (err, row) => resolve(err ? null : row)
            );
        });
    }

    /**
     * Get provider by ID from database
     */
    async getProviderById(id) {
        return new Promise((resolve) => {
            db.get(
                'SELECT * FROM llm_providers WHERE id = ?',
                [id],
                (err, row) => resolve(err ? null : row)
            );
        });
    }

    /**
     * Update provider in database
     */
    async updateProviderInDb(providerId, updates) {
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }

        setClauses.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(providerId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE llm_providers SET ${setClauses.join(', ')} WHERE provider = ?`,
                values,
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    /**
     * Create provider in database
     */
    async createProviderInDb(provider) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO llm_providers 
                (id, name, provider, api_key, endpoint, model_id, cost_per_1k, is_active, is_default, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    provider.priority ?? 0
                ],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // ========================================================================
    // ORGANIZATION MANAGEMENT
    // ========================================================================

    /**
     * Get providers for a specific organization (including enabled/disabled status)
     */
    async getOrganizationProviders(organizationId) {
        const providers = await this.getAllProviders();
        if (!organizationId) return providers;

        return new Promise((resolve, reject) => {
            db.all(
                'SELECT provider_id, is_enabled FROM organization_llm_settings WHERE organization_id = ?',
                [organizationId],
                (err, rows) => {
                    if (err) {
                        aiLogger.error('LLMConfigService', `Failed to get org settings: ${err.message}`);
                        // Fallback to all providers enabled
                        resolve(providers.map(p => ({ ...p, is_enabled_for_org: true })));
                        return;
                    }

                    const settingsMap = new Map();
                    rows.forEach(r => settingsMap.set(r.provider_id, r.is_enabled === 1));

                    // Merge settings
                    const orgProviders = providers.map(p => ({
                        ...p,
                        // Enabled if not explicitly disabled (opt-out model)
                        is_enabled_for_org: settingsMap.has(p.id) ? settingsMap.get(p.id) : true
                    }));

                    resolve(orgProviders);
                }
            );
        });
    }

    /**
     * Toggle provider enabled status for an organization
     */
    async toggleOrganizationProvider(organizationId, providerId, isEnabled) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO organization_llm_settings (organization_id, provider_id, is_enabled, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(organization_id, provider_id) 
                DO UPDATE SET is_enabled = excluded.is_enabled
            `;

            db.run(sql, [organizationId, providerId, isEnabled ? 1 : 0], (err) => {
                if (err) {
                    aiLogger.error('LLMConfigService', `Failed to toggle provider: ${err.message}`);
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    // ========================================================================
    // PROVIDER RETRIEVAL
    // ========================================================================

    /**
     * Get all active providers from database
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Array>} Array of provider configurations
     */
    async getAllProviders(useCache = true) {
        // Check cache
        if (useCache && this.cacheExpiry > Date.now()) {
            return Array.from(this.providerCache.values());
        }

        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY priority DESC, is_default DESC',
                [],
                (err, rows) => {
                    if (err) {
                        aiLogger.error('LLMConfigService', `Failed to get providers: ${err.message}`);
                        reject(err);
                        return;
                    }

                    // Update cache
                    this.providerCache.clear();
                    for (const row of rows || []) {
                        this.providerCache.set(row.provider, this.enrichProviderConfig(row));
                    }
                    this.cacheExpiry = Date.now() + this.cacheTTL;

                    resolve(Array.from(this.providerCache.values()));
                }
            );
        });
    }

    /**
     * Get provider configuration by provider type
     * @param {string} providerId - Provider identifier (e.g., 'openai', 'google')
     * @returns {Promise<Object|null>} Provider configuration or null
     */
    async getProviderConfig(providerId) {
        // Check cache first
        if (this.providerCache.has(providerId) && this.cacheExpiry > Date.now()) {
            return this.providerCache.get(providerId);
        }

        const dbProvider = await this.getProviderFromDb(providerId);
        if (dbProvider) {
            const enriched = this.enrichProviderConfig(dbProvider);
            this.providerCache.set(providerId, enriched);
            return enriched;
        }

        // Fallback to env-only config
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

    /**
     * Get default provider
     * @returns {Promise<Object|null>} Default provider configuration
     */
    async getDefaultProvider() {
        return new Promise((resolve) => {
            db.get(
                'SELECT * FROM llm_providers WHERE is_default = 1 AND is_active = 1 LIMIT 1',
                [],
                (err, row) => {
                    if (row) {
                        resolve(this.enrichProviderConfig(row));
                    } else {
                        // Fallback: get any active provider
                        db.get(
                            'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY priority DESC LIMIT 1',
                            [],
                            (err2, row2) => {
                                resolve(row2 ? this.enrichProviderConfig(row2) : null);
                            }
                        );
                    }
                }
            );
        });
    }

    /**
     * Enrich database row with provider definitions
     */
    enrichProviderConfig(dbRow) {
        const definition = PROVIDER_DEFINITIONS[dbRow.provider] || {};

        return {
            ...dbRow,
            // Add definition properties
            supportsStreaming: definition.supportsStreaming ?? true,
            supportsVision: definition.supportsVision ?? false,
            supportsTools: definition.supportsTools ?? false,
            tier: definition.tier || 'STANDARD',
            requiresJWT: definition.requiresJWT || false,
            isLocal: definition.isLocal || false,
            // Computed properties
            isConfigured: !!dbRow.api_key,
            healthStatus: this.healthStatus.get(dbRow.provider) || 'unknown'
        };
    }

    // ========================================================================
    // FALLBACK CHAIN
    // ========================================================================

    /**
     * Get fallback chain for a tier
     * @param {string} tier - Tier level (BUDGET, STANDARD, PREMIUM, REASONING)
     * @returns {Promise<Array>} Ordered array of provider IDs
     */
    async getFallbackChain(tier = 'STANDARD') {
        const providers = await this.getAllProviders();
        const configured = providers.filter(p => p.isConfigured && p.is_active);

        // Sort by: health status, tier match, priority
        return configured
            .sort((a, b) => {
                // Healthy providers first
                const healthScore = {
                    'healthy': 3,
                    'degraded': 2,
                    'unknown': 1,
                    'unhealthy': 0
                };
                const healthDiff = (healthScore[b.healthStatus] || 1) - (healthScore[a.healthStatus] || 1);
                if (healthDiff !== 0) return healthDiff;

                // Same tier preference
                if (a.tier === tier && b.tier !== tier) return -1;
                if (b.tier === tier && a.tier !== tier) return 1;

                // Then by priority
                return (b.priority || 0) - (a.priority || 0);
            })
            .map(p => p.provider);
    }

    /**
     * Get next fallback provider
     * @param {Array} excludeProviders - Providers to exclude (already tried)
     * @param {string} tier - Requested tier
     * @returns {Promise<Object|null>} Next provider to try
     */
    async getNextFallback(excludeProviders = [], tier = 'STANDARD') {
        const chain = await this.getFallbackChain(tier);
        const excludeSet = new Set(excludeProviders);

        for (const providerId of chain) {
            if (!excludeSet.has(providerId)) {
                return this.getProviderConfig(providerId);
            }
        }

        return null;
    }

    // ========================================================================
    // HEALTH TRACKING
    // ========================================================================

    /**
     * Log an LLM event for analytics
     */
    async logEvent(data) {
        if (!this.initialized) await this.initialize();

        try {
            const {
                traceId,
                provider,
                model,
                status,
                latencyMs,
                tokensIn,
                tokensOut,
                cost,
                errorMessage
            } = data;

            await this.runAsync(`
                INSERT INTO llm_logs (
                    trace_id, provider, model, status, latency_ms, 
                    tokens_in, tokens_out, cost, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                traceId || `trace_${Date.now()}`,
                provider || 'unknown',
                model || 'unknown',
                status,
                latencyMs || 0,
                tokensIn || 0,
                tokensOut || 0,
                cost || 0,
                errorMessage || null
            ]);

            // Keep log size manageable (retention policy: ~10k logs)
            // Cleanup every 100th insert roughly
            if (Math.random() < 0.01) {
                this.cleanupOldLogs();
            }

        } catch (error) {
            // Don't crash app if logging fails
            aiLogger.error('LLMConfigService', 'Failed to save log event', error);
        }
    }

    /**
     * Cleanup old logs to prevent DB bloat
     */
    async cleanupOldLogs() {
        try {
            // Keep last 30 days
            await this.runAsync(`
                DELETE FROM llm_logs 
                WHERE timestamp < datetime('now', '-30 days')
            `);
        } catch (e) {
            aiLogger.error('LLMConfigService', 'Cleanup failed', e);
        }
    }

    /**
     * Get aggregated analytics stats
     */
    async getAnalyticsParams(days = 7) {
        if (!this.initialized) await this.initialize();

        try {
            const timeFilter = `datetime('now', '-${days} days')`;

            // Total Requests
            const total = await this.getAsync(`
                SELECT COUNT(*) as count FROM llm_logs 
                WHERE timestamp > ${timeFilter}
            `);

            // Error Rate
            const errors = await this.getAsync(`
                SELECT COUNT(*) as count FROM llm_logs 
                WHERE status = 'error' AND timestamp > ${timeFilter}
            `);

            // Avg Latency
            const latency = await this.getAsync(`
                SELECT AVG(latency_ms) as avg_ms FROM llm_logs 
                WHERE status = 'success' AND timestamp > ${timeFilter}
            `);

            // Total Cost
            const cost = await this.getAsync(`
                SELECT SUM(cost) as total_cost FROM llm_logs 
                WHERE timestamp > ${timeFilter}
            `);

            // Provider Breakdown
            const providers = await this.allAsync(`
                SELECT provider, COUNT(*) as count, SUM(cost) as total_cost
                FROM llm_logs 
                WHERE timestamp > ${timeFilter}
                GROUP BY provider
            `);

            return {
                total_requests: total?.count || 0,
                error_count: errors?.count || 0,
                error_rate: total?.count ? (errors.count / total.count) : 0,
                avg_latency: Math.round(latency?.avg_ms || 0),
                total_cost: cost?.total_cost || 0,
                providers
            };
        } catch (error) {
            aiLogger.error('LLMConfigService', 'Analytics fetch failed', error);
            return null;
        }
    }

    /**
     * Get recent logs (paginated)
     */
    async getRecentLogs(limit = 50, offset = 0, onlyErrors = false) {
        if (!this.initialized) await this.initialize();

        try {
            let query = `SELECT * FROM llm_logs`;
            if (onlyErrors) {
                query += ` WHERE status = 'error'`;
            }
            query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

            return await this.allAsync(query, [limit, offset]);
        } catch (error) {
            aiLogger.error('LLMConfigService', 'Logs fetch failed', error);
            return [];
        }
    }
    /**
     * Update health status for a provider
     * @param {string} providerId - Provider identifier
     * @param {string} status - Health status ('healthy', 'degraded', 'unhealthy')
     * @param {Object} details - Additional details
     */
    async updateHealthStatus(providerId, status, details = {}) {
        this.healthStatus.set(providerId, status);

        // Update database
        await this.runAsync(
            'UPDATE llm_providers SET health_status = ?, last_health_check = ? WHERE provider = ?',
            [status, new Date().toISOString(), providerId]
        );

        aiLogger.info('LLMConfigService', `Health status updated: ${providerId} = ${status}`, details);
    }

    /**
     * Get health status for all providers
     * @returns {Object} Health status map
     */
    getHealthStatusMap() {
        const status = {};
        for (const [provider, health] of this.healthStatus) {
            status[provider] = health;
        }
        return status;
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Validate all configured API keys
     * @returns {Promise<Object>} Validation results
     */
    async validateAllKeys() {
        const results = {
            timestamp: new Date().toISOString(),
            providers: [],
            summary: {
                total: 0,
                configured: 0,
                valid: 0,
                invalid: 0,
                unconfigured: 0
            }
        };

        for (const [providerId, definition] of Object.entries(PROVIDER_DEFINITIONS)) {
            results.summary.total++;

            const apiKey = this.getApiKeyFromEnv(providerId);
            const providerResult = {
                provider: providerId,
                name: definition.name,
                configured: !!apiKey,
                valid: false,
                error: null
            };

            if (!apiKey) {
                providerResult.error = 'No API key configured';
                results.summary.unconfigured++;
            } else {
                results.summary.configured++;
                // Basic validation (format check)
                if (this.isValidKeyFormat(providerId, apiKey)) {
                    providerResult.valid = true;
                    results.summary.valid++;
                } else {
                    providerResult.error = 'Invalid key format';
                    results.summary.invalid++;
                }
            }

            results.providers.push(providerResult);
        }

        return results;
    }

    /**
     * Check if API key format is valid
     * @param {string} providerId - Provider identifier
     * @param {string} apiKey - API key to validate
     * @returns {boolean} Whether format is valid
     */
    isValidKeyFormat(providerId, apiKey) {
        if (!apiKey || typeof apiKey !== 'string') return false;

        const patterns = {
            openai: /^sk-[a-zA-Z0-9_-]{20,}$/,
            anthropic: /^sk-ant-[a-zA-Z0-9_-]{20,}$/,
            google: /^AIza[a-zA-Z0-9_-]{30,}$/,
            deepseek: /^sk-[a-zA-Z0-9]{20,}$/,
            nvidia: /^nvapi-[a-zA-Z0-9_-]{20,}$/,
            cohere: /^[a-zA-Z0-9]{30,}$/,
            qwen: /^sk-[a-zA-Z0-9]{20,}$/,
            zai: /^[a-zA-Z0-9]{20,}\.[a-zA-Z0-9]{10,}$/,
            ollama: /^(http|https):\/\/.+/
        };

        const pattern = patterns[providerId];
        if (!pattern) return apiKey.length >= 10; // Generic fallback

        return pattern.test(apiKey);
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    /**
     * Clear provider cache
     */
    clearCache() {
        this.providerCache.clear();
        this.cacheExpiry = 0;
    }

    /**
     * Get provider definitions (for documentation/UI)
     */
    getProviderDefinitions() {
        return { ...PROVIDER_DEFINITIONS };
    }

    /**
     * Check if at least one provider is configured
     */
    async hasAnyProvider() {
        const providers = await this.getAllProviders();
        return providers.some(p => p.isConfigured);
    }

    /**
     * Get recommended environment variable names
     */
    getRecommendedEnvVars() {
        return Object.values(PROVIDER_DEFINITIONS).map(def => ({
            provider: def.id,
            envVar: def.envKey,
            description: `API key for ${def.name}`
        }));
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const llmConfigService = new LLMConfigService();

module.exports = {
    LLMConfigService,
    llmConfigService,
    PROVIDER_DEFINITIONS,
    TIER_PRIORITY,
    DEFAULT_FALLBACK_CHAIN
};


