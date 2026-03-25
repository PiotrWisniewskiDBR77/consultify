import { v8Get } from './client';

export const V8_KB_SEARCH_PATH = '/kb/search' as const;
export const V8_KB_ARTICLE_PATH = '/kb/articles' as const;
export const V8_KB_CONTEXT_PATH = '/kb/context' as const;

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
}

export interface V8KbArticle extends V8KbArticleListItem {
  content: string;
  video_url?: string;
  video_script?: string;
  related_modules: string[];
  target_audience: string[];
  category_id: string;
}

export const V8KnowledgeBaseApi = {
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
};
