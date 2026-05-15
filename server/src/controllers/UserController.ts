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

      // Feedback #d11ec6b0 — the org-admin "Users" panel previously pulled only
      // rows where `users.organization_id = orgId`, which hid users whose
      // primary tenant is another org but who are active members of THIS org
      // via `organization_members` (e.g. Piotr=OWNER of APLIX with primary
      // `users.organization_id='vts'`). We now UNION both sources and
      // deduplicate on user id so each member shows up exactly once.
      // Select only columns that exist in the users table
      // Note: 'title' column doesn't exist - use 'job_title' if needed, or get from user_profiles table
      let sql = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.avatar_url, u.last_login,
               u.job_title, u.department, u.site_location, u.seniority_level, u.tenure_years,
               u.manages_team, u.team_size, u.expertise_tags, u.engagement_level
          FROM users u
         WHERE u.organization_id = ?
        UNION
        SELECT u.id, u.email, u.first_name, u.last_name,
               COALESCE(om.role, u.role) AS role,
               u.status, u.avatar_url, u.last_login,
               u.job_title, u.department, u.site_location, u.seniority_level, u.tenure_years,
               u.manages_team, u.team_size, u.expertise_tags, u.engagement_level
          FROM organization_members om
          JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = ?
           AND (om.status IS NULL OR UPPER(om.status) = 'ACTIVE')
      `;
      type SQLParam = string | number | boolean | null | undefined;
      const params: SQLParam[] = [orgId, orgId];

      // If canReview=true, filter to users with review permissions
      if (canReview === 'true') {
        sql = `SELECT * FROM (${sql}) scoped WHERE (role IN ('ADMIN', 'MANAGER', 'REVIEWER', 'LEADER') OR status = 'ACTIVE')`;
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
        title: u.job_title,
        jobTitle: u.job_title,
        department: u.department,
        siteLocation: u.site_location,
        seniorityLevel: u.seniority_level,
        tenureYears: u.tenure_years,
        managesTeam: u.manages_team === true || u.manages_team === 1,
        teamSize: u.team_size,
        expertiseTags: (() => {
          try {
            return u.expertise_tags ? JSON.parse(String(u.expertise_tags)) : [];
          } catch {
            return [];
          }
        })(),
        engagementLevel: u.engagement_level,
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

      const {
        firstName,
        lastName,
        email,
        status,
        role,
        title,
        phone,
        avatarUrl,
        licensePlanId,
        jobTitle,
        department,
        siteLocation,
        seniorityLevel,
        tenureYears,
        managesTeam,
        teamSize,
        expertiseTags,
        engagementLevel,
        displayName,
        pronouns,
        statusMessage,
        isOutOfOffice,
        outOfOfficeUntil,
        linkedinId,
        timezone,
        location,
        profileSurveyCompletedAt,
        profileSurveyDismissedCount,
        profileSurveyLastDismissedAt,
      } = req.body;

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
      const canUpdateTarget =
        id === currentUserId ||
        currentUserRole === 'SUPERADMIN' ||
        (await queryHelpers.queryOne(
          `SELECT 1 FROM users WHERE id = ? AND organization_id = ?
           UNION
           SELECT 1
             FROM organization_members
            WHERE user_id = ?
              AND organization_id = ?
              AND (status IS NULL OR UPPER(status) = 'ACTIVE')
            LIMIT 1`,
          [id, orgId, id, orgId]
        ));

      if (!canUpdateTarget) {
        res.status(404).json({ error: 'User not found in this organization' });
        return;
      }

      const nextJobTitle = jobTitle !== undefined ? jobTitle : title;
      if (nextJobTitle !== undefined) {
        updates.push('job_title = ?');
        params.push(nextJobTitle || null);
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
      if (department !== undefined) {
        updates.push('department = ?');
        params.push(department || null);
      }
      if (siteLocation !== undefined) {
        updates.push('site_location = ?');
        params.push(siteLocation || null);
      }
      if (seniorityLevel !== undefined) {
        updates.push('seniority_level = ?');
        params.push(seniorityLevel || null);
      }
      if (tenureYears !== undefined) {
        updates.push('tenure_years = ?');
        params.push(tenureYears || null);
      }
      if (managesTeam !== undefined) {
        updates.push('manages_team = ?');
        params.push(managesTeam ? '1' : '0');
      }
      if (teamSize !== undefined) {
        updates.push('team_size = ?');
        params.push(teamSize || null);
      }
      if (expertiseTags !== undefined) {
        updates.push('expertise_tags = ?');
        params.push(JSON.stringify(Array.isArray(expertiseTags) ? expertiseTags : []));
      }
      if (engagementLevel !== undefined) {
        updates.push('engagement_level = ?');
        params.push(engagementLevel || null);
      }
      if (displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(displayName || null);
      }
      if (pronouns !== undefined) {
        updates.push('pronouns = ?');
        params.push(pronouns || null);
      }
      if (statusMessage !== undefined) {
        updates.push('status_message = ?');
        params.push(statusMessage || null);
      }
      if (isOutOfOffice !== undefined) {
        updates.push('out_of_office = ?');
        params.push(isOutOfOffice ? '1' : '0');
      }
      if (outOfOfficeUntil !== undefined) {
        updates.push('vacation_end = ?');
        params.push(outOfOfficeUntil || null);
      }
      if (linkedinId !== undefined) {
        updates.push('linkedin_id = ?');
        params.push(linkedinId || null);
      }
      if (timezone !== undefined) {
        updates.push('timezone = ?');
        params.push(timezone || null);
      }
      if (location !== undefined) {
        updates.push('location = ?');
        params.push(location || null);
      }
      if (profileSurveyCompletedAt !== undefined) {
        updates.push('profile_survey_completed_at = ?');
        params.push(profileSurveyCompletedAt || null);
      }
      if (profileSurveyDismissedCount !== undefined) {
        updates.push('profile_survey_dismissed_count = ?');
        params.push(String(profileSurveyDismissedCount));
      }
      if (profileSurveyLastDismissedAt !== undefined) {
        updates.push('profile_survey_last_dismissed_at = ?');
        params.push(profileSurveyLastDismissedAt || null);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());

      params.push(id);

      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      await queryHelpers.queryRun(sql, params);

      const updated = (await queryHelpers.queryOne(
        `SELECT id, email, first_name, last_name, role, status, avatar_url,
                job_title, department, site_location, seniority_level, tenure_years,
                manages_team, team_size, expertise_tags, engagement_level,
                display_name, pronouns, status_message, out_of_office,
                vacation_end, linkedin_id, timezone, location, license_plan_id
           FROM users
          WHERE id = ?`,
        [id]
      )) as Record<string, any> | null;

      if (!updated) {
        res.status(404).json({ error: 'User not found after update' });
        return;
      }

      let parsedExpertiseTags: string[] = [];
      try {
        parsedExpertiseTags = updated.expertise_tags
          ? JSON.parse(String(updated.expertise_tags))
          : [];
      } catch {
        parsedExpertiseTags = [];
      }

      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.first_name,
        lastName: updated.last_name,
        role: updated.role,
        status: updated.status,
        avatarUrl: updated.avatar_url,
        title: updated.job_title,
        jobTitle: updated.job_title,
        department: updated.department,
        siteLocation: updated.site_location,
        seniorityLevel: updated.seniority_level,
        tenureYears: updated.tenure_years,
        managesTeam: updated.manages_team === true || updated.manages_team === 1,
        teamSize: updated.team_size,
        expertiseTags: parsedExpertiseTags,
        engagementLevel: updated.engagement_level,
        displayName: updated.display_name,
        pronouns: updated.pronouns,
        statusMessage: updated.status_message,
        isOutOfOffice: updated.out_of_office === true || updated.out_of_office === 1,
        outOfOfficeUntil: updated.vacation_end,
        linkedinId: updated.linkedin_id,
        timezone: updated.timezone,
        location: updated.location,
        licensePlanId: updated.license_plan_id,
        message: 'User updated successfully',
      });
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
