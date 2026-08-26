/**
 * DEC-120 A6 — mounted signed-JWT + real PostgreSQL proof.
 * POST /api/execution/:projectId/gate-check counted blocking decisions and
 * blocked tasks with WHERE clauses that never filtered by organization_id
 * (only initiative_id / project_id). A caller authenticated to org A could
 * pass an initiativeId/projectId that belongs to org B and receive real
 * counts from org B's data — a cross-tenant numeric oracle.
 *
 * Requires a disposable, fully migrated database whose name starts with
 * `consultify_exe_gate_tenant`. Destroy the disposable database after the run.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';

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
  databaseName.startsWith('consultify_exe_gate_tenant');

describe.skipIf(!enabled).sequential('mounted execution gate-check tenant isolation', () => {
  const suffix = randomUUID();
  const orgA = `exe-gate-${suffix}-a`;
  const orgB = `exe-gate-${suffix}-b`;
  const adminA = `exe-gate-${suffix}-admin-a`;
  const adminB = `exe-gate-${suffix}-admin-b`;
  const initiativeA = `exe-gate-${suffix}-initiative-a`;
  const initiativeB = `exe-gate-${suffix}-initiative-b`;
  const projectA = `exe-gate-${suffix}-project-a`;
  const projectB = `exe-gate-${suffix}-project-b`;
  let pool: pg.Pool;
  let app: Express;

  const token = (id: string, organizationId: string, role: string) =>
    jwt.sign(
      { id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });

    for (const [org, label] of [
      [orgA, 'A'],
      [orgB, 'B'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
        org,
        `Execution Gate ${label}`,
      ]);
    }
    for (const [id, org] of [
      [adminA, orgA],
      [adminB, orgB],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
         VALUES($1,$2,$3,'x','ADMIN','active','Execution','Gate',now())`,
        [id, org, `${id}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
        [`mem-${id}`, org, id]
      );
    }
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status) VALUES($1,$2,'Gate Project A','ACTIVE'),($3,$4,'Gate Project B','ACTIVE')`,
      [projectA, orgA, projectB, orgB]
    );
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status)
       VALUES($1,$2,$3,'Gate Initiative A','DRAFT'),($4,$5,$6,'Gate Initiative B','DRAFT')`,
      [initiativeA, orgA, projectA, initiativeB, orgB, projectB]
    );

    // Org B has one BLOCKED task on its initiative, and one blocking pending decision.
    await pool.query(
      `INSERT INTO tasks(id,organization_id,project_id,initiative_id,title,status)
       VALUES($1,$2,$3,$4,'Org B blocked task','BLOCKED')`,
      [`task-${suffix}-b`, orgB, projectB, initiativeB]
    );
    const decisionB = `dec-${suffix}-b`;
    await pool.query(
      `INSERT INTO decisions(id,organization_id,project_id,initiative_id,title,type,decision_maker_id,status,created_by)
       VALUES($1,$2,$3,$4,'Org B blocking decision','GATE',$5,'pending',$5)`,
      [decisionB, orgB, projectB, initiativeB, adminB]
    );
    await pool.query(
      `INSERT INTO decision_impacts(id,decision_id,impacted_type,impacted_id,is_blocker)
       VALUES($1,$2,'initiative',$3,TRUE)`,
      [`di-${suffix}-b`, decisionB, initiativeB]
    );

    // Org A has zero blocked tasks and zero blocking decisions.

    const router = (await import('../../server/src/routes/execution.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/execution', router);
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('never returns org B blocker counts for a caller authenticated to org A', async () => {
    const bearer = token(adminA, orgA, 'ADMIN');
    const res = await request(app)
      .post(`/api/execution/${projectA}/gate-check`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ initiativeId: initiativeB, targetStatus: 'DONE' });

    expect(res.status).toBe(200);
    // Post-fix: org A token + org B initiativeId must not see org B's
    // blocking decision or blocked task. Pre-fix this returned canAdvance:false
    // with 2 errors sourced entirely from org B's rows.
    expect(res.body.canAdvance).toBe(true);
    expect(res.body.errors).toEqual([]);
  });

  it('still reports the real blockers for the owning org', async () => {
    const bearer = token(adminB, orgB, 'ADMIN');
    const res = await request(app)
      .post(`/api/execution/${projectB}/gate-check`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ initiativeId: initiativeB, targetStatus: 'DONE' });

    expect(res.status).toBe(200);
    expect(res.body.canAdvance).toBe(false);
    expect(res.body.errors.length).toBe(2);
  });
});
