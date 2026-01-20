// @ts-nocheck
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
  static getUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { canReview } = req.query;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Select only columns that exist in the users table
      let sql =
        'SELECT id, email, first_name, last_name, role, status, avatar_url, last_login FROM users WHERE organization_id = ?';
      type SQLParam = string | number | boolean | null | undefined;
      const params: SQLParam[] = [orgId];

      // If canReview=true, filter to users with review permissions
      if (canReview === 'true') {
        sql += ` AND (role IN ('ADMIN', 'MANAGER', 'REVIEWER', 'LEADER') OR status = 'ACTIVE')`;
      }

      sql += ' ORDER BY first_name, last_name';

      const rows = await queryHelpers.queryAll(sql, params);

      const users = rows.map((u: Record<string, unknown>) => ({
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        role: u.role,
        status: u.status || 'active',
        avatarUrl: u.avatar_url,
        lastLogin: u.last_login,
        title: null, // Title column doesn't exist in users table
        // Default values for columns that may not exist
        aiConfig: {},
        licensePlanId: null,
        isOwner: u.role === 'OWNER',
        phone: null,
        linkedinId: null,
      }));

      res.json({ users, total: users.length });
    }
  );

  /**
   * Get single user by ID
   */
  static getUserById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    }
  );

  /**
   * Update user
   */
  static updateUser = asyncHandler(
    async (req: AuthenticatedRequest<UpdateUserRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Users can only update themselves unless they're admin
      if (id !== currentUserId && currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPERADMIN') {
        res.status(403).json({ error: 'You can only update your own profile' });
        return;
      }

      const { firstName, lastName, email, status, role, title, phone, avatarUrl, licensePlanId } =
        req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const params: (string | null)[] = [];

      if (firstName !== undefined) {
        updates.push('first_name = ?');
        params.push(firstName);
      }
      if (lastName !== undefined) {
        updates.push('last_name = ?');
        params.push(lastName);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        params.push(email);
      }
      if (status !== undefined) {
        // Only admins can change status
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPERADMIN') {
          res.status(403).json({ error: 'Only admins can change user status' });
          return;
        }
        updates.push('status = ?');
        params.push(status);
      }
      if (role !== undefined) {
        // Only admins can change roles
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPERADMIN') {
          res.status(403).json({ error: 'Only admins can change user roles' });
          return;
        }
        updates.push('role = ?');
        params.push(role);
      }
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
      }
      if (avatarUrl !== undefined) {
        updates.push('avatar_url = ?');
        params.push(avatarUrl);
      }
      if (licensePlanId !== undefined) {
        updates.push('license_plan_id = ?');
        params.push(licensePlanId);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());

      // Add WHERE clause params
      params.push(id);
      params.push(orgId);

      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, params);

      res.json({ id, message: 'User updated successfully' });
    }
  );

  /**
   * Delete user
   */
  static deleteUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Only admins can delete users
      if (currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPERADMIN') {
        res.status(403).json({ error: 'Only admins can delete users' });
        return;
      }

      // Cannot delete yourself
      if (id === currentUserId) {
        res.status(400).json({ error: 'You cannot delete yourself' });
        return;
      }

      // Check if user exists and belongs to organization
      const user = await queryHelpers.queryOne(
        'SELECT id, role FROM users WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Cannot delete owner
      if ((user as any).role === 'OWNER') {
        res.status(403).json({
          error: 'Cannot delete Account Owner. Transfer ownership first.',
          code: 'OWNER_PROTECTED',
        });
        return;
      }

      // Soft delete - set status to deleted
      await queryHelpers.queryRun(
        `UPDATE users SET status = 'deleted', deleted_at = ? WHERE id = ? AND organization_id = ?`,
        [new Date().toISOString(), id, orgId]
      );

      res.json({ message: 'User deleted successfully' });
    }
  );

  /**
   * Update user role
   */
  static updateUserRole = asyncHandler(
    async (req: AuthenticatedRequest<UpdateUserRoleRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const { role } = req.body;
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
    }
  );
}

export default UserController;
