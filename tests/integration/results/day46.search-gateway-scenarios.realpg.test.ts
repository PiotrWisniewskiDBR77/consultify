/** @vitest-environment node
 *
 * D.2 — the five real-Gateway scenarios RESULTS_DAY46C_REPORT_20260828.md
 * flagged as missing for the `resultsSearch` flag's read endpoint
 * (`GET /api/vnext/results/search`, search.routes.ts): hit, empty, q<2,
 * invalid cursor, foreign tenant. All through the REAL `ApiGateway`, real
 * Postgres, with `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` (see
 * day46.gateway-reachability.realpg.test.ts's own header for why this is
 * mandatory — without it the beta envelope is a no-op in NODE_ENV=test).
 *
 * Fixture: the same RN-G6 seed (scripts/rn-g6-seed-runtime-dataset.ts) used
 * by day46.mutator-tenant-isolation.realpg.test.ts (F.2) — org A's real KPI
 * `4d5db4f2-...` has a distinctive Polish title
 * ("Odchylenie budżetu utrzymania ruchu...") already given an `OPEN_ORG`
 * `rvn_platform_resource_visibility` row by the seed's own
 * `seedOpenOrgVisibility` step, so the search repository's visibility CTE
 * (`INNER JOIN rvn_visible_resources`) actually surfaces it — a query
 * against a KPI with no visibility row would silently return zero hits for
 * a reason unrelated to the scenario being tested.
 *
 * NOT covered by this file: screenshots (light/dark/empty) — see the
 * day46-finish report for those, captured separately via the dev-render
 * harness per CLAUDE.md rule 7 (Piotr is never the first visual tester).
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;

const ORG_A = 'rn-g6-org-przemysl';
const ORG_B = 'rn-g6-org-doradztwo';
const USER_A_OWNER = 'rn-g6-user-a-owner';
const USER_B_ADMIN = 'rn-g6-user-b-admin';

// Real, seeded org-A KPI with a real OPEN_ORG visibility row — see file header.
const ORG_A_KPI_TITLE_SUBSTRING = 'budżetu utrzymania';

describe.skipIf(!enabled)(
  'day46-finish D.2 — GET /api/vnext/results/search real-Gateway scenarios',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const tokenFor = (userId: string, organizationId: string) =>
      jwt.sign(
        {
          id: userId,
          userId,
          email: `${userId}@test.invalid`,
          organizationId,
          organization_id: organizationId,
          role: organizationId === ORG_A ? 'OWNER' : 'ADMIN',
        },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );
    const orgAToken = tokenFor(USER_A_OWNER, ORG_A);
    const orgBToken = tokenFor(USER_B_ADMIN, ORG_B);

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
      const visibility = await pool.query(
        `SELECT 1 FROM rvn_platform_resource_visibility WHERE resource_id = $1`,
        ['4d5db4f2-454e-4813-8813-4d5db4454ebd']
      );
      expect(
        visibility.rowCount,
        'seeded KPI has no rvn_platform_resource_visibility row — hit/foreign-tenant scenarios below would be meaningless'
      ).toBeGreaterThan(0);
    });

    afterAll(async () => {
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    it("S1 (hit) — a real query against the caller's own org returns the real KPI", async () => {
      const response = await request(app)
        .get('/api/vnext/results/search')
        .query({ q: ORG_A_KPI_TITLE_SUBSTRING })
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.scopeCompleteness).toBe('FULL');
      expect(
        response.body.results.some(
          (hit: { id: string }) => hit.id === '4d5db4f2-454e-4813-8813-4d5db4454ebd'
        ),
        JSON.stringify(response.body.results)
      ).toBe(true);
    });

    it('S2 (empty) — a real, well-formed query that matches nothing returns an honest empty list, not an error', async () => {
      const response = await request(app)
        .get('/api/vnext/results/search')
        .query({ q: 'zzz-no-such-results-vnext-hit-xyz123' })
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.results).toEqual([]);
      expect(response.body.nextCursor).toBeNull();
    });

    it('S3 (q<2) — a one-character query short-circuits to an empty result WITHOUT querying the domain tables', async () => {
      const response = await request(app)
        .get('/api/vnext/results/search')
        .query({ q: 'a' })
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.results).toEqual([]);
      expect(response.body.scopeCompleteness).toBe('FULL');
      expect(response.body.unavailableKinds).toEqual([]);
    });

    it('S4 (invalid cursor) — a malformed cursor is rejected with a typed 400, not a 500 or a silently-ignored cursor', async () => {
      const response = await request(app)
        .get('/api/vnext/results/search')
        .query({ q: ORG_A_KPI_TITLE_SUBSTRING, cursor: 'not-a-valid-base64url-cursor!!!' })
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(response.body.code).toBe('INVALID_CURSOR');
    });

    it("S5 (foreign tenant) — org B searching org A's exact KPI title gets zero hits, never org A's row", async () => {
      const response = await request(app)
        .get('/api/vnext/results/search')
        .query({ q: ORG_A_KPI_TITLE_SUBSTRING })
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(
        response.body.results.some(
          (hit: { id: string }) => hit.id === '4d5db4f2-454e-4813-8813-4d5db4454ebd'
        ),
        "org B must never see org A's KPI in search results, even by exact-title query: " +
          JSON.stringify(response.body.results)
      ).toBe(false);
    });
  }
);
