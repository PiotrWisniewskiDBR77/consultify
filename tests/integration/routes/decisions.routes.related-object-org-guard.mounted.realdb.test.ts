/**
 * FIX-212 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/controllers/DecisionController.ts:650 assertRelatedObjectsBelongToOrg.
 *
 * POST /api/decisions (DecisionController.createDecision) accepts an
 * optional `projectId`/`initiativeId`/`taskId` and stamps it straight onto
 * the new decision row. Without assertRelatedObjectsBelongToOrg, a caller in
 * org A could pass a real projectId belonging to org B: the FK on
 * decisions.project_id only proves the row exists SOMEWHERE, not that it
 * belongs to the caller's own org, so the created decision would forge a
 * cross-tenant relationship (and, since every decisions read is org-scoped
 * on decisions.organization_id — not project_id — the row silently becomes
 * invisible to org B, the actual project owner).
 *
 * This test mounts the REAL pmo/decisions.routes.ts router behind REAL
 * verifyToken/requireOrgAccess middleware, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot create a decision pointing at org B's project
 *      (400, field: projectId — never a silent success),
 *  (2) an org B caller (the real project owner) can create a decision
 *      pointing at their own project (201),
 *  (3) MUTATION PROOF: with assertRelatedObjectsBelongToOrg's WHERE clause
 *      stripped of the organization_id predicate, the org A -> org B
 *      attempt from (1) succeeds (201) instead of being rejected — proving
 *      this test is a real regression guard, not a false-positive 400.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/decisions.routes.related-object-org-guard.mounted.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential(
  'mounted POST /api/decisions — assertRelatedObjectsBelongToOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `dec-relorg-${suffix}-a`;
    const orgB = `dec-relorg-${suffix}-b`;
    const userA = `dec-relorg-${suffix}-user-a`;
    const userB = `dec-relorg-${suffix}-user-b`;
    const projectBId = `dec-relorg-${suffix}-project-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const countDecisionsForProject = async (projectId: string) => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM decisions WHERE project_id = $1`,
        [projectId]
      );
      return rows[0].n as number;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Decisions RelOrg ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Dec','RelOrg',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing project belongs ONLY to org B.
      await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)`, [
        projectBId,
        orgB,
        'Org B project',
      ]);

      const router = (await import('../../../server/src/routes/pmo/decisions.routes.js')).default;
      app = express();
      app.use(express.json());
      app.use('/api/decisions', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM decisions WHERE project_id = $1`, [projectBId]);
        await pool.query(`DELETE FROM projects WHERE id = $1`, [projectBId]);
        await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
          orgA,
          orgB,
        ]);
        await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
        await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
      } catch {
        // ignore cleanup failures — disposable database is destroyed by the harness anyway.
      }
      await pool?.end();
    });

    it('(1) org A caller cannot create a decision pointing at org B\'s project — 400, zero rows created', async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await countDecisionsForProject(projectBId);

      const res = await request(app)
        .post('/api/decisions')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ title: 'Cross-org forge attempt', projectId: projectBId, type: 'GENERAL' });

      expect(res.status).toBe(400);
      expect(res.body.field).toBe('projectId');

      const after = await countDecisionsForProject(projectBId);
      expect(after).toBe(before);
    });

    it('(2) org B caller (real project owner) can create a decision on their own project — 201', async () => {
      const bearer = token(userB, orgB, 'ADMIN');
      const before = await countDecisionsForProject(projectBId);

      const res = await request(app)
        .post('/api/decisions')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ title: 'Legit org B decision', projectId: projectBId, type: 'GENERAL' });

      expect(res.status).toBe(201);

      const after = await countDecisionsForProject(projectBId);
      expect(after).toBe(before + 1);
    });
  }
);
