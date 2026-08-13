/**
 * P08-B — Teresa Copilot HTTP surface
 *
 * Mounted at `/api/v8/teresa`.
 *
 * Endpoints:
 *   POST /proposal          — Create a new proposal (handoff to target module)
 *   POST /proposal/:id/approve  — Approve a proposal
 *   POST /proposal/:id/reject   — Reject a proposal
 *   POST /proposal/:id/execute  — Execute an approved proposal
 *   POST /proposal/:id/undo     — Undo an applied XLSX proposal
 *   GET  /proposal/:id      — Get a proposal with audit trail
 *   GET  /proposals         — Get proposal history for current user
 *   GET  /audit/:proposalId — Get full audit trail for a proposal
 *   GET  /voice-posture     — Resolve current voice availability
 *   GET  /degraded/:id      — Get degraded scenario details
 *   GET  /contract          — Get P08 contract metadata
 */
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { caseWorkspaceHandler } from '../caseWorkspace/_shared/handler.js';
import { parseBody, parseParams } from '../caseWorkspace/_shared/validate.js';
import * as caseIntakeService from '../../services/caseWorkspace/caseIntakeService.js';
import {
  type HandoffTargetModule,
  P08_ACCEPTANCE_CHECKLIST,
  P08_ACTION_ENVELOPE_RULES,
  P08_ACTION_ENVELOPE_STATES,
  P08_ACTION_ENVELOPE_TRANSITIONS,
  P08_ANNA_BOUNDARY,
  P08_ANTI_DUPLICATE_RULES,
  P08_CITATION_POSTURE,
  P08_COMMON_PAYLOAD_FIELDS,
  P08_COPILOT_CONTRACT,
  P08_DEGRADED_SCENARIOS,
  P08_HANDOFF_TARGETS,
  P08_VOICE_POSTURE,
  P08_WRITE_OWNERSHIP,
} from '../../services/v8/teresaCopilotCanon.js';
import * as teresaService from '../../services/v8/teresaCopilotService.js';
import * as teresaToolOperatorService from '../../services/v8/teresaToolOperatorService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

