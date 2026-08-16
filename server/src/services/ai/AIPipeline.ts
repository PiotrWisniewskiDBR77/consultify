/**
 * AI Pipeline Service
 * Enterprise SaaS Architecture - TypeScript Backend AI Pipeline
 *
 * This is the TypeScript migration of the core AI Pipeline.
 * It serves as a pattern for migrating other backend services.
 */

import { buildPersonaPrompt } from '../../ai/persona.js';
import { featureFlags } from '../../config/FeatureFlags.js';
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
import { inferChatTaskPurpose, normalizePurposeKey } from './aiTaskCatalog.js';
import { llmService } from './llmService.js';
import modelRouter from './modelRouter.js';
import { isQaAiMode } from './qaAiRuntime.js';

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
  help: {
    role: 'COACH',
    maxTokens: 4000,
    description: 'Contextual help assistant grounded in knowledge base articles',
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
        releaseBundleId: (modelConfig as any)?.releaseBundleId || null,
        promptKey: (modelConfig as any)?.promptKey || null,
        promptVersion: (modelConfig as any)?.promptVersion || null,
        policyVersion: (modelConfig as any)?.policyVersion || null,
      };

      // 6b. Enforce AI Budgets + Model Permissions (SuperAdmin)
      const budgetsEnabled =
        String(process.env.AI_BUDGETS_ENABLED || '')
          .trim()
          .toLowerCase() !== 'false';
      const orgId = request.organizationId;
      const userId = request.userId;
      const normalizeModelId = (m: string) =>
        String(m || '')
          .split('/')
          .pop() || String(m || '');

      let aiBudgetService: any = null;
      const getAiBudgetService = async () => {
        if (aiBudgetService) return aiBudgetService;
        const mod = (await import('../aiBudgetService.js')) as any;
        aiBudgetService = mod.default || mod.aiBudgetService || mod;
        return aiBudgetService;
      };

      const enforceBudgetsAndPerms = async (provider: string, modelId: string) => {
        if (!budgetsEnabled || !orgId || !userId)
          return { allowed: true, warnings: [] as string[] };
        const svc = await getAiBudgetService();

        // Explicit deny rules (we treat permissions as "deny list" by default)
        try {
          const perms = await svc.getModelPermissions(String(orgId), 'organization', String(orgId));
          const normalized = normalizeModelId(modelId);
          const hit = (perms || []).find(
            (p: any) => p?.modelId === modelId || p?.modelId === normalized
          );
          if (hit && hit.isAllowed === false) {
            throw new Error(`Model not allowed by policy: ${modelId}`);
          }
          if (hit?.maxTokensPerRequest && Number(hit.maxTokensPerRequest) > 0) {
            modelConfig.maxTokens = Math.min(
              modelConfig.maxTokens,
              Number(hit.maxTokensPerRequest)
            );
          }
        } catch (permErr: any) {
          // If permissions table is not available, don't break AI (best-effort).
          // But if we explicitly detected a deny, rethrow.
          const msg = String(permErr?.message || '');
          if (msg.includes('not allowed by policy')) throw permErr;
          logger.warn('[AIPipeline] Model permissions enforcement skipped:', msg.slice(0, 200));
        }

        // Hard-limit: block if already exceeded (projected usage + 0 still exceeds)
        const check = await svc.checkBudget(String(orgId), String(userId), { tokens: 0, cost: 0 });
        if (!check.allowed) {
          throw new Error(`AI budget exceeded: ${(check.warnings || []).join(', ') || 'blocked'}`);
        }
        return check;
      };

      // Check if streaming is requested
      if ((request as any).stream) {
        let systemPromptStr = prompt.find((m) => m.role === 'system')?.content || '';
        const nonSystemMsgs = prompt
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system' | 'tool',
            content: m.content,
          }));

        // "Show reasoning" wiring. When on, we ask llmService to surface the
        // model's native reasoning deltas via onReasoning(); we collect them in
        // an ordered buffer and merge them into the outgoing wrapped stream as
        // tagged { reasoning } chunks (interleaved with plain text chunks). The
        // route distinguishes them and emits a separate SSE 'reasoning' event.
        // When off, reasoningBuffer stays empty and the stream is plain strings —
        // normal chat is byte-for-byte unaffected.
        const streamAiModes =
          (request.options as any)?.aiModes || (request.context as any)?.aiModes;
        const showReasoning = streamAiModes?.showReasoning === true;

        // SPEC_01 (Tryb A): function-calling on the chat stream. The route opts
        // in via options.deliverableTools = { enabled, context: { ..., onDeliverable } }.
        // Disabled when reasoning is on (deepseek-reasoner has no tool support).
        const deliverableTools = (request.options as any)?.deliverableTools;
        const enableDeliverableTools = deliverableTools?.enabled === true && !showReasoning;
        let deliverableToolDefs:
          | Array<{ name: string; description: string; parameters: Record<string, unknown> }>
          | undefined;
        if (enableDeliverableTools) {
          try {
            const mcpModule = await import('./mcpServer.js');
            const mcp = (mcpModule.mcpServer || mcpModule.default) as any;
            await import('./tools/index.js').catch(() => {});
            // Expose BOTH chat-creation tools so the model can choose the right one:
            //   generate_deliverable → document/sheet/deck artifact (canvas)
            //   generate_initiative  → a real DRAFT initiative entity (PMO backbone)
            // Previously only generate_deliverable was passed, so "stwórz inicjatywę"
            // could ONLY become a document — the model literally had no initiative
            // tool to call. The route's deliverableTools.context already carries
            // organizationId/userId/language, which is exactly what generate_initiative
            // needs; callStream runs every passed tool with that same context.
            // Teresa routing-N (naprawa-rN-routing): also expose create_task /
            // create_decision so "stwórz zadanie/decyzję" creates a REAL N-object
            // (a tasks/decisions row) instead of the model falling back to
            // generate_deliverable(type:'document'). Gated on ENABLE_TERESA_
            // RECORD_CREATE (handlers ALSO self-gate — defense in depth). The
            // route's deliverableTools.context already carries organizationId/
            // userId/language/onDeliverable, which is exactly what both handlers
            // need; callStream runs every passed tool with that same context.
            const CHAT_CREATION_TOOLS = new Set([
              'generate_deliverable',
              'generate_initiative',
              ...(featureFlags.ENABLE_TERESA_RECORD_CREATE
                ? ['create_task', 'create_decision']
                : []),
            ]);
            let defs = mcp
              .getToolDefinitions()
              .filter((d: { name: string }) => CHAT_CREATION_TOOLS.has(d.name));

            // ── Teresa routing-N · BUG1 — deterministic pre-classification ──────
            // Description-only steering is probabilistic: on RICH "stwórz
            // inicjatywę: <200-word brief>" prompts the model drifts to
            // generate_deliverable(type:'doc'). When the user's OWN words
            // explicitly ask to create an OBJECT (inicjatywa/zadanie/decyzja),
            // we REMOVE generate_deliverable for this turn so the model *cannot*
            // fall back to a document — it can only call the matching object tool
            // (which is present in defs) or answer in text. The rich brief then
            // lands in the object's fields (problem/description), not a doc.
            try {
              const { classifyChatCreationIntent, INTENT_TO_TOOL, INTENT_DROP_TOOLS } =
                await import('./chatCreationIntent.js');
              const lastUser = [...nonSystemMsgs].reverse().find((m) => m.role === 'user')?.content;
              const intent = classifyChatCreationIntent(String(lastUser || ''));
              if (intent) {
                const forcedTool = INTENT_TO_TOOL[intent];
                const hasForced = defs.some((d: { name: string }) => d.name === forcedTool);
                if (hasForced) {
                  // Drop the tools that would let the model route AROUND the forced
                  // one. For object intents that's generate_deliverable (no doc
                  // fallback); for a 'document' intent (wniosek/insight/raport) it's
                  // the OBJECT creators, so "wygeneruj wniosek" can NEVER become an
                  // empty-skeleton initiative (sędzia score 44).
                  const dropSet = new Set(INTENT_DROP_TOOLS[intent] || []);
                  const before = defs.length;
                  defs = defs.filter((d: { name: string }) => !dropSet.has(d.name));
                  logger.info(
                    `[AIPipeline] routing-N pre-classify intent=${intent} → forcing ${forcedTool}, dropped [${[
                      ...dropSet,
                    ].join(', ')}] (${before}→${defs.length} tools)`
                  );

                  // c2MindTable — 'table' intent needs MORE than a tool-drop: the
                  // global persona instructs the model to answer a "zrób tabelę …"
                  // request with an INLINE ```artifact:table``` markdown block
                  // (a static table, NOT a real Ideas Table). Dropping distractor
                  // tools does not beat that default, so we inject a per-turn
                  // directive (system prompt is NOT the global persona.ts — this is
                  // additive, one turn only) that forces the tool call.
                  if (intent === 'table') {
                    systemPromptStr +=
                      '\n\n[NADPISANIE NA TĘ TURĘ] Użytkownik prosi o UTWORZENIE TABELI. ' +
                      'MUSISZ wywołać narzędzie generate_deliverable z type="table" (realna Tabela Pomysłów), ' +
                      'aby otworzyła się po prawej. NIE odpowiadaj tabelą Markdown w treści ani blokiem ' +
                      '```artifact:table``` — to nie tworzy prawdziwej tabeli. Najpierw wywołaj narzędzie, ' +
                      'potem krótko potwierdź. / [OVERRIDE THIS TURN] The user asks to CREATE A TABLE. You MUST ' +
                      'call the generate_deliverable tool with type="table" so a real Ideas Table opens; do NOT ' +
                      'reply with an inline Markdown table or an ```artifact:table``` block.';
                    logger.info(
                      '[AIPipeline] routing-N table intent → injected force-tool directive'
                    );
                  }
                }
              }
            } catch (classifyErr: any) {
              logger.debug(
                `[AIPipeline] routing-N pre-classify skipped: ${String(
                  classifyErr?.message || classifyErr
                ).slice(0, 120)}`
              );
            }

            if (defs.length > 0) deliverableToolDefs = defs;
          } catch (e: any) {
            logger.warn(
              `[AIPipeline] deliverable tool wiring skipped: ${String(e?.message || e).slice(0, 160)}`
            );
          }
        }

        // Z4 transport (fala „Teresa steruje Ideą przez rejestr") — narzędzia
        // akcji OTWARTEJ reprezentacji Idei. Route opt-in przez
        // options.ideaTools = { defs, context: { onClientToolCall } }, gated
        // route-side na featureFlags.ENABLE_TERESA_IDEA_ACTIONS (default OFF).
        // Wyłączone przy reasoningu (jak deliverable). Wykonanie NIE jest
        // serwerowe — patrz `clientTools` w llmService.callStream.
        const ideaTools = (request.options as any)?.ideaTools;
        let ideaClientToolDefs:
          | Array<{ name: string; description: string; parameters: Record<string, unknown> }>
          | undefined;
        if (!showReasoning && Array.isArray(ideaTools?.defs) && ideaTools.defs.length > 0) {
          ideaClientToolDefs = ideaTools.defs;
          logger.info(`[AIPipeline] idea-action client tools: ${ideaTools.defs.length}`);
        }

        // Try primary model, with automatic cross-provider fallback on failure.
        // Important: having multiple API keys (e.g. OpenAI + Gemini) must actually enable failover.
        const tierForFallback = ((request.options as any)?.selectedTier || 'STANDARD') as any;
        const fallbackChain: string[] =
          typeof (modelRouter as any).getFallbackChain === 'function'
            ? ((modelRouter as any).getFallbackChain(tierForFallback) as string[])
            : [];

        // "Show reasoning" → reasoning model. gpt-4o (our STANDARD default) does
        // NOT emit a reasoning trace, so the toggle was a no-op. When showReasoning
        // is on we PREPEND deepseek-reasoner (DeepSeek-R1) as the preferred
        // candidate: it always emits delta.reasoning_content, which callStream
        // surfaces as a native reasoning channel. This only re-orders the candidate
        // list for the reasoning-on streaming chat path; if deepseek is not
        // configured (no API key) the per-candidate `isConfigured` guard below
        // skips it and we fall through to the normal model + the soft <thinking>
        // fallback. Normal chat (showReasoning off) is untouched.
        const reasoningPreferredModelId = 'deepseek-reasoner';
        const candidateModelIds = Array.from(
          new Set(
            [
              ...(showReasoning ? [reasoningPreferredModelId] : []),
              modelConfig.model,
              ...fallbackChain,
            ].filter(Boolean)
          )
        ) as string[];

        let usedProvider = modelConfig.provider;
        let usedModel = modelConfig.model;
        let streamResponse: Record<string, unknown> | null = null;
        let lastError: Error | null = null;

        // Sink presence is what ENABLES the reasoning path in llmService.callStream
        // (wantsReasoning = !!onReasoning && !!reasoning). Reasoning deltas are now
        // yielded INLINE on the returned stream as `{ reasoning }` objects in real
        // arrival order, so this sink no longer needs to buffer anything — it's a
        // no-op kept only to flip the reasoning path on. A defensive no-op body
        // also guarantees a sink error can never break the answer stream.
        const onReasoningDelta = showReasoning
          ? (_delta: string) => {
              /* reasoning is streamed inline; nothing to buffer here */
            }
          : undefined;

        for (const candidateModelId of candidateModelIds) {
          try {
            const cfg = await modelRouter.getProviderConfig(candidateModelId, tierForFallback);
            const providerId = String((cfg as any)?.provider || '');
            const modelId = String((cfg as any)?.id || candidateModelId);
            const apiKey = (cfg as any)?.apiKey;
            const endpoint = (cfg as any)?.endpoint;

            const isConfigured =
              isQaAiMode() ||
              providerId.toLowerCase() === 'ollama' ||
              (typeof apiKey === 'string' && apiKey.trim().length > 0);
            if (!isConfigured) {
              logger.info(`[AIPipeline] Skipping unconfigured fallback: ${providerId}/${modelId}`);
              continue;
            }

            await enforceBudgetsAndPerms(providerId, modelId);

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
              abortSignal: request.abortSignal,
              timeoutMs: 60_000,
              // Reasoning: request medium-effort native thinking and a sink to
              // capture the deltas. No-ops on providers without reasoning support.
              ...(showReasoning
                ? { reasoning: { effort: 'medium' as const }, onReasoning: onReasoningDelta }
                : {}),
              // SPEC_01 (Tryb A): pass the deliverable tool + emit context when
              // enabled. callStream registers it and the model can call it to
              // create+open an artifact mid-stream.
              // Z4 transport: dokładamy `clientTools` (akcje otwartej Idei) i
              // scalamy `onClientToolCall` do wspólnego kontekstu. Kontekst musi
              // nieść OBA callbacki: onDeliverable (mcp) i onClientToolCall (Idea).
              ...(deliverableToolDefs || ideaClientToolDefs
                ? {
                    ...(deliverableToolDefs ? { tools: deliverableToolDefs } : {}),
                    ...(ideaClientToolDefs ? { clientTools: ideaClientToolDefs } : {}),
                    context: {
                      ...((deliverableTools?.context as Record<string, unknown>) || {}),
                      ...(ideaTools?.context
                        ? {
                            onClientToolCall: (ideaTools.context as any)?.onClientToolCall,
                          }
                        : {}),
                    },
                    maxIterations: 4,
                  }
                : {}),
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

        // QA-2026-06-10: this branch used to return the stream WITHOUT ever
        // calling logRequest — the main streamed chat call (most AI traffic)
        // produced no ai_usage_logs row at all, and budgets only got a request
        // count. Wrap the stream so that once it is consumed (or aborted) we
        // log real provider usage (resolved by the AI SDK after the final
        // chunk; OpenRouter/OpenAI surface it via stream usage), falling back
        // to a ~4 chars/token estimate (same heuristic as preflightCostService).
        const usagePromise = (streamResponse as { usagePromise?: Promise<TokenUsage | undefined> })
          .usagePromise;
        const finalizeStreamUsage = async (streamedText: string) => {
          let usage: TokenUsage | undefined;
          if (usagePromise) {
            // The usage promise settles only when the provider stream ends; on
            // client disconnect it may never settle — give it a 2s grace window.
            usage = await Promise.race([
              usagePromise,
              new Promise<undefined>((resolve) => {
                const t = setTimeout(() => resolve(undefined), 2000);
                (t as any).unref?.();
              }),
            ]).catch(() => undefined);
          }
          if (!usage || (!(usage.promptTokens > 0) && !(usage.completionTokens > 0))) {
            const { estimateTokenUsage } = await import('./tokenUsage.js');
            const inputChars = prompt.reduce((n, m) => n + (m?.content?.length || 0), 0);
            usage = estimateTokenUsage(inputChars, streamedText.length);
          }

          try {
            await this.logRequest(request, { content: '', usage }, Date.now() - startTime, traceId);
          } catch {
            /* best-effort */
          }

          if (budgetsEnabled && orgId && userId) {
            try {
              const svc = await getAiBudgetService();
              await svc.recordUsage(String(orgId), String(userId), {
                model: normalizeModelId(String(usedModel || '')),
                inputTokens: usage.promptTokens,
                outputTokens: usage.completionTokens,
                requestCount: 1,
              });
            } catch (e: any) {
              logger.warn(
                '[AIPipeline] Streaming budget record failed:',
                String(e?.message || e || '').slice(0, 200)
              );
            }
          }
        };

        type StreamItem = string | { reasoning: string };
        const innerStream = (streamResponse as { stream?: AsyncIterable<StreamItem> }).stream;
        if (innerStream) {
          // llmService.callStream now yields a MIXED stream when reasoning is on:
          // visible answer text as plain strings interleaved with `{ reasoning }`
          // objects, in real arrival order. We pass items straight through so the
          // route emits SSE `{type:'reasoning'}` the moment each delta arrives —
          // for DeepSeek-R1 (whole trace before text) this streams the trace live
          // during the thinking phase instead of dumping it as one pre-answer
          // block. No buffering. When showReasoning is off only strings flow
          // (unchanged contract). streamedText accumulates ONLY text strings so
          // finalizeStreamUsage's token estimate excludes reasoning.
          const wrapped = (async function* () {
            let streamedText = '';
            try {
              for await (const chunk of innerStream) {
                if (typeof chunk === 'string') streamedText += chunk;
                yield chunk;
              }
            } finally {
              // Fires on normal completion AND consumer break/abort.
              // Fire-and-forget: never block or fail the stream teardown.
              finalizeStreamUsage(streamedText).catch(() => undefined);
            }
          })();
          (streamResponse as any).stream = wrapped;
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
      await enforceBudgetsAndPerms(modelConfig.provider, modelConfig.model);
      const response = await this.executeWithProvider(
        request,
        prompt,
        modelConfig,
        request.options
      );

      // 8. Post-process response
      const processedResponse = await this.postProcess(response, capability);

      // 8b. Record budget usage (best-effort)
      try {
        if (budgetsEnabled && orgId && userId) {
          const svc = await getAiBudgetService();
          const usage = (processedResponse as any)?.usage;
          const usedModelNorm = normalizeModelId(String(modelConfig.model || ''));
          await svc.recordUsage(String(orgId), String(userId), {
            model: usedModelNorm,
            inputTokens: Number(usage?.promptTokens || 0) || 0,
            outputTokens: Number(usage?.completionTokens || 0) || 0,
            requestCount: 1,
          });
        }
      } catch (e: any) {
        logger.warn(
          '[AIPipeline] Budget record failed:',
          String(e?.message || e || '').slice(0, 200)
        );
      }

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

      // 7. Execute streaming (capture usage so the usage log isn't zeroed out)
      const streamResult = await this.executeStreamingWithProvider(
        prompt,
        modelConfig,
        request.options,
        onChunk
      );

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

      // 9. Best-effort usage log — now with usage captured from the stream (QA-2026-06-09).
      await this.logRequest(
        request,
        { content: '', usage: streamResult?.usage },
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

      const memoryReadAllowed = Boolean(
        memoryEnabled && !isPrivateMode && retentionMode !== 'none'
      );
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

        // i18n-teresa fix 2026-04-18: propagate authoritative UI language
        const authoritativeLanguageDT =
          (request as any)?.options?.language ||
          (request.context as any)?.language ||
          (lightContext as any)?.conversationLanguage ||
          (lightContext as any)?.userMemory?.preferences?.language ||
          'en';
        (lightContext as any).conversationLanguage = String(authoritativeLanguageDT).split('-')[0];

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

        // Per-project brief (composer #5): if this conversation belongs to a chat
        // project with custom instructions, append them to Teresa's system prompt.
        // Applied regardless of private mode — it's task framing the user explicitly
        // set on the project, not inferred personal memory.
        try {
          const convIdForProject =
            (request.context as any)?.conversationId ||
            (request as any)?.conversationId ||
            (request.options as any)?.conversationId ||
            null;
          if (convIdForProject) {
            const { get: dbGet } = await import('../../utils/DbPromise.js');
            const row = (await dbGet(
              `SELECT p.custom_instructions AS ci
               FROM conversations c
               JOIN chat_projects p ON p.id = c.chat_project_id
               WHERE c.id = ?`,
              [convIdForProject]
            )) as { ci?: string } | null;
            const projectCi = row?.ci ? String(row.ci).trim().slice(0, 2000) : '';
            if (projectCi) {
              customInstructions = customInstructions
                ? `${customInstructions}\n\n[Project brief] ${projectCi}`
                : `[Project brief] ${projectCi}`;
            }

            // F3: append the project's TEXT knowledge snippets (file knowledge is
            // handled as RAG scope in the chat route). Capped so the prompt stays sane.
            try {
              const { all: dbAll } = await import('../../utils/DbPromise.js');
              const kRows = (await dbAll(
                `SELECT k.title, k.content
                 FROM conversations c
                 JOIN project_knowledge k ON k.project_id = c.chat_project_id
                 WHERE c.id = ? AND k.kind = 'text' AND k.content IS NOT NULL
                 ORDER BY k.added_at DESC
                 LIMIT 12`,
                [convIdForProject]
              )) as Array<{ title?: string; content?: string }>;
              const snippets = (kRows || [])
                .map((r) => {
                  const body = String(r.content || '').trim();
                  if (!body) return '';
                  const ttl = r.title ? `${String(r.title).trim()}: ` : '';
                  return `- ${ttl}${body}`;
                })
                .filter(Boolean)
                .join('\n')
                .slice(0, 4000);
              if (snippets) {
                customInstructions =
                  `${customInstructions || ''}\n\n[Project knowledge]\n${snippets}`.trim();
              }
            } catch {
              // project_knowledge may not exist yet — skip silently.
            }
          }
        } catch {
          // chat_projects.custom_instructions may not exist yet — skip silently.
        }

        // Resolve authoritative UI language for this request.
        // Order of precedence (i18n-teresa fix 2026-04-18):
        //   1. request.options.language / request.context.language    (explicit UI locale)
        //   2. ctx.conversationLanguage                                (existing thread language)
        //   3. userMemory.preferences.language                         (sticky profile pref)
        //   4. 'en' fallback (NOT 'pl' — previously defaulted to Polish)
        const authoritativeLanguage =
          (request as any)?.options?.language ||
          (request.context as any)?.language ||
          (fullContext as any)?.conversationLanguage ||
          userMemory?.preferences?.language ||
          'en';

        // Merge memory into context
        const contextWithMemory = {
          ...fullContext,
          conversationLanguage: String(authoritativeLanguage).split('-')[0],
          userMemory: userMemory
            ? {
                preferences: userMemory.preferences,
                expertise: userMemory.expertise?.slice(0, 10),
                // chat-scoping fix (feedback #4408f355 Quick savings context bleed):
                // recentTopics is a GLOBAL per-user rollup across ALL conversations and orgs,
                // so passing it to the LLM makes Teresa answer about topics from unrelated
                // sessions (cross-conversation / cross-org leak). Drop it from runtime context;
                // if a future "global memory" feature returns, it must be explicitly opt-in
                // and scoped per-org.
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
      const fallbackContext: any = { ...(request.context || {}) };
      // i18n-teresa fix 2026-04-18: still propagate authoritative language in fallback
      const authoritativeLanguageFallback =
        (request as any)?.options?.language ||
        fallbackContext?.language ||
        fallbackContext?.conversationLanguage ||
        'en';
      fallbackContext.conversationLanguage = String(authoritativeLanguageFallback).split('-')[0];
      return {
        context: fallbackContext,
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

    // Dedicated system instruction mode: when a caller provides systemInstruction
    // AND sets dedicatedSystemPrompt=true, use ONLY that instruction as the system
    // prompt (skip persona, org context, etc.). Used by WorkbookGeneratorService, etc.
    const dedicatedMode =
      !!(request.options as any)?.dedicatedSystemPrompt &&
      (request.options as any)?.systemInstruction;

    let systemPrompt: string;
    if (dedicatedMode) {
      systemPrompt = (request.options as any).systemInstruction;
    } else {
      // Build intelligent system prompt based on context
      systemPrompt = await this.buildSystemPrompt(capability, ctx, request);

      // Add custom system instruction if provided
      if ((request.options as any)?.systemInstruction) {
        systemPrompt += `\n\n${(request.options as any).systemInstruction}`;
      }
    }

    // Integrate adaptive style preferences (v2.0)
    // Deep Thinking autonomy: skip (pulls user/system preferences outside the conversation).
    // Dedicated mode: skip all post-processing to keep the system prompt pristine.
    const aiModes = (request.options as any)?.aiModes || (ctx as any)?.aiModes;
    if (!aiModes?.deepResearch && !dedicatedMode) {
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
    // Dedicated mode: skip to keep the system prompt pristine.
    if (request.organizationId && !ctx?._promptSsotUsed && !dedicatedMode) {
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
    let history = request.history || (request as any).messages || [];

    // A0 memory fix — server-side history rehydration.
    // When the client sends no history but we have a conversationId, load the recent
    // turns from conversation_messages so Teresa keeps in-conversation memory even on
    // fresh page loads / API clients that don't replay history.
    if (!history || history.length === 0) {
      const conversationId =
        (request.context as any)?.conversationId ||
        (request as any)?.conversationId ||
        (request.options as any)?.conversationId ||
        null;
      if (conversationId) {
        try {
          const dbMod = await import('../../utils/DbPromise.js');
          const rows = (await (dbMod as any).all(
            `SELECT content, role FROM conversation_messages
             WHERE conversation_id = ?
             ORDER BY created_at DESC LIMIT 12`,
            [conversationId]
          )) as Array<{ content?: string; role?: string }>;
          if (Array.isArray(rows) && rows.length > 0) {
            // rows are newest-first; reverse to chronological order for the prompt
            history = rows
              .reverse()
              .filter((r) => r?.content)
              .map((r) => ({
                role: r.role === 'ai' || r.role === 'model' ? 'assistant' : 'user',
                content: String(r.content),
              }));
            logger.debug(
              `[AIPipeline] Rehydrated ${history.length} history turns from conversation ${conversationId}`
            );
          }
        } catch (rehydrateErr: any) {
          logger.debug(
            `[AIPipeline] History rehydration skipped: ${rehydrateErr?.message || rehydrateErr}`
          );
        }
      }
    }

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
            parts.push(
              this.buildRoleSection(capability, ctx?.currentScreen, conversationLang, request)
            );
          }
        } else {
          parts.push(
            this.buildRoleSection(capability, ctx?.currentScreen, conversationLang, request)
          );
        }
      } else {
        parts.push(
          this.buildRoleSection(capability, ctx?.currentScreen, conversationLang, request)
        );
      }
    } catch (err: any) {
      logger.debug(`[AIPipeline] Prompt SSOT unavailable, using persona prompt: ${err?.message}`);
      parts.push(this.buildRoleSection(capability, ctx?.currentScreen, conversationLang, request));
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
    // i18n-teresa fix 2026-04-18: DO NOT inject `preferences.language` into the prompt.
    // It used to be rendered in Polish as "Preferowany język: pl", which the LLM treated as
    // an authoritative user preference and overrode the UI locale (EN) with Polish output —
    // even literally quoting "preferowany język to polski". The authoritative language is
    // now enforced exclusively via the strict LANGUAGE INSTRUCTION block below.
    if (ctx?.userMemory) {
      const um = ctx.userMemory;
      const memParts: string[] = ['## PREFERENCJE UŻYTKOWNIKA'];
      if (um.preferences?.communicationStyle)
        memParts.push(`- Styl komunikacji: ${um.preferences.communicationStyle}`);
      if (um.preferences?.detailLevel)
        memParts.push(`- Poziom szczegółowości: ${um.preferences.detailLevel}`);
      if (um.expertise?.length > 0) memParts.push(`- Ekspertyza: ${um.expertise.join(', ')}`);
      // chat-scoping fix 2026-04-18 (feedback #4408f355 Quick savings context bleed):
      // DO NOT render `recentTopics`. It is a cross-conversation / cross-org user-level
      // rollup and caused Teresa to pull content from other sessions (privacy + scoping
      // regression). Conversation-local context is already supplied via history + RAG.
      if (um.interactionCount)
        memParts.push(`- Liczba dotychczasowych interakcji: ${um.interactionCount}`);
      if (memParts.length > 1) parts.push(memParts.join('\n'));
    }

    // 4.5b. Custom instructions (user-defined via AI preferences UI)
    if (ctx?.customInstructions) {
      parts.push(`## INSTRUKCJE UŻYTKOWNIKA (Custom Instructions)\n${ctx.customInstructions}`);
    }

    // 4.5c. User AI Settings → shape Teresa's behavior (response style, tone, proactivity)
    // These are persisted via /api/ai-settings/user and loaded by AIContextBuilder.
    if (ctx?.aiSettings) {
      const s = ctx.aiSettings;
      const settingsParts: string[] = [];
      if (s.response_style || s.responseStyle) {
        settingsParts.push(`- Response style: ${s.response_style || s.responseStyle}`);
      }
      if (s.writing_tone || s.writingTone) {
        settingsParts.push(`- Writing tone: ${s.writing_tone || s.writingTone}`);
      }
      if (s.proactivity_mode || s.proactivityMode) {
        settingsParts.push(`- Proactivity: ${s.proactivity_mode || s.proactivityMode}`);
      }
      if (s.custom_instructions || s.customInstructions) {
        settingsParts.push(
          `- Additional instructions: ${s.custom_instructions || s.customInstructions}`
        );
      }
      if (settingsParts.length > 0) {
        parts.push(`## PREFERENCJE AI UŻYTKOWNIKA (from Settings)\n${settingsParts.join('\n')}`);
      }
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
            surface: 'ai_recommendations',
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

    // 9. Strict LANGUAGE INSTRUCTION (i18n-teresa fix 2026-04-18).
    //    Appended LAST so it is the most recent / highest-priority directive the LLM sees.
    //    Mirrors the non-negotiable language policy used in /chat/stream & /chat/confirm routes.
    const langBaseFinal = conversationLang ? String(conversationLang).split('-')[0] : 'en';
    const languageLabelMap: Record<string, string> = {
      pl: 'Polish (Polski)',
      en: 'English',
      de: 'German (Deutsch)',
      es: 'Spanish (Español)',
      ja: 'Japanese (日本語)',
      jp: 'Japanese (日本語)',
      ar: 'Arabic (العربية)',
    };
    const langLabel = languageLabelMap[langBaseFinal] || 'English';
    parts.push(
      `[LANGUAGE INSTRUCTION: You MUST always respond in ${langLabel}. This is the user's chosen application language and takes absolute priority over any other hint (memory, organization terminology, prior conversation). Even if the user writes their message in a different language, your response must be in ${langLabel}. Never mix languages within a single response. This is non-negotiable.]`
    );

    return parts.filter(Boolean).join('\n\n');
  }

  private buildRoleSection(
    capability: AICapability,
    currentScreen?: string | null,
    language?: string | null,
    request?: AIPipelineRequest
  ): string {
    // Use unified persona with screen-aware emphasis, language + user steering
    // (responseStyle + free-text customInstructions — "how Teresa should answer").
    const opts = (request?.options as any) || {};
    const rctx = (request?.context as any) || {};
    const responseStyle = opts.responseStyle ?? rctx.responseStyle;
    const customInstructions = opts.customInstructions ?? rctx.customInstructions;
    return buildPersonaPrompt(currentScreen, language, { responseStyle, customInstructions });
  }

  private buildOrganizationSection(org: any): string {
    if (!org) return '';

    const p = org.profile;
    const s = org.strategic;
    const sys = org.systems;
    const ops = org.operations;

    const lines = [
      '## ORGANIZACJA',
      `- Nazwa: ${org.organizationName || p?.companyName || 'Nieznana'}`,
      p?.organizationType ? `- Typ organizacji: ${p.organizationType}` : '',
      org.industry || p?.industry
        ? `- Branża: ${org.industry || p?.industry}${p?.industrySubsector ? ` / ${p.industrySubsector}` : ''}`
        : '',
      p?.companySize
        ? `- Skala: ${p.companySize}${p.employeeCount ? ` (${p.employeeCount} pracowników)` : ''}${p.annualRevenue ? `, przychód: ${p.annualRevenue}` : ''}`
        : '',
      s?.growthStage ? `- Etap wzrostu: ${s.growthStage}` : '',
      s?.competitivePosition ? `- Pozycja konkurencyjna: ${s.competitivePosition}` : '',
      `- Aktywne projekty: ${org.activeProjectCount || 0}`,
      `- Poziom dojrzałości PMO: ${org.pmoMaturityLevel || 'BASIC'}`,
    ];

    if (s?.priorities?.length > 0) {
      lines.push(`- Priorytety strategiczne: ${s.priorities.join(', ')}`);
    }
    if (s?.mission) {
      lines.push(`- Misja: ${s.mission}`);
    }
    if (sys?.stack?.length > 0) {
      lines.push(`- Stack technologiczny: ${sys.stack.join(', ')}`);
    }
    if (sys?.coreSystems?.length > 0) {
      lines.push(`- Systemy core: ${sys.coreSystems.join(', ')}`);
    }
    if (sys?.cloudAdoption) {
      lines.push(`- Cloud: ${sys.cloudAdoption}`);
    }
    if (ops?.constraints?.length > 0) {
      lines.push(`- Ograniczenia: ${ops.constraints.slice(0, 5).join(', ')}`);
    }
    if (s?.riskAppetite) {
      lines.push(`- Apetyt na ryzyko: ${s.riskAppetite}`);
    }
    if (p?.revenueModel) {
      lines.push(`- Model przychodowy: ${p.revenueModel}`);
    }
    if (ops?.deliveryModel) {
      lines.push(`- Model dostarczania: ${ops.deliveryModel}`);
    }
    if (ops?.productionArchetype) {
      lines.push(`- Archetyp produkcji: ${ops.productionArchetype}`);
    }
    if (ops?.shiftPattern) {
      lines.push(`- System zmianowy: ${ops.shiftPattern}`);
    }
    if (ops?.automationLevel) {
      lines.push(`- Poziom automatyzacji: ${ops.automationLevel}`);
    }
    if (p?.communicationStyle) {
      lines.push(`- Styl komunikacji: ${p.communicationStyle}`);
    }
    if (p?.industryJargonLevel) {
      lines.push(`- Żargon branżowy: ${p.industryJargonLevel}`);
    }

    if (org.terminology && Object.keys(org.terminology).length > 0) {
      lines.push('', '### Terminologia organizacji (używaj tych terminów):');
      for (const [term, definition] of Object.entries(org.terminology)) {
        lines.push(`- **${term}**: ${definition}`);
      }
    }

    if (org.orgPatterns && org.orgPatterns.length > 0) {
      lines.push('', '### Wzorce organizacyjne (learned from past projects):');
      for (const p of org.orgPatterns.slice(0, 3)) {
        lines.push(`- [${p.type}] ${p.title}: ${p.content}`);
      }
    }

    // Feedback #1b81d375 / #30592ee0 — surface interview findings that were
    // already computed by OrganizationContextService (P10 insights with
    // confidence tags) so Teresa can reason about them instead of replying
    // "nie mam danych".
    const findings: string[] = Array.isArray(org?.signals?.interviewFindingsFormatted)
      ? (org.signals.interviewFindingsFormatted as string[])
      : [];
    if (findings.length > 0) {
      lines.push('', '### Ustalenia z wywiadów (zatwierdzone insighty):');
      for (const f of findings.slice(0, 8)) {
        lines.push(`- ${f}`);
      }
    }

    // Feedback #1b81d375 / #2f5803b0 / #30592ee0 / #fa158b06 — raw snapshot
    // of the tenant's collected context (Q&As, uploaded evidence, manual
    // notes, document extractions). Previously we had the data sitting in
    // `organization_context_items` but never surfaced it to the prompt, so
    // Teresa couldn't cite VTS/Atelier answers or attached files even when
    // they existed.
    const snap = org?.contextItemsSample as
      | {
          interviewAnswers?: Array<{ question: string; answer: string; updatedAt: string }>;
          evidence?: Array<{ title: string; fileType?: string; updatedAt: string }>;
          manualNotes?: Array<{ title: string; snippet: string; updatedAt: string }>;
          documentExtractions?: Array<{ title: string; snippet: string; updatedAt: string }>;
          totalItems?: number;
          lastUpdated?: string | null;
        }
      | undefined;
    if (snap) {
      const snapLines: string[] = [
        '',
        '### Dane zebrane od organizacji (wywiady, dowody, notatki)',
      ];
      if (Array.isArray(snap.interviewAnswers) && snap.interviewAnswers.length > 0) {
        snapLines.push('#### Ostatnie odpowiedzi z wywiadów:');
        for (const qa of snap.interviewAnswers) {
          snapLines.push(`- **P:** ${qa.question}`);
          snapLines.push(`  **O:** ${qa.answer}`);
        }
      }
      if (Array.isArray(snap.evidence) && snap.evidence.length > 0) {
        snapLines.push('#### Załączone dowody / pliki:');
        for (const ev of snap.evidence) {
          const typeHint = ev.fileType ? ` (${ev.fileType})` : '';
          snapLines.push(`- ${ev.title}${typeHint}`);
        }
      }
      if (Array.isArray(snap.manualNotes) && snap.manualNotes.length > 0) {
        snapLines.push('#### Notatki ręczne:');
        for (const note of snap.manualNotes) {
          snapLines.push(`- ${note.title}: ${note.snippet}`);
        }
      }
      if (Array.isArray(snap.documentExtractions) && snap.documentExtractions.length > 0) {
        snapLines.push('#### Wyciągi z dokumentów:');
        for (const doc of snap.documentExtractions) {
          snapLines.push(`- ${doc.title}: ${doc.snippet}`);
        }
      }
      // Only push the section if at least one bucket produced content.
      if (snapLines.length > 2) {
        snapLines.push(
          `_Łącznie zebranych wpisów: ${snap.totalItems ?? 'n/d'}. Korzystaj z tych danych cytując pytanie/źródło, gdy odpowiadasz._`
        );
        lines.push(...snapLines);
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
    // i18n-teresa fix 2026-04-18: rules 5-7 previously told the model to respond in the
    // language the user WROTE in, which directly contradicted the strict LANGUAGE INSTRUCTION
    // appended later. Replaced with a single rule that defers to the authoritative block.
    const instructions: string[] = [
      '## INSTRUKCJE',
      '1. Odpowiadaj konkretnie i pomocnie, wykorzystując powyższy kontekst.',
      '1.1. Zasada jakości (CHAT): Nie odmawiaj tylko dlatego, że brakuje danych lub źródeł. Jeśli nie masz pewności: (a) podaj 2–5 hipotez, (b) zaznacz założenia, (c) zadaj maks. 3 pytania doprecyzowujące, (d) zaproponuj jak zweryfikować (np. wklejenie linku/fragmentu/plików).',
      '1.2. Prosty chat: dla zwykłych pytań produktowych odpowiadaj w 4–8 zdaniach, profesjonalnie i rzeczowo. Bez sztucznych sekcji procesu, bez technicznego żargonu i bez ciężkich zastrzeżeń, jeśli evidence policy ich nie wymaga.',
      '1.3. Product assistant: gdy użytkownik pyta jak coś zrobić w aplikacji, odpowiedz praktycznie: wskaż moduł, orientacyjną ścieżkę w UI, ograniczenia i następny krok. Nie odpowiadaj ogólną wiedzą biznesową, jeśli pytanie dotyczy funkcji produktu.',
      '2. Jeśli użytkownik pyta o swoje zadania lub inicjatywy, odwołuj się do danych z sekcji KONTEKST UŻYTKOWNIKA.',
      '3. Proponuj konkretne działania bazując na aktualnym stanie pracy użytkownika.',
      '4. Jeśli są blokery lub problemy, proaktywnie oferuj pomoc w ich rozwiązaniu.',
      "5. LANGUAGE POLICY: You support Polish (pl), English (en), German (de), Spanish (es), Arabic (ar) and Japanese (ja). ALWAYS respond in the single language specified by the final [LANGUAGE INSTRUCTION] block — do NOT auto-detect from the user's input and do NOT mix languages within one response. Natural, idiomatic output in the selected language is required.",
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

    // "Show reasoning" — native reasoning is now wired through the model client.
    //
    // The streaming path in process() requests model-level reasoning via
    // llmService.callStream({ reasoning, onReasoning }) (CallParams.reasoning →
    // per-provider providerOptions: OpenAI reasoningEffort, Anthropic thinking
    // budget, Google thinkingConfig). Reasoning deltas are streamed to the client
    // as separate SSE `{type:'reasoning'}` events. The soft <thinking> instruction
    // below is RETAINED as a fallback: it covers the non-streaming path
    // (extractThinkingSteps parses <thinking> tags) and providers/models with no
    // native reasoning support, where the native channel emits nothing.
    if (aiModes?.showReasoning) {
      if (aiModes?.deepResearch) {
        instructions.push(
          '10. MODE: Reasoning ON (Deep Thinking) — add a "Reasoning highlights" section (3–6 bullet points) with high-level observations: key assumptions, trade-offs, why the recommendation makes sense. Do NOT use <thinking> tags and do NOT reveal chain-of-thought.'
        );
      } else {
        instructions.push(
          '10. MODE: Reasoning ON — You MUST begin your reply with a reasoning section, ' +
            'and it MUST be the very first thing you output. Format it EXACTLY as: ' +
            '<thinking>\n- ...\n- ...\n</thinking> followed by the normal answer. ' +
            'This is mandatory on EVERY reply in this mode, even for short or simple questions — ' +
            'never skip the <thinking> block and never omit the closing </thinking> tag. ' +
            'Inside it, give 3-8 concise bullet points: what assumptions you made, what alternatives ' +
            'you considered, why you chose this path, and what could change your recommendation. ' +
            'Be specific and substantive. Do not reveal sensitive data.'
        );
      }
    } else {
      instructions.push('10. MODE: Reasoning OFF — do not use <thinking>...</thinking> tags.');
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

    // C8.3: Behavioral guardrails — governed mutations only (proposal-first, never silent)
    instructions.push(
      '13. ZASADA BEZPIECZEŃSTWA: Nie wykonujesz samodzielnych mutacji danych (no silent writes). ' +
        'Gdy użytkownik prosi o utworzenie/zmianę (np. Canvas, dokument, inicjatywa, zadanie, decyzja), NIE odmawiaj takiej intencji. ' +
        'Zamiast tego przygotuj proposal do zatwierdzenia i jasno poproś o akceptację wykonania. ' +
        'Każda modyfikacja danych wymaga jawnej zgody użytkownika; po zgodzie system wykonuje akcję z audytem AIRun.'
    );

    // C8.2: Documentation/help awareness — AI knows the platform and can guide users
    instructions.push(
      '14. POMOC I DOKUMENTACJA: Znasz strukturę platformy Consultify i jej moduły:\n' +
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
    routingTrace?: any;
    releaseBundleId?: string | null;
    promptKey?: string | null;
    promptVersion?: string | null;
    policyVersion?: string | null;
  }> {
    // 1) Explicit overrides from request options (user-selected model or direct provider/model)
    const selectedTier = request.options?.selectedTier;
    const explicitModel = request.options?.selectedModelId || request.options?.model;
    const explicitProvider = request.options?.provider;
    const routingCapability = request.capability === 'chatStream' ? 'chat' : request.capability;

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
          routingTrace: {
            requestedPurpose: request.purpose || request.capability || null,
            normalizedPurpose: request.purpose || request.capability || null,
            organizationId: request.organizationId || null,
            tier: selectedTier || 'STANDARD',
            selected: {
              provider: 'ollama',
              id: explicitModel,
              tier: selectedTier || 'STANDARD',
              source: 'explicit_model',
            },
            candidates: [
              {
                provider: 'ollama',
                id: explicitModel,
                tier: selectedTier || 'STANDARD',
                source: 'explicit_model',
              },
            ],
            skipped: [],
          },
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
      const explicitTrace = {
        requestedPurpose: request.purpose || request.capability || null,
        normalizedPurpose: request.purpose || request.capability || null,
        organizationId: request.organizationId || null,
        tier: tierForConfig,
        selected: {
          provider,
          id: cfg.id,
          tier: tierForConfig,
          source: 'explicit_model',
        },
        candidates: [
          {
            provider,
            id: cfg.id,
            tier: tierForConfig,
            source: 'explicit_model',
          },
        ],
        skipped: [],
      };
      (request as any)._routingTrace = explicitTrace;
      (request as any)._routingParams = {
        capability: routingCapability,
        purpose: request.purpose || routingCapability,
        organizationId: request.organizationId,
        tier: tierForConfig,
        options: { tier: tierForConfig },
      };
      return {
        provider,
        model: cfg.id,
        maxTokens: request.options?.maxTokens || capability.maxTokens,
        endpoint,
        apiKey: cfg.apiKey,
        routingTrace: explicitTrace,
      };
    }

    // 2) Dynamic routing by tier/purpose
    const attachmentDocIdsRaw =
      (request.context as any)?.attachmentDocIds ||
      (Array.isArray((request.context as any)?.attachments)
        ? (request.context as any)?.attachments.map((a: any) => a?.docId).filter(Boolean)
        : []);
    const resolvedPurpose =
      normalizePurposeKey(request.purpose) ||
      (routingCapability === 'chat'
        ? inferChatTaskPurpose({
            explicitPurpose: request.purpose,
            capability: routingCapability,
            message: request.prompt,
            attachments: ((request.context as any)?.attachments || []) as any[],
            attachmentDocIds: attachmentDocIdsRaw,
            deepResearch: Boolean((request.options as any)?.aiModes?.deepResearch),
          })
        : normalizePurposeKey(routingCapability) || routingCapability);
    const routed = await modelRouter.select({
      capability: routingCapability,
      purpose: resolvedPurpose,
      dataClass: (request as any).dataClass,
      organizationId: request.organizationId,
      options: { tier: selectedTier },
      tier: selectedTier,
    } as any);
    (request as any)._routingTrace = (routed as any).routingTrace || null;
    (request as any)._routingParams = {
      capability: routingCapability,
      purpose: resolvedPurpose,
      dataClass: (request as any).dataClass,
      organizationId: request.organizationId,
      options: { tier: selectedTier },
      tier: selectedTier,
    };

    logger.info(
      `[AIPipeline] Routed model: ${routed.provider}/${routed.id} (tier: ${routed.tier})`
    );

    return {
      provider: routed.provider,
      model: routed.id,
      maxTokens: request.options?.maxTokens || capability.maxTokens,
      endpoint: routed.endpoint,
      apiKey: routed.apiKey,
      routingTrace: (routed as any).routingTrace,
      releaseBundleId: (routed as any).releaseBundleId || null,
      promptKey: (routed as any).promptKey || null,
      promptVersion: (routed as any).promptVersion || null,
      policyVersion: (routed as any).policyVersion || null,
    };
  }

  private async executeWithProvider(
    request: AIPipelineRequest,
    messages: ChatMessage[],
    modelConfig: {
      provider: string;
      model: string;
      maxTokens: number;
      endpoint?: string | null;
      apiKey?: string | null;
      routingTrace?: any;
      releaseBundleId?: string | null;
      promptKey?: string | null;
      promptVersion?: string | null;
      policyVersion?: string | null;
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

      let lastError: Error | null = primaryError as Error;
      const routeCandidates =
        (await (modelRouter as any).getRuntimeFallbackCandidates?.(
          (request as any)._routingParams || {
            capability: request.capability === 'chatStream' ? 'chat' : request.capability,
            purpose: (request as any).purpose || request.capability,
            dataClass: (request as any).dataClass,
            organizationId: request.organizationId,
            options: { tier: (options as any)?.selectedTier },
            tier: (options as any)?.selectedTier,
          },
          [modelConfig.model]
        )) || [];

      for (const candidate of routeCandidates) {
        if (candidate.id === modelConfig.model) continue;
        try {
          const providerId = String((candidate as any)?.provider || '');
          const modelId = String((candidate as any)?.id || '');
          const apiKey = (candidate as any)?.apiKey;
          const endpoint = (candidate as any)?.endpoint;

          const isConfigured =
            providerId.toLowerCase() === 'ollama' ||
            (typeof apiKey === 'string' && apiKey.trim().length > 0);
          if (!isConfigured) continue;

          logger.info(
            `[AIPipeline] Attempting fallback: ${providerId}/${modelId} (source: ${String((candidate as any)?.source || 'runtime')})`
          );
          (request as any)._routingTrace =
            (candidate as any)?.routingTrace || (request as any)._routingTrace;
          (request as any)._modelConfigForLog = {
            provider: providerId,
            model: modelId,
            releaseBundleId: (candidate as any)?.releaseBundleId || null,
            promptKey: (candidate as any)?.promptKey || null,
            promptVersion: (candidate as any)?.promptVersion || null,
            policyVersion: (candidate as any)?.policyVersion || null,
          };
          return await callOnce({ provider: providerId, model: modelId, endpoint, apiKey });
        } catch (fbError: any) {
          lastError = fbError as Error;
          const fbMsg = String(fbError?.message || fbError || '');
          logger.warn(
            `[AIPipeline] Fallback failed (${String((candidate as any)?.id || 'unknown')}): ${fbMsg.slice(0, 200)}`
          );
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
  ): Promise<{ usage?: TokenUsage }> {
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
      let fullText = '';
      if (stream) {
        for await (const chunk of stream) {
          fullText += typeof chunk === 'string' ? chunk : '';
          onChunk({
            type: 'text',
            content: chunk,
          });
        }
      }

      // QA-2026-06-09: streaming used to log usage:undefined → ai_usage_logs got
      // prompt_tokens=0/completion_tokens=0 (AI cost tracking was blind on streamed
      // chats, which is most chat traffic). Prefer the provider's real usage if it
      // surfaces one; otherwise estimate from input+streamed output (~4 chars/token,
      // same heuristic as preflightCostService.estimateTokens).
      // QA-2026-06-10: real usage arrives via callStream's usagePromise (settles
      // after the stream ends), not as a static property — await it with a grace
      // window so a hung promise can't stall the request.
      const usagePromise = (response as { usagePromise?: Promise<TokenUsage | undefined> })
        .usagePromise;
      const realUsage: Partial<TokenUsage> | undefined = usagePromise
        ? await Promise.race([
            usagePromise,
            new Promise<undefined>((resolve) => {
              const t = setTimeout(() => resolve(undefined), 2000);
              (t as any).unref?.();
            }),
          ]).catch(() => undefined)
        : (response as { usage?: Partial<TokenUsage> }).usage;
      let usage: TokenUsage;
      if (
        realUsage &&
        (Number(realUsage.promptTokens) > 0 || Number(realUsage.completionTokens) > 0)
      ) {
        const p = Number(realUsage.promptTokens) || 0;
        const ccount = Number(realUsage.completionTokens) || 0;
        usage = {
          promptTokens: p,
          completionTokens: ccount,
          totalTokens: Number(realUsage.totalTokens) || p + ccount,
        };
      } else {
        const { estimateTokenUsage } = await import('./tokenUsage.js');
        const inputChars = messages.reduce((n, m) => n + (m?.content?.length || 0), 0);
        usage = estimateTokenUsage(inputChars, fullText.length);
      }
      return { usage };
    } catch (error: any) {
      logger.error(`[AIPipeline] Streaming execution failed: ${error.message}`);
      onChunk({
        type: 'error',
        content: error.message,
      });
      return {};
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
      routingTrace: (request as any)?._routingTrace ?? null,
    };

    logger.info(
      `[AI Pipeline] ${request.capability} completed in ${latency}ms (trace: ${traceId})`,
      meta
    );

    // Best-effort DB-backed usage log (208_ai_usage_logs.sql).
    // Never fail the request if logging is unavailable.
    try {
      const { run: dbRun, get: dbGet } = await import('../../utils/DbPromise.js');
      const { v4: uuidv4 } = await import('uuid');

      // Normalize defensively: some callers still pass raw AI SDK v5/v6 usage
      // ({inputTokens, outputTokens}) — reading only the v4 names here was one
      // of the reasons prompt_tokens/completion_tokens persisted as 0/0.
      const { normalizeTokenUsage } = await import('./tokenUsage.js');
      const usage = normalizeTokenUsage(_response?.usage) || (_response?.usage as any) || {};
      const promptTokens = Number(usage?.promptTokens || 0);
      const completionTokens = Number(usage?.completionTokens || 0);
      const tokensUsed = Number(
        usage?.totalTokens || usage?.tokensUsed || promptTokens + completionTokens || 0
      );

      const usedProvider =
        (request as any)?._modelConfigForLog?.provider || (request as any)?._provider || 'unknown';
      const usedModel =
        (request as any)?._modelConfigForLog?.model || (request as any)?._model || null;

      // Best-effort pricing snapshot binding for consistent cost analytics.
      // - Match on (provider, model_id)
      // - Respect effective_to if present
      // - Store selected snapshot id in ai_usage_logs.price_snapshot_id
      // - Put computed estimated cost into metadata (no dedicated DB column yet)
      let priceSnapshotId: string | null = null;
      let estimatedCost: { amount: number; currency: string } | null = null;
      try {
        const providerKey = String(usedProvider || '').trim();
        const modelKey = usedModel ? String(usedModel).trim() : '';
        if (providerKey && modelKey) {
          const snap = await dbGet(
            `SELECT id, currency, units
             FROM ai_price_snapshots
             WHERE provider = ? AND model_id = ?
               AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP)
             ORDER BY effective_from DESC, created_at DESC
             LIMIT 1`,
            [providerKey, modelKey],
            { fallback: true } as any
          );
          if (snap?.id) {
            priceSnapshotId = String(snap.id);
            const currency = String(snap.currency || 'USD');
            const unitsRaw = (snap as any)?.units;
            let units: any = unitsRaw;
            if (typeof unitsRaw === 'string') {
              try {
                units = JSON.parse(unitsRaw);
              } catch {
                units = {};
              }
            }

            const inTok = Number.isFinite(promptTokens) ? promptTokens : 0;
            const outTok = Number.isFinite(completionTokens) ? completionTokens : 0;

            const inputPer1M = Number((units as any)?.input_per_1m_tokens);
            const outputPer1M = Number((units as any)?.output_per_1m_tokens);
            const inputPer1K = Number((units as any)?.input_per_1k_tokens);
            const outputPer1K = Number((units as any)?.output_per_1k_tokens);
            const costPer1K = Number((units as any)?.cost_per_1k);

            const has1M = Number.isFinite(inputPer1M) || Number.isFinite(outputPer1M);
            const has1K = Number.isFinite(inputPer1K) || Number.isFinite(outputPer1K);
            const hasLegacy = Number.isFinite(costPer1K);

            const safeInput1M = Number.isFinite(inputPer1M) ? inputPer1M : 0;
            const safeOutput1M = Number.isFinite(outputPer1M) ? outputPer1M : 0;
            const safeInput1K = Number.isFinite(inputPer1K) ? inputPer1K : 0;
            const safeOutput1K = Number.isFinite(outputPer1K) ? outputPer1K : 0;
            const safeLegacy1K = Number.isFinite(costPer1K) ? costPer1K : 0;

            let amount = 0;
            if (has1M) {
              amount = (inTok / 1_000_000) * safeInput1M + (outTok / 1_000_000) * safeOutput1M;
            } else if (has1K) {
              amount = (inTok / 1_000) * safeInput1K + (outTok / 1_000) * safeOutput1K;
            } else if (hasLegacy) {
              amount = ((inTok + outTok) / 1_000) * safeLegacy1K;
            }

            // Apply platform markup (+100% => 2.0) to match "drożej na 100%".
            // Priority: llm_providers.markup_multiplier -> env -> default 2.0.
            let markup = 2.0;
            try {
              const row = await dbGet(
                `SELECT markup_multiplier
                 FROM llm_providers
                 WHERE provider = ? AND model_id = ?
                 ORDER BY is_active DESC, is_default DESC
                 LIMIT 1`,
                [providerKey, modelKey],
                { fallback: true } as any
              );
              const m = Number((row as any)?.markup_multiplier);
              if (Number.isFinite(m) && m > 0) markup = m;
            } catch {
              /* ignore */
            }
            try {
              const env = Number(
                process.env.AI_MARKUP_MULTIPLIER || process.env.AI_PRICE_MARKUP_MULTIPLIER
              );
              if (Number.isFinite(env) && env > 0) markup = env;
            } catch {
              /* ignore */
            }

            if (Number.isFinite(amount) && amount > 0 && Number.isFinite(markup) && markup > 0) {
              amount = amount * markup;
            }
            if (Number.isFinite(amount) && amount > 0) {
              estimatedCost = { amount, currency };
            }
          }
        }
      } catch {
        // ignore pricing binding
      }

      const estimatedCostUsd =
        estimatedCost && String(estimatedCost.currency || '').toUpperCase() === 'USD'
          ? Number(estimatedCost.amount)
          : null;

      await dbRun(
        `INSERT INTO ai_usage_logs (
            id,
            user_id,
            organization_id,
            provider,
            model,
            action,
            purpose,
            kind,
            price_snapshot_id,
            estimated_cost_usd,
            prompt_tokens,
            completion_tokens,
            tokens_used,
            latency_ms,
            status,
            error_class,
            error_message,
            metadata,
            created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', NULL, NULL, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          request.userId || null,
          request.organizationId || null,
          String(usedProvider || 'unknown'),
          usedModel ? String(usedModel) : null,
          String(request.capability || 'unknown'),
          String((request as any).purpose || request.capability || 'unknown'),
          'TEXT_LLM',
          priceSnapshotId,
          typeof estimatedCostUsd === 'number' && Number.isFinite(estimatedCostUsd)
            ? estimatedCostUsd
            : null,
          Number.isFinite(promptTokens) ? promptTokens : 0,
          Number.isFinite(completionTokens) ? completionTokens : 0,
          Number.isFinite(tokensUsed) ? tokensUsed : 0,
          Number.isFinite(latency) ? latency : 0,
          JSON.stringify({
            traceId,
            promptKey: (request.options as any)?.promptKey || (request as any)?._promptKey || null,
            promptVersion: (request as any)?._promptVersion || null,
            promptSsotUsed: (request as any)?._promptSsotUsed || false,
            routing_trace: (request as any)?._routingTrace || null,
            ...(priceSnapshotId ? { price_snapshot_id: priceSnapshotId } : {}),
            ...(estimatedCost
              ? {
                  estimated_cost: estimatedCost,
                }
              : {}),
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
    latency: number,
    traceId: string
  ): Promise<void> {
    logger.error(
      `[AI Pipeline] ${request.capability} failed: ${error.message} (trace: ${traceId})`
    );

    // Best-effort DB-backed error usage log.
    // Never fail the request if logging is unavailable.
    try {
      const { run: dbRun, get: dbGet } = await import('../../utils/DbPromise.js');
      const { v4: uuidv4 } = await import('uuid');

      const usedProvider =
        (request as any)?._modelConfigForLog?.provider || (request as any)?._provider || 'unknown';
      const usedModel =
        (request as any)?._modelConfigForLog?.model || (request as any)?._model || null;

      let priceSnapshotId: string | null = null;
      try {
        const providerKey = String(usedProvider || '').trim();
        const modelKey = usedModel ? String(usedModel).trim() : '';
        if (providerKey && modelKey) {
          const snap = await dbGet(
            `SELECT id
             FROM ai_price_snapshots
             WHERE provider = ? AND model_id = ?
               AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP)
             ORDER BY effective_from DESC, created_at DESC
             LIMIT 1`,
            [providerKey, modelKey],
            { fallback: true } as any
          );
          if (snap?.id) priceSnapshotId = String(snap.id);
        }
      } catch {
        /* ignore */
      }

      const status = 'error';
      const errorMessage = String(error?.message || 'AI request failed');
      const errorClass = String((error as any)?.code || 'AI_ERROR');

      await dbRun(
        `INSERT INTO ai_usage_logs (
            id,
            user_id,
            organization_id,
            provider,
            model,
            action,
            purpose,
            kind,
            price_snapshot_id,
            estimated_cost_usd,
            prompt_tokens,
            completion_tokens,
            tokens_used,
            latency_ms,
            status,
            error_class,
            error_message,
            metadata,
            created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          request.userId || null,
          request.organizationId || null,
          String(usedProvider || 'unknown'),
          usedModel ? String(usedModel) : null,
          String(request.capability || 'unknown'),
          String((request as any).purpose || request.capability || 'unknown'),
          'TEXT_LLM',
          priceSnapshotId,
          Number.isFinite(latency) ? latency : 0,
          status,
          errorClass,
          errorMessage,
          JSON.stringify({
            traceId,
            error_class: errorClass,
            retryable: Boolean((error as any)?.retryable),
            routing_trace: (request as any)?._routingTrace || null,
          }),
        ]
      );
    } catch {
      // ignore
    }
  }

  private handleError(error: unknown): AIError {
    if (error instanceof Error) {
      const anyErr = error as any;
      // Feedback #a9fcdd99 / #3b6c0287 — preserve the underlying error's `code`
      // (e.g. CIRCUIT_OPEN, INVALID_API_KEY, RATE_LIMIT) so the route handler
      // and SSE client can render a user-friendly localized message instead of
      // the raw engineering text. Without this, every thrown Error was
      // collapsed to `AI_ERROR`, which the client didn't recognize and fell
      // back to surfacing the raw message (e.g. "Circuit [openrouter] is
      // OPEN. Retry in 18s") in the chat bubble.
      const preserved =
        typeof anyErr?.code === 'string' && anyErr.code.length > 0 ? anyErr.code : null;
      const msg = String(error.message || '');
      const inferred = !preserved
        ? /invalid_api_key|incorrect api key/i.test(msg)
          ? 'INVALID_API_KEY'
          : /quota|rate.limit|429|too many/i.test(msg)
            ? 'RATE_LIMIT'
            : /circuit.*open/i.test(msg)
              ? 'CIRCUIT_OPEN'
              : null
        : null;
      return {
        code: preserved || inferred || 'AI_ERROR',
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

  // Collect matches alongside their position in the source text so the final
  // `artifacts` array can be sorted into document order — the extraction below
  // runs in multiple phases (one regex pass per artifact form), so the order
  // matches themselves are found in is NOT the order they appear in the text.
  const foundArtifacts: Array<{ index: number; artifact: AIArtifact }> = [];
  const processedPositions = new Set<number>();

  // Pattern for artifact blocks with language: ```artifact:type:language:title\ncontent\n```
  const artifactPatternWithLang = /```artifact:(\w+):(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = artifactPatternWithLang.exec(content)) !== null) {
    const [, type, language, title, artifactContent] = match;
    processedPositions.add(match.index);
    foundArtifacts.push({
      index: match.index,
      artifact: {
        id: `art-${Math.random().toString(36).substring(2, 9)}`,
        type: type as any,
        title: title.trim(),
        content: artifactContent.trim(),
        language,
      },
    });
  }

  // Pattern for artifact blocks without language: ```artifact:type:title\ncontent\n```
  const artifactPattern = /```artifact:(\w+):([^\n]+)\n([\s\S]*?)```/g;

  while ((match = artifactPattern.exec(content)) !== null) {
    if (processedPositions.has(match.index)) continue;

    const [, type, title, artifactContent] = match;
    processedPositions.add(match.index);
    foundArtifacts.push({
      index: match.index,
      artifact: {
        id: `art-${Math.random().toString(36).substring(2, 9)}`,
        type: type as any,
        title: title.trim(),
        content: artifactContent.trim(),
      },
    });
  }

  // Also check for JSON artifact definitions
  const jsonPattern = /```json:artifact\n([\s\S]*?)```/g;
  while ((match = jsonPattern.exec(content)) !== null) {
    try {
      const artifactDef = JSON.parse(match[1]);
      if (artifactDef.type && artifactDef.content) {
        foundArtifacts.push({
          index: match.index,
          artifact: {
            id: artifactDef.id || `art-${Math.random().toString(36).substring(2, 9)}`,
            type: artifactDef.type,
            title: artifactDef.title || 'Untitled',
            content: artifactDef.content,
            ...artifactDef,
          },
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
      foundArtifacts.push({
        index: match.index,
        artifact: {
          id: `art-${Math.random().toString(36).substring(2, 9)}`,
          type: 'code',
          title: 'Code Snippet',
          content: codeContent.trim(),
          language: language || 'text',
        },
      });
    }
  }

  // Sort by position of first appearance in the source text so callers that
  // rely on `artifacts[]` matching document/reading order get a stable result.
  foundArtifacts.sort((a, b) => a.index - b.index);
  const artifacts = foundArtifacts.map((found) => found.artifact);

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

    // Split into individual steps if numbered or bulleted. Real AI output
    // typically indents each list line (e.g. "        2. Then, ..."), so the
    // lookahead must tolerate leading whitespace between the newline and the
    // marker — otherwise indented lists never split and collapse into one step.
    const stepLines = thinkingContent.split(/\n(?=[ \t]*(?:\d+\.|[-*•]))/);

    stepLines.forEach((line) => {
      const cleanLine = line
        .trim()
        .replace(/^\d+\.\s*|^[-*•]\s*/, '')
        .trim();
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
