import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/services/api/v8/kb', async () => {
  const actual = await vi.importActual('@/services/api/v8/kb');
  return {
    ...actual,
    V8KnowledgeBaseApi: {
      getPublicPreview: vi.fn(),
      getFeaturedArticles: vi.fn(),
      searchArticles: vi.fn(),
      getArticleBySlug: vi.fn(),
      getContextualArticles: vi.fn(),
    },
  };
});

import {
  useKnowledgeArticle,
  useKnowledgeContextual,
  useKnowledgeFeatured,
  useKnowledgePublicPreview,
  useKnowledgeSearch,
} from '@/hooks/useKnowledge';
import { V8KnowledgeBaseApi } from '@/services/api/v8/kb';

describe('useKnowledge V8 read bridge', () => {
  const mockFetch = vi.fn();

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as typeof fetch;
  });

  it('uses the V8 KB public preview endpoint for landing articles', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          articles: [
            {
              id: 'pub-1',
              slug: 'landing-preview',
              title: 'Landing Preview',
              summary: 'Preview',
              reading_time_minutes: 3,
              is_featured: true,
              category_slug: 'ops',
              category_name: 'Ops',
              category_icon: 'BookOpen',
              view_count: 1,
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() => useKnowledgePublicPreview(3), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/public?lang=en&limit=3&site=consultify');
    expect(result.current.data?.[0].slug).toBe('landing-preview');
    expect(V8KnowledgeBaseApi.getPublicPreview).not.toHaveBeenCalled();
  });

  it('falls back to the legacy featured endpoint when the V8 featured read fails', async () => {
    vi.mocked(V8KnowledgeBaseApi.getFeaturedArticles).mockRejectedValue(new Error('v8 unavailable'));
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          articles: [
            {
              id: 'feat-1',
              slug: 'featured-fallback',
              title: 'Featured Fallback',
              summary: 'Legacy',
              reading_time_minutes: 7,
              is_featured: true,
              category_slug: 'ops',
              category_name: 'Ops',
              category_icon: 'BookOpen',
              view_count: 4,
            },
          ],
        }),
      });

    const { result } = renderHook(() => useKnowledgeFeatured(4), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(V8KnowledgeBaseApi.getFeaturedArticles).toHaveBeenCalledWith('en', 4);
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/public/kb-v8/featured?lang=en&limit=4&site=consultify');
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/kb/featured?lang=en&limit=4');
    expect(result.current.data?.[0].slug).toBe('featured-fallback');
  });

  it('uses the V8 KB search endpoint for search results', async () => {
    vi.mocked(V8KnowledgeBaseApi.searchArticles).mockResolvedValue({
      articles: [
        {
          id: 'art-1',
          slug: 'ai-playbook',
          title: 'AI Playbook',
          summary: 'Summary',
          reading_time_minutes: 5,
          is_featured: false,
          category_slug: 'ops',
          category_name: 'Ops',
          category_icon: 'BookOpen',
          view_count: 2,
        },
      ],
    } as any);

    const { result } = renderHook(() => useKnowledgeSearch('ai'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(V8KnowledgeBaseApi.searchArticles).toHaveBeenCalledWith('ai', 'en', 10);
    expect(result.current.data?.[0].slug).toBe('ai-playbook');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls back to the legacy article endpoint when the V8 article read fails', async () => {
    vi.mocked(V8KnowledgeBaseApi.getArticleBySlug).mockRejectedValue(new Error('v8 unavailable'));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        article: {
          id: 'art-2',
          slug: 'fallback-article',
          title: 'Fallback Article',
          summary: 'Legacy',
          content: 'Hello',
          reading_time_minutes: 4,
          is_featured: false,
          category_slug: 'ops',
          category_name: 'Ops',
          category_icon: 'BookOpen',
          view_count: 1,
          related_modules: [],
          target_audience: [],
          category_id: 'cat-1',
        },
      }),
    });

    const { result } = renderHook(() => useKnowledgeArticle('fallback-article'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(V8KnowledgeBaseApi.getArticleBySlug).toHaveBeenCalledWith('fallback-article', 'en');
    expect(mockFetch).toHaveBeenCalledWith('/api/kb/articles/fallback-article?lang=en');
    expect(result.current.data?.title).toBe('Fallback Article');
  });

  it('uses the V8 KB contextual endpoint for help-panel suggestions', async () => {
    vi.mocked(V8KnowledgeBaseApi.getContextualArticles).mockResolvedValue({
      articles: [
        {
          id: 'art-3',
          slug: 'context-help',
          title: 'Context Help',
          summary: 'Contextual',
          reading_time_minutes: 6,
          is_featured: false,
          category_slug: 'ops',
          category_name: 'Ops',
          category_icon: 'BookOpen',
          view_count: 3,
        },
      ],
    } as any);

    const { result } = renderHook(() => useKnowledgeContextual('my-work'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(V8KnowledgeBaseApi.getContextualArticles).toHaveBeenCalledWith('my-work', 'en');
    expect(result.current.data?.[0].slug).toBe('context-help');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
