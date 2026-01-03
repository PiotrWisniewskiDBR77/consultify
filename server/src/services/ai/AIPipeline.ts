/**
 * AI Pipeline Service
 * Enterprise SaaS Architecture - TypeScript Backend AI Pipeline
 * 
 * This is the TypeScript migration of the core AI Pipeline.
 * It serves as a pattern for migrating other backend services.
 */

import type {
    AIPipelineRequest,
    AIPipelineResponse,
    AIContext,
    AIOptions,
    ChatMessage,
    StreamChunk,
    StreamCallback,
    CapabilityName,
    AICapability,
    CapabilityRegistry,
    TokenUsage,
    ResponseMetadata,
    AIError,
    AIArtifact,
} from '../../types/ai.types';

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
        } catch (error) {
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
    public async processStream(
        request: AIPipelineRequest,
        onChunk: StreamCallback
    ): Promise<void> {
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
            await this.executeStreamingWithProvider(
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
        } catch (error) {
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

    private async checkQuota(userId: string, organizationId?: string): Promise<void> {
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
        enrichedContext: { context: AIContext }
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
        capability: AICapability
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
        messages: ChatMessage[],
        modelConfig: { provider: string; model: string; maxTokens: number },
        options?: AIOptions
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
        messages: ChatMessage[],
        modelConfig: { provider: string; model: string; maxTokens: number },
        options: AIOptions | undefined,
        onChunk: StreamCallback
    ): Promise<void> {
        // TODO: Implement streaming execution
        // This will be migrated from aiGateway.js
        onChunk({
            type: 'text',
            content: 'Streaming response placeholder - implement provider execution',
        });
    }

    private async postProcess(
        response: { content: string; artifacts?: AIArtifact[]; usage?: TokenUsage; cached?: boolean },
        capability: AICapability
    ): Promise<typeof response> {
        // TODO: Implement post-processing
        // Quality checks, artifact extraction, etc.
        return response;
    }

    private async logRequest(
        request: AIPipelineRequest,
        response: { content: string; usage?: TokenUsage },
        latency: number,
        traceId: string
    ): Promise<void> {
        // TODO: Implement logging
        console.log(`[AI Pipeline] ${request.capability} completed in ${latency}ms (trace: ${traceId})`);
    }

    private async logError(
        request: AIPipelineRequest,
        error: AIError,
        latency: number,
        traceId: string
    ): Promise<void> {
        console.error(`[AI Pipeline] ${request.capability} failed: ${error.message} (trace: ${traceId})`);
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

export {
    CAPABILITY_REGISTRY,
    type AIPipelineRequest,
    type AIPipelineResponse,
    type StreamCallback,
};