function teresaMeta(extra?: Record<string, unknown>) {
  return {
    version: 'v8' as const,
    contract: P08_COPILOT_CONTRACT,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// POST /proposal — Create a new proposal
// ---------------------------------------------------------------------------

router.post(
  '/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { sessionId, handoffContext, targetModule, targetPayload, idempotencyKey } =
      req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId required', code: 'P08_SESSION_ID_REQUIRED' });
    }
    if (!targetModule || typeof targetModule !== 'string') {
      return res
        .status(400)
        .json({ error: 'targetModule required', code: 'P08_TARGET_MODULE_REQUIRED' });
    }
    if (!handoffContext || typeof handoffContext !== 'object') {
      return res
        .status(400)
        .json({ error: 'handoffContext required', code: 'P08_HANDOFF_CONTEXT_REQUIRED' });
    }

    try {
      const proposal = await teresaService.createProposal({
        organizationId,
        userId,
        sessionId,
        handoffContext,
        targetModule: targetModule as HandoffTargetModule,
        targetPayload: targetPayload ?? {},
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      });
      return res.status(201).json({
        data: teresaService.toChatProposalEnvelope(proposal),
        meta: teresaMeta({ action: 'proposal_created' }),
      });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /operators/initiative-draft
// ---------------------------------------------------------------------------

router.post(
  '/operators/initiative-draft',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await teresaToolOperatorService.proposeInitiativeDraftOperator({
        organizationId,
        userId,
        sessionId: String(
          req.body?.sessionId || req.body?.conversationId || `initiative-${userId}`
        ),
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : null,
        contextSnapshotId: req.body?.contextSnapshotId ? String(req.body.contextSnapshotId) : null,
        sourceSurface: 'initiatives',
        title: String(req.body?.title || ''),
        description: String(req.body?.description || ''),
        category: req.body?.category ? String(req.body.category) : null,
        estimatedRoi:
          typeof req.body?.estimatedRoi === 'number' ? req.body.estimatedRoi : undefined,
        priority: req.body?.priority ? String(req.body.priority) : null,
        timelineWeeks:
          typeof req.body?.timelineWeeks === 'number' ? req.body.timelineWeeks : undefined,
      });
      return res.status(201).json({ data, meta: teresaMeta({ action: 'initiative_operator' }) });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /operators/notebook-entry
// ---------------------------------------------------------------------------

router.post(
  '/operators/notebook-entry',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await teresaToolOperatorService.proposeNotebookEntryOperator({
        organizationId,
        userId,
        sessionId: String(req.body?.sessionId || req.body?.conversationId || `notebook-${userId}`),
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : null,
        contextSnapshotId: req.body?.contextSnapshotId ? String(req.body.contextSnapshotId) : null,
        sourceSurface: 'notebook',
        title: String(req.body?.title || ''),
        content: String(req.body?.content || ''),
        entryType: req.body?.entryType ? String(req.body.entryType) : null,
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((tag: unknown) => String(tag)) : [],
      });
      return res.status(201).json({ data, meta: teresaMeta({ action: 'notebook_operator' }) });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /operators/structured-query
// ---------------------------------------------------------------------------

router.post(
  '/operators/structured-query',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await teresaToolOperatorService.runStructuredQueryOperator({
        organizationId,
        userId,
        sessionId: String(req.body?.sessionId || req.body?.conversationId || `tables-${userId}`),
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : null,
        contextSnapshotId: req.body?.contextSnapshotId ? String(req.body.contextSnapshotId) : null,
        sourceSurface: 'tables',
        question: String(req.body?.question || ''),
        dataDomain: req.body?.dataDomain ? String(req.body.dataDomain) : null,
        limit: typeof req.body?.limit === 'number' ? req.body.limit : undefined,
      });
      return res.json({ data, meta: teresaMeta({ action: 'structured_query_operator' }) });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /proposal/:id/approve
// ---------------------------------------------------------------------------

router.post(
  '/proposal/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const proposal = await teresaService.approveProposal({
        proposalId: req.params.id,
        organizationId,
        userId,
      });
      return res.json({
        data: teresaService.toChatProposalEnvelope(proposal),
        meta: teresaMeta({ action: 'approved' }),
      });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /proposal/:id/reject
// ---------------------------------------------------------------------------

router.post(
  '/proposal/:id/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { reason } = req.body ?? {};
    try {
      const proposal = await teresaService.rejectProposal({
        proposalId: req.params.id,
        organizationId,
        userId,
        reason,
      });
      return res.json({
        data: teresaService.toChatProposalEnvelope(proposal),
        meta: teresaMeta({ action: 'rejected' }),
      });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /proposal/:id/execute
// ---------------------------------------------------------------------------

router.post(
  '/proposal/:id/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const result = await teresaService.executeProposal({
        proposalId: req.params.id,
        organizationId,
        userId,
      });
      const proposal = await teresaService.getProposal(req.params.id, organizationId);
      const status = result.success ? 200 : 500;
      return res.status(status).json({
        data: {
          execution: result,
          proposal: proposal ? teresaService.toChatProposalEnvelope(proposal, result) : null,
        },
        meta: teresaMeta({ action: 'executed' }),
      });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

router.post(
  '/proposal/:id/undo',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const result = await teresaService.undoProposal({
        proposalId: req.params.id,
        organizationId,
        userId,
      });
      const proposal = await teresaService.getProposal(req.params.id, organizationId);
      return res.json({
        data: {
          execution: result,
          proposal: proposal ? teresaService.toChatProposalEnvelope(proposal, result) : null,
        },
        meta: teresaMeta({ action: 'undone' }),
      });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// GET /proposal/:id
// ---------------------------------------------------------------------------

router.get(
  '/proposal/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const proposal = await teresaService.getProposal(req.params.id, organizationId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found', code: 'P08_PROPOSAL_NOT_FOUND' });
    }
    return res.json({ data: teresaService.toChatProposalEnvelope(proposal), meta: teresaMeta() });
  })
);

// ---------------------------------------------------------------------------
// GET /proposals
// ---------------------------------------------------------------------------

router.get(
  '/proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const proposals = await teresaService.getProposalHistory(organizationId, userId, limit);
    return res.json({
      data: proposals.map((proposal) => teresaService.toChatProposalEnvelope(proposal)),
      meta: teresaMeta({ count: proposals.length }),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /audit/:proposalId
// ---------------------------------------------------------------------------

router.get(
  '/audit/:proposalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const trail = await teresaService.getAuditTrail(req.params.proposalId, organizationId);
      return res.json({ data: trail, meta: teresaMeta({ count: trail.length }) });
    } catch (err) {
      if (err instanceof teresaService.TeresaCopilotError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------------
// GET /voice-posture
// ---------------------------------------------------------------------------

router.get(
  '/voice-posture',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const micPermission = req.query.mic !== 'false';
    const networkStable = req.query.network !== 'false';
    const runtimeReady = req.query.runtime !== 'false';

    const posture = teresaService.resolveVoicePosture({
      micPermission,
      networkStable,
      runtimeReady,
    });
    return res.json({ data: posture, meta: teresaMeta() });
  })
);

// ---------------------------------------------------------------------------
// GET /degraded/:id
// ---------------------------------------------------------------------------

router.get(
  '/degraded/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const scenario = teresaService.getDegradedScenario(req.params.id);
    if (!scenario) {
      return res
        .status(404)
        .json({ error: 'Degraded scenario not found', code: 'P08_SCENARIO_NOT_FOUND' });
    }
    return res.json({ data: scenario, meta: teresaMeta() });
  })
);

// ---------------------------------------------------------------------------
// Case Intake — Teresa's work-order summary -> Case (Stream B / E8)
// ---------------------------------------------------------------------------
/**
 * The Teresa-side twin of the `/api/v8/chat/conversations/:id/case-intake/*`
 * family. Same service, same guarantees, same error codes — deliberately, so
 * a Case born from the Teresa panel is indistinguishable from one born in the
 * chat stream and neither surface can drift into its own semantics.
 *
 * WHY A SEPARATE PATH RATHER THAN THE EXISTING PROPOSAL ENVELOPE. Teresa's
 * `POST /proposal` (above) is an ACTION envelope: approve -> execute, aimed at
 * a target module. It carries no versioned digest of what the human read —
 * `teresaCopilotService.ts` contains no `digest`/`sha256`/`createHash` at all
 * — so approving one proves only that a proposal id was approved, never that
 * the human saw the goal/scope/outcome that will be executed. Bolting a digest
 * onto that envelope would change the meaning of an existing, used contract.
 * These routes add the missing one instead.
 *
 * Confirmation takes ONLY a digest. Teresa never re-sends the summary at
 * confirm time: the server reads back the conversation's current work order,
 * so a summary that was redrafted between display and click can no longer be
 * confirmed (409 `intake_work_order_digest_stale`).
 */

const teresaClosureTypeEnum = z.enum([
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
]);

/**
 * The three fields the human actually reads before clicking — goal, scope,
 * expected outcome — are required. Everything below them is governance
 * metadata that is nonetheless part of the digest, so the human confirms the
 * profile and the autonomy policy too, not just the prose.
 */
const teresaWorkOrderBody = z.object({
  projectId: z.string().trim().min(1),
  goal: z.string().min(1),
  scope: z.array(z.string()).min(1),
  expectedOutcome: z.string().min(1),
  constraints: z.array(z.string()).nullable().optional(),
  successCriteria: z.array(z.string()).nullable().optional(),
  contractedClosureType: teresaClosureTypeEnum,
  caseProfile: z.enum(['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING']).nullable().optional(),
  governanceTier: z.enum(['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED']).nullable().optional(),
  autonomyPolicy: z
    .enum(['ASK_EACH_ACTION', 'ASK_MATERIAL_ACTIONS', 'EXECUTE_APPROVED_PLAN'])
    .nullable()
    .optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
});

const teresaConversationParams = z.object({ conversationId: z.string().trim().min(1) });

const teresaConfirmBody = z.object({
  confirmedDigest: z
    .string()
    .trim()
    .regex(/^sha256:[0-9a-f]{64}$/, 'confirmedDigest must be sha256:<64 hex chars>'),
});

/**
 * POST /case-intake/conversations/:conversationId/summary
 *
 * "Here is exactly what I understood you want." Records that this summary was
 * SHOWN and returns it with its digest. Creates ZERO Cases and ZERO Runs.
 * 200, not 201 — nothing was created.
 */
router.post(
  '/case-intake/conversations/:conversationId/summary',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const workOrder = parseBody(teresaWorkOrderBody, req.body);

    const proposal = await caseIntakeService.proposeConversationWorkOrder({
      conversationId,
      workOrder: { ...workOrder, organizationId: actor.organizationId },
      proposedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(200).json({
      data: {
        conversationId,
        // The digested object, not the request body.
        workOrder: proposal.workOrder,
        workOrderId: proposal.workOrderId,
        workOrderDigest: proposal.workOrderDigest,
        alreadyProposed: proposal.alreadyProposed,
        runStartPolicy: proposal.runStartPolicy,
        caseCreated: false,
        runCreated: false,
      },
      meta: teresaMeta({ action: 'case_intake_work_order_proposed' }),
    });
  })
);

/** GET /case-intake/conversations/:conversationId/work-order — current summary. */
router.get(
  '/case-intake/conversations/:conversationId/work-order',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const current = await caseIntakeService.getCurrentConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: current, meta: teresaMeta({ action: 'case_intake_current' }) });
  })
);

