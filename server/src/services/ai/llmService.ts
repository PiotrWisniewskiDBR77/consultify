/**
 * LLM Service - Vercel AI SDK Integration
 * Unified wrapper for model providers using the 'ai' package.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  asSchema,
  generateObject,
  generateText,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { createHash } from 'crypto';
import { z } from 'zod';

import { appCache } from '../redis/CacheService.js';
import circuitBreaker from './circuitBreaker.js';
import { embeddingService } from './embeddingService.js';
import { aiLogger } from './logger.js';
import {
  buildQaAiStructuredObject,
  buildQaAiText,
  buildQaAiUsage,
  createQaAiStream,
  getQaAiModeLabel,
  isQaAiMode,
} from './qaAiRuntime.js';
import { normalizeTokenUsage } from './tokenUsage.js';

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
    const usage: Record<string, any> = normalizeTokenUsage((result as any)?.usage) || {};
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
  modelId?: string;
  provider?: string;
  apiKey?: string | null;
  api_key?: string | null;
  endpoint?: string | null;
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
  /**
   * Z4 transport (fala „Teresa steruje Ideą") — narzędzia, których wykonanie NIE
   * odbywa się na serwerze. Model widzi je razem z `tools`, ale ich `execute`
   * tylko ZGŁASZA wywołanie przez `context.onClientToolCall(name, args)` (route
   * zamienia to na SSE `idea_action`) i zwraca krótkie potwierdzenie, żeby model
   * dokończył turę. Powód: otwarta reprezentacja Idei żyje w przeglądarce
   * (płótno, `window.dispatchEvent`), więc serwer nie ma czego wykonać — realny
   * handler (executeTeresaTool) uruchamia się na froncie. Pusta/niepodana lista
   * = ścieżka bez zmian. Wykonanie serwerowe (mcpServer.execute) dotyczy WYŁĄCZNIE
   * `tools`, nigdy `clientTools`.
   */
  clientTools?: ToolDefinition[];
  context?: unknown;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
  cache?: boolean; // Cache control
  cacheTtl?: number; // TTL in seconds
  semantic?: boolean; // Use semantic search for caching
  /**
   * Request model-level reasoning / extended-thinking.
   * `true` is treated as { effort: 'medium' }. Mapped per-provider to the
   * correct Vercel AI SDK providerOptions (OpenAI reasoningEffort, Anthropic
   * thinking budget, Google thinkingConfig). No-ops gracefully on providers
   * that do not support reasoning — never errors.
   */
  reasoning?: boolean | { effort?: 'low' | 'medium' | 'high' };
  /**
   * Escape hatch: provider-specific options forwarded verbatim to streamText()/
   * generateText() as `providerOptions`. Merged AFTER reasoning mapping, so an
   * explicit providerOptions can override the reasoning-derived defaults.
   */
  providerOptions?: Record<string, unknown>;
  /**
   * Optional total timeout hint for a single provider call.
   * Note: circuit-breaker retries can extend total wall time unless retryAttempts is reduced.
   */
  timeoutMs?: number;
  /** Caller lifecycle cancellation, composed with the provider timeout. */
  abortSignal?: AbortSignal;
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

// Exported so tests can exercise the real over-strip-regression guard directly
// (rather than re-implementing the logic in a test double).
export function normalizeBaseUrl(endpoint?: string): string | undefined {
  if (!endpoint) return undefined;
  let base = String(endpoint).trim();
  if (!base) return undefined;
  base = base.replace(/\/+$/, '');

  // Many DB rows store full "chat completions" endpoints, but provider SDKs expect a base URL.
  // Example: https://openrouter.ai/api/v1/chat/completions -> https://openrouter.ai/api/v1
  //
  // IMPORTANT: strip ONLY the trailing operation path, and leave any /vN version
  // segment intact. A previous version of this list included '/v1/messages' etc.
  // as whole suffixes, which over-stripped the /v1 too — e.g.
  // https://api.anthropic.com/v1/messages -> bare https://api.anthropic.com.
  // @ai-sdk/anthropic then POSTs to `${baseURL}/messages` with no /v1 -> 404 on
  // EVERY anthropic call whenever the DB endpoint included the full path (see
  // llmConfigService.ts's defaultEndpoint seed). providerSentinel.ts has an
  // identical twin of this function, fixed the same way.
  const suffixes = ['/chat/completions', '/completions', '/responses', '/messages'];
  const lower = base.toLowerCase();
  for (const s of suffixes) {
    if (lower.endsWith(s)) {
      base = base.slice(0, -s.length).replace(/\/+$/, '');
      break;
    }
  }
  return base || undefined;
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
  const normalizedBaseUrl = normalizeBaseUrl(endpoint);
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
  const envOpenRouter = process.env.OPENROUTER_API_KEY?.trim();
  const envGemini = (
    process.env.GEMINI_API_KEY ||
    // preferred naming in this repo
    process.env.GOOGLE_AI_API_KEY ||
    // legacy fallback(s)
    (process.env as any).GOOGLE_API_KEY ||
    (process.env as any).GOOGLE_API_KEY
  )?.trim();
  const envDeepSeek = process.env.DEEPSEEK_API_KEY?.trim();
  const envZai = process.env.ZAI_API_KEY?.trim();

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
      // @ai-sdk/anthropic v3 default base URL omits the `/v1` segment, so
      // env-key calls hit https://api.anthropic.com/messages → 404 → the SDK
      // surfaces it as "Invalid JSON response". Pin the correct base (honoring
      // a DB/endpoint override) the same way deepseek/zai/qwen do below.
      //
      // normalizeBaseUrl only strips the trailing operation path — it does NOT
      // guarantee the remainder ends in /vN (a DB/env override can legitimately
      // be a bare host, e.g. https://api.anthropic.com with no version). Guard
      // against that here so we never end up POSTing to `${baseURL}/messages`
      // without /v1 in front of it.
      const anthropicBase = normalizedBaseUrl
        ? /\/v\d+$/i.test(normalizedBaseUrl)
          ? normalizedBaseUrl
          : `${normalizedBaseUrl}/v1`
        : 'https://api.anthropic.com/v1';
      return createAnthropic({
        apiKey: envAnthropic || effectiveApiKey,
        baseURL: anthropicBase,
      });
    }
    case 'deepseek':
      return createOpenAI({
        apiKey: envDeepSeek || effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://api.deepseek.com',
      });
    case 'z_ai':
    case 'zai':
      return createOpenAI({
        apiKey: envZai || effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://api.z.ai/api/paas/v4',
      });
    case 'qwen':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      });
    case 'mistral':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://api.mistral.ai/v1',
      });
    case 'nvidia':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://integrate.api.nvidia.com/v1',
      });
    case 'cohere':
      return createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: normalizedBaseUrl || 'https://api.cohere.ai/v1',
      });
    case 'openrouter':
      if (!envOpenRouter && !effectiveApiKey) {
        throw new Error('No OpenRouter API key configured (set OPENROUTER_API_KEY).');
      }
      return createOpenAI({
        apiKey: effectiveApiKey || envOpenRouter,
        baseURL: normalizedBaseUrl || 'https://openrouter.ai/api/v1',
      });
    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: normalizedBaseUrl || 'http://localhost:11434/v1',
      });
    default:
      return createOpenAI({
        apiKey: effectiveApiKey || process.env.OPENAI_API_KEY,
      });
  }
}

