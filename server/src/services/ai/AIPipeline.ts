/**
 * AI Pipeline Service
 * Enterprise SaaS Architecture - TypeScript Backend AI Pipeline
 *
 * This is the TypeScript migration of the core AI Pipeline.
 * It serves as a pattern for migrating other backend services.
 */

import { buildPersonaPrompt } from '../../ai/persona.js';
import type {
  AIArtifact,
  AICapability,
  AIContext,
  AIError,
  AIOptions,
  AIPipelineRequest,
  AIPipelineResponse,
  CapabilityName,
  CapabilityRegistry,
  ChatMessage,
  StreamCallback,
  ThinkingStep,
  TokenUsage,
} from '../../types/ai.types.js';
import logger from '../../utils/Logger.js';
import { llmService } from './llmService.js';
import modelRouter from './modelRouter.js';

// Lazy load AIContextBuilder to avoid circular dependencies
let _AIContextBuilder: any = null;
async function getAIContextBuilder() {
  if (!_AIContextBuilder) {
    const mod = await import('../aiContextBuilder.js');
    _AIContextBuilder = mod.AIContextBuilder || mod.default;
  }
  return _AIContextBuilder;
}

// ==========================================
// CAPABILITY REGISTRY
// ==========================================

const CAPABILITY_REGISTRY: CapabilityRegistry = {
  diagnose: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Analyze maturity for a specific axis',
    outputFormat: 'json',
  },
  deepDiagnose: {
    role: 'ANALYST',
    maxTokens: 4000,
    description: 'Deep chain-of-thought diagnosis',
    outputFormat: 'json',
  },
  generateList: {
    role: 'ANALYST',
    maxTokens: 1500,
    description: 'Generate a list of items',
    outputFormat: 'json',
  },
  generateTable: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Generate a structured table',
    outputFormat: 'json',
  },
  generateInitiatives: {
    role: 'CONSULTANT',
    maxTokens: 4000,
    description: 'Generate transformation initiatives',
    outputFormat: 'json',
  },
  generateObservations: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Generate strategic observations',
    outputFormat: 'json',
  },
  generateFirstValuePlan: {
    role: 'STRATEGIST',
    maxTokens: 3000,
    description: 'Generate first value delivery plan',
    outputFormat: 'json',
  },
  suggestTasks: {
    role: 'IMPLEMENTER',
    maxTokens: 2000,
    description: 'Suggest implementation tasks',
    outputFormat: 'json',
  },
  generateTaskInsight: {
    role: 'ANALYST',
    maxTokens: 1500,
    description: 'Generate task insights',
    outputFormat: 'json',
  },
  generateExecutionStrategy: {
    role: 'IMPLEMENTER',
    maxTokens: 2500,
    description: 'Generate execution strategy',
    outputFormat: 'json',
  },
  validateInitiative: {
    role: 'GATEKEEPER',
    maxTokens: 1500,
    description: 'Validate initiative',
    outputFormat: 'json',
  },
  enrichInitiative: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Enrich initiative with context',
    outputFormat: 'json',
  },
  generateInsights: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Generate strategic insights',
    outputFormat: 'json',
  },
  generateStrategicFit: {
    role: 'ANALYST',
    maxTokens: 1500,
    description: 'Analyze strategic fit',
    outputFormat: 'json',
  },
  buildRoadmap: {
    role: 'STRATEGIST',
    maxTokens: 3000,
    description: 'Build transformation roadmap',
    outputFormat: 'json',
  },
  validateRoadmap: {
    role: 'ANALYST',
    maxTokens: 2000,
    description: 'Validate roadmap',
    outputFormat: 'json',
  },
  chat: {
    role: 'CONSULTANT',
    maxTokens: 4000,
    description: 'General chat interaction',
    outputFormat: 'text',
  },
  chatStream: {
    role: 'CONSULTANT',
    maxTokens: 4000,
    description: 'Streaming chat interaction',
    outputFormat: 'text',
  },
  // Phase 3 capabilities
  nlToInitiative: {
    role: 'CONSULTANT',
    maxTokens: 3000,
    description: 'Generate structured initiative from natural language description',
    outputFormat: 'json',
  },
  senseCheck: {
    role: 'GATEKEEPER',
    maxTokens: 1500,
    description: 'Validate and sense-check form data (timeline, budget, consistency)',
    outputFormat: 'json',
  },
  riskScore: {
    role: 'ANALYST',
    maxTokens: 1500,
    description: 'Predict risk score for an initiative',
    outputFormat: 'json',
  },
  narrateDashboard: {
    role: 'ANALYST',
    maxTokens: 1000,
    description: 'Generate natural language explanation of chart/KPI data',
    outputFormat: 'text',
  },
  engagementSummary: {
    role: 'CONSULTANT',
    maxTokens: 6000,
    description: 'Generate weekly/monthly engagement summary report',
    outputFormat: 'text',
  },
};

// ==========================================
// AI PIPELINE CLASS
// ==========================================

export class AIPipeline {
  private static instance: AIPipeline;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AIPipeline {
    if (!AIPipeline.instance) {
      AIPipeline.instance = new AIPipeline();
    }
    return AIPipeline.instance;
  }

  /**
   * Set dependencies manually (useful for testing)
   */
  public setDependencies(_deps: { db?: any }): void {
    // For testing compatibility
  }

