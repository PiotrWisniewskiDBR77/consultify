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
  tags?: Array<{ id: string; slug: string; kind: string; label: string }>;
  requested_language?: string;
  resolved_language?: string;
  is_fallback?: boolean;
}

// ============================================
// SERVICE CLASS
// ============================================

class KnowledgeBaseService {
  private async attachTagsToArticleListItems(
    language: string,
    rows: any[]
  ): Promise<KbArticleListItem[]> {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const articleIds = rows
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean);

    let tagsByArticleId = new Map<string, Array<{ id: string; slug: string; kind: string; label: string }>>();

    if (articleIds.length > 0) {
      try {
        const placeholders = articleIds.map(() => '?').join(', ');
        const tagRows = (await dbAll(
          `SELECT
             atg.article_id,
             tg.id,
             tg.slug,
             tg.kind,
             COALESCE(tt.label, tte.label) as label
           FROM kb_article_tags atg
           JOIN kb_tags tg ON atg.tag_id = tg.id
           LEFT JOIN kb_tag_translations tt ON tg.id = tt.tag_id AND tt.language = ?
           LEFT JOIN kb_tag_translations tte ON tg.id = tte.tag_id AND tte.language = 'en'
           WHERE atg.article_id IN (${placeholders})
             AND tg.status = 'active'
           ORDER BY tg.kind ASC, label ASC`,
          [language, ...articleIds]
        )) as any[];

        tagsByArticleId = tagRows.reduce((map, row) => {
          const articleId = String(row?.article_id || '').trim();
          if (!articleId) return map;
          const current = map.get(articleId) || [];
          current.push({
            id: row.id,
            slug: row.slug,
            kind: row.kind,
            label: row.label,
          });
          map.set(articleId, current);
          return map;
        }, new Map<string, Array<{ id: string; slug: string; kind: string; label: string }>>());
      } catch {
        tagsByArticleId = new Map();
      }
    }

