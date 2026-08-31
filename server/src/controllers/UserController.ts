// @ts-nocheck
/**
 * User Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all user-related business logic
 */

import { randomUUID } from 'node:crypto';

import type { Response } from 'express';

import { invalidatePlatformSuperAdminCache } from '../services/organizationSuspensionGuard.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearSchemaCache, getTableColumns } from '../utils/dbSchema.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { UpdateUserRequest, UpdateUserRoleRequest } from '../validators/user.validators.js';

const PROFILE_SCHEMA_RETRY_ERRORS = [
  'does not exist',
  'no such column',
  'relation',
  'column',
  'constraint',
  'duplicate key',
];

const isProfileSchemaWriteError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return PROFILE_SCHEMA_RETRY_ERRORS.some((needle) => message.includes(needle));
};

const PROFILE_USERS_COLUMNS: Array<{ name: string; sql: string }> = [
  { name: 'display_name', sql: 'ALTER TABLE users ADD COLUMN display_name TEXT' },
  { name: 'pronouns', sql: 'ALTER TABLE users ADD COLUMN pronouns TEXT' },
  { name: 'status_message', sql: 'ALTER TABLE users ADD COLUMN status_message TEXT' },
  { name: 'out_of_office', sql: 'ALTER TABLE users ADD COLUMN out_of_office INTEGER DEFAULT 0' },
  { name: 'vacation_end', sql: 'ALTER TABLE users ADD COLUMN vacation_end TEXT' },
  { name: 'out_of_office_message', sql: 'ALTER TABLE users ADD COLUMN out_of_office_message TEXT' },
  { name: 'company_name', sql: 'ALTER TABLE users ADD COLUMN company_name TEXT' },
  { name: 'timezone', sql: 'ALTER TABLE users ADD COLUMN timezone TEXT' },
  { name: 'date_format', sql: 'ALTER TABLE users ADD COLUMN date_format TEXT' },
  { name: 'time_format', sql: 'ALTER TABLE users ADD COLUMN time_format TEXT' },
  { name: 'linkedin_id', sql: 'ALTER TABLE users ADD COLUMN linkedin_id TEXT' },
  // P0.3 (2026-07-26): interface language preference — SSOT priority is
  // account > localStorage > navigator. See src/services/languagePreference.ts.
  { name: 'language', sql: 'ALTER TABLE users ADD COLUMN language TEXT' },
];