// Providers that only support the Chat Completions API (not the Responses API).
// @ai-sdk/openai v3 defaults to the Responses API when calling provider(modelId),
// so we must use provider.chat(modelId) for these.
const CHAT_COMPLETIONS_ONLY_PROVIDERS = new Set([
  'deepseek',
  'z_ai',
  'zai',
  'qwen',
  'mistral',
  'nvidia',
  'cohere',
  'openrouter',
  'ollama',
]);

function getModel(modelConfig: ModelConfig) {
  const provider = getProviderSync(modelConfig);
  const modelId = modelConfig.id as string;
  const providerName = String(modelConfig.provider || '').toLowerCase();

  if (CHAT_COMPLETIONS_ONLY_PROVIDERS.has(providerName) && typeof provider.chat === 'function') {
    // @ai-sdk/openai chat models default to structuredOutputs:true, which forces OpenAI STRICT
    // json_schema (every nested object must list `required` for ALL properties + additionalProperties
    // false). Zod→json_schema conversion does not satisfy strict for nested arrays/objects, so the
    // upstream (OpenAI/Azure via OpenRouter) rejects it with code 400 "Invalid schema for
    // response_format" → surfaced as a generic "Provider returned error".
    //
    // TS-REMEDIATION NOTE (2026-08-08): the installed @ai-sdk/openai@3.0.90 provider's
    // `chat(modelId)` type signature takes ONLY `modelId` — the `structuredOutputs` second
    // argument (and the option itself) no longer exists anywhere in this package's type
    // definitions. That means this `{ structuredOutputs: false }` argument was ALREADY a
    // silent no-op at runtime before this fix (plain JS ignores the extra argument) — the
    // comment's described mitigation has not actually been in effect under this SDK version.
    // Removing the argument here is type-only and changes no runtime behavior. The underlying
    // "Invalid schema for response_format" risk this comment describes is a real,
    // pre-existing functional gap that needs its own product/engineering decision (e.g. finding
    // the v3-equivalent knob, or fixing the Zod→json_schema conversion for strict mode) —
    // flagged here, not silently fixed.
    return provider.chat(modelId);
  }
  return provider(modelId);
}

function getProvider(modelConfig: ModelConfig) {
  return getProviderSync(modelConfig);
}

/**
 * Map a `reasoning` request + caller-supplied providerOptions onto the Vercel AI
 * SDK `providerOptions` shape for the active provider. Returns `undefined` when
 * nothing reasoning-related applies, so the request path is byte-for-byte
 * unchanged for normal (reasoning-off) chat.
 *
 * Per-provider wiring:
 *   - openai / openrouter / deepseek (OpenAI-compatible): { openai: { reasoningEffort } }
 *   - anthropic: { anthropic: { thinking: { type: 'enabled', budgetTokens } } }
 *   - google / gemini: { google: { thinkingConfig: { includeThoughts, thinkingBudget } } }
 * Providers without reasoning support get no reasoning options (graceful no-op).
 * Explicit `providerOptions` is merged last and wins on key conflicts.
 */
