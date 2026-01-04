import BaseService from '../BaseService.js';
import { AIGateway } from './aiGateway.js';
import { enhancedContextBuilder } from './enhancedContextBuilder.js';
import { PromptAssembler, FALLBACK_ROLES } from './promptAssembler.js';
import { ModelRouter } from './modelRouter.js';
import { LLMService } from './llmService.js';
import { quotaService } from './quotaService.js';
import { memoryManager } from './memoryManager.js';
import { aiLogger } from './logger.js';
import { createTrace, calculateCost } from './observability.js';
import metrics from './metrics.js';
import crypto from 'crypto';
import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();

// Enterprise AI Services Integration
import { qualityChecker } from './qualityChecker.js';
import { enterpriseSecurity } from './enterpriseSecurity.js';
import { performanceOptimizer } from './performanceOptimizer.js';
import { learningSystem } from './learningSystem.js';

// AI Settings Integration
import AISettingsService from '../aiSettingsService.js';
import AIProactivityEngine from '../aiProactivityEngine.js';

// ============================================================================
// CAPABILITY REGISTRY
// ============================================================================
// Maps legacy aiService.js methods to unified pipeline capabilities.
// Each capability defines: systemPrompt role, max tokens, output format, etc.
// ============================================================================

const CAPABILITY_REGISTRY = {
    // === DIAGNOSIS CAPABILITIES ===
    'diagnose': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Analyze maturity for a specific axis',
        outputFormat: 'json'
    },
    'deepDiagnose': {
        role: 'ANALYST',
        maxTokens: 4000,
        description: 'Deep chain-of-thought diagnosis with multiple reasoning steps',
        outputFormat: 'json'
    },

    // === GENERATION CAPABILITIES ===
    'generateList': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Generate a list of items based on context',
        outputFormat: 'json'
    },
    'generateTable': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Generate a structured table',
        outputFormat: 'json'
    },
    'generateInitiatives': {
        role: 'CONSULTANT',
        maxTokens: 4000,
        description: 'Generate transformation initiatives from diagnosis',
        outputFormat: 'json'
    },
    'generateObservations': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Generate strategic observations from data',
        outputFormat: 'json'
    },
    'generateFirstValuePlan': {
        role: 'STRATEGIST',
        maxTokens: 3000,
        description: 'Generate first value delivery plan',
        outputFormat: 'json'
    },

    // === TASK CAPABILITIES ===
    'suggestTasks': {
        role: 'IMPLEMENTER',
        maxTokens: 2000,
        description: 'Suggest implementation tasks for an initiative',
        outputFormat: 'json'
    },
    'generateTaskInsight': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Generate insights for a specific task',
        outputFormat: 'json'
    },
    'generateExecutionStrategy': {
        role: 'IMPLEMENTER',
        maxTokens: 2500,
        description: 'Generate execution strategy for initiative',
        outputFormat: 'json'
    },

    // === INITIATIVE CAPABILITIES ===
    'validateInitiative': {
        role: 'GATEKEEPER',
        maxTokens: 1500,
        description: 'Validate initiative quality and completeness',
        outputFormat: 'json'
    },
    'enrichInitiative': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Enrich initiative with market context',
        outputFormat: 'json'
    },
    'generateInsights': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Generate strategic insights for initiative',
        outputFormat: 'json'
    },
    'generateStrategicFit': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Analyze strategic fit of initiative',
        outputFormat: 'json'
    },

    // === ROADMAP CAPABILITIES ===
    'buildRoadmap': {
        role: 'STRATEGIST',
        maxTokens: 3000,
        description: 'Build transformation roadmap from initiatives',
        outputFormat: 'json'
    },
    'validateRoadmap': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Validate roadmap structure and dependencies',
        outputFormat: 'text'
    },
    'explainRoadmap': {
        role: 'STRATEGIST',
        maxTokens: 2000,
        description: 'Explain roadmap for board presentation',
        outputFormat: 'text'
    },
    'optimizeRoadmap': {
        role: 'STRATEGIST',
        maxTokens: 2000,
        description: 'Optimize roadmap based on strategy',
        outputFormat: 'text'
    },
    'reviewQuarter': {
        role: 'IMPLEMENTER',
        maxTokens: 1500,
        description: 'Review quarterly progress and roadblocks',
        outputFormat: 'text'
    },
    'suggestPlacement': {
        role: 'STRATEGIST',
        maxTokens: 1000,
        description: 'Suggest optimal placement for initiative',
        outputFormat: 'text'
    },
    'generateRoadmapSummary': {
        role: 'STRATEGIST',
        maxTokens: 2000,
        description: 'Generate executive summary of roadmap',
        outputFormat: 'json'
    },
    'generatePlacementReason': {
        role: 'STRATEGIST',
        maxTokens: 1000,
        description: 'Explain why initiative is placed in a quarter',
        outputFormat: 'json'
    },
    'rebalanceRoadmap': {
        role: 'STRATEGIST',
        maxTokens: 2500,
        description: 'Rebalance roadmap for optimal resource allocation',
        outputFormat: 'json'
    },
    'generateWorkloadAnalysis': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Analyze quarterly workload distribution',
        outputFormat: 'json'
    },

    // === ECONOMICS CAPABILITIES ===
    'simulateEconomics': {
        role: 'FINANCE',
        maxTokens: 2500,
        description: 'Simulate economic impact of initiatives',
        outputFormat: 'json'
    },

    // === CHAT CAPABILITIES ===
    'chat': {
        role: 'CONSULTANT',
        maxTokens: 2000,
        description: 'General chat with AI consultant',
        outputFormat: 'text',
        supportsStreaming: true
    },
    'chat_simple': {
        role: 'PARTNER',
        maxTokens: 1500,
        description: 'Simple conversational chat',
        outputFormat: 'text',
        supportsStreaming: true
    },

    // === REPORT CAPABILITIES ===
    'generateReportSectionContent': {
        role: 'STRATEGIST',
        maxTokens: 3000,
        description: 'Generate content for report section',
        outputFormat: 'json'
    },
    'parseReportEditIntent': {
        role: 'ANALYST',
        maxTokens: 1000,
        description: 'Parse user intent for report editing',
        outputFormat: 'json'
    },
    'buildReportAIContext': {
        role: 'ANALYST',
        maxTokens: 2000,
        description: 'Build AI context for report generation',
        outputFormat: 'json'
    },

    // === CHAIN OF THOUGHT ===
    'runChainOfThought': {
        role: 'ANALYST',
        maxTokens: 4000,
        description: 'Run multi-step chain of thought reasoning',
        outputFormat: 'json'
    },

    // === KNOWLEDGE CAPABILITIES ===
    'extractInsights': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Extract insights from text',
        outputFormat: 'json'
    },
    'verifyWithWeb': {
        role: 'ANALYST',
        maxTokens: 1500,
        description: 'Verify information with web research',
        outputFormat: 'text'
    },

    // === STRATEGIC CAPABILITIES ===
    'getStrategicIdeas': {
        role: 'STRATEGIST',
        maxTokens: 2000,
        description: 'Get strategic ideas for transformation',
        outputFormat: 'json'
    },

    // === CHARTER GENERATION ===
    'generateStructuredContent': {
        role: 'CONSULTANT',
        maxTokens: 2500,
        description: 'Generate structured content for initiative charters',
        outputFormat: 'json'
    },

    // === QUEUE CAPABILITIES ===
    'queueTask': {
        role: 'IMPLEMENTER',
        maxTokens: 1000,
        description: 'Queue async AI task',
        outputFormat: 'json',
        async: true
    }
};

