/**
 * Trial Routes
 * API endpoints for trial
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoGuard } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Service interfaces
interface TrialServiceInterface {
  convertTrialToOrg?: (
    trialId: string,
    userId: string,
    newOrgName: string
  ) => Promise<{ newOrganizationId: string }>;
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

// Dynamic imports for services (may not be migrated yet)
let TrialService: TrialServiceInterface | null = null;
let AuditService: AuditServiceInterface | null = null;

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

/**
 * POST /api/trial/:trialId/convert
 * Convert trial to permanent organization
 */
router.post(
  '/:trialId/convert',
  verifyToken,
  demoGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!TrialService?.convertTrialToOrg) {
      return res.status(503).json({ error: 'Trial service not available' });
    }

    try {
      const { trialId } = req.params;
      const { newOrgName } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!newOrgName) {
        return res.status(400).json({ error: 'New organization name is required' });
      }

      const result = await TrialService.convertTrialToOrg(trialId, userId, newOrgName);

      return res.json({
        success: true,
        message: 'Trial converted successfully',
        newOrganizationId: result.newOrganizationId,
      });
    } catch (error: unknown) {
      logger.error('Trial Conversion Error:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })
);

/**
 * POST /api/trial/confirm-transition
 * Records explicit user confirmations before organization creation (Phase C → D Gate)
 */
router.post(
  '/confirm-transition',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AuditService?.log) {
      return res.status(503).json({ error: 'Audit service not available' });
    }

    try {
      const { confirmations, confirmedAt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate all 3 confirmations are present
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

      // Log to audit trail
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
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })
);

export default router;
