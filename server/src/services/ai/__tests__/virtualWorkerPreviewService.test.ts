import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetWorkerWithProfile,
  mockBuildWorkerKnowledgeContext,
  mockBuildWorkerWebAccessResult,
  mockSelectModel,
  mockCallText,
} = vi.hoisted(() => ({
  mockGetWorkerWithProfile: vi.fn(),
  mockBuildWorkerKnowledgeContext: vi.fn(),
  mockBuildWorkerWebAccessResult: vi.fn(),
  mockSelectModel: vi.fn(),
  mockCallText: vi.fn(),
}));

vi.mock('../virtualWorkerService.js', async () => {
  const actual = await vi.importActual('../virtualWorkerService.js');
  return {
    ...actual,
    getWorkerWithProfile: mockGetWorkerWithProfile,
  };
});

vi.mock('../virtualWorkerKnowledgeService.js', () => ({
  buildWorkerKnowledgeContext: mockBuildWorkerKnowledgeContext,
}));

vi.mock('../virtualWorkerWebAccessService.js', () => ({
  buildWorkerWebAccessResult: mockBuildWorkerWebAccessResult,
}));

vi.mock('../modelRouter.js', () => ({
  modelRouter: {
    select: mockSelectModel,
  },
}));

vi.mock('../llmService.js', () => ({
  llmService: {
    callText: mockCallText,
  },
}));

import { previewVirtualWorkerResponse } from '../virtualWorkerPreviewService.js';
import { VirtualWorkerValidationError } from '../virtualWorkerService.js';

describe('virtualWorkerPreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkerWithProfile.mockResolvedValue({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
        name: 'Anna',
        status: 'active',
        surface: 'landing_page',
        locale_default: 'pl',
      },
      profile: {
        id: 'profile-anna',
        version: 3,
        system_prompt: 'Answer like a calm advisor.',
      },
    });
    mockBuildWorkerKnowledgeContext.mockResolvedValue({
      contextText: 'WORKER KNOWLEDGE CONTEXT\nConsultify public positioning.',
      sources: ['pill:consultify#overview'],
      matchedProducts: ['consultify'],
      primaryProducts: ['consultify'],
      usedPillIds: ['pill-1'],
      usedPillSections: ['overview'],
      fallbackReason: null,
    });
    mockBuildWorkerWebAccessResult.mockResolvedValue({
      used: false,
      citations: [],
      systemInstructionAddon: '',
    });
    mockSelectModel.mockResolvedValue({
      id: 'openai/gpt-4o-mini',
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
    });
    mockCallText.mockResolvedValue({
      content: 'Consultify helps structure transformation work and guide the next step.',
    });
  });

  it('builds a preview using active worker profile and governed knowledge', async () => {
    const result = await previewVirtualWorkerResponse({
      workerIdOrSlug: 'anna',
      message: 'What is Consultify?',
      locale: 'en',
      userEnabledWebSearch: false,
    });

    expect(result.answer).toContain('Consultify');
    expect(result.responseMode).toBe('knowledge_pill');
    expect(result.knowledgeSources).toEqual(['pill:consultify#overview']);
    expect(result.model).toEqual({
      id: 'openai/gpt-4o-mini',
      provider: 'openrouter',
    });
    expect(mockCallText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'What is Consultify?' }],
        systemPrompt: expect.stringContaining('## GOVERNED WORKER KNOWLEDGE'),
      })
    );
  });

  it('returns a web-enabled preview mode when governed web access is used', async () => {
    mockBuildWorkerWebAccessResult.mockResolvedValue({
      used: true,
      citations: [
        {
          id: 'worker_web_1',
          title: 'Fresh source',
          link: 'https://example.com/fresh',
          reference: 'https://example.com/fresh',
          excerpt: 'Fresh external context',
          type: 'external',
        },
      ],
      systemInstructionAddon: '## GOVERNED WEB SOURCES\n[1] Fresh source',
    });

    const result = await previewVirtualWorkerResponse({
      workerIdOrSlug: 'anna',
      message: 'What changed recently?',
      locale: 'en',
      userEnabledWebSearch: true,
    });

    expect(result.responseMode).toBe('knowledge_pill_web');
    expect(result.webUsed).toBe(true);
    expect(result.webCitations).toHaveLength(1);
  });

  it('rejects preview when worker has no active profile', async () => {
    mockGetWorkerWithProfile.mockResolvedValue({
      worker: {
        id: 'worker-anna',
        slug: 'anna',
      },
      profile: null,
    });

    await expect(
      previewVirtualWorkerResponse({
        workerIdOrSlug: 'anna',
        message: 'Test',
      })
    ).rejects.toMatchObject({
      code: 'VW_PREVIEW_WORKER_NOT_READY',
    });
  });
});
