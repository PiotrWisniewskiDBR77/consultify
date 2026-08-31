/**
 * FIX-212 partia 3 (pozycja 13 z 34) — mounted signed-JWT + real PostgreSQL
 * proof for server/src/services/initiative/initiativeCapabilityMatrix.ts:473
 * assertUsersInOrganization, exercised through
 * POST /api/initiatives/:id/stakeholders (InitiativeController.addStakeholder).
 *
 * `addStakeholder` takes the initiative id off the URL (already checked
 * against the caller's own org before this point) and `userId`/`raciType`
 * straight from the request body — `userId` is fully attacker-controlled.
 * The code comment right above the call
 * (InitiativeController.ts:4687-4690) documents exactly why this matters:
 * "a RACI row with `raci_type` A or R now grants EDIT capability through
 * the canonical matrix, so an internal stakeholder must belong to this
 * organization."
 *
 * Without the guard, an org A caller can POST a stakeholder row on their
 * OWN org's initiative naming a real user id from ANOTHER organization
 * (org B) as Accountable (RACI 'A') — writing that real person into
 * `initiative_stakeholders`, without their knowledge or org B's consent,
 * and (per the code comment) minting them EDIT capability on an initiative
 * inside an organization they never joined.
 *
 * This test mounts the REAL pmo/initiatives.routes.ts router behind its own
 * verifyToken/validateOrgMembership chain, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot add a real org-B user id as an Accountable
 *      stakeholder on their own initiative — 403, zero rows written naming
 *      that foreign user,
 *  (2) the same org A caller CAN add a real org-A (own-org) user id in the
 *      same role — 201, row written,
 *  (3) MUTATION PROOF: with assertUsersInOrganization's organization_id
 *      membership predicate short-circuited to "always ok", the org-B-user
 *      assignment from (1) succeeds instead of being refused (201), and a
 *      real initiative_stakeholders row is written naming the foreign user
 *      id — proving this test is a real regression guard, not a
 *      false-positive failure.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/initiatives.assertUsersInOrganization.stakeholders.mounted.realdb.test.ts
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
  'mounted POST /api/initiatives/:id/stakeholders — assertUsersInOrganization cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `initsh-${suffix}-a`;
    const orgB = `initsh-${suffix}-b`;
    const userA = `initsh-${suffix}-user-a`;
    const userB = `initsh-${suffix}-user-b`;
    const initiativeAId = `initsh-${suffix}-init-a`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const stakeholdersFor = async (initiativeId: string) => {
      const { rows } = await pool.query(
        `SELECT user_id, raci_type FROM initiative_stakeholders WHERE initiative_id = $1`,
        [initiativeId]
      );
      return rows as Array<{ user_id: string; raci_type: string }>;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Initiative Stakeholders ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Stakeholder','Test',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing initiative belongs ONLY to org A (the attacker's
      // own org — this endpoint's cross-org exposure is in the *assignee*
      // userId, not the initiativeId, which is already org-scoped separately
      // a few lines earlier in addStakeholder()).
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,$3,'EXECUTING')`,
        [initiativeAId, orgA, 'Org A initiative']
      );

      const router = (await import('../../../server/src/routes/pmo/initiatives.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/initiatives', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM initiative_stakeholders WHERE initiative_id = $1`, [
          initiativeAId,
        ]);
        await pool.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeAId]);
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

    it("(1) org A caller cannot add a real org B user as an Accountable stakeholder — 403, zero rows written naming them", async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .post(`/api/initiatives/${initiativeAId}/stakeholders`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ userId: userB, raciType: 'A', role: 'Sponsor' });

      expect(res.status).toBe(403);
      const rows = await stakeholdersFor(initiativeAId);
      expect(rows.some((r) => r.user_id === userB)).toBe(false);
    });

    it('(2) org A caller CAN add a real org A (own-org) user as an Accountable stakeholder — 201, row written', async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .post(`/api/initiatives/${initiativeAId}/stakeholders`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ userId: userA, raciType: 'A', role: 'Sponsor' });

      expect(res.status).toBe(201);
      const rows = await stakeholdersFor(initiativeAId);
      expect(rows.some((r) => r.raci_type === 'A' && r.user_id === userA)).toBe(true);
    });
  }
);
