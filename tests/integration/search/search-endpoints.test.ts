import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentSearchService } from '../../../server/src/services/content/ContentSearchService.ts';

describe('ContentSearchService - REAL_CODE', () => {
  const db = {
    all: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.all.mockResolvedValue([]);
  });

  it('builds LIKE conditions when query is provided', async () => {
    const svc = new ContentSearchService({ db: db as any });
    await svc.searchContent({ query: 'abc', contentTypes: ['PLAYBOOK_TEMPLATE'] });
    expect(db.all).toHaveBeenCalledWith(
      expect.stringContaining('title LIKE ?'),
      expect.arrayContaining(['%abc%'])
    );
  });

  it('aggregates items and paginates in memory', async () => {
    db.all.mockResolvedValueOnce([{ id: 'p1', title: 'T', description: '', status: 'published' }]);
    db.all.mockResolvedValueOnce([{ id: 'e1', name: 'N', subject: 'S' }]);

    const svc = new ContentSearchService({ db: db as any });
    const res = await svc.searchContent({ page: 1, limit: 1 });
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(1);
    expect(res.hasMore).toBe(true);
  });
});
