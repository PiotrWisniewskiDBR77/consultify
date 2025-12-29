// server/services/ai/aiPipeline.js
const { AIGateway } = require('./aiGateway');
const { ContextBuilder } = require('./aiContext');
const { PromptAssembler } = require('./promptAssembler');
const { ModelRouter } = require('./modelRouter');
const { LLMService } = require('./llmService');
const { quotaService } = require('./quotaService');
const { memoryManager } = require('./memoryManager');
const { aiLogger } = require('./logger');
const { createTrace, calculateCost } = require('./observability');
const metrics = require('./metrics');
const crypto = require('crypto');
const db = require('../../database');

// Enterprise AI Services Integration
const { qualityChecker } = require('./qualityChecker');
const { enterpriseSecurity } = require('./enterpriseSecurity');
const { performanceOptimizer } = require('./performanceOptimizer');
const { learningSystem } = require('./learningSystem');

class AIPipeline {
    constructor() {
        this.gateway = new AIGateway();
        this.contextBuilder = new ContextBuilder();
        this.promptAssembler = new PromptAssembler();
        this.modelRouter = new ModelRouter();
        this.llmService = new LLMService();
    }

    async process(request) {
        const startTime = Date.now();
        let modelConfig = null;
        let error = null;
        let cacheHit = false;
        let costInfo = null;
        let qualityResult = null;

        // Create observability trace
        const trace = createTrace({
            name: `ai-${request.capability || 'chat'}`,
            userId: request.userId,
            organizationId: request.organizationId,
            metadata: {
                capability: request.capability,
                hasScreenContext: !!request.screenContext
            }
        });

        try {
            aiLogger.pipeline('Starting process', { capability: request.capability, traceId: trace.traceId });

            // 0. Enterprise Security - Rate Limit Check
            const rateLimitCheck = await enterpriseSecurity.checkRateLimit(
                request.organizationId,
                request.capability || 'all'
            );
            if (!rateLimitCheck.allowed) {
                aiLogger.warn('Pipeline', `Rate limit exceeded: ${rateLimitCheck.limitType}`);
                throw new Error(`Rate limit exceeded. Reset at: ${rateLimitCheck.resetAt?.toISOString()}`);
            }

            // 1. Gateway Security Check (includes PII scrubbing)
            const gatewaySpan = trace.startSpan('gateway');
            await this.gateway.process(request);
            trace.endSpan(gatewaySpan, { status: 'passed' });

            // 2. Quota Check (3-level: User → Project → Organization)
            const quotaCheck = await quotaService.checkQuota(
                request.userId,
                request.organizationId,
                request.projectId
            );
            if (!quotaCheck.allowed) {
                aiLogger.warn('Pipeline', `Quota exceeded: ${quotaCheck.reason}`);
                throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
            }

            // 3. Cache Check - Return immediately if cached
            const { cacheService } = require('./cacheService');
            const cacheQuery = request.prompt || request.messages?.[request.messages.length - 1]?.content;
            const cacheContext = {
                organizationId: request.organizationId,
                projectId: request.projectId,
                capability: request.capability
            };

            if (!request.stream && cacheQuery) {
                const cached = await cacheService.get(cacheQuery, cacheContext);
                if (cached) {
                    cacheHit = true;
                    const cacheLatency = Date.now() - startTime;
                    aiLogger.cache('get', true);
                    
                    // Record cache hit metrics
                    metrics.recordRequest({
                        capability: request.capability,
                        model: cached.metadata?.model || 'cached',
                        success: true,
                        durationSeconds: cacheLatency / 1000,
                        cached: true
                    });
                    
                    trace.complete({ status: 'cache_hit' });
                    
                    return {
                        ...cached,
                        metadata: {
                            model: cached.metadata?.model || 'cached',
                            latency: cacheLatency,
                            cached: true
                        }
                    };
                }
                aiLogger.cache('get', false);
            }

            // 4. RAG Query - Fetch relevant knowledge chunks
            let knowledgeContext = null;
            if (cacheQuery) {
                try {
                    const RagService = require('../ragService');
                    const ragResults = await RagService.searchRelevantChunks(cacheQuery, {
                        limit: 5,
                        organizationId: request.organizationId,
                        minSimilarity: 0.7 // Quality guard: only high-relevance chunks
                    });

                    if (ragResults && ragResults.length > 0) {
                        knowledgeContext = ragResults
                            .map((r, i) => `[Source ${i + 1}: ${r.source}] (Relevance: ${Math.round(r.similarity * 100)}%)\n${r.content}`)
                            .join('\n\n---\n\n');
                        aiLogger.rag('Found relevant chunks', { count: ragResults.length });
                    }
                } catch (ragError) {
                    aiLogger.error('Pipeline', 'RAG query failed', ragError);
                }
            }

            // 4.5 Memory System - Retrieve from 5-layer memory
            let memoryContext = null;
            try {
                const memorySpan = trace.startSpan('memory_retrieval');
                const memoryResult = await memoryManager.retrieve({
                    userId: request.userId,
                    organizationId: request.organizationId,
                    projectId: request.projectId,
                    queryText: cacheQuery,
                    layers: ['session', 'project', 'organization', 'knowledge'],
                    maxTokens: 2000,
                    includeExternal: request.includeWebResearch
                });

                if (memoryResult.chunks && memoryResult.chunks.length > 0) {
                    memoryContext = memoryManager.serializeForPrompt(memoryResult);
                    aiLogger.debug('Pipeline', `Memory retrieved: ${memoryResult.chunks.length} chunks, ${memoryResult.totalTokens} tokens`);
                }
                trace.endSpan(memorySpan, { 
                    chunkCount: memoryResult.chunks?.length || 0,
                    sources: memoryResult.sources 
                });
            } catch (memoryError) {
                aiLogger.warn('Pipeline', `Memory retrieval failed: ${memoryError.message}`);
            }

            // 5. Build Context
            const context = await this.contextBuilder.build({
                userId: request.userId,
                organizationId: request.organizationId,
                projectId: request.projectId,
                screenContext: request.screenContext,
                capability: request.capability,
                knowledgeContext, // Pass RAG results to context
                memoryContext // Pass 5-layer memory context
            });

            // 6. Assemble Prompt (includes visual context + knowledge + memory injection)
            const { systemPrompt, messages } = await this.promptAssembler.build({
                request,
                context,
                knowledgeContext, // Pass to assembler for injection
                memoryContext // Pass memory context for enhanced responses
            });

            // 6. Route Model (with org overrides)
            modelConfig = await this.modelRouter.select({
                capability: request.capability,
                organizationId: request.organizationId,
                options: request.options
            });

            // 7. Call LLM Service (with fallback support)
            // Note: Tools temporarily disabled for streaming due to OpenAI Responses API schema issue
            // TODO: Fix tool schema compatibility with OpenAI /v1/responses endpoint
            const enableTools = !request.stream && (request.enableTools || request.capability === 'chat');
            const tools = enableTools ? this.getAvailableTools() : undefined;

            aiLogger.info('Pipeline', 'Calling LLM Service', { model: modelConfig.id, toolsEnabled: !!tools, streaming: !!request.stream });

            // 7. Execute LLM with automatic multi-provider fallback
            let response;
            let usedFallback = false;
            let attempts = 1;

            const llmParams = {
                type: request.type || 'chat',
                systemPrompt,
                messages,
                schema: request.schema,
                stream: request.stream,
                tools,
                context: {
                    userId: request.userId,
                    organizationId: request.organizationId,
                    projectId: request.projectId
                }
            };

            try {
                // Use executeWithFallback for automatic provider switching
                const result = await this.executeWithFallback(llmParams, modelConfig, 3);
                response = result.response;
                modelConfig = result.modelConfig; // Update to actual model used
                attempts = result.attempts;
                usedFallback = attempts > 1;

                if (usedFallback) {
                    aiLogger.info('Pipeline', `Request succeeded with fallback after ${attempts} attempts`, {
                        finalModel: modelConfig.id
                    });
                }
            } catch (llmError) {
                // Log all failed providers
                aiLogger.error('Pipeline', `All providers failed after fallback attempts: ${llmError.message}`);
                throw llmError;
            }

            const latency = Date.now() - startTime;

            // 7.5. Quality Check - Validate AI response before returning
            const qualitySpan = trace.startSpan('quality_check');
            try {
                qualityResult = await qualityChecker.check(response, {
                    query: request.prompt || messages?.[messages.length - 1]?.content,
                    capability: request.capability
                }, { 
                    strictMode: request.strictQuality,
                    capability: request.capability 
                });

                if (!qualityResult.passed && qualityResult.overallScore < 0.5) {
                    aiLogger.warn('Pipeline', `Quality check failed: score=${qualityResult.overallScore}`, {
                        warnings: qualityResult.warnings
                    });
                    // For very low quality, we could retry with different model
                    // For now, we flag it in metadata
                }
                trace.endSpan(qualitySpan, { 
                    score: qualityResult.overallScore, 
                    passed: qualityResult.passed 
                });
            } catch (qualityError) {
                aiLogger.warn('Pipeline', `Quality check error: ${qualityError.message}`);
                trace.endSpan(qualitySpan, { error: qualityError.message });
            }

            // 8. Calculate cost and record generation
            costInfo = calculateCost(modelConfig.id, response.usage);
            trace.recordGeneration({
                name: request.capability || 'chat',
                model: modelConfig.id,
                prompt: request.prompt || messages?.[messages.length - 1]?.content,
                completion: response.content,
                usage: response.usage,
                metadata: { cached: false, qualityScore: qualityResult?.overallScore }
            });

            // 9. Save to Cache (non-streaming only)
            if (!request.stream && cacheQuery && response.content) {
                await cacheService.set(cacheQuery, cacheContext, response);
                aiLogger.cache('set', true);
            }

            // 10. Consume tokens from quota
            const tokenCount = costInfo.totalTokens || 1000;
            await quotaService.consumeTokens(
                request.userId,
                request.organizationId,
                request.projectId,
                tokenCount
            );

            // 11. Audit Logging (with cost) - Legacy internal logging
            await this.logAudit({
                userId: request.userId,
                organizationId: request.organizationId,
                capability: request.capability,
                model: modelConfig?.id,
                latency,
                hasScreenContext: !!request.screenContext,
                screenContextHash: request.screenContext
                    ? this.hashContext(request.screenContext)
                    : null,
                success: true,
                tokensUsed: tokenCount,
                costUsd: costInfo.totalCost
            });

            // 11.5 Enterprise Security - Comprehensive Audit Log
            enterpriseSecurity.logAudit({
                userId: request.userId,
                organizationId: request.organizationId,
                action: 'ai_request',
                resourceType: request.capability,
                requestSummary: (request.prompt || cacheQuery)?.substring(0, 200),
                responseSummary: response.content?.substring(0, 200),
                modelUsed: modelConfig?.id,
                tokensUsed: tokenCount,
                costUsd: costInfo.totalCost,
                ipAddress: request.ipAddress,
                userAgent: request.userAgent
            });

            // 11.6 Performance Optimizer - Record metrics
            performanceOptimizer.recordMetrics(trace.traceId, {
                responseTime: latency,
                tokensUsed: tokenCount,
                cached: cacheHit,
                error: false
            });

            // 11.7 Learning System - Record interaction for pattern learning
            learningSystem.recordInteraction({
                userId: request.userId,
                organizationId: request.organizationId,
                requestType: request.capability,
                prompt: (request.prompt || cacheQuery)?.substring(0, 500),
                response: response.content?.substring(0, 1000),
                metadata: {
                    qualityScore: qualityResult?.overallScore,
                    model: modelConfig?.id,
                    latency,
                    cached: cacheHit
                }
            }).catch(err => {
                aiLogger.warn('Pipeline', `Learning system record failed: ${err.message}`);
            });

            // Record metrics
            metrics.recordRequest({
                capability: request.capability,
                model: modelConfig.id,
                success: true,
                durationSeconds: latency / 1000,
                tokens: tokenCount,
                costUsd: costInfo.totalCost,
                cached: false
            });

            // Complete trace
            trace.complete({ status: 'success', output: response.content?.substring?.(0, 100) });

            // 12. Record to Memory if significant (async, non-blocking)
            this._recordToMemoryAsync({
                userId: request.userId,
                organizationId: request.organizationId,
                projectId: request.projectId,
                capability: request.capability,
                query: cacheQuery,
                response: response.content,
                tokenCount
            });

            aiLogger.pipeline('Process complete', { 
                latency, 
                tokensUsed: tokenCount, 
                costUsd: costInfo.totalCost,
                qualityScore: qualityResult?.overallScore,
                traceId: trace.traceId 
            });

            return {
                ...response,
                metadata: {
                    model: modelConfig.id,
                    latency,
                    cost: costInfo.totalCost,
                    traceId: trace.traceId,
                    quality: qualityResult ? {
                        score: qualityResult.overallScore,
                        passed: qualityResult.passed,
                        warnings: qualityResult.warnings
                    } : null
                }
            };

        } catch (err) {
            error = err;
            const errorLatency = Date.now() - startTime;

            // Record error in trace
            trace.recordError(err, { capability: request.capability, model: modelConfig?.id });
            trace.complete({ status: 'error' });

            // Record error metrics
            metrics.recordRequest({
                capability: request.capability,
                model: modelConfig?.id || 'unknown',
                success: false,
                durationSeconds: errorLatency / 1000,
                cached: false
            });

            // Performance Optimizer - Record error metrics
            performanceOptimizer.recordMetrics(trace.traceId, {
                responseTime: errorLatency,
                tokensUsed: 0,
                cached: false,
                error: true
            });

            // Enterprise Security - Log error in audit
            enterpriseSecurity.logAudit({
                userId: request.userId,
                organizationId: request.organizationId,
                action: 'ai_request_error',
                resourceType: request.capability,
                requestSummary: request.prompt?.substring(0, 200),
                responseSummary: `Error: ${err.message}`,
                modelUsed: modelConfig?.id,
                tokensUsed: 0,
                costUsd: 0,
                ipAddress: request.ipAddress,
                userAgent: request.userAgent
            });

            // Log error in internal audit
            await this.logAudit({
                userId: request.userId,
                organizationId: request.organizationId,
                capability: request.capability,
                model: modelConfig?.id,
                latency: errorLatency,
                success: false,
                error: err.message
            });

            aiLogger.error('Pipeline', 'Process failed', { error: err.message, traceId: trace.traceId });
            throw err;
        }
    }

