/**
 * FIN-005 P1-1 / P1-2 / P1-3 — the Finance seed FAILS CLOSED on a real
 * PostgreSQL, and reports a lost COMMIT with evidence.
 *
 * ===========================================================================
 * THE DEFECT THIS FILE EXISTS TO KEEP DEAD
 * ===========================================================================
 * The earlier build conflated "there is no PostgreSQL here" with "PostgreSQL is
 * momentarily not giving me a pinned connection". Both produced
 * `mode: 'unavailable'`, and the seed answered BOTH by promoting through a
 * NON-ATOMIC compensating path — which could still return `complete`. On a real
 * database that is the same class of defect the whole packet exists to remove,
 * and on Railway `demo` it would mean a silent degradation nobody could see.
 *
 * So: on a real PostgreSQL, every one of
 *     probe failure · checkout timeout · pool exhaustion · connection failure ·
 *     database mismatch
 * must end the Finance seed as `incomplete`, with ZERO promotion UPDATEs, and
 * WITHOUT ever touching the fallback.
 *
 * ===========================================================================
 * HOW THE FAULTS ARE INJECTED — AND WHY NOT THROUGH A PRODUCTION HOOK
 * ===========================================================================
 * Two PARTIAL module mocks, both `importOriginal`-based, so everything the seed
 * actually writes still goes to the live database:
 *
 *   - `DbPromise.all` is wrapped to fail / empty / lie about the availability
 *     probe (that one statement, matched on its sentinel alias). Every other
 *     statement passes straight through to the real implementation.
 *   - `getPoolClientForPinnedTransaction` is wrapped to refuse or stall the
 *     checkout, or to hand back a client whose `COMMIT` loses its answer.
 *
 * THE WRAPPERS ARE PLAIN FUNCTIONS, NOT `vi.fn()`, ON PURPOSE. A fully doubled
 * `DbPromise` is one of the signals `identifyNonPostgresSeam` accepts; a partial
 * mock that still writes to a real database must NOT be mistaken for one, or
 * this file would be testing the fallback instead of proving it unreachable.
 * `get` and `run` are left untouched precisely so the signal cannot match.
 *
 * ===========================================================================
 * HOW TO RUN
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_b \
 *   npx vitest run --retry=0 \
 *     server/src/services/demo/__tests__/atelierFinanceFailClosed.pg.test.ts
 *
 * `NODE_ENV=test` alone is a trap — it silently yields a MOCK database and
 * every write becomes a no-op. Without a reachable database the file SKIPS
 * loudly rather than failing a machine with no local Postgres.
 *
 * RUN THE `atelierFinance*.pg.test.ts` FILES SEQUENTIALLY
 * (`npx vitest run --retry=0 --fileParallelism=false ...`). They share one
 * database AND install triggers on `financial_statements` for the whole of it;
 * per-organization tenancy isolates the DATA, not the schema objects. Run in
 * parallel they interleave, and the failures look like adapter bugs while being
 * pure harness interference.
 */

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Fault switches, hoisted so both `vi.mock` factories can close over them. */
const fault = vi.hoisted(() => ({
  probe: null as null | 'throw' | 'empty' | 'mismatch',
  checkout: null as null | 'exhausted' | 'refused' | 'hang',
  commit: null as null | 'landed' | 'aborted' | 'mixed',
  mismatchDatabase: 'fin005_a_completely_different_database',
  mixedStatementId: '',
}));

vi.mock('../../../utils/DbPromise.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/DbPromise.js')>();
  // PLAIN function — see the header. A `vi.fn()` here would be read as a full
  // test double and would open the very fallback this file forbids.
  const all = (...args: unknown[]): Promise<unknown[]> => {
    const sql = typeof args[0] === 'string' ? args[0] : (args[1] as string | undefined);
    if (fault.probe && typeof sql === 'string' && sql.includes('pinned_probe_db')) {
      if (fault.probe === 'throw') {
        return Promise.reject(new Error('injected probe transport failure'));
      }
      if (fault.probe === 'empty') return Promise.resolve([]);
      return Promise.resolve([
        { pinned_probe_db: fault.mismatchDatabase, pinned_probe_pid: 424242 },
      ]);
    }
    return (actual.all as unknown as (...a: unknown[]) => Promise<unknown[]>)(...args);
  };
  return { ...actual, all };
});

