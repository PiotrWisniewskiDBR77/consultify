/**
 * Stage Gates Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All stage gate-related API endpoints with Zod validation
 */

import { Router } from 'express';

import StageGateControllerRaw from '../controllers/StageGateController.js';
const StageGateController = StageGateControllerRaw as any;
import { verifyToken } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { requireAnyProjectCapability } from '../middleware/effectiveCapability.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { PassGateSchema } from '../validators/stageGate.validators.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// Resolve tenant ownership before capability evaluation. This preserves the
// endpoint contract that a foreign-tenant project is indistinguishable from a
// missing project (404) and avoids leaking its existence through a preceding 403.
router.param('projectId', async (req: AuthRequest, res, next, projectId: string) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const project = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [projectId, organizationId]
    );
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// ==========================================
// STAGE GATE OPERATIONS
// ==========================================

/**
 * GET /api/stage-gates/:projectId/evaluate/:gateType
 * Evaluate gate readiness
 */
router.get('/:projectId/evaluate/:gateType', StageGateController.evaluateGate);

/**
 * GET /api/stage-gates/:projectId/current
 * Get current gate for project
 */
router.get('/:projectId/current', StageGateController.getCurrentGate);

/**
 * POST /api/stage-gates/:projectId/pass/:gateType
 * Pass gate (requires manage_stage_gates permission)
 */
router.post(
  '/:projectId/pass/:gateType',
  requireAnyProjectCapability(['gate.request', 'gate.approve'], undefined, {
    shadow: true,
    enforceMode: 'enforce',
  }),
  validateBody(PassGateSchema),
  StageGateController.passGate
);

/**
 * GET /api/stage-gates/:projectId/history
 * Get gate history for project
 */
router.get('/:projectId/history', StageGateController.getGateHistory);

export default router;
