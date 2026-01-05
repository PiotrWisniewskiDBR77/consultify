/**
 * Organization Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all organization-related business logic
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type {
    AddMemberRequest,
    CreateOrganizationRequest,
    InviteMemberRequest,
    UpdateMemberRoleRequest,
    UpdateOrganizationRequest,
} from '../validators/organization.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class OrganizationController {
    /**
     * Get current user's organizations
     */
    static getCurrentOrganizations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { getUserOrganizations } = await import('../services/organizationService.js');
        const orgs = await getUserOrganizations(userId);

        res.json(orgs);
    });

    /**
     * Create new organization
     */
    static createOrganization = asyncHandler(
        async (req: AuthenticatedRequest<CreateOrganizationRequest>, res: Response): Promise<void> => {
            const userId = req.user?.id;
            const { name } = req.body;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!name) {
                res.status(400).json({ error: 'Name is required' });
                return;
            }

            const { createOrganization } = await import('../services/organizationService.js');
            const org = await createOrganization({ userId, name });

            res.status(201).json(org);
        },
    );

    /**
     * Get organization by ID
     */
    static getOrganizationById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { getMembers, getOrganization } = await import('../services/organizationService.js');

        // Security check: User must be member
        const members = await getMembers(orgId);
        const isMember = members.some((m) => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const org = await getOrganization(orgId);
        res.json(org);
    });

    /**
     * Update organization
     */
    static updateOrganization = asyncHandler(
        async (req: AuthenticatedRequest<UpdateOrganizationRequest>, res: Response): Promise<void> => {
            const { orgId } = req.params;
            const _updates = req.body;

            // TODO: Implement full update logic
            res.json({ id: orgId, message: 'Organization updated' });
        },
    );

    /**
     * Get organization members
     */
    static getMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { getMembers } = await import('../services/organizationService.js');

        // Security check
        const members = await getMembers(orgId);
        const isMember = members.some((m) => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        res.json(members);
    });

    /**
     * Add member to organization
     */
    static addMember = asyncHandler(
        async (req: AuthenticatedRequest<AddMemberRequest>, res: Response): Promise<void> => {
            const { orgId } = req.params;
            const { targetUserId, role } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { getMembers, addMember: addMemberService } = await import('../services/organizationService.js');

            // Security check: Only OWNER or ADMIN can add members
            const members = await getMembers(orgId);
            const currentUserMember = members.find((m) => m.user_id === userId);

            if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
                if (req.user?.role !== 'SUPERADMIN') {
                    res.status(403).json({ error: 'Only Admins can add members' });
                    return;
                }
            }

            const result = await addMemberService({
                organizationId: orgId,
                userId: targetUserId,
                role: (role || 'MEMBER') as 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
                invitedBy: userId,
            });

            res.json(result);
        },
    );

    /**
     * Update member role
     */
    static updateMemberRole = asyncHandler(
        async (req: AuthenticatedRequest<UpdateMemberRoleRequest>, res: Response): Promise<void> => {
            const { orgId, memberId } = req.params;
            const { role } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { updateMemberRole } = await import('../services/organizationService.js');
            const result = await updateMemberRole({
                organizationId: orgId,
                userId: memberId,
                role: role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
            });

            res.json(result);
        },
    );

    /**
     * Remove member from organization
     */
    static removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { orgId, memberId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { removeMember } = await import('../services/organizationService.js');
        await removeMember({
            organizationId: orgId,
            userId: memberId,
        });

        res.json({ message: 'Member removed' });
    });
}

export default OrganizationController;
