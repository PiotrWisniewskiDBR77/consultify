import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService placeholder', () => {
  it('returns Polish placeholder for overview', async () => {
    vi.resetModules();

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'overview',
          aiPromptTemplate: 'Anything',
        })),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => {
      throw new Error('LLM not installed');
    });

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const result = await service.generateSectionContent('overview', {
      initiativeId: '',
      initiativeName: 'Beta',
      language: 'pl',
    });

    expect(result.model).toBe('placeholder');
    expect(result.content).toContain('Beta');
    expect(result.content).toMatch(/Uzupełnij|spróbuj ponownie|analizy/i);
  });
});
