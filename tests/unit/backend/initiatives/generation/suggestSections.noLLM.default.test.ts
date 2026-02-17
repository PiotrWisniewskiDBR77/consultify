import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.suggestSections', () => {
  it('returns a stable default suggestion list when LLM is unavailable', async () => {
    vi.resetModules();

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => {
      throw new Error('LLM not installed');
    });

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const suggestions = await service.suggestSections({
      initiativeId: '',
      initiativeName: 'X',
      language: 'en',
    });

    expect(suggestions.map((s: any) => s.key)).toEqual(['overview', 'tasks', 'decisions']);
    expect(suggestions[0].priority).toBe('high');
  });
});
