/**
 * Inbox Enterprise Routes
 * V4-INBX-02, V4-INBX-03, V4-INBX-05, V4-INBX-06
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { inboxEnterpriseService } from '../services/inboxEnterpriseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

// M02-002/M02-006: this MUST NOT fall back to a client-supplied
// x-organization-id header or ?organizationId= query param. Both are fully
// attacker-controlled — any authenticated caller could set either to another
// tenant's org id. `verifyToken` (auth.middleware.ts `attachUser`) already
// resolves req.organizationId server-side from the verified JWT claim, the
// confirmed org-context membership lookup, or the caller's actual ACTIVE org
// membership; req.user.organizationId is that SAME resolved value (never the
// raw token claim). If both are empty the caller has no server-resolvable
// tenant context (e.g. no active org membership) and every one of these
// org-scoped enterprise Inbox endpoints must fail closed rather than trust
// anything the client sent. Every downstream inboxEnterpriseService.* call in
// this file is keyed off this orgId, so this is the single choke point.
const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId = req.user?.organizationId || req.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// ═══════════════════════════════════════════
// V4-INBX-06: Connectors + Routing
// ═══════════════════════════════════════════

router.post(
  '/connectors/ingest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      sourceChannel: z.string(),
      sourceId: z.string().optional(),
      payloadJson: z.string().optional(),
      targetUserId: z.string().optional(),
      senderEmail: z.string().optional(),
      senderName: z.string().optional(),
      subject: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.ingestConnectorItem(id.orgId, p.data);
    res.status(201).json(r);
  })
);

router.post(
  '/connectors/:itemId/route',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const r = await inboxEnterpriseService.routeConnectorItem(id.orgId, req.params.itemId);
    res.json(r);
  })
);

router.get(
  '/connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const status = req.query.status as string | undefined;
    res.json({ items: await inboxEnterpriseService.listConnectorItems(id.orgId, status) });
  })
);

router.post(
  '/routing-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      channel: z.string(),
      ruleName: z.string().optional(),
      conditionsJson: z.record(z.string(), z.unknown()).optional(),
      targetUserId: z.string().optional(),
      targetProjectId: z.string().optional(),
      priority: z.number().optional(),
      actionType: z.string().optional(),
      actionConfig: z.record(z.string(), z.unknown()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.createRoutingRule(id.orgId, p.data);
    res.status(201).json(r);
  })
);

router.get(
  '/routing-rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const channel = req.query.channel as string | undefined;
    res.json({ rules: await inboxEnterpriseService.listRoutingRules(id.orgId, channel) });
  })
);

router.put(
  '/routing-rules/:ruleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.updateRoutingRule(id.orgId, req.params.ruleId, req.body));
  })
);

router.delete(
  '/routing-rules/:ruleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.deleteRoutingRule(id.orgId, req.params.ruleId));
  })
);

// ═══════════════════════════════════════════
// V4-INBX-02: Focus Board
// ═══════════════════════════════════════════

router.post(
  '/focus/boards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      name: z.string().optional(),
      capacityLimit: z.number().optional(),
      rulesJson: z.record(z.string(), z.unknown()).optional(),
      templateId: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.createFocusBoard(id.userId, id.orgId, p.data);
    res.status(201).json(r);
  })
);

router.get(
  '/focus/boards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ boards: await inboxEnterpriseService.getFocusBoards(id.userId, id.orgId) });
  })
);

router.put(
  '/focus/boards/:boardId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(
      await inboxEnterpriseService.updateFocusBoard(req.params.boardId, id.userId, req.body)
    );
  })
);

router.post(
  '/focus/boards/:boardId/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      inboxItemId: z.string().optional(),
      sourceEntityType: z.string().optional(),
      sourceEntityId: z.string().optional(),
      title: z.string(),
      priority: z.string().optional(),
      plannedDate: z.string().optional(),
      timeEstimateMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.addFocusItem(req.params.boardId, id.orgId, p.data);
    if ('error' in r) {
      // board_not_found = the board is absent or owned by another org (fail-closed).
      res.status(r.error === 'board_not_found' ? 404 : 409).json(r);
      return;
    }
    res.status(201).json(r);
  })
);

router.get(
  '/focus/boards/:boardId/items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const status = req.query.status as string | undefined;
    res.json({
      items: await inboxEnterpriseService.getFocusItems(req.params.boardId, id.orgId, status),
    });
  })
);

router.post(
  '/focus/items/:itemId/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.completeFocusItem(req.params.itemId, id.orgId));
  })
);

router.delete(
  '/focus/items/:itemId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.removeFocusItem(req.params.itemId, id.orgId));
  })
);

router.post(
  '/focus/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      name: z.string(),
      description: z.string().optional(),
      rulesJson: z.record(z.string(), z.unknown()).optional(),
      capacityLimit: z.number().optional(),
      isOrgDefault: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.createFocusTemplate(id.orgId, id.userId, p.data);
    res.status(201).json(r);
  })
);

router.get(
  '/focus/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ templates: await inboxEnterpriseService.listFocusTemplates(id.orgId) });
  })
);

// ═══════════════════════════════════════════
// V4-INBX-03: AI Triage
// ═══════════════════════════════════════════

router.post(
  '/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      inboxItemId: z.string(),
      suggestedPriority: z.string().optional(),
      suggestedSection: z.string().optional(),
      suggestedAction: z.string().optional(),
      confidenceScore: z.number(),
      reasoning: z.string().optional(),
      originalPriority: z.string().optional(),
      originalSection: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await inboxEnterpriseService.triageInboxItem(id.orgId, p.data);
    res.status(201).json(r);
  })
);

router.post(
  '/triage/:triageId/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.acceptTriage(req.params.triageId, id.orgId));
  })
);

router.post(
  '/triage/:triageId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.rejectTriage(req.params.triageId, id.orgId));
  })
);

router.post(
  '/triage/:triageId/undo',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await inboxEnterpriseService.undoTriage(req.params.triageId, id.orgId));
  })
);

router.get(
  '/triage/log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const inboxItemId = req.query.inboxItemId as string | undefined;
    res.json({ log: await inboxEnterpriseService.getTriageLog(id.orgId, inboxItemId) });
  })
);

router.get(
  '/triage/config',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const config = await inboxEnterpriseService.getTriageConfig(id.orgId, id.userId);
    res.json(config || { autoTriageEnabled: false, confidenceThreshold: 0.7 });
  })
);

router.put(
  '/triage/config',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      autoTriageEnabled: z.boolean().optional(),
      confidenceThreshold: z.number().optional(),
      allowedActions: z.array(z.string()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.json(await inboxEnterpriseService.upsertTriageConfig(id.orgId, id.userId, p.data));
  })
);

// ═══════════════════════════════════════════
// V4-INBX-05: Inbox Table (App Table Standard)
// ═══════════════════════════════════════════

router.get(
  '/table',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      section: req.query.section as string | undefined,
      slaStatus: req.query.slaStatus as string | undefined,
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortDir: req.query.sortDir as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };
    res.json(await inboxEnterpriseService.getInboxTable(id.userId, id.orgId, filters));
  })
);

router.get(
  '/items/:itemId/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const preview = await inboxEnterpriseService.getInboxItemPreview(id.userId, req.params.itemId);
    if (!preview) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json(preview);
  })
);

export default router;
