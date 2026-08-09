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

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
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
