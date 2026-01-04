/**
 * LLM Fallback Service
 * 
 * Implements intelligent automatic provider switching when LLM calls fail.
 * Key features:
 * - Multi-provider fallback chain
 * - Network connectivity monitoring
 * - Provider health tracking
 * - Auto/MAX/Multi-model mode support
 * 
 * "When one door closes, another opens" - but automatically.
 */

import CircuitBreakerService from './circuitBreakerService.js';
import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();



// Provider priority chains by capability tier
const FALLBACK_CHAINS = {
    BUDGET: ['deepseek-chat', 'qwen-turbo', 'gpt-4o-mini', 'gemini-1.5-flash'],
    STANDARD: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'deepseek-chat'],
    PREMIUM: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'o1-preview'],
    REASONING: ['o1-preview', 'o1', 'claude-3-opus', 'gpt-4o'],
    VISION: ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet'],
    CODING: ['deepseek-coder', 'gpt-4o', 'claude-3-5-sonnet']
};

// Provider endpoint mappings
const PROVIDER_ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    together: 'https://api.together.xyz/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    nvidia: 'https://integrate.api.nvidia.com/v1/models',
    cohere: 'https://api.cohere.com/v1/check-api-key',
    zai: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    ollama: 'http://localhost:11434/api'
};

// Health status by provider
const providerHealth = new Map();

class LLMFallbackService {
    constructor() {
        this.healthCheckInterval = null;
        this.lastHealthCheck = null;
    }