function buildProviderOptions(
  providerName: string,
  reasoning: CallParams['reasoning'],
  explicit?: Record<string, unknown>
): Record<string, unknown> | undefined {
  const provider = providerName.toLowerCase();
  const reasoningOpts: Record<string, Record<string, unknown>> = {};

  if (reasoning) {
    const effort: 'low' | 'medium' | 'high' =
      typeof reasoning === 'object' && reasoning.effort ? reasoning.effort : 'medium';

    if (provider === 'openai' || provider === 'openrouter') {
      reasoningOpts.openai = { reasoningEffort: effort };
    } else if (provider === 'deepseek') {
      // DeepSeek-R1 (deepseek-reasoner) reasons UNCONDITIONALLY and exposes the
      // trace via delta.reasoning_content — it does not accept the OpenAI
      // `reasoning_effort` parameter (sending it can 400). So we deliberately
      // emit NO providerOptions for deepseek; callStream reads reasoning_content
      // from the raw stream chunks instead.
    } else if (provider === 'anthropic') {
      const budgetByEffort: Record<string, number> = { low: 4096, medium: 8192, high: 16384 };
      reasoningOpts.anthropic = {
        thinking: { type: 'enabled', budgetTokens: budgetByEffort[effort] },
      };
    } else if (provider === 'google' || provider === 'gemini') {
      const budgetByEffort: Record<string, number> = { low: 2048, medium: 8192, high: 16384 };
      reasoningOpts.google = {
        thinkingConfig: { includeThoughts: true, thinkingBudget: budgetByEffort[effort] },
      };
    }
    // Other providers: no reasoning options — no-op, never throws.
  }

  const merged: Record<string, unknown> = { ...reasoningOpts };
  if (explicit && typeof explicit === 'object') {
    for (const [k, v] of Object.entries(explicit)) {
      const base = merged[k];
      merged[k] =
        base && typeof base === 'object' && v && typeof v === 'object'
          ? { ...(base as object), ...(v as object) }
          : v;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Pull the reasoning / chain-of-thought delta out of a raw OpenAI-compatible
 * Chat Completions stream chunk. The @ai-sdk/openai chat parser only surfaces
 * `delta.content`, so reasoning fields used by non-OpenAI providers are dropped
 * from the normal stream — we recover them from the raw chunk (exposed via
 * streamText `includeRawChunks: true` as `{ type: 'raw', rawValue }`).
 *
 * Field map:
 *   - DeepSeek-R1 (deepseek-reasoner):   choices[].delta.reasoning_content
 *   - OpenRouter reasoning models:        choices[].delta.reasoning
 *     (OpenRouter may also nest as delta.reasoning.text / .content)
 *
 * Returns the reasoning text for this chunk, or '' when there is none. Never
 * throws — a malformed chunk simply yields ''.
 */
function extractReasoningFromRawChunk(rawValue: unknown): string {
  try {
    const chunk = rawValue as
      | {
          choices?: Array<{
            delta?: {
              reasoning_content?: unknown;
              reasoning?: unknown;
            };
          }>;
        }
      | undefined;
    const delta = chunk?.choices?.[0]?.delta;
    if (!delta) return '';

    // DeepSeek: reasoning_content is a plain string delta.
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
      return delta.reasoning_content;
    }

    // OpenRouter: reasoning can be a string, or an object { text|content }.
    const r = delta.reasoning;
    if (typeof r === 'string' && r.length > 0) return r;
    if (r && typeof r === 'object') {
      const obj = r as { text?: unknown; content?: unknown };
      if (typeof obj.text === 'string' && obj.text.length > 0) return obj.text;
      if (typeof obj.content === 'string' && obj.content.length > 0) return obj.content;
    }
    return '';
  } catch {
    return '';
  }
}

export { normalizeTokenUsage } from './tokenUsage.js';

/**
 * Extract the post-stream usage promise from a streamText() result.
 * Prefers totalUsage (multi-step aggregate, AI SDK v5/v6) over usage.
 * Both SDK promises are marked handled so a mid-stream provider error can
 * never escalate into an unhandled promise rejection; the returned promise
 * always resolves (normalized usage or undefined).
 */
function buildStreamUsagePromise(result: unknown): Promise<ReturnType<typeof normalizeTokenUsage>> {
  const totalUsageP = (result as { totalUsage?: unknown })?.totalUsage;
  const usageP = (result as { usage?: unknown })?.usage;
  Promise.resolve(totalUsageP).catch(() => undefined);
  Promise.resolve(usageP).catch(() => undefined);
  return Promise.resolve(totalUsageP ?? usageP)
    .then((u) => normalizeTokenUsage(u))
    .catch(() => undefined);
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

    if (isQaAiMode()) {
      const content = buildQaAiText(params);
      if (stream) {
        return {
          stream: createQaAiStream(content),
          usage: buildQaAiUsage(content),
          qaMock: true,
          provider: getQaAiModeLabel(),
        };
      }
      if (type === 'structured' && schema) {
        return {
          object: buildQaAiStructuredObject(schema),
          usage: buildQaAiUsage(content),
          qaMock: true,
          provider: getQaAiModeLabel(),
        };
      }
      return {
        content,
        usage: buildQaAiUsage(content),
        qaMock: true,
        provider: getQaAiModeLabel(),
      };
    }

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

    const model = getModel(modelConfig);
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
      usage: normalizeTokenUsage(result.usage),
      isReasoningModel: true,
      model: modelConfig.id,
    };
  }

  async callWithTools(
    params: CallParams & { modelConfig: ModelConfig }
  ): Promise<Record<string, unknown>> {
    const { modelConfig, systemPrompt, messages, tools, context, maxIterations = 3 } = params;

    const model = getModel(modelConfig);
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
        inputSchema: jsonSchema(def.parameters as any),
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
          // ai v6 removed `maxSteps`; multi-step tool loops now use
          // `stopWhen: stepCountIs(n)`. Without this the SDK stops after the
          // first step (the tool call) and never generates the follow-up text.
          stopWhen: stepCountIs(maxIterations),
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
        // ai-sdk v6 splits a step's tool activity into two separate arrays —
        // `step.toolCalls[]` (toolCallId + toolName + `input`, NO result) and
        // `step.toolResults[]` (toolCallId + `output`). v4/v5 used `args`/
        // `result` and (in the old API) merged both onto the same tool-call
        // object; v6's toolCalls entries never carry a result at all, so the
        // output must be looked up from toolResults by toolCallId. Without
        // this join, tc.result/tc.output are ALWAYS undefined on v6 — the
        // args fix alone (input→args) is not sufficient.
        const outputByCallId = new Map<string, unknown>();
        for (const tr of ((step as any).toolResults || []) as any[]) {
          outputByCallId.set(tr.toolCallId, tr.output ?? tr.result);
        }
        for (const tc of ((step as any).toolCalls || []) as any[]) {
          toolCalls.push({
            toolName: tc.toolName,
            args: tc.input ?? tc.args,
            result: outputByCallId.has(tc.toolCallId)
              ? outputByCallId.get(tc.toolCallId)
              : (tc.output ?? tc.result),
          });
        }
      }
    }

    return {
      content: result.text,
      usage: normalizeTokenUsage(result.usage),
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

    const model = getModel(modelConfig);
    const providerId = String(modelConfig.provider || 'openai');
    const mcpModule = await import('./mcpServer.js');
    const mcpServer = (mcpModule.mcpServer || mcpModule.default) as McpServer;
    await import('./tools/index.js').catch(() => {});

    const circuitCheck = await circuitBreaker.canExecute(providerId);
    if (!circuitCheck.allowed) {
      // Feedback #a9fcdd99 / #3b6c0287 — the old `throw new Error(reason)` produced
      // an Error with no code, so AIPipeline.handleError stamped it as AI_ERROR
      // and the frontend SSE handler fell through to `String(data.error)` —
      // leaking the raw "Circuit [openrouter] is OPEN. Retry in 18s" diagnostic
      // into the user-facing chat bubble. Tag it with CIRCUIT_OPEN so both the
      // pipeline (for provider-level fallback) and the client (for a friendly
      // localized message) can recognize the condition.
      const err: any = new Error(circuitCheck.reason || `Circuit [${providerId}] is OPEN`);
      err.code = 'CIRCUIT_OPEN';
      err.isCircuitOpen = true;
      err.breakerName = providerId;
      err.circuitState = circuitCheck.state;
      throw err;
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
        inputSchema: jsonSchema(def.parameters as any),
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
            // ai v6: `maxSteps` is gone; use `stopWhen: stepCountIs(n)` so the
            // SDK continues past the tool call to stream the confirmation turn.
            stopWhen: stepCountIs(maxIterations),
            abortSignal: AbortSignal.timeout(60000),
          } as any);

          await circuitBreaker.recordSuccess(providerId);
          const usagePromise = buildStreamUsagePromise(result);
          return { stream: result.textStream, usagePromise };
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

    const model = getModel(modelConfig);
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

    const providerOptions = buildProviderOptions(
      providerId,
      params.reasoning,
      params.providerOptions
    );

    const result = await withGuards(
      providerId,
      async () =>
        generateText({
          model,
          messages: formattedMessages as any,
          abortSignal: AbortSignal.timeout(timeoutMs),
          ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
          ...(typeof params.maxTokens === 'number' ? { maxOutputTokens: params.maxTokens } : {}),
          ...(providerOptions ? { providerOptions: providerOptions as any } : {}),
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
      usage: normalizeTokenUsage(result.usage),
    };
  }

  async callStream(
    params: CallParams & {
      modelConfig: ModelConfig;
      /**
       * Optional sink for the model's native reasoning / thinking deltas.
       * When provided AND the provider/model supports reasoning, callStream
       * consumes the SDK fullStream and (a) forwards reasoning text to this sink
       * as it arrives AND (b) yields a MIXED `stream`: visible answer text as
       * plain strings interleaved with reasoning deltas as `{ reasoning }`
       * objects, both in real arrival order, so the trace can be streamed live.
       * When omitted, the legacy textStream path runs verbatim — normal chat
       * yields ONLY strings and is byte-for-byte unaffected.
       */
      onReasoning?: (delta: string) => void;
    }
  ): Promise<Record<string, unknown>> {
    const { modelConfig, systemPrompt, messages, onReasoning } = params;

    const model = getModel(modelConfig);
    const providerId = String(modelConfig.provider || 'openai');

    const formattedMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt || '' },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    // Reasoning is only wired when a sink is supplied AND a reasoning request
    // was made. providerOptions maps reasoning → the right per-provider knob;
    // when there's no reasoning to surface we leave the legacy path untouched.
    const providerOptions = buildProviderOptions(
      providerId,
      params.reasoning,
      params.providerOptions
    );
    const wantsReasoning = !!onReasoning && !!params.reasoning;

    // SPEC_01 (Tryb A): optional function-calling on the streaming chat path.
    // When the caller supplies `tools`, register them so the model can invoke
    // them mid-stream (e.g. generate_deliverable → opens a canvas draft). The
    // SDK auto-runs each tool's `execute` server-side and continues generation
    // (maxSteps), so the visible answer stream is unchanged for the user; the
    // tool's side effects (and its onDeliverable emit) fire during execution.
    // Reasoning models (deepseek-reasoner) don't support tools, so AIPipeline
    // only passes tools when reasoning is OFF — guarded again here for safety.
    let streamToolDefinitions: Record<string, ReturnType<typeof tool>> | undefined;
    // Captured when a tool runs successfully: its user-facing confirmation, used
    // to rescue a post-tool empty stream (see firstChunk.done branch).
    let lastToolMessage: string | undefined;
    // naprawa-r2Narr · Problem 1 — the created artifact's REAL kind + title. This
    // is the single source of truth for the confirmation the user reads: the rescue
    // sentence is derived from `kind` (not whichever tool wrote `message` last), and
    // a model confirmation that names a DIFFERENT artifact type gets a corrective
    // canonical line. `kind` matches the deliverable SSE event the FE navigates on,
    // so the words and the landing module can never disagree.
    let lastCreatedKind: import('./creationConfirmation.js').CreationKind | undefined;
    let lastCreatedTitle: string | undefined;
    const confirmationLang: 'pl' | 'en' =
      String((params.context as any)?.language || '').toLowerCase() === 'en' ? 'en' : 'pl';
    if (params.tools?.length && !wantsReasoning) {
      const mcpModule = await import('./mcpServer.js');
      const mcpServer = (mcpModule.mcpServer || mcpModule.default) as McpServer;
      await import('./tools/index.js').catch(() => {});
      streamToolDefinitions = {};
      for (const def of params.tools) {
        streamToolDefinitions[def.name] = tool({
          description: def.description,
          inputSchema: jsonSchema(def.parameters as any),
          execute: async (args: unknown) => {
            const r = await mcpServer.execute(def.name, args, params.context as any);
            // Remember a successful tool's user-facing confirmation. Some
            // providers/routes (e.g. gpt-4o via OpenRouter) invoke a tool but then
            // emit NO text on the post-tool step, which looks like an empty stream
            // (see the firstChunk.done branch below). Surfacing this message there
            // gives the user a result AND stops a successful tool turn from being
            // misread as a failure that triggers duplicate-causing retries.
            // NOTE: mcpServer.execute wraps the handler result as
            // `{ status: 'SUCCESS', data: <handlerResult> }`, so the confirmation
            // lives at r.data.message — NOT r.message.
            try {
              const wrapped = r as {
                status?: string;
                data?: { ok?: unknown; message?: unknown; kind?: unknown; title?: unknown };
              };
              const m = wrapped?.data?.message;
              if (
                wrapped?.status === 'SUCCESS' &&
                wrapped?.data?.ok !== false &&
                typeof m === 'string' &&
                m.trim()
              ) {
                lastToolMessage = m;
                // naprawa-r2Narr · Problem 1 — remember the REAL created kind/title
                // so the confirmation the user reads is derived from `kind`, the one
                // authoritative type token (never a stale/other tool's message).
                const k = wrapped?.data?.kind;
                const KNOWN = new Set([
                  'initiative',
                  'task',
                  'decision',
                  'note',
                  'doc',
                  'sheet',
                  'deck',
                  'mindmap',
                  'process_flow',
                  'table',
                  'whiteboard',
                ]);
                if (typeof k === 'string' && KNOWN.has(k)) {
                  lastCreatedKind = k as typeof lastCreatedKind;
                  lastCreatedTitle =
                    typeof wrapped?.data?.title === 'string' ? wrapped.data.title : undefined;
                }
              }
            } catch {
              /* never let result inspection break tool execution */
            }
            return r;
          },
        } as any);
      }
    }

    // Z4 transport — narzędzia klienckie (akcje otwartej Idei). Rejestrujemy je
    // OBOK narzędzi mcp, ale ich `execute` NIC nie robi na serwerze: zgłasza
    // wywołanie przez `context.onClientToolCall(name, args)` (route → SSE
    // `idea_action`) i zwraca krótkie potwierdzenie, żeby model dokończył turę.
    // Realny handler (executeTeresaTool) uruchamia się na froncie. Blok jest w
    // pełni addytywny: bez `clientTools` nic się nie zmienia; gdy są, ale nie ma
    // `tools`, inicjujemy tu `streamToolDefinitions`, żeby `useFullStream` +
    // `stopWhen` włączyły się tak samo jak dla narzędzi deliverable.
    if (params.clientTools?.length && !wantsReasoning) {
      const onClientToolCall = (params.context as any)?.onClientToolCall as
        | ((name: string, args: unknown) => void)
        | undefined;
      if (!streamToolDefinitions) streamToolDefinitions = {};
      for (const def of params.clientTools) {
        // Nie nadpisuj narzędzia mcp o tej samej nazwie (mcp ma pierwszeństwo —
        // to ono realnie wykonuje po stronie serwera).
        if (streamToolDefinitions[def.name]) continue;
        streamToolDefinitions[def.name] = tool({
          description: def.description,
          inputSchema: jsonSchema(def.parameters as any),
          execute: async (args: unknown) => {
            try {
              onClientToolCall?.(def.name, args);
            } catch {
              /* zgłoszenie do klienta nie może wywrócić strumienia */
            }
            // Krótkie, deterministyczne potwierdzenie dla modelu. NIE twierdzimy,
            // że akcja się wykonała — front dopiero ją uruchomi (i może odmówić,
            // np. przy confirmBeforeRun). Model ma tylko domknąć turę.
            return {
              status: 'DISPATCHED_TO_CLIENT',
              tool: def.name,
              message:
                confirmationLang === 'en'
                  ? 'Requested in the open Idea view; the interface will apply it.'
                  : 'Przekazano do otwartej reprezentacji Idei; interfejs zaraz to wykona.',
            };
          },
        } as any);
      }
    }

    const circuitCheck = await circuitBreaker.canExecute(providerId);
    if (!circuitCheck.allowed) {
      // Feedback #a9fcdd99 / #3b6c0287 — see matching block in callWithToolsStream.
      // Tagging the error lets the AIPipeline fallback loop keep iterating to the
      // next candidate and gives the client a localizable code to map on.
      const err: any = new Error(circuitCheck.reason || `Circuit [${providerId}] is OPEN`);
      err.code = 'CIRCUIT_OPEN';
      err.isCircuitOpen = true;
      err.breakerName = providerId;
      err.circuitState = circuitCheck.state;
      throw err;
    }

    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const timeoutSignal = AbortSignal.timeout(params.timeoutMs ?? 60_000);
          const abortSignal = params.abortSignal
            ? AbortSignal.any([params.abortSignal, timeoutSignal])
            : timeoutSignal;
          const result = await streamText({
            model,
            messages: formattedMessages as any,
            abortSignal,
            ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
            ...(typeof params.maxTokens === 'number' ? { maxOutputTokens: params.maxTokens } : {}),
            ...(providerOptions ? { providerOptions: providerOptions as any } : {}),
            // SPEC_01 (Tryb A): function-calling on streaming chat. In ai v6,
            // `maxSteps` was removed — the multi-step loop is driven by
            // `stopWhen: stepCountIs(n)`. It lets the SDK continue generating a
            // confirmation turn AFTER the tool runs (without it the stream could
            // end on the tool call with no text → EMPTY_STREAM). Only set when
            // tools are present — normal chat path is byte-for-byte unchanged.
            ...(streamToolDefinitions
              ? {
                  tools: streamToolDefinitions,
                  stopWhen: stepCountIs(params.maxIterations ?? 4),
                }
              : {}),
            // Reasoning ON: include raw provider chunks so we can read OpenAI-
            // compatible reasoning fields the SDK chat parser drops. DeepSeek-R1
            // (deepseek-reasoner) streams its trace in delta.reasoning_content,
            // and OpenRouter reasoning models use delta.reasoning — neither is
            // mapped to a `reasoning-delta` part by @ai-sdk/openai's chat path,
            // so we extract them from { type: 'raw' } parts below. Native
            // reasoning-delta parts (Anthropic thinking, OpenAI Responses API)
            // are still handled too. OFF: never set — legacy path unchanged.
            ...(wantsReasoning ? { includeRawChunks: true } : {}),
          });

          // Force-consume the first chunk BEFORE returning. This detects 429 /
          // rate-limit errors that only manifest during iteration (the Vercel AI
          // SDK resolves streamText() but the underlying API call fails lazily).
          // If we don't do this, the error surfaces only inside the route's
          // for-await loop, AFTER process() has already returned, making the
          // provider-fallback mechanism in AIPipeline.process() useless.
          //
          // Reasoning ON: iterate fullStream and yield a MIXED stream in arrival
          // order — text-delta parts yield as plain strings (the visible answer),
          // reasoning parts yield as `{ reasoning: delta }` objects so they flow
          // to the SSE reasoning channel the INSTANT the model emits them (no
          // buffering). DeepSeek-R1 emits its whole trace BEFORE any text, so this
          // makes the trace stream live during the thinking phase instead of
          // arriving in one block right before the answer. onReasoning is still
          // invoked for any side-channel consumers. Reasoning OFF: legacy
          // textStream — string-for-string identical, never yields objects.
          type StreamItem = string | { reasoning: string };
          // Use the reasoning-aware fullStream iterator whenever reasoning is
          // requested OR tools are present. Reasoning models (e.g. Z.ai GLM-4.6
          // via OpenRouter) emit a reasoning block around their content + tool
          // calls; the plain textStream path mishandled that and produced
          // EMPTY_STREAM. `surfaceReasoning` controls whether internal reasoning
          // is forwarded to the user — only when they asked (showReasoning);
          // otherwise it is consumed SILENTLY so a tool-calling model's thinking
          // never leaks into the visible answer. text-delta + tool execution flow
          // identically for non-reasoning models (e.g. gpt-4o), so their path is
          // unchanged in practice.
          const useFullStream = wantsReasoning || !!streamToolDefinitions;
          const surfaceReasoning = wantsReasoning;
          const rawIterator: AsyncIterator<StreamItem> = useFullStream
            ? (function () {
                const fs = result.fullStream[Symbol.asyncIterator]();
                return {
                  async next(): Promise<IteratorResult<StreamItem>> {
                    // Yield the next item (text or reasoning) in arrival order;
                    // skip only structural parts (start/end, tool-*, source).
                    while (true) {
                      const part = await fs.next();
                      if (part.done) return { done: true, value: undefined };
                      const p = part.value as {
                        type?: string;
                        text?: string;
                        rawValue?: unknown;
                      };
                      if (p?.type === 'reasoning-delta') {
                        // Native reasoning channel: Anthropic extended thinking,
                        // OpenAI Responses API reasoning summaries, etc.
                        if (surfaceReasoning && typeof p.text === 'string' && p.text.length > 0) {
                          try {
                            onReasoning?.(p.text);
                          } catch {
                            /* never let a reasoning sink error break the answer stream */
                          }
                          return { done: false, value: { reasoning: p.text } };
                        }
                        continue;
                      }
                      if (p?.type === 'raw') {
                        // OpenAI-compatible chat providers (DeepSeek-R1 via the
                        // direct API, OpenRouter reasoning models) stream their
                        // chain-of-thought in fields the SDK's chat parser drops:
                        //   - DeepSeek:    choices[].delta.reasoning_content
                        //   - OpenRouter:  choices[].delta.reasoning
                        // We recover them from the raw chunk and yield inline so
                        // they reach the FE in real time. text-delta still carries
                        // the visible answer below.
                        const reasoningChunk = surfaceReasoning
                          ? extractReasoningFromRawChunk(p.rawValue)
                          : '';
                        if (reasoningChunk) {
                          try {
                            onReasoning?.(reasoningChunk);
                          } catch {
                            /* never let a reasoning sink error break the answer stream */
                          }
                          return { done: false, value: { reasoning: reasoningChunk } };
                        }
                        continue;
                      }
                      if (p?.type === 'text-delta' && typeof p.text === 'string') {
                        return { done: false, value: p.text };
                      }
                      // error parts surface as thrown by the SDK on the next pull;
                      // all other part types (tool-*, start/end, source) are ignored.
                    }
                  },
                };
              })()
            : (result.textStream[Symbol.asyncIterator]() as AsyncIterator<StreamItem>);
          let firstChunk: IteratorResult<StreamItem>;
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

          // Some providers can successfully initialize a stream but immediately end it
          // without producing any tokens (e.g. blocked/empty completion). Treat this as
          // a failure so AIPipeline can try its cross-provider fallback chain.
          if (firstChunk.done) {
            // RESCUE: the model invoked a tool that SUCCEEDED (we captured its
            // confirmation) but then streamed no text — common for gpt-4o via
            // OpenRouter on the post-tool step. Surface the tool's message as the
            // answer instead of throwing. This both shows the user a result and
            // stops AIPipeline from retrying a successful tool turn with the next
            // candidate model — those retries re-ran the tool and created
            // duplicate initiatives (verified on demo 2026-06-28).
            if (lastToolMessage) {
              // naprawa-r2Narr · Problem 1 — prefer the canonical kind-derived
              // confirmation over the raw tool `message`. On a multi-tool turn the
              // captured `message` can belong to a DIFFERENT tool than the artifact
              // the FE actually opens; deriving from `kind` guarantees the words
              // match the created object.
              let toolMsg = lastToolMessage;
              if (lastCreatedKind) {
                try {
                  const { buildCreationConfirmation } = await import('./creationConfirmation.js');
                  toolMsg = buildCreationConfirmation(
                    lastCreatedKind,
                    lastCreatedTitle || '',
                    confirmationLang
                  );
                } catch {
                  /* fall back to the raw tool message */
                }
              }
              async function* toolOnlyStream(): AsyncGenerator<StreamItem> {
                yield toolMsg;
              }
              await circuitBreaker.recordSuccess(providerId);
              const usagePromise = buildStreamUsagePromise(result);
              return { stream: toolOnlyStream(), usagePromise };
            }
            const emptyErr: any = new Error(
              `LLM stream ended immediately without output (${providerId}/${String(modelConfig.id)}).`
            );
            emptyErr.code = 'EMPTY_STREAM';
            throw emptyErr;
          }

          // Build a generator that yields the first chunk we already consumed,
          // then delegates to the rest of the iterator. With reasoning ON this
          // may yield `{ reasoning }` objects interleaved with text strings (in
          // arrival order); with reasoning OFF only strings flow (unchanged).
          async function* prependedStream(): AsyncGenerator<StreamItem> {
            let emittedText = false;
            let visibleText = '';
            const track = (v: StreamItem) => {
              if (typeof v === 'string' && v.trim().length > 0) {
                emittedText = true;
                visibleText += v;
              }
            };
            if (firstChunk.value !== undefined) {
              track(firstChunk.value);
              yield firstChunk.value;
            }
            while (true) {
              const next = await rawIterator.next();
              if (next.done) break;
              if (next.value !== undefined) {
                track(next.value);
                yield next.value;
              }
            }
            // naprawa-r2Narr · Problem 1 — the canonical, kind-derived confirmation
            // (single source of truth). Built lazily only when a creation tool ran.
            let canonicalConfirmation: string | undefined;
            if (lastCreatedKind) {
              try {
                const { buildCreationConfirmation } = await import('./creationConfirmation.js');
                canonicalConfirmation = buildCreationConfirmation(
                  lastCreatedKind,
                  lastCreatedTitle || '',
                  confirmationLang
                );
              } catch {
                /* fall through to raw tool message below */
              }
            }
            // END-OF-STREAM RESCUE: a reasoning model can call a tool successfully
            // and emit NO meaningful visible text (e.g. GLM-4.6 finishes on the
            // tool-call step with only whitespace). The firstChunk.done rescue
            // above only fires when the FIRST pull is already done; here we also
            // cover the case where some whitespace/reasoning flowed first. If the
            // turn produced a successful tool message but no real answer text,
            // surface the kind-derived confirmation (or the raw tool message).
            if (!emittedText && (canonicalConfirmation || lastToolMessage)) {
              yield (canonicalConfirmation || lastToolMessage) as string;
            } else if (emittedText && lastCreatedKind && canonicalConfirmation) {
              // narracja ≠ kind GUARD: the model DID write a confirmation, but it
              // names a DIFFERENT artifact type than the one actually created
              // (verbatim live bug: "Utworzyłem DECYZJĘ…" after creating an
              // initiative). We do NOT delete the model's prose — we append the
              // authoritative, kind-derived line so the user reads the truth about
              // what was created and where it lives. Additive + deterministic.
              try {
                const { textContradictsKind } = await import('./creationConfirmation.js');
                if (textContradictsKind(visibleText, lastCreatedKind)) {
                  yield `\n\n${canonicalConfirmation}`;
                }
              } catch {
                /* never let the guard break the stream */
              }
            }
          }

          await circuitBreaker.recordSuccess(providerId);
          // result.usage resolves only after the stream is fully consumed —
          // hand it to the caller so streamed calls can log real token usage
          // (ai_usage_logs) instead of 0/0. Never let it reject the request,
          // and mark BOTH SDK promises handled (a stream error rejects them
          // and the unconsumed one would surface as an unhandled rejection).
          const usagePromise = buildStreamUsagePromise(result);
          return { stream: prependedStream(), usagePromise };
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

    const model = getModel(modelConfig);
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

    // Honor an explicit per-call timeout (large deliverables — e.g. an 8-section
    // report structure or rich per-section content — legitimately exceed 60s).
    // Default unchanged at 60s when the caller does not override.
    const structuredTimeoutMs =
      typeof params.timeoutMs === 'number' && params.timeoutMs > 0 ? params.timeoutMs : 60000;

    // OpenRouter (and other OpenAI-compatible aggregators) route to upstream providers
    // (Azure/OpenAI/Google) whose STRICT json_schema mode — which @ai-sdk/openai v3 +
    // ai v6's generateObject force and won't disable via mode/structuredOutputs — rejects
    // any schema with an OPTIONAL field (OpenAI strict requires EVERY property in `required`),
    // returning code 400 "Invalid schema for response_format" → surfaced as "Provider returned
    // error". For these providers, skip generateObject's json_schema entirely: ask for raw JSON
    // via generateText, then parse + Zod-validate ourselves (same guarantee, no strict schema).
    const JSON_MODE_PROVIDERS = new Set(['openrouter', 'ollama']);

    if (JSON_MODE_PROVIDERS.has(providerId.toLowerCase())) {
      let schemaHint = '';
      try {
        const js = (asSchema(zodSchema as any) as any)?.jsonSchema;
        if (js)
          schemaHint = `\n\nThe JSON MUST conform exactly to this JSON Schema (produce every required field):\n${JSON.stringify(js)}`;
      } catch {
        /* schema introspection best-effort */
      }
      const jsonMessages: LLMMessage[] = [
        {
          role: 'system',
          content: `${systemPrompt || ''}\n\nYou MUST respond with a SINGLE valid JSON object only — no prose, no markdown fences.${schemaHint}`,
        },
        ...messages.filter((m) => m.role !== 'system'),
      ];
      const textResult = await withGuards(
        providerId,
        async () =>
          generateText({
            model,
            messages: jsonMessages as any,
            abortSignal: AbortSignal.timeout(structuredTimeoutMs),
          }),
        {
          timeout: structuredTimeoutMs,
          onRetry: (attempt: number) =>
            aiLogger.info(
              'LLMService',
              `Retrying structured(text) call to ${providerId} (attempt ${attempt})`
            ),
        }
      );
      const raw = String((textResult as any)?.text || '').trim();
      // Strip accidental ```json fences and isolate the outermost JSON object.
      const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const start = unfenced.indexOf('{');
      const end = unfenced.lastIndexOf('}');
      const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        throw new Error(`Structured(text) parse failed for ${providerId}: non-JSON response`);
      }
      const validated = (zodSchema as z.ZodSchema<unknown>).parse(parsed);
      return {
        object: validated as Record<string, unknown>,
        usage: normalizeTokenUsage((textResult as any)?.usage),
      };
    }

    const result = await withGuards(
      providerId,
      async () =>
        generateObject({
          model,
          schema: zodSchema,
          messages: formattedMessages as any,
          abortSignal: AbortSignal.timeout(structuredTimeoutMs),
        }),
      {
        timeout: structuredTimeoutMs,
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
      usage: normalizeTokenUsage(result.usage),
    };
  }

  async testConnection(modelConfig: ModelConfig): Promise<Record<string, unknown>> {
    const providerId = String(modelConfig.provider || 'openai');

    try {
      const timeoutMsRaw = (modelConfig as any)?.timeoutMs;
      const timeoutMs =
        typeof timeoutMsRaw === 'number' && Number.isFinite(timeoutMsRaw)
          ? Math.min(20000, Math.max(300, timeoutMsRaw))
          : 5000;
      const startedAt = Date.now();

      // Fast-path for OpenAI: avoid SDK retries/backoff in health checks.
      // This gives clearer error messages (e.g. insufficient_quota) and deterministic timeouts.
      if (providerId.toLowerCase() === 'openai') {
        const apiKey =
          (typeof modelConfig.apiKey === 'string' ? modelConfig.apiKey : undefined) ||
          (typeof modelConfig.api_key === 'string' ? modelConfig.api_key : undefined) ||
          process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('No OpenAI API key configured (set OPENAI_API_KEY).');

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${String(apiKey).trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: String(modelConfig.id || 'gpt-4o-mini'),
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          await circuitBreaker.recordSuccess(providerId);
          return {
            success: true,
            latency: Date.now() - startedAt,
            circuitState: (await circuitBreaker.canExecute(providerId)).state,
          };
        }

        const data: any = await res.json().catch(() => null);
        const msg =
          data?.error?.message ||
          data?.message ||
          `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
        await circuitBreaker.recordFailure(providerId, new Error(msg));
        return {
          success: false,
          latency: Date.now() - startedAt,
          error: msg,
          code: data?.error?.code,
          type: data?.error?.type,
          httpStatus: res.status,
          circuitState: (await circuitBreaker.canExecute(providerId)).state,
        };
      }

      // Fast-path for OpenRouter (SDK is fine, but this yields clearer 401/403 errors and bypasses breaker OPEN short-circuit).
      if (providerId.toLowerCase() === 'openrouter') {
        const apiKey =
          (typeof modelConfig.apiKey === 'string' ? modelConfig.apiKey : undefined) ||
          (typeof modelConfig.api_key === 'string' ? modelConfig.api_key : undefined) ||
          process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('No OpenRouter API key configured (set OPENROUTER_API_KEY).');

        const base =
          normalizeBaseUrl(
            typeof modelConfig.endpoint === 'string' ? modelConfig.endpoint : undefined
          ) || 'https://openrouter.ai/api/v1';
        const baseUrl = String(base).replace(/\/+$/, '');

        const normalizeModelId = (id: string): string => {
          const raw = String(id || '').trim();
          if (!raw) return 'openai/gpt-4o-mini';
          if (raw.includes('/') && !raw.includes('://')) return raw;
          const lower = raw.toLowerCase();
          if (lower === 'gpt-4o') return 'openai/gpt-4o';
          if (lower === 'gpt-4o-mini') return 'openai/gpt-4o-mini';
          if (lower === 'o1-preview') return 'openai/o1-preview';
          if (lower === 'o1-mini' || lower === 'o1') return 'openai/o1-mini';
          if (lower.startsWith('claude')) return `anthropic/${raw}`;
          if (lower.startsWith('gemini')) return `google/${raw}`;
          return raw;
        };

        const modelId = normalizeModelId(String(modelConfig.id || ''));
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${String(apiKey).trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          await circuitBreaker.recordSuccess(providerId);
          return {
            success: true,
            latency: Date.now() - startedAt,
            httpStatus: res.status,
            circuitState: (await circuitBreaker.canExecute(providerId)).state,
          };
        }

        const data: any = await res.json().catch(() => null);
        const msg =
          data?.error?.message ||
          data?.message ||
          `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
        await circuitBreaker.recordFailure(providerId, new Error(msg));
        return {
          success: false,
          latency: Date.now() - startedAt,
          error: msg,
          code: data?.error?.code,
          httpStatus: res.status,
          circuitState: (await circuitBreaker.canExecute(providerId)).state,
        };
      }

      const model = getModel(modelConfig);
      const result = await generateText({
        model,
        messages: [{ role: 'user', content: 'Say "pong"' }] as any,
        maxTokens: 5,
        abortSignal: AbortSignal.timeout(timeoutMs),
      } as any);

      await circuitBreaker.recordSuccess(providerId);

      return {
        success: true,
        response: result.text,
        usage: result.usage,
        latency: Date.now() - startedAt,
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
