/**
 * V8 read-only Knowledge Base bridge — delegates to KnowledgeBaseService.
 * Namespace: /api/v8/kb (mounted by v8/index).
 *
 * @module routes/v8/knowledge-base.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import KnowledgeBaseService from '../../services/KnowledgeBaseService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

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
  }),
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
  }),
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
  }),
);

export default router;
