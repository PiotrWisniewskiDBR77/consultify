/**
 * Readiness contract — negative controls.
 *
 * Exercises the REAL exported production units:
 *   - establishDatabaseReadiness (server/src/startup/databaseReadiness.ts)
 *   - createReadyHandler / createMigrationsHealthHandler (server/src/startup/readinessRoutes.ts)
 *   - evaluateSqlChain (the shared evaluator the release gate also uses)
 * No copy of the logic is rebuilt in this file.
 *
 * Why these exist: before this wave readiness validated ONLY tp_migration_history. /api/ready
 * could answer 200 while the SQL chain had failed rows, skipped rows, pending migrations or
 * unexplained checksum drift.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  establishDatabaseReadiness,
  type ReadinessDeps,
  type SqlMigrationStatus,
} from '../../../startup/databaseReadiness.js';
import { createMigrationsHealthHandler, createReadyHandler } from '../../../startup/readinessRoutes.js';
import { evaluateSqlChain, isSqlChainAcceptable, type SqlChainEvaluation } from '../sqlChainEvaluator.js';

const okSql = (over: Partial<SqlChainEvaluation> = {}): SqlChainEvaluation => ({
  state: 'ok',
  ledgerPresent: true,
  failed: [],
  skipped: [],
  pending: [],
  unexplainedDrift: [],
  approvedVariants: [],
  attestedLegacyVariants: [],
  unverifiable: [],
  detail: 'chain complete',
  ...over,
});

const baseDeps = (over: Partial<ReadinessDeps> = {}): ReadinessDeps => ({
  initializeSchema: async () => ({ success: true, message: 'ok' }),
  runMigrations: async () =>
    ({ applied: 0, skipped: 3, failed: null, failedFile: null, total: 3, checksumMismatches: [], acceptedHistoricalChecksumVariants: [] }) as any,
  seedTemplates: async () => {},
  isProduction: false,
  migrationsDisabled: false,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  evaluateSqlChain: async () => okSql(),
  ...over,
});

/** Minimal express double so we assert the REAL handlers' status codes. */
function callHandler(handler: any, state: any) {
  let status = 0;
  let body: any = null;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: any) {
      body = payload;
      return this;
    },
  };
  handler({} as any, res as any, (() => {}) as any);
  return { status, body, get: () => ({ status, body }) };
}

const stateFrom = (outcome: any, buildSha = 'abcdef1234') => ({
  dbReady: outcome.ready,
  dbInitError: outcome.error,
  migrations: outcome.migrations,
  sqlMigrations: outcome.sqlMigrations as SqlMigrationStatus,
  buildSha,
});

