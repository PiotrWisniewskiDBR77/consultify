/**
 * AI Health Service
 * Responsibility: Perform capability tests and health monitoring for the AI system.
 * 
 * Features:
 * - Capability testing (connection, eyes, memory, hands, reasoning)
 * - Circuit breaker status
 * - Rate limiter status
 * - Redis/Cache status
 * - Provider health probes
 */

const { AIPipeline } = require('./aiPipeline');
const { aiLogger } = require('./logger');
const { circuitBreaker } = require('./llmService');
const { rateLimiter } = require('./rateLimiter');
const { cacheService } = require('./cacheService');
const { isRedisConnected, healthCheck: redisHealthCheck } = require('./redisClient');
const db = require('../../database');

class AIHealthService {
    constructor() {
        this.pipeline = new AIPipeline();
    }

    /**
     * Test a specific AI capability
     * @param {string} capability - 'connection' | 'eyes' | 'memory' | 'hands' | 'reasoning'
     */
    async testCapability(capability, context = {}) {
        const startTime = Date.now();
        const results = {
            capability,
            status: 'PENDING',
            latency: 0,
            details: null,
            error: null
        };

        try {
            switch (capability) {
                case 'connection':
                    results.details = await this.testConnection();
                    break;
                case 'eyes':
                    results.details = await this.testEyes(context);
                    break;
                case 'memory':
                    results.details = await this.testMemory(context);
                    break;
                case 'hands':
                    results.details = await this.testHands(context);
                    break;
                case 'reasoning':
                    results.details = await this.testReasoning(context);
                    break;
                default:
                    throw new Error(`Unknown capability: ${capability}`);
            }
            results.status = 'SUCCESS';
        } catch (err) {
            results.status = 'FAILED';
            results.error = err.message;
            aiLogger.error('HealthService', `Test failed: ${capability}`, err);
        } finally {
            results.latency = Date.now() - startTime;
        }

        return results;
    }

    /**
     * 1. Test basic LLM connection
     */
    async testConnection() {
        const response = await this.pipeline.process({
            type: 'chat',
            capability: 'chat_simple',
            prompt: 'Respond with "pong"',
            userId: 'system-test',
            organizationId: 'system'
        });
        return { model: response.metadata?.model, text: response.content };
    }

    /**
     * 2. Test Visual Context (AI Eyes)
     */
    async testEyes(context) {
        const mockScreenContext = context.screenContext || {
            screen_id: 'health_test',
            visible_data: { test_value: 42 }
        };
        const response = await this.pipeline.process({
            type: 'chat',
            capability: 'chat',
            prompt: 'What is the test_value visible on my screen?',
            screenContext: mockScreenContext,
            userId: 'system-test',
            organizationId: 'system'
        });
        return { response: response.content, detected: response.content.includes('42') };
    }

    /**
     * 3. Test RAG (AI Memory)
     */
    async testMemory(context) {
        const query = context.query || 'DRD methodology';
        const response = await this.pipeline.process({
            type: 'chat',
            capability: 'chat',
            prompt: `Tell me something specific about ${query} based on knowledge base.`,
            userId: 'system-test',
            organizationId: 'system'
        });
        return { response: response.content, hasSources: !!response.content.match(/Source/i) };
    }

    /**
     * 4. Test MCP Tools (AI Hands)
     */
    async testHands(context) {
        const response = await this.pipeline.process({
            type: 'chat',
            capability: 'chat',
            prompt: 'Get the details for project "system-test-id"',
            enableTools: true,
            userId: 'system-test',
            organizationId: 'system'
        });
        const toolCalled = response.toolCalls?.some(tc => tc.name === 'get_project_details');
        return { response: response.content, toolCalled };
    }

    /**
     * 5. Test MAX Mode (Reasoning)
     */
    async testReasoning(context) {
        const response = await this.pipeline.process({
            type: 'chat',
            capability: 'max_mode',
            prompt: 'Explain the strategic impact of digital transformation in 3 steps.',
            userId: 'system-test',
            organizationId: 'system'
        });
        return { response: response.content, model: response.metadata?.model };
    }