/**
 * Get capability configuration
 * @param {string} capability - Capability name
 * @returns {Object} Capability configuration
 */
function getCapabilityConfig(capability) {
    return CAPABILITY_REGISTRY[capability] || {
        role: 'CONSULTANT',
        maxTokens: 2000,
        description: 'Default capability',
        outputFormat: 'text'
    };
}

class AIPipeline extends BaseService {
    constructor(dependencies = {}) {
        super();
        this.gateway = new AIGateway();
        this.contextBuilder = enhancedContextBuilder;
        this.promptAssembler = new PromptAssembler();
        this.modelRouter = new ModelRouter();

        const {
            llmService,
            memoryManager: injectedMemoryManager,
            quotaService: injectedQuotaService,
            enterpriseSecurity: injectedSecurity,
            qualityChecker: injectedQualityChecker,
            performanceOptimizer: injectedOptimizer,
            learningSystem: injectedLearningSystem,
            cacheService: injectedCacheService
        } = dependencies;

        this.llmService = llmService || new LLMService();
        this.memoryManager = injectedMemoryManager || memoryManager;
        this.quotaService = injectedQuotaService || quotaService;
        this.enterpriseSecurity = injectedSecurity || enterpriseSecurity;
        this.qualityChecker = injectedQualityChecker || qualityChecker;
        this.performanceOptimizer = injectedOptimizer || performanceOptimizer;
        this.learningSystem = injectedLearningSystem || learningSystem;
        this.cacheService = injectedCacheService || null; // Will be loaded lazily if needed

        // Initialize other services
        this.ragService = null;
        this.settingsService = null;
    }

    async initDeps() {
        if (!this.cacheService) {
            const { cacheService } = await import('./cacheService.js');
            this.cacheService = cacheService;
        }
        if (!this.ragService) {
            const { default: ragService } = await import('../ragService.js');
            this.ragService = ragService;
        }
        if (!this.settingsService) {
            const { default: aiSettingsService } = await import('../aiSettingsService.js');
            this.settingsService = aiSettingsService;
        }
        if (!this.mcpServer) {
            const { mcpServer } = await import('./mcpServer.js');
            this.mcpServer = mcpServer;
            await import('./tools/index.js'); // Ensure tools are registered
        }
    }

    // =========================================================================
    // RESILIENT WRAPPERS - Fail-open pattern for external service calls
    // =========================================================================

