/**
 * Initiatives Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All initiative-related API endpoints with Zod validation
 */

import { Router } from 'express';

import InitiativeControllerRaw from '../../controllers/InitiativeController.js';
const InitiativeController = InitiativeControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  CreateInitiativeSchema,
  UpdateInitiativeSchema,
  UpdateInitiativeStatusSchema,
} from '../../validators/initiative.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);

// ==========================================
// INITIATIVE CRUD
// ==========================================

/**
 * GET /api/initiatives/portfolio
 * Get initiatives with portfolio stats
 */
router.get('/portfolio', InitiativeController.getPortfolioData);

/**
 * GET /api/initiatives
 * Get all initiatives for organization
 */
router.get('/', InitiativeController.getInitiatives);

/**
 * POST /api/initiatives
 * Create a new initiative
 */
router.post('/', validateBody(CreateInitiativeSchema), InitiativeController.createInitiative);

/**
 * GET /api/initiatives/:id
 * Get single initiative by ID
 */
router.get('/:id', InitiativeController.getInitiativeById);

/**
 * PUT /api/initiatives/:id
 * Update initiative
 */
router.put('/:id', validateBody(UpdateInitiativeSchema), InitiativeController.updateInitiative);

/**
 * PATCH /api/initiatives/:id/status
 * Update initiative status
 */
router.patch(
  '/:id/status',
  validateBody(UpdateInitiativeStatusSchema),
  InitiativeController.updateInitiativeStatus
);

// ==========================================
// FLOW-INITIATIVE-001: STATUS TRANSITIONS
// ==========================================

/**
 * GET /api/initiatives/:id/readiness
 * Check if initiative is ready for review
 */
router.get('/:id/readiness', InitiativeController.checkReadiness);

/**
 * POST /api/initiatives/:id/submit-review
 * Submit initiative for review
 */
router.post('/:id/submit-review', InitiativeController.submitForReview);

/**
 * POST /api/initiatives/:id/approve
 * Approve initiative
 */
router.post('/:id/approve', InitiativeController.approveInitiative);

/**
 * POST /api/initiatives/:id/reject
 * Reject initiative (back to planning)
 */
router.post('/:id/reject', InitiativeController.rejectInitiative);

/**
 * POST /api/initiatives/:id/start-execution
 * Start execution phase
 */
router.post('/:id/start-execution', InitiativeController.startExecution);

/**
 * POST /api/initiatives/:id/block
 * Block initiative
 */
router.post('/:id/block', InitiativeController.blockInitiative);

/**
 * POST /api/initiatives/:id/unblock
 * Unblock initiative
 */
router.post('/:id/unblock', InitiativeController.unblockInitiative);

/**
 * POST /api/initiatives/:id/complete
 * Mark initiative as done
 */
router.post('/:id/complete', InitiativeController.completeInitiative);

/**
 * POST /api/initiatives/:id/move
 * Move initiative to different project
 */
router.post('/:id/move', InitiativeController.moveInitiative);

/**
 * POST /api/initiatives/:id/archive
 * Archive initiative
 */
router.post('/:id/archive', InitiativeController.archiveInitiative);

export default router;
