/**
 * User Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles all user-related business logic
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { UpdateUserRequest, UpdateUserRoleRequest } from '../validators/user.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class UserController {
    /**
     * Get all users for organization
     */
    static getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const { canReview } = req.query;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        let sql = 'SELECT id, email, first_name, last_name, role, status, avatar_url, last_login, license_plan_id, ai_config, is_owner, phone, linkedin_id FROM users WHERE organization_id = ?';
        const params: unknown[] = [orgId];

        // If canReview=true, filter to users with review permissions
        if (canReview === 'true') {
            sql += ` AND (role IN ('ADMIN', 'MANAGER', 'REVIEWER', 'LEADER') OR status = 'ACTIVE')`;
        }

        sql += ' ORDER BY is_owner DESC, first_name, last_name';

        const rows = await queryHelpers.queryAll(sql, params);

        const users = rows.map((u: Record<string, unknown>) => ({
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            status: u.status,
            avatarUrl: u.avatar_url,
            lastLogin: u.last_login,
            aiConfig: u.ai_config ? JSON.parse(u.ai_config as string) : {},
            licensePlanId: u.license_plan_id,
            isOwner: u.is_owner === 1 || u.is_owner === true,
            phone: u.phone,
            linkedinId: u.linkedin_id
        }));

        res.json({ users, total: users.length });
    });

    /**
     * Get single user by ID
     */
    static getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = 'SELECT * FROM users WHERE id = ? AND organization_id = ?';
        const user = await queryHelpers.queryOne(sql, [id, orgId]);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    });

    /**
     * Update user
     */
    static updateUser = asyncHandler(async (req: AuthenticatedRequest<UpdateUserRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // TODO: Implement full update logic
        res.json({ id, message: 'User updated' });
    });

    /**
     * Update user role
     */
    static updateUserRole = asyncHandler(async (req: AuthenticatedRequest<UpdateUserRoleRequest>, res: Response): Promise<void> => {
        const { id } = req.params;
        const { role, reason } = req.body;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permission - only admins can change roles
        if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Only admins can change user roles' });
            return;
        }

        const sql = `UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND organization_id = ?`;
        await queryHelpers.queryRun(sql, [role, new Date().toISOString(), id, orgId]);

        res.json({ id, role, message: 'Role updated' });
    });
}

export default UserController;