/**
 * POST /case-intake/conversations/:conversationId/confirm
 * 201 when this call created the Case, 200 on any reuse (refresh, retry, race).
 */
router.post(
  '/case-intake/conversations/:conversationId/confirm',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const body = parseBody(teresaConfirmBody, req.body);

    const result = await caseIntakeService.confirmConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      confirmedDigest: body.confirmedDigest,
      confirmedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(result.caseCreated ? 201 : 200).json({
      data: result,
      meta: teresaMeta({ action: 'case_intake_work_order_confirmed' }),
    });
  })
);

/** GET /case-intake/conversations/:conversationId/case — conversation -> Case. */
router.get(
  '/case-intake/conversations/:conversationId/case',
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const link = await caseIntakeService.findCaseForConversation({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: link, meta: teresaMeta({ action: 'case_intake_link' }) });
  })
);

/** GET /case-intake/cases/:caseId/conversation — Case -> conversation. */
router.get(
  '/case-intake/cases/:caseId/conversation',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const link = await caseIntakeService.findConversationForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: link, meta: teresaMeta({ action: 'case_intake_link' }) });
  })
);

// ---------------------------------------------------------------------------
// GET /contract
// ---------------------------------------------------------------------------

router.get(
  '/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        contract_id: P08_COPILOT_CONTRACT,
        handoff_targets: P08_HANDOFF_TARGETS,
        common_payload_fields: [...P08_COMMON_PAYLOAD_FIELDS],
        envelope_states: [...P08_ACTION_ENVELOPE_STATES],
        envelope_transitions: P08_ACTION_ENVELOPE_TRANSITIONS,
        envelope_rules: P08_ACTION_ENVELOPE_RULES,
        voice_posture: P08_VOICE_POSTURE,
        citation_posture: P08_CITATION_POSTURE,
        anna_boundary: P08_ANNA_BOUNDARY,
        write_ownership: P08_WRITE_OWNERSHIP,
        anti_duplicate_rules: P08_ANTI_DUPLICATE_RULES,
        degraded_scenarios: P08_DEGRADED_SCENARIOS,
        acceptance_checklist: P08_ACCEPTANCE_CHECKLIST,
      },
      meta: teresaMeta(),
    });
  })
);

export default router;
