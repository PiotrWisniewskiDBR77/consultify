/**
 * insightSourceBaskets.routes — CRUD for reusable "Source Baskets" consumed by
 * the AI Insight Creator (InsightCreatorModal).
 *
 * Why this exists (audit #28c/#28d — _IV_TEST_NOTES.md #28):
 * The owner wants to build a source-session selection once and reuse it across
 * many insights/lenses ("z jednych źródeł różne insighty pod różnym kątem")
 * instead of re-picking the same sessions in the wizard every time. This router
 * exposes the persistence for those baskets, org-scoped, behind the same auth
 * stack the other interview routes use.
 *
 * Mounted at /api/interview (see Gateway.ts), so the effective paths are:
 *   GET    /api/interview/insight-baskets          — list (newest first)
 *   POST   /api/interview/insight-baskets          — create
 *   GET    /api/interview/insight-baskets/:id       — read one
 *   PATCH  /api/interview/insight-baskets/:id        — update
 *   DELETE /api/interview/insight-baskets/:id        — delete
 *   POST   /api/interview/insight-baskets/:id/touch  — bump usage_count + last_used_at
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import {
  createBasket,
  deleteBasket,
  getBasket,
  listBaskets,
  touchBasket,
  updateBasket,
} from '../services/insightSourceBasketService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Same middleware stack the other interview routes use (interview.routes.ts).
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ---------------------------------------------------------------------------
// Auth context — mirror discovery.routes.ts so we read org/user the same way.
// ---------------------------------------------------------------------------
function authContext(req: AuthRequest): { organizationId: string; userId: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user || {};
  return {
    organizationId: String(req.organizationId || user.organizationId || user.organization_id || ''),
    userId: String(req.userId || user.id || user.userId || ''),
  };
}

// ---------------------------------------------------------------------------
// GET /insight-baskets — list for org (newest first)
// ---------------------------------------------------------------------------
router.get('/insight-baskets', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const baskets = await listBaskets(organizationId);
    return res.json({ baskets });
  } catch (error) {
    logger.error('[insightSourceBaskets] list failed', { error });
    return res.status(500).json({ error: 'Failed to list source baskets' });
  }
});

// ---------------------------------------------------------------------------
// POST /insight-baskets — create
// ---------------------------------------------------------------------------
router.post('/insight-baskets', async (req: AuthRequest, res) => {
  const { organizationId, userId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;

  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Basket name is required' });
  if (!Array.isArray(body.sessionIds) || body.sessionIds.length === 0) {
    return res.status(400).json({ error: 'At least one session id is required' });
  }

  try {
    const basket = await createBasket(organizationId, userId, {
      name,
      sessionIds: body.sessionIds,
      projectId: body.projectId ?? null,
      description: body.description ?? null,
      peopleFilter: body.peopleFilter ?? undefined,
      filterCriteria: body.filterCriteria ?? undefined,
    });
    return res.status(201).json({ basket });
  } catch (error) {
    logger.error('[insightSourceBaskets] create failed', { error });
    return res.status(500).json({ error: 'Failed to create source basket' });
  }
});

// ---------------------------------------------------------------------------
// GET /insight-baskets/:id — read one
// ---------------------------------------------------------------------------
router.get('/insight-baskets/:id', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const basket = await getBasket(organizationId, req.params.id);
    if (!basket) return res.status(404).json({ error: 'Source basket not found' });
    return res.json({ basket });
  } catch (error) {
    logger.error('[insightSourceBaskets] read failed', { error });
    return res.status(500).json({ error: 'Failed to read source basket' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /insight-baskets/:id — update
// ---------------------------------------------------------------------------
router.patch('/insight-baskets/:id', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;

  if (
    body.sessionIds !== undefined &&
    (!Array.isArray(body.sessionIds) || body.sessionIds.length === 0)
  ) {
    return res.status(400).json({ error: 'sessionIds must be a non-empty array when provided' });
  }

  try {
    const basket = await updateBasket(organizationId, req.params.id, {
      name: body.name,
      sessionIds: body.sessionIds,
      projectId: body.projectId,
      description: body.description,
      peopleFilter: body.peopleFilter,
      filterCriteria: body.filterCriteria,
    });
    if (!basket) return res.status(404).json({ error: 'Source basket not found' });
    return res.json({ basket });
  } catch (error) {
    logger.error('[insightSourceBaskets] update failed', { error });
    return res.status(500).json({ error: 'Failed to update source basket' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /insight-baskets/:id — delete
// ---------------------------------------------------------------------------
router.delete('/insight-baskets/:id', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const deleted = await deleteBasket(organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Source basket not found' });
    return res.json({ success: true });
  } catch (error) {
    logger.error('[insightSourceBaskets] delete failed', { error });
    return res.status(500).json({ error: 'Failed to delete source basket' });
  }
});

// ---------------------------------------------------------------------------
// POST /insight-baskets/:id/touch — bump usage_count + last_used_at
// ---------------------------------------------------------------------------
router.post('/insight-baskets/:id/touch', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const basket = await touchBasket(organizationId, req.params.id);
    if (!basket) return res.status(404).json({ error: 'Source basket not found' });
    return res.json({ basket });
  } catch (error) {
    logger.error('[insightSourceBaskets] touch failed', { error });
    return res.status(500).json({ error: 'Failed to touch source basket' });
  }
});

export default router;
