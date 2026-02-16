import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.suggestSections', () => {
  it('parses JSON from a markdown code fence response', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async () => ({
      content: '```json\n[{"key":"overview","reason":"r","priority":"high"}]\n```',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getAllSectionTypes: vi.fn(async () => [
          { key: 'overview', name: 'Overview', description: '' },
          { key: 'tasks', name: 'Tasks', description: '' },
        ]),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => ({
      llmService: { call: llmCall },
    }));

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const suggestions = await service.suggestSections({
      initiativeId: '',
      initiativeName: 'X',
      language: 'en',
    });

    expect(llmCall).toHaveBeenCalled();
    expect(suggestions).toEqual([{ key: 'overview', reason: 'r', priority: 'high' }]);
  });
});
