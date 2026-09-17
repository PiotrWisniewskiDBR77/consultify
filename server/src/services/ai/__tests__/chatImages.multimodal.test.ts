import { beforeEach, describe, expect, it, vi } from 'vitest';

const { streamTextMock } = vi.hoisted(() => ({ streamTextMock: vi.fn() }));

vi.mock('ai', () => ({
  streamText: streamTextMock,
  generateText: vi.fn(),
  generateObject: vi.fn(),
  jsonSchema: vi.fn((schema: unknown) => schema),
  stepCountIs: vi.fn((count: number) => ({ count })),
  tool: vi.fn((definition: unknown) => definition),
}));

vi.mock('@ai-sdk/openai', () => {
  const provider: any = vi.fn((modelId: string) => ({ modelId }));
  provider.chat = vi.fn((modelId: string) => ({ modelId }));
  return { createOpenAI: vi.fn(() => provider) };
});
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn(() => vi.fn()) }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn(() => vi.fn()) }));
vi.mock('../../redis/CacheService.js', () => ({
  appCache: { get: vi.fn(), set: vi.fn(), delPattern: vi.fn() },
}));
vi.mock('../circuitBreaker.js', () => ({
  default: {
    canExecute: vi.fn(async () => ({ allowed: true, state: 'CLOSED' })),
    recordSuccess: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
    execute: vi.fn(async (_provider: string, run: () => Promise<unknown>) => run()),
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
vi.mock('../llmConfigService.js', () => ({
  llmConfigService: {
    getFallbackChain: vi.fn(async () => []),
    getProviderConfig: vi.fn(async () => null),
  },
}));

import {
  assertVisionCapableModel,
  attachChatImagesToLastUserMessage,
  extractTextFromProviderContent,
} from '../AIPipeline.js';
import { classifyChatCreationIntent } from '../chatCreationIntent.js';
import { inferChatTaskPurpose } from '../aiTaskCatalog.js';
import { llmService } from '../llmService.js';
import { modelMeetsRequirements } from '../modelCapabilities.js';
import { MODEL_PROVIDER_MAP, ModelRouter, TIER_DEFAULTS } from '../modelRouter.js';

describe('CHAT-IMG-1 multimodal provider contract', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    streamTextMock.mockResolvedValue({
      textStream: (async function* () {
        yield 'I can see the chart.';
      })(),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
      totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
    });
  });

  it('delivers the real image data URL to the AI SDK payload', async () => {
    const base64 = Buffer.from('real-pixel-payload').toString('base64');
    const messages = attachChatImagesToLastUserMessage(
      [{ role: 'user', content: 'Describe this screenshot.' }],
      [
        {
          base64,
          mimeType: 'image/png',
          originalSize: 18,
          processedSize: 18,
          width: 20,
          height: 10,
        },
      ]
    );

    await llmService.callStream({
      type: 'chat',
      modelConfig: { provider: 'openai', id: 'gpt-4o-mini', apiKey: 'test-key' },
      systemPrompt: 'You are Teresa.',
      messages,
      stream: true,
    });

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(streamTextMock.mock.calls[0][0].messages).toEqual([
      { role: 'system', content: 'You are Teresa.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this screenshot.' },
          {
            type: 'image',
            image: `data:image/png;base64,${base64}`,
            mediaType: 'image/png',
          },
        ],
      },
    ]);
  });

  it('keeps creation-intent routing on the user text after an image is attached', () => {
    const messages = attachChatImagesToLastUserMessage(
      [{ role: 'user', content: 'Create an initiative for the service redesign.' }],
      [
        {
          base64: Buffer.from('routing-pixel').toString('base64'),
          mimeType: 'image/png',
          originalSize: 13,
          processedSize: 13,
          width: 1,
          height: 1,
        },
      ]
    );

    const text = extractTextFromProviderContent(messages[0].content);
    expect(text).toBe('Create an initiative for the service redesign.');
    expect(text).not.toContain('[object Object]');
    expect(classifyChatCreationIntent(text)).toBe('initiative');
  });

  it('keeps the actual BUDGET default vision-capable after vendor/model normalization', () => {
    expect(
      inferChatTaskPurpose({
        capability: 'chat',
        message: 'What is visible here?',
        attachments: [{ mimeType: 'image/png', name: 'screen.png' }],
      })
    ).toBe('chat_with_image');
    expect(TIER_DEFAULTS.BUDGET).toBe('openai/gpt-4o-mini');
    expect(MODEL_PROVIDER_MAP['gpt-4o-mini']).toBe('openrouter');
    // Global capability semantics stay unchanged for OFF-parity; CHAT-IMG's
    // guard alone normalizes OpenRouter vendor/model ids.
    expect(modelMeetsRequirements(TIER_DEFAULTS.BUDGET, { vision: true })).toBe(false);
    expect(modelMeetsRequirements(TIER_DEFAULTS.BUDGET, { structured_outputs: true })).toBe(false);
    expect(modelMeetsRequirements('gpt-4o-mini', { vision: true })).toBe(true);
    expect(() => assertVisionCapableModel(TIER_DEFAULTS.BUDGET)).not.toThrow();
    expect(() => assertVisionCapableModel('anthropic/claude-sonnet-4-6')).not.toThrow();
  });

  it('rejects an explicit selected text-only model instead of dropping the image', () => {
    try {
      assertVisionCapableModel('openai/o1-mini');
      throw new Error('expected assertVisionCapableModel to throw');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'CHAT_IMAGE_MODEL_UNSUPPORTED:openai/o1-mini',
        code: 'CHAT_IMAGE_MODEL_UNSUPPORTED',
        status: 422,
        retryable: false,
      });
    }
  });

  it('keeps a namespaced vision model in the runtime static fallback chain', async () => {
    const router = new ModelRouter();
    vi.spyOn(router, 'getModelsForTier').mockResolvedValue([]);
    vi.spyOn(router, 'getModelsForPurpose').mockResolvedValue([]);
    vi.spyOn(router, 'getProviderConfig').mockImplementation(async (modelId, tier) => ({
      id: modelId,
      tier,
      provider: 'openrouter',
      apiKey: 'test-key',
      endpoint: 'https://example.invalid/v1',
      source: 'static_fallback',
    }));

    const candidates = await router.getRuntimeFallbackCandidates({
      capability: 'chat_with_image',
      tier: 'BUDGET',
      requirements: { vision: true },
    });

    expect(candidates.map((candidate) => candidate.id)).toContain('openai/gpt-4o-mini');
  });
});
