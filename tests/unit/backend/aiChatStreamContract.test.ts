import { describe, expect, it, vi } from 'vitest';

// -------------------------
// Validator contract tests
// -------------------------
import { ChatStreamRequestSchema } from '../../../server/src/validators/ai.validators.js';

describe('AI chat stream contract', () => {
  it('accepts ToolsMenu + routing fields on /ai/chat/stream', () => {
    const payload = {
      message: 'hello',
      projectId: '00000000-0000-0000-0000-000000000000',
      focusMode: 'all',
      screenContext: { currentScreen: 'dashboard' },
      selectedTier: 'BUDGET',
      selectedModelId: null,
      aiModes: { deepResearch: true, webSearch: false, showReasoning: true },
      knowledgeSources: { pmoDocuments: true, projectData: true, organizationData: false },
      responseStyle: 'concise',
    };

    const result = ChatStreamRequestSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.aiModes?.deepResearch).toBe(true);
    expect(result.data.knowledgeSources?.pmoDocuments).toBe(true);
    expect(result.data.responseStyle).toBe('concise');
    expect(result.data.selectedTier).toBe('BUDGET');
    expect(result.data.projectId).toBe(payload.projectId);
    expect(result.data.focusMode).toBe('all');
  });
});

// -------------------------
// Pipeline routing tests
// -------------------------
vi.mock('../../../server/src/services/ai/modelRouter.js', () => {
  return {
    default: {
      select: vi.fn(async () => ({
        id: 'gpt-4o-mini',
        tier: 'BUDGET',
        provider: 'openai',
        apiKey: 'test-key',
        endpoint: null,
      })),
      getProviderConfig: vi.fn(async (modelId: string) => ({
        id: modelId,
        tier: 'STANDARD',
        provider: 'openai',
        apiKey: 'test-key',
        endpoint: null,
      })),
    },
  };
});

vi.mock('../../../server/src/services/ai/llmService.js', () => {
  return {
    llmService: {
      call: vi.fn(async () => ({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      })),
      callStream: vi.fn(async () => ({
        stream: (async function* () {
          yield 'hi';
        })(),
      })),
    },
  };
});

// Avoid hitting DB-heavy context builder in unit tests (AIPipeline dynamically imports it).
vi.mock('../../../server/src/services/aiContextBuilder.js', () => {
  return {
    AIContextBuilder: {
      buildContext: vi.fn(async () => ({})),
    },
    default: {
      buildContext: vi.fn(async () => ({})),
    },
  };
});

// Avoid DB access inside adaptive response service during unit tests.
vi.mock('../../../server/src/services/ai/adaptiveResponseService.js', () => {
  return {
    adaptiveResponseService: {
      buildAdaptiveSystemPrompt: vi.fn(
        async (_userId: string, systemPrompt: string) => systemPrompt
      ),
    },
    default: {
      buildAdaptiveSystemPrompt: vi.fn(
        async (_userId: string, systemPrompt: string) => systemPrompt
      ),
    },
  };
});

import { AIPipeline } from '../../../server/src/services/ai/AIPipeline.js';
import modelRouter from '../../../server/src/services/ai/modelRouter.js';
import { llmService } from '../../../server/src/services/ai/llmService.js';

describe('AIPipeline routing', () => {
  it('routes streaming chat via modelRouter using selectedTier', async () => {
    const pipeline = AIPipeline.getInstance();

    const res = await pipeline.process({
      capability: 'chatStream',
      prompt: 'hello',
      userId: 'user-1',
      organizationId: 'org-1',
      // stream is a legacy flag used by the route to request streaming
      stream: true,
      options: {
        selectedTier: 'BUDGET',
        aiModes: { showReasoning: true },
        responseStyle: 'concise',
      },
    } as any);

    expect((modelRouter as any).select).toHaveBeenCalledTimes(1);
    const callArgs = ((modelRouter as any).select as any).mock.calls[0]?.[0];
    expect(callArgs.options?.tier).toBe('BUDGET');
    expect(callArgs.tier).toBe('BUDGET');
    expect(callArgs.capability).toBe('chat'); // chatStream -> chat mapping

    expect((llmService as any).callStream).toHaveBeenCalledTimes(1);
    const llmArgs = ((llmService as any).callStream as any).mock.calls[0]?.[0];
    expect(llmArgs.modelConfig.provider).toBe('openai');
    expect(llmArgs.modelConfig.id).toBe('gpt-4o-mini');

    // streamed response path
    expect(res.success).toBe(true);
    expect((res as any).stream).toBeTruthy();
  });
});
