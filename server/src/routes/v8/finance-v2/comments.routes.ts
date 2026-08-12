/**
 * Finance v3 canonical adapter — Comments / review-checklist surface,
 * `/api/v8/finance-v2/{comments,review-checklist}/*`.
 *
 * `commentService.ts` (AP-06, ~345 lines, REAL migrated tables
 * `finance_comments`/`finance_comment_assignments`) and
 * `reviewChecklistService.ts` (~299 lines, `finance_review_checklists` +
 * the changed-only reviewer entry) had ZERO HTTP routes and ZERO callers —
 * lowest risk of every service in this package's scope (real, already-
 * migrated, FK-backed tables), so this is a thin, direct wiring pass, no
 * new domain logic.
 *
 * Write paths (`POST /comments`, `POST /review-checklist`) pre-validate
 * `businessVersionId` against `finance_business_versions` (via
 * `artifactVersionService.getBusinessVersion`) BEFORE calling the service —
 * `finance_comments`/`finance_review_checklists` both carry a composite FK
 * `(business_version_id, organization_id) REFERENCES finance_business_versions`
 * (migration `20260809_finance_v3_d_ap06_comments_01_tables.sql`), so a
 * cross-tenant or nonexistent businessVersionId would otherwise surface as a
 * raw Postgres FK-violation 500, not a clean 404 — the pre-check turns that
 * into the same `{code:'NOT_FOUND'}` shape every other route in this package
 * uses. Read paths need no such pre-check: every list/get query already
 * scopes by `organization_id` in SQL, so a foreign id is indistinguishable
 * from "nothing here yet" (safe, same convention `crosscutting.routes.ts`
 * documents for its own lineage/exception reads).
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  assignComment,
  createComment,
  getComment,
  getCurrentAssignment,
  hasUnresolvedBlockingComments,
  listByArtifact,
  listByBusinessVersion,
  listByCell,
  listMentioning,
  reopenComment,
  resolveComment,
} from '../../../services/finance/canonical/commentService.js';
import {
  addChecklistItem,
  allRequiredItemsChecked,
  checkItem,
  getChangedCellsForStatementPack,
  listChecklistItems,
  setChecklistItemRequired,
  uncheckItem,
} from '../../../services/finance/canonical/reviewChecklistService.js';
import { CellRefSchema, type CellRef } from '../../../types/finance/CellRef.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

// ---------------------------------------------------------------------------
// Comments — create / resolve / reopen / assign
// ---------------------------------------------------------------------------

router.post(
  '/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.artifactId !== 'string' || !body.artifactId) {
      return sendError(res, 400, 'INVALID_BODY', 'artifactId is required');
    }
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }

    const businessVersion = await getBusinessVersion(organizationId, body.businessVersionId);
    if (!businessVersion) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }
    if (businessVersion.artifact_id !== body.artifactId) {
      return sendError(res, 400, 'ARTIFACT_MISMATCH', 'businessVersionId does not belong to artifactId');
    }

    let anchor: CellRef | null = null;
    if (body.anchor !== undefined && body.anchor !== null) {
      const parsedAnchor = CellRefSchema.safeParse(body.anchor);
      if (!parsedAnchor.success) {
        return sendError(res, 400, 'INVALID_ANCHOR', `anchor is not a valid CellRef: ${parsedAnchor.error.message}`);
      }
      anchor = parsedAnchor.data;
    }

    const result = await createComment({
      organizationId,
      artifactId: body.artifactId,
      businessVersionId: body.businessVersionId,
      anchor,
      authorId: userId,
      body: typeof body.body === 'string' ? body.body : '',
      mentions: Array.isArray(body.mentions) ? body.mentions.filter((m: unknown) => typeof m === 'string') : undefined,
      isBlocking: typeof body.isBlocking === 'boolean' ? body.isBlocking : undefined,
    });
    if (!result.ok) {
      return sendError(res, 400, result.code, result.message);
    }
    return res.status(201).json({ data: result.comment, meta: financeV2Meta() });
  })
);

router.post(
  '/comments/:commentId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await resolveComment(organizationId, String(req.params.commentId || ''), userId);
    if (!result.ok) {
      return sendError(res, result.code === 'NOT_FOUND' ? 404 : 409, result.code, result.message);
    }
    return res.status(200).json({ data: result.comment, meta: financeV2Meta() });
  })
);

router.post(
  '/comments/:commentId/reopen',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await reopenComment(organizationId, String(req.params.commentId || ''));
    if (!result.ok) {
      return sendError(res, result.code === 'NOT_FOUND' ? 404 : 409, result.code, result.message);
    }
    return res.status(200).json({ data: result.comment, meta: financeV2Meta() });
  })
);

router.post(
  '/comments/:commentId/assign',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.assigneeId !== 'string' || !body.assigneeId) {
      return sendError(res, 400, 'INVALID_BODY', 'assigneeId is required');
    }
    const result = await assignComment({
      organizationId,
      commentId: String(req.params.commentId || ''),
      assigneeId: body.assigneeId,
      assignedBy: userId,
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : undefined,
    });
    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }
    return res.status(201).json({ data: result.assignment, meta: financeV2Meta() });
  })
);

router.get(
  '/comments/:commentId/assignment',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const assignment = await getCurrentAssignment(organizationId, String(req.params.commentId || ''));
    return res.status(200).json({ data: assignment, meta: financeV2Meta() });
  })
);

router.get(
  '/comments/:commentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const comment = await getComment(organizationId, String(req.params.commentId || ''));
    if (!comment) {
      return sendError(res, 404, 'NOT_FOUND', 'Comment not found');
    }
    return res.status(200).json({ data: comment, meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// Comments — list (exactly one of artifactId/businessVersionId)
// ---------------------------------------------------------------------------

router.get(
  '/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const artifactId = typeof req.query.artifactId === 'string' ? req.query.artifactId : undefined;
    const businessVersionId = typeof req.query.businessVersionId === 'string' ? req.query.businessVersionId : undefined;
    if ((!artifactId && !businessVersionId) || (artifactId && businessVersionId)) {
      return sendError(res, 400, 'INVALID_QUERY', 'Exactly one of artifactId or businessVersionId is required');
    }
    const opts = {
      unresolvedOnly: req.query.unresolvedOnly === 'true',
      blockingOnly: req.query.blockingOnly === 'true',
    };
    const comments = businessVersionId
      ? await listByBusinessVersion(organizationId, businessVersionId, opts)
      : await listByArtifact(organizationId, artifactId as string, opts);
    return res.status(200).json({ data: comments, meta: financeV2Meta() });
  })
);

router.post(
  '/comments/search-by-cell',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }
    const parsedCellRef = CellRefSchema.safeParse(body.cellRef);
    if (!parsedCellRef.success) {
      return sendError(res, 400, 'INVALID_CELL_REF', `cellRef is not valid: ${parsedCellRef.error.message}`);
    }
    const comments = await listByCell(organizationId, body.businessVersionId, parsedCellRef.data);
    return res.status(200).json({ data: comments, meta: financeV2Meta() });
  })
);

/** Only the CALLER's own mentions — never accepts a userId query param, so no caller can enumerate another user's mentions. */
router.get(
  '/comments/mentions/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const comments = await listMentioning(organizationId, userId);
    return res.status(200).json({ data: comments, meta: financeV2Meta() });
  })
);

