import { afterEach, describe, expect, it, vi } from 'vitest';

const { callStreamMock, getProviderConfigMock } = vi.hoisted(() => ({
  callStreamMock: vi.fn(),
  getProviderConfigMock: vi.fn(),
}));

vi.mock('../llmService.js', () => ({
  llmService: { callStream: callStreamMock },
}));

vi.mock('../modelRouter.js', () => ({
  default: {
    getFallbackChain: vi.fn(() => []),
    getProviderConfig: getProviderConfigMock,
  },
}));

vi.mock('../mcpServer.js', () => ({
  mcpServer: {
    getToolDefinitions: vi.fn(() => [
      { name: 'generate_deliverable', description: 'Create a document', parameters: {} },
      { name: 'generate_initiative', description: 'Create an initiative', parameters: {} },
    ]),
  },
}));

vi.mock('../tools/index.js', () => ({}));

import { AIPipeline } from '../AIPipeline.js';

describe('CHAT-IMG P2 v2 — AIPipeline multimodal intent call-site', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    callStreamMock.mockReset();
    getProviderConfigMock.mockReset();
  });

  it('routes an image-bearing initiative request by its text, never by [object Object]', async () => {
    const pipeline = AIPipeline.getInstance() as any;
    vi.spyOn(pipeline, 'checkQuota').mockResolvedValue(undefined);
    vi.spyOn(pipeline, 'buildContext').mockResolvedValue({ ragResults: [], memoryUsed: false });
    vi.spyOn(pipeline, 'buildPrompt').mockResolvedValue([
      { role: 'system', content: 'You are Teresa.' },
      { role: 'user', content: 'Create an initiative for reducing scrap.' },
    ]);
    vi.spyOn(pipeline, 'selectModel').mockResolvedValue({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      maxTokens: 1000,
    });
    vi.spyOn(pipeline, 'logError').mockResolvedValue(undefined);

    getProviderConfigMock.mockResolvedValue({
      provider: 'openrouter',
      id: 'openai/gpt-4o-mini',
      apiKey: 'db-key',
      endpoint: 'https://openrouter.ai/api/v1',
    });
    callStreamMock.mockResolvedValue({
      stream: (async function* () {
        yield 'Created.';
      })(),
    });

    const response = await pipeline.process({
      capability: 'chatStream',
      prompt: 'Create an initiative for reducing scrap.',
      userId: 'member-1',
      stream: true,
      context: {
        chatImages: [
          {
            base64: Buffer.from('pixels').toString('base64'),
            mimeType: 'image/png',
            originalSize: 6,
            processedSize: 6,
            width: 2,
            height: 3,
          },
        ],
      },
      options: { deliverableTools: { enabled: true, context: {} } },
    });

    expect(response.success).toBe(true);
    expect(callStreamMock).toHaveBeenCalledTimes(1);
    const providerRequest = callStreamMock.mock.calls[0][0];
    expect(providerRequest.messages[0].content).toEqual([
      { type: 'text', text: 'Create an initiative for reducing scrap.' },
      expect.objectContaining({ type: 'image', mediaType: 'image/png' }),
    ]);
    expect(providerRequest.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'generate_initiative',
    ]);
  });
});
