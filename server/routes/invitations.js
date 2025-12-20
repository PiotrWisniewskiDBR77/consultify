/**
 * Invitation Routes
 * 
 * Enterprise-grade invitation API endpoints for B2B SaaS platform.
 * Supports organization and project-level invitations with full audit trail.
 * 
 * Public Endpoints (Authenticated):
 * - GET  /api/invitations/pending - User's pending invitations
 * - POST /api/invitations/accept  - Accept invitation by token
 * 
 * Admin Endpoints:
 * - GET  /api/invitations/org           - List org invitations
 * - POST /api/invitations/org           - Create org invitation
 * - GET  /api/invitations/project/:id   - List project invitations
 * - POST /api/invitations/project       - Create project invitation
 * - POST /api/invitations/:id/resend    - Resend invitation
 * - POST /api/invitations/:id/revoke    - Revoke invitation
 * - GET  /api/invitations/:id/audit     - Get invitation audit trail
 */

const express = require('express');
const router = express.Router();
const InvitationService = require('../services/invitationService');
const verifyToken = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');
const {
    validateRateLimiter,
    acceptRateLimiter,
    recordAcceptFailure,
    clearAcceptFailure
} = require('../middleware/invitationRateLimiter');

/**
 * Helper to extract request info for audit logging
 */
const getRequestInfo = (req) => ({
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent']
});

/**
 * Public: Accept invitation (no auth required for token validation,
 * but can be used by authenticated users too)
 * POST /api/invitations/accept
 * Rate limited: 5 failed attempts per 15 minutes per IP
 */
router.post('/accept', acceptRateLimiter, async (req, res) => {
    try {
        const { token, email, firstName, lastName, password } = req.body;

        // Validation
        if (!token) {
            recordAcceptFailure(req);
            return res.status(400).json({ error: 'Token is required' });
        }
        if (!email || !firstName || !lastName || !password) {
            recordAcceptFailure(req);
            return res.status(400).json({ error: 'Email, first name, last name, and password are required' });
        }
        if (password.length < 8) {
            recordAcceptFailure(req);
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const result = await InvitationService.acceptInvitation(
            { token, email, firstName, lastName, password },
            getRequestInfo(req)
        );

        // Clear failure count on success
        clearAcceptFailure(req);

        res.json({
            success: true,
            message: 'Invitation accepted successfully',
            user: {
                id: result.userId,
                email,
                firstName,
                lastName,
                role: result.role,
                organizationId: result.organizationId,
                projectId: result.projectId
            }
        });
    } catch (error) {
        console.error('[Invitations] Accept error:', error.message);
        recordAcceptFailure(req);

        // Return 409 for race condition / already accepted
        if (error.message.includes('already') || error.message.includes('accepted')) {
            return res.status(409).json({ error: error.message });
        }

        res.status(400).json({ error: error.message });
    }
});

/**
 * Public: Validate invitation token and get details
 * GET /api/invitations/validate/:token
 * Rate limited: 20 requests per 10 minutes per IP
 */
router.get('/validate/:token', validateRateLimiter, async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await InvitationService.getByToken(token);

        if (!invitation) {
            return res.status(404).json({ error: 'Invalid invitation token' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({
                error: `Invitation is ${invitation.status}`,
                status: invitation.status
            });
        }

        // Check expiration
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({
                error: 'Invitation has expired',
                status: 'expired'
            });
        }

        // Return safe details (no token in response)
        res.json({
            valid: true,
            invitationType: invitation.invitation_type,
            organizationName: invitation.organization_name,
            projectName: invitation.project_name,
            email: invitation.email,
            roleToAssign: invitation.role_to_assign || invitation.role,
            expiresAt: invitation.expires_at
        });
    } catch (error) {
        console.error('[Invitations] Validate error:', error.message);
        res.status(500).json({ error: 'Failed to validate invitation' });
    }
});

// ==========================================
// AUTHENTICATED ROUTES
// ==========================================

router.use(verifyToken);

/**
 * User: Get pending invitations for current user's email
 * GET /api/invitations/pending
 */
