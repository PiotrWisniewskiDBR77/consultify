import type { Response } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { evaluateRetrievalPolicyDecision } from '../../services/ai/chatPolicyGateway.js';
import type { CandidateSource } from '../../services/v8/governedRetrievalService.js';
import * as governedRetrievalService from '../../services/v8/governedRetrievalService.js';
import * as knowledgeRetrievalService from '../../services/v8/knowledgeRetrievalService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

function parseLimit(raw: unknown, fallback: number = 50): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function handleRetrievalError(
  err: unknown,
  res: Response,
  fallbackMessage: string
): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
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
  })
);

router.post(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const polResult = await evaluateRetrievalPolicyDecision({
        consumerClass: req.body?.consumerClass || 'chat',
        organizationId,
        userId,
        query: String(req.body?.query || ''),
      });
      if (polResult.decision.allowed === false) {
        return res.status(403).json({
          error: polResult.decision.rationale || 'Request refused by policy gateway',
          code: 'POLICY_GATEWAY_REFUSED',
        });
      }
    } catch (polErr: any) {
      logger.error(
        '[V8 Retrieval] Policy gateway unavailable (fail-closed):',
        polErr?.message || String(polErr)
      );
      return res.status(503).json({
        error: 'Policy gateway unavailable',
        code: 'POLICY_GATEWAY_UNAVAILABLE',
      });
    }

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
  })
);

router.get(
  '/requests/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    return res.json({ data: requestRecord, meta: { version: 'v8' } });
  })
);

router.post(
  '/requests/:requestId/pipeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    try {
      const polResult = await evaluateRetrievalPolicyDecision({
        consumerClass: 'chat',
        organizationId,
        userId,
        query: '',
      });
      if (polResult.decision.allowed === false) {
        return res.status(403).json({
          error: polResult.decision.rationale || 'Request refused by policy gateway',
          code: 'POLICY_GATEWAY_REFUSED',
        });
      }
    } catch (polErr: any) {
      logger.error(
        '[V8 Retrieval] Policy gateway unavailable (fail-closed):',
        polErr?.message || String(polErr)
      );
      return res.status(503).json({
        error: 'Policy gateway unavailable',
        code: 'POLICY_GATEWAY_UNAVAILABLE',
      });
    }

    const sources = req.body?.sources;
    if (!Array.isArray(sources)) {
      return res.status(400).json({
        error: 'sources must be an array',
        code: 'VALIDATION_ERROR',
      });
    }

    const pipeline = await governedRetrievalService.runPipeline(
      requestRecord,
      sources as CandidateSource[]
    );

    return res.json({
      data: {
        request: requestRecord,
        pipeline,
      },
      meta: { version: 'v8' },
    });
  })
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
  })
);

router.get(
  '/requests/:requestId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const requestRecord = await ensureRequestExists(req.params.requestId, organizationId, res);
    if (!requestRecord) return;

    const data = await governedRetrievalService.getTracesByRequest(
      req.params.requestId,
      organizationId
    );
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/conversations/:conversationId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await governedRetrievalService.getTracesByConversation(
      req.params.conversationId,
      organizationId
    );
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/snapshots/:snapshotId/traces',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await governedRetrievalService.getTracesBySnapshot(
      req.params.snapshotId,
      organizationId
    );
    return res.json({ data, meta: { version: 'v8' } });
  })
);

// ==========================================
// Working memory + promotion (P34-B)
// ==========================================

const CreateWorkingMemoryEntryBodySchema = z.object({
  conversationId: z.string().uuid(),
  memoryType: z.enum(['ephemeral', 'session', 'user_private_durable', 'organization_durable']),
  content: z.string().min(1).max(20_000),
  sourceRef: z.string().max(500).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

const RequestPromotionBodySchema = z.object({
  sourceEntryId: z.string().uuid(),
  targetMemoryType: z.enum(['user_private_durable', 'organization_durable']),
  provenanceRef: z.string().min(1).max(500),
});

const ResolvePromotionBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

function isPromotionReviewerRole(userRole?: string, isSuperAdmin?: boolean): boolean {
  if (isSuperAdmin) return true;
  const role = String(userRole || '').toUpperCase();
  return role.includes('ADMIN') || role === 'OWNER' || role === 'SUPERADMIN';
}

router.get(
  '/memory/entries',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const conversationId = String(req.query.conversationId || '').trim();
    if (!conversationId) {
      return res.status(400).json({
        error: 'conversationId query parameter is required',
        code: 'MISSING_QUERY_PARAM',
      });
    }

    const data = await knowledgeRetrievalService.getWorkingMemory(conversationId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/memory/entries',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const body = CreateWorkingMemoryEntryBodySchema.parse(req.body || {});
      const data = await knowledgeRetrievalService.createWorkingMemoryEntry({
        conversationId: body.conversationId,
        organizationId,
        memoryType: body.memoryType,
        content: body.content,
        sourceRef: body.sourceRef ?? null,
        expiresAt: body.expiresAt ?? null,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleRetrievalError(err, res, 'Invalid working memory entry parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/memory/promotions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    try {
      const body = RequestPromotionBodySchema.parse(req.body || {});
      const data = await knowledgeRetrievalService.requestMemoryPromotion({
        organizationId,
        sourceEntryId: body.sourceEntryId,
        targetMemoryType: body.targetMemoryType,
        provenanceRef: body.provenanceRef,
        requestedBy: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleRetrievalError(err, res, 'Invalid promotion request parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/memory/promotions/:requestId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole, isSuperAdmin } = getV8Context(req);
    if (!isPromotionReviewerRole(userRole, isSuperAdmin)) {
      return res.status(403).json({
        error: 'Insufficient permissions to resolve promotions',
        code: 'PROMOTION_REVIEW_FORBIDDEN',
      });
    }

    const requestId = String(req.params.requestId || '').trim();
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid requestId', code: 'VALIDATION_ERROR' });
    }

    try {
      const body = ResolvePromotionBodySchema.parse(req.body || {});
      const data = await knowledgeRetrievalService.resolveMemoryPromotion(
        requestId,
        body.status,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleRetrievalError(err, res, 'Invalid promotion resolution parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

export default router;
