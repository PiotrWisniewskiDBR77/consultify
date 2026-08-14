import type { Response } from 'express';
import { Router } from 'express';
import { z, ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getCanonicalTransformationRun,
  reconcileCanonicalTransformationRun,
} from '../../services/v8/agentCanonicalRunService.js';
import * as transformationCaseService from '../../services/v8/transformationCaseService.js';
import * as transformationFinalOutputService from '../../services/v8/transformationFinalOutputService.js';
import * as planningIntakeService from '../../services/v8/transformationPlanningIntakeService.js';
import * as projectTeamService from '../../services/v8/transformationProjectTeamService.js';
import * as runtimeCapabilityService from '../../services/v8/transformationRuntimeCapabilityService.js';
import {
  AcceptBenefitsReviewSchema,
  AcceptDeliveryHandoffSchema,
  AcceptDrdResultsSchema,
  AcceptExecutionResultsSchema,
  AcceptExecutionStartSchema,
  AcceptFinanceKpiResultsSchema,
  AcceptInitiativeResultsSchema,
  AcceptInterviewResultsSchema,
  AcceptMobilizationResultsSchema,
  AcceptPortfolioDecisionResultsSchema,
  AcceptSustainabilityReviewSchema,
  ApproveTransformationPlanSchema,
  CancelTransformationCaseSchema,
  CreateTransformationCaseBodySchema,
  ProposeDrdAssessmentSchema,
  ProposeFinanceKpiPackSchema,
  ProposeInitialIdeasSchema,
  ProposeInterviewsSchema,
  ProposeMobilizationBlueprintSchema,
  ProposeOpportunitySynthesisSchema,
  ProposePortfolioDecisionSchema,
  ResolvePortfolioDecisionSchema,
  ReviewDrdAssessmentProposalSchema,
  ReviewFinanceKpiPackSchema,
  ReviewInitialIdeasProposalSchema,
  ReviewInterviewsProposalSchema,
  ReviewMobilizationBlueprintSchema,
  ReviewOpportunitySynthesisSchema,
  ReviewPortfolioDecisionSchema,
  ReviseTransformationCaseSchema,
} from '../../types/transformationCase.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { queryOne } from '../../utils/queryHelpers.js';

const router = Router();

const runtimeCapabilityRegistrationSchema = z.object({
  lifecycleStage: z.string().trim().min(1).max(100),
  capabilityKey: z.string().trim().min(1).max(200),
  ownerModule: z.string().trim().min(1).max(200),
  evidenceContract: z.object({
    requiredChecks: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  }),
});

const runtimeEvidenceSchema = z.object({
  lifecycleStage: z.string().trim().min(1).max(100),
  evidence: z.record(
    z.string().trim().min(1).max(100),
    z.object({
      passed: z.boolean(),
      evidenceRef: z.string().trim().min(1).max(1000).nullable().optional(),
      observedAt: z.string().datetime().nullable().optional(),
      detail: z.string().trim().max(2000).nullable().optional(),
    })
  ),
});

function isPrivileged(context: { userRole: string; isSuperAdmin: boolean }): boolean {
  if (context.isSuperAdmin) return true;
  return ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(String(context.userRole || '').toUpperCase());
}

function errorResponse(error: unknown, res: Response): Response | null {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid Transformation Case input',
      code: 'TRANSFORMATION_CASE_VALIDATION_ERROR',
      details: error.issues,
    });
  }
  if (error instanceof transformationCaseService.TransformationCaseOperationError) {
    return res.status(error.httpStatus).json({ error: error.message, code: error.code });
  }
  return null;
}

function publicFinalOutputRun(
  run: transformationFinalOutputService.TransformationFinalOutputRun
): Omit<transformationFinalOutputService.TransformationFinalOutputRun, 'docxPath' | 'pptxPath'> {
  return {
    runId: run.runId,
    transformationCaseId: run.transformationCaseId,
    caseVersion: run.caseVersion,
    factsDigest: run.factsDigest,
    docxSha256: run.docxSha256,
    pptxSha256: run.pptxSha256,
    generatedAt: run.generatedAt,
    idempotentReplay: run.idempotentReplay,
    native: run.native,
  };
}

