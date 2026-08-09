/**
 * M04 Living Notebook — Topics HTTP surface.
 *
 * Registered onto the v8 `/notebook` sub-router via {@link registerNotebookTopicsRoutes},
 * so effective paths are:
 *   GET    /api/v8/notebook/topics              — list org topics
 *   POST   /api/v8/notebook/topics              — create topic
 *   GET    /api/v8/notebook/topics/:id          — topic aggregate (notes/outputs/initiatives)
 *   POST   /api/v8/notebook/pages/:id/topics    — pin a page to a topic
 *   DELETE /api/v8/notebook/pages/:id/topics/:topicId — unpin
 *
 * Org-scope + owner auth follows the existing v8/notebook.routes.ts pattern
 * (getV8Context + per-row org/owner checks).
 *
 * Owned by AGENT 1. CTO wires registration centrally (see report).
 */

import type { Response, Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import notebookTopicService from '../../services/notebookTopicService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/** Resolve a page row for org/owner gating before mutating its topic pins. */
async function loadOwnedPage(
  pageId: string,
  organizationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row = await queryHelpers.queryOne<any>(
    `SELECT id, owner_user_id, organization_id
       FROM notebook_pages WHERE id = ? LIMIT 1`,
    [pageId]
  );
  if (!row) return { ok: false, status: 404, error: 'Not found' };
  if (String(row.organization_id ?? '') !== String(organizationId)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  if (String(row.owner_user_id ?? '') !== String(userId)) {
    return { ok: false, status: 403, error: 'Owner-only' };
  }
  return { ok: true };
}

export function registerNotebookTopicsRoutes(router: Router): void {
  // ── List org topics ────────────────────────────────────────────────────────
  router.get(
    '/topics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId } = getV8Context(req);
      const topics = await notebookTopicService.listTopics(organizationId);
      return res.json({ data: topics });
    })
  );

  // ── Create topic (idempotent on slug) ───────────────────────────────────────
  router.post(
    '/topics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId } = getV8Context(req);
      const name = String(req.body?.name ?? '').trim();
      if (!name) {
        return res
          .status(400)
          .json({ error: 'name required', code: 'NOTEBOOK_TOPIC_NAME_REQUIRED' });
      }
      try {
        const topic = await notebookTopicService.createTopic(organizationId, name);
        return res.status(201).json({ data: topic });
      } catch (err: any) {
        return res
          .status(400)
          .json({ error: err?.message || 'Invalid topic', code: 'NOTEBOOK_TOPIC_INVALID' });
      }
    })
  );

  // ── Topic aggregate ─────────────────────────────────────────────────────────
  router.get(
    '/topics/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId } = getV8Context(req);
      const topicId = String(req.params.id || '').trim();
      if (!topicId) {
        return res.status(400).json({ error: 'topic id required' });
      }
      const aggregate = await notebookTopicService.aggregateTopic(organizationId, topicId);
      if (!aggregate) {
        return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_TOPIC_NOT_FOUND' });
      }
      return res.json({ data: aggregate });
    })
  );

  // ── Topics pinned to a page ─────────────────────────────────────────────────
  // #18 — was missing: NotebookTopicChips (rail) and NotebookGraphView (Topics
  // fan) both call this path already; without it they silently degrade to
  // empty/org-wide results. Read-only, no owner gate (any org member viewing
  // the note can see its topic chips, matching the pin/unpin owner-only writes).
  router.get(
    '/pages/:id/topics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      if (!pageId) return res.status(400).json({ error: 'page id required' });

      const topics = await notebookTopicService.listTopicsForPage(organizationId, pageId);
      return res.json({ data: topics });
    })
  );

  // ── Pin a page to a topic ───────────────────────────────────────────────────
  // Body: { topicId?: string, topicName?: string, score?: number, source?: 'ai'|'manual' }
  // If topicName is given (and no topicId), the topic is created/resolved first.
  router.post(
    '/pages/:id/topics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      if (!pageId) return res.status(400).json({ error: 'page id required' });

      const gate = await loadOwnedPage(pageId, organizationId, userId);
      if (gate.ok === false) return res.status(gate.status).json({ error: gate.error });

      let topicId = String(req.body?.topicId ?? '').trim();
      const topicName = String(req.body?.topicName ?? '').trim();

      if (!topicId && topicName) {
        const topic = await notebookTopicService.createTopic(organizationId, topicName);
        topicId = topic.id;
      }
      if (!topicId) {
        return res
          .status(400)
          .json({ error: 'topicId or topicName required', code: 'NOTEBOOK_TOPIC_REF_REQUIRED' });
      }

      // Verify the topic exists within this org before pinning.
      const topic = await notebookTopicService.getTopicById(organizationId, topicId);
      if (!topic) {
        return res.status(404).json({ error: 'Topic not found', code: 'NOTEBOOK_TOPIC_NOT_FOUND' });
      }

      const score = Number.isFinite(Number(req.body?.score)) ? Number(req.body?.score) : 0;
      const source = String(req.body?.source ?? 'manual').toLowerCase() === 'ai' ? 'ai' : 'manual';

      const link = await notebookTopicService.pinPageToTopic({
        pageId,
        topicId,
        score,
        source,
      });
      return res.status(201).json({ data: { ...link, topic } });
    })
  );

  // ── Unpin a page from a topic ───────────────────────────────────────────────
  router.delete(
    '/pages/:id/topics/:topicId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      const topicId = String(req.params.topicId || '').trim();
      if (!pageId || !topicId) {
        return res.status(400).json({ error: 'page id and topic id required' });
      }

      const gate = await loadOwnedPage(pageId, organizationId, userId);
      if (gate.ok === false) return res.status(gate.status).json({ error: gate.error });

      await notebookTopicService.unpinPageFromTopic(pageId, topicId);
      return res.json({ data: { pageId, topicId, unpinned: true } });
    })
  );
}

export default registerNotebookTopicsRoutes;
