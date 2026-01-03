/**
 * AI Health Monitor - Self-Healing System
 * 
 * Provides automatic diagnostics and repair for AI system components:
 * - Database connectivity and table verification
 * - LLM provider availability
 * - Rate limit tables existence
 * - Auto-repair for common issues
 * 
 * Features:
 * - Periodic health checks (configurable interval)
 * - Auto-repair for missing tables
 * - Circuit breaker for failing providers
 * - Alert system for critical issues
 */

const deps = {
    _dbPromise: null,
    _aiLogger: null,
    _dbConfig: null,
    _NotificationService: null
};

async function initDeps() {
    if (!deps._dbPromise) {
        const dbPromise = await import('../../utils/dbPromise.js');
        deps._dbPromise = dbPromise.default || dbPromise;
    }
    if (!deps._aiLogger) {
        const { aiLogger } = await import('./logger.js');
        deps._aiLogger = aiLogger;
    }
    if (!deps._dbConfig) {
        const dbConfig = await import('../../config/database.config.js');
        deps._dbConfig = dbConfig.default || dbConfig;
    }
}

async function getNotificationService() {
    if (!deps._NotificationService) {
        const { default: NotificationService } = await import('../notificationService.js');
        deps._NotificationService = NotificationService;
    }
    return deps._NotificationService;
}

// Health check configuration
const CONFIG = {
    checkIntervalMs: 60000,          // 1 minute between checks
    maxFailuresBeforeAlert: 3,       // Alert after 3 consecutive failures
    repairCooldownMs: 300000,        // 5 minutes between repair attempts
    providerTimeoutMs: 5000,         // 5 seconds timeout for provider checks
};

// Detect database type - will be initialized after deps are loaded
let isPostgres = false;

// Helper to get proper timestamp syntax
const getTimestampDefault = () => isPostgres ? 'DEFAULT NOW()' : 'DEFAULT CURRENT_TIMESTAMP';
const getTextType = () => isPostgres ? 'VARCHAR(255)' : 'TEXT';
const getTextLongType = () => 'TEXT';
const getIdType = () => isPostgres ? 'VARCHAR(255) PRIMARY KEY' : 'TEXT PRIMARY KEY';
const getBlobType = () => isPostgres ? 'BYTEA' : 'BLOB';
const getRealType = () => isPostgres ? 'DOUBLE PRECISION' : 'REAL';