    /**
     * Determine fallback model for a given model ID using fallback chain
     * @param {string} modelId - Current model that failed
     * @param {Array} excludeModels - Models already tried (to skip)
     * @param {string} tier - Model tier for selecting appropriate chain
     */
    getFallbackModel(modelId, excludeModels = [], tier = 'STANDARD') {
        const { TIER_FALLBACK_CHAINS } = require('./modelRouter');
        const chain = TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS['STANDARD'];
        
        // Add current model to exclude list
        const excluded = new Set([...excludeModels, modelId]);
        
        // Find next available model in chain
        for (const fallbackModel of chain) {
            if (!excluded.has(fallbackModel)) {
                return fallbackModel;
            }
        }
        
        // Ultimate fallback
        return 'gpt-4o-mini';
    }

    /**
     * Execute LLM call with automatic multi-provider fallback
     * @param {Object} params - LLM call parameters
     * @param {Object} modelConfig - Initial model configuration
     * @param {number} maxRetries - Maximum retry attempts
     */
    async executeWithFallback(params, modelConfig, maxRetries = 3) {
        const excludeModels = [];
        let currentConfig = modelConfig;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                aiLogger.info('Pipeline', `LLM attempt ${attempt}/${maxRetries}`, { model: currentConfig.id });
                
                const response = await this.llmService.call({
                    ...params,
                    modelConfig: currentConfig
                });
                
                return { response, modelConfig: currentConfig, attempts: attempt };
            } catch (error) {
                lastError = error;
                excludeModels.push(currentConfig.id);
                
                aiLogger.warn('Pipeline', `Attempt ${attempt} failed: ${error.message}`, { 
                    model: currentConfig.id,
                    excludeModels 
                });
                
                // Don't retry on auth/budget errors
                if (this.isNonRetryableError(error)) {
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    // Get next fallback
                    const fallbackModelId = this.getFallbackModel(
                        currentConfig.id, 
                        excludeModels, 
                        currentConfig.tier
                    );
                    
                    if (fallbackModelId && !excludeModels.includes(fallbackModelId)) {
                        currentConfig = await this.modelRouter.getProviderConfig(
                            fallbackModelId, 
                            currentConfig.tier
                        );
                        aiLogger.info('Pipeline', `Switching to fallback: ${fallbackModelId}`);
                    } else {
                        throw lastError; // No more fallbacks
                    }
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Check if error should not trigger retry
     */
    isNonRetryableError(error) {
        const message = (error.message || '').toLowerCase();
        if (message.includes('unauthorized') || message.includes('auth')) return true;
        if (message.includes('budget') || message.includes('insufficient')) return true;
        if (message.includes('access denied')) return true;
        if (message.includes('quota')) return true;
        return false;
    }

    /**
     * Create a hash of the screen context for audit purposes
     * (Don't store full context to avoid data retention issues)
     */
    hashContext(context) {
        const str = JSON.stringify(context);
        return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
    }

    /**
     * Log AI request to audit table (with cost tracking)
     */
    async logAudit(data) {
        if (!db || !db.run) return;

        const sql = `
            INSERT INTO ai_audit_logs (
                timestamp, user_id, organization_id, capability, 
                model, latency_ms, has_screen_context, screen_context_hash,
                success, error_message, tokens_used, cost_usd
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            await new Promise((resolve, reject) => {
                db.run(sql, [
                    new Date().toISOString(),
                    data.userId,
                    data.organizationId,
                    data.capability,
                    data.model,
                    data.latency,
                    data.hasScreenContext ? 1 : 0,
                    data.screenContextHash,
                    data.success ? 1 : 0,
                    data.error || null,
                    data.tokensUsed || 0,
                    data.costUsd || 0
                ], function (err) {
                    if (err) {
                        // Don't fail the request if audit logging fails
                        console.warn('[AIPipeline] Audit log failed:', err.message);
                        resolve();
                    } else {
                        resolve();
                    }
                });
            });
        } catch (e) {
            console.warn('[AIPipeline] Audit log exception:', e.message);
        }
    }

    /**
     * Get available tools for the pipeline
     */
    getAvailableTools() {
        try {
            const { mcpServer } = require('./mcpServer');
            require('./tools'); // Ensure registered
            return mcpServer.getToolDefinitions();
        } catch (e) {
            console.warn('[AIPipeline] Failed to load tools:', e.message);
            return [];
        }
    }

    /**
     * Record interaction to memory asynchronously (non-blocking)
     * @private
     */
    _recordToMemoryAsync(data) {
        // Don't await - let this run in background
        setImmediate(async () => {
            try {
                const { userId, organizationId, projectId, capability, query, response, tokenCount } = data;

                // Calculate significance based on various factors
                const significance = this._calculateSignificance({
                    capability,
                    tokenCount,
                    responseLength: response?.length || 0
                });

                // Record to session memory (always)
                await memoryManager.sessionStore.addMessage(userId, {
                    role: 'user',
                    content: query?.substring(0, 1000) || '',
                    timestamp: new Date().toISOString()
                });

                await memoryManager.sessionStore.addMessage(userId, {
                    role: 'assistant',
                    content: response?.substring(0, 2000) || '',
                    timestamp: new Date().toISOString()
                });

                // For significant interactions with project context, record to project memory
                if (significance >= 0.6 && projectId) {
                    await memoryManager.recordIfSignificant({
                        userId,
                        organizationId,
                        projectId,
                        type: capability,
                        content: {
                            query: query?.substring(0, 500),
                            summary: response?.substring(0, 1000),
                            capability,
                            timestamp: new Date().toISOString()
                        },
                        significance
                    });
                }
            } catch (error) {
                aiLogger.warn('Pipeline', `Memory recording failed: ${error.message}`);
            }
        });
    }

    /**
     * Calculate significance score for memory recording
     * @private
     */
    _calculateSignificance(data) {
        const { capability, tokenCount, responseLength } = data;

        let score = 0.3; // Base significance

        // High-value capabilities get higher significance
        const highValueCapabilities = ['initiative', 'report', 'recommendation', 'decision', 'analysis'];
        if (highValueCapabilities.includes(capability)) {
            score += 0.3;
        }

        // Longer responses are often more significant
        if (responseLength > 2000) score += 0.2;
        else if (responseLength > 1000) score += 0.1;

        // Higher token usage indicates complex interaction
        if (tokenCount > 3000) score += 0.2;
        else if (tokenCount > 1500) score += 0.1;

        return Math.min(score, 1.0);
    }
}

module.exports = { AIPipeline };