    return rows.map((row: any) => {
      const { requested_title, ...rest } = row;
      return {
        ...rest,
        tags: tagsByArticleId.get(String(row.id)) || [],
        ...this.resolveLanguage(language, Boolean(requested_title)),
        is_featured: Boolean(row.is_featured),
      };
    });
  }

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
        articles: await this.attachTagsToArticleListItems(language, articles),
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

      // Load article tags
      let tags: Array<{ id: string; slug: string; kind: string; label: string }> = [];
      try {
        tags = (await dbAll(
          `SELECT tg.id, tg.slug, tg.kind,
                  COALESCE(tt.label, tte.label) as label
           FROM kb_article_tags atg
           JOIN kb_tags tg ON atg.tag_id = tg.id
           LEFT JOIN kb_tag_translations tt ON tg.id = tt.tag_id AND tt.language = ?
           LEFT JOIN kb_tag_translations tte ON tg.id = tte.tag_id AND tte.language = 'en'
           WHERE atg.article_id = ? AND tg.status = 'active'`,
          [language, rest.id]
        )) as any[];
      } catch { /* tags table may not exist yet */ }

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
        tags,
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
      return await this.attachTagsToArticleListItems(language, articles);
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
      return await this.attachTagsToArticleListItems(language, articles);
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

      return await this.attachTagsToArticleListItems(language, articles);
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

  // ============================================
  // P26-B: COLLECTIONS (IA spine)
  // ============================================

  async getCollections(
    language: string = 'en',
    params: { parentId?: string; visibility?: string; featured?: boolean } = {}
  ): Promise<any[]> {
    try {
      const conditions = ['c.status = ?'];
      const queryParams: any[] = ['active'];

      if (params.parentId) {
        conditions.push('c.parent_collection_id = ?');
        queryParams.push(params.parentId);
      } else if (params.parentId === undefined) {
        conditions.push('c.parent_collection_id IS NULL');
      }

      if (params.visibility) {
        conditions.push('c.visibility = ?');
        queryParams.push(params.visibility);
      }

      if (params.featured) {
        conditions.push('c.featured = TRUE');
      }

      const sql = `
        SELECT c.id, c.slug, c.parent_collection_id, c.visibility, c.featured, c.sort_order,
               COALESCE(t.title, te.title) as title,
               COALESCE(t.description, te.description) as description,
               (SELECT COUNT(*) FROM kb_article_collections ac WHERE ac.collection_id = c.id) as article_count
        FROM kb_collections c
        LEFT JOIN kb_collection_translations t ON c.id = t.collection_id AND t.language = ?
        LEFT JOIN kb_collection_translations te ON c.id = te.collection_id AND te.language = 'en'
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.sort_order ASC, c.created_at ASC
      `;

      return await dbAll(sql, [language, ...queryParams]);
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting collections:', error);
      return [];
    }
  }

  async getCollectionBySlug(slug: string, language: string = 'en'): Promise<any | null> {
    try {
      const sql = `
        SELECT c.id, c.slug, c.parent_collection_id, c.visibility, c.featured, c.sort_order, c.status,
               COALESCE(t.title, te.title) as title,
               COALESCE(t.description, te.description) as description,
               (SELECT COUNT(*) FROM kb_article_collections ac WHERE ac.collection_id = c.id) as article_count
        FROM kb_collections c
        LEFT JOIN kb_collection_translations t ON c.id = t.collection_id AND t.language = ?
        LEFT JOIN kb_collection_translations te ON c.id = te.collection_id AND te.language = 'en'
        WHERE c.slug = ?
      `;
      return await dbGet(sql, [language, slug]);
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting collection by slug:', error);
      return null;
    }
  }

  async getArticlesByCollection(
    collectionId: string,
    language: string = 'en',
    limit: number = 50,
    offset: number = 0
  ): Promise<{ articles: KbArticleListItem[]; total: number }> {
    try {
      const countSql = `
        SELECT COUNT(*) as total
        FROM kb_article_collections ac
        JOIN kb_articles a ON ac.article_id = a.id
        WHERE ac.collection_id = ? AND a.status = 'published'
      `;
      const countResult = (await dbGet(countSql, [collectionId])) as any;
      const total = countResult?.total || 0;

      const sql = `
        SELECT a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
               COALESCE(t.title, te.title) as title,
               COALESCE(t.summary, te.summary) as summary,
               c.slug as category_slug,
               COALESCE(ct.name, cte.name) as category_name,
               c.icon as category_icon
        FROM kb_article_collections ac
        JOIN kb_articles a ON ac.article_id = a.id
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE ac.collection_id = ? AND a.status = 'published'
        ORDER BY ac.sort_order ASC, a.is_featured DESC, a.view_count DESC
        LIMIT ? OFFSET ?
      `;

      const articles = await dbAll(sql, [language, language, collectionId, limit, offset]);
      return {
        articles: articles.map((row: any) => ({
          ...row,
          is_featured: Boolean(row.is_featured),
        })),
        total,
      };
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting articles by collection:', error);
      return { articles: [], total: 0 };
    }
  }

  // ============================================
  // P26-B: TAGS (facets)
  // ============================================

  async getTags(
    language: string = 'en',
    params: { kind?: string; articleId?: string } = {}
  ): Promise<any[]> {
    try {
      const conditions = ['tg.status = ?'];
      const queryParams: any[] = ['active'];

      if (params.kind) {
        conditions.push('tg.kind = ?');
        queryParams.push(params.kind);
      }

      let joinClause = '';
      if (params.articleId) {
        joinClause = 'JOIN kb_article_tags at2 ON tg.id = at2.tag_id';
        conditions.push('at2.article_id = ?');
        queryParams.push(params.articleId);
      }

      const sql = `
        SELECT tg.id, tg.slug, tg.kind, tg.synonyms, tg.visibility,
               COALESCE(tt.label, tte.label) as label,
               COALESCE(tt.description, tte.description) as description,
               (SELECT COUNT(*) FROM kb_article_tags at3 WHERE at3.tag_id = tg.id) as article_count
        FROM kb_tags tg
        ${joinClause}
        LEFT JOIN kb_tag_translations tt ON tg.id = tt.tag_id AND tt.language = ?
        LEFT JOIN kb_tag_translations tte ON tg.id = tte.tag_id AND tte.language = 'en'
        WHERE ${conditions.join(' AND ')}
        ORDER BY tg.kind ASC, COALESCE(tt.label, tte.label) ASC
      `;

      return await dbAll(sql, [language, ...queryParams]);
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting tags:', error);
      return [];
    }
  }

  async getArticlesByTag(
    tagSlug: string,
    language: string = 'en',
    limit: number = 20
  ): Promise<KbArticleListItem[]> {
    try {
      const sql = `
        SELECT a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
               COALESCE(t.title, te.title) as title,
               COALESCE(t.summary, te.summary) as summary,
               c.slug as category_slug,
               COALESCE(ct.name, cte.name) as category_name,
               c.icon as category_icon
        FROM kb_article_tags atg
        JOIN kb_tags tg ON atg.tag_id = tg.id
        JOIN kb_articles a ON atg.article_id = a.id
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE tg.slug = ? AND a.status = 'published'
        ORDER BY a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [language, language, tagSlug, limit]);
      return articles.map((row: any) => ({
        ...row,
        is_featured: Boolean(row.is_featured),
      }));
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting articles by tag:', error);
      return [];
    }
  }

  // ============================================
  // P26-B: SEARCH with facets
  // ============================================

  async searchWithFacets(
    query: string,
    language: string = 'en',
    params: { collectionSlug?: string; tagSlugs?: string[]; surface?: string; limit?: number } = {}
  ): Promise<{
    articles: KbArticleListItem[];
    facets: { collections: any[]; tags: any[] };
    total: number;
  }> {
    try {
      const limit = params.limit || 20;
      const searchPattern = `%${query}%`;
      const conditions = ['a.status = ?'];
      const queryParams: any[] = ['published'];

      if (params.surface) {
        conditions.push(`EXISTS (SELECT 1 FROM kb_surface_bindings sb WHERE sb.article_id = a.id AND sb.surface = ?)`);
        queryParams.push(params.surface);
      }

      if (params.collectionSlug) {
        conditions.push(`EXISTS (
          SELECT 1 FROM kb_article_collections ac2
          JOIN kb_collections col ON ac2.collection_id = col.id
          WHERE ac2.article_id = a.id AND col.slug = ?
        )`);
        queryParams.push(params.collectionSlug);
      }

      if (params.tagSlugs && params.tagSlugs.length > 0) {
        const placeholders = params.tagSlugs.map(() => '?').join(',');
        conditions.push(`EXISTS (
          SELECT 1 FROM kb_article_tags at4
          JOIN kb_tags tg2 ON at4.tag_id = tg2.id
          WHERE at4.article_id = a.id AND tg2.slug IN (${placeholders})
        )`);
        queryParams.push(...params.tagSlugs);
      }

      conditions.push(
        `(t.title LIKE ? OR t.summary LIKE ? OR t.content LIKE ?
          OR te.title LIKE ? OR te.summary LIKE ? OR te.content LIKE ?)`
      );
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);

      const whereClause = conditions.join(' AND ');

      const countSql = `
        SELECT COUNT(*) as total
        FROM kb_articles a
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        WHERE ${whereClause}
      `;
      const countResult = (await dbGet(countSql, [language, ...queryParams])) as any;
      const total = countResult?.total || 0;

      const dataSql = `
        SELECT a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
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
        ORDER BY
          CASE
            WHEN LOWER(COALESCE(t.title, te.title)) = LOWER(?) THEN 0
            WHEN COALESCE(t.title, te.title) LIKE ? THEN 1
            WHEN COALESCE(t.summary, te.summary) LIKE ? THEN 2
            ELSE 3
          END,
          CASE WHEN a.deprecated_at IS NOT NULL THEN 1 ELSE 0 END,
          a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(dataSql, [language, language, ...queryParams, query, searchPattern, searchPattern, limit]);

      // Build facets from result set
      const articleIds = articles.map((a: any) => a.id);
      let collectionFacets: any[] = [];
      let tagFacets: any[] = [];

      if (articleIds.length > 0) {
        const idPlaceholders = articleIds.map(() => '?').join(',');

        try {
          const collFacetSql = `
            SELECT col.id, col.slug, COALESCE(ct2.title, cte2.title) as title, COUNT(*) as count
            FROM kb_article_collections ac5
            JOIN kb_collections col ON ac5.collection_id = col.id
            LEFT JOIN kb_collection_translations ct2 ON col.id = ct2.collection_id AND ct2.language = ?
            LEFT JOIN kb_collection_translations cte2 ON col.id = cte2.collection_id AND cte2.language = 'en'
            WHERE ac5.article_id IN (${idPlaceholders})
            GROUP BY col.id, col.slug, ct2.title, cte2.title
            ORDER BY count DESC
          `;
          collectionFacets = await dbAll(collFacetSql, [language, ...articleIds]);
        } catch { /* collections table may not exist yet */ }

        try {
          const tagFacetSql = `
            SELECT tg3.id, tg3.slug, tg3.kind, COALESCE(tt3.label, tte3.label) as label, COUNT(*) as count
            FROM kb_article_tags at5
            JOIN kb_tags tg3 ON at5.tag_id = tg3.id
            LEFT JOIN kb_tag_translations tt3 ON tg3.id = tt3.tag_id AND tt3.language = ?
            LEFT JOIN kb_tag_translations tte3 ON tg3.id = tte3.tag_id AND tte3.language = 'en'
            WHERE at5.article_id IN (${idPlaceholders}) AND tg3.status = 'active'
            GROUP BY tg3.id, tg3.slug, tg3.kind, tt3.label, tte3.label
            ORDER BY count DESC
          `;
          tagFacets = await dbAll(tagFacetSql, [language, ...articleIds]);
        } catch { /* tags table may not exist yet */ }
      }

      return {
        articles: articles.map((row: any) => ({
          ...row,
          is_featured: Boolean(row.is_featured),
        })),
        facets: { collections: collectionFacets, tags: tagFacets },
        total,
      };
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error in searchWithFacets:', error);
      return { articles: [], facets: { collections: [], tags: [] }, total: 0 };
    }
  }

  // ============================================
  // P26-B: RELATED ARTICLES (curated)
  // ============================================

  async getRelatedArticles(
    articleId: string,
    language: string = 'en',
    limit: number = 5
  ): Promise<KbArticleListItem[]> {
    try {
      const article = (await dbGet(
        `SELECT related_article_ids FROM kb_articles WHERE id = ?`,
        [articleId]
      )) as any;

      if (!article?.related_article_ids) return [];

      let relatedIds: string[];
      try {
        relatedIds = JSON.parse(article.related_article_ids);
      } catch {
        return [];
      }

      if (!Array.isArray(relatedIds) || relatedIds.length === 0) return [];

      const bounded = relatedIds.slice(0, limit);
      const placeholders = bounded.map(() => '?').join(',');

      const sql = `
        SELECT a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
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
        WHERE a.id IN (${placeholders}) AND a.status = 'published'
      `;

      const articles = await dbAll(sql, [language, language, ...bounded]);
      return articles.map((row: any) => ({
        ...row,
        is_featured: Boolean(row.is_featured),
      }));
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting related articles:', error);
      return [];
    }
  }

  // ============================================
  // P26-B: ARTICLE VERSIONS
  // ============================================

  async getArticleVersions(articleId: string): Promise<any[]> {
    try {
      return await dbAll(
        `SELECT id, article_id, version, change_type, change_note, changed_by, changed_at
         FROM kb_article_versions
         WHERE article_id = ?
         ORDER BY version DESC`,
        [articleId]
      );
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting article versions:', error);
      return [];
    }
  }

  // ============================================
  // P26-B: DEPRECATION / REDIRECT
  // ============================================

  async resolveArticleRedirect(slug: string): Promise<{ redirectSlug: string | null; deprecationReason: string | null }> {
    try {
      const article = (await dbGet(
        `SELECT a.redirect_to_article_id, a.deprecated_at, a.deprecation_reason, a.replacement_article_id
         FROM kb_articles a WHERE a.slug = ?`,
        [slug]
      )) as any;

      if (!article) return { redirectSlug: null, deprecationReason: null };

      const targetId = article.redirect_to_article_id || article.replacement_article_id;
      if (targetId) {
        const target = (await dbGet(`SELECT slug FROM kb_articles WHERE id = ?`, [targetId])) as any;
        return {
          redirectSlug: target?.slug || null,
          deprecationReason: article.deprecation_reason || null,
        };
      }

      return {
        redirectSlug: null,
        deprecationReason: article.deprecated_at ? (article.deprecation_reason || 'This article has been deprecated.') : null,
      };
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error resolving redirect:', error);
      return { redirectSlug: null, deprecationReason: null };
    }
  }

  // ============================================
  // P26-B: SURFACE BINDING FILTER
  // ============================================

  async getArticlesForSurface(
    surface: string,
    language: string = 'en',
    params: { toolContext?: string; limit?: number } = {}
  ): Promise<KbArticleListItem[]> {
    try {
      const limit = params.limit || 10;
      const conditions = ['a.status = ?', 'sb.surface = ?'];
      const queryParams: any[] = ['published', surface];

      if (params.toolContext) {
        conditions.push('(sb.tool_context = ? OR sb.tool_context IS NULL)');
        queryParams.push(params.toolContext);
      }

      const sql = `
        SELECT DISTINCT a.id, a.slug, a.thumbnail_url, a.reading_time_minutes, a.is_featured, a.view_count,
               COALESCE(t.title, te.title) as title,
               COALESCE(t.summary, te.summary) as summary,
               c.slug as category_slug,
               COALESCE(ct.name, cte.name) as category_name,
               c.icon as category_icon
        FROM kb_surface_bindings sb
        JOIN kb_articles a ON sb.article_id = a.id
        JOIN kb_categories c ON a.category_id = c.id
        LEFT JOIN kb_article_translations t ON a.id = t.article_id AND t.language = ?
        LEFT JOIN kb_article_translations te ON a.id = te.article_id AND te.language = 'en'
        LEFT JOIN kb_category_translations ct ON c.id = ct.category_id AND ct.language = ?
        LEFT JOIN kb_category_translations cte ON c.id = cte.category_id AND cte.language = 'en'
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.is_featured DESC, a.view_count DESC
        LIMIT ?
      `;

      const articles = await dbAll(sql, [language, language, ...queryParams, limit]);
      return articles.map((row: any) => ({
        ...row,
        is_featured: Boolean(row.is_featured),
      }));
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting articles for surface:', error);
      return [];
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
      return await this.attachTagsToArticleListItems(language, articles);
    } catch (error) {
      logger.error('[KnowledgeBaseService] Error getting featured articles:', error);
      return [];
    }
  }
}

export default new KnowledgeBaseService();
export { KnowledgeBaseService };
