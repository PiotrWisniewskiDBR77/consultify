/**
 * Knowledge Base Routes
 * Public API endpoints for Knowledge Base articles, categories and search
 *
 * @module routes/knowledgeBase.routes
 */

import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import KnowledgeBaseService from '../services/KnowledgeBaseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

/**
 * GET /api/kb/categories
 * Get all active categories with article counts
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const language = (req.query.lang as string) || 'en';
    const includePrivate = req.query.all === 'true';

    const categories = await KnowledgeBaseService.getCategories(language, includePrivate);
    res.json({ categories });
  })
);

/**
 * GET /api/kb/articles
 * Get paginated articles with optional filters
 */
router.get(
  '/articles',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      lang = 'en',
      category,
      search,
      limit = '20',
      offset = '0',
      public: publicOnly = 'false',
      module: moduleId,
    } = req.query;

    const result = await KnowledgeBaseService.getArticles({
      language: lang as string,
      categorySlug: category as string,
      search: search as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      publicOnly: publicOnly === 'true',
      moduleId: moduleId as string,
    });

    res.json(result);
  })
);

/**
 * GET /api/kb/articles/:slug
 * Get single article by slug with full content
 */
router.get(
  '/articles/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = firstParam((req.params as any).slug);
    const language = firstParam(req.query.lang) || 'en';
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const article = await KnowledgeBaseService.getArticleBySlug(slug, language);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article });
  })
);

/**
 * GET /api/kb/public
 * Get public articles for landing page preview
 */
router.get(
  '/public',
  asyncHandler(async (req: Request, res: Response) => {
    const language = (req.query.lang as string) || 'en';
    const limit = parseInt((req.query.limit as string) || '3', 10);

    const articles = await KnowledgeBaseService.getPublicPreview(language, limit);
    res.json({ articles });
  })
);

/**
 * GET /api/kb/featured
 * Get featured articles
 */
router.get(
  '/featured',
  asyncHandler(async (req: Request, res: Response) => {
    const language = (req.query.lang as string) || 'en';
    const limit = parseInt((req.query.limit as string) || '4', 10);

    const articles = await KnowledgeBaseService.getFeaturedArticles(language, limit);
    res.json({ articles });
  })
);

/**
 * GET /api/kb/search
 * Full-text search across articles
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { q, lang = 'en', limit = '10' } = req.query;

    const qStr = firstParam(q);
    if (!qStr || qStr.length < 2) {
      return res.json({ articles: [] });
    }

    const articles = await KnowledgeBaseService.searchArticles(
      qStr,
      firstParam(lang) || 'en',
      parseInt(firstParam(limit) || '10', 10)
    );

    res.json({ articles });
  })
);

/**
 * POST /api/kb/articles/:id/view
 * Track article view (anonymous allowed)
 */
router.post(
  '/articles/:id/view',
  asyncHandler(async (req: Request, res: Response) => {
    const id = firstParam((req.params as any).id);
    const { sessionId, source = 'in_app' } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    // Try to get user ID from token if present
    // NOTE: We intentionally don't decode JWT here. Anonymous tracking is allowed and
    // the middleware JWT helpers are not exposed as a standalone verifier.
    const userId: string | undefined = undefined;

    await KnowledgeBaseService.trackView(id, userId, sessionId, source);
    res.json({ success: true });
  })
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * GET /api/kb/context/:moduleId
 * Get contextual articles for a specific module (for help panel)
 */
router.get(
  '/context/:moduleId',
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const moduleId = firstParam((req.params as any).moduleId);
    const language = firstParam(req.query.lang) || 'en';
    const limit = parseInt(firstParam(req.query.limit) || '5', 10);
    if (!moduleId) {
      return res.status(400).json({ error: 'moduleId is required' });
    }

    const articles = await KnowledgeBaseService.getContextualArticles(moduleId, language, limit);
    res.json({ articles });
  })
);

export default router;
