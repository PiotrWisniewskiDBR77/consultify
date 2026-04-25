import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbAll, mockSearchRelevantChunks, mockGetWorkerBySlug, mockListKnowledgeAssignments } =
  vi.hoisted(() => ({
    mockDbAll: vi.fn(),
    mockSearchRelevantChunks: vi.fn(),
    mockGetWorkerBySlug: vi.fn(),
    mockListKnowledgeAssignments: vi.fn(),
  }));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: mockDbAll,
}));

vi.mock('../../ragService.js', () => ({
  default: {
    searchRelevantChunks: mockSearchRelevantChunks,
  },
}));

vi.mock('../virtualWorkerService.js', () => ({
  getWorkerBySlug: mockGetWorkerBySlug,
  listKnowledgeAssignments: mockListKnowledgeAssignments,
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { buildWorkerKnowledgeContext } from '../virtualWorkerKnowledgeService.js';

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

describe('virtualWorkerKnowledgeService locale-aware retrieval quality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkerBySlug.mockResolvedValue({
      id: 'worker-anna',
      slug: 'anna',
    });
    mockListKnowledgeAssignments.mockResolvedValue([
      {
        id: 'assign-consultify',
        worker_id: 'worker-anna',
        knowledge_source_type: 'product_pill',
        knowledge_doc_id: null,
        product_slug: 'consultify',
        priority_weight: 1,
        assigned_at: '2026-03-26T00:00:00Z',
      },
    ]);
  });

  it('prefers locale-matching and neutral worker docs before other-language docs', async () => {
    mockDbAll.mockResolvedValue([
      buildDoc('pl-doc', 'worker-consultify-pl.md', 'consultify', 'pl'),
      buildDoc('neutral-doc', 'worker-consultify-neutral.md', 'consultify', null),
      buildDoc('en-doc', 'worker-consultify-en.md', 'consultify', 'en'),
    ]);

    const hitsByDocumentId = new Map([
      ['pl-doc', { documentId: 'pl-doc', content: 'Polish worker context', similarity: 0.91 }],
      [
        'neutral-doc',
        { documentId: 'neutral-doc', content: 'Neutral worker context', similarity: 0.84 },
      ],
      ['en-doc', { documentId: 'en-doc', content: 'English worker context', similarity: 0.99 }],
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) => {
        return opts.documentIds
          .map((documentId) => hitsByDocumentId.get(documentId))
          .filter(Boolean);
      }
    );

    const result = await buildWorkerKnowledgeContext({
      workerSlug: 'anna',
      query: 'Czym jest Consultify?',
      locale: 'pl',
      limit: 4,
    });

    expect(result.sources).toContain('worker-consultify-pl.md');
    expect(result.sources).toContain('worker-consultify-neutral.md');
    expect(result.sources).not.toContain('worker-consultify-en.md');
    expect(result.contextText).toContain('Polish worker context');
    expect(result.contextText).toContain('Neutral worker context');
  });

  it('falls back to other-language worker docs only when locale-matching docs do not return hits', async () => {
    mockDbAll.mockResolvedValue([
      buildDoc('en-doc', 'worker-consultify-en.md', 'consultify', 'en'),
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) => {
        if (opts.documentIds.includes('en-doc')) {
          return [
            { documentId: 'en-doc', content: 'English worker fallback context', similarity: 0.89 },
          ];
        }
        return [];
      }
    );

    const result = await buildWorkerKnowledgeContext({
      workerSlug: 'anna',
      query: 'Jak wyglada demo?',
      locale: 'pl',
      limit: 4,
    });

    expect(result.sources).toContain('worker-consultify-en.md');
    expect(result.contextText).toContain('English worker fallback context');
  });

  it('prioritizes explicitly requested products ahead of heavier worker weights', async () => {
    mockListKnowledgeAssignments.mockResolvedValue([
      {
        id: 'assign-vector',
        worker_id: 'worker-anna',
        knowledge_source_type: 'product_pill',
        knowledge_doc_id: null,
        product_slug: 'vector',
        priority_weight: 1,
        assigned_at: '2026-03-26T00:00:00Z',
      },
      {
        id: 'assign-iris',
        worker_id: 'worker-anna',
        knowledge_source_type: 'product_pill',
        knowledge_doc_id: null,
        product_slug: 'iris',
        priority_weight: 3,
        assigned_at: '2026-03-26T00:00:00Z',
      },
      {
        id: 'assign-consultify',
        worker_id: 'worker-anna',
        knowledge_source_type: 'product_pill',
        knowledge_doc_id: null,
        product_slug: 'consultify',
        priority_weight: 2,
        assigned_at: '2026-03-26T00:00:00Z',
      },
    ]);
    mockDbAll.mockResolvedValue([
      buildDoc('vector-doc', 'vector.md', 'vector', 'pl'),
      buildDoc('iris-doc', 'iris.md', 'iris', 'pl'),
      buildDoc('consultify-doc', 'consultify.md', 'consultify', 'pl'),
    ]);

    const hitsByDocumentId = new Map([
      [
        'vector-doc',
        { documentId: 'vector-doc', content: 'Vector worker context', similarity: 0.8 },
      ],
      ['iris-doc', { documentId: 'iris-doc', content: 'IRIS worker context', similarity: 0.95 }],
      [
        'consultify-doc',
        { documentId: 'consultify-doc', content: 'Consultify worker context', similarity: 0.92 },
      ],
    ]);

    mockSearchRelevantChunks.mockImplementation(
      async (_query: string, opts: { documentIds: string[] }) =>
        opts.documentIds.map((documentId) => hitsByDocumentId.get(documentId)).filter(Boolean)
    );

    const result = await buildWorkerKnowledgeContext({
      workerSlug: 'anna',
      query: 'Czym jest Vector i czym rozni sie od IRIS?',
      locale: 'pl',
      limit: 6,
    });

    expect(result.contextText.indexOf('Vector worker context')).toBeLessThan(
      result.contextText.indexOf('IRIS worker context')
    );
    expect(result.fallbackReason).toBeNull();
  });
});
