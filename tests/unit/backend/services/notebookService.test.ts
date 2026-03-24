import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};
const mockGenerateEmbedding = vi.fn();

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn(),
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryFirst: vi.fn(),
}));

vi.mock('../../../../server/src/services/ai/embeddingService.js', () => ({
  embeddingService: {
    generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'proposal-uuid',
}));

describe('NotebookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockResolvedValue(undefined);
    mockDb.all.mockResolvedValue([]);
    mockGenerateEmbedding.mockResolvedValue([1, 0]);
  });

  it('applies accepted AI proposals to notebook page content', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        id: 'proposal-1',
        page_id: 'page-1',
        proposal_type: 'append',
        block_content: JSON.stringify({
          type: 'paragraph',
          content: [{ type: 'text', text: 'New AI block' }],
        }),
      })
      .mockResolvedValueOnce({
        id: 'page-1',
        content_json: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing block' }] }],
        }),
        content_text: 'Existing block',
      })
      .mockResolvedValueOnce({
        id: 'proposal-1',
        page_id: 'page-1',
        actor_id: 'actor-1',
        proposal_type: 'append',
        block_content: JSON.stringify({
          type: 'paragraph',
          content: [{ type: 'text', text: 'New AI block' }],
        }),
        rationale: 'because',
        status: 'accepted',
        created_at: '2026-03-07T00:00:00.000Z',
        resolved_at: '2026-03-07T00:01:00.000Z',
        resolved_by: 'user-1',
      });

    const { NotebookService } = await import('../../../../server/src/services/notebookService.js');
    const service = new NotebookService();
    const proposal = await service.resolveAIProposal('org-1', 'proposal-1', 'user-1', 'accepted');

    expect(proposal?.status).toBe('accepted');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notebook_pages'),
      [
        expect.stringContaining('"New AI block"'),
        'Existing block\n\nNew AI block',
        expect.any(String),
        'page-1',
        'org-1',
      ],
    );
  });

  it('does not mutate notebook pages when proposal is rejected', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        id: 'proposal-1',
        page_id: 'page-1',
        proposal_type: 'append',
        block_content: '{"text":"ignored"}',
      })
      .mockResolvedValueOnce({
        id: 'proposal-1',
        page_id: 'page-1',
        actor_id: 'actor-1',
        proposal_type: 'append',
        block_content: '{"text":"ignored"}',
        rationale: 'because',
        status: 'rejected',
        created_at: '2026-03-07T00:00:00.000Z',
        resolved_at: '2026-03-07T00:01:00.000Z',
        resolved_by: 'user-1',
      });

    const { NotebookService } = await import('../../../../server/src/services/notebookService.js');
    const service = new NotebookService();
    await service.resolveAIProposal('org-1', 'proposal-1', 'user-1', 'rejected');

    expect(
      mockDb.run.mock.calls.some(([sql]) => String(sql).includes('UPDATE notebook_pages'))
    ).toBe(false);
  });

  it('semanticSearch ranks notebook chunks using stored embeddings when available', async () => {
    mockDb.get.mockResolvedValue({ ok: 1 });
    mockDb.all.mockResolvedValue([
      {
        page_id: 'page-1',
        title: 'Closer match',
        snippet: 'alpha beta',
        embedding_vector: JSON.stringify([1, 0]),
      },
      {
        page_id: 'page-2',
        title: 'Weaker match',
        snippet: 'gamma delta',
        embedding_vector: JSON.stringify([0, 1]),
      },
    ]);

    const { NotebookService } = await import('../../../../server/src/services/notebookService.js');
    const service = new NotebookService();
    const results = await service.semanticSearch('org-1', 'user-1', 'alpha topic', { limit: 5 });

    expect(results[0]?.pageId).toBe('page-1');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });
});
