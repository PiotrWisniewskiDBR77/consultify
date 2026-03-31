/**
 * useKnowledge hooks
 * React Query hooks for Knowledge Base API
 *
 * @module hooks/useKnowledge
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { V8KnowledgeBaseApi } from '@/services/api/v8/kb';

// ============================================
// TYPES
// ============================================

export interface KbCategory {
  id: string;
  slug: string;
  icon: string;
  name: string;
  description?: string;
  article_count: number;
  is_public: boolean;
  requested_language?: string;
  resolved_language?: string;
  is_fallback?: boolean;
}

export interface KbArticleListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnail_url?: string;
  video_teaser_url?: string;
  reading_time_minutes: number;
  is_featured: boolean;
  category_slug: string;
  category_name: string;
  category_icon: string;
  view_count: number;
  requested_language?: string;
  resolved_language?: string;
  is_fallback?: boolean;
}

export interface KbArticle extends KbArticleListItem {
  content: string;
  video_url?: string;
  video_script?: string;
  related_modules: string[];
  target_audience: string[];
  category_id: string;
  next_action?: unknown | null;
}

// ============================================
// API FUNCTIONS
// ============================================

const API_BASE = '/api/kb';
const PUBLIC_V8_KB_BASE = '/api/public/kb-v8';

function normalizeKbLang(raw: string | undefined | null): string {
  const lang = String(raw || '').trim().toLowerCase();
  if (!lang) return 'en';
  if (lang === 'pl' || lang.startsWith('pl-')) return 'pl';
  if (lang === 'en' || lang.startsWith('en-')) return 'en';
  // KB currently guarantees EN + PL; keep the API stable for the help runtime.
  return 'en';
}

async function fetchPublicBridgeArticles(path: 'public' | 'featured', lang: string, limit: number) {
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/${path}?lang=${lang}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch public KB bridge: ${path}`);
  }
  const data = await res.json();
  return (data.data?.articles || data.articles || []) as KbArticleListItem[];
}

async function fetchCategories(lang: string, includePrivate = false): Promise<KbCategory[]> {
  try {
    const data = await V8KnowledgeBaseApi.getCategories(lang, includePrivate);
    return data.categories as KbCategory[];
  } catch {
    const params = new URLSearchParams({ lang });
    if (includePrivate) params.append('all', 'true');

    const res = await fetch(`${API_BASE}/categories?${params}`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    const data = await res.json();
    return data.categories;
  }
}

async function fetchArticles(params: {
  lang?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
  publicOnly?: boolean;
  moduleId?: string;
}): Promise<{ articles: KbArticleListItem[]; total: number }> {
  try {
    const data = await V8KnowledgeBaseApi.getArticles({
      lang: params.lang || 'en',
      category: params.category,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
      publicOnly: params.publicOnly,
      moduleId: params.moduleId,
    });
    return { articles: data.articles as KbArticleListItem[], total: data.total || 0 };
  } catch {
    const searchParams = new URLSearchParams();
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.category) searchParams.append('category', params.category);
    if (params.search) searchParams.append('search', params.search);
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.offset) searchParams.append('offset', String(params.offset));
    if (params.publicOnly) searchParams.append('public', 'true');
    if (params.moduleId) searchParams.append('module', params.moduleId);

    const res = await fetch(`${API_BASE}/articles?${searchParams}`);
    if (!res.ok) throw new Error('Failed to fetch articles');
    return res.json();
  }
}

async function fetchArticle(slug: string, lang: string): Promise<KbArticle> {
  try {
    const data = await V8KnowledgeBaseApi.getArticleBySlug(slug, lang);
    return data.article as KbArticle;
  } catch {
    const res = await fetch(`${API_BASE}/articles/${slug}?lang=${lang}`);
    if (!res.ok) throw new Error('Failed to fetch article');
    const data = await res.json();
    return data.article;
  }
}

async function fetchPublicPreview(lang: string, limit = 3): Promise<KbArticleListItem[]> {
  try {
    return await fetchPublicBridgeArticles('public', lang, limit);
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.getPublicPreview(lang, limit);
      return data.articles as KbArticleListItem[];
    } catch {
      const res = await fetch(`${API_BASE}/public?lang=${lang}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch public preview');
      const data = await res.json();
      return data.articles;
    }
  }
}

async function fetchFeatured(lang: string, limit = 4): Promise<KbArticleListItem[]> {
  try {
    return await fetchPublicBridgeArticles('featured', lang, limit);
  } catch {
    try {
      const data = await V8KnowledgeBaseApi.getFeaturedArticles(lang, limit);
      return data.articles as KbArticleListItem[];
    } catch {
      const res = await fetch(`${API_BASE}/featured?lang=${lang}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch featured articles');
      const data = await res.json();
      return data.articles;
    }
  }
}

async function searchArticles(
  query: string,
  lang: string,
  limit = 10
): Promise<KbArticleListItem[]> {
  if (!query || query.length < 2) return [];
  try {
    const data = await V8KnowledgeBaseApi.searchArticles(query, lang, limit);
    return data.articles as KbArticleListItem[];
  } catch {
    const res = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(query)}&lang=${lang}&limit=${limit}`
    );
    if (!res.ok) throw new Error('Failed to search articles');
    const data = await res.json();
    return data.articles;
  }
}

async function fetchContextual(
  moduleId: string,
  lang: string,
  token?: string
): Promise<KbArticleListItem[]> {
  try {
    const data = await V8KnowledgeBaseApi.getContextualArticles(moduleId, lang);
    return data.articles as KbArticleListItem[];
  } catch {
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/context/${moduleId}?lang=${lang}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch contextual articles');
    const data = await res.json();
    return data.articles;
  }
}

async function trackView(articleId: string, source = 'in_app'): Promise<void> {
  const sessionId = getSessionId();
  try {
    await V8KnowledgeBaseApi.trackArticleView(articleId, source, sessionId);
    return;
  } catch {
    await fetch(`${API_BASE}/articles/${articleId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, sessionId }),
    });
  }
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('kb_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('kb_session_id', sessionId);
  }
  return sessionId;
}

// ============================================
// HOOKS
// ============================================

/**
 * Get all active categories
 */
