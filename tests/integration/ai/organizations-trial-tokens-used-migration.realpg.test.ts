/**
 * TRIAL-TOKENS-COLUMN — regression gate for `server/migrations/
 * 953_organizations_trial_tokens_used_gap.sql`, executed against a REAL,
 * DISPOSABLE PostgreSQL by spawning `server/scripts/migrate.postgres.ts`
 * exactly the way production does (same helper the sibling
 * `tests/integration/scripts/migrationRunnerStrict.realpg.test.ts` suite
 * uses for its own `--dir`/`--only` invocations).
 *
 * DEFECT THIS CLOSES: `AccessUsageService.trackTokenUsage()`
 * (server/src/services/access/AccessUsageService.ts:109) and
 * `.getTrialUsage()` (same file, L120) read/write
 * `organizations.trial_tokens_used`. No migration in the strict run set
 * ever added that column to `organizations` — `000_z_core_baseline.sql`
 * (L71/L103) and `20260813_repair_c1_core_identity_columns.sql` (L23) both
 * add a same-named column to `users` instead; `223_billing_mock_seed.sql`
 * and `000_initdb_core_tables.sql` are excluded from the strict run by
 * `isSqliteOnlyMigration()`; `never-ran/016_add_trial_token_tracking.sql.sql`
 * lives in a directory `getAllMigrations()` never walks. On a database that
 * has ONLY ever seen the strict migration ledger (no runtime `initDb()`
 * self-heal — see the note in the new migration file's header on
 * `DB_MANAGED_SCHEMA=off`/`POSTGRES_SKIP_INIT_IN_TEST=1`), every read/write
 * against that column throws `42703 column does not exist`, which
 * `AccessPolicyService.checkAccess` (accessPolicyService.ts:519-525) catches
 * and turns into a fail-closed `ACCESS_POLICY_UNAVAILABLE`.
 *
 * SAFETY (all required before a single statement runs):
 *   1. explicit opt-in           TRIAL_TOKENS_MIGRATION_REALPG=1
 *   2. local host only           DATABASE_URL must point at loopback
 *   3. database-name prefix      current_database() must start with c_fresh_
 *      (same disposable-DB naming convention as the sibling
 *      migrationRunnerStrict.realpg.test.ts suite)
 *   4. suite advisory lock       serializes this file against itself
 *
 * When not opted in, this suite SKIPS VISIBLY (describe.skipIf), never a
 * silent pass.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REQUIRED_DB_PREFIX = 'c_fresh_';
const SUITE_LOCK_KEY = 'consultify:test:organizationsTrialTokensUsedMigration.realpg';
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server', 'migrations');
const BASELINE_FILE = '000_z_core_baseline.sql';
const NEW_FILE = '953_organizations_trial_tokens_used_gap.sql';
const NEW_FILE_PATH = path.join(MIGRATIONS_DIR, NEW_FILE);

// The exact literal SQL AccessUsageService.ts runs (transcribed from the
// source file itself below via a strict, byte-exact regex — this suite
// fails loudly rather than silently testing stale text if that file's
// literals ever change out from under it).
const ACCESS_USAGE_SERVICE_PATH = path.join(
  REPO_ROOT,
  'server',
  'src',
  'services',
  'access',
  'AccessUsageService.ts'
);

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

const DATABASE_URL = readDatabaseUrl();
const OPTED_IN = process.env.TRIAL_TOKENS_MIGRATION_REALPG === '1' && DATABASE_URL !== null;

if (!OPTED_IN) {
  // eslint-disable-next-line no-console
  console.error(
    '[SKIPPED] organizations-trial-tokens-used-migration.realpg — requires ' +
      `TRIAL_TOKENS_MIGRATION_REALPG=1 and a DATABASE_URL pointing at a disposable local database ` +
      `named ${REQUIRED_DB_PREFIX}*. NOT EVIDENCE.`
  );
}

const sha256 = (buf: string) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Extracts the exact SQL string literal AccessUsageService.ts passes to
 * DbPromise for a given method, by anchoring on the method name and the
 * backtick-delimited template literal immediately after it. Throws if the
 * anchor text is not found — a silent regex non-match would defeat the
 * whole point of reading the real file instead of hand-copying its SQL.
 */
