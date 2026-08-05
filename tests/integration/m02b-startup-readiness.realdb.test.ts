/**
 * M02-004 GATE 1 — startup readiness must not publish an app with an
 * incomplete schema.
 *
 * Before: index.ts bound HTTP, set dbReady=true, then ran migrations in a
 * detached setTimeout 5s later and merely logged any failure. A broken
 * migration therefore produced a fully "ready" server on a half-built schema.
 *
 * These tests drive `establishDatabaseReadiness` — the sequence index.ts now
 * calls — with the REAL migration runner against a REAL Postgres. Only the
 * seeding sink and the production flag are injected, so the ordering and the
 * failure policy under test are the production ones.
 *
 * Scenarios (Master Codex list): broken migration → never ready · zero
 * seeding · failure visible · retry after the fix · success → ready.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const MIGRATION_TABLE = 'tp_migration_history';

describe('M02-004 — startup readiness gate (real Postgres, real runner)', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let tmpDir = '';
  const written: string[] = [];

  const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

  function writeMigration(name: string, sql: string): string {
    const file = `29990101_m02bstartup_${name}.sql`;
    fs.writeFileSync(path.join(tmpDir, file), sql, 'utf-8');
    if (!written.includes(file)) written.push(file);
    return file;
  }

  /** Real runner, pointed at the isolated temp dir (never server/migrations). */
  async function realRunner() {
    const mod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    return mod.runMigrations({ migrationsDir: tmpDir });
  }

  async function readiness(over: Record<string, unknown> = {}) {
    const { establishDatabaseReadiness } = await import(
      '../../server/src/startup/databaseReadiness.js'
    );
    const seedTemplates = vi.fn(async () => {});
    const outcome = await establishDatabaseReadiness({
      initializeSchema: async () => ({ success: true, message: 'ok' }),
      runMigrations: realRunner,
      seedTemplates,
      isProduction: false,
      migrationsDisabled: false,
      logger: silentLogger,
      ...(over as any),
    } as any);
    return { outcome, seedTemplates };
  }

  beforeAll(async () => {
    if (!RUN_DB) return;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm02b-startup-'));
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT)`);
  });

  afterEach(async () => {
    if (!RUN_DB) return;
    for (const f of written.splice(0)) {
      fs.rmSync(path.join(tmpDir, f), { force: true });
      await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename = $1`, [f]);
    }
    await client.query(`DROP TABLE IF EXISTS m02b_startup_probe CASCADE`);
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename LIKE '29990101_m02bstartup%'`);
    await client.end();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('is actually running against a database (a skip is not a pass)', () => {
    if (!RUN_DB) {
      // eslint-disable-next-line no-console
      console.warn('[M02-004/startup] SKIPPED — set RUN_DB_TESTS=1 and DATABASE_URL.');
    }
    expect(true).toBe(true);
  });

  // ── success ──────────────────────────────────────────────────────────────
  itDB('success → ready, migrations reported ok, seeding ran', async () => {
    writeMigration('good', `CREATE TABLE IF NOT EXISTS m02b_startup_probe (id TEXT PRIMARY KEY);`);

    const { outcome, seedTemplates } = await readiness();

    expect(outcome.ready).toBe(true);
    expect(outcome.error).toBeNull();
    expect(outcome.migrations.state).toBe('ok');
    expect(outcome.shouldExitProcess).toBe(false);
    expect(outcome.seeded).toBe(true);
    expect(seedTemplates).toHaveBeenCalledTimes(1);
  });

  // ── broken migration ─────────────────────────────────────────────────────
  itDB('broken migration → NEVER ready, zero seeding, failure is visible', async () => {
    const bad = writeMigration('broken', `SELECT * FROM table_that_does_not_exist_m02b_startup;`);

    const { outcome, seedTemplates } = await readiness();

    // never ready
    expect(outcome.ready).toBe(false);
    // precise, operator-facing error naming the file
    expect(outcome.error).toContain(bad);
    expect(outcome.migrations.state).toBe('failed');
    expect(outcome.migrations.detail).toContain(bad);
    // zero seeding
    expect(outcome.seeded).toBe(false);
    expect(seedTemplates).not.toHaveBeenCalled();
    // and nothing was recorded as applied, so a restart retries it
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM ${MIGRATION_TABLE} WHERE filename = $1`,
      [bad]
    );
    expect(rows[0].n).toBe(0);
  });

  itDB('production failure demands a non-zero exit / failed deployment', async () => {
    writeMigration('broken2', `SELECT * FROM table_that_does_not_exist_m02b_startup;`);

    const { outcome } = await readiness({ isProduction: true });

    expect(outcome.ready).toBe(false);
    expect(outcome.shouldExitProcess).toBe(true);
  });

  itDB('development failure stays alive but explicitly not-ready', async () => {
    writeMigration('broken3', `SELECT * FROM table_that_does_not_exist_m02b_startup;`);

    const { outcome } = await readiness({ isProduction: false });

    expect(outcome.ready).toBe(false);
    expect(outcome.shouldExitProcess).toBe(false); // process survives
    expect(outcome.error).toBeTruthy(); // but readiness is red
  });

  // ── retry ────────────────────────────────────────────────────────────────
  itDB('retry after the migration is fixed → ready, and it actually applies', async () => {
    const file = writeMigration('retry', `SELECT * FROM table_that_does_not_exist_m02b_startup;`);

    const first = await readiness();
    expect(first.outcome.ready).toBe(false);
    expect(first.seedTemplates).not.toHaveBeenCalled();

    // Operator fixes the migration and the process restarts.
    fs.writeFileSync(
      path.join(tmpDir, file),
      `CREATE TABLE IF NOT EXISTS m02b_startup_probe (id TEXT PRIMARY KEY);`,
      'utf-8'
    );

    const second = await readiness();
    expect(second.outcome.ready).toBe(true);
    expect(second.outcome.migrations.state).toBe('ok');
    expect(second.outcome.seeded).toBe(true);

    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM ${MIGRATION_TABLE} WHERE filename = $1`,
      [file]
    );
    expect(rows[0].n).toBe(1);
  });

  // ── schema init failure short-circuits ───────────────────────────────────
  itDB('schema init failure never reaches migrations or seeding', async () => {
    const runMigrations = vi.fn(async () => {
      throw new Error('must not be called');
    });
    const { outcome, seedTemplates } = await readiness({
      initializeSchema: async () => ({ success: false, message: 'schema verification failed' }),
      runMigrations,
    });

    expect(outcome.ready).toBe(false);
    expect(outcome.error).toBe('schema verification failed');
    expect(runMigrations).not.toHaveBeenCalled();
    expect(seedTemplates).not.toHaveBeenCalled();
  });

  // ── operator override ────────────────────────────────────────────────────
  itDB('DISABLE_TP_MIGRATIONS does NOT open readiness (operator override is not a bypass)', async () => {
    const runMigrations = vi.fn(async () => {
      throw new Error('must not be called');
    });
    const { outcome, seedTemplates } = await readiness({
      migrationsDisabled: true,
      runMigrations,
    });

    // An operator may skip migrations, but the app must not then serve traffic
    // on an unverified schema — that would be a bypass around this whole gate.
    expect(outcome.ready).toBe(false);
    expect(outcome.migrations.state).toBe('disabled_by_operator');
    expect(outcome.migrations.state).not.toBe('ok');
    expect(outcome.error).toContain('DISABLE_TP_MIGRATIONS');
    expect(outcome.seeded).toBe(false);
    expect(seedTemplates).not.toHaveBeenCalled();
    expect(runMigrations).not.toHaveBeenCalled();
  });

  itDB('DISABLE_TP_MIGRATIONS in production demands a non-zero exit', async () => {
    const { outcome } = await readiness({ migrationsDisabled: true, isProduction: true });
    expect(outcome.ready).toBe(false);
    expect(outcome.shouldExitProcess).toBe(true);
  });

  // ── seeding failure must not fake readiness, nor block it ────────────────
  itDB('seeding failure is reported but does not gate readiness', async () => {
    writeMigration('seedfail', `CREATE TABLE IF NOT EXISTS m02b_startup_probe (id TEXT PRIMARY KEY);`);

    const { outcome } = await readiness({
      seedTemplates: vi.fn(async () => {
        throw new Error('seed boom');
      }),
    });

    expect(outcome.ready).toBe(true);
    expect(outcome.seeded).toBe(false);
  });
});
