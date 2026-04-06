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
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { default: AIPolicyEngine } = await import('../services/aiPolicyEngine.js');
    const [effective, summary] = await Promise.all([
      AIPolicyEngine.getEffectivePolicy(orgId, null, req.user?.id || null),
      AIPolicyEngine.getPolicySummary(orgId),
    ]);

    const { getRuntimeWebSearchStatus } = await import(
      '../services/ai/runtimeWebSearchService.js'
    );
    const runtimeStatus = getRuntimeWebSearchStatus();
    res.json({
      success: true,
      data: {
        effective,
        summary,
        runtime: {
          ...runtimeStatus,
          webSearchAvailable: Boolean((effective as any)?.internetEnabled) && runtimeStatus.available,
        },
      },
    });
  })
);

router.put(
  '/policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { default: AIPolicyEngine } = await import('../services/aiPolicyEngine.js');
    await AIPolicyEngine.updatePolicy(orgId, req.body || {});

    logger.info(`[AIGov] Policy updated for org ${orgId} by ${req.user?.id}`);
    res.json({ success: true, message: 'Policy updated' });
  })
);

router.get(
  '/context-policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const { getOrgContextPolicy } = await import('../services/ai/contextGovernance.js');
    const policy = await getOrgContextPolicy(orgId);
    res.json({ success: true, data: policy });
  })
);

router.put(
  '/context-policy',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const { updateOrgContextPolicy } = await import('../services/ai/contextGovernance.js');
    await updateOrgContextPolicy(orgId, req.body);
    logger.info(`[AIGov] Context policy updated for org ${orgId} by ${req.user?.id}`);
    res.json({ success: true, message: 'Context policy updated' });
  })
);

// === T120: User Privacy ===

router.get(
  '/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { getUserPrivacySettings } = await import('../services/ai/userPrivacyService.js');
    const settings = await getUserPrivacySettings(userId);
    res.json({ success: true, data: settings });
  })
);

router.put(
  '/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { updateUserPrivacySettings } = await import('../services/ai/userPrivacyService.js');
    await updateUserPrivacySettings(userId, req.body);
    res.json({ success: true, message: 'Privacy settings updated' });
  })
);

router.get(
  '/memory/preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { previewMemory } = await import('../services/ai/userPrivacyService.js');
    const memory = await previewMemory(userId);
    res.json({ success: true, data: memory });
  })
);

router.get(
  '/memory/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { exportMemory } = await import('../services/ai/userPrivacyService.js');
    const memory = await exportMemory(userId);
    res.json({ success: true, data: memory });
  })
);

router.delete(
  '/memory',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { deleteMemory } = await import('../services/ai/userPrivacyService.js');
    const result = await deleteMemory(userId);
    res.json({ ...result });
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
