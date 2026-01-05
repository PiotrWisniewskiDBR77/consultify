/**
 * Initiatives Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All initiative-related API endpoints with Zod validation
 */

import { Router } from 'express';

import InitiativeControllerRaw from '../controllers/InitiativeController.js';
const InitiativeController = InitiativeControllerRaw as any;
import { verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
    CreateInitiativeSchema,
    UpdateInitiativeSchema,
    UpdateInitiativeStatusSchema,
} from '../validators/initiative.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// INITIATIVE CRUD
// ==========================================

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
router.patch('/:id/status', validateBody(UpdateInitiativeStatusSchema), InitiativeController.updateInitiativeStatus);

export default router;
