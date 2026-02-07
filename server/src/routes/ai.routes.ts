/**
 * AI Routes
 * Complete AI API - Enterprise PMO Brain
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  ActionIdParamSchema,
  ActionTypeParamSchema,
  AIContextQuerySchema,
  ApproveActionRequestSchema,
  AuditIdParamSchema,
  CalculateQualityRequestSchema,
  CanPerformActionQuerySchema,
  ChatConfirmRequestSchema,
  ChatRequestSchema,
  ChatStreamRequestSchema,
  CreateDraftRequestSchema,
  ExportExplanationsQuerySchema,
  GenerateProposalsQuerySchema,
  GetAggregateQualityQuerySchema,
  GetAuditLogsQuerySchema,
  GetCurrentMemoryQuerySchema,
  GetExplanationsQuerySchema,
  GetMemoryLatencyQuerySchema,
  GetMemoryMetricsQuerySchema,
  GetPatternsQuerySchema,
  GetPendingActionsQuerySchema,
  GetQualityTrendsQuerySchema,
  GetSuggestionMetricsQuerySchema,
  GetSuggestionsQuerySchema,
  InitiativeConflictsRequestSchema,
  InitiativePrioritiesRequestSchema,
  PatternIdParamSchema,
  PostSuggestionsRequestSchema,
  ProjectIdParamSchema,
  RecommendRequestSchema,
  RecordAuditDecisionRequestSchema,
  RecordDecisionRequestSchema,
  RecordFeedbackRequestSchema,
  RecordSuggestionActionRequestSchema,
  RejectActionRequestSchema,
  ReportMessageRequestSchema,
  RoadmapRequestSchema,
  SessionIdParamSchema,
  ToggleAutoApplyRequestSchema,
  UpdatePolicyRequestSchema,
  UpdateUserPreferencesRequestSchema,
} from '../validators/ai.validators.js';

const router = Router();

// Apply rate limiting to all AI routes
router.use(aiRateLimiter);

// Lazy load services to avoid circular dependencies

const getAIContextBuilder = async () =>
  (await import('../services/aiContextBuilder.js')).default as any;
const getAIPolicyEngine = async () =>
  (await import('../services/aiPolicyEngine.js')).default as any;
const getAIMemoryManager = async () =>
  (await import('../services/aiMemoryManager.js')).default as any;
const getAIOrchestrator = async () =>
  (await import('../services/aiOrchestrator.js')).default as any;
const getAIActionExecutor = async () =>
  (await import('../services/aiActionExecutor.js')).default as any;
const getAIAuditLogger = async () => (await import('../services/aiAuditLogger.js')).default as any;
const getAIPipeline = async () => {
  const { AIPipeline } = (await import('../services/ai/aiPipeline.js')) as any;
  return new AIPipeline();
};

// ==================== CONTEXT ====================

router.get(
  '/context',
  verifyToken,
  validateQuery(AIContextQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIContextBuilder = await getAIContextBuilder();
      const context = await AIContextBuilder.buildContext(
        req.userId as string,
        req.organizationId as string,
        null,
        { currentScreen: (req.query as any).screen as string | undefined }
      );
      return res.json(context);
    } catch (err: any) {
      const error = err as Error;
      return res.status(500).json({ error: error.message });
    }
  })
);

router.get(
  '/context/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateQuery(AIContextQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIContextBuilder = await getAIContextBuilder();
      const context = await AIContextBuilder.buildContext(
        req.userId as string,
        req.organizationId as string,
        req.params.projectId,
        { currentScreen: (req.query as any).screen as string | undefined }
      );
      return res.json(context);
    } catch (err: any) {
      const error = err as Error;
      return res.status(500).json({ error: error.message });
    }
  })
);

// ==================== CHAT ====================

/**
 * Deep Thinking: Confirm Understanding (blocking gate)
 *
 * Returns a decision-ready paraphrase of the user's task + minimal questions/gaps
 * before running expensive Deep Thinking / research.
 */
