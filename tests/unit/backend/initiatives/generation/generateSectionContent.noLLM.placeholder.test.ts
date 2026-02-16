import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('returns deterministic placeholder content when LLM module is unavailable', async () => {
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
      initiativeName: 'Alpha',
      language: 'en',
    });

    expect(result.model).toBe('placeholder');
    expect(result.tokensUsed).toBe(0);
    expect(result.content).toContain('Alpha');
  });
});
