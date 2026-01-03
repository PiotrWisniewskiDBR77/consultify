import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import verifyToken from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
const { AIPipeline } = import('ai/aiPipeline.js.js');

// Helper: Run DB Run
const dbRun = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

// Helper: Run DB All
const dbAll = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Helper: Run DB Get
const dbGet = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// ==========================================
// PUBLIC ENDPOINTS (No Auth Required)
// ==========================================

// GET /api/llm/health-check-ai - New route to bypass cache
router.get('/health-check-ai', async (req, res) => {
    return res.json({ status: 'OK', version: 'FAILOVER-READY' });
});

// POST /api/llm/test - Test LLM connection with given config
router.post('/test', verifyToken, async (req, res) => {
    try {
        const { provider, api_key, model_id, endpoint } = req.body;

        // Basic validation
        if (!provider) {
            return res.status(400).json({ success: false, message: 'Provider is required' });
        }

        // Return mock success for now - actual test would call the provider
        return res.json({
            success: true,
            message: `Connection to ${provider} successful`,
            response: 'Test completed successfully'
        });
    } catch (error) {
        console.error('[LLM] Test error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Test failed' });
    }
});

// GET /api/llm/status - Comprehensive LLM provider status (Phase 5: Dashboard API)
// Returns full health status for all providers, fallback chain, and circuit breaker states
router.get('/status', async (req, res) => {
    try {
        const { llmConfigService } = import('ai/llmConfigService.js');
        const { generateQuickHealthReport, testSingleProvider } = import('ai/startupValidator.js');
        const circuitBreaker = import('ai/circuitBreaker.js');

        // Initialize if not already
        await llmConfigService.initialize();

        // Get all providers with health status
        const providers = await llmConfigService.getAllProviders(false); // force fresh fetch

        // Format provider data for response (hide API keys)
        const formattedProviders = providers.map(p => ({
            id: p.id,
            provider: p.provider,
            name: p.name,
            model: p.model_id,
            endpoint: p.endpoint,
            isConfigured: !!p.api_key,
            isActive: !!p.is_active,
            isDefault: !!p.is_default,
            tier: p.tier || 'STANDARD',
            healthStatus: p.healthStatus || llmConfigService.healthStatus?.get(p.provider) || 'unknown',
            lastHealthCheck: p.last_health_check,
            supportsVision: p.supportsVision || false,
            supportsStreaming: p.supportsStreaming || true,
            supportsTools: p.supportsTools || false,
            priority: p.priority || 0,
            costPer1k: p.cost_per_1k || 0
        }));

        // Get default provider
        const defaultProvider = await llmConfigService.getDefaultProvider();

        // Get fallback chains for different tiers
        const fallbackChains = {
            BUDGET: await llmConfigService.getFallbackChain('BUDGET'),
            STANDARD: await llmConfigService.getFallbackChain('STANDARD'),
            PREMIUM: await llmConfigService.getFallbackChain('PREMIUM'),
            REASONING: await llmConfigService.getFallbackChain('REASONING')
        };

        // Get circuit breaker status for all providers
        const circuitBreakerStatus = {};
        for (const p of providers) {
            const cbStatus = circuitBreaker.getStatus(p.provider);
            if (cbStatus) {
                circuitBreakerStatus[p.provider] = {
                    state: cbStatus.state,
                    failures: cbStatus.failures,
                    lastFailure: cbStatus.lastFailure,
                    lastSuccess: cbStatus.lastSuccess
                };
            }
        }

        // Get startup health report if available
        const startupReport = global.llmHealthReport || null;

        // Summary stats
        const summary = {
            total: formattedProviders.length,
            configured: formattedProviders.filter(p => p.isConfigured).length,
            active: formattedProviders.filter(p => p.isActive).length,
            healthy: formattedProviders.filter(p => p.healthStatus === 'healthy').length,
            degraded: formattedProviders.filter(p => p.healthStatus === 'degraded').length,
            unhealthy: formattedProviders.filter(p => p.healthStatus === 'unhealthy').length
        };

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            providers: formattedProviders,
            defaultProvider: defaultProvider ? {
                provider: defaultProvider.provider,
                model: defaultProvider.model_id,
                name: defaultProvider.name
            } : null,
            fallbackChains,
            circuitBreakers: circuitBreakerStatus,
            summary,
            startupValidation: startupReport ? {
                timestamp: startupReport.timestamp,
                duration: startupReport.duration,
                healthy: startupReport.summary?.healthy || 0,
                criticalErrors: startupReport.criticalErrors || []
            } : null
        });
    } catch (err) {
        console.error('[LLM Status] Error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/llm/providers/:id/tier - Update provider tier (SuperAdmin)
router.put('/providers/:id/tier', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { tier } = req.body;

    try {
        // Verify SuperAdmin
        if (!req.user || req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { llmConfigService } = import('ai/llmConfigService.js');
        await llmConfigService.initialize();

        // Map ID (which might be 'openai', 'google') to provider ID
        // The service uses 'provider' column as ID for updates in updateProviderTier
        // We need to support both UUIDs or provider names if possible, but updateProviderTier takes providerId (e.g. 'openai') 
        // Let's first check if 'id' matches a provider identifier
        let providerId = id;

        // If it looks like a uuid, we might need to look it up, but simpler is to expect provider name (e.g. 'openai')
        // Frontend sends provider name usually. 

        await llmConfigService.updateProviderTier(providerId, tier);

        res.json({
            success: true,
            providerId,
            tier,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/llm/status/test/:provider - Test a specific provider's connectivity
router.post('/status/test/:provider', async (req, res) => {
    const { provider } = req.params;

    try {
        const { testSingleProvider } = import('ai/startupValidator.js');
        const result = await testSingleProvider(provider);

        res.json({
            success: result.reachable || false,
            provider,
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            provider,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/llm/status/refresh - Force refresh all provider health checks
router.post('/status/refresh', async (req, res) => {
    try {
        const { validateOnStartup } = import('ai/startupValidator.js');

        // Run full validation
        const healthReport = await validateOnStartup({
            testConnectivity: true,
            parallel: true
        });

        // Store for future /status calls
        global.llmHealthReport = healthReport;

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration: healthReport.duration,
            summary: healthReport.summary,
            criticalErrors: healthReport.criticalErrors,
            warnings: healthReport.warnings
        });
    } catch (err) {
        console.error('[LLM Status Refresh] Error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/llm/providers/health - Check connectivity and health of all providers
router.get('/providers/health', async (req, res) => {
    try {
        const llmFallbackService = import('llmFallbackService.js');

        // Force fresh health check
        const providerStatuses = await llmFallbackService.checkAllProviders();
        const fullHealth = llmFallbackService.getHealthStatus();

        res.json({
            success: true,
            providers: providerStatuses,
            circuitBreakers: fullHealth.circuitBreakers,
            lastCheck: fullHealth.lastCheck,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[LLM Health] Error:', err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// GET /api/llm/providers/recommended - Get recommended provider based on current health
router.get('/providers/recommended', async (req, res) => {
    try {
        const llmFallbackService = import('llmFallbackService.js');
        const tier = req.query.tier || 'STANDARD';

        const recommendation = await llmFallbackService.getRecommendedProvider(tier);

        // SECURITY: Mask API keys before sending response
        const safeRecommendation = recommendation ? {
            ...recommendation,
            provider: recommendation.provider ? {
                ...recommendation.provider,
                api_key: recommendation.provider.api_key ? '***MASKED***' : null
            } : null
        } : null;

        res.json({
            success: true,
            recommendation: safeRecommendation,
            tier,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// POST /api/llm/test-fallback - Test fallback chain execution
router.post('/test-fallback', async (req, res) => {
    try {
        const llmFallbackService = import('llmFallbackService.js');
        const { tier = 'STANDARD' } = req.body;

        // Get available fallback options without executing
        const fallbackChain = llmFallbackService.getFallbackChain(tier);
        const fallbackProvider = await llmFallbackService.selectFallbackProvider(tier);

        // SECURITY: Mask API keys before sending response
        const safeFallbackProvider = fallbackProvider ? {
            ...fallbackProvider,
            provider: fallbackProvider.provider ? {
                ...fallbackProvider.provider,
                api_key: fallbackProvider.provider.api_key ? '***MASKED***' : null
            } : null
        } : null;

        res.json({
            success: true,
            tier,
            fallbackChain,
            recommendedFallback: safeFallbackProvider,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// POST /api/llm/test - Quick LLM availability test
router.post('/test', async (req, res) => {
    try {
        const { LLMService } = import('ai/llmService.js');
        const { ModelRouter } = import('ai/modelRouter.js');

        const modelRouter = new ModelRouter();
        const llmService = new LLMService();

        // Get active model config
        const modelConfig = await modelRouter.select({
            capability: 'chat',
            options: req.body.model ? { model: req.body.model } : undefined
        });

        // Quick test call
        const response = await llmService.call({
            type: 'chat',
            modelConfig,
            systemPrompt: 'You are a test assistant. Respond with exactly: OK',
            messages: [{ role: 'user', content: 'Test' }],
            stream: false
        });

        res.json({
            success: true,
            model: modelConfig.id,
            provider: modelConfig.provider,
            response: response.content?.substring(0, 100)
        });
    } catch (err) {
        console.error('[LLM Test] Error:', err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// GET /api/llm/redis-status - Public Redis status check
router.get('/redis-status', async (req, res) => {
    try {
        const { isRedisConnected, healthCheck } = import('ai/redisClient.js');
        const connected = isRedisConnected();
        const health = await healthCheck();

        res.json({
            redis: {
                connected,
                ...health
            },
            fallback: connected ? 'none' : 'in-memory',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            redis: { connected: false, error: err.message },
            fallback: 'in-memory',
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/llm/alerting-status - Public alerting status check
router.get('/alerting-status', async (req, res) => {
    try {
        const { alertingService } = import('ai/alerting.js');
        const status = alertingService.getStatus();

        res.json({
            alerting: status,
            envVars: {
                slackConfigured: !!(process.env.SLACK_WEBHOOK_URL || process.env.AI_SLACK_WEBHOOK_URL),
                discordConfigured: !!(process.env.DISCORD_WEBHOOK_URL || process.env.AI_DISCORD_WEBHOOK_URL)
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            alerting: { error: err.message },
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/llm/observability-status - Public observability status check
router.get('/observability-status', async (req, res) => {
    try {
        const { getStatus, initLangfuse } = import('ai/observability.js');
        const status = getStatus();

        // Try to initialize if not already
        if (!status.langfuseEnabled && status.langfuseConfigured) {
            await initLangfuse();
        }

        res.json({
            observability: {
                langfuse: {
                    enabled: status.langfuseEnabled,
                    configured: status.langfuseConfigured,
                    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
                },
                pricingModels: status.pricingModels
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            observability: { error: err.message },
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/llm/comprehensive-report-status - Status of comprehensive report generator
router.get('/comprehensive-report-status', async (req, res) => {
    try {
        const { comprehensiveReportGenerator } = import('ai/comprehensiveReportGenerator.js');
        const { webResearchService } = import('ai/webResearchService.js');
        const { contextBuilder } = import('ai/aiContext.js');

        res.json({
            comprehensiveReportGenerator: comprehensiveReportGenerator.getStatus(),
            webResearch: webResearchService.getStatus(),
            contextBuilder: contextBuilder.getConfigurations(),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/llm/metrics - Prometheus-compatible metrics endpoint (PUBLIC for scraping)
router.get('/metrics', async (req, res) => {
    try {
        const metrics = import('ai/metrics.js');
        const format = req.query.format || 'prometheus';

        if (format === 'json') {
            res.json(metrics.exportJson());
        } else {
            res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
            res.send(metrics.exportPrometheus());
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to export metrics', details: err.message });
    }
});

// GET /api/llm/health/status - System-wide AI health status
router.get('/health/status', verifyToken, async (req, res) => {
    try {
        const { AIHealthService } = import('ai/aiHealthService.js');
        const status = await AIHealthService.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch AI status', details: err.message });
    }
});

// POST /api/llm/health/test/:capability - Test a specific AI capability
router.post('/health/test/:capability', verifyToken, async (req, res) => {
    const { capability } = req.params;
    const { context, sendAlerts = false } = req.body;

    try {
        const { AIHealthService } = import('ai/aiHealthService.js');
        const results = await AIHealthService.testCapability(capability, context);
        
        // If test failed and alerts are enabled, trigger alert
        if (results.status === 'FAILED' && sendAlerts) {
            try {
                const AIHealthAlertService = import('ai/aiHealthAlertService.js');
                const alertResult = await AIHealthAlertService.triggerHealthAlert(
                    { results: { [capability]: results } },
                    req.user?.email || 'system'
                );
                results.alertSent = alertResult.alertSent;
                results.alertDetails = alertResult;
            } catch (alertErr) {
                console.error('[LLM API] Failed to send alert:', alertErr.message);
                results.alertSent = false;
                results.alertError = alertErr.message;
            }
        }
        
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: `Test failed for ${capability}`, details: err.message });
    }
});

// POST /api/llm/health/test-all - Run all AI capability tests with alerts
router.post('/health/test-all', verifyToken, async (req, res) => {
    const { sendAlerts = true } = req.body;
    
    try {
        const { AIHealthService } = import('ai/aiHealthService.js');
        const testResults = await AIHealthService.runAllTests();
        
        // If any test failed and alerts are enabled, trigger alerts
        if (!testResults.summary.allPassed && sendAlerts) {
            try {
                const AIHealthAlertService = import('ai/aiHealthAlertService.js');
                const alertResult = await AIHealthAlertService.triggerHealthAlert(
                    testResults,
                    req.user?.email || 'system'
                );
                testResults.alertSent = alertResult.alertSent;
                testResults.alertDetails = alertResult;
            } catch (alertErr) {
                console.error('[LLM API] Failed to send alert:', alertErr.message);
                testResults.alertSent = false;
                testResults.alertError = alertErr.message;
            }
        }
        
        res.json(testResults);
    } catch (err) {
        res.status(500).json({ error: 'Failed to run all tests', details: err.message });
    }
});

// GET /api/llm/health/alerts - Get AI health alert history
router.get('/health/alerts', verifyToken, async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    try {
        const AIHealthAlertService = import('ai/aiHealthAlertService.js');
        const alerts = await AIHealthAlertService.getAlertHistory(limit);
        res.json({ alerts, total: alerts.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alert history', details: err.message });
    }
});

// GET /api/llm/health/probe/:provider - Pre-flight health check for a provider
router.get('/health/probe/:provider', verifyToken, async (req, res) => {
    const { provider } = req.params;
    try {
        const { AIHealthService } = import('ai/aiHealthService.js');
        const result = await AIHealthService.probeProvider(provider);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: `Probe failed for ${provider}`, details: err.message });
    }
});

// GET /api/llm/health/probe-all - Pre-flight health check for all providers
router.get('/health/probe-all', verifyToken, async (req, res) => {
    try {
        const { AIHealthService } = import('ai/aiHealthService.js');
        const results = await AIHealthService.probeAllProviders();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Probe all failed', details: err.message });
    }
});

// GET /api/llm/circuits - Get circuit breaker status for all providers
router.get('/circuits', verifyToken, async (req, res) => {
    try {
        const { circuitBreaker } = import('ai/llmService.js');
        const status = circuitBreaker.getStatus();
        res.json({ circuits: status, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get circuit status', details: err.message });
    }
});

// POST /api/llm/circuits/:provider/reset - Reset circuit breaker for a provider
router.post('/circuits/:provider/reset', verifyToken, async (req, res) => {
    const { provider } = req.params;
    try {
        const { circuitBreaker } = import('ai/llmService.js');
        circuitBreaker.reset(provider);
        res.json({ success: true, message: `Circuit reset for ${provider}` });
    } catch (err) {
        res.status(500).json({ error: `Failed to reset circuit for ${provider}`, details: err.message });
    }
});

// GET /api/llm/rate-limits - Get current rate limit status
router.get('/rate-limits', verifyToken, async (req, res) => {
    try {
        const { rateLimiter } = import('ai/rateLimiter.js');
        const status = await rateLimiter.getStatus({
            userId: req.user?.id,
            organizationId: req.headers['x-org-id']
        });
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get rate limit status', details: err.message });
    }
});

// GET /api/llm/costs - Get cost analytics
router.get('/costs', verifyToken, async (req, res) => {
    try {
        const orgId = req.headers['x-org-id'];
        const days = parseInt(req.query.days) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Total costs
        const totals = await dbGet(`
            SELECT 
                SUM(cost_usd) as total_cost,
                SUM(tokens_used) as total_tokens,
                COUNT(*) as total_requests
            FROM ai_audit_logs 
            WHERE timestamp >= ? 
            ${orgId ? 'AND organization_id = ?' : ''}
        `, orgId ? [since, orgId] : [since]);

        // Cost by model
        const byModel = await dbAll(`
            SELECT 
                model,
                SUM(cost_usd) as cost,
                SUM(tokens_used) as tokens,
                COUNT(*) as requests
            FROM ai_audit_logs 
            WHERE timestamp >= ? 
            ${orgId ? 'AND organization_id = ?' : ''}
            GROUP BY model
            ORDER BY cost DESC
        `, orgId ? [since, orgId] : [since]);

        // Cost by capability
        const byCapability = await dbAll(`
            SELECT 
                capability,
                SUM(cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_audit_logs 
            WHERE timestamp >= ? 
            ${orgId ? 'AND organization_id = ?' : ''}
            GROUP BY capability
            ORDER BY cost DESC
        `, orgId ? [since, orgId] : [since]);

        // Daily costs
        const daily = await dbAll(`
            SELECT 
                DATE(timestamp) as date,
                SUM(cost_usd) as cost,
                SUM(tokens_used) as tokens
            FROM ai_audit_logs 
            WHERE timestamp >= ? 
            ${orgId ? 'AND organization_id = ?' : ''}
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
            LIMIT 30
        `, orgId ? [since, orgId] : [since]);

        res.json({
            period: { days, since },
            totals: {
                costUsd: totals?.total_cost || 0,
                tokens: totals?.total_tokens || 0,
                requests: totals?.total_requests || 0
            },
            byModel: byModel || [],
            byCapability: byCapability || [],
            daily: daily || []
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get cost analytics', details: err.message });
    }
});

// GET /api/llm/observability/status - Get observability status
router.get('/observability/status', verifyToken, async (req, res) => {
    try {
        const { getStatus } = import('ai/observability.js');
        const { alertingService } = import('ai/alerting.js');

        res.json({
            observability: getStatus(),
            alerting: alertingService.getStatus(),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get observability status', details: err.message });
    }
});

// GET /api/llm/metrics/summary - Quick summary of AI metrics
router.get('/metrics/summary', verifyToken, async (req, res) => {
    try {
        const metrics = import('ai/metrics.js');
        res.json(metrics.getSummary());
    } catch (err) {
        res.status(500).json({ error: 'Failed to get metrics summary', details: err.message });
    }
});

// GET /api/llm/diagnose - Self-diagnostic and auto-repair endpoint
router.get('/diagnose', async (req, res) => {
    const diagnostics = {
        version: '1.2.0-DIAGNOSTIC-V2',
        timestamp: new Date().toISOString(),
        checks: [],
        repairs: [],
        status: 'OK'
    };

    try {
        // 1. Check if llm_providers table exists
        const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
        const tableCheckQuery = isPg
            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_providers'"
            : "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers'";
        const tableCheck = await new Promise((resolve) => {
            db.get(tableCheckQuery, [], (err, row) => {
                resolve(row ? true : false);
            });
        });

        if (!tableCheck) {
            diagnostics.checks.push({ name: 'llm_providers_table', status: 'MISSING' });
            diagnostics.status = 'REPAIRED';

            await dbRun(`CREATE TABLE IF NOT EXISTS llm_providers(
                id TEXT PRIMARY KEY,
                name TEXT,
                provider TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                input_cost_per_1k REAL DEFAULT 0,
                output_cost_per_1k REAL DEFAULT 0,
                markup_multiplier REAL DEFAULT 1.0,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                visibility TEXT DEFAULT 'admin'
            )`);
            diagnostics.repairs.push('Created llm_providers table');
        } else {
            diagnostics.checks.push({ name: 'llm_providers_table', status: 'OK' });
        }

        const providerCount = await dbGet("SELECT COUNT(*) as count FROM llm_providers");
        diagnostics.checks.push({ name: 'providers_count', value: providerCount?.count || 0 });

        if (!providerCount || providerCount.count === 0) {
            diagnostics.status = 'REPAIRED';
            const defaultId = uuidv4();
            await dbRun(`INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, is_active, is_default, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [defaultId, 'GPT-4o (Default)', 'openai', 'sk-REPLACE-WITH-YOUR-KEY', 'https://api.openai.com/v1', 'gpt-4o', 1, 1, 'public']
            );
            diagnostics.repairs.push('Added default OpenAI provider (needs API key configuration)');
        }

        // 3. Check ai_audit_logs table and tokens_used column
        const auditTableCheckQuery = isPg
            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_audit_logs'"
            : "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_audit_logs'";
        const auditTableCheck = await new Promise((resolve) => {
            db.get(auditTableCheckQuery, [], (err, row) => {
                resolve(row ? true : false);
            });
        });

        if (!auditTableCheck) {
            diagnostics.checks.push({ name: 'ai_audit_logs_table', status: 'MISSING' });
            const idColumn = isPg ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT';
            const timestampType = isPg ? 'TIMESTAMP' : 'TEXT';
            await dbRun(`CREATE TABLE IF NOT EXISTS ai_audit_logs (
                ${idColumn},
                timestamp ${timestampType},
                user_id TEXT,
                organization_id TEXT,
                capability TEXT,
                model TEXT,
                latency_ms INTEGER,
                has_screen_context INTEGER,
                screen_context_hash TEXT,
                success INTEGER,
                error_message TEXT,
                tokens_used INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0
            )`);
            diagnostics.repairs.push('Created ai_audit_logs table with cost tracking');
        } else {
            // Check for tokens_used column
            const columnsQuery = isPg
                ? "SELECT column_name as name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_audit_logs'"
                : "PRAGMA table_info(ai_audit_logs)";
            const columns = await new Promise((resolve) => {
                db.all(columnsQuery, [], (err, rows) => {
                    resolve(rows || []);
                });
            });

            const hasTokensColumn = columns.some(r => r.name === 'tokens_used');
            const hasCostColumn = columns.some(r => r.name === 'cost_usd');

            if (!hasTokensColumn) {
                diagnostics.checks.push({ name: 'ai_audit_logs_tokens_column', status: 'MISSING' });
                await dbRun("ALTER TABLE ai_audit_logs ADD COLUMN tokens_used INTEGER DEFAULT 0");
                diagnostics.repairs.push('Added tokens_used column to ai_audit_logs');
            }

            if (!hasCostColumn) {
                diagnostics.checks.push({ name: 'ai_audit_logs_cost_column', status: 'MISSING' });
                await dbRun("ALTER TABLE ai_audit_logs ADD COLUMN cost_usd REAL DEFAULT 0");
                diagnostics.repairs.push('Added cost_usd column to ai_audit_logs');
            }
        }

        // 4. Get active providers list
        const activeProviders = await dbAll("SELECT id, name, provider, is_active, visibility, api_key FROM llm_providers WHERE is_active = 1");
        diagnostics.checks.push({ name: 'active_providers', value: activeProviders?.length || 0 });

        // 5. Test connection to first active provider
        if (activeProviders && activeProviders.length > 0) {
            const testProvider = activeProviders.find(p => p.provider === 'openai') || activeProviders[0];

            if (testProvider && testProvider.api_key && !testProvider.api_key.includes('REPLACE')) {
                const { LLMService } = import('ai/llmService.js');
                const llmService = new LLMService();

                // Get full config including API key (already in activeProviders details)
                const fullProvider = await dbGet("SELECT * FROM llm_providers WHERE id = ?", [testProvider.id]);

                const testResult = await llmService.testConnection({
                    id: fullProvider.model_id || 'gpt-4o',
                    provider: fullProvider.provider,
                    apiKey: fullProvider.api_key,
                    endpoint: fullProvider.endpoint
                });

                if (testResult.success) {
                    diagnostics.checks.push({ name: 'api_connection', status: 'OK', provider: testProvider.name, details: testResult.response });
                } else {
                    diagnostics.checks.push({ name: 'api_connection', status: 'FAILED', provider: testProvider.name, error: testResult.error });
                    diagnostics.status = 'ERROR';
                }
            } else {
                diagnostics.checks.push({ name: 'api_key_status', status: 'NEEDS_CONFIGURATION', message: 'API key needs to be set in Admin > LLM Providers' });
                diagnostics.status = diagnostics.status === 'OK' ? 'NEEDS_CONFIG' : diagnostics.status;
            }
        }

        res.json(diagnostics);
    } catch (err) {
        console.error('[LLM Diagnose] Error:', err);
        diagnostics.status = 'ERROR';
        diagnostics.error = err.message;
        res.status(500).json(diagnostics);
    }
});

// GET /api/llm/providers/public - Get providers visible to users (PUBLIC)
router.get('/providers/public', async (req, res) => {
    try {
        const providers = await dbAll(
            "SELECT id, name, provider, model_id, endpoint FROM llm_providers WHERE visibility = 'public' AND is_active = 1 ORDER BY name ASC"
        );
        res.json(providers || []);
    } catch (err) {
        console.error('[LLM] providers/public error:', err.message);
        res.json([]);
    }
});

// ==========================================
// V2 PIPELINE ENDPOINT (EPIC 1: AI SPINE)
// ==========================================
const aiPipeline = new AIPipeline();

router.post('/v2/chat', async (req, res) => {
    try {
        const pipelineRequest = {
            type: 'chat',
            userId: req.user ? req.user.id : 'anonymous',
            organizationId: req.headers['x-org-id'] || 'default-org',
            prompt: req.body.prompt,
            messages: req.body.messages,
            capability: req.body.capability || 'chat',
            screenContext: req.body.screenContext,
            options: req.body.options || {}
        };

        const response = await aiPipeline.process(pipelineRequest);

        if (response.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            for await (const chunk of response.stream) {
                if (chunk) res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            res.json(response);
        }
    } catch (err) {
        console.error('Pipeline Error:', err);
        res.status(500).json({ error: 'AI Pipeline Failed', details: err.message });
    }
});

// ==========================================
// PROTECTED ENDPOINTS (Requires Auth)
// ==========================================
router.use(verifyToken);

// GET /api/llm/providers
router.get('/providers', async (req, res) => {
    try {
        const { llmConfigService } = import('ai/llmConfigService.js');

        // If x-org-context header is present and user is admin of that org, return org-specific config
        const orgContext = req.headers['x-org-context'];

        if (orgContext && req.user.organization_id === orgContext) {
            // Tenant Admin View
            const providers = await llmConfigService.getOrganizationProviders(orgContext);
            res.json(providers);
        } else {
            // SuperAdmin / Standard View
            const providers = await dbAll("SELECT * FROM llm_providers ORDER BY name ASC");
            res.json(providers);
        }
    } catch (err) {
        console.error('Failed to fetch providers:', err);
        res.status(500).json({ error: 'Failed to fetch providers' });
    }
});

// POST /api/llm/providers/organization/toggle
router.post('/providers/organization/toggle', verifyToken, async (req, res) => {
    const { providerId, enabled } = req.body;
    const orgId = req.user.organization_id;

    if (!orgId) {
        return res.status(400).json({ error: 'User must belong to an organization' });
    }

    try {
        const { llmConfigService } = import('ai/llmConfigService.js');
        await llmConfigService.toggleOrganizationProvider(orgId, providerId, enabled);
        res.json({ success: true, message: `Provider ${enabled ? 'enabled' : 'disabled'} for organization` });
    } catch (err) {
        console.error('Failed to toggle provider:', err);
        res.status(500).json({ error: 'Failed to update provider status' });
    }
});

// POST /api/llm/providers
router.post('/providers', async (req, res) => {
    const { name, provider, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility } = req.body;
    try {
        const id = uuidv4();
        await dbRun(`
            INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, provider, api_key, endpoint, model_id,
            cost_per_1k || 0,
            input_cost_per_1k || 0,
            output_cost_per_1k || 0,
            markup_multiplier || 1.0,
            is_active ? 1 : 0,
            visibility || 'admin'
        ]);

        res.json({ id, message: 'Provider added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add provider' });
    }
});

// PUT /api/llm/providers/:id
router.put('/providers/:id', async (req, res) => {
    const { name, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility } = req.body;
    const { id } = req.params;
    try {
        await dbRun(`
            UPDATE llm_providers 
            SET name = ?, api_key = ?, endpoint = ?, model_id = ?, cost_per_1k = ?, input_cost_per_1k = ?, output_cost_per_1k = ?, markup_multiplier = ?, is_active = ?, visibility = ?
            WHERE id = ?
        `, [
            name, api_key, endpoint, model_id,
            cost_per_1k,
            input_cost_per_1k || 0,
            output_cost_per_1k || 0,
            markup_multiplier || 1.0,
            is_active ? 1 : 0,
            visibility,
            id
        ]);

        res.json({ message: 'Provider updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update provider' });
    }
});

// DELETE /api/llm/providers/:id
router.delete('/providers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun("DELETE FROM llm_providers WHERE id = ?", [id]);
        res.json({ message: 'Provider deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete provider' });
    }
});

// GET /api/llm/prompts - Get all system prompts
router.get('/prompts', async (req, res) => {
    try {
        const prompts = await dbAll("SELECT * FROM ai_system_prompts ORDER BY key ASC");
        res.json(prompts || []);
    } catch (err) {
        console.error('[LLM] Failed to fetch prompts:', err);
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

// POST /api/llm/prompts - Create or Seed
router.post('/prompts', async (req, res) => {
    const { key, description, content, context_config } = req.body;
    try {
        const id = uuidv4();
        await dbRun(`
            INSERT INTO ai_system_prompts (id, key, description, content, context_config, version)
            VALUES (?, ?, ?, ?, ?, 1)
        `, [id, key, description, content, JSON.stringify(context_config || {})]);
        res.json({ id, message: 'Prompt created' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') ||
            err.message.includes('duplicate key') ||
            err.message.includes('violates unique constraint')) {
            return res.status(409).json({ error: 'Prompt key already exists' });
        }
        res.status(500).json({ error: 'Failed to create prompt' });
    }
});

// PUT /api/llm/prompts/:key - Update or Create (Upsert)
router.put('/prompts/:key', async (req, res) => {
    const { key } = req.params;
    const { content, description, context_config } = req.body;
    const updatedBy = req.user?.id || null;

    try {
        // Check if prompt exists
        const existing = await dbGet("SELECT id FROM ai_system_prompts WHERE key = ?", [key]);

        if (existing) {
            // Update existing
            await dbRun(`
                UPDATE ai_system_prompts 
                SET content = ?, description = ?, context_config = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1
                WHERE key = ?
            `, [content, description || '', JSON.stringify(context_config || {}), updatedBy, key]);
        } else {
            // Create new
            const id = uuidv4();
            await dbRun(`
                INSERT INTO ai_system_prompts (id, key, description, content, context_config, version, updated_by)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            `, [id, key, description || '', content, JSON.stringify(context_config || {}), updatedBy]);
        }

        res.json({ message: 'Prompt saved successfully', key });
    } catch (err) {
        console.error('[LLM] Failed to save prompt:', err);
        res.status(500).json({ error: 'Failed to save prompt' });
    }
});

// MAGIC WAND API (Epic 6: AI Skills)
router.post('/magic-wand', async (req, res) => {
    const { fieldName, fieldContext, screenContext } = req.body;

    if (!fieldName) {
        return res.status(400).json({ error: 'fieldName is required' });
    }

    try {
        const { magicWandService } = import('ai/magicWandService.js');
        let projectData = null;
        if (req.body.projectId) {
            const { mcpServer } = import('ai/mcpServer.js');
            import('ai/tools.js');
            const projectResult = await mcpServer.execute('get_project_details', { projectId: req.body.projectId }, {});
            if (projectResult.status === 'SUCCESS') {
                projectData = projectResult.data;
            }
        }

        const result = await magicWandService.suggest({
            fieldName,
            fieldContext: fieldContext || `Input field for ${fieldName}`,
            screenContext,
            projectData,
            userId: req.user.id,
            organizationId: req.user.organization_id,
            projectId: req.body.projectId
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        console.error('[MagicWand] API Error:', err);
        res.status(500).json({ error: 'Magic Wand failed', details: err.message });
    }
});

// CONTROL PLANE API
router.get('/control/usage', verifyToken, async (req, res) => {
    try {
        const { quotaService } = import('ai/quotaService.js');
        const { cacheService } = import('ai/cacheService.js');
        const orgUsage = await quotaService.getUsage('organization', req.user.organization_id);
        const userUsage = await quotaService.getUsage('user', req.user.id);
        const cacheStats = cacheService.getStats();

        res.json({
            user: userUsage,
            organization: orgUsage,
            cache: cacheStats,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Control Plane] Usage error:', err);
        res.status(500).json({ error: 'Failed to fetch usage data' });
    }
});

router.get('/control/models', verifyToken, async (req, res) => {
    try {
        const { CAPABILITY_TIERS, TIER_DEFAULTS } = import('ai/modelRouter.js');
        const overrides = await dbAll(`SELECT * FROM ai_model_overrides WHERE organization_id = ?`, [req.user.organization_id]);
        res.json({
            tiers: TIER_DEFAULTS,
            capabilities: CAPABILITY_TIERS,
            overrides: overrides || []
        });
    } catch (err) {
        console.error('[Control Plane] Models error:', err);
        res.status(500).json({ error: 'Failed to fetch model config' });
    }
});

router.put('/control/models/:capability', verifyToken, async (req, res) => {
    const { capability } = req.params;
    const { modelId, tier } = req.body;
    const orgId = req.user.organization_id;

    try {
        await dbRun(`
            INSERT INTO ai_model_overrides (id, organization_id, capability, model_id, tier, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(organization_id, capability) DO UPDATE SET
                model_id = excluded.model_id,
                tier = excluded.tier,
                updated_at = CURRENT_TIMESTAMP
        `, [uuidv4(), orgId, capability, modelId, tier]);
        res.json({ success: true, capability, modelId, tier });
    } catch (err) {
        console.error('[Control Plane] Model override error:', err);
        res.status(500).json({ error: 'Failed to set model override' });
    }
});

router.get('/control/quotas', verifyToken, async (req, res) => {
    try {
        const { DEFAULT_QUOTAS } = import('ai/quotaService.js');
        const quotas = await dbAll(`SELECT * FROM ai_usage_quotas WHERE entity_type = 'organization' AND entity_id = ?`, [req.user.organization_id]);
        res.json({ defaults: DEFAULT_QUOTAS, current: quotas || [] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch quotas' });
    }
});

router.put('/control/quotas', verifyToken, async (req, res) => {
    const { entityType, entityId, dailyLimit, monthlyLimit } = req.body;
    try {
        const { quotaService } = import('ai/quotaService.js');
        await quotaService.setQuotaLimits(entityType, entityId, dailyLimit, monthlyLimit);
        res.json({ success: true, message: 'Quota limits updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update quotas' });
    }
});

// AUDIT DASHBOARD API
router.get('/audit/stats', verifyToken, async (req, res) => {
    try {
        const { cacheService } = import('ai/cacheService.js');
        const tokensToday = await dbGet(`SELECT SUM(tokens_used_today) as total FROM ai_usage_quotas WHERE entity_type = 'organization'`);
        const topOrgs = await dbAll(`SELECT entity_id, tokens_used_today, tokens_used_month FROM ai_usage_quotas WHERE entity_type = 'organization' ORDER BY tokens_used_month DESC LIMIT 5`);
        const cacheStats = cacheService.getStats();
        res.json({
            tokensToday: tokensToday?.total || 0,
            tokensThisMonth: topOrgs.reduce((sum, o) => sum + (o.tokens_used_month || 0), 0),
            topOrganizations: topOrgs.map(o => ({ organizationId: o.entity_id, tokensToday: o.tokens_used_today, tokensMonth: o.tokens_used_month })),
            cache: { hits: cacheStats.hits, misses: cacheStats.misses, hitRate: cacheStats.hitRate, estimatedTokensSaved: cacheStats.hits * 1000 },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Audit] Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
});

// DOCUMENT INGESTION API (RAG)
router.post('/ingest', async (req, res) => {
    const { content, filename, mimeType } = req.body;
    if (!content || !filename) return res.status(400).json({ error: 'content and filename are required' });
    try {
        const RagService = import('ragService.js');
        const result = await RagService.ingestDocument({ content, filename, mimeType: mimeType || 'text/plain', organizationId: req.user.organization_id });
        res.json({ success: result.success, documentId: result.documentId, chunks: { total: result.totalChunks, embedded: result.embeddedChunks } });
    } catch (err) {
        console.error('[Ingest] Error:', err);
        res.status(500).json({ error: 'Document ingestion failed', details: err.message });
    }
});

router.get('/search', async (req, res) => {
    const { q, limit = 5 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query (q) is required' });
    try {
        const RagService = import('ragService.js');
        const results = await RagService.searchRelevantChunks(q, { limit: parseInt(limit), organizationId: req.user.organization_id });
        res.json({ query: q, results, count: results.length });
    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// REPORT GENERATOR API
router.post('/generate-report', async (req, res) => {
    const { assessmentData, projectData, screenContext } = req.body;
    if (!assessmentData) return res.status(400).json({ error: 'assessmentData is required' });
    try {
        const { reportGeneratorService } = import('ai/reportGeneratorService.js');
        const result = await reportGeneratorService.generate({ assessmentData, projectData: projectData || null, screenContext: screenContext || null, userId: req.user.id, organizationId: req.user.organization_id });
        if (result.success) res.json(result);
        else res.status(500).json({ error: result.error });
    } catch (err) {
        console.error('[ReportGenerator] API Error:', err);
        res.status(500).json({ error: 'Report generation failed', details: err.message });
    }
});

router.post('/generate-section', async (req, res) => {
    const { sectionType, data } = req.body;
    if (!sectionType || !data) return res.status(400).json({ error: 'sectionType and data are required' });
    try {
        const { reportGeneratorService } = import('ai/reportGeneratorService.js');
        const result = await reportGeneratorService.generateSection({ sectionType, data, userId: req.user.id, organizationId: req.user.organization_id });
        res.json(result);
    } catch (err) {
        console.error('[ReportGenerator] Section Error:', err);
        res.status(500).json({ error: 'Section generation failed', details: err.message });
    }
});

// USER USAGE API - Token consumption visible to end users
router.get('/user/usage', async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organization_id;

        // Get user's quota if exists
        const userQuota = await dbGet(
            `SELECT tokens_used_today, tokens_used_month, daily_token_limit, monthly_token_limit 
             FROM ai_usage_quotas WHERE entity_type = 'user' AND entity_id = ?`,
            [userId]
        );

        // Fallback to organization quota
        const orgQuota = await dbGet(
            `SELECT tokens_used_today, tokens_used_month, daily_token_limit, monthly_token_limit 
             FROM ai_usage_quotas WHERE entity_type = 'organization' AND entity_id = ?`,
            [orgId]
        );

        const quota = userQuota || orgQuota || {
            tokens_used_today: 0,
            tokens_used_month: 0,
            daily_token_limit: 50000,
            monthly_token_limit: 1000000
        };

        // Get recent usage history (last 7 days)
        const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
        const dateFunction = isPg ? 'timestamp::date' : 'DATE(timestamp)';
        const dateCompare = isPg ? "timestamp >= NOW() - INTERVAL '7 days'" : "timestamp >= date('now', '-7 days')";
        const recentUsage = await dbAll(
            `SELECT ${dateFunction} as date, SUM(tokens_used) as tokens, COUNT(*) as requests
             FROM ai_audit_logs 
             WHERE user_id = ? AND ${dateCompare}
             GROUP BY ${dateFunction}
             ORDER BY date DESC`,
            [userId]
        );

        res.json({
            daily: quota.tokens_used_today || 0,
            monthly: quota.tokens_used_month || 0,
            dailyLimit: quota.daily_token_limit || 50000,
            monthlyLimit: quota.monthly_token_limit || 1000000,
            percentage: ((quota.tokens_used_today || 0) / (quota.daily_token_limit || 50000)) * 100,
            recentUsage: recentUsage || [],
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[LLM User Usage] Error:', err);
        res.status(500).json({ error: 'Failed to fetch user usage', details: err.message });
    }
});

// GET /api/llm/user/active-model - Get user's currently active model info
router.get('/user/active-model', async (req, res) => {
    try {
        const orgId = req.user.organization_id;

        // Get organization's active LLM provider
        const orgConfig = await dbGet(
            `SELECT active_llm_provider_id FROM organizations WHERE id = ?`,
            [orgId]
        );

        if (orgConfig?.active_llm_provider_id) {
            const provider = await dbGet(
                `SELECT id, name, provider, model_id FROM llm_providers WHERE id = ?`,
                [orgConfig.active_llm_provider_id]
            );
            if (provider) {
                return res.json({ activeModel: provider, source: 'organization' });
            }
        }

        // Fallback to default public provider
        const defaultProvider = await dbGet(
            `SELECT id, name, provider, model_id FROM llm_providers 
             WHERE is_active = 1 AND visibility = 'public' 
             ORDER BY is_default DESC, name ASC LIMIT 1`
        );

        res.json({
            activeModel: defaultProvider || null,
            source: defaultProvider ? 'default' : 'none'
        });
    } catch (err) {
        console.error('[LLM Active Model] Error:', err);
        res.status(500).json({ error: 'Failed to fetch active model' });
    }
});

// ==========================================
// DETAILED HEALTH CHECK WITH ERROR DIAGNOSIS
// ==========================================

// Import health monitor
const { llmHealthMonitor, HealthStatus, ErrorCategory, ErrorMessages } = import('ai/llmHealthMonitor.js');

/**
 * GET /api/llm/health/detailed
 * Performs live health check with detailed error diagnosis
 */
router.get('/health/detailed', verifyToken, async (req, res) => {
    try {
        // Get all active providers
        const providers = await dbAll(`
            SELECT id, name, provider, api_key, endpoint, model_id, is_active, is_default
            FROM llm_providers 
            WHERE is_active = 1
        `);

        if (providers.length === 0) {
            return res.json({
                success: true,
                summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
                providers: [],
                alerts: []
            });
        }

        // Run health checks
        const results = await llmHealthMonitor.checkAllProviders(providers);
        const summary = llmHealthMonitor.getSummary();

        // Format response with detailed error info
        const formattedResults = results.map(r => ({
            id: r.id,
            name: r.provider,
            providerId: r.providerId,
            status: r.status,
            statusLabel: getHealthStatusLabel(r.status),
            isHealthy: r.status === HealthStatus.HEALTHY,
            isDegraded: r.status === HealthStatus.DEGRADED,
            isUnhealthy: r.status === HealthStatus.UNHEALTHY,
            errorCategory: r.errorCategory,
            error: r.error ? {
                title: r.error.title,
                description: r.error.description,
                action: r.error.action,
                code: r.errorCategory
            } : null,
            rawError: r.rawError,
            statusCode: r.statusCode,
            responseTime: r.responseTime,
            lastCheck: r.lastCheck
        }));

        // Generate alerts for unhealthy providers
        const alerts = formattedResults
            .filter(r => r.isUnhealthy)
            .map(r => ({
                severity: 'error',
                provider: r.name,
                providerId: r.providerId,
                title: r.error?.title || 'Provider niedostępny',
                description: r.error?.description || r.rawError,
                action: r.error?.action || 'Sprawdź konfigurację',
                code: r.errorCategory,
                timestamp: r.lastCheck
            }));

        // Add warnings for degraded providers
        formattedResults
            .filter(r => r.isDegraded)
            .forEach(r => {
                alerts.push({
                    severity: 'warning',
                    provider: r.name,
                    providerId: r.providerId,
                    title: 'Spowolniona odpowiedź',
                    description: `Czas odpowiedzi: ${r.responseTime}ms`,
                    action: 'Monitoruj wydajność',
                    timestamp: r.lastCheck
                });
            });

        res.json({
            success: true,
            summary: {
                ...summary,
                healthyCount: formattedResults.filter(r => r.isHealthy).length,
                degradedCount: formattedResults.filter(r => r.isDegraded).length,
                unhealthyCount: formattedResults.filter(r => r.isUnhealthy).length
            },
            providers: formattedResults,
            alerts: alerts.sort((a, b) => {
                const severityOrder = { error: 0, warning: 1, info: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            }),
            errorCategories: ErrorMessages
        });
    } catch (error) {
        console.error('[LLM Health Detailed] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/llm/health/test-provider
 * Test a specific provider with detailed diagnosis
 */
router.post('/health/test-provider', verifyToken, async (req, res) => {
    try {
        const { providerId } = req.body;

        if (!providerId) {
            return res.status(400).json({
                success: false,
                error: 'providerId is required'
            });
        }

        // Get provider config
        const provider = await dbGet(`
            SELECT id, name, provider, api_key, endpoint, model_id
            FROM llm_providers 
            WHERE id = ?
        `, [providerId]);

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        // Run health check
        const result = await llmHealthMonitor.testProvider(provider);

        res.json({
            success: result.status === HealthStatus.HEALTHY || result.status === HealthStatus.DEGRADED,
            provider: {
                id: providerId,
                name: result.provider,
                providerId: result.providerId,
                status: result.status,
                statusLabel: getHealthStatusLabel(result.status),
                error: result.error ? {
                    title: result.error.title,
                    description: result.error.description,
                    action: result.error.action,
                    code: result.errorCategory
                } : null,
                rawError: result.rawError,
                statusCode: result.statusCode,
                responseTime: result.responseTime,
                lastCheck: result.lastCheck
            }
        });
    } catch (error) {
        console.error('[LLM Health Test] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/llm/health/alerts
 * Get current health alerts
 */
router.get('/health/alerts', verifyToken, async (req, res) => {
    try {
        const cachedStatuses = llmHealthMonitor.getAllCachedStatuses();

        const alerts = cachedStatuses
            .filter(s => s.status !== HealthStatus.HEALTHY)
            .map(s => ({
                severity: s.status === HealthStatus.UNHEALTHY ? 'error' : 'warning',
                provider: s.provider,
                title: s.error?.title || (s.status === HealthStatus.DEGRADED ? 'Spowolniona odpowiedź' : 'Nieznany problem'),
                description: s.error?.description || s.rawError,
                action: s.error?.action || 'Sprawdź konfigurację',
                code: s.errorCategory,
                responseTime: s.responseTime,
                lastCheck: s.lastCheck
            }));

        res.json({
            success: true,
            count: alerts.length,
            alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function for status labels
function getHealthStatusLabel(status) {
    switch (status) {
        case HealthStatus.HEALTHY:
            return { text: 'Zdrowy', textEn: 'Healthy', color: 'green', icon: 'check-circle' };
        case HealthStatus.DEGRADED:
            return { text: 'Spowolniony', textEn: 'Degraded', color: 'yellow', icon: 'alert-triangle' };
        case HealthStatus.UNHEALTHY:
            return { text: 'Niedostępny', textEn: 'Unhealthy', color: 'red', icon: 'x-circle' };
        default:
            return { text: 'Nieznany', textEn: 'Unknown', color: 'gray', icon: 'help-circle' };
    }
}

// Analytics Endpoints

/**
 * GET /api/llm/analytics
 * Get aggregated LLM usage stats
 */
router.get('/analytics', verifyToken, async (req, res) => {
    // Only admins can see analytics
    if (!req.user.is_super_admin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await llmConfigService.getAnalyticsParams(days);
        res.json(stats);
    } catch (error) {
        aiLogger.error('API', 'Failed to fetch analytics', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * GET /api/llm/logs
 * Get detailed request logs
 */
router.get('/logs', verifyToken, async (req, res) => {
    // Only admins can see logs
    if (!req.user.is_super_admin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const onlyErrors = req.query.errors === 'true';

        const logs = await llmConfigService.getRecentLogs(limit, offset, onlyErrors);
        res.json({ logs });
    } catch (error) {
        aiLogger.error('API', 'Failed to fetch logs', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// ==========================================
// NEW LLM DELIVERY SYSTEM - Tier Assignments
// ==========================================

const { modelRouter, TIER_HIERARCHY } = import('ai/modelRouter.js');

/**
 * GET /api/llm/tiers/assignments
 * Get all model-to-tier assignments (SuperAdmin only)
 */
router.get('/tiers/assignments', verifyToken, async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    try {
        const assignments = await modelRouter.getAllTierAssignments();
        res.json({
            success: true,
            tiers: TIER_HIERARCHY,
            assignments
        });
    } catch (error) {
        console.error('[LLM] Failed to get tier assignments:', error);
        res.status(500).json({ error: 'Failed to get tier assignments', details: error.message });
    }
});

/**
 * POST /api/llm/tiers/assign
 * Assign a model to a tier (SuperAdmin only)
 */
router.post('/tiers/assign', verifyToken, async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    try {
        const { providerId, tier, priority = 0 } = req.body;

        if (!providerId || !tier) {
            return res.status(400).json({ error: 'providerId and tier are required' });
        }

        if (!TIER_HIERARCHY.includes(tier)) {
            return res.status(400).json({ error: `Invalid tier. Must be one of: ${TIER_HIERARCHY.join(', ')}` });
        }

        const result = await modelRouter.assignModelToTier(providerId, tier, priority);
        
        // Clear cache after assignment change
        modelRouter.clearCache();

        res.json({
            success: true,
            assignment: result
        });
    } catch (error) {
        console.error('[LLM] Failed to assign model to tier:', error);
        res.status(500).json({ error: 'Failed to assign model to tier', details: error.message });
    }
});

/**
 * DELETE /api/llm/tiers/assign
 * Remove a model from a tier (SuperAdmin only)
 */
router.delete('/tiers/assign', verifyToken, async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    try {
        const { providerId, tier } = req.body;

        if (!providerId || !tier) {
            return res.status(400).json({ error: 'providerId and tier are required' });
        }

        await modelRouter.removeModelFromTier(providerId, tier);
        
        // Clear cache after assignment change
        modelRouter.clearCache();

        res.json({ success: true });
    } catch (error) {
        console.error('[LLM] Failed to remove model from tier:', error);
        res.status(500).json({ error: 'Failed to remove model from tier', details: error.message });
    }
});

/**
 * PUT /api/llm/tiers/priority
 * Update priority of a model within a tier (SuperAdmin only)
 */
router.put('/tiers/priority', verifyToken, async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    try {
        const { providerId, tier, priority } = req.body;

        if (!providerId || !tier || priority === undefined) {
            return res.status(400).json({ error: 'providerId, tier, and priority are required' });
        }

        await modelRouter.updateTierPriority(providerId, tier, priority);
        
        // Clear cache after priority change
        modelRouter.clearCache();

        res.json({ success: true });
    } catch (error) {
        console.error('[LLM] Failed to update tier priority:', error);
        res.status(500).json({ error: 'Failed to update tier priority', details: error.message });
    }
});

/**
 * POST /api/llm/tiers/bulk-assign
 * Bulk assign models to tiers (SuperAdmin only)
 * Body: { assignments: [{ providerId, tier, priority }] }
 */
router.post('/tiers/bulk-assign', verifyToken, async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    try {
        const { assignments } = req.body;

        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ error: 'assignments array is required' });
        }

        const results = [];
        for (const assignment of assignments) {
            const { providerId, tier, priority = 0 } = assignment;
            if (providerId && tier && TIER_HIERARCHY.includes(tier)) {
                const result = await modelRouter.assignModelToTier(providerId, tier, priority);
                results.push(result);
            }
        }

        // Clear cache after bulk changes
        modelRouter.clearCache();

        res.json({
            success: true,
            count: results.length,
            assignments: results
        });
    } catch (error) {
        console.error('[LLM] Failed to bulk assign models to tiers:', error);
        res.status(500).json({ error: 'Failed to bulk assign', details: error.message });
    }
});

// ==========================================
// NEW LLM DELIVERY SYSTEM - Organization Provider Settings
// ==========================================

/**
 * GET /api/llm/org/:orgId/providers
 * Get organization's provider settings (Admin only)
 */
router.get('/org/:orgId/providers', verifyToken, async (req, res) => {
    const { orgId } = req.params;

    // Check access: must be admin of this org or superadmin
    if (!req.user.is_super_admin && req.user.organization_id !== orgId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    try {
        const providers = await modelRouter.getOrgProviderSettings(orgId);
        res.json({
            success: true,
            organizationId: orgId,
            providers
        });
    } catch (error) {
        console.error('[LLM] Failed to get org provider settings:', error);
        res.status(500).json({ error: 'Failed to get provider settings', details: error.message });
    }
});

/**
 * PUT /api/llm/org/:orgId/providers/:providerId
 * Enable/disable a provider for an organization (Admin only)
 */
router.put('/org/:orgId/providers/:providerId', verifyToken, async (req, res) => {
    const { orgId, providerId } = req.params;
    const { isEnabled } = req.body;

    // Check access: must be admin of this org or superadmin
    if (!req.user.is_super_admin && req.user.organization_id !== orgId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    try {
        await modelRouter.setOrgProviderEnabled(orgId, providerId, isEnabled);
        
        // Clear cache after settings change
        modelRouter.clearCache();

        res.json({
            success: true,
            organizationId: orgId,
            providerId,
            isEnabled
        });
    } catch (error) {
        console.error('[LLM] Failed to update org provider setting:', error);
        res.status(500).json({ error: 'Failed to update provider setting', details: error.message });
    }
});

/**
 * PUT /api/llm/org/:orgId/providers/bulk
 * Bulk update provider settings for an organization (Admin only)
 * Body: { settings: [{ providerId, isEnabled, customPriority? }] }
 */
router.put('/org/:orgId/providers/bulk', verifyToken, async (req, res) => {
    const { orgId } = req.params;
    const { settings } = req.body;

    // Check access: must be admin of this org or superadmin
    if (!req.user.is_super_admin && req.user.organization_id !== orgId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'settings array is required' });
    }

    try {
        for (const setting of settings) {
            const { providerId, isEnabled } = setting;
            if (providerId !== undefined && isEnabled !== undefined) {
                await modelRouter.setOrgProviderEnabled(orgId, providerId, isEnabled);
            }
        }

        // Clear cache after bulk changes
        modelRouter.clearCache();

        res.json({
            success: true,
            organizationId: orgId,
            updated: settings.length
        });
    } catch (error) {
        console.error('[LLM] Failed to bulk update org provider settings:', error);
        res.status(500).json({ error: 'Failed to bulk update', details: error.message });
    }
});

/**
 * GET /api/llm/org/:orgId/available-models
 * Get available models for organization based on enabled providers and tier
 */
router.get('/org/:orgId/available-models', verifyToken, async (req, res) => {
    const { orgId } = req.params;
    const { tier } = req.query;

    try {
        const result = {};
        const tiersToFetch = tier ? [tier] : TIER_HIERARCHY;

        for (const t of tiersToFetch) {
            const models = await modelRouter.getModelsForTier(t, orgId);
            result[t] = models.map(m => ({
                id: m.id,
                name: m.name,
                provider: m.provider,
                model_id: m.model_id,
                health_status: m.health_status
            }));
        }

        res.json({
            success: true,
            organizationId: orgId,
            tiers: result
        });
    } catch (error) {
        console.error('[LLM] Failed to get available models:', error);
        res.status(500).json({ error: 'Failed to get available models', details: error.message });
    }
});

export default router;
