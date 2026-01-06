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
    TokenUsage,
} from '../../types/ai.types.js';
import logger from '../../utils/Logger.js';

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

            // 7. Execute with provider
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
        // TODO: Implement context building
        // This will be migrated from enhancedContextBuilder.js
        return {
            context: request.context || {},
            ragResults: 0,
            memoryUsed: false,
        };
    }

    private async buildPrompt(
        request: AIPipelineRequest,
        capability: AICapability,
        _enrichedContext: { context: AIContext },
    ): Promise<ChatMessage[]> {
        // TODO: Implement prompt building
        // This will be migrated from promptAssembler.js
        return [
            {
                role: 'system',
                content: `You are a ${capability.role}. ${capability.description}`,
            },
            {
                role: 'user',
                content: request.prompt,
            },
        ];
    }

    private async selectModel(
        request: AIPipelineRequest,
        capability: AICapability,
    ): Promise<{ provider: string; model: string; maxTokens: number }> {
        // TODO: Implement model selection
        // This will be migrated from modelRouter.js
        return {
            provider: request.options?.provider || 'anthropic',
            model: request.options?.model || 'claude-3-5-sonnet-20241022',
            maxTokens: request.options?.maxTokens || capability.maxTokens,
        };
    }

    private async executeWithProvider(
        _messages: ChatMessage[],
        _modelConfig: { provider: string; model: string; maxTokens: number },
        _options?: AIOptions,
    ): Promise<{
        content: string;
        artifacts?: AIArtifact[];
        usage?: TokenUsage;
        cached?: boolean;
    }> {
        // TODO: Implement provider execution
        // This will be migrated from aiGateway.js
        return {
            content: 'Response placeholder - implement provider execution',
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
            },
            cached: false,
        };
    }

    private async executeStreamingWithProvider(
        _messages: ChatMessage[],
        _modelConfig: { provider: string; model: string; maxTokens: number },
        _options: AIOptions | undefined,
        onChunk: StreamCallback,
    ): Promise<void> {
        // TODO: Implement streaming execution
        // This will be migrated from aiGateway.js
        onChunk({
            type: 'text',
            content: 'Streaming response placeholder - implement provider execution',
        });
    }

    private async postProcess(
        response: { content: string; artifacts?: AIArtifact[]; thinkingSteps?: ThinkingStep[]; usage?: TokenUsage; cached?: boolean },
        _capability: AICapability,
    ): Promise<typeof response> {
        // Enhance response with extracted artifacts and thinking steps
        return enhanceResponse(response as any) as any;
    }

    private async logRequest(
        request: AIPipelineRequest,
        _response: { content: string; usage?: TokenUsage },
        latency: number,
        traceId: string,
    ): Promise<void> {
        // TODO: Implement logging
        logger.info(`[AI Pipeline] ${request.capability} completed in ${latency}ms (trace: ${traceId})`);
    }

    private async logError(
        request: AIPipelineRequest,
        error: AIError,
        _latency: number,
        traceId: string,
    ): Promise<void> {
        logger.error(`[AI Pipeline] ${request.capability} failed: ${error.message} (trace: ${traceId})`);
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
    type AIPipelineRequest,
    type AIPipelineResponse,
    CAPABILITY_REGISTRY,
    type StreamCallback,
    type ThinkingStep,
    type AIArtifact,
};

/**
 * Extract artifacts from AI response content
 */
export function extractArtifacts(content: string): { cleanContent: string; artifacts: AIArtifact[] } {
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
export function extractThinkingSteps(content: string): { cleanContent: string; thinkingSteps: ThinkingStep[] } {
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
    if (lower.includes('analyz') || lower.includes('examin') || lower.includes('assess')) return 'analysis';
    if (lower.includes('search') || lower.includes('look') || lower.includes('find') || lower.includes('research')) return 'research';
    if (lower.includes('combin') || lower.includes('integrat') || lower.includes('synthesiz') || lower.includes('creat')) return 'synthesis';
    if (lower.includes('verify') || lower.includes('check') || lower.includes('valid') || lower.includes('confirm')) return 'validation';
    return 'analysis';
}

/**
 * Enhance AI response with extracted artifacts and thinking steps
 */
export function enhanceResponse<T extends { content: string; artifacts?: AIArtifact[]; thinkingSteps?: ThinkingStep[] }>(
    response: T,
): T {
    if (!response.content) return response;

    const { cleanContent: contentAfterThinking, thinkingSteps } = extractThinkingSteps(response.content);
    const { cleanContent, artifacts } = extractArtifacts(contentAfterThinking);

    return {
        ...response,
        content: cleanContent,
        artifacts: artifacts.length > 0 ? [...(response.artifacts || []), ...artifacts] : response.artifacts,
        thinkingSteps:
            thinkingSteps.length > 0
                ? [...(response.thinkingSteps || []), ...thinkingSteps]
                : response.thinkingSteps,
    };
}