router.post(
  '/chat/confirm',
  verifyToken,
  validateBody(ChatConfirmRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      message: string;
      history?: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }>;
      systemInstruction?: string;
      context?: Record<string, unknown>;
      roleName?: string;
      language?: string;
      conversationId?: string;
      projectId?: string;
      screenContext?: Record<string, unknown>;
      focusMode?: string;
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
      aiModes?: { deepResearch?: boolean; webSearch?: boolean; showReasoning?: boolean };
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?: 'normal' | 'learning' | 'concise' | 'explanatory' | 'formal';
    };

    const {
      message,
      history,
      systemInstruction,
      context,
      roleName,
      language,
      selectedTier,
      selectedModelId,
      aiModes,
      knowledgeSources,
      responseStyle,
      projectId: bodyProjectId,
      screenContext: bodyScreenContext,
      focusMode: bodyFocusMode,
    } = body;

    // Fast-fail when no LLM provider is configured (dev UX parity with stream)
    const hasEnvProvider =
      !!process.env.OPENAI_API_KEY ||
      !!process.env.GEMINI_API_KEY ||
      !!process.env.GOOGLE_AI_API_KEY ||
      !!process.env.ANTHROPIC_API_KEY ||
      !!process.env.MISTRAL_API_KEY;

    if (!hasEnvProvider) {
      return res.status(500).json({
        error:
          'No LLM provider configured on the backend. Set OPENAI_API_KEY or GEMINI_API_KEY (or configure providers in llm_providers).',
        code: 'NO_LLM_PROVIDER',
      });
    }

    // Access policy enforcement (same semantics as streaming)
    const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
    const aiAccessCheck = await AccessPolicyService.checkAccess(req.organizationId!, 'ai_call');
    if (!aiAccessCheck.allowed) {
      return res.status(403).json({
        error: aiAccessCheck.reason || 'Access blocked',
        code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
      });
    }

    // Count the AI call (confirm is a real model call)
    AccessPolicyService.incrementUsage(req.organizationId!, 'ai_calls', 1).catch((err: any) => {
      logger.warn('[AI Confirm] Failed to increment ai_calls usage:', err?.message || err);
    });

    // Language instruction (keep behavior consistent with stream)
    const languageMap: Record<string, string> = {
      pl: 'Polish (Polski)',
      en: 'English',
      de: 'German (Deutsch)',
      es: 'Spanish (Español)',
      ja: 'Japanese (日本語)',
      ar: 'Arabic (العربية)',
    };
    const langCode = (language || 'pl').split('-')[0];
    const langName = languageMap[langCode] || languageMap['pl'];
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: Always respond in ${langName}.]\n`;

    // Confirm schema (structured output)
    // NOTE: OpenAI Structured Outputs requires ALL properties to be in 'required' array.
    // All fields must be required (no .optional() or .default()) for OpenAI compatibility.
    const ConfirmSchema = z.object({
      understanding: z.object({
        goal: z.string().describe('The main goal or objective of the user request'),
        context: z.string().describe('Additional context about the request'),
        constraints: z.array(z.string()).describe('Any constraints or limitations'),
        expectedOutput: z
          .enum(['Decision', 'StructuredAnalysis', 'FullReport'])
          .describe('The type of output expected'),
        decisionHorizon: z.string().describe('Time horizon for the decision'),
      }),
      isClearEnoughToProceed: z
        .boolean()
        .describe('Whether the request is clear enough to proceed'),
      missingInfoQuestions: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the question'),
            question: z.string().describe('The question to ask'),
            whyItMatters: z.string().describe('Why this question is important'),
          })
        )
        .describe('Questions to clarify missing information'),
      researchPlanItems: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the research item'),
            type: z
              .enum(['ConceptualFrameworks', 'PriorPatterns', 'UserInputs', 'ExternalReferences'])
              .describe('Type of research'),
            label: z.string().describe('Label for the research item'),
            rationale: z.string().describe('Why this research is needed'),
          })
        )
        .describe('Planned research items'),
      suggestedDepth: z.enum(['Light', 'Standard', 'Hard']).describe('Suggested depth of analysis'),
    });

    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { modelMeetsRequirements } = await import('../services/ai/modelCapabilities.js');
    const { llmService } = await import('../services/ai/llmService.js');

    // Select a model that supports Structured Outputs (JSON Schema).
    // This is a hard contract requirement for the confirm step.
    const tier = (selectedTier || 'BUDGET') as any;
    const requirements = { structured_outputs: true as const };

    let modelCfg: any = null;
    if (selectedModelId) {
      try {
        const cfg = await modelRouter.getProviderConfig(selectedModelId, tier);
        if (modelMeetsRequirements(cfg.id, requirements)) {
          modelCfg = cfg;
        }
      } catch {
        // ignore
      }
    }

    if (!modelCfg) {
      modelCfg = await modelRouter.select({
        capability: 'chat_confirm',
        organizationId: req.organizationId,
        tier,
        requirements,
      } as any);
    }

    logger.info('[AI Confirm] Using model:', modelCfg.id, 'provider:', modelCfg.provider);

    const compactHistory = (history || []).slice(-8).map((m) => ({
      role: m.role === 'model' ? 'assistant' : (m.role as any),
      content: (m as any).parts?.[0]?.text || m.content || '',
    }));

    const focusMode = (context as any)?.focusMode || bodyFocusMode || 'all';
    const projectId = (context as any)?.projectId || bodyProjectId || null;
    const screenContext = (context as any)?.screenContext || bodyScreenContext || null;

    const sys = [
      (systemInstruction || '') + languageInstruction,
      'You are running Deep Thinking Mode – Confirm Understanding.',
      'Your ONLY job is to paraphrase the task into a decision-ready framing and list minimal gaps/questions.',
      'Do NOT provide solutions yet. Do NOT start analysis. Be concise.',
      'Return ONLY valid JSON matching the provided schema.',
    ].join('\n');

    const user = [
      `User task: ${message}`,
      '',
      `Context hints (may be empty):`,
      `- focusMode: ${String(focusMode)}`,
      `- projectId: ${String(projectId)}`,
      `- hasScreenContext: ${screenContext ? 'yes' : 'no'}`,
      `- aiModes: ${JSON.stringify(aiModes || {})}`,
      `- knowledgeSources: ${JSON.stringify(knowledgeSources || {})}`,
      `- responseStyle: ${String(responseStyle || 'normal')}`,
    ].join('\n');

    logger.info(
      '[AI Confirm] Calling LLM with model:',
      modelCfg.id,
      'provider:',
      modelCfg.provider
    );
    logger.info(
      '[AI Confirm] History length:',
      compactHistory.length,
      'User prompt length:',
      user.length
    );

    let result: any;
    try {
      result = (await llmService.callStructured({
        type: 'chat',
        modelConfig: {
          provider: modelCfg.provider,
          id: modelCfg.id,
          endpoint: (modelCfg as any).endpoint,
          apiKey: (modelCfg as any).apiKey,
        },
        systemPrompt: sys,
        messages: [
          ...compactHistory.filter((m) => m.content && String(m.content).trim().length > 0),
          { role: 'user', content: user },
        ],
        schema: ConfirmSchema,
      } as any)) as any;
    } catch (llmError: any) {
      logger.error('[AI Confirm] LLM call failed:', llmError?.message || llmError);
      logger.error('[AI Confirm] LLM error stack:', llmError?.stack);
      throw llmError;
    }

    logger.info('[AI Confirm] LLM call succeeded, returning result');

    return res.json({
      confirm: result.object,
      metadata: {
        provider: modelCfg.provider,
        model: modelCfg.id,
        projectId,
        focusMode,
      },
    });
  })
);

router.post(
  '/chat/stream',
  verifyToken,
  validateBody(ChatStreamRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      message: string;
      history?: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }>;
      systemInstruction?: string;
      context?: Record<string, unknown>;
      roleName?: string;
      language?: string;
      conversationId?: string;
      resumeFromPartial?: boolean;
      // Extended AI chat configuration (ToolsMenu + routing)
      projectId?: string;
      screenContext?: Record<string, unknown>;
      focusMode?: string;
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
      aiModes?: {
        deepResearch?: boolean;
        webSearch?: boolean;
        showReasoning?: boolean;
      };
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?: 'normal' | 'learning' | 'concise' | 'explanatory' | 'formal';
    };

    const {
      message,
      history,
      systemInstruction,
      context,
      roleName,
      language,
      conversationId,
      resumeFromPartial,
      projectId: bodyProjectId,
      screenContext: bodyScreenContext,
      focusMode: bodyFocusMode,
      selectedTier,
      selectedModelId,
      aiModes,
      knowledgeSources,
      responseStyle,
    } = body;

    // Detect "force depth" triggers (user control). These must cause a real structure change.
    const rawMsg = String(message || '').trim();
    const forceDepthTriggers = [
      'go deeper',
      'too shallow',
      'challenge this conclusion',
      // Polish
      'idź głębiej',
      'za płytkie',
      'podważ wnioski',
      'podważ tę konkluzję',
      'podważ tę rekomendację',
    ];
    const forceDepthTrigger = forceDepthTriggers.find((t) => t === rawMsg.toLowerCase());

    // Deep Thinking determinism: enforce Confirm gate server-side (not just UI).
    if (aiModes?.deepResearch) {
      const confirmed = Boolean((context as any)?.deepThinkingConfirmed);
      if (!confirmed) {
        return res.status(400).json({
          error:
            'Deep Thinking requires Confirm Understanding first. Call /api/ai/chat/confirm and then retry with context.deepThinkingConfirmed=true.',
          code: 'DEEP_THINKING_CONFIRM_REQUIRED',
        });
      }
    }

    const streamSessionId = conversationId || `stream-${req.userId}-${Date.now()}`;
    let accumulatedContent = '';
    let lastSaveTime = Date.now();
    let isClientConnected = true;
    let streamAborted = false;
    let streamCompleted = false;
    let deepThinkingStartedLogged = false;

    const languageMap: Record<string, string> = {
      pl: 'Polish (Polski)',
      en: 'English',
      de: 'German (Deutsch)',
      es: 'Spanish (Español)',
      ja: 'Japanese (日本語)',
      ar: 'Arabic (العربية)',
    };
    const langName = languageMap[language || 'pl'] || languageMap['pl'];
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: Always respond in ${langName}. This is critical - the user's interface is set to ${langName}, so ALL your responses MUST be in ${langName}.]\n`;

    const enhancedSystemInstruction = (systemInstruction || '') + languageInstruction;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Stream-Session-Id', streamSessionId);
    res.flushHeaders();

    // --------------------------------------------------------------------
    // E2E_MODE: deterministic streaming for runtime tests (CI + Playwright)
    // --------------------------------------------------------------------
    // - Emits SSE chunks in the same format the frontend expects
    // - Persists conversation + messages so History / DB are verifiable
    if (process.env.E2E_MODE === 'true') {
      const assistantFull = `E2E_OK: Received "${message}".`;

      try {
        // Stream assistant response in chunks
        const chunks = ['E2E_OK: ', `Received "${message}"`, '.'];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          accumulatedContent += chunk;
        }

        res.write('data: [DONE]\n\n');

        return res.end();
      } catch (e: any) {
        res.write(
          `data: ${JSON.stringify({
            error: `E2E stream failed: ${e?.message || String(e)}`,
            code: 'E2E_STREAM_ERROR',
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    const connectionCleanup = () => {
      // `close` also fires on normal completion; avoid logging abort in that case.
      if (streamCompleted) return;
      isClientConnected = false;
      streamAborted = true;
      logger.info(`[Stream] Client disconnected: ${streamSessionId}`);

      // Deep Thinking ops metric: aborted run
      if (aiModes?.deepResearch && req.organizationId && req.userId && deepThinkingStartedLogged) {
        import('../services/ai/deepThinkingMetricsService.js')
          .then(({ logDeepThinkingEvent }) =>
            logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'client_disconnected' },
            })
          )
          .catch(() => {
            /* ignore */
          });
      }

      if (accumulatedContent.length > 0) {
        savePartialResponse(
          streamSessionId,
          accumulatedContent,
          req.userId!,
          req.organizationId!
        ).catch((err: Error | null) => logger.error('[Stream] Failed to save partial:', err));
      }

      // Trace: mark run as aborted (best-effort)
      if (chatRunId && req.organizationId && req.userId) {
        setImmediate(() => {
          import('../services/ai/chatTraceService.js')
            .then((mod: any) =>
              (mod.default || mod).completeRun({
                runId: chatRunId,
                status: 'aborted',
                pipelineTraceId: pipelineMeta?.traceId || pipelineMeta?.trace_id || null,
                modelProvider: pipelineMeta?.provider || null,
                modelId: pipelineMeta?.model || null,
                tier: selectedTier || null,
                outputText: accumulatedContent,
                dtStates: dtStatesEmitted,
              })
            )
            .catch(() => {
              /* ignore */
            });
        });
      }
    };

    req.socket?.on('close', connectionCleanup);
    req.socket?.on('error', connectionCleanup);
    res.on('close', connectionCleanup);

    const savePartialResponse = async (
      sessionId: string,
      content: string,
      userId: string,
      orgId: string
    ) => {
      await dbRun(
        `
            INSERT INTO ai_partial_responses (id, session_id, user_id, organization_id, content, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                content = excluded.content,
                updated_at = CURRENT_TIMESTAMP
        `,
        [uuidv4(), sessionId, userId, orgId, content]
      );
    };

    try {
      // --------------------------------------------------------
      // Fast-fail when no LLM provider is configured (dev UX)
      // --------------------------------------------------------
      // Without at least one provider (env key or configured provider table),
      // the pipeline can end up returning empty content or failing late.
      const hasEnvProvider =
        !!process.env.OPENAI_API_KEY ||
        !!process.env.GEMINI_API_KEY ||
        !!process.env.GOOGLE_AI_API_KEY ||
        !!process.env.ANTHROPIC_API_KEY ||
        !!process.env.MISTRAL_API_KEY;

      if (!hasEnvProvider) {
        res.write(
          `data: ${JSON.stringify({
            error:
              'No LLM provider configured on the backend. Set OPENAI_API_KEY or GEMINI_API_KEY (or configure providers in llm_providers).',
            code: 'NO_LLM_PROVIDER',
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // --------------------------------------------------------
      // Access policy enforcement (Demo/Trial/Paid) for streaming
      // NOTE: streaming pipeline bypasses AIOrchestrator, so enforce here.
      // --------------------------------------------------------
      const AccessPolicyService = (await import('../services/accessPolicyService.js'))
        .default as any;
      const aiAccessContext = await AccessPolicyService.getAIAccessContext(req.organizationId!);
      const aiAccessCheck = await AccessPolicyService.checkAccess(req.organizationId!, 'ai_call');

      if (!aiAccessCheck.allowed) {
        res.write(
          `data: ${JSON.stringify({
            error: aiAccessCheck.reason || 'Access blocked',
            code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
            accessContext: aiAccessContext,
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Count the AI call for daily limits
      AccessPolicyService.incrementUsage(req.organizationId!, 'ai_calls', 1).catch((err: any) => {
        logger.warn('[AI Stream] Failed to increment ai_calls usage:', err?.message || err);
      });

      // Deep Thinking ops metrics (best-effort; must not break chat)
      if (aiModes?.deepResearch && req.organizationId && req.userId) {
        const { logDeepThinkingEvent } =
          await import('../services/ai/deepThinkingMetricsService.js');
        await logDeepThinkingEvent({
          organizationId: req.organizationId!,
          userId: req.userId!,
          sessionId: streamSessionId,
          conversationId: conversationId || null,
          eventType: 'run_started',
          payload: {
            deepThinkingDepth: (context as any)?.deepThinkingDepth || null,
            webSearch: Boolean(aiModes?.webSearch),
            forceDepth: Boolean(forceDepthTrigger || (context as any)?.forceDepth),
          },
        });
        deepThinkingStartedLogged = true;

        if (forceDepthTrigger || (context as any)?.forceDepth) {
          await logDeepThinkingEvent({
            organizationId: req.organizationId!,
            userId: req.userId!,
            sessionId: streamSessionId,
            conversationId: conversationId || null,
            eventType: 'force_depth',
            payload: { trigger: forceDepthTrigger || null },
          });
        }
      }

      if (resumeFromPartial && conversationId) {
        const row = (await dbGet(
          `SELECT content FROM ai_partial_responses WHERE session_id = ? AND user_id = ?`,
          [conversationId, req.userId]
        )) as { content: string } | null;
        const partial = row?.content || null;

        if (partial) {
          accumulatedContent = partial;
          res.write(
            `data: ${JSON.stringify({
              type: 'resume',
              text: partial,
              sessionId: streamSessionId,
            })}\n\n`
          );
        }

        // Partial resume logic handled by sending previous content to client
      }

      // Extract projectId and screenContext from request context
      // Deep Thinking autonomy: do not pass project/screen context into the pipeline.
      // Keep them only in request.context if needed for UI continuity, but prevent AIContextBuilder usage.
      const projectId = aiModes?.deepResearch
        ? null
        : (context as any)?.projectId ||
          (context as any)?.workspaceContext?.projectId ||
          bodyProjectId ||
          null;

      const screenContext = aiModes?.deepResearch
        ? null
        : (context as any)?.screenContext ||
          (context as any)?.workspaceContext ||
          bodyScreenContext ||
          null;

      const focusMode = (context as any)?.focusMode || bodyFocusMode || 'all';

      let pipelineRequest = {
        type: 'chat',
        userId: req.userId,
        organizationId: req.organizationId,
        projectId, // Pass projectId for context building
        prompt: forceDepthTrigger ? `Force-depth request: ${rawMsg}` : message,
        messages: (history || []).map((m) => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: (m as { parts?: Array<{ text: string }> }).parts?.[0]?.text || m.content || '',
        })),
        capability: 'chat',
        screenContext, // Full screen context for AI awareness
        focusMode, // Focus mode for context filtering
        context: {
          ...(context || {}),
          projectId,
          screenContext,
          focusMode,
          conversationId,
          // Tools & routing options (used by AIPipeline prompt + model selection)
          aiModes,
          knowledgeSources,
          responseStyle,
          selectedTier,
          selectedModelId,
        },
        stream: true,
        options: {
          role: roleName,
          systemInstruction: enhancedSystemInstruction,
          // Tools & routing options
          aiModes,
          knowledgeSources,
          responseStyle,
          selectedTier,
          selectedModelId,
        },
      };

      logger.info(`[AI Stream] Processing request for user ${req.userId}`, {
        projectId,
        focusMode,
        hasScreenContext: !!screenContext,
        screenId: screenContext?.screenId || screenContext?.currentScreen || 'unknown',
      });

      // B1: Track emitted DT states for process integrity diagnostic
      const dtStatesEmitted: string[] = [];

      const emitSSE = (payload: Record<string, unknown>) => {
        if (!isClientConnected || res.destroyed) return;
        // Capture dt_state events for B1 diagnostic
        if (payload.type === 'dt_state' && typeof payload.state === 'string') {
          dtStatesEmitted.push(payload.state);
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      // --------------------------------------------------------
      // AI-suggested Deep Thinking activation (hint)
      // When DT is OFF, check if user's message looks strategic and suggest DT.
      // --------------------------------------------------------
      if (!aiModes?.deepResearch && message && message.trim().length >= 20) {
        try {
          const { detectDeepThinkingIntent } =
            await import('../services/ai/deepThinkingHintService.js');
          const hint = detectDeepThinkingIntent(message, language);
          if (hint.shouldSuggest) {
            emitSSE({
              type: 'dt_hint',
              reason: hint.reason,
              confidence: hint.confidence,
            });
          }
        } catch (_hintErr) {
          // Non-critical; swallow silently
        }
      }

      // --------------------------------------------------------
      // Web Search tool (non-DeepThinking mode)
      // --------------------------------------------------------
      // When webSearch is enabled but deepResearch is OFF, we do a lightweight search and:
      // - stream citations metadata to the client (for UI rendering)
      // - inject sources into system instruction so the model can ground claims
      if (aiModes?.webSearch && !aiModes?.deepResearch) {
        const tavilyKey = (process.env.TAVILY_API_KEY || '').trim();
        if (!tavilyKey) {
          emitSSE({
            type: 'research_progress',
            topic: message,
            stage: 'complete',
            queries: [],
            sources: [],
            error: 'Web research enabled but TAVILY_API_KEY is missing',
          });
        } else {
          try {
            const { TavilyWebSearchService } =
              await import('../services/ai/tavilyWebSearchService.js');
            const svc = new (TavilyWebSearchService as any)(tavilyKey);
            const resp = await svc.search(message, { maxResults: 5, includeNews: true });
            const results = Array.isArray(resp?.results) ? resp.results : [];

            const citations = results
              .filter((r: any) => r?.url && r?.title)
              .slice(0, 5)
              .map((r: any, idx: number) => ({
                id: `web_${idx + 1}`,
                type: 'external',
                title: String(r.title || ''),
                reference: String(r.url || ''),
                link: String(r.url || ''),
                excerpt: String(r.snippet || ''),
              }));

            emitSSE({ type: 'citations', citations });

            // Inject sources into the system instruction (so the model can cite them).
            const sourcesText = citations
              .map((c: any, i: number) => `[${i + 1}] ${c.title}\n${c.link}\n${c.excerpt || ''}`)
              .join('\n\n');

            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n## WEB SOURCES (provided by tool)\n${sourcesText}\n\nRules:\n- When using any web source, cite it inline like [1], [2].\n- If sources are insufficient or contradictory, say so.\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                external: {
                  ...(context as any)?.external,
                  webSearch: { query: message, results },
                  citations,
                },
              },
            } as any;
          } catch (err: any) {
            logger.warn('[AI Stream] Web search failed, continuing without it:', err?.message);
            emitSSE({
              type: 'research_progress',
              topic: message,
              stage: 'complete',
              queries: [],
              sources: [],
              error: 'Web research unavailable',
            });
          }
        }
      }

      // --------------------------------------------------------
      // Conversation-scoped RAG from attached documents
      // --------------------------------------------------------
      // The client can attach documents to a conversation and pass their `knowledge_docs.id` as:
      // - context.attachmentDocIds: string[]
      // - OR context.attachments: Array<{ docId: string; ... }>
      // We then restrict retrieval to ONLY those doc IDs.
      const attachmentDocIdsRaw =
        (context as any)?.attachmentDocIds ||
        (Array.isArray((context as any)?.attachments)
          ? (context as any).attachments.map((a: any) => a?.docId).filter(Boolean)
          : null);
      const attachmentDocIds = Array.isArray(attachmentDocIdsRaw)
        ? Array.from(new Set(attachmentDocIdsRaw.map((x: any) => String(x)).filter(Boolean)))
        : [];

      if (attachmentDocIds.length > 0 && message && message.trim().length > 0) {
        try {
          const ragModule = await import('../services/ragService.js');
          const ragService = (ragModule.default || ragModule) as any;
          const chunks = await ragService.searchRelevantChunks(message, {
            limit: 5,
            organizationId: req.organizationId || undefined,
            documentIds: attachmentDocIds,
          });

          if (Array.isArray(chunks) && chunks.length > 0) {
            const attachmentsText = chunks
              .slice(0, 5)
              .map((c: any, i: number) => {
                const source = String(c?.source || 'Attachment');
                const content = String(c?.content || '').trim();
                return `[A${i + 1}] ${source}\n${content}`;
              })
              .join('\n\n');

            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n## ATTACHMENTS (conversation-scoped sources)\n${attachmentsText}\n\nRules:\n- Prefer these attachments when relevant.\n- If you use an attachment chunk, cite it inline like [A1], [A2].\n- If the attachments do not contain the needed info, say so.\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                external: {
                  ...(context as any)?.external,
                  attachmentsRag: {
                    documentIds: attachmentDocIds,
                    chunks,
                  },
                },
              },
            } as any;
          }
        } catch (err: any) {
          logger.warn(
            '[AI Stream] Attachment RAG failed, continuing without it:',
            err?.message || String(err)
          );
        }
      }

      // --------------------------------------------------------
      // Deep Thinking orchestration (standalone, composable)
      // --------------------------------------------------------
      // NOTE: `aiModes.deepResearch` is used as the Deep Thinking toggle in the client (ToolsMenu).
      if (aiModes?.deepResearch) {
        const { DeepThinkingOrchestrator } =
          await import('../services/ai/deepThinkingOrchestrator.js');
        const orchestrator = new (DeepThinkingOrchestrator as any)();
        const prelude = await orchestrator.runPrelude({
          message,
          language,
          context: (context || null) as any,
          aiModes: (aiModes || null) as any,
          emit: emitSSE,
        });

        if (prelude?.systemInstructionAddon) {
          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                String(prelude.systemInstructionAddon || ''),
            },
          } as any;
        }

        // Force-depth: revise the previous answer with NEW axes/contrarguments (no repetition, no defensiveness).
        if (forceDepthTrigger) {
          const lastAssistant = (pipelineRequest as any).messages
            .slice()
            .reverse()
            .find((m: any) => m.role === 'assistant' && String(m.content || '').trim().length > 0);

          const revisionInstruction = [
            '\n\n## FORCE DEPTH (user requested)',
            `Trigger: ${rawMsg}`,
            'Rules:',
            '- Do NOT be defensive. Assume the previous answer was insufficient.',
            '- Do NOT repeat the same structure or phrasing.',
            '- Add at least 2 NEW decision dimensions/axes.',
            '- Add at least 2 contrarguments / failure modes against your recommendation.',
            '- Strengthen trade-offs and assumptions/gaps.',
            '- Keep decision-grade format (6 sections).',
            '',
            lastAssistant
              ? `Previous answer to improve:\n---\n${String(lastAssistant.content).slice(0, 6000)}\n---`
              : '',
          ]
            .filter(Boolean)
            .join('\n');

          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                revisionInstruction,
            },
            context: {
              ...((pipelineRequest as any).context || {}),
              deepThinkingDepth: 'hard',
              forceDepth: true,
              forceDepthTrigger: rawMsg,
            },
          } as any;
        }
      }

      const aiPipeline = await getAIPipeline();
      const response = await (aiPipeline as any).process(
        pipelineRequest,
        (progress: Record<string, unknown>) => {
          if (!isClientConnected || res.destroyed) return;

          res.write(
            `data: ${JSON.stringify({
              type: 'thought',
              ...progress,
            })}\n\n`
          );
        }
      );

      // If pipeline failed before streaming starts, surface the error as SSE (instead of silently ending).
      // Otherwise the client sees "nothing" or a misleading EMPTY_STREAM.
      if ((response as any)?.success === false && (response as any)?.error) {
        const errObj = (response as any).error;
        const msg = String(errObj?.message || errObj?.error || 'AI request failed');
        const codeFromObj = typeof errObj?.code === 'string' ? errObj.code : undefined;
        const code =
          codeFromObj ||
          (/invalid_api_key|incorrect api key/i.test(msg)
            ? 'INVALID_API_KEY'
            : 'AI_PIPELINE_ERROR');

        if (isClientConnected && !res.destroyed) {
          res.write(
            `data: ${JSON.stringify({
              error: msg,
              code,
            })}\n\n`
          );
          res.write('data: [DONE]\n\n');
        }
        if (
          aiModes?.deepResearch &&
          req.organizationId &&
          req.userId &&
          deepThinkingStartedLogged
        ) {
          try {
            const { logDeepThinkingEvent } =
              await import('../services/ai/deepThinkingMetricsService.js');
            await logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'pipeline_error', code, message: msg },
            });
          } catch {
            /* ignore */
          }
        }
        streamCompleted = true;
        return res.end();
      }

      if ((response as { stream?: AsyncIterable<string> }).stream) {
        for await (const chunk of (response as { stream: AsyncIterable<string> }).stream) {
          if (!isClientConnected || res.destroyed || streamAborted) {
            logger.info(`[Stream] Aborting stream - client disconnected: ${streamSessionId}`);
            break;
          }

          if (chunk) {
            accumulatedContent += chunk;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);

            if (Date.now() - lastSaveTime > 2000) {
              savePartialResponse(
                streamSessionId,
                accumulatedContent,
                req.userId!,
                req.organizationId!
              ).catch((err: Error | null) =>
                logger.warn('[Stream] Partial save failed:', (err as Error).message)
              );
              lastSaveTime = Date.now();
            }
          }
        }

        if (isClientConnected && !streamAborted) {
          // If stream produced no content, surface an explicit error.
          // Without this, the frontend may see only [DONE] and appear "dead".
          if (!accumulatedContent || accumulatedContent.trim().length === 0) {
            res.write(
              `data: ${JSON.stringify({
                error:
                  'AI stream ended without output. Check LLM provider configuration and backend logs.',
                code: 'EMPTY_STREAM',
              })}\n\n`
            );
          }

          // ================================================================
          // Deep Thinking Self-Check: 3-layer quality gate + auto-repair
          // ================================================================
          if (aiModes?.deepResearch && accumulatedContent && accumulatedContent.trim().length > 0) {
            try {
              const { scoreRubricV2, detectPatterns } =
                await import('../services/ai/deepThinkingEvaluationService.js');
              const { evaluatePassFail, buildRepairPrompt } =
                await import('../services/ai/deepThinkingSelfCheck.js');

              let currentText = accumulatedContent;
              let repairIterations = 0;
              const MAX_REPAIR_ITERATIONS = 2;
              let selfCheckVerdict: 'PASS' | 'FAIL' | 'BEST_EFFORT' = 'FAIL';

              for (let iter = 0; iter <= MAX_REPAIR_ITERATIONS; iter++) {
                const rubric = scoreRubricV2(currentText, language);
                const patterns = detectPatterns(currentText, language);
                const { pass, failReasons } = evaluatePassFail({
                  rubric,
                  negativePatterns: patterns.negative,
                });

                if (pass) {
                  selfCheckVerdict = 'PASS';
                  break;
                }

                // If this was the last allowed check (after max repairs), mark as best effort
                if (iter === MAX_REPAIR_ITERATIONS) {
                  selfCheckVerdict = 'BEST_EFFORT';
                  logger.info(
                    `[DeepThinking SelfCheck] Best effort after ${repairIterations} repair(s). ` +
                      `Fail reasons: ${failReasons.join(', ')}`
                  );
                  break;
                }

                // Auto-repair: N-tag driven, replace (not append)
                repairIterations++;

                // Emit generic "Refining analysis…" — no specific details
                emitSSE({
                  type: 'dt_selfcheck',
                  status: 'repairing',
                  iteration: repairIterations,
                  label: 'Refining analysis…',
                });

                try {
                  const { modelRouter } = await import('../services/ai/modelRouter.js');
                  const { llmService } = await import('../services/ai/llmService.js');
                  const tier = (selectedTier || 'STANDARD') as any;
                  const modelCfg = selectedModelId
                    ? await modelRouter.getProviderConfig(selectedModelId, tier)
                    : await modelRouter.select({
                        capability: 'report_section',
                        tier,
                        organizationId: req.organizationId!,
                        options: { tier },
                      } as any);

                  const repairSys = buildRepairPrompt(
                    currentText,
                    patterns.negative,
                    failReasons,
                    repairIterations
                  );

                  const fixed = (await llmService.callText({
                    type: 'chat',
                    modelConfig: {
                      provider: modelCfg.provider,
                      id: modelCfg.id,
                      endpoint: (modelCfg as any).endpoint,
                      apiKey: (modelCfg as any).apiKey,
                    },
                    systemPrompt: repairSys,
                    messages: [
                      {
                        role: 'user',
                        content: currentText,
                      },
                    ],
                  } as any)) as any;

                  const fixedText = String(fixed?.content || '').trim();
                  if (fixedText.length > 0) {
                    // Replace strategy: send dt_repair_replace event, then stream new content
                    currentText = fixedText;

                    emitSSE({
                      type: 'dt_repair_replace',
                      text: fixedText,
                    });
                  }
                } catch (repairErr: any) {
                  logger.warn(
                    `[DeepThinking SelfCheck] Repair iteration ${repairIterations} failed:`,
                    repairErr?.message || repairErr
                  );
                  selfCheckVerdict = 'BEST_EFFORT';
                  break;
                }
              }

              // Update accumulated content with final (possibly repaired) text
              accumulatedContent = currentText;

              // Emit self-check result
              emitSSE({
                type: 'dt_selfcheck',
                status: selfCheckVerdict === 'PASS' ? 'passed' : 'best_effort',
                label:
                  selfCheckVerdict === 'PASS'
                    ? 'Deep Thinking check passed'
                    : 'Analysis complete (best effort)',
                repairIterations,
              });
            } catch (err: any) {
              logger.warn('[DeepThinking SelfCheck] Failed:', err?.message || err);
            }
          }

          // Deep Thinking ops metric: completed run (evaluate final output; do not reward length)
          if (
            aiModes?.deepResearch &&
            req.organizationId &&
            req.userId &&
            deepThinkingStartedLogged
          ) {
            try {
              const { validateDeepThinkingDoD } =
                await import('../services/ai/deepThinkingQuality.js');
              const { detectPatterns, scoreRubricV2 } =
                await import('../services/ai/deepThinkingEvaluationService.js');
              const { logDeepThinkingEvent } =
                await import('../services/ai/deepThinkingMetricsService.js');

              const dodFinal = validateDeepThinkingDoD(accumulatedContent, language);
              const rubricFinal = scoreRubricV2(accumulatedContent, language);
              const patternsFinal = detectPatterns(accumulatedContent, language);

              // Force-depth diff check: if this was a force-depth request, compare with previous answer
              let forceDepthDiff: any = null;
              if (forceDepthTrigger || (context as any)?.forceDepth) {
                try {
                  const { evaluateForceDepthDiff } =
                    await import('../services/ai/deepThinkingSelfCheck.js');

                  // Find the last assistant message from history (the answer being challenged)
                  const lastAssistant = (pipelineRequest as any).messages
                    ?.slice()
                    .reverse()
                    .find(
                      (m: any) =>
                        m.role === 'assistant' && String(m.content || '').trim().length > 0
                    );

                  if (lastAssistant) {
                    const beforeText = String(lastAssistant.content || '').trim();
                    const beforeRubric = scoreRubricV2(beforeText, language);
                    forceDepthDiff = evaluateForceDepthDiff(
                      beforeText,
                      accumulatedContent,
                      beforeRubric,
                      rubricFinal
                    );

                    if (!forceDepthDiff.isSubstantiallyDifferent) {
                      logger.warn(
                        `[DeepThinking] Force-depth FAIL: response too similar. ` +
                          `Jaccard=${forceDepthDiff.jaccardSimilarity}, delta=${forceDepthDiff.rubricDelta}`
                      );
                      // Emit explicit quality FAIL signal to frontend (non-blocking, but must be visible).
                      emitSSE({
                        type: 'dt_selfcheck',
                        status: 'failed',
                        label:
                          'Directed deepening failed: output is too similar (insufficient depth).',
                        forceDepthDiff,
                      });
                    }
                  }
                } catch (fdErr: any) {
                  logger.warn('[DeepThinking] Force-depth diff failed:', fdErr?.message);
                }
              }

              // B1: Process State Integrity (diagnostic, non-blocking)
              let processStateLog: any = null;
              try {
                const { checkProcessStateIntegrity } =
                  await import('../services/ai/deepThinkingSelfCheck.js');
                processStateLog = checkProcessStateIntegrity(dtStatesEmitted);
              } catch {
                /* ignore */
              }

              await logDeepThinkingEvent({
                organizationId: req.organizationId!,
                userId: req.userId!,
                sessionId: streamSessionId,
                conversationId: conversationId || null,
                eventType: 'run_completed',
                payload: {
                  dod: dodFinal,
                  rubric: rubricFinal,
                  negativePatterns: patternsFinal.negative,
                  positivePatterns: patternsFinal.positive,
                  optionsCount: (patternsFinal.diagnostics as any)?.optionsCount ?? null,
                  deepThinkingDepth: (context as any)?.deepThinkingDepth || null,
                  webSearch: Boolean(aiModes?.webSearch),
                  forceDepth: Boolean(forceDepthTrigger || (context as any)?.forceDepth),
                  forceDepthDiff,
                  processStateIntegrity: processStateLog,
                },
              });
            } catch (err: any) {
              logger.warn(
                '[DeepThinkingMetrics] Failed to log completed run:',
                err?.message || err
              );
            }
          }

          // ================================================================
          // Agent Audit Layer (Post-DT) — optional, streamed transparency
          // ================================================================
          try {
            const agentAudit = (context as any)?.agentAudit || null;
            const agentIds = Array.isArray(agentAudit?.agentIds)
              ? agentAudit.agentIds.map((x: any) => String(x || '').trim()).filter(Boolean)
              : [];
            const decisionContext = agentAudit?.decisionContext || null;

            if (
              aiModes?.deepResearch &&
              req.organizationId &&
              req.userId &&
              decisionContext &&
              agentIds.length > 0
            ) {
              emitSSE({
                type: 'agent_audit_state',
                state: 'reviewing',
                agentsTotal: agentIds.length,
              });

              const { runAgentAudit } =
                await import('../services/ai/agentAudit/orchestratorService.js');
              const { createAgentAuditRun } =
                await import('../services/ai/agentAudit/agentAuditStore.js');

              const auditOut = await runAgentAudit({
                organizationId: req.organizationId!,
                userId: req.userId!,
                conversationId: conversationId || null,
                decisionContext,
                deepThinkingReport: accumulatedContent,
                forceDepthDiff,
                agentIds,
                userIntent: agentAudit?.userIntent || 'validate',
                language,
                webSearchEnabled: Boolean(aiModes?.webSearch),
                selectedTier,
                selectedModelId,
                loopIteration: agentAudit?.loopIteration || 1,
                emit: emitSSE,
              } as any);

              // Persist run (best-effort)
              try {
                await createAgentAuditRun({
                  id: auditOut.orchestratorRunId,
                  organizationId: req.organizationId!,
                  userId: req.userId!,
                  conversationId: conversationId || null,
                  dtSessionId: streamSessionId,
                  userIntent: String(agentAudit?.userIntent || 'validate'),
                  loopIteration: Number(agentAudit?.loopIteration || 1),
                  decisionContext: decisionContext || null,
                  selectedAgentIds: agentIds,
                  verdict: auditOut.verdict || null,
                  reviews: (auditOut.reviews || []).map((r: any) => ({
                    agentId: String(r.agentId || ''),
                    overreach: r.overreach || null,
                    review: r,
                  })),
                } as any);
              } catch {
                /* ignore */
              }

              emitSSE({
                type: 'agent_audit_verdict',
                orchestratorRunId: auditOut.orchestratorRunId,
                verdict: auditOut.verdict,
                reviews: auditOut.reviews,
                decisionContext,
                agentIds,
                userIntent: agentAudit?.userIntent || 'validate',
                loopIteration: agentAudit?.loopIteration || 1,
              });
            }
          } catch (auditErr: any) {
            emitSSE({
              type: 'agent_audit_state',
              state: 'error',
              error: String(auditErr?.message || auditErr || ''),
            });
          }

          streamCompleted = true;
          res.write('data: [DONE]\n\n');

          await dbRun(`DELETE FROM ai_partial_responses WHERE session_id = ?`, [streamSessionId]);

          // Track token usage for trial budget (rough estimate based on chars)
          try {
            const estimatedTokens = Math.max(
              50,
              Math.ceil(((message?.length || 0) + (accumulatedContent?.length || 0)) / 4)
            );
            if (aiAccessContext?.isTrial && !aiAccessContext?.isPaid) {
              await AccessPolicyService.trackTokenUsage(req.organizationId!, estimatedTokens);
            }
          } catch (usageErr: any) {
            logger.warn(
              '[AI Stream] Failed to track trial token usage:',
              usageErr?.message || usageErr
            );
          }
        }
        return res.end();
      } else {
        if (isClientConnected && !res.destroyed) {
          res.write(
            `data: ${JSON.stringify({ text: (response as { content?: string }).content || '' })}\n\n`
          );
          streamCompleted = true;
          res.write('data: [DONE]\n\n');
        }
        return res.end();
      }
    } catch (err: any) {
      logger.error('Stream Error:', err);

      if (accumulatedContent.length > 0) {
        savePartialResponse(
          streamSessionId,
          accumulatedContent,
          req.userId!,
          req.organizationId!
        ).catch((e) =>
          logger.warn('[Stream] Failed to save partial on error:', (e as Error).message)
        );
      }

      if (isClientConnected && !res.destroyed) {
        const msg = (err as Error)?.message || String(err);
        const code = /invalid_api_key|incorrect api key/i.test(msg)
          ? 'INVALID_API_KEY'
          : 'AI_STREAM_ERROR';
        res.write(
          `data: ${JSON.stringify({
            error: msg,
            code,
            sessionId: streamSessionId,
            canResume: accumulatedContent.length > 0,
          })}\n\n`
        );
        // Keep SSE protocol consistent for the client parser
        res.write('data: [DONE]\n\n');
        if (
          aiModes?.deepResearch &&
          req.organizationId &&
          req.userId &&
          deepThinkingStartedLogged
        ) {
          try {
            const { logDeepThinkingEvent } =
              await import('../services/ai/deepThinkingMetricsService.js');
            await logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'exception', code, message: msg },
            });
          } catch {
            /* ignore */
          }
        }
        streamCompleted = true;
        return res.end();
      }
    } finally {
      req.socket?.removeListener('close', connectionCleanup);
      req.socket?.removeListener('error', connectionCleanup);
      res.removeListener('close', connectionCleanup);
    }
    return;
  })
);

router.get(
  '/stream/partial/:sessionId',
  verifyToken,
  validateParams(SessionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const row = (await dbGet(
        `
            SELECT content, updated_at 
            FROM ai_partial_responses 
            WHERE session_id = ? AND user_id = ?
        `,
        [req.params.sessionId, req.userId]
      )) as { content: string; updated_at: string } | null;

      if (!row) {
        return res.status(404).json({ error: 'No partial response found' });
        return;
      }

      return res.json({
        sessionId: req.params.sessionId,
        content: row.content,
        updatedAt: row.updated_at,
        canResume: true,
      });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/chat',
  verifyToken,
  validateBody(ChatRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, projectId, currentScreen, selectedObjectId, selectedObjectType } = req.body;

    try {
      const AIOrchestrator = await getAIOrchestrator();
      const AIAuditLogger = await getAIAuditLogger();

      const result = await AIOrchestrator.processMessage(
        message,
        req.userId!,
        req.organizationId!,
        projectId,
        {
          currentScreen,
          selectedObjectId,
          selectedObjectType,
        }
      );

      console.log('[AI Routes] Chat result:', JSON.stringify(result, null, 2));

      await AIAuditLogger.logSuggestion(
        req.userId!,
        req.organizationId!,
        projectId,
        result.role,
        result.prompt,
        result.contextSummary
      );

      return res.json({
        role: result.role,
        roleDescription: AIOrchestrator.getRoleDescription(result.role),
        intent: result.intent,
        contextSummary: result.contextSummary,
        dataSources: (result.responseContext as { dataSources?: unknown[] })?.dataSources || [],
        prompt: result.prompt,
        policyLevel:
          (result.responseContext as { policy?: { policyLevel?: string } })?.policy?.policyLevel ||
          'ADVISORY',
      });
    } catch (err: any) {
      logger.error('Chat Error:', err);
      const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
      if (error.isBudgetError) {
        return res.status(403).json({
          error: error.message,
          code: 'AI_BUDGET_EXHAUSTED',
          budgetStatus: error.budgetStatus,
        });
        return;
      }
      return res.status(500).json({ error: error.message });
    }
  })
);

// ==================== POLICY ====================

router.get(
  '/policy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const info = await (AIPolicyEngine as any).getPolicySummary(req.organizationId as string);
      return res.json(info);
    } catch (err: any) {
      console.error('[AI Routes] Policy GET error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/policy',
  verifyToken,
  validateBody(UpdatePolicyRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin required' });
    }

    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const result = await AIPolicyEngine.updatePolicy(req.organizationId!, req.body);
      return res.json(result);
    } catch (err: any) {
      console.error('[AI Routes] Policy PATCH error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/policy/can-perform/:actionType',
  verifyToken,
  validateParams(ActionTypeParamSchema),
  validateQuery(CanPerformActionQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const result = await AIPolicyEngine.canPerformAction(
        req.params.actionType,
        req.organizationId as string,
        projectId as string | undefined,
        req.userId as string
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== MEMORY ====================

router.get(
  '/memory/project/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const memory = await AIMemoryManager.buildProjectMemorySummary(req.params.projectId);
      return res.json(memory);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/memory/project/:projectId/decision',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateBody(RecordDecisionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decisionId, title, outcome, rationale } = req.body;

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.recordDecision(
        req.params.projectId,
        decisionId,
        title,
        outcome,
        rationale,
        req.userId!
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/memory/user',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const preferences = await AIMemoryManager.getUserPreferences(req.userId!);
      return res.json(preferences);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/memory/user',
  verifyToken,
  validateBody(UpdateUserPreferencesRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.updateUserPreferences(req.userId!, req.body);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.delete(
  '/memory/project/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_project_settings')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.clearProjectMemory(req.params.projectId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// Organization Memory
router.get(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const memory = await AIMemoryManager.getOrganizationMemory(req.organizationId!);
      return res.json({
        organizationId: req.organizationId,
        ...memory,
      });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.updateOrganizationMemory(req.organizationId!, req.body);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.delete(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.clearOrganizationMemory(req.organizationId!);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== ACTIONS ====================

router.post(
  '/actions/draft',
  verifyToken,
  validateBody(CreateDraftRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { draftType, content, projectId } = req.body;

    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.createDraft(
        draftType,
        content,
        req.userId!,
        req.organizationId!,
        projectId
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/pending',
  verifyToken,
  validateQuery(GetPendingActionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const actions = await AIActionExecutor.getPendingActions(
        req.userId as string,
        projectId as string | undefined,
        req.organizationId as string
      );
      return res.json(actions);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/actions/:id/approve',
  verifyToken,
  validateParams(ActionIdParamSchema),
  validateBody(ApproveActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.approveAction(req.params.id, req.userId!);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/actions/:id/reject',
  verifyToken,
  validateParams(ActionIdParamSchema),
  validateBody(RejectActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.rejectAction(req.params.id, req.userId!, reason);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/actions/:id/execute',
  verifyToken,
  validateParams(ActionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.executeAction(req.params.id, req.userId!);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/proposals',
  verifyToken,
  validateQuery(GenerateProposalsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
      const logger = (await import('../utils/Logger.js')).default;
      logger.warn('Unauthorized proposal access attempt', {
        userId: req.userId,
        role: req.userRole,
      });
      return res.status(403).json({ error: 'Permission denied. ADMIN or SUPERADMIN required.' });
      return;
    }

    const { organizationId: queryOrgId } = req.query as { organizationId?: string };
    const organizationId =
      req.userRole === 'SUPERADMIN' && queryOrgId ? queryOrgId : req.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
      return;
    }

    try {
      const { getRequestContext } = await import('../utils/requestContext.js');
      const logger = (await import('../utils/Logger.js')).default;

      logger.info('Generating action proposals', {
        ...getRequestContext(req),
        targetOrgId: organizationId as string,
      });

      const AIContextBuilder = await getAIContextBuilder();
      const ActionProposalEngine = await import('../ai/actionProposalEngine.js').then(
        (m) => (m as any).default || m
      );

      const context = await AIContextBuilder.buildContext(undefined as any, organizationId);
      const proposals = ActionProposalEngine.generateProposals(context);

      return res.json(proposals);
    } catch (err: any) {
      logger.error('[AI Proposals] Error:', err);
      const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
      if (error.isBudgetError) {
        return res.status(403).json({
          error: error.message,
          code: 'AI_BUDGET_EXHAUSTED',
          budgetStatus: error.budgetStatus,
        });
        return;
      }
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// LAYER 2: RECOMMEND
router.post(
  '/recommend',
  verifyToken,
  validateBody(RecommendRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { diagnosisReport } = req.body;

    const generateFallbackInitiatives = (
      assessment: Record<string, unknown>,
      goals: string[],
      industry: string
    ) => {
      const axes = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ];

      const templates: Record<
        string,
        { name: string; priority: string; roi: number; budget: number }
      > = {
        processes: {
          name: 'Process Automation Initiative',
          priority: 'HIGH',
          roi: 2.0,
          budget: 200000,
        },
        digitalProducts: {
          name: 'Digital Product Development',
          priority: 'MEDIUM',
          roi: 2.5,
          budget: 300000,
        },
        businessModels: {
          name: 'Business Model Innovation',
          priority: 'MEDIUM',
          roi: 3.0,
          budget: 250000,
        },
        dataManagement: {
          name: 'Data Governance Implementation',
          priority: 'HIGH',
          roi: 1.8,
          budget: 150000,
        },
        culture: {
          name: 'Digital Culture Transformation',
          priority: 'MEDIUM',
          roi: 1.5,
          budget: 100000,
        },
        cybersecurity: {
          name: 'Cybersecurity Enhancement Program',
          priority: 'HIGH',
          roi: 1.5,
          budget: 180000,
        },
        aiMaturity: { name: 'AI Adoption Roadmap', priority: 'MEDIUM', roi: 2.2, budget: 220000 },
      };

      const initiativesToGenerate =
        Object.keys(assessment).length > 0
          ? axes.filter((axis) => {
              const axisData = assessment[axis] as
                | { current?: number; target?: number }
                | undefined;
              return (
                axisData &&
                axisData.current !== undefined &&
                axisData.target !== undefined &&
                axisData.current < axisData.target
              );
            })
          : axes.slice(0, 5);

      return initiativesToGenerate.map((axis) => {
        const template = templates[axis] || templates.processes;
        return {
          id: uuidv4(),
          name: template.name,
          description: `${template.name} for ${industry}`,
          hypothesis: `Implementing this initiative will improve ${axis} maturity and support: ${goals[0]}`,
          axis,
          area: null,
          priority: template.priority,
          complexity: 'Medium',
          estimatedROI: template.roi,
          estimatedBudget: template.budget,
          status: 'DRAFT',
          progress: 0,
          quarter: 'Q1',
          wave: 'Wave 1',
        };
      });
    };

    try {
      const aiPipeline = await getAIPipeline();

      const assessment = diagnosisReport.assessment || {};
      const goals = diagnosisReport.goals || ['Digital Transformation'];
      const painPoints = diagnosisReport.painPoints || [];
      const industry = diagnosisReport.industry || 'General';

      const initiativesPrompt = `You are a strategic transformation consultant. Based on the assessment data and business context, generate specific transformation initiatives.

BUSINESS CONTEXT:
- Industry: ${industry}
- Strategic Goals: ${goals.join(', ')}
- Pain Points: ${painPoints.join(', ')}

ASSESSMENT DATA:
${JSON.stringify(assessment, null, 2)}

Generate 5-10 strategic initiatives. For each initiative, provide:
1. name: Clear, actionable initiative name
2. description: Brief description of what the initiative involves
3. axis: Which assessment axis it addresses (processes, digitalProducts, businessModels, dataManagement, culture, cybersecurity, aiMaturity)
4. priority: HIGH, MEDIUM, or LOW
5. complexity: Low, Medium, or High
6. estimatedROI: Expected ROI multiplier (e.g., 1.5x, 2x, 3x)
7. estimatedBudget: Rough budget range in PLN
8. hypothesis: The expected outcome/benefit

Return as a JSON array of initiatives.`;

      const response = await aiPipeline.process({
        type: 'chat',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: initiativesPrompt,
        stream: false,
      });

      let initiatives: unknown[] = [];
      try {
        const text =
          (response as { text?: string; content?: string }).text ||
          (response as { content?: string }).content ||
          '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          initiatives = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        logger.warn('[AI Recommend] Failed to parse AI response as JSON:', parseErr);
      }

      if (!initiatives || (Array.isArray(initiatives) && initiatives.length === 0)) {
        logger.warn('[AI Recommend] No initiatives parsed, using fallback generation');
        initiatives = generateFallbackInitiatives(assessment, goals, industry);
      }

      const processedInitiatives = (Array.isArray(initiatives) ? initiatives : []).map(
        (init: any, idx: number) => ({
          id: (init.id as string) || uuidv4(),
          name: (init.name as string) || `Initiative ${idx + 1}`,
          description: (init.description as string) || (init.summary as string) || '',
          hypothesis: (init.hypothesis as string) || (init.description as string) || '',
          axis: (init.axis as string) || 'processes',
          area: (init.area as string | null) || null,
          priority: (init.priority as string) || 'MEDIUM',
          complexity: (init.complexity as string) || 'Medium',
          estimatedROI: parseFloat((init.estimatedROI as string) || '1.5') || 1.5,
          estimatedBudget: parseInt((init.estimatedBudget as string) || '100000', 10) || 100000,
          status: 'DRAFT',
          progress: 0,
          quarter: 'Q1',
          wave: 'Wave 1',
        })
      );

      return res.json(processedInitiatives);
    } catch (err: any) {
      logger.error('[AI Recommend] Error:', err);
      const fallbackInitiatives = generateFallbackInitiatives(
        diagnosisReport.assessment || {},
        diagnosisReport.goals || ['Digital Transformation'],
        diagnosisReport.industry || 'General'
      );
      return res.json(fallbackInitiatives);
    }
  })
);

// LAYER 3: ROADMAP
router.post(
  '/roadmap',
  verifyToken,
  validateBody(RoadmapRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body;

    try {
      const aiPipeline = await getAIPipeline();

      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`
        )
        .join('\n');

      const roadmapPrompt = `You are a strategic transformation consultant. Create an optimized implementation roadmap for the following initiatives.

INITIATIVES TO SCHEDULE:
${initiativesSummary}

RULES:
1. High priority + Low complexity initiatives should go in Q1-Q2 Year 1 (quick wins)
2. High priority + High complexity initiatives should start Q2 Year 1 with longer duration
3. Medium/Low priority can be scheduled in Year 2-3
4. Consider dependencies - foundation initiatives before dependent ones
5. Balance workload across quarters - no more than 3-4 major initiatives per quarter
6. Return the EXACT initiative names as provided (case-sensitive)

Return a structured roadmap assigning each initiative to a specific quarter.`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: roadmapPrompt,
        schema: 'roadmap',
        stream: false,
      });

      const roadmapData = (response as { object?: unknown }).object || response;

      if (!(roadmapData as { year1?: unknown }).year1) {
        logger.warn('[AI Roadmap] Invalid response structure, using fallback');
        const fallback: Record<string, Record<string, string[]>> = {
          year1: { q1: [], q2: [], q3: [], q4: [] },
          year2: { q1: [], q2: [], q3: [], q4: [] },
          reasoning: 'Fallback distribution due to AI response error',
        } as unknown as Record<string, Record<string, string[]>>;

        initiatives.forEach((init: Record<string, unknown>, idx: number) => {
          const quarter = idx % 4;
          const year = idx < 8 ? 'year1' : 'year2';
          const qKey = `q${quarter + 1}`;
          (fallback[year][qKey] as string[]).push(init.name as string);
        });

        return res.json(fallback);
        return;
      }

      return res.json(roadmapData);
    } catch (err: any) {
      logger.error('[AI Roadmap] Error:', err);
      const fallback: Record<string, Record<string, string[]>> = {
        year1: { q1: [], q2: [], q3: [], q4: [] },
        year2: { q1: [], q2: [], q3: [], q4: [] },
        reasoning: 'Fallback distribution due to error: ' + (err as Error).message,
      } as unknown as Record<string, Record<string, string[]>>;

      initiatives.forEach((init: Record<string, unknown>, idx: number) => {
        const quarter = idx % 4;
        const year = idx < 8 ? 'year1' : 'year2';
        const qKey = `q${quarter + 1}`;
        (fallback[year][qKey] as string[]).push(init.name as string);
      });

      return res.json(fallback);
    }
  })
);

// ==================== INITIATIVES AI ====================

router.post(
  '/initiatives/schedule',
  verifyToken,
  validateBody(RoadmapRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`
        )
        .join('\n');

      const roadmapPrompt = `You are a strategic transformation consultant. Create an optimized implementation roadmap for the following initiatives.

INITIATIVES TO SCHEDULE:
${initiativesSummary}

RULES:
1. High priority + Low complexity initiatives should go in Q1-Q2 Year 1 (quick wins)
2. High priority + High complexity initiatives should start Q2 Year 1 with longer duration
3. Medium/Low priority can be scheduled in Year 2-3
4. Consider dependencies - foundation initiatives before dependent ones
5. Balance workload across quarters - no more than 3-4 major initiatives per quarter
6. Return the EXACT initiative names as provided (case-sensitive)

Return a structured roadmap assigning each initiative to a specific quarter.`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: roadmapPrompt,
        schema: 'roadmap',
        stream: false,
      });

      const roadmapData = (response as { object?: unknown }).object || response;
      const now = new Date();
      const currentYear = now.getFullYear();

      const schedule = (initiatives as any[]).map((init: any) => {
        let quarter = 'Q1';
        let yearOffset = 0;
        let found = false;

        ['year1', 'year2', 'year3'].forEach((yKey, yIdx) => {
          const yObj = (roadmapData as any)?.[yKey];
          if (!yObj || found) return;
          ['q1', 'q2', 'q3', 'q4'].forEach((qKey: string) => {
            if (found) return;
            const titles = yObj[qKey];
            if (Array.isArray(titles) && titles.includes(init.name)) {
              quarter = qKey.toUpperCase();
              yearOffset = yIdx;
              found = true;
            }
          });
        });

        const qNum = Number(quarter.replace('Q', '')) || 1;
        const year = currentYear + yearOffset;
        const startDate = new Date(year, (qNum - 1) * 3, 1);
        const endDate = new Date(year, qNum * 3, 0);

        return {
          id: init.id,
          name: init.name,
          quarter: `${quarter} ${year}`,
          plannedStartDate: startDate.toISOString(),
          plannedEndDate: endDate.toISOString(),
        };
      });

      return res.json({ roadmap: roadmapData, schedule });
    } catch (err: any) {
      logger.error('[AI Schedule] Error:', err);
      return res.status(500).json({ error: 'Failed to generate schedule' });
    }
  })
);

router.post(
  '/initiatives/conflicts',
  verifyToken,
  validateBody(InitiativeConflictsRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives, dependencies } = req.body as any;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Owner: ${init.owner || 'Unassigned'}, Start: ${init.plannedStartDate || 'TBD'}, End: ${init.plannedEndDate || 'TBD'}`
        )
        .join('\n');

      const depsSummary = Array.isArray(dependencies)
        ? dependencies
            .map(
              (dep: any) =>
                `- ${dep.fromInitiativeId} -> ${dep.toInitiativeId} (${dep.type || 'FINISH_TO_START'})`
            )
            .join('\n')
        : 'None';

      const conflictsPrompt = `Analyze the following initiative schedule and dependencies. Identify resource conflicts, timeline overlaps, and dependency risks.

INITIATIVES:
${initiativesSummary}

DEPENDENCIES:
${depsSummary}

Return a JSON array of conflicts with fields:
- type (resource|dependency|timeline)
- initiatives (array of initiative names)
- severity (low|medium|high)
- description
- recommendation`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: conflictsPrompt,
        schema: 'initiative_conflicts',
        stream: false,
      });

      const result = (response as { object?: unknown }).object || response;
      return res.json({ conflicts: result });
    } catch (err: any) {
      logger.error('[AI Conflicts] Error:', err);
      return res.status(500).json({ error: 'Failed to analyze conflicts' });
    }
  })
);

