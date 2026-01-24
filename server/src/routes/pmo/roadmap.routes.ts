/**
 * Roadmap Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';

import RoadmapController from '../../controllers/RoadmapController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/roadmap/:projectId/waves
 * Get roadmap waves for a project
 */
router.get('/:projectId/waves', RoadmapController.getWaves);

/**
 * POST /api/roadmap/:projectId/waves
 * Create a new roadmap wave
 */
router.post('/:projectId/waves', RoadmapController.createWave);

/**
 * GET /api/roadmap/:projectId/summary
 * Get roadmap summary
 */
router.get('/:projectId/summary', RoadmapController.getSummary);

export default router;
