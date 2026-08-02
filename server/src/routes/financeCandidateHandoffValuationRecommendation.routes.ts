/**
 * FIN-06 — Valuation Advisory Recommendation -> canonical Candidate handoff
 * routes.
 *
 * NOT mounted here — central mounting (Gateway.ts) happens in a later,
 * separate step owned outside this file's scope. This module only defines
 * the router.
 *
 * Three endpoints, mirroring `interviewCandidateHandoff.routes.ts`'s shape:
 *   GET  /:recommendationId/preview  — read-only preview
 *   POST /:recommendationId/confirm  — explicit confirm (writes)
 *   GET  /:recommendationId          — lineage read-back
 *
 * Auth: `verifyToken` only, same gate the existing
 * `POST /valuations/:id/advisory/:recommendationId/convert-to-initiative`
 * route (`economics.routes.ts`) already uses for this exact action — no new
 * permission key introduced.
 */
import type { Response } from 'express';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  confirmValuationRecommendationCandidateHandoff,
  getValuationRecommendationCandidateHandoff,
  previewValuationRecommendationCandidate,
} from '../services/finance/financeValuationRecommendationCandidateHandoff.js';
import { FinanceCandidateHandoffError } from '../services/finance/financeCandidateHandoffCore.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireOrgAndUser(req: AuthRequest): { organizationId: string; userId: string } {
  const organizationId = req.user?.organizationId || (req.user as any)?.organization_id;
  const userId = req.user?.id || (req.user as any)?.user_id;
  if (!organizationId || !userId) {
    const err = new Error('Unauthorized') as Error & { status?: number; code?: string };
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { organizationId, userId };
}

function mapError(err: unknown): { status: number; body: Record<string, unknown> } | null {
  if (err instanceof FinanceCandidateHandoffError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }
  if (err instanceof Error && (err as any).status === 401) {
    return { status: 401, body: { error: err.message, code: (err as any).code || 'UNAUTHORIZED' } };
  }
  return null;
}

router.get(
  '/:recommendationId/preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId } = requireOrgAndUser(req);
      const recommendationId = String(req.params.recommendationId || '');
      const preview = await previewValuationRecommendationCandidate({
        organizationId,
        recommendationId,
      });
      return res.json({ data: preview });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.post(
  '/:recommendationId/confirm',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId, userId } = requireOrgAndUser(req);
      const recommendationId = String(req.params.recommendationId || '');
      const result = await confirmValuationRecommendationCandidateHandoff({
        organizationId,
        recommendationId,
        createdBy: userId,
      });
      return res.status(result.created ? 201 : 200).json({ data: result });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.get(
  '/:recommendationId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId } = requireOrgAndUser(req);
      const recommendationId = String(req.params.recommendationId || '');
      const handoff = await getValuationRecommendationCandidateHandoff({
        organizationId,
        recommendationId,
      });
      if (!handoff) {
        return res.status(404).json({
          error: 'No candidate handoff exists yet for this valuation recommendation',
          code: 'NO_CANDIDATE_HANDOFF',
        });
      }
      return res.json({ data: handoff });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

export default router;