router.post(
  '/initiatives/priorities',
  verifyToken,
  validateBody(InitiativePrioritiesRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body as any;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Current Priority: ${init.priority || 'Medium'}, ROI: ${init.expectedRoi || 'Unknown'}, Owner: ${init.owner || 'Unassigned'}`
        )
        .join('\n');

      const prioritiesPrompt = `Review the initiatives and recommend priority adjustments. Consider ROI, strategic impact, and dependencies.

INITIATIVES:
${initiativesSummary}

Return a JSON array with fields:
- name
- recommendedPriority (Critical|High|Medium|Low)
- rationale`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: prioritiesPrompt,
        schema: 'initiative_priorities',
        stream: false,
      });

      const result = (response as { object?: unknown }).object || response;
      return res.json({ priorities: result });
    } catch (err: any) {
      logger.error('[AI Priorities] Error:', err);
      return res.status(500).json({ error: 'Failed to recommend priorities' });
    }
  })
);

// ==================== AUDIT ====================

router.get(
  '/audit',
  verifyToken,
  validateQuery(GetAuditLogsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { projectId, userId, actionType, limit, offset } = req.query as any;
    // The original instruction had an extra closing brace here, which is removed for syntactical correctness.
    // The instruction was: `const { projectId, userId, actionType, limit, offset } = req.query as any; };`
    // Corrected to: `const { projectId, userId, actionType, limit, offset } = req.query as any;`

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: projectId as string | undefined,
        userId: userId as string | undefined,
        actionType: actionType as string | undefined,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
      });
      return res.json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/audit/stats',
  verifyToken,
  validateQuery(GetAuditLogsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIAuditLogger = await getAIAuditLogger();
      const stats = await AIAuditLogger.getAuditStats(
        req.organizationId!,
        projectId as string | undefined
      );
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/audit/:id/decision',
  verifyToken,
  validateParams(AuditIdParamSchema),
  validateBody(RecordAuditDecisionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decision, feedback } = req.body;
    try {
      const AIAuditLogger = await getAIAuditLogger();
      const result = await AIAuditLogger.recordUserDecision(req.params.id, decision, feedback);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== EXPLANATIONS ====================

router.get(
  '/explanations/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateQuery(GetExplanationsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { limit, offset } = req.query as any;

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: req.params.projectId,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
        includeExplanation: true,
      });

      const explanations = (Array.isArray(logs) ? logs : []).map(
        (log: Record<string, unknown>) => ({
          id: log.id,
          timestamp: log.created_at,
          explanation: log.explanation,
          aiResponse: log.ai_suggestion,
          userDecision: log.user_decision,
        })
      );

      return res.json({
        projectId: req.params.projectId,
        total: explanations.length,
        explanations,
      });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/explanations/export',
  verifyToken,
  validateQuery(ExportExplanationsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { projectId, startDate, endDate } = req.query as {
      projectId?: string;
      startDate?: string;
      endDate?: string;
    };

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: projectId || null,
        limit: 1000,
        offset: 0,
        includeExplanation: true,
      });

      let filteredLogs = Array.isArray(logs) ? logs : [];
      if (startDate) {
        const start = new Date(startDate);
        filteredLogs = filteredLogs.filter(
          (log: Record<string, unknown>) => new Date(log.created_at as string) >= start
        );
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredLogs = filteredLogs.filter(
          (log: Record<string, unknown>) => new Date(log.created_at as string) <= end
        );
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        organizationId: req.organizationId,
        projectId: projectId || 'ALL',
        totalRecords: filteredLogs.length,
        dateRange: {
          start: startDate || 'N/A',
          end: endDate || 'N/A',
        },
        records: filteredLogs.map((log: Record<string, unknown>) => ({
          id: log.id,
          userId: log.user_id,
          projectId: log.project_id,
          timestamp: log.created_at,
          actionType: log.action_type,
          explanation: log.explanation,
          aiResponse: log.ai_suggestion,
          userDecision: log.user_decision,
          userFeedback: log.user_feedback,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ai_explanations_${new Date().toISOString().split('T')[0]}.json"`
      );
      return res.json(exportData);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== HEALTH MONITORING ====================