vi.mock('../../../database/PostgresDatabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../database/PostgresDatabase.js')>();
  const getPoolClientForPinnedTransaction = async (): Promise<PoolClient> => {
    if (fault.checkout === 'exhausted') {
      throw new Error('sorry, too many clients already');
    }
    if (fault.checkout === 'refused') {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
    }
    if (fault.checkout === 'hang') {
      // Longer than the adapter's own 10s checkout deadline, which is the thing
      // under test: the deadline must fire and the call must refuse.
      await new Promise((resolve) => setTimeout(resolve, 45_000));
      throw new Error('the stalled checkout should never get this far');
    }
    const client = await actual.getPoolClientForPinnedTransaction();
    return fault.commit ? withLostCommitAck(client) : client;
  };
  return { ...actual, getPoolClientForPinnedTransaction };
});

/**
 * A client whose `COMMIT` does what the fault says and then loses its answer —
 * the in-doubt case, staged exactly: the database state is decided BEFORE the
 * error, so the reconciliation has something real to find.
 */
function withLostCommitAck(client: PoolClient): PoolClient {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'query') {
        return async (sql: unknown, params?: unknown[]) => {
          if (typeof sql === 'string' && sql.trim().toUpperCase() === 'COMMIT') {
            if (fault.commit === 'aborted') {
              await target.query('ROLLBACK');
            } else if (fault.commit === 'mixed') {
              await target.query(
                `UPDATE financial_statements
                    SET status = 'imported', validation_status = 'pending',
                        readiness_status = 'pending'
                  WHERE id = $1`,
                [fault.mixedStatementId]
              );
              await target.query('COMMIT');
            } else {
              await target.query('COMMIT');
            }
            throw new Error('Connection terminated unexpectedly');
          }
          return target.query(sql as string, params as unknown[]);
        };
      }
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  }) as PoolClient;
}

import fs from 'fs';
import os from 'os';
import path from 'path';

import logger from '../../../utils/Logger.js';
import {
  decidePinnedTransactionSeam,
  identifyNonPostgresSeam,
} from '../atelierFinancePromotionTransaction.js';
import {
  acknowledgeAtelierFinanceCommitIndeterminate,
  type AtelierCanonicalIds,
  atelierFinanceOperatorHoldPath,
  getAtelierFinanceCanonicalIds,
  readAtelierFinanceOperatorHold,
  readAtelierFinancePromotionMarker,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

// The NEEDS_OPERATOR hold is a FILE. Point it at a scratch directory so this
// suite cannot leave one under the repository (or, worse, inherit one).
process.env.ATELIER_FINANCE_HOLD_DIR =
  process.env.ATELIER_FINANCE_HOLD_DIR ??
  fs.mkdtempSync(path.join(os.tmpdir(), 'fin005-holds-'));

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HEALTHY_SCHEMA = REACHABLE ? await hasReadinessColumns(CONNECTION_STRING) : false;

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function hasReadinessColumns(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_statements'
          AND column_name IN ('readiness_status', 'readiness_score')`
    );
    return Number(result.rows[0]?.present ?? 0) === 2;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE || !HEALTHY_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 fail-closed suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} migrated=${HEALTHY_SCHEMA}`
  );
}

const ORG_PREFIX = 'fin005-fail-closed';
const ORG_KEYS = [
  'seam',
  'probe-throws',
  'probe-empty',
  'db-mismatch',
  'pool-exhausted',
  'connect-refused',
  'checkout-timeout',
  'commit-landed',
  'commit-aborted',
  'commit-mixed',
  'commit-stale-flags',
  'mock-db-true',
] as const;

type OrgKey = (typeof ORG_KEYS)[number];

const orgFor = (key: OrgKey): string => `${ORG_PREFIX}-${key}`;
const idsFor = (key: OrgKey): AtelierCanonicalIds => getAtelierFinanceCanonicalIds(orgFor(key));

let control: Pool;

