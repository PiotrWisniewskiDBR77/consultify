/**
 * AI Observability Service
 * Integrates with Langfuse for tracing, metrics, and cost tracking
 * 
 * Features:
 * - Request tracing with spans
 * - Token usage and cost tracking
 * - Performance metrics
 * - Error tracking
 * - Fallback to local logging when Langfuse unavailable
 */

const { aiLogger } = require('./logger');

// Model pricing (per 1M tokens) - Updated Dec 2024
const MODEL_PRICING = {
    // OpenAI
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'o1-preview': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },

    // Anthropic
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },

    // Google
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },

    // DeepSeek
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-coder': { input: 0.14, output: 0.28 },

    // Default fallback
    'default': { input: 1.00, output: 3.00 }
};

// Langfuse client (lazy loaded)
let langfuseClient = null;
let langfuseEnabled = false;

/**
 * Initialize Langfuse client
 */
async function initLangfuse() {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (!publicKey || !secretKey) {
        aiLogger.info('Observability', 'Langfuse not configured, using local logging only');
        return false;
    }

    try {
        const { Langfuse } = require('langfuse');
        langfuseClient = new Langfuse({
            publicKey,
            secretKey,
            baseUrl,
            flushAt: 10,        // Flush after 10 events
            flushInterval: 5000 // Or every 5 seconds
        });

        langfuseEnabled = true;
        aiLogger.info('Observability', 'Langfuse initialized successfully');
        return true;
    } catch (error) {
        aiLogger.warn('Observability', 'Langfuse initialization failed', error);
        return false;
    }
}

/**
 * Calculate cost for a request based on token usage
 */
function calculateCost(modelId, usage) {
    if (!usage) return 0;

    const pricing = MODEL_PRICING[modelId] || MODEL_PRICING['default'];
    const inputTokens = usage.promptTokens || usage.prompt_tokens || 0;
    const outputTokens = usage.completionTokens || usage.completion_tokens || 0;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return {
        inputCost: Math.round(inputCost * 1_000_000) / 1_000_000, // 6 decimal places
        outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
        totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
    };
}

/**
 * Create a trace for an AI request
 */
function createTrace(params) {
    const {
        name,
        userId,
        organizationId,
        sessionId,
        metadata = {}
    } = params;

    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (langfuseEnabled && langfuseClient) {
        try {
            const trace = langfuseClient.trace({
                id: traceId,
                name,
                userId,
                sessionId: sessionId || `session_${organizationId}`,
                metadata: {
                    organizationId,
                    ...metadata
                }
            });
            return new TracingContext(traceId, trace);
        } catch (error) {
            aiLogger.warn('Observability', 'Failed to create Langfuse trace', error);
        }
    }

    // Fallback to local tracing
    return new TracingContext(traceId, null);
}

/**
 * Tracing context wrapper
 */
class TracingContext {
    constructor(traceId, langfuseTrace) {
        this.traceId = traceId;
        this.trace = langfuseTrace;
        this.spans = [];
        this.startTime = Date.now();
    }

    /**
     * Start a new span (sub-operation)
     */
    startSpan(name, metadata = {}) {
        const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const span = {
            id: spanId,
            name,
            startTime: Date.now(),
            metadata,
            langfuseSpan: null
        };

        if (this.trace) {
            try {
                span.langfuseSpan = this.trace.span({
                    name,
                    metadata
                });
            } catch (error) {
                aiLogger.debug('Observability', 'Failed to create Langfuse span', error);
            }
        }

        this.spans.push(span);
        return span;
    }

    /**
     * End a span with results
     */
    endSpan(span, result = {}) {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.result = result;

        if (span.langfuseSpan) {
            try {
                span.langfuseSpan.end({
                    output: result.output,
                    statusMessage: result.status,
                    level: result.error ? 'ERROR' : 'DEFAULT'
                });
            } catch (error) {
                aiLogger.debug('Observability', 'Failed to end Langfuse span', error);
            }
        }

        return span;
    }

