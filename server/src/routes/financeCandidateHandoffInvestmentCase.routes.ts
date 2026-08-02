/**
 * FIN-06 — Finance Investment Case (`financial_models`, approved) ->
 * canonical Candidate handoff routes.
 *
 * Route shape/response envelopes/`mapError` copied verbatim in spirit from
 * `interviewCandidateHandoff.routes.ts` (INT-08's sibling router) — same
 * pattern, this domain's own auth. Intended mount point (done centrally,
 * NOT by this file): `/api/finance/candidate-handoff/investment-case`,
 * alongside `/api/interview/candidate-handoff`.
 *
 * Auth: this repo's Finance routes (`v8/finance.routes.ts`,
 * `financial-modeling.routes.ts`) do not use fine-grained
 * `requirePermission` gates — they resolve org/user straight off the
 * session (`req.user`, `AuthenticatedRequest`), same as
 * `interviewCandidateHandoff.routes.ts` itself. This router follows the
 * same convention: no new permission key introduced, whichever
 * verifyToken-equivalent already runs ahead of this router populates
 * `req.user`.
 *
 *   GET  /:modelId/preview  — read-only preview
 *   POST /:modelId/confirm  — explicit confirm (writes)
 *   GET  /:modelId          — lineage read-back
 */
import type { Response } from 'express';
import { Router } from 'express';

import { FinanceCandidateHandoffError } from '../services/finance/financeCandidateHandoffCore.js';
import {
  confirmInvestmentCaseCandidateHandoff,
  getInvestmentCaseCandidateHandoff,
  previewInvestmentCaseCandidate,
} from '../services/finance/financeInvestmentCaseCandidateHandoff.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireUser(req: AuthenticatedRequest) {
  const user = req.user;
  if (!user) throw new Error('Unauthorized');
  return user;
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
  return null;
}

router.get(
  '/:modelId/preview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const modelId = String(req.params.modelId || '');
    try {
      const preview = await previewInvestmentCaseCandidate({
        organizationId: user.organizationId,
        modelId,
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
  '/:modelId/confirm',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const modelId = String(req.params.modelId || '');
    try {
      const result = await confirmInvestmentCaseCandidateHandoff({
        organizationId: user.organizationId,
        modelId,
        createdBy: user.id,
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
  '/:modelId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const modelId = String(req.params.modelId || '');
    const handoff = await getInvestmentCaseCandidateHandoff({
      organizationId: user.organizationId,
      modelId,
    });
    if (!handoff) {
      return res.status(404).json({
        error: 'No candidate handoff exists yet for this investment case',
        code: 'NO_CANDIDATE_HANDOFF',
      });
    }
    return res.json({ data: handoff });
  })
);

export default router;
