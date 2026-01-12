/**
 * Admin Data Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Admin panel data endpoints (requires ADMIN role)
 */

import { Router } from 'express';

import AdminDataController from '../controllers/AdminDataController.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { UpdateUserTierSchema } from '../validators/admin.validators.js';

const router = Router();

// Apply auth and admin middleware to all routes
router.use(verifyToken);
router.use(verifyAdmin);

// ==========================================
// USER TIERS & COST ATTRIBUTION
// ==========================================

/**
 * GET /api/admin-data/user-tiers/:orgId
 * Get user tier assignments with usage stats
 */
router.get('/user-tiers/:orgId', AdminDataController.getUserTiers);

/**
 * PUT /api/admin-data/user-tiers/:orgId/:userId
 * Update user's AI tier
 */
router.put('/user-tiers/:orgId/:userId', validateBody(UpdateUserTierSchema), AdminDataController.updateUserTier);

/**
 * GET /api/admin-data/cost-attribution/:orgId
 * Get cost attribution by user and project
 */
router.get('/cost-attribution/:orgId', AdminDataController.getCostAttribution);

// ==========================================
// SECURITY & ACTIVITY
// ==========================================

/**
 * GET /api/admin-data/security-events/:orgId
 * Get security events
 */
router.get('/security-events/:orgId', AdminDataController.getSecurityEvents);

/**
 * GET /api/admin-data/dashboard-activity/:orgId
 * Get dashboard activity
 */
router.get('/dashboard-activity/:orgId', AdminDataController.getDashboardActivity);

export default router;