    /**
     * Record LLM generation
     */
    recordGeneration(params) {
        const {
            name,
            model,
            prompt,
            completion,
            usage,
            metadata = {}
        } = params;

        const costInfo = calculateCost(model, usage);

        if (this.trace) {
            try {
                this.trace.generation({
                    name: name || 'llm-call',
                    model,
                    input: prompt,
                    output: completion,
                    usage: {
                        promptTokens: costInfo.inputTokens,
                        completionTokens: costInfo.outputTokens,
                        totalTokens: costInfo.totalTokens
                    },
                    metadata: {
                        ...metadata,
                        cost: costInfo.totalCost
                    }
                });
            } catch (error) {
                aiLogger.debug('Observability', 'Failed to record Langfuse generation', error);
            }
        }

        // Always log locally
        aiLogger.info('Observability', 'Generation recorded', {
            traceId: this.traceId,
            model,
            tokens: costInfo.totalTokens,
            cost: costInfo.totalCost
        });

        // Persist to DB for Analytics
        try {
            const { llmConfigService } = require('./llmConfigService');
            llmConfigService.logEvent({
                traceId: this.traceId,
                provider: this.getProviderFromModel(model),
                model,
                status: 'success',
                latencyMs: metadata.latency || (Date.now() - this.startTime),
                tokensIn: costInfo.inputTokens,
                tokensOut: costInfo.outputTokens,
                cost: costInfo.totalCost,
                errorMessage: null
            });
        } catch (e) {
            aiLogger.warn('Observability', 'Failed to persist analytics log', e);
        }

        return costInfo;
    }

    getProviderFromModel(model) {
        if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai';
        if (model.includes('claude')) return 'anthropic';
        if (model.includes('gemini')) return 'google';
        if (model.includes('deepseek')) return 'deepseek';
        if (model.includes('llama')) return 'ollama';
        return 'unknown';
    }

    /**
     * Record an error
     */
    recordError(error, metadata = {}) {
        if (this.trace) {
            try {
                this.trace.event({
                    name: 'error',
                    level: 'ERROR',
                    statusMessage: error.message,
                    metadata: {
                        stack: error.stack,
                        code: error.code,
                        ...metadata
                    }
                });
            } catch (e) {
                aiLogger.debug('Observability', 'Failed to record error in Langfuse', e);
            }
        }

        aiLogger.error('Observability', 'Error recorded', {
            traceId: this.traceId,
            error: error.message,
            ...metadata
        });

        // Persist Error to DB
        try {
            const { llmConfigService } = require('./llmConfigService');
            llmConfigService.logEvent({
                traceId: this.traceId,
                provider: 'unknown', // Can't easily determine provider on generic error unless metadata has it
                model: metadata.model || 'unknown',
                status: 'error',
                latencyMs: Date.now() - this.startTime,
                tokensIn: 0,
                tokensOut: 0,
                cost: 0,
                errorMessage: error.message
            });
        } catch (e) {
            aiLogger.warn('Observability', 'Failed to persist error log', e);
        }
    }

    /**
     * Complete the trace
     */
    complete(result = {}) {
        const duration = Date.now() - this.startTime;

        if (this.trace) {
            try {
                this.trace.update({
                    output: result.output,
                    statusMessage: result.status || 'completed',
                    metadata: {
                        duration,
                        ...result.metadata
                    }
                });
            } catch (error) {
                aiLogger.debug('Observability', 'Failed to complete Langfuse trace', error);
            }
        }

        aiLogger.info('Observability', 'Trace completed', {
            traceId: this.traceId,
            duration,
            status: result.status
        });

        return {
            traceId: this.traceId,
            duration,
            spans: this.spans.length
        };
    }
}

/**
 * Flush pending events (call on shutdown)
 */
async function flush() {
    if (langfuseClient) {
        try {
            await langfuseClient.flushAsync();
            aiLogger.info('Observability', 'Flushed Langfuse events');
        } catch (error) {
            aiLogger.warn('Observability', 'Failed to flush Langfuse', error);
        }
    }
}

/**
 * Shutdown observability service
 */
async function shutdown() {
    await flush();
    if (langfuseClient) {
        await langfuseClient.shutdownAsync();
        langfuseClient = null;
        langfuseEnabled = false;
    }
}

/**
 * Get observability status
 */
function getStatus() {
    return {
        langfuseEnabled,
        langfuseConfigured: !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY),
        pricingModels: Object.keys(MODEL_PRICING).length
    };
}

export default {
    initLangfuse,
    createTrace,
    calculateCost,
    flush,
    shutdown,
    getStatus,
    TracingContext,
    MODEL_PRICING
};