describe('readiness — PASS path', () => {
  it('is ready and answers 200 when both ledgers are ok', async () => {
    const outcome = await establishDatabaseReadiness(baseDeps());
    expect(outcome.ready).toBe(true);
    expect(outcome.sqlMigrations.state).toBe('ok');

    const ready = callHandler(createReadyHandler(() => stateFrom(outcome)), null);
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');
    // required response fields
    expect(ready.body).toHaveProperty('buildSha', 'abcdef1234');
    expect(ready.body.sqlMigrations).toMatchObject({
      state: 'ok',
      failed: 0,
      skipped: 0,
      pending: 0,
      unexplainedDrift: 0,
    });
    expect(ready.body).toHaveProperty('migrations');
    expect(ready.body).toHaveProperty('timestamp');
    // never leak connection details
    expect(JSON.stringify(ready.body)).not.toMatch(/postgres(ql)?:\/\//);
  });

  it('reports attested legacy variants without failing readiness', async () => {
    const outcome = await establishDatabaseReadiness(
      baseDeps({
        evaluateSqlChain: async () =>
          okSql({ attestedLegacyVariants: ['730_partner_users_uuid_columns.sql'] }),
      })
    );
    expect(outcome.ready).toBe(true);
    expect(outcome.sqlMigrations.attestedLegacyVariants).toBe(1);
  });
});

describe('readiness — every SQL-chain fault must yield 503', () => {
  const cases: Array<[string, Partial<SqlChainEvaluation>]> = [
    ['failed SQL migration', { state: 'failed', failed: ['x.sql'], detail: '1 failed' }],
    ['skipped migration', { state: 'skipped', skipped: ['x.sql'], detail: '1 skipped' }],
    ['pending migration', { state: 'pending', pending: ['x.sql'], detail: '1 pending' }],
    ['unexplained drift', { state: 'unexplained_drift', unexplainedDrift: ['x.sql'], detail: 'drift' }],
    ['missing SQL ledger', { state: 'ledger_missing', ledgerPresent: false, detail: 'no ledger' }],
    ['evaluator error', { state: 'error', detail: 'boom' }],
  ];

  for (const [name, over] of cases) {
    it(`${name} -> not ready and /api/ready 503`, async () => {
      const outcome = await establishDatabaseReadiness(
        baseDeps({ evaluateSqlChain: async () => okSql(over) })
      );
      expect(outcome.ready, name).toBe(false);
      const ready = callHandler(createReadyHandler(() => stateFrom(outcome)), null);
      expect(ready.status, name).toBe(503);
      expect(ready.body.status).toBe('not_ready');
    });
  }

  it('an evaluator that THROWS fails closed rather than passing', async () => {
    const outcome = await establishDatabaseReadiness(
      baseDeps({
        evaluateSqlChain: async () => {
          throw new Error('connection reset');
        },
      })
    );
    expect(outcome.ready).toBe(false);
    expect(outcome.sqlMigrations.state).toBe('error');
    expect(callHandler(createReadyHandler(() => stateFrom(outcome)), null).status).toBe(503);
  });

  it('a MISSING evaluator fails closed — absence of proof is not proof', async () => {
    const deps = baseDeps();
    delete (deps as any).evaluateSqlChain;
    const outcome = await establishDatabaseReadiness(deps);
    expect(outcome.ready).toBe(false);
    expect(outcome.error).toMatch(/evaluator not configured/i);
  });
});

describe('readiness — Table Platform faults still yield 503', () => {
  it('TP migration failed -> 503', async () => {
    const outcome = await establishDatabaseReadiness(
      baseDeps({
        runMigrations: async () => ({ applied: 0, skipped: 0, failed: 'boom', failedFile: 'x.sql', total: 1, checksumMismatches: [], acceptedHistoricalChecksumVariants: [] }) as any,
      })
    );
    expect(outcome.ready).toBe(false);
    expect(callHandler(createReadyHandler(() => stateFrom(outcome)), null).status).toBe(503);
  });

  it('disabled_by_operator -> 503, never an open door', async () => {
    const outcome = await establishDatabaseReadiness(baseDeps({ migrationsDisabled: true }));
    expect(outcome.ready).toBe(false);
    expect(outcome.migrations.state).toBe('disabled_by_operator');
    expect(callHandler(createReadyHandler(() => stateFrom(outcome)), null).status).toBe(503);
  });

  it('TP checksum drift -> 503', async () => {
    const outcome = await establishDatabaseReadiness(
      baseDeps({
        runMigrations: async () => ({ applied: 0, skipped: 0, failed: null, failedFile: null, total: 1, checksumMismatches: ['x.sql'], acceptedHistoricalChecksumVariants: [] }) as any,
      })
    );
    expect(outcome.ready).toBe(false);
    expect(callHandler(createReadyHandler(() => stateFrom(outcome)), null).status).toBe(503);
  });
});

describe('/api/health/migrations requires BOTH ledgers', () => {
  it('degrades to 503 when only the SQL chain is unhealthy', async () => {
    const outcome = await establishDatabaseReadiness(baseDeps());
    const state = stateFrom(outcome);
    // Force the SQL half unhealthy while TP stays ok.
    const broken = { ...state, sqlMigrations: { ...state.sqlMigrations, state: 'pending' as const } };
    const health = callHandler(createMigrationsHealthHandler(() => broken as any), null);
    expect(health.status).toBe(503);
    expect(health.body.status).toBe('degraded');
  });

  it('is 200 only when both are ok', async () => {
    const outcome = await establishDatabaseReadiness(baseDeps());
    const health = callHandler(createMigrationsHealthHandler(() => stateFrom(outcome) as any), null);
    expect(health.status).toBe(200);
    expect(health.body.sqlMigrations.state).toBe('ok');
    expect(health.body).toHaveProperty('buildSha');
  });
});

describe('shared evaluator — one implementation, not a test copy', () => {
  it('reports ledger_missing (fail closed) when schema_migrations does not exist', async () => {
    const db = { query: vi.fn(async () => ({ rows: [{ present: false }] })) };
    const e = await evaluateSqlChain({ db: db as any, migrationsDir: process.cwd() });
    expect(e.state).toBe('ledger_missing');
    expect(isSqlChainAcceptable(e)).toBe(false);
  });

  it('returns state "error" (never ok) when the query layer throws', async () => {
    const db = {
      query: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    const e = await evaluateSqlChain({ db: db as any, migrationsDir: process.cwd() });
    expect(e.state).toBe('error');
    expect(isSqlChainAcceptable(e)).toBe(false);
  });
});
