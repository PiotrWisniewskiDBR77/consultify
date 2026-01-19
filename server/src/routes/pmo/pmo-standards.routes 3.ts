/**
 * PMO Standards Routes
 * FLOW-PMO-001: PMO Standards Configuration API
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import pmoStandardsService from '../../services/pmoStandardsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// ==========================================
// MIDDLEWARE
// ==========================================

router.use(verifyToken);

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/pmo/standards
 * List all available PMO standards
 */
router.get(
  '/standards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const standards = await pmoStandardsService.getStandards();

    return res.json({
      success: true,
      standards,
    });
  })
);

/**
 * GET /api/pmo/standards/:standardId
 * Get a specific PMO standard
 */
router.get(
  '/standards/:standardId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { standardId } = req.params;

    const standard = await pmoStandardsService.getStandard(standardId);

    if (!standard) {
      return res.status(404).json({ error: 'Standard not found' });
    }

    return res.json({
      success: true,
      standard,
    });
  })
);

/**
 * GET /api/pmo/standards/:standardId/roles
 * Get role definitions for a specific PMO standard
 */
router.get(
  '/standards/:standardId/roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { standardId } = req.params;

    const roles = await pmoStandardsService.getRoleDefinitions(standardId);

    return res.json({
      success: true,
      standardId,
      roles,
    });
  })
);

/**
 * GET /api/pmo/my-project-permissions/:projectId
 * Get current user's permissions in a project
 */
router.get(
  '/my-project-permissions/:projectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = await pmoStandardsService.getUserProjectPermissions(userId, projectId);

    return res.json({
      success: true,
      projectId,
      userId,
      permissions,
    });
  })
);

/**
 * GET /api/pmo/check-permission/:projectId/:permission
 * Check if current user has a specific permission in a project
 */
router.get(
  '/check-permission/:projectId/:permission',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const { projectId, permission } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = await pmoStandardsService.checkProjectPermission(
      userId,
      projectId,
      permission
    );

    return res.json({
      success: true,
      projectId,
      permission,
      hasPermission,
    });
  })
);

export default router;
