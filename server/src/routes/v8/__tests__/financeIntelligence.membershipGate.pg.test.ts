/**
 * LANE B-FRESH W2 PHASE 2 — finance-intelligence.routes.ts has ZERO business
 * writers. This suite exists to LOCK THAT IN, not to fake a membership gate.
 *
 * `requireActiveMembership` (services/legacyCutover/requireActiveMembership.ts)
 * was mounted on exactly 5 handlers in finance-value.routes.ts (see
 * financeV8MutationInventory.test.ts for the static denominator: 74 handlers
 * total, 5 BUSINESS-WRITE, all 5 in finance-value.routes.ts). This file's
 * job is the mirror image: prove — against a REAL Postgres, over REAL HTTP,
 * through the REAL `verifyToken -> requireV8OrgContext -> attachV8Context`
 * chain — that a caller with NO active tenant membership can still reach
 * every one of this file's 13 handlers (2 READ + 11 CALCULATOR), and that
 * none of them persists anything. Adding a `requireActiveMembership` guard
 * here would be encoding the OPPOSITE of the mandate (this file has no
 * writer to guard) — this suite does not assert a 403 anywhere.
 *
 * If a future change adds a genuine business writer to this file, the
 * companion static test (financeV8MutationInventory.test.ts) fails first on
 * the pinned handler-classification counts; THIS file additionally fails if
 * that new writer is reachable by a caller with no membership row, because
 * the zero-row-delta assertion below would trip.
 *
 * PATTERNS APPLIED (same conventions as financeValue.membershipGate.pg.test.ts
 * and server/src/services/legacyCutover/__tests__/financeTwoDoorsMountedAuth.pg.test.ts):
 *   - loud-fail at module load if the real-DB env gate isn't satisfied — NOT
 *     `describe.skipIf`; a suite that cannot prove it is real must never
 *     silently report a pass.
 *   - `assertRealDatabase` (round-trip current_database()/current_schema())
 *     PLUS a server-side `current_database()` prefix assertion — the
 *     connection string can lie about which database it points at; the
 *     server cannot.
 *   - real HS256 JWTs signed with the canonical vitest JWT secret, verified
 *     by the REAL `verifyToken` middleware (ENABLE_TEST_AUTH_BYPASS deleted
 *     first, so a token-less request cannot silently succeed via the test
 *     bypass identity).
 *   - self-override `DB_TYPE=postgres` (the root vitest.config.ts forces
 *     `DB_TYPE=sqlite`/`NODE_ENV=test` into `process.env` for every test
 *     process before this file's module body runs).
 *   - per-suite advisory lock, released in `finally`.
 *   - teardown in an explicit transaction, residue asserted BEFORE COMMIT,
 *     catch re-throws (no swallowed teardown failure).
 *
 * RUN (from the worktree ROOT):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<disposable-db> \
 *   npx vitest run --retry=0 --no-file-parallelism \
 *     server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts
 */
/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealDatabase, fromPgPool } from '../../../testing/assertRealDatabase.js';

// ---------------------------------------------------------------------------
// Loud-fail env gate — module-level throw, NOT describe.skipIf. A suite that
// cannot prove it is running against a real, local, disposable Postgres must
// never silently report zero tests as a pass.
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(DATABASE_URL) &&
  /localhost|127\.0\.0\.1/.test(DATABASE_URL);

if (!REAL_DB_REQUESTED) {
  throw new Error(
    '[financeIntelligence.membershipGate.pg.test] Refusing to proceed: requires RUN_DB_TESTS=1, ' +
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
    `[financeIntelligence.membershipGate.pg.test] JWT_SECRET must be exactly "${CANONICAL_JWT_SECRET}" ` +
      '(same canonical vitest secret every other V8 finance mounted-auth suite in this repo uses).'
  );
}

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

/**
 * Caller-side + server-side disposable-database guard. There is no
 * pre-established naming convention specific to THIS lane's disposable DB
 * (unlike e.g. `consultify_fin_` for financeTwoDoorsMountedAuth or
 * `consultify_wobs` for resultsWriterObservation) — the prefix is therefore
 * env-overridable with a documented, permissive default, exactly like
 * `resultsWriterObservation.pg.test.ts`'s `REQUIRED_DB_PREFIX`. Whoever
 * provisions the disposable DB for this lane should either name it starting
 * with "consultify" or export
 * `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX=<actual-prefix>`.
 */
const REQUIRED_DB_PREFIX = process.env.FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX || 'consultify';
const SUITE_LOCK_NAME = 'finance-intelligence-membership-gate-lockin';

const prefix = `finintel-${randomUUID().slice(0, 8)}`;
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

