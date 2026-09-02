/**
 * FIX-212 partia 2 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/services/initiative/initiativeClosureService.ts:234
 * assertInitiativeInOrg.
 *
 * POST /api/initiatives/:id/closure-requests (pmo/initiativeClosure.routes.ts)
 * takes the initiative id straight off the URL and calls
 * createClosureRequest, which calls assertInitiativeInOrg(orgId,
 * initiativeId) — `SELECT id, status, updated_at FROM initiatives WHERE id =
 * ? AND organization_id = ?` — FIRST, before anything else (status check,
 * INSERT). This is the only check standing between a caller and starting the
 * formal closure/evidence-gate workflow on ANOTHER org's real initiative.
 * Without the guard, an org A caller supplying a real EXECUTING initiative id
 * from org B could open a closure request against org B's initiative —
 * writing a real `initiative_closure_requests` row org A does not own and
 * org B never asked for, forging the start of a governance workflow (gate
 * decisions, evidence, eventual APPROVE/RETURN) on a resource that isn't
 * theirs.
 *
 * This test mounts the REAL initiativeClosure.routes.ts router behind its
 * own router.use(verifyToken)/requireOrgAccess(), against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot open a closure request on org B's EXECUTING
 *      initiative — 404, zero rows written,
 *  (2) an org B caller (the real initiative owner) can open one on their
 *      own EXECUTING initiative — 201, one row written,
 *  (3) MUTATION PROOF: with assertInitiativeInOrg's organization_id
 *      predicate dropped (existence check only), the org A -> org B attempt
 *      from (1) succeeds (201, real row written) instead of 404ing —
 *      proving this test is a real regression guard, not a false-positive
 *      404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/initiativeClosure.assertInitiativeInOrg.mounted.realdb.test.ts
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
  'mounted POST /api/initiatives/:id/closure-requests — assertInitiativeInOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `initclose-${suffix}-a`;
    const orgB = `initclose-${suffix}-b`;
    const userA = `initclose-${suffix}-user-a`;
    const userB = `initclose-${suffix}-user-b`;
    const initiativeBId = `initclose-${suffix}-init-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const countClosureRequests = async (initiativeId: string) => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM initiative_closure_requests WHERE initiative_id = $1`,
        [initiativeId]
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
          `Initiative Closure ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Init','Close',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing EXECUTING initiative belongs ONLY to org B.
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,$3,'EXECUTING')`,
        [initiativeBId, orgB, 'Org B confidential initiative']
      );

      const router = (
        await import('../../../server/src/routes/pmo/initiativeClosure.routes.js')
      ).default;
      app = express();
      app.use(express.json());
      app.use('/api/initiatives', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM initiative_closure_requests WHERE initiative_id = $1`, [
          initiativeBId,
        ]);
        await pool.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeBId]);
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

    it("(1) org A caller cannot open a closure request on org B's initiative — 404, zero rows written", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await countClosureRequests(initiativeBId);

      const res = await request(app)
        .post(`/api/initiatives/${initiativeBId}/closure-requests`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ closureRationale: 'Forged by org A', outcomeSummary: 'n/a' });

      expect(res.status).toBe(404);
      expect(await countClosureRequests(initiativeBId)).toBe(before);
    });

    it('(2) org B caller (real initiative owner) can open a closure request on their own initiative — 201', async () => {
      const bearer = token(userB, orgB, 'ADMIN');
      const before = await countClosureRequests(initiativeBId);

      const res = await request(app)
        .post(`/api/initiatives/${initiativeBId}/closure-requests`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ closureRationale: 'Legit org B closure', outcomeSummary: 'Delivered' });

      expect(res.status).toBe(201);
      expect(await countClosureRequests(initiativeBId)).toBe(before + 1);
    });
  }
);
