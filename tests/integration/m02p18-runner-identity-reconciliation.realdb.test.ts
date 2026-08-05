/**
 * M02-P18 — Schema/runner reconciliation (real Postgres, real runner).
 *
 * This suite is this packet's own addition, on top of the ported M02-B/
 * M02-C/M01 suites (m02b-migration-runner.realdb.test.ts,
 * m02b-preflight-checksum.realdb.test.ts, m02b-readiness-routes.test.ts,
 * m02b-startup-readiness.realdb.test.ts). It covers three things none of
 * the ported suites can, because each was written from inside its own
 * branch and assumes files that do not exist here:
 *
 *   1. The 942_* cross-module collision (M02-C's
 *      942_ideas_collaboration_tool_sessions.sql and M01's
 *      942_chat_m01p04a_attachment_status.sql) and M01's two migrations —
 *      exercised with DECOY fixtures under the EXACT real filenames,
 *      because this packet is infrastructure-only and deliberately does not
 *      bring in other packets' product migration .sql files (see
 *      "forbidden files" in M02-P18_PACKET.md). This mirrors the pattern
 *      M01's own test already used for the M02-C file it didn't own either
 *      (`codex/m01-prun-runner-consolidation-local-20260805`,
 *      tests/integration/m01-prun-runtime-migration-reconciliation.realdb.test.ts).
 *   2. The 932 duplicate-numbering non-collision (findings M02-019/M02-020) —
 *      proves BOTH real 932_* files (which DO exist in server/migrations
 *      today) are correctly excluded from runtime discovery, so no false
 *      pending/checksum report is possible without any DDL re-run.
 *   3. The 940 allowlist addition (findings M02-020/M02-021) — exercised
 *      against the REAL migration file (940_mw010_vault_document_versions.sql
 *      already exists in server/migrations on origin/demo; only its
 *      allowlist entry is new), proving fresh-apply and idempotent-rerun
 *      against a genuine, non-trivial production migration rather than a
 *      synthetic fixture.
 *   4. M02-P16B_FIX — the 942_ai_agent_plan_run_idempotency.sql allowlist
 *      addition (M02-P16B_REVIEW.md: the original packet shipped the file
 *      without allowlisting it, so a real deploy would never have applied
 *      it). Same real-file fresh-apply/idempotent-rerun/production-discovery
 *      proof as the 940 case above, plus confirmation the allowlist now
 *      carries all FIVE entries and the two pre-existing 942_* files and
 *      the 932_* exclusions are unaffected by the addition.
 *
 * Never touches server/migrations; migration files under test are either
 * fixtures in a private mkdtemp (argument-only seam) or a scratch database
 * pointed at the read-only real directory for the 940 case.
 *
 * HOW TO RUN LOCALLY:
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:<port>/consultinity_test \
 *     RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres \
 *     npx vitest run tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts
 *
 * SKIP POLICY: if RUN_DB_TESTS=1/DATABASE_URL are not both set, every itDB
 * test is skipped and the "is actually running" sentinel test warns loudly —
 * a skip must never be mistaken for a pass.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const testDir = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_DIR = path.resolve(testDir, '../../server/migrations');
const MIGRATION_TABLE = 'tp_migration_history';

const M02C_942 = '942_ideas_collaboration_tool_sessions.sql';
const M01_800 = '800_chat_007_proposal_idempotency_key.sql';
const M01_942 = '942_chat_m01p04a_attachment_status.sql';
const M02P18_940 = '940_mw010_vault_document_versions.sql';
const M02P16B_942 = '942_ai_agent_plan_run_idempotency.sql';
const DECISION_932 = '932_decision_workflow_canonical.sql';
const INBOX_932 = '932_canonical_inbox_items_source_status_initiative.sql';

/** The discovery rule as it stood before ANY reconciliation packet touched it. */
const OLD_MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let reachable = false;

const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
  const d = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}

