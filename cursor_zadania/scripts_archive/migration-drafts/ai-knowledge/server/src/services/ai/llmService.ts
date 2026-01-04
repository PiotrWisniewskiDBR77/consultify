/**
 * MIGRATION DRAFT (auto-generated)
 * Source: server/services/ai/llmService.js
 * Target: server/src/services/ai/llmService.ts
 * Status: wrapper
 *
 * TODO:
 * - Convert require/imports to ES module imports.
 * - Replace db callbacks with DbPromise/getDatabase().
 * - Add types and runtime validation where needed.
 */

/**
 * LLM Service - Vercel AI SDK Integration
 * Unified wrapper for model providers using the 'ai' package
 *
 * Features:
 * - Multi-provider support (OpenAI, Google, DeepSeek, Ollama, and more)
 * - Circuit breaker for fault tolerance
 * - Retry with exponential backoff
 * - Structured outputs with Zod schemas
 * - Integration with centralized LLMConfigService
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText, jsonSchema, streamText, tool } from 'ai';
import { z } from 'zod';

import circuitBreaker from './circuitBreaker.js';
import { aiLogger } from './logger.js';

// Lazy-load LLMConfigService to avoid circular dependencies
let _llmConfigService = null;
async function getLLMConfigService() {
    if (!_llmConfigService) {
        try {
            const mod = await import('./llmConfigService.js');
            _llmConfigService = mod.llmConfigService;
        } catch (e) {
            aiLogger.warn('LLMService', `LLMConfigService not available: ${e.message}`);
        }
    }
    return _llmConfigService;
}

/**
 * Get API key for a provider
 * Tries: 1) passed apiKey, 2) LLMConfigService, 3) environment variable
 */
async function getApiKey(providerName, passedKey) {
    // If key already passed, use it
    if (passedKey) return passedKey;

    // Try LLMConfigService
    const configService = await getLLMConfigService();
    if (configService) {
        const config = await configService.getProviderConfig(providerName);
        if (config && config.api_key) {
            return config.api_key;
        }
    }

    // Fallback to environment variables
    const envKeys = {
        openai: process.env.OPENAI_API_KEY,
        google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        gemini: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        cohere: process.env.COHERE_API_KEY,
        qwen: process.env.ALIBABA_API_KEY || process.env.QWEN_API_KEY,
        zai: process.env.ZAI_API_KEY,
    };

    return envKeys[providerName.toLowerCase()] || null;
}

/**
 * Get endpoint for a provider
 * Tries: 1) passed endpoint, 2) LLMConfigService, 3) default
 */
async function getEndpoint(providerName, passedEndpoint) {
    if (passedEndpoint) return passedEndpoint;

    // Try LLMConfigService
    const configService = await getLLMConfigService();
    if (configService) {
        const config = await configService.getProviderConfig(providerName);
        if (config && config.endpoint) {
            return config.endpoint;
        }
    }

    // Fallback to defaults
    const defaultEndpoints = {
        deepseek: 'https://api.deepseek.com',
        qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        zai: 'https://api.z.ai/api/paas/v4',
        ollama: 'http://localhost:11434/v1',
    };

    return defaultEndpoints[providerName.toLowerCase()] || null;
}

// Helper for default endpoints
function getDefaultEndpoint(providerName) {
    const endpoints = {
        deepseek: 'https://api.deepseek.com',
        qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        zai: 'https://api.z.ai/api/paas/v4',
        z_ai: 'https://api.z.ai/api/paas/v4',
    };
    return endpoints[providerName.toLowerCase()] || undefined;
}

