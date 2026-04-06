/**
 * Public API v1 (PO1)
 *
 * Auth: API keys (user-owned or org-owned), via `apiKeyAuth`.
 * Base path: /api/public/v1
 *
 * Initial scope:
 * - Tasks (subset of /api/tasks)
 * - Calendar (subset of /api/v8/calendar)
 */

import type { Response } from 'express';
import { Router } from 'express';

import TaskControllerRaw from '../controllers/TaskController.js';
import { apiKeyAuth, requireApiKeyPermission } from '../middleware/apiKeyAuth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import * as calendarInteropService from '../services/v8/calendarInteropService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const TaskController = TaskControllerRaw as any;

function requireApiKeyActor(req: any, res: Response): { userId: string; organizationId: string } | null {
  const userId = String(req.userId || '').trim();
  const organizationId = String(req.organizationId || '').trim();
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized', code: 'API_KEY_ORG_REQUIRED' });
    return null;
  }
  if (!userId) {
    // For PO1 baseline we require a user actor so audit and ownership remain consistent.
    res.status(403).json({
      error: 'API key requires a user actor',
      code: 'API_KEY_ACTOR_REQUIRED',
      message: 'Use a user API key for this endpoint.',
    });
    return null;
  }
  return { userId, organizationId };
}

function attachUserContext(req: any): void {
  // Many controllers expect `req.user` with id + organizationId.
  // We keep the shape minimal and let downstream enforce RBAC where applicable.
  req.user = { id: req.userId, organizationId: req.organizationId };
  req.organizationId = req.organizationId;
}

router.use(apiKeyAuth);
router.use((req, _res, next) => {
  attachUserContext(req);
  next();
});

// ---------------------------------------------------------------------------
// Tasks (subset)
// ---------------------------------------------------------------------------

router.get('/tasks', requireApiKeyPermission('read:tasks'), TaskController.getTasks);
router.post('/tasks', requireApiKeyPermission('write:tasks'), TaskController.createTask);
router.get('/tasks/:id', requireApiKeyPermission('read:tasks'), TaskController.getTaskById);
router.put('/tasks/:id', requireApiKeyPermission('write:tasks'), TaskController.updateTask);
router.delete('/tasks/:id', requireApiKeyPermission('write:tasks'), TaskController.deleteTask);

// ---------------------------------------------------------------------------
// Calendar (subset, user-scoped)
// ---------------------------------------------------------------------------

router.get(
  '/calendar/sources',
  requireApiKeyPermission('read:calendar'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = requireApiKeyActor(req as any, res);
    if (!actor) return;
    const sources = await calendarInteropService.getCalendarSources(actor.organizationId, actor.userId);
    res.json({ data: sources, meta: { version: 'public-v1', contract: 'po1_calendar_sources_v1' } });
  })
);

router.post(
  '/calendar/sources',
  requireApiKeyPermission('write:calendar'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = requireApiKeyActor(req as any, res);
    if (!actor) return;

    const body: any = req.body ?? {};
    const { provider, accountRef, selectedCalendars, declaredMode, permissionGradient } = body;

    if (!provider || !accountRef || !declaredMode) {
      res.status(400).json({
        error: 'provider, accountRef, and declaredMode are required',
        code: 'PO1_CALENDAR_SOURCE_PARAMS_REQUIRED',
      });
      return;
    }

    const source = await calendarInteropService.createCalendarSource({
      organizationId: actor.organizationId,
      userId: actor.userId,
      provider,
      accountRef: String(accountRef),
      selectedCalendars: Array.isArray(selectedCalendars) ? selectedCalendars.map(String) : [],
      declaredMode,
      permissionGradient,
    });

    res.status(201).json({ data: source, meta: { version: 'public-v1', contract: 'po1_calendar_sources_v1' } });
  })
);

router.get(
  '/calendar/items',
  requireApiKeyPermission('read:calendar'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = requireApiKeyActor(req as any, res);
    if (!actor) return;

    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId.trim() : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 250) : 50;

    if (!sourceId) {
      res.status(400).json({ error: 'sourceId is required', code: 'PO1_CALENDAR_SOURCE_ID_REQUIRED' });
      return;
    }

    const items = await calendarInteropService.getCalendarItems(actor.organizationId, {
      sourceId,
    });

    res.json({
      data: items.slice(0, limit),
      meta: { version: 'public-v1', contract: 'po1_calendar_items_v1' },
    });
  })
);

export default router;

