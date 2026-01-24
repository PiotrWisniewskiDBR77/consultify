/**
 * Capacity Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';

import CapacityController from '../../controllers/CapacityController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/capacity/user/:userId
 * Get capacity for a user
 */
router.get('/user/:userId', CapacityController.getUserCapacity);

/**
 * GET /api/capacity/project/:projectId/overloads
 * Get overloads for a project
 */
router.get('/project/:projectId/overloads', CapacityController.getProjectOverloads);

/**
 * GET /api/capacity/project/:projectId/summary
 * Get capacity summary for a project
 */
router.get('/project/:projectId/summary', CapacityController.getProjectSummary);

export default router;
