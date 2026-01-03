/**
 * LLM Service - Vercel AI SDK Integration
 * Unified wrapper for model providers using the 'ai' package.
 */

import { generateText, streamText, generateObject, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import circuitBreaker from './circuitBreaker.js';
import { aiLogger } from './logger.js';

type ModelConfig = {
    id?: string;
    provider?: string;
    apiKey?: string;
    api_key?: string;
    endpoint?: string;
    tier?: string;
    [key: string]: unknown;
};

type LLMMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    [key: string]: unknown;
};

type ToolDefinition = {
    name: string;
    description: string;
    parameters: unknown;
};

type CallParams = {
    type: string;
    modelConfig: ModelConfig;
    systemPrompt?: string;
    messages: LLMMessage[];
    stream?: boolean;
    schema?: string | z.ZodSchema<unknown>;
    tools?: ToolDefinition[];
    context?: unknown;
    maxTokens?: number;
    temperature?: number;
    maxIterations?: number;
};

type McpServer = {
    getToolDefinitions: () => ToolDefinition[];
    execute: (name: string, args: unknown, context?: unknown) => Promise<unknown>;
};

type ToolCall = {
    toolName: string;
    args: unknown;
    result: unknown;
};

let _llmConfigService: unknown = null;
async function getLLMConfigService(): Promise<{
    getProviderConfig: (providerName: string) => Promise<{ api_key?: string | null; endpoint?: string | null } | null>;
    getNextFallback: (excludeProviders: string[], tier: string) => Promise<ModelConfig | null>;
} | null> {
    if (!_llmConfigService) {
        try {
            const mod = await import('./llmConfigService.js');
            _llmConfigService = mod.llmConfigService;
        } catch (error) {
            const err = error as Error;
            aiLogger.warn('LLMService', `LLMConfigService not available: ${err.message}`);
        }
    }
    return _llmConfigService as {
        getProviderConfig: (providerName: string) => Promise<{ api_key?: string | null; endpoint?: string | null } | null>;
        getNextFallback: (excludeProviders: string[], tier: string) => Promise<ModelConfig | null>;
    } | null;
}

async function getApiKey(providerName: string, passedKey?: string | null): Promise<string | null> {
    if (passedKey) return passedKey;

    const configService = await getLLMConfigService();
    if (configService) {
        const config = await configService.getProviderConfig(providerName);
        if (config && config.api_key) {
            return config.api_key;
        }
    }

    const envKeys: Record<string, string | undefined> = {
        openai: process.env.OPENAI_API_KEY,
        google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        gemini: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        cohere: process.env.COHERE_API_KEY,
        qwen: process.env.ALIBABA_API_KEY || process.env.QWEN_API_KEY,
        zai: process.env.ZAI_API_KEY
    };

    return envKeys[providerName.toLowerCase()] || null;
}

async function getEndpoint(providerName: string, passedEndpoint?: string | null): Promise<string | null> {
    if (passedEndpoint) return passedEndpoint;

    const configService = await getLLMConfigService();
    if (configService) {
        const config = await configService.getProviderConfig(providerName);
        if (config && config.endpoint) {
            return config.endpoint;
        }
    }

    const defaultEndpoints: Record<string, string> = {
        deepseek: 'https://api.deepseek.com',
        qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        zai: 'https://api.z.ai/api/paas/v4',
        ollama: 'http://localhost:11434/v1'
    };

    return defaultEndpoints[providerName.toLowerCase()] || null;
}

function getDefaultEndpoint(providerName: string): string | undefined {
    const endpoints: Record<string, string> = {
        deepseek: 'https://api.deepseek.com',
        qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        zai: 'https://api.z.ai/api/paas/v4',
        z_ai: 'https://api.z.ai/api/paas/v4'
    };
    return endpoints[providerName.toLowerCase()];
}

function getProviderSync(modelConfig: ModelConfig) {
    const providerName = String(modelConfig.provider || '');
    const apiKey = typeof modelConfig.apiKey === 'string' ? modelConfig.apiKey : undefined;
    const endpoint = typeof modelConfig.endpoint === 'string' ? modelConfig.endpoint : undefined;

    switch (providerName.toLowerCase()) {
        case 'openai':
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY
            });
        case 'google':
        case 'gemini':
            return createGoogleGenerativeAI({
                apiKey: apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
            });
        case 'deepseek':
        case 'z_ai':
        case 'zai':
        case 'qwen':
        case 'mistral':
        case 'nvidia':
            return createOpenAI({
                apiKey,
                baseURL: endpoint || getDefaultEndpoint(providerName)
            });
        case 'ollama':
            return createOpenAI({
                apiKey: 'ollama',
                baseURL: endpoint || 'http://localhost:11434/v1'
            });
        default:
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY
            });
    }
}

