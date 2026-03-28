/**
 * Tool Enterprise Routes
 * V4-TOOL-03, V4-TOOL-06, V4-TOOL-07
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { toolEnterpriseService } from '../services/toolEnterpriseService.js';
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

// ── TOOL-03: Template Library ──

router.post(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      templateKey: z.string(),
      templateName: z.string(),
      category: z.string(),
      description: z.string().optional(),
      schemaJson: z.record(z.string(), z.unknown()),
      defaultConfig: z.record(z.string(), z.unknown()).optional(),
      isOrgCurated: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(
        await toolEnterpriseService.createTemplate(id.orgId, { ...p.data, createdBy: id.userId })
      );
  })
);

router.get(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const category = req.query.category as string | undefined;
    res.json({ templates: await toolEnterpriseService.listTemplates(id.orgId, category) });
  })
);

router.get(
  '/templates/:templateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const t = await toolEnterpriseService.getTemplate(id.orgId, req.params.templateId);
    if (!t) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(t);
  })
);

router.put(
  '/templates/:templateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      templateName: z.string().optional(),
      description: z.string().optional(),
      schemaJson: z.record(z.string(), z.unknown()).optional(),
      defaultConfig: z.record(z.string(), z.unknown()).optional(),
      isOrgCurated: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const result = await toolEnterpriseService.updateTemplate(
      id.orgId,
      req.params.templateId,
      p.data
    );
    if (!result.ok) {
      res.status(404).json({ error: 'Template not found or not editable' });
      return;
    }
    res.json(result);
  })
);

router.delete(
  '/templates/:templateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await toolEnterpriseService.deleteTemplate(id.orgId, req.params.templateId);
    if (!result.deleted) {
      res.status(404).json({ error: 'Template not found or not deletable' });
      return;
    }
    res.json(result);
  })
);

// ── TOOL-06: Knowledge Bank + RAG ──

router.post(
  '/knowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      toolSessionId: z.string().optional(),
      sourceType: z.string(),
      sourceId: z.string(),
      contentText: z.string().optional(),
      embeddingVector: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      scope: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(await toolEnterpriseService.addKnowledgeEntry(id.orgId, p.data));
  })
);

router.get(
  '/knowledge/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    const toolSessionId = req.query.toolSessionId as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    res.json({
      results: await toolEnterpriseService.searchKnowledge(id.orgId, query, toolSessionId, limit),
    });
  })
);

router.get(
  '/knowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const toolSessionId = req.query.toolSessionId as string | undefined;
    res.json({ entries: await toolEnterpriseService.getKnowledgeEntries(id.orgId, toolSessionId) });
  })
);

router.delete(
  '/knowledge/:entryId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await toolEnterpriseService.deleteKnowledgeEntry(id.orgId, req.params.entryId);
    if (!result.deleted) {
      res.status(404).json({ error: 'Knowledge entry not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/rag/query',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      toolSessionId: z.string().optional(),
      queryText: z.string(),
      results: z.array(z.record(z.string(), z.unknown())).optional(),
      citations: z.array(z.record(z.string(), z.unknown())).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(await toolEnterpriseService.createRagQuery(id.orgId, p.data));
  })
);

router.get(
  '/rag/queries',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const toolSessionId = req.query.toolSessionId as string | undefined;
    res.json({ queries: await toolEnterpriseService.getRagQueries(id.orgId, toolSessionId) });
  })
);

// ── TOOL-07: Entitlements ──

router.post(
  '/entitlements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      packKey: z.string(),
      packName: z.string(),
      licensedTools: z.array(z.string()).optional(),
      maxSessionsPerMonth: z.number().optional(),
      maxConcurrentUsers: z.number().optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(await toolEnterpriseService.createEntitlement(id.orgId, p.data));
  })
);

router.get(
  '/entitlements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ entitlements: await toolEnterpriseService.getEntitlements(id.orgId) });
  })
);

router.get(
  '/entitlements/check/:toolKey',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await toolEnterpriseService.checkEntitlement(id.orgId, req.params.toolKey));
  })
);

router.post(
  '/usage/log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      toolKey: z.string(),
      entitlementId: z.string().optional(),
      action: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await toolEnterpriseService.logToolUsage(id.orgId, { ...p.data, userId: id.userId }));
  })
);

router.get(
  '/usage/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const toolKey = req.query.toolKey as string | undefined;
    res.json({ stats: await toolEnterpriseService.getUsageStats(id.orgId, toolKey) });
  })
);

router.post(
  '/entitlements/:entitlementId/deactivate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await toolEnterpriseService.deactivateEntitlement(id.orgId, req.params.entitlementId));
  })
);

export default router;
