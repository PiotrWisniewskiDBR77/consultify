/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);
const secret = 'admin-audit-projection-realpg-secret-long-enough';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';

describe.skipIf(!enabled)('Admin P32 canonical audit projection mounted RealPG', () => {
  const suffix = randomUUID().slice(0, 8);
  const org = `adm-audit-org-${suffix}`;
  const foreignOrg = `adm-audit-foreign-org-${suffix}`;
  const owner = `adm-audit-owner-${suffix}`;
  const roleTarget = `adm-audit-role-target-${suffix}`;
  const revokeTarget = `adm-audit-revoke-target-${suffix}`;
  const foreignOwner = `adm-audit-foreign-owner-${suffix}`;
  const foreignTarget = `adm-audit-foreign-target-${suffix}`;
  let pool: Pool;
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const now = new Date().toISOString();
    for (const organizationId of [org, foreignOrg]) {
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $1, 'enterprise', 'active', 1, $2)`,
        [organizationId, now]
      );
    }
    for (const [userId, organizationId, role] of [
      [owner, org, 'OWNER'],
      [roleTarget, org, 'MEMBER'],
      [revokeTarget, org, 'MEMBER'],
      [foreignOwner, foreignOrg, 'OWNER'],
      [foreignTarget, foreignOrg, 'MEMBER'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES ($1, $2, $3, 'unused', $4, 'active', $5)`,
        [userId, organizationId, `${userId}@test.invalid`, role, now]
      );
      await pool.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5)`,
        [randomUUID(), organizationId, userId, role, now]
      );
    }

    const iam = await import('../../services/orgPeopleIamService.js');
    const roleCommand = {
      actorId: owner,
      actorRole: 'OWNER',
      organizationId: org,
      targetMemberId: roleTarget,
      newRole: 'ADMIN',
      expectedRole: 'MEMBER',
      idempotencyKey: `role-${suffix}`,
    };
    expect(await iam.changeOrganizationMemberRoleAtomicallyViaIam(roleCommand)).toMatchObject({
      denied: false,
    });
    expect(await iam.changeOrganizationMemberRoleAtomicallyViaIam(roleCommand)).toMatchObject({
      denied: false,
      replayed: true,
    });
    expect(
      await iam.removeOrganizationMemberAtomicallyViaIam({
        actorId: owner,
        actorRole: 'OWNER',
        organizationId: org,
        targetMemberId: revokeTarget,
        expectedRole: 'MEMBER',
        idempotencyKey: `revoke-${suffix}`,
      })
    ).toMatchObject({ denied: false });
    expect(
      await iam.changeOrganizationMemberRoleAtomicallyViaIam({
        actorId: foreignOwner,
        actorRole: 'OWNER',
        organizationId: foreignOrg,
        targetMemberId: foreignTarget,
        newRole: 'ADMIN',
        expectedRole: 'MEMBER',
        idempotencyKey: `foreign-role-${suffix}`,
      })
    ).toMatchObject({ denied: false });

    const router = (await import('../adminP32.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/admin', router);
    app.use((error: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(error?.message || error) })
    );
    token = jwt.sign(
      { id: owner, userId: owner, organizationId: org, email: `${owner}@test.invalid`, role: 'OWNER' },
      secret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  });

  afterAll(async () => {
    if (!pool) return;
    const organizations = [org, foreignOrg];
    const users = [owner, roleTarget, revokeTarget, foreignOwner, foreignTarget];
    await pool.query(`DELETE FROM admin_iam_member_commands WHERE organization_id = ANY($1)`, [
      organizations,
    ]);
    await pool.query(`DELETE FROM role_change_audit_events WHERE organization_id = ANY($1)`, [
      organizations,
    ]);
    await pool.query(`DELETE FROM revoked_tokens WHERE user_id = ANY($1)`, [users]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      organizations,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [organizations]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [organizations]);
    await pool.end();
  });

  it('cold-reads canonical role/revoke once and keeps list, stats, export, and tenant scope aligned', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const list = await request(app).get('/api/admin/audit-logs?limit=100').set(auth);
    expect(list.status).toBe(200);
    const canonical = list.body.logs.filter((row: any) =>
      ['role_change', 'member_removed'].includes(row.action_type)
    );
    expect(canonical).toHaveLength(2);
    expect(canonical.map((row: any) => row.action_type).sort()).toEqual([
      'member_removed',
      'role_change',
    ]);
    expect(canonical.every((row: any) => row.organization_id === org)).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain(foreignTarget);

    const coldCount = await pool.query(
      `SELECT count(*)::int AS count
         FROM role_change_audit_events
        WHERE organization_id = $1 AND action IN ('role_change', 'member_removed')`,
      [org]
    );
    expect(coldCount.rows[0].count).toBe(2);

    const stats = await request(app).get('/api/admin/audit-logs/stats').set(auth);
    expect(stats.status).toBe(200);
    expect(stats.body.totalLogs).toBe(list.body.total);
    expect(stats.body.highRiskCount).toBeGreaterThanOrEqual(2);

    const exported = await request(app).get('/api/admin/audit-logs/export').set(auth);
    expect(exported.status).toBe(200);
    expect(exported.text).toContain('"role_change"');
    expect(exported.text).toContain('"member_removed"');
    expect(exported.text).not.toContain(foreignTarget);
  });
});
