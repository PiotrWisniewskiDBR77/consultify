/**
 * Governance Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import GovernanceController from '../../controllers/GovernanceController.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/governance/change-requests
 * List change requests
 */
router.get('/change-requests', GovernanceController.getChangeRequests);

/**
 * POST /api/governance/change-requests
 * Create a new change request
 */
router.post('/change-requests', GovernanceController.createChangeRequest);

/**
 * GET /api/governance/policies
 * List governance policies
 */
router.get('/policies', GovernanceController.getPolicies);

export default router;
