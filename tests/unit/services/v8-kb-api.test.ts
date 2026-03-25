import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import {
  V8KnowledgeBaseApi,
  V8_KB_ARTICLE_PATH,
  V8_KB_CONTEXT_PATH,
  V8_KB_SEARCH_PATH,
} from '@/services/api/v8/kb';
import { v8Get } from '@/services/api/v8/client';

describe('V8KnowledgeBaseApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests KB search results from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ articles: [] });

    await V8KnowledgeBaseApi.searchArticles('ai', 'en', 12);

    expect(v8Get).toHaveBeenCalledWith(V8_KB_SEARCH_PATH, {
      q: 'ai',
      lang: 'en',
      limit: '12',
    });
  });

  it('requests KB article detail by slug from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ article: { slug: 'foo' } });

    const data = await V8KnowledgeBaseApi.getArticleBySlug('foo', 'pl');

    expect(v8Get).toHaveBeenCalledWith(`${V8_KB_ARTICLE_PATH}/foo`, { lang: 'pl' });
    expect(data.article.slug).toBe('foo');
  });

  it('requests KB contextual articles from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ articles: [] });

    await V8KnowledgeBaseApi.getContextualArticles('my-work', 'en', 7);

    expect(v8Get).toHaveBeenCalledWith(`${V8_KB_CONTEXT_PATH}/my-work`, {
      lang: 'en',
      limit: '7',
    });
  });
});
