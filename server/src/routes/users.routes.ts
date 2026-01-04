/**
 * Users Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All user-related API endpoints with Zod validation
 */

import { Router } from 'express';

import UserController from '../controllers/UserController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { UpdateUserRoleSchema, UpdateUserSchema } from '../validators/user.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// USER CRUD
// ==========================================

/**
 * GET /api/users
 * Get all users for organization
 */
router.get('/', UserController.getUsers);

/**
 * GET /api/users/:id
 * Get single user by ID
 */
router.get('/:id', UserController.getUserById);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', validateBody(UpdateUserSchema), UserController.updateUser);

/**
 * PATCH /api/users/:id/role
 * Update user role (Admin only)
 */
router.patch('/:id/role', validateBody(UpdateUserRoleSchema), UserController.updateUserRole);

export default router;
