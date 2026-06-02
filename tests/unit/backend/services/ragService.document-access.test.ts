import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAllMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../../../server/src/services/ai/embeddingService.js', () => ({
  embeddingService: {},
}));

describe('RagService document access filtering', () => {
  beforeEach(() => {
    vi.resetModules();
    dbAllMock.mockReset();
    dbRunMock.mockReset();
    dbAllMock.mockImplementation((sql: string) => {
      if (sql.includes('PRAGMA table_info(knowledge_docs)')) {
        return Promise.resolve([
          { name: 'id' },
          { name: 'filename' },
          { name: 'status' },
          { name: 'organization_id' },
          { name: 'deleted_at' },
        ]);
      }
      if (sql.includes('PRAGMA table_info(knowledge_chunks)')) {
        return Promise.resolve([{ name: 'doc_id' }, { name: 'document_id' }]);
      }
      return Promise.resolve([
        {
          id: 'chunk-1',
          content: 'secret organization context about operations',
          filename: 'secret.md',
          doc_id: 'doc-cross-tenant',
        },
      ]);
    });
  });

  it('fails closed for explicit documentIds without organization scope', async () => {
    const ragService = (await import('../../../../server/src/services/ragService.js')).default;

    const results = await ragService.bm25Search('secret', 5, null, ['doc-cross-tenant']);

    expect(results).toEqual([]);
    expect(dbAllMock).toHaveBeenCalledTimes(2);
    expect(String(dbAllMock.mock.calls[0][0])).toContain('PRAGMA table_info');
  });

  it('adds organization, deletion, and ready/indexed status filters for explicit documentIds', async () => {
    const ragService = (await import('../../../../server/src/services/ragService.js')).default;

    await ragService.bm25Search('secret organization', 5, 'org-allowed', ['doc-allowed']);

    const searchCall = dbAllMock.mock.calls.find((call) =>
      String(call[0]).includes('FROM knowledge_chunks')
    );
    expect(searchCall).toBeTruthy();
    expect(String(searchCall?.[0])).toContain(
      'JOIN knowledge_docs d ON (c.doc_id = d.id OR c.document_id = d.id)'
    );
    expect(String(searchCall?.[0])).toContain('d.id IN (?) AND d.organization_id = ?');
    expect(String(searchCall?.[0])).toContain('d.deleted_at IS NULL');
    expect(String(searchCall?.[0])).toContain("d.status IS NULL OR d.status IN ('ready', 'indexed')");
    expect(searchCall?.[1]).toEqual(['doc-allowed', 'org-allowed']);
  });
});
