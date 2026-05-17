/**
 * AI Governance Routes (T119-T122)
 * Context policy, user privacy, document governance, health checks.
 */
import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// === T119: Org Context Policy ===

// === T118: Org AI Policy (internet, audit, levels) ===

router.get(
  '/policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId)
      return res.status(400).json({ error: 'Organization required', code: 'ORG_CONTEXT_REQUIRED' });

    try {
      const { default: AIPolicyEngine } = await import('../services/aiPolicyEngine.js');
      const [effective, summary] = await Promise.all([
        AIPolicyEngine.getEffectivePolicy(orgId, null, req.user?.id || null),
        AIPolicyEngine.getPolicySummary(orgId),
      ]);

      const { getRuntimeWebSearchStatus } =
        await import('../services/ai/runtimeWebSearchService.js');
      const runtimeStatus = getRuntimeWebSearchStatus();
      res.json({
        success: true,
        data: {
          effective,
          summary,
          runtime: {
            ...runtimeStatus,
            webSearchAvailable:
              Boolean((effective as any)?.internetEnabled) && runtimeStatus.available,
          },
        },
      });
    } catch {
      res.status(500).json({
        error: 'AI governance policy could not be loaded',
        code: 'AI_GOVERNANCE_ORG_POLICY_READ_FAILED',
      });
    }
  })
);

router.put(
  '/policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId)
      return res.status(400).json({ error: 'Organization required', code: 'ORG_CONTEXT_REQUIRED' });

    try {
      const { default: AIPolicyEngine } = await import('../services/aiPolicyEngine.js');
      await AIPolicyEngine.updatePolicy(orgId, req.body || {});

      logger.info(`[AIGov] Policy updated for org ${orgId} by ${req.user?.id}`);
      res.json({ success: true, message: 'Policy updated' });
    } catch {
      res.status(500).json({
        error: 'AI governance policy could not be updated',
        code: 'AI_GOVERNANCE_ORG_POLICY_UPDATE_FAILED',
      });
    }
  })
);

router.get(
  '/context-policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId)
      return res.status(400).json({ error: 'Organization required', code: 'ORG_CONTEXT_REQUIRED' });
    const { getOrgContextPolicy } = await import('../services/ai/contextGovernance.js');
    try {
      const policy = await getOrgContextPolicy(orgId);
      res.json({ success: true, data: policy });
    } catch {
      res.status(500).json({
        error: 'Context policy store is invalid',
        code: 'CONTEXT_POLICY_INVALID_STORE',
      });
    }
  })
);

router.put(
  '/context-policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId)
      return res.status(400).json({ error: 'Organization required', code: 'ORG_CONTEXT_REQUIRED' });
    const { updateOrgContextPolicy } = await import('../services/ai/contextGovernance.js');
    try {
      await updateOrgContextPolicy(orgId, req.body);
      logger.info(`[AIGov] Context policy updated for org ${orgId} by ${req.user?.id}`);
      res.json({ success: true, message: 'Context policy updated' });
    } catch {
      res.status(500).json({
        error: 'Context policy could not be saved',
        code: 'CONTEXT_POLICY_PERSIST_FAILED',
      });
    }
  })
);

// === T120: User Privacy ===

router.get(
  '/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    try {
      const { getUserPrivacySettings } = await import('../services/ai/userPrivacyService.js');
      const settings = await getUserPrivacySettings(userId);
      res.json({ success: true, data: settings });
    } catch {
      res.status(500).json({
        error: 'AI governance privacy settings could not be loaded',
        code: 'AI_GOVERNANCE_PRIVACY_READ_FAILED',
      });
    }
  })
);

router.put(
  '/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    try {
      const { updateUserPrivacySettings } = await import('../services/ai/userPrivacyService.js');
      await updateUserPrivacySettings(userId, req.body);
      res.json({ success: true, message: 'Privacy settings updated' });
    } catch {
      res.status(500).json({
        error: 'AI governance privacy settings could not be updated',
        code: 'AI_GOVERNANCE_PRIVACY_UPDATE_FAILED',
      });
    }
  })
);

router.get(
  '/memory/preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    const { previewMemory } = await import('../services/ai/userPrivacyService.js');
    try {
      const memory = await previewMemory(userId);
      res.json({ success: true, data: memory });
    } catch {
      res
        .status(500)
        .json({ error: 'Memory store is invalid', code: 'AI_GOVERNANCE_MEMORY_INVALID_STORE' });
    }
  })
);

router.get(
  '/memory/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    const { exportMemory } = await import('../services/ai/userPrivacyService.js');
    try {
      const memory = await exportMemory(userId);
      res.json({ success: true, data: memory });
    } catch {
      res
        .status(500)
        .json({ error: 'Memory store is invalid', code: 'AI_GOVERNANCE_MEMORY_INVALID_STORE' });
    }
  })
);

router.delete(
  '/memory',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    const { deleteMemory } = await import('../services/ai/userPrivacyService.js');
    try {
      const result = await deleteMemory(userId);
      if (!result.success) {
        return res.status(500).json({
          error: 'Memory could not be deleted',
          code: 'AI_GOVERNANCE_MEMORY_DELETE_FAILED',
        });
      }
      res.json({ ...result });
    } catch {
      res
        .status(500)
        .json({ error: 'Memory could not be deleted', code: 'AI_GOVERNANCE_MEMORY_DELETE_FAILED' });
    }
  })
);

// === T121: Document Governance ===

router.put(
  '/documents/:id/ai-visibility',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { visibility } = req.body;
    if (!['allowed', 'blocked', 'requires_approval'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value' });
    }
    const { setDocumentVisibility } = await import('../services/ai/documentGovernance.js');
    await setDocumentVisibility(id, visibility);
    res.json({ success: true, message: 'Document AI visibility updated' });
  })
);

router.put(
  '/documents/:id/sensitivity',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { sensitivity } = req.body;
    if (!['public', 'internal', 'confidential'].includes(sensitivity)) {
      return res.status(400).json({ error: 'Invalid sensitivity value' });
    }
    const { setDocumentSensitivity } = await import('../services/ai/documentGovernance.js');
    await setDocumentSensitivity(id, sensitivity);
    res.json({ success: true, message: 'Document sensitivity updated' });
  })
);

// === T122: Health Checks ===

router.get(
  '/health',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const { runFullSanityCheck } = await import('../utils/archSanityCheck.js');
    const report = await runFullSanityCheck();
    res.json({ success: true, data: report });
  })
);

export default router;
