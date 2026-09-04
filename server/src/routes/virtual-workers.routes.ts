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
import * as PreviewService from '../services/ai/virtualWorkerPreviewService.js';
import * as WorkerService from '../services/ai/virtualWorkerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

// All routes require superadmin — virtual workers are global system configuration
router.use(verifyToken);
router.use(requireRole('super_admin'));

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
      memory_policy: body.memory_policy,
      channel_policy: body.channel_policy,
      retrieval_policy: body.retrieval_policy,
      cta_policy: body.cta_policy,
      release_notes: body.release_notes,
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
      knowledge_pill_id: body.knowledge_pill_id,
      product_slug: body.product_slug,
      priority_weight: body.priority_weight,
      usage_mode: body.usage_mode,
      section_keys: body.section_keys,
      language_policy: body.language_policy,
      fallback_policy: body.fallback_policy,
      hard_required: body.hard_required,
      max_context_chars: body.max_context_chars,
      metadata: body.metadata,
    });
    return res.status(201).json({ success: true, data: assignment });
  })
);

router.get(
  '/:id/knowledge/pills',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const pills = await WorkerService.listKnowledgePills({
      workerId: req.params.id,
      includeUnassigned: req.query.includeUnassigned !== 'false',
    });
    return res.json({ success: true, data: pills });
  })
);

router.post(
  '/:id/knowledge/pills',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!body?.slug || !body?.title) {
      return res.status(400).json({ error: 'slug and title are required' });
    }
    const pill = await WorkerService.createKnowledgePill({
      slug: body.slug,
      product_slug: body.product_slug,
      title: body.title,
      summary: body.summary,
      language: body.language,
      status: body.status,
      source_type: body.source_type,
      metadata: body.metadata,
      authored_by: (req as any).user?.id || null,
      change_notes: body.change_notes,
      sections: Array.isArray(body.sections) ? body.sections : [],
    });
    return res.status(201).json({ success: true, data: pill });
  })
);

router.put(
  '/:id/knowledge/pills/:pillId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    const pill = await WorkerService.updateKnowledgePill(req.params.pillId, {
      title: body.title,
      summary: body.summary,
      language: body.language,
      status: body.status,
      metadata: body.metadata,
      authored_by: (req as any).user?.id || null,
      change_notes: body.change_notes,
      sections: Array.isArray(body.sections) ? body.sections : undefined,
    });
    if (!pill) return res.status(404).json({ error: 'Knowledge pill not found' });
    return res.json({ success: true, data: pill });
  })
);

router.post(
  '/:id/knowledge/bootstrap-defaults',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const pills = await WorkerService.bootstrapDefaultKnowledgePills(req.params.id);
    return res.json({ success: true, data: pills, created: pills.length });
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
      topic: query.topic,
      intent: query.intent,
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

router.post(
  '/:id/conversations/:convId/redact',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const redacted = await ConversationLogger.redactConversation({
      workerId: req.params.id,
      conversationId: req.params.convId,
      redactedBy: (req as any).user?.id || null,
    });
    if (!redacted) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true });
  })
);

router.delete(
  '/:id/conversations/:convId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const removed = await ConversationLogger.deleteConversation({
      workerId: req.params.id,
      conversationId: req.params.convId,
    });
    if (!removed) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true });
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

router.get(
  '/:id/release-readiness',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const readiness = await WorkerService.getWorkerReleaseReadiness(req.params.id);
    return res.json({ success: true, data: readiness });
  })
);

router.get(
  '/:id/evaluations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const evaluations = await WorkerService.listWorkerEvaluations(req.params.id);
    return res.json({ success: true, data: evaluations });
  })
);

router.post(
  '/:id/evaluations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    if (!body?.name) return res.status(400).json({ error: 'name is required' });
    try {
      const evaluation = await WorkerService.createWorkerEvaluation({
        worker_id: req.params.id,
        name: body.name,
        dataset_json: body.dataset_json,
        results_json: body.results_json,
        score: body.score,
        status: body.status,
        created_by: (req as any).user?.id || null,
      });
      return res.status(201).json({ success: true, data: evaluation });
    } catch (error) {
      if (error instanceof WorkerService.VirtualWorkerValidationError) {
        return res.status(error.statusCode).json({ ...mapAppErrorResponse(error, req, 'error'), code: error.code });
      }
      throw error;
    }
  })
);

router.get(
  '/:id/releases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const releases = await WorkerService.listWorkerReleases(req.params.id);
    return res.json({ success: true, data: releases });
  })
);

router.post(
  '/:id/releases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    try {
      const release = await WorkerService.createWorkerRelease({
        worker_id: req.params.id,
        profile_id: body.profile_id,
        evaluation_id: body.evaluation_id,
        release_type: body.release_type,
        status: body.status,
        notes: body.notes,
        payload_json: body.payload_json,
        created_by: (req as any).user?.id || null,
      });
      return res.status(201).json({ success: true, data: release });
    } catch (error) {
      if (error instanceof WorkerService.VirtualWorkerValidationError) {
        return res.status(error.statusCode).json({ ...mapAppErrorResponse(error, req, 'error'), code: error.code });
      }
      throw error;
    }
  })
);

router.post(
  '/:id/releases/:releaseId/activate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const release = await WorkerService.activateWorkerRelease(req.params.releaseId);
      if (!release) return res.status(404).json({ error: 'Release not found' });
      return res.json({ success: true, data: release });
    } catch (error) {
      if (error instanceof WorkerService.VirtualWorkerValidationError) {
        return res.status(error.statusCode).json({ ...mapAppErrorResponse(error, req, 'error'), code: error.code });
      }
      throw error;
    }
  })
);

router.post(
  '/:id/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as any;
    try {
      const preview = await PreviewService.previewVirtualWorkerResponse({
        workerIdOrSlug: req.params.id,
        message: String(body?.message || ''),
        locale: body?.locale,
        userEnabledWebSearch: Boolean(body?.userEnabledWebSearch),
      });
      return res.json({ success: true, data: preview });
    } catch (error) {
      if (error instanceof WorkerService.VirtualWorkerValidationError) {
        return res.status(error.statusCode).json({ ...mapAppErrorResponse(error, req, 'error'), code: error.code });
      }
      throw error;
    }
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