async function canUseProject(params: {
  projectId: string;
  organizationId: string;
  userId: string;
  isSuperAdmin: boolean;
}): Promise<boolean> {
  if (params.isSuperAdmin) return true;
  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM projects p
      WHERE p.id = ?
        AND p.organization_id = ?
        AND (
          p.owner_id = ?
          OR EXISTS (
            SELECT 1 FROM project_members pm
             WHERE pm.project_id = p.id AND pm.user_id = ?
          )
        )
      LIMIT 1`,
    [params.projectId, params.organizationId, params.userId, params.userId]
  );
  return Boolean(row);
}

async function canSeeCase(
  transformationCase: { projectId: string | null; initiatedByUserId: string },
  context: ReturnType<typeof getV8Context>
): Promise<boolean> {
  if (isPrivileged(context) || transformationCase.initiatedByUserId === context.userId) return true;
  if (!transformationCase.projectId) return false;
  return canUseProject({
    projectId: transformationCase.projectId,
    organizationId: context.organizationId,
    userId: context.userId,
    isSuperAdmin: context.isSuperAdmin,
  });
}

router.post(
  '/planning-intakes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 256)
      return res.status(400).json({ code: 'TRANSFORMATION_CASE_IDEMPOTENCY_KEY_REQUIRED' });
    const body = req.body ?? {};
    if (
      body.projectId &&
      !(await canUseProject({
        projectId: String(body.projectId),
        organizationId: context.organizationId,
        userId: context.userId,
        isSuperAdmin: context.isSuperAdmin,
      }))
    )
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_PROJECT_NOT_FOUND' });
    try {
      const data = await planningIntakeService.startPlanningIntake({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        idempotencyKey,
        mandate: String(body.mandate ?? ''),
        projectId: body.projectId ?? null,
        conversationId: body.conversationId ?? null,
        measurableOutcomes: body.measurableOutcomes,
        sponsor: body.sponsor,
        scope: body.scope,
        horizon: body.horizon,
      });
      return res
        .status(data.idempotentReplay ? 200 : 201)
        .json({ data, meta: { version: 'v8', idempotentReplay: data.idempotentReplay } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/planning-intakes/from-template',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 256)
      return res.status(400).json({ code: 'TRANSFORMATION_CASE_IDEMPOTENCY_KEY_REQUIRED' });
    const body = req.body ?? {};
    if (
      body.projectId &&
      !(await canUseProject({
        projectId: String(body.projectId),
        organizationId: context.organizationId,
        userId: context.userId,
        isSuperAdmin: context.isSuperAdmin,
      }))
    )
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_PROJECT_NOT_FOUND' });
    try {
      const data = await planningIntakeService.startPlanningIntakeFromTemplate({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        idempotencyKey,
        templateId: String(body.templateId ?? ''),
        projectId: body.projectId ?? null,
        conversationId: body.conversationId ?? null,
        mandate: body.mandate,
        measurableOutcomes: body.measurableOutcomes,
        sponsor: body.sponsor,
        scope: body.scope,
        horizon: body.horizon,
      });
      return res
        .status(data.idempotentReplay ? 200 : 201)
        .json({ data, meta: { version: 'v8', idempotentReplay: data.idempotentReplay } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.patch(
  '/planning-intakes/:intakeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const data = await planningIntakeService.answerPlanningIntake({
        intakeId: String(req.params.intakeId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        ...(req.body ?? {}),
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/planning-intakes/:intakeId/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const data = await planningIntakeService.convertPlanningIntake({
        intakeId: String(req.params.intakeId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/planning-intakes/:intakeId/convert-template',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 256)
      return res.status(400).json({ code: 'TRANSFORMATION_CASE_IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const data = await planningIntakeService.convertTemplatePlanningIntake({
        intakeId: String(req.params.intakeId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        idempotencyKey,
        expectedTemplateDigest: String(req.body?.expectedTemplateDigest ?? ''),
      });
      return res.json({ data, meta: { version: 'v8', idempotentReplay: data.idempotentReplay } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 256) {
      return res.status(400).json({
        error: 'Idempotency-Key header must contain 8-256 characters',
        code: 'TRANSFORMATION_CASE_IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    try {
      const body = CreateTransformationCaseBodySchema.parse(req.body ?? {});
      if (
        body.projectId &&
        !(await canUseProject({
          projectId: body.projectId,
          organizationId: context.organizationId,
          userId: context.userId,
          isSuperAdmin: context.isSuperAdmin,
        }))
      ) {
        return res.status(404).json({
          error: 'Project not found',
          code: 'TRANSFORMATION_CASE_PROJECT_NOT_FOUND',
        });
      }

      const transformationCase = await transformationCaseService.createTransformationCase({
        ...body,
        idempotencyKey,
        organizationId: context.organizationId,
        initiatedByUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(transformationCase.idempotentReplay ? 200 : 201).json({
        data: transformationCase,
        meta: { version: 'v8', idempotentReplay: Boolean(transformationCase.idempotentReplay) },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.patch(
  '/:transformationCaseId/plan',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviseTransformationCaseSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.reviseTransformationCase({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/plan/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ApproveTransformationPlanSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.approveTransformationPlan({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8', action: 'plan_approved' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/ideas/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeInitialIdeasSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.proposeInitialIdeas({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'ideas_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/ideas/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context))) {
      return res.status(404).json({
        error: 'Transformation Case not found',
        code: 'TRANSFORMATION_CASE_NOT_FOUND',
      });
    }
    const data = await transformationCaseService.getInitialIdeasProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data) {
      return res.status(404).json({
        error: 'Initial Ideas proposal not found',
        code: 'TRANSFORMATION_IDEAS_PROPOSAL_NOT_FOUND',
      });
    }
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/:transformationCaseId/ideas/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewInitialIdeasProposalSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.reviewInitialIdeasProposal({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action: body.decision === 'approve' ? 'ideas_approved_and_applied' : 'ideas_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/interviews/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeInterviewsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      }
      const data = await transformationCaseService.proposeInterviews({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'interviews_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/interviews/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context))) {
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    }
    const data = await transformationCaseService.getInterviewsProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data) {
      return res.status(404).json({
        error: 'Interview proposal not found',
        code: 'TRANSFORMATION_INTERVIEWS_PROPOSAL_NOT_FOUND',
      });
    }
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/:transformationCaseId/interviews/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewInterviewsProposalSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.reviewInterviewsProposal({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action:
            body.decision === 'approve' ? 'interviews_approved_and_applied' : 'interviews_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/interviews/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptInterviewResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.acceptInterviewResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'interview_results_accepted', nextStage: 'drd' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/drd/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeDrdAssessmentSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      }
      const data = await transformationCaseService.proposeDrdAssessment({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'drd_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/drd/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context))) {
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    }
    const data = await transformationCaseService.getDrdAssessmentProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res
        .status(404)
        .json({ error: 'DRD proposal not found', code: 'TRANSFORMATION_DRD_PROPOSAL_NOT_FOUND' });
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/:transformationCaseId/drd/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewDrdAssessmentProposalSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      }
      const data = await transformationCaseService.reviewDrdAssessmentProposal({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action: body.decision === 'approve' ? 'drd_approved_and_created' : 'drd_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/drd/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptDrdResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      }
      const data = await transformationCaseService.acceptDrdResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'drd_results_accepted', nextStage: 'opportunity_synthesis' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/synthesis/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeOpportunitySynthesisSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.proposeOpportunitySynthesis({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'synthesis_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/synthesis/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getOpportunitySynthesisProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res.status(404).json({
        error: 'Synthesis proposal not found',
        code: 'TRANSFORMATION_SYNTHESIS_PROPOSAL_NOT_FOUND',
      });
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/:transformationCaseId/synthesis/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewOpportunitySynthesisSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.reviewOpportunitySynthesis({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action:
            body.decision === 'approve' ? 'synthesis_candidate_created' : 'synthesis_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/initiatives/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptInitiativeResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptInitiativeResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'initiative_results_accepted', nextStage: 'finance_kpi' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/finance-kpi/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeFinanceKpiPackSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.proposeFinanceKpiPack({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'finance_kpi_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/finance-kpi/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getFinanceKpiPackProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res.status(404).json({
        error: 'Finance/KPI proposal not found',
        code: 'TRANSFORMATION_FINANCE_KPI_PROPOSAL_NOT_FOUND',
      });
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/:transformationCaseId/finance-kpi/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewFinanceKpiPackSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.reviewFinanceKpiPack({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action: body.decision === 'approve' ? 'finance_kpi_materialized' : 'finance_kpi_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/finance-kpi/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptFinanceKpiResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptFinanceKpiResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action: 'finance_kpi_results_accepted',
          nextStage: 'portfolio_decision',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/portfolio-decision/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposePortfolioDecisionSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.proposePortfolioDecision({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: {
          version: 'v8',
          action: 'portfolio_decision_proposed',
          businessArtifactsCreated: false,
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.get(
  '/:transformationCaseId/portfolio-decision/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getPortfolioDecisionProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res.status(404).json({
        error: 'Portfolio decision proposal not found',
        code: 'TRANSFORMATION_PORTFOLIO_PROPOSAL_NOT_FOUND',
      });
    return res.json({ data, meta: { version: 'v8' } });
  })
);
router.post(
  '/:transformationCaseId/portfolio-decision/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewPortfolioDecisionSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.reviewPortfolioDecision({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action:
            body.decision === 'approve'
              ? 'portfolio_decision_created'
              : 'portfolio_decision_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.post(
  '/:transformationCaseId/portfolio-decision/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptPortfolioDecisionResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptPortfolioDecisionResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action: 'portfolio_decision_results_accepted',
          nextStage: 'mobilization',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/portfolio-decision/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ResolvePortfolioDecisionSchema.parse(req.body ?? {});
      const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
      if (!idempotencyKey)
        return res
          .status(400)
          .json({ error: 'Idempotency-Key is required', code: 'IDEMPOTENCY_KEY_REQUIRED' });
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.resolvePortfolioDecision({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        idempotencyKey,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8', action: 'portfolio_decision_resolved' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/mobilization/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ProposeMobilizationBlueprintSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.proposeMobilizationBlueprint({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'mobilization_proposed', businessArtifactsCreated: false },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.get(
  '/:transformationCaseId/mobilization/proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getMobilizationBlueprintProposal(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res.status(404).json({
        error: 'Mobilization proposal not found',
        code: 'TRANSFORMATION_MOBILIZATION_PROPOSAL_NOT_FOUND',
      });
    return res.json({ data, meta: { version: 'v8' } });
  })
);
router.post(
  '/:transformationCaseId/mobilization/proposals/:proposalId/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = ReviewMobilizationBlueprintSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.reviewMobilizationBlueprint({
        ...body,
        proposalId: String(req.params.proposalId || '').trim(),
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: {
          version: 'v8',
          action:
            body.decision === 'approve'
              ? 'mobilization_blueprint_applied'
              : 'mobilization_rejected',
        },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.post(
  '/:transformationCaseId/mobilization/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptMobilizationResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptMobilizationResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'mobilization_results_accepted', nextStage: 'execution' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.get(
  '/:transformationCaseId/execution/checkpoint',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getExecutionCheckpoint(
      transformationCaseId,
      context.organizationId
    );
    return res.json({ data, meta: { version: 'v8', readOnly: true } });
  })
);
router.post(
  '/:transformationCaseId/execution/accept-start',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptExecutionStartSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptExecutionStart({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8', action: 'execution_start_accepted' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.post(
  '/:transformationCaseId/execution/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptExecutionResultsSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptExecutionResults({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'execution_results_accepted', nextStage: 'delivery' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.get(
  '/:transformationCaseId/delivery/benefits-checkpoint',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getBenefitsCheckpoint(
      transformationCaseId,
      context.organizationId
    );
    return res.json({ data, meta: { version: 'v8', readOnly: true } });
  })
);
router.post(
  '/:transformationCaseId/delivery/accept-benefits-handoff',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptDeliveryHandoffSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptDeliveryHandoff({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'benefits_handoff_accepted', nextStage: 'benefits' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.post(
  '/:transformationCaseId/benefits/accept-results',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptBenefitsReviewSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptBenefitsReview({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({
        data,
        meta: { version: 'v8', action: 'benefits_verified', nextStage: 'sustainability' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);
router.get(
  '/:transformationCaseId/sustainability/checkpoint',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationCaseService.getSustainabilityCheckpoint(
      transformationCaseId,
      context.organizationId
    );
    return res.json({ data, meta: { version: 'v8', readOnly: true } });
  })
);
router.post(
  '/:transformationCaseId/sustainability/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = AcceptSustainabilityReviewSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context)))
        return res
          .status(404)
          .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
      const data = await transformationCaseService.acceptSustainabilityReview({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8', action: 'sustainability_reviewed' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const body = CancelTransformationCaseSchema.parse(req.body ?? {});
      const transformationCaseId = String(req.params.transformationCaseId || '').trim();
      const current = await transformationCaseService.getTransformationCase(
        transformationCaseId,
        context.organizationId
      );
      if (!current || !(await canSeeCase(current, context))) {
        return res.status(404).json({
          error: 'Transformation Case not found',
          code: 'TRANSFORMATION_CASE_NOT_FOUND',
        });
      }
      const data = await transformationCaseService.cancelTransformationCase({
        ...body,
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/final-outputs/prepare-publication',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    try {
      const data = await transformationFinalOutputService.prepareFinalOutputPublication({
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
      });
      return res.status(201).json({
        data,
        meta: { version: 'v8', action: 'final_output_publication_prepared' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.post(
  '/:transformationCaseId/final-outputs/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    try {
      const data = await transformationFinalOutputService.generateFinalOutputs({
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        correlationId: String(req.header('X-Correlation-Id') || '').trim() || null,
      });
      return res.status(data.idempotentReplay ? 200 : 201).json({
        data: publicFinalOutputRun(data),
        meta: { version: 'v8', action: 'final_outputs_generated' },
      });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/final-outputs/latest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await transformationFinalOutputService.getLatestFinalOutputRun(
      transformationCaseId,
      context.organizationId
    );
    if (!data)
      return res
        .status(404)
        .json({ error: 'Final outputs not found', code: 'TRANSFORMATION_FINAL_OUTPUTS_NOT_FOUND' });
    return res.json({ data: publicFinalOutputRun(data), meta: { version: 'v8' } });
  })
);

router.get(
  '/:transformationCaseId/final-outputs/:format/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const format = String(req.params.format || '').toLowerCase();
    if (!['docx', 'pptx'].includes(format))
      return res.status(400).json({
        error: 'Unsupported final output format',
        code: 'TRANSFORMATION_FINAL_OUTPUT_FORMAT_INVALID',
      });
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res
        .status(404)
        .json({ error: 'Transformation Case not found', code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const run = await transformationFinalOutputService.getLatestFinalOutputRun(
      transformationCaseId,
      context.organizationId
    );
    if (!run)
      return res
        .status(404)
        .json({ error: 'Final outputs not found', code: 'TRANSFORMATION_FINAL_OUTPUTS_NOT_FOUND' });
    const filePath = format === 'docx' ? run.docxPath : run.pptxPath;
    return res.download(filePath, `transformation-${transformationCaseId}.${format}`);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : null;
    const parsedLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const data = await transformationCaseService.listTransformationCases(context.organizationId, {
      projectId: projectId || null,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 50,
      userId: context.userId,
      privileged: isPrivileged(context),
    });
    return res.json({ data, meta: { version: 'v8', count: data.length } });
  })
);

router.put(
  '/runtime-capabilities/registration',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'TRANSFORMATION_CAPABILITY_ADMIN_REQUIRED' });
    const body = runtimeCapabilityRegistrationSchema.parse(req.body ?? {});
    const data = await runtimeCapabilityService.registerRuntimeCapability({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      ...body,
    });
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/runtime-capabilities/evidence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'TRANSFORMATION_CAPABILITY_ADMIN_REQUIRED' });
    const body = runtimeEvidenceSchema.parse(req.body ?? {});
    const data = await runtimeCapabilityService.reportRuntimeEvidence({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      ...body,
    });
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/:transformationCaseId/runtime-capabilities',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context)))
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await runtimeCapabilityService.listRuntimeCapabilities(context.organizationId);
    return res.json({ data, meta: { version: 'v8', count: data.length } });
  })
);

router.post(
  '/:transformationCaseId/runtime-capabilities/reconcile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'TRANSFORMATION_CAPABILITY_ADMIN_REQUIRED' });
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current) return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await runtimeCapabilityService.reconcileTransformationPlan({
      organizationId: context.organizationId,
      transformationCaseId,
      actorUserId: context.userId,
    });
    return res.json({ data, meta: { version: 'v8', idempotentReplay: data.idempotentReplay } });
  })
);

router.get(
  '/:transformationCaseId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const data = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!data || !(await canSeeCase(data, context))) {
      return res.status(404).json({
        error: 'Transformation Case not found',
        code: 'TRANSFORMATION_CASE_NOT_FOUND',
      });
    }
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/:transformationCaseId/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const transformationCase = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!transformationCase || !(await canSeeCase(transformationCase, context))) {
      return res.status(404).json({
        error: 'Transformation Case not found',
        code: 'TRANSFORMATION_CASE_NOT_FOUND',
      });
    }
    const data = await transformationCaseService.getTransformationCaseAudit(
      transformationCaseId,
      context.organizationId
    );
    return res.json({ data, meta: { version: 'v8', count: data.length } });
  })
);

router.post(
  '/:transformationCaseId/bind-project',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const projectId = String(req.body?.projectId || '').trim();
    const current = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!current || !(await canSeeCase(current, context))) {
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    }
    if (
      !projectId ||
      !(await canUseProject({
        projectId,
        organizationId: context.organizationId,
        userId: context.userId,
        isSuperAdmin: context.isSuperAdmin,
      }))
    ) {
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_PROJECT_NOT_FOUND' });
    }
    try {
      const data = await transformationCaseService.bindTransformationCaseProject({
        transformationCaseId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        projectId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (error) {
      const handled = errorResponse(error, res);
      if (handled) return handled;
      throw error;
    }
  })
);

router.get(
  '/:transformationCaseId/runtime',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCaseId = String(req.params.transformationCaseId || '').trim();
    const transformationCase = await transformationCaseService.getTransformationCase(
      transformationCaseId,
      context.organizationId
    );
    if (!transformationCase || !(await canSeeCase(transformationCase, context))) {
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    }
    const data = await getCanonicalTransformationRun({
      transformationCaseId,
      organizationId: context.organizationId,
    });
    if (!data) return res.status(404).json({ code: 'CANONICAL_RUN_NOT_FOUND' });
    return res.json({ data });
  })
);

router.post(
  '/:transformationCaseId/runtime/reconcile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'AGENT_OPERATOR_ROLE_REQUIRED' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ code: 'RUN_RECONCILIATION_REASON_REQUIRED' });
    try {
      const data = await reconcileCanonicalTransformationRun({
        transformationCaseId: String(req.params.transformationCaseId || '').trim(),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        reason,
      });
      return res.json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'run_reconciliation_failed';
      return res.status(code.includes('not_found') ? 404 : 409).json({ code });
    }
  })
);

const teamBlueprintSchema = z.object({
  expectedCaseVersion: z.number().int().positive(),
  sponsorUserId: z.string().min(1).nullable().optional(),
  members: z
    .array(
      z.object({
        kind: z.enum(['human', 'agent']),
        identityId: z.string().min(1).nullable().optional(),
        displayName: z.string().min(1),
        role: z.string().min(1),
        authority: z.array(z.string().min(1)),
        autonomy: z
          .enum(['prepare_only', 'execute_with_approval', 'bounded_autonomous'])
          .optional(),
        budgetLimit: z.number().nonnegative().nullable().optional(),
        sourceRefs: z.array(z.string()),
      })
    )
    .min(1),
  raci: z.array(
    z.object({
      workItem: z.string().min(1),
      responsible: z.array(z.string()),
      accountable: z.string().nullable(),
      consulted: z.array(z.string()),
      informed: z.array(z.string()),
    })
  ),
  agentLimits: z.record(
    z.string(),
    z.object({ autonomy: z.string(), budgetLimit: z.number().nonnegative().nullable() })
  ),
  work: z.array(
    z.object({
      workItem: z.string(),
      ownerIdentityId: z.string().nullable(),
      branchStatus: z.string(),
      estimatedCost: z.number().nonnegative().nullable(),
      conflicts: z.array(z.string()),
      pendingDecisions: z.array(z.string()),
    })
  ),
});

router.get(
  '/:transformationCaseId/team-blueprints/current',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const transformationCase = await transformationCaseService.getTransformationCase(
      String(req.params.transformationCaseId),
      context.organizationId
    );
    if (!transformationCase || !(await canSeeCase(transformationCase, context)))
      return res.status(404).json({ code: 'TRANSFORMATION_CASE_NOT_FOUND' });
    const data = await projectTeamService.getProjectTeam({
      organizationId: context.organizationId,
      caseId: String(req.params.transformationCaseId),
    });
    return data ? res.json({ data }) : res.status(404).json({ code: 'PROJECT_TEAM_NOT_FOUND' });
  })
);

router.post(
  '/:transformationCaseId/team-blueprints',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'PROJECT_TEAM_AUTHORITY_REQUIRED' });
    const parsed = teamBlueprintSchema.safeParse(req.body);
    const idempotencyKey = String(req.header('Idempotency-Key') || '');
    if (!parsed.success)
      return res
        .status(400)
        .json({ code: 'PROJECT_TEAM_VALIDATION_ERROR', details: parsed.error.issues });
    try {
      const { expectedCaseVersion, ...blueprint } = parsed.data;
      const data = await projectTeamService.proposeProjectTeam({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorRole: context.userRole,
        caseId: String(req.params.transformationCaseId),
        expectedCaseVersion,
        blueprint: {
          ...blueprint,
          // z.infer of `accountable: z.string().nullable()` (no `.optional()`) prints
          // as `accountable?: string` here (optional, no `null`) under this project's
          // Zod v4 + strictNullChecks:false toolchain — same inference quirk as
          // `blockerReason` in transformationCaseService.ts. Normalize to the
          // service's `Blueprint.raci[].accountable: string | null` DTO shape.
          raci: blueprint.raci.map((entry) => ({
            ...entry,
            accountable: entry.accountable ?? null,
          })),
          // Same Zod v4 + strictNullChecks:false `.nullable()`-without-`.optional()`
          // inference quirk as `raci[].accountable` above — normalize to the
          // service's `Blueprint.agentLimits[].budgetLimit: number | null` DTO shape.
          agentLimits: Object.fromEntries(
            Object.entries(blueprint.agentLimits).map(([agentId, limit]) => [
              agentId,
              { ...limit, budgetLimit: limit.budgetLimit ?? null },
            ])
          ),
          // Same nullable-field quirk on `work[].ownerIdentityId` / `.estimatedCost`
          // (schema: `.nullable()` without `.optional()`, prints as optional-no-null).
          work: blueprint.work.map((item) => ({
            ...item,
            ownerIdentityId: item.ownerIdentityId ?? null,
            estimatedCost: item.estimatedCost ?? null,
          })),
        },
        idempotencyKey,
      });
      return res.status(data.idempotentReplay ? 200 : 201).json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROJECT_TEAM_PROPOSE_FAILED';
      return res.status(code.includes('NOT_FOUND') ? 404 : 409).json({ code });
    }
  })
);

router.post(
  '/:transformationCaseId/team-blueprints/:blueprintVersionId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'PROJECT_TEAM_AUTHORITY_REQUIRED' });
    const parsed = z
      .object({ expectedVersion: z.number().int().positive(), reason: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'PROJECT_TEAM_VALIDATION_ERROR' });
    try {
      const data = await projectTeamService.approveProjectTeam({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorRole: context.userRole,
        caseId: String(req.params.transformationCaseId),
        blueprintVersionId: String(req.params.blueprintVersionId),
        idempotencyKey: String(req.header('Idempotency-Key') || ''),
        ...parsed.data,
      });
      return res.json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROJECT_TEAM_APPROVE_FAILED';
      return res.status(409).json({ code });
    }
  })
);

router.post(
  '/:transformationCaseId/team-blueprints/:blueprintVersionId/activate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    if (!isPrivileged(context))
      return res.status(403).json({ code: 'PROJECT_TEAM_AUTHORITY_REQUIRED' });
    try {
      const data = await projectTeamService.activateProjectTeam({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorRole: context.userRole,
        caseId: String(req.params.transformationCaseId),
        blueprintVersionId: String(req.params.blueprintVersionId),
        idempotencyKey: String(req.header('Idempotency-Key') || ''),
      });
      return res.json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROJECT_TEAM_ACTIVATE_FAILED';
      return res.status(409).json({ code });
    }
  })
);

export default router;