    /**
     * Initialize provider health monitoring
     */
    startHealthMonitoring(intervalMs = 60000) {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.healthCheckInterval = setInterval(() => this.checkAllProviders(), intervalMs);
        // Initial check
        this.checkAllProviders();
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Check network connectivity for a provider
     */
    async checkProviderConnectivity(providerName) {
        const endpoint = PROVIDER_ENDPOINTS[providerName];
        if (!endpoint) return { available: false, reason: 'Unknown provider' };

        try {
            // For local providers (ollama), use different check
            if (providerName === 'ollama') {
                const response = await fetch(`${endpoint}/tags`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                return { available: response.ok, latency: null };
            }

            // For cloud providers, just check if endpoint responds
            const start = Date.now();
            const response = await fetch(endpoint, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
            }).catch(() => null);

            const latency = Date.now() - start;

            // Even 401/403 means the endpoint is reachable (just not authenticated)
            const available = response !== null;

            return { available, latency };
        } catch (error) {
            return {
                available: false,
                reason: error.message,
                error: error.name === 'TimeoutError' ? 'timeout' : 'network_error'
            };
        }
    }

    /**
     * Check all configured providers
     */
    async checkAllProviders() {
        const providers = await this.getActiveProviders();
        const results = {};

        for (const provider of providers) {
            const providerType = provider.provider;
            const status = await this.checkProviderConnectivity(providerType);

            // Update health map
            providerHealth.set(providerType, {
                ...status,
                lastCheck: Date.now(),
                provider: providerType,
                modelId: provider.model_id
            });

            results[providerType] = status;

            // Update circuit breaker state if provider is healthy
            if (status.available) {
                const breaker = CircuitBreakerService.getBreaker(`llm-${providerType}`);
                if (breaker.state === 'OPEN') {
                    // Force to HALF_OPEN for retry
                    breaker.state = 'HALF_OPEN';
                }
            }
        }

        this.lastHealthCheck = Date.now();
        return results;
    }

    /**
     * Get all active LLM providers from database
     */
    async getActiveProviders() {
        return new Promise((resolve) => {
            db.all(
                "SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY is_default DESC",
                [],
                (err, rows) => resolve(rows || [])
            );
        });
    }

    /**
     * Get provider config by model ID
     */
    async getProviderByModelId(modelId) {
        return new Promise((resolve) => {
            db.get(
                "SELECT * FROM llm_providers WHERE model_id = ? AND is_active = 1",
                [modelId],
                (err, row) => resolve(row)
            );
        });
    }

    /**
     * Get fallback chain for a given tier/capability
     */
    getFallbackChain(tier, customChain = null) {
        if (customChain && customChain.length > 0) {
            return customChain;
        }
        return FALLBACK_CHAINS[tier] || FALLBACK_CHAINS.STANDARD;
    }

    /**
     * Select next available provider from fallback chain
     * @param {string} tier - Capability tier
     * @param {string} failedModelId - Model that just failed (to skip)
     * @param {Object} options - Additional options (multiModel, maxMode)
     */
    async selectFallbackProvider(tier, failedModelId = null, options = {}) {
        const chain = this.getFallbackChain(tier);
        const failedProviders = options.failedProviders || [];

        // Add failed model to list
        if (failedModelId) {
            failedProviders.push(failedModelId);
        }

        for (const modelId of chain) {
            // Skip already failed providers
            if (failedProviders.includes(modelId)) continue;

            // Check if provider is available in our DB
            const provider = await this.getProviderByModelId(modelId);
            if (!provider) continue;

            // Check circuit breaker state
            const breakerStatus = CircuitBreakerService.getBreaker(`llm-${provider.provider}`).getStatus();
            if (breakerStatus.state === 'OPEN') {
                console.log(`[LLMFallback] Skipping ${modelId} - circuit breaker OPEN`);
                continue;
            }

            // Check provider health
            const health = providerHealth.get(provider.provider);
            if (health && !health.available) {
                console.log(`[LLMFallback] Skipping ${modelId} - health check failed`);
                continue;
            }

            console.log(`[LLMFallback] Selected fallback: ${modelId}`);
            return {
                provider,
                modelId,
                isFallback: true,
                originalTier: tier
            };
        }

        // No fallback available - return null
        console.warn(`[LLMFallback] No fallback available for tier ${tier}`);
        return null;
    }

    /**
     * Execute LLM call with automatic fallback
     * This wraps the actual LLM call and handles failures
     * @param {Function} llmCallFn - Function that makes the actual LLM call
     * @param {Object} params - Parameters including tier, userId, etc.
     */
    async executeWithFallback(llmCallFn, params = {}) {
        const { tier = 'STANDARD', maxRetries = 3, aiConfig = {} } = params;
        const failedProviders = [];
        let lastError = null;
        let attempt = 0;

        // Get initial fallback chain based on mode
        let effectiveTier = tier;
        if (aiConfig.maxMode) {
            effectiveTier = 'REASONING';
        }

        while (attempt < maxRetries) {
            attempt++;

            try {
                // Select provider (first attempt uses primary, then fallbacks)
                let providerInfo;
                if (attempt === 1 && !params.forceAutoSelect) {
                    // Use requested provider on first attempt
                    providerInfo = params.initialProvider;
                } else {
                    // Get fallback
                    providerInfo = await this.selectFallbackProvider(
                        effectiveTier,
                        null,
                        { failedProviders, multiModel: aiConfig.multiModel }
                    );
                }

                if (!providerInfo && attempt > 1) {
                    throw new Error('No available providers in fallback chain');
                }

                // Execute the LLM call
                const result = await llmCallFn(providerInfo);

                // Success - return result with metadata
                return {
                    success: true,
                    result,
                    usedFallback: attempt > 1,
                    attempts: attempt,
                    provider: providerInfo?.modelId || 'primary'
                };

            } catch (error) {
                lastError = error;

                // Determine if we should retry
                const shouldRetry = this.shouldRetryOnError(error);

                if (!shouldRetry) {
                    console.log(`[LLMFallback] Non-retryable error: ${error.message}`);
                    break;
                }

                // Track failed provider
                if (params.initialProvider?.modelId) {
                    failedProviders.push(params.initialProvider.modelId);
                }

                console.log(`[LLMFallback] Attempt ${attempt} failed, trying fallback...`, {
                    error: error.message,
                    failedProviders
                });
            }
        }

        // All attempts failed
        return {
            success: false,
            error: lastError,
            attempts: attempt,
            failedProviders,
            gracefulDegradation: this.getGracefulDegradation(lastError)
        };
    }

    /**
     * Determine if we should retry on this error
     */
    shouldRetryOnError(error) {
        const message = (error.message || '').toLowerCase();

        // Don't retry on auth/budget errors
        if (message.includes('unauthorized') || message.includes('auth')) return false;
        if (message.includes('budget') || message.includes('insufficient')) return false;
        if (message.includes('access denied')) return false;

        // Retry on network/availability errors
        if (message.includes('timeout')) return true;
        if (message.includes('rate limit') || message.includes('429')) return true;
        if (message.includes('500') || message.includes('503')) return true;
        if (message.includes('unavailable')) return true;
        if (message.includes('network')) return true;
        if (error.isCircuitOpen) return true;

        return false;
    }

    /**
     * Get graceful degradation message
     */
    getGracefulDegradation(error) {
        return {
            message: 'AI services are temporarily unavailable. Core PMO functions continue to work.',
            suggestion: 'You can continue working manually. AI features will resume automatically.',
            canRetry: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get current health status of all providers
     */
    getHealthStatus() {
        const status = {};
        providerHealth.forEach((value, key) => {
            status[key] = value;
        });
        return {
            providers: status,
            lastCheck: this.lastHealthCheck,
            circuitBreakers: CircuitBreakerService.getAllStatuses()
        };
    }

    /**
     * Get provider recommendation based on current health
     */
    async getRecommendedProvider(tier = 'STANDARD') {
        const providers = await this.getActiveProviders();
        const chain = this.getFallbackChain(tier);

        for (const modelId of chain) {
            const provider = providers.find(p => p.model_id === modelId);
            if (!provider) continue;

            const health = providerHealth.get(provider.provider);
            const breaker = CircuitBreakerService.getBreaker(`llm-${provider.provider}`).getStatus();

            if (health?.available && breaker.state !== 'OPEN') {
                return {
                    provider,
                    health,
                    circuitBreaker: breaker,
                    recommended: true
                };
            }
        }

        return null;
    }
}

// Singleton instance
const llmFallbackService = new LLMFallbackService();

export default llmFallbackService;











