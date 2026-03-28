/**
 * Virtual Workers Routes
 *
 * Admin-only CRUD for virtual workers, profiles, knowledge, conversations, analytics, insights.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import * as ConversationLogger from '../services/ai/virtualWorkerConversationLogger.js';
import * as InsightsEngine from '../services/ai/virtualWorkerInsightsEngine.js';
import * as WorkerService from '../services/ai/virtualWorkerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// All routes require authentication and admin role
router.use(verifyToken);
router.use(requireRole('super_admin', 'admin'));

// ==========================================
// WORKERS CRUD
// ==========================================

router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const workers = await WorkerService.listWorkers();
    return res.json({ success: true, data: workers });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await WorkerService.getWorkerWithProfile(req.params.id);
    if (!result) return res.status(404).json({ error: 'Worker not found' });
    return res.json({ success: true, data: result });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!body?.slug || !body?.name) {
      return res.status(400).json({ error: 'slug and name are required' });
    }
    const worker = await WorkerService.createWorker({
      slug: body.slug,
      name: body.name,
      role: body.role,
      status: body.status,
      surface: body.surface,
      voice_enabled: body.voice_enabled,
      voice_name: body.voice_name,
      locale_default: body.locale_default,
      avatar_url: body.avatar_url,
      description: body.description,
    });
    return res.status(201).json({ success: true, data: worker });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const worker = await WorkerService.updateWorker(req.params.id, req.body as any);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    return res.json({ success: true, data: worker });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const deleted = await WorkerService.deleteWorker(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Worker not found' });
    return res.json({ success: true });
  })
);

// ==========================================
// PROFILES
// ==========================================

router.get(
  '/:id/profiles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profiles = await WorkerService.listProfiles(req.params.id);
    return res.json({ success: true, data: profiles });
  })
);

router.put(
  '/:id/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!body?.system_prompt) {
      return res.status(400).json({ error: 'system_prompt is required' });
    }
    const profile = await WorkerService.createProfile({
      worker_id: req.params.id,
      persona_description: body.persona_description,
      tone_description: body.tone_description,
      system_prompt: body.system_prompt,
      priority_rules: body.priority_rules,
      boundaries: body.boundaries,
      activate: body.activate !== false,
    });
    return res.json({ success: true, data: profile });
  })
);

router.post(
  '/:id/profiles/:profileId/activate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await WorkerService.activateProfile(req.params.profileId);
    return res.json({ success: true });
  })
);

// ==========================================
// KNOWLEDGE ASSIGNMENTS
// ==========================================

router.get(
  '/:id/knowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignments = await WorkerService.listKnowledgeAssignments(req.params.id);
    return res.json({ success: true, data: assignments });
  })
);

router.post(
  '/:id/knowledge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    const assignment = await WorkerService.assignKnowledge({
      worker_id: req.params.id,
      knowledge_source_type: body.knowledge_source_type,
      knowledge_doc_id: body.knowledge_doc_id,
      product_slug: body.product_slug,
      priority_weight: body.priority_weight,
    });
    return res.status(201).json({ success: true, data: assignment });
  })
);

router.post(
  '/:id/knowledge/bulk',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!Array.isArray(body?.products)) {
      return res.status(400).json({ error: 'products array is required' });
    }
    const count = await WorkerService.bulkAssignProductPills(
      req.params.id,
      body.products.map((p: any) => ({ slug: String(p.slug), weight: Number(p.weight ?? 1.0) }))
    );
    return res.json({ success: true, assigned: count });
  })
);

router.delete(
  '/:id/knowledge/:assignmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const removed = await WorkerService.removeKnowledgeAssignment(req.params.assignmentId);
    if (!removed) return res.status(404).json({ error: 'Assignment not found' });
    return res.json({ success: true });
  })
);

// ==========================================
// CONVERSATIONS
// ==========================================

router.get(
  '/:id/conversations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as any;
    const result = await ConversationLogger.listConversations({
      workerId: req.params.id,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      channel: query.channel,
      outcome: query.outcome,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return res.json({ success: true, data: result.conversations, total: result.total });
  })
);

router.get(
  '/:id/conversations/:convId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const messages = await ConversationLogger.getConversationMessages(req.params.convId);
    return res.json({ success: true, data: messages });
  })
);

// ==========================================
// ANALYTICS
// ==========================================

router.get(
  '/:id/analytics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as any;
    const analytics = await ConversationLogger.getWorkerAnalytics({
      workerId: req.params.id,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return res.json({ success: true, data: analytics });
  })
);

// ==========================================
// INSIGHTS
// ==========================================

router.get(
  '/:id/insights',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as any;
    const result = await InsightsEngine.listInsights({
      workerId: req.params.id,
      status: query.status,
      type: query.type,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return res.json({ success: true, data: result.insights, total: result.total });
  })
);

router.post(
  '/:id/insights/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const insights = await InsightsEngine.generateInsights(req.params.id);
    return res.json({ success: true, data: insights, generated: insights.length });
  })
);

router.put(
  '/:id/insights/:insightId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!body?.status) {
      return res.status(400).json({ error: 'status is required' });
    }
    await InsightsEngine.reviewInsight(
      req.params.insightId,
      body.status,
      (req as any).user?.id || 'admin'
    );
    return res.json({ success: true });
  })
);

export default router;
