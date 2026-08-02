/**
 * EXE-08 — Closure/Evidence Gate HTTP adapter.
 *
 * Thin HTTP layer over `services/initiative/initiativeClosureService.ts`
 * (owns all business logic, validation, and the atomicity design — see that
 * file's header). This router does auth/param plumbing only.
 *
 * Mounted at `/api/initiatives` (Gateway.ts), alongside the existing
 * `pmo/initiatives.routes.ts` mount — a SEPARATE router file rather than
 * appending to that already-large file, to keep single-writer-per-file
 * discipline clean during parallel EXE-0x work and because this is a
 * genuinely separate concern (closure workflow, not initiative CRUD).
 */

import type { Response } from 'express';
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import {
  addEvidence,
  approveClosureRequest,
  ClosureGateFailure,
  createClosureRequest,
  getReadinessChecklist,
  reconcileClosureRequestStatus,
  returnClosureRequest,
  submitClosureRequest,
} from '../../services/initiative/initiativeClosureService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  getReceiptForInitiative,
  manualRetryReceipt,
} from '../../services/closureDeliveryReceiptService.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

function handleClosureError(res: Response, err: unknown): void {
  if (err instanceof ClosureGateFailure) {
    res.status(err.httpStatus).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  res.status(500).json({
    error: 'Closure gate operation failed',
    code: 'CLOSURE_INTERNAL_ERROR',
    details: err instanceof Error ? err.message : String(err),
  });
}

function requireAuth(req: AuthenticatedRequest, res: Response): { orgId: string; actorId: string } | null {
  const orgId = req.user?.organizationId;
  const actorId = req.user?.id;
  if (!orgId || !actorId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { orgId, actorId };
}

/**
 * POST /api/initiatives/:id/closure-requests
 * Create a new (draft) closure request. Idempotent via body.idempotencyKey.
 */
router.post('/:id/closure-requests', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const { id: initiativeId } = req.params;
    const { closureRationale, outcomeSummary, idempotencyKey } = req.body || {};
    const result = await createClosureRequest({
      orgId: auth.orgId,
      initiativeId,
      actorId: auth.actorId,
      closureRationale,
      outcomeSummary,
      idempotencyKey,
    });
    res.status(result.idempotent ? 200 : 201).json({ success: true, ...result });
  } catch (err) {
    handleClosureError(res, err);
  }
});

/**
 * GET /api/initiatives/:id/closure-requests
 * List closure requests for this initiative (most recent first) — org-scoped.
 */
router.get('/:id/closure-requests', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const { id: initiativeId } = req.params;
    const initiative = await queryHelpers.queryOne(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, auth.orgId]
    );
    if (!initiative) {
      res.status(404).json({ error: 'Initiative not found' });
      return;
    }
    const rows = await queryHelpers.queryAll(
      `SELECT id, status, approval_status as "approvalStatus", requested_by as "requestedBy",
              requested_at as "requestedAt", closure_rationale as "closureRationale",
              outcome_summary as "outcomeSummary", exceptions_waivers as "exceptionsWaivers",
              approver_id as "approverId", approved_at as "approvedAt", returned_at as "returnedAt",
              review_rationale as "reviewRationale", transition_audit_ref as "transitionAuditRef",
              version, created_at as "createdAt", updated_at as "updatedAt"
       FROM initiative_closure_requests
       WHERE initiative_id = ? AND organization_id = ?
       ORDER BY created_at DESC`,
      [initiativeId, auth.orgId]
    );
    res.json({ closureRequests: rows });
  } catch (err) {
    handleClosureError(res, err);
  }
});

/**
 * GET /api/initiatives/:id/closure-requests/:requestId
 * Self-heals approved_pending_transition/transition_failed -> done on read
 * (see initiativeClosureService.reconcileClosureRequestStatus doc comment).
 */
