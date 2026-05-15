/**
 * P14-B — Process Flow HTTP surface
 *
 * Mounted at `/api/v8/process-flow`.
 *
 * Endpoints:
 *   GET  /contract                          — P14 canon metadata
 *   GET  /:processId/objects                — Full graph (nodes + edges)
 *   POST /:processId/nodes                  — Create a node
 *   PUT  /nodes/:nodeId/label               — Update node label
 *   PUT  /nodes/:nodeId/move                — Move node position
 *   PUT  /nodes/:nodeId/gateway-kind        — Set gateway kind
 *   PUT  /nodes/:nodeId/lane                — Set lane assignment
 *   DELETE /nodes/:nodeId                   — Delete node + connected edges
 *   POST /:processId/edges                  — Create edge (connect)
 *   PUT  /edges/:edgeId/label               — Update edge label
 *   DELETE /edges/:edgeId                   — Delete edge
 *   POST /:processId/validate               — Run 2-layer validation
 *   GET  /:processId/readback               — Semantic readback
 *   GET  /:processId/export/:format         — Export (json | readback)
 *   POST /:processId/ai-proposals           — Create AI proposal (preview)
 *   GET  /ai-proposals/:proposalId          — Get AI proposal
 *   POST /ai-proposals/:proposalId/resolve  — Accept/reject AI proposal
 *   GET  /:processId/health                 — Degraded state check
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import {
  isValidSemanticObject,
  P14_ACCEPTANCE_CHECKLIST,
  P14_AI_PROPOSAL_RULES,
  P14_ANTI_DUPLICATE_RULES,
  P14_BPMN_INTEROP_POSTURE,
  P14_DEGRADED_SCENARIOS,
  P14_SEMANTIC_OBJECTS,
  P14_TOOLBELT,
  P14_VALIDATION_LAYERS,
  P14_VALIDATION_RULES,
} from '../../services/v8/processFlowCanon.js';
import type {
  AIProposalOperation,
  ValidationResult,
} from '../../services/v8/processFlowService.js';
import * as pfService from '../../services/v8/processFlowService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

const HTTP = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
} as const;

const MAX_ID_LENGTH = 128;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_LABEL_LENGTH = 4000;

function pfMeta(extra?: Record<string, unknown>) {
  return { version: 'v8' as const, surface: 'process_flow' as const, ...extra };
}

function opStatus(code?: string): number {
  if (code === 'TABLE_MISSING') return HTTP.SERVICE_UNAVAILABLE;
  if (code === 'NOT_FOUND') return HTTP.NOT_FOUND;
  if (code === 'INVALID_MESSAGE_FLOW' || code === 'INVALID_STATE') return HTTP.CONFLICT;
  return HTTP.BAD_REQUEST;
}

function isValidSafeId(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    SAFE_ID_PATTERN.test(value)
  );
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// ---------------------------------------------------------------------------
// GET /contract — P14 canon (static)
// ---------------------------------------------------------------------------

router.get(
  '/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        semanticObjects: P14_SEMANTIC_OBJECTS,
        bpmnInteropPosture: P14_BPMN_INTEROP_POSTURE,
        validationLayers: P14_VALIDATION_LAYERS,
        validationRules: P14_VALIDATION_RULES,
        toolbelt: P14_TOOLBELT,
        aiProposalRules: P14_AI_PROPOSAL_RULES,
        antiDuplicateRules: P14_ANTI_DUPLICATE_RULES,
        degradedScenarios: P14_DEGRADED_SCENARIOS,
        acceptanceChecklist: P14_ACCEPTANCE_CHECKLIST,
      },
      meta: pfMeta({ contract: 'P14' }),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /:processId/objects — full graph
// ---------------------------------------------------------------------------

router.get(
  '/:processId/objects',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await pfService.getProcessObjects(req.params.processId, organizationId);
    return res.json({ data: result, meta: pfMeta({ degraded: result.degraded }) });
  })
);

// ---------------------------------------------------------------------------
// POST /:processId/nodes — create node
// ---------------------------------------------------------------------------

router.post(
  '/:processId/nodes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.processId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid processId', code: 'VALIDATION', meta: pfMeta() });
    }
    const body = req.body ?? {};
    if (!body.object_type || !isValidSemanticObject(body.object_type)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Valid object_type required', code: 'VALIDATION', meta: pfMeta() });
    }
    if (
      (body.position_x !== undefined && !isFiniteNumber(body.position_x)) ||
      (body.position_y !== undefined && !isFiniteNumber(body.position_y))
    ) {
      return res.status(HTTP.BAD_REQUEST).json({
        error: 'position_x and position_y must be finite numbers',
        code: 'VALIDATION',
        meta: pfMeta(),
      });
    }

    const label = typeof body.label === 'string' ? body.label.slice(0, MAX_LABEL_LENGTH) : '';
    const result = await pfService.createNode(req.params.processId, organizationId, {
      object_type: body.object_type,
      label,
      lane_id: body.lane_id,
      pool_id: body.pool_id,
      parent_subprocess_id: body.parent_subprocess_id,
      position_x: body.position_x,
      position_y: body.position_y,
      gateway_kind: body.gateway_kind,
    });
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res
      .status(HTTP.CREATED)
      .json({ data: result, meta: pfMeta({ action: 'node_created' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/label
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/label',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.nodeId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid nodeId', code: 'VALIDATION', meta: pfMeta() });
    }
    const label = req.body?.label;
    if (typeof label !== 'string') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'label required', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.updateNodeLabel(
      req.params.nodeId,
      organizationId,
      label.slice(0, MAX_LABEL_LENGTH)
    );
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'label_updated' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/move
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/move',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.nodeId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid nodeId', code: 'VALIDATION', meta: pfMeta() });
    }
    const x = req.body?.position_x;
    const y = req.body?.position_y;
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'position_x and position_y required', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.moveNode(req.params.nodeId, organizationId, { x, y });
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'node_moved' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/gateway-kind
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/gateway-kind',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const kind = req.body?.gateway_kind;
    if (kind !== 'xor' && kind !== 'and') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: "gateway_kind must be 'xor' or 'and'", code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.setGatewayKind(req.params.nodeId, organizationId, kind);
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'gateway_kind_set' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/lane
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/lane',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.nodeId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid nodeId', code: 'VALIDATION', meta: pfMeta() });
    }
    const laneRaw = req.body?.lane_id;
    if (laneRaw !== undefined && laneRaw !== null && typeof laneRaw !== 'string') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'lane_id must be a string or null', code: 'VALIDATION', meta: pfMeta() });
    }
    const laneId = toTrimmedString(laneRaw) ?? null;
    const result = await pfService.setLane(req.params.nodeId, organizationId, laneId);
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'lane_set' }) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /nodes/:nodeId
// ---------------------------------------------------------------------------

router.delete(
  '/nodes/:nodeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await pfService.deleteNode(req.params.nodeId, organizationId);
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'node_deleted' }) });
  })
);

// ---------------------------------------------------------------------------
// POST /:processId/edges — create edge (connect)
// ---------------------------------------------------------------------------

router.post(
  '/:processId/edges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.processId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid processId', code: 'VALIDATION', meta: pfMeta() });
    }
    const body = req.body ?? {};
    const sourceNodeId = toTrimmedString(body.source_node_id);
    const targetNodeId = toTrimmedString(body.target_node_id);
    if (!sourceNodeId || !targetNodeId) {
      return res.status(HTTP.BAD_REQUEST).json({
        error: 'source_node_id and target_node_id required',
        code: 'VALIDATION',
        meta: pfMeta(),
      });
    }
    const result = await pfService.createEdge(req.params.processId, organizationId, {
      edge_type: body.edge_type ?? 'sequence_flow',
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      label: typeof body.label === 'string' ? body.label.slice(0, MAX_LABEL_LENGTH) : body.label,
    });
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res
      .status(HTTP.CREATED)
      .json({ data: result, meta: pfMeta({ action: 'edge_created' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /edges/:edgeId/label
// ---------------------------------------------------------------------------

router.put(
  '/edges/:edgeId/label',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.edgeId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid edgeId', code: 'VALIDATION', meta: pfMeta() });
    }
    const label = req.body?.label;
    if (typeof label !== 'string') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'label required', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.updateEdgeLabel(
      req.params.edgeId,
      organizationId,
      label.slice(0, MAX_LABEL_LENGTH)
    );
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'edge_label_updated' }) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /edges/:edgeId
// ---------------------------------------------------------------------------

router.delete(
  '/edges/:edgeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await pfService.deleteEdge(req.params.edgeId, organizationId);
    if (!result.success)
      return res
        .status(opStatus(result.error_code))
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    return res.json({ data: result, meta: pfMeta({ action: 'edge_deleted' }) });
  })
);

// ---------------------------------------------------------------------------
// POST /:processId/validate — 2-layer validation
// ---------------------------------------------------------------------------

router.post(
  '/:processId/validate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.processId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid processId', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.validateProcess(req.params.processId, organizationId);

    organizationContextService
      .recordContextSource({
        organizationId,
        sourceType: 'tools.sessionOutput',
        sourceId: req.params.processId,
        authorUserId: req.user?.id ?? null,
        channel: 'process_flow_validate',
        sourceLabel: 'Process Flow Validation',
        content: {
          processId: req.params.processId,
          valid: result.valid,
          issueCount: result.errors.length + result.warnings.length,
        },
        metadata: { surface: 'process_flow', action: 'validate' },
      })
      .catch((err: unknown) => logger.warn('[ProcessFlow] context recording failed', err));

    return res.json({ data: result, meta: pfMeta({ action: 'validated', valid: result.valid }) });
  })
);

// ---------------------------------------------------------------------------
// GET /:processId/readback — semantic readback
// ---------------------------------------------------------------------------

router.get(
  '/:processId/readback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!isValidSafeId(req.params.processId)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'Invalid processId', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.semanticReadback(req.params.processId, organizationId);

    organizationContextService
      .recordContextSource({
        organizationId,
        sourceType: 'tools.sessionOutput',
        sourceId: req.params.processId,
        authorUserId: req.user?.id ?? null,
        channel: 'process_flow_readback',
        sourceLabel: 'Process Flow Readback',
        content: {
          processId: req.params.processId,
          readbackChars: typeof result === 'string' ? result.length : 0,
        },
        metadata: { surface: 'process_flow', action: 'readback' },
      })
      .catch((err: unknown) =>
        logger.warn('[ProcessFlow] context recording failed', {
          code: 'PROCESS_FLOW_CONTEXT_RECORD_FAILED',
          message: err instanceof Error ? err.message : 'unknown_error',
          channel: 'process_flow_readback',
        })
      );

    return res.json({ data: result, meta: pfMeta({ action: 'readback' }) });
  })
);

// ---------------------------------------------------------------------------
// GET /:processId/export/:format — export
// ---------------------------------------------------------------------------

router.get(
  '/:processId/export/:format',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const fmt = req.params.format;
    if (fmt !== 'json' && fmt !== 'readback') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: 'format must be json or readback', code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.exportProcess(req.params.processId, organizationId, fmt);
    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    return res.status(HTTP.OK).send(result.content);
  })
);

// ---------------------------------------------------------------------------
// POST /:processId/ai-proposals — create AI proposal (preview)
// ---------------------------------------------------------------------------

router.post(
  '/:processId/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const ops: AIProposalOperation[] = Array.isArray(body.operations) ? body.operations : [];
    const validationReport: ValidationResult = body.validation_report ?? {
      valid: true,
      layer: 'both',
      errors: [],
      warnings: [],
    };
    const riskFlags = body.risk_flags ?? { destructive_count: 0, branch_changes: 0 };

    const proposal = pfService.createAIProposal(req.params.processId, organizationId, {
      summary: typeof body.summary === 'string' ? body.summary : '',
      operations: ops,
      before_readback: typeof body.before_readback === 'string' ? body.before_readback : '',
      after_readback: typeof body.after_readback === 'string' ? body.after_readback : '',
      validation_report: validationReport,
      risk_flags: riskFlags,
    });
    return res
      .status(HTTP.CREATED)
      .json({ data: proposal, meta: pfMeta({ action: 'ai_proposal_created' }) });
  })
);

// ---------------------------------------------------------------------------
// GET /ai-proposals/:proposalId
// ---------------------------------------------------------------------------

router.get(
  '/ai-proposals/:proposalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const proposal = pfService.getAIProposal(req.params.proposalId, organizationId);
    if (!proposal) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ error: 'Proposal not found', code: 'NOT_FOUND', meta: pfMeta() });
    }
    return res.json({ data: proposal, meta: pfMeta() });
  })
);

// ---------------------------------------------------------------------------
// POST /ai-proposals/:proposalId/resolve — accept/reject
// ---------------------------------------------------------------------------

router.post(
  '/ai-proposals/:proposalId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const action = req.body?.action;
    if (action !== 'accept' && action !== 'reject') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ error: "action must be 'accept' or 'reject'", code: 'VALIDATION', meta: pfMeta() });
    }
    const result = await pfService.resolveAIProposal(req.params.proposalId, action, organizationId);
    if (!result.success) {
      const status =
        result.error_code === 'PROPOSAL_NOT_FOUND'
          ? HTTP.NOT_FOUND
          : result.error_code === 'INVALID_STATE'
            ? HTTP.CONFLICT
            : result.error_code === 'APPLY_FAILED'
              ? HTTP.SERVICE_UNAVAILABLE
              : HTTP.BAD_REQUEST;
      return res
        .status(status)
        .json({ error: result.error, code: result.error_code, meta: pfMeta() });
    }
    return res.json({
      data: result.proposal,
      meta: pfMeta({
        action: `proposal_${result.proposal?.status}`,
        applied: result.applied_count,
      }),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /:processId/health — degraded state
// ---------------------------------------------------------------------------

router.get(
  '/:processId/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const state = await pfService.getDegradedState(req.params.processId, organizationId);
    return res.json({ data: state, meta: pfMeta({ degraded: state.degraded }) });
  })
);

export default router;
