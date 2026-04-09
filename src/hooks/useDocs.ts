/**
 * Documentation Hooks
 *
 * React Query hooks for Knowledge Base API integration.
 * Used by the public documentation portal at /docs/*
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { V8KnowledgeBaseApi } from '@/services/api/v8/kb';
const PUBLIC_V8_KB_BASE = '/api/public/kb-v8';
const LEGACY_KB_BASE = '/api/kb';

// ============================================
// TYPES
// ============================================

export interface KbCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon: string;
  article_count?: number;
}

export interface KbArticleListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnail_url?: string;
  reading_time_minutes: number;
  is_featured: boolean;
  category_slug: string;
  category_name: string;
  category_icon: string;
  view_count: number;
  tags?: Array<{ id: string; slug: string; kind: string; label: string }>;
}

export interface KbArticle extends KbArticleListItem {
  content: string;
  video_url?: string;
  video_teaser_url?: string;
  hero_asset_refs?: Array<{
    type: 'image' | 'video' | 'embed';
    url: string;
    alt?: string;
    caption?: string;
    poster?: string;
  }>;
  related_modules: string[];
  target_audience: string[];
  video_script?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const fetchPublicKbBridge = async <T>(path: string, fallbackError: string): Promise<T> => {
  const response = await fetch(`${PUBLIC_V8_KB_BASE}${path}`);
  if (!response.ok) throw new Error(fallbackError);
  const data = await response.json();
  return data;
};

function normalizeCategoryList(
  payload:
    | { data?: { categories?: KbCategory[] }; categories?: KbCategory[] }
    | KbCategory[]
    | null
    | undefined
): KbCategory[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data?.categories || payload?.categories || [];
}

function normalizeArticleList(
  payload:
    | { data?: { articles?: KbArticleListItem[] }; articles?: KbArticleListItem[] }
    | KbArticleListItem[]
    | null
    | undefined
): KbArticleListItem[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data?.articles || payload?.articles || [];
}

const fetchCategories = async (language: string = 'en'): Promise<KbCategory[]> => {
  try {
    const data = await fetchPublicKbBridge<{
      data?: { categories?: KbCategory[] };
      categories?: KbCategory[];
    }>(`/categories?lang=${language}`, 'public v8 unavailable');
    return normalizeCategoryList(data);
  } catch {
    const response = await fetch(`${LEGACY_KB_BASE}/categories?lang=${language}`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    const data = await response.json();
    return normalizeCategoryList(data);
  }
};

const fetchArticles = async (params: {
  language?: string;
  categorySlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ articles: KbArticleListItem[]; total: number }> => {
  const searchParams = new URLSearchParams();
  if (params.language) searchParams.set('lang', params.language);
  if (params.categorySlug) searchParams.set('category', params.categorySlug);
  if (params.search) searchParams.set('search', params.search);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  try {
    const data = await fetchPublicKbBridge<{
      data?: { articles?: KbArticleListItem[]; total?: number };
      articles?: KbArticleListItem[];
      total?: number;
    }>(`/articles?${searchParams.toString()}`, 'public v8 unavailable');
    return {
      articles: data.data?.articles || data.articles || [],
      total: data.data?.total ?? data.total ?? 0,
    };
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.getArticles({
        lang: params.language || 'en',
        category: params.categorySlug,
        search: params.search,
        limit: params.limit,
        offset: params.offset,
        publicOnly: true,
      });
      return {
        articles: data.articles as KbArticleListItem[],
        total: data.total || 0,
      };
    } catch {
      const response = await fetch(`${LEGACY_KB_BASE}/articles?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    }
  }
};

const fetchArticleBySlug = async (
  slug: string,
  language: string = 'en'
): Promise<KbArticle | null> => {
  try {
    const data = await fetchPublicKbBridge<{ data?: { article?: KbArticle }; article?: KbArticle }>(
      `/articles/${encodeURIComponent(slug)}?lang=${language}`,
      'public v8 unavailable'
    );
    return data.data?.article || data.article || null;
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.getArticleBySlug(slug, language);
      return data.article as KbArticle;
    } catch {
      const response = await fetch(`${LEGACY_KB_BASE}/articles/${slug}?lang=${language}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch article');
      }
      return response.json();
    }
  }
};

const fetchFeaturedArticles = async (
  language: string = 'en',
  limit: number = 4
): Promise<KbArticleListItem[]> => {
  try {
    const publicResponse = await fetch(
      `${PUBLIC_V8_KB_BASE}/featured?lang=${language}&limit=${limit}`
    );
    if (!publicResponse.ok) throw new Error('public v8 unavailable');
    const publicData = await publicResponse.json();
    return (publicData.data?.articles || publicData.articles || []) as KbArticleListItem[];
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.getFeaturedArticles(language, limit);
      return data.articles as KbArticleListItem[];
    } catch {
      const response = await fetch(`${LEGACY_KB_BASE}/featured?lang=${language}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch featured articles');
      const data = await response.json();
      return data.articles || data || [];
    }
  }
};

const searchArticles = async (
  query: string,
  language: string = 'en'
): Promise<KbArticleListItem[]> => {
  try {
    const data = await fetchPublicKbBridge<{
      data?: { articles?: KbArticleListItem[] };
      articles?: KbArticleListItem[];
    }>(`/search?q=${encodeURIComponent(query)}&lang=${language}`, 'public v8 unavailable');
    return normalizeArticleList(data);
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.searchArticles(query, language);
      return data.articles as KbArticleListItem[];
    } catch {
      const response = await fetch(
        `${LEGACY_KB_BASE}/search?q=${encodeURIComponent(query)}&lang=${language}`
      );
      if (!response.ok) throw new Error('Failed to search articles');
      const data = await response.json();
      return normalizeArticleList(data);
    }
  }
};

const trackArticleView = async (articleId: string): Promise<void> => {
  try {
    const response = await fetch(`${PUBLIC_V8_KB_BASE}/articles/${articleId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'public_docs' }),
    });
    if (!response.ok) throw new Error('public v8 unavailable');
  } catch {
    await fetch(`${LEGACY_KB_BASE}/articles/${articleId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ============================================
// HOOKS
// ============================================

/**
 * Fetch all documentation categories
 */
