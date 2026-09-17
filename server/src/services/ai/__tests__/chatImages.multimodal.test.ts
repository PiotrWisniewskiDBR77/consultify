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
  llmConfigService: { getFallbackChain: vi.fn(async () => []) },
}));

import {
  assertVisionCapableModel,
  attachChatImagesToLastUserMessage,
  readProviderChatMessageText,
} from '../AIPipeline.js';
import { inferChatTaskPurpose } from '../aiTaskCatalog.js';
import { llmService } from '../llmService.js';
import { modelMeetsRequirements } from '../modelCapabilities.js';
import { ModelRouter, MODEL_PROVIDER_MAP, TIER_DEFAULTS } from '../modelRouter.js';

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
      throw new Error('expected assertion to reject a text-only model');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'CHAT_IMAGE_MODEL_UNSUPPORTED:openai/o1-mini',
        code: 'CHAT_IMAGE_MODEL_UNSUPPORTED',
        retryable: false,
      });
    }
  });

  it('reads intent text from a multimodal turn without stringifying image objects', () => {
    const content = [
      { type: 'text', text: 'Create a task from this screenshot.' },
      { type: 'image', image: 'data:image/png;base64,cGl4ZWxz', mediaType: 'image/png' },
    ];

    expect(readProviderChatMessageText(content)).toBe('Create a task from this screenshot.');
    expect(readProviderChatMessageText(content)).not.toContain('[object Object]');
    expect(readProviderChatMessageText(content)).not.toContain('cGl4ZWxz');
  });

  it('keeps the namespaced BUDGET vision model in the real runtime fallback list', async () => {
    const router = new ModelRouter();
    Object.defineProperties(router, {
      getModelsForTier: { value: vi.fn(async () => []) },
      getProviderConfig: {
        value: vi.fn(async (modelId: string) => ({
          id: modelId,
          provider: 'openrouter',
          apiKey: 'test-key',
          endpoint: null,
          tier: 'BUDGET',
        })),
      },
    });

    const candidates = await router.getRuntimeFallbackCandidates({
      capability: 'chat_with_image',
      purpose: 'chat_with_image',
      requirements: { vision: true },
      tier: 'BUDGET',
      options: { tier: 'BUDGET' },
    });

    expect(candidates.map((candidate: { id: string }) => candidate.id)).toContain(
      'openai/gpt-4o-mini'
    );
  });
});