function extractLiteralSql(source: string, anchor: string): string {
  const idx = source.indexOf(anchor);
  if (idx === -1) {
    throw new Error(
      `[fidelity guard] AccessUsageService.ts no longer contains the expected anchor ` +
        `"${anchor}". This suite transcribes its literal SQL from the real source file; ` +
        `update the anchor if the method changed, and re-verify the ALTER TABLE fix still applies.`
    );
  }
  const afterAnchor = source.slice(idx);
  const match = afterAnchor.match(/`([^`]+)`/);
  if (!match) {
    throw new Error(
      `[fidelity guard] No backtick-delimited SQL literal found after anchor "${anchor}" in ` +
        'AccessUsageService.ts.'
    );
  }
  return match[1];
}

describe.skipIf(!OPTED_IN)(
  '953_organizations_trial_tokens_used_gap.sql — strict contract on real Postgres',
  () => {
    const url = DATABASE_URL as string;
    let lockClient: Client;

    async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        return await fn(client);
      } finally {
        await client.end();
      }
    }

    function runMigrate(args: string[], env: Record<string, string> = {}) {
      return spawnSync('npx', ['tsx', 'server/scripts/migrate.postgres.ts', ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          NODE_ENV: 'test',
          RUN_DB_TESTS: '1',
          DATABASE_URL: url,
          ...env,
        },
      });
    }

    async function ledgerRow(filename: string) {
      return withClient(async (c) => {
        const res = await c.query(
          `SELECT filename, status, checksum FROM schema_migrations WHERE filename = $1`,
          [filename]
        );
        return res.rows[0] as { filename: string; status: string; checksum: string } | undefined;
      });
    }

    async function organizationsColumn() {
      return withClient(async (c) => {
        const res = await c.query(
          `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'organizations'
              AND column_name = 'trial_tokens_used'`
        );
        return res.rows[0] as
          | {
              column_name: string;
              data_type: string;
              is_nullable: string;
              column_default: string | null;
            }
          | undefined;
      });
    }

    /**
     * Full row-content snapshot of `organizations`, used by the hostile
     * deviant-shape tests to prove a refused migration is TOTAL and
     * side-effect-free — not just "the column definition looks the same",
     * but the actual data underneath is byte-identical too.
     */
    async function organizationsRows() {
      return withClient(async (c) => {
        const res = await c.query(`SELECT * FROM organizations ORDER BY id`);
        return res.rows;
      });
    }

    beforeAll(async () => {
      const host = new URL(url).hostname;
      const local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
      if (!local) throw new Error(`Refusing to run against non-local host "${host}".`);

      // Guard 3: ask the SERVER what database it is, never trust the URL string.
      const dbName = await withClient(async (c) => {
        const res = await c.query('SELECT current_database() AS db');
        return String(res.rows[0].db);
      });
      if (!dbName.startsWith(REQUIRED_DB_PREFIX)) {
        throw new Error(
          `Refusing to run: current_database() is "${dbName}", which does not carry the ` +
            `disposable "${REQUIRED_DB_PREFIX}" prefix. This suite mutates schema and must never ` +
            `touch a shared database.`
        );
      }

      // Guard 4: serialize this suite against itself.
      lockClient = new Client({ connectionString: url });
      await lockClient.connect();
      const got = await lockClient.query(
        'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked',
        [SUITE_LOCK_KEY]
      );
      if (got.rows[0]?.locked !== true) {
        throw new Error('Another instance of this suite already holds the suite advisory lock.');
      }

      // Confirm the file this whole suite is about actually exists on disk
      // before any test runs — a missing file should fail loudly here, not
      // as a confusing downstream migrate.postgres.ts error.
      if (!fs.existsSync(NEW_FILE_PATH)) {
        throw new Error(`Expected migration file not found: ${NEW_FILE_PATH}`);
      }

      // Bootstrap `schema_migrations` on a genuinely virgin database: a REAL
      // run over an empty fixture directory (not --dry-run, which
      // deliberately never creates the ledger table). Every `it()` below
      // assumes the ledger already exists.
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c5-trialtok-bootstrap-'));
      try {
        const boot = runMigrate(['--dir', emptyDir]);
        if (boot.status !== 0) {
          throw new Error(`Failed to bootstrap schema_migrations: ${boot.stderr || boot.stdout}`);
        }
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    }, 60_000);

    afterAll(async () => {
      if (lockClient) {
        try {
          const unlocked = await lockClient.query(
            'SELECT pg_advisory_unlock(hashtext($1)::bigint) AS unlocked',
            [SUITE_LOCK_KEY]
          );
          expect(unlocked.rows[0]?.unlocked).toBe(true);
        } finally {
          await lockClient.end();
        }
      }
    });

    it('ledger scan: the chosen numbered slot 953 is free before this file existed', () => {
      const siblings = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f !== NEW_FILE);
      const collision = siblings.some((f) => /^953[a-zA-Z]?_/.test(f));
      expect(collision).toBe(false);
    });

    it(
      'discovery: a normal (non---only) run over the REAL full migrations tree finds the new ' +
        'file and does not silently exclude it',
      async () => {
        // --dry-run never executes a migration body (no CREATE EXTENSION, no
        // DDL) — safe against a plain, non-pgvector Postgres image even
        // though the full tree has ~972 candidate files.
        // Self-isolate the ledger pre-state: this same disposable database may
        // be retained for an immediate second qualification run, in which case
        // 953 is already recorded as success. Discovery must still prove that
        // the normal full-tree scanner classifies 953 as pending, without
        // weakening the assertion to accept Pending=0. Snapshot and restore the
        // exact bookkeeping row; --dry-run itself performs no schema mutation.
        const previous = await withClient(async (c) => {
          const result = await c.query(
            `SELECT version, filename, checksum, execution_time_ms, status, applied_at
               FROM schema_migrations
              WHERE filename = $1`,
            [NEW_FILE]
          );
          await c.query(`DELETE FROM schema_migrations WHERE filename = $1`, [NEW_FILE]);
          return result.rows[0] as
            | {
                version: string;
                filename: string;
                checksum: string;
                execution_time_ms: number | null;
                status: string;
                applied_at: Date;
              }
            | undefined;
        });

        try {
          const run = runMigrate(['--dry-run']);
          expect(run.status).toBe(0);
          expect(run.stdout).toContain(`- ${NEW_FILE}`);
        } finally {
          if (previous) {
            await withClient((c) =>
              c.query(
                `INSERT INTO schema_migrations
                   (version, filename, checksum, execution_time_ms, status, applied_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (filename) DO UPDATE SET
                   version = EXCLUDED.version,
                   checksum = EXCLUDED.checksum,
                   execution_time_ms = EXCLUDED.execution_time_ms,
                   status = EXCLUDED.status,
                   applied_at = EXCLUDED.applied_at`,
                [
                  previous.version,
                  previous.filename,
                  previous.checksum,
                  previous.execution_time_ms,
                  previous.status,
                  previous.applied_at,
                ]
              )
            );
          }
        }
      },
      120_000
    );

    it(
      'fresh apply: baseline + new file together create the column, checksum matches real bytes ' +
        'on disk, repeat run applies 0',
      async () => {
        await withClient((c) =>
          c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
            [BASELINE_FILE, NEW_FILE],
          ])
        );

        const realBytes = fs.readFileSync(NEW_FILE_PATH, 'utf-8');
        const expectedChecksum = sha256(realBytes);

        // Real files, real directory (server/migrations), --only scopes
        // execution to exactly the two files this fix needs: the baseline
        // (sole producer of `organizations`) and the new gap-closer.
        const run = runMigrate(['--only', `${BASELINE_FILE},${NEW_FILE}`]);
        expect(run.status).toBe(0);
        expect(run.stdout).toContain(`Applying migrations: 2`);
        expect(run.stdout).toContain('✅ Postgres migrations complete');

        const col = await organizationsColumn();
        expect(col).toBeDefined();
        expect(col?.data_type).toBe('integer');
        expect(col?.column_default).toContain('0');

        const row = await ledgerRow(NEW_FILE);
        expect(row?.status).toBe('success');
        expect(row?.checksum).toBe(expectedChecksum);

        // repeat0
        const again = runMigrate(['--only', `${BASELINE_FILE},${NEW_FILE}`]);
        expect(again.status).toBe(0);
        expect(again.stdout).toContain('Applying migrations: 0');

        // dry0
        const dry = runMigrate(['--only', `${BASELINE_FILE},${NEW_FILE}`, '--dry-run']);
        expect(dry.status).toBe(0);
        expect(dry.stdout).toContain('Pending migrations: 0');
      },
      120_000
    );

    it(
      'defect closed: the exact literal SQL AccessUsageService.ts runs against ' +
        'organizations.trial_tokens_used now succeeds',
      async () => {
        const source = fs.readFileSync(ACCESS_USAGE_SERVICE_PATH, 'utf-8');
        const writeSql = extractLiteralSql(source, 'async trackTokenUsage(');
        const readSql = extractLiteralSql(source, 'async getTrialUsage(');

        expect(writeSql).toContain('UPDATE organizations SET trial_tokens_used');
        expect(readSql).toContain('SELECT trial_tokens_used FROM organizations');

        // The exact, real conversion PostgresDatabase.ts applies to every
        // `?`-placeholder query it runs (DbPromise -> executeWithLogging ->
        // pool.query), imported directly rather than hand-translated.
        const { replacePositionalPlaceholders } = await import(
          '../../../server/src/database/PostgresDatabase.js'
        );
        const writeSqlPg = replacePositionalPlaceholders(writeSql);
        const readSqlPg = replacePositionalPlaceholders(readSql);

        const orgId = 'trial-tok-defect-check-org';
        await withClient(async (c) => {
          await c.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
          await c.query(
            `INSERT INTO organizations (id, name, trial_tokens_used) VALUES ($1, $2, 0)`,
            [orgId, 'Trial tokens defect-closed org']
          );

          // trackTokenUsage(organizationId, tokens) binds [tokens, organizationId]
          await c.query(writeSqlPg, [42, orgId]);
          // getTrialUsage(organizationId) binds [organizationId]
          const read = await c.query(readSqlPg, [orgId]);

          expect(read.rows[0]?.trial_tokens_used).toBe(42);

          await c.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
        });
      },
      60_000
    );

    it(
      'late apply: a database already migrated WITHOUT the new file still applies it cleanly ' +
        'once introduced',
      async () => {
        await withClient((c) =>
          c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
            [BASELINE_FILE, NEW_FILE],
          ])
        );
        // Genuinely reset table state — the prior "fresh apply" test already
        // created `organizations` WITH the column; `CREATE TABLE IF NOT
        // EXISTS` in the baseline would otherwise no-op and this "before"
        // assertion below would observe stale state from that earlier test.
        await withClient((c) => c.query(`DROP TABLE IF EXISTS organizations CASCADE`));

        // Step 1: only the baseline runs, simulating the real historical
        // sequence — organizations exists, WITHOUT trial_tokens_used.
        const baselineOnly = runMigrate(['--only', BASELINE_FILE]);
        expect(baselineOnly.status).toBe(0);
        expect(baselineOnly.stdout).toContain('Applying migrations: 1');

        const before = await organizationsColumn();
        expect(before).toBeUndefined();

        // Step 2: the new file is "introduced later" — applied on its own,
        // against the already-migrated database.
        const late = runMigrate(['--only', NEW_FILE]);
        expect(late.status).toBe(0);
        expect(late.stdout).toContain('Applying migrations: 1');
        expect(late.stdout).toContain(`→ ${NEW_FILE}`);

        const after = await organizationsColumn();
        expect(after).toBeDefined();
        expect(after?.data_type).toBe('integer');

        const baselineRow = await ledgerRow(BASELINE_FILE);
        expect(baselineRow?.status).toBe('success');
      },
      120_000
    );

    /**
     * Three SEPARATE hostile "late apply into a deviant pre-existing
     * column" scenarios (owner ruling 2026-08-18): a bare `ADD COLUMN IF
     * NOT EXISTS` would silently accept any of these. Each case starts from
     * an already-migrated database (baseline applied) into which the
     * column is pre-created in the deviant shape BEFORE the new migration
     * ever runs, then applies the new migration and proves the refusal is
     * total: the run exits non-zero, `organizations`' schema AND data are
     * byte/row-identical before/after (the DDL runs inside `BEGIN`/`COMMIT`
     * per `applyOneMigration()` — RAISE EXCEPTION aborts and rolls that
     * back before anything is visible).
     *
     * LEDGER — stated precisely, not assumed: `applyOneMigration()`
     * (server/scripts/migrate.postgres.ts) ROLLS BACK first, then writes a
     * 'failed' bookkeeping row as a SEPARATE statement, outside the aborted
     * transaction (see its own header comment: "the failed/skipped
     * bookkeeping row [is] written ... never inside the transaction that
     * just aborted"). So the ledger is NOT untouched — a real 'failed' row
     * with the real file's checksum lands there, on purpose, as the run's
     * own audit trail of the refusal. This suite asserts that row's exact
     * shape (status='failed', checksum=sha256 of the real file) rather than
     * its absence.
     */
    async function runHostileDeviantShapeCase(params: {
      label: string;
      deviantColumnSql: string;
    }) {
      await withClient((c) =>
        c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
          [BASELINE_FILE, NEW_FILE],
        ])
      );
      await withClient((c) => c.query(`DROP TABLE IF EXISTS organizations CASCADE`));

      const baselineOnly = runMigrate(['--only', BASELINE_FILE]);
      expect(baselineOnly.status).toBe(0);

      const probeOrgId = `trial-tok-hostile-${params.label}`;
      await withClient(async (c) => {
        await c.query(params.deviantColumnSql);
        await c.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          probeOrgId,
          `Hostile ${params.label} org`,
        ]);
      });

      const before = await organizationsColumn();
      expect(before).toBeDefined();
      const beforeRows = await organizationsRows();
      const beforeLedgerCount = await withClient(async (c) => {
        const res = await c.query(
          `SELECT count(*)::int AS n FROM schema_migrations WHERE filename = $1`,
          [NEW_FILE]
        );
        return res.rows[0].n as number;
      });
      expect(beforeLedgerCount).toBe(0);

      const run = runMigrate(['--only', NEW_FILE]);

      const after = await organizationsColumn();
      const afterRows = await organizationsRows();
      const afterLedgerRow = await ledgerRow(NEW_FILE);

      await withClient((c) => c.query(`DELETE FROM organizations WHERE id = $1`, [probeOrgId]));
      await withClient((c) =>
        c.query(`DELETE FROM schema_migrations WHERE filename = $1`, [NEW_FILE])
      );

      return { run, before, after, beforeRows, afterRows, afterLedgerRow };
    }

    it(
      'hostile late apply — wrong type: pre-existing TEXT column is refused, not coerced',
      async () => {
        const { run, before, after, beforeRows, afterRows, afterLedgerRow } =
          await runHostileDeviantShapeCase({
            label: 'wrong-type',
            deviantColumnSql: `ALTER TABLE organizations ADD COLUMN trial_tokens_used TEXT DEFAULT '0'`,
          });

        expect(run.status).not.toBe(0);
        expect(run.stdout + run.stderr).toContain(
          'organizations.trial_tokens_used already exists with an unexpected shape'
        );
        expect(run.stdout + run.stderr).toContain('data_type=text');
        expect(run.stdout).not.toContain('✅ Postgres migrations complete');

        // Schema unchanged: still TEXT, still the deviant default.
        expect(after).toEqual(before);
        expect(after?.data_type).toBe('text');
        // Data unchanged: same rows, byte/row-identical.
        expect(afterRows).toEqual(beforeRows);
        // Ledger: a real 'failed' row IS written (see comment above) — this
        // is the runner's own audit trail, not the migration's DDL escaping
        // the rollback. Checksum matches the real file's real bytes.
        const realChecksum = sha256(fs.readFileSync(NEW_FILE_PATH, 'utf-8'));
        expect(afterLedgerRow?.status).toBe('failed');
        expect(afterLedgerRow?.checksum).toBe(realChecksum);
      },
      120_000
    );

    it(
      'hostile late apply — wrong default: pre-existing DEFAULT 1 is refused, not overwritten',
      async () => {
        const { run, before, after, beforeRows, afterRows, afterLedgerRow } =
          await runHostileDeviantShapeCase({
            label: 'wrong-default',
            deviantColumnSql: `ALTER TABLE organizations ADD COLUMN trial_tokens_used INTEGER DEFAULT 1`,
          });

        expect(run.status).not.toBe(0);
        expect(run.stdout + run.stderr).toContain(
          'organizations.trial_tokens_used already exists with an unexpected shape'
        );
        expect(run.stdout + run.stderr).toMatch(/default=1\b/);
        expect(run.stdout).not.toContain('✅ Postgres migrations complete');

        expect(after).toEqual(before);
        expect(after?.column_default).toContain('1');
        expect(afterRows).toEqual(beforeRows);
        const realChecksum = sha256(fs.readFileSync(NEW_FILE_PATH, 'utf-8'));
        expect(afterLedgerRow?.status).toBe('failed');
        expect(afterLedgerRow?.checksum).toBe(realChecksum);
      },
      120_000
    );

    it(
      'hostile late apply — missing default: pre-existing nullable INTEGER without a default is refused',
      async () => {
        const { run, before, after, beforeRows, afterRows, afterLedgerRow } =
          await runHostileDeviantShapeCase({
            label: 'missing-default',
            deviantColumnSql: `ALTER TABLE organizations ADD COLUMN trial_tokens_used INTEGER`,
          });

        expect(run.status).not.toBe(0);
        expect(run.stdout + run.stderr).toContain(
          'organizations.trial_tokens_used already exists with an unexpected shape'
        );
        expect(run.stdout + run.stderr).toContain('default=<none>');
        expect(run.stdout).not.toContain('✅ Postgres migrations complete');

        expect(after).toEqual(before);
        expect(after?.data_type).toBe('integer');
        expect(after?.is_nullable).toBe('YES');
        expect(after?.column_default).toBeNull();
        expect(afterRows).toEqual(beforeRows);
        const realChecksum = sha256(fs.readFileSync(NEW_FILE_PATH, 'utf-8'));
        expect(afterLedgerRow?.status).toBe('failed');
        expect(afterLedgerRow?.checksum).toBe(realChecksum);
      },
      120_000
    );

    it(
      'hostile late apply — NOT NULL: pre-existing NOT NULL constraint is refused, not relaxed',
      async () => {
        const { run, before, after, beforeRows, afterRows, afterLedgerRow } =
          await runHostileDeviantShapeCase({
            label: 'not-null',
            deviantColumnSql: `ALTER TABLE organizations ADD COLUMN trial_tokens_used INTEGER NOT NULL DEFAULT 0`,
          });

        expect(run.status).not.toBe(0);
        expect(run.stdout + run.stderr).toContain(
          'organizations.trial_tokens_used already exists with an unexpected shape'
        );
        expect(run.stdout + run.stderr).toContain('is_nullable=NO');
        expect(run.stdout).not.toContain('✅ Postgres migrations complete');

        expect(after).toEqual(before);
        expect(after?.is_nullable).toBe('NO');
        expect(afterRows).toEqual(beforeRows);
        const realChecksum = sha256(fs.readFileSync(NEW_FILE_PATH, 'utf-8'));
        expect(afterLedgerRow?.status).toBe('failed');
        expect(afterLedgerRow?.checksum).toBe(realChecksum);
      },
      120_000
    );

    /**
     * Fourth hostile case (owner ruling 2026-08-18, second review): the base
     * table itself is missing. The migration must RAISE, not no-op and not
     * `ALTER TABLE IF EXISTS`-away the absence — see the migration file's own
     * header for why (unrepaired environment, not a no-op condition; a
     * silent success would burn a ledger row for work never performed and
     * nothing would ever replay it). Proves the runner's OWN documented
     * contract, not an idealised one: a genuine failure DOES write a
     * 'failed' ledger row (server/scripts/migrate.postgres.ts
     * `applyOneMigration` rolls back, then records 'failed' as a separate
     * statement outside the aborted transaction) — asserted, not assumed.
     * Then proves the fail-closed state is RECOVERABLE, not terminal: once
     * `public.organizations` is created, replaying the same migration
     * applies deliberately and flips the ledger row 'failed' -> 'success'
     * with the real checksum.
     */
    it(
      'hostile late apply — missing table: public.organizations absent is refused, then ' +
        'recovers once the table exists',
      async () => {
        await withClient((c) =>
          c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
            [BASELINE_FILE, NEW_FILE],
          ])
        );
        await withClient((c) => c.query(`DROP TABLE IF EXISTS organizations CASCADE`));

        const tableExists = await withClient(async (c) => {
          const res = await c.query(`SELECT to_regclass('public.organizations') AS t`);
          return res.rows[0].t !== null;
        });
        expect(tableExists).toBe(false);

        // Step 1: run the new migration alone — baseline never applied,
        // table genuinely absent.
        const run = runMigrate(['--only', NEW_FILE]);
        expect(run.status).not.toBe(0);
        expect(run.stdout + run.stderr).toContain('public.organizations does not exist');
        expect(run.stdout).not.toContain('✅ Postgres migrations complete');

        // No schema/data mutation of any kind: table still absent.
        const afterTableExists = await withClient(async (c) => {
          const res = await c.query(`SELECT to_regclass('public.organizations') AS t`);
          return res.rows[0].t !== null;
        });
        expect(afterTableExists).toBe(false);

        // Ledger reflects the real, current runner contract: a 'failed' row
        // with the real file's checksum — not silence, not 'success'.
        const realChecksum = sha256(fs.readFileSync(NEW_FILE_PATH, 'utf-8'));
        const failedRow = await ledgerRow(NEW_FILE);
        expect(failedRow?.status).toBe('failed');
        expect(failedRow?.checksum).toBe(realChecksum);

        // Step 2: repair the baseline (organizations now exists, WITHOUT
        // the column — same shape 000_z_core_baseline.sql always produces).
        const baselineOnly = runMigrate(['--only', BASELINE_FILE]);
        expect(baselineOnly.status).toBe(0);

        // Step 3: replay — the pending set is "no ledger row OR status !=
        // 'success'", so the earlier 'failed' row does not block a retry.
        const replay = runMigrate(['--only', NEW_FILE]);
        expect(replay.status).toBe(0);
        expect(replay.stdout).toContain('Applying migrations: 1');
        expect(replay.stdout).toContain(`→ ${NEW_FILE}`);
        expect(replay.stdout).toContain('✅ Postgres migrations complete');

        const successRow = await ledgerRow(NEW_FILE);
        expect(successRow?.status).toBe('success');
        expect(successRow?.checksum).toBe(realChecksum);

        const col = await organizationsColumn();
        expect(col?.data_type).toBe('integer');
        expect(col?.is_nullable).toBe('YES');
        expect(col?.column_default).toContain('0');
      },
      120_000
    );

    it(
      'preflight fails before mutation: an already-applied copy of this migration, edited on ' +
        'disk, is refused before any pending file runs (uses a TEMP fixture copy — the tracked ' +
        'file under server/migrations/ is never touched)',
      async () => {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c5-trialtok-'));
        try {
          const realBytes = fs.readFileSync(NEW_FILE_PATH, 'utf-8');
          // Numbered so phaseAndKeyFor() classifies it instead of throwing
          // UnclassifiedMigrationFilenameError — this suite is proving the
          // preflight/mutation-refusal contract, not the classifier.
          const fixtureFile = '700_c5_trialtok_gap_fixture.sql';
          const fixturePath = path.join(fixtureDir, fixtureFile);
          // Fixture table name distinct from `organizations` so this test is
          // fully decoupled from the real table the hostile-shape tests
          // above also mutate. EVERY occurrence of the `organizations`
          // identifier is swapped — not just the `ALTER TABLE` line: the
          // migration's own preflight branch also reads
          // `to_regclass('public.organizations')` and
          // `information_schema.columns ... table_name = 'organizations'`.
          // An earlier version of this fixture swapped only the ALTER
          // line, leaving those two catalog lookups pointed at the REAL
          // `organizations` table — so this test's outcome silently
          // depended on whatever shape a PRECEDING test in this file left
          // that table in, rather than testing the fixture's own table at
          // all. Caught via a genuine ordering failure against the "NOT
          // NULL" hostile-shape test's leftover column shape.
          const fixtureSql =
            'CREATE TABLE IF NOT EXISTS c5_trialtok_preflight_probe (id INT);\n' +
            realBytes.replace(/\borganizations\b/g, 'c5_trialtok_preflight_probe');
          fs.writeFileSync(fixturePath, fixtureSql);

          const pendingFile = '800_pending_after_mutation.sql';
          await withClient((c) =>
            c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
              [fixtureFile, pendingFile],
            ])
          );
          await withClient((c) =>
            c.query(`DROP TABLE IF EXISTS c5_trialtok_preflight_probe, c5_trialtok_pending_probe`)
          );

          const applied = runMigrate(['--dir', fixtureDir]);
          expect(applied.status).toBe(0);

          // Mutate the fixture (NOT the real migration file) and add a
          // pending sibling.
          fs.writeFileSync(fixturePath, fixtureSql + '\n-- edited after the fact\n');
          fs.writeFileSync(
            path.join(fixtureDir, pendingFile),
            'CREATE TABLE IF NOT EXISTS c5_trialtok_pending_probe (id INT);'
          );

          const run = runMigrate(['--dir', fixtureDir]);
          expect(run.status).not.toBe(0);
          expect(run.stdout + run.stderr).toContain('HISTORICAL MUTATION');
          expect(run.stdout).not.toContain('✅ Postgres migrations complete');

          const pendingRow = await ledgerRow(pendingFile);
          expect(pendingRow).toBeUndefined();
          const pendingExists = await withClient((c) =>
            c.query(`SELECT to_regclass('public.c5_trialtok_pending_probe') AS t`)
          );
          expect(pendingExists.rows[0].t).toBeNull();

          await withClient((c) =>
            c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
              [fixtureFile, pendingFile],
            ])
          );
          await withClient((c) =>
            c.query(`DROP TABLE IF EXISTS c5_trialtok_preflight_probe, c5_trialtok_pending_probe`)
          );

          // The real tracked file must be byte-identical to what this suite
          // read at the start of the test — proof this scenario never
          // touched it.
          const realBytesAfter = fs.readFileSync(NEW_FILE_PATH, 'utf-8');
          expect(realBytesAfter).toBe(realBytes);
        } finally {
          fs.rmSync(fixtureDir, { recursive: true, force: true });
        }
      },
      120_000
    );

    it('leaves no residue: no fixture ledger rows and no advisory locks held', async () => {
      await withClient((c) =>
        c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [
          [BASELINE_FILE, NEW_FILE],
        ])
      );
      await withClient((c) => c.query(`DROP TABLE IF EXISTS organizations CASCADE`));

      const residue = await withClient(async (c) => {
        const rows = await c.query(
          `SELECT filename FROM schema_migrations WHERE filename LIKE '%c5_trialtok%' OR filename LIKE '%pending_after_mutation%'`
        );
        const locks = await c.query(
          `SELECT count(*)::int AS n FROM pg_locks
            WHERE locktype = 'advisory'
              AND objid = (SELECT hashtext('consultify:migrate.postgres:schema_migrations')::bigint & 4294967295)`
        );
        return { rows: rows.rowCount, locks: locks.rows[0].n as number };
      });
      expect(residue.rows).toBe(0);
      expect(residue.locks).toBe(0);
    }, 60_000);
  }
);
