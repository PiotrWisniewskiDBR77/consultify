/**
 * P0 IDOR fix — mounted signed-JWT + real PostgreSQL proof.
 *
 * ATTACK CHAIN (confirmed live via probe, 2026-08-28):
 *   1. A `consultant`-role user in org A calls
 *      `POST /api/access-codes/generate { type: 'CONSULTANT', organizationId: <org B> }`
 *      → 201, and the minted code's `organization_id` is org B (the victim),
 *      even though the caller has no relationship to org B whatsoever.
 *      (accessCodes.routes.ts previously checked role for CONSULTANT/TRIAL
 *      but never compared `organizationId` against the caller's own org —
 *      that ownership check existed ONLY on the INVITE branch.)
 *   2. Anonymous `POST /api/auth/register { accessCode: 'CONS-XXXX' }` reads
 *      `access_codes WHERE code = ? AND is_active = 1` (no type filter, no
 *      creator check) and, since the row carries org B's id, sets
 *      `joiningExistingOrg = true` and writes an ACTIVE `organization_members`
 *      row for the caller IN ORG B — full cross-tenant privilege escalation
 *      from an anonymous, unauthenticated request.
 *
 * This suite proves BOTH fix layers against a REAL migrated PostgreSQL
 * database (MOCK_DB=false), mounting the REAL routers behind REAL
 * verifyToken middleware / REAL register handler — no mocks:
 *
 *  BARRIER 1 (mint-time, accessCodes.routes.ts POST /generate):
 *   (a) org-A consultant generating CONSULTANT with organizationId=org B → 403,
 *       readback proves ZERO new access_codes rows.
 *   (b) same for TRIAL → 403, zero new rows.
 *   (c) generating for the caller's OWN org still works (201) for every code
 *       type reachable from this endpoint (CONSULTANT, TRIAL, INVITE,
 *       REFERRAL) — no regression.
 *   (d) INVITE's pre-existing (narrower) org check is unchanged — an org-A
 *       admin still cannot mint an INVITE for org B (403, pre-existing
 *       behavior, not touched by this fix).
 *   (g) a platform superadmin (signed `isSuperAdmin` claim) is the ONLY
 *       exempted caller — cross-org mint still succeeds (201) for them.
 *
 *  BARRIER 2 (consumption-time, auth.routes.ts POST /register):
 *   (e) even if a cross-org-bound code exists (simulating pre-fix data, a
 *       seed, or a hypothetical future bypass of barrier 1 — inserted
 *       directly here, bypassing the /generate endpoint entirely), the
 *       anonymous register flow refuses to honor it (400
 *       ACCESS_CODE_ORG_MISMATCH) because its creator is not a member of the
 *       org the code is bound to. Readback proves no user row and no
 *       organization_members row were created for the attempted registration.
 *
 *  MUTATION PROOF (f): documented as a manual step in the task write-up —
 *  reverting the barrier-1 org check and re-running test (a) flips it from
 *  403 to 201 with a real row written, then the fix is restored. Kept out of
 *  this file (which must reflect the FIXED state) and run once by hand.
 *
 * Requires a disposable, fully migrated database whose name starts with
 * `consultify_accesscodes_idor_test`. Destroy the disposable database after
 * the run.
 */