/**
 * Drop every NEEDS_OPERATOR hold AND every blocking promotion marker this
 * suite's tenants could be holding.
 *
 * Goes through the real, attributed acknowledgement (FIN-005 P1-B #11) rather
 * than unlinking files: the suite exercises the operator API the runbook names,
 * so a change to that API cannot leave the suite passing against a door nobody
 * uses.
 */
function clearAllHolds(): void {
  for (const key of ORG_KEYS) {
    try {
      acknowledgeAtelierFinanceCommitIndeterminate(orgFor(key), {
        operator: 'fin005-suite',
        decision: 'other',
        note: 'suite reset between tests; no operator decision is being recorded here',
      });
    } catch {
      /* nothing to clear */
    }
  }
}

const suite = REACHABLE && HEALTHY_SCHEMA ? describe.sequential : describe.skip;

suite('FIN-005 — the Finance seed fails closed on a real PostgreSQL', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    for (const key of ORG_KEYS) {
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [orgFor(key), `FIN-005 fail-closed fixture (${key})`]
      );
    }
  }, 120_000);

  afterAll(async () => {
    clearAllHolds();
    if (!control) return;
    for (const key of ORG_KEYS) {
      await deleteFixture(idsFor(key)).catch(() => undefined);
      await control
        .query(`DELETE FROM organizations WHERE id = $1`, [orgFor(key)])
        .catch(() => undefined);
    }
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  beforeEach(() => {
    fault.probe = null;
    fault.checkout = null;
    fault.commit = null;
    fault.mixedStatementId = '';
    // A hold left by a previous test (or a previous, aborted run of this file)
    // would block every later seed for that tenant. Clear them all: the one test
    // that cares about a hold creates its own inside the test body.
    clearAllHolds();
  });

  // -------------------------------------------------------------------------
  // The seam is identified POSITIVELY, and NODE_ENV is not one of the signals.
  // -------------------------------------------------------------------------

  it(
    'does NOT recognise a seam here, even though NODE_ENV === "test"',
    async () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.MOCK_DB).toBe('false');
      const seam = await identifyNonPostgresSeam();
      expect(seam.recognised, `seam said: ${seam.signal}`).toBe(false);
      // The evidence is stated, not assumed — including that the PARTIAL mock in
      // this very file is not mistaken for a full test double.
      expect(seam.signal).toMatch(/DbPromise get\/all\/run are real functions/);
      expect(seam.signal).toMatch(/MOCK_DB=false/);
    },
    60_000
  );

  it(
    'asking the seam question INSTALLS NOTHING — it is a read, not a command',
    async () => {
      // `getDatabaseInstance()` creates and installs the process-wide singleton
      // when none exists. The seam predicate used to call it, so a read-only
      // question changed the process. It now peeks at what is already there.
      const KEY = '__CONSULTIFY_GLOBAL_DB_INSTANCE__';
      const holder = process as unknown as Record<string, unknown>;
      const globalHolder = globalThis as unknown as Record<string, unknown>;
      const savedProcess = holder[KEY];
      const savedGlobal = globalHolder[KEY];
      try {
        delete holder[KEY];
        delete globalHolder[KEY];
        const seam = await identifyNonPostgresSeam();
        expect(holder[KEY], 'the seam question must not install a database').toBeUndefined();
        expect(globalHolder[KEY], 'the seam question must not install a database').toBeUndefined();
        expect(seam.recognised, `seam said: ${seam.signal}`).toBe(false);
        expect(seam.signal).toMatch(/no database instance is installed yet/);
      } finally {
        if (savedProcess !== undefined) holder[KEY] = savedProcess;
        if (savedGlobal !== undefined) globalHolder[KEY] = savedGlobal;
      }
    },
    60_000
  );

  // -------------------------------------------------------------------------
  // FIN-005 P1-1b — the falsified claim, kept dead.
  //
  // `MOCK_DB=true` used to be an accepted seam signal, on the stated grounds
  // that `Database.ts` treats it as its primary mock switch. It does — inside
  // `createDatabase()`, which `DbPromise` never calls. `DbPromise` resolves
  // through `getDatabaseInstance()`, and THAT honours `MOCK_DB` only when
  // `NODE_ENV === 'test'` and `RUN_DB_TESTS !== '1'`. This process is the
  // counter-example: `MOCK_DB=true` here, and every write still lands in a real
  // PostgreSQL. The seam used to say "mock", the seed took the non-atomic path,
  // and it could still return `complete`.
  //
  // BEFORE THE FIX these two tests fail: `identifyNonPostgresSeam()` returned
  // `recognised: true` on the env var alone, and `decidePinnedTransactionSeam()`
  // did not exist. Verified by running them against the previous commit.
  // -------------------------------------------------------------------------

  it(
    'IGNORES MOCK_DB=true — an env var is a claim about intent, never evidence about the database',
    async () => {
      const previous = process.env.MOCK_DB;
      process.env.MOCK_DB = 'true';
      try {
        const seam = await identifyNonPostgresSeam();
        expect(
          seam.recognised,
          `MOCK_DB must not open the non-atomic path; seam said: ${seam.signal}`
        ).toBe(false);
        expect(seam.signal).toMatch(/MOCK_DB=true \(IGNORED/);
      } finally {
        process.env.MOCK_DB = previous;
      }
    },
    60_000
  );

  it(
    'asks the DATABASE first: with MOCK_DB=true the decision is still "postgres", never "seam"',
    async () => {
      const previous = process.env.MOCK_DB;
      process.env.MOCK_DB = 'true';
      try {
        const decision = await decidePinnedTransactionSeam();
        expect(decision.outcome, `decision evidence: ${decision.seam.signal}`).toBe('postgres');
        if (decision.outcome === 'postgres') {
          expect(decision.probe.supported).toBe(true);
          expect(decision.probe.database).toBeTruthy();
        }
      } finally {
        process.env.MOCK_DB = previous;
      }
    },
    60_000
  );

  it(
    'MOCK_DB=true on a real PostgreSQL still promotes through the PINNED transaction',
    async () => {
      const ids = await seedThenDemote('mock-db-true');

      const previous = process.env.MOCK_DB;
      const warn = vi.spyOn(logger, 'warn');
      let result: Awaited<ReturnType<typeof seed>>;
      let warnLines: string[];
      try {
        process.env.MOCK_DB = 'true';
        result = await seed('mock-db-true');
      } finally {
        process.env.MOCK_DB = previous;
        warnLines = warn.mock.calls.map((call) => String(call[0]));
        warn.mockRestore();
      }

      expect(result.status, result.reason ?? '').toBe('complete');
      // THE TEETH. Before the fix this line was present and the fixture was
      // promoted by five separate autocommitted UPDATEs on a real database.
      expect(
        warnLines.some((line) => line.includes('WITHOUT a pinned transaction')),
        'a stray MOCK_DB=true must not be able to open the non-atomic path'
      ).toBe(false);
      await expectFixtureFullyReady(ids);
    },
    180_000
  );

  // -------------------------------------------------------------------------
  // Every way a pinned transaction can fail to exist on a REAL database.
  // -------------------------------------------------------------------------

  const refusals: Array<{
    name: string;
    key: OrgKey;
    arm: () => void;
    reason: RegExp;
    timeoutMs: number;
  }> = [
    {
      name: 'the availability probe THROWS',
      key: 'probe-throws',
      arm: () => {
        fault.probe = 'throw';
      },
      reason: /the availability probe failed on a database that is NOT a recognised test seam/,
      timeoutMs: 180_000,
    },
    {
      name: 'the availability probe answers with NO rows',
      key: 'probe-empty',
      arm: () => {
        fault.probe = 'empty';
      },
      reason: /the availability probe failed on a database that is NOT a recognised test seam/,
      timeoutMs: 180_000,
    },
    {
      name: 'the pinned client turns out to be on a DIFFERENT database',
      key: 'db-mismatch',
      arm: () => {
        fault.probe = 'mismatch';
      },
      reason: /pinned connection is on database .* but the service layer reports/,
      timeoutMs: 180_000,
    },
    {
      name: 'the pool is EXHAUSTED',
      key: 'pool-exhausted',
      arm: () => {
        fault.checkout = 'exhausted';
      },
      reason: /could not check out a (pinned connection|client from the authorised write pool): sorry, too many clients already/,
      timeoutMs: 180_000,
    },
    {
      name: 'the CONNECTION fails',
      key: 'connect-refused',
      arm: () => {
        fault.checkout = 'refused';
      },
      reason: /could not check out a (pinned connection|client from the authorised write pool): connect ECONNREFUSED/,
      timeoutMs: 180_000,
    },
    {
      name: 'the pool CHECKOUT never completes',
      key: 'checkout-timeout',
      arm: () => {
        fault.checkout = 'hang';
      },
      reason: /could not check out a (pinned connection|client from the authorised write pool): pool checkout did not complete within/,
      timeoutMs: 180_000,
    },
  ];

  for (const refusal of refusals) {
    it(
      `REFUSES and issues ZERO promotions when ${refusal.name}`,
      async () => {
        const ids = await seedThenDemote(refusal.key);

        const warn = vi.spyOn(logger, 'warn');
        let result: Awaited<ReturnType<typeof seed>>;
        let warnLines: string[];
        const startedAt = Date.now();
        try {
          refusal.arm();
          result = await seed(refusal.key);
        } finally {
          fault.probe = null;
          fault.checkout = null;
          // Capture BEFORE restoring: `mockRestore` clears the history, and an
          // assertion made after it is an assertion against an empty array —
          // i.e. a `toBe(false)` that can never fail.
          warnLines = warn.mock.calls.map((call) => String(call[0]));
          warn.mockRestore();
        }
        const elapsed = Date.now() - startedAt;

        expect(result.status).toBe('incomplete');
        // TWO GATES CAN REFUSE, and both are fail-closed with zero promotion
        // UPDATEs. FIN-005 P1-A added the earlier one: the DECISIVE READ SESSION
        // is opened before the schema probe, so a probe failure or a pool that
        // will not hand out a client now stops the run BEFORE a single statement
        // is issued rather than after phase 1 has written the not-ready fixture.
        // The pinned transaction's own refusal is still reachable for faults that
        // only bite at promotion time (the database divergence below).
        expect(result.reason).toMatch(
          /^(pinned promotion transaction REFUSED \(fail-closed, zero promotion UPDATEs issued\): |refusing to run: decisive reads could not be bound to the primary: )/
        );
        expect(result.reason).toMatch(refusal.reason);
        expect(result.statementIds).toEqual([]);
        expect(elapsed, 'a refusal must return in bounded time').toBeLessThan(60_000);

        // TEETH — the whole point of P1-1. The fallback must never announce
        // itself on a real database.
        expect(warnLines.length, 'the spy must actually have observed the run').toBeGreaterThan(0);
        expect(
          warnLines.some((line) => line.includes('WITHOUT a pinned transaction')),
          'the seed must NOT have degraded to the non-atomic path'
        ).toBe(false);

        // ZERO promotion UPDATEs: read the rows straight out of the database.
        await expectNoPartialReady(ids);
        expect(result.promotion?.statementPromotionsIssued).toBe(0);
        expect(result.promotion?.analysisPromotionIssued).toBe(false);
        expect(result.promotion?.packPromotionIssued).toBe(false);

        // ...and the fixture still recovers once the fault is gone.
        const recovery = await seed(refusal.key);
        expect(recovery.status, recovery.reason ?? '').toBe('complete');
        await expectFixtureFullyReady(ids);
      },
      refusal.timeoutMs
    );
  }

  // -------------------------------------------------------------------------
  // A LOST COMMIT ACK, end to end through the seed — FIN-005 P1-3.
  // -------------------------------------------------------------------------

  it(
    'a lost COMMIT ACK over a transaction that DID commit ends the seed COMPLETE, on evidence',
    async () => {
      const ids = await seedThenDemote('commit-landed');

      const info = vi.spyOn(logger, 'info');
      let result: Awaited<ReturnType<typeof seed>>;
      let infoLines: string[];
      try {
        fault.commit = 'landed';
        result = await seed('commit-landed');
      } finally {
        infoLines = info.mock.calls.map((call) => String(call[0]));
        info.mockRestore();
        fault.commit = null;
      }

      expect(result.status, result.reason ?? '').toBe('complete');
      expect(
        infoLines.some((line) => line.includes('commit ack lost-then-confirmed')),
        'the seed must record that the ack was lost and then PROVED'
      ).toBe(true);

      await expectFixtureFullyReady(ids);
    },
    180_000
  );

  it(
    'a lost COMMIT ACK over a transaction that did NOT commit is reported rolled back, with evidence',
    async () => {
      const ids = await seedThenDemote('commit-aborted');

      let result: Awaited<ReturnType<typeof seed>>;
      try {
        fault.commit = 'aborted';
        result = await seed('commit-aborted');
      } finally {
        fault.commit = null;
      }

      expect(result.status).toBe('incomplete');
      expect(result.reason).toMatch(/reconciliation proved it did NOT/);
      expect(result.reason).toMatch(
        /all 5 promoted records read back in their pre-promotion state on a fresh connection/
      );
      await expectNoPartialReady(ids);

      const recovery = await seed('commit-aborted');
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady(ids);
    },
    180_000
  );

  // -------------------------------------------------------------------------
  // FIN-005 P1-3b — the `committed` direction used to rest on FLAGS.
  //
  // `claimsReady` is an OR over three columns, and the coherence re-run
  // (`planAtelierPromotion`) never reads `pack_readiness_score`,
  // `source_statement_count` or `missing_statement_types`. So a fixture whose
  // rows were ALREADY ready-looking from an earlier run reconciled to
  // `lost-then-confirmed` even when the transaction had genuinely rolled back,
  // and the seed returned COMPLETE over a pack that says it is ready while
  // scoring 0 and listing all three statement types as missing.
  //
  // BEFORE THE FIX this test fails on the FIRST assertion: the seed returns
  // `complete`. Verified by running it against the previous commit.
  // -------------------------------------------------------------------------
  it(
    'a lost COMMIT ACK over a ROLLBACK of an already-ready-looking fixture is NOT "confirmed" — the pre-state decides',
    async () => {
      const ids = idsFor('commit-stale-flags');
      await deleteFixture(ids);
      const first = await seed('commit-stale-flags');
      expect(first.status, first.reason ?? '').toBe('complete');

      // Leave every readiness FLAG looking promoted and break only the columns
      // no flag check reads. This is what an interrupted older build leaves
      // behind, and it is not the state the promotion intends.
      await control.query(
        `UPDATE financial_statement_packs
            SET pack_readiness_score = 0,
                source_statement_count = 0,
                missing_statement_types = '["P&L","BS","CF"]'
          WHERE id = $1`,
        [ids.packId]
      );

      let result: Awaited<ReturnType<typeof seed>>;
      try {
        fault.commit = 'aborted';
        result = await seed('commit-stale-flags');
      } finally {
        fault.commit = null;
      }

      // The transaction really did roll back, and the reconciliation says so on
      // the strength of the pre-state snapshot rather than of five flags.
      expect(result.status, result.reason ?? '').toBe('incomplete');
      expect(result.reason).toMatch(/reconciliation proved it did NOT/);
      expect(result.reason).toMatch(
        /every promotion-owned column matches the snapshot taken under the FOR UPDATE locks/
      );

      // And the evidence that the old verdict was WRONG, not merely imprecise:
      // the pack still carries the incoherent numbers the "committed" verdict
      // would have blessed as a complete fixture.
      const pack = await control.query(
        `SELECT pack_status, pack_readiness_status, pack_readiness_score, source_statement_count,
                missing_statement_types
           FROM financial_statement_packs WHERE id = $1`,
        [ids.packId]
      );
      expect(pack.rows[0]?.pack_status).toBe('confirmed');
      expect(pack.rows[0]?.pack_readiness_status).toBe('ready');
      expect(Number(pack.rows[0]?.pack_readiness_score)).toBe(0);
      expect(Number(pack.rows[0]?.source_statement_count)).toBe(0);

      // No hold: `not-committed` is a decided outcome, not an in-doubt one.
      expect(readAtelierFinanceOperatorHold(orgFor('commit-stale-flags'))).toBeNull();

      // ...and the fixture recovers on the next, fault-free run.
      const recovery = await seed('commit-stale-flags');
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady(ids);
      const healed = await control.query(
        `SELECT pack_readiness_score, source_statement_count FROM financial_statement_packs WHERE id = $1`,
        [ids.packId]
      );
      expect(Number(healed.rows[0]?.pack_readiness_score)).toBe(100);
      expect(Number(healed.rows[0]?.source_statement_count)).toBe(3);
    },
    180_000
  );

  it(
    'a lost COMMIT ACK over a MIXED result is NEEDS_OPERATOR — never complete, never "rolled back"',
    async () => {
      const ids = await seedThenDemote('commit-mixed');

      let result: Awaited<ReturnType<typeof seed>>;
      try {
        fault.commit = 'mixed';
        fault.mixedStatementId = ids.statementIds[0];
        result = await seed('commit-mixed');
      } finally {
        fault.commit = null;
        fault.mixedStatementId = '';
      }

      expect(result.status).toBe('incomplete');
      expect(result.reason).toMatch(/COMMIT INDETERMINATE — NEEDS_OPERATOR/);
      expect(result.reason).toMatch(/MIXED state after a lost COMMIT ack: 4\/5/);
      // No compensating demotion was attempted, and none was claimed.
      expect(result.promotion?.rolledBack).toBe(false);
      expect(result.promotion?.rowsStillClaimingReady).toHaveLength(4);

      // ---------------------------------------------------------------------
      // FIN-005 P1-3c — the verdict SURVIVES, and the next run does not erase it.
      //
      // BEFORE THE FIX this block read `const recovery = await seed(...);
      // expect(recovery.status).toBe('complete')` — the suite asserted the
      // silent erasure as if it were a feature. Nothing persisted the verdict,
      // so the next run's phase 0 saw the mixed residue, demoted it,
      // re-promoted and returned `complete`. A NEEDS_OPERATOR that clears
      // itself is not NEEDS_OPERATOR.
      // ---------------------------------------------------------------------
      const holdFile = atelierFinanceOperatorHoldPath(orgFor('commit-mixed'));
      expect(fs.existsSync(holdFile), 'the in-doubt verdict must be on disk').toBe(true);
      const hold = readAtelierFinanceOperatorHold(orgFor('commit-mixed'));
      expect(hold?.rowsClaimingReady).toHaveLength(4);
      expect(hold?.reconciliation).toMatch(/MIXED state after a lost COMMIT ack: 4\/5/);
      // The instruction names the ATTRIBUTED acknowledgement, and says in so
      // many words that deleting the file by hand is not it.
      expect(hold?.acknowledgement).toMatch(/acknowledgeAtelierFinanceCommitIndeterminate/);
      expect(hold?.acknowledgement).toMatch(/Do NOT simply delete/);

      // FIN-005 P1-B — the promotion marker is in NEEDS_OPERATOR as well, and
      // carries the run id, the five row ids and the target it ran against.
      const marker = readAtelierFinancePromotionMarker(orgFor('commit-mixed'));
      expect(marker?.state).toBe('NEEDS_OPERATOR');
      expect(marker?.rowIds).toHaveLength(5);
      expect(marker?.target.database).toBeTruthy();

      // Snapshot the residue: the blocked run must not touch a single row.
      const residueBefore = await residueSnapshot(ids);

      const blocked = await seed('commit-mixed');
      expect(blocked.status).toBe('incomplete');
      expect(blocked.reason).toMatch(/NEEDS_OPERATOR — refusing to run/);
      expect(blocked.reason).toMatch(/has not been acknowledged/);
      expect(await residueSnapshot(ids), 'a blocked run must heal nothing').toEqual(residueBefore);

      // A SECOND blocked run behaves identically — the hold does not decay.
      const blockedAgain = await seed('commit-mixed');
      expect(blockedAgain.status).toBe('incomplete');
      expect(await residueSnapshot(ids)).toEqual(residueBefore);

      // The operator investigates, then acknowledges. Only now may the fixture
      // be healed and READY re-earned.
      const ack = acknowledgeAtelierFinanceCommitIndeterminate(orgFor('commit-mixed'), {
        operator: 'fin005-suite',
        decision: 'commit-did-not-land',
        note: 'reconciliation showed a MIXED state; the residue was inspected and re-seeding is authorised',
      });
      expect(ack.cleared).toBe(true);
      // The audit record is written BEFORE anything is cleared, and it names who
      // decided what.
      const audit = JSON.parse(fs.readFileSync(ack.auditPath as string, 'utf8'));
      expect(audit.operator).toBe('fin005-suite');
      expect(audit.decision).toBe('commit-did-not-land');
      expect(audit.clearedHold).toBeTruthy();
      expect(fs.existsSync(holdFile)).toBe(false);
      expect(readAtelierFinancePromotionMarker(orgFor('commit-mixed'))).toBeNull();

      const recovery = await seed('commit-mixed');
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady(ids);
    },
    180_000
  );

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function seed(key: OrgKey) {
    return upsertAtelierFinanceGoldenFlow({ organizationId: orgFor(key), createdBy: null });
  }

  async function seedThenDemote(key: OrgKey): Promise<AtelierCanonicalIds> {
    const ids = idsFor(key);
    await deleteFixture(ids);
    const first = await seed(key);
    expect(first.status, first.reason ?? '').toBe('complete');
    await demoteFixture(ids);
    await expectNoPartialReady(ids);
    return ids;
  }

  async function deleteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`DELETE FROM financial_analyses WHERE id = $1`, [ids.analysisId]);
    await control.query(`DELETE FROM financial_statements WHERE id = ANY($1::text[])`, [
      ids.statementIds,
    ]);
    await control.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [ids.packId]);
  }

  async function demoteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `UPDATE financial_statements
          SET status = 'imported', validation_status = 'pending',
              readiness_status = 'pending', readiness_score = 0
        WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`UPDATE financial_analyses SET status = 'DRAFT' WHERE id = $1`, [
      ids.analysisId,
    ]);
    await control.query(
      `UPDATE financial_statement_packs
          SET pack_status = 'draft', pack_readiness_status = 'pending', pack_readiness_score = 0
        WHERE id = $1`,
      [ids.packId]
    );
  }

  /**
   * Every promotion-owned column of the five rows, plus `updated_at`. Used to
   * prove that a run blocked by an unacknowledged hold changed NOTHING — not
   * the readiness flags, not a timestamp.
   */
  async function residueSnapshot(ids: AtelierCanonicalIds): Promise<unknown> {
    const statements = await control.query(
      `SELECT id, status, validation_status, validation_messages, readiness_status, readiness_score,
              quality_summary, quality_reason_codes, confirmed_by, updated_at
         FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids.statementIds]
    );
    const analysis = await control.query(
      `SELECT id, status, approved_by, approved_at, updated_at FROM financial_analyses WHERE id = $1`,
      [ids.analysisId]
    );
    const pack = await control.query(
      `SELECT id, pack_status, pack_readiness_status, pack_readiness_score, pack_quality_summary,
              pack_quality_reason_codes, source_statement_count, missing_statement_types, updated_at
         FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    return { statements: statements.rows, analysis: analysis.rows, pack: pack.rows };
  }

  async function expectNoPartialReady(ids: AtelierCanonicalIds): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).not.toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).not.toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).not.toBe('ready');
    }
    const analysis = await control.query(`SELECT status FROM financial_analyses WHERE id = $1`, [
      ids.analysisId,
    ]);
    for (const row of analysis.rows) expect(row.status).not.toBe('APPROVED');
    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    for (const row of pack.rows) {
      expect(row.pack_status).not.toBe('confirmed');
      expect(row.pack_readiness_status).not.toBe('ready');
    }
  }

  async function expectFixtureFullyReady(ids: AtelierCanonicalIds): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids.statementIds]
    );
    expect(statements.rows).toHaveLength(ids.statementIds.length);
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).toBe('ready');
    }
    const analysis = await control.query(`SELECT status FROM financial_analyses WHERE id = $1`, [
      ids.analysisId,
    ]);
    expect(analysis.rows[0]?.status).toBe('APPROVED');
    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    expect(pack.rows[0]?.pack_status).toBe('confirmed');
    expect(pack.rows[0]?.pack_readiness_status).toBe('ready');
  }
});
