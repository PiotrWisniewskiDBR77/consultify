import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { evaluateTransformationCaseLive } from '../../services/v8/agentQualityEvaluationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get(
  '/transformation-cases/:transformationCaseId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId ?? '').trim();
    if (!transformationCaseId) {
      return res.status(400).json({ code: 'TRANSFORMATION_CASE_ID_REQUIRED' });
    }
    const data = await evaluateTransformationCaseLive({ transformationCaseId, organizationId });
    if (!data) {
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    }
    return res.json({ data, meta: { version: 'v8', source: 'canonical_live_readback' } });
  })
);

export default router;
