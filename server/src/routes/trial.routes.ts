/**
 * Trial Routes
 * API endpoints for trial lifecycle management
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoGuard } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

const ADMIN_ROLES = new Set(['owner', 'admin', 'administrator', 'superadmin', 'super_admin']);

const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

router.use(apiAuthRateLimiter);

interface TrialServiceInterface {
  convertTrialToOrg?: (
    trialId: string,
    userId: string,
    newOrgName: string
  ) => Promise<{ newOrganizationId: string }>;
  sendTrialWarnings?: () => Promise<number>;
  processExpiredTrials?: () => Promise<number>;
}

interface AuditServiceInterface {
  log?: (data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

let TrialService: TrialServiceInterface | null = null;
let AuditService: AuditServiceInterface | null = null;
let AccessPolicyService: any = null;

try {
  const trialModule = (await import('../services/trialService.js')) as any;
  TrialService = (trialModule.default || trialModule) as TrialServiceInterface;
} catch {
  logger.warn('[Trial Routes] TrialService not available');
}

try {
  const auditModule = (await import('../services/auditService.js')) as any;
  AuditService = (auditModule.default || auditModule) as AuditServiceInterface;
} catch {
  logger.warn('[Trial Routes] AuditService not available');
}

try {
  const apsModule = (await import('../services/accessPolicyService.js')) as any;
  AccessPolicyService = apsModule.default || apsModule;
} catch {
  logger.warn('[Trial Routes] AccessPolicyService not available');
}

/**
 * GET /api/trial/status
 * Get trial status for the current user's organization
 */
router.get(
  '/status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!AccessPolicyService?.buildPolicySnapshot) {
        return notConfigured(res);
      }

      const snapshot = await AccessPolicyService.buildPolicySnapshot(orgId, {
        isDemoView: String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true',
      });
      if (!snapshot) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      return res.json({
        orgType: snapshot.orgType,
        isTrial: snapshot.isTrial,
        isDemo: snapshot.isDemo,
        isPaid: snapshot.isPaid,
        subscriptionStatus: snapshot.subscriptionStatus,
        trialDaysLeft: snapshot.trialDaysLeft,
        isTrialExpired: snapshot.isTrialExpired,
        warningLevel: snapshot.warningLevel,
        trialStartedAt: snapshot.trialStartedAt,
        trialExpiresAt: snapshot.trialExpiresAt,
        usagePercent: snapshot.usagePercent,
        hasPaymentMethod: snapshot.hasPaymentMethod,
        upgradeCtas: snapshot.upgradeCtas,
      });
    } catch (error: unknown) {
      logger.error('Trial Status Error:', error);
      return res.status(500).json({ error: 'Unknown error' });
    }
  })
);

/**
 * POST /api/trial/:trialId/convert
 * Convert trial to permanent organization
 */
router.post(
  '/:trialId/convert',
  verifyToken,
  demoGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { trialId } = req.params;
      const { newOrgName } = req.body;
      const userId = req.user?.id;
      const requesterOrgId = req.user?.organizationId;
      const normalizedRole = String(req.user?.role || '')
        .trim()
        .toLowerCase();

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requesterOrgId || requesterOrgId !== trialId) {
        return res.status(403).json({
          error: 'You can only convert the active organization trial.',
          errorCode: 'TRIAL_SCOPE_MISMATCH',
        });
      }

      if (!ADMIN_ROLES.has(normalizedRole)) {
        return res.status(403).json({
          error: 'Only organization admins can convert a trial.',
          errorCode: 'TRIAL_CONVERSION_FORBIDDEN',
        });
      }

      if (!newOrgName) {
        return res.status(400).json({
          error: 'New organization name is required',
          errorCode: 'MISSING_ORG_NAME',
        });
      }

      if (!TrialService?.convertTrialToOrg) {
        return notConfigured(res);
      }

      const result = await TrialService.convertTrialToOrg(trialId, userId, newOrgName);
      if (!result || typeof (result as any).newOrganizationId !== 'string') {
        return res.status(503).json({
          error: 'Trial conversion unavailable',
          errorCode: 'CONVERSION_FAILED',
        });
      }

      if (AuditService?.log) {
        await AuditService.log({
          userId,
          action: 'trial_converted',
          entityType: 'organization',
          entityId: trialId,
          metadata: { newOrganizationId: result.newOrganizationId, newOrgName },
        });
      }

      return res.json({
        success: true,
        message: 'Trial converted successfully',
        newOrganizationId: result.newOrganizationId,
      });
    } catch (error: unknown) {
      logger.error('Trial Conversion Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : message.includes('already') ? 409 : 500;
      const safeMessage =
        status === 404
          ? 'Trial not found'
          : status === 409
            ? 'Trial already converted'
            : 'Trial conversion failed';
      const code =
        status === 404
          ? 'TRIAL_NOT_FOUND'
          : status === 409
            ? 'TRIAL_ALREADY_CONVERTED'
            : 'TRIAL_CONVERSION_FAILED';
      return res.status(status).json({ error: safeMessage, code });
    }
  })
);

/**
 * POST /api/trial/confirm-transition
 * Records explicit user confirmations before organization creation (Phase C -> D Gate)
 */
router.post(
  '/confirm-transition',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AuditService?.log) {
      return notConfigured(res);
    }

    try {
      const { confirmations, confirmedAt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (
        !confirmations?.timeCommitment ||
        !confirmations?.teamScope ||
        !confirmations?.memoryAware
      ) {
        return res.status(400).json({
          error: 'All three confirmations required',
          required: ['timeCommitment', 'teamScope', 'memoryAware'],
        });
      }

      await AuditService.log({
        userId,
        action: 'trial_transition_confirmed',
        entityType: 'user',
        entityId: userId,
        metadata: {
          confirmations,
          confirmedAt: confirmedAt || new Date().toISOString(),
          phase: 'C_TO_D',
        },
      });

      return res.json({
        success: true,
        message: 'Transition confirmed',
        nextStep: 'ORG_SETUP_WIZARD',
      });
    } catch (error: unknown) {
      logger.error('Transition Confirmation Error:', error);
      return res.status(500).json({ error: 'Unknown error' });
    }
  })
);

export default router;
