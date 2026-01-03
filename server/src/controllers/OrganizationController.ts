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
    CreateOrganizationRequest,
    UpdateOrganizationRequest,
    AddMemberRequest,
    UpdateMemberRoleRequest,
    InviteMemberRequest,
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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const OrganizationService = require('../../services/organizationService');
        const orgs = await OrganizationService.getUserOrganizations(userId);

        res.json(orgs);
    });

    /**
     * Create new organization
     */
    static createOrganization = asyncHandler(async (req: AuthenticatedRequest<CreateOrganizationRequest>, res: Response): Promise<void> => {
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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const OrganizationService = require('../../services/organizationService');
        const org = await OrganizationService.createOrganization({ userId, name });

        res.status(201).json(org);
    });

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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const OrganizationService = require('../../services/organizationService');

        // Security check: User must be member
        const members = await OrganizationService.getMembers(orgId);
        const isMember = members.some((m: { user_id: string }) => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const org = await OrganizationService.getOrganization(orgId);
        res.json(org);
    });

    /**
     * Update organization
     */
    static updateOrganization = asyncHandler(async (req: AuthenticatedRequest<UpdateOrganizationRequest>, res: Response): Promise<void> => {
        const { orgId } = req.params;
        const updates = req.body;
        
        // TODO: Implement full update logic
        res.json({ id: orgId, message: 'Organization updated' });
    });

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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const OrganizationService = require('../../services/organizationService');

        // Security check
        const members = await OrganizationService.getMembers(orgId);
        const isMember = members.some((m: { user_id: string }) => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        res.json(members);
    });

    /**
     * Add member to organization
     */
    static addMember = asyncHandler(async (req: AuthenticatedRequest<AddMemberRequest>, res: Response): Promise<void> => {
        const { orgId } = req.params;
        const { targetUserId, role } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const OrganizationService = require('../../services/organizationService');

        // Security check: Only OWNER or ADMIN can add members
        const members = await OrganizationService.getMembers(orgId);
        const currentUserMember = members.find((m: { user_id: string }) => m.user_id === userId);

        if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
            if (req.user?.role !== 'SUPERADMIN') {
                res.status(403).json({ error: 'Only Admins can add members' });
                return;
            }
        }

        // TODO: Implement add member logic
        res.json({ message: 'Member added' });
    });

    /**
     * Update member role
     */
    static updateMemberRole = asyncHandler(async (req: AuthenticatedRequest<UpdateMemberRoleRequest>, res: Response): Promise<void> => {
        const { orgId, memberId } = req.params;
        const { role } = req.body;
        
        // TODO: Implement update member role logic
        res.json({ id: memberId, role, message: 'Member role updated' });
    });

    /**
     * Remove member from organization
     */
    static removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { orgId, memberId } = req.params;
        
        // TODO: Implement remove member logic
        res.json({ message: 'Member removed' });
    });
}

export default OrganizationController;

