/**
 * FIX-200 (dyżur 200-b) — realny dowód HTTP dla `MonteCarloNpvPanel.tsx`
 * (`src/components/Economics/panels/MonteCarloNpvPanel.tsx`) — jeden z 7
 * paneli już dopiętych przez dyżur 135's `finance-value-panels.tsx` harness,
 * wybrany tu jako drugi reprezentatywny panel bo konsumuje inny endpoint
 * (`finance-valuation` zamiast `finance-planning`) i inny kształt danych
 * (rozkład triangularny, nie drzewo formuł). Panel woła
 * `runMonteCarloNpv` (`src/services/financeValuationApi.ts`) →
 * `POST /api/v8/finance-valuation/monte-carlo-npv`.
 *
 * Wzorzec identyczny do `day200.driver-tree-evaluate.pg.test.ts` (patrz ten
 * plik po pełne uzasadnienie): REALNY stos Gateway.ts
 * (`app.use('/api/v8', v8FeatureGate, v8Router)`), REALNY `verifyToken`,
 * REALNY `v8OrgGate`, `ENABLE_V8_GLOBAL=true` ustawione w `beforeAll`.
 *
 * Różnica wobec `financeValuation.membershipGate.pg.test.ts` (ten sam route
 * file): TAMTEN wysyła `drivers: { revenue: 1000, cost: -400 }` — LICZBY, nie
 * obiekty `{kind:'triangular',...}` — więc silnik (`monteCarloNpvService.ts`
 * `driver.kind === 'triangular' ? ... : sampleNormal(driver, ...)`) czyta
 * `driver.mean`/`driver.sd` z liczby (= `undefined`) i cicho produkuje NaN;
 * ten test tego NIE robi, bo tamten sprawdza tylko `simulation` !== undefined
 * (kształt), nie realne liczby. TEN test wysyła DOKŁADNIE kształt, jaki
 * realnie buduje `MonteCarloNpvPanel.tsx` (`kind: 'triangular', min, mode,
 * max` na wiersz + `weights`), i dodatkowo asercją `Number.isFinite` łapie tę
 * klasę cichego NaN, gdyby się pojawiła tutaj.
 *
 * RUN (z korzenia worktree):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6141/consultify_fix200 \
 *   npx vitest run --retry=0 --no-file-parallelism \
 *     server/src/routes/v8/__tests__/day200.monte-carlo-npv.pg.test.ts
 */
/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealDatabase, fromPgPool } from '../../../testing/assertRealDatabase.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(DATABASE_URL) &&
  /localhost|127\.0\.0\.1/.test(DATABASE_URL);

if (!REAL_DB_REQUESTED) {
  throw new Error(
    '[day200.monte-carlo-npv.pg.test] Refusing to proceed: requires RUN_DB_TESTS=1, ' +
      'MOCK_DB=false and a postgres DATABASE_URL on localhost/127.0.0.1. ' +
      `Got RUN_DB_TESTS=${JSON.stringify(process.env.RUN_DB_TESTS ?? null)} ` +
      `MOCK_DB=${JSON.stringify(process.env.MOCK_DB ?? null)} ` +
      `DATABASE_URL=${DATABASE_URL ? '[set]' : '[unset]'}. ` +
      'A suite proving a real 200 through the real Gateway must fail loudly, never skip.'
  );
}

const CANONICAL_JWT_SECRET = 'test-jwt-secret-key-min-32-chars-long-for-validation';
if (process.env.JWT_SECRET !== CANONICAL_JWT_SECRET) {
  throw new Error(
    `[day200.monte-carlo-npv.pg.test] JWT_SECRET must be exactly "${CANONICAL_JWT_SECRET}" ` +
      '(same canonical vitest secret every other V8 finance mounted-auth suite in this repo uses).'
  );
}

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

const SUITE_LOCK_NAME = 'day200-monte-carlo-npv-real-gateway';
const prefix = `day200mc-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const userId = `${prefix}-user`;

function bearer(uid: string, organizationId: string) {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: uid,
        userId: uid,
        email: `${uid}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
        isSuperAdmin: false,
      },
      CANONICAL_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

