/**
 * P12-B — Mindmap V8 HTTP surface
 *
 * Mounted at `/api/v8/mindmap`.
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import type { MindmapAIProposal } from '../../services/v8/mindmapService.js';
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