router.get(
  '/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const healthMonitor = (await import('../services/ai/healthMonitor.js')).default as any;
      const status = healthMonitor.getStatus();

      // Keep response compatible with `AIHealthResponse` expected by the frontend.
      const overall =
        (status?.lastCheck as { overall?: 'healthy' | 'degraded' | 'error' } | null)?.overall ||
        'error';
      const lastCheck =
        (status?.lastCheck as { timestamp?: string } | null)?.timestamp || new Date().toISOString();

      return res.json({
        status: overall,
        providers: status?.providers || {},
        lastCheck,
        // Extra debug fields (harmless for typed clients)
        isRunning: status?.isRunning,
        consecutiveFailures: status?.consecutiveFailures,
        checks: (status?.lastCheck as { checks?: unknown[] } | null)?.checks || [],
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  })
);

router.post(
  '/health/diagnose',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const healthMonitor = (await import('../services/ai/healthMonitor.js')).default as any;
      const results = await healthMonitor.runDiagnostics();
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  })
);

// ==================== SMART SUGGESTIONS ====================

router.get(
  '/suggestions',
  verifyToken,
  validateQuery(GetSuggestionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.query as { projectId?: string };
      const smartSuggestions = await import('../services/ai/smartSuggestions.js').then(
        (m) => (m as any).default || m
      );

      const suggestions = await smartSuggestions.getCachedSuggestions(req.userId!, projectId, {});

      return res.json({ suggestions });
    } catch (err: any) {
      logger.error('[AI] Suggestions error:', err);
      return res.status(500).json({
        error: (err as Error).message,
        suggestions: [],
      });
    }
  })
);