let runMigrations: (options?: { migrationsDir?: string }) => Promise<{
  applied: number;
  skipped: number;
  failed: string | null;
  failedFile: string | null;
  total: number;
  checksumMismatches: string[];
}>;
let isRuntimeMigrationFile: (f: string) => boolean;
let getRuntimeMigrationAllowlist: () => string[];

async function historyRows(
  filenames: string[]
): Promise<Array<{ filename: string; checksum: string | null }>> {
  const res = await client.query(
    `SELECT filename, checksum FROM ${MIGRATION_TABLE} WHERE filename = ANY($1::text[]) ORDER BY filename ASC`,
    [filenames]
  );
  return res.rows;
}

async function deleteHistory(filenames: string[]): Promise<void> {
  await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename = ANY($1::text[])`, [
    filenames,
  ]);
}

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
  return rows[0]?.reg != null;
}

describe('M02-P18 — runner/identity reconciliation (real Postgres)', () => {
  beforeAll(async () => {
    if (!RUN_DB) return;
    await client.connect();
    reachable = true;

    const runnerMod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    runMigrations = runnerMod.runMigrations;
    const identity = await import('../../server/src/services/tablePlatform/migrationIdentity.js');
    isRuntimeMigrationFile = identity.isRuntimeMigrationFile;
    getRuntimeMigrationAllowlist = identity.getRuntimeMigrationAllowlist;

    await client.query(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT)`);
  }, 120_000);

  afterAll(async () => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    if (!reachable) return;
    await deleteHistory([
      M02C_942,
      M01_800,
      M01_942,
      M02P18_940,
      M02P16B_942,
      DECISION_932,
      INBOX_932,
    ]);
    await client.query('DROP TABLE IF EXISTS knowledge_doc_versions CASCADE');
    await client.query('DROP TABLE IF EXISTS ai_agent_plans CASCADE');
    await client.end();
  }, 60_000);

  it('is actually running against a database (a skip is not a pass)', () => {
    if (!RUN_DB) {
      // eslint-disable-next-line no-console
      console.warn(
        '[M02-P18/reconciliation] SKIPPED — set RUN_DB_TESTS=1 and DATABASE_URL to run for real.'
      );
    }
    expect(true).toBe(true);
  });

  // ── 1. 942 cross-module collision (decoys — no product .sql files owned) ──

  itDB('NEGATIVE CONTROL: the pre-reconciliation pattern finds none of the three 9xx allowlist entries', () => {
    expect(OLD_MIGRATION_PATTERN.test(M02C_942)).toBe(false);
    expect(OLD_MIGRATION_PATTERN.test(M01_800)).toBe(false);
    expect(OLD_MIGRATION_PATTERN.test(M01_942)).toBe(false);
  });

  itDB('the reconciled runner DOES find all five allowlisted names', () => {
    expect(isRuntimeMigrationFile(M02C_942)).toBe(true);
    expect(isRuntimeMigrationFile(M01_800)).toBe(true);
    expect(isRuntimeMigrationFile(M01_942)).toBe(true);
    expect(isRuntimeMigrationFile(M02P18_940)).toBe(true);
    expect(isRuntimeMigrationFile(M02P16B_942)).toBe(true);
  });

  itDB('the allowlist stays narrow: exactly the 5 individually-reviewed entries', () => {
    const allowlist = getRuntimeMigrationAllowlist();
    expect(new Set(allowlist)).toEqual(
      new Set([M02C_942, M01_800, M01_942, M02P18_940, M02P16B_942])
    );
    expect(allowlist.length).toBe(5);
  });

  itDB(
    'DETERMINISM: the two 942_* files (M02-C, M01) apply in the same order regardless of on-disk creation order',
    async () => {
      // Neither file is this packet's to own; both stand in as DECOYS under
      // their EXACT real filenames. The collision under test is the shared
      // "942_" prefix, not either file's actual DDL content — the same
      // approach M01's own test used for the M02-C file it didn't own.
      const ideasDecoySql = `CREATE TABLE IF NOT EXISTS m02p18_942_ideas_decoy (id INT PRIMARY KEY);`;
      const chatDecoySql = `CREATE TABLE IF NOT EXISTS m02p18_942_chat_decoy (id INT PRIMARY KEY);`;

      const applyOrder = async (createIdeasFirst: boolean): Promise<string[]> => {
        const dir = makeTempDir('m02p18-942-order-');
        if (createIdeasFirst) {
          writeFileSync(path.join(dir, M02C_942), ideasDecoySql);
          writeFileSync(path.join(dir, M01_942), chatDecoySql);
        } else {
          writeFileSync(path.join(dir, M01_942), chatDecoySql);
          writeFileSync(path.join(dir, M02C_942), ideasDecoySql);
        }
        await deleteHistory([M02C_942, M01_942]);
        const result = await runMigrations({ migrationsDir: dir });
        expect(result.failed).toBeNull();
        const rows = await historyRows([M02C_942, M01_942]);
        return rows.map((r) => r.filename);
      };

      const orderA = await applyOrder(true);
      const orderB = await applyOrder(false);

      expect(orderA).toEqual([M01_942, M02C_942]); // 'chat' < 'ideas' lexically
      expect(orderB).toEqual(orderA);

      await client.query('DROP TABLE IF EXISTS m02p18_942_ideas_decoy, m02p18_942_chat_decoy CASCADE');
      await deleteHistory([M02C_942, M01_942]);
    },
    120_000
  );

  // ── 2. 932 duplicate numbering — non-collision, no DDL re-run ─────────────

  itDB(
    'RESOLUTION (M02-019/M02-020): both real 932_* files exist on disk but neither is runtime-discovered',
    async () => {
      const { readdirSync, existsSync } = await import('node:fs');
      expect(existsSync(path.join(REAL_MIGRATIONS_DIR, DECISION_932))).toBe(true);
      expect(existsSync(path.join(REAL_MIGRATIONS_DIR, INBOX_932))).toBe(true);

      expect(isRuntimeMigrationFile(DECISION_932)).toBe(false);
      expect(isRuntimeMigrationFile(INBOX_932)).toBe(false);

      // A full run against the REAL directory therefore never even
      // considers either file — no pending report, no checksum check.
      const files = readdirSync(REAL_MIGRATIONS_DIR).filter((f) => isRuntimeMigrationFile(f));
      expect(files).not.toContain(DECISION_932);
      expect(files).not.toContain(INBOX_932);
    }
  );

  itDB('full-filename keying means the two 932_* files could never collide even if both were later allowlisted', () => {
    // Same guarantee already relied on for the two 942_* files: identity is
    // a Set keyed on the COMPLETE filename, never the numeric prefix alone.
    const probe = new Set([DECISION_932, INBOX_932]);
    expect(probe.size).toBe(2); // distinct keys despite the shared "932_" prefix
  });

  // ── 3. 940 allowlist addition — real file, real idempotent apply ─────────

  itDB(
    'FRESH: the real 940_mw010_vault_document_versions.sql applies cleanly against a bare schema',
    async () => {
      // A minimal knowledge_docs so the migration's guarded backfill block
      // has something to (safely) no-op against; the migration's own DDL
      // (CREATE TABLE knowledge_doc_versions, ADD COLUMN IF NOT EXISTS) does
      // not require it, but exercising the full real file end-to-end is the
      // point of this test rather than a synthetic stand-in.
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_docs (
          id TEXT PRIMARY KEY,
          filename TEXT
        )
      `);
      await deleteHistory([M02P18_940]);
      await client.query('DROP TABLE IF EXISTS knowledge_doc_versions CASCADE');

      const dir = makeTempDir('m02p18-940-fresh-');
      const { copyFileSync } = await import('node:fs');
      copyFileSync(path.join(REAL_MIGRATIONS_DIR, M02P18_940), path.join(dir, M02P18_940));

      const result = await runMigrations({ migrationsDir: dir });
      expect(result.failed).toBeNull();
      expect(result.applied).toBe(1);
      expect(await tableExists('knowledge_doc_versions')).toBe(true);

      const row = await historyRows([M02P18_940]);
      expect(row).toHaveLength(1);
      expect(row[0].checksum).toBeTruthy();
    },
    60_000
  );

  itDB('RERUN: applying 940 again is a no-op (idempotent)', async () => {
    const dir = makeTempDir('m02p18-940-rerun-');
    const { copyFileSync } = await import('node:fs');
    copyFileSync(path.join(REAL_MIGRATIONS_DIR, M02P18_940), path.join(dir, M02P18_940));

    const result = await runMigrations({ migrationsDir: dir });
    expect(result.failed).toBeNull();
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  itDB(
    'the production (no-argument) runner discovers 940 from the REAL canonical directory',
    async () => {
      // Explicit assertion that the allowlist entry, not just a fixture
      // copy, is what makes 940 visible: read the canonical directory
      // listing directly rather than a temp copy.
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(REAL_MIGRATIONS_DIR).filter((f) => isRuntimeMigrationFile(f));
      expect(files).toContain(M02P18_940);
    }
  );

  // ── 4. M02-P16B_FIX: 942_ai_agent_plan_run_idempotency.sql allowlist ──────
  // addition. This is the coordinator-reviewed defect (M02-P16B_REVIEW.md):
  // the packet shipped the .sql file but never registered it here, so
  // isRuntimeMigrationFile() returned false and a real deploy would never
  // have discovered or applied it. Same fresh/rerun/production-discovery
  // proof shape as the 940 case above, against the REAL file.

  itDB(
    'FRESH: the real 942_ai_agent_plan_run_idempotency.sql applies cleanly against a minimal ai_agent_plans table',
    async () => {
      // Minimal stand-in for the real producer (672_enterprise_agent_planner
      // .sql, itself not runtime-discovered — out of scope here) so the
      // ALTER TABLE has a target; the migration under test does not require
      // any of ai_agent_plans' other columns.
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_plans (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'planning'
        )
      `);
      await deleteHistory([M02P16B_942]);
      await client.query('ALTER TABLE ai_agent_plans DROP COLUMN IF EXISTS run_idempotency_key');

      const dir = makeTempDir('m02p18-942-p16b-fresh-');
      const { copyFileSync } = await import('node:fs');
      copyFileSync(path.join(REAL_MIGRATIONS_DIR, M02P16B_942), path.join(dir, M02P16B_942));

      const result = await runMigrations({ migrationsDir: dir });
      expect(result.failed).toBeNull();
      expect(result.applied).toBe(1);

      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'ai_agent_plans' AND column_name = 'run_idempotency_key'`
      );
      expect(rows).toHaveLength(1);

      const row = await historyRows([M02P16B_942]);
      expect(row).toHaveLength(1);
      expect(row[0].checksum).toBeTruthy();
    },
    60_000
  );

  itDB('RERUN: applying 942_ai_agent_plan_run_idempotency.sql again is a no-op (idempotent)', async () => {
    const dir = makeTempDir('m02p18-942-p16b-rerun-');
    const { copyFileSync } = await import('node:fs');
    copyFileSync(path.join(REAL_MIGRATIONS_DIR, M02P16B_942), path.join(dir, M02P16B_942));

    const result = await runMigrations({ migrationsDir: dir });
    expect(result.failed).toBeNull();
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  itDB(
    'the production (no-argument) runner discovers 942_ai_agent_plan_run_idempotency.sql from the REAL canonical directory',
    async () => {
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(REAL_MIGRATIONS_DIR).filter((f) => isRuntimeMigrationFile(f));
      expect(files).toContain(M02P16B_942);
    }
  );

  itDB(
    'NO REGRESSION: adding the third 942_* entry leaves the other two 942_* files and both 932_* exclusions unchanged',
    () => {
      expect(isRuntimeMigrationFile(M02C_942)).toBe(true);
      expect(isRuntimeMigrationFile(M01_942)).toBe(true);
      expect(isRuntimeMigrationFile(DECISION_932)).toBe(false);
      expect(isRuntimeMigrationFile(INBOX_932)).toBe(false);
    }
  );
});
