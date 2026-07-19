#!/usr/bin/env tsx
/**
 * Provision SuperAdmin — creates (or promotes) a real, login-capable
 * SUPERADMIN account.
 *
 * Context (M27 registry gap, 2026-07-19): the only "superadmin bootstrap" row
 * shipped today is `server/migrations/000_z_core_baseline.sql:751-753`
 * (`system@iris.internal`), which:
 *   1. uses SQLite-only `INSERT OR IGNORE` syntax, so it never runs on a real
 *      Postgres deploy (demo/staging/prod all run DB_TYPE=postgres) — the
 *      migration runner logs a syntax error and moves on, non-fatal;
 *   2. even where it *does* run (sqlite/dev), the row has no `password` hash,
 *      so it is not a usable login account anyway.
 * Net effect: verified on the local parity Postgres (`:5443`, schema-identical
 * to demo) — zero rows in `users` carry role SUPERADMIN/super_admin. There is
 * no way today to actually log in as a superadmin without hand-editing the DB.
 * That is the concrete blocker behind registry item "M27: konto superadmina"
 * (teczka M27-superadmin.md, decision D-02 — Fazy 3/4 live-verify "wymaga
 * konta superadmin").
 *
 * This script closes that gap the same way `qa-fixtures-superadmin.ts` closes
 * the "no QA people" gap: an explicit, idempotent, confirm-gated provisioning
 * step — NOT a baked-in credential in a migration file. It creates (or
 * upgrades) exactly one user row with a real bcrypt password hash and role
 * SUPERADMIN, using the identical INSERT shape as the real registration path
 * (`auth.routes.ts` `/register-demo`) so the row round-trips through the
 * normal login flow, `superAdmin.middleware.ts` DB-role check, and the
 * `FORCE_SUPERADMIN_EMAILS` re-affirmation on every subsequent login.
 *
 * Safety guarantees (mirrors qa-fixtures-superadmin.ts):
 *  - Refuses to run unless SUPERADMIN_PROVISION_CONFIRM=YES.
 *  - Refuses to run in production unless SUPERADMIN_PROVISION_PROD_OK=YES.
 *  - Requires an explicit email + password (no hardcoded/guessable default
 *    credential shipped in code) — falls back to the first entry of
 *    FORCE_SUPERADMIN_EMAILS only for the EMAIL (never the password).
 *  - Idempotent: existing row → role/status fixed in place; password is only
 *    rotated when SUPERADMIN_PROVISION_ROTATE_PASSWORD=YES (never clobbers a
 *    real admin's password by accident on repeat runs).
 *
 * Usage (from consultify/):
 *   SUPERADMIN_PROVISION_CONFIRM=YES \
 *   SUPERADMIN_EMAIL=admin@dbr77.com \
 *   SUPERADMIN_PASSWORD='...' \
 *     npx tsx server/scripts/provision-superadmin.ts
 *
 * Optional env:
 *   SUPERADMIN_ORG_ID / SUPERADMIN_ORG_NAME  (default: 'system' / 'System')
 *   SUPERADMIN_FIRST_NAME / SUPERADMIN_LAST_NAME (default: 'Super' / 'Admin')
 *   SUPERADMIN_PROVISION_ROTATE_PASSWORD=YES  (rotate password on an existing row)
 *   SUPERADMIN_PROVISION_PROD_OK=YES  (required when NODE_ENV=production)
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';

export interface ProvisionSuperAdminOptions {
  email: string;
  password: string;
  organizationId?: string;
  organizationName?: string;
  firstName?: string;
  lastName?: string;
  rotatePassword?: boolean;
}

export interface ProvisionSuperAdminResult {
  userId: string;
  organizationId: string;
  email: string;
  created: boolean;
  roleFixed: boolean;
  passwordRotated: boolean;
}

function firstForcedSuperAdminEmail(): string | undefined {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  const first = raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)[0];
  return first;
}

/** Core provisioning logic — importable directly by tests (no CLI/env gating). */
export async function provisionSuperAdmin(
  opts: ProvisionSuperAdminOptions
): Promise<ProvisionSuperAdminResult> {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('provisionSuperAdmin: email is required');
  }
  if (!opts.password || opts.password.length < 8) {
    throw new Error('provisionSuperAdmin: password is required (min 8 chars)');
  }

  const organizationId = opts.organizationId || 'system';
  const organizationName = opts.organizationName || 'System';
  const firstName = opts.firstName || 'Super';
  const lastName = opts.lastName || 'Admin';

  await dbRun(
    `INSERT INTO organizations (id, name, status) VALUES (?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [organizationId, organizationName, 'active'],
    { fallback: true }
  );

  const existing = await dbGet<{ id: string; role?: string }>(
    `SELECT id, role FROM users WHERE lower(email) = lower(?)`,
    [email]
  );

  const hashedPassword = bcrypt.hashSync(opts.password, 10);

  if (existing?.id) {
    const roleFixed = String(existing.role || '').toUpperCase() !== 'SUPERADMIN';
    if (roleFixed) {
      await dbRun(`UPDATE users SET role = ?, status = ? WHERE id = ?`, [
        'SUPERADMIN',
        'active',
        existing.id,
      ]);
    }
    let passwordRotated = false;
    if (opts.rotatePassword) {
      await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, existing.id]);
      passwordRotated = true;
    }
    await dbRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${organizationId}-member-${existing.id}`, organizationId, existing.id],
      { fallback: true }
    );
    return {
      userId: existing.id,
      organizationId,
      email,
      created: false,
      roleFixed,
      passwordRotated,
    };
  }

  const userId = uuidv4();
  const result = await dbRun(
    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, organizationId, email, hashedPassword, firstName, lastName, 'SUPERADMIN', 'active'],
    { fallback: false }
  );
  if (!result.success) {
    throw new Error(`provisionSuperAdmin: failed to insert user row: ${result.error}`);
  }
  await dbRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`${organizationId}-member-${userId}`, organizationId, userId],
    { fallback: true }
  );

  return {
    userId,
    organizationId,
    email,
    created: true,
    roleFixed: true,
    passwordRotated: true,
  };
}

