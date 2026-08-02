/**
 * FIN-06 — Statement Pack (Finance) -> canonical Candidate handoff routes.
 *
 * NOT mounted here — a later packet wires this into `Gateway.ts` alongside
 * the two sibling Finance source-type adapters (Investment Case / Valuation
 * Recommendation). This file only defines the router.
 *
 * Three endpoints, mirroring `interviewCandidateHandoff.routes.ts`'s shape:
 *   GET  /:packId/preview  — read-only preview
 *   POST /:packId/confirm  — explicit confirm (writes)
 *   GET  /:packId          — lineage read-back
 *
 * Auth: `verifyToken` + `isAuthenticated`, matching every other route in the
 * Finance Statement Pack surface (`finance-statements.routes.ts`'s
 * `GET /packs/:id` etc.) — no new permission capability introduced.
 */
import type { Response } from 'express';
import { Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  confirmStatementPackCandidateHandoff,
  FinanceCandidateHandoffError,
  getFinanceCandidateHandoff,
  previewStatementPackCandidate,
} from '../services/finance/financeStatementPackCandidateHandoff.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken, isAuthenticated);

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
  '/:packId/preview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const packId = String(req.params.packId || '');
    try {
      const preview = await previewStatementPackCandidate({
        organizationId: user.organizationId,
        packId,
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
  '/:packId/confirm',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const packId = String(req.params.packId || '');
    try {
      const result = await confirmStatementPackCandidateHandoff({
        organizationId: user.organizationId,
        packId,
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
  '/:packId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const packId = String(req.params.packId || '');
    const handoff = await getFinanceCandidateHandoff({
      organizationId: user.organizationId,
      sourceType: 'finance_statement_pack',
      sourceId: packId,
    });
    if (!handoff) {
      return res.status(404).json({
        error: 'No candidate handoff exists yet for this statement pack',
        code: 'NO_CANDIDATE_HANDOFF',
      });
    }
    return res.json({ data: handoff });
  })
);

export default router;
