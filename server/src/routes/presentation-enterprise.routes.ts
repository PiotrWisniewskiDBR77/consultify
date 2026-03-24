/**
 * Presentation Enterprise Routes (V4-DECK-02 through V4-DECK-07)
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { presentationEnterpriseService } from '../services/presentationEnterpriseService.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId = req.user?.organizationId || req.organizationId || (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
  if (!userId || !orgId) { res.status(401).json({ error: 'Authentication required' }); return null; }
  return { userId, orgId };
};

// ── DECK-02: Bindings ──

router.post('/decks/:deckId/bindings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ slideIndex: z.number().int(), blockId: z.string().optional(), bindingType: z.string().optional(), artifactType: z.string().optional(), artifactId: z.string().optional(), datasetRef: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await presentationEnterpriseService.createBinding(id.orgId, { deckId: req.params.deckId, ...p.data });
  res.status(201).json(r);
}));

router.get('/decks/:deckId/bindings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ bindings: await presentationEnterpriseService.getBindings(id.orgId, req.params.deckId) });
}));

router.post('/bindings/:bindingId/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ valueHash: z.string() }); const p = s.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const ok = await presentationEnterpriseService.refreshBinding(id.orgId, req.params.bindingId, p.data.valueHash);
  if (!ok) { res.status(404).json({ error: 'Binding not found' }); return; }
  res.json({ ok: true });
}));

router.post('/bindings/:bindingId/approve', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const ok = await presentationEnterpriseService.approveBinding(id.orgId, req.params.bindingId, id.userId);
  if (!ok) { res.status(404).json({ error: 'Binding not found' }); return; }
  res.json({ ok: true });
}));

// ── DECK-03: Layout rules + export QA ──

router.post('/layout-rules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ ruleName: z.string().min(1), ruleType: z.string().optional(), config: z.record(z.string(), z.unknown()), isGlobal: z.boolean().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.createLayoutRule(id.orgId, p.data));
}));

router.get('/layout-rules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ rules: await presentationEnterpriseService.getLayoutRules(id.orgId) });
}));

router.post('/decks/:deckId/export-qa', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ exportFormat: z.string().optional(), fidelityScore: z.number(), issues: z.array(z.unknown()).optional(), passed: z.boolean() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.createExportQA(id.orgId, { deckId: req.params.deckId, ...p.data }));
}));

router.get('/decks/:deckId/export-qa', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ results: await presentationEnterpriseService.getExportQAResults(id.orgId, req.params.deckId) });
}));

// ── DECK-04: Template governance ──

router.post('/template-governance', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ templateId: z.string(), name: z.string().min(1), description: z.string().optional(), category: z.string().optional(), variables: z.array(z.unknown()).optional(), governanceLevel: z.string().optional(), consultingPackType: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.createTemplateGovernance(id.orgId, id.userId, p.data));
}));

router.post('/template-governance/:governanceId/publish', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const ok = await presentationEnterpriseService.publishTemplateVersion(id.orgId, req.params.governanceId, id.userId);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
}));

router.get('/template-governance', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ templates: await presentationEnterpriseService.getTemplateGovernance(id.orgId) });
}));

// ── DECK-05: PPTX import ──

router.post('/pptx-imports', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ originalFilename: z.string().min(1), fileSizeBytes: z.number().int().optional(), slideCount: z.number().int().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.createPPTXImport(id.orgId, id.userId, p.data));
}));

router.patch('/pptx-imports/:importId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ deckId: z.string().optional(), mappingData: z.array(z.unknown()).optional(), status: z.string(), warnings: z.array(z.unknown()).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await presentationEnterpriseService.updatePPTXImport(id.orgId, req.params.importId, p.data);
  res.json({ ok: true });
}));

router.get('/pptx-imports', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ imports: await presentationEnterpriseService.getPPTXImports(id.orgId) });
}));

// ── DECK-06: Realtime collaboration ──

router.post('/decks/:deckId/collab/join', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.status(201).json(await presentationEnterpriseService.joinCollabSession(id.orgId, req.params.deckId, id.userId));
}));

router.post('/collab/:sessionId/presence', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ cursorPosition: z.record(z.string(), z.unknown()).optional(), activeSlideIndex: z.number().int().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await presentationEnterpriseService.updatePresence(id.orgId, req.params.sessionId, p.data);
  res.json({ ok: true });
}));

router.post('/collab/:sessionId/leave', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  await presentationEnterpriseService.leaveCollabSession(id.orgId, req.params.sessionId);
  res.json({ ok: true });
}));

router.get('/decks/:deckId/collab/active', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ collaborators: await presentationEnterpriseService.getActiveCollaborators(id.orgId, req.params.deckId) });
}));

// ── DECK-07: Media library ──

router.post('/media', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ filename: z.string().min(1), mimeType: z.string(), fileSizeBytes: z.number().int().optional(), storageUrl: z.string().optional(), rightsStatus: z.string().optional(), licenseType: z.string().optional(), licenseExpiry: z.string().optional(), entitlementScope: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.addMedia(id.orgId, id.userId, p.data));
}));

router.get('/media', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const rightsFilter = req.query.rights ? String(req.query.rights) : undefined;
  res.json({ media: await presentationEnterpriseService.getMediaLibrary(id.orgId, rightsFilter) });
}));

router.post('/media/:mediaId/watermark', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const ok = await presentationEnterpriseService.applyWatermark(id.orgId, req.params.mediaId);
  if (!ok) { res.status(404).json({ error: 'Media not found' }); return; }
  res.json({ ok: true });
}));

router.post('/media/:mediaId/usage', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ deckId: z.string(), slideIndex: z.number().int().optional(), action: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await presentationEnterpriseService.logMediaUsage(id.orgId, { mediaId: req.params.mediaId, actorId: id.userId, ...p.data }));
}));

export default router;