router.get(
  '/:id/closure-requests/:requestId',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      await reconcileClosureRequestStatus(auth.orgId, requestId);
      const row = await queryHelpers.queryOne(
        `SELECT id, status, approval_status as "approvalStatus", requested_by as "requestedBy",
                requested_at as "requestedAt", closure_rationale as "closureRationale",
                outcome_summary as "outcomeSummary", acceptance_criteria_snapshot as "acceptanceCriteriaSnapshot",
                completed_items_snapshot as "completedItemsSnapshot", exceptions_waivers as "exceptionsWaivers",
                approver_id as "approverId", approved_at as "approvedAt", returned_at as "returnedAt",
                review_rationale as "reviewRationale", transition_audit_ref as "transitionAuditRef",
                expected_initiative_version as "expectedInitiativeVersion",
                version, created_at as "createdAt", updated_at as "updatedAt"
         FROM initiative_closure_requests
         WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [requestId, initiativeId, auth.orgId]
      );
      if (!row) {
        res.status(404).json({ error: 'Closure request not found' });
        return;
      }
      const evidence = await queryHelpers.queryAll(
        `SELECT id, evidence_type as "evidenceType", evidence_ref_id as "evidenceRefId",
                notes, added_by as "addedBy", added_at as "addedAt"
         FROM initiative_closure_evidence
         WHERE closure_request_id = ? AND organization_id = ?
         ORDER BY added_at ASC`,
        [requestId, auth.orgId]
      );
      res.json({ closureRequest: row, evidence });
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * GET /api/initiatives/:id/closure-requests/:requestId/readiness
 * Read-only checklist — polled by the UI, also enforced server-side on submit.
 */
router.get(
  '/:id/closure-requests/:requestId/readiness',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      const readiness = await getReadinessChecklist(auth.orgId, initiativeId, requestId);
      res.json(readiness);
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * POST /api/initiatives/:id/closure-requests/:requestId/evidence
 * Evidence reference must point at a real (task|milestone|decision) row
 * belonging to the caller's own organization — validated in the service.
 */
router.post(
  '/:id/closure-requests/:requestId/evidence',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      const { evidenceType, evidenceRefId, notes, idempotencyKey } = req.body || {};
      if (!evidenceType || !evidenceRefId) {
        res.status(400).json({ error: 'evidenceType and evidenceRefId are required' });
        return;
      }
      const result = await addEvidence({
        orgId: auth.orgId,
        initiativeId,
        closureRequestId: requestId,
        actorId: auth.actorId,
        evidenceType,
        evidenceRefId,
        notes,
        idempotencyKey,
      });
      res.status(result.idempotent ? 200 : 201).json({ success: true, ...result });
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * POST /api/initiatives/:id/closure-requests/:requestId/submit
 * Runs the full readiness gate server-side — a client-side-only check is
 * cosmetic, this is the enforcement.
 */
router.post(
  '/:id/closure-requests/:requestId/submit',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      const { closureRationale, outcomeSummary, exceptionsWaivers } = req.body || {};
      const result = await submitClosureRequest({
        orgId: auth.orgId,
        initiativeId,
        closureRequestId: requestId,
        actorId: auth.actorId,
        closureRationale,
        outcomeSummary,
        exceptionsWaivers,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * POST /api/initiatives/:id/closure-requests/:requestId/return
 * Approver sends the request back with a required rationale.
 */
router.post(
  '/:id/closure-requests/:requestId/return',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      const { reviewRationale } = req.body || {};
      const result = await returnClosureRequest({
        orgId: auth.orgId,
        initiativeId,
        closureRequestId: requestId,
        actorId: auth.actorId,
        reviewRationale,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * POST /api/initiatives/:id/closure-requests/:requestId/approve
 * The only HTTP path in this packet that can result in the initiative
 * reaching DONE — via the canonical transition engine, see
 * initiativeClosureService.approveClosureRequest.
 */
router.post(
  '/:id/closure-requests/:requestId/approve',
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { id: initiativeId, requestId } = req.params;
      const { reviewRationale, idempotencyKey } = req.body || {};
      const result = await approveClosureRequest({
        orgId: auth.orgId,
        initiativeId,
        closureRequestId: requestId,
        actorId: auth.actorId,
        actorRole: req.user?.role,
        reviewRationale,
        idempotencyKey,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleClosureError(res, err);
    }
  }
);

/**
 * EXE-09 — GET /api/initiatives/:id/closure-receipt
 *
 * Read-only status of the durable Results/Finance delivery receipt for this
 * initiative's closure (see closureDeliveryReceiptService.ts,
 * migration 935). Additive to this router — no existing route below this
 * point is modified. Returns `{ receipt: null }` (200, not 404) when the
 * initiative has never closed — "no receipt yet" is a normal state, not an
 * error, and the UI must not render any delivered/failed status for it.
 */
router.get('/:id/closure-receipt', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const { id: initiativeId } = req.params;
    const receipt = await getReceiptForInitiative(initiativeId, auth.orgId);
    res.json({ receipt });
  } catch (err) {
    handleClosureError(res, err);
  }
});

/**
 * EXE-09 — POST /api/initiatives/:id/closure-receipt/retry
 *
 * Operator-triggered retry (contract point 8: "użytkownik/operator może
 * odczytać stan i bezpiecznie ponowić"). Safe to call repeatedly — each leg
 * only re-attempts while its own status is retry-eligible.
 */
router.post('/:id/closure-receipt/retry', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const { id: initiativeId } = req.params;
    const existing = await getReceiptForInitiative(initiativeId, auth.orgId);
    if (!existing) {
      res.status(404).json({ error: 'No closure receipt for this initiative', code: 'CLOSURE_RECEIPT_NOT_FOUND' });
      return;
    }
    const receipt = await manualRetryReceipt(existing.id, auth.orgId);
    res.json({ success: true, receipt });
  } catch (err) {
    handleClosureError(res, err);
  }
});

export default router;
