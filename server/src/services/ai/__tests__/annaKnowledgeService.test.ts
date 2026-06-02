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

  it('includes locale-matching and neutral Consultify pills (full portfolio mode may add more sources)', async () => {
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
    expect(result.primaryProducts).toContain('dbr77');
    expect(result.primaryProducts[0]).toBe('consultify');
  });

  it('prioritizes explicitly requested products ahead of the default portfolio order', async () => {
    mockDbAll.mockResolvedValue([
      buildDoc('vector-doc', 'vector.md', 'vector', 'pl'),
      buildDoc('iris-doc', 'iris.md', 'iris', 'pl'),
      buildDoc('consultify-doc', 'consultify.md', 'consultify', 'pl'),
    ]);

    const hitsByDocumentId = new Map<string, RagResult>([
      [
        'vector-doc',
        { documentId: 'vector-doc', content: 'Vector Anna context', similarity: 0.81 },
      ],
      ['iris-doc', { documentId: 'iris-doc', content: 'IRIS Anna context', similarity: 0.97 }],
      [
        'consultify-doc',
        { documentId: 'consultify-doc', content: 'Consultify Anna context', similarity: 0.93 },
      ],
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) =>
        opts.documentIds.map((documentId) => hitsByDocumentId.get(documentId)).filter(Boolean)
    );

    const result = await buildAnnaKnowledgeContext({
      query: 'Czym jest Vector i czym rozni sie od IRIS?',
      locale: 'pl',
      siteKey: 'consultify',
      limit: 6,
    });

    expect(result.primaryProducts[0]).toBe('vector');
    expect(result.primaryProducts[1]).toBe('iris');
    expect(result.contextText.indexOf('Vector Anna context')).toBeLessThan(
      result.contextText.indexOf('IRIS Anna context')
    );
  });
});
