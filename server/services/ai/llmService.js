/**
 * LLM Service - Vercel AI SDK Integration
 * Unified wrapper for model providers using the 'ai' package
 * 
 * Features:
 * - Multi-provider support (OpenAI, Google, DeepSeek, Ollama)
 * - Circuit breaker for fault tolerance
 * - Retry with exponential backoff
 * - Structured outputs with Zod schemas
 */

const { generateText, streamText, generateObject, tool, jsonSchema } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { z } = require('zod');
const circuitBreaker = require('./circuitBreaker');
const { aiLogger } = require('./logger');

// Provider Factory
function getProvider(modelConfig) {
    const { provider: providerName, apiKey, endpoint } = modelConfig;

    switch (providerName.toLowerCase()) {
        case 'openai':
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY
            });
        case 'google':
        case 'gemini':
            return createGoogleGenerativeAI({
                apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
            });
        case 'deepseek':
        case 'z_ai':
        case 'qwen':
        case 'mistral':
            // These providers often use OpenAI-compatible APIs
            return createOpenAI({
                apiKey: apiKey,
                baseURL: endpoint || (providerName === 'deepseek' ? 'https://api.deepseek.com' : undefined)
            });
        case 'ollama':
            return createOpenAI({
                apiKey: 'ollama', // Usually not needed
                baseURL: endpoint || 'http://localhost:11434/v1'
            });
        default:
            // Default to OpenAI
            return createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY
            });
    }
}

// Pre-defined Zod Schemas for Structured Outputs
const MagicWandSchema = z.object({
    suggestions: z.array(z.object({
        field: z.string(),
        value: z.string(),
        reasoning: z.string().optional()
    })),
    confidence: z.number().min(0).max(1)
});

const AnalysisResultSchema = z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    recommendations: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW'])
    })),
    overallScore: z.number().optional()
});

