import type { Request, Response } from 'express';

import AssessmentEvidenceService from '../services/AssessmentEvidenceService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AssessmentEvidenceController {
  getEvidence = asyncHandler(async (req: Request, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const items = await AssessmentEvidenceService.getEvidenceForAssessment(assessmentId);
    res.json({ evidence: items });
  });

  upsertEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const { frameworkId, dimensionId, currentScore, targetScore, evidenceText, attachments } =
      req.body;
    if (!frameworkId || !dimensionId)
      return res.status(400).json({ error: 'frameworkId and dimensionId are required' });

    const result = await AssessmentEvidenceService.upsertEvidence({
      assessmentId,
      frameworkId,
      dimensionId,
      currentScore,
      targetScore,
      evidenceText,
      attachments,
    });
    res.json({ evidence: result });
  });

  getEvidenceReport = asyncHandler(async (req: Request, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const report = await AssessmentEvidenceService.getEvidenceReport(assessmentId);
    res.json(report);
  });
}

export default new AssessmentEvidenceController();
