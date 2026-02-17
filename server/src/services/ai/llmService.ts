/**
 * LLM Service - Vercel AI SDK Integration
 * Unified wrapper for model providers using the 'ai' package.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText, jsonSchema, streamText, tool } from 'ai';
import { createHash } from 'crypto';
import { z } from 'zod';

import { appCache } from '../redis/CacheService.js';
import circuitBreaker from './circuitBreaker.js';
import { embeddingService } from './embeddingService.js';
import { aiLogger } from './logger.js';

// Concurrency and rate limits per provider (process-level guard)
const PROVIDER_CONCURRENCY_LIMITS: Record<string, number> = {
  default: 20,
  openai: 25,
  google: 20,
  gemini: 20,
  anthropic: 20,
  deepseek: 15,
  nvidia: 10,
  cohere: 15,
  ollama: 10,
};

const PROVIDER_RATE_LIMIT_PER_SEC: Record<string, number> = {
  default: 30,
  openai: 40,
  google: 30,
  gemini: 30,
  anthropic: 30,
  deepseek: 25,
  nvidia: 15,
  cohere: 25,
  ollama: 20,
};

const providerConcurrency = new Map<string, number>();
const providerRateBuckets = new Map<string, number[]>();

function getLimit(map: Record<string, number>, providerId: string): number {
  const key = providerId.toLowerCase();
  return map[key] ?? map.default;
}

function acquireProviderSlot(providerId: string) {
  const current = providerConcurrency.get(providerId) || 0;
  const limit = getLimit(PROVIDER_CONCURRENCY_LIMITS, providerId);
  if (current >= limit) {
    throw new Error(`Concurrency limit exceeded for provider ${providerId}`);
  }
  providerConcurrency.set(providerId, current + 1);
}

function releaseProviderSlot(providerId: string) {
  const current = providerConcurrency.get(providerId) || 0;
  providerConcurrency.set(providerId, Math.max(0, current - 1));
}

function enforceRateLimit(providerId: string) {
  const now = Date.now();
  const bucket = providerRateBuckets.get(providerId) || [];
  const windowStart = now - 1000;
  const recent = bucket.filter((ts) => ts >= windowStart);
  const limit = getLimit(PROVIDER_RATE_LIMIT_PER_SEC, providerId);
  if (recent.length >= limit) {
    throw new Error(`Rate limit exceeded for provider ${providerId}`);
  }
  recent.push(now);
  providerRateBuckets.set(providerId, recent);
}

async function withGuards<T>(
  providerId: string,
  fn: () => Promise<T>,
  breakerOptions: Record<string, unknown> = {}
): Promise<T> {
  const startedAt = Date.now();
  enforceRateLimit(providerId);
  acquireProviderSlot(providerId);
  try {
    const result = await circuitBreaker.execute(providerId, fn, breakerOptions);
    const durationMs = Date.now() - startedAt;
    const usage = (result as any)?.usage || {};
    aiLogger.info('LLMServiceMetrics', `LLM call success for ${providerId}`, {
      providerId,
      durationMs,
      tokens: usage.totalTokens || usage.total || null,
      promptTokens: usage.promptTokens || null,
      completionTokens: usage.completionTokens || null,
    });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const err = error as Error;
    aiLogger.warn('LLMServiceMetrics', `LLM call failed for ${providerId}`, {
      providerId,
      durationMs,
      error: err.message,
    });
    throw error;
  } finally {
    releaseProviderSlot(providerId);
  }
}

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
  cache?: boolean; // Cache control
  cacheTtl?: number; // TTL in seconds
  semantic?: boolean; // Use semantic search for caching
  /**
   * Optional total timeout hint for a single provider call.
   * Note: circuit-breaker retries can extend total wall time unless retryAttempts is reduced.
   */
  timeoutMs?: number;
  /**
   * Circuit breaker options override (e.g. retryAttempts, retry delays).
   * Use sparingly; interactive UI endpoints should prefer fail-fast.
   */
  breakerOptions?: Record<string, unknown>;
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
  getProviderConfig: (
    providerName: string
  ) => Promise<{ api_key?: string | null; endpoint?: string | null } | null>;
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
    getProviderConfig: (
      providerName: string
    ) => Promise<{ api_key?: string | null; endpoint?: string | null } | null>;
    getNextFallback: (excludeProviders: string[], tier: string) => Promise<ModelConfig | null>;
  } | null;
}

