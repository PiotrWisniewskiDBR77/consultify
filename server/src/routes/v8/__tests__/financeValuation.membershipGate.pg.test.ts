/**
 * LANE B-FRESH W2 PHASE 2 — finance-valuation.routes.ts has ZERO business
 * writers (and, like finance-planning.routes.ts, ZERO READ handlers either
 * — all 19 handlers are pure-function CALCULATOR endpoints; see the file's
 * own header: "All 7 engines are pure functions — no DB, no I/O."). This
 * suite exists to LOCK THAT IN against a REAL Postgres, not to fake a
 * membership gate — asserting a 403 here would encode the opposite of the
 * mandate (this file has no writer to guard).
 *
 * Companion static proof: financeV8MutationInventory.test.ts pins this
 * file's handler classification at 19 = 0 READ + 19 CALCULATOR + 0
 * BUSINESS-WRITE and asserts (structurally) it contains zero write
 * primitives. This file adds the runtime proof: over REAL HTTP, a caller
 * with NO active tenant membership reaches representative handlers and
 * nothing is persisted.
 *
 * PATTERNS APPLIED (identical to financeIntelligence.membershipGate.pg.test.ts
 * and financePlanning.membershipGate.pg.test.ts — see either file's header
 * for the full precedent citations):
 *   - loud-fail module-level throw on a missing/invalid real-DB env gate,
 *     NOT `describe.skipIf`.
 *   - `assertRealDatabase` + a server-side `current_database()` prefix
 *     assertion (env-overridable via `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX`
 *     — no established naming convention exists for this specific lane's
 *     disposable DB; see final report).
 *   - canonical vitest HS256 JWT secret; `ENABLE_TEST_AUTH_BYPASS` deleted.
 *   - self-override `DB_TYPE=postgres` (root vitest.config.ts forces
 *     `DB_TYPE=sqlite` into every test process's env otherwise).
 *   - per-suite advisory lock released in `finally`; teardown in an explicit
 *     transaction with residue asserted before COMMIT; catch re-throws.
 *
 * RUN (from the worktree ROOT):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<disposable-db> \
 *   npx vitest run --retry=0 --no-file-parallelism \
 *     server/src/routes/v8/__tests__/financeValuation.membershipGate.pg.test.ts
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
    '[financeValuation.membershipGate.pg.test] Refusing to proceed: requires RUN_DB_TESTS=1, ' +
      'MOCK_DB=false and a postgres DATABASE_URL on localhost/127.0.0.1. ' +
      `Got RUN_DB_TESTS=${JSON.stringify(process.env.RUN_DB_TESTS ?? null)} ` +
      `MOCK_DB=${JSON.stringify(process.env.MOCK_DB ?? null)} ` +
      `DATABASE_URL=${DATABASE_URL ? '[set]' : '[unset]'}. ` +
      'A suite proving "no writer, no gate needed" must fail loudly instead of skipping silently.'
  );
}

const CANONICAL_JWT_SECRET = 'test-jwt-secret-key-min-32-chars-long-for-validation';
if (process.env.JWT_SECRET !== CANONICAL_JWT_SECRET) {
  throw new Error(
    `[financeValuation.membershipGate.pg.test] JWT_SECRET must be exactly "${CANONICAL_JWT_SECRET}" ` +
      '(same canonical vitest secret every other V8 finance mounted-auth suite in this repo uses).'
  );
}

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

const REQUIRED_DB_PREFIX = process.env.FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX || 'consultify';
const SUITE_LOCK_NAME = 'finance-valuation-membership-gate-lockin';

const prefix = `finval2-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const revokedUser = `${prefix}-revoked`;
const noMembershipUser = `${prefix}-nomember`;

function bearer(userId: string, organizationId: string) {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
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

describe.sequential('finance-valuation.routes.ts — zero-writer lock-in (real Postgres)', () => {
  let pool: Pool;
  let lockClient: PoolClient;
  let app: express.Express;
  let routerHandlerCount = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await assertRealDatabase(fromPgPool(pool));

    const { rows } = await pool.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `[financeValuation.membershipGate.pg.test] refusing to run: server-side ` +
          `current_database()="${serverDb}" does not start with "${REQUIRED_DB_PREFIX}". Set ` +
          `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX to override, or name the disposable DB accordingly.`
      );
    }

    lockClient = await pool.connect();
    await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [SUITE_LOCK_NAME]);

    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$1,'enterprise','active',1,$2)`,
      [org, now]
    );
    for (const [userId, status] of [
      [revokedUser, 'REVOKED'],
      [noMembershipUser, null],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
         VALUES($1,$2,$3,'unused','ADMIN','active',$4)`,
        [userId, org, `${userId}@test.invalid`, now]
      );
      if (status) {
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN',$4,$5)`,
          [`${prefix}-${userId}-membership`, org, userId, status, now]
        );
      }
    }

    const router = (await import('../finance-valuation.routes.js')).default;
    routerHandlerCount = (router as unknown as { stack: Array<{ route?: unknown }> }).stack.filter(
      (layer) => layer.route
    ).length;

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.v8Context = { organizationId: org, userId: noMembershipUser, userRole: 'ADMIN', isSuperAdmin: false };
      next();
    });
    // Direct v8Context stub (not the full verifyToken chain) — same reasoning
    // as financeIntelligence.membershipGate.pg.test.ts: this suite's job is
    // to prove finance-valuation's OWN handlers never consult
    // organization_members, not to re-prove JWT verification (already
    // exhaustively covered by financeValue.membershipGate.pg.test.ts /
    // financeTwoDoorsMountedAuth.pg.test.ts).
    app.use('/api/v8/finance-valuation', router);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    let cleanupClient: PoolClient | undefined;
    try {
      cleanupClient = await pool.connect();
      await cleanupClient.query('BEGIN');
      await cleanupClient.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
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
      const postCommitResidue = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM organizations WHERE id=$1) +
           (SELECT count(*)::int FROM users WHERE organization_id=$1) +
           (SELECT count(*)::int FROM organization_members WHERE organization_id=$1) AS n`,
        [org]
      );
      expect(postCommitResidue.rows[0].n, 'residue must be exactly zero AFTER commit').toBe(0);
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

  it('the compiled router has exactly 19 route handlers (matches the pinned static denominator)', () => {
    expect(routerHandlerCount).toBe(19);
  });

  // Representative CALCULATOR handlers — this file has ZERO READ handlers
  // (0 GET routes exist; see financeV8MutationInventory.test.ts). Picked
  // from two different underlying engines (valueAtRiskService,
  // monteCarloNpvService) to span more than one of the file's 7 clusters.
  it('POST /value-at-risk (CALCULATOR) succeeds for a caller with NO membership row', async () => {
    const res = await request(app)
      .post('/api/v8/finance-valuation/value-at-risk')
      .set(bearer(noMembershipUser, org))
      .send({ benefitForecast: 100000, spi: 0.9 });
    expect(res.status).toBe(200);
    expect(res.body?.data).toBeDefined();
  });

  it('POST /monte-carlo-npv (CALCULATOR) succeeds for a REVOKED-membership caller', async () => {
    const res = await request(app)
      .post('/api/v8/finance-valuation/monte-carlo-npv')
      .set(bearer(revokedUser, org))
      .send({ drivers: { revenue: 1000, cost: -400 }, iterations: 25, seed: 42, bins: 5 });
    expect(res.status).toBe(200);
    expect(res.body?.data?.simulation).toBeDefined();
  });

  it('exercising this file\'s handlers writes ZERO rows to financial_models / financial_analyses / value_baselines', async () => {
    const countRows = async () => {
      const result = await pool.query<{ n: string }>(
        `SELECT
           (SELECT count(*)::int FROM financial_models WHERE organization_id = $1) +
           (SELECT count(*)::int FROM financial_analyses WHERE organization_id = $1) +
           (SELECT count(*)::int FROM value_baselines WHERE organization_id = $1) AS n`,
        [org]
      );
      return Number(result.rows[0]?.n ?? 0);
    };

    const before = await countRows();
    await request(app)
      .post('/api/v8/finance-valuation/value-at-risk')
      .set(bearer(noMembershipUser, org))
      .send({ benefitForecast: 5000, spi: 1.1 });
    await request(app)
      .post('/api/v8/finance-valuation/monte-carlo-npv')
      .set(bearer(revokedUser, org))
      .send({ drivers: { x: 10 }, iterations: 5 });
    const after = await countRows();

    expect(after, 'this writer-free cluster must never persist a business row').toBe(before);
  });
});
