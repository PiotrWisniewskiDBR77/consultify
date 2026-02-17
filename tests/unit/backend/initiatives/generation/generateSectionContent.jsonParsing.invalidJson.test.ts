import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('keeps content when JSON parsing fails', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async () => ({
      content: '```json\n{not:json}\n```',
      usage: { totalTokens: 7 },
      model: 'mock-model',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'target_state',
          aiPromptTemplate: 'Return valid JSON with { "x": 1 }.',
        })),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => ({
      llmService: { call: llmCall },
    }));

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const result = await service.generateSectionContent('target_state', {
      initiativeId: '',
      initiativeName: 'X',
      language: 'en',
    });

    expect(result.isJson).toBe(true);
    expect(result.parsedContent).toBeUndefined();
    expect(result.content).toContain('{not:json}');
  });
});
