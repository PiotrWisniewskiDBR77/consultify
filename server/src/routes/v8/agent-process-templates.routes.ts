import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  createAgentProcessTemplate,
  getAgentProcessTemplateGovernance,
  instantiateAgentProcessTemplate,
  listAgentProcessTemplates,
  reviseAgentProcessTemplate,
  transitionAgentProcessTemplate,
} from '../../services/v8/agentProcessTemplateService.js';
import type { AgentProcessTemplateGraph } from '../../services/v8/agentProcessTemplateService.js';
import * as executionSpineService from '../../services/v8/executionSpineService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { TransformationPlanStepDraftSchema } from '../../types/transformationCase.js';

const router = Router();
const graphSchema = z.object({
  mode: z.enum(['sequential', 'hierarchical', 'router_parallel']),
  leadAgentId: z.string().min(1).max(200),
  budget: z.record(z.string(), z.unknown()).optional(),
  runtimeBundle: z
    .object({
      promptKey: z.string().min(1),
      promptVersion: z.string().min(1),
      modelId: z.string().min(1),
      modelVersion: z.string().min(1),
      policyVersion: z.string().min(1),
      toolPolicyRefs: z.array(z.string().min(1)),
      agentDefinitionVersions: z.record(z.string(), z.string().min(1)),
    })
    .optional(),
  planningBlueprint: z.object({
    intakeDefaults:z.object({mandate:z.string().trim().min(1).max(4000),measurableOutcomes:z.array(z.string().trim().min(1).max(500)).max(20).optional(),sponsor:z.string().trim().max(500).nullable().optional(),scope:z.string().trim().max(2000).nullable().optional(),horizon:z.string().trim().max(500).nullable().optional()}),
    steps:z.array(TransformationPlanStepDraftSchema.omit({sourceStepId:true})).min(1).max(100),
  }).optional(),
  tasks: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        specialistAgentId: z.string().min(1).max(200),
        title: z.string().min(1).max(300),
        objective: z.string().min(1).max(4000),
        dependsOn: z.array(z.string()).max(30).optional(),
        expectedOutputSchema: z.record(z.string(), z.unknown()).optional(),
        toolScope: z.array(z.string()).max(50).optional(),
        budget: z
          .object({
            maxTokens: z.number().int().positive().optional(),
            maxCostUsd: z.number().nonnegative().optional(),
            timeoutSeconds: z.number().int().positive().max(86400).optional(),
          })
          .optional(),
        maxAttempts: z.number().int().min(1).max(10).optional(),
      })
    )
    .min(1)
    .max(30),
});

// z.infer of TransformationPlanStepDraftSchema.omit({sourceStepId:true}) prints
// `blockerReason?: string` here (optional, no `null`) even though the schema field
// is `z.string().trim().max(1000).nullable()` (required, nullable) — a Zod
// v4 + `strictNullChecks:false` inference quirk, not an intentional optional field.
// `AgentPlanningBlueprint.steps` (agentProcessTemplateService.ts) is typed against
// the DB-facing `TransformationPlanStep.blockerReason: string | null` (always
// present). Normalize here so the parsed request body matches that DTO shape —
// mirrors the same `?? null` normalization already applied in
// transformationCaseService.ts's plan compilers.
function normalizeGraphForService(
  graph: z.infer<typeof graphSchema>
): AgentProcessTemplateGraph {
  const { planningBlueprint, ...rest } = graph;
  return {
    ...rest,
    ...(planningBlueprint
      ? {
          planningBlueprint: {
            ...planningBlueprint,
            steps: planningBlueprint.steps.map((step) => ({
              ...step,
              blockerReason: step.blockerReason ?? null,
            })),
          },
        }
      : {}),
  };
}

function requireTemplateAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const { userRole, isSuperAdmin } = getV8Context(req);
  if (!isSuperAdmin && !['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole.toUpperCase())) {
    res.status(403).json({ code: 'AGENT_TEMPLATE_ADMIN_REQUIRED' });
    return;
  }
  next();
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    return res.json({ data: await listAgentProcessTemplates(organizationId) });
  })
);

router.get(
  '/:templateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await getAgentProcessTemplateGovernance(
      String(req.params.templateId),
      organizationId
    );
    if (!data) return res.status(404).json({ code: 'AGENT_TEMPLATE_NOT_FOUND' });
    return res.json({ data });
  })
);

router.post(
  '/',
  requireTemplateAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const parsed = z
      .object({
        key: z.string().min(1).max(200),
        title: z.string().min(1).max(300),
        description: z.string().max(4000).optional(),
        graph: graphSchema,
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ code: 'INVALID_AGENT_TEMPLATE', details: parsed.error.issues });
    const data = await createAgentProcessTemplate({
      ...parsed.data,
      graph: normalizeGraphForService(parsed.data.graph),
      organizationId: context.organizationId,
      actorUserId: context.userId,
    });
    return res.status(201).json({ data });
  })
);

router.post(
  '/:templateId/revise',
  requireTemplateAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const parsed = z
      .object({
        graph: graphSchema,
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(4000).optional(),
        reason: z.string().min(1).max(1000),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ code: 'INVALID_AGENT_TEMPLATE_REVISION', details: parsed.error.issues });
    try {
      const data = await reviseAgentProcessTemplate({
        ...parsed.data,
        graph: normalizeGraphForService(parsed.data.graph),
        templateId: String(req.params.templateId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
      });
      return res.json({ data });
    } catch (error) {
      return res
        .status(409)
        .json({ code: error instanceof Error ? error.message : 'agent_template_revision_failed' });
    }
  })
);

router.post(
  ['/:templateId/publish', '/:templateId/deprecate'],
  requireTemplateAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ code: 'GOVERNANCE_REASON_REQUIRED' });
    try {
      const data = await transitionAgentProcessTemplate({
        templateId: String(req.params.templateId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: req.path.endsWith('/deprecate') ? 'deprecate' : 'publish',
        reason,
      });
      return res.json({ data });
    } catch (error) {
      return res.status(409).json({
        code: error instanceof Error ? error.message : 'agent_template_transition_failed',
      });
    }
  })
);

router.post(
  '/:templateId/instantiate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const executionRunId = String(req.body?.executionRunId || '');
    const run = await executionSpineService.getRun(executionRunId, context.organizationId);
    if (!run) return res.status(404).json({ code: 'RUN_NOT_FOUND' });
    try {
      const data = await instantiateAgentProcessTemplate({
        templateId: String(req.params.templateId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        executionRunId,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return res.status(409).json({
        code: error instanceof Error ? error.message : 'agent_template_instantiation_failed',
      });
    }
  })
);

export default router;
