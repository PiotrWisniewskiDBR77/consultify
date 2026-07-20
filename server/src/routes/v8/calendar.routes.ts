/**
 * P02-B: Calendar interoperability routes
 * Namespace: /api/v8/calendar
 *
 * @module routes/v8/calendar.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  P02_ACCEPTANCE_CHECKLIST,
  P02_DECLARED_PROVIDERS,
  P02_ERROR_POSTURE,
  P02_LIFECYCLE_STATES,
  P02_LIFECYCLE_TRANSITIONS,
  P02_PERMISSION_GRADIENTS,
} from '../../services/v8/calendarInteropCanon.js';
import type {
  ConflictInfo,
  SourceLifecycleState,
} from '../../services/v8/calendarInteropService.js';
import * as calendarInteropService from '../../services/v8/calendarInteropService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

export const P02_CALENDAR_HTTP_STATUSES = {
  200: 'OK — resource returned',
  201: 'Created — source/item created',
  204: 'Deleted — source removed',
  400: 'Bad request — invalid payload',
  404: 'Not found — source/item does not exist',
  409: 'Conflict — etag mismatch or sync conflict',
  412: 'Precondition failed — If-Match etag mismatch',
  422: 'Unprocessable — lifecycle transition not allowed',
  503: 'Service unavailable — provider unreachable',
} as const;

function calendarMeta() {
  return { version: 'v8' as const, contract: 'p02_calendar_interop_v1' };
}

function readIfMatch(req: AuthRequest): string | undefined {
  const raw = req.get('If-Match')?.trim();
  if (!raw) return undefined;
  if (raw === '*') return raw;
  return raw.replace(/^W\//i, '').replace(/^"|"$/g, '').trim() || undefined;
}

function isConflictInfo(value: unknown): value is ConflictInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    'providedEtag' in value &&
    'currentEtag' in value &&
    'itemId' in value
  );
}

const P02_LIFECYCLE_SET = new Set<string>(P02_LIFECYCLE_STATES as unknown as string[]);

function isAllowedLifecycleTransition(current: string, next: string): boolean {
  const allowed = P02_LIFECYCLE_TRANSITIONS[current];
  return Array.isArray(allowed) && allowed.includes(next);
}

function mapErrorToHttp(err: unknown, res: Response): boolean {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    const { code, message } = err as { code: string; message?: string };
    const payload = { error: String(message || code), code };
    switch (code) {
      case 'P02_BAD_REQUEST':
        res.status(400).json(payload);
        return true;
      case 'P02_NOT_FOUND':
        res.status(404).json(payload);
        return true;
      case 'P02_CONFLICT':
        res.status(409).json(payload);
        return true;
      case 'P02_PRECONDITION_FAILED':
        res.status(412).json(payload);
        return true;
      case 'P02_LIFECYCLE_INVALID':
      case 'P02_UNPROCESSABLE':
        res.status(422).json(payload);
        return true;
      case 'P02_SERVICE_UNAVAILABLE':
      case 'P02_PROVIDER_UNAVAILABLE':
        res.status(503).json(payload);
        return true;
      default:
        break;
    }
  }

  if (err instanceof Error) {
    const msg = err.message;
    if (/not found/i.test(msg)) {
      res.status(404).json({ error: 'Resource not found', code: 'P02_NOT_FOUND' });
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Source management
// ---------------------------------------------------------------------------

router.post(
  '/sources',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    const { provider, accountRef, selectedCalendars, declaredMode, permissionGradient } = body;

    if (!provider || !accountRef || !declaredMode) {
      return res.status(400).json({
        error: 'provider, accountRef, and declaredMode are required',
        code: 'P02_SOURCE_PARAMS_REQUIRED',
      });
    }

    if (!calendarInteropService.CalendarProviderValues.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider', code: 'P02_INVALID_PROVIDER' });
    }
    if (!calendarInteropService.DeclaredModeValues.includes(declaredMode)) {
      return res
        .status(400)
        .json({ error: 'Invalid declaredMode', code: 'P02_INVALID_DECLARED_MODE' });
    }
    if (
      permissionGradient != null &&
      !calendarInteropService.PermissionGradientValues.includes(permissionGradient)
    ) {
      return res.status(400).json({
        error: 'Invalid permissionGradient',
        code: 'P02_INVALID_PERMISSION_GRADIENT',
      });
    }

    try {
      const source = await calendarInteropService.createCalendarSource({
        organizationId,
        userId,
        provider,
        accountRef: String(accountRef),
        selectedCalendars: Array.isArray(selectedCalendars) ? selectedCalendars.map(String) : [],
        declaredMode,
        permissionGradient,
      });
      return res.status(201).json({ data: source, meta: calendarMeta() });
    } catch (e) {
      if (mapErrorToHttp(e, res)) return;
      throw e;
    }
  })
);

router.get(
  '/sources',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId =
      typeof req.query.userId === 'string' && req.query.userId.trim()
        ? req.query.userId.trim()
        : undefined;
    const sources = await calendarInteropService.getCalendarSources(organizationId, userId);
    return res.json({ data: sources, meta: calendarMeta() });
  })
);

router.get(
  '/sources/:sourceId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }
    const source = await calendarInteropService.getCalendarSource(sourceId, organizationId);
    if (!source) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }
    return res.json({ data: source, meta: calendarMeta() });
  })
);

router.put(
  '/sources/:sourceId/lifecycle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }

    const { state, reason } = req.body ?? {};
    if (!state || typeof state !== 'string') {
      return res
        .status(400)
        .json({ error: 'state is required', code: 'P02_LIFECYCLE_STATE_REQUIRED' });
    }

    if (!P02_LIFECYCLE_SET.has(state)) {
      return res
        .status(400)
        .json({ error: 'Invalid lifecycle state', code: 'P02_INVALID_LIFECYCLE_STATE' });
    }

    const existing = await calendarInteropService.getCalendarSource(sourceId, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }

    if (!isAllowedLifecycleTransition(existing.lifecycleState, state)) {
      return res.status(422).json({
        error: `Transition from ${existing.lifecycleState} to ${state} is not allowed`,
        code: 'P02_LIFECYCLE_INVALID',
      });
    }

    const updated = await calendarInteropService.updateSourceLifecycle(
      sourceId,
      organizationId,
      state as SourceLifecycleState,
      reason != null ? String(reason) : undefined
    );
    if (!updated) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }
    return res.json({ data: updated, meta: calendarMeta() });
  })
);

router.delete(
  '/sources/:sourceId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }
    const deleted = await calendarInteropService.deleteCalendarSource(sourceId, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }
    return res.status(204).send();
  })
);

// ---------------------------------------------------------------------------
// Item management
// ---------------------------------------------------------------------------

router.get(
  '/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const q = req.query;
    const filters: calendarInteropService.CalendarItemFilters = {};

    if (typeof q.sourceId === 'string' && q.sourceId.trim()) filters.sourceId = q.sourceId.trim();
    if (typeof q.startAt === 'string' && q.startAt.trim()) filters.startAt = q.startAt.trim();
    if (typeof q.endAt === 'string' && q.endAt.trim()) filters.endAt = q.endAt.trim();
    if (typeof q.itemType === 'string' && q.itemType.trim()) {
      if (!calendarInteropService.ItemTypeValues.includes(q.itemType as any)) {
        return res.status(400).json({ error: 'Invalid itemType', code: 'P02_INVALID_ITEM_TYPE' });
      }
      filters.itemType = q.itemType as calendarInteropService.ItemType;
    }
    if (typeof q.syncState === 'string' && q.syncState.trim()) {
      if (!calendarInteropService.SyncStateValues.includes(q.syncState as any)) {
        return res.status(400).json({ error: 'Invalid syncState', code: 'P02_INVALID_SYNC_STATE' });
      }
      filters.syncState = q.syncState as calendarInteropService.SyncState;
    }

    const items = await calendarInteropService.getCalendarItems(organizationId, filters);
    return res.json({ data: items, meta: calendarMeta() });
  })
);

router.get(
  '/items/:itemId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const itemId = req.params.itemId?.trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId required', code: 'P02_ITEM_ID_REQUIRED' });
    }
    const item = await calendarInteropService.getCalendarItem(itemId, organizationId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found', code: 'P02_ITEM_NOT_FOUND' });
    }
    return res.json({ data: item, meta: calendarMeta() });
  })
);

router.post(
  '/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const {
      sourceId,
      itemType,
      sourceSystem,
      sourceObjectRef,
      title,
      startAt,
      endAt,
      allDay,
      timezone,
      visibilityClass,
      editAuthority,
      recurrenceModel,
    } = body;

    if (
      !itemType ||
      !sourceSystem ||
      sourceObjectRef == null ||
      startAt == null ||
      allDay === undefined ||
      !visibilityClass ||
      !editAuthority
    ) {
      return res.status(400).json({
        error:
          'itemType, sourceSystem, sourceObjectRef, startAt, allDay, visibilityClass, and editAuthority are required',
        code: 'P02_ITEM_PARAMS_REQUIRED',
      });
    }

    if (!calendarInteropService.ItemTypeValues.includes(itemType)) {
      return res.status(400).json({ error: 'Invalid itemType', code: 'P02_INVALID_ITEM_TYPE' });
    }
    if (!calendarInteropService.SourceSystemValues.includes(sourceSystem)) {
      return res
        .status(400)
        .json({ error: 'Invalid sourceSystem', code: 'P02_INVALID_SOURCE_SYSTEM' });
    }
    if (!calendarInteropService.VisibilityClassValues.includes(visibilityClass)) {
      return res.status(400).json({
        error: 'Invalid visibilityClass',
        code: 'P02_INVALID_VISIBILITY_CLASS',
      });
    }
    if (!calendarInteropService.EditAuthorityValues.includes(editAuthority)) {
      return res.status(400).json({
        error: 'Invalid editAuthority',
        code: 'P02_INVALID_EDIT_AUTHORITY',
      });
    }

    try {
      const item = await calendarInteropService.createCalendarItem({
        organizationId,
        sourceId: sourceId != null ? String(sourceId) : null,
        itemType,
        sourceSystem,
        sourceObjectRef: String(sourceObjectRef),
        title: title != null ? String(title) : null,
        startAt: String(startAt),
        endAt: endAt != null ? String(endAt) : null,
        allDay: Boolean(allDay),
        timezone: timezone != null ? String(timezone) : null,
        visibilityClass,
        editAuthority,
        recurrenceModel: recurrenceModel ?? null,
      });
      return res.status(201).json({ data: item, meta: calendarMeta() });
    } catch (e) {
      if (mapErrorToHttp(e, res)) return;
      throw e;
    }
  })
);

router.put(
  '/items/:itemId/conflict',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const itemId = req.params.itemId?.trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId required', code: 'P02_ITEM_ID_REQUIRED' });
    }

    const resolution = req.body?.resolution;
    if (!['accept_local', 'accept_remote', 'merge'].includes(resolution)) {
      return res.status(400).json({
        error: 'resolution must be accept_local, accept_remote, or merge',
        code: 'P02_CONFLICT_RESOLUTION_REQUIRED',
      });
    }

    const item = await calendarInteropService.resolveConflict(
      itemId,
      organizationId,
      resolution as 'accept_local' | 'accept_remote' | 'merge'
    );
    if (!item) {
      return res.status(404).json({ error: 'Item not found', code: 'P02_ITEM_NOT_FOUND' });
    }
    return res.json({ data: item, meta: calendarMeta() });
  })
);

router.put(
  '/items/:itemId/write',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const itemId = req.params.itemId?.trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId required', code: 'P02_ITEM_ID_REQUIRED' });
    }

    const etag = readIfMatch(req);
    if (!etag || etag === '*') {
      return res.status(400).json({
        error: 'If-Match header with a concrete etag is required',
        code: 'P02_IF_MATCH_REQUIRED',
      });
    }

    const updates = (req.body?.updates ?? req.body) as calendarInteropService.CalendarItemUpdates;
    if (!updates || typeof updates !== 'object') {
      return res
        .status(400)
        .json({ error: 'updates object is required', code: 'P02_UPDATES_REQUIRED' });
    }

    try {
      const result = await calendarInteropService.conditionalWriteItem(
        itemId,
        organizationId,
        updates,
        etag
      );
      if (isConflictInfo(result)) {
        return res.status(409).json({
          error: 'Conditional write failed — etag mismatch',
          code: 'P02_CONFLICT',
          data: result,
          meta: calendarMeta(),
        });
      }
      return res.json({ data: result, meta: calendarMeta() });
    } catch (e) {
      if (mapErrorToHttp(e, res)) return;
      throw e;
    }
  })
);

router.put(
  '/items/:itemId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const itemId = req.params.itemId?.trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId required', code: 'P02_ITEM_ID_REQUIRED' });
    }

    const updates = req.body?.updates ?? req.body;
    if (!updates || typeof updates !== 'object') {
      return res
        .status(400)
        .json({ error: 'updates object is required', code: 'P02_UPDATES_REQUIRED' });
    }

    const ifMatch = readIfMatch(req);
    const item = await calendarInteropService.updateCalendarItem(
      itemId,
      organizationId,
      updates as calendarInteropService.CalendarItemUpdates,
      ifMatch
    );

    if (!item) {
      const existing = await calendarInteropService.getCalendarItem(itemId, organizationId);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found', code: 'P02_ITEM_NOT_FOUND' });
      }
      if (ifMatch) {
        return res.status(412).json({
          error: 'If-Match etag mismatch',
          code: 'P02_PRECONDITION_FAILED',
        });
      }
      return res.status(404).json({ error: 'Item not found', code: 'P02_ITEM_NOT_FOUND' });
    }

    return res.json({ data: item, meta: calendarMeta() });
  })
);

// ---------------------------------------------------------------------------
// Sync operations
// ---------------------------------------------------------------------------

router.post(
  '/sources/:sourceId/sync/incremental',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }
    try {
      const result = await calendarInteropService.performIncrementalSync(sourceId, organizationId);
      return res.json({ data: result, meta: calendarMeta() });
    } catch (e) {
      if (mapErrorToHttp(e, res)) return;
      throw e;
    }
  })
);

router.post(
  '/sources/:sourceId/sync/full',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }
    try {
      const result = await calendarInteropService.performFullResync(sourceId, organizationId);
      return res.json({ data: result, meta: calendarMeta() });
    } catch (e) {
      if (mapErrorToHttp(e, res)) return;
      throw e;
    }
  })
);

router.post(
  '/sources/:sourceId/sync/error',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sourceId = req.params.sourceId?.trim();
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId required', code: 'P02_SOURCE_ID_REQUIRED' });
    }

    const errorType = req.body?.errorType;
    if (errorType == null || String(errorType).trim() === '') {
      return res
        .status(400)
        .json({ error: 'errorType is required', code: 'P02_ERROR_TYPE_REQUIRED' });
    }

    const existingSource = await calendarInteropService.getCalendarSource(sourceId, organizationId);
    if (!existingSource) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }

    const updated = await calendarInteropService.handleSyncError(
      sourceId,
      organizationId,
      String(errorType)
    );
    if (!updated) {
      return res.status(404).json({ error: 'Source not found', code: 'P02_SOURCE_NOT_FOUND' });
    }

    return res.json({ data: updated, meta: calendarMeta() });
  })
);

// ---------------------------------------------------------------------------
// Health + contract
// ---------------------------------------------------------------------------

router.get(
  '/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const summary = await calendarInteropService.getSourceHealth(organizationId);
    return res.json({ data: summary, meta: calendarMeta() });
  })
);

router.get(
  '/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        acceptanceChecklist: P02_ACCEPTANCE_CHECKLIST,
        errorPosture: P02_ERROR_POSTURE,
        declaredProviders: P02_DECLARED_PROVIDERS,
        permissionGradients: P02_PERMISSION_GRADIENTS,
        lifecycleStates: P02_LIFECYCLE_STATES,
      },
      meta: calendarMeta(),
    });
  })
);

export default router;
