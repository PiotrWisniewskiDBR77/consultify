import { Router } from 'express';
import type { Response } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import type { CandidateSource } from '../../services/v8/governedRetrievalService.js';
import * as governedRetrievalService from '../../services/v8/governedRetrievalService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

function parseLimit(raw: unknown, fallback: number = 50): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function handleRetrievalError(err: unknown, res: Response, fallbackMessage: string): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof Error && err.message.includes('not found')) {
    return res.status(404).json({
      error: err.message,
      code: 'RESOURCE_NOT_FOUND',
    });
  }

  return null;
}

async function ensureRequestExists(requestId: string, organizationId: string, res: Response) {
  const request = await governedRetrievalService.getRequest(requestId, organizationId);
  if (!request) {
    res.status(404).json({
      error: `Retrieval request ${requestId} not found`,
      code: 'REQUEST_NOT_FOUND',
    });
    return null;
  }
  return request;
}

router.get(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const limit = parseLimit(req.query.limit);

    const data = await governedRetrievalService.getRequestsByOrg(organizationId, limit);
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.post(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await governedRetrievalService.createRetrievalRequest({
        ...req.body,
        organizationId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleRetrievalError(err, res, 'Invalid retrieval request parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/requests/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    return res.json({ data: requestRecord, meta: { version: 'v8' } });
  }),
);

router.post(
  '/requests/:requestId/pipeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    const sources = req.body?.sources;
    if (!Array.isArray(sources)) {
      return res.status(400).json({
        error: 'sources must be an array',
        code: 'VALIDATION_ERROR',
      });
    }

    const pipeline = await governedRetrievalService.runPipeline(
      requestRecord,
      sources as CandidateSource[],
    );

    return res.json({
      data: {
        request: requestRecord,
        pipeline,
      },
      meta: { version: 'v8' },
    });
  }),
);

router.post(
  '/requests/:requestId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    try {
      const data = await governedRetrievalService.logRetrievalTrace({
        ...req.body,
        requestId: req.params.requestId,
        organizationId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleRetrievalError(err, res, 'Invalid retrieval trace parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/requests/:requestId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    const data = await governedRetrievalService.getTracesByRequest(req.params.requestId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.get(
  '/conversations/:conversationId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await governedRetrievalService.getTracesByConversation(
      req.params.conversationId,
      organizationId,
    );
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.get(
  '/snapshots/:snapshotId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await governedRetrievalService.getTracesBySnapshot(req.params.snapshotId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

export default router;
