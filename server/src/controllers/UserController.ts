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
      // Note: 'title' column doesn't exist - use 'job_title' if needed, or get from user_profiles table
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
        title: null, // title column doesn't exist in users table
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
   * Delete user (soft delete)
   *
   * Feedback #406b042a CRIT — "Nie można usuwać kont":
   * - Previously attempted to UPDATE users.deleted_at which didn't exist on
   *   the PG schema, so every call failed server-side and the UI only saw a
   *   generic "Failed to delete user" toast.
   * - Also required `organization_id` match on the target user, which blocked
   *   superadmins operating cross-org (their own organizationId is rarely
   *   the same as the tenant they're managing).
   * - Sessions table has a user_id FK with no ON DELETE action, so leaving
   *   live sessions behind would let a "deleted" user keep hitting the API
   *   until their JWT expired — we explicitly purge them here.
   *
   * New behaviour:
   * - SUPERADMIN can delete any non-owner user, regardless of org scoping.
   * - ADMIN can only delete users inside their own organization.
   * - Email is anonymized to free up the address for future re-registration.
   * - Sessions are hard-deleted so the token is invalidated immediately.
   * - Soft delete writes status='deleted' + deleted_at NOW() (the schema
   *   migration 20260418_users_deleted_at_column.sql adds the column).
   */
  static deleteUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const isSuperadmin = currentUserRole === 'SUPERADMIN';

      // Only admins can delete users. Superadmins don't need an org.
      if (currentUserRole !== 'ADMIN' && !isSuperadmin) {
        res.status(403).json({ error: 'Only admins can delete users' });
        return;
      }

      if (!isSuperadmin && !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Cannot delete yourself
      if (id === currentUserId) {
        res.status(400).json({ error: 'You cannot delete yourself' });
        return;
      }

      // Look up the target user. Superadmin bypasses the org filter so they
      // can manage users across tenants; regular admins stay scoped.
      const user = (await queryHelpers.queryOne(
        isSuperadmin
          ? 'SELECT id, role, email, organization_id FROM users WHERE id = ?'
          : 'SELECT id, role, email, organization_id FROM users WHERE id = ? AND organization_id = ?',
        isSuperadmin ? [id] : [id, orgId]
      )) as {
        id: string;
        role?: string;
        email?: string;
        organization_id?: string;
      } | null;

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Cannot delete the Account Owner. Upper-cased role values are the
      // convention used elsewhere in this controller, but some older rows
      // use lowercase — normalize before comparing.
      if (String(user.role || '').toLowerCase() === 'owner') {
        res.status(403).json({
          error: 'Cannot delete Account Owner. Transfer ownership first.',
          code: 'OWNER_PROTECTED',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      // Anonymized email preserves the unique index while freeing the original
      // address for re-registration. Using a '+' tag keeps the original value
      // recoverable from the audit trail if needed.
      const anonymizedEmail = user.email
        ? `${user.email}.deleted-${Date.now()}@deleted.local`
        : `deleted-${id}@deleted.local`;

      // 1) Revoke live sessions so the user is kicked off immediately. Sessions
      //    has no ON DELETE CASCADE so we purge explicitly — this also unblocks
      //    the soft delete path from any lingering FK issues on that table.
      try {
        await queryHelpers.queryRun('DELETE FROM sessions WHERE user_id = ?', [id]);
      } catch (err) {
        // sessions table may not exist in every environment (tests, local) —
        // don't block the delete, but surface it in logs.
        console.warn('[UserController.deleteUser] failed to purge sessions:', err);
      }

      // 2) Soft-delete with anonymization. `deleted_at` is provided by the
      //    20260418_users_deleted_at_column.sql migration.
      await queryHelpers.queryRun(
        `UPDATE users
            SET status = 'deleted',
                deleted_at = ?,
                email = ?
          WHERE id = ?`,
        [nowIso, anonymizedEmail, id]
      );

      res.json({ message: 'User deleted successfully', id });
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