async function getProviderAsync(modelConfig: ModelConfig) {
    const providerName = String(modelConfig.provider || '');
    const apiKey = await getApiKey(providerName, (modelConfig.apiKey as string | null) || (modelConfig.api_key as string | null));
    const endpoint = await getEndpoint(providerName, modelConfig.endpoint as string | null);

    return getProviderSync({
        ...modelConfig,
        apiKey,
        endpoint
    });
}

function getProvider(modelConfig: ModelConfig) {
    return getProviderSync(modelConfig);
}

export const MagicWandSchema = z.object({
    suggestions: z.array(z.object({
        field: z.string(),
        value: z.string(),
        reasoning: z.string().optional()
    })),
    confidence: z.number().min(0).max(1)
});

export const AnalysisResultSchema = z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    recommendations: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW'])
    })),
    overallScore: z.number().optional()
});

export const RoadmapSchema = z.object({
    year1: z.object({
        q1: z.array(z.string()).describe('Initiative names for Q1 Year 1'),
        q2: z.array(z.string()).describe('Initiative names for Q2 Year 1'),
        q3: z.array(z.string()).describe('Initiative names for Q3 Year 1'),
        q4: z.array(z.string()).describe('Initiative names for Q4 Year 1')
    }),
    year2: z.object({
        q1: z.array(z.string()).describe('Initiative names for Q1 Year 2'),
        q2: z.array(z.string()).describe('Initiative names for Q2 Year 2'),
        q3: z.array(z.string()).describe('Initiative names for Q3 Year 2'),
        q4: z.array(z.string()).describe('Initiative names for Q4 Year 2')
    }).optional(),
    year3: z.object({
        q1: z.array(z.string()).describe('Initiative names for Q1 Year 3'),
        q2: z.array(z.string()).describe('Initiative names for Q2 Year 3'),
        q3: z.array(z.string()).describe('Initiative names for Q3 Year 3'),
        q4: z.array(z.string()).describe('Initiative names for Q4 Year 3')
    }).optional(),
    reasoning: z.string().describe('Brief explanation of the sequencing logic')
});

const REASONING_MODELS = ['o1', 'o1-preview', 'o1-mini', 'o1-2024-12-17'];

export class LLMService {
    maxTokens: number;
    temperature: number;

    constructor() {
        this.maxTokens = 4096;
        this.temperature = 0.7;
    }

    isReasoningModel(modelId?: string): boolean {
        const modelLower = (modelId || '').toLowerCase();
        return REASONING_MODELS.some(rm => modelLower.includes(rm));
    }

    async resolveModelConfig(modelConfig: ModelConfig): Promise<ModelConfig> {
        if (modelConfig.provider && (modelConfig.api_key || modelConfig.apiKey)) return modelConfig;

        const tierMap: Record<string, string> = {
            budget: 'BUDGET',
            fast: 'STANDARD',
            standard: 'STANDARD',
            premium: 'PREMIUM',
            reasoning: 'REASONING'
        };

        const tier = tierMap[String(modelConfig.id || '').toLowerCase()] || modelConfig.tier;

        if (tier) {
            const configService = await getLLMConfigService();
            if (configService) {
                const bestProvider = await configService.getNextFallback([], tier);
                if (bestProvider) {
                    aiLogger.info('LLMService', `Resolved Tier ${tier} to ${bestProvider.provider}/${bestProvider.model_id}`);
                    return bestProvider;
                }
                aiLogger.warn('LLMService', `No providers found for Tier ${tier}, falling back to default`);
            }
        }

        return modelConfig;
    }