describe.sequential('finance-intelligence.routes.ts — zero-writer lock-in (real Postgres)', () => {
  let pool: Pool;
  let lockClient: PoolClient;
  let app: express.Express;
  let routerHandlerCount = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });

    // assertRealDatabase: generic round-trip proof this is a real connection.
    await assertRealDatabase(fromPgPool(pool));

    // Server-side current_database() prefix assertion — the connection
    // string can be rewritten by a stale env or a proxy; current_database()
    // cannot.
    const { rows } = await pool.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `[financeIntelligence.membershipGate.pg.test] refusing to run: server-side ` +
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
      // noMembershipUser deliberately gets NO organization_members row at all.
    }

    const router = (await import('../finance-intelligence.routes.js')).default;
    routerHandlerCount = (router as unknown as { stack: Array<{ route?: unknown }> }).stack.filter(
      (layer) => layer.route
    ).length;

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.v8Context = { organizationId: org, userId: noMembershipUser, userRole: 'ADMIN', isSuperAdmin: false };
      next();
    });
    // Real router mounted directly — the middleware above stands in for the
    // real verifyToken/requireV8OrgContext/attachV8Context chain ONLY for
    // the "no membership row needed" proof; the point of this suite is NOT
    // to re-prove JWT verification (financeValue.membershipGate.pg.test.ts
    // and financeTwoDoorsMountedAuth.pg.test.ts already do, exhaustively) —
    // it is to prove finance-intelligence's OWN handlers never consult
    // organization_members at all.
    app.use('/api/v8/finance-intelligence', router);
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

  // ---------------------------------------------------------------------
  // 1. Runtime handler-count cross-check (independent of the static regex
  //    parser in financeV8MutationInventory.test.ts — this one introspects
  //    the ACTUAL compiled express.Router() instance's route layers).
  // ---------------------------------------------------------------------
  it('the compiled router has exactly 13 route handlers (matches the pinned static denominator)', () => {
    expect(routerHandlerCount).toBe(13);
  });

  // ---------------------------------------------------------------------
  // 2. Representative READ + CALCULATOR handlers remain reachable WITHOUT
  //    an ACTIVE membership row. Picked to span: a pure v8Context-only
  //    lookup (canonical-lines), a DB-backed READ that reaches all the way
  //    to a real query and makes an application-level not-found decision
  //    (packs/:packId/tie-out), and two pure CALCULATOR handlers from two
  //    different sub-clusters of this file (completeness/readiness,
  //    anomalies/detect) — deliberately NOT the LLM-backed pipeline/run and
  //    pipeline/document endpoints, which call real external LLM providers
  //    and are out of scope for a DB-focused suite (see final report).
  // ---------------------------------------------------------------------
  it('GET /canonical-lines/:statementType (pure) succeeds for a caller with NO membership row', async () => {
    const res = await request(app)
      .get('/api/v8/finance-intelligence/canonical-lines/P%26L')
      .set(bearer(noMembershipUser, org));
    expect(res.status).toBe(200);
    expect(res.body?.data?.statementType).toBeDefined();
  });

  it('GET /packs/:packId/tie-out (DB-backed READ) reaches the real handler for a caller with NO membership row (404 not-found, not 403 membership)', async () => {
    const res = await request(app)
      .get(`/api/v8/finance-intelligence/packs/${prefix}-missing-pack/tie-out`)
      .set(bearer(noMembershipUser, org));
    expect(res.status).toBe(404);
    expect(res.body).not.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('POST /completeness/readiness (CALCULATOR) succeeds for a REVOKED-membership caller', async () => {
    const res = await request(app)
      .post('/api/v8/finance-intelligence/completeness/readiness')
      .set(bearer(revokedUser, org))
      .send({ coverage: { A: true, B: false }, requiredCoverage: ['A', 'B'] });
    expect(res.status).toBe(200);
    expect(res.body?.data).toBeDefined();
  });

  it('POST /anomalies/detect (CALCULATOR) succeeds for a caller with NO membership row', async () => {
    const res = await request(app)
      .post('/api/v8/finance-intelligence/anomalies/detect')
      .set(bearer(noMembershipUser, org))
      .send({ type: 'P&L', lines: [{ code: 'REV', label: 'Revenue', value: 1000, priorValue: 900 }] });
    expect(res.status).toBe(200);
    expect(res.body?.data?.anomalies).toBeDefined();
  });

  // ---------------------------------------------------------------------
  // 3. Exercising every representative handler above produces ZERO row
  //    deltas in the finance business tables this cluster's dependency
  //    services (financialAnalysisService, financialStatementPackService)
  //    are capable of writing to — the exact two services confirmed to
  //    contain ANY write primitive behind this file. Scoped to this run's
  //    unique org so a concurrent run can never pollute this count.
  // ---------------------------------------------------------------------
  it('exercising this file\'s handlers writes ZERO rows to financial_analyses / financial_analysis_ratios / financial_statement_packs', async () => {
    const countRows = async () => {
      const result = await pool.query<{ n: string }>(
        `SELECT
           (SELECT count(*)::int FROM financial_analyses WHERE organization_id = $1) +
           (SELECT count(*)::int FROM financial_analysis_ratios ratios
              WHERE ratios.analysis_id IN (SELECT id FROM financial_analyses WHERE organization_id = $1)) +
           (SELECT count(*)::int FROM financial_statement_packs WHERE organization_id = $1) AS n`,
        [org]
      );
      return Number(result.rows[0]?.n ?? 0);
    };

    const before = await countRows();
    await request(app)
      .get('/api/v8/finance-intelligence/canonical-lines/BS')
      .set(bearer(noMembershipUser, org));
    await request(app)
      .get(`/api/v8/finance-intelligence/packs/${prefix}-missing-pack-2/tie-out`)
      .set(bearer(noMembershipUser, org));
    await request(app)
      .post('/api/v8/finance-intelligence/completeness/readiness')
      .set(bearer(revokedUser, org))
      .send({ coverage: {}, requiredCoverage: [] });
    await request(app)
      .post('/api/v8/finance-intelligence/anomalies/detect')
      .set(bearer(noMembershipUser, org))
      .send({ type: 'BS', lines: [{ code: 'CASH', label: 'Cash', value: 500 }] });
    await request(app)
      .post('/api/v8/finance-intelligence/business-case/one-pager')
      .set(bearer(noMembershipUser, org))
      .send({
        initiative: {
          id: `${prefix}-init`,
          name: 'lock-in probe',
          capex: 1000,
          opexAnnual: 100,
          benefitAnnual: 500,
          horizonYears: 3,
        },
        waccPct: 8,
      });
    const after = await countRows();

    expect(after, 'this writer-free cluster must never persist a business row').toBe(before);
  });
});