  /**
   * Process an AI request through the pipeline
   * If request.stream is true, returns a response with a stream property
   */
  public async process(request: AIPipelineRequest): Promise<AIPipelineResponse> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    try {
      // 1. Validate request
      this.validateRequest(request);

      // 2. Get capability config
      const capability = this.getCapability(request.capability);

      // 3. Check quota
      await this.checkQuota(request.userId, request.organizationId);

      // 4. Build context
      const enrichedContext = await this.buildContext(request);

      // 5. Build prompt
      const prompt = await this.buildPrompt(request, capability, enrichedContext);

      // 6. Select model
      const modelConfig = await this.selectModel(request, capability);
      (request as any)._modelConfigForLog = {
        provider: modelConfig?.provider || null,
        model: modelConfig?.model || null,
      };

      // Check if streaming is requested
      if ((request as any).stream) {
        const systemPromptStr = prompt.find((m) => m.role === 'system')?.content || '';
        const nonSystemMsgs = prompt
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system' | 'tool',
            content: m.content,
          }));

        // Try primary model, with automatic cross-provider fallback on failure.
        // Important: having multiple API keys (e.g. OpenAI + Gemini) must actually enable failover.
        const tierForFallback = ((request.options as any)?.selectedTier || 'STANDARD') as any;
        const fallbackChain: string[] =
          typeof (modelRouter as any).getFallbackChain === 'function'
            ? ((modelRouter as any).getFallbackChain(tierForFallback) as string[])
            : [];

        const candidateModelIds = Array.from(
          new Set([modelConfig.model, ...fallbackChain].filter(Boolean))
        ) as string[];

        let usedProvider = modelConfig.provider;
        let usedModel = modelConfig.model;
        let streamResponse: Record<string, unknown> | null = null;
        let lastError: Error | null = null;

        for (const candidateModelId of candidateModelIds) {
          try {
            const cfg = await modelRouter.getProviderConfig(candidateModelId, tierForFallback);
            const providerId = String((cfg as any)?.provider || '');
            const modelId = String((cfg as any)?.id || candidateModelId);
            const apiKey = (cfg as any)?.apiKey;
            const endpoint = (cfg as any)?.endpoint;

            const isConfigured =
              providerId.toLowerCase() === 'ollama' ||
              (typeof apiKey === 'string' && apiKey.trim().length > 0);
            if (!isConfigured) {
              logger.info(`[AIPipeline] Skipping unconfigured fallback: ${providerId}/${modelId}`);
              continue;
            }

            logger.info(`[AIPipeline] Starting stream with ${providerId}/${modelId}`);
            streamResponse = await llmService.callStream({
              type: 'chat',
              modelConfig: {
                provider: providerId,
                id: modelId,
                endpoint,
                apiKey,
              },
              systemPrompt: systemPromptStr,
              messages: nonSystemMsgs,
              maxTokens: modelConfig.maxTokens,
              temperature: request.options?.temperature ?? 0.7,
              stream: true,
            });

            usedProvider = providerId;
            usedModel = modelId;
            (request as any)._modelConfigForLog = { provider: providerId, model: modelId };
            logger.info(`[AIPipeline] Stream started: ${providerId}/${modelId}`);
            break;
          } catch (err: any) {
            lastError = err as Error;
            const msg = String(err?.message || err || '');
            const isRateLimit = /quota|rate\\.limit|429|too many requests/i.test(msg);
            logger.warn(
              `[AIPipeline] Stream failed (${candidateModelId}): ${msg.slice(0, 200)}${isRateLimit ? ' [RATE_LIMIT]' : ''}`
            );
          }
        }

        if (!streamResponse) {
          throw lastError || new Error('All streaming providers failed');
        }

        return {
          success: true,
          content: '',
          stream: (streamResponse as { stream?: AsyncIterable<string> }).stream,
          metadata: {
            provider: usedProvider,
            model: usedModel,
            latency: Date.now() - startTime,
            traceId,
            ragResults: enrichedContext.ragResults,
            memoryUsed: enrichedContext.memoryUsed,
          },
        } as AIPipelineResponse & { stream?: AsyncIterable<string> };
      }

      // 7. Execute with provider (non-streaming)
      const response = await this.executeWithProvider(prompt, modelConfig, request.options);

      // 8. Post-process response
      const processedResponse = await this.postProcess(response, capability);

      // 9. Log and track
      await this.logRequest(request, processedResponse, Date.now() - startTime, traceId);

      return {
        success: true,
        content: processedResponse.content,
        artifacts: processedResponse.artifacts,
        usage: processedResponse.usage,
        metadata: {
          provider: modelConfig.provider,
          model: modelConfig.model,
          latency: Date.now() - startTime,
          traceId,
          cached: processedResponse.cached,
          ragResults: enrichedContext.ragResults,
          memoryUsed: enrichedContext.memoryUsed,
        },
      };
    } catch (error: unknown) {
      const aiError = this.handleError(error);
      await this.logError(request, aiError, Date.now() - startTime, traceId);

      return {
        success: false,
        content: '',
        error: aiError,
        metadata: {
          provider: 'unknown',
          model: 'unknown',
          latency: Date.now() - startTime,
          traceId,
        },
      };
    }
  }

  /**
   * Process a streaming AI request
   */
  public async processStream(request: AIPipelineRequest, onChunk: StreamCallback): Promise<void> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    try {
      // 1. Validate request
      this.validateRequest(request);

      // 2. Get capability config
      const capability = this.getCapability(request.capability);

      // 3. Check quota
      await this.checkQuota(request.userId, request.organizationId);

      // 4. Build context
      const enrichedContext = await this.buildContext(request);

      // 5. Build prompt
      const prompt = await this.buildPrompt(request, capability, enrichedContext);

      // 6. Select model
      const modelConfig = await this.selectModel(request, capability);
      (request as any)._modelConfigForLog = {
        provider: modelConfig?.provider || null,
        model: modelConfig?.model || null,
      };

      // 7. Execute streaming
      await this.executeStreamingWithProvider(prompt, modelConfig, request.options, onChunk);

      // 8. Send done signal
      onChunk({
        type: 'done',
        metadata: {
          provider: modelConfig.provider,
          model: modelConfig.model,
          latency: Date.now() - startTime,
          traceId,
        },
      });

      // 9. Best-effort usage log (streaming typically has no token usage here)
      await this.logRequest(
        request,
        { content: '', usage: undefined },
        Date.now() - startTime,
        traceId
      );
    } catch (error: unknown) {
      const aiError = this.handleError(error);
      await this.logError(request, aiError, Date.now() - startTime, traceId);
      onChunk({
        type: 'error',
        error: aiError,
      });
    }
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private validateRequest(request: AIPipelineRequest): void {
    if (!request.capability) {
      throw new Error('Capability is required');
    }
    if (!request.prompt) {
      throw new Error('Prompt is required');
    }
    if (!request.userId) {
      throw new Error('User ID is required');
    }
    if (!CAPABILITY_REGISTRY[request.capability]) {
      throw new Error(`Unknown capability: ${request.capability}`);
    }
  }

  private getCapability(name: CapabilityName): AICapability {
    return CAPABILITY_REGISTRY[name];
  }

  private async checkQuota(userId: string, organizationId?: string): Promise<void> {
    if (!organizationId) return; // Skip for requests without org context

    try {
      const budgetMod = await import('../budgetManagementService.js');
      const BudgetService = budgetMod.default || budgetMod;
      if (!BudgetService?.checkBudgetLimit) return;

      // Check token budget (estimate ~500 tokens per request)
      const result = await BudgetService.checkBudgetLimit(
        organizationId,
        userId,
        null, // projectId — checked separately if needed
        'tokens',
        500 // estimated token cost
      );

      if (result && !result.allowed) {
        const error = new Error(
          result.reason || 'AI token budget exceeded. Please contact your administrator.'
        );
        (error as any).code = 'AI_BUDGET_EXHAUSTED';
        (error as any).budgetStatus = {
          currentUsage: result.currentUsage,
          budgetLimit: result.budgetLimit,
          usagePercent: result.usagePercent,
          scope: 'Organization',
        };
        throw error;
      }
    } catch (err: any) {
      // Re-throw budget errors, swallow everything else (fail-open)
      if (err?.code === 'AI_BUDGET_EXHAUSTED') throw err;
      logger.debug(`[AIPipeline] Quota check skipped: ${err?.message}`);
    }
  }

  private async buildContext(request: AIPipelineRequest): Promise<{
    context: AIContext;
    ragResults?: number;
    memoryUsed?: boolean;
  }> {
    try {
      const userId = request.userId;

      // T120: Private mode + retention enforcement (fail-soft)
      let isPrivateMode: boolean =
        typeof (request.options as any)?.privateMode === 'boolean'
          ? Boolean((request.options as any)?.privateMode)
          : Boolean((request.context as any)?.privateMode);
      let retentionMode: 'session' | 'extended' | 'none' | null = null;
      let memoryEnabled = true;

      try {
        const upMod = (await import('./userPrivacyService.js')) as any;
        const privacy = (upMod.default || upMod) as any;
        if (privacy?.getUserPrivacySettings) {
          const settings = await privacy.getUserPrivacySettings(userId);
          // If client didn't explicitly set privateMode, apply user's default
          if (typeof (request.options as any)?.privateMode !== 'boolean') {
            isPrivateMode = Boolean(settings?.privateModeDefault);
          }
          retentionMode =
            ((request.options as any)?.retentionMode as any) || (settings?.retentionMode ?? null);
          memoryEnabled = settings?.memoryEnabled !== false;
        }
      } catch {
        // ignore
      }

      const memoryReadAllowed = Boolean(memoryEnabled && !isPrivateMode && retentionMode !== 'none');
      (request as any)._privateMode = isPrivateMode;
      (request as any)._retentionMode = retentionMode;

      // Deep Thinking autonomy: do NOT pull external/internal context (org/project/memory/RAG).
      // Use ONLY the conversation-provided context (request.context) when deepThinking is enabled.
      const aiModes =
        (request.options as any)?.aiModes ||
        ((request.context as any)?.aiModes as any) ||
        ((request as any)?.context?.aiModes as any);
      const isDeepThinking = aiModes?.deepResearch === true;
      if (isDeepThinking) {
        // v2.0: Deep Thinking gets LIGHT context (org profile + memory only).
        // We skip heavy execution context (tasks, blockers) but include org identity
        // for personalized research.
        logger.info('[AIPipeline] Deep Thinking: building light context (org + memory only)');

        const organizationId = request.organizationId || null;

        const lightContext: any = { ...(request.context || {}) };

        if (userId && organizationId && memoryReadAllowed) {
          try {
            // Get org memory (terminology, decision patterns, maturity)
            const aiMemoryMod = await import('./aiMemoryService.js');
            const aiMemoryService = (aiMemoryMod as any).default || aiMemoryMod;

            let orgMemory = null;
            if (aiMemoryService?.getOrgMemory) {
              orgMemory = await aiMemoryService.getOrgMemory(organizationId);
            }

            let userMemory = null;
            if (aiMemoryService?.getUserMemory) {
              userMemory = await aiMemoryService.getUserMemory(userId);
            }

            if (orgMemory) {
              lightContext.orgMemory = {
                terminology: orgMemory.terminology,
                decisionPatterns: orgMemory.decisionPatterns?.slice(0, 3),
                aiMaturityStage: orgMemory.aiMaturityStage,
              };
            }

            if (userMemory) {
              lightContext.userMemory = {
                preferences: userMemory.preferences,
                expertise: userMemory.expertise?.slice(0, 5),
              };
            }
          } catch (memErr: any) {
            logger.debug(`[AIPipeline] Deep Thinking light context failed: ${memErr?.message}`);
          }
        }

        return {
          context: lightContext as any,
          ragResults: 0,
          memoryUsed: memoryReadAllowed,
        };
      }

      const AIContextBuilder = await getAIContextBuilder();

      // Extract IDs from request
      const organizationId = request.organizationId || null;
      const projectId = (request as any).projectId || (request.context as any)?.projectId || null;
      const screenContext =
        (request as any).screenContext || (request.context as any)?.screenContext || null;

      // Build rich context if we have userId and organizationId
      if (userId && organizationId && AIContextBuilder?.buildContext) {
        logger.info(
          `[AIPipeline] Building context for user: ${userId}, org: ${organizationId}, project: ${projectId}`
        );

        const fullContext = await AIContextBuilder.buildContext(userId, organizationId, projectId, {
          focusMode: (request as any).focusMode || 'all',
          currentScreen: screenContext?.screenId || screenContext?.currentScreen || null,
          selectedObjectId: screenContext?.selectedObjectId || null,
          selectedObjectType: screenContext?.selectedObjectType || null,
          conversationId:
            (request.context as any)?.conversationId ||
            (request.context as any)?.sessionId ||
            (request as any)?.conversationId ||
            null,
        });

        // Enrich with user memory (preferences, expertise, communication style)
        let userMemory = null;
        if (memoryReadAllowed) {
          try {
            const aiMemoryMod = await import('./aiMemoryService.js');
            const aiMemoryService = (aiMemoryMod as any).default || aiMemoryMod;
            if (aiMemoryService?.getUserMemory) {
              userMemory = await aiMemoryService.getUserMemory(userId);
            }
          } catch (memErr: any) {
            logger.debug(`[AIPipeline] User memory not available: ${memErr?.message}`);
          }
        }

        // Enrich with org memory (terminology, decision patterns)
        let orgMemory = null;
        if (memoryReadAllowed) {
          try {
            const aiMemoryMod = await import('./aiMemoryService.js');
            const aiMemoryService = (aiMemoryMod as any).default || aiMemoryMod;
            if (aiMemoryService?.getOrgMemory) {
              orgMemory = await aiMemoryService.getOrgMemory(organizationId);
            }
          } catch (memErr: any) {
            logger.debug(`[AIPipeline] Org memory not available: ${memErr?.message}`);
          }
        }

        // Load custom instructions (075 schema: key/value; 250 schema: preferences JSON, no key)
        let customInstructions: string | null = null;
        if (memoryReadAllowed) {
          const { get: dbGet } = await import('../../utils/DbPromise.js');
          try {
            const ciRow = (await dbGet(
              'SELECT value FROM ai_user_memory WHERE user_id = ? AND key = ?',
              [userId, 'custom_instructions']
            )) as { value?: string } | null;
            if (ciRow?.value) {
              customInstructions = String(ciRow.value).trim().slice(0, 1000);
            }
          } catch {
            try {
              const prefsRow = (await dbGet(
                'SELECT preferences FROM ai_user_memory WHERE user_id = ?',
                [userId]
              )) as { preferences?: string } | null;
              if (prefsRow?.preferences) {
                const prefs = JSON.parse(prefsRow.preferences || '{}');
                const ci = prefs?.customInstructions || prefs?.system_instructions;
                if (ci) customInstructions = String(ci).trim().slice(0, 1000);
              }
            } catch {
              // Schema may differ
            }
          }
        }

        // Merge memory into context
        const contextWithMemory = {
          ...fullContext,
          userMemory: userMemory
            ? {
                preferences: userMemory.preferences,
                expertise: userMemory.expertise?.slice(0, 10),
                recentTopics: userMemory.recentTopics?.slice(0, 5),
                interactionCount: userMemory.interactionCount,
              }
            : null,
          orgMemory: orgMemory
            ? {
                terminology: orgMemory.terminology,
                decisionPatterns: orgMemory.decisionPatterns?.slice(0, 5),
                aiMaturityStage: orgMemory.aiMaturityStage,
              }
            : null,
          customInstructions,
          privacy: {
            privateMode: isPrivateMode,
            retentionMode,
          },
        };

        // T121: best-effort document usage audit (per chat run)
        try {
          const chatRunId = String((request.context as any)?.chatRunId || '').trim();
          const dg = (fullContext as any)?.knowledge?.docGovernance;
          if (
            chatRunId &&
            dg &&
            request.organizationId &&
            request.userId &&
            typeof dg === 'object'
          ) {
            const { logDocumentUsage } = await import('./documentGovernance.js');
            const used = Array.isArray(dg.allowedDocIds) ? dg.allowedDocIds : [];
            const blocked = [
              ...(Array.isArray(dg.blockedDocIds) ? dg.blockedDocIds : []),
              ...(Array.isArray(dg.requiresApprovalDocIds) ? dg.requiresApprovalDocIds : []),
            ];
            await logDocumentUsage(
              chatRunId,
              request.organizationId,
              projectId,
              request.userId,
              used,
              blocked
            );
          }
        } catch {
          // ignore
        }

        logger.info(`[AIPipeline] Context built successfully`, {
          hasExecution: !!fullContext?.execution,
          taskCount: fullContext?.execution?.userTasks?.length || 0,
          initiativeCount: fullContext?.execution?.userInitiatives?.length || 0,
          hasUserMemory: !!userMemory,
          hasOrgMemory: !!orgMemory,
        });

        return {
          context: contextWithMemory,
          ragResults: fullContext?.knowledge?.projectDocuments?.length || 0,
          memoryUsed:
            !!fullContext?.execution ||
            (memoryReadAllowed && (!!userMemory || !!orgMemory || !!customInstructions)),
        };
      }

      // Fallback: use context from request
      logger.info('[AIPipeline] Using fallback context (no userId/organizationId)');
      return {
        context: request.context || {},
        ragResults: 0,
        memoryUsed: false,
      };
    } catch (error: any) {
      logger.error(`[AIPipeline] Failed to build context: ${error.message}`);
      // Fallback to basic context on error
      return {
        context: request.context || {},
        ragResults: 0,
        memoryUsed: false,
      };
    }
  }

  private async buildPrompt(
    request: AIPipelineRequest,
    capability: AICapability,
    enrichedContext: { context: AIContext }
  ): Promise<ChatMessage[]> {
    const ctx = enrichedContext.context as any;
    const messages: ChatMessage[] = [];

    // Build intelligent system prompt based on context
    let systemPrompt = await this.buildSystemPrompt(capability, ctx, request);

    // Add custom system instruction if provided
    if ((request.options as any)?.systemInstruction) {
      systemPrompt += `\n\n${(request.options as any).systemInstruction}`;
    }

    // Integrate adaptive style preferences (v2.0)
    // Deep Thinking autonomy: skip (pulls user/system preferences outside the conversation).
    const aiModes = (request.options as any)?.aiModes || (ctx as any)?.aiModes;
    if (!aiModes?.deepResearch) {
      try {
        const adaptiveModule = await import('./adaptiveResponseService.js');
        const adaptiveService = adaptiveModule.adaptiveResponseService || adaptiveModule.default;

        if (adaptiveService?.buildAdaptiveSystemPrompt && request.userId) {
          const screenContext = (request as any).screenContext || ctx?.currentScreen;
          systemPrompt = await adaptiveService.buildAdaptiveSystemPrompt(
            request.userId,
            systemPrompt,
            screenContext ? { screenId: screenContext, screenType: screenContext } : undefined
          );
          logger.info('[AIPipeline] Applied adaptive style preferences for user');
        }
      } catch (err) {
        // Adaptive service not available, continue with base prompt
        logger.debug('[AIPipeline] Adaptive style service not available, using base prompt');
      }
    }

    // Enhance system prompt with learned instructions from user feedback.
    // If SSOT prompt assembler already injected org learned instructions, skip to avoid duplication.
    if (request.organizationId && !ctx?._promptSsotUsed) {
      try {
        const lsPath = './learningSystem' + '.js';
        const learningMod = await import(/* @vite-ignore */ lsPath);
        const learningSystem = (learningMod as any).default || learningMod;
        if (learningSystem?.enhancePrompt) {
          const enhanced = await learningSystem.enhancePrompt(systemPrompt, request.organizationId);
          if (enhanced?.enhancedPrompt) {
            systemPrompt = enhanced.enhancedPrompt;
            if (enhanced.appliedPatterns?.length > 0) {
              logger.info(
                `[AIPipeline] Applied ${enhanced.appliedPatterns.length} learned instruction(s)`
              );
            }
          }
        }
      } catch (learnErr: any) {
        logger.debug(`[AIPipeline] Learning system not available: ${learnErr?.message}`);
      }
    }

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add conversation history if provided (can come as 'history' or 'messages')
    const history = request.history || (request as any).messages || [];
    if (history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : (msg.role as any),
          content: msg.content,
        });
      }
    }

    // Scan user prompt for PII and prompt injection before sending to LLM
    let sanitizedPrompt = request.prompt;
    try {
      const secMod = await import('./enterpriseSecurity.js');
      const security = (secMod as any).default || (secMod as any).enterpriseSecurity;
      if (security?.scanAndSanitize) {
        const scanResult = await security.scanAndSanitize(
          request.prompt,
          request.userId,
          request.organizationId
        );
        if (scanResult.blocked) {
          logger.warn(`[AIPipeline] Prompt blocked by security scan (injection detected)`);
          throw new Error('PROMPT_BLOCKED: Input contains disallowed content');
        }
        if (scanResult.piiResult?.hasPII) {
          sanitizedPrompt = scanResult.sanitizedText;
          logger.info(
            `[AIPipeline] PII redacted from user prompt (${scanResult.piiResult.detections.length} items)`
          );
        }
      }
    } catch (secErr: any) {
      if (secErr?.message?.startsWith('PROMPT_BLOCKED')) throw secErr;
      logger.debug(`[AIPipeline] Security scan not available: ${secErr?.message}`);
    }

    // Add user prompt (sanitized)
    messages.push({
      role: 'user',
      content: sanitizedPrompt,
    });

    return messages;
  }

  /**
   * Build intelligent system prompt with full context awareness
   */
  private async buildSystemPrompt(
    capability: AICapability,
    ctx: any,
    request: AIPipelineRequest
  ): Promise<string> {
    const parts: string[] = [];

    // 1. Role definition with screen-aware persona + language (SSOT prompt registry preferred)
    const conversationLang =
      ctx?.conversationLanguage || ctx?.userMemory?.preferences?.language || null;
    const langBase = conversationLang ? String(conversationLang).split('-')[0] : null;

    // Prefer canonical Prompt SSOT (T116). Fail-soft to persona prompt when registry isn't ready.
    try {
      const promptKeyRaw =
        (request.options as any)?.promptKey ||
        (request as any)?.promptKey ||
        (request.capability === 'chat' || request.capability === 'chatStream'
          ? 'system_chat'
          : `${String(request.capability || 'chat')}.default`);

      const primaryKey = String(promptKeyRaw || '').trim();
      const fallbackKey =
        request.capability === 'chat' || request.capability === 'chatStream' ? 'chat.default' : '';

      const tryAssemble = async (promptKey: string) => {
        const paMod = await import('./promptAssembler.js');
        const promptAssembler = (paMod as any).default || (paMod as any).promptAssembler || paMod;
        if (!promptAssembler?.assemble) return null;
        return await promptAssembler.assemble({
          promptKey,
          organizationId: request.organizationId || undefined,
          language: langBase || 'en',
        });
      };

      const promptKey = primaryKey;
      if (promptKey) {
        const paMod = await import('./promptAssembler.js');
        const promptAssembler = (paMod as any).default || (paMod as any).promptAssembler || paMod;

        if (promptAssembler?.assemble) {
          let assembled: any = null;
          try {
            assembled = await tryAssemble(promptKey);
          } catch (e: any) {
            // If primary key doesn't exist, try a secondary default for smooth rollouts.
            if (fallbackKey && fallbackKey !== promptKey) {
              assembled = await tryAssemble(fallbackKey);
              if (assembled?.metadata?.promptKey) {
                (request as any)._promptKey = assembled.metadata.promptKey;
              }
            } else {
              throw e;
            }
          }

          if (assembled?.systemPrompt) {
            parts.push(String(assembled.systemPrompt));
            ctx._promptSsotUsed = true;
            ctx._promptKey = assembled?.metadata?.promptKey || promptKey;
            ctx._promptVersion = assembled?.metadata?.promptVersion ?? null;
            ctx._promptMeta = assembled?.metadata || null;
            (request as any)._promptSsotUsed = true;
            (request as any)._promptKey = assembled?.metadata?.promptKey || promptKey;
            (request as any)._promptVersion = assembled?.metadata?.promptVersion ?? null;
            (request as any)._promptMeta = assembled?.metadata || null;
          } else {
            parts.push(this.buildRoleSection(capability, ctx?.currentScreen, conversationLang));
          }
        } else {
          parts.push(this.buildRoleSection(capability, ctx?.currentScreen, conversationLang));
        }
      } else {
        parts.push(this.buildRoleSection(capability, ctx?.currentScreen, conversationLang));
      }
    } catch (err: any) {
      logger.debug(`[AIPipeline] Prompt SSOT unavailable, using persona prompt: ${err?.message}`);
      parts.push(this.buildRoleSection(capability, ctx?.currentScreen, conversationLang));
    }

    // 2. Organization context
    if (ctx?.organization) {
      parts.push(this.buildOrganizationSection(ctx.organization));
    }

    // 3. Project context
    if (ctx?.project) {
      parts.push(this.buildProjectSection(ctx.project));
    }

    // 4. User execution context (tasks, initiatives, blockers)
    if (ctx?.execution) {
      parts.push(this.buildExecutionSection(ctx.execution));
    }

    // 4.5. User memory (preferences, expertise, communication style)
    if (ctx?.userMemory) {
      const um = ctx.userMemory;
      const memParts: string[] = ['## PREFERENCJE UŻYTKOWNIKA'];
      if (um.preferences?.communicationStyle)
        memParts.push(`- Styl komunikacji: ${um.preferences.communicationStyle}`);
      if (um.preferences?.detailLevel)
        memParts.push(`- Poziom szczegółowości: ${um.preferences.detailLevel}`);
      if (um.preferences?.language)
        memParts.push(`- Preferowany język: ${um.preferences.language}`);
      if (um.expertise?.length > 0) memParts.push(`- Ekspertyza: ${um.expertise.join(', ')}`);
      if (um.recentTopics?.length > 0)
        memParts.push(`- Ostatnie tematy: ${um.recentTopics.join(', ')}`);
      if (um.interactionCount)
        memParts.push(`- Liczba dotychczasowych interakcji: ${um.interactionCount}`);
      if (memParts.length > 1) parts.push(memParts.join('\n'));
    }

    // 4.5b. Custom instructions (user-defined via AI preferences UI)
    if (ctx?.customInstructions) {
      parts.push(`## INSTRUKCJE UŻYTKOWNIKA (Custom Instructions)\n${ctx.customInstructions}`);
    }

    // 4.6. Organization memory (terminology, patterns)
    if (ctx?.orgMemory) {
      const om = ctx.orgMemory;
      const omParts: string[] = ['## PAMIĘĆ ORGANIZACJI'];
      if (om.aiMaturityStage) omParts.push(`- Etap dojrzałości AI: ${om.aiMaturityStage}`);
      if (om.terminology && Object.keys(om.terminology).length > 0) {
        const termEntries = Object.entries(om.terminology)
          .slice(0, 10)
          .map(([k, v]) => `  - "${k}" → "${v}"`)
          .join('\n');
        omParts.push(`- Terminologia organizacji:\n${termEntries}`);
      }
      if (om.decisionPatterns?.length > 0) {
        const pats = om.decisionPatterns
          .slice(0, 3)
          .map((p: any) => `  - ${p.type}: typowy wynik "${p.commonOutcome}" (${p.frequency}×)`)
          .join('\n');
        omParts.push(`- Wzorce decyzji:\n${pats}`);
      }
      if (omParts.length > 1) parts.push(omParts.join('\n'));
    }

    // 5. Pending approvals
    if (ctx?.pendingApprovals?.count > 0) {
      parts.push(this.buildPendingApprovalsSection(ctx.pendingApprovals));
    }

    // 5.5 Selected entity context (deep-loaded data for the item user is viewing)
    if (ctx?.selectedEntity) {
      parts.push(this.buildSelectedEntitySection(ctx.selectedEntity));
    }

    // 6. Screen context
    if (ctx?.currentScreen) {
      parts.push(this.buildScreenContextSection(ctx));
    }

    // 7. Knowledge context
    if (ctx?.knowledge && !ctx.knowledge.ragDisabled) {
      parts.push(this.buildKnowledgeSection(ctx.knowledge));
    }

    // 7.5 Assessment data
    if (ctx?.assessmentData) {
      parts.push(this.buildAssessmentSection(ctx.assessmentData));
    }

    // 7.6 Financial data
    if (ctx?.financialData) {
      parts.push(this.buildFinancialSection(ctx.financialData));
    }

    // 7.7 Historical patterns, RAID, decision memory
    if (ctx?.historicalPatterns) {
      parts.push(this.buildHistoricalSection(ctx.historicalPatterns));
    }

    // 7.8 Industry benchmarks (R9) — inject if assessment data exists
    if (ctx?.assessmentData?.axisScores && ctx?.organization) {
      try {
        const { industryBenchmarkService } = await import('./industryBenchmarkService.js');
        const industry = ctx.orgMemory?.industry || ctx.organization?.industry || 'manufacturing';
        const orgScores = ctx.assessmentData.axisScores.map((a: any) => ({
          axis: a.axis,
          score: a.asIs || a.current_score || 0,
        }));
        const benchmarkCtx = industryBenchmarkService.buildBenchmarkContext(industry, orgScores);
        if (benchmarkCtx) parts.push(benchmarkCtx);
      } catch {
        // Benchmark service not available — continue
      }
    }

    // 7.9 Knowledge graph context (R8) — inject entity intelligence
    if (ctx?.organization && request.organizationId) {
      try {
        const { knowledgeGraphService } = await import('./knowledgeGraphService.js');
        const graphCtx = await knowledgeGraphService.buildGraphContext(request.organizationId, 10);
        if (graphCtx) parts.push(graphCtx);
      } catch {
        // Knowledge graph not available — continue
      }
    }

    // 7.10 Help docs context (T071) — auto-inject KB docs for product/how-to questions
    if (request.prompt && !ctx?.external?.helpDocs) {
      try {
        const { isProductOrHowToQuery } = await import('./helpDocsContext.js');
        const userLang =
          ctx?.conversationLanguage || ctx?.userMemory?.preferences?.language || null;
        if (isProductOrHowToQuery(request.prompt, userLang === 'pl' ? 'pl' : 'en')) {
          const { buildHelpDocsContext } = await import('./helpDocsContext.js');
          const kbModuleId =
            String(ctx?.currentScreen || ctx?.screenContext?.screenId || '').trim() || null;
          const kb = await buildHelpDocsContext({
            query: request.prompt,
            language: userLang || undefined,
            moduleId: kbModuleId,
            maxArticles: 3,
            maxCharsPerArticle: 1200,
          });
          if (kb?.systemInstructionAddon?.trim()) {
            parts.push(kb.systemInstructionAddon);
          }
        }
      } catch {
        // Help docs context not available — continue
      }
    }

    // 8. Behavioral instructions
    parts.push(this.buildBehavioralInstructions(capability, ctx, request));

    return parts.filter(Boolean).join('\n\n');
  }

  private buildRoleSection(
    capability: AICapability,
    currentScreen?: string | null,
    language?: string | null
  ): string {
    // Use unified persona with screen-aware emphasis and language
    return buildPersonaPrompt(currentScreen, language);
  }

  private buildOrganizationSection(org: any): string {
    if (!org) return '';

    const lines = [
      '## ORGANIZACJA',
      `- Nazwa: ${org.organizationName || 'Nieznana'}`,
      org.industry ? `- Branża: ${org.industry}` : '',
      `- Aktywne projekty: ${org.activeProjectCount || 0}`,
      `- Poziom dojrzałości PMO: ${org.pmoMaturityLevel || 'BASIC'}`,
    ];

    // Inject organization terminology for consistent language
    if (org.terminology && Object.keys(org.terminology).length > 0) {
      lines.push('', '### Terminologia organizacji (używaj tych terminów):');
      for (const [term, definition] of Object.entries(org.terminology)) {
        lines.push(`- **${term}**: ${definition}`);
      }
    }

    // Inject org-level best practices / patterns
    if (org.orgPatterns && org.orgPatterns.length > 0) {
      lines.push('', '### Wzorce organizacyjne (learned from past projects):');
      for (const p of org.orgPatterns.slice(0, 3)) {
        lines.push(`- [${p.type}] ${p.title}: ${p.content}`);
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  private buildProjectSection(project: any): string {
    if (!project) return '';

    return `## AKTUALNY PROJEKT
- Nazwa: ${project.projectName}
- Faza: ${project.currentPhase} (${project.phaseNumber}/6)
- Inicjatywy: ${project.completedInitiatives || 0}/${project.initiativeCount || 0} ukończonych
- Status: ${project.roadmapStatus || 'W TOKU'}`;
  }

  private buildExecutionSection(execution: any): string {
    if (!execution) return '';

    const sections: string[] = ['## KONTEKST UŻYTKOWNIKA'];

    // User's tasks
    if (execution.userTasks && execution.userTasks.length > 0) {
      sections.push(`### Zadania użytkownika (${execution.userTasks.length}):`);
      const taskList = execution.userTasks.slice(0, 5).map((t: any) => {
        const dueInfo = t.dueDate
          ? ` [termin: ${new Date(t.dueDate).toLocaleDateString('pl-PL')}]`
          : '';
        return `- [${t.status}] ${t.title}${dueInfo}`;
      });
      sections.push(taskList.join('\n'));
      if (execution.userTasks.length > 5) {
        sections.push(`... i ${execution.userTasks.length - 5} więcej zadań`);
      }
    }

    // User's initiatives
    if (execution.userInitiatives && execution.userInitiatives.length > 0) {
      sections.push(`### Inicjatywy użytkownika (${execution.userInitiatives.length}):`);
      const initList = execution.userInitiatives
        .slice(0, 5)
        .map((i: any) => `- [${i.status}] ${i.name}`);
      sections.push(initList.join('\n'));
    }

    // Blockers
    if (execution.blockers && execution.blockers.length > 0) {
      sections.push(`### ⚠️ BLOKERY (${execution.blockers.length}):`);
      const blockerList = execution.blockers
        .slice(0, 3)
        .map((b: any) => `- ${b.type}: ${b.description}`);
      sections.push(blockerList.join('\n'));
    }

    // Pending decisions
    if (execution.pendingDecisions && execution.pendingDecisions.length > 0) {
      sections.push(`### Oczekujące decyzje (${execution.pendingDecisions.length}):`);
      const decisionList = execution.pendingDecisions.slice(0, 3).map((d: any) => `- ${d.title}`);
      sections.push(decisionList.join('\n'));
    }

    // Capacity status
    if (execution.capacityStatus) {
      const statusEmoji =
        execution.capacityStatus === 'HEALTHY'
          ? '✅'
          : execution.capacityStatus === 'WARNING'
            ? '⚠️'
            : '🔴';
      sections.push(`### Obciążenie: ${statusEmoji} ${execution.capacityStatus}`);
    }

    return sections.join('\n');
  }

  private buildPendingApprovalsSection(approvals: any): string {
    if (!approvals || approvals.count === 0) return '';

    const parts: string[] = [];
    if (approvals.summary) {
      parts.push(String(approvals.summary));
    }

    if (approvals.actions?.length > 0) {
      parts.push(
        '### Akcje',
        ...approvals.actions.slice(0, 5).map((a: any) => `- ${a.title || a.actionType || a.id}`)
      );
    }

    if (approvals.documents?.count > 0) {
      parts.push(
        '### Dokumenty wymagające zgody',
        ...(Array.isArray(approvals.documents.documents) ? approvals.documents.documents : [])
          .slice(0, 5)
          .map((d: any) => `- ${d.filename || d.id}`),
        'Aby dopuścić dokument do AI w tej rozmowie, zatwierdź dostęp (conversation-scoped).'
      );
    }

    return `## OCZEKUJĄCE ZATWIERDZENIA\n${parts.filter(Boolean).join('\n')}`;
  }

  private buildScreenContextSection(ctx: any): string {
    // Legacy screen hints (fallback)
    const screenHints: Record<string, string> = {
      initiatives:
        'Użytkownik przegląda inicjatywy - skup się na statusach, postępach i priorytetach.',
      roadmap: 'Użytkownik jest w widoku roadmapy - skup się na harmonogramie i zależnościach.',
      assessment:
        'Użytkownik jest w module oceny dojrzałości - skup się na lukach i rekomendacjach.',
      tasks: 'Użytkownik zarządza zadaniami - pomóż w priorytetyzacji i planowaniu.',
      dashboard:
        'Użytkownik jest na dashboardzie - daj przegląd sytuacji i proponuj kolejne kroki.',
      execution: 'Użytkownik jest w trybie realizacji - skup się na konkretnych działaniach.',
      discovery: 'Użytkownik jest w fazie discovery - pomóż zrozumieć kontekst biznesowy.',
      portfolio: 'Użytkownik przegląda portfolio projektów - daj perspektywę strategiczną.',
    };

    const screen = ctx.currentScreen?.toLowerCase() || '';

    // Try to use contextResponseMapper for enhanced context (v2.0)
    let contextGuidelines: string[] = [];
    try {
      const contextMapper = require('./contextResponseMapper.js');
      if (contextMapper?.buildContextPromptAdditions) {
        contextGuidelines = contextMapper.buildContextPromptAdditions(screen);
      }
    } catch {
      // Fallback to legacy hints
    }

    const hint = Object.entries(screenHints).find(([key]) => screen.includes(key))?.[1];

    if (!hint && !ctx.selectedObjectType && contextGuidelines.length === 0) return '';

    let section = `## KONTEKST EKRANU`;
    if (ctx.currentScreen) {
      section += `\n- Aktualny widok: ${ctx.currentScreen}`;
    }

    // Add enhanced context guidelines if available
    if (contextGuidelines.length > 0) {
      section += '\n### Wytyczne dla tego kontekstu:';
      for (const guideline of contextGuidelines.slice(0, 5)) {
        section += `\n- ${guideline}`;
      }
    } else if (hint) {
      section += `\n- ${hint}`;
    }

    if (ctx.selectedObjectType && ctx.selectedObjectId) {
      section += `\n- Wybrany element: ${ctx.selectedObjectType} (ID: ${ctx.selectedObjectId})`;
    }

    return section;
  }

  private buildKnowledgeSection(knowledge: any): string {
    if (!knowledge) return '';

    const sections: string[] = [];

    // Strategic directions
    if (knowledge.strategicDirections && knowledge.strategicDirections.length > 0) {
      sections.push(`### Kierunki strategiczne organizacji:`);
      knowledge.strategicDirections.slice(0, 3).forEach((s: any) => {
        sections.push(`- ${s.title}: ${s.description?.substring(0, 100) || ''}...`);
      });
    }

    // Previous decisions
    if (knowledge.previousDecisions && knowledge.previousDecisions.length > 0) {
      sections.push(`### Ostatnie decyzje w projekcie:`);
      knowledge.previousDecisions.slice(0, 3).forEach((d: any) => {
        sections.push(`- ${d.title}: ${d.outcome}`);
      });
    }

    if (sections.length === 0) return '';

    return `## WIEDZA KONTEKSTOWA\n${sections.join('\n')}`;
  }

  private buildSelectedEntitySection(entity: any): string {
    if (!entity?.data) return '';
    const d = entity.data;
    const type = entity.type;

    const sections: string[] = [`## WYBRANY ELEMENT: ${type.toUpperCase()}`];

    if (type === 'initiative') {
      sections.push(`- Nazwa: ${d.name}`);
      sections.push(`- Status: ${d.status} | Priorytet: ${d.priority}`);
      if (d.description) sections.push(`- Opis: ${d.description.slice(0, 300)}`);
      if (d.cost_capex) sections.push(`- CAPEX: ${d.cost_capex} | OPEX: ${d.cost_opex || 0}`);
      if (d.expected_roi) sections.push(`- Oczekiwany ROI: ${d.expected_roi}%`);
      if (d.estimated_duration_weeks)
        sections.push(`- Szacowany czas: ${d.estimated_duration_weeks} tygodni`);
      if (d.drd_axis) sections.push(`- Oś DRD: ${d.drd_axis} / ${d.drd_area || ''}`);
      if (d.kpis?.length > 0) {
        sections.push(`### KPI (${d.kpis.length}):`);
        d.kpis.slice(0, 5).forEach((k: any) => {
          sections.push(
            `  - ${k.name}: ${k.current_value || '?'}/${k.target_value} ${k.unit || ''}`
          );
        });
      }
      if (d.dependencies?.length > 0) {
        sections.push(
          `- Zależności: ${d.dependencies.length} (${d.dependencies.map((dep: any) => dep.depends_on_id).join(', ')})`
        );
      }
    } else if (type === 'task') {
      sections.push(`- Tytuł: ${d.title}`);
      sections.push(`- Status: ${d.status} | Priorytet: ${d.priority || 'N/A'}`);
      if (d.description) sections.push(`- Opis: ${d.description.slice(0, 200)}`);
      if (d.due_date) sections.push(`- Termin: ${d.due_date}`);
      if (d.progress !== undefined) sections.push(`- Postęp: ${d.progress}%`);
      if (d.recentComments?.length > 0) {
        sections.push(`### Ostatnie komentarze (${d.recentComments.length}):`);
        d.recentComments.slice(0, 3).forEach((c: any) => {
          sections.push(`  - ${c.content?.slice(0, 100)}`);
        });
      }
    } else if (type === 'assessment') {
      sections.push(`- Nazwa: ${d.name} (${d.framework})`);
      sections.push(`- Status: ${d.status} | Ukończenie: ${d.completion_percent}%`);
      if (d.overall_score) sections.push(`- Wynik ogólny: ${d.overall_score}`);
      if (d.topGaps?.length > 0) {
        sections.push(`### Top luki:`);
        d.topGaps.slice(0, 5).forEach((g: any) => {
          sections.push(`  - ${g.axis_name || g.axis_id}: gap = ${g.gap}`);
        });
      }
    } else if (type === 'decision') {
      sections.push(`- Tytuł: ${d.title}`);
      sections.push(`- Typ: ${d.type} | Status: ${d.status}`);
      if (d.description) sections.push(`- Opis: ${d.description.slice(0, 200)}`);
      if (d.deadline) sections.push(`- Deadline: ${d.deadline}`);
      if (d.options?.length > 0) {
        sections.push(`### Opcje (${d.options.length}):`);
        d.options.slice(0, 5).forEach((o: any) => {
          sections.push(
            `  - ${o.label || o.name || 'Opcja'}: ${(o.description || '').slice(0, 100)}`
          );
        });
      }
    }

    return sections.join('\n');
  }

  private buildAssessmentSection(data: any): string {
    if (!data) return '';
    const sections: string[] = ['## OCENA DOJRZAŁOŚCI CYFROWEJ'];
    sections.push(`- Assessment: ${data.name} (${data.framework})`);
    sections.push(`- Status: ${data.status} | Ukończenie: ${data.completionPercent || 0}%`);
    if (data.overallScore) sections.push(`- Wynik ogólny AS-IS: ${data.overallScore}`);
    if (data.overallTarget) sections.push(`- Cel TO-BE: ${data.overallTarget}`);
    if (data.overallGap) sections.push(`- Luka ogólna: ${data.overallGap}`);

    if (data.axisScores?.length > 0) {
      sections.push(`### Wyniki per oś:`);
      data.axisScores.forEach((a: any) => {
        const gapIndicator = a.gap > 1.5 ? ' ⚠️' : a.gap > 0.5 ? ' ↑' : '';
        sections.push(
          `  - ${a.axis}: AS-IS ${a.asIs} → TO-BE ${a.toBe} (gap: ${a.gap})${gapIndicator}`
        );
      });
    }

    if (data.topGaps?.length > 0) {
      sections.push(`### Największe luki:`);
      data.topGaps.forEach((g: any) => {
        sections.push(`  - ${g.axis}: gap ${g.gap}`);
      });
    }

    return sections.join('\n');
  }

  private buildFinancialSection(data: any): string {
    if (!data) return '';
    const sections: string[] = ['## ANALIZA FINANSOWA'];

    if (data.portfolio) {
      const p = data.portfolio;
      sections.push(`### Portfel inicjatyw (${p.initiativeCount}):`);
      if (p.totalCapex) sections.push(`- Łączny CAPEX: ${p.totalCapex.toLocaleString()}`);
      if (p.totalOpex) sections.push(`- Łączny OPEX: ${p.totalOpex.toLocaleString()}`);
      if (p.avgExpectedRoi)
        sections.push(`- Średni oczekiwany ROI: ${Math.round(p.avgExpectedRoi)}%`);
    }

    if (data.analysis) {
      const a = data.analysis;
      sections.push(`### Analiza finansowa:`);
      if (a.npv) sections.push(`- NPV: ${a.npv.toLocaleString()}`);
      if (a.irr) sections.push(`- IRR: ${a.irr}%`);
      if (a.roiPercentage) sections.push(`- ROI: ${a.roiPercentage}%`);
      if (a.paybackMonths) sections.push(`- Payback: ${a.paybackMonths} miesięcy`);
    }

    if (data.scenarios?.length > 0) {
      sections.push(`### Scenariusze:`);
      data.scenarios.forEach((s: any) => {
        sections.push(`  - ${s.type}: NPV ${s.npv?.toLocaleString() || '?'}, ROI ${s.roi || '?'}%`);
      });
    }

    return sections.join('\n');
  }

  private buildHistoricalSection(data: any): string {
    if (!data) return '';
    const sections: string[] = ['## WZORCE HISTORYCZNE'];

    if (data.initiativePatterns) {
      const p = data.initiativePatterns;
      sections.push(`### Inicjatywy organizacji:`);
      sections.push(
        `- Łącznie: ${p.total} | Ukończone: ${p.completed} | Anulowane: ${p.cancelled}`
      );
      sections.push(`- Success rate: ${p.successRate}%`);
      if (p.avgDurationWeeks)
        sections.push(`- Średni czas realizacji: ${p.avgDurationWeeks} tygodni`);
    }

    if (data.raidItems?.length > 0) {
      sections.push(`### Aktywne ryzyka/problemy (${data.raidItems.length}):`);
      data.raidItems.slice(0, 5).forEach((r: any) => {
        sections.push(`  - [${r.type}] ${r.title} — impact: ${r.impact}, status: ${r.status}`);
      });
    }

    if (data.decisionMemory?.length > 0) {
      sections.push(`### Pamięć decyzji:`);
      data.decisionMemory.slice(0, 3).forEach((d: any) => {
        sections.push(`  - Problem: ${d.problem} → Wybrano: ${d.chosen} → Wynik: ${d.outcome}`);
      });
    }

    return sections.join('\n');
  }

  private buildBehavioralInstructions(
    capability: AICapability,
    ctx: any,
    request: AIPipelineRequest
  ): string {
    const instructions: string[] = [
      '## INSTRUKCJE',
      '1. Odpowiadaj konkretnie i pomocnie, wykorzystując powyższy kontekst.',
      '1.1. Zasada jakości (CHAT): Nie odmawiaj tylko dlatego, że brakuje danych lub źródeł. Jeśli nie masz pewności: (a) podaj 2–5 hipotez, (b) zaznacz założenia, (c) zadaj maks. 3 pytania doprecyzowujące, (d) zaproponuj jak zweryfikować (np. wklejenie linku/fragmentu/plików).',
      '2. Jeśli użytkownik pyta o swoje zadania lub inicjatywy, odwołuj się do danych z sekcji KONTEKST UŻYTKOWNIKA.',
      '3. Proponuj konkretne działania bazując na aktualnym stanie pracy użytkownika.',
      '4. Jeśli są blokery lub problemy, proaktywnie oferuj pomoc w ich rozwiązaniu.',
      '5. MULTI-LANGUAGE SUPPORT: Twoją natywną funkcją jest obsługa 6 języków: polski (pl), angielski (en), niemiecki (de), hiszpański (es), arabski (ar), japoński (ja).',
      '6. Zawsze odpowiadaj w tym samym języku, w którym zwrócił się do Ciebie użytkownik. Jeśli użytkownik mówi po polsku, odpowiadaj po polsku. Jeśli po japońsku - po japońsku, itd.',
      '7. Dbaj o naturalność i poprawność językową w każdym z tych języków.',
    ];

    // Chat runtime modes (ToolsMenu)
    const aiModes = request.options?.aiModes || (ctx as any)?.aiModes;
    // Deep Thinking autonomy: never reference internal knowledge sources / system modules.
    const knowledgeSources =
      aiModes?.deepResearch === true
        ? undefined
        : request.options?.knowledgeSources || (ctx as any)?.knowledgeSources;
    const responseStyle = request.options?.responseStyle || (ctx as any)?.responseStyle;

    if (aiModes?.deepResearch) {
      instructions.push(
        '8. TRYB: Deep Research — zanim odpowiesz, doprecyzuj brakujące informacje i przedstaw uporządkowaną analizę, założenia oraz rekomendacje.'
      );
    }

    // Web search instruction — active when user toggle is on OR when auto-detected
    if (aiModes?.webSearch || (request as any)?.context?.external?.webSearch) {
      const hasWebResults = !!(request as any)?.context?.external?.webSearch?.results?.length;
      if (hasWebResults) {
        instructions.push(
          '9. TRYB: Web Search AKTYWNY — System dostarczył Ci wyniki wyszukiwania internetowego w sekcji "WEB SOURCES". Wykorzystaj je aktywnie:\n' +
            '   - Cytuj źródła inline jak [1], [2] gdy korzystasz z danych ze źródeł.\n' +
            '   - Jeśli źródła są sprzeczne, zaznacz to.\n' +
            '   - Preferuj najnowsze dane i źródła o wyższej wiarygodności.\n' +
            '   - Jeśli źródła nie wystarczają do pełnej odpowiedzi, uzupełnij swoją wiedzą ale zaznacz co pochodzi ze źródeł a co z Twojej wiedzy.'
        );
      } else {
        instructions.push(
          '9. TRYB: Web Search — wyszukiwanie jest włączone, ale w tym przypadku nie dostarczono wyników. Nie udawaj, że wykonałeś wyszukiwanie. Odpowiedz najlepiej jak potrafisz na podstawie swojej wiedzy, zaznaczając że odpowiedź nie jest oparta na najświeższych danych z internetu.'
        );
      }
    }

    if (aiModes?.showReasoning) {
      if (aiModes?.deepResearch) {
        instructions.push(
          '10. TRYB: Reasoning ON (Deep Thinking) — dodaj sekcję "Reasoning highlights" (3–6 punktów) z wysokopoziomowymi obserwacjami: kluczowe założenia, trade-offy, dlaczego rekomendacja ma sens. NIE używaj tagów <thinking> i NIE ujawniaj chain-of-thought.'
        );
      } else {
        instructions.push(
          '10. TRYB: Reasoning ON — PRZED odpowiedzią dodaj sekcję toku rozumowania w tagach <thinking>...</thinking>. ' +
            'Opisz w 3-8 punktach: jakie założenia przyjąłeś, jakie alternatywy rozważyłeś, ' +
            'dlaczego wybrałeś daną ścieżkę, i co mogłoby zmienić Twoją rekomendację. ' +
            'Bądź konkretny i merytoryczny. Nie ujawniaj danych wrażliwych.'
        );
      }
    } else {
      instructions.push('10. TRYB: Reasoning OFF — nie używaj tagów <thinking>...</thinking>.');
    }

    if (responseStyle) {
      const styleMap: Record<string, string> = {
        normal: 'Standardowy styl odpowiedzi (zbalansowany).',
        executive:
          'Styl Executive: zwięzły, decyzyjny, max 3-5 bulletów, zawsze z konkretną rekomendacją. Unikaj dygresji. Format: problem → analiza → rekomendacja.',
        analyst:
          'Styl Analyst: dane, metryki, porównania, tabele. Precyzyjny i oparty na faktach. Podawaj liczby, procenty, benchmarki. Używaj tabel i wykresów tam gdzie to możliwe.',
        coach:
          'Styl Coach: zadawaj pytania naprowadzające, tłumacz krok po kroku, buduj zrozumienie. Zamiast dawać gotowe odpowiedzi — prowadź użytkownika do samodzielnych wniosków.',
        concise: 'Styl zwięzły: tylko najważniejsze punkty, bez dygresji.',
        formal: 'Styl formalny: język urzędowy/biznesowy, precyzyjny i neutralny.',
        professional:
          'Styl Professional: odpowiadaj jak doświadczony konsultant strategiczny. Struktura: sytuacja → analiza → rekomendacja → następne kroki. Podawaj konkretne metryki i KPI. Odnoś się do frameworków (SWOT, Porter, BCG matrix, OKR). Język biznesowy, precyzyjny, z jasnym action planem i przypisaniem odpowiedzialności.',
        friendly:
          'Styl Friendly: odpowiadaj ciepło, luźno i przystępnie, jak dobry przyjaciel. Używaj prostego języka, emoji tam gdzie pasują, i bądź wspierający. Skracaj dystans, ale zachowaj merytorykę. Bądź entuzjastyczny i pozytywny.',
      };
      instructions.push(`11. Styl odpowiedzi: ${styleMap[responseStyle] || responseStyle}`);
    }

    if (knowledgeSources) {
      const enabled: string[] = [];
      if (knowledgeSources.pmoDocuments) enabled.push('pmoDocuments');
      if (knowledgeSources.projectData) enabled.push('projectData');
      if (knowledgeSources.organizationData) enabled.push('organizationData');
      if (enabled.length) {
        instructions.push(
          `12. Źródła wiedzy (preferowane): ${enabled.join(', ')}. Jeśli w kontekście brakuje danych, dopytaj użytkownika zamiast halucynować.`
        );
      }
    }

    // C8.3: Behavioral guardrails — prevent autonomous creation of entities
    instructions.push(
      '13. ZASADA BEZPIECZEŃSTWA: NIGDY nie twórz samodzielnie inicjatyw, zadań, decyzji ani kamieni milowych w systemie. ' +
        'Możesz jedynie PROPONOWAĆ ich utworzenie jako akcje do zatwierdzenia przez użytkownika. ' +
        'Każda modyfikacja danych w systemie wymaga jawnej zgody użytkownika. ' +
        'Możesz natomiast generować powiadomienia informacyjne i sugestie.'
    );

    // C8.2: Documentation/help awareness — AI knows the platform and can guide users
    instructions.push(
      '14. POMOC I DOKUMENTACJA: Znasz strukturę platformy Consultinity i jej moduły:\n' +
        '   - Assessment (DRD, SIRI, ADMA, CMMI, Lean) — ocena dojrzałości organizacji\n' +
        '   - Initiatives — zarządzanie inicjatywami transformacyjnymi\n' +
        '   - Execution — realizacja zadań, KPI, timeline\n' +
        '   - Portfolio — widok portfela inicjatyw, priorytetyzacja\n' +
        '   - Reports — generowanie raportów zarządczych\n' +
        '   - My Work — osobisty dashboard, zadania, decyzje, powiadomienia\n' +
        '   - Interview/Discovery — wywiady i narzędzia odkrywcze\n' +
        '   - Context Builder — profil organizacji, cele, wyzwania\n' +
        '   - Studio — zaawansowane narzędzia analityczne\n' +
        '   Gdy użytkownik pyta "jak coś zrobić" lub potrzebuje pomocy, wskaż mu odpowiedni moduł, ' +
        '   opisz kroki i zaproponuj nawigację (akcja navigate). ' +
        '   Możesz też sugerować najlepsze praktyki PMO i metodyki zarządzania projektami.'
    );

    // C8.1: Navigation capability — AI can propose navigation actions
    instructions.push(
      '15. NAWIGACJA: Możesz zaproponować użytkownikowi przejście do konkretnego modułu/ekranu. ' +
        'Dostępne widoki: chat, my-work, initiatives, portfolio, execution, roadmap, reports, ' +
        'assessment, interview, discovery-tools, implementation, roi, economics, kpi-okr, benefits, ' +
        'studio, admin, settings, project-intelligence, context, rollout. ' +
        'Gdy użytkownik pyta o konkretną inicjatywę, zadanie lub moduł, zaproponuj nawigację.'
    );

    // C4.1: Attachment analysis — AI should reference uploaded files
    if (ctx?.attachments?.length > 0 || ctx?.attachmentFileNames?.length > 0) {
      const fileNames =
        ctx.attachmentFileNames || ctx.attachments?.map((a: any) => a.filename) || [];
      instructions.push(
        `16. ZAŁĄCZNIKI: Użytkownik dołączył pliki: ${fileNames.join(', ')}. ` +
          'Przeanalizuj ich zawartość (dostarczoną przez system RAG) i odwołuj się do nich w odpowiedzi. ' +
          'Cytuj konkretne fragmenty z plików gdy to istotne. Wskaż nazwy plików w odpowiedzi.'
      );
    }

    // Add context-specific instructions
    if (ctx?.execution?.capacityStatus === 'OVERLOADED') {
      instructions.push(
        '17. ⚠️ Użytkownik jest przeciążony - sugeruj priorytetyzację i delegowanie zadań.'
      );
    }

    if (ctx?.execution?.blockers?.length > 0) {
      instructions.push('17. Są aktywne blokery - zaoferuj pomoc w ich rozwiązaniu.');
    }

    if (ctx?.pendingApprovals?.count > 0) {
      instructions.push(
        `17. Użytkownik ma ${ctx.pendingApprovals.count} oczekujących akcji AI do przejrzenia.`
      );
    }

    // Response format hint
    if (capability.outputFormat === 'json') {
      instructions.push('18. Odpowiedz w formacie JSON.');
    }

    return instructions.join('\n');
  }

  private async selectModel(
    request: AIPipelineRequest,
    capability: AICapability
  ): Promise<{
    provider: string;
    model: string;
    maxTokens: number;
    endpoint?: string | null;
    apiKey?: string | null;
  }> {
    // 1) Explicit overrides from request options (user-selected model or direct provider/model)
    const selectedTier = request.options?.selectedTier;
    const explicitModel = request.options?.selectedModelId || request.options?.model;
    const explicitProvider = request.options?.provider;

    if (explicitModel) {
      // Fast-path for local inference: user-provided Ollama does not require a DB provider row.
      if (String(explicitProvider || '').toLowerCase() === 'ollama') {
        const endpointOverride = (request.options as any)?.endpoint as string | undefined;
        const endpoint = endpointOverride || 'http://localhost:11434/v1';
        logger.info(`[AIPipeline] Selected explicit model (local): ollama/${explicitModel}`);
        return {
          provider: 'ollama',
          model: explicitModel,
          maxTokens: request.options?.maxTokens || capability.maxTokens,
          endpoint,
          apiKey: null,
        };
      }

      // If provider not provided, let ModelRouter infer provider & resolve endpoint/apiKey.
      const tierForConfig = (selectedTier || 'STANDARD') as any;
      const cfg = await modelRouter.getProviderConfig(explicitModel, tierForConfig);
      const provider = explicitProvider || cfg.provider;
      const endpointOverride = (request.options as any)?.endpoint as string | undefined;
      const isOllama = String(provider || '').toLowerCase() === 'ollama';
      const endpoint = isOllama
        ? endpointOverride || cfg.endpoint || 'http://localhost:11434/v1'
        : cfg.endpoint;

      logger.info(`[AIPipeline] Selected explicit model: ${provider}/${cfg.id}`);
      return {
        provider,
        model: cfg.id,
        maxTokens: request.options?.maxTokens || capability.maxTokens,
        endpoint,
        apiKey: cfg.apiKey,
      };
    }

    // 2) Dynamic routing by tier/capability
    const routingCapability = request.capability === 'chatStream' ? 'chat' : request.capability;
    const routed = await modelRouter.select({
      capability: routingCapability,
      organizationId: request.organizationId,
      options: { tier: selectedTier },
      tier: selectedTier,
    } as any);

    logger.info(
      `[AIPipeline] Routed model: ${routed.provider}/${routed.id} (tier: ${routed.tier})`
    );

    return {
      provider: routed.provider,
      model: routed.id,
      maxTokens: request.options?.maxTokens || capability.maxTokens,
      endpoint: routed.endpoint,
      apiKey: routed.apiKey,
    };
  }

  private async executeWithProvider(
    messages: ChatMessage[],
    modelConfig: {
      provider: string;
      model: string;
      maxTokens: number;
      endpoint?: string | null;
      apiKey?: string | null;
    },
    options?: AIOptions
  ): Promise<{
    content: string;
    artifacts?: AIArtifact[];
    usage?: TokenUsage;
    cached?: boolean;
  }> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const callOnce = async (cfg: {
      provider: string;
      model: string;
      endpoint?: string | null;
      apiKey?: string | null;
    }) => {
      const response = await llmService.call({
        type: 'chat',
        modelConfig: {
          provider: cfg.provider,
          id: cfg.model,
          endpoint: cfg.endpoint || undefined,
          apiKey: cfg.apiKey || undefined,
        },
        systemPrompt: systemMessage?.content || '',
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
        })),
        maxTokens: modelConfig.maxTokens,
        temperature: options?.temperature ?? 0.7,
        cache: (options as any)?.cache ?? true,
      });

      return {
        content: (response as { content?: string }).content || String(response),
        usage: (response as { usage?: TokenUsage }).usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        cached: false,
      };
    };

    try {
      return await callOnce(modelConfig);
    } catch (primaryError: any) {
      const primaryMsg = String(primaryError?.message || primaryError || '');
      logger.warn(
        `[AIPipeline] Primary provider failed (${modelConfig.provider}/${modelConfig.model}): ${primaryMsg.slice(0, 200)}`
      );

      const tierForFallback = ((options as any)?.selectedTier || 'STANDARD') as any;
      const fallbackChain: string[] =
        typeof (modelRouter as any).getFallbackChain === 'function'
          ? ((modelRouter as any).getFallbackChain(tierForFallback) as string[])
          : [];

      const candidateModelIds = Array.from(new Set(fallbackChain.filter(Boolean))) as string[];

      let lastError: Error | null = primaryError as Error;
      for (const candidateModelId of candidateModelIds) {
        if (candidateModelId === modelConfig.model) continue;
        try {
          const cfg = await modelRouter.getProviderConfig(candidateModelId, tierForFallback);
          const providerId = String((cfg as any)?.provider || '');
          const modelId = String((cfg as any)?.id || candidateModelId);
          const apiKey = (cfg as any)?.apiKey;
          const endpoint = (cfg as any)?.endpoint;

          const isConfigured =
            providerId.toLowerCase() === 'ollama' ||
            (typeof apiKey === 'string' && apiKey.trim().length > 0);
          if (!isConfigured) continue;

          logger.info(`[AIPipeline] Attempting fallback: ${providerId}/${modelId}`);
          return await callOnce({ provider: providerId, model: modelId, endpoint, apiKey });
        } catch (fbError: any) {
          lastError = fbError as Error;
          const fbMsg = String(fbError?.message || fbError || '');
          logger.warn(`[AIPipeline] Fallback failed (${candidateModelId}): ${fbMsg.slice(0, 200)}`);
        }
      }

      logger.error(`[AIPipeline] Provider execution failed after fallbacks: ${primaryMsg}`);
      throw lastError || primaryError;
    }
  }

  private async executeStreamingWithProvider(
    messages: ChatMessage[],
    modelConfig: {
      provider: string;
      model: string;
      maxTokens: number;
      endpoint?: string | null;
      apiKey?: string | null;
    },
    options: AIOptions | undefined,
    onChunk: StreamCallback
  ): Promise<void> {
    try {
      const systemMessage = messages.find((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      const response = await llmService.callStream({
        type: 'chat',
        modelConfig: {
          provider: modelConfig.provider,
          id: modelConfig.model,
          endpoint: modelConfig.endpoint || undefined,
          apiKey: modelConfig.apiKey || undefined,
        },
        systemPrompt: systemMessage?.content || '',
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
        })),
        maxTokens: modelConfig.maxTokens,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      });

      const stream = (response as { stream?: AsyncIterable<string> }).stream;
      if (stream) {
        for await (const chunk of stream) {
          onChunk({
            type: 'text',
            content: chunk,
          });
        }
      }
    } catch (error: any) {
      logger.error(`[AIPipeline] Streaming execution failed: ${error.message}`);
      onChunk({
        type: 'error',
        content: error.message,
      });
    }
  }

  private async postProcess(
    response: {
      content: string;
      artifacts?: AIArtifact[];
      thinkingSteps?: ThinkingStep[];
      usage?: TokenUsage;
      cached?: boolean;
    },
    _capability: AICapability
  ): Promise<typeof response> {
    // Enhance response with extracted artifacts and thinking steps
    return enhanceResponse(response as any) as any;
  }

  private async logRequest(
    request: AIPipelineRequest,
    _response: { content: string; usage?: TokenUsage },
    latency: number,
    traceId: string
  ): Promise<void> {
    const meta = {
      traceId,
      capability: request.capability,
      promptKey:
        (request.options as any)?.promptKey ||
        (request as any)?._promptKey ||
        (request as any)?.promptKey ||
        null,
      promptVersion: (request as any)?._promptVersion ?? null,
      promptSsotUsed: (request as any)?._promptSsotUsed ?? false,
    };

    logger.info(`[AI Pipeline] ${request.capability} completed in ${latency}ms (trace: ${traceId})`, meta);

    // Best-effort DB-backed usage log (208_ai_usage_logs.sql).
    // Never fail the request if logging is unavailable.
    try {
      const { run: dbRun } = await import('../../utils/DbPromise.js');
      const { v4: uuidv4 } = await import('uuid');

      const usage = _response?.usage || ({} as any);
      const promptTokens = Number(usage?.promptTokens || 0);
      const completionTokens = Number(usage?.completionTokens || 0);
      const tokensUsed = Number(usage?.totalTokens || usage?.tokensUsed || promptTokens + completionTokens || 0);

      const usedProvider =
        (request as any)?._modelConfigForLog?.provider ||
        (request as any)?._provider ||
        'unknown';
      const usedModel =
        (request as any)?._modelConfigForLog?.model ||
        (request as any)?._model ||
        null;

      await dbRun(
        `INSERT INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, status, error_message, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', NULL, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          request.userId || null,
          request.organizationId || null,
          String(usedProvider || 'unknown'),
          usedModel ? String(usedModel) : null,
          String(request.capability || 'unknown'),
          Number.isFinite(promptTokens) ? promptTokens : 0,
          Number.isFinite(completionTokens) ? completionTokens : 0,
          Number.isFinite(tokensUsed) ? tokensUsed : 0,
          Number.isFinite(latency) ? latency : 0,
          JSON.stringify({
            traceId,
            promptKey: (request.options as any)?.promptKey || (request as any)?._promptKey || null,
            promptVersion: (request as any)?._promptVersion || null,
            promptSsotUsed: (request as any)?._promptSsotUsed || false,
          }),
        ]
      );
    } catch {
      // ignore
    }
  }

  private async logError(
    request: AIPipelineRequest,
    error: AIError,
    _latency: number,
    traceId: string
  ): Promise<void> {
    logger.error(
      `[AI Pipeline] ${request.capability} failed: ${error.message} (trace: ${traceId})`
    );
  }

  private handleError(error: unknown): AIError {
    if (error instanceof Error) {
      return {
        code: 'AI_ERROR',
        message: error.message,
        retryable: true,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      retryable: false,
    };
  }

  private generateTraceId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const aiPipeline = AIPipeline.getInstance();
export default aiPipeline;

export {
  type AIArtifact,
  type AIPipelineRequest,
  type AIPipelineResponse,
  CAPABILITY_REGISTRY,
  type StreamCallback,
  type ThinkingStep,
};

/**
 * Extract artifacts from AI response content
 */
export function extractArtifacts(content: string): {
  cleanContent: string;
  artifacts: AIArtifact[];
} {
  if (!content) return { cleanContent: '', artifacts: [] };

  const artifacts: AIArtifact[] = [];
  const processedPositions = new Set<number>();

  // Pattern for artifact blocks with language: ```artifact:type:language:title\ncontent\n```
  const artifactPatternWithLang = /```artifact:(\w+):(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = artifactPatternWithLang.exec(content)) !== null) {
    const [, type, language, title, artifactContent] = match;
    processedPositions.add(match.index);
    artifacts.push({
      id: `art-${Math.random().toString(36).substring(2, 9)}`,
      type: type as any,
      title: title.trim(),
      content: artifactContent.trim(),
      language,
    });
  }

  // Pattern for artifact blocks without language: ```artifact:type:title\ncontent\n```
  const artifactPattern = /```artifact:(\w+):([^\n]+)\n([\s\S]*?)```/g;

  while ((match = artifactPattern.exec(content)) !== null) {
    if (processedPositions.has(match.index)) continue;

    const [, type, title, artifactContent] = match;
    processedPositions.add(match.index);
    artifacts.push({
      id: `art-${Math.random().toString(36).substring(2, 9)}`,
      type: type as any,
      title: title.trim(),
      content: artifactContent.trim(),
    });
  }

  // Also check for JSON artifact definitions
  const jsonPattern = /```json:artifact\n([\s\S]*?)```/g;
  while ((match = jsonPattern.exec(content)) !== null) {
    try {
      const artifactDef = JSON.parse(match[1]);
      if (artifactDef.type && artifactDef.content) {
        artifacts.push({
          id: artifactDef.id || `art-${Math.random().toString(36).substring(2, 9)}`,
          type: artifactDef.type,
          title: artifactDef.title || 'Untitled',
          content: artifactDef.content,
          ...artifactDef,
        });
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  // Also extract substantial regular code blocks (>100 chars)
  const regularCodeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
  while ((match = regularCodeBlockPattern.exec(content)) !== null) {
    if (processedPositions.has(match.index)) continue;

    const [, language, codeContent] = match;
    if (codeContent.length > 100) {
      processedPositions.add(match.index);
      artifacts.push({
        id: `art-${Math.random().toString(36).substring(2, 9)}`,
        type: 'code',
        title: 'Code Snippet',
        content: codeContent.trim(),
        language: language || 'text',
      });
    }
  }

  // Remove artifacts from content
  const cleanContent = content
    .replace(artifactPatternWithLang, '')
    .replace(artifactPattern, '')
    .replace(jsonPattern, '')
    .trim();

  return { cleanContent, artifacts };
}

/**
 * Extract thinking steps from AI response content
 */
export function extractThinkingSteps(content: string): {
  cleanContent: string;
  thinkingSteps: ThinkingStep[];
} {
  if (!content) return { cleanContent: '', thinkingSteps: [] };

  const thinkingSteps: ThinkingStep[] = [];
  let stepId = 1;

  // Pattern for <thinking>...</thinking> blocks
  const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/gi;

  let match;
  while ((match = thinkingPattern.exec(content)) !== null) {
    const thinkingContent = match[1].trim();

    // Split into individual steps if numbered or bulleted
    const stepLines = thinkingContent.split(/\n(?=\d+\.|[-*•])/);

    stepLines.forEach((line) => {
      const cleanLine = line.replace(/^\d+\.\s*|^[-*•]\s*/, '').trim();
      if (cleanLine) {
        thinkingSteps.push({
          id: `think-${stepId++}`,
          label: `Step ${thinkingSteps.length + 1}`,
          content: cleanLine,
          status: 'done',
          timestamp: new Date(),
          category: categorizeThinkingStep(cleanLine),
        });
      }
    });
  }

  // Remove thinking blocks from content
  const cleanContent = content.replace(thinkingPattern, '').trim();

  return { cleanContent, thinkingSteps };
}

function categorizeThinkingStep(stepContent: string): ThinkingStep['category'] {
  const lower = stepContent.toLowerCase();
  if (lower.includes('analyz') || lower.includes('examin') || lower.includes('assess'))
    return 'analysis';
  if (
    lower.includes('search') ||
    lower.includes('look') ||
    lower.includes('find') ||
    lower.includes('research')
  )
    return 'research';
  if (
    lower.includes('combin') ||
    lower.includes('integrat') ||
    lower.includes('synthesiz') ||
    lower.includes('creat')
  )
    return 'synthesis';
  if (
    lower.includes('verify') ||
    lower.includes('check') ||
    lower.includes('valid') ||
    lower.includes('confirm')
  )
    return 'validation';
  return 'analysis';
}

/**
 * Enhance AI response with extracted artifacts and thinking steps
 */
export function enhanceResponse<
  T extends { content: string; artifacts?: AIArtifact[]; thinkingSteps?: ThinkingStep[] },
>(response: T): T {
  if (!response.content) return response;

  const { cleanContent: contentAfterThinking, thinkingSteps } = extractThinkingSteps(
    response.content
  );
  const { cleanContent, artifacts } = extractArtifacts(contentAfterThinking);

  return {
    ...response,
    content: cleanContent,
    artifacts:
      artifacts.length > 0 ? [...(response.artifacts || []), ...artifacts] : response.artifacts,
    thinkingSteps:
      thinkingSteps.length > 0
        ? [...(response.thinkingSteps || []), ...thinkingSteps]
        : response.thinkingSteps,
  };
}
