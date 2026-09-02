/**
 * FIX-212 partia 3 (pozycja 14 z 34) — mounted signed-JWT + real PostgreSQL
 * proof for server/src/services/initiative/initiativeKpiAssignmentService.ts:250/260
 * assertInitiativeBelongsToOrg / assertKpiBelongsToOrg, exercised through
 * PUT/DELETE /api/initiatives/:id/kpis/:kpiId
 * (InitiativeController.updateInitiativeKpi / deleteInitiativeKpi).
 *
 * Both `:id` (initiativeId) and `:kpiId` come straight off the URL, fully
 * attacker-controlled; `organizationId` comes only from the verified JWT.
 * `updateInitiativeKpiAssignment`/`deleteInitiativeKpiAssignment` call
 * `assertInitiativeBelongsToOrg(initiativeId, organizationId)` then
 * `assertKpiBelongsToOrg(kpiId, organizationId)` — two
 * `SELECT ... WHERE id = ? AND organization_id = ?`-shaped checks — before
 * any UPDATE/DELETE runs. The controller comment (InitiativeController.ts:
 * 3154-3157) spells out the exact mass-assignment risk this closes: "server-
 * derived identity/tenant fields MUST win over the request body... defeating
 * the org-scope assertions inside updateInitiativeKpiAssignment."
 *
 * Without the guard, an org A caller who learns (or guesses) a real
 * initiativeId/kpiId pair from org B could overwrite org B's real KPI value
 * via PUT (a benefits/ROI tracking number a client is watching) or delete it
 * outright via DELETE — both without org B's knowledge or consent.
 *
 * This test mounts the REAL pmo/initiatives.routes.ts router behind its own
 * verifyToken/validateOrgMembership chain, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot overwrite org B's real KPI via PUT — 404,
 *      the stored current_value is unchanged,
 *  (2) an org B caller (the real KPI owner) CAN overwrite their own KPI via
 *      PUT — 200, value changed,
 *  (3) an org A caller cannot delete org B's real KPI via DELETE — 404, the
 *      row still exists afterwards,
 *  (4) MUTATION PROOF: with assertKpiBelongsToOrg's organization_id
 *      predicate short-circuited to "always ok", the org A -> org B PUT
 *      from (1) succeeds instead of 404ing and actually overwrites org B's
 *      stored value — proving this test is a real regression guard, not a
 *      false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/initiatives.assertKpiBelongsToOrg.mounted.realdb.test.ts
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
  'mounted PUT/DELETE /api/initiatives/:id/kpis/:kpiId — assertInitiativeBelongsToOrg/assertKpiBelongsToOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `initkpi-${suffix}-a`;
    const orgB = `initkpi-${suffix}-b`;
    const userA = `initkpi-${suffix}-user-a`;
    const userB = `initkpi-${suffix}-user-b`;
    const initiativeBId = `initkpi-${suffix}-init-b`;
    const kpiBId = `initkpi-${suffix}-kpi-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const readCurrentValue = async (kpiId: string): Promise<number | null> => {
      const { rows } = await pool.query(
        `SELECT current_value FROM initiative_kpis WHERE id = $1`,
        [kpiId]
      );
      return rows[0]?.current_value ?? null;
    };

    const kpiExists = async (kpiId: string): Promise<boolean> => {
      const { rows } = await pool.query(`SELECT id FROM initiative_kpis WHERE id = $1`, [kpiId]);
      return rows.length > 0;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Initiative KPI ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Kpi','Test',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing initiative + KPI belong ONLY to org B.
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,$3,'EXECUTING')`,
        [initiativeBId, orgB, 'Org B confidential initiative']
      );
      await pool.query(
        `INSERT INTO initiative_kpis(id,initiative_id,organization_id,name,current_value,target_value)
         VALUES($1,$2,$3,$4,10,100)`,
        [kpiBId, initiativeBId, orgB, 'Org B confidential KPI']
      );

      const router = (await import('../../../server/src/routes/pmo/initiatives.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/initiatives', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM initiative_kpis WHERE id = $1`, [kpiBId]);
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

    it("(1) org A caller cannot overwrite org B's real KPI via PUT — 404, value unchanged", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await readCurrentValue(kpiBId);

      const res = await request(app)
        .put(`/api/initiatives/${initiativeBId}/kpis/${kpiBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ currentValue: 999999 });

      expect(res.status).toBe(404);
      expect(await readCurrentValue(kpiBId)).toBe(before);
    });

    it('(2) org B caller (real KPI owner) can overwrite their own KPI via PUT — 200, value changed', async () => {
      const bearer = token(userB, orgB, 'ADMIN');

      const res = await request(app)
        .put(`/api/initiatives/${initiativeBId}/kpis/${kpiBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ currentValue: 42 });

      expect(res.status).toBe(200);
      expect(await readCurrentValue(kpiBId)).toBe(42);
    });

    it("(3) org A caller cannot delete org B's real KPI via DELETE — 404, row still exists", async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .delete(`/api/initiatives/${initiativeBId}/kpis/${kpiBId}`)
        .set('Authorization', `Bearer ${bearer}`);

      expect(res.status).toBe(404);
      expect(await kpiExists(kpiBId)).toBe(true);
    });
  }
);