export function useDocsCategories(language: string = 'en') {
  return useQuery({
    queryKey: ['docs', 'categories', language],
    queryFn: () => fetchCategories(language),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch articles with optional filtering
 */
export function useDocsArticles(params: {
  language?: string;
  categorySlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['docs', 'articles', params],
    queryFn: () => fetchArticles(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch single article by slug
 */
export function useDocsArticle(slug: string, language: string = 'en') {
  return useQuery({
    queryKey: ['docs', 'article', slug, language],
    queryFn: () => fetchArticleBySlug(slug, language),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!slug,
  });
}

/**
 * Fetch featured articles for homepage
 */
export function useDocsFeatured(language: string = 'en', limit: number = 4) {
  return useQuery({
    queryKey: ['docs', 'featured', language, limit],
    queryFn: () => fetchFeaturedArticles(language, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Search articles with debouncing (handled by caller)
 */
export function useDocsSearch(query: string, language: string = 'en') {
  return useQuery({
    queryKey: ['docs', 'search', query, language],
    queryFn: () => searchArticles(query, language),
    staleTime: 60 * 1000, // 1 minute
    enabled: query.length >= 2,
  });
}

/**
 * Track article view (mutation)
 */
export function useDocsTrackView() {
  return useMutation({
    mutationFn: (articleId: string) => trackArticleView(articleId),
  });
}

export default {
  useDocsCategories,
  useDocsArticles,
  useDocsArticle,
  useDocsFeatured,
  useDocsSearch,
  useDocsTrackView,
};