// Sync version for backward compatibility
function getProviderSync(modelConfig) {
    const { provider: providerName, apiKey, endpoint } = modelConfig;

    switch (providerName.toLowerCase()) {
        case 'openai':
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });
        case 'google':
        case 'gemini':
            return createGoogleGenerativeAI({
                apiKey: apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
            });
        case 'deepseek':
        case 'z_ai':
        case 'zai':
        case 'qwen':
        case 'mistral':
        case 'nvidia':
            // These providers often use OpenAI-compatible APIs
            return createOpenAI({
                apiKey: apiKey,
                baseURL: endpoint || getDefaultEndpoint(providerName),
            });
        case 'ollama':
            return createOpenAI({
                apiKey: 'ollama', // Usually not needed
                baseURL: endpoint || 'http://localhost:11434/v1',
            });
        default:
            // Default to OpenAI
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });
    }
}

// Provider Factory - now async to support LLMConfigService
async function getProviderAsync(modelConfig) {
    const { provider: providerName } = modelConfig;
    const apiKey = await getApiKey(providerName, modelConfig.apiKey || modelConfig.api_key);
    const endpoint = await getEndpoint(providerName, modelConfig.endpoint);

    return getProviderSync({
        ...modelConfig,
        apiKey,
        endpoint,
    });
}

// Backward compatible sync wrapper
function getProvider(modelConfig) {
    return getProviderSync(modelConfig);
}

// Pre-defined Zod Schemas for Structured Outputs
export const MagicWandSchema = z.object({
    suggestions: z.array(
        z.object({
            field: z.string(),
            value: z.string(),
            reasoning: z.string().optional(),
        }),
    ),
    confidence: z.number().min(0).max(1),
});

export const AnalysisResultSchema = z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    recommendations: z.array(
        z.object({
            title: z.string(),
            description: z.string(),
            priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        }),
    ),
    overallScore: z.number().optional(),
});

// Schema for roadmap generation
export const RoadmapSchema = z.object({
    year1: z.object({
        q1: z.array(z.string()).describe('Initiative names for Q1 Year 1'),
        q2: z.array(z.string()).describe('Initiative names for Q2 Year 1'),
        q3: z.array(z.string()).describe('Initiative names for Q3 Year 1'),
        q4: z.array(z.string()).describe('Initiative names for Q4 Year 1'),
    }),
    year2: z
        .object({
            q1: z.array(z.string()).describe('Initiative names for Q1 Year 2'),
            q2: z.array(z.string()).describe('Initiative names for Q2 Year 2'),
            q3: z.array(z.string()).describe('Initiative names for Q3 Year 2'),
            q4: z.array(z.string()).describe('Initiative names for Q4 Year 2'),
        })
        .optional(),
    year3: z
        .object({
            q1: z.array(z.string()).describe('Initiative names for Q1 Year 3'),
            q2: z.array(z.string()).describe('Initiative names for Q2 Year 3'),
            q3: z.array(z.string()).describe('Initiative names for Q3 Year 3'),
            q4: z.array(z.string()).describe('Initiative names for Q4 Year 3'),
        })
        .optional(),
    reasoning: z.string().describe('Brief explanation of the sequencing logic'),
});

// O1/Reasoning model identifiers
const REASONING_MODELS = ['o1', 'o1-preview', 'o1-mini', 'o1-2024-12-17'];

export class LLMService {
    constructor() {
        this.maxTokens = 4096;
        this.temperature = 0.7;
    }

    /**
     * Check if model is a reasoning/o1 model
     */
    isReasoningModel(modelId) {
        const modelLower = (modelId || '').toLowerCase();
        return REASONING_MODELS.some((rm) => modelLower.includes(rm));
    }

