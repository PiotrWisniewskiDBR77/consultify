/**
 * SuperAdmin Billing Operations Routes (T109)
 * Guardrailed billing ops: plan changes, grace periods, overview, audit.
 */
import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.get(
  '/overview/:orgId',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { getBillingOverview } = await import('../../services/billing/billingAdminOps.js');
    const overview = await getBillingOverview(orgId);
    res.json({ success: true, data: overview });
  })
);

router.post(
  '/change-plan',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, newPlanId, reason } = req.body;
    if (!organizationId || !newPlanId || !reason) {
      return res.status(400).json({ error: 'organizationId, newPlanId, and reason are required' });
    }
    const { changePlanWithGuardrails } = await import('../../services/billing/billingAdminOps.js');
    const result = await changePlanWithGuardrails(
      organizationId,
      newPlanId,
      req.user?.id || 'unknown',
      reason
    );
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    logger.info(`[BillingAdmin] Plan changed for ${organizationId} by ${req.user?.id}`);
    res.json(result);
  })
);

router.post(
  '/grace-period',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, days, reason } = req.body;
    if (!organizationId || !days || !reason) {
      return res.status(400).json({ error: 'organizationId, days, and reason are required' });
    }
    const { grantGracePeriod } = await import('../../services/billing/billingAdminOps.js');
    const result = await grantGracePeriod(
      organizationId,
      parseInt(days, 10),
      req.user?.id || 'unknown',
      reason
    );
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    res.json(result);
  })
);

export default router;