// Required tables for AI system (PostgreSQL-compatible)
const REQUIRED_TABLES = [
    {
        name: 'ai_rate_limits', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_rate_limits (
            id VARCHAR(255) PRIMARY KEY,
            organization_id VARCHAR(255) NOT NULL,
            applies_to VARCHAR(50) DEFAULT 'all',
            limit_type VARCHAR(50) DEFAULT 'per_day',
            limit_value INTEGER DEFAULT 1000,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_rate_limits (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            applies_to TEXT DEFAULT 'all',
            limit_type TEXT DEFAULT 'per_day',
            limit_value INTEGER DEFAULT 1000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `},
    {
        name: 'ai_audit_log', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_audit_log (
            id VARCHAR(255) PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT NOW(),
            user_id VARCHAR(255),
            organization_id VARCHAR(255),
            action VARCHAR(100),
            resource_type VARCHAR(100),
            resource_id VARCHAR(255),
            request_summary TEXT,
            response_summary TEXT,
            model_used VARCHAR(100),
            tokens_used INTEGER,
            cost_usd DOUBLE PRECISION,
            ip_address VARCHAR(100),
            user_agent TEXT,
            risk_level VARCHAR(50),
            flagged INTEGER DEFAULT 0,
            flag_reason TEXT
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_audit_log (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            organization_id TEXT,
            action TEXT,
            resource_type TEXT,
            resource_id TEXT,
            request_summary TEXT,
            response_summary TEXT,
            model_used TEXT,
            tokens_used INTEGER,
            cost_usd REAL,
            ip_address TEXT,
            user_agent TEXT,
            risk_level TEXT,
            flagged INTEGER DEFAULT 0,
            flag_reason TEXT
        )
    `},
    {
        name: 'ai_data_access_log', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_data_access_log (
            id VARCHAR(255) PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT NOW(),
            user_id VARCHAR(255),
            organization_id VARCHAR(255),
            data_type VARCHAR(100),
            data_id VARCHAR(255),
            access_type VARCHAR(50),
            purpose TEXT,
            ai_request_id VARCHAR(255)
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_data_access_log (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            organization_id TEXT,
            data_type TEXT,
            data_id TEXT,
            access_type TEXT,
            purpose TEXT,
            ai_request_id TEXT
        )
    `},
    {
        name: 'ai_learning_patterns', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_learning_patterns (
            id VARCHAR(255) PRIMARY KEY,
            pattern_hash VARCHAR(255) UNIQUE,
            pattern_type VARCHAR(100),
            pattern_data TEXT,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            last_used TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_learning_patterns (
            id TEXT PRIMARY KEY,
            pattern_hash TEXT UNIQUE,
            pattern_type TEXT,
            pattern_data TEXT,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `},
    {
        name: 'ai_learning_interactions', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_learning_interactions (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255),
            organization_id VARCHAR(255),
            request_type VARCHAR(100),
            prompt_hash VARCHAR(255),
            response_hash VARCHAR(255),
            success INTEGER DEFAULT 1,
            feedback_score DOUBLE PRECISION,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_learning_interactions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            organization_id TEXT,
            request_type TEXT,
            prompt_hash TEXT,
            response_hash TEXT,
            success INTEGER DEFAULT 1,
            feedback_score REAL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `},
    {
        name: 'ai_learned_patterns', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_learned_patterns (
            id VARCHAR(255) PRIMARY KEY,
            organization_id VARCHAR(255),
            pattern_type VARCHAR(100),
            pattern_key VARCHAR(255),
            pattern_data TEXT,
            sample_count INTEGER DEFAULT 0,
            confidence DOUBLE PRECISION DEFAULT 0,
            last_updated TIMESTAMP DEFAULT NOW(),
            UNIQUE(organization_id, pattern_type, pattern_key)
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_learned_patterns (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            pattern_type TEXT,
            pattern_key TEXT,
            pattern_data TEXT,
            sample_count INTEGER DEFAULT 0,
            confidence REAL DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, pattern_type, pattern_key)
        )
    `},
    {
        name: 'ai_knowledge_embeddings', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
            id VARCHAR(255) PRIMARY KEY,
            organization_id VARCHAR(255),
            source_type VARCHAR(100),
            source_id VARCHAR(255),
            chunk_text TEXT,
            embedding BYTEA,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            source_type TEXT,
            source_id TEXT,
            chunk_text TEXT,
            embedding BLOB,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `},
    {
        name: 'ai_cache', createSql: isPostgres ? `
        CREATE TABLE IF NOT EXISTS ai_cache (
            id VARCHAR(255) PRIMARY KEY,
            query_hash VARCHAR(255),
            context_hash VARCHAR(255),
            response TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            hit_count INTEGER DEFAULT 0,
            UNIQUE(query_hash, context_hash)
        )
    ` : `
        CREATE TABLE IF NOT EXISTS ai_cache (
            id TEXT PRIMARY KEY,
            query_hash TEXT,
            context_hash TEXT,
            response TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            hit_count INTEGER DEFAULT 0,
            UNIQUE(query_hash, context_hash)
        )
    `}
];

// Provider health status
const providerStatus = {
    openai: { healthy: true, failures: 0, lastCheck: null, lastError: null },
    anthropic: { healthy: true, failures: 0, lastCheck: null, lastError: null },
    google: { healthy: true, failures: 0, lastCheck: null, lastError: null },
    deepseek: { healthy: true, failures: 0, lastCheck: null, lastError: null },
    ollama: { healthy: true, failures: 0, lastCheck: null, lastError: null },
};

class AIHealthMonitor {
    constructor() {
        this.isRunning = false;
        this.checkInterval = null;
        this.lastCheck = null;
        this.consecutiveFailures = 0;
        this.repairAttempts = new Map();
        this.listeners = [];
        this._initialized = false;
    }

    async ensureInitialized() {
        if (!this._initialized) {
            await initDeps();
            isPostgres = deps._dbConfig.type === 'postgres';
            this._initialized = true;
        }
    }

    /**
     * Start periodic health monitoring
     */
    async start(intervalMs = CONFIG.checkIntervalMs) {
        await this.ensureInitialized();
        if (this.isRunning) {
            deps._aiLogger.info('HealthMonitor', 'Already running');
            return;
        }

        this.isRunning = true;
        deps._aiLogger.info('HealthMonitor', `Starting with ${intervalMs}ms interval`);

        // Run initial check immediately
        this.runDiagnostics().catch(err => {
            deps._aiLogger.error('HealthMonitor', `Initial check failed: ${err.message}`);
        });

        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.runDiagnostics().catch(err => {
                deps._aiLogger.error('HealthMonitor', `Periodic check failed: ${err.message}`);
            });
        }, intervalMs);
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        if (deps._aiLogger) {
            deps._aiLogger.info('HealthMonitor', 'Stopped');
        }
    }

    /**
     * Run full diagnostics
     */
    async runDiagnostics() {
        await this.ensureInitialized();
        const startTime = Date.now();
        const results = {
            timestamp: new Date().toISOString(),
            duration: 0,
            overall: 'healthy',
            checks: [],
            repairs: [],
            alerts: []
        };

        try {
            // 1. Check database connectivity
            const dbCheck = await this.checkDatabase();
            results.checks.push(dbCheck);

            // 2. Check required tables
            const tablesCheck = await this.checkRequiredTables();
            results.checks.push(tablesCheck);

            // 3. Check LLM providers
            const providersCheck = await this.checkLLMProviders();
            results.checks.push(providersCheck);

            // 4. Check disk/memory (basic)
            const resourcesCheck = await this.checkResources();
            results.checks.push(resourcesCheck);

            // Attempt repairs for any failed checks
            for (const check of results.checks) {
                if (!check.healthy && check.canRepair) {
                    const repair = await this.attemptRepair(check);
                    results.repairs.push(repair);
                }
            }

            // Determine overall status
            const hasFailures = results.checks.some(c => !c.healthy);
            const hasUnrepairedFailures = results.checks.some(c =>
                !c.healthy && (!results.repairs.find(r => r.check === c.name)?.success)
            );

            if (hasUnrepairedFailures) {
                results.overall = 'degraded';
                this.consecutiveFailures++;
            } else if (hasFailures) {
                results.overall = 'repaired';
                this.consecutiveFailures = 0;
            } else {
                results.overall = 'healthy';
                this.consecutiveFailures = 0;
            }

            // Generate alerts if needed
            if (this.consecutiveFailures >= CONFIG.maxFailuresBeforeAlert || results.checks.some(c => c.name === 'database' && !c.healthy)) {
                const message = `AI system has failed ${this.consecutiveFailures} consecutive health checks. Failures: ${results.checks.filter(c => !c.healthy).map(c => c.name).join(', ')}`;

                const alert = {
                    type: 'critical',
                    message,
                    checks: results.checks.filter(c => !c.healthy).map(c => c.name)
                };
                results.alerts.push(alert);
                this.notifyListeners(alert);

                // --- AUTO-REPORTING: SIGNALIZATOR INTEGRATION ---
                // Immediately report Database failures or Persistent failures to NotificationService
                try {
                    const criticalFailure = results.checks.find(c => !c.healthy);
                    if (criticalFailure) {
                        const notificationService = await getNotificationService();
                        // Use a static debounce map to avoid spamming the DB every minute
                        const alertKey = `health_${criticalFailure.name}`;
                        const lastSent = this._lastAlertTime?.[alertKey] || 0;
                        const now = Date.now();

                        // Alert immediately for DB, or every 15 mins for others
                        const cooldown = criticalFailure.name === 'database' ? 60000 : 900000;

                        if (now - lastSent > cooldown) {
                            notificationService.create({
                                userId: 'system',
                                organizationId: 'system',
                                type: 'SYSTEM_ALERT',
                                severity: 'CRITICAL',
                                title: `CRITICAL INFRASTRUCTURE FAILURE: ${criticalFailure.name.toUpperCase()}`,
                                message: `Automated Watchdog detected critical failure in ${criticalFailure.name}: ${criticalFailure.message || 'Unknown Error'}. Urgent attention required.`,
                                isActionable: false
                            }).then(() => {
                                deps._aiLogger.info('HealthMonitor', `Sent SYSTEM_ALERT for ${criticalFailure.name}`);
                                if (!this._lastAlertTime) this._lastAlertTime = {};
                                this._lastAlertTime[alertKey] = now;
                            }).catch(err => console.error('Failed to send watchdog alert:', err));
                        }
                    }
                } catch (notifyErr) {
                    console.error('HealthMonitor Notification Error:', notifyErr);
                }
            }

        } catch (error) {
            results.overall = 'error';
            results.error = error.message;
            deps._aiLogger.error('HealthMonitor', `Diagnostics failed: ${error.message}`);
        }

        results.duration = Date.now() - startTime;
        this.lastCheck = results;

        // Log summary
        deps._aiLogger.info('HealthMonitor',
            `Diagnostics complete: ${results.overall} (${results.duration}ms, ${results.checks.length} checks, ${results.repairs.length} repairs)`
        );

        return results;
    }

    /**
     * Check database connectivity
     */
    async checkDatabase() {
        await this.ensureInitialized();
        const check = {
            name: 'database',
            healthy: false,
            canRepair: false,
            message: '',
            duration: 0
        };

        const startTime = Date.now();

        try {
            const result = await deps._dbPromise.get('SELECT 1 as ok');
            check.healthy = result?.ok === 1;
            check.message = check.healthy ? 'Database is responsive' : 'Database query returned unexpected result';
        } catch (error) {
            check.message = `Database error: ${error.message}`;
            check.healthy = false;
        }

        check.duration = Date.now() - startTime;
        return check;
    }

    /**
     * Check if required tables exist
     */
    async checkRequiredTables() {
        await this.ensureInitialized();
        const check = {
            name: 'required_tables',
            healthy: true,
            canRepair: true,
            missingTables: [],
            message: '',
            duration: 0
        };

        const startTime = Date.now();

        try {
            for (const table of REQUIRED_TABLES) {
                const exists = await deps._dbPromise.tableExists(table.name);
                if (!exists) {
                    check.missingTables.push(table.name);
                    check.healthy = false;
                }
            }

            if (check.healthy) {
                check.message = 'All required tables exist';
            } else {
                check.message = `Missing tables: ${check.missingTables.join(', ')}`;
            }
        } catch (error) {
            check.message = `Table check error: ${error.message}`;
            check.healthy = false;
        }

        check.duration = Date.now() - startTime;
        return check;
    }

    /**
     * Check LLM provider availability (basic connectivity)
     */
    async checkLLMProviders() {
        const check = {
            name: 'llm_providers',
            healthy: true,
            canRepair: false,
            providers: {},
            message: '',
            duration: 0
        };

        const startTime = Date.now();
        let healthyCount = 0;

        // Check each provider
        for (const [name, status] of Object.entries(providerStatus)) {
            try {
                // For now, just check if API key is configured
                const envKey = this.getProviderEnvKey(name);
                const isConfigured = !!process.env[envKey];

                status.lastCheck = new Date().toISOString();
                status.healthy = isConfigured;
                status.lastError = isConfigured ? null : 'API key not configured';

                if (isConfigured) {
                    healthyCount++;
                }

                check.providers[name] = {
                    configured: isConfigured,
                    healthy: status.healthy
                };
            } catch (error) {
                status.healthy = false;
                status.failures++;
                status.lastError = error.message;
                check.providers[name] = { healthy: false, error: error.message };
            }
        }

        // At least one provider should be available
        check.healthy = healthyCount > 0;
        check.message = check.healthy
            ? `${healthyCount} provider(s) available`
            : 'No LLM providers configured';

        check.duration = Date.now() - startTime;
        return check;
    }

    /**
     * Get environment variable key for provider
     */
    getProviderEnvKey(provider) {
        const keys = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            google: 'GOOGLE_AI_KEY',
            deepseek: 'DEEPSEEK_API_KEY',
            ollama: 'OLLAMA_BASE_URL'
        };
        return keys[provider] || '';
    }

    /**
     * Check system resources
     */
    async checkResources() {
        const check = {
            name: 'resources',
            healthy: true,
            canRepair: false,
            message: '',
            duration: 0
        };

        const startTime = Date.now();

        try {
            // Check memory usage
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

            check.memory = {
                heapUsedMB,
                heapTotalMB,
                heapPercent
            };

            // Alert if memory usage is too high (only if using significant memory > 500MB)
            // V8 expands heapTotal lazily, so high % of small total is normal
            if (heapPercent > 95 && heapUsedMB > 500) {
                check.healthy = false;
                check.message = `High memory usage: ${heapPercent}% (${heapUsedMB}MB)`;
            } else {
                check.message = `Memory: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`;
            }
        } catch (error) {
            check.message = `Resource check error: ${error.message}`;
            // Don't fail overall for resource check errors
        }

        check.duration = Date.now() - startTime;
        return check;
    }

    /**
     * Attempt to repair a failed check
     */
    async attemptRepair(check) {
        await this.ensureInitialized();
        const repair = {
            check: check.name,
            success: false,
            action: null,
            message: ''
        };

        // Check cooldown
        const lastAttempt = this.repairAttempts.get(check.name);
        if (lastAttempt && (Date.now() - lastAttempt) < CONFIG.repairCooldownMs) {
            repair.message = 'Repair on cooldown';
            return repair;
        }

        this.repairAttempts.set(check.name, Date.now());
        deps._aiLogger.info('HealthMonitor', `Attempting repair: ${check.name}`);

        try {
            switch (check.name) {
                case 'required_tables':
                    repair.action = 'create_tables';
                    await this.repairMissingTables(check.missingTables);
                    repair.success = true;
                    repair.message = `Created tables: ${check.missingTables.join(', ')}`;
                    break;

                default:
                    repair.message = `No repair action for: ${check.name}`;
            }
        } catch (error) {
            repair.message = `Repair failed: ${error.message}`;
            deps._aiLogger.error('HealthMonitor', `Repair failed for ${check.name}: ${error.message}`);
        }

        return repair;
    }

    /**
     * Create missing tables
     */
    async repairMissingTables(missingTables) {
        await this.ensureInitialized();
        for (const tableName of missingTables) {
            const tableConfig = REQUIRED_TABLES.find(t => t.name === tableName);
            if (tableConfig) {
                deps._aiLogger.info('HealthMonitor', `Creating table: ${tableName}`);
                await deps._dbPromise.run(tableConfig.createSql);
            }
        }
    }

    /**
     * Register alert listener
     */
    onAlert(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners of an alert
     */
    notifyListeners(alert) {
        for (const listener of this.listeners) {
            try {
                listener(alert);
            } catch (error) {
                if (deps._aiLogger) {
                    deps._aiLogger.error('HealthMonitor', `Alert listener error: ${error.message}`);
                }
            }
        }
    }

    /**
     * Get current health status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastCheck: this.lastCheck,
            consecutiveFailures: this.consecutiveFailures,
            providers: providerStatus
        };
    }

    /**
     * Get provider status
     */
    getProviderStatus(providerName) {
        return providerStatus[providerName] || null;
    }

    /**
     * Mark provider as failed (called by LLM service on error)
     */
    async markProviderFailed(providerName, error) {
        await this.ensureInitialized();
        const status = providerStatus[providerName];
        if (status) {
            status.healthy = false;
            status.failures++;
            status.lastError = error?.message || 'Unknown error';
            status.lastCheck = new Date().toISOString();
            deps._aiLogger.warn('HealthMonitor', `Provider ${providerName} marked as failed: ${status.lastError}`);
        }
    }

    /**
     * Mark provider as healthy (called by LLM service on success)
     */
    markProviderHealthy(providerName) {
        const status = providerStatus[providerName];
        if (status) {
            status.healthy = true;
            status.failures = 0;
            status.lastError = null;
            status.lastCheck = new Date().toISOString();
        }
    }

    /**
     * Get best available provider
     */
    getBestProvider() {
        // Prefer providers with fewer failures
        const sorted = Object.entries(providerStatus)
            .filter(([_, s]) => s.healthy)
            .sort((a, b) => a[1].failures - b[1].failures);

        return sorted[0]?.[0] || null;
    }
}

// Singleton instance
const healthMonitor = new AIHealthMonitor();

export default {
    AIHealthMonitor,
    healthMonitor,
    providerStatus
};

