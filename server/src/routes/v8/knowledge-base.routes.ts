/**
 * V8 read-only Knowledge Base bridge — delegates to KnowledgeBaseService.
 * Namespace: /api/v8/kb (mounted by v8/index).
 *
 * @module routes/v8/knowledge-base.routes
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import KnowledgeBaseService from '../../services/KnowledgeBaseService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
export const publicKnowledgeBaseRoutes = Router();

/** Stable contract id for clients parsing V8 KB read responses. */
export const V8_KB_READ_CONTRACT = 'knowledge_base_read_v1';

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

function parseBoundedLimit(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function kbMeta() {
  return { version: 'v8' as const, contract: V8_KB_READ_CONTRACT };
}

const VALID_SITE_KEYS = new Set(['consultify', 'iot', 'iris', 'dt', 'marketplace', 'vector']);

function sitePrefix(raw: unknown): string | undefined {
  const key = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return VALID_SITE_KEYS.has(key) ? key + '-' : undefined;
}

/**
 * GET /api/v8/kb/categories?lang=&all=
 * Anonymous-safe category listing for public docs and landing surfaces.
 */
publicKnowledgeBaseRoutes.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const categories = await KnowledgeBaseService.getCategories(language, false, categoryPrefix);
    return res.json({ data: { categories }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/public?lang=&limit=
 * Anonymous-safe public article preview for landing surfaces.
 */
publicKnowledgeBaseRoutes.get(
  '/public',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 3, 20);
    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const articles = await KnowledgeBaseService.getPublicPreview(language, limit, categoryPrefix);
    return res.json({ data: { articles }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/featured?lang=&limit=
 * Anonymous-safe featured article cards for public or authenticated help surfaces.
 */
publicKnowledgeBaseRoutes.get(
  '/featured',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 4, 20);
    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const articles = await KnowledgeBaseService.getFeaturedArticles(language, limit, categoryPrefix);
    return res.json({ data: { articles }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles?lang=&category=&search=&limit=&offset=
 * Anonymous-safe public docs article listing.
 */
publicKnowledgeBaseRoutes.get(
  '/articles',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const categorySlug = firstParam(req.query.category);
    const search = firstParam(req.query.search);
    const limit = parseBoundedLimit(firstParam(req.query.limit), 20, 100);
    const offset = Math.max(
      0,
      Number.parseInt(String(firstParam(req.query.offset) ?? '0'), 10) || 0
    );

    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const result = await KnowledgeBaseService.getArticles({
      language,
      categorySlug,
      search,
      limit,
      offset,
      publicOnly: true,
      categoryPrefix,
    });

    return res.json({ data: result, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/search?q=&lang=&limit=
 * Anonymous-safe public docs search.
 */
publicKnowledgeBaseRoutes.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const qStr = firstParam(req.query.q);
    const lang = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 10, 50);

    if (!qStr || qStr.length < 2) {
      return res.json({ data: { articles: [] }, meta: kbMeta() });
    }

    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const articles = await KnowledgeBaseService.searchArticles(qStr, lang, limit, categoryPrefix);
    const publicArticles = articles.filter((article) => (article as any)?.is_public !== false);
    return res.json({ data: { articles: publicArticles }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles/:slug?lang=
 * Anonymous-safe public docs article detail.
 */
publicKnowledgeBaseRoutes.get(
  '/articles/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as { slug?: string }).slug);
    const language = firstParam(req.query.lang) || 'en';
    if (!slug) {
      return res.status(400).json({ error: 'slug is required', code: 'KB_SLUG_REQUIRED' });
    }

    const article = await KnowledgeBaseService.getArticleBySlug(slug, language);
    if (!article || !article.is_public) {
      return res.status(404).json({ error: 'Article not found', code: 'KB_ARTICLE_NOT_FOUND' });
    }

    return res.json({ data: { article }, meta: kbMeta() });
  })
);

/**
 * POST /api/v8/kb/articles/:id/view
 * Anonymous-safe public docs article view tracking.
 */
publicKnowledgeBaseRoutes.post(
  '/articles/:id/view',
  asyncHandler(async (req: Request, res: Response) => {
    const articleId = firstParam((req.params as { id?: string }).id);
    const source =
      typeof req.body?.source === 'string' && req.body.source.trim()
        ? req.body.source.trim()
        : 'public_docs';
    const sessionId =
      typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
        ? req.body.sessionId.trim()
        : undefined;

    if (!articleId) {
      return res.status(400).json({ error: 'id is required', code: 'KB_ARTICLE_ID_REQUIRED' });
    }

    await KnowledgeBaseService.trackView(articleId, undefined, sessionId, source);
    return res.json({ data: { success: true }, meta: kbMeta() });
  })
);

// ============================================================
// P26-B: Collections (IA spine)
// ============================================================

/**
 * GET /api/v8/kb/collections?lang=&parent=&featured=
 * Browse collections (IA spine). Public + authenticated.
 */
publicKnowledgeBaseRoutes.get(
  '/collections',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const parentId = firstParam(req.query.parent);
    const featured = firstParam(req.query.featured) === 'true';
    const collections = await KnowledgeBaseService.getCollections(language, {
      parentId: parentId || undefined,
      visibility: 'public',
      featured: featured || undefined,
    });
    return res.json({ data: { collections }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/collections/:slug?lang=
 */
publicKnowledgeBaseRoutes.get(
  '/collections/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    const language = firstParam(req.query.lang) || 'en';
    if (!slug) return res.status(400).json({ error: 'slug required' });
    const collection = await KnowledgeBaseService.getCollectionBySlug(slug, language);
    if (!collection) return res.status(404).json({ error: 'Collection not found', code: 'KB_COLLECTION_NOT_FOUND' });
    return res.json({ data: { collection }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/collections/:slug/articles?lang=&limit=&offset=
 */
publicKnowledgeBaseRoutes.get(
  '/collections/:slug/articles',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 20, 100);
    const offset = Math.max(0, Number.parseInt(String(firstParam(req.query.offset) ?? '0'), 10) || 0);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const collection = await KnowledgeBaseService.getCollectionBySlug(slug, language);
    if (!collection) return res.status(404).json({ error: 'Collection not found', code: 'KB_COLLECTION_NOT_FOUND' });

    const result = await KnowledgeBaseService.getArticlesByCollection(collection.id, language, limit, offset);
    return res.json({ data: { ...result, collection }, meta: kbMeta() });
  })
);

// ============================================================
// P26-B: Tags (facets)
// ============================================================

/**
 * GET /api/v8/kb/tags?lang=&kind=
 */
publicKnowledgeBaseRoutes.get(
  '/tags',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const kind = firstParam(req.query.kind);
    const tags = await KnowledgeBaseService.getTags(language, { kind: kind || undefined });
    return res.json({ data: { tags }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/tags/:slug/articles?lang=&limit=
 */
publicKnowledgeBaseRoutes.get(
  '/tags/:slug/articles',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 20, 100);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const articles = await KnowledgeBaseService.getArticlesByTag(slug, language, limit);
    return res.json({ data: { articles }, meta: kbMeta() });
  })
);

// ============================================================
// P26-B: Search with facets
// ============================================================

/**
 * GET /api/v8/kb/search/faceted?q=&lang=&collection=&tags=&surface=&limit=
 */
publicKnowledgeBaseRoutes.get(
  '/search/faceted',
  asyncHandler(async (req: Request, res: Response) => {
    const q = firstParam(req.query.q);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 20, 50);
    const collectionSlug = firstParam(req.query.collection);
    const tagsRaw = firstParam(req.query.tags);
    const surface = firstParam(req.query.surface);

    if (!q || q.length < 2) {
      return res.json({ data: { articles: [], facets: { collections: [], tags: [] }, total: 0 }, meta: kbMeta() });
    }

    const tagSlugs = tagsRaw ? tagsRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;

    const result = await KnowledgeBaseService.searchWithFacets(q, language, {
      collectionSlug: collectionSlug || undefined,
      tagSlugs,
      surface: surface || undefined,
      limit,
    });

    return res.json({ data: result, meta: kbMeta() });
  })
);

// ============================================================
// P26-B: Related articles + versions + redirect
// ============================================================

/**
 * GET /api/v8/kb/articles/:slug/related?lang=&limit=
 */
publicKnowledgeBaseRoutes.get(
  '/articles/:slug/related',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 5, 20);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const article = await KnowledgeBaseService.getArticleBySlug(slug, language);
    if (!article) return res.status(404).json({ error: 'Article not found', code: 'KB_ARTICLE_NOT_FOUND' });

    const related = await KnowledgeBaseService.getRelatedArticles(article.id, language, limit);
    return res.json({ data: { articles: related }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles/:slug/versions
 */
publicKnowledgeBaseRoutes.get(
  '/articles/:slug/versions',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const article = await KnowledgeBaseService.getArticleBySlug(slug, 'en');
    if (!article) return res.status(404).json({ error: 'Article not found', code: 'KB_ARTICLE_NOT_FOUND' });

    const versions = await KnowledgeBaseService.getArticleVersions(article.id);
    return res.json({ data: { versions }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles/:slug/redirect — resolve deprecation/redirect
 */
publicKnowledgeBaseRoutes.get(
  '/articles/:slug/redirect',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const result = await KnowledgeBaseService.resolveArticleRedirect(slug);
    return res.json({ data: result, meta: kbMeta() });
  })
);

// ============================================================
// P26-B: Surface binding (contextual articles for a surface)
// ============================================================

/**
 * GET /api/v8/kb/surface/:surface?lang=&toolContext=&limit=
 */
publicKnowledgeBaseRoutes.get(
  '/surface/:surface',
  asyncHandler(async (req: Request, res: Response) => {
    const surface = firstParam((req.params as any).surface);
    const language = firstParam(req.query.lang) || 'en';
    const toolContext = firstParam(req.query.toolContext);
    const limit = parseBoundedLimit(firstParam(req.query.limit), 10, 50);
    if (!surface) return res.status(400).json({ error: 'surface required' });

    const articles = await KnowledgeBaseService.getArticlesForSurface(surface, language, {
      toolContext: toolContext || undefined,
      limit,
    });
    return res.json({ data: { articles, surface }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/categories?lang=&all=
 * Same semantics as GET /api/kb/categories; returns translated category pills with counts.
 */
router.get(
  '/categories',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const language = firstParam(req.query.lang) || 'en';
    const includePrivate = firstParam(req.query.all) === 'true';
    const categoryPrefix = sitePrefix(firstParam(req.query.site));

    const categories = await KnowledgeBaseService.getCategories(language, includePrivate, categoryPrefix);
    return res.json({ data: { categories }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles?lang=&category=&search=&limit=&offset=&public=&module=
 * Same semantics as GET /api/kb/articles; returns paginated article cards plus total.
 */
router.get(
  '/articles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const language = firstParam(req.query.lang) || 'en';
    const categorySlug = firstParam(req.query.category);
    const search = firstParam(req.query.search);
    const limit = parseBoundedLimit(firstParam(req.query.limit), 20, 100);
    const offset = Math.max(
      0,
      Number.parseInt(String(firstParam(req.query.offset) ?? '0'), 10) || 0
    );
    const publicOnly = firstParam(req.query.public) === 'true';
    const moduleId = firstParam(req.query.module);

    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const result = await KnowledgeBaseService.getArticles({
      language,
      categorySlug,
      search,
      limit,
      offset,
      publicOnly,
      moduleId,
      categoryPrefix,
    });

    return res.json({ data: result, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/search?q=&lang=&limit=
 * Same semantics as GET /api/kb/search; empty q or q.length < 2 → empty list.
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const qStr = firstParam(req.query.q);
    const lang = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 10, 50);

    if (!qStr || qStr.length < 2) {
      return res.json({ data: { articles: [] }, meta: kbMeta() });
    }

    const categoryPrefix = sitePrefix(firstParam(req.query.site));
    const articles = await KnowledgeBaseService.searchArticles(qStr, lang, limit, categoryPrefix);
    return res.json({ data: { articles }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/articles/:slug?lang=
 * Single published article by slug (full content when available from service).
 */
router.get(
  '/articles/:slug',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const slug = firstParam((req.params as { slug?: string }).slug);
    const language = firstParam(req.query.lang) || 'en';
    if (!slug) {
      return res.status(400).json({ error: 'slug is required', code: 'KB_SLUG_REQUIRED' });
    }

    const article = await KnowledgeBaseService.getArticleBySlug(slug, language);
    if (!article) {
      return res.status(404).json({ error: 'Article not found', code: 'KB_ARTICLE_NOT_FOUND' });
    }

    return res.json({ data: { article }, meta: kbMeta() });
  })
);

/**
 * POST /api/v8/kb/articles/:id/view
 * Authenticated article view tracking from the Help Center surface.
 */
router.post(
  '/articles/:id/view',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const articleId = firstParam((req.params as { id?: string }).id);
    const source =
      typeof req.body?.source === 'string' && req.body.source.trim()
        ? req.body.source.trim()
        : 'in_app';
    const sessionId =
      typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
        ? req.body.sessionId.trim()
        : undefined;
    const userId =
      typeof req.userId === 'string' && req.userId.trim() ? req.userId.trim() : undefined;

    if (!articleId) {
      return res.status(400).json({ error: 'id is required', code: 'KB_ARTICLE_ID_REQUIRED' });
    }

    await KnowledgeBaseService.trackView(articleId, userId, sessionId, source);
    return res.json({ data: { success: true }, meta: kbMeta() });
  })
);

/**
 * GET /api/v8/kb/context/:moduleId?lang=&limit=
 * Module-tagged articles (related_modules), same backing as GET /api/kb/context/:moduleId.
 */
router.get(
  '/context/:moduleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const moduleId = firstParam((req.params as { moduleId?: string }).moduleId);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseBoundedLimit(firstParam(req.query.limit), 5, 50);

    if (!moduleId) {
      return res.status(400).json({ error: 'moduleId is required', code: 'KB_MODULE_REQUIRED' });
    }

    const articles = await KnowledgeBaseService.getContextualArticles(moduleId, language, limit);
    return res.json({ data: { articles }, meta: kbMeta() });
  })
);

export default router;