// Schema for roadmap generation
const RoadmapSchema = z.object({
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

// O1/Reasoning model identifiers
const REASONING_MODELS = ['o1', 'o1-preview', 'o1-mini', 'o1-2024-12-17'];

class LLMService {

    /**
     * Check if model is a reasoning/o1 model
     * Reasoning models have special requirements:
     * - No system prompt (inject into user message)
     * - No streaming support
     * - No tools support
     * - Different token handling
     */
    isReasoningModel(modelId) {
        const modelLower = (modelId || '').toLowerCase();
        return REASONING_MODELS.some(rm => modelLower.includes(rm));
    }

    async call(params) {
        const { type, modelConfig, systemPrompt, messages, stream, schema, tools, context } = params;

        // Check if this is a reasoning model (o1)
        const isReasoning = this.isReasoningModel(modelConfig?.id);

        // Reasoning models: no streaming, no tools, special handling
        if (isReasoning) {
            aiLogger.info('LLMService', `Using reasoning model: ${modelConfig.id}`);
            return this.callReasoningModel(params);
        }

        // Determine call type for standard models
        if (tools && tools.length > 0) {
            if (stream) {
                return this.callWithToolsStream(params);
            }
            return this.callWithTools(params);
        } else if (type === 'structured' && schema) {
            return this.callStructured(params);
        } else if (stream) {
            return this.callStream(params);
        } else {
            return this.callText(params);
        }
    }

    /**
     * Special handler for o1/reasoning models
     * - Injects system prompt into first user message
     * - No streaming
     * - Extended max_completion_tokens
     */
    async callReasoningModel(params) {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        // For o1 models, inject system prompt into first user message
        // because o1 doesn't support system role
        const formattedMessages = [];
        let systemInjected = false;

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Skip system messages - will be injected into first user message
                continue;
            }
            
            if (msg.role === 'user' && !systemInjected && systemPrompt) {
                // Inject system prompt into first user message
                formattedMessages.push({
                    role: 'user',
                    content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[USER REQUEST]\n${msg.content}`
                });
                systemInjected = true;
            } else {
                formattedMessages.push(msg);
            }
        }

        // If no user messages yet, add system as user message
        if (!systemInjected && systemPrompt) {
            formattedMessages.unshift({
                role: 'user',
                content: `[INSTRUCTIONS]\n${systemPrompt}\n\n[Please provide your analysis following the instructions above.]`
            });
        }

        aiLogger.debug('LLMService', `Reasoning model call with ${formattedMessages.length} messages`);

        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages,
                    maxTokens: 16384, // o1 models support large outputs
                    // Note: o1 doesn't support temperature parameter
                });
            },
            {
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} reasoning (attempt ${attempt})`, {
                        delay,
                        error: error.message
                    });
                },
                maxRetries: 2, // Less retries for expensive reasoning calls
                timeout: 180000 // 3 minute timeout for reasoning
            }
        );

        return {
            content: result.text,
            usage: result.usage,
            isReasoningModel: true,
            model: modelConfig.id
        };
    }

    /**
     * Call LLM with tool definitions - enables agentic tool use
     * Protected by circuit breaker with retry logic
     */
    async callWithTools(params) {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';
        const { mcpServer } = require('./mcpServer');
        require('./tools'); // Ensure tools are registered

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system')
        ];

        // Convert MCP tools to Vercel AI SDK format
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
                }
            });
        }

        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages,
                    tools: toolDefinitions,
                    maxSteps: maxIterations
                });
            },
            {
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying ${providerId} with tools (attempt ${attempt})`, {
                        delay,
                        error: error.message
                    });
                }
            }
        );

        // Collect tool call results
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
            toolCalls: toolCalls.map(tc => ({
                name: tc.toolName,
                args: tc.args,
                result: tc.result
            }))
        };
    }

    /**
     * Call LLM with tool definitions and STREAMING
     * Circuit breaker check before streaming (no retry mid-stream)
     */
    async callWithToolsStream(params) {
        const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';
        const { mcpServer } = require('./mcpServer');
        require('./tools');

        // Check circuit before streaming
        const circuitCheck = circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system')
        ];

        const toolDefinitions = {};
        const toolDefs = tools || mcpServer.getToolDefinitions();

        for (const def of toolDefs) {
            toolDefinitions[def.name] = tool({
                description: def.description,
                parameters: jsonSchema(def.parameters),
                execute: async (args) => await mcpServer.execute(def.name, args, context)
            });
        }

        try {
            const result = await streamText({
                model,
                messages: formattedMessages,
                tools: toolDefinitions,
                maxSteps: maxIterations
            });

            circuitBreaker.recordSuccess(providerId);
            return { stream: result.textStream };
        } catch (error) {
            circuitBreaker.recordFailure(providerId, error);
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
            ...messages.filter(m => m.role !== 'system')
        ];

        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateText({
                    model,
                    messages: formattedMessages
                });
            },
            {
                onRetry: (attempt, delay, error) => {
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

    async callStream(params) {
        const { modelConfig, systemPrompt, messages } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system')
        ];

        // Check circuit before streaming (can't retry mid-stream)
        const circuitCheck = circuitBreaker.canExecute(providerId);
        if (!circuitCheck.allowed) {
            throw new Error(circuitCheck.reason);
        }

        try {
            const result = await streamText({
                model,
                messages: formattedMessages
            });

            circuitBreaker.recordSuccess(providerId);
            return { stream: result.textStream };
        } catch (error) {
            circuitBreaker.recordFailure(providerId, error);
            throw error;
        }
    }

    async callStructured(params) {
        const { modelConfig, systemPrompt, messages, schema } = params;

        const provider = getProvider(modelConfig);
        const model = provider(modelConfig.id);
        const providerId = modelConfig.provider || 'openai';

        // Map schema name to actual Zod schema
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
            ...messages.filter(m => m.role !== 'system')
        ];

        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(
            providerId,
            async () => {
                return await generateObject({
                    model,
                    schema: zodSchema,
                    messages: formattedMessages
                });
            },
            {
                onRetry: (attempt, delay, error) => {
                    aiLogger.info('LLMService', `Retrying structured call to ${providerId} (attempt ${attempt})`);
                }
            }
        );

        return {
            object: result.object,
            usage: result.usage
        };
    }

    /**
     * Test connection to a provider
     * Records success/failure in circuit breaker
     */
    async testConnection(modelConfig) {
        const providerId = modelConfig.provider || 'openai';
        
        try {
            const provider = getProvider(modelConfig);
            const model = provider(modelConfig.id);

            const result = await generateText({
                model,
                messages: [{ role: 'user', content: 'Say "pong"' }],
                maxTokens: 5
            });

            circuitBreaker.recordSuccess(providerId);
            
            return {
                success: true,
                response: result.text,
                usage: result.usage,
                circuitState: circuitBreaker.canExecute(providerId).state
            };
        } catch (error) {
            circuitBreaker.recordFailure(providerId, error);
            
            return {
                success: false,
                error: error.message,
                circuitState: circuitBreaker.canExecute(providerId).state
            };
        }
    }

    /**
     * Get circuit breaker status for all providers
     */
    getCircuitStatus() {
        return circuitBreaker.getStatus();
    }

    /**
     * Reset circuit breaker for a provider (admin function)
     */
    resetCircuit(providerId) {
        circuitBreaker.reset(providerId);
    }
}

// Export schemas and circuit breaker for external use
module.exports = {
    LLMService,
    MagicWandSchema,
    AnalysisResultSchema,
    circuitBreaker
};
