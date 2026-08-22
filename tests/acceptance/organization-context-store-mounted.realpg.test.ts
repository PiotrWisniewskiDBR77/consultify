/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  throw new Error('Organization context mounted proof requires a disposable local PostgreSQL DB');
}

const JWT_SECRET = 'organization-context-mounted-proof-secret-32-characters';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const runId = `org-context-${Date.now()}-${randomUUID().slice(0, 8)}`;
const orgA = `${runId}-org-a`;
const orgB = `${runId}-org-b`;
const userA = `${runId}-user-a`;
const userB = `${runId}-user-b`;
const pool = new Pool({ connectionString: DATABASE_URL });

const token = (id: string, organizationId: string) =>
  jwt.sign({ id, organizationId, email: `${id}@example.test`, role: 'ADMIN' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
const auth = (id: string, organizationId: string) => ({
  Authorization: `Bearer ${token(id, organizationId)}`,
});

describe('Organization context store mounted auth + PostgreSQL persistence', () => {
  let app: express.Express;

  beforeAll(async () => {
    const now = new Date().toISOString();
    for (const [orgId, userId] of [
      [orgA, userA],
      [orgB, userB],
    ]) {
      await pool.query(
        `INSERT INTO organizations (id,name,plan,status,is_active,created_at)
         VALUES ($1,$2,'enterprise','active',1,$3)`,
        [orgId, orgId, now]
      );
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,created_at)
         VALUES ($1,$2,$3,'not-used','ADMIN','active',$4)`,
        [userId, orgId, `${userId}@example.test`, now]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
         VALUES ($1,$2,$3,'ADMIN','ACTIVE',$4)`,
        [`${runId}-member-${userId}`, orgId, userId, now]
      );
    }
    await pool.query(
      `INSERT INTO organization_context_store
       (organization_id,goals_json,challenges_json,synthesis_json,company_profile_json,updated_by)
       VALUES ($1,'{}','{}','{}',$2::jsonb,$3)`,
      [orgA, JSON.stringify({ companyName: 'Legacy must survive', industry: 'Legacy' }), userA]
    );

    const routes = (await import('../../server/src/routes/organization-context-store.routes.js'))
      .default;
    app = express();
    app.use(express.json());
    app.use('/api/organization-context-store', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM organization_context_store WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('mounts real auth, isolates organizations and proves PUT -> cold GET versioned readback', async () => {
    expect((await request(app).get('/api/organization-context-store')).status).toBe(401);

    const payload = {
      goals: { primaryObjective: 'Grow recurring revenue' },
      challenges: { declaredChallenges: [{ id: 'c1', text: 'Capacity' }] },
      synthesis: { selectedScenarioId: 'balanced' },
      companyProfile: { companyName: 'Attempted competing writer' },
    };
    const put = await request(app)
      .put('/api/organization-context-store')
      .set(auth(userA, orgA))
      .send(payload);
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body).toMatchObject({ ok: true, companyProfileOwnership: 'organization_profiles' });
    expect(put.body.version).toBeTruthy();

    const cold = await request(app).get('/api/organization-context-store').set(auth(userA, orgA));
    expect(cold.status).toBe(200);
    expect(cold.body).toMatchObject({
      goals: payload.goals,
      challenges: payload.challenges,
      synthesis: payload.synthesis,
      companyProfile: {},
      companyProfileOwnership: 'organization_profiles',
      version: put.body.version,
    });

    const foreign = await request(app)
      .get('/api/organization-context-store')
      .set(auth(userB, orgB));
    expect(foreign.status).toBe(200);
    expect(foreign.body).toMatchObject({ goals: {}, challenges: {}, synthesis: {}, version: null });

    const stored = await pool.query(
      `SELECT company_profile_json FROM organization_context_store WHERE organization_id=$1`,
      [orgA]
    );
    expect(stored.rows[0].company_profile_json).toEqual({
      companyName: 'Legacy must survive',
      industry: 'Legacy',
    });
  });

  it('returns non-2xx when the durable table is unavailable', async () => {
    await pool.query(
      `ALTER TABLE organization_context_store RENAME TO organization_context_store_proof_failure`
    );
    try {
      const failed = await request(app)
        .put('/api/organization-context-store')
        .set(auth(userA, orgA))
        .send({ goals: { primaryObjective: 'Must not be acknowledged' } });
      expect(failed.status).toBe(500);
      expect(failed.body.error).toBe('Failed to save org context');
    } finally {
      await pool.query(
        `ALTER TABLE organization_context_store_proof_failure RENAME TO organization_context_store`
      );
    }
  });
});
