import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.enrichContext', () => {
  it('hydrates missing fields from DB when initiativeId is provided', async () => {
    vi.resetModules();

    const dbGet = vi.fn(async () => ({
      name: 'DB Initiative',
      summary: 'DB summary',
      description: 'DB description',
      problem_statement: 'DB problem',
      category: 'cat',
      module: 'mod',
      status: 'PLANNING',
      current_phase: 'phase',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/utils/DbPromise.js', () => ({
      default: {
        get: (...args: any[]) => dbGet(...args),
      },
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'overview',
          aiPromptTemplate: 'Name={{initiativeName}} Summary={{summary}}',
        })),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => ({
      llmService: {
        call: vi.fn(async (args: any) => ({
          content: String(args?.messages?.[0]?.content || ''),
          usage: { totalTokens: 1 },
          model: 'mock-model',
        })),
      },
    }));

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: { name: 'db' } });

    const result = await service.generateSectionContent('overview', {
      initiativeId: 'init-1',
      initiativeName: '',
      language: 'en',
    } as any);

    expect(dbGet).toHaveBeenCalled();
    expect(result.content).toContain('Name=DB Initiative');
    expect(result.content).toContain('Summary=DB summary');
  });
});