    /**
     * Get system-wide AI status including all subsystems
     */
    async getStatus() {
        const providers = await new Promise((resolve) => {
            db.all("SELECT name, provider, is_active, visibility FROM llm_providers", [], (err, rows) => resolve(rows || []));
        });

        // Get last 50 audit logs to check success rate
        const logs = await new Promise((resolve) => {
            db.all("SELECT success, latency_ms FROM ai_audit_logs ORDER BY timestamp DESC LIMIT 50", [], (err, rows) => resolve(rows || []));
        });

        const successCount = logs.filter(l => l.success === 1).length;
        const avgLatency = logs.length > 0 ? logs.reduce((sum, l) => sum + l.latency_ms, 0) / logs.length : 0;

        // Get circuit breaker status
        const circuitStatus = circuitBreaker ? circuitBreaker.getStatus() : {};

        // Get cache stats
        const cacheStats = cacheService.getStats();

        // Get Redis health
        let redisStatus = { status: 'disconnected' };
        try {
            redisStatus = await redisHealthCheck();
        } catch (e) {
            redisStatus = { status: 'error', error: e.message };
        }

        return {
            providers: providers.map(p => {
                const providerCircuit = circuitStatus[p.provider] || { state: 'CLOSED' };
                return {
                    name: p.name,
                    type: p.provider,
                    status: p.is_active ? 'ACTIVE' : 'INACTIVE',
                    visibility: p.visibility,
                    circuitState: providerCircuit.state,
                    circuitFailures: providerCircuit.failures || 0
                };
            }),
            metrics: {
                uptime50: logs.length > 0 ? (successCount / logs.length) * 100 : 100,
                avgLatencyMs: Math.round(avgLatency),
                totalRequests: logs.length
            },
            subsystems: {
                circuitBreaker: {
                    status: Object.keys(circuitStatus).length > 0 ? 'ACTIVE' : 'INACTIVE',
                    circuits: circuitStatus
                },
                cache: {
                    status: cacheStats.redisConnected ? 'REDIS' : 'MEMORY',
                    hitRate: cacheStats.hitRate,
                    size: cacheStats.memoryCacheSize
                },
                redis: redisStatus,
                rateLimiter: {
                    status: 'ACTIVE',
                    backend: isRedisConnected() ? 'REDIS' : 'MEMORY'
                }
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Pre-flight health check for a specific provider
     * @param {string} providerId - Provider to check (e.g., 'openai', 'anthropic')
     */
    async probeProvider(providerId) {
        // Check circuit breaker first
        const circuitCheck = circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            return {
                providerId,
                status: 'CIRCUIT_OPEN',
                message: circuitCheck.reason,
                healthy: false
            };
        }

        // Get provider config from DB
        const providerConfig = await new Promise((resolve) => {
            db.get(
                "SELECT * FROM llm_providers WHERE provider = ? AND is_active = 1 LIMIT 1",
                [providerId],
                (err, row) => resolve(row)
            );
        });

        if (!providerConfig) {
            return {
                providerId,
                status: 'NOT_CONFIGURED',
                message: `No active provider found for ${providerId}`,
                healthy: false
            };
        }

        // Test connection
        const { LLMService } = require('./llmService');
        const llmService = new LLMService();
        
        const testResult = await llmService.testConnection({
            id: providerConfig.model_id || 'gpt-4o',
            provider: providerConfig.provider,
            apiKey: providerConfig.api_key,
            endpoint: providerConfig.endpoint
        });

        return {
            providerId,
            status: testResult.success ? 'HEALTHY' : 'UNHEALTHY',
            message: testResult.success ? testResult.response : testResult.error,
            circuitState: testResult.circuitState,
            healthy: testResult.success
        };
    }

    /**
     * Run health probes for all active providers
     */
    async probeAllProviders() {
        const providers = await new Promise((resolve) => {
            db.all(
                "SELECT DISTINCT provider FROM llm_providers WHERE is_active = 1",
                [],
                (err, rows) => resolve(rows || [])
            );
        });

        const results = {};
        for (const p of providers) {
            results[p.provider] = await this.probeProvider(p.provider);
        }

        return results;
    }
}

module.exports = { AIHealthService: new AIHealthService() };