    async resolveModelConfig(modelConfig) {
        // If it's already a full config with provider and API key, return it
        if (modelConfig.provider && (modelConfig.api_key || modelConfig.apiKey)) return modelConfig;

        // Check if ID is a Tier
        const tierMap = {
            budget: 'BUDGET',
            fast: 'STANDARD',
            standard: 'STANDARD',
            premium: 'PREMIUM',
            reasoning: 'REASONING',
        };

        const tier = tierMap[(modelConfig.id || '').toLowerCase()] || modelConfig.tier;

        if (tier) {
            const configService = await getLLMConfigService();
            if (configService) {
                // Get best available provider for this tier
                const bestProvider = await configService.getNextFallback([], tier);
                if (bestProvider) {
                    aiLogger.info(
                        'LLMService',
                        `Resolved Tier ${tier} to ${bestProvider.provider}/${bestProvider.model_id}`,
                    );
                    return bestProvider;
                }
                aiLogger.warn('LLMService', `No providers found for Tier ${tier}, falling back to default`);
            }
        }

        return modelConfig;
    }

    async call(params) {
        let { type, modelConfig, systemPrompt, messages, stream, schema, tools, context } = params;

        // Resolve Tier to actual Model Config
        modelConfig = await this.resolveModelConfig(modelConfig);

        // Check if this is a reasoning model (o1)
        const isReasoning = this.isReasoningModel(modelConfig?.id) || modelConfig?.tier === 'REASONING';

        // Reasoning models: no streaming, no tools, special handling
        if (isReasoning) {
            aiLogger.info('LLMService', `Using reasoning model: ${modelConfig.id}`);
            return this.callReasoningModel({ ...params, modelConfig });
        }

        // Determine call type for standard models
        if (tools && tools.length > 0) {
            if (stream) {
                return this.callWithToolsStream({ ...params, modelConfig });
            }
            return this.callWithTools({ ...params, modelConfig });
        } else if (type === 'structured' && schema) {
            return this.callStructured({ ...params, modelConfig });
        } else if (stream) {
            return this.callStream({ ...params, modelConfig });
        } else {
            return this.callText({ ...params, modelConfig });
        }
    }

    async generateResponse(params) {
        const { prompt, maxTokens, temperature, model, systemPrompt } = params;

        return this.call({
            type: 'text',
            modelConfig: { id: model || 'default' },
            systemPrompt: systemPrompt || 'You are a helpful assistant.',
            messages: [{ role: 'user', content: prompt }],
            maxTokens: maxTokens || this.maxTokens,
            temperature: temperature || this.temperature,
        });
    }

