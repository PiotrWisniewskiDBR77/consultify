/**
 * SuperAdmin account provisioning — real-runtime E2E proof (M27 registry gap).
 *
 * Context: `Harvard/wdrozenie-100/M27-superadmin.md` (decision D-02) flags that
 * Fazy 3/4 live-verify "wymaga konta superadmin" — and on inspection, no
 * migration/seed actually creates a login-capable SUPERADMIN account on
 * Postgres (the only bootstrap row, `000_z_core_baseline.sql:751-753`, uses
 * SQLite-only `INSERT OR IGNORE` syntax and ships with no password hash).
 * Confirmed directly against the local parity Postgres (`:5443`, schema
 * identical to demo/staging): zero rows in `users` carry a superadmin role.
 *
 * This test proves the fix (`server/scripts/provision-superadmin.ts`) closes
 * the gap end-to-end against the REAL local Postgres, REAL bcrypt hashing,
 * and the REAL `verifySuperAdmin` production gate (DB-role source of truth,
 * not the JWT claim) — no mocks:
 *   1. provisionSuperAdmin() creates a real user row with role SUPERADMIN
 *      and a genuinely verifiable bcrypt password hash.
 *   2. The stored hash actually authenticates the chosen password (proves
 *      the account is login-capable, not just a role flag).
 *   3. The real `verifySuperAdmin` middleware (mounted exactly as
 *      `superadmin.routes.ts` mounts it) admits the provisioned account (200).
 *   4. The same middleware rejects a real, pre-existing non-superadmin user
 *      from the same database (403) — proving no accidental over-grant.
 *   5. Re-running provisionSuperAdmin() on the same email is idempotent
 *      (no duplicate row, role fix reported false on the second call).
 *
 * All rows created by this test are deleted in `afterAll` (dedicated QA org,
 * `qa-m27k-superadmin-org`) — no residue left in the database.
 */
import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { get as dbGet, run as dbRun } from '../../server/src/utils/DbPromise.js';
import { provisionSuperAdmin } from '../../server/scripts/provision-superadmin.js';

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`This test requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz';
}

function mintToken(user: {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      organization_id: user.organizationId,
      role: user.role,
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function buildProbeApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { verifySuperAdmin } = await import('../../server/src/middleware/superAdmin.middleware.js');
  const app = express();
  app.use(express.json());
  // Mirrors the real mount order in server/src/routes/superadmin.routes.ts:340-347
  // (verifyToken, then requireSuperAdmin) behind a trivial protected route.
  app.get('/probe', verifyToken as any, verifySuperAdmin as any, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

const QA_ORG_ID = 'qa-m27k-superadmin-org';
const TEST_EMAIL = `m27k-provision-${Date.now()}@qa.consultify.local`;
const TEST_PASSWORD = 'M27k-Sup3radmin-Test-Password!';

describe('M27 — superadmin account provisioning (real Postgres, real gate)', () => {
  let app: Express;
  let provisionedUserId: string;
  let controlNonSuperAdminUser: { id: string; email: string; organization_id: string } | null;

  beforeAll(async () => {
    requireLocalDbUrl();
    app = await buildProbeApp();

    // A real, pre-existing non-superadmin row from the same DB — proves the
    // gate discriminates on the DB role, not "any known user id".
    controlNonSuperAdminUser =
      (await dbGet<{ id: string; email: string; organization_id: string }>(
        `SELECT id, email, organization_id FROM users
         WHERE upper(coalesce(role, '')) NOT LIKE '%SUPER%'
         LIMIT 1`
      )) || null;
  });

  afterAll(async () => {
    // Probe cleans up after itself — zero residual QA rows (CLAUDE.md hygiene rule).
    await dbRun(`DELETE FROM organization_members WHERE organization_id = ?`, [QA_ORG_ID], {
      fallback: true,
    });
    await dbRun(`DELETE FROM users WHERE organization_id = ?`, [QA_ORG_ID], { fallback: true });
    await dbRun(`DELETE FROM organizations WHERE id = ?`, [QA_ORG_ID], { fallback: true });
  });

  it('creates a real SUPERADMIN user row with a genuinely verifiable password hash', async () => {
    const result = await provisionSuperAdmin({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      organizationId: QA_ORG_ID,
      organizationName: 'QA M27 SuperAdmin Provisioning Test',
    });

    expect(result.created).toBe(true);
    expect(result.roleFixed).toBe(true);
    provisionedUserId = result.userId;

    const row = await dbGet<{ role: string; password: string; status: string }>(
      `SELECT role, password, status FROM users WHERE id = ?`,
      [provisionedUserId]
    );
    expect(row?.role).toBe('SUPERADMIN');
    expect(row?.status).toBe('active');
    expect(typeof row?.password).toBe('string');
    // Round-trips through the exact same bcrypt comparison the real login
    // path (AuthController.comparePassword) uses.
    expect(bcrypt.compareSync(TEST_PASSWORD, row!.password)).toBe(true);
    expect(bcrypt.compareSync('wrong-password', row!.password)).toBe(false);
  });

  it('is idempotent: re-running on the same email does not duplicate the row or re-fix an already-correct role', async () => {
    const again = await provisionSuperAdmin({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      organizationId: QA_ORG_ID,
      organizationName: 'QA M27 SuperAdmin Provisioning Test',
    });
    expect(again.created).toBe(false);
    expect(again.userId).toBe(provisionedUserId);
    expect(again.roleFixed).toBe(false); // already SUPERADMIN from the first run
    expect(again.passwordRotated).toBe(false); // rotatePassword not requested

    const count = await dbGet<{ count: string }>(
      `SELECT count(*)::text AS count FROM users WHERE lower(email) = lower(?)`,
      [TEST_EMAIL]
    );
    expect(count?.count).toBe('1');
  });

  it('the real verifySuperAdmin gate ADMITS the provisioned superadmin account (200)', async () => {
    const { default: request } = await import('supertest');
    const token = mintToken({
      id: provisionedUserId,
      email: TEST_EMAIL,
      organizationId: QA_ORG_ID,
      role: 'SUPERADMIN',
    });
    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('the real verifySuperAdmin gate REJECTS a real non-superadmin user from the same DB (403)', async () => {
    if (!controlNonSuperAdminUser) {
      // No non-superadmin fixture user exists in this DB snapshot — nothing to
      // assert against; do not fabricate a false pass.
      expect(controlNonSuperAdminUser).toBeNull();
      return;
    }
    const { default: request } = await import('supertest');
    const token = mintToken({
      id: controlNonSuperAdminUser.id,
      email: controlNonSuperAdminUser.email,
      organizationId: controlNonSuperAdminUser.organization_id,
      role: 'ADMIN', // stale/forged claim — gate must re-check the DB, not trust this
    });
    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects requests with no token at all (401)', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).get('/probe');
    expect(res.status).toBe(401);
  });
});
