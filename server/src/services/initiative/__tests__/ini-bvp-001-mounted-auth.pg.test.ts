/** INI-BVP-001 — mounted JWT/membership/tenant/cold proof on real PostgreSQL. */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('INI-BVP-001 mounted candidate acceptance (real PostgreSQL)', () => {
  const suffix = randomUUID();
  const id = (part: string) => `codex_ini_bvp_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const ownerA = id('owner_a');
  const ownerB = id('owner_b');
  const staleA = id('stale_a');
  const candidate = id('candidate');
  const staleCandidate = id('stale_candidate');
  let pool: Pool;
  let app: express.Express;
  let ownerAToken = '';
  let ownerBToken = '';
  let staleToken = '';

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const org of [orgA, orgB]) await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
    for (const [user, org, status] of [[ownerA, orgA, 'ACTIVE'], [ownerB, orgB, 'ACTIVE'], [staleA, orgA, 'INACTIVE']]) {
      await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`, [user, org, `${user}@example.test`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER',$4)`, [id(`member_${user}`), org, user, status]);
    }
    for (const candidateId of [candidate, staleCandidate]) {
      await pool.query(
        `INSERT INTO initiative_candidates(id,organization_id,source_type,source_id,title,rationale,fit_score,status,created_by)
         VALUES($1,$2,'mounted-test',$3,$4,'bounded proof',0.8,'pending',$5)`,
        [candidateId, orgA, id(`source_${candidateId}`), `Mounted ${candidateId}`, ownerA]
      );
    }
    const { default: config } = await import('../../../config/Config.js');
    const sign = (user: string, org: string) => jwt.sign({ id: user, organizationId: org, role: 'OWNER', email: `${user}@example.test` }, config.JWT_SECRET, { expiresIn: '10m' });
    ownerAToken = sign(ownerA, orgA);
    ownerBToken = sign(ownerB, orgB);
    staleToken = sign(staleA, orgA);
    const { default: router } = await import('../../../routes/initiativeCandidates.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', router);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM initiative_candidates WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('concurrent mounted acceptance converges to one Initiative and stable receipt', async () => {
    const accept = () => request(app).post(`/api/initiatives/candidates/${candidate}/accept`).set(auth(ownerAToken)).send({ fill: false });
    const [a, b] = await Promise.all([accept(), accept()]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.initiativeId).toBe(b.body.initiativeId);
    const rows = await pool.query(`SELECT id FROM initiatives WHERE organization_id=$1 AND id=$2`, [orgA, a.body.initiativeId]);
    expect(rows.rows).toHaveLength(1);
  });

  it('denies foreign tenant and stale membership through mounted auth', async () => {
    const foreign = await request(app).post(`/api/initiatives/candidates/${staleCandidate}/accept`).set(auth(ownerBToken)).send({ fill: false });
    expect(foreign.status).toBe(404);
    const stale = await request(app).post(`/api/initiatives/candidates/${staleCandidate}/accept`).set(auth(staleToken)).send({ fill: false });
    expect(stale.status).toBe(403);
    expect(stale.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('cold connection reopens one accepted candidate and one Initiative', async () => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const row = await cold.query(
      `SELECT c.status,c.initiative_id,count(i.id)::int AS initiative_count
         FROM initiative_candidates c LEFT JOIN initiatives i ON i.id=c.initiative_id AND i.organization_id=c.organization_id
        WHERE c.id=$1 AND c.organization_id=$2 GROUP BY c.status,c.initiative_id`,
      [candidate, orgA]
    );
    await cold.end();
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({ status: 'accepted', initiative_count: 1 });
  });
});
