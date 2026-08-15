/**
 * Organizations Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All organization-related API endpoints with Zod validation
 */

import { Router } from 'express';

import OrganizationControllerRaw from '../../controllers/OrganizationController.js';
const OrganizationController = OrganizationControllerRaw as any;
import { requireRole, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import adminAuditService from '../../services/adminAuditService.js';
import logger from '../../utils/Logger.js';
import {
  AddMemberSchema,
  CreateOrganizationSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from '../../validators/organization.validators.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// ORGANIZATION CRUD
// ==========================================

/**
 * GET /api/organizations/current
 * Get current user's organizations
 */
router.get('/current', OrganizationController.getCurrentOrganizations);

/**
 * POST /api/organizations
 * Create new organization
 */
router.post('/', validateBody(CreateOrganizationSchema), OrganizationController.createOrganization);

/**
 * GET /api/organizations/:orgId
 * Get organization by ID
 */
router.get('/:orgId', OrganizationController.getOrganizationById);

/**
 * PUT /api/organizations/:orgId
 * Update organization
 */
router.put(
  '/:orgId',
  validateBody(UpdateOrganizationSchema),
  OrganizationController.updateOrganization
);

// ==========================================
// MEMBERS MANAGEMENT
// ==========================================

/**
 * GET /api/organizations/:orgId/members
 * Get organization members — ADMIN/OWNER only (the full member list exposes
 * names + emails; a plain USER must not be able to dump the directory).
 */
router.get(
  '/:orgId/members',
  requireRole('ADMIN', 'OWNER', 'SUPERADMIN'),
  OrganizationController.getMembers
);

/**
 * POST /api/organizations/:orgId/members
 * Add member to organization (with audit logging)
 */
router.post(
  '/:orgId/members',
  validateBody(AddMemberSchema),
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400) {
        adminAuditService
          .logAction({
            adminId: (req as any).userId || (req as any).user?.id || 'unknown',
            actionType: 'add_member',
            details: { orgId: req.params.orgId, member: req.body, isSensitive: true },
          })
          .catch((err: unknown) => logger.warn('[Org] audit logging failed', err));
      }
      return originalJson(body);
    } as any;
    return OrganizationController.addMember(req, res, next);
  }
);

/**
 * PATCH /api/organizations/:orgId/members/:memberId/role
 * Update member role (with audit logging)
 */
router.patch(
  '/:orgId/members/:memberId/role',
  validateBody(UpdateMemberRoleSchema),
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400) {
        adminAuditService
          .logAction({
            adminId: (req as any).userId || (req as any).user?.id || 'unknown',
            actionType: 'update_member_role',
            details: {
              orgId: req.params.orgId,
              memberId: req.params.memberId,
              role: req.body,
              isSensitive: true,
            },
          })
          .catch((err: unknown) => logger.warn('[Org] audit logging failed', err));
      }
      return originalJson(body);
    } as any;
    return OrganizationController.updateMemberRole(req, res, next);
  }
);

/**
 * DELETE /api/organizations/:orgId/members/:memberId
 * Remove member from organization (with audit logging)
 */
router.delete(
  '/:orgId/members/:memberId',
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400) {
        adminAuditService
          .logAction({
            adminId: (req as any).userId || (req as any).user?.id || 'unknown',
            actionType: 'remove_member',
            details: { orgId: req.params.orgId, memberId: req.params.memberId, isSensitive: true },
          })
          .catch((err: unknown) => logger.warn('[Org] audit logging failed', err));
      }
      return originalJson(body);
    } as any;
    return OrganizationController.removeMember(req, res, next);
  }
);

export default router;