const ensureUsersProfileColumns = async (): Promise<Set<string>> => {
  clearSchemaCache();
  let userColumns = await getTableColumns('users');
  const missingColumns = PROFILE_USERS_COLUMNS.filter(({ name }) => !userColumns.has(name));
  if (missingColumns.length === 0) return userColumns;

  for (const migration of missingColumns) {
    try {
      await queryHelpers.queryRun(migration.sql);
    } catch (error: unknown) {
      const message = String((error as Error)?.message || error || '').toLowerCase();
      const alreadyExists =
        message.includes('already exists') ||
        message.includes('duplicate column') ||
        message.includes('duplicate');
      if (!alreadyExists) {
        // Some environments run with DB users that cannot ALTER TABLE.
        // Best effort only: profile fields will fall back to user_preferences.
        continue;
      }
    }
  }

  clearSchemaCache();
  userColumns = await getTableColumns('users');
  return userColumns;
};

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
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.avatar_url, u.last_login
          FROM users u
         WHERE u.organization_id = ?
        UNION
        SELECT u.id, u.email, u.first_name, u.last_name,
               COALESCE(om.role, u.role) AS role,
               u.status, u.avatar_url, u.last_login
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

      // PII guard (#20): the full org directory exposes everyone's email +
      // last-login. Pilot/survey USERs only need this list to populate assignee
      // pickers (My Work tasks, decision/initiative owners), so non-privileged
      // roles get name + avatar but NOT email/last-login. Admin-class roles keep
      // the full record for the org-admin "Users" panel.
      const requesterRole = String(req.user?.role || '').toUpperCase();
      const isPrivileged = ['ADMIN', 'OWNER', 'SUPERADMIN', 'MANAGER'].includes(requesterRole);

      const users = rows.map((u: Record<string, unknown>) => ({
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: isPrivileged ? u.email : null,
        role: u.role,
        status: u.status || 'active',
        avatarUrl: u.avatar_url,
        lastLogin: isPrivileged ? u.last_login : null,
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

      const {
        firstName,
        lastName,
        email,
        status,
        role,
        title,
        jobTitle,
        phone,
        avatarUrl,
        licensePlanId,
        linkedinId,
        displayName,
        pronouns,
        department,
        statusMessage,
        isOutOfOffice,
        outOfOfficeUntil,
        outOfOfficeMessage,
        companyName,
        timezone,
        dateFormat,
        timeFormat,
        seniorityLevel,
        siteLocation,
        tenureYears,
        managesTeam,
        teamSize,
        expertiseTags,
        engagementLevel,
        profileSurveyCompletedAt,
        profileSurveyDismissedCount,
        profileSurveyLastDismissedAt,
        language,
      } = req.body;

      if (firstName !== undefined && !String(firstName).trim()) {
        res.status(400).json({ error: 'First name is required before saving' });
        return;
      }

      const userColumns = await ensureUsersProfileColumns();
      const userProfileColumns = await getTableColumns('user_profiles');
      const userProfileExtendedColumns = await getTableColumns('user_profile_extended');
      const canPersistToUserProfiles =
        userProfileColumns.size > 0 && userProfileColumns.has('user_id');
      const canPersistToUserProfileExtended =
        userProfileExtendedColumns.size > 0 && userProfileExtendedColumns.has('user_id');
      const persistToUserProfiles: {
        jobTitle?: string | null;
        department?: string | null;
      } = {};
      const persistToUserProfileExtended: {
        jobTitle?: string | null;
        department?: string | null;
      } = {};
      const profilePreferenceFallback: Record<string, unknown> = {};

      // Build dynamic update query
      const updates: string[] = [];
      const params: (string | null)[] = [];
      const addColumnUpdate = (column: string, value: unknown) => {
        if (!userColumns.has(column) || value === undefined) return;
        updates.push(`${column} = ?`);
        params.push(value === null ? null : String(value));
      };
      const addBooleanColumnUpdate = (column: string, value: unknown) => {
        if (!userColumns.has(column) || value === undefined) return;
        updates.push(`${column} = ?`);
        params.push(value ? '1' : '0');
      };

      if (firstName !== undefined) {
        updates.push('first_name = ?');
        params.push(String(firstName).trim());
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
        const usersJobTitleColumn = userColumns.has('job_title')
          ? 'job_title'
          : userColumns.has('title')
            ? 'title'
            : null;
        if (usersJobTitleColumn) {
          addColumnUpdate(usersJobTitleColumn, title);
        } else if (canPersistToUserProfiles && userProfileColumns.has('job_title')) {
          persistToUserProfiles.jobTitle =
            title === null ? null : String(title || '').trim() || null;
        } else if (
          canPersistToUserProfileExtended &&
          (userProfileExtendedColumns.has('job_title') || userProfileExtendedColumns.has('title'))
        ) {
          persistToUserProfileExtended.jobTitle =
            title === null ? null : String(title || '').trim() || null;
        }
      }
      if (jobTitle !== undefined) {
        const usersJobTitleColumn = userColumns.has('job_title')
          ? 'job_title'
          : userColumns.has('title')
            ? 'title'
            : null;
        if (usersJobTitleColumn) {
          addColumnUpdate(usersJobTitleColumn, jobTitle);
        } else if (canPersistToUserProfiles && userProfileColumns.has('job_title')) {
          persistToUserProfiles.jobTitle =
            jobTitle === null ? null : String(jobTitle || '').trim() || null;
        } else if (
          canPersistToUserProfileExtended &&
          (userProfileExtendedColumns.has('job_title') || userProfileExtendedColumns.has('title'))
        ) {
          persistToUserProfileExtended.jobTitle =
            jobTitle === null ? null : String(jobTitle || '').trim() || null;
        }
      }
      if (phone !== undefined) {
        addColumnUpdate('phone', phone);
      }
      if (avatarUrl !== undefined) {
        addColumnUpdate('avatar_url', avatarUrl);
      }
      if (licensePlanId !== undefined) {
        addColumnUpdate('license_plan_id', licensePlanId);
      }
      addColumnUpdate('linkedin_id', linkedinId);
      if (linkedinId !== undefined && !userColumns.has('linkedin_id')) {
        profilePreferenceFallback.linkedinId =
          linkedinId === null ? null : String(linkedinId || '').trim() || null;
      }
      addColumnUpdate('display_name', displayName);
      if (displayName !== undefined && !userColumns.has('display_name')) {
        profilePreferenceFallback.displayName =
          displayName === null ? null : String(displayName || '').trim() || null;
      }
      addColumnUpdate('pronouns', pronouns);
      if (pronouns !== undefined && !userColumns.has('pronouns')) {
        profilePreferenceFallback.pronouns =
          pronouns === null ? null : String(pronouns || '').trim() || null;
      }
      if (userColumns.has('department')) {
        addColumnUpdate('department', department);
      } else if (
        department !== undefined &&
        canPersistToUserProfiles &&
        userProfileColumns.has('department')
      ) {
        persistToUserProfiles.department =
          department === null ? null : String(department || '').trim() || null;
      } else if (
        department !== undefined &&
        canPersistToUserProfileExtended &&
        userProfileExtendedColumns.has('department')
      ) {
        persistToUserProfileExtended.department =
          department === null ? null : String(department || '').trim() || null;
      }
      addColumnUpdate('status_message', statusMessage);
      if (statusMessage !== undefined && !userColumns.has('status_message')) {
        profilePreferenceFallback.statusMessage =
          statusMessage === null ? null : String(statusMessage || '').trim() || null;
      }
      addBooleanColumnUpdate('out_of_office', isOutOfOffice);
      if (isOutOfOffice !== undefined && !userColumns.has('out_of_office')) {
        profilePreferenceFallback.isOutOfOffice = Boolean(isOutOfOffice);
      }
      addColumnUpdate('vacation_end', outOfOfficeUntil);
      if (outOfOfficeUntil !== undefined && !userColumns.has('vacation_end')) {
        profilePreferenceFallback.outOfOfficeUntil =
          outOfOfficeUntil === null ? null : String(outOfOfficeUntil || '').trim() || null;
      }
      addColumnUpdate('out_of_office_message', outOfOfficeMessage);
      if (outOfOfficeMessage !== undefined && !userColumns.has('out_of_office_message')) {
        profilePreferenceFallback.outOfOfficeMessage =
          outOfOfficeMessage === null ? null : String(outOfOfficeMessage || '').trim() || null;
      }
      addColumnUpdate('company_name', companyName);
      if (companyName !== undefined && !userColumns.has('company_name')) {
        profilePreferenceFallback.companyName =
          companyName === null ? null : String(companyName || '').trim() || null;
      }
      addColumnUpdate('timezone', timezone);
      if (timezone !== undefined && !userColumns.has('timezone')) {
        profilePreferenceFallback.timezone =
          timezone === null ? null : String(timezone || '').trim() || null;
      }
      addColumnUpdate('date_format', dateFormat);
      if (dateFormat !== undefined && !userColumns.has('date_format')) {
        profilePreferenceFallback.dateFormat =
          dateFormat === null ? null : String(dateFormat || '').trim() || null;
      }
      addColumnUpdate('time_format', timeFormat);
      if (timeFormat !== undefined && !userColumns.has('time_format')) {
        profilePreferenceFallback.timeFormat =
          timeFormat === null ? null : String(timeFormat || '').trim() || null;
      }
      // P0.3: interface language preference (account > localStorage > navigator).
      addColumnUpdate('language', language);
      if (language !== undefined && !userColumns.has('language')) {
        profilePreferenceFallback.language =
          language === null ? null : String(language || '').trim() || null;
      }
      addColumnUpdate('seniority_level', seniorityLevel);
      addColumnUpdate('site_location', siteLocation);
      addColumnUpdate('tenure_years', tenureYears);
      addBooleanColumnUpdate('manages_team', managesTeam);
      addColumnUpdate('team_size', teamSize);
      addColumnUpdate(
        'expertise_tags',
        expertiseTags === undefined ? undefined : JSON.stringify(expertiseTags)
      );
      addColumnUpdate('engagement_level', engagementLevel);
      addColumnUpdate('profile_survey_completed_at', profileSurveyCompletedAt);
      if (
        userColumns.has('profile_survey_dismissed_count') &&
        profileSurveyDismissedCount !== undefined
      ) {
        updates.push('profile_survey_dismissed_count = ?');
        params.push(String(profileSurveyDismissedCount));
      }
      addColumnUpdate('profile_survey_last_dismissed_at', profileSurveyLastDismissedAt);

      const shouldPersistProfileFallback =
        (canPersistToUserProfiles &&
          (persistToUserProfiles.jobTitle !== undefined ||
            persistToUserProfiles.department !== undefined)) ||
        (canPersistToUserProfileExtended &&
          (persistToUserProfileExtended.jobTitle !== undefined ||
            persistToUserProfileExtended.department !== undefined));
      const shouldPersistPreferenceFallback = Object.keys(profilePreferenceFallback).length > 0;

      if (
        updates.length === 0 &&
        !shouldPersistProfileFallback &&
        !shouldPersistPreferenceFallback
      ) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      if (updates.length > 0) {
        if (userColumns.has('updated_at')) {
          updates.push('updated_at = ?');
          params.push(new Date().toISOString());
        }

        // Users may update their own profile even when their primary
        // users.organization_id differs from the active org membership.
        const isSelfUpdate = id === currentUserId;
        params.push(id);
        if (!isSelfUpdate) params.push(orgId);

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?${
          isSelfUpdate ? '' : ' AND organization_id = ?'
        }`;
        await queryHelpers.queryRun(sql, params);
      }

      if (shouldPersistProfileFallback) {
        const upsertColumns = ['user_id'];
        const upsertValues: (string | null)[] = [id];

        if (userProfileColumns.has('id')) {
          upsertColumns.unshift('id');
          upsertValues.unshift(randomUUID());
        }

        if (userProfileColumns.has('updated_at')) {
          upsertColumns.push('updated_at');
          upsertValues.push(new Date().toISOString());
        }

        if (userProfileColumns.has('job_title') && persistToUserProfiles.jobTitle !== undefined) {
          upsertColumns.push('job_title');
          upsertValues.push(persistToUserProfiles.jobTitle);
        }

        if (
          userProfileColumns.has('department') &&
          persistToUserProfiles.department !== undefined
        ) {
          upsertColumns.push('department');
          upsertValues.push(persistToUserProfiles.department);
        }

        if (
          persistToUserProfiles.jobTitle !== undefined ||
          persistToUserProfiles.department !== undefined
        ) {
          const profileUpdates: string[] = [];
          const profileParams: (string | null)[] = [];

          if (userProfileColumns.has('job_title') && persistToUserProfiles.jobTitle !== undefined) {
            profileUpdates.push('job_title = ?');
            profileParams.push(persistToUserProfiles.jobTitle);
          }

          if (
            userProfileColumns.has('department') &&
            persistToUserProfiles.department !== undefined
          ) {
            profileUpdates.push('department = ?');
            profileParams.push(persistToUserProfiles.department);
          }

          if (profileUpdates.length > 0) {
            if (userProfileColumns.has('updated_at')) {
              profileUpdates.push('updated_at = ?');
              profileParams.push(new Date().toISOString());
            }
            profileParams.push(id);

            try {
              const profileUpdateResult = await queryHelpers.queryRun(
                `UPDATE user_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
                profileParams
              );

              if (!profileUpdateResult.changes) {
                const placeholders = upsertColumns.map(() => '?').join(', ');
                await queryHelpers.queryRun(
                  `INSERT INTO user_profiles (${upsertColumns.join(', ')}) VALUES (${placeholders})`,
                  upsertValues
                );
              }
            } catch (error) {
              if (!isProfileSchemaWriteError(error)) throw error;
            }
          }
        }
      }

      if (shouldPersistPreferenceFallback) {
        await queryHelpers.queryRun(
          `CREATE TABLE IF NOT EXISTS user_preferences (
             user_id TEXT NOT NULL,
             key TEXT NOT NULL,
             value TEXT NOT NULL,
             updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (user_id, key)
           )`
        );
        await queryHelpers.queryRun(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_user_key ON user_preferences(user_id, key)`
        );
        const existingPreference = (await queryHelpers.queryOne(
          `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
          [id, 'settings:profile-fallback']
        )) as { value?: string } | null;
        let existingPayload: Record<string, unknown> = {};
        try {
          existingPayload = existingPreference?.value
            ? (JSON.parse(existingPreference.value) as Record<string, unknown>)
            : {};
        } catch {
          existingPayload = {};
        }
        const mergedFallback = { ...existingPayload, ...profilePreferenceFallback };
        await queryHelpers.queryRun(
          `INSERT INTO user_preferences (user_id, key, value, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [id, 'settings:profile-fallback', JSON.stringify(mergedFallback)]
        );
      }

      if (
        canPersistToUserProfileExtended &&
        (persistToUserProfileExtended.jobTitle !== undefined ||
          persistToUserProfileExtended.department !== undefined)
      ) {
        const extendedUpdates: string[] = [];
        const extendedParams: (string | null)[] = [];
        const extendedJobTitleColumn = userProfileExtendedColumns.has('job_title')
          ? 'job_title'
          : userProfileExtendedColumns.has('title')
            ? 'title'
            : null;

        if (extendedJobTitleColumn && persistToUserProfileExtended.jobTitle !== undefined) {
          extendedUpdates.push(`${extendedJobTitleColumn} = ?`);
          extendedParams.push(persistToUserProfileExtended.jobTitle);
        }

        if (
          userProfileExtendedColumns.has('department') &&
          persistToUserProfileExtended.department !== undefined
        ) {
          extendedUpdates.push('department = ?');
          extendedParams.push(persistToUserProfileExtended.department);
        }

        if (extendedUpdates.length > 0) {
          if (userProfileExtendedColumns.has('updated_at')) {
            extendedUpdates.push('updated_at = ?');
            extendedParams.push(new Date().toISOString());
          }
          extendedParams.push(id);

          try {
            const profileExtendedUpdateResult = await queryHelpers.queryRun(
              `UPDATE user_profile_extended SET ${extendedUpdates.join(', ')} WHERE user_id = ?`,
              extendedParams
            );

            if (!profileExtendedUpdateResult.changes) {
              const insertColumns: string[] = ['user_id'];
              const insertValues: (string | null)[] = [id];

              if (extendedJobTitleColumn && persistToUserProfileExtended.jobTitle !== undefined) {
                insertColumns.push(extendedJobTitleColumn);
                insertValues.push(persistToUserProfileExtended.jobTitle);
              }

              if (
                userProfileExtendedColumns.has('department') &&
                persistToUserProfileExtended.department !== undefined
              ) {
                insertColumns.push('department');
                insertValues.push(persistToUserProfileExtended.department);
              }

              if (userProfileExtendedColumns.has('created_at')) {
                insertColumns.push('created_at');
                insertValues.push(new Date().toISOString());
              }
              if (userProfileExtendedColumns.has('updated_at')) {
                insertColumns.push('updated_at');
                insertValues.push(new Date().toISOString());
              }

              const placeholders = insertColumns.map(() => '?').join(', ');
              await queryHelpers.queryRun(
                `INSERT INTO user_profile_extended (${insertColumns.join(', ')}) VALUES (${placeholders})`,
                insertValues
              );
            }
          } catch (error) {
            if (!isProfileSchemaWriteError(error)) throw error;
          }
        }
      }

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
      // DEC-91 FIX-2 — `isVerifiedPlatformSuperAdmin` memoises `users.role` for
      // 30 s, so any writer of that column must drop the entry or the answer
      // goes stale in BOTH directions: a promotion is ignored for up to a TTL,
      // and — the direction that matters — a REVOKED superadmin keeps the
      // suspension exemption for up to a TTL after being demoted.
      invalidatePlatformSuperAdminCache(id);

      res.json({ id, role, message: 'Role updated' });
    }
  );
}

export default UserController;