router.get(
  '/versions/:businessVersionId/has-unresolved-blocking-comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const hasBlocking = await hasUnresolvedBlockingComments(organizationId, String(req.params.businessVersionId || ''));
    return res.status(200).json({ data: { hasUnresolvedBlockingComments: hasBlocking }, meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// Review checklist — add / check / uncheck / require
// ---------------------------------------------------------------------------

router.post(
  '/review-checklist',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }
    const businessVersion = await getBusinessVersion(organizationId, body.businessVersionId);
    if (!businessVersion) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const result = await addChecklistItem({
      organizationId,
      businessVersionId: body.businessVersionId,
      item: typeof body.item === 'string' ? body.item : '',
      required: typeof body.required === 'boolean' ? body.required : undefined,
      createdBy: userId,
    });
    if (!result.ok) {
      return sendError(res, 400, result.code, result.message);
    }
    return res.status(201).json({ data: result.item, meta: financeV2Meta() });
  })
);

router.post(
  '/review-checklist/:itemId/check',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await checkItem(organizationId, String(req.params.itemId || ''), userId);
    if (!result.ok) {
      return sendError(res, result.code === 'NOT_FOUND' ? 404 : 409, result.code, result.message);
    }
    return res.status(200).json({ data: result.item, meta: financeV2Meta() });
  })
);

router.post(
  '/review-checklist/:itemId/uncheck',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await uncheckItem(organizationId, String(req.params.itemId || ''));
    if (!result.ok) {
      return sendError(res, result.code === 'NOT_FOUND' ? 404 : 409, result.code, result.message);
    }
    return res.status(200).json({ data: result.item, meta: financeV2Meta() });
  })
);

router.post(
  '/review-checklist/:itemId/required',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.required !== 'boolean') {
      return sendError(res, 400, 'INVALID_BODY', 'required must be a boolean');
    }
    const result = await setChecklistItemRequired(organizationId, String(req.params.itemId || ''), body.required);
    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }
    return res.status(200).json({ data: result.item, meta: financeV2Meta() });
  })
);

router.get(
  '/review-checklist/:businessVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const items = await listChecklistItems(organizationId, String(req.params.businessVersionId || ''));
    return res.status(200).json({ data: items, meta: financeV2Meta() });
  })
);

router.get(
  '/review-checklist/:businessVersionId/all-required-checked',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const allChecked = await allRequiredItemsChecked(organizationId, String(req.params.businessVersionId || ''));
    return res.status(200).json({ data: { allRequiredChecked: allChecked }, meta: financeV2Meta() });
  })
);

router.get(
  '/review-checklist/:businessVersionId/changed-cells',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const previousApprovedBusinessVersionId =
      typeof req.query.previousApprovedBusinessVersionId === 'string' ? req.query.previousApprovedBusinessVersionId : undefined;
    const result = await getChangedCellsForStatementPack(organizationId, String(req.params.businessVersionId || ''), {
      previousApprovedBusinessVersionId,
    });
    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }
    return res.status(200).json({
      data: {
        hasPreviousApproved: result.hasPreviousApproved,
        previousBusinessVersionId: result.previousBusinessVersionId,
        changedCells: result.changedCells,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
