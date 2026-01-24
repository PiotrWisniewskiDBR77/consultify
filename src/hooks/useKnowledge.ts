/**
 * useKnowledge hooks
 * React Query hooks for Knowledge Base API
 *
 * @module hooks/useKnowledge
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
}

export interface KbArticle extends KbArticleListItem {
  content: string;
  video_url?: string;
  video_script?: string;
  related_modules: string[];
  target_audience: string[];
  category_id: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const API_BASE = '/api/kb';

async function fetchCategories(lang: string, includePrivate = false): Promise<KbCategory[]> {
  const params = new URLSearchParams({ lang });
  if (includePrivate) params.append('all', 'true');

  const res = await fetch(`${API_BASE}/categories?${params}`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
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

async function fetchArticle(slug: string, lang: string): Promise<KbArticle> {
  const res = await fetch(`${API_BASE}/articles/${slug}?lang=${lang}`);
  if (!res.ok) throw new Error('Failed to fetch article');
  const data = await res.json();
  return data.article;
}

async function fetchPublicPreview(lang: string, limit = 3): Promise<KbArticleListItem[]> {
  const res = await fetch(`${API_BASE}/public?lang=${lang}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch public preview');
  const data = await res.json();
  return data.articles;
}

async function fetchFeatured(lang: string, limit = 4): Promise<KbArticleListItem[]> {
  const res = await fetch(`${API_BASE}/featured?lang=${lang}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch featured articles');
  const data = await res.json();
  return data.articles;
}

async function searchArticles(
  query: string,
  lang: string,
  limit = 10
): Promise<KbArticleListItem[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(query)}&lang=${lang}&limit=${limit}`
  );
  if (!res.ok) throw new Error('Failed to search articles');
  const data = await res.json();
  return data.articles;
}

async function fetchContextual(
  moduleId: string,
  lang: string,
  token?: string
): Promise<KbArticleListItem[]> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/context/${moduleId}?lang=${lang}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch contextual articles');
  const data = await res.json();
  return data.articles;
}

async function trackView(articleId: string, source = 'in_app'): Promise<void> {
  await fetch(`${API_BASE}/articles/${articleId}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, sessionId: getSessionId() }),
  });
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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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
  const lang = i18n.language || 'en';

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

export default {
  useKnowledgeCategories,
  useKnowledgeArticles,
  useKnowledgeArticle,
  useKnowledgePublicPreview,
  useKnowledgeFeatured,
  useKnowledgeSearch,
  useKnowledgeContextual,
  useTrackArticleView,
};
