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
  InviteMemberSchema,
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
 * GET /api/organizations/debug-memberships
 * Temporary diagnostic — direct PG query to verify memberships
 */
router.get('/debug-memberships', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      `SELECT o.id, o.name, o.billing_status, m.role, m.status
       FROM organizations o
       JOIN organization_members m ON o.id = m.organization_id
       WHERE m.user_id = $1
       ORDER BY o.name`,
      [userId]
    );
    await pool.end();

    console.log(`[DEBUG-MEMBERSHIPS] userId=${userId} rows=${result.rows.length}`);
    res.json({ userId, memberships: result.rows, count: result.rows.length });
  } catch (err: any) {
    console.error('[DEBUG-MEMBERSHIPS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
router.post('/:orgId/members', validateBody(AddMemberSchema), async (req, res, next) => {
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
});

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
router.delete('/:orgId/members/:memberId', async (req, res, next) => {
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
});

export default router;
