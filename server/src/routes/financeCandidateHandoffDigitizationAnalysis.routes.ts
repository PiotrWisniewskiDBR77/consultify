import type { Response } from 'express';
import { Router } from 'express';

import { FinanceCandidateHandoffError } from '../services/finance/financeCandidateHandoffCore.js';
import {
  confirmDigitizationAnalysisCandidateHandoff,
  getDigitizationAnalysisCandidateHandoff,
  previewDigitizationAnalysisCandidate,
} from '../services/finance/financeDigitizationAnalysisCandidateHandoff.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) throw new Error('Unauthorized');
  return req.user;
}

function mapError(error: unknown) {
  if (!(error instanceof FinanceCandidateHandoffError)) return null;
  return {
    status: error.status,
    body: {
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

router.get(
  '/:analysisId/preview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const preview = await previewDigitizationAnalysisCandidate({
      organizationId: user.organizationId,
      analysisId: String(req.params.analysisId || ''),
    });
    return res.json({ data: preview });
  })
);

router.post(
  '/:analysisId/confirm',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    try {
      const result = await confirmDigitizationAnalysisCandidateHandoff({
        organizationId: user.organizationId,
        analysisId: String(req.params.analysisId || ''),
        createdBy: user.id,
      });
      return res.status(result.created ? 201 : 200).json({ data: result });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw error;
    }
  })
);

router.get(
  '/:analysisId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const handoff = await getDigitizationAnalysisCandidateHandoff({
      organizationId: user.organizationId,
      analysisId: String(req.params.analysisId || ''),
    });
    if (!handoff) {
      return res.status(404).json({
        error: 'No candidate handoff exists yet for this digitization analysis',
        code: 'NO_CANDIDATE_HANDOFF',
      });
    }
    return res.json({ data: handoff });
  })
);

export default router;
