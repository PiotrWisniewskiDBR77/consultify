import { describe, expect, it, vi } from 'vitest';

describe('InitiativeGenerationService.generateSectionContent', () => {
  it('parses JSON from fenced code blocks when template requests JSON', async () => {
    vi.resetModules();

    const llmCall = vi.fn(async () => ({
      content: '```json\n{"ok":true,"n":2}\n```',
      usage: { completionTokens: 20 },
      modelId: 'mock-model',
    }));

    vi.doMock('../../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));
    vi.doMock('../../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: vi.fn(async () => ({
          key: 'problem_definition',
          aiPromptTemplate: 'Return valid JSON with { "ok": true }.',
        })),
      },
    }));
    vi.doMock('../../../../../server/src/services/ai/llmService.js', () => ({
      llmService: { call: llmCall },
    }));

    const mod = await import('../../../../../server/src/services/initiativeGenerationService.ts');
    const service = new mod.InitiativeGenerationService();
    service.setDependencies({ db: {} });

    const result = await service.generateSectionContent('problem_definition', {
      initiativeId: '',
      initiativeName: 'X',
      language: 'en',
    });

    expect(result.isJson).toBe(true);
    expect(result.parsedContent).toEqual({ ok: true, n: 2 });
    expect(result.tokensUsed).toBe(20);
    expect(result.model).toBe('mock-model');
  });
});
