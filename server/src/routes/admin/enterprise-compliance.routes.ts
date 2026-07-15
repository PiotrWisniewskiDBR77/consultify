/**
 * Enterprise Compliance Admin Routes
 *
 * Unified routes for SOC2 audit, DLP management, data residency,
 * retention automation, and org AI policy configuration.
 */
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { advancedDlpService } from '../../services/ai/advancedDlpService.js';
import { dataResidencyService } from '../../services/ai/dataResidencyService.js';
import { orgAiPolicyService } from '../../services/ai/orgAiPolicyService.js';
import { retentionAutomationService } from '../../services/ai/retentionAutomationService.js';
import { soc2AuditTrailService } from '../../services/ai/soc2AuditTrailService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
  const role = req.user?.role;
  if (role !== 'super_admin' && role !== 'administrator' && role !== 'owner') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
});
router.use(requireAdmin);

// === SOC2 Audit Trail ===

router.get(
  '/audit-trail/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { from, to, user_id, event_type } = req.query;
    const now = new Date();
    const result = await soc2AuditTrailService.exportAuditLog({
      organizationId: orgId,
      from: (from as string) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: (to as string) || now.toISOString(),
      userId: user_id as string,
      eventType: event_type as string,
    });

    res.json({ success: true, data: result });
  })
);

router.get(
  '/audit-trail/cost-attribution',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { from, to } = req.query;
    const now = new Date();
    const result = await soc2AuditTrailService.getCostAttribution({
      organizationId: orgId,
      from: (from as string) || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: (to as string) || now.toISOString(),
    });

    res.json({ success: true, data: result });
  })
);

// === Agent Decision Trace (HP-12) ===
//
// AI/agent action log — WHO ran WHAT, the AI suggestion, and the human
// decision on it. Sourced from `ai_audit_logs` via AIAuditLogger (the same
// store InitiativeController / ProjectController / ai.routes write to on
// every AI suggestion). Read-only, org-scoped by token, admin-gated by the
// router-level `requireAdmin` above. Date range is applied in-route because
// `getAuditLogs` filters by org/project/user/action, not by timestamp.
router.get(
  '/audit-trail/agent-decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { from, to, user_id, action_type, limit } = req.query;
    const { AIAuditLogger } = await import('../../services/aiAuditLogger.js');

    const rawLimit = Number(limit);
    const safeLimit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500)
      : 200;

    const logs = await AIAuditLogger.getAuditLogs(orgId, {
      userId: (user_id as string) || undefined,
      actionType: (action_type as string) || undefined,
      limit: safeLimit,
      offset: 0,
      includeExplanation: false,
    });

    let entries = Array.isArray(logs) ? logs : [];
    if (from) {
      const fromTime = new Date(from as string).getTime();
      if (Number.isFinite(fromTime)) {
        entries = entries.filter(
          (l: any) => new Date(l.created_at as string).getTime() >= fromTime
        );
      }
    }
    if (to) {
      const toTime = new Date(to as string).getTime();
      if (Number.isFinite(toTime)) {
        entries = entries.filter((l: any) => new Date(l.created_at as string).getTime() <= toTime);
      }
    }

    const data = entries.map((l: any) => ({
      id: l.id,
      createdAt: l.created_at,
      userId: l.user_id || null,
      userName:
        [l.first_name, l.last_name].filter(Boolean).join(' ').trim() || l.user_id || null,
      actionType: l.action_type || null,
      actionDescription: l.action_description || null,
      aiRole: l.ai_project_role || l.ai_role || null,
      aiSuggestion: l.ai_suggestion || null,
      userDecision: l.user_decision || null,
      confidenceLevel: l.confidence_level || null,
      projectId: l.project_id || null,
    }));

    res.json({
      success: true,
      data: { entries: data, totalCount: data.length, exportedAt: new Date().toISOString() },
    });
  })
);

// === DLP Rules ===

router.get(
  '/dlp/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const rules = await advancedDlpService.listRules(orgId);
    res.json({ success: true, data: rules });
  })
);

router.post(
  '/dlp/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const rule = await advancedDlpService.createRule({
      organizationId: orgId,
      ...req.body,
      createdBy: req.user?.id || '',
    });

    res.json({ success: true, data: rule });
  })
);

router.put(
  '/dlp/rules/:ruleId/toggle',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    await advancedDlpService.toggleRule(req.params.ruleId, orgId, req.body.isActive);
    res.json({ success: true });
  })
);

router.delete(
  '/dlp/rules/:ruleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    await advancedDlpService.deleteRule(req.params.ruleId, orgId);
    res.json({ success: true });
  })
);

router.post(
  '/dlp/scan',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const result = await advancedDlpService.scan(
      req.body.content,
      orgId,
      req.body.direction || 'both'
    );
    res.json({ success: true, data: result });
  })
);

// === Data Residency ===

router.get(
  '/data-residency',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const policy = await dataResidencyService.getPolicy(orgId);
    res.json({ success: true, data: policy });
  })
);

router.put(
  '/data-residency',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    await dataResidencyService.setPolicy(orgId, req.body, req.user?.id || '');
    const updated = await dataResidencyService.getPolicy(orgId);
    res.json({ success: true, data: updated });
  })
);

// === Retention ===

router.get(
  '/retention/schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const schedules = await retentionAutomationService.getSchedules(orgId);
    res.json({ success: true, data: schedules });
  })
);

router.post(
  '/retention/initialize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const schedules = await retentionAutomationService.initializeSchedule(orgId);
    res.json({ success: true, data: schedules });
  })
);

router.put(
  '/retention/schedules/:scheduleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    await retentionAutomationService.updateSchedule(req.params.scheduleId, orgId, req.body);
    res.json({ success: true });
  })
);

router.post(
  '/retention/execute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const results = await retentionAutomationService.executeRetention(orgId);
    res.json({ success: true, data: results });
  })
);

router.post(
  '/retention/preserve/:conversationId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    await retentionAutomationService.preserveConversation({
      conversationId: req.params.conversationId,
      organizationId: orgId,
      userId: req.user?.id || '',
      reason: req.body.reason,
    });
    res.json({ success: true });
  })
);

// === Org AI Policy ===

router.get(
  '/ai-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const policy = await orgAiPolicyService.getPolicy(orgId);
    res.json({ success: true, data: policy });
  })
);

router.put(
  '/ai-policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const updated = await orgAiPolicyService.updatePolicy(orgId, req.body, req.user?.id || '');
    res.json({ success: true, data: updated });
  })
);

export default router;
