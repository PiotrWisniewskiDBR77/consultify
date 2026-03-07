/**
 * Report Enterprise Routes (V4-RPT-01 through V4-RPT-06)
 *
 * Source packs, data bindings, templates, brand voice, AI proposals, distribution.
 * Base report CRUD remains in report-builder.routes.ts.
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reportEnterpriseService } from '../services/reportEnterpriseService.js';

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

// ── V4-RPT-01: Source Packs ──

router.post('/reports/:reportId/source-packs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ name: z.string().min(1).max(200), description: z.string().max(2000).optional(), citationPolicy: z.enum(['required', 'recommended', 'optional']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const pack = await reportEnterpriseService.createSourcePack(identity.orgId, identity.userId, { reportId: req.params.reportId, ...parsed.data });
  res.status(201).json(pack);
}));

router.post('/source-packs/:packId/items', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ artifactType: z.string().min(1), artifactId: z.string().min(1), artifactTitle: z.string().optional(), citationLabel: z.string().optional(), sortOrder: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let item;
  try {
    item = await reportEnterpriseService.addSourcePackItem(identity.orgId, req.params.packId, parsed.data);
  } catch (error: any) {
    if (error?.message === 'source_pack_not_found') {
      res.status(404).json({ error: 'Source pack not found' });
      return;
    }
    throw error;
  }
  res.status(201).json(item);
}));

router.get('/reports/:reportId/source-packs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const packs = await reportEnterpriseService.getSourcePacks(
    identity.orgId,
    String(req.params.reportId)
  );
  res.json({ packs });
}));

router.get('/source-packs/:packId/items', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const items = await reportEnterpriseService.getSourcePackItems(
    identity.orgId,
    String(req.params.packId)
  );
  res.json({ items });
}));

// ── V4-RPT-02: Data bindings ──

router.post('/reports/:reportId/data-bindings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ sectionId: z.string().min(1), bindingType: z.enum(['kpi', 'finance', 'custom']).optional(), datasetRef: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const binding = await reportEnterpriseService.createDataBinding(identity.orgId, { reportId: req.params.reportId, ...parsed.data });
  res.status(201).json(binding);
}));

router.post('/data-bindings/:bindingId/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ value: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const ok = await reportEnterpriseService.refreshDataBinding(identity.orgId, req.params.bindingId, parsed.data.value);
  if (!ok) { res.status(404).json({ error: 'Binding not found' }); return; }
  res.json({ ok: true });
}));

router.post('/data-bindings/:bindingId/approve', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const ok = await reportEnterpriseService.approveDataBinding(identity.orgId, req.params.bindingId, identity.userId);
  if (!ok) { res.status(404).json({ error: 'Binding not found' }); return; }
  res.json({ ok: true });
}));

router.get('/reports/:reportId/data-bindings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const bindings = await reportEnterpriseService.getDataBindings(identity.orgId, req.params.reportId);
  res.json({ bindings });
}));

// ── V4-RPT-03: Templates ──

router.post('/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({
    name: z.string().min(1).max(200), description: z.string().max(2000).optional(),
    category: z.string().optional(), templateData: z.record(z.string(), z.unknown()),
    variables: z.array(z.unknown()).optional(), governanceLevel: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tpl = await reportEnterpriseService.createTemplate(identity.orgId, identity.userId, parsed.data);
  res.status(201).json(tpl);
}));

router.post('/templates/:templateId/publish', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const ok = await reportEnterpriseService.publishTemplate(identity.orgId, req.params.templateId, identity.userId);
  if (!ok) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json({ ok: true });
}));

router.get('/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const templates = await reportEnterpriseService.getTemplates(identity.orgId);
  res.json({ templates });
}));

router.get('/templates/:templateId/versions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const versions = await reportEnterpriseService.getTemplateVersions(req.params.templateId);
  res.json({ versions });
}));

// ── V4-RPT-04: Brand voice ──

router.post('/brand-voice', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({
    policyName: z.string().min(1).max(200), tone: z.string().optional(),
    forbiddenPhrases: z.array(z.string()).optional(),
    requiredSourceCitation: z.boolean().optional(),
    noMarketingLanguage: z.boolean().optional(),
    customRules: z.array(z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const policy = await reportEnterpriseService.createBrandVoicePolicy(identity.orgId, identity.userId, parsed.data);
  res.status(201).json(policy);
}));

router.get('/brand-voice', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const policies = await reportEnterpriseService.getBrandVoicePolicies(identity.orgId);
  res.json({ policies });
}));

router.post('/brand-voice/validate', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await reportEnterpriseService.validateAgainstBrandVoice(identity.orgId, parsed.data.text);
  res.json(result);
}));

// ── V4-RPT-05: AI proposals ──

router.post('/reports/:reportId/ai-proposals', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({
    sectionId: z.string().optional(), blockId: z.string().optional(),
    proposedContent: z.string().min(1), originalContent: z.string().optional(),
    citations: z.array(z.unknown()).optional(), aiModelUsed: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const proposal = await reportEnterpriseService.createAIProposal(identity.orgId, { reportId: req.params.reportId, ...parsed.data });
  res.status(201).json(proposal);
}));

router.post('/ai-proposals/:proposalId/resolve', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({ action: z.enum(['accept', 'reject']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await reportEnterpriseService.resolveAIProposal(identity.orgId, req.params.proposalId, identity.userId, parsed.data.action);
  if (!result.ok && result.reason === 'not_found') { res.status(404).json({ error: 'Proposal not found' }); return; }
  if (!result.ok && result.reason === 'target_not_found') {
    res.status(409).json({ error: 'Proposal target section not found' });
    return;
  }
  res.json(result);
}));

router.get('/reports/:reportId/ai-proposals', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const status = req.query.status ? String(req.query.status) : undefined;
  const proposals = await reportEnterpriseService.getAIProposals(identity.orgId, req.params.reportId, status);
  res.json({ proposals });
}));

// ── V4-RPT-06: Distribution ──

router.post('/reports/:reportId/distribution-schedules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schema = z.object({
    scheduleCron: z.string().optional(), sendAt: z.string().optional(),
    recipientPolicy: z.record(z.string(), z.unknown()),
    approvalRequired: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const schedule = await reportEnterpriseService.createDistributionSchedule(identity.orgId, identity.userId, { reportId: req.params.reportId, ...parsed.data });
  res.status(201).json(schedule);
}));

router.post('/distribution-schedules/:scheduleId/approve', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const ok = await reportEnterpriseService.approveDistribution(identity.orgId, req.params.scheduleId, identity.userId);
  if (!ok) { res.status(404).json({ error: 'Schedule not found' }); return; }
  res.json({ ok: true });
}));

router.get('/reports/:reportId/distribution-schedules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const schedules = await reportEnterpriseService.getDistributionSchedules(identity.orgId, req.params.reportId);
  res.json({ schedules });
}));

router.get('/distribution-schedules/:scheduleId/log', asyncHandler(async (req: AuthRequest, res: Response) => {
  const identity = requireUser(req, res); if (!identity) return;
  const logs = await reportEnterpriseService.getDistributionLog(identity.orgId, req.params.scheduleId);
  res.json({ logs });
}));

export default router;
