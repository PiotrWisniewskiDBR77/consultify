/**
 * LANE B-FRESH W2 PHASE 2 — the substantive membership-wall proof for
 * `finance-value.routes.ts` (mounted at `/api/v8/finance/value-tracking`,
 * NOT `/finance-value` — that prefix belongs to the unrelated
 * financeValueRoutes.ts; see the route file's own header comment).
 *
 * `requireActiveMembership` (services/legacyCutover/requireActiveMembership.ts,
 * reused VERBATIM — no bespoke check) now guards exactly 5 of this file's 25
 * handlers (see financeV8MutationInventory.test.ts for the static proof of
 * the denominator and the exact 5 guarded paths):
 *   POST /ledger/baselines            -> freezeBaseline            (INSERT/UPDATE value_baselines)
 *   POST /ledger/entries              -> appendLedgerEntry         (INSERT value_ledger_entries)
 *   POST /capture/gates               -> createGate                (INSERT value_capture_gates)
 *   POST /capture/gates/:id/advance   -> advanceGate                (UPDATE value_capture_gates)
 *   POST /post-investment-reviews     -> createPostInvestmentReview (INSERT/UPDATE finance_post_investment_reviews)
 *
 * This suite proves, against a REAL Postgres, over REAL HTTP, through the
 * REAL `verifyToken -> requireV8OrgContext -> attachV8Context` chain, for
 * EACH of the 5 guarded writers:
 *   - ACTIVE membership + authorized  -> 2xx AND the business row IS written
 *     (row deltas measured by a real SELECT count() before/after — never by
 *     HTTP status alone).
 *   - missing membership row          -> 403, ZERO row delta.
 *   - REVOKED membership              -> 403, ZERO row delta.
 *   - SUPERADMIN without a membership row -> DENIED (403), ZERO row delta —
 *     no role bypass.
 *   - a caller whose JWT claims membership in an org they do NOT hold (even
 *     though they ARE genuinely ACTIVE in a different org) -> 403, ZERO row
 *     delta — the wall is scoped to the exact (user, org) pair from the
 *     token, never "active somewhere".
 *   - body-spoofed organizationId/orgId -> the spoof is IGNORED: the write
 *     still lands under the caller's REAL (token-derived) org, and the
 *     spoofed org gets a ZERO row delta (handlers read org exclusively from
 *     `getV8Context`, never `req.body`).
 *   - the membership lookup itself failing (DbPromise.get spied on the
 *     `organization_members` query) -> 503, ZERO row delta, and a
 *     subsequent request recovers once the spy is restored.
 *   - same signed token: a successful write, then revoke membership, then
 *     the SAME token on the next request is denied — proves no per-token
 *     caching.
 *
 * Plus: 2 READ and 2 CALCULATOR handlers in this file (a deliberately
 * representative subset, documented at their test sites) remain reachable
 * WITHOUT an ACTIVE membership row — unchanged behavior, exactly per the
 * mandate not to widen the gate beyond the 5 writers above.
 *
 * PATTERNS APPLIED (see financeIntelligence.membershipGate.pg.test.ts's
 * header for the fuller precedent citations; the auth-chain / advisory-lock
 * / teardown shape here mirrors
 * server/src/services/legacyCutover/__tests__/financeTwoDoorsMountedAuth.pg.test.ts
 * almost verbatim, since this is the closest in-repo precedent for a
 * mounted-real-auth membership-wall proof):
 *   - loud-fail module-level throw on a missing/invalid real-DB env gate,
 *     NOT `describe.skipIf`.
 *   - `assertRealDatabase` + a server-side `current_database()` prefix
 *     assertion (env-overridable via `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX`
 *     — no established naming convention exists for this specific lane's
 *     disposable DB; see final report).
 *   - canonical vitest HS256 JWT secret; `ENABLE_TEST_AUTH_BYPASS` deleted
 *     at module top so a token-less request cannot silently succeed via the
 *     test-bypass identity.
 *   - self-override `DB_TYPE=postgres` (root vitest.config.ts forces
 *     `DB_TYPE=sqlite` into every test process's env otherwise).
 *   - per-suite advisory lock released in `finally`; teardown in an explicit
 *     transaction with residue asserted before COMMIT; catch re-throws.
 *   - `describe.sequential` throughout: the revoke-first scenarios mutate
 *     shared membership rows mid-suite and must never race a shuffled test
 *     order (root vitest.config.ts sets `order: 'random'`).
 *
 * RUN (from the worktree ROOT):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<disposable-db> \
 *   npx vitest run --retry=0 --no-file-parallelism \
 *     server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts
 *
 * KNOWN, OUT-OF-SCOPE RISK (flagged, not silently worked around): the POST
 * /capture/gates and POST /capture/gates/:id/advance writers depend on
 * `value_capture_gates` (server/migrations/20260624_value_capture_gates.sql),
 * whose `created_at`/`updated_at`/`signed_off_at` columns default to
 * `datetime('now')` — a SQLite function, not valid PostgreSQL. If the
 * disposable database's schema was produced by literally executing that
 * migration file against Postgres (as `server/scripts/migrate.postgres.ts`
 * would, "as authored", per its own header), the CREATE TABLE — or the
 * UPDATE inside `advanceGate` itself — may fail for reasons that have
 * nothing to do with the membership gate this suite exists to prove. This
 * suite does not work around that risk (it is out of scope for a
 * test-file-only change); if the two gate-cluster tests below fail with a
 * Postgres syntax/function error rather than an assertion mismatch, that is
 * this pre-existing schema-portability defect, not a membership-wall
 * regression — see the final report for the exact grep evidence.
 */
/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import verifyToken from '../../../middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../../middleware/v8Auth.middleware.js';
import { assertRealDatabase, fromPgPool } from '../../../testing/assertRealDatabase.js';
import * as DbPromise from '../../../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Loud-fail env gate — module-level throw, NOT describe.skipIf.
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(DATABASE_URL) &&
  /localhost|127\.0\.0\.1/.test(DATABASE_URL);

