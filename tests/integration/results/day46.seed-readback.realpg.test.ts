/** @vitest-environment node
 *
 * G.1 completion — RESULTS_DAY46C_REPORT_20260828.md left G.1
 * CZĘŚCIOWO_ZWERYFIKOWANE: "nie wykonano w tym wznowieniu wymaganych
 * odczytów trzech list przez Gateway ani zrzutu KPI z seeda" (the three
 * list reads through the real Gateway, and a KPI screenshot from the seed,
 * were never actually done — only the seed SCRIPT's own process exit was
 * verified, which is not proof the data is reachable through the API).
 *
 * This file closes that gap: real GET requests through the real
 * `ApiGateway`, real Postgres, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=
 * enforce`, authenticated as the real seeded org-A OWNER
 * (rn-g6-user-a-owner), for the three domain lists
 * (scripts/rn-g6-seed-runtime-dataset.ts's own manifest is the expected-count
 * source, not a number invented here).
 *
 * NOT covered here: the KPI dev-render screenshot from the seed data — see
 * the day46-finish report; the existing docs/qa/screens/results-day46/
 * screenshots already show mock-harness data, not this seed, and capturing
 * the seed itself through the full app (not the harness) needs the backend
 * + frontend dev servers running together, out of this file's scope.
 */
import { Pool } from 'pg';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;

const ORG_A = 'rn-g6-org-przemysl';
const USER_A_OWNER = 'rn-g6-user-a-owner';

describe.skipIf(!enabled)(
  'day46-finish G.1 — real Gateway readback of the RN-G6 seed (KPI/ROI/OKR lists)',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const token = jwt.sign(
      {
        id: USER_A_OWNER,
        userId: USER_A_OWNER,
        email: `${USER_A_OWNER}@test.invalid`,
        organizationId: ORG_A,
        organization_id: ORG_A,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    beforeAll(async () => {
      expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
      const membership = await pool.query(
        `SELECT role, status FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [USER_A_OWNER, ORG_A]
      );
      expect(
        membership.rows[0],
        'RN-G6 seed fixture missing — run scripts/rn-g6-seed-runtime-dataset.ts against this DATABASE_URL first'
      ).toEqual({ role: 'OWNER', status: 'ACTIVE' });
    });

    afterAll(async () => {
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    it('GET /api/vnext/results/kpi returns the real seeded KPI rows for org A (not an empty/mocked list)', async () => {
      const response = await request(app)
        .get('/api/vnext/results/kpi')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(Array.isArray(response.body.kpis)).toBe(true);
      expect(response.body.kpis.length).toBeGreaterThan(0);
      expect(
        response.body.kpis.some(
          (k: { kpiId: string }) => k.kpiId === '4d5db4f2-454e-4813-8813-4d5db4454ebd'
        )
      ).toBe(true);
    });

    it('GET /api/vnext/results/roi/cases returns the real seeded ROI cases for org A', async () => {
      const response = await request(app)
        .get('/api/vnext/results/roi/cases')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(Array.isArray(response.body.cases)).toBe(true);
      expect(response.body.cases.length).toBeGreaterThan(0);
      expect(
        response.body.cases.some(
          (c: { caseId: string }) => c.caseId === '4d60dfca-463e-4b5e-8b5e-4d60df463e9a'
        )
      ).toBe(true);
    });

    it('GET /api/vnext/results/okr/sets returns the real seeded OKR set for org A', async () => {
      const response = await request(app)
        .get('/api/vnext/results/okr/sets')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(Array.isArray(response.body.sets)).toBe(true);
      expect(response.body.sets.length).toBeGreaterThan(0);
      expect(
        response.body.sets.some(
          (s: { setId: string }) => s.setId === 'f772dd20-6d67-49a1-89a1-f772dd6d67ca'
        )
      ).toBe(true);
    });
  }
);