    async call(params: CallParams): Promise<Record<string, unknown>> {
        let { type, modelConfig, systemPrompt, messages, stream, schema, tools } = params;

        modelConfig = await this.resolveModelConfig(modelConfig);
        const isReasoning = this.isReasoningModel(modelConfig?.id as string | undefined) || modelConfig?.tier === 'REASONING';

        if (isReasoning) {
            aiLogger.info('LLMService', `Using reasoning model: ${modelConfig.id}`);
            return this.callReasoningModel({ ...params, modelConfig });
        }

        if (tools && tools.length > 0) {
            if (stream) {
                return this.callWithToolsStream({ ...params, modelConfig });
            }
            return this.callWithTools({ ...params, modelConfig });
        }
        if (type === 'structured' && schema) {
            return this.callStructured({ ...params, modelConfig });
        }
        if (stream) {
            return this.callStream({ ...params, modelConfig });
        }
        return this.callText({ ...params, modelConfig });
    }

    async generateResponse(params: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
        model?: string;
        systemPrompt?: string;
    }): Promise<Record<string, unknown>> {
        const { prompt, maxTokens, temperature, model, systemPrompt } = params;

        return this.call({
            type: 'text',
            modelConfig: { id: model || 'default' },
            systemPrompt: systemPrompt || 'You are a helpful assistant.',
            messages: [{ role: 'user', content: prompt }],
            maxTokens: maxTokens || this.maxTokens,
            temperature: temperature || this.temperature
        });
    }

    async callReasoningModel(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');

        const formattedMessages: LLMMessage[] = [];
        let systemInjected = false;

        for (const msg of messages) {
            if (msg.role === 'system') continue;

            if (msg.role === 'user' && !systemInjected && systemPrompt) {
                formattedMessages.push({
                    role: 'user',
                    content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[USER REQUEST]\n${msg.content}`
                });
                systemInjected = true;
            } else {
                formattedMessages.push(msg);
            }
        }

        if (!systemInjected && systemPrompt) {
            formattedMessages.unshift({
                role: 'user',
                content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[Please provide your analysis following the instructions above.]`
            });
        }

        aiLogger.debug('LLMService', `Reasoning model call with ${formattedMessages.length} messages`);

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return generateText({
                    model,
                    messages: formattedMessages,
                    maxTokens: 16384
                });
            },
            {
                onRetry: (attempt: number, delay: number, error: Error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} reasoning (attempt ${attempt})`, {
                        delay,
                        error: error.message
                    });
                },
                maxRetries: 2,
                timeout: 180000
            }
        );

        return {
            content: result.text,
            usage: result.usage,
            isReasoningModel: true,
            model: modelConfig.id
        };
    }

    async callWithTools(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');
        const mcpModule = await import('./mcpServer.js');
        const mcpServer = (mcpModule.mcpServer || mcpModule.default) as McpServer;
        await import('./tools/index.js').catch(() => {});

        const formattedMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt || '' },
            ...messages.filter(m => m.role !== 'system')
        ];

        const toolDefinitions: Record<string, ReturnType<typeof tool>> = {};
        const toolDefs = tools || mcpServer.getToolDefinitions();

        for (const def of toolDefs) {
            aiLogger.debug('LLMService', `Registering tool: ${def.name}`);
            toolDefinitions[def.name] = tool({
                description: def.description,
                parameters: jsonSchema(def.parameters),
                execute: async (args: unknown) => mcpServer.execute(def.name, args, context)
            });
        }

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return generateText({
                    model,
                    messages: formattedMessages,
                    tools: toolDefinitions,
                    maxSteps: maxIterations
                });
            },
            {
                onRetry: (attempt: number, delay: number, error: Error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} with tools (attempt ${attempt})`, {
                        delay,
                        error: error.message
                    });
                }
            }
        );

        const toolCalls: ToolCall[] = [];
        if (result.steps) {
            for (const step of result.steps) {
                if (step.toolCalls) {
                    toolCalls.push(...step.toolCalls);
                }
            }
        }

        return {
            content: result.text,
            usage: result.usage,
            toolCalls: toolCalls.map(tc => ({
                name: tc.toolName,
                args: tc.args,
                result: tc.result
            }))
        };
    }

    async callWithToolsStream(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');
        const mcpModule = await import('./mcpServer.js');
        const mcpServer = (mcpModule.mcpServer || mcpModule.default) as McpServer;
        await import('./tools/index.js').catch(() => {});

        const circuitCheck = await circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        const formattedMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt || '' },
            ...messages.filter(m => m.role !== 'system')
        ];

        const toolDefinitions: Record<string, ReturnType<typeof tool>> = {};
        const toolDefs = tools || mcpServer.getToolDefinitions();

        for (const def of toolDefs) {
            toolDefinitions[def.name] = tool({
                description: def.description,
                parameters: jsonSchema(def.parameters),
                execute: async (args: unknown) => mcpServer.execute(def.name, args, context)
            });
        }

        try {
            let lastError: Error | null = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await streamText({
                        model,
                        messages: formattedMessages,
                        tools: toolDefinitions,
                        maxSteps: maxIterations,
                        abortSignal: AbortSignal.timeout(60000)
                    });

                    await circuitBreaker.recordSuccess(providerId);
                    return { stream: result.textStream };
                } catch (error) {
                    lastError = error as Error;
                    aiLogger.warn('LLMService', `Stream initialization failed (attempt ${attempt + 1}/2): ${lastError.message}`);
                    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            throw lastError;
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);
            throw error;
        }
    }

    async callText(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');

        const formattedMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt || '' },
            ...messages.filter(m => m.role !== 'system')
        ];

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return generateText({
                    model,
                    messages: formattedMessages,
                    abortSignal: AbortSignal.timeout(60000)
                });
            },
            {
                timeout: 60000,
                onRetry: (attempt: number, delay: number, error: Error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} (attempt ${attempt})`, {
                        delay,
                        error: error.message
                    });
                }
            }
        );

        return {
            content: result.text,
            usage: result.usage
        };
    }

    async callStream(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');

        const formattedMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt || '' },
            ...messages.filter(m => m.role !== 'system')
        ];

        const circuitCheck = await circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        try {
            let lastError: Error | null = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await streamText({
                        model,
                        messages: formattedMessages,
                        abortSignal: AbortSignal.timeout(60000)
                    });

                    await circuitBreaker.recordSuccess(providerId);
                    return { stream: result.textStream };
                } catch (error) {
                    lastError = error as Error;
                    aiLogger.warn('LLMService', `Stream initialization failed (attempt ${attempt + 1}/2): ${lastError.message}`);
                    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            throw lastError;
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);
            throw error;
        }
    }

    async callStructured(params: CallParams & { modelConfig: ModelConfig }): Promise<Record<string, unknown>> {
        const { modelConfig, systemPrompt, messages, schema } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id as string);
        const providerId = String(modelConfig.provider || 'openai');

        let zodSchema: z.ZodSchema<unknown>;
        if (typeof schema === 'string') {
            switch (schema) {
                case 'magic_wand':
                    zodSchema = MagicWandSchema;
                    break;
                case 'analysis':
                    zodSchema = AnalysisResultSchema;
                    break;
                case 'roadmap':
                    zodSchema = RoadmapSchema;
                    break;
                default:
                    throw new Error(`Unknown schema: ${schema}`);
            }
        } else if (schema && typeof schema === 'object') {
            zodSchema = schema;
        } else {
            throw new Error('Schema required for structured output');
        }

        const formattedMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt || '' },
            ...messages.filter(m => m.role !== 'system')
        ];

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return generateObject({
                    model,
                    schema: zodSchema,
                    messages: formattedMessages,
                    abortSignal: AbortSignal.timeout(60000)
                });
            },
            {
                timeout: 60000,
                onRetry: (attempt: number) => {
                    aiLogger.info('LLMService', `Retrying structured call to ${providerId} (attempt ${attempt})`);
                }
            }
        );

        return {
            object: result.object,
            usage: result.usage
        };
    }

    async testConnection(modelConfig: ModelConfig): Promise<Record<string, unknown>> {
        const providerId = String(modelConfig.provider || 'openai');

        try {
            const provider = getProvider(modelConfig);
            const model = provider(modelConfig.id as string);

            const result = await generateText({
                model,
                messages: [{ role: 'user', content: 'Say "pong"' }],
                maxTokens: 5
            });

            await circuitBreaker.recordSuccess(providerId);

            return {
                success: true,
                response: result.text,
                usage: result.usage,
                circuitState: (await circuitBreaker.canExecute(providerId)).state
            };
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);

            return {
                success: false,
                error: (error as Error).message,
                circuitState: (await circuitBreaker.canExecute(providerId)).state
            };
        }
    }

    async getCircuitStatus(): Promise<unknown> {
        return circuitBreaker.getStatus();
    }

    async resetCircuit(providerId: string): Promise<void> {
        await circuitBreaker.reset(providerId);
    }
}

export const llmService = new LLMService();
export default llmService;
