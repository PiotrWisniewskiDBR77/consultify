/**
 * Knowledge Base Routes
 * Public API endpoints for Knowledge Base articles, categories and search
 * 
 * @module routes/knowledgeBase.routes
 */

import { Request, Response, Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';
import KnowledgeBaseService from '../services/KnowledgeBaseService.js';
import logger from '../utils/Logger.js';

const router = Router();

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
            module: moduleId
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
        const { slug } = req.params;
        const language = (req.query.lang as string) || 'en';

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

        if (!q || (q as string).length < 2) {
            return res.json({ articles: [] });
        }

        const articles = await KnowledgeBaseService.searchArticles(
            q as string,
            lang as string,
            parseInt(limit as string, 10)
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
        const { id } = req.params;
        const { sessionId, source = 'in_app' } = req.body;

        // Try to get user ID from token if present
        let userId: string | undefined;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                // Token might be present but we don't require it
                const decoded = await import('../utils/jwt.js').then(m => m.verifyToken(authHeader.split(' ')[1]));
                userId = (decoded as any)?.userId;
            }
        } catch {
            // Ignore auth errors for anonymous tracking
        }

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
        const { moduleId } = req.params;
        const language = (req.query.lang as string) || 'en';
        const limit = parseInt((req.query.limit as string) || '5', 10);

        const articles = await KnowledgeBaseService.getContextualArticles(moduleId, language, limit);
        res.json({ articles });
    })
);

export default router;