    /**
     * Safe wrapper for rate limit check - fails open (allows) on error
     */
    async safeCheckRateLimit(organizationId, capability) {
        try {
            const result = await this.enterpriseSecurity.checkRateLimit(organizationId, capability);
            return result;
        } catch (error) {
            aiLogger.error('Pipeline', `Rate limit check failed, allowing request: ${error.message}`);
            return { allowed: true, remaining: Infinity, bypassed: true, error: error.message };
        }
    }

    /**
     * Safe wrapper for quota check - fails open (allows) on error
     */
    async safeCheckQuota(userId, organizationId, projectId) {
        try {
            const result = await this.quotaService.checkQuota(userId, organizationId, projectId);
            return result;
        } catch (error) {
            aiLogger.error('Pipeline', `Quota check failed, allowing request: ${error.message}`);
            return { allowed: true, reason: null, bypassed: true, error: error.message };
        }
    }

    /**
     * Safe wrapper for quality check - fails open (passes) on error
     */
    async safeQualityCheck(response, context, options) {
        try {
            const result = await this.qualityChecker.check(response, context, options);
            return result;
        } catch (error) {
            aiLogger.warn('Pipeline', `Quality check failed, skipping: ${error.message}`);
            return { passed: true, overallScore: 0.5, skipped: true, warnings: [], error: error.message };
        }
    }

    /**
     * Safe wrapper for gateway processing - continues on non-critical errors
     */
    async safeGatewayProcess(request) {
        try {
            await this.gateway.process(request);
            return { success: true };
        } catch (error) {
            aiLogger.warn('Pipeline', `Gateway process warning: ${error.message}`);
            // Only fail for critical security errors
            if (error.message?.includes('blocked') || error.message?.includes('injection')) {
                throw error; // Re-throw security-critical errors
            }
            return { success: true, warning: error.message };
        }
    }

    /**
     * Safe wrapper for audit logging - non-blocking
     */
    safeLogAudit(auditData) {
        // Don't await - fire and forget
        try {
            const promise = this.enterpriseSecurity.logAudit(auditData);
            if (promise && typeof promise.catch === 'function') {
                promise.catch(err => {
                    aiLogger.warn('Pipeline', `Audit log failed (non-blocking): ${err.message}`);
                });
            }
        } catch (err) {
            aiLogger.warn('Pipeline', `Audit log sync error (non-blocking): ${err.message}`);
        }
    }

    /**
     * Safe wrapper for learning system - non-blocking
     * @deprecated Use safeRecordLearningEnhanced instead
     */
    safeRecordLearning(data) {
        try {
            const promise = this.learningSystem.recordInteraction(data);
            if (promise && typeof promise.catch === 'function') {
                promise.catch(err => {
                    aiLogger.warn('Pipeline', `Learning record failed (non-blocking): ${err.message}`);
                });
            }
        } catch (err) {
            aiLogger.warn('Pipeline', `Learning record sync error (non-blocking): ${err.message}`);
        }
    }

    /**
     * Enhanced learning system wrapper with quality-based auto-feedback
     * Records interaction with quality scores for pattern extraction
     */
    safeRecordLearningEnhanced(data) {
        try {
            const promise = this.learningSystem.recordWithAutoFeedback(data);
            if (promise && typeof promise.catch === 'function') {
                promise.catch(err => {
                    aiLogger.warn('Pipeline', `Enhanced learning record failed (non-blocking): ${err.message}`);
                });
            }
        } catch (err) {
            aiLogger.warn('Pipeline', `Enhanced learning record sync error (non-blocking): ${err.message}`);
        }
    }

    /**
     * Safe wrapper for performance metrics - non-blocking
     */
    safeRecordPerformance(traceId, metrics) {
        try {
            this.performanceOptimizer.recordMetrics(traceId, metrics);
        } catch (error) {
            aiLogger.debug('Pipeline', `Performance metrics failed: ${error.message}`);
        }
    }

    // =========================================================================
    // MAIN PROCESS METHOD
    // =========================================================================