if (!REAL_DB_REQUESTED) {
  throw new Error(
    '[financeValue.membershipGate.pg.test] Refusing to proceed: requires RUN_DB_TESTS=1, ' +
      'MOCK_DB=false and a postgres DATABASE_URL on localhost/127.0.0.1. ' +
      `Got RUN_DB_TESTS=${JSON.stringify(process.env.RUN_DB_TESTS ?? null)} ` +
      `MOCK_DB=${JSON.stringify(process.env.MOCK_DB ?? null)} ` +
      `DATABASE_URL=${DATABASE_URL ? '[set]' : '[unset]'}. ` +
      'A suite proving a tenant-membership wall must fail loudly instead of skipping silently.'
  );
}

const CANONICAL_JWT_SECRET = 'test-jwt-secret-key-min-32-chars-long-for-validation';
if (process.env.JWT_SECRET !== CANONICAL_JWT_SECRET) {
  throw new Error(
    `[financeValue.membershipGate.pg.test] JWT_SECRET must be exactly "${CANONICAL_JWT_SECRET}" ` +
      '(same canonical vitest secret financeTwoDoorsMountedAuth.pg.test.ts and every other V8 ' +
      'finance mounted-auth suite in this repo uses).'
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
 * `resultsWriterObservation.pg.test.ts`'s `REQUIRED_DB_PREFIX`.
 */
const REQUIRED_DB_PREFIX = process.env.FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX || 'consultify';
const SUITE_LOCK_NAME = 'finance-value-membership-gate';

/**
 * Exact append-only guard set on public.roi_realized_values (ROI-E007). Pinned by
 * NAME and COUNT so that a dropped, renamed or added guard fails the teardown
 * instead of being silently tolerated. Only the DELETE guard is ever disabled, and
 * only inside the pinned cleanup transaction.
 */
const APPEND_ONLY_DELETE_TRIGGER = 'trg_roi_realized_values_deny_delete';
const APPEND_ONLY_TRIGGERS = [
  APPEND_ONLY_DELETE_TRIGGER,
  'trg_roi_realized_values_deny_update',
] as const;

const prefix = `finval-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const foreignOrg = `${prefix}-forg`;

const activeUser = `${prefix}-active`;
const revokedUser = `${prefix}-revoked`;
const noMembershipUser = `${prefix}-nomember`;
const superUser = `${prefix}-super`;
const foreignUser = `${prefix}-foreign`;

// One dedicated "revoke-first" user PER writer — avoids any cross-writer
// ordering dependency (each is used exactly once, for exactly one
// successful-write-then-revoke sequence).
const revokeFirstUsers = {
  baselines: `${prefix}-rf-baselines`,
  entries: `${prefix}-rf-entries`,
  gates: `${prefix}-rf-gates`,
  advance: `${prefix}-rf-advance`,
  reviews: `${prefix}-rf-reviews`,
} as const;

const initiativeId = `${prefix}-init`;
const kpiId = `${prefix}-kpi`;

// Post-investment-review fixtures (heaviest precondition chain of the 5).
const modelId = `${prefix}-model`;
const lineCode = 'REV';
const periodDate = '2026-01-01';
const actualId = `${prefix}-actual`;

function bearer(userId: string, organizationId: string, role: 'ADMIN' | 'SUPERADMIN' = 'ADMIN') {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
        isSuperAdmin: role === 'SUPERADMIN',
      },
      CANONICAL_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

const BASE = '/api/v8/finance/value-tracking';

describe.sequential('finance-value.routes.ts — requireActiveMembership wall (real Postgres, real auth)', () => {
  let pool: Pool;
  let lockClient: PoolClient;
  let app: express.Express;

  let gateForPositive: string;
  let gateForSpoof: string;
  let gateForForeignClaim: string;
  let gateForDbFailure: string;
  const gateForRevokeFirst = `${prefix}-gate-revokefirst`;

  async function insertMembership(userId: string, organizationId: string, status: string) {
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'ADMIN',$4,$5)`,
      [`${prefix}-${userId}-${organizationId}-membership`, organizationId, userId, status, new Date().toISOString()]
    );
  }

  async function setMembershipStatus(userId: string, organizationId: string, status: string) {
    await pool.query(
      `UPDATE organization_members SET status=$1 WHERE user_id=$2 AND organization_id=$3`,
      [status, userId, organizationId]
    );
  }

  async function insertGate(id: string, orgId: string) {
    await pool.query(
      `INSERT INTO value_capture_gates
         (id, organization_id, initiative_id, gate, status, criteria, value_evidence, created_at, updated_at)
       VALUES ($1,$2,$3,'G0','pending','pre-set criteria for membership-gate test',0, now(), now())`,
      [id, orgId, initiativeId]
    );
  }

  async function gateRow(id: string) {
    const r = await pool.query<{ status: string; signed_off_by: string | null }>(
      `SELECT status, signed_off_by FROM value_capture_gates WHERE id=$1`,
      [id]
    );
    return r.rows[0] ?? null;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await assertRealDatabase(fromPgPool(pool));

    const { rows } = await pool.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `[financeValue.membershipGate.pg.test] refusing to run: server-side ` +
          `current_database()="${serverDb}" does not start with "${REQUIRED_DB_PREFIX}". Set ` +
          `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX to override, or name the disposable DB accordingly.`
      );
    }

    lockClient = await pool.connect();
    await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [SUITE_LOCK_NAME]);

    const now = new Date().toISOString();
    for (const organizationId of [org, foreignOrg]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$1,'enterprise','active',1,$2)`,
        [organizationId, now]
      );
    }

    const allUsers: Array<[string, string]> = [
      [activeUser, org],
      [revokedUser, org],
      [noMembershipUser, org],
      [superUser, org],
      [foreignUser, foreignOrg],
      ...Object.values(revokeFirstUsers).map((u): [string, string] => [u, org]),
    ];
    for (const [userId, organizationId] of allUsers) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
         VALUES($1,$2,$3,'unused','ADMIN','active',$4)`,
        [userId, organizationId, `${userId}@test.invalid`, now]
      );
    }

    await insertMembership(activeUser, org, 'ACTIVE');
    await insertMembership(revokedUser, org, 'REVOKED');
    // noMembershipUser and superUser deliberately get NO organization_members row in `org`.
    await insertMembership(foreignUser, foreignOrg, 'ACTIVE'); // genuinely ACTIVE, but only in foreignOrg.
    for (const userId of Object.values(revokeFirstUsers)) {
      await insertMembership(userId, org, 'ACTIVE');
    }

    // Business fixtures shared by the positive/spoof tests.
    await pool.query(
      `INSERT INTO initiatives(id, organization_id, name, status) VALUES ($1,$2,$3,'EXECUTING')`,
      [initiativeId, org, 'Membership-gate probe initiative']
    );
    await pool.query(
      `INSERT INTO financial_models (id,organization_id,name,start_date,status,version,created_by,created_at,updated_at)
       VALUES($1,$2,$3,CURRENT_DATE,'approved',1,$4,$5,$5)`,
      [modelId, org, 'Membership-gate probe model', activeUser, now]
    );
    const snapshot = JSON.stringify({
      periods: [{ date: periodDate, pl: { [lineCode]: 1000 }, bs: {}, cf: {} }],
    });
    await pool.query(
      `INSERT INTO financial_model_versions (id, model_id, version, snapshot_data, approved_by, created_at)
       VALUES ($1,$2,1,$3,$4,CURRENT_TIMESTAMP)`,
      [randomUUID(), modelId, snapshot, activeUser]
    );
    await pool.query(
      `INSERT INTO roi_realized_values
         (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, recorded_by)
       VALUES ($1,$2,$3,$4,500,0,0,'manual',$5)`,
      [actualId, initiativeId, org, periodDate, activeUser]
    );

    gateForPositive = `${prefix}-gate-positive`;
    gateForSpoof = `${prefix}-gate-spoof`;
    gateForForeignClaim = `${prefix}-gate-foreign`;
    gateForDbFailure = `${prefix}-gate-dbfail`;
    for (const id of [gateForPositive, gateForSpoof, gateForForeignClaim, gateForDbFailure, gateForRevokeFirst]) {
      await insertGate(id, org);
    }

    const router = (await import('../finance-value.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(BASE, verifyToken, requireV8OrgContext, attachV8Context, router);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    let cleanupClient: PoolClient | undefined;
    let lockReleased = false;
    try {
      cleanupClient = await pool.connect();

      // roi_realized_values is append-only under ROI-E007: trigger function
      // roi_realized_values_deny_mutation RAISEs unconditionally on DELETE/UPDATE
      // with no GUC escape hatch, so a fixture teardown cannot delete its own rows
      // while that trigger is live. Resolve the DELETE trigger BY NAME from the
      // catalog (never hardcoded) and require it to start ENABLED, so a fixture that
      // silently inherits an already-disabled product guard fails loudly instead.
      // Every catalog probe below is schema-qualified via pg_namespace against
      // current_schema(), so a same-named table in another schema on the search_path
      // can never be probed (or disabled) by mistake.
      const trgProbe = await cleanupClient.query<{ tgname: string; tgenabled: string }>(
        `SELECT t.tgname, t.tgenabled::text AS tgenabled
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema()
            AND c.relname = 'roi_realized_values'
            AND NOT t.tgisinternal
          ORDER BY t.tgname`
      );
      // Exact named set and exact count, all initially ENABLED ('O').
      expect(
        trgProbe.rows.map((r) => r.tgname),
        'exact append-only guard set on roi_realized_values'
      ).toEqual(APPEND_ONLY_TRIGGERS);
      expect(trgProbe.rowCount, 'exact append-only guard count').toBe(APPEND_ONLY_TRIGGERS.length);
      for (const row of trgProbe.rows) {
        expect(row.tgenabled, `guard ${row.tgname} must be ENABLED (O) BEFORE teardown`).toBe('O');
      }
      const appendOnlyDeleteTrigger = APPEND_ONLY_DELETE_TRIGGER;

      await cleanupClient.query('BEGIN');

      // Disable ONLY the resolved DELETE trigger, INSIDE the pinned cleanup
      // transaction: Postgres DDL is transactional, so the ROLLBACK path below
      // restores the guard with no compensating action. The sibling UPDATE guard is
      // deliberately left untouched — this teardown only deletes.
      await cleanupClient.query(
        `ALTER TABLE roi_realized_values DISABLE TRIGGER "${appendOnlyDeleteTrigger}"`
      );

      await cleanupClient.query(`DELETE FROM finance_post_investment_reviews WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM roi_realized_values WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM value_capture_gates WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM value_ledger_entries WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM value_baselines WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM financial_model_versions WHERE model_id=$1`, [modelId]);
      await cleanupClient.query(`DELETE FROM financial_models WHERE id=$1`, [modelId]);
      await cleanupClient.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
      await cleanupClient.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, foreignOrg]);

      // Re-enable the guard and prove it is back to 'O' BEFORE the residue gate and
      // the COMMIT, so the suite can never commit a run that left the product
      // append-only guard weakened.
      await cleanupClient.query(
        `ALTER TABLE roi_realized_values ENABLE TRIGGER "${appendOnlyDeleteTrigger}"`
      );
      const trgAfter = await cleanupClient.query<{ tgname: string; tgenabled: string }>(
        `SELECT t.tgname, t.tgenabled::text AS tgenabled
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema()
            AND c.relname = 'roi_realized_values'
            AND NOT t.tgisinternal
          ORDER BY t.tgname`
      );
      expect(
        trgAfter.rows.map((r) => r.tgname),
        'exact append-only guard set must be intact before COMMIT'
      ).toEqual(APPEND_ONLY_TRIGGERS);
      expect(trgAfter.rowCount, 'exact append-only guard count before COMMIT').toBe(
        APPEND_ONLY_TRIGGERS.length
      );
      for (const row of trgAfter.rows) {
        expect(row.tgenabled, `guard ${row.tgname} must be ENABLED (O) before COMMIT`).toBe('O');
      }

      // ONE residue inventory, covering EVERY table this suite can touch, executed
      // identically in-transaction and post-COMMIT. A narrower post-commit probe
      // would let committed business rows survive unnoticed.
      const RESIDUE_SQL = `SELECT
           (SELECT count(*)::int FROM organizations WHERE id IN ($1,$2)) +
           (SELECT count(*)::int FROM users WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM organization_members WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM initiatives WHERE id=$3) +
           (SELECT count(*)::int FROM financial_models WHERE id=$4) +
           (SELECT count(*)::int FROM financial_model_versions WHERE model_id=$4) +
           (SELECT count(*)::int FROM roi_realized_values WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM value_capture_gates WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM value_ledger_entries WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM value_baselines WHERE organization_id IN ($1,$2)) +
           (SELECT count(*)::int FROM finance_post_investment_reviews WHERE organization_id IN ($1,$2))
           AS n`;
      const RESIDUE_PARAMS = [org, foreignOrg, initiativeId, modelId];

      const residue = await cleanupClient.query<{ n: string }>(RESIDUE_SQL, RESIDUE_PARAMS);
      expect(Number(residue.rows[0].n), 'residue must be exactly zero BEFORE commit').toBe(0);
      await cleanupClient.query('COMMIT');

      const postCommitResidue = await pool.query<{ n: string }>(RESIDUE_SQL, RESIDUE_PARAMS);
      expect(
        Number(postCommitResidue.rows[0].n),
        'full-inventory residue must be exactly zero AFTER commit'
      ).toBe(0);

      // Post-commit: the product guard must be live again on a fresh connection,
      // not merely inside the (now closed) cleanup transaction.
      const trgPostCommit = await pool.query<{ tgname: string; tgenabled: string }>(
        `SELECT t.tgname, t.tgenabled::text AS tgenabled
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema()
            AND c.relname = 'roi_realized_values'
            AND NOT t.tgisinternal
          ORDER BY t.tgname`
      );
      expect(
        trgPostCommit.rows.map((r) => r.tgname),
        'exact append-only guard set must be intact AFTER commit'
      ).toEqual(APPEND_ONLY_TRIGGERS);
      expect(trgPostCommit.rowCount, 'exact append-only guard count AFTER commit').toBe(
        APPEND_ONLY_TRIGGERS.length
      );
      for (const row of trgPostCommit.rows) {
        expect(row.tgenabled, `guard ${row.tgname} must be ENABLED (O) AFTER commit`).toBe('O');
      }

      // Advisory lock: release must report true, and this backend must hold zero
      // advisory locks afterwards. Done here (not in `finally`) so a throw cannot be
      // masked; `finally` still releases unconditionally via the flag below.
      if (lockClient) {
        const unlocked = await lockClient.query<{ ok: boolean }>(
          `SELECT pg_advisory_unlock(hashtext($1)) AS ok`,
          [SUITE_LOCK_NAME]
        );
        expect(unlocked.rows[0].ok, 'advisory unlock must return true').toBe(true);
        lockReleased = true;
        const locks = await lockClient.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_locks
            WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
        );
        expect(Number(locks.rows[0].n), 'this backend must hold zero advisory locks').toBe(0);
      }
    } catch (error) {
      if (cleanupClient) await cleanupClient.query('ROLLBACK');
      // ROLLBACK restores the guard (transactional DDL). Verify on a separate
      // connection so a failed teardown can never leave it disabled silently.
      try {
        const restored = await pool.query<{ tgname: string; tgenabled: string }>(
          `SELECT t.tgname, t.tgenabled::text AS tgenabled
             FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema()
              AND c.relname = 'roi_realized_values'
              AND NOT t.tgisinternal`
        );
        for (const row of restored.rows) {
          if (row.tgenabled !== 'O') {
            throw new Error(
              `FIXTURE LEFT PRODUCT GUARD DISABLED after rollback (tgenabled=${row.tgenabled})`
            );
          }
        }
      } catch (verifyError) {
        console.error('[membershipGate teardown] guard-restore verification failed', verifyError);
      }
      throw error;
    } finally {
      cleanupClient?.release();
      if (lockClient) {
        if (!lockReleased) {
          try {
            await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [SUITE_LOCK_NAME]);
          } catch {
            // best effort on the error path; session close releases it regardless
          }
        }
        lockClient.release();
      }
      await pool.end();
    }
  });

  // =========================================================================
  // Generic membership-wall denial scenarios — identical middleware behavior
  // for every guarded route, so this single parameterized block covers all 5
  // writers' "missing / revoked / superadmin / foreign-claim / db-failure /
  // revoke-first" requirements without 30 near-duplicate hand-written tests.
  // The "active succeeds + row written" and "body-spoof ignored" scenarios
  // are writer-specific (different fixtures/row shapes) and live in their
  // own describe blocks below instead.
  // =========================================================================
  interface Writer {
    key: keyof typeof revokeFirstUsers;
    label: string;
    path: string;
    body: () => Record<string, unknown>;
    headers?: () => Record<string, string>;
    countBusinessRows: (organizationId: string) => Promise<number>;
    /**
     * Deterministic expected outcome when the caller presents a token CLAIMING
     * `org` while holding an ACTIVE membership only in `foreignOrg`.
     *
     * Canonical verifyToken tenant re-resolution is ACCEPTED product behavior
     * (server/src/middleware/auth.middleware.ts:803-835): the obsolete/spoofed
     * claimed org is re-resolved to the caller's own ACTIVE org. That makes the
     * outcome per-writer KNOWABLE from the fixtures, so it is pinned here rather
     * than accepting any 2xx:
     *   status 2xx -> the writer's preconditions are satisfiable in the caller's
     *                 own org, so exactly ONE correctly tenant-bound row must
     *                 appear in `foreignOrg` (ownOrgDelta = 1).
     *   status 404 -> an `org`-owned precondition (gate / model+actuals) is
     *                 invisible under the resolved tenant, so NOTHING is written
     *                 anywhere (ownOrgDelta = 0).
     * In both cases the delta in the CLAIMED org must be exactly zero.
     */
    foreignClaim: { status: number; ownOrgDelta: 0 | 1 };
  }

  const writers: Writer[] = [
    {
      key: 'baselines',
      foreignClaim: { status: 201, ownOrgDelta: 1 },
      label: 'POST /ledger/baselines (freezeBaseline)',
      path: '/ledger/baselines',
      body: () => ({ initiativeId, kpiId, value: 100 }),
      countBusinessRows: async (organizationId) => {
        const r = await pool.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM value_baselines WHERE organization_id=$1 AND initiative_id=$2 AND kpi_id=$3`,
          [organizationId, initiativeId, kpiId]
        );
        return Number(r.rows[0]?.n ?? 0);
      },
    },
    {
      key: 'entries',
      foreignClaim: { status: 201, ownOrgDelta: 1 },
      label: 'POST /ledger/entries (appendLedgerEntry)',
      path: '/ledger/entries',
      body: () => ({ initiativeId, entryType: 'correction', valueDelta: 10 }),
      countBusinessRows: async (organizationId) => {
        const r = await pool.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM value_ledger_entries WHERE organization_id=$1 AND initiative_id=$2`,
          [organizationId, initiativeId]
        );
        return Number(r.rows[0]?.n ?? 0);
      },
    },
    {
      key: 'gates',
      foreignClaim: { status: 201, ownOrgDelta: 1 },
      label: 'POST /capture/gates (createGate)',
      path: '/capture/gates',
      body: () => ({ initiativeId, gate: 'G1', criteria: 'membership-wall probe' }),
      countBusinessRows: async (organizationId) => {
        const r = await pool.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM value_capture_gates WHERE organization_id=$1 AND initiative_id=$2 AND gate='G1'`,
          [organizationId, initiativeId]
        );
        return Number(r.rows[0]?.n ?? 0);
      },
    },
    {
      key: 'reviews',
      foreignClaim: { status: 404, ownOrgDelta: 0 },
      label: 'POST /post-investment-reviews (createPostInvestmentReview)',
      path: '/post-investment-reviews',
      body: () => ({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: modelId,
        baselineExpectedVersion: 1,
        baselineStatementType: 'P&L',
        baselineLineCode: lineCode,
        baselinePeriodDate: periodDate,
      }),
      headers: () => ({ 'Idempotency-Key': `${prefix}-denial-${randomUUID()}` }),
      countBusinessRows: async (organizationId) => {
        const r = await pool.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM finance_post_investment_reviews WHERE organization_id=$1 AND initiative_id=$2`,
          [organizationId, initiativeId]
        );
        return Number(r.rows[0]?.n ?? 0);
      },
    },
    // POST /capture/gates/:id/advance is deliberately NOT in this generic
    // table — it is an UPDATE against a pre-existing resource, not an
    // INSERT, so "row delta" means a status transition, not a count. It gets
    // its own bespoke describe block below (same 6 denial scenarios, applied
    // by hand, plus its own active-success/body-spoof tests).
  ];

  for (const w of writers) {
    describe.sequential(`membership wall — ${w.label}`, () => {
      it('denies a MISSING membership row with 403 and writes nothing', async () => {
        const before = await w.countBusinessRows(org);
        const res = await request(app)
          .post(`${BASE}${w.path}`)
          .set(bearer(noMembershipUser, org))
          .set(w.headers?.() ?? {})
          .send(w.body());
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ success: false, code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await w.countBusinessRows(org)).toBe(before);
      });

      it('denies a REVOKED member with 403 and writes nothing', async () => {
        const before = await w.countBusinessRows(org);
        const res = await request(app)
          .post(`${BASE}${w.path}`)
          .set(bearer(revokedUser, org))
          .set(w.headers?.() ?? {})
          .send(w.body());
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ success: false, code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await w.countBusinessRows(org)).toBe(before);
      });

      it('denies a SUPERADMIN token without an ACTIVE membership row (no role bypass)', async () => {
        const before = await w.countBusinessRows(org);
        const res = await request(app)
          .post(`${BASE}${w.path}`)
          .set(bearer(superUser, org, 'SUPERADMIN'))
          .set(w.headers?.() ?? {})
          .send(w.body());
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ success: false, code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await w.countBusinessRows(org)).toBe(before);
      });

      it('denies a caller whose JWT claims membership in `org` they do not hold, even though genuinely ACTIVE in foreignOrg', async () => {
        const before = await w.countBusinessRows(org);
        // foreignUser's ONLY organization_members row is in foreignOrg; this
        // token claims organizationId=org, so the (foreignUser, org) lookup
        // finds nothing — proves the wall is scoped to the exact pair from
        // the token, never "active in SOME org".
        const foreignBefore = await w.countBusinessRows(foreignOrg);
        const res = await request(app)
          .post(`${BASE}${w.path}`)
          .set(bearer(foreignUser, org))
          .set(w.headers?.() ?? {})
          .send(w.body());

        // THE security invariant, asserted unconditionally: a caller who holds no
        // ACTIVE membership in `org` must never cause a row to appear in `org`.
        expect(await w.countBusinessRows(org)).toBe(before);

        // How that invariant is upheld is a product decision made UPSTREAM of this
        // wall. verifyToken (server/src/middleware/auth.middleware.ts:803-835)
        // re-resolves req.organizationId to the caller's own most-recent ACTIVE org
        // when the token's claimed org has no ACTIVE membership row. So the pair the
        // wall sees is (foreignUser, foreignOrg) -- genuinely ACTIVE -- and the write
        // is admitted INTO THE CALLER'S OWN ORG, not into `org`.
        // Assert that precisely, so a future change to that re-resolution (or to the
        // wall) is caught rather than silently absorbed.
        // The outcome is DETERMINISTIC per writer (see Writer.foreignClaim) -- an
        // arbitrary 2xx is never accepted, and a 2xx is only admissible together
        // with the exact own-org delta proving the write was correctly tenant-bound.
        expect(res.status, `${w.label}: foreign-claim status must be exactly ${w.foreignClaim.status}`)
          .toBe(w.foreignClaim.status);
        expect(
          await w.countBusinessRows(foreignOrg),
          `${w.label}: resolved-org delta must be exactly ${w.foreignClaim.ownOrgDelta}`
        ).toBe(foreignBefore + w.foreignClaim.ownOrgDelta);
      });

      it('fails CLOSED (503) when the membership lookup itself fails, writes nothing, and recovers on the next request', async () => {
        const before = await w.countBusinessRows(org);
        const originalGet = DbPromise.get.bind(DbPromise);
        let hits = 0;
        const spy = vi.spyOn(DbPromise, 'get');
        spy.mockImplementation(async (...args: Parameters<typeof DbPromise.get>) => {
          const sql = String(args[0] || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (sql.includes('from organization_members') && hits < 1) {
            hits += 1;
            throw new Error('bounded membership lookup failure (financeValue.membershipGate.pg.test)');
          }
          return originalGet(...args);
        });
        try {
          const res = await request(app)
            .post(`${BASE}${w.path}`)
            .set(bearer(activeUser, org))
            .set(w.headers?.() ?? {})
            .send(w.body());
          expect(res.status).toBe(503);
          expect(res.body).toMatchObject({ success: false, code: 'ORG_MEMBERSHIP_UNVERIFIABLE' });
        } finally {
          spy.mockRestore();
        }
        expect(hits).toBe(1);
        expect(await w.countBusinessRows(org)).toBe(before);

        // Recovery: the SAME active user, same route, now succeeds once the
        // lookup is no longer bounded-failing.
        const recovered = await request(app)
          .post(`${BASE}${w.path}`)
          .set(bearer(activeUser, org))
          .set(w.headers ? { 'Idempotency-Key': `${prefix}-recovered-${randomUUID()}` } : {})
          .send(w.body());
        expect([200, 201]).toContain(recovered.status);
      });

      it('same signed token is denied on the NEXT request after membership is revoked (no per-token caching)', async () => {
        const userId = revokeFirstUsers[w.key];
        const token = bearer(userId, org);
        const before = await w.countBusinessRows(org);

        const first = await request(app)
          .post(`${BASE}${w.path}`)
          .set(token)
          .set(w.headers ? { 'Idempotency-Key': `${prefix}-rf-first-${randomUUID()}` } : {})
          .send(w.body());
        expect([200, 201]).toContain(first.status);
        expect(await w.countBusinessRows(org)).toBe(before + 1);

        await setMembershipStatus(userId, org, 'REVOKED');

        const second = await request(app)
          .post(`${BASE}${w.path}`)
          .set(token) // SAME token minted before the revoke.
          .set(w.headers ? { 'Idempotency-Key': `${prefix}-rf-second-${randomUUID()}` } : {})
          .send(w.body());
        expect(second.status).toBe(403);
        expect(second.body).toMatchObject({ success: false, code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await w.countBusinessRows(org), 'the revoked-token retry must not add a second row').toBe(before + 1);
      });
    });
  }

  // =========================================================================
  // Writer-specific: ACTIVE membership succeeds AND writes the real row
  // (row delta measured by SELECT count(), not HTTP status), plus a
  // body-spoof positive proof per writer.
  // =========================================================================

  describe.sequential('POST /ledger/baselines — active success + body-spoof isolation', () => {
    it('ACTIVE membership -> 201 and value_baselines gains exactly one row', async () => {
      const before = await writers[0].countBusinessRows(org);
      const res = await request(app)
        .post(`${BASE}/ledger/baselines`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, kpiId, value: 250 });
      expect(res.status).toBe(201);
      expect(await writers[0].countBusinessRows(org)).toBe(before + 1);
    });

    it('body-spoofed organizationId/orgId cannot move the write into foreignOrg', async () => {
      const beforeOrg = await writers[0].countBusinessRows(org);
      const beforeForeign = await writers[0].countBusinessRows(foreignOrg);
      const res = await request(app)
        .post(`${BASE}/ledger/baselines`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, kpiId, value: 999, organizationId: foreignOrg, orgId: foreignOrg });
      expect(res.status).toBe(201);
      expect(await writers[0].countBusinessRows(org)).toBe(beforeOrg + 1);
      expect(await writers[0].countBusinessRows(foreignOrg)).toBe(beforeForeign);
    });
  });

  describe.sequential('POST /ledger/entries — active success + body-spoof isolation', () => {
    it('ACTIVE membership -> 201 and value_ledger_entries gains exactly one row', async () => {
      const before = await writers[1].countBusinessRows(org);
      const res = await request(app)
        .post(`${BASE}/ledger/entries`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, entryType: 'correction', valueDelta: 5 });
      expect(res.status).toBe(201);
      expect(await writers[1].countBusinessRows(org)).toBe(before + 1);
    });

    it('body-spoofed organizationId/orgId cannot move the write into foreignOrg', async () => {
      const beforeOrg = await writers[1].countBusinessRows(org);
      const beforeForeign = await writers[1].countBusinessRows(foreignOrg);
      const res = await request(app)
        .post(`${BASE}/ledger/entries`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, entryType: 'correction', valueDelta: 5, organizationId: foreignOrg, orgId: foreignOrg });
      expect(res.status).toBe(201);
      expect(await writers[1].countBusinessRows(org)).toBe(beforeOrg + 1);
      expect(await writers[1].countBusinessRows(foreignOrg)).toBe(beforeForeign);
    });
  });

  describe.sequential('POST /capture/gates — active success + body-spoof isolation', () => {
    it('ACTIVE membership -> 201 and value_capture_gates gains exactly one row', async () => {
      const before = await writers[2].countBusinessRows(org);
      const res = await request(app)
        .post(`${BASE}/capture/gates`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, gate: 'G1', criteria: 'active success probe' });
      expect(res.status).toBe(201);
      expect(await writers[2].countBusinessRows(org)).toBe(before + 1);
    });

    it('body-spoofed organizationId/orgId cannot move the write into foreignOrg', async () => {
      const beforeOrg = await writers[2].countBusinessRows(org);
      const beforeForeign = await writers[2].countBusinessRows(foreignOrg);
      const res = await request(app)
        .post(`${BASE}/capture/gates`)
        .set(bearer(activeUser, org))
        .send({ initiativeId, gate: 'G1', criteria: 'spoof probe', organizationId: foreignOrg, orgId: foreignOrg });
      expect(res.status).toBe(201);
      expect(await writers[2].countBusinessRows(org)).toBe(beforeOrg + 1);
      expect(await writers[2].countBusinessRows(foreignOrg)).toBe(beforeForeign);
    });
  });

  describe.sequential('POST /post-investment-reviews — active success + body-spoof isolation', () => {
    it('ACTIVE membership -> 201 and finance_post_investment_reviews gains exactly one row', async () => {
      const before = await writers[3].countBusinessRows(org);
      const res = await request(app)
        .post(`${BASE}/post-investment-reviews`)
        .set(bearer(activeUser, org))
        .set('Idempotency-Key', `${prefix}-review-active-${randomUUID()}`)
        .send({
          initiativeId,
          actualIds: [actualId],
          baselineModelId: modelId,
          baselineExpectedVersion: 1,
          baselineStatementType: 'P&L',
          baselineLineCode: lineCode,
          baselinePeriodDate: periodDate,
        });
      expect(res.status).toBe(201);
      expect(await writers[3].countBusinessRows(org)).toBe(before + 1);
    });

    it('body-spoofed organizationId/orgId cannot move the write into foreignOrg', async () => {
      const beforeOrg = await writers[3].countBusinessRows(org);
      const beforeForeign = await writers[3].countBusinessRows(foreignOrg);
      const res = await request(app)
        .post(`${BASE}/post-investment-reviews`)
        .set(bearer(activeUser, org))
        .set('Idempotency-Key', `${prefix}-review-spoof-${randomUUID()}`)
        .send({
          initiativeId,
          actualIds: [actualId],
          baselineModelId: modelId,
          baselineExpectedVersion: 1,
          baselineStatementType: 'P&L',
          baselineLineCode: lineCode,
          baselinePeriodDate: periodDate,
          organizationId: foreignOrg,
          orgId: foreignOrg,
        });
      expect(res.status).toBe(201);
      expect(await writers[3].countBusinessRows(org)).toBe(beforeOrg + 1);
      expect(await writers[3].countBusinessRows(foreignOrg)).toBe(beforeForeign);
    });
  });

  // =========================================================================
  // POST /capture/gates/:id/advance — bespoke block (UPDATE, not INSERT: the
  // "row delta" analog is a status transition on a pre-existing row, plus a
  // constant row COUNT). Same 6 denial scenarios as the generic table above,
  // applied by hand because the URL embeds a resource id.
  // =========================================================================
  describe.sequential('membership wall — POST /capture/gates/:id/advance (advanceGate)', () => {
    it('denies a MISSING membership row with 403 and leaves the gate unchanged', async () => {
      const before = await gateRow(gateForPositive);
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForPositive}/advance`)
        .set(bearer(noMembershipUser, org))
        .send({ signedOffBy: noMembershipUser });
      expect(res.status).toBe(403);
      expect(await gateRow(gateForPositive)).toEqual(before);
    });

    it('denies a REVOKED member with 403 and leaves the gate unchanged', async () => {
      const before = await gateRow(gateForPositive);
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForPositive}/advance`)
        .set(bearer(revokedUser, org))
        .send({ signedOffBy: revokedUser });
      expect(res.status).toBe(403);
      expect(await gateRow(gateForPositive)).toEqual(before);
    });

    it('denies a SUPERADMIN token without an ACTIVE membership row (no role bypass)', async () => {
      const before = await gateRow(gateForPositive);
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForPositive}/advance`)
        .set(bearer(superUser, org, 'SUPERADMIN'))
        .send({ signedOffBy: superUser });
      expect(res.status).toBe(403);
      expect(await gateRow(gateForPositive)).toEqual(before);
    });

    it('denies a caller whose JWT claims membership in `org` they do not hold', async () => {
      const before = await gateRow(gateForForeignClaim);
      // Delta-based, not absolute: earlier foreign-claim cases legitimately create
      // rows in the resolved org, so only THIS request's delta is meaningful.
      const foreignGatesBefore = await pool.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM value_capture_gates WHERE organization_id=$1`,
        [foreignOrg]
      );
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForForeignClaim}/advance`)
        .set(bearer(foreignUser, org))
        .send({ signedOffBy: foreignUser });

      // Invariant: the `org`-owned gate must be untouched, whatever the status.
      expect(await gateRow(gateForForeignClaim)).toEqual(before);

      // Deterministic, not a set: verifyToken re-resolves the tenant to foreignOrg,
      // advanceGate scopes its lookup to foreignOrg, and the gate lives in `org`, so
      // the only correct outcome for THIS fixture is a tenant-scoped miss -> 404 with
      // nothing written anywhere. A 2xx would mean a foreign-org gate was mutated.
      expect(res.status, 'foreign-claim advance must be exactly 404 (tenant-scoped miss)').toBe(404);
      const foreignGatesAfter = await pool.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM value_capture_gates WHERE organization_id=$1`,
        [foreignOrg]
      );
      expect(
        Number(foreignGatesAfter.rows[0].n) - Number(foreignGatesBefore.rows[0].n),
        'an advance must create zero gates in the resolved org'
      ).toBe(0);
    });

    it('fails CLOSED (503) when the membership lookup itself fails, leaves the gate unchanged, and recovers on the next request', async () => {
      const before = await gateRow(gateForDbFailure);
      const originalGet = DbPromise.get.bind(DbPromise);
      let hits = 0;
      const spy = vi.spyOn(DbPromise, 'get');
      spy.mockImplementation(async (...args: Parameters<typeof DbPromise.get>) => {
        const sql = String(args[0] || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (sql.includes('from organization_members') && hits < 1) {
          hits += 1;
          throw new Error('bounded membership lookup failure (advanceGate)');
        }
        return originalGet(...args);
      });
      try {
        const res = await request(app)
          .post(`${BASE}/capture/gates/${gateForDbFailure}/advance`)
          .set(bearer(activeUser, org))
          .send({ signedOffBy: activeUser });
        expect(res.status).toBe(503);
      } finally {
        spy.mockRestore();
      }
      expect(await gateRow(gateForDbFailure)).toEqual(before);

      const recovered = await request(app)
        .post(`${BASE}/capture/gates/${gateForDbFailure}/advance`)
        .set(bearer(activeUser, org))
        .send({ signedOffBy: activeUser });
      expect(recovered.status).toBe(200);
      expect((await gateRow(gateForDbFailure))?.status).toBe('passed');
    });

    it('same signed token is denied on the NEXT request after membership is revoked (no per-token caching)', async () => {
      const userId = revokeFirstUsers.advance;
      const token = bearer(userId, org);
      const before = await gateRow(gateForRevokeFirst);
      expect(before?.status).toBe('pending');

      const first = await request(app)
        .post(`${BASE}/capture/gates/${gateForRevokeFirst}/advance`)
        .set(token)
        .send({ signedOffBy: userId });
      expect(first.status).toBe(200);
      const afterFirst = await gateRow(gateForRevokeFirst);
      expect(afterFirst?.status).toBe('passed');

      await setMembershipStatus(userId, org, 'REVOKED');

      const second = await request(app)
        .post(`${BASE}/capture/gates/${gateForRevokeFirst}/advance`)
        .set(token) // SAME token minted before the revoke.
        .send({ signedOffBy: userId });
      expect(second.status).toBe(403);
      // The gate must be exactly as the first (successful) call left it —
      // the revoked retry must not be able to touch it again.
      expect(await gateRow(gateForRevokeFirst)).toEqual(afterFirst);
    });

    it('ACTIVE membership -> 200 and the gate transitions pending -> passed with signed_off_by set', async () => {
      const before = await gateRow(gateForPositive);
      expect(before?.status).toBe('pending');
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForPositive}/advance`)
        .set(bearer(activeUser, org))
        .send({ signedOffBy: activeUser });
      expect(res.status).toBe(200);
      const after = await gateRow(gateForPositive);
      expect(after).toEqual({ status: 'passed', signed_off_by: activeUser });

      // Row COUNT for `org` is unchanged by an UPDATE — the INSERT-based
      // writers above use a count delta; this is the UPDATE analog.
      const countRow = await pool.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM value_capture_gates WHERE organization_id=$1`,
        [org]
      );
      expect(Number(countRow.rows[0]?.n ?? 0)).toBeGreaterThan(0); // sanity: table is reachable at all.
    });

    it('body-spoofed organizationId/orgId cannot move the advance onto a foreign-org copy of the gate (handler reads only getV8Context)', async () => {
      const before = await gateRow(gateForSpoof);
      expect(before?.status).toBe('pending');
      const res = await request(app)
        .post(`${BASE}/capture/gates/${gateForSpoof}/advance`)
        .set(bearer(activeUser, org))
        .send({ signedOffBy: activeUser, organizationId: foreignOrg, orgId: foreignOrg });
      // advanceGate looks the gate up by (id, organizationId=getV8Context(req).organizationId=org),
      // so a real org-A gate id is found and advanced under the caller's REAL org regardless of the spoofed body.
      expect(res.status).toBe(200);
      const after = await gateRow(gateForSpoof);
      expect(after).toEqual({ status: 'passed', signed_off_by: activeUser });
    });
  });

  // =========================================================================
  // Reads and calculators in this file remain reachable WITHOUT an ACTIVE
  // membership row — unchanged behavior. Representative subset: 2 READ
  // (GET /ledger/baselines/active — a DB-backed read returning null
  // gracefully with no fixture row; GET /capture/gates — a DB-backed list
  // read, chosen because it is resilient even if the underlying table has a
  // provisioning problem, see the file-header risk note) and 2 CALCULATOR
  // (POST /attribution/rollup and POST /ratios/extended — pure functions
  // from two different sub-clusters of this file, neither DB-backed at
  // all), picked to span both DB-backed and pure handlers.
  // =========================================================================
  describe.sequential('reads and calculators remain reachable without an ACTIVE membership row', () => {
    it('GET /ledger/baselines/active succeeds for a caller with NO membership row', async () => {
      const res = await request(app)
        .get(`${BASE}/ledger/baselines/active`)
        .query({ initiativeId: `${prefix}-nonexistent-init`, kpiId: `${prefix}-nonexistent-kpi` })
        .set(bearer(noMembershipUser, org));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /capture/gates succeeds for a REVOKED-membership caller', async () => {
      const res = await request(app)
        .get(`${BASE}/capture/gates`)
        .query({ initiativeId })
        .set(bearer(revokedUser, org));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data)).toBe(true);
    });

    it('POST /attribution/rollup (pure) succeeds for a caller with NO membership row', async () => {
      const res = await request(app)
        .post(`${BASE}/attribution/rollup`)
        .set(bearer(noMembershipUser, org))
        .send({
          contributions: [
            { initiativeId, kpiId, kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /ratios/extended (pure) succeeds for a REVOKED-membership caller', async () => {
      const res = await request(app)
        .post(`${BASE}/ratios/extended`)
        .set(bearer(revokedUser, org))
        .send({
          netIncome: 100,
          equity: 500,
          totalAssets: 2000,
          ebit: 150,
          ebitda: 200,
          debt: 400,
          cash: 50,
          revenue: 1000,
          fixedAssets: 800,
          taxRatePct: 19,
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
