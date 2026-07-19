/**
 * organization-limits Routes
 * API endpoints for organization limits and policy snapshots
 */
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { buildPolicySnapshot } from '../../services/accessPolicyService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

/**
 * GET /api/organization/policy-snapshot
 * Get policy snapshot for the authenticated user's organization
 */
router.get(
  '/policy-snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.organizationId || req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized: Organization ID required' });
    }

    try {
      const snapshot = await buildPolicySnapshot(organizationId, {
        isDemoView: String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true',
      });

      if (!snapshot) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      return res.json(snapshot);
    } catch (err: any) {
      // Fail-closed — the policy snapshot drives access-control decisions downstream
      // (capability gates). A silent degrade here could hand back wrong/permissive
      // defaults, so this stays a real 5xx with a code, never err.message leak.
      logger.error('[OrganizationLimitsRoutes] Error fetching policy snapshot:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać ustawień dostępu organizacji',
        code: 'ORG_POLICY_SNAPSHOT_FAILED',
      });
    }
  })
);

export default router;
