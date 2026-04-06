import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbAll, mockSearchRelevantChunks } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockSearchRelevantChunks: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: mockDbAll,
}));

vi.mock('../../ragService.js', () => ({
  default: {
    searchRelevantChunks: mockSearchRelevantChunks,
  },
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { buildAnnaKnowledgeContext, buildAnnaVoiceBootstrap } from '../annaKnowledgeService.js';

type RagResult = {
  documentId: string;
  content: string;
  similarity: number;
};

function buildDoc(id: string, filename: string, productSlug: string, language?: string | null) {
  return {
    id,
    filename,
    metadata: JSON.stringify({
      product_slug: productSlug,
      pill_id: `${id}-pill`,
      ...(language ? { language } : {}),
    }),
  };
}

describe('annaKnowledgeService locale-aware retrieval quality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DB_TYPE;
  });

  it('prefers locale-matching and neutral product pills before other-language docs', async () => {
    mockDbAll.mockResolvedValue([
      buildDoc('pl-doc', 'consultify-pl.md', 'consultify', 'pl'),
      buildDoc('neutral-doc', 'consultify-neutral.md', 'consultify', null),
      buildDoc('en-doc', 'consultify-en.md', 'consultify', 'en'),
    ]);

    const hitsByDocumentId = new Map<string, RagResult>([
      ['pl-doc', { documentId: 'pl-doc', content: 'Polish Consultify context', similarity: 0.92 }],
      [
        'neutral-doc',
        { documentId: 'neutral-doc', content: 'Neutral Consultify context', similarity: 0.83 },
      ],
      ['en-doc', { documentId: 'en-doc', content: 'English Consultify context', similarity: 0.99 }],
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) => {
        return opts.documentIds
          .map((documentId) => hitsByDocumentId.get(documentId))
          .filter(Boolean);
      }
    );

    const result = await buildAnnaKnowledgeContext({
      query: 'Czym jest Consultify?',
      locale: 'pl',
      limit: 4,
    });

    expect(result.sources).toContain('consultify-pl.md');
    expect(result.sources).toContain('consultify-neutral.md');
    expect(result.sources).not.toContain('consultify-en.md');
    expect(result.contextText).toContain('Polish Consultify context');
    expect(result.contextText).toContain('Neutral Consultify context');
  });

  it('falls back to other-language pills only when locale-matching retrieval finds no hits', async () => {
    mockDbAll.mockResolvedValue([buildDoc('en-doc', 'consultify-en.md', 'consultify', 'en')]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) => {
        if (opts.documentIds.includes('en-doc')) {
          return [
            {
              documentId: 'en-doc',
              content: 'English Consultify fallback context',
              similarity: 0.88,
            },
          ];
        }
        return [];
      }
    );

    const result = await buildAnnaKnowledgeContext({
      query: 'Jak wyglada demo?',
      locale: 'pl',
      limit: 4,
    });

    expect(result.sources).toContain('consultify-en.md');
    expect(result.contextText).toContain('English Consultify fallback context');
  });

  it('uses the same locale preference for voice bootstrap retrieval', async () => {
    mockDbAll.mockResolvedValue([
      buildDoc('pl-doc', 'voice-pl.md', 'consultify', 'pl'),
      buildDoc('en-doc', 'voice-en.md', 'consultify', 'en'),
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) => {
        return opts.documentIds.map((documentId) => ({
          documentId,
          content: `context-for-${documentId}`,
          similarity: documentId === 'pl-doc' ? 0.91 : 0.89,
        }));
      }
    );

    const result = await buildAnnaVoiceBootstrap('pl');

    expect(result.sources).toContain('voice-pl.md');
    expect(result.contextText).toContain('context-for-pl-doc');
    expect(result.primaryProducts[0]).toBe('dbr77');
  });
});