import { createHash, randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseName = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres') &&
  databaseName.startsWith('consultify_accesscodes_idor_test');

describe.skipIf(!enabled).sequential('mounted access-codes cross-org escalation (IDOR fix)', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgA = `acx-idor-${suffix}-a`;
  const orgB = `acx-idor-${suffix}-b`;
  const consultantA = `acx-idor-${suffix}-consultant-a`;
  const adminA = `acx-idor-${suffix}-admin-a`;
  const superAdminX = `acx-idor-${suffix}-superadmin`;

  let pool: pg.Pool;
  let accessCodesApp: Express;
  let authApp: Express;

  const token = (id: string, organizationId: string, role: string, isSuperAdmin = false) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
        ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  const countAccessCodesForOrg = async (organizationId: string) => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM access_codes WHERE organization_id = $1`,
      [organizationId]
    );
    return rows[0].n as number;
  };

  const hashCode = (code: string) =>
    createHash('sha256').update(String(code).trim()).digest('hex');

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });

    for (const [org, label] of [
      [orgA, 'A'],
      [orgB, 'B'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
        org,
        `AccessCodes IDOR ${label}`,
      ]);
    }

    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
       VALUES($1,$2,$3,'x','CONSULTANT','active','Consultant','A',now())`,
      [consultantA, orgA, `${consultantA}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
       VALUES($1,$2,$3,'x','ADMIN','active','Admin','A',now())`,
      [adminA, orgA, `${adminA}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
       VALUES($1,$2,$3,'x','SUPERADMIN','active','Super','Admin',now())`,
      [superAdminX, orgA, `${superAdminX}@test.invalid`]
    );

    const accessCodesRouter = (await import('../../../server/src/routes/accessCodes.routes.js'))
      .default;
    accessCodesApp = express();
    accessCodesApp.use(express.json());
    accessCodesApp.use('/api/access-codes', accessCodesRouter);

    const authRouter = (await import('../../../server/src/routes/auth.routes.js')).default;
    authApp = express();
    authApp.use(express.json());
    authApp.use('/api/auth', authRouter);
  }, 60_000);

  afterAll(async () => {
    try {
      await pool.query(`DELETE FROM access_code_usage WHERE code_id IN (
        SELECT id FROM access_codes WHERE organization_id IN ($1,$2)
      )`, [orgA, orgB]);
      await pool.query(`DELETE FROM access_codes WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await pool.query(
        `DELETE FROM organization_members WHERE organization_id IN ($1,$2)`,
        [orgA, orgB]
      );
      await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`acx-idor-${suffix}-%`]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    } catch {
      // ignore cleanup failures — disposable database is destroyed by the harness anyway.
    }
    await pool?.end();
  });

  // ───────────────────────────────────────────────────────────────────────
  // BARRIER 1 — mint-time org guard
  // ───────────────────────────────────────────────────────────────────────

  it('(a) org-A consultant minting CONSULTANT for org B is rejected — 403, zero new rows', async () => {
    const before = await countAccessCodesForOrg(orgB);
    const res = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(consultantA, orgA, 'CONSULTANT')}`)
      .send({ type: 'CONSULTANT', organizationId: orgB });

    expect(res.status).toBe(403);
    const after = await countAccessCodesForOrg(orgB);
    expect(after).toBe(before);
  });

  it('(b) org-A consultant minting TRIAL for org B is rejected — 403, zero new rows', async () => {
    const before = await countAccessCodesForOrg(orgB);
    const res = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(consultantA, orgA, 'CONSULTANT')}`)
      .send({ type: 'TRIAL', organizationId: orgB });

    expect(res.status).toBe(403);
    const after = await countAccessCodesForOrg(orgB);
    expect(after).toBe(before);
  });

  it('(c) generating for the CALLER\'S OWN org still works, for every code type — no regression', async () => {
    for (const type of ['CONSULTANT', 'TRIAL']) {
      const res = await request(accessCodesApp)
        .post('/api/access-codes/generate')
        .set('Authorization', `Bearer ${token(consultantA, orgA, 'CONSULTANT')}`)
        .send({ type, organizationId: orgA });
      expect(res.status, `type=${type}`).toBe(201);
      expect(res.body.code).toBeTruthy();
    }

    const inviteRes = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(adminA, orgA, 'ADMIN')}`)
      .send({ type: 'INVITE', organizationId: orgA });
    expect(inviteRes.status).toBe(201);

    const referralRes = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(consultantA, orgA, 'CONSULTANT')}`)
      .send({ type: 'REFERRAL', organizationId: orgA });
    expect(referralRes.status).toBe(201);
  });

  it('(d) INVITE cross-org check is unchanged (pre-existing behavior, not regressed)', async () => {
    const res = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(adminA, orgA, 'ADMIN')}`)
      .send({ type: 'INVITE', organizationId: orgB });
    expect(res.status).toBe(403);
  });

  it('(g) a platform superadmin IS exempt from the cross-org mint guard', async () => {
    const res = await request(accessCodesApp)
      .post('/api/access-codes/generate')
      .set('Authorization', `Bearer ${token(superAdminX, orgA, 'SUPERADMIN', true)}`)
      .send({ type: 'CONSULTANT', organizationId: orgB });
    expect(res.status).toBe(201);
  });

  // ───────────────────────────────────────────────────────────────────────
  // BARRIER 2 — consumption-time creator/org consistency guard
  // ───────────────────────────────────────────────────────────────────────

  it('(e) a cross-org-bound code (simulating pre-fix/seed data) is refused at register — no membership created', async () => {
    // Bypass /generate entirely (as barrier 1 now blocks it) and insert the
    // poisoned row directly, exactly as pre-fix data / a seed script would
    // have left it: bound to org B, but created by a user who only ever
    // belonged to org A.
    const plainCode = `CONS-POISON-${suffix}`;
    const codeId = `ac-${randomUUID()}`;
    await pool.query(
      `INSERT INTO access_codes
         (id, code, code_hash, type, organization_id, created_by, created_by_user_id, max_uses, uses_count, current_uses, expires_at, status, is_active, metadata_json, created_at)
       VALUES ($1,$2,$3,'CONSULTANT',$4,$5,$5,1,0,0, now() + interval '30 days', 'ACTIVE', 1, '{}', now())`,
      [codeId, plainCode, hashCode(plainCode), orgB, consultantA]
    );

    const attackerEmail = `acx-idor-${suffix}-victim-register@test.invalid`;
    const res = await request(authApp).post('/api/auth/register').send({
      email: attackerEmail,
      password: 'Password123',
      firstName: 'Cross',
      lastName: 'Org',
      accessCode: plainCode,
    });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('ACCESS_CODE_ORG_MISMATCH');

    const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      attackerEmail,
    ]);
    expect(userRows.length).toBe(0);

    const { rows: memberRows } = await pool.query(
      `SELECT om.id FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE u.email = $1 AND om.organization_id = $2`,
      [attackerEmail, orgB]
    );
    expect(memberRows.length).toBe(0);

    // Code must not have been consumed either.
    const { rows: codeRows } = await pool.query(
      `SELECT current_uses FROM access_codes WHERE id = $1`,
      [codeId]
    );
    expect(codeRows[0].current_uses).toBe(0);
  });
});
