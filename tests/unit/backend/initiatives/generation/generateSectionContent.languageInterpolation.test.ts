import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('interpolates {{language}} as Polish/English labels', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async () => ({
      content: 'Language: Polish',
      usage: { totalTokens: 12 },
      model: 'mock-model',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'overview',
          aiPromptTemplate: 'Language: {{language}}',
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
      language: 'pl',
    });

    expect(llmCall).toHaveBeenCalled();
    expect(result.content).toBe('Language: Polish');
    expect(result.model).toBe('mock-model');
    expect(result.tokensUsed).toBe(12);
  });
});