    async callReasoningModel(params) {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        const formattedMessages = [];
        let systemInjected = false;

        for (const msg of messages) {
            if (msg.role === 'system') continue;

            if (msg.role === 'user' && !systemInjected && systemPrompt) {
                formattedMessages.push({
                    role: 'user',
                    content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[USER REQUEST]\n${msg.content}`,
                });
                systemInjected = true;
            } else {
                formattedMessages.push(msg);
            }
        }

        if (!systemInjected && systemPrompt) {
            formattedMessages.unshift({
                role: 'user',
                content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[Please provide your analysis following the instructions above.]`,
            });
        }

        aiLogger.debug('LLMService', `Reasoning model call with ${formattedMessages.length} messages`);

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages,
                    maxTokens: 16384,
                });
            },
            {
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} reasoning (attempt ${attempt})`, {
                        delay,
                        error: error.message,
                    });
                },
                maxRetries: 2,
                timeout: 180000,
            },
        );

        return {
            content: result.text,
            usage: result.usage,
            isReasoningModel: true,
            model: modelConfig.id,
        };
    }

    async callWithTools(params) {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';
        const { mcpServer } = await import('./mcpServer.js');
        await import('./tools/index.js').catch(() => {}); // Ensure tools are registered if they exist

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
        ];

        const toolDefinitions = {};
        const toolDefs = tools || mcpServer.getToolDefinitions();

        for (const def of toolDefs) {
            aiLogger.debug('LLMService', `Registering tool: ${def.name}`);
            toolDefinitions[def.name] = tool({
                description: def.description,
                parameters: jsonSchema(def.parameters),
                execute: async (args) => {
                    const result = await mcpServer.execute(def.name, args, context);
                    return result;
                },
            });
        }

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages,
                    tools: toolDefinitions,
                    maxSteps: maxIterations,
                });
            },
            {
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} with tools (attempt ${attempt})`, {
                        delay,
                        error: error.message,
                    });
                },
            },
        );

        const toolCalls = [];
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
            toolCalls: toolCalls.map((tc) => ({
                name: tc.toolName,
                args: tc.args,
                result: tc.result,
            })),
        };
    }

    async callWithToolsStream(params) {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';
        const { mcpServer } = await import('./mcpServer.js');
        await import('./tools/index.js').catch(() => {});

        const circuitCheck = await circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
        ];

        const toolDefinitions = {};
        const toolDefs = tools || mcpServer.getToolDefinitions();

        for (const def of toolDefs) {
            toolDefinitions[def.name] = tool({
                description: def.description,
                parameters: jsonSchema(def.parameters),
                execute: async (args) => await mcpServer.execute(def.name, args, context),
            });
        }

        try {
            let lastError;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await streamText({
                        model,
                        messages: formattedMessages,
                        tools: toolDefinitions,
                        maxSteps: maxIterations,
                        abortSignal: AbortSignal.timeout(60000),
                    });

                    await circuitBreaker.recordSuccess(providerId);
                    return { stream: result.textStream };
                } catch (error) {
                    lastError = error;
                    aiLogger.warn(
                        'LLMService',
                        `Stream initialization failed (attempt ${attempt + 1}/2): ${error.message}`,
                    );
                    if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
                }
            }
            throw lastError;
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);
            throw error;
        }
    }

    async callText(params) {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
        ];

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages,
                    abortSignal: AbortSignal.timeout(60000),
                });
            },
            {
                timeout: 60000,
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} (attempt ${attempt})`, {
                        delay,
                        error: error.message,
                    });
                },
            },
        );

        return {
            content: result.text,
            usage: result.usage,
        };
    }

    async callStream(params) {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
        ];

        const circuitCheck = await circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        try {
            let lastError;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await streamText({
                        model,
                        messages: formattedMessages,
                        abortSignal: AbortSignal.timeout(60000),
                    });

                    await circuitBreaker.recordSuccess(providerId);
                    return { stream: result.textStream };
                } catch (error) {
                    lastError = error;
                    aiLogger.warn(
                        'LLMService',
                        `Stream initialization failed (attempt ${attempt + 1}/2): ${error.message}`,
                    );
                    if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
                }
            }
            throw lastError;
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);
            throw error;
        }
    }

    async callStructured(params) {
        const { modelConfig, systemPrompt, messages, schema } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        let zodSchema;
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

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
        ];

        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateObject({
                    model,
                    schema: zodSchema,
                    messages: formattedMessages,
                    abortSignal: AbortSignal.timeout(60000),
                });
            },
            {
                timeout: 60000,
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying structured call to ${providerId} (attempt ${attempt})`);
                },
            },
        );

        return {
            object: result.object,
            usage: result.usage,
        };
    }

    async testConnection(modelConfig) {
        const providerId = modelConfig.provider || 'openai';

        try {
            const provider = getProvider(modelConfig);
            const model = provider(modelConfig.id);

            const result = await generateText({
                model,
                messages: [{ role: 'user', content: 'Say "pong"' }],
                maxTokens: 5,
            });

            await circuitBreaker.recordSuccess(providerId);

            return {
                success: true,
                response: result.text,
                usage: result.usage,
                circuitState: (await circuitBreaker.canExecute(providerId)).state,
            };
        } catch (error) {
            await circuitBreaker.recordFailure(providerId, error);

            return {
                success: false,
                error: error.message,
                circuitState: (await circuitBreaker.canExecute(providerId)).state,
            };
        }
    }

    async getCircuitStatus() {
        return await circuitBreaker.getStatus();
    }

    async resetCircuit(providerId) {
        await circuitBreaker.reset(providerId);
    }
}

export const llmService = new LLMService();
export default llmService;