function getProviderSync(modelConfig: ModelConfig) {
  const providerName = String(modelConfig.provider || '');
  const apiKey =
    typeof modelConfig.apiKey === 'string'
      ? modelConfig.apiKey
      : typeof modelConfig.api_key === 'string'
        ? modelConfig.api_key
        : undefined;
  const endpoint = typeof modelConfig.endpoint === 'string' ? modelConfig.endpoint : undefined;
  const normalizedApiKey = apiKey?.trim();
  const isPlaceholderKey =
    !!normalizedApiKey &&
    (normalizedApiKey.startsWith('sk-demo-') ||
      normalizedApiKey.includes('placeholder') ||
      normalizedApiKey === 'YOUR_GEMINI_API_KEY_HERE' ||
      normalizedApiKey === 'YOUR_OPENAI_API_KEY_HERE');
  const effectiveApiKey = isPlaceholderKey ? undefined : normalizedApiKey;

  // IMPORTANT: Prefer environment keys over DB-stored keys.
  // Reason: in local + Railway deployments, env vars are the intended source of truth.
  // DB keys are still supported as a fallback when env vars are not set.
  const envOpenAI = process.env.OPENAI_API_KEY?.trim();
  const envGemini = (
    process.env.GEMINI_API_KEY ||
    // preferred naming in this repo
    process.env.GOOGLE_AI_API_KEY ||
    // legacy fallback(s)
    (process.env as any).GOOGLE_API_KEY ||
    (process.env as any).GOOGLE_API_KEY
  )?.trim();

  switch (providerName.toLowerCase()) {
    case 'openai':
      if (!envOpenAI && !effectiveApiKey) {
        throw new Error('No OpenAI API key configured (set OPENAI_API_KEY).');
      }
      return createOpenAI({
        apiKey: envOpenAI || effectiveApiKey,
      });
    case 'google':
    case 'gemini':
      if (!envGemini && !effectiveApiKey) {
        throw new Error(
          'No Gemini/Google API key configured (set GEMINI_API_KEY or GOOGLE_AI_API_KEY).'
        );
      }
      return createGoogleGenerativeAI({
        apiKey: envGemini || effectiveApiKey,
      });
    case 'anthropic': {
      const envAnthropic = process.env.ANTHROPIC_API_KEY?.trim();
      if (!envAnthropic && !effectiveApiKey) {
        throw new Error('No Anthropic API key configured (set ANTHROPIC_API_KEY).');
      }
      return createAnthropic({
        apiKey: envAnthropic || effectiveApiKey,
      });
    }
    case 'deepseek':
    case 'z_ai':
    case 'zai':
    case 'qwen':
    case 'mistral':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: endpoint || 'https://api.deepseek.com',
      });
    case 'nvidia':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: endpoint || 'https://integrate.api.nvidia.com/v1',
      });
    case 'cohere':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: endpoint || 'https://api.cohere.ai/v1',
      });
    case 'openrouter':
      return createOpenAI({
        apiKey: effectiveApiKey || process.env.OPENROUTER_API_KEY,
        baseURL: endpoint || 'https://openrouter.ai/api/v1',
      });
    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: endpoint || 'http://localhost:11434/v1',
      });
    default:
      return createOpenAI({
        apiKey: effectiveApiKey || process.env.OPENAI_API_KEY,
      });
  }
}

function getProvider(modelConfig: ModelConfig) {
  return getProviderSync(modelConfig);
}

