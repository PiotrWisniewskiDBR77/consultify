/**
 * Case Workspace HTTP routes — caseIntakeService
 * (server/src/services/caseWorkspace/caseIntakeService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts); this file
 * owns the `/case-intake/*` path family. It is the HTTP contract that the
 * chat/Teresa layer calls — this packet deliberately does NOT edit
 * `chat.routes.ts`, `teresa.routes.ts` or `ai.routes.ts`; it builds the
 * contract they will call, so the wiring is a separate, reviewable change.
 *
 * TENANT: `organizationId` is NEVER read from the request body. Neither zod
 * schema below declares the field, so a body-supplied one is stripped before
 * the handler runs, and both service calls receive `actor.organizationId`
 * from the authenticated v8 context. This matters more here than on most
 * routes: `organizationId` is part of the DIGESTED work order, so allowing a
 * client-supplied value would let a caller mint a digest for a tenant they
 * do not belong to and then confirm it.
 *
 * TWO-STEP BY DESIGN. There is no "propose and confirm in one call" endpoint
 * and there must never be one: the entire guarantee of CW-CANON-03 is that a
 * human saw the exact work order between the two calls. A combined endpoint
 * would satisfy every check in the service while proving nothing.
 *
 * Error mapping is the shared funnel in `_shared/errors.ts`:
 *   intake_work_order_digest_mismatch  -> 422 (contains `_mismatch`)
 *   intake_project_not_found           -> 404 (enumeration-safe)
 *   intake_work_order_not_proposed     -> 422
 *   intake_*_required / _invalid       -> 400
 *   CaseWorkspaceAuthError not_org_member -> 403; case_access_denied -> 404
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/caseIntakeService.js';
import { requireOrgMemberForActor } from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { parseBody, parseParams } from './_shared/validate.js';

const router = Router();

const closureTypeEnum = z.enum([
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
]);
const caseProfileEnum = z.enum(['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING']);
const governanceTierEnum = z.enum(['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED']);
const autonomyPolicyEnum = z.enum(['ASK_EACH_ACTION', 'ASK_MATERIAL_ACTIONS', 'EXECUTE_APPROVED_PLAN']);

/**
 * Note what is NOT trimmed here: `goal`, `scope[]`, `expectedOutcome`,
 * `constraints[]` and `successCriteria[]` are passed through as sent. The
 * service's own `normalizeWorkOrder` owns normalization (NFC + trim) because
 * normalization and digesting must be the SAME step — a route that trimmed
 * first would digest a string the service never saw, and the two sides could
 * drift apart on a future edit to either file.
 */
const workOrderBody = z.object({
  projectId: z.string().trim().min(1),
  // CW-T-A: the Case's own canonical name/title, distinct from `goal`. Not
  // trimmed here for the same reason `goal`/`scope`/etc. below are not —
  // normalization and digesting must be the SAME step, owned entirely by
  // caseIntakeService.normalizeWorkOrder. Optional on the wire (the service
  // derives an honest fallback from `goal` when omitted — see
  // caseIntakeService.ts's WorkOrderDraftInput.caseName), but every real
  // caller of this route should send one.
  caseName: z.string().min(1).max(200).nullable().optional(),
  goal: z.string().min(1),
  scope: z.array(z.string()).min(1),
  expectedOutcome: z.string().min(1),
  constraints: z.array(z.string()).nullable().optional(),
  successCriteria: z.array(z.string()).nullable().optional(),
  contractedClosureType: closureTypeEnum,
  caseProfile: caseProfileEnum.nullable().optional(),
  governanceTier: governanceTierEnum.nullable().optional(),
  autonomyPolicy: autonomyPolicyEnum.nullable().optional(),
  sourceConversationId: z.string().trim().min(1).nullable().optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
});

const proposeBody = z.object({ workOrder: workOrderBody });

const confirmBody = z.object({
  workOrder: workOrderBody,
  /** `sha256:<64 hex>` — the shape proposeWorkOrder returns, nothing else. */
  confirmedDigest: z
    .string()
    .trim()
    .regex(/^sha256:[0-9a-f]{64}$/, 'confirmedDigest must be sha256:<64 hex chars>'),
  /**
   * CW-T-A: an optional caller-minted token identifying THIS confirmation
   * attempt — one factor of `computeIntakeConfirmationKey`
   * (caseIntakeService.ts). Omit it and the service defaults to
   * `confirmedDigest` itself, which reproduces the pre-CW-T-A idempotency
   * behaviour (a retry of byte-identical content collapses to one Case).
   */
  confirmationIdempotencyKey: z.string().trim().min(1).max(200).nullable().optional(),
});

// POST /case-intake/work-orders/propose — CW-CANON-01: creates no Case, no Run.
// 200, not 201: nothing was created. The response is a proposal to show a
// human, and answering 201 would misdescribe it to every client.
router.post(
  '/case-intake/work-orders/propose',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(proposeBody, req.body);
    await requireOrgMemberForActor(actor);
    const proposal = await svc.proposeWorkOrder({
      workOrder: { ...body.workOrder, organizationId: actor.organizationId },
      proposedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });
    res.status(200).json({ data: proposal });
  })
);

// POST /case-intake/work-orders/confirm — CW-CANON-03: exactly one Case.
// 201 only when this call actually created the Case; a reuse (idempotent
// retry, or a Case that already existed for the project) is 200, so a client
// can tell "I created it" from "it was already there" without parsing the body.
router.post(
  '/case-intake/work-orders/confirm',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(confirmBody, req.body);
    await requireOrgMemberForActor(actor);
    const result = await svc.confirmWorkOrder({
      workOrder: { ...body.workOrder, organizationId: actor.organizationId },
      confirmedDigest: body.confirmedDigest,
      confirmedByActorId: actor.actorUserId,
      confirmationIdempotencyKey: body.confirmationIdempotencyKey ?? null,
      correlationId: actor.correlationId,
    });
    res.status(result.caseCreated ? 201 : 200).json({ data: result });
  })
);

// GET /case-intake/cases/:caseId/work-orders — the confirmed work orders behind
// one Case. Access is gated inside the service by requireCaseAccess, so an
// unknown and a cross-tenant caseId both answer 404.
router.get(
  '/case-intake/cases/:caseId/work-orders',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const items = await svc.getConfirmedWorkOrders(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

export default router;
