import { v8Get, v8Post } from './client';

export const V8_KB_SEARCH_PATH = '/kb/search' as const;
export const V8_KB_ARTICLE_PATH = '/kb/articles' as const;
export const V8_KB_CONTEXT_PATH = '/kb/context' as const;
export const V8_KB_CATEGORIES_PATH = '/kb/categories' as const;
export const V8_KB_PUBLIC_PATH = '/kb/public' as const;
export const V8_KB_FEATURED_PATH = '/kb/featured' as const;

export interface V8KbCategory {
  id: string;
  slug: string;
  icon: string;
  name: string;
  description?: string;
  article_count: number;
  is_public: boolean;
}

export interface V8KbArticleListItem {
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
  tags?: Array<{ id: string; slug: string; kind: string; label: string }>;
  requested_language?: string;
  resolved_language?: string;
  is_fallback?: boolean;
}

export interface V8KbArticle extends V8KbArticleListItem {
  content: string;
  video_url?: string;
  video_script?: string;
  related_modules: string[];
  target_audience: string[];
  category_id: string;
  next_action?: unknown | null;
}

export const V8KnowledgeBaseApi = {
  getPublicPreview: (lang: string, limit = 3) =>
    v8Get<{ articles: V8KbArticleListItem[] }>(V8_KB_PUBLIC_PATH, {
      lang,
      limit: String(limit),
    }),

  getFeaturedArticles: (lang: string, limit = 4) =>
    v8Get<{ articles: V8KbArticleListItem[] }>(V8_KB_FEATURED_PATH, {
      lang,
      limit: String(limit),
    }),

  getCategories: (lang: string, includePrivate = false) =>
    v8Get<{ categories: V8KbCategory[] }>(V8_KB_CATEGORIES_PATH, {
      lang,
      ...(includePrivate ? { all: 'true' } : {}),
    }),

  getArticles: (
    params: {
      lang: string;
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
      publicOnly?: boolean;
      moduleId?: string;
    } = { lang: 'en' }
  ) =>
    v8Get<{ articles: V8KbArticleListItem[]; total: number }>(V8_KB_ARTICLE_PATH, {
      lang: params.lang,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(typeof params.limit === 'number' ? { limit: String(params.limit) } : {}),
      ...(typeof params.offset === 'number' ? { offset: String(params.offset) } : {}),
      ...(params.publicOnly ? { public: 'true' } : {}),
      ...(params.moduleId ? { module: params.moduleId } : {}),
    }),

  searchArticles: (query: string, lang: string, limit = 10) =>
    v8Get<{ articles: V8KbArticleListItem[] }>(V8_KB_SEARCH_PATH, {
      q: query,
      lang,
      limit: String(limit),
    }),

  getArticleBySlug: (slug: string, lang: string) =>
    v8Get<{ article: V8KbArticle }>(`${V8_KB_ARTICLE_PATH}/${encodeURIComponent(slug)}`, { lang }),

  getContextualArticles: (moduleId: string, lang: string, limit = 5) =>
    v8Get<{ articles: V8KbArticleListItem[] }>(
      `${V8_KB_CONTEXT_PATH}/${encodeURIComponent(moduleId)}`,
      {
        lang,
        limit: String(limit),
      }
    ),

  trackArticleView: (articleId: string, source = 'in_app', sessionId?: string) =>
    v8Post<{ success: boolean }>(`${V8_KB_ARTICLE_PATH}/${encodeURIComponent(articleId)}/view`, {
      source,
      ...(sessionId ? { sessionId } : {}),
    }),
};
