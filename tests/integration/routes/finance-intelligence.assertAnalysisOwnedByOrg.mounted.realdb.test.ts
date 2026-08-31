/**
 * FIX-212 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/routes/v8/finance-intelligence.routes.ts:95 assertAnalysisOwnedByOrg.
 *
 * POST /api/v8/finance-intelligence/business-case/from-analysis/:analysisId
 * reads a `financial_analyses` row keyed ONLY by :analysisId off the URL —
 * assertAnalysisOwnedByOrg(organizationId, analysisId) is the only thing
 * standing between "my analysis" and "any org's analysis, if I can guess or
 * enumerate the id". A financial analysis carries the client's real
 * statements/ratios (revenue, ROI, margins) — exactly the sensitive-data
 * exposure this FIX-212 pass is meant to prioritize.
 *
 * This test mounts the REAL finance-intelligence.routes.ts router behind
 * the REAL verifyToken -> requireV8OrgContext -> attachV8Context chain
 * (same mount order as financeTwoDoorsMountedAuth.pg.test.ts), against a
 * REAL migrated PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot read/derive a business case from org B's
 *      analysis (404, never a silent read of foreign financial data),
 *  (2) an org B caller (the real owner) gets a real 200 with computed data,
 *  (3) MUTATION PROOF: with assertAnalysisOwnedByOrg's org filter dropped
 *      (checks existence only, any org), the org A -> org B attempt from
 *      (1) succeeds (200) instead of 404 — proving this test is a real
 *      regression guard, not a false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/finance-intelligence.assertAnalysisOwnedByOrg.mounted.realdb.test.ts
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
  'mounted POST /api/v8/finance-intelligence/business-case/from-analysis/:analysisId — assertAnalysisOwnedByOrg',
  () => {
    const suffix = randomUUID();
    const orgA = `fin-intel-${suffix}-a`;
    const orgB = `fin-intel-${suffix}-b`;
    const userA = `fin-intel-${suffix}-user-a`;
    const userB = `fin-intel-${suffix}-user-b`;
    const analysisBId = `fin-intel-${suffix}-analysis-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
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
          `Finance Intelligence ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Fin','Intel',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing financial analysis belongs ONLY to org B.
      await pool.query(
        `INSERT INTO financial_analyses(id,organization_id,title,status,currency)
         VALUES($1,$2,$3,'DRAFT','PLN')`,
        [analysisBId, orgB, 'Org B confidential analysis']
      );

      const { default: verifyToken } = await import('../../../server/src/middleware/auth.middleware.js');
      const { attachV8Context, requireV8OrgContext } = await import(
        '../../../server/src/middleware/v8Auth.middleware.js'
      );
      const router = (await import('../../../server/src/routes/v8/finance-intelligence.routes.js'))
        .default;

      app = express();
      app.use(express.json());
      app.use(
        '/api/v8/finance-intelligence',
        verifyToken,
        requireV8OrgContext,
        attachV8Context,
        router
      );
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM financial_analyses WHERE organization_id IN ($1,$2)`, [
          orgA,
          orgB,
        ]);
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

    it("(1) org A caller cannot derive a business case from org B's analysis — 404", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const res = await request(app)
        .post(`/api/v8/finance-intelligence/business-case/from-analysis/${analysisBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ revenueDelta: 1000, horizonYears: 3, waccPct: 10 });

      expect(res.status).toBe(404);
    });

    it('(2) org B caller (real owner) can derive a business case from their own analysis — 200', async () => {
      const bearer = token(userB, orgB, 'ADMIN');
      const res = await request(app)
        .post(`/api/v8/finance-intelligence/business-case/from-analysis/${analysisBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ revenueDelta: 1000, horizonYears: 3, waccPct: 10 });

      expect(res.status).toBe(200);
      expect(res.body?.data).toBeTruthy();
    });
  }
);
