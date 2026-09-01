/**
 * FIX-200 (dyżur 200-b) — realny dowód HTTP dla `DriverTreePanel.tsx`
 * (`src/components/Economics/panels/DriverTreePanel.tsx`), jednego z 14
 * paneli dopiętych do zrzutów w tym dyżurze. Panel woła
 * `postDriverTreeEvaluate` (`src/services/api/v8/financePlanning.ts`) →
 * `POST /api/v8/finance-planning/driver-tree/evaluate`.
 *
 * Różnica wobec `financePlanning.membershipGate.pg.test.ts` (ten sam route
 * file, sąsiedni katalog): TAM auth jest ZASTĄPIONA stubem `req.v8Context`
 * (celowo — ten plik dowodzi że finance-planning nie ma writerów, nie że
 * auth działa). TU celem jest dowód przez REALNY stos Gateway.ts:
 * `app.use('/api/v8', v8FeatureGate, v8Router)` — te same dwa obiekty,
 * w tej samej kolejności, co produkcyjny `Gateway.ts:1481-1482` — więc
 * REALNY `verifyToken` (podpisany JWT, wyszukanie usera w Postgres),
 * REALNY `requireV8OrgContext`, REALNY `v8OrgGate` (organizacja bez
 * jawnych wierszy `v8_feature_flags` — fallback "allow" poza produkcją,
 * ten sam mechanizm co w day171), i `ENABLE_V8_GLOBAL=true` ustawione w
 * `beforeAll`, nie ominięte.
 *
 * RUN (z korzenia worktree):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6141/consultify_fix200 \
 *   npx vitest run --retry=0 --no-file-parallelism \
 *     server/src/routes/v8/__tests__/day200.driver-tree-evaluate.pg.test.ts
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
    '[day200.driver-tree-evaluate.pg.test] Refusing to proceed: requires RUN_DB_TESTS=1, ' +
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
    `[day200.driver-tree-evaluate.pg.test] JWT_SECRET must be exactly "${CANONICAL_JWT_SECRET}" ` +
      '(same canonical vitest secret every other V8 finance mounted-auth suite in this repo uses).'
  );
}

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

const SUITE_LOCK_NAME = 'day200-driver-tree-evaluate-real-gateway';
const prefix = `day200dt-${randomUUID().slice(0, 8)}`;
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
  'day200: DriverTreePanel — POST /driver-tree/evaluate on the real Gateway V8 stack (real Postgres)',
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

    it('returns 401 without a token (proves auth is the REAL verifyToken, not a stub)', async () => {
      const res = await request(app)
        .post('/api/v8/finance-planning/driver-tree/evaluate')
        .send({ nodes: [] });
      expect(res.status).toBe(401);
    });

    it('returns 200 with the exact node/formula shape DriverTreePanel.tsx sends, and computes the real value', async () => {
      // Mirrors DriverTreePanel.tsx DEFAULT_ROWS exactly: Customers(input) ×
      // ARPU(input) -> Revenue(formula, op='*'). Same shape the panel's
      // `postDriverTreeEvaluate` call sends when the user clicks "Evaluate".
      const res = await request(app)
        .post('/api/v8/finance-planning/driver-tree/evaluate')
        .set(bearer(userId, org))
        .send({
          nodes: [
            { id: 'customers', label: 'Customers', kind: 'input', value: 1000 },
            { id: 'arpu', label: 'ARPU', kind: 'input', value: 120 },
            {
              id: 'revenue',
              label: 'Revenue',
              kind: 'formula',
              operands: ['customers', 'arpu'],
              op: '*',
            },
          ],
        });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      // Exact contract DriverTreePanel.tsx consumes: `{ values: Record<string,
      // number>, order: string[] }` (DriverTreeEvaluateResponse).
      expect(res.body?.data?.values).toEqual({ customers: 1000, arpu: 120, revenue: 120_000 });
      expect(res.body?.data?.order).toEqual(
        expect.arrayContaining(['customers', 'arpu', 'revenue'])
      );
      // The value the panel would actually render is not NaN/undefined.
      expect(Number.isFinite(res.body.data.values.revenue)).toBe(true);
    });

    it('a cyclic tree returns 400 DRIVER_TREE_CYCLE, not a silent 200 (proves the REAL engine runs, not a mock)', async () => {
      const res = await request(app)
        .post('/api/v8/finance-planning/driver-tree/evaluate')
        .set(bearer(userId, org))
        .send({
          nodes: [
            { id: 'a', label: 'A', kind: 'formula', operands: ['b'], op: '+' },
            { id: 'b', label: 'B', kind: 'formula', operands: ['a'], op: '+' },
          ],
        });
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body?.code).toBe('DRIVER_TREE_CYCLE');
    });
  }
);
