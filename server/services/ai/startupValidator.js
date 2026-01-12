/**
 * Startup Validator for LLM Providers
 * 
 * Performs comprehensive health checks on server startup to ensure
 * AI services are properly configured and available.
 * 
 * Features:
 * - Validates all configured API keys
 * - Tests actual connectivity to LLM providers
 * - Generates detailed health report
 * - Supports graceful degradation
 * 
 * @module server/services/ai/startupValidator
 */

import { llmConfigService, PROVIDER_DEFINITIONS } from './llmConfigService.js';
import { aiLogger } from './logger.js';
import jwt from 'jsonwebtoken';

// Timeout for provider health checks (ms)
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

// Minimum providers required for startup (0 = allow degraded mode)
const MIN_PROVIDERS_REQUIRED = 0;

/**
 * Health check result interface
 * @typedef {Object} HealthCheckResult
 * @property {string} provider - Provider ID
 * @property {string} name - Provider display name
 * @property {boolean} configured - Whether API key is present
 * @property {boolean} valid - Whether API key format is valid
 * @property {boolean} reachable - Whether provider API responded
 * @property {number|null} latency - Response time in ms
 * @property {string|null} error - Error message if any
 * @property {string} status - Overall status ('healthy', 'degraded', 'unhealthy', 'unconfigured')
 */

/**
 * Test connectivity to a specific LLM provider
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} Health check result
 */
async function testProviderConnection(providerConfig) {
    const result = {
        provider: providerConfig.provider,
        name: PROVIDER_DEFINITIONS[providerConfig.provider]?.name || providerConfig.provider,
        configured: true,
        valid: true,
        reachable: false,
        latency: null,
        error: null,
        status: 'unhealthy',
        model: providerConfig.model_id,
        endpoint: providerConfig.endpoint
    };

    const startTime = Date.now();

    try {
        const provider = providerConfig.provider;
        const apiKey = providerConfig.api_key;
        const endpoint = providerConfig.endpoint;

        // Provider-specific health checks
        switch (provider) {
            case 'openai':
                await testOpenAI(apiKey, endpoint);
                break;
            case 'google':
            case 'gemini':
                await testGemini(apiKey);
                break;
            case 'deepseek':
                await testOpenAICompatible(apiKey, endpoint || 'https://api.deepseek.com/chat/completions', 'deepseek-chat');
                break;
            case 'anthropic':
                await testAnthropic(apiKey, endpoint);
                break;
            case 'nvidia':
                await testOpenAICompatible(apiKey, endpoint || 'https://integrate.api.nvidia.com/v1/chat/completions', 'meta/llama-3.1-70b-instruct');
                break;
            case 'cohere':
                await testCohere(apiKey, endpoint);
                break;
            case 'qwen':
                await testOpenAICompatible(apiKey, endpoint || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-max');
                break;
            case 'zai':
                await testZAI(apiKey, providerConfig.model_id || 'glm-4');
                break;
            case 'ollama':
                await testOllama(endpoint || 'http://localhost:11434');
                break;
            default:
                // Generic test for unknown providers
                result.error = 'Unknown provider type';
                return result;
        }

        result.reachable = true;
        result.status = 'healthy';
        result.latency = Date.now() - startTime;

    } catch (error) {
        result.latency = Date.now() - startTime;
        result.error = error.message || 'Connection failed';

        // Determine if it's a configuration or connectivity issue
        if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('invalid_api_key')) {
            result.valid = false;
            result.status = 'invalid_key';
        } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            result.status = 'timeout';
        } else {
            result.status = 'unhealthy';
        }
    }

    return result;
}

// ============================================================================
// PROVIDER-SPECIFIC TEST FUNCTIONS
// ============================================================================

