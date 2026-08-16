/**
 * QA-2026-06-10: ai_usage_logs rows were written with prompt_tokens=0 /
 * completion_tokens=0 (and streamed chats often logged no row at all).
 * Root causes covered here:
 *  1. AI SDK v5/v6 report usage as {inputTokens, outputTokens}, but the
 *     logging path read the v4 names {promptTokens, completionTokens}.
 *  2. llmService.callStream returned only {stream} — the SDK's post-stream
 *     usage promise was dropped, so even the estimation fallback never saw
 *     real provider usage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { estimateTokenUsage, normalizeTokenUsage } from '../tokenUsage.js';

describe('normalizeTokenUsage', () => {
  it('accepts AI SDK v4 shape (promptTokens/completionTokens)', () => {
    expect(normalizeTokenUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })).toEqual(
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    );
  });

  it('accepts AI SDK v5/v6 shape (inputTokens/outputTokens)', () => {
    expect(normalizeTokenUsage({ inputTokens: 100, outputTokens: 20, totalTokens: 120 })).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
  });

  it('accepts snake_case provider payloads (prompt_tokens/completion_tokens)', () => {
    expect(normalizeTokenUsage({ prompt_tokens: 7, completion_tokens: 3 })).toEqual({
      promptTokens: 7,
      completionTokens: 3,
      totalTokens: 10,
    });
  });

  it('computes totalTokens when missing', () => {
    expect(normalizeTokenUsage({ inputTokens: 4, outputTokens: 6 })).toEqual({
      promptTokens: 4,
      completionTokens: 6,
      totalTokens: 10,
    });
  });

  it('returns undefined when there is no usable signal', () => {
    expect(normalizeTokenUsage(undefined)).toBeUndefined();
    expect(normalizeTokenUsage(null)).toBeUndefined();
    expect(normalizeTokenUsage({})).toBeUndefined();
    expect(normalizeTokenUsage({ inputTokens: 0, outputTokens: 0 })).toBeUndefined();
    expect(normalizeTokenUsage({ promptTokens: NaN, completionTokens: NaN })).toBeUndefined();
    expect(normalizeTokenUsage('usage')).toBeUndefined();
  });
});

describe('estimateTokenUsage', () => {
  it('estimates ~4 chars/token for input and output', () => {
    expect(estimateTokenUsage(400, 40)).toEqual({
      promptTokens: 100,
      completionTokens: 10,
      totalTokens: 110,
    });
  });

  it('never returns negative counts', () => {
    expect(estimateTokenUsage(-10, -10)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// llmService.callStream must surface the SDK's post-stream usage promise
// ---------------------------------------------------------------------------

const { mockStreamText } = vi.hoisted(() => ({ mockStreamText: vi.fn() }));

vi.mock('ai', () => ({
  streamText: mockStreamText,
  generateText: vi.fn(),
  generateObject: vi.fn(),
  jsonSchema: vi.fn((s: unknown) => s),
  tool: vi.fn((t: unknown) => t),
}));

vi.mock('@ai-sdk/openai', () => {
  const provider: any = vi.fn(() => ({ modelId: 'mock-model' }));
  provider.chat = vi.fn(() => ({ modelId: 'mock-chat-model' }));
  return { createOpenAI: vi.fn(() => provider) };
});

vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn() }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn() }));

vi.mock('../../redis/CacheService.js', () => ({
  appCache: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../circuitBreaker.js', () => ({
  default: {
    canExecute: vi.fn(async () => ({ allowed: true, state: 'CLOSED' })),
    recordSuccess: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
    execute: vi.fn(async (_p: string, fn: () => Promise<unknown>) => fn()),
    getStatus: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../embeddingService.js', () => ({
  embeddingService: { generateEmbedding: vi.fn(), storeChunk: vi.fn() },
}));

vi.mock('../logger.js', () => ({
  aiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../qaAiRuntime.js', () => ({
  buildQaAiStructuredObject: vi.fn(),
  buildQaAiText: vi.fn(),
  buildQaAiUsage: vi.fn(),
  createQaAiStream: vi.fn(),
  getQaAiModeLabel: vi.fn(() => 'off'),
  isQaAiMode: vi.fn(() => false),
}));

describe('llmService.callStream usage capture', () => {
  beforeEach(() => {
    mockStreamText.mockReset();
  });

  const collect = async (stream: AsyncIterable<string>) => {
    let text = '';
    for await (const chunk of stream) text += chunk;
    return text;
  };

  it('returns a usagePromise that resolves to normalized real usage', async () => {
    mockStreamText.mockResolvedValue({
      textStream: (async function* () {
        yield 'Hello';
        yield ' world';
      })(),
      // AI SDK v6: usage resolves AFTER the stream finishes, with v6 field names
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 20, totalTokens: 120 }),
      totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 20, totalTokens: 120 }),
    });

    const { llmService } = await import('../llmService.js');
    const result = await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openrouter', id: 'openai/gpt-4o', apiKey: 'test-key' },
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hi' }],
    } as any);

    expect(await collect(result.stream as AsyncIterable<string>)).toBe('Hello world');
    expect(await result.usagePromise).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
  });

  it('resolves usagePromise to undefined when the provider reports no usage', async () => {
    mockStreamText.mockResolvedValue({
      textStream: (async function* () {
        yield 'chunk';
      })(),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
      totalUsage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    });

    const { llmService } = await import('../llmService.js');
    const result = await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openrouter', id: 'openai/gpt-4o', apiKey: 'test-key' },
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hi' }],
    } as any);

    expect(await collect(result.stream as AsyncIterable<string>)).toBe('chunk');
    expect(await result.usagePromise).toBeUndefined();
  });

  it('never rejects the usagePromise even if the SDK usage promise rejects', async () => {
    mockStreamText.mockResolvedValue({
      textStream: (async function* () {
        yield 'x';
      })(),
      usage: Promise.reject(new Error('usage unavailable')),
      totalUsage: Promise.reject(new Error('usage unavailable')),
    });

    const { llmService } = await import('../llmService.js');
    const result = await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openrouter', id: 'openai/gpt-4o', apiKey: 'test-key' },
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hi' }],
    } as any);

    expect(await collect(result.stream as AsyncIterable<string>)).toBe('x');
    await expect(result.usagePromise).resolves.toBeUndefined();
  });

  it('composes caller cancellation with a bounded provider timeout', async () => {
    mockStreamText.mockResolvedValue({
      textStream: (async function* () {
        yield 'chunk';
      })(),
      usage: Promise.resolve(undefined),
      totalUsage: Promise.resolve(undefined),
    });
    const controller = new AbortController();
    const { llmService } = await import('../llmService.js');
    await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openrouter', id: 'openai/gpt-4o', apiKey: 'test-key' },
      messages: [{ role: 'user', content: 'cancel me' }],
      abortSignal: controller.signal,
      timeoutMs: 250,
    } as any);

    const providerSignal = mockStreamText.mock.calls.at(-1)?.[0]?.abortSignal as AbortSignal;
    expect(providerSignal).toBeInstanceOf(AbortSignal);
    expect(providerSignal.aborted).toBe(false);
    controller.abort();
    expect(providerSignal.aborted).toBe(true);
  });

  it('uses the bounded single retry and then streams provider recovery', async () => {
    mockStreamText
      .mockRejectedValueOnce(new Error('transient provider failure'))
      .mockResolvedValueOnce({
        textStream: (async function* () {
          yield 'recovered';
        })(),
        usage: Promise.resolve(undefined),
        totalUsage: Promise.resolve(undefined),
      });
    const { llmService } = await import('../llmService.js');
    const result = await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openrouter', id: 'openai/gpt-4o', apiKey: 'test-key' },
      messages: [{ role: 'user', content: 'retry once' }],
    } as any);

    expect(await collect(result.stream as AsyncIterable<string>)).toBe('recovered');
    expect(mockStreamText).toHaveBeenCalledTimes(2);
  });
});
