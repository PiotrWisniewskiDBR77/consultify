/**
 * Final Batch Routes
 * V4-IDEA-06, V4-ORG-02, V4-ORG-03, V4-ORG-04, V4-AI-04, V4-AI-08
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { finalBatchService } from '../services/finalBatchService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId =
    req.user?.organizationId ||
    req.organizationId ||
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string);
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// ── IDEA-06: Export ──

router.post(
  '/ideas/:ideaId/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      exportType: z.string(),
      exportFormat: z.string(),
      watermarkText: z.string().optional(),
      includeMetadata: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const result = await finalBatchService.requestAndGenerateExport(id.orgId, {
      ...p.data,
      ideaId: req.params.ideaId,
      requestedBy: id.userId,
    });
    if (result.status === 'failed') {
      const status = result.reason === 'unsupported_format' ? 501 : 404;
      res.status(status).json({
        id: result.id,
        status: result.status,
        error: result.reason,
        message: result.message,
      });
      return;
    }
    res.status(201).json(result);
  })
);

router.get(
  '/ideas/:ideaId/exports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ exports: await finalBatchService.getExports(id.orgId, req.params.ideaId) });
  })
);

router.post(
  '/exports/:exportId/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ fileUrl: z.string(), fileSizeBytes: z.number().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.json(await finalBatchService.completeExport(req.params.exportId, p.data));
  })
);

// ── ORG-02: Cohort Privacy ──

router.get(
  '/cohort-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const policy = await finalBatchService.getCohortPolicy(id.orgId);
    res.json(policy || { minCohortSize: 5, suppressionEnabled: true, noiseMethod: 'rounding' });
  })
);

router.put(
  '/cohort-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      minCohortSize: z.number().optional(),
      suppressionEnabled: z.boolean().optional(),
      noiseMethod: z.string().optional(),
      noiseMagnitude: z.number().optional(),
      auditAllQueries: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.json(await finalBatchService.upsertCohortPolicy(id.orgId, p.data));
  })
);

router.post(
  '/cohort-privacy/apply',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      value: z.number(),
      cohortSize: z.number(),
      queryType: z.string(),
      queryParams: z.record(z.string(), z.unknown()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.json(
      await finalBatchService.applyCohortPrivacy(
        id.orgId,
        { value: p.data.value, cohortSize: p.data.cohortSize },
        id.userId,
        p.data.queryType,
        p.data.queryParams
      )
    );
  })
);

router.get(
  '/cohort-privacy/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json({ audit: await finalBatchService.getQueryAudit(id.orgId, limit) });
  })
);

// ── ORG-03: Framework Mappings ──

router.post(
  '/framework-mappings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      frameworkKey: z.string(),
      frameworkName: z.string(),
      version: z.string().optional(),
      dimensionKey: z.string(),
      dimensionName: z.string(),
      percentileP25: z.number().optional(),
      percentileP50: z.number().optional(),
      percentileP75: z.number().optional(),
      percentileP90: z.number().optional(),
      whatGoodLooksLike: z.string().optional(),
      dataSource: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(await finalBatchService.upsertFrameworkMapping(p.data));
  })
);

router.get(
  '/framework-mappings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const frameworkKey = req.query.frameworkKey as string | undefined;
    res.json({ mappings: await finalBatchService.getFrameworkMappings(frameworkKey) });
  })
);

router.get(
  '/frameworks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ frameworks: await finalBatchService.getFrameworks() });
  })
);

// ── ORG-04: Gap Analysis Pipeline ──

router.post(
  '/gap-analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      frameworkKey: z.string(),
      assessmentId: z.string().optional(),
      gaps: z.array(z.record(z.string(), z.unknown())).optional(),
      recommendations: z.array(z.record(z.string(), z.unknown())).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(
        await finalBatchService.createGapAnalysis(id.orgId, { ...p.data, createdBy: id.userId })
      );
  })
);

router.get(
  '/gap-analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const frameworkKey = req.query.frameworkKey as string | undefined;
    res.json({ analyses: await finalBatchService.getGapAnalyses(id.orgId, frameworkKey) });
  })
);

router.post(
  '/gap-analyses/:gapId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ dimensionKey: z.string(), initiativeId: z.string() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(
        await finalBatchService.linkGapToInitiative(
          req.params.gapId,
          p.data.dimensionKey,
          p.data.initiativeId
        )
      );
  })
);

router.get(
  '/gap-analyses/:gapId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ links: await finalBatchService.getGapInitiativeLinks(req.params.gapId) });
  })
);

router.put(
  '/gap-analyses/:gapId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ status: z.string(), autoInitiativesCreated: z.number().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.json(
      await finalBatchService.updateGapAnalysisStatus(
        req.params.gapId,
        p.data.status,
        p.data.autoInitiativesCreated
      )
    );
  })
);

// ── AI-04: Typed Actions ──

router.post(
  '/actions/propose',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      actionType: z.string(),
      targetEntityType: z.string(),
      targetEntityId: z.string().optional(),
      proposedChanges: z.record(z.string(), z.unknown()),
      previewDiff: z.string().optional(),
      rbacRequiredRole: z.string().optional(),
      idempotencyKey: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await finalBatchService.proposeAction(id.orgId, { ...p.data, proposedBy: id.userId }));
  })
);

router.get(
  '/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const status = req.query.status as string | undefined;
    res.json({ actions: await finalBatchService.getProposedActions(id.orgId, status) });
  })
);

router.get(
  '/actions/:actionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const a = await finalBatchService.getAction(id.orgId, req.params.actionId);
    if (!a) {
      res.status(404).json({ error: 'Action not found' });
      return;
    }
    res.json(a);
  })
);

router.post(
  '/actions/:actionId/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await finalBatchService.acceptAction(
      id.orgId,
      req.params.actionId,
      id.userId,
      req.userRole || req.user?.role
    );
    if (!result.ok && result.reason === 'not_found') {
      res.status(404).json({ error: 'Action not found' });
      return;
    }
    if (!result.ok && result.reason === 'insufficient_role') {
      res
        .status(403)
        .json({ error: 'Insufficient role for action', requiredRole: result.requiredRole });
      return;
    }
    if (!result.ok && result.reason === 'invalid_state') {
      res.status(409).json({ error: 'Action is no longer pending acceptance' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/actions/:actionId/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = req.body.result;
    const execution = await finalBatchService.executeAction(id.orgId, req.params.actionId, result);
    if (!execution.ok) {
      res.status(409).json({ error: 'Action must be accepted before execution' });
      return;
    }
    res.json(execution);
  })
);

router.post(
  '/actions/:actionId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await finalBatchService.rejectAction(id.orgId, req.params.actionId);
    if (!result.ok) {
      res.status(404).json({ error: 'Action not found or no longer rejectable' });
      return;
    }
    res.json(result);
  })
);

// ── AI-08: Domain Playbooks ──

router.post(
  '/playbooks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      domain: z.string(),
      playbookName: z.string(),
      description: z.string().optional(),
      systemPrompt: z.string(),
      exampleQueries: z.array(z.string()).optional(),
      requiredContext: z.array(z.string()).optional(),
      outputSchema: z.record(z.string(), z.unknown()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await finalBatchService.createPlaybook(id.orgId, { ...p.data, createdBy: id.userId }));
  })
);

router.get(
  '/playbooks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const domain = req.query.domain as string | undefined;
    res.json({ playbooks: await finalBatchService.getPlaybooks(domain, id.orgId) });
  })
);

router.get(
  '/playbooks/:playbookId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const pb = await finalBatchService.getPlaybook(req.params.playbookId);
    if (!pb) {
      res.status(404).json({ error: 'Playbook not found' });
      return;
    }
    res.json(pb);
  })
);

router.put(
  '/playbooks/:playbookId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await finalBatchService.updatePlaybook(req.params.playbookId, req.body));
  })
);

router.post(
  '/playbooks/:playbookId/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      inputContext: z.record(z.string(), z.unknown()).optional(),
      outputResult: z.record(z.string(), z.unknown()).optional(),
      citations: z.array(z.string()).optional(),
      confidence: z.number().optional(),
      durationMs: z.number().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(
      await finalBatchService.executePlaybook(id.orgId, {
        ...p.data,
        playbookId: req.params.playbookId,
        userId: id.userId,
      })
    );
  })
);

router.get(
  '/playbooks/:playbookId/executions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json({
      executions: await finalBatchService.getPlaybookExecutions(req.params.playbookId, limit),
    });
  })
);

export default router;