export function useKnowledgeCategories(includePrivate = false) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-categories', lang, includePrivate],
    queryFn: () => fetchCategories(lang, includePrivate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get paginated articles
 */
export function useKnowledgeArticles(
  params: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
    publicOnly?: boolean;
    moduleId?: string;
  } = {}
) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-articles', lang, params],
    queryFn: () => fetchArticles({ ...params, lang }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get single article by slug
 */
export function useKnowledgeArticle(slug: string | undefined) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-article', slug, lang],
    queryFn: () => fetchArticle(slug!, lang),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get public articles for landing page
 */
export function useKnowledgePublicPreview(limit = 3) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-public', lang, limit],
    queryFn: () => fetchPublicPreview(lang, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get featured articles
 */
export function useKnowledgeFeatured(limit = 4) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-featured', lang, limit],
    queryFn: () => fetchFeatured(lang, limit),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Search articles
 */
export function useKnowledgeSearch(query: string, limit = 10) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-search', query, lang, limit],
    queryFn: () => searchArticles(query, lang, limit),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get contextual articles for current module (for help panel)
 */
export function useKnowledgeContextual(moduleId: string | undefined, token?: string) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);

  return useQuery({
    queryKey: ['kb-contextual', moduleId, lang],
    queryFn: () => fetchContextual(moduleId!, lang, token),
    enabled: !!moduleId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Track article view (mutation)
 */
export function useTrackArticleView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, source }: { articleId: string; source?: string }) =>
      trackView(articleId, source),
    onSuccess: () => {
      // Optionally invalidate article queries to update view counts
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
    },
  });
}

// ============================================
// P26-B: COLLECTION + TAG HOOKS
// ============================================

export interface KbCollection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  parent_collection_id?: string;
  visibility: string;
  featured: boolean;
  article_count: number;
}

export interface KbTag {
  id: string;
  slug: string;
  kind: string;
  label: string;
  description?: string;
  article_count: number;
}

async function fetchCollections(lang: string, params: { parentId?: string; featured?: boolean } = {}): Promise<KbCollection[]> {
  const searchParams = new URLSearchParams({ lang });
  if (params.parentId) searchParams.append('parent', params.parentId);
  if (params.featured) searchParams.append('featured', 'true');
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/collections?${searchParams}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.collections || []) as KbCollection[];
}

