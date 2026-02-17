import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('stringifies object context values as JSON', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async (args: any) => ({
      content: String(args?.messages?.[0]?.content || ''),
      usage: { totalTokens: 10 },
      model: 'mock-model',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'overview',
          aiPromptTemplate: 'Obj: {{payload}}',
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
      payload: { a: 1, b: 'x' },
    } as any);

    expect(result.content).toContain('{"a":1,"b":"x"}');
  });
});
