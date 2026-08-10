import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { caseWorkspaceHandler } from '../caseWorkspace/_shared/handler.js';
import { parseBody, parseParams } from '../caseWorkspace/_shared/validate.js';
import * as caseIntakeService from '../../services/caseWorkspace/caseIntakeService.js';
import * as chatExecutionService from '../../services/v8/chatExecutionService.js';
import * as contextConsumerBindingService from '../../services/v8/contextConsumerBindingService.js';
import * as contextSnapshotService from '../../services/v8/contextSnapshotService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

// ==========================================
// Context Snapshots
// ==========================================

router.get(
  '/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { conversationId, runId } = req.query;

    if (conversationId && typeof conversationId === 'string') {
      const data = await contextSnapshotService.getSnapshotsByConversation(
        conversationId,
        organizationId
      );
      return res.json({ data, meta: { version: 'v8' } });
    }

    if (runId && typeof runId === 'string') {
      const data = await contextSnapshotService.getSnapshotsByRun(runId, organizationId);
      return res.json({ data, meta: { version: 'v8' } });
    }

    return res.status(400).json({
      error: 'Either conversationId or runId query parameter is required',
      code: 'MISSING_QUERY_PARAM',
    });
  })
);

router.get(
  '/snapshots/:snapshotId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { snapshotId } = req.params;

    const data = await contextSnapshotService.getSnapshot(snapshotId, organizationId);
    if (!data) {
      return res.status(404).json({
        error: `Snapshot ${snapshotId} not found`,
        code: 'SNAPSHOT_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    const merged = {
      ...req.body,
      organizationId,
      initiatorUserId: userId,
    };

    try {
      const data = await contextSnapshotService.captureSnapshot(merged);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn('[V8:Chat] Snapshot validation failed', {
          issues: err.issues,
          received: {
            workspaceId: merged.workspaceId,
            organizationId: merged.organizationId,
            projectId: merged.projectId,
            conversationId: merged.conversationId,
            initiatorUserId: merged.initiatorUserId,
            consumerClass: merged.consumerClass,
            effectiveScopeRef: merged.effectiveScopeRef,
            resolvedRoleRef: merged.resolvedRoleRef,
            artifactRefsLen: Array.isArray(merged.artifactRefs)
              ? merged.artifactRefs.length
              : merged.artifactRefs,
            sourceContextRefsLen: Array.isArray(merged.sourceContextRefs)
              ? merged.sourceContextRefs.length
              : merged.sourceContextRefs,
          },
        });
        return res.status(400).json({
          error: 'Invalid snapshot parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Chat Execution Handoffs
// ==========================================

router.get(
  '/handoffs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { conversationId } = req.query;

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({
        error: 'conversationId query parameter is required',
        code: 'MISSING_QUERY_PARAM',
      });
    }

    const data = await chatExecutionService.getHandoffsByConversation(
      conversationId,
      organizationId
    );
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/handoffs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await chatExecutionService.initiateHandoff({
        ...req.body,
        organizationId,
        userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid handoff parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      if (err instanceof Error && err.message.includes('not found')) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Context Consumer Bindings
// ==========================================

router.post(
  '/bindings/chat',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForChat({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

router.post(
  '/bindings/execution',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForExecution({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

router.post(
  '/bindings/retrieval',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForRetrieval({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Case Intake — chat conversation -> Case (Stream B / E8)
// ==========================================
/**
 * WHY THESE LIVE HERE AND NOT ON A SEPARATE INTAKE ROUTER.
 *
 * `caseIntakeService` already had an HTTP surface —
 * `POST /api/v8/case-workspace/case-intake/work-orders/{propose,confirm}` in
 * routes/caseWorkspace/intake.routes.ts — and that file says so itself: "this
 * packet deliberately does NOT edit chat.routes.ts … it builds the contract
 * they will call". Nothing ever called it. A Case could not be born from a
 * conversation, which is the entire point of the feature, so the guarantees
 * were being proved on an endpoint no chat surface touches. This block is that
 * missing wiring: the SAME service, on the router the chat surface is mounted
 * on (`/api/v8/chat`, see routes/v8/index.ts:96).
 *
 * The `/case-workspace/case-intake/*` routes are left in place and untouched —
 * they are the machine-to-machine contract and they take the work order in the
 * request body. These routes are the HUMAN contract and are deliberately
 * NARROWER in one decisive way:
 *
 *   CONFIRMATION TAKES A DIGEST AND NOTHING ELSE.
 *
 * The client cannot send a work order at confirm time. The server reads the
 * conversation's CURRENT proposal back out of the event stream, re-digests it,
 * and refuses (409 `intake_work_order_digest_stale`) if that is not the digest
 * the human clicked. So "what you confirmed is what gets executed" is enforced
 * by there being only one copy of the order — the server's — rather than by
 * comparing two copies the client controls.
 *
 * Errors go through `caseWorkspaceHandler` (the caseWorkspace funnel in
 * _shared/errors.ts), not this file's local try/catch style, so the intake
 * error codes map identically here and on the case-workspace router:
 * digest_stale -> 409, digest_mismatch -> 422, project_not_found -> 404,
 * not_org_member -> 403, case_access_denied -> 404.
 */

const intakeClosureTypeEnum = z.enum([
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
]);
const intakeCaseProfileEnum = z.enum(['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING']);
const intakeGovernanceTierEnum = z.enum(['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED']);
const intakeAutonomyPolicyEnum = z.enum([
  'ASK_EACH_ACTION',
  'ASK_MATERIAL_ACTIONS',
  'EXECUTE_APPROVED_PLAN',
]);

/**
 * The structured summary Teresa shows the human. `goal`, `scope` and
 * `expectedOutcome` are REQUIRED, not optional niceties: a confirmation
 * dialogue that cannot state what will be done, what is in scope and what will
 * exist at the end is not a work order, and the digest would be signing an
 * incomplete promise.
 *
 * Text fields are NOT trimmed here — `normalizeWorkOrder` in the service owns
 * normalization, because normalizing and digesting must be the same step.
 * `organizationId` and `sourceConversationId` are absent by design: the first
 * comes from the authenticated context, the second from the URL.
 */
const intakeWorkOrderBody = z.object({
  projectId: z.string().trim().min(1),
  goal: z.string().min(1),
  scope: z.array(z.string()).min(1),
  expectedOutcome: z.string().min(1),
  constraints: z.array(z.string()).nullable().optional(),
  successCriteria: z.array(z.string()).nullable().optional(),
  contractedClosureType: intakeClosureTypeEnum,
  caseProfile: intakeCaseProfileEnum.nullable().optional(),
  governanceTier: intakeGovernanceTierEnum.nullable().optional(),
  autonomyPolicy: intakeAutonomyPolicyEnum.nullable().optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
});

const intakeTurnBody = z.object({
  message: z.string().min(1),
  /**
   * Forwarded to `chatExecutionService.classifyIntent` when present. Optional
   * because intake happens BEFORE any snapshot exists in the common case, and
   * that function's body is today a documented heuristic stub
   * (chatExecutionService.ts:132 "LLM call placeholder") that reads only the
   * message — the id exists solely to satisfy its zod schema. KNOWN
   * LIMITATION: when that stub is replaced by a real LLM call that actually
   * reads the snapshot, this must become required.
   */
  contextSnapshotId: z.string().uuid().optional(),
  workOrder: intakeWorkOrderBody.optional(),
});

const intakeConfirmBody = z.object({
  /** `sha256:<64 hex>` and nothing else — the shape the turn response returns. */
  confirmedDigest: z
    .string()
    .trim()
    .regex(/^sha256:[0-9a-f]{64}$/, 'confirmedDigest must be sha256:<64 hex chars>'),
});

const conversationParams = z.object({ conversationId: z.string().trim().min(1) });

/**
 * POST /conversations/:conversationId/case-intake/turn
 *
 * One chat turn, classified. Three outcomes, and only the third writes
 * anything at all:
 *
 *   `informational`       the message is a question/explanation request. ZERO
 *                         Cases, ZERO Runs, ZERO rows — CW-CANON-01 holds by
 *                         construction, and it holds EVEN IF the caller
 *                         attached a work order, because a clearly
 *                         conversational turn is refused a proposal outright.
 *                         That refusal is the point: a client must not be able
 *                         to turn "what is the status?" into a work order by
 *                         attaching one to the request.
 *   `work_order_required` the turn asks for durable work but no structured
 *                         summary was supplied. Teresa must draft goal/scope/
 *                         expected outcome first. Still ZERO writes.
 *   `work_order_proposed` the summary is recorded as SHOWN and returned with
 *                         its digest. Still ZERO Cases and ZERO Runs — the
 *                         only row is the proposal event.
 *
 * 200 in all three cases: nothing was created, and 201 would misdescribe that.
 */
router.post(
  '/conversations/:conversationId/case-intake/turn',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(conversationParams, req.params);
    const body = parseBody(intakeTurnBody, req.body);

    const intent = await chatExecutionService.classifyIntent(
      body.message,
      body.contextSnapshotId ?? uuidv4(),
      actor.organizationId
    );

    if (intent.intentType === 'conversational' || !body.workOrder) {
      res.status(200).json({
        data: {
          conversationId,
          mode: intent.intentType === 'conversational' ? 'informational' : 'work_order_required',
          intent,
          workOrder: null,
          workOrderDigest: null,
          caseCreated: false,
          runCreated: false,
        },
        meta: { version: 'v8' },
      });
      return;
    }

    const proposal = await caseIntakeService.proposeConversationWorkOrder({
      conversationId,
      workOrder: { ...body.workOrder, organizationId: actor.organizationId },
      proposedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(200).json({
      data: {
        conversationId,
        mode: 'work_order_proposed',
        intent,
        // The EXACT object that was digested — never the raw request body, so
        // the UI cannot render one thing while the signature covers another.
        workOrder: proposal.workOrder,
        workOrderId: proposal.workOrderId,
        workOrderDigest: proposal.workOrderDigest,
        alreadyProposed: proposal.alreadyProposed,
        runStartPolicy: proposal.runStartPolicy,
        caseCreated: false,
        runCreated: false,
      },
      meta: { version: 'v8' },
    });
  })
);

/**
 * GET /conversations/:conversationId/case-intake/work-order
 *
 * The CURRENT work order for this conversation, reconstructed from the event
 * stream and re-digested on the way out. This is what a refreshed browser must
 * re-read before showing a confirm button — a page holding a digest from
 * before a redraft would otherwise offer a stale confirmation the server will
 * (correctly) refuse.
 */
router.get(
  '/conversations/:conversationId/case-intake/work-order',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(conversationParams, req.params);
    const current = await caseIntakeService.getCurrentConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: current, meta: { version: 'v8' } });
  })
);

/**
 * POST /conversations/:conversationId/case-intake/confirm
 *
 * The human clicked "confirm". Body carries ONLY the digest (see this block's
 * header for why). Creates exactly one Case and ZERO Runs, for every profile.
 *
 * 201 when this call created the Case; 200 when an existing Case was reused —
 * a refresh, a double-click or a genuine concurrent confirmation all land on
 * 200 with the same caseId, never a second Case and never an error the client
 * has to interpret.
 */
router.post(
  '/conversations/:conversationId/case-intake/confirm',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(conversationParams, req.params);
    const body = parseBody(intakeConfirmBody, req.body);

    const result = await caseIntakeService.confirmConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      confirmedDigest: body.confirmedDigest,
      confirmedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(result.caseCreated ? 201 : 200).json({ data: result, meta: { version: 'v8' } });
  })
);

/**
 * GET /conversations/:conversationId/case-intake/case
 * Conversation -> Case. `null` when this chat never produced one.
 */
router.get(
  '/conversations/:conversationId/case-intake/case',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(conversationParams, req.params);
    const link = await caseIntakeService.findCaseForConversation({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: link, meta: { version: 'v8' } });
  })
);

/**
 * GET /case-intake/cases/:caseId/conversation
 * Case -> conversation ("take me back to the chat this came from"). Gated by
 * requireCaseAccess inside the service, so an unknown and a cross-tenant
 * caseId both answer 404 — the return link is not an enumeration oracle.
 */
router.get(
  '/case-intake/cases/:caseId/conversation',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const link = await caseIntakeService.findConversationForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: link, meta: { version: 'v8' } });
  })
);

export default router;