    async process(request, onProgress = null) {
        const reportProgress = (stage, detail) => {
            if (onProgress && typeof onProgress === 'function') {
                onProgress({
                    stage,
                    detail,
                    timestamp: new Date()
                });
            }
        };
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
            reportProgress('init', 'Initializing AI pipeline...');

            // 0. Enterprise Security - Rate Limit Check (RESILIENT)
            reportProgress('security', 'Checking security & rate limits...');
            const rateLimitCheck = await this.safeCheckRateLimit(
                request.organizationId,
                request.capability || 'all'
            );
            if (!rateLimitCheck.allowed) {
                aiLogger.warn('Pipeline', `Rate limit exceeded: ${rateLimitCheck.limitType}`);
                throw new Error(`Rate limit exceeded. Reset at: ${rateLimitCheck.resetAt?.toISOString()}`);
            }
            if (rateLimitCheck.bypassed) {
                aiLogger.info('Pipeline', 'Rate limit check bypassed due to error');
            }

            // 0.5. Load Effective AI Settings
            reportProgress('settings', 'Loading AI settings...');
            let effectiveSettings = null;
            try {
                if (request.userId && request.organizationId) {
                    effectiveSettings = await AISettingsService.getEffectiveSettings(
                        request.userId,
                        request.organizationId
                    );

                    // Apply proactivity mode to prompt modifier
                    if (effectiveSettings.proactivityMode) {
                        const proactivityPrompt = AIProactivityEngine.getProactivityPromptModifier(
                            effectiveSettings.proactivityMode
                        );
                        request._proactivityPrompt = proactivityPrompt;
                        request._effectiveSettings = effectiveSettings;
                    }

                    aiLogger.pipeline('Effective settings loaded', {
                        proactivityMode: effectiveSettings.proactivityMode,
                        maxTokens: effectiveSettings.maxTokens
                    });
                }
            } catch (settingsErr) {
                aiLogger.warn('Pipeline', `Failed to load effective settings: ${settingsErr.message}`);
                // Continue without settings - fail-open pattern
            }

            // 1. Gateway Security Check (RESILIENT - only blocks on critical)
            reportProgress('security', 'Verifying request integrity...');
            const gatewaySpan = trace.startSpan('gateway');
            await this.safeGatewayProcess(request);
            trace.endSpan(gatewaySpan, { status: 'passed' });

            // 2. Quota Check (RESILIENT)
            const quotaCheck = await this.safeCheckQuota(
                request.userId,
                request.organizationId,
                request.projectId
            );
            if (!quotaCheck.allowed) {
                aiLogger.warn('Pipeline', `Quota exceeded: ${quotaCheck.reason}`);
                throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
            }
            if (quotaCheck.bypassed) {
                aiLogger.info('Pipeline', 'Quota check bypassed due to error');
            }

            // 3. Cache Check - Return immediately if cached
            reportProgress('cache', 'Checking semantic cache...');
            const cacheService = this.cacheService;
            const cacheQuery = request.prompt || request.messages?.[request.messages.length - 1]?.content;
            const cacheContext = {
                organizationId: request.organizationId,
                projectId: request.projectId,
                capability: request.capability
            };

            if (!request.stream && cacheQuery) {
                if (cacheService) {
                    const cached = await cacheService.get(cacheQuery, cacheContext);
                    if (cached) {
                        const cacheLatency = Date.now() - startTime;
                        aiLogger.cache('get', true);

                        // Record cache hit metrics
                        if (metrics) {
                            metrics.recordRequest({
                                capability: request.capability,
                                model: cached.metadata?.model || 'cached',
                                success: true,
                                durationSeconds: cacheLatency / 1000,
                                cached: true
                            });
                        }

                        if (trace) trace.complete({ status: 'cache_hit' });

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
            }

            // 4. RAG Query - Fetch relevant knowledge chunks
            reportProgress('rag', 'Searching knowledge base...');
            let knowledgeContext = null;
            if (cacheQuery) {
                try {
                    const RagService = this.ragService;
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
            reportProgress('memory', 'Retrieving context from memory...');
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
            reportProgress('context', 'Building conversation context...');
            const context = await this.contextBuilder.build({
                userId: request.userId,
                organizationId: request.organizationId,
                projectId: request.projectId,
                conversationId: request.conversationId, // Pass conversation ID
                currentMessage: request.prompt || request.messages?.[request.messages.length - 1]?.content,
                intent: request.intent || request.capability, // Use capability as default intent
                topic: request.topic, // Optional topic override
                screenContext: request.screenContext,
                // Enhanced context params
                includeResearch: request.includeWebResearch !== false, // Default to true unless explicitly disabled
                knowledgeGaps: request.knowledgeGaps || [],
                maxTokens: request.maxContextTokens || 12000
            });

            // 5.5. Determine Response Mode (Adaptive Response System)
            let responseModeConfig = null;
            let responseModePrompt = '';
            try {
                const { adaptiveResponseService } = await import('./adaptiveResponseService.js');
                const userPreferences = request.aiPreferences || {};

                responseModeConfig = await adaptiveResponseService.determineResponseMode(
                    request.userId,
                    request.prompt || request.messages?.[request.messages.length - 1]?.content,
                    userPreferences
                );

                responseModePrompt = adaptiveResponseService.buildResponseModePrompt(
                    responseModeConfig,
                    userPreferences
                );

                aiLogger.info('Pipeline', `Response mode: ${responseModeConfig.mode} (${responseModeConfig.wasAutoDetected ? 'auto-detected' : 'default'})`);
            } catch (adaptiveError) {
                aiLogger.warn('Pipeline', `Adaptive response error (non-blocking): ${adaptiveError.message}`);
            }

            // 6. Assemble Prompt (includes visual context + knowledge + memory injection)
            reportProgress('prompt', 'Assembling optimized prompt...');
            const { systemPrompt, messages } = await this.promptAssembler.build({
                request,
                context,
                knowledgeContext, // Pass to assembler for injection
                memoryContext, // Pass memory context for enhanced responses
                responseModePrompt // Pass response mode instructions
            });

            // 6. Route Model (with org overrides and user tier preference)
            reportProgress('routing', 'Routing to optimal model...');

            // Apply User's Tier Preference
            const routingOptions = { ...(request.options || {}) };
            // Only apply if user has a preference AND caller didn't explicitly force a tier
            if (effectiveSettings?.selectedTier && !routingOptions.tier) {
                routingOptions.tier = effectiveSettings.selectedTier;
                aiLogger.debug('Pipeline', `Applied user tier preference: ${effectiveSettings.selectedTier}`);
            }

            modelConfig = await this.modelRouter.select({
                capability: request.capability,
                organizationId: request.organizationId,
                options: routingOptions
            });

            // 7. Call LLM Service (with fallback support)
            reportProgress('generation', 'Streaming response from model...');
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
            reportProgress('quality', 'Verifying response quality...');
            const qualitySpan = trace.startSpan('quality_check');
            try {
                // RESILIENT: Use safe wrapper for quality check
                qualityResult = await this.safeQualityCheck(response, {
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
                if (this.cacheService) {
                    await this.cacheService.set(cacheQuery, cacheContext, response);
                }
                aiLogger.cache('set', true);
            }

            // 10. Consume tokens from quota
            const tokenCount = costInfo.totalTokens || 1000;
            // Use injected quota service for testing
            await this.quotaService.consumeTokens(
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

            // 11.5 Enterprise Security - Comprehensive Audit Log (RESILIENT - non-blocking)
            this.safeLogAudit({
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

            // 11.6 Performance Optimizer - Record metrics (RESILIENT - non-blocking)
            this.safeRecordPerformance(trace.traceId, {
                responseTime: latency,
                tokensUsed: tokenCount,
                cached: cacheHit,
                error: false
            });

            // 11.7 Learning System - Enhanced record with auto-feedback (RESILIENT - non-blocking)
            this.safeRecordLearningEnhanced({
                userId: request.userId,
                organizationId: request.organizationId,
                requestType: request.capability,
                prompt: (request.prompt || cacheQuery)?.substring(0, 500),
                response: response.content?.substring(0, 1000),
                qualityResult: qualityResult, // Pass full quality result for auto-feedback
                model: modelConfig?.id,
                latency,
                tokenCount: tokenCount,
                metadata: {
                    cached: cacheHit,
                    traceId: trace.traceId,
                    usedFallback: attempts > 1
                }
            });
            // Note: safeRecordLearningEnhanced is fire-and-forget with internal error handling

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

            // Performance Optimizer - Record error metrics (RESILIENT)
            this.safeRecordPerformance(trace.traceId, {
                responseTime: errorLatency,
                tokensUsed: 0,
                cached: false,
                error: true
            });

            // Enterprise Security - Log error in audit (RESILIENT)
            this.safeLogAudit({
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
     * Stream a chat response
     * @param {Array} messages - Chat messages
     * @param {Object} context - Context object (userId, organizationId, projectId)
     * @returns {Promise<AsyncIterator>} Stream iterator
     */
    async streamChat(messages, context = {}) {
        await this.initDeps();

        const { userId, organizationId, projectId } = context;
        let finalMessages = messages;

        // 1. Rate Limit & Quota (Fail Open)
        await this.safeCheckRateLimit(organizationId, 'chat_stream');
        await this.safeCheckQuota(userId, organizationId, projectId);

        // 2. Gateway Check
        const gatewayResult = await this.safeGatewayProcess({
            messages,
            userId,
            organizationId,
            capability: 'chat_stream'
        });

        if (gatewayResult && gatewayResult.blocked) {
            throw new Error(`Request blocked by AI Gateway: ${gatewayResult.reason}`);
        }

        // 3. Model Routing
        const modelSelection = this.modelRouter.select('chat_stream', 'gemini-pro');
        const providerConfig = await this.modelRouter.getProviderConfig(modelSelection.id);

        // 4. Call LLM Service Stream
        if (this.llmService && this.llmService.stream) {
            try {
                // Track start of stream
                const trace = this.observability.createTrace('ai_stream_chat');
                trace.startSpan('stream_generation');

                const stream = await this.llmService.stream(finalMessages, providerConfig);

                trace.endSpan('stream_generation');
                return stream;
            } catch (error) {
                this.observability.recordError(error, { capability: 'chat_stream' });
                throw error;
            }
        } else {
            throw new Error('LLMService does not support streaming');
        }
    }

    /**
     * Determine fallback model for a given model ID using fallback chain
     * @param {string} modelId - Current model that failed
     * @param {Array} excludeModels - Models already tried (to skip)
     * @param {string} tier - Model tier for selecting appropriate chain
     */
    getFallbackModel(modelId, excludeModels = [], tier = 'STANDARD') {
        const chain = this.modelRouter.getFallbackChain(tier);

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
    /**
     * Get available tools for the pipeline
     */
    getAvailableTools() {
        try {
            if (this.mcpServer) {
                return this.mcpServer.getToolDefinitions();
            }
            // If not initialized yet (shouldn't happen if initDeps handled), return empty or try lazy import?
            // Since this method is synchronous, we cannot await.
            // Assuming initDeps was called.
            return [];
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

// ============================================================================
// DOMAIN-SPECIFIC METHODS
// ============================================================================
// These methods provide backward compatibility with aiService.js API.
// They wrap the unified process() method with capability-specific configuration.
// ============================================================================

/**
 * Suggest tasks for an initiative
 * @param {Object} initiativeContext - Initiative context
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Suggested tasks
 */
async function suggestTasks(initiativeContext, userId, organizationId, pipelineInstance = null) {
    // DEBUG: Verify injection
    // console.log('DEBUG: suggestTasks pipeline injection:', !!pipelineInstance, pipelineInstance?.llmService?.call ? 'HasMockCall' : 'NoMockCall');
    const pipeline = pipelineInstance || new AIPipeline();
    const config = getCapabilityConfig('suggestTasks');

    const prompt = `Given this initiative context, suggest implementation tasks:
    
Initiative: ${initiativeContext.name || 'Unknown'}
Summary: ${initiativeContext.summary || ''}
Hypothesis: ${initiativeContext.hypothesis || ''}
Axis: ${initiativeContext.axis || ''}

Generate a structured list of tasks following SCMS methodology with:
- Clear task names
- Estimated effort
- Dependencies
- Priority (HIGH/MEDIUM/LOW)

Output as JSON array.`;

    const result = await pipeline.process({
        capability: 'suggestTasks',
        prompt,
        userId,
        organizationId,
        role: config.role
    });

    return parseJsonResponse(result.content);
}

/**
 * Validate an initiative
 * @param {Object} initiativeContext - Initiative to validate
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Validation result
 */
async function validateInitiative(initiativeContext, userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();
    const config = getCapabilityConfig('validateInitiative');

    const prompt = `Validate this initiative as a strict gatekeeper:
    
Name: ${initiativeContext.name || 'Unknown'}
Summary: ${initiativeContext.summary || ''}
Expected Outcome: ${initiativeContext.expectedOutcome || ''}
Success Metrics: ${initiativeContext.successMetrics || ''}

Evaluate:
1. Clarity of definition
2. Measurability of success
3. Alignment with transformation goals
4. Risk factors

Provide: isValid (boolean), score (0-100), issues (array), recommendations (array)
Output as JSON.`;

    const result = await pipeline.process({
        capability: 'validateInitiative',
        prompt,
        userId,
        organizationId,
        role: config.role
    });

    return parseJsonResponse(result.content);
}

/**
 * Enrich initiative with market context
 * @param {Object} initiativeContext - Initiative context
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Enriched context
 */
async function enrichInitiative(initiativeContext, userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();
    const config = getCapabilityConfig('enrichInitiative');

    const prompt = `Enrich this initiative with market context and best practices:
    
Name: ${initiativeContext.name || 'Unknown'}
Summary: ${initiativeContext.summary || ''}
Industry: ${initiativeContext.industry || 'Technology'}

Provide:
- Market trends related to this initiative
- Industry benchmarks
- Success factors from similar transformations
- Potential risks and mitigation strategies

Output as JSON with keys: marketTrends, benchmarks, successFactors, risks.`;

    const result = await pipeline.process({
        capability: 'enrichInitiative',
        prompt,
        userId,
        organizationId,
        role: config.role,
        includeWebResearch: true
    });

    return parseJsonResponse(result.content);
}

/**
 * Generate observations from assessment data
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Generated observations
 */
async function generateObservations(userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();
    const config = getCapabilityConfig('generateObservations');

    const prompt = `Analyze the organization's digital maturity data and generate strategic observations.

Focus on:
1. Key patterns and trends
2. Areas of strength
3. Critical gaps
4. Quick wins
5. Strategic priorities

Output as JSON with keys: patterns, strengths, gaps, quickWins, priorities.`;

    const result = await pipeline.process({
        capability: 'generateObservations',
        prompt,
        userId,
        organizationId,
        role: config.role
    });

    return parseJsonResponse(result.content);
}

/**
 * Generate structured content for initiative charter
 * @param {string} prompt - Generation prompt
 * @param {string} contentType - Type of content to generate
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Generated content
 */
async function generateStructuredContent(prompt, contentType, userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();
    const config = getCapabilityConfig('generateStructuredContent');

    const result = await pipeline.process({
        capability: 'generateStructuredContent',
        prompt,
        userId,
        organizationId,
        role: config.role
    });

    return parseJsonResponse(result.content);
}

/**
 * Chat with AI
 * @param {string} message - User message
 * @param {Array} history - Conversation history
 * @param {string} roleName - Role to use
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<string>} AI response
 */
async function chat(message, history = [], roleName = 'CONSULTANT', userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();

    const result = await pipeline.process({
        capability: 'chat',
        prompt: message,
        messages: history,
        userId,
        organizationId,
        role: roleName
    });

    return result.content;
}

/**
 * Stream chat with AI
 * @param {string} message - User message
 * @param {Array} history - Conversation history
 * @param {string} roleName - Role to use
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {AsyncGenerator} Stream of chunks
 */
async function* streamChat(message, history = [], roleName = 'CONSULTANT', userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || new AIPipeline();

    // Construct messages
    const messages = [...(history || [])];
    if (message) {
        messages.push({ role: 'user', content: message });
    }

    const iterator = await pipeline.streamChat(messages, {
        userId,
        organizationId,
        role: roleName,
        capability: 'chat'
    });

    for await (const chunk of iterator) {
        yield chunk;
    }
}

/**
 * Parse JSON response with error handling
 * @param {string} content - Response content
 * @returns {Object} Parsed JSON or error object
 */
function parseJsonResponse(content) {
    if (!content) return { error: 'Empty response' };

    try {
        // Clean markdown code blocks if present
        const cleaned = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to extract JSON from text
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                return { rawContent: content, parseError: e.message };
            }
        }
        return { rawContent: content, parseError: e.message };
    }
}

// ============================================================================
// WORLD-CLASS CHAT 2025: THINKING & ARTIFACTS EXTRACTION
// ============================================================================

/**
 * Extract thinking steps from AI response
 * Parses <thinking>...</thinking> blocks and returns structured steps
 * @param {string} content - Raw AI response content
 * @returns {{ cleanContent: string, thinkingSteps: Array }} Parsed content and thinking steps
 */
function extractThinkingSteps(content) {
    if (!content) return { cleanContent: '', thinkingSteps: [] };

    const thinkingSteps = [];
    let stepId = 1;

    // Pattern for <thinking>...</thinking> blocks
    const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/gi;

    // Extract thinking blocks
    let match;
    while ((match = thinkingPattern.exec(content)) !== null) {
        const thinkingContent = match[1].trim();

        // Try to split by numbered list (1. 2. 3.) or bullets (- * •)
        // Use a more robust pattern that captures the delimiter
        const numberedPattern = /(\d+\.\s*[^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g;
        const bulletPattern = /([-*•]\s*[^\n]+(?:\n(?![-*•])[^\n]+)*)/g;

        let foundSteps = false;

        // Try numbered list first
        let stepMatch;
        while ((stepMatch = numberedPattern.exec(thinkingContent)) !== null) {
            foundSteps = true;
            const stepText = stepMatch[1].replace(/^\d+\.\s*/, '').trim();
            if (stepText) {
                thinkingSteps.push({
                    id: `think-${stepId++}`,
                    label: `Step ${thinkingSteps.length + 1}`,
                    content: stepText,
                    status: 'done',
                    timestamp: new Date(),
                    category: categorizeThinkingStep(stepText)
                });
            }
        }

        // If no numbered steps found, try bullets
        if (!foundSteps) {
            while ((stepMatch = bulletPattern.exec(thinkingContent)) !== null) {
                foundSteps = true;
                const stepText = stepMatch[1].replace(/^[-*•]\s*/, '').trim();
                if (stepText) {
                    thinkingSteps.push({
                        id: `think-${stepId++}`,
                        label: `Step ${thinkingSteps.length + 1}`,
                        content: stepText,
                        status: 'done',
                        timestamp: new Date(),
                        category: categorizeThinkingStep(stepText)
                    });
                }
            }
        }

        // If still no steps found, treat entire content as one step
        if (!foundSteps && thinkingContent.length > 0) {
            thinkingSteps.push({
                id: `think-${stepId++}`,
                label: 'Step 1',
                content: thinkingContent,
                status: 'done',
                timestamp: new Date(),
                category: categorizeThinkingStep(thinkingContent)
            });
        }
    }

    // Remove thinking blocks from content
    const cleanContent = content.replace(thinkingPattern, '').trim();

    return { cleanContent, thinkingSteps };
}

/**
 * Categorize a thinking step based on its content
 * @param {string} stepContent - Content of the thinking step
 * @returns {string} Category: 'analysis' | 'research' | 'synthesis' | 'validation'
 */
function categorizeThinkingStep(stepContent) {
    const lower = stepContent.toLowerCase();

    if (lower.includes('analyz') || lower.includes('examin') || lower.includes('assess')) {
        return 'analysis';
    }
    if (lower.includes('search') || lower.includes('look') || lower.includes('find') || lower.includes('research')) {
        return 'research';
    }
    if (lower.includes('combin') || lower.includes('integrat') || lower.includes('synthesiz') || lower.includes('creat')) {
        return 'synthesis';
    }
    if (lower.includes('verify') || lower.includes('check') || lower.includes('valid') || lower.includes('confirm')) {
        return 'validation';
    }

    return 'analysis'; // Default
}

/**
 * Extract artifacts from AI response
 * Parses ```artifact:type:title...``` blocks and returns structured artifacts
 * @param {string} content - Raw AI response content
 * @returns {{ cleanContent: string, artifacts: Array }} Parsed content and artifacts
 */
function extractArtifacts(content) {
    if (!content) return { cleanContent: '', artifacts: [] };

    const artifacts = [];
    let artifactId = 1;
    const processedPositions = new Set();

    // Pattern for ```artifact:type:language:title\ncontent\n``` (for code artifacts with language)
    const artifactPatternWithLang = /```artifact:(\w+):(\w+):([^\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = artifactPatternWithLang.exec(content)) !== null) {
        const [, type, language, title, artifactContent] = match;
        processedPositions.add(match.index);

        artifacts.push({
            id: `artifact-${Date.now()}-${artifactId++}`,
            type: type.toLowerCase(),
            title: title.trim(),
            content: artifactContent.trim(),
            language: language,
            editable: true,
            version: 1,
            createdAt: new Date()
        });
    }

    // Pattern for ```artifact:type:title\ncontent\n``` (without language)
    const artifactPattern = /```artifact:(\w+):([^\n]+)\n([\s\S]*?)```/g;

    while ((match = artifactPattern.exec(content)) !== null) {
        // Skip if already processed by language pattern
        if (processedPositions.has(match.index)) continue;

        const [, type, title, artifactContent] = match;
        processedPositions.add(match.index);

        artifacts.push({
            id: `artifact-${Date.now()}-${artifactId++}`,
            type: type.toLowerCase(),
            title: title.trim(),
            content: artifactContent.trim(),
            editable: true,
            version: 1,
            createdAt: new Date()
        });
    }

    // Also check for JSON artifact definitions
    const jsonArtifactPattern = /```json:artifact\n([\s\S]*?)```/g;
    while ((match = jsonArtifactPattern.exec(content)) !== null) {
        try {
            const artifactDef = JSON.parse(match[1]);
            if (artifactDef.type && artifactDef.content) {
                artifacts.push({
                    id: `artifact-${Date.now()}-${artifactId++}`,
                    type: artifactDef.type,
                    title: artifactDef.title || 'Untitled',
                    content: artifactDef.content,
                    language: artifactDef.language,
                    editable: artifactDef.editable !== false,
                    version: 1,
                    createdAt: new Date(),
                    metadata: artifactDef.metadata
                });
            }
        } catch (e) {
            // Invalid JSON, skip
        }
    }

    // Also extract standard code blocks as potential artifacts
    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    let codeMatch;
    while ((codeMatch = codeBlockPattern.exec(content)) !== null) {
        const [fullMatch, language, codeContent] = codeMatch;

        // Skip artifact blocks we already processed
        if (fullMatch.includes('artifact:') || fullMatch.includes('json:artifact')) {
            continue;
        }

        // Only create artifacts for substantial code blocks (>100 chars)
        if (codeContent.trim().length > 100) {
            artifacts.push({
                id: `artifact-${Date.now()}-${artifactId++}`,
                type: 'code',
                title: `Code (${language || 'plaintext'})`,
                content: codeContent.trim(),
                language: language || 'plaintext',
                editable: true,
                version: 1,
                createdAt: new Date()
            });
        }
    }

    // Don't remove code blocks from content (they should still be visible)
    // Only remove explicit artifact blocks
    const cleanContent = content
        .replace(artifactPatternWithLang, '')
        .replace(artifactPattern, '')
        .replace(jsonArtifactPattern, '')
        .trim();

    return { cleanContent, artifacts };
}

/**
 * Process AI response for World-Class Chat 2025 features
 * Extracts thinking steps, artifacts, and cleans up content
 * @param {Object} response - Raw AI response
 * @returns {Object} Enhanced response with thinking and artifacts
 */
function enhanceResponse(response) {
    if (!response || !response.content) return response;

    const { cleanContent: contentAfterThinking, thinkingSteps } = extractThinkingSteps(response.content);
    const { cleanContent, artifacts } = extractArtifacts(contentAfterThinking);

    return {
        ...response,
        content: cleanContent,
        thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
        artifacts: artifacts.length > 0 ? artifacts : undefined
    };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
const aiPipeline = new AIPipeline();

/**
 * Stream chat wrapper for backward compatibility / testing
 * @param {string} prompt - User prompt
 * @param {Array} history - Chat history
 * @param {string} role - User role
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {AIPipeline} [pipelineInstance] - Optional pipeline instance
 * @returns {Promise<AsyncIterator>} Stream iterator
 */
async function streamChat(prompt, history, role, userId, organizationId, pipelineInstance = null) {
    const pipeline = pipelineInstance || aiPipeline;
    // Basic message construction
    const messages = [...(history || [])];
    if (prompt) {
        messages.push({ role: 'user', content: prompt });
    }

    return pipeline.streamChat(messages, {
        userId,
        organizationId,
        role,
        capability: 'chat_stream'
    });
}

export {
    AIPipeline,
    aiPipeline,
    CAPABILITY_REGISTRY,
    getCapabilityConfig,
    FALLBACK_ROLES,
    extractThinkingSteps,
    extractArtifacts,
    enhanceResponse,
    chat,
    streamChat,
    suggestTasks,
    generateStructuredContent
};

export default aiPipeline;