export const MagicWandSchema = z.object({
  suggestions: z.array(
    z.object({
      field: z.string(),
      value: z.string(),
      reasoning: z.string().optional(),
    })
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
    })
  ),
  overallScore: z.number().optional(),
});

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
    return REASONING_MODELS.some((rm) => modelLower.includes(rm));
  }

  async resolveModelConfig(modelConfig: ModelConfig): Promise<ModelConfig> {
    if (modelConfig.provider && (modelConfig.api_key || modelConfig.apiKey)) return modelConfig;

    const tierMap: Record<string, string> = {
      budget: 'BUDGET',
      fast: 'STANDARD',
      standard: 'STANDARD',
      premium: 'PREMIUM',
      reasoning: 'REASONING',
    };

    const tier = tierMap[String(modelConfig.id || '').toLowerCase()] || modelConfig.tier;

    if (tier) {
      const configService = await getLLMConfigService();
      if (configService) {
        const bestProvider = await configService.getNextFallback([], tier);
        if (bestProvider) {
          aiLogger.info(
            'LLMService',
            `Resolved Tier ${tier} to ${bestProvider.provider}/${bestProvider.model_id}`
          );
          return bestProvider;
        }
        aiLogger.warn('LLMService', `No providers found for Tier ${tier}, falling back to default`);
      }
    }

    return modelConfig;
  }

  async call(params: CallParams): Promise<Record<string, unknown>> {
    const { type, stream, schema, tools, cache, cacheTtl } = params;
    let { modelConfig } = params;

    // Intelligent Caching (Skip for streams/tools/reasoning for now)
    // We can cache simple text/structured generation
    const canCache = cache !== false && !stream && (!tools || tools.length === 0);
    let cacheKey = '';

    if (canCache) {
      try {
        cacheKey = this.generateCacheKey(params);
        const cached = await appCache.get<Record<string, unknown>>(cacheKey);
        if (cached) {
          aiLogger.info(
            'LLMService',
            `Cache hit for ${modelConfig.id} (${cacheKey.substring(0, 8)})`
          );
          return { ...cached, _cached: true };
        }
      } catch (error) {
        // Ignore cache errors
      }
    }

    modelConfig = await this.resolveModelConfig(modelConfig);
    const isReasoning =
      this.isReasoningModel(modelConfig?.id as string | undefined) ||
      modelConfig?.tier === 'REASONING';

    if (isReasoning) {
      aiLogger.info('LLMService', `Using reasoning model: ${modelConfig.id}`);
      return this.callReasoningModel({ ...params, modelConfig });
    }

    let result: Record<string, unknown>;

    if (tools && tools.length > 0) {
      if (stream) {
        result = await this.callWithToolsStream({ ...params, modelConfig });
      } else {
        result = await this.callWithTools({ ...params, modelConfig });
      }
    } else if (type === 'structured' && schema) {
      result = await this.callStructured({ ...params, modelConfig });
    } else if (stream) {
      result = await this.callStream({ ...params, modelConfig });
    } else {
      result = await this.callText({ ...params, modelConfig });
    }

    if (canCache && result && !result.stream) {
      // Cache success results only
      if (params.semantic) {
        const promptText =
          params.systemPrompt + '\n' + params.messages.map((m) => m.content).join('\n');
        try {
          const embedding = await embeddingService.generateEmbedding(promptText);
          await embeddingService.storeChunk(
            {
              documentId: 'cache',
              content: promptText,
              sourceType: 'llm_cache',
              metadata: { response: result },
            },
            embedding
          );
        } catch (err) {
          aiLogger.warn('LLMService', 'Failed to store semantic cache', err);
        }
      } else {
        await appCache.set(cacheKey, result, cacheTtl || 3600);
      }
    }

    return result;
  }

  private generateCacheKey(params: CallParams): string {
    const payload = JSON.stringify({
      model: params.modelConfig.id,
      provider: params.modelConfig.provider,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      system: params.systemPrompt,
      schema: params.schema ? String(params.schema) : undefined,
      temp: params.temperature,
      maxTokens: params.maxTokens,
    });
    return 'llm:' + createHash('sha256').update(payload).digest('hex');
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
      temperature: temperature || this.temperature,
    });
  }

  async callReasoningModel(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
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

    const result = await withGuards(
      providerId,
      async () =>
        generateText({
          model,
          messages: formattedMessages as any,
          maxTokens: 16384,
        } as any),
      {
        onRetry: (attempt: number, delay: number, error: Error) => {
          aiLogger.info('LLMService', `Retrying ${providerId} reasoning (attempt ${attempt})`, {
            delay,
            error: error.message,
          });
        },
        maxRetries: 2,
        timeout: 180000,
      }
    );

    return {
      content: result.text,
      usage: result.usage,
      isReasoningModel: true,
      model: modelConfig.id,
    };
  }

  async callWithTools(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
    const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

    const provider = getProvider(modelConfig);
    const model = provider(modelConfig.id as string);
    const providerId = String(modelConfig.provider || 'openai');
    const mcpModule = await import('./mcpServer.js');
    const mcpServer = (mcpModule.mcpServer || mcpModule.default) as McpServer;
    await import('./tools/index.js').catch(() => {});

    const formattedMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt || '' },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const toolDefinitions: Record<string, ReturnType<typeof tool>> = {};
    const toolDefs = tools || mcpServer.getToolDefinitions();

    for (const def of toolDefs) {
      aiLogger.debug('LLMService', `Registering tool: ${def.name}`);
      toolDefinitions[def.name] = tool({
        description: def.description,
        parameters: jsonSchema(def.parameters as any),
        execute: async (args: unknown) => mcpServer.execute(def.name, args, context),
      } as any) as any;
    }

    const result = await withGuards(
      providerId,
      async () =>
        generateText({
          model,
          messages: formattedMessages as any,
          tools: toolDefinitions,
          maxSteps: maxIterations,
        } as any),
      {
        onRetry: (attempt: number, delay: number, error: Error) => {
          aiLogger.info('LLMService', `Retrying ${providerId} with tools (attempt ${attempt})`, {
            delay,
            error: error.message,
          });
        },
      }
    );

    const toolCalls: ToolCall[] = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          toolCalls.push(...(step.toolCalls as any));
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

  async callWithToolsStream(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
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
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const toolDefinitions: Record<string, ReturnType<typeof tool>> = {};
    const toolDefs = tools || mcpServer.getToolDefinitions();

    for (const def of toolDefs) {
      toolDefinitions[def.name] = tool({
        description: def.description,
        parameters: jsonSchema(def.parameters as any),
        execute: async (args: unknown) => mcpServer.execute(def.name, args, context),
      } as any);
    }

    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await streamText({
            model,
            messages: formattedMessages as any,
            tools: toolDefinitions,
            maxSteps: maxIterations,
            abortSignal: AbortSignal.timeout(60000),
          } as any);

          await circuitBreaker.recordSuccess(providerId);
          return { stream: result.textStream };
        } catch (error: unknown) {
          lastError = error as Error;
          aiLogger.warn(
            'LLMService',
            `Stream initialization failed (attempt ${attempt + 1}/2): ${lastError.message}`
          );
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      throw lastError;
    } catch (error) {
      await circuitBreaker.recordFailure(providerId, error as Error);
      throw error;
    }
  }

  async callText(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
    const { modelConfig, systemPrompt, messages } = params;

    const provider = getProvider(modelConfig);
    const model = provider(modelConfig.id as string);
    const providerId = String(modelConfig.provider || 'openai');
    const timeoutMs =
      typeof params.timeoutMs === 'number' &&
      Number.isFinite(params.timeoutMs) &&
      params.timeoutMs > 0
        ? Math.max(1000, Math.floor(params.timeoutMs))
        : 60000;

    const formattedMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt || '' },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const result = await withGuards(
      providerId,
      async () =>
        generateText({
          model,
          messages: formattedMessages as any,
          abortSignal: AbortSignal.timeout(timeoutMs),
        }),
      {
        timeout: timeoutMs,
        ...(params.breakerOptions || {}),
        onRetry: (attempt: number, delay: number, error: Error) => {
          aiLogger.info('LLMService', `Retrying ${providerId} (attempt ${attempt})`, {
            delay,
            error: error.message,
          });
        },
      }
    );

    return {
      content: result.text,
      usage: result.usage,
    };
  }

  async callStream(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
    const { modelConfig, systemPrompt, messages } = params;

    const provider = getProvider(modelConfig);
    const model = provider(modelConfig.id as string);
    const providerId = String(modelConfig.provider || 'openai');

    const formattedMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt || '' },
      ...messages.filter((m) => m.role !== 'system'),
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
            messages: formattedMessages as any,
            abortSignal: AbortSignal.timeout(60000),
          });

          // Force-consume the first chunk BEFORE returning. This detects 429 /
          // rate-limit errors that only manifest during iteration (the Vercel AI
          // SDK resolves streamText() but the underlying API call fails lazily).
          // If we don't do this, the error surfaces only inside the route's
          // for-await loop, AFTER process() has already returned, making the
          // provider-fallback mechanism in AIPipeline.process() useless.
          const rawIterator = result.textStream[Symbol.asyncIterator]();
          let firstChunk: IteratorResult<string>;
          try {
            firstChunk = await rawIterator.next();
          } catch (firstChunkError: any) {
            // The actual API call failed (e.g. Gemini 429)
            aiLogger.warn(
              'LLMService',
              `Stream first-chunk failed (${providerId}/${modelConfig.id}): ${firstChunkError?.message?.slice(0, 200)}`
            );
            throw firstChunkError;
          }

          // Build a generator that yields the first chunk we already consumed,
          // then delegates to the rest of the iterator.
          async function* prependedStream(): AsyncGenerator<string> {
            if (!firstChunk.done && firstChunk.value) {
              yield firstChunk.value;
            }
            while (true) {
              const next = await rawIterator.next();
              if (next.done) break;
              if (next.value) yield next.value;
            }
          }

          await circuitBreaker.recordSuccess(providerId);
          return { stream: prependedStream() };
        } catch (error: unknown) {
          lastError = error as Error;
          aiLogger.warn(
            'LLMService',
            `Stream initialization failed (attempt ${attempt + 1}/2): ${lastError.message?.slice(0, 200)}`
          );
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      throw lastError;
    } catch (error) {
      await circuitBreaker.recordFailure(providerId, error as Error);
      throw error;
    }
  }

  async callStructured(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
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
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const result = await withGuards(
      providerId,
      async () =>
        generateObject({
          model,
          schema: zodSchema,
          messages: formattedMessages as any,
          abortSignal: AbortSignal.timeout(60000),
        }),
      {
        timeout: 60000,
        onRetry: (attempt: number) => {
          aiLogger.info(
            'LLMService',
            `Retrying structured call to ${providerId} (attempt ${attempt})`
          );
        },
      }
    );

    return {
      object: result.object,
      usage: result.usage,
    };
  }

  async testConnection(modelConfig: ModelConfig): Promise<Record<string, unknown>> {
    const providerId = String(modelConfig.provider || 'openai');

    try {
      const provider = getProvider(modelConfig);
      const model = provider(modelConfig.id as string);

      const result = await generateText({
        model,
        messages: [{ role: 'user', content: 'Say "pong"' }] as any,
        maxTokens: 5,
      } as any);

      await circuitBreaker.recordSuccess(providerId);

      return {
        success: true,
        response: result.text,
        usage: result.usage,
        circuitState: (await circuitBreaker.canExecute(providerId)).state,
      };
    } catch (error) {
      await circuitBreaker.recordFailure(providerId, error as Error);

      return {
        success: false,
        error: (error as Error).message,
        circuitState: (await circuitBreaker.canExecute(providerId)).state,
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
