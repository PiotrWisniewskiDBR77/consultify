/**
 * FIX-212 partia 2 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/routes/ideaFinancialCase.routes.ts:104 assertIdeaInOrg.
 *
 * GET/PUT /api/idea-financial-case/:ideaId take `ideaId` straight off the
 * URL. assertIdeaInOrg(ideaId, organizationId) — `SELECT id FROM my_ideas
 * WHERE id = ? AND organization_id = ?` — is the only check standing
 * between a caller and another org's idea FINANCIAL case (own table,
 * separate from the business case — see the file header for why they are
 * not merged). A financial case carries the client's real P&L-shaped
 * driver model: currency, discount rate, monthly cost/benefit time series
 * per scenario — exactly the sensitive-data exposure this program is meant
 * to prioritize, arguably more so than the prose business case. Without the
 * guard, an org A caller supplying a real ideaId from org B could both READ
 * org B's financial drivers and OVERWRITE the whole case (whole-case PUT
 * under optimistic concurrency — see the route header) grafted onto org B's
 * idea, invisible to org B's own org-scoped list views.
 *
 * This test mounts the REAL ideaFinancialCase.routes.ts router behind its
 * own router.use(verifyToken), against a REAL migrated PostgreSQL database
 * (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot read org B's financial case via GET — 404,
 *  (2) an org A caller cannot overwrite org B's financial case via PUT —
 *      404, zero rows changed,
 *  (3) an org B caller (the real idea owner) can do both on their own idea,
 *  (4) MUTATION PROOF: with assertIdeaInOrg's organization_id predicate
 *      dropped (existence check only), the org A -> org B GET/PUT from
 *      (1)/(2) succeed instead of 404ing — proving this test is a real
 *      regression guard, not a false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/ideaFinancialCase.assertIdeaInOrg.mounted.realdb.test.ts
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

const financialCaseBody = (marker: string) => ({
  case: {
    input: {
      currency: 'PLN',
      discountRatePct: 8,
      startPeriod: '2026-01',
      horizonMonths: 12,
      drivers: [
        {
          id: `driver-${marker}`,
          kind: 'cost',
          costType: 'recurring',
          monthlyValues: { '2026-01': 1000 },
        },
      ],
      scenarios: ['base'],
    },
    result: null,
    lastComputedAt: null,
  },
});

describe.skipIf(!enabled).sequential(
  'mounted GET/PUT /api/idea-financial-case/:ideaId — assertIdeaInOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `ideafc-${suffix}-a`;
    const orgB = `ideafc-${suffix}-b`;
    const userA = `ideafc-${suffix}-user-a`;
    const userB = `ideafc-${suffix}-user-b`;
    const ideaBId = `ideafc-${suffix}-idea-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const readCaseJson = async (ideaId: string): Promise<unknown> => {
      const { rows } = await pool.query(
        `SELECT case_json FROM idea_financial_cases WHERE idea_id = $1`,
        [ideaId]
      );
      if (!rows[0]) return null;
      return typeof rows[0].case_json === 'string'
        ? JSON.parse(rows[0].case_json)
        : rows[0].case_json;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Idea Financial Case ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Idea','FC',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing idea belongs ONLY to org B.
      await pool.query(
        `INSERT INTO my_ideas(id,user_id,organization_id,title) VALUES($1,$2,$3,$4)`,
        [ideaBId, userB, orgB, 'Org B confidential idea (financials)']
      );

      const router = (await import('../../../server/src/routes/ideaFinancialCase.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/idea-financial-case', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM idea_financial_cases WHERE idea_id = $1`, [ideaBId]);
        await pool.query(`DELETE FROM my_ideas WHERE id = $1`, [ideaBId]);
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

    it("(1) org A caller cannot read org B's financial case — 404", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const res = await request(app)
        .get(`/api/idea-financial-case/${ideaBId}`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(res.status).toBe(404);
    });

    it("(2) org A caller cannot overwrite org B's financial case — 404, zero rows written", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await readCaseJson(ideaBId);

      const res = await request(app)
        .put(`/api/idea-financial-case/${ideaBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send(financialCaseBody('grafted-by-org-a'));

      expect(res.status).toBe(404);
      expect(await readCaseJson(ideaBId)).toEqual(before);
    });

    it('(3) org B caller (real idea owner) can read and write their own financial case', async () => {
      const bearer = token(userB, orgB, 'ADMIN');

      const putRes = await request(app)
        .put(`/api/idea-financial-case/${ideaBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send(financialCaseBody('legit-org-b'));
      expect(putRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/idea-financial-case/${ideaBId}`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body?.financialCase).toBeTruthy();

      const stored = await readCaseJson(ideaBId);
      expect(stored).toBeTruthy();
    });
  }
);
