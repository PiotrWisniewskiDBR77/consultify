/**
 * Organizations Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All organization-related API endpoints with Zod validation
 */

import { Router } from 'express';

import OrganizationController from '../controllers/OrganizationController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
    _InviteMemberSchema,
    AddMemberSchema,
    CreateOrganizationSchema,
    UpdateMemberRoleSchema,
    UpdateOrganizationSchema,
} from '../validators/organization.validators.js';

const router = Router();

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
router.put('/:orgId', validateBody(UpdateOrganizationSchema), OrganizationController.updateOrganization);

// ==========================================
// MEMBERS MANAGEMENT
// ==========================================

/**
 * GET /api/organizations/:orgId/members
 * Get organization members
 */
router.get('/:orgId/members', OrganizationController.getMembers);

/**
 * POST /api/organizations/:orgId/members
 * Add member to organization
 */
router.post('/:orgId/members', validateBody(AddMemberSchema), OrganizationController.addMember);

/**
 * PATCH /api/organizations/:orgId/members/:memberId/role
 * Update member role
 */
router.patch(
    '/:orgId/members/:memberId/role',
    validateBody(UpdateMemberRoleSchema),
    OrganizationController.updateMemberRole,
);

/**
 * DELETE /api/organizations/:orgId/members/:memberId
 * Remove member from organization
 */
router.delete('/:orgId/members/:memberId', OrganizationController.removeMember);

export default router;
