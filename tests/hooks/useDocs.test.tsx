import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/kb', async () => {
  const actual = await vi.importActual('@/services/api/v8/kb');
  return {
    ...actual,
    V8KnowledgeBaseApi: {
      getArticles: vi.fn(),
      searchArticles: vi.fn(),
      getArticleBySlug: vi.fn(),
      getFeaturedArticles: vi.fn(),
    },
  };
});

import { useDocsArticle, useDocsArticles, useDocsCategories, useDocsFeatured, useDocsSearch, useDocsTrackView } from '@/hooks/useDocs';
import { V8KnowledgeBaseApi } from '@/services/api/v8/kb';

describe('useDocs V8 featured bridge', () => {
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

  it('uses the public KB V8 categories bridge for docs homepage categories', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          categories: [
            {
              id: 'cat-1',
              slug: 'guides',
              name: 'Guides',
              icon: 'BookOpen',
              article_count: 3,
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() => useDocsCategories('en'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/categories?lang=en');
    expect(result.current.data?.[0].slug).toBe('guides');
  });

  it('uses the V8 KB featured endpoint for public docs home articles', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          articles: [
            {
              id: 'feat-1',
              slug: 'featured-v8',
              title: 'Featured via V8',
              summary: 'Summary',
              reading_time_minutes: 5,
              is_featured: true,
              category_slug: 'guides',
              category_name: 'Guides',
              category_icon: 'BookOpen',
              view_count: 8,
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() => useDocsFeatured('en', 6), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/featured?lang=en&limit=6');
    expect(result.current.data?.[0].slug).toBe('featured-v8');
    expect(V8KnowledgeBaseApi.getFeaturedArticles).not.toHaveBeenCalled();
  });

  it('uses the public KB V8 bridge for docs category article listings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          articles: [
            {
              id: 'art-1',
              slug: 'intro',
              title: 'Intro',
              summary: 'Summary',
              reading_time_minutes: 4,
              is_featured: false,
              category_slug: 'guides',
              category_name: 'Guides',
              category_icon: 'BookOpen',
              view_count: 11,
            },
          ],
          total: 1,
        },
      }),
    });

    const { result } = renderHook(
      () => useDocsArticles({ language: 'en', categorySlug: 'guides', limit: 12, offset: 4 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/public/kb-v8/articles?lang=en&category=guides&limit=12&offset=4'
    );
    expect(result.current.data?.articles[0].slug).toBe('intro');
    expect(V8KnowledgeBaseApi.getArticles).not.toHaveBeenCalled();
  });

  it('uses the public KB V8 bridge for docs article detail', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          article: {
            id: 'art-2',
            slug: 'deep-dive',
            title: 'Deep Dive',
            summary: 'Summary',
            content: '# Title',
            reading_time_minutes: 7,
            is_featured: false,
            category_slug: 'guides',
            category_name: 'Guides',
            category_icon: 'BookOpen',
            view_count: 5,
            related_modules: [],
            target_audience: [],
          },
        },
      }),
    });

    const { result } = renderHook(() => useDocsArticle('deep-dive', 'en'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/articles/deep-dive?lang=en');
    expect(result.current.data?.slug).toBe('deep-dive');
    expect(V8KnowledgeBaseApi.getArticleBySlug).not.toHaveBeenCalled();
  });

  it('uses the public KB V8 bridge for docs search', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          articles: [
            {
              id: 'art-3',
              slug: 'search-hit',
              title: 'Search Hit',
              summary: 'Summary',
              reading_time_minutes: 3,
              is_featured: false,
              category_slug: 'guides',
              category_name: 'Guides',
              category_icon: 'BookOpen',
              view_count: 2,
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() => useDocsSearch('search', 'en'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/search?q=search&lang=en');
    expect(result.current.data?.[0].slug).toBe('search-hit');
    expect(V8KnowledgeBaseApi.searchArticles).not.toHaveBeenCalled();
  });

  it('uses the public KB V8 bridge for docs article tracking', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });

    const { result } = renderHook(() => useDocsTrackView(), { wrapper: createWrapper() });

    result.current.mutate('article-9');

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/public/kb-v8/articles/article-9/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'public_docs' }),
      })
    );
  });
});
