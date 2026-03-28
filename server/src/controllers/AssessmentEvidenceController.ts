import type { Request, Response } from 'express';

import AssessmentEvidenceService from '../services/AssessmentEvidenceService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AssessmentEvidenceController {
  getEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const context = await AssessmentEvidenceService.getAssessmentContext(
      assessmentId,
      organizationId
    );
    if (!context) return res.status(404).json({ error: 'Assessment not found' });

    const items = await AssessmentEvidenceService.getEvidenceForAssessment(
      assessmentId,
      organizationId
    );
    res.json({ evidence: items });
  });

  upsertEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const { frameworkId, dimensionId, currentScore, targetScore, evidenceText, attachments } =
      req.body;
    if (!frameworkId || !dimensionId)
      return res.status(400).json({ error: 'frameworkId and dimensionId are required' });

    try {
      const existingItems = await AssessmentEvidenceService.getEvidenceForAssessment(
        assessmentId,
        organizationId
      );
      const before = existingItems.find(
        (item) => item.frameworkId === frameworkId && item.dimensionId === dimensionId
      );

      const result = await AssessmentEvidenceService.upsertEvidence({
        organizationId,
        assessmentId,
        frameworkId,
        dimensionId,
        currentScore,
        targetScore,
        evidenceText,
        attachments,
      });
      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: before ? 'update' : 'create',
        resourceType: 'assessment_evidence',
        resourceId: `${assessmentId}:${frameworkId}:${dimensionId}`,
        before: before
          ? {
              currentScore: before.currentScore,
              targetScore: before.targetScore,
              evidenceStatus: before.evidenceStatus,
            }
          : undefined,
        after: {
          currentScore: result.currentScore,
          targetScore: result.targetScore,
          evidenceStatus: result.evidenceStatus,
        },
        metadata: { assessmentId, frameworkId, dimensionId },
      });
      res.json({ evidence: result });
    } catch (error: any) {
      if (error?.message === 'ASSESSMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Assessment not found' });
      }
      if (error?.message === 'FRAMEWORK_MISMATCH') {
        return res.status(400).json({ error: 'frameworkId does not match assessment type' });
      }
      throw error;
    }
  });

  getEvidenceReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const assessmentId = (req.params as any)?.assessmentId;
    if (!assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const report = await AssessmentEvidenceService.getEvidenceReport(
        assessmentId,
        organizationId
      );
      res.json(report);
    } catch (error: any) {
      if (error?.message === 'ASSESSMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Assessment not found' });
      }
      throw error;
    }
  });
}

export default new AssessmentEvidenceController();
