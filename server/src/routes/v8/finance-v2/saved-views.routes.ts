/**
 * Finance v3 canonical adapter — Saved views surface,
 * `/api/v8/finance-v2/saved-views/*`.
 *
 * `savedViewService.ts` (AP-07, ~591 lines, real migrated `finance_saved_views`
 * table: PERSONAL/TEAM scope, structured+typed filters, shareable token,
 * KPI-deprecation column-availability check) had ZERO HTTP routes and ZERO
 * callers. This router is a thin wiring pass — every visibility rule
 * (PERSONAL = owner-only, TEAM = whole org, owner-only edit/delete
 * regardless of scope, the share-token boundary) is enforced INSIDE the
 * service, not re-implemented here.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getArtifact } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  createSavedView,
  deleteSavedView,
  FinanceSavedViewScopeValues,
  getSavedView,
  listSavedViews,
  resolveSharedView,
  updateSavedView,
  type FinanceSavedViewRow,
  type LoadedSavedView,
} from '../../../services/finance/canonical/savedViewService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

// ---------------------------------------------------------------------------
// Row -> DTO mapping (camelCase, internal columns dropped) — same local
// `toDto`-style convention `crosscutting.routes.ts` and `comments.routes.ts`
// already use in this package. `organization_id` is deliberately dropped:
// every query here is already `WHERE organization_id = ?`, so it is always
// the caller's own org and carries no information the client doesn't
// already have. `columnAvailability` is only present on `LoadedSavedView`
// (get/list/shared reads, which run `resolveColumnAvailability`) — create
// and update deliberately return the plain, unloaded row today (same
// behavior as before this change), so the DTO includes the field only when
// the input row actually has it.
// ---------------------------------------------------------------------------

function toSavedViewDto(row: FinanceSavedViewRow | LoadedSavedView) {
  const dto: Record<string, unknown> = {
    id: row.id,
    artifactId: row.artifact_id,
    artifactType: row.artifact_type,
    scope: row.scope,
    ownerUserId: row.owner_user_id,
    name: row.name,
    viewState: row.view_state,
    shareToken: row.share_token,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if ('columnAvailability' in row) {
    dto.columnAvailability = row.columnAvailability;
  }
  return dto;
}

function httpStatusForSavedViewError(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
    case 'ARTIFACT_NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    default:
      return 400; // NAME_REQUIRED, INVALID_FILTERS, INVALID_GRID_VIEW_STATE
  }
}

// ---------------------------------------------------------------------------
// POST /saved-views — create (PERSONAL or TEAM)
// ---------------------------------------------------------------------------

router.post(
  '/saved-views',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.artifactId !== 'string' || !body.artifactId) {
      return sendError(res, 400, 'INVALID_BODY', 'artifactId is required');
    }

    // Gate E FIX-B (proof-gaps pass, 2026-08-12) — LUKA 3: ownership checked BEFORE the remaining
    // body-shape checks below (scope enum, gridViewState typeof), mirroring the same reordering
    // `createSavedView()` now does internally (name/filters/gridViewState-content checks). A
    // cross-tenant artifactId must ALWAYS surface as the uniform ARTIFACT_NOT_FOUND 404, never as
    // an INVALID_BODY 400 that happens to depend on what else was wrong with the rest of the body.
    const artifact = await getArtifact(organizationId, body.artifactId);
    if (!artifact) {
      return sendError(res, 404, 'ARTIFACT_NOT_FOUND', `No finance_artifacts row for artifact_id='${body.artifactId}' in this organization`);
    }

    if (!(FinanceSavedViewScopeValues as readonly string[]).includes(body.scope)) {
      return sendError(res, 400, 'INVALID_BODY', `scope must be one of ${FinanceSavedViewScopeValues.join(', ')}`);
    }
    if (typeof body.gridViewState !== 'object' || body.gridViewState === null) {
      return sendError(res, 400, 'INVALID_BODY', 'gridViewState is required');
    }

    const result = await createSavedView({
      organizationId,
      artifactId: body.artifactId,
      scope: body.scope,
      ownerUserId: userId,
      name: typeof body.name === 'string' ? body.name : '',
      gridViewState: body.gridViewState,
      filters: Array.isArray(body.filters) ? body.filters : undefined,
      createdBy: userId,
    });
    if (!result.ok) {
      return sendError(res, httpStatusForSavedViewError(result.code), result.code, result.message);
    }
    return res.status(201).json({ data: toSavedViewDto(result.view), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// GET /saved-views?artifactId= — TEAM views on the artifact + requester's own PERSONAL views
// ---------------------------------------------------------------------------

router.get(
  '/saved-views',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const artifactId = typeof req.query.artifactId === 'string' ? req.query.artifactId : undefined;
    if (!artifactId) {
      return sendError(res, 400, 'INVALID_QUERY', 'artifactId is required');
    }
    const views = await listSavedViews({ organizationId, artifactId, requesterUserId: userId });
    return res.status(200).json({ data: views.map(toSavedViewDto), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// GET /saved-views/shared/:shareToken — resolve a shareable-link token
// ---------------------------------------------------------------------------

router.get(
  '/saved-views/shared/:shareToken',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await resolveSharedView({
      shareToken: String(req.params.shareToken || ''),
      organizationId,
      requesterUserId: userId,
    });
    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }
    return res.status(200).json({ data: toSavedViewDto(result.view), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// GET /saved-views/:viewId
// ---------------------------------------------------------------------------

router.get(
  '/saved-views/:viewId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await getSavedView(organizationId, String(req.params.viewId || ''), userId);
    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }
    return res.status(200).json({ data: toSavedViewDto(result.view), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// PATCH /saved-views/:viewId — owner-only, regardless of scope
// ---------------------------------------------------------------------------

router.patch(
  '/saved-views/:viewId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    const result = await updateSavedView({
      organizationId,
      viewId: String(req.params.viewId || ''),
      requesterUserId: userId,
      patch: {
        name: typeof body.name === 'string' ? body.name : undefined,
        gridViewState: typeof body.gridViewState === 'object' && body.gridViewState !== null ? body.gridViewState : undefined,
        filters: Array.isArray(body.filters) ? body.filters : undefined,
      },
    });
    if (!result.ok) {
      return sendError(res, httpStatusForSavedViewError(result.code), result.code, result.message);
    }
    return res.status(200).json({ data: toSavedViewDto(result.view), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// DELETE /saved-views/:viewId — owner-only, regardless of scope
// ---------------------------------------------------------------------------

router.delete(
  '/saved-views/:viewId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await deleteSavedView(organizationId, String(req.params.viewId || ''), userId);
    if (!result.ok) {
      return sendError(res, httpStatusForSavedViewError(result.code), result.code, result.message);
    }
    return res.status(204).send();
  })
);

export default router;