router.get('/pending', async (req, res) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(400).json({ error: 'User email not found' });
        }

        const invitations = await InvitationService.getPendingForEmail(userEmail);

        res.json(invitations.map(inv => ({
            id: inv.id,
            invitationType: inv.invitation_type,
            organizationId: inv.organization_id,
            organizationName: inv.organization_name,
            projectId: inv.project_id,
            projectName: inv.project_name,
            roleToAssign: inv.role_to_assign || inv.role,
            expiresAt: inv.expires_at,
            createdAt: inv.created_at
        })));
    } catch (error) {
        console.error('[Invitations] Pending error:', error.message);
        res.status(500).json({ error: 'Failed to fetch pending invitations' });
    }
});

// ==========================================
// ADMIN ROUTES - Organization Invitations
// ==========================================

/**
 * Admin: List organization invitations
 * GET /api/invitations/org
 */
router.get('/org', verifyAdmin, async (req, res) => {
    try {
        const organizationId = req.organizationId;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        const { status, type, limit, offset } = req.query;

        const invitations = await InvitationService.listOrgInvitations(organizationId, {
            status,
            invitationType: type,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });

        res.json(invitations.map(inv => ({
            id: inv.id,
            invitationType: inv.invitation_type,
            email: inv.email,
            role: inv.role_to_assign || inv.role,
            status: inv.status,
            projectId: inv.project_id,
            projectName: inv.project_name,
            invitedBy: {
                firstName: inv.inviter_first_name,
                lastName: inv.inviter_last_name
            },
            expiresAt: inv.expires_at,
            createdAt: inv.created_at,
            acceptedAt: inv.accepted_at
        })));
    } catch (error) {
        console.error('[Invitations] List org error:', error.message);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

/**
 * Admin: Create organization invitation
 * POST /api/invitations/org
 */
router.post('/org', verifyAdmin, async (req, res) => {
    try {
        const organizationId = req.organizationId;
        const invitedByUserId = req.userId;

        if (!organizationId || !invitedByUserId) {
            return res.status(400).json({ error: 'Authentication context missing' });
        }

        const { email, role, metadata } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate role
        const validRoles = ['USER', 'ADMIN'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        // Check if inviter can assign this role
        if (role === 'ADMIN' && req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can invite other admins' });
        }

        const invitation = await InvitationService.createOrgInvitation(
            { organizationId, email, role: role || 'USER', invitedByUserId, metadata: metadata || {} },
            getRequestInfo(req)
        );

        res.status(201).json({
            success: true,
            message: 'Invitation sent successfully',
            invitation: {
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt
            }
        });
    } catch (error) {
        console.error('[Invitations] Create org error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// ==========================================
// ADMIN ROUTES - Project Invitations
// ==========================================

/**
 * Admin: List project invitations
 * GET /api/invitations/project/:projectId
 */
router.get('/project/:projectId', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user?.id;

        // Check permission
        const canInvite = await InvitationService.canInviteToProject(userId, projectId);
        if (!canInvite && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const { status, limit, offset } = req.query;

        const invitations = await InvitationService.listProjectInvitations(projectId, {
            status,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });

        res.json(invitations.map(inv => ({
            id: inv.id,
            email: inv.email,
            role: inv.role_to_assign || inv.role,
            status: inv.status,
            metadata: JSON.parse(inv.metadata || '{}'),
            invitedBy: {
                firstName: inv.inviter_first_name,
                lastName: inv.inviter_last_name
            },
            expiresAt: inv.expires_at,
            createdAt: inv.created_at,
            acceptedAt: inv.accepted_at
        })));
    } catch (error) {
        console.error('[Invitations] List project error:', error.message);
        res.status(500).json({ error: 'Failed to fetch project invitations' });
    }
});

/**
 * Admin: Create project invitation
 * POST /api/invitations/project
 */
router.post('/project', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const invitedByUserId = req.user?.id;

        const { projectId, email, projectRole, orgRole, metadata } = req.body;

        if (!projectId || !email) {
            return res.status(400).json({ error: 'Project ID and email are required' });
        }

        // Check permission
        const canInvite = await InvitationService.canInviteToProject(invitedByUserId, projectId);
        if (!canInvite && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Permission denied to invite to this project' });
        }

        // Validate project roles
        const validProjectRoles = ['member', 'admin', 'owner'];
        if (projectRole && !validProjectRoles.includes(projectRole)) {
            return res.status(400).json({ error: `Invalid project role. Must be one of: ${validProjectRoles.join(', ')}` });
        }

        const invitation = await InvitationService.createProjectInvitation(
            {
                organizationId,
                projectId,
                email,
                projectRole: projectRole || 'member',
                orgRole: orgRole || 'USER',
                invitedByUserId,
                metadata: metadata || {}
            },
            getRequestInfo(req)
        );

        res.status(201).json({
            success: true,
            message: 'Project invitation sent successfully',
            invitation: {
                id: invitation.id,
                email: invitation.email,
                projectRole: invitation.projectRole,
                orgRole: invitation.orgRole,
                status: invitation.status,
                expiresAt: invitation.expiresAt
            }
        });
    } catch (error) {
        console.error('[Invitations] Create project error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// ==========================================
// ADMIN ROUTES - Invitation Management
// ==========================================

/**
 * Admin: Resend invitation
 * POST /api/invitations/:id/resend
 */
router.post('/:id/resend', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const performedByUserId = req.user?.id;

        const result = await InvitationService.resendInvitation(id, performedByUserId, getRequestInfo(req));

        res.json({
            success: true,
            message: 'Invitation resent successfully',
            invitation: result
        });
    } catch (error) {
        console.error('[Invitations] Resend error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Admin: Revoke invitation
 * POST /api/invitations/:id/revoke
 */
router.post('/:id/revoke', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const performedByUserId = req.user?.id;
        const { reason } = req.body;

        const result = await InvitationService.revokeInvitation(id, performedByUserId, reason, getRequestInfo(req));

        res.json({
            success: true,
            message: 'Invitation revoked successfully',
            invitation: result
        });
    } catch (error) {
        console.error('[Invitations] Revoke error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Admin: Get invitation audit trail
 * GET /api/invitations/:id/audit
 */
router.get('/:id/audit', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const events = await InvitationService.getAuditTrail(id);

        res.json(events.map(evt => ({
            id: evt.id,
            eventType: evt.event_type,
            performedBy: evt.first_name
                ? { firstName: evt.first_name, lastName: evt.last_name, email: evt.email }
                : null,
            ipAddress: evt.ip_address,
            metadata: JSON.parse(evt.metadata || '{}'),
            createdAt: evt.created_at
        })));
    } catch (error) {
        console.error('[Invitations] Audit error:', error.message);
        res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
});

// ==========================================
// LEGACY COMPATIBILITY
// Keep old endpoint patterns working during transition
// ==========================================

/**
 * Legacy: List invitations (redirects to /org)
 * GET /api/invitations
 */
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const { organizationId: queryOrgId } = req.query;
        // RBAC enforcement: Only SUPERADMIN can view other orgs
        const orgId = (req.userRole === 'SUPERADMIN' && queryOrgId)
            ? queryOrgId
            : req.organizationId;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        const invitations = await InvitationService.listOrgInvitations(orgId, {});

        // Return in legacy format for backward compatibility
        res.json(invitations.map(row => ({
            id: row.id,
            organizationId: row.organization_id,
            email: row.email,
            role: row.role,
            token: row.token,
            status: row.status,
            invitedBy: row.invited_by,
            inviter: {
                firstName: row.inviter_first_name,
                lastName: row.inviter_last_name
            },
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            acceptedAt: row.accepted_at
        })));
    } catch (error) {
        console.error('[Invitations] Legacy list error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Legacy: Create invitation
 * POST /api/invitations
 */
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const { organizationId, email, role, userId } = req.body;
        const orgId = organizationId || req.user?.organizationId;
        const invitedByUserId = userId || req.user?.id;

        if (!orgId || !email) {
            return res.status(400).json({ error: 'Organization ID and email are required' });
        }

        const invitation = await InvitationService.createOrgInvitation(
            { organizationId: orgId, email, role: role || 'USER', invitedByUserId },
            getRequestInfo(req)
        );

        res.json({
            message: 'Invitation created',
            invitation: {
                id: invitation.id,
                organizationId: invitation.organizationId,
                email: invitation.email,
                role: invitation.role,
                token: invitation.token,
                status: invitation.status,
                invitedBy: invitation.invitedByUserId,
                expiresAt: invitation.expiresAt
            }
        });
    } catch (error) {
        console.error('[Invitations] Legacy create error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Legacy: Delete invitation (maps to revoke)
 * DELETE /api/invitations/:id
 */
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const performedByUserId = req.user?.id;

        await InvitationService.revokeInvitation(id, performedByUserId, 'Deleted via legacy endpoint', getRequestInfo(req));

        res.json({ message: 'Invitation deleted' });
    } catch (error) {
        console.error('[Invitations] Legacy delete error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
