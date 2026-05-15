#!/usr/bin/env tsx
/**
 * Clone "project access" rows from one user to another in the same staging DB.
 *
 * What it does (idempotent upserts):
 * - project_users
 * - project_members
 * - project_user_permissions
 * - project_role_assignments
 * - project_steering_board_members
 *
 * Usage (repo root):
 *   SKIP_ENV_VALIDATION=true DB_MANAGED_SCHEMA=off ENV_FILE=.env.staging.local \
 *   npx tsx server/scripts/staging-clone-project-access.ts \
 *     --from piotr.wisniewski@dbr77.com \
 *     --to torian.richardson@dbr77.com
 */

import crypto from 'crypto';

import dotenv from 'dotenv';

function loadEnv() {
  dotenv.config({ path: '.env' });
  if (!process.env.ENV_FILE) {
    dotenv.config({ path: '.env.local' });
  }
  if (process.env.ENV_FILE) {
    dotenv.config({ path: process.env.ENV_FILE, override: true });
  }
}

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] || null;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

async function main() {
  loadEnv();

  const fromEmail = normalizeEmail(getArg('--from') || '');
  const toEmail = normalizeEmail(getArg('--to') || '');
  if (!fromEmail || !toEmail) {
    throw new Error('Missing --from and/or --to email.');
  }
  if (fromEmail === toEmail) {
    throw new Error('Refusing to clone from/to the same email.');
  }

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const users = await db.query<{ id: string; email: string }>(
    `SELECT id, lower(trim(email)) AS email
     FROM users
     WHERE lower(trim(email)) = ANY(?)`,
    [[fromEmail, toEmail]]
  );
  const from = users.rows.find((r) => r.email === fromEmail);
  const to = users.rows.find((r) => r.email === toEmail);
  if (!from || !to) {
    throw new Error(`Missing user(s). Found: ${users.rows.map((r) => r.email).join(', ')}`);
  }

  const summary: Record<string, unknown> = {};

  await db.run('BEGIN', []);
  try {
    // project_users (composite PK)
    await db.run(
      `INSERT INTO project_users (project_id, user_id, role, assigned_at)
       SELECT project_id, ?, role, CURRENT_TIMESTAMP
       FROM project_users
       WHERE user_id = ?
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [to.id, from.id]
    );

    // project_members
    const projectMembers = await db.query<any>(
      `SELECT project_id, project_role, workstream_id, allocation_percent, permissions, start_date, end_date,
              added_by_id, pmo_role_id, responsibilities, notes, is_invoked, consultant_profile, engagement_type, acting_org_id
       FROM project_members
       WHERE user_id = ?`,
      [from.id]
    );
    for (const r of projectMembers.rows || []) {
      await db.run(
        `INSERT INTO project_members (
            id, project_id, user_id, project_role, workstream_id, allocation_percent, permissions, start_date, end_date,
            created_at, updated_at, added_by_id, pmo_role_id, responsibilities, notes, is_invoked, consultant_profile, engagement_type, acting_org_id
         ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?
         )
         ON CONFLICT (project_id, user_id) DO UPDATE SET
            project_role = EXCLUDED.project_role,
            workstream_id = EXCLUDED.workstream_id,
            allocation_percent = EXCLUDED.allocation_percent,
            permissions = EXCLUDED.permissions,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            updated_at = CURRENT_TIMESTAMP,
            added_by_id = EXCLUDED.added_by_id,
            pmo_role_id = EXCLUDED.pmo_role_id,
            responsibilities = EXCLUDED.responsibilities,
            notes = EXCLUDED.notes,
            is_invoked = EXCLUDED.is_invoked,
            consultant_profile = EXCLUDED.consultant_profile,
            engagement_type = EXCLUDED.engagement_type,
            acting_org_id = EXCLUDED.acting_org_id`,
        [
          crypto.randomUUID(),
          r.project_id,
          to.id,
          r.project_role,
          r.workstream_id,
          r.allocation_percent,
          r.permissions,
          r.start_date,
          r.end_date,
          r.added_by_id,
          r.pmo_role_id,
          r.responsibilities,
          r.notes,
          r.is_invoked,
          r.consultant_profile,
          r.engagement_type,
          r.acting_org_id,
        ]
      );
    }

    // project_user_permissions
    const projectUserPermissions = await db.query<any>(
      `SELECT project_id, permission_key, grant_type, granted_by, expires_at
       FROM project_user_permissions
       WHERE user_id = ?`,
      [from.id]
    );
    for (const r of projectUserPermissions.rows || []) {
      await db.run(
        `INSERT INTO project_user_permissions (
            id, user_id, project_id, permission_key, grant_type, granted_by, created_at, expires_at
         ) VALUES (
            ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?
         )
         ON CONFLICT (user_id, project_id, permission_key) DO UPDATE SET
           grant_type = EXCLUDED.grant_type,
           granted_by = EXCLUDED.granted_by,
           expires_at = EXCLUDED.expires_at`,
        [crypto.randomUUID(), to.id, r.project_id, r.permission_key, r.grant_type, r.granted_by, r.expires_at]
      );
    }

    // project_role_assignments
    const projectRoleAssignments = await db.query<any>(
      `SELECT project_id, pmo_role_key, assigned_by, notes
       FROM project_role_assignments
       WHERE user_id = ?`,
      [from.id]
    );
    for (const r of projectRoleAssignments.rows || []) {
      await db.run(
        `INSERT INTO project_role_assignments (id, project_id, user_id, pmo_role_key, assigned_by, assigned_at, notes)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (project_id, user_id, pmo_role_key) DO UPDATE SET
           assigned_by = EXCLUDED.assigned_by,
           notes = EXCLUDED.notes`,
        [crypto.randomUUID(), r.project_id, to.id, r.pmo_role_key, r.assigned_by, r.notes]
      );
    }

    // project_steering_board_members
    const steeringBoard = await db.query<any>(
      `SELECT project_id, member_type, notify_decision_requests, notify_escalations
       FROM project_steering_board_members
       WHERE user_id = ?`,
      [from.id]
    );
    for (const r of steeringBoard.rows || []) {
      await db.run(
        `INSERT INTO project_steering_board_members (
            id, project_id, user_id, member_type, notify_decision_requests, notify_escalations, created_at, updated_at
         ) VALUES (
            ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         ON CONFLICT (project_id, user_id) DO UPDATE SET
           member_type = EXCLUDED.member_type,
           notify_decision_requests = EXCLUDED.notify_decision_requests,
           notify_escalations = EXCLUDED.notify_escalations,
           updated_at = CURRENT_TIMESTAMP`,
        [crypto.randomUUID(), r.project_id, to.id, r.member_type, r.notify_decision_requests, r.notify_escalations]
      );
    }

    await db.run('COMMIT', []);

    summary.source = { fromEmail, fromId: from.id, toEmail, toId: to.id };
    summary.copied = {
      project_members: projectMembers.rows?.length || 0,
      project_user_permissions: projectUserPermissions.rows?.length || 0,
      project_role_assignments: projectRoleAssignments.rows?.length || 0,
      project_steering_board_members: steeringBoard.rows?.length || 0,
    };

    const torianCounts = await db.query(
      `SELECT
        (SELECT COUNT(*)::int FROM project_members WHERE user_id = ?) AS project_members,
        (SELECT COUNT(*)::int FROM project_users WHERE user_id = ?) AS project_users,
        (SELECT COUNT(*)::int FROM project_user_permissions WHERE user_id = ?) AS project_user_permissions,
        (SELECT COUNT(*)::int FROM project_role_assignments WHERE user_id = ?) AS project_role_assignments,
        (SELECT COUNT(*)::int FROM project_steering_board_members WHERE user_id = ?) AS project_steering_board_members`,
      [to.id, to.id, to.id, to.id, to.id]
    );
    summary.torianCounts = torianCounts.rows?.[0] || {};

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    try {
      await db.run('ROLLBACK', []);
    } catch {
      // ignore
    }
    throw e;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ staging-clone-project-access failed:', e?.message || e);
  process.exit(1);
});