async function fetchCollectionArticles(
  collectionSlug: string,
  lang: string,
  limit = 20,
  offset = 0
): Promise<{ articles: KbArticleListItem[]; total: number; collection: KbCollection | null }> {
  const res = await fetch(
    `${PUBLIC_V8_KB_BASE}/collections/${collectionSlug}/articles?lang=${lang}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) return { articles: [], total: 0, collection: null };
  const data = await res.json();
  return {
    articles: (data.data?.articles || []) as KbArticleListItem[],
    total: data.data?.total || 0,
    collection: (data.data?.collection || null) as KbCollection | null,
  };
}

async function fetchTags(lang: string, kind?: string): Promise<KbTag[]> {
  const searchParams = new URLSearchParams({ lang });
  if (kind) searchParams.append('kind', kind);
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/tags?${searchParams}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.tags || []) as KbTag[];
}

async function fetchRelatedArticles(slug: string, lang: string, limit = 5): Promise<KbArticleListItem[]> {
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/articles/${slug}/related?lang=${lang}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.articles || []) as KbArticleListItem[];
}

async function fetchArticleRedirect(slug: string): Promise<{ redirectSlug: string | null; deprecationReason: string | null }> {
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/articles/${slug}/redirect`);
  if (!res.ok) return { redirectSlug: null, deprecationReason: null };
  const data = await res.json();
  return data.data || { redirectSlug: null, deprecationReason: null };
}

async function searchWithFacets(
  query: string,
  lang: string,
  params: { collectionSlug?: string; tagSlugs?: string[]; surface?: string; limit?: number } = {}
): Promise<{ articles: KbArticleListItem[]; facets: { collections: any[]; tags: any[] }; total: number }> {
  if (!query || query.length < 2) return { articles: [], facets: { collections: [], tags: [] }, total: 0 };
  const searchParams = new URLSearchParams({ q: query, lang });
  if (params.collectionSlug) searchParams.append('collection', params.collectionSlug);
  if (params.tagSlugs?.length) searchParams.append('tags', params.tagSlugs.join(','));
  if (params.surface) searchParams.append('surface', params.surface);
  if (params.limit) searchParams.append('limit', String(params.limit));
  const res = await fetch(`${PUBLIC_V8_KB_BASE}/search/faceted?${searchParams}`);
  if (!res.ok) throw new Error(`Faceted search failed: ${res.status}`);
  const data = await res.json();
  return data.data || { articles: [], facets: { collections: [], tags: [] }, total: 0 };
}

export function useKnowledgeCollections(params: { parentId?: string; featured?: boolean } = {}) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);
  return useQuery({
    queryKey: ['kb-collections', lang, params],
    queryFn: () => fetchCollections(lang, params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useKnowledgeCollectionArticles(collectionSlug: string | undefined, limit = 20, offset = 0) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);
  return useQuery({
    queryKey: ['kb-collection-articles', collectionSlug, lang, limit, offset],
    queryFn: () => fetchCollectionArticles(collectionSlug!, lang, limit, offset),
    enabled: !!collectionSlug,
    staleTime: 2 * 60 * 1000,
  });
}

export function useKnowledgeTags(kind?: string) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);
  return useQuery({
    queryKey: ['kb-tags', lang, kind],
    queryFn: () => fetchTags(lang, kind),
    staleTime: 5 * 60 * 1000,
  });
}

export function useKnowledgeRelated(slug: string | undefined) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);
  return useQuery({
    queryKey: ['kb-related', slug, lang],
    queryFn: () => fetchRelatedArticles(slug!, lang),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useKnowledgeRedirect(slug: string | undefined) {
  return useQuery({
    queryKey: ['kb-redirect', slug],
    queryFn: () => fetchArticleRedirect(slug!),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
}

export function useKnowledgeSearchFaceted(
  query: string,
  params: { collectionSlug?: string; tagSlugs?: string[]; surface?: string; limit?: number } = {}
) {
  const { i18n } = useTranslation();
  const lang = normalizeKbLang(i18n.language);
  return useQuery({
    queryKey: ['kb-search-faceted', query, lang, params],
    queryFn: () => searchWithFacets(query, lang, params),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}

export default {
  useKnowledgeCategories,
  useKnowledgeArticles,
  useKnowledgeArticle,
  useKnowledgePublicPreview,
  useKnowledgeFeatured,
  useKnowledgeSearch,
  useKnowledgeContextual,
  useTrackArticleView,
  useKnowledgeCollections,
  useKnowledgeCollectionArticles,
  useKnowledgeTags,
  useKnowledgeRelated,
  useKnowledgeRedirect,
  useKnowledgeSearchFaceted,
};
