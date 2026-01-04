/**
 * Admin Alerts Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Admin alert management endpoints (requires ADMIN role)
 */

import { Router } from 'express';

import AdminAlertController from '../controllers/AdminAlertController.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { CreateAdminAlertSchema } from '../validators/admin.validators.js';

// Apply rate limiting
const router = Router();

// Apply auth and admin middleware to all routes
router.use(verifyToken);
router.use(verifyAdmin);

// ==========================================
// ADMIN ALERTS
// ==========================================

/**
 * GET /api/admin-alerts
 * Get all admin alerts for organization
 */
router.get('/', AdminAlertController.getAlerts);

/**
 * POST /api/admin-alerts
 * Create admin alert
 */
router.post('/', validateBody(CreateAdminAlertSchema), AdminAlertController.createAlert);

/**
 * GET /api/admin-alerts/history
 * Get alert trigger history
 */
router.get('/history', AdminAlertController.getAlertHistory);

export default router;
