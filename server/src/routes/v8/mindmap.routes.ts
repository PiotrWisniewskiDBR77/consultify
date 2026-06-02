/**
 * P12-B — Mindmap V8 HTTP surface
 *
 * Mounted at `/api/v8/mindmap`.
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import type { MindmapNodeOperation } from '../../services/v8/mindmapCanon.js';
import {
  P12_ACCEPTANCE_CHECKLIST,
  P12_AI_COBUILDING_RULES,
  P12_CALM_LOOP_RULES,
  P12_DEGRADED_SCENARIOS,
  P12_EXPORT_FORMATS,
  P12_EXPORT_RULES,
  P12_NODE_KINDS,
  P12_NODE_OPERATIONS,
  P12_UNDO_REDO_RULES,
} from '../../services/v8/mindmapCanon.js';
import type {
  MindmapAIProposal,
  MindmapOperationResult,
} from '../../services/v8/mindmapService.js';
import * as mindmapService from '../../services/v8/mindmapService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const P12_MINDMAP_HTTP_STATUSES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
} as const;

const router = Router();

function mindmapMeta(extra?: Record<string, unknown>) {
  return { version: 'v8' as const, surface: 'mindmap' as const, ...extra };
}

function httpStatusForOpResult(r: MindmapOperationResult): number {
  if (r.success) return P12_MINDMAP_HTTP_STATUSES.OK;
  const c = r.error_code;
  if (
    c === 'INVALID_LABEL' ||
    c === 'ROOT_EXISTS' ||
    c === 'SIZE_LIMIT' ||
    c === 'VALIDATION_FAILED'
  ) {
    return P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST;
  }
  if (c === 'NOT_FOUND' || c === 'PARENT_NOT_FOUND' || c === 'PROPOSAL_NOT_FOUND') {
    return P12_MINDMAP_HTTP_STATUSES.NOT_FOUND;
  }
  if (c === 'CYCLE_DETECTED' || c === 'INVALID_STATE') {
    return P12_MINDMAP_HTTP_STATUSES.CONFLICT;
  }
  if (c === 'TABLE_MISSING' || c === 'DB_ERROR') {
    return P12_MINDMAP_HTTP_STATUSES.SERVICE_UNAVAILABLE;
  }
  return P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST;
}

function sendOpFailure(res: Response, r: MindmapOperationResult) {
  return res.status(httpStatusForOpResult(r)).json({
    error: r.error ?? 'Operation failed',
    code: r.error_code ?? 'UNKNOWN',
    meta: mindmapMeta({ degraded: r.error_code === 'TABLE_MISSING' }),
  });
}

function isMindmapOperation(value: unknown): value is MindmapNodeOperation {
  return typeof value === 'string' && (P12_NODE_OPERATIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// GET /contract — full P12 canon (static)
// ---------------------------------------------------------------------------

router.get(
  '/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        acceptanceChecklist: P12_ACCEPTANCE_CHECKLIST,
        degradedScenarios: P12_DEGRADED_SCENARIOS,
        nodeOperations: P12_NODE_OPERATIONS,
        nodeKinds: P12_NODE_KINDS,
        calmLoopRules: P12_CALM_LOOP_RULES,
        exportFormats: P12_EXPORT_FORMATS,
        exportRules: P12_EXPORT_RULES,
        aiCobuildingRules: P12_AI_COBUILDING_RULES,
        undoRedoRules: P12_UNDO_REDO_RULES,
      },
      meta: mindmapMeta({ contract: 'P12' }),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /ai-proposals/:proposalId/resolve
// ---------------------------------------------------------------------------

router.post(
  '/ai-proposals/:proposalId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const action = req.body?.action;
    if (action !== 'accept' && action !== 'reject') {
      return res.status(P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST).json({
        error: "action must be 'accept' or 'reject'",
        code: 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    const result = await mindmapService.resolveAIProposal(req.params.proposalId, action);
    if (!result.success) {
      const code = result.error_code ?? 'UNKNOWN';
      const status =
        code === 'PROPOSAL_NOT_FOUND'
          ? P12_MINDMAP_HTTP_STATUSES.NOT_FOUND
          : code === 'INVALID_STATE'
            ? P12_MINDMAP_HTTP_STATUSES.CONFLICT
            : code === 'TABLE_MISSING'
              ? P12_MINDMAP_HTTP_STATUSES.SERVICE_UNAVAILABLE
              : P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST;
      return res.status(status).json({
        error: result.error ?? 'Resolve failed',
        code,
        meta: mindmapMeta(),
      });
    }
    return res.json({
      data: result.proposal,
      meta: mindmapMeta({
        action: `proposal_${result.proposal?.status}`,
        applied: result.applied_count,
      }),
    });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/rename
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/rename',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const label = req.body?.label;
    const result = await mindmapService.renameNode(req.params.nodeId, organizationId, label);
    if (!result.success) return sendOpFailure(res, result);
    return res.json({ data: result, meta: mindmapMeta({ action: 'renamed' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/move
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/move',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const raw = req.body?.new_parent_id;
    if (raw !== null && (typeof raw !== 'string' || raw === '')) {
      return res.status(P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST).json({
        error: 'new_parent_id must be a non-empty string (target parent node id)',
        code: 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    if (typeof raw !== 'string') {
      return res.status(P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST).json({
        error: 'new_parent_id required',
        code: 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    const result = await mindmapService.moveNode(req.params.nodeId, organizationId, raw);
    if (!result.success) return sendOpFailure(res, result);
    return res.json({ data: result, meta: mindmapMeta({ action: 'moved' }) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /nodes/:nodeId
// ---------------------------------------------------------------------------

router.delete(
  '/nodes/:nodeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await mindmapService.deleteNode(req.params.nodeId, organizationId);
    if (!result.success) return sendOpFailure(res, result);
    return res.json({ data: result, meta: mindmapMeta({ action: 'deleted' }) });
  })
);

// ---------------------------------------------------------------------------
// PUT /nodes/:nodeId/collapse
// ---------------------------------------------------------------------------

router.put(
  '/nodes/:nodeId/collapse',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const result = await mindmapService.toggleCollapse(req.params.nodeId, organizationId);
    if (!result.success) return sendOpFailure(res, result);
    return res.json({ data: result, meta: mindmapMeta({ action: 'collapse_toggled' }) });
  })
);

// ---------------------------------------------------------------------------
// GET /:mindmapId/nodes
// ---------------------------------------------------------------------------

router.get(
  '/:mindmapId/nodes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { nodes, degraded } = await mindmapService.getNodes(req.params.mindmapId, organizationId);
    return res.json({
      data: nodes,
      meta: mindmapMeta({ degraded }),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /:mindmapId/nodes
// ---------------------------------------------------------------------------

router.post(
  '/:mindmapId/nodes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const result = await mindmapService.createNode(req.params.mindmapId, organizationId, {
      parent_id: body.parent_id,
      label: body.label,
      kind: body.kind,
    });
    if (!result.success) return sendOpFailure(res, result);
    return res.status(P12_MINDMAP_HTTP_STATUSES.CREATED).json({
      data: result,
      meta: mindmapMeta({ action: 'node_created' }),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /:mindmapId/export/:format
// ---------------------------------------------------------------------------

router.get(
  '/:mindmapId/export/:format',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const fmt = req.params.format;
    if (fmt !== 'json' && fmt !== 'markdown') {
      return res.status(P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST).json({
        error: 'format must be json or markdown',
        code: 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    const result = await mindmapService.exportMindmap(req.params.mindmapId, organizationId, fmt);
    res.setHeader(
      'Content-Type',
      fmt === 'json' ? 'application/json' : 'text/markdown; charset=utf-8'
    );
    return res.status(P12_MINDMAP_HTTP_STATUSES.OK).send(result.content);
  })
);

// ---------------------------------------------------------------------------
// POST /:mindmapId/ai-proposals
// ---------------------------------------------------------------------------

router.post(
  '/:mindmapId/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const mindmapId = req.params.mindmapId;
    const { summary, plan, operations, diff_summary } = req.body ?? {};
    const diff =
      diff_summary && typeof diff_summary === 'object' && !Array.isArray(diff_summary)
        ? (diff_summary as MindmapAIProposal['diff_summary'])
        : { added: 0, renamed: 0, moved: 0, deleted: 0, destructive: false };
    const ops = Array.isArray(operations) ? operations : [];
    const proposal = await mindmapService.createAIProposal(mindmapId, organizationId, {
      mindmap_id: mindmapId,
      summary: typeof summary === 'string' ? summary : '',
      plan: typeof plan === 'string' ? plan : '',
      operations: ops,
      diff_summary: diff,
    });
    return res.status(P12_MINDMAP_HTTP_STATUSES.CREATED).json({
      data: proposal,
      meta: mindmapMeta({ action: 'ai_proposal_created' }),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /:mindmapId/validate
// ---------------------------------------------------------------------------

router.post(
  '/:mindmapId/validate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { operation, node_id, params } = req.body ?? {};
    if (!isMindmapOperation(operation) || !node_id || typeof node_id !== 'string') {
      return res.status(P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST).json({
        error: 'operation (P12 op) and node_id required',
        code: 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    const p =
      params && typeof params === 'object' && !Array.isArray(params)
        ? {
            ...params,
            newParentId:
              (params as Record<string, unknown>).new_parent_id ??
              (params as Record<string, unknown>).newParentId,
          }
        : undefined;
    const vr = await mindmapService.validateOperation(
      operation,
      node_id,
      req.params.mindmapId,
      organizationId,
      p
    );
    if (!vr.valid) {
      const isCycle = vr.reason?.toLowerCase().includes('cycle');
      const status = isCycle
        ? P12_MINDMAP_HTTP_STATUSES.CONFLICT
        : vr.reason?.includes('not available')
          ? P12_MINDMAP_HTTP_STATUSES.SERVICE_UNAVAILABLE
          : P12_MINDMAP_HTTP_STATUSES.BAD_REQUEST;
      return res.status(status).json({
        error: vr.reason ?? 'Validation failed',
        code: isCycle ? 'CYCLE' : 'VALIDATION',
        meta: mindmapMeta(),
      });
    }
    return res.json({ data: { valid: true }, meta: mindmapMeta({ action: 'validated' }) });
  })
);

// ---------------------------------------------------------------------------
// GET /:mindmapId/health
// ---------------------------------------------------------------------------

router.get(
  '/:mindmapId/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const state = await mindmapService.getDegradedState(req.params.mindmapId, organizationId);
    return res.json({
      data: state,
      meta: mindmapMeta({ degraded: state.degraded }),
    });
  })
);

export default router;
