/**
 * AI Pipeline Service
 * Enterprise SaaS Architecture - TypeScript Backend AI Pipeline
 *
 * This is the TypeScript migration of the core AI Pipeline.
 * It serves as a pattern for migrating other backend services.
 */

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

      // Check if streaming is requested
      if ((request as any).stream) {
        logger.info(
          `[AIPipeline] Starting stream with ${modelConfig.provider}/${modelConfig.model}`
        );

        // Return a stream-enabled response
        const streamResponse = await llmService.callStream({
          type: 'chat',
          modelConfig: {
            provider: modelConfig.provider,
            id: modelConfig.model,
            endpoint: (modelConfig as any).endpoint,
          },
          systemPrompt: prompt.find((m) => m.role === 'system')?.content || '',
          messages: prompt
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role as 'user' | 'assistant' | 'system' | 'tool',
              content: m.content,
            })),
          maxTokens: modelConfig.maxTokens,
          temperature: request.options?.temperature ?? 0.7,
          stream: true,
        });

        return {
          success: true,
          content: '',
          stream: (streamResponse as { stream?: AsyncIterable<string> }).stream,
          metadata: {
            provider: modelConfig.provider,
            model: modelConfig.model,
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
    } catch (error: unknown) {
      const aiError = this.handleError(error);
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

  private async checkQuota(_userId: string, _organizationId?: string): Promise<void> {
    // TODO: Implement quota checking
    // This will be migrated from quotaService.js
  }

  private async buildContext(request: AIPipelineRequest): Promise<{
    context: AIContext;
    ragResults?: number;
    memoryUsed?: boolean;
  }> {
    try {
      const AIContextBuilder = await getAIContextBuilder();
      
      // Extract IDs from request
      const userId = request.userId;
      const organizationId = request.organizationId || null;
      const projectId = (request as any).projectId || (request.context as any)?.projectId || null;
      const screenContext = (request as any).screenContext || (request.context as any)?.screenContext || null;
      
      // Build rich context if we have userId and organizationId
      if (userId && organizationId && AIContextBuilder?.buildContext) {
        logger.info(`[AIPipeline] Building context for user: ${userId}, org: ${organizationId}, project: ${projectId}`);
        
        const fullContext = await AIContextBuilder.buildContext(
          userId,
          organizationId,
          projectId,
          {
            focusMode: (request as any).focusMode || 'all',
            currentScreen: screenContext?.screenId || screenContext?.currentScreen || null,
            selectedObjectId: screenContext?.selectedObjectId || null,
            selectedObjectType: screenContext?.selectedObjectType || null,
          }
        );
        
        logger.info(`[AIPipeline] Context built successfully`, {
          hasExecution: !!fullContext?.execution,
          taskCount: fullContext?.execution?.userTasks?.length || 0,
          initiativeCount: fullContext?.execution?.userInitiatives?.length || 0,
        });
        
        return {
          context: fullContext,
          ragResults: fullContext?.knowledge?.projectDocuments?.length || 0,
          memoryUsed: !!fullContext?.execution,
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
    let systemPrompt = this.buildSystemPrompt(capability, ctx, request);
    
    // Add custom system instruction if provided
    if ((request.options as any)?.systemInstruction) {
      systemPrompt += `\n\n${(request.options as any).systemInstruction}`;
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
    
    // Add user prompt
    messages.push({
      role: 'user',
      content: request.prompt,
    });
    
    return messages;
  }
  
  /**
   * Build intelligent system prompt with full context awareness
   */
  private buildSystemPrompt(capability: AICapability, ctx: any, request: AIPipelineRequest): string {
    const parts: string[] = [];
    
    // 1. Role definition
    parts.push(this.buildRoleSection(capability));
    
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
    
    // 5. Pending approvals
    if (ctx?.pendingApprovals?.count > 0) {
      parts.push(this.buildPendingApprovalsSection(ctx.pendingApprovals));
    }
    
    // 6. Screen context
    if (ctx?.currentScreen) {
      parts.push(this.buildScreenContextSection(ctx));
    }
    
    // 7. Knowledge context
    if (ctx?.knowledge && !ctx.knowledge.ragDisabled) {
      parts.push(this.buildKnowledgeSection(ctx.knowledge));
    }
    
    // 8. Behavioral instructions
    parts.push(this.buildBehavioralInstructions(capability, ctx));
    
    return parts.filter(Boolean).join('\n\n');
  }
  
  private buildRoleSection(capability: AICapability): string {
    const roleDescriptions: Record<string, string> = {
      CONSULTANT: 'Jesteś ekspertem PMO i doradcą transformacji cyfrowej w platformie Consultinity. Pomagasz użytkownikom w zarządzaniu projektami, inicjatywami i zadaniami.',
      ANALYST: 'Jesteś analitykiem biznesowym specjalizującym się w ocenie dojrzałości cyfrowej i analizie strategicznej.',
      STRATEGIST: 'Jesteś strategiem transformacji cyfrowej, pomagającym w planowaniu roadmap i priorytetyzacji inicjatyw.',
      IMPLEMENTER: 'Jesteś specjalistą od wdrożeń, pomagającym w wykonaniu zadań i zarządzaniu pracą.',
      GATEKEEPER: 'Jesteś kontrolerem jakości, weryfikującym zgodność ze standardami PMO.',
    };
    
    return `## ROLA
${roleDescriptions[capability.role] || `Jesteś ${capability.role}. ${capability.description}`}`;
  }
  
  private buildOrganizationSection(org: any): string {
    if (!org) return '';
    
    return `## ORGANIZACJA
- Nazwa: ${org.organizationName || 'Nieznana'}
- Aktywne projekty: ${org.activeProjectCount || 0}
- Poziom dojrzałości PMO: ${org.pmoMaturityLevel || 'BASIC'}`;
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
        const dueInfo = t.dueDate ? ` [termin: ${new Date(t.dueDate).toLocaleDateString('pl-PL')}]` : '';
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
      const initList = execution.userInitiatives.slice(0, 5).map((i: any) => 
        `- [${i.status}] ${i.name}`
      );
      sections.push(initList.join('\n'));
    }
    
    // Blockers
    if (execution.blockers && execution.blockers.length > 0) {
      sections.push(`### ⚠️ BLOKERY (${execution.blockers.length}):`);
      const blockerList = execution.blockers.slice(0, 3).map((b: any) => 
        `- ${b.type}: ${b.description}`
      );
      sections.push(blockerList.join('\n'));
    }
    
    // Pending decisions
    if (execution.pendingDecisions && execution.pendingDecisions.length > 0) {
      sections.push(`### Oczekujące decyzje (${execution.pendingDecisions.length}):`);
      const decisionList = execution.pendingDecisions.slice(0, 3).map((d: any) => 
        `- ${d.title}`
      );
      sections.push(decisionList.join('\n'));
    }
    
    // Capacity status
    if (execution.capacityStatus) {
      const statusEmoji = execution.capacityStatus === 'HEALTHY' ? '✅' : 
                         execution.capacityStatus === 'WARNING' ? '⚠️' : '🔴';
      sections.push(`### Obciążenie: ${statusEmoji} ${execution.capacityStatus}`);
    }
    
    return sections.join('\n');
  }
  
  private buildPendingApprovalsSection(approvals: any): string {
    if (!approvals || approvals.count === 0) return '';
    
    return `## OCZEKUJĄCE AKCJE AI
${approvals.summary}
Użytkownik może zapytać o te akcje - możesz mu pomóc je przejrzeć i zatwierdzić.`;
  }
  
  private buildScreenContextSection(ctx: any): string {
    const screenHints: Record<string, string> = {
      initiatives: 'Użytkownik przegląda inicjatywy - skup się na statusach, postępach i priorytetach.',
      roadmap: 'Użytkownik jest w widoku roadmapy - skup się na harmonogramie i zależnościach.',
      assessment: 'Użytkownik jest w module oceny dojrzałości - skup się na lukach i rekomendacjach.',
      tasks: 'Użytkownik zarządza zadaniami - pomóż w priorytetyzacji i planowaniu.',
      dashboard: 'Użytkownik jest na dashboardzie - daj przegląd sytuacji i proponuj kolejne kroki.',
      execution: 'Użytkownik jest w trybie realizacji - skup się na konkretnych działaniach.',
      discovery: 'Użytkownik jest w fazie discovery - pomóż zrozumieć kontekst biznesowy.',
      portfolio: 'Użytkownik przegląda portfolio projektów - daj perspektywę strategiczną.',
    };
    
    const screen = ctx.currentScreen?.toLowerCase() || '';
    const hint = Object.entries(screenHints).find(([key]) => screen.includes(key))?.[1];
    
    if (!hint && !ctx.selectedObjectType) return '';
    
    let section = `## KONTEKST EKRANU`;
    if (ctx.currentScreen) {
      section += `\n- Aktualny widok: ${ctx.currentScreen}`;
    }
    if (hint) {
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
  
  private buildBehavioralInstructions(capability: AICapability, ctx: any): string {
    const instructions: string[] = [
      '## INSTRUKCJE',
      '1. Odpowiadaj konkretnie i pomocnie, wykorzystując powyższy kontekst.',
      '2. Jeśli użytkownik pyta o swoje zadania lub inicjatywy, odwołuj się do danych z sekcji KONTEKST UŻYTKOWNIKA.',
      '3. Proponuj konkretne działania bazując na aktualnym stanie pracy użytkownika.',
      '4. Jeśli są blokery lub problemy, proaktywnie oferuj pomoc w ich rozwiązaniu.',
    ];
    
    // Add context-specific instructions
    if (ctx?.execution?.capacityStatus === 'OVERLOADED') {
      instructions.push('5. ⚠️ Użytkownik jest przeciążony - sugeruj priorytetyzację i delegowanie zadań.');
    }
    
    if (ctx?.execution?.blockers?.length > 0) {
      instructions.push('5. Są aktywne blokery - zaoferuj pomoc w ich rozwiązaniu.');
    }
    
    if (ctx?.pendingApprovals?.count > 0) {
      instructions.push(`5. Użytkownik ma ${ctx.pendingApprovals.count} oczekujących akcji AI do przejrzenia.`);
    }
    
    // Response format hint
    if (capability.outputFormat === 'json') {
      instructions.push('6. Odpowiedz w formacie JSON.');
    }
    
    return instructions.join('\n');
  }

  private async selectModel(
    request: AIPipelineRequest,
    capability: AICapability
  ): Promise<{ provider: string; model: string; maxTokens: number; endpoint?: string }> {
    // Use Ollama as default local provider if available
    const provider = request.options?.provider || 'ollama';
    const model = request.options?.model || 'gemma3:27b';

    // For Ollama, use local endpoint
    const endpoint = provider === 'ollama' ? 'http://localhost:11434/v1' : undefined;

    logger.info(
      `[AIPipeline] Selected model: ${provider}/${model}, endpoint: ${endpoint || 'default'}`
    );

    return {
      provider,
      model,
      maxTokens: request.options?.maxTokens || capability.maxTokens,
      endpoint,
    };
  }

  private async executeWithProvider(
    messages: ChatMessage[],
    modelConfig: { provider: string; model: string; maxTokens: number },
    options?: AIOptions
  ): Promise<{
    content: string;
    artifacts?: AIArtifact[];
    usage?: TokenUsage;
    cached?: boolean;
  }> {
    try {
      const systemMessage = messages.find((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      const response = await llmService.call({
        type: 'chat',
        modelConfig: {
          provider: modelConfig.provider,
          id: modelConfig.model,
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
    } catch (error: any) {
      logger.error(`[AIPipeline] Provider execution failed: ${error.message}`);
      throw error;
    }
  }

  private async executeStreamingWithProvider(
    messages: ChatMessage[],
    modelConfig: { provider: string; model: string; maxTokens: number },
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
    // TODO: Implement logging
    logger.info(
      `[AI Pipeline] ${request.capability} completed in ${latency}ms (trace: ${traceId})`
    );
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