router.post(
  '/suggestions',
  verifyToken,
  validateBody(PostSuggestionsRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, conversationContext } = req.body;
      const smartSuggestions = await import('../services/ai/smartSuggestions.js').then(
        (m) => (m as any).default || m
      );

      const suggestions = await smartSuggestions.getSuggestions(
        req.userId!,
        projectId,
        conversationContext || {}
      );

      return res.json({ suggestions });
    } catch (err: any) {
      logger.error('[AI] Suggestions error:', err);
      return res.status(500).json({
        error: (err as Error).message,
        suggestions: [],
      });
    }
  })
);

// ==================== APPROVAL PATTERNS ====================

// const ApprovalPatternService = await import('../services/approvalPatternService.js').then(
//     (m) => (m as any).default || m,
// );

router.get(
  '/patterns',
  verifyToken,
  validateQuery(GetPatternsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { actionType } = req.query as { actionType?: string };
      // const patterns = await ApprovalPatternService.getUserPatterns(req.userId!, actionType);
      // return res.json({ success: true, patterns });
      return res.json({ success: true, patterns: [] });
    } catch (err: any) {
      logger.error('[AI] Get patterns error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// router.get(
//     '/patterns/stats',
//     verifyToken,
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const stats = await ApprovalPatternService.getPatternStats(req.userId!);
//             return res.json(stats);
//         } catch (err: any) {
//             logger.error('[AI] Pattern stats error:', err);
//             return res.status(500).json({ error: (err as Error).message });
//         }
//     }),
// );

// router.patch(
//     '/patterns/:patternId/auto-apply',
//     verifyToken,
//     validateParams(PatternIdParamSchema),
//     validateBody(ToggleAutoApplyRequestSchema),
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const { enabled } = req.body;
//             const result = await ApprovalPatternService.setAutoApply(req.params.patternId, enabled, req.userId!);
//             return res.json(result);
//         } catch (err: any) {
//             logger.error('[AI] Toggle auto-apply error:', err);
//             return res.status(500).json({ success: false, error: (err as Error).message });
//         }
//     }),
// );

// router.delete(
//     '/patterns/:patternId',
//     verifyToken,
//     validateParams(PatternIdParamSchema),
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const result = await ApprovalPatternService.deletePattern(req.params.patternId, req.userId!);
//             return res.json(result);
//         } catch (err: any) {
//             logger.error('[AI] Delete pattern error:', err);
//             return res.status(500).json({ success: false, error: (err as Error).message });
//         }
//     }),
// );

router.post(
  '/actions/:actionId/approve',
  verifyToken,
  validateParams(z.object({ actionId: z.string().uuid() })),
  validateBody(ApproveActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const alwaysApprove = (req.body as any).alwaysApprove;
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.approveAction(
        (req.params as any).actionId,
        req.userId as string,
        {
          alwaysApprove,
        }
      );
      return res.json(result);
    } catch (err: any) {
      logger.error('[AI] Approve action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/actions/:actionId/reject',
  verifyToken,
  validateParams(z.object({ actionId: z.string().uuid() })),
  validateBody(RejectActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { reason, alwaysReject } = req.body as any;
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.rejectAction(
        (req.params as any).actionId,
        req.userId as string,
        reason,
        { alwaysReject }
      );
      return res.json(result);
    } catch (err: any) {
      logger.error('[AI] Reject action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/pending',
  verifyToken,
  validateQuery(GetPendingActionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.query as { projectId?: string };
      const AIActionExecutor = await getAIActionExecutor();
      const actions = await AIActionExecutor.getPendingActions(
        req.userId as string,
        projectId || null,
        req.organizationId as string
      );

      const actionsWithPatterns = await Promise.all(
        (Array.isArray(actions) ? actions : []).map(async (action: Record<string, unknown>) => {
          const patternInfo = await (AIActionExecutor as any).getPatternInfo(
            req.userId as string,
            action.action_type as string,
            (action.payload as Record<string, unknown>) || {}
          );
          return { ...action, patternInfo };
        })
      );

      return res.json({ success: true, actions: actionsWithPatterns });
    } catch (err: any) {
      logger.error('[AI] Get pending actions error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message, actions: [] });
    }
  })
);

// ==================== FEEDBACK & REPORTING ====================

router.post(
  '/feedback',
  verifyToken,
  validateBody(RecordFeedbackRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, rating } = req.body;
    const userId = req.userId!;

    try {
      logger.info(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);

      try {
        const aiLogger = await import('../services/ai/logger.js').then(
          (m) => (m as any).default || m
        );
        await aiLogger.log('feedback', {
          userId,
          messageId,
          rating,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        logger.warn('[AI] Could not log feedback:', (logErr as Error).message);
      }

      // Feed into adaptive response service to learn user preferences
      try {
        const adaptiveMod = await import('../services/ai/adaptiveResponseService.js');
        const adaptiveService =
          (adaptiveMod as any).adaptiveResponseService || (adaptiveMod as any).default;
        if (adaptiveService?.processFeedback) {
          await adaptiveService.processFeedback({
            userId,
            messageId,
            rating,
            lengthFeedback: req.body.lengthFeedback,
            detailFeedback: req.body.detailFeedback,
            formatFeedback: req.body.formatFeedback,
            responseLength: req.body.responseLength,
            conversationId: req.body.conversationId,
            screenContext: req.body.screenContext,
            focusMode: req.body.focusMode,
          });
          logger.debug(`[AI Feedback] Adaptive service updated for user ${userId}`);
        }
      } catch (adaptErr) {
        logger.warn('[AI] Could not update adaptive service:', (adaptErr as Error).message);
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Feedback error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/report',
  verifyToken,
  validateBody(ReportMessageRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, reason } = req.body;
    const userId = req.userId!;

    try {
      logger.error(`[AI REPORT] 🚨 User ${userId} reported message ${messageId}: ${reason}`);

      try {
        const aiLogger = await import('../services/ai/logger.js').then(
          (m) => (m as any).default || m
        );
        await aiLogger.log('report', {
          userId,
          messageId,
          reason,
          timestamp: new Date().toISOString(),
          severity: reason === 'harmful' ? 'critical' : 'warning',
        });
      } catch (logErr) {
        logger.warn('[AI] Could not log report:', (logErr as Error).message);
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Report error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== MEMORY METRICS ====================

router.get(
  '/memory/metrics',
  verifyToken,
  validateQuery(GetMemoryMetricsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      const { period } = req.query as any;

      const metrics = await AIMemoryMetricsService.getDashboardMetrics(req.organizationId!, period);

      return res.json({ success: true, ...metrics });
    } catch (err: any) {
      logger.error('[AI] Memory metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/memory/current',
  verifyToken,
  validateQuery(GetCurrentMemoryQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      const { projectId } = req.query as any;

      const state = await AIMemoryMetricsService.getCurrentMemoryState(
        projectId,
        req.organizationId!
      );

      return res.json({ success: true, ...state });
    } catch (err: any) {
      logger.error('[AI] Current memory state error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/memory/latency',
  verifyToken,
  validateQuery(GetMemoryLatencyQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      const { hours } = req.query as any;

      const latency = await AIMemoryMetricsService.getLatencyPercentiles(
        req.organizationId!,
        hours
      );

      return res.json({ success: true, ...latency });
    } catch (err: any) {
      logger.error('[AI] Latency metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== PROACTIVE SUGGESTIONS ====================

const getProactiveSuggestionsService = async () =>
  (await import('../services/ai/proactiveSuggestionsService.js')).default as any;
const getResponseQualityService = async () =>
  (await import('../services/ai/responseQualityService.js')).default as any;

router.get(
  '/suggestions',
  verifyToken,
  validateQuery(GetSuggestionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, screenContext } = req.query as any;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      const suggestions = await ProactiveSuggestionsService.generateSuggestions({
        userId: req.userId!,
        organizationId: req.organizationId!,
        projectId: projectId || null,
        screenContext: screenContext ? JSON.parse(screenContext) : null,
        recentActions: [],
      });

      return res.json({ success: true, suggestions });
    } catch (err: any) {
      logger.error('[AI] Proactive suggestions error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/suggestions/action',
  verifyToken,
  validateBody(RecordSuggestionActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { suggestionId, action, feedback } = req.body;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      await ProactiveSuggestionsService.recordSuggestionAction(
        suggestionId,
        req.userId!,
        action,
        feedback
      );

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Suggestion action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/suggestions/metrics',
  verifyToken,
  validateQuery(GetSuggestionMetricsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      const metrics = await ProactiveSuggestionsService.getSuggestionMetrics(
        req.organizationId!,
        days
      );

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Suggestion metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== RESPONSE QUALITY ====================

router.post(
  '/quality/calculate',
  verifyToken,
  validateBody(CalculateQualityRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { query, response, context, sources } = req.body;
      const ResponseQualityService = await getResponseQualityService();

      const metrics = await ResponseQualityService.calculateQuality({
        query,
        response,
        context: {
          ...context,
          organizationId: req.organizationId,
        },
        sources: sources || [],
      });

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Quality calculation error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/quality/aggregate',
  verifyToken,
  validateQuery(GetAggregateQualityQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ResponseQualityService = await getResponseQualityService();

      const metrics = await ResponseQualityService.getAggregateMetrics(req.organizationId!, days);

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Aggregate quality metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/quality/trends',
  verifyToken,
  validateQuery(GetQualityTrendsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ResponseQualityService = await getResponseQualityService();

      const trends = await ResponseQualityService.getQualityTrends(req.organizationId!, days);

      return res.json({ success: true, trends });
    } catch (err: any) {
      logger.error('[AI] Quality trends error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==========================================
// GAP-AI-002: SOFT CAP STATUS
// ==========================================

/**
 * GET /api/ai/soft-cap-status
 * Get current soft cap and usage status for the organization
 */
router.get(
  '/soft-cap-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const usageService = (await import('../services/usageService.js')).default;
      const quota = await usageService.checkQuota(orgId, 'token');

      // Soft cap configuration
      const softCapConfig = {
        enabled: true,
        softCapPercentage: 100,
        hardCapPercentage: 150,
        degradedTier: 'BUDGET',
      };

      const status = {
        usage: {
          used: quota.used,
          limit: quota.limit,
          percentage: quota.percentage,
          remaining: quota.remaining,
        },
        softCap: {
          ...softCapConfig,
          isInSoftCap:
            quota.percentage >= softCapConfig.softCapPercentage &&
            quota.percentage < softCapConfig.hardCapPercentage,
          isAtHardCap: quota.percentage >= softCapConfig.hardCapPercentage,
          currentMode:
            quota.percentage >= softCapConfig.hardCapPercentage
              ? 'blocked'
              : quota.percentage >= softCapConfig.softCapPercentage
                ? 'degraded'
                : 'normal',
        },
        recommendations: [] as string[],
      };

      // Add recommendations based on status
      if (status.softCap.currentMode === 'blocked') {
        status.recommendations.push(
          'Your organization has exceeded the hard cap. Please upgrade your plan to continue using AI features.'
        );
      } else if (status.softCap.currentMode === 'degraded') {
        status.recommendations.push(
          'You are in degraded mode. AI responses will use budget-tier models until your usage resets or you upgrade.'
        );
        status.recommendations.push(
          'Consider upgrading your plan for access to premium AI models.'
        );
      } else if (quota.percentage >= 80) {
        status.recommendations.push(
          'You are approaching your token limit. Consider monitoring your usage closely.'
        );
      }

      return res.json({ success: true, ...status });
    } catch (err: any) {
      logger.error('[AI] Soft cap status error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

export default router;
