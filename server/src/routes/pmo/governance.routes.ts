/**
 * Governance Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';

import GovernanceController from '../../controllers/GovernanceController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireProjectCapability } from '../../middleware/effectiveCapability.middleware.js';

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
router.post(
  '/change-requests',
  // Faza B (2026-07-14): shadow-only capability telemetry. allowWithoutProject
  // because change requests may arrive without an explicit project context.
  requireProjectCapability('change.request.submit', undefined, {
    shadow: true,
    allowWithoutProject: true,
  }),
  GovernanceController.createChangeRequest
);

/**
 * GET /api/governance/policies
 * List governance policies
 */
router.get('/policies', GovernanceController.getPolicies);

/**
 * GET /api/governance/audit
 * List governance audit logs
 */
router.get('/audit', async (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'audit-1',
        action: 'policy_updated',
        actor: 'admin',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'audit-2',
        action: 'request_approved',
        actor: 'manager',
        timestamp: new Date().toISOString(),
      },
    ],
    total: 2,
  });
});

/**
 * GET /api/governance/permissions
 * List governance permissions
 */
router.get('/permissions', async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'perm-1', name: 'view_policies', description: 'View governance policies' },
      { id: 'perm-2', name: 'edit_policies', description: 'Edit governance policies' },
      { id: 'perm-3', name: 'approve_requests', description: 'Approve change requests' },
    ],
  });
});

/**
 * GET /api/governance/break-glass/active
 * List active break-glass sessions
 */
router.get('/break-glass/active', async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'No active break-glass sessions',
  });
});

export default router;