describe.sequential(
  'day200: MonteCarloNpvPanel — POST /monte-carlo-npv on the real Gateway V8 stack (real Postgres)',
  () => {
    let pool: Pool;
    let lockClient: PoolClient;
    let app: express.Express;
    const originalEnableV8Global = process.env.ENABLE_V8_GLOBAL;

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL });
      await assertRealDatabase(fromPgPool(pool));

      lockClient = await pool.connect();
      await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [SUITE_LOCK_NAME]);

      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$1,'enterprise','active',1,$2)`,
        [org, now]
      );
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,created_at)
       VALUES($1,$2,$3,'x','Piotr','Kontraktowy','ADMIN','active',$4)`,
        [userId, org, `${userId}@test.invalid`, now]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'ADMIN','ACTIVE',$4)`,
        [`${prefix}-membership`, org, userId, now]
      );

      // Real production mount from Gateway.ts:1481 — same two objects, same order.
      process.env.ENABLE_V8_GLOBAL = 'true';
      const { v8FeatureGate } = await import('../../../middleware/v8FeatureGate.middleware.js');
      const v8Router = (await import('../index.js')).default;
      app = express();
      app.use(express.json());
      app.use('/api/v8', v8FeatureGate, v8Router);
    }, 120_000);

    afterAll(async () => {
      if (originalEnableV8Global === undefined) delete process.env.ENABLE_V8_GLOBAL;
      else process.env.ENABLE_V8_GLOBAL = originalEnableV8Global;

      if (!pool) return;
      let cleanupClient: PoolClient | undefined;
      try {
        cleanupClient = await pool.connect();
        await cleanupClient.query('BEGIN');
        await cleanupClient.query(`DELETE FROM organization_members WHERE organization_id=$1`, [
          org,
        ]);
        await cleanupClient.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
        await cleanupClient.query(`DELETE FROM organizations WHERE id=$1`, [org]);
        const residue = await cleanupClient.query(
          `SELECT
           (SELECT count(*)::int FROM organizations WHERE id=$1) +
           (SELECT count(*)::int FROM users WHERE organization_id=$1) +
           (SELECT count(*)::int FROM organization_members WHERE organization_id=$1) AS n`,
          [org]
        );
        expect(residue.rows[0].n, 'residue must be exactly zero BEFORE commit').toBe(0);
        await cleanupClient.query('COMMIT');
      } catch (error) {
        if (cleanupClient) await cleanupClient.query('ROLLBACK');
        throw error;
      } finally {
        cleanupClient?.release();
        if (lockClient) {
          await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [SUITE_LOCK_NAME]);
          lockClient.release();
        }
        await pool.end();
      }
    });

    it('returns 404 V8_DISABLED when ENABLE_V8_GLOBAL is off (proves the gate is REAL, not bypassed)', async () => {
      delete process.env.ENABLE_V8_GLOBAL;
      try {
        const res = await request(app)
          .post('/api/v8/finance-valuation/monte-carlo-npv')
          .set(bearer(userId, org))
          .send({ drivers: {}, iterations: 1 });
        expect(res.status).toBe(404);
        expect(res.body?.code).toBe('V8_DISABLED');
      } finally {
        process.env.ENABLE_V8_GLOBAL = 'true';
      }
    });

    it('returns 200 with the exact triangular-driver shape MonteCarloNpvPanel.tsx sends, deterministic and finite', async () => {
      // Mirrors MonteCarloNpvPanel.tsx's `run()` request exactly: one row ->
      // `{ kind: 'triangular', min, mode, max }` + a linear `weights` map, the
      // same body shape `runMonteCarloNpv` posts when the user clicks "Run
      // simulation". Seeded (seed=42) so the simulation is byte-reproducible.
      const body = {
        drivers: {
          revenue: { kind: 'triangular', min: 800_000, mode: 1_200_000, max: 1_800_000 },
          costs: { kind: 'triangular', min: 400_000, mode: 500_000, max: 650_000 },
        },
        weights: { revenue: 1, costs: -1 },
        intercept: 0,
        iterations: 2000,
        seed: 42,
        bins: 8,
      };

      const res = await request(app)
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .set(bearer(userId, org))
        .send(body);

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      // Exact contract MonteCarloNpvPanel.tsx consumes: `{ simulation: {
      // samples, mean, p10, p50, p90, probPositive, valueAtRisk5 }, histogram:
      // HistogramBin[] }`.
      const { simulation, histogram } = res.body.data;
      expect(Array.isArray(simulation.samples)).toBe(true);
      expect(simulation.samples).toHaveLength(2000);
      for (const key of ['mean', 'p10', 'p50', 'p90', 'probPositive', 'valueAtRisk5'] as const) {
        expect(
          Number.isFinite(simulation[key]),
          `simulation.${key} must be a real finite number, got ${simulation[key]}`
        ).toBe(true);
      }
      expect(simulation.probPositive).toBeGreaterThanOrEqual(0);
      expect(simulation.probPositive).toBeLessThanOrEqual(1);
      expect(Array.isArray(histogram)).toBe(true);
      expect(histogram.length).toBeGreaterThan(0);
      const totalBinned = histogram.reduce(
        (sum: number, bin: { count: number }) => sum + bin.count,
        0
      );
      expect(totalBinned).toBe(2000);

      // Determinism: same seed => same first sample, re-requested.
      const res2 = await request(app)
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .set(bearer(userId, org))
        .send(body);
      expect(res2.body.data.simulation.samples[0]).toBe(simulation.samples[0]);
      expect(res2.body.data.simulation.mean).toBe(simulation.mean);
    });

    it('an empty drivers map returns 400, not a silent 200 (proves the REAL handler validates, not a mock)', async () => {
      const res = await request(app)
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .set(bearer(userId, org))
        .send({ drivers: {} });
      expect(res.status, JSON.stringify(res.body)).toBe(400);
    });
  }
);
