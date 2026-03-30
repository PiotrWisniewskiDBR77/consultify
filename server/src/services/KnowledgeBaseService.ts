/**
 * Knowledge Base Service
 * Handles public Knowledge Base articles, categories and translations
 *
 * @module services/KnowledgeBaseService
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================
// TYPES
// ============================================

export interface KbCategory {
  id: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  // Translation fields (populated based on language)
  name?: string;
  description?: string;
  article_count?: number;
  requested_language?: string;
  resolved_language?: string;
  is_fallback?: boolean;
}

export interface KbArticle {
  id: string;
  category_id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_public: boolean;
  view_count: number;
  reading_time_minutes: number;
  thumbnail_url?: string;
  video_url?: string;
  video_teaser_url?: string;
  related_modules: string[];
  target_audience: string[];
  next_action?: unknown | null;
  created_at: string;
  updated_at?: string;
  // Translation fields
  title?: string;
  summary?: string;
  content?: string;
  video_script?: string;
  // Category info
  category_slug?: string;
  category_name?: string;
  category_icon?: string;
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

// ============================================
// SERVICE CLASS
// ============================================

class KnowledgeBaseService {
  private resolveLanguage(language: string, hasRequestedTranslation: boolean) {
    const requested = language || 'en';
    const resolved = requested === 'en' || hasRequestedTranslation ? requested : 'en';
    return { requested_language: requested, resolved_language: resolved, is_fallback: resolved !== requested };
  }

  /**
   * Get all active categories with translations
   */
  async getCategories(
    language: string = 'en',
    includePrivate: boolean = false
  ): Promise<KbCategory[]> {
    try {
      const publicFilter = includePrivate ? '' : 'AND c.is_public = 1';

      const sql = `
        SELECT 
          c.id, c.slug, c.icon, c.sort_order, c.is_active, c.is_public, c.created_at,
          t.name as requested_name,
          COALESCE(t.name, te.name) as name,
          COALESCE(t.description, te.description) as description,
          (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id AND a.status = 'published') as article_count
        FROM kb_categories c
        LEFT JOIN kb_category_translations t ON c.id = t.category_id AND t.language = ?
        LEFT JOIN kb_category_translations te ON c.id = te.category_id AND te.language = 'en'
        WHERE c.is_active = 1 ${publicFilter}
        ORDER BY c.sort_order ASC
      `;

      const rows = await dbAll(sql, [language]);
      return rows.map((row: any) => {
        const { requested_name, ...rest } = row;
        return {
          ...rest,
          ...this.resolveLanguage(language, Boolean(requested_name)),
          is_active: Boolean(row.is_active),
          is_public: Boolean(row.is_public),
        };
      });
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting categories:', error);
      return [];
    }
  }

  /**
   * Get articles with optional filtering
   */
  async getArticles(
    params: {
      language?: string;
      categorySlug?: string;
      search?: string;
      limit?: number;
      offset?: number;
      publicOnly?: boolean;
      moduleId?: string;
    } = {}
  ): Promise<{ articles: KbArticleListItem[]; total: number }> {
    try {
      const {
        language = 'en',
        categorySlug,
        search,
        limit = 20,
        offset = 0,
        publicOnly = false,
        moduleId,
      } = params;

      const whereConditions = ['a.status = ?'];
      const queryParams: any[] = ['published'];

      if (publicOnly) {
        whereConditions.push('a.is_public = 1');
      }

      if (categorySlug) {
        whereConditions.push('c.slug = ?');
        queryParams.push(categorySlug);
      }

      if (moduleId) {
        whereConditions.push(`a.related_modules LIKE ?`);
        queryParams.push(`%"${moduleId}"%`);
      }

      if (search) {
        whereConditions.push(
          `((t.title LIKE ? OR t.summary LIKE ? OR t.content LIKE ?) OR (te.title LIKE ? OR te.summary LIKE ? OR te.content LIKE ?))`
        );
        const searchPattern = `%${search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      const whereClause = whereConditions.join(' AND ');

      // Count query
      const countSql = `
        SELECT COUNT(*) as total
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        WHERE ${whereClause}
      `;
      const countResult = (await dbGet(countSql, [language, ...queryParams])) as any;
      const total = countResult?.total || 0;

      // Data query
      const dataSql = `
        SELECT 
          a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
          t.title as requested_title,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE ${whereClause}
        ORDER BY a.is_featured DESC, a.view_count DESC, a.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const articles = await dbAll(dataSql, [language, language, ...queryParams, limit, offset]);

      return {
        articles: articles.map((row: any) => {
          const { requested_title, ...rest } = row;
          return {
            ...rest,
            ...this.resolveLanguage(language, Boolean(requested_title)),
            is_featured: Boolean(row.is_featured),
          };
        }),
        total,
      };
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting articles:', error);
      return { articles: [], total: 0 };
    }
  }

  /**
   * Get single article by slug with full content
   */
  async getArticleBySlug(slug: string, language: string = 'en'): Promise<KbArticle | null> {
    try {
      const sql = `
        SELECT 
          a.*,
          t.title as requested_title,
          t.content as requested_content,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          COALESCE(t.content, te.content) as content,
          COALESCE(t.video_script, te.video_script) as video_script,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE a.slug = ? AND a.status = 'published'
      `;

      const row = (await dbGet(sql, [language, language, slug])) as any;

      if (!row) return null;

      const { requested_title, requested_content, next_action: nextActionRaw, ...rest } = row;

      // Mock DB (E2E) doesn't evaluate COALESCE/JOIN expressions — best-effort fill via translations table.
      // This also makes the endpoint resilient if join-based fields are missing for any reason.
      let hasRequestedTranslation = Boolean(requested_title) || Boolean(requested_content);
      let title = rest.title as any;
      let summary = rest.summary as any;
      let content = rest.content as any;
      let video_script = rest.video_script as any;

      if (!title || !content) {
        const requested = (await dbGet(
          `SELECT title, summary, content, video_script
           FROM kb_article_translations
           WHERE article_id = ? AND language = ?
           LIMIT 1`,
          [rest.id, language]
        )) as any;
        if (requested?.title || requested?.content) {
          hasRequestedTranslation = true;
          title = requested.title ?? title;
          summary = requested.summary ?? summary;
          content = requested.content ?? content;
          video_script = requested.video_script ?? video_script;
        }

        if (!title || !content) {
          const en = (await dbGet(
            `SELECT title, summary, content, video_script
             FROM kb_article_translations
             WHERE article_id = ? AND language = 'en'
             LIMIT 1`,
            [rest.id]
          )) as any;
          title = en?.title ?? title;
          summary = en?.summary ?? summary;
          content = en?.content ?? content;
          video_script = en?.video_script ?? video_script;
        }
      }

      const langMeta = this.resolveLanguage(language, hasRequestedTranslation);
      let parsedNextAction: unknown | null = null;
      if (typeof nextActionRaw === 'string' && nextActionRaw.trim()) {
        try {
          parsedNextAction = JSON.parse(nextActionRaw);
        } catch {
          parsedNextAction = null;
        }
      }

      // Parse JSON arrays
      return {
        ...rest,
        title,
        summary,
        content,
        video_script,
        ...langMeta,
        next_action: parsedNextAction,
        is_featured: Boolean(row.is_featured),
        is_public: Boolean(row.is_public),
        related_modules: JSON.parse(row.related_modules || '[]'),
        target_audience: JSON.parse(row.target_audience || '[]'),
      };
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting article:', error);
      return null;
    }
  }

  /**
   * Get public articles for landing page preview
   */
  async getPublicPreview(language: string = 'en', limit: number = 3): Promise<KbArticleListItem[]> {
    try {
      const sql = `
        SELECT 
          a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
          a.video_teaser_url,
          t.title as requested_title,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE a.status = 'published' AND a.is_public = 1
        ORDER BY a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [language, language, limit]);
      return articles.map((row: any) => {
        const { requested_title, ...rest } = row;
        return {
          ...rest,
          ...this.resolveLanguage(language, Boolean(requested_title)),
          is_featured: Boolean(row.is_featured),
        };
      });
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting public preview:', error);
      return [];
    }
  }

  /**
   * Get articles related to a specific module (for context-aware help)
   */
  async getContextualArticles(
    moduleId: string,
    language: string = 'en',
    limit: number = 5
  ): Promise<KbArticleListItem[]> {
    try {
      const sql = `
        SELECT 
          a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
          t.title as requested_title,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE a.status = 'published' AND a.related_modules LIKE ?
        ORDER BY a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [language, language, `%"${moduleId}"%`, limit]);
      return articles.map((row: any) => {
        const { requested_title, ...rest } = row;
        return {
          ...rest,
          ...this.resolveLanguage(language, Boolean(requested_title)),
          is_featured: Boolean(row.is_featured),
        };
      });
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting contextual articles:', error);
      return [];
    }
  }

  /**
   * Search articles with full-text search
   */
  async searchArticles(
    query: string,
    language: string = 'en',
    limit: number = 10
  ): Promise<KbArticleListItem[]> {
    try {
      const searchPattern = `%${query}%`;

      const sql = `
        SELECT 
          a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
          t.title as requested_title,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE a.status = 'published' 
          AND (t.title LIKE ? OR t.summary LIKE ? OR t.content LIKE ?
               OR te.title LIKE ? OR te.summary LIKE ? OR te.content LIKE ?)
        ORDER BY 
          CASE WHEN t.title LIKE ? OR te.title LIKE ? THEN 0 ELSE 1 END,
          a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [
        language,
        language,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        limit,
      ]);

      return articles.map((row: any) => {
        const { requested_title, ...rest } = row;
        return {
          ...rest,
          ...this.resolveLanguage(language, Boolean(requested_title)),
          is_featured: Boolean(row.is_featured),
        };
      });
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error searching articles:', error);
      return [];
    }
  }

  /**
   * Increment view count for an article
   */
  async trackView(
    articleId: string,
    userId?: string,
    sessionId?: string,
    source: string = 'in_app'
  ): Promise<void> {
    try {
      const viewId = uuidv4();

      // Insert view record
      await dbRun(
        'INSERT INTO kb_article_views (id, article_id, user_id, session_id, source) VALUES (?, ?, ?, ?, ?)',
        [viewId, articleId, userId || null, sessionId || null, source]
      );

      // Increment counter
      await dbRun('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?', [articleId]);
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error tracking view:', error);
    }
  }

  /**
   * Get featured articles
   */
  async getFeaturedArticles(
    language: string = 'en',
    limit: number = 4
  ): Promise<KbArticleListItem[]> {
    try {
      const sql = `
        SELECT 
          a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
          t.title as requested_title,
          COALESCE(t.title, te.title) as title,
          COALESCE(t.summary, te.summary) as summary,
          c.slug as category_slug,
          COALESCE(ct.name, cte.name) as category_name,
          c.icon as category_icon
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE a.status = 'published' AND a.is_featured = 1
        ORDER BY a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [language, language, limit]);
      return articles.map((row: any) => {
        const { requested_title, ...rest } = row;
        return {
          ...rest,
          ...this.resolveLanguage(language, Boolean(requested_title)),
          is_featured: Boolean(row.is_featured),
        };
      });
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting featured articles:', error);
      return [];
    }
  }
}

export default new KnowledgeBaseService();
export { KnowledgeBaseService };
