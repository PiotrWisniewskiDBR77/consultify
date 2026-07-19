/**
 * RED-G + RED-D W5/W6 (2026-07-19) — 3 schema-drift/DI regressions in the
 * PMO / superadmin rewir, all masked as 503 or 500 on real Postgres parity :5443.
 *
 *   1. GET /api/pmo/project-members/:projectId
 *      SELECT referenced pm.role / pm.joined_at — the live `project_members`
 *      table has `project_role` / `created_at`. isSchemaMissingError() caught
 *      the raw 42703 and turned it into a masked 503 ("not_configured"), so the
 *      member list silently looked "not configured" instead of erroring loudly.
 *      Fix: alias the real columns to the unchanged JSON contract (role,
 *      joined_at) in server/src/routes/pmo/project-members.routes.ts.
 *
 *   2. GET /api/superadmin/admin/permissions/stats
 *      PermissionsMatrixService queried role_permissions.role_id / .enabled —
 *      the live table has (id, role, permission_key, description, created_at),
 *      no `enabled` column (row presence IS enabled — same convention already
 *      used by ToolController/AssessmentController role_permissions seeders).
 *      Fix: server/src/services/permissionsMatrixService.ts rewritten against
 *      the real columns.
 *
 *   3. GET/POST /api/superadmin/compliance/retention-policies
 *      shared.ts wired DataRetentionService to a phantom stub —
 *      `{ getPolicy: async () => ({}) }` — while the controller calls
 *      `getPolicies()` / `createPolicy()`: "... .getPolicies is not a
 *      function". The backing table (data_retention_policies) was also never
 *      created here (legacy migrations 015 / migrations-v2 baseline never
 *      autorun). Fix: new server/src/services/dataRetentionAdminService.ts
 *      wired into shared.ts + additive migration
 *      20260719_red_pmoadmin_data_retention_policies.sql.
 *
 * Real routers + real verifyToken/verifySuperAdmin + real Postgres, zero
 * mocks. Prefix odbior--pmoadm--, cleaned up in afterAll.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--pmoadm--';
const PROJECT_ID = `${PREFIX}project-0001`;
const SA_USER = `${PREFIX}sa`;
const SECRET = process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz';

const MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/migrations/20260719_red_pmoadmin_data_retention_policies.sql'
);

function saToken(): string {
  return jwt.sign(
    {
      id: SA_USER,
      email: `${SA_USER}@acceptance.local`,
      organizationId: SEED.ORG_ID,
      organization_id: SEED.ORG_ID,
      role: 'superadmin',
      isSuperAdmin: true,
    },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

let token: string;
let pmApp: Express;
let saApp: Express;
let memberId: string | undefined;

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM project_members WHERE project_id = $1`, [PROJECT_ID]).catch(() => {});
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => {});
    await c.query(`DELETE FROM data_retention_policies WHERE data_type LIKE $1`, [`${PREFIX}%`]).catch(() => {});
    await c.query(`DELETE FROM organization_members WHERE user_id = $1`, [SA_USER]).catch(() => {});
    await c.query(`DELETE FROM users WHERE id = $1`, [SA_USER]).catch(() => {});
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();

  const c = pgClient();
  await c.connect();
  try {
    // Additive, idempotent — mirrors the autorun on demo boot.
    await c.query(readFileSync(MIGRATION, 'utf8'));

    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,$3,'active',$4,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'PmoAdmin Regression Project', SEED.USER_ID]
    );

    const now = new Date().toISOString();
    await c.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'superadmin', 'active', 'PmoAdmin', 'SA', $4)
       ON CONFLICT (id) DO UPDATE SET role = 'superadmin'`,
      [SA_USER, SEED.ORG_ID, `${SA_USER}@acceptance.local`, now]
    );
    await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $1, $2, $3, 'OWNER', 'ACTIVE', $4
       WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$2 AND user_id=$3)`,
      [`${SA_USER}--mem`, SEED.ORG_ID, SA_USER, now]
    );
  } finally {
    await c.end();
  }

  token = mintToken();

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const projectMembers = (await import('../../server/src/routes/pmo/project-members.routes.js'))
    .default;
  const superAdminRoutes = (await import('../../server/src/routes/superadmin.routes.js')).default;

  pmApp = express();
  pmApp.use(express.json({ limit: '5mb' }));
  pmApp.use('/api/pmo/project-members', projectMembers);

  saApp = express();
  saApp.use(express.json({ limit: '5mb' }));
  // superadmin.routes applies verifySuperAdmin per-route internally; verifyToken populates req.user first.
  saApp.use('/api/superadmin', verifyToken as any, superAdminRoutes);
}, 60_000);

afterAll(cleanup);

describe('RED-G / RED-D W5-W6: pmo/admin schema-drift regressions (fixed)', () => {
  it('GET /pmo/project-members/:projectId is not 503 (was masked 42703: pm.role/pm.joined_at missing)', async () => {
    const res = await request(pmApp)
      .get(`/api/pmo/project-members/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /pmo/project-members/:projectId inserts against project_role/added_by_id/created_at (201)', async () => {
    const res = await request(pmApp)
      .post(`/api/pmo/project-members/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID, role: 'LEAD' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    memberId = res.body.id;
  });

  it('GET reflects the added member with aliased role/joined_at keys', async () => {
    const res = await request(pmApp)
      .get(`/api/pmo/project-members/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const row = res.body.find((m: any) => m.user_id === SEED.USER_ID);
    expect(row).toBeTruthy();
    expect(row.role).toBe('LEAD');
    expect(row.joined_at).toBeTruthy();
  });

  it('PUT updates project_role via the `role` field (200)', async () => {
    expect(memberId).toBeTruthy();
    const res = await request(pmApp)
      .put(`/api/pmo/project-members/${PROJECT_ID}/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MANAGER' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE removes the member (200)', async () => {
    expect(memberId).toBeTruthy();
    const res = await request(pmApp)
      .delete(`/api/pmo/project-members/${PROJECT_ID}/${memberId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /superadmin/admin/permissions/stats is not 500 (was 42703: role_permissions.role_id/.enabled missing)', async () => {
    const res = await request(saApp)
      .get('/api/superadmin/admin/permissions/stats')
      .set('Authorization', `Bearer ${saToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('role_count');
    expect(res.body).toHaveProperty('total_permissions');
  });

  it('GET /superadmin/compliance/retention-policies is not 500 (was: DataRetentionService.getPolicies is not a function)', async () => {
    const res = await request(saApp)
      .get('/api/superadmin/compliance/retention-policies')
      .set('Authorization', `Bearer ${saToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /superadmin/compliance/retention-policies creates a policy row (exercises the new table)', async () => {
    const res = await request(saApp)
      .post('/api/superadmin/compliance/retention-policies')
      .set('Authorization', `Bearer ${saToken()}`)
      .send({
        organizationId: SEED.ORG_ID,
        dataType: `${PREFIX}audit-log`,
        retentionDays: 90,
      });
    expect(res.status).toBeLessThan(300);
    expect(res.body.dataType).toBe(`${PREFIX}audit-log`);

    const list = await request(saApp)
      .get(`/api/superadmin/compliance/retention-policies?organizationId=${SEED.ORG_ID}`)
      .set('Authorization', `Bearer ${saToken()}`);
    expect(list.status).toBe(200);
    expect(list.body.some((p: any) => p.data_type === `${PREFIX}audit-log`)).toBe(true);
  });
});
