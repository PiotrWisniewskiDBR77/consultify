const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { AIPipeline } = require('../services/ai/aiPipeline.js');

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

// GET /api/llm/providers/health - Check connectivity and health of all providers
router.get('/providers/health', async (req, res) => {
    try {
        const llmFallbackService = require('../services/llmFallbackService');

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
        const llmFallbackService = require('../services/llmFallbackService');
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
        const llmFallbackService = require('../services/llmFallbackService');
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
        const { LLMService } = require('../services/ai/llmService');
        const { ModelRouter } = require('../services/ai/modelRouter');

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
        const { isRedisConnected, healthCheck } = require('../services/ai/redisClient');
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
        const { alertingService } = require('../services/ai/alerting');
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
        const { getStatus, initLangfuse } = require('../services/ai/observability');
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
        const { comprehensiveReportGenerator } = require('../services/ai/comprehensiveReportGenerator');
        const { webResearchService } = require('../services/ai/webResearchService');
        const { contextBuilder } = require('../services/ai/aiContext');

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
        const metrics = require('../services/ai/metrics');
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
        const { AIHealthService } = require('../services/ai/aiHealthService');
        const status = await AIHealthService.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch AI status', details: err.message });
    }
});

// POST /api/llm/health/test/:capability - Test a specific AI capability
router.post('/health/test/:capability', verifyToken, async (req, res) => {
    const { capability } = req.params;
    const { context } = req.body;

    try {
        const { AIHealthService } = require('../services/ai/aiHealthService');
        const results = await AIHealthService.testCapability(capability, context);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: `Test failed for ${capability}`, details: err.message });
    }
});

// GET /api/llm/health/probe/:provider - Pre-flight health check for a provider
router.get('/health/probe/:provider', verifyToken, async (req, res) => {
    const { provider } = req.params;
    try {
        const { AIHealthService } = require('../services/ai/aiHealthService');
        const result = await AIHealthService.probeProvider(provider);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: `Probe failed for ${provider}`, details: err.message });
    }
});

// GET /api/llm/health/probe-all - Pre-flight health check for all providers
router.get('/health/probe-all', verifyToken, async (req, res) => {
    try {
        const { AIHealthService } = require('../services/ai/aiHealthService');
        const results = await AIHealthService.probeAllProviders();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Probe all failed', details: err.message });
    }
});

// GET /api/llm/circuits - Get circuit breaker status for all providers
router.get('/circuits', verifyToken, async (req, res) => {
    try {
        const { circuitBreaker } = require('../services/ai/llmService');
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
        const { circuitBreaker } = require('../services/ai/llmService');
        circuitBreaker.reset(provider);
        res.json({ success: true, message: `Circuit reset for ${provider}` });
    } catch (err) {
        res.status(500).json({ error: `Failed to reset circuit for ${provider}`, details: err.message });
    }
});

// GET /api/llm/rate-limits - Get current rate limit status
router.get('/rate-limits', verifyToken, async (req, res) => {
    try {
        const { rateLimiter } = require('../services/ai/rateLimiter');
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
        const { getStatus } = require('../services/ai/observability');
        const { alertingService } = require('../services/ai/alerting');

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
        const metrics = require('../services/ai/metrics');
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
        const tableCheck = await new Promise((resolve) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers'", [], (err, row) => {
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
        const auditTableCheck = await new Promise((resolve) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_audit_logs'", [], (err, row) => {
                resolve(row ? true : false);
            });
        });

        if (!auditTableCheck) {
            diagnostics.checks.push({ name: 'ai_audit_logs_table', status: 'MISSING' });
            await dbRun(`CREATE TABLE IF NOT EXISTS ai_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
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
            const columns = await new Promise((resolve) => {
                db.all("PRAGMA table_info(ai_audit_logs)", [], (err, rows) => {
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
                const { LLMService } = require('../services/ai/llmService');
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
        const providers = await dbAll("SELECT * FROM llm_providers ORDER BY name ASC");
        res.json(providers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch providers' });
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
        if (err.message.includes('UNIQUE constraint failed')) {
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
        const { magicWandService } = require('../services/ai/magicWandService');
        let projectData = null;
        if (req.body.projectId) {
            const { mcpServer } = require('../services/ai/mcpServer');
            require('../services/ai/tools');
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
router.get('/control/usage', async (req, res) => {
    try {
        const { quotaService } = require('../services/ai/quotaService');
        const { cacheService } = require('../services/ai/cacheService');
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

router.get('/control/models', async (req, res) => {
    try {
        const { CAPABILITY_TIERS, TIER_DEFAULTS } = require('../services/ai/modelRouter');
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

router.put('/control/models/:capability', async (req, res) => {
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

router.get('/control/quotas', async (req, res) => {
    try {
        const { DEFAULT_QUOTAS } = require('../services/ai/quotaService');
        const quotas = await dbAll(`SELECT * FROM ai_usage_quotas WHERE entity_type = 'organization' AND entity_id = ?`, [req.user.organization_id]);
        res.json({ defaults: DEFAULT_QUOTAS, current: quotas || [] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch quotas' });
    }
});

router.put('/control/quotas', async (req, res) => {
    const { entityType, entityId, dailyLimit, monthlyLimit } = req.body;
    try {
        const { quotaService } = require('../services/ai/quotaService');
        await quotaService.setQuotaLimits(entityType, entityId, dailyLimit, monthlyLimit);
        res.json({ success: true, message: 'Quota limits updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update quotas' });
    }
});

// AUDIT DASHBOARD API
router.get('/audit/stats', async (req, res) => {
    try {
        const { cacheService } = require('../services/ai/cacheService');
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
        const RagService = require('../services/ragService');
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
        const RagService = require('../services/ragService');
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
        const { reportGeneratorService } = require('../services/ai/reportGeneratorService');
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
        const { reportGeneratorService } = require('../services/ai/reportGeneratorService');
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
        const recentUsage = await dbAll(
            `SELECT DATE(timestamp) as date, SUM(tokens_used) as tokens, COUNT(*) as requests
             FROM ai_audit_logs 
             WHERE user_id = ? AND timestamp >= date('now', '-7 days')
             GROUP BY DATE(timestamp)
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

module.exports = router;