function requireConfirmation() {
  const confirm = String(process.env.SUPERADMIN_PROVISION_CONFIRM || '');
  if (confirm !== 'YES') {
    throw new Error(
      "Refusing to run: set SUPERADMIN_PROVISION_CONFIRM=YES to acknowledge this creates/promotes a live superadmin account."
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.SUPERADMIN_PROVISION_PROD_OK !== 'YES') {
    throw new Error(
      'Refusing to run in production: set SUPERADMIN_PROVISION_PROD_OK=YES if intentional.'
    );
  }
}

async function main() {
  requireConfirmation();

  const email = process.env.SUPERADMIN_EMAIL || firstForcedSuperAdminEmail();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email) {
    throw new Error(
      'Set SUPERADMIN_EMAIL (or FORCE_SUPERADMIN_EMAILS with at least one entry).'
    );
  }
  if (!password) {
    throw new Error('Set SUPERADMIN_PASSWORD.');
  }

  const result = await provisionSuperAdmin({
    email,
    password,
    organizationId: process.env.SUPERADMIN_ORG_ID,
    organizationName: process.env.SUPERADMIN_ORG_NAME,
    firstName: process.env.SUPERADMIN_FIRST_NAME,
    lastName: process.env.SUPERADMIN_LAST_NAME,
    rotatePassword: String(process.env.SUPERADMIN_PROVISION_ROTATE_PASSWORD || '') === 'YES',
  });

  console.log(
    `[provision-superadmin] ${result.created ? 'created' : 'updated'} user=${result.userId} email=${result.email} org=${result.organizationId} roleFixed=${result.roleFixed} passwordRotated=${result.passwordRotated}`
  );
}

// Only auto-run when invoked as a CLI script, not when imported by tests.
const isDirectRun = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[provision-superadmin] failed:', err?.message || err);
      process.exit(1);
    });
}