async function testOpenAI(apiKey, endpoint) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.error?.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testGemini(apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        // Use models list endpoint for lightweight check
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.error?.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testAnthropic(apiKey, endpoint) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        const response = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.error?.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testOpenAICompatible(apiKey, endpoint, model) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.error?.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testCohere(apiKey, endpoint) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        const response = await fetch(endpoint || 'https://api.cohere.ai/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'command-r',
                message: 'Hi',
                max_tokens: 1
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testZAI(apiKey, model) {
    // z.ai requires JWT signing
    const [id, secret] = apiKey.split('.');

    if (!id || !secret) {
        throw new Error('Invalid z.ai key format (expected: id.secret)');
    }

    const now = Date.now();
    const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: model || 'glm-4-plus',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${response.status}: ${errorData.error?.message || response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testOllama(baseUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
        // Use tags endpoint to check if Ollama is running
        const response = await fetch(`${baseUrl}/api/tags`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`${response.status}: ${response.statusText}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============================================================================
// MAIN VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate all LLM providers on startup
 * @param {Object} options - Validation options
 * @param {boolean} options.testConnectivity - Whether to test actual API connectivity (default: true)
 * @param {boolean} options.parallel - Whether to run tests in parallel (default: true)
 * @returns {Promise<Object>} Health report
 */
async function validateOnStartup(options = {}) {
    const { testConnectivity = true, parallel = true } = options;

    aiLogger.info('StartupValidator', '====== LLM Provider Health Check Started ======');
    const startTime = Date.now();

    // Initialize config service
    await llmConfigService.initialize();

    // Validate key formats
    const keyValidation = await llmConfigService.validateAllKeys();

    const report = {
        timestamp: new Date().toISOString(),
        duration: 0,
        providers: [],
        summary: {
            total: keyValidation.summary.total,
            configured: keyValidation.summary.configured,
            healthy: 0,
            degraded: 0,
            unhealthy: 0,
            unconfigured: keyValidation.summary.unconfigured
        },
        defaultProvider: null,
        fallbackChain: [],
        criticalErrors: [],
        warnings: []
    };

    // Get all providers from database
    const configuredProviders = await llmConfigService.getAllProviders();

    // Test connectivity for configured providers
    if (testConnectivity && configuredProviders.length > 0) {
        aiLogger.info('StartupValidator', `Testing ${configuredProviders.length} configured providers...`);

        const testPromises = configuredProviders.map(async (provider) => {
            if (!provider.api_key) {
                return {
                    provider: provider.provider,
                    name: PROVIDER_DEFINITIONS[provider.provider]?.name || provider.provider,
                    configured: false,
                    valid: false,
                    reachable: false,
                    status: 'unconfigured',
                    error: 'No API key'
                };
            }

            return testProviderConnection(provider);
        });

        const results = parallel
            ? await Promise.all(testPromises)
            : await sequentialTests(testPromises);

        // Process results
        for (const result of results) {
            report.providers.push(result);

            // Update health status in config service
            await llmConfigService.updateHealthStatus(result.provider, result.status, {
                latency: result.latency,
                error: result.error
            });

            // Update summary
            if (result.status === 'healthy') {
                report.summary.healthy++;
            } else if (result.status === 'degraded' || result.status === 'timeout') {
                report.summary.degraded++;
                report.warnings.push(`${result.name}: ${result.error || 'Degraded performance'}`);
            } else if (result.status === 'unconfigured') {
                // Already counted in unconfigured
            } else {
                report.summary.unhealthy++;
                if (result.status === 'invalid_key') {
                    report.warnings.push(`${result.name}: Invalid API key`);
                }
            }
        }
    } else {
        // No connectivity test - just report configuration status
        for (const provider of keyValidation.providers) {
            report.providers.push({
                ...provider,
                reachable: null,
                latency: null,
                status: provider.configured ? 'unknown' : 'unconfigured'
            });
        }
    }

    // Get default provider
    const defaultProvider = await llmConfigService.getDefaultProvider();
    if (defaultProvider) {
        report.defaultProvider = {
            provider: defaultProvider.provider,
            name: PROVIDER_DEFINITIONS[defaultProvider.provider]?.name || defaultProvider.provider,
            model: defaultProvider.model_id
        };
    }

    // Get fallback chain
    report.fallbackChain = await llmConfigService.getFallbackChain();

    // Check for critical errors
    if (report.summary.healthy === 0 && report.summary.degraded === 0) {
        if (report.summary.configured > 0) {
            report.criticalErrors.push('All configured LLM providers are unreachable');
        } else {
            report.criticalErrors.push('No LLM providers configured. AI features will not work.');
        }
    }

    if (report.summary.healthy + report.summary.degraded < MIN_PROVIDERS_REQUIRED) {
        report.criticalErrors.push(`Minimum ${MIN_PROVIDERS_REQUIRED} healthy providers required`);
    }

    report.duration = Date.now() - startTime;

    // Log summary
    logHealthReport(report);

    return report;
}

/**
 * Run tests sequentially (for debugging/rate limiting)
 */
async function sequentialTests(promises) {
    const results = [];
    for (const promise of promises) {
        results.push(await promise);
    }
    return results;
}

/**
 * Log health report to console/logger
 */
function logHealthReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('  LLM PROVIDER HEALTH CHECK REPORT');
    console.log('='.repeat(60));
    console.log(`  Timestamp: ${report.timestamp}`);
    console.log(`  Duration:  ${report.duration}ms`);
    console.log('-'.repeat(60));

    console.log('\n  PROVIDER STATUS:');
    for (const provider of report.providers) {
        const statusIcon = getStatusIcon(provider.status);
        const latency = provider.latency ? ` (${provider.latency}ms)` : '';
        console.log(`    ${statusIcon} ${provider.name.padEnd(20)} ${provider.status}${latency}`);
        if (provider.error && provider.status !== 'unconfigured') {
            console.log(`       └─ Error: ${provider.error}`);
        }
    }

    console.log('\n  SUMMARY:');
    console.log(`    Total:        ${report.summary.total}`);
    console.log(`    Configured:   ${report.summary.configured}`);
    console.log(`    Healthy:      ${report.summary.healthy}`);
    console.log(`    Degraded:     ${report.summary.degraded}`);
    console.log(`    Unhealthy:    ${report.summary.unhealthy}`);
    console.log(`    Unconfigured: ${report.summary.unconfigured}`);

    if (report.defaultProvider) {
        console.log(`\n  DEFAULT PROVIDER: ${report.defaultProvider.name} (${report.defaultProvider.model})`);
    }

    if (report.fallbackChain.length > 0) {
        console.log(`  FALLBACK CHAIN:  ${report.fallbackChain.join(' → ')}`);
    }

    if (report.criticalErrors.length > 0) {
        console.log('\n  ⚠️  CRITICAL ERRORS:');
        for (const error of report.criticalErrors) {
            console.log(`    ❌ ${error}`);
        }
    }

    if (report.warnings.length > 0) {
        console.log('\n  WARNINGS:');
        for (const warning of report.warnings) {
            console.log(`    ⚠️  ${warning}`);
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

function getStatusIcon(status) {
    const icons = {
        'healthy': '✅',
        'degraded': '⚠️ ',
        'unhealthy': '❌',
        'unconfigured': '⬜',
        'invalid_key': '🔑',
        'timeout': '⏱️ ',
        'unknown': '❓'
    };
    return icons[status] || '❓';
}

/**
 * Generate a simple health report without connectivity tests
 * @returns {Promise<Object>} Quick health report
 */
async function generateQuickHealthReport() {
    await llmConfigService.initialize();

    const keyValidation = await llmConfigService.validateAllKeys();
    const defaultProvider = await llmConfigService.getDefaultProvider();
    const fallbackChain = await llmConfigService.getFallbackChain();

    return {
        timestamp: new Date().toISOString(),
        hasAnyProvider: keyValidation.summary.configured > 0,
        configuredCount: keyValidation.summary.configured,
        defaultProvider: defaultProvider?.provider || null,
        fallbackChain,
        healthStatus: llmConfigService.getHealthStatusMap()
    };
}

/**
 * Test a single provider's connectivity
 * @param {string} providerId - Provider to test
 * @returns {Promise<Object>} Test result
 */
async function testSingleProvider(providerId) {
    const config = await llmConfigService.getProviderConfig(providerId);

    if (!config) {
        return {
            provider: providerId,
            configured: false,
            reachable: false,
            status: 'unconfigured',
            error: 'Provider not configured'
        };
    }

    return testProviderConnection(config);
}

export {
validateOnStartup,
    testProviderConnection,
    testSingleProvider,
    generateQuickHealthReport,
    HEALTH_CHECK_TIMEOUT
};

export default {
    validateOnStartup,
    testProviderConnection,
    testSingleProvider,
    generateQuickHealthReport,
    HEALTH_CHECK_TIMEOUT
};









