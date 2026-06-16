import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('replaces missing context keys with [not provided]', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async (args: any) => ({
      content: String(args?.messages?.[0]?.content || ''),
      usage: { totalTokens: 5 },
      model: 'mock-model',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'overview',
          aiPromptTemplate: 'Missing: {{doesNotExist}}',
        })),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => ({
      llmService: { call: llmCall },
    }));

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const result = await service.generateSectionContent('overview', {
      initiativeId: '',
      initiativeName: 'X',
      language: 'en',
    });

    // Template interpolation replaces unknown keys with [not provided]. The service
    // additionally appends CARD_CONTENT_FORMULA guidance to the prompt (L-04 / #16),
    // so assert the interpolated fragment is present rather than exact-equality.
    expect(result.content).toContain('Missing: [not provided]');
    expect(result.content).toContain('KANON JAKOŚCI');
  });
});
