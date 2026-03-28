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

/**
 * GET /api/v8/kb/categories?lang=&all=
 * Anonymous-safe category listing for public docs and landing surfaces.
 */
publicKnowledgeBaseRoutes.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const language = firstParam(req.query.lang) || 'en';
    const categories = await KnowledgeBaseService.getCategories(language, false);
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
    const articles = await KnowledgeBaseService.getPublicPreview(language, limit);
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
    const articles = await KnowledgeBaseService.getFeaturedArticles(language, limit);
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

    const result = await KnowledgeBaseService.getArticles({
      language,
      categorySlug,
      search,
      limit,
      offset,
      publicOnly: true,
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

    const articles = await KnowledgeBaseService.searchArticles(qStr, lang, limit);
    const publicArticles = articles.filter(
      (article: { is_public?: boolean }) => article.is_public !== false
    );
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

    const categories = await KnowledgeBaseService.getCategories(language, includePrivate);
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

    const result = await KnowledgeBaseService.getArticles({
      language,
      categorySlug,
      search,
      limit,
      offset,
      publicOnly,
      moduleId,
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

    const articles = await KnowledgeBaseService.searchArticles(qStr, lang, limit);
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
