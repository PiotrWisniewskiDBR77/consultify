#!/usr/bin/env tsx
/**
 * Schema verification via information_schema (FAZA C / Harvard audit)
 *
 * Why this exists: the migration runner's --safe mode records a failed
 * migration as skipped-and-done in schema_migrations, so that table CANNOT
 * be trusted as proof the schema is right. This script derives the expected
 * schema directly from the .sql files and checks the live database through
 * information_schema instead.
 *
 * Checks:
 *  - every `CREATE TABLE [IF NOT EXISTS] <name>` exists in information_schema.tables
 *  - every `ALTER TABLE <t> ADD COLUMN [IF NOT EXISTS] <col>` exists in information_schema.columns
 *
 * Read-only: only SELECTs against information_schema.
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/verify-schema-vs-migrations.ts
 * Options:
 *   --dir <path>      migrations dir (default server/migrations)
 *   --json            machine-readable output
 *   --only <prefix>   only migration files starting with prefix (e.g. 20260323_v8)
 */

import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { Pool } from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { PROMOTED_LEGACY_SET, sortMigrationsDeterministically } from './migrationOrdering.js';

export type ExpectedSchema = {
  tables: Map<string, string>; // table -> first defining file
  columns: Map<string, string>; // "table.column" -> defining file
};

const TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/gi;
const ALTER_COL_RE =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi;
const DROP_COL_RE =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi;
// A table created and then dropped or renamed-away within the migrations is
// transient (rename-swap or marker tables) and must not count as expected.
const DROP_RE = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi;
const RENAME_RE = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?\s+RENAME\s+TO/gi;

// Mirror of migrate.postgres.ts isSqliteOnlyMigration: the Postgres runner
// deliberately skips these files, so verify must NOT expect their schema (else
// it reports phantom drift for migrations that are never applied on Postgres).
export function isSqliteOnlyMigration(filename: string): boolean {
  const f = filename.toLowerCase();
  const versionNum = Number.parseInt(filename.split('_')[0] || '', 10);
  if (/\s+\d+\.sql$/.test(f)) return true;
  if (
    f.includes('seed') ||
    f.includes('mock') ||
    f.includes('demo') ||
    f.startsWith('add_') ||
    f === 'assessment-module.sql' ||
    f === 'fix_conversations_table.sql'
  ) {
    return true;
  }
  if (Number.isFinite(versionNum) && versionNum > 0 && versionNum < 500) {
    if (!f.startsWith('000_z_core_baseline')) return true;
  }
  if (f.startsWith('000_initdb_')) return true;
  if (f.includes('_sqlite')) return true;
  if (f.includes('fts5')) return true;
  if (f.includes('repair_sqlite')) return true;
  if (f.includes('sqlite') && !f.includes('postgres')) return true;
  if (f.endsWith('.sql.sql')) return true;
  return false;
}

export function parseExpectedSchema(dir: string, onlyPrefix?: string): ExpectedSchema {
  const tables = new Map<string, string>();
  const columns = new Map<string, string>();
  const files = sortMigrationsDeterministically(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => PROMOTED_LEGACY_SET.has(f) || !isSqliteOnlyMigration(f))
      .filter((f) => !onlyPrefix || f.startsWith(onlyPrefix))
      .map((filename) => ({
        filename,
        filepath: path.join(dir, filename),
        version: filename.split('_')[0] || filename,
        checksum: '',
      }))
  ).map((migration) => migration.filename);

  const droppedOrRenamed = new Set<string>();
  const tableKey = (schema: string | undefined, table: string) =>
    schema && schema.toLowerCase() !== 'public'
      ? `${schema.toLowerCase()}.${table.toLowerCase()}`
      : table.toLowerCase();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    // Strip comments and SQL string literals. DDL embedded inside EXECUTE
    // strings is conditional runtime logic, not an unconditional final-schema
    // promise, and previously produced phantom tables named `if`.
    const cleaned = sql.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
    for (const m of cleaned.matchAll(TABLE_RE)) {
      const t = tableKey(m[1], m[2]);
      if (!tables.has(t)) tables.set(t, file);
    }
    for (const m of cleaned.matchAll(ALTER_COL_RE)) {
      const key = `${tableKey(m[1], m[2])}.${m[3].toLowerCase()}`;
      columns.set(key, file);
    }
    for (const m of cleaned.matchAll(DROP_COL_RE)) {
      columns.delete(`${tableKey(m[1], m[2])}.${m[3].toLowerCase()}`);
    }
    for (const m of cleaned.matchAll(DROP_RE)) droppedOrRenamed.add(m[1].toLowerCase());
    for (const m of cleaned.matchAll(RENAME_RE)) droppedOrRenamed.add(m[1].toLowerCase());
  }
  // Transient tables (created then dropped/renamed-away within the migration set)
  // are not part of the final schema — don't expect them on the live DB.
  for (const t of droppedOrRenamed) {
    tables.delete(t);
    for (const key of [...columns.keys()]) {
      if (key.startsWith(`${t}.`)) columns.delete(key);
    }
  }
  return { tables, columns };
}

type Report = {
  databaseHostHint: string;
  migrationsDir: string;
  expectedTables: number;
  expectedAlterColumns: number;
  missingTables: Array<{ table: string; definedIn: string }>;
  missingColumns: Array<{ table: string; column: string; definedIn: string }>;
  ok: boolean;
};

async function verify(dir: string, onlyPrefix?: string, asJson = false): Promise<number> {
  const expected = parseExpectedSchema(dir, onlyPrefix);

  const resolved = resolveReachableDatabaseUrl();
  const url = resolved.databaseUrl;
  if (!url) {
    throw new Error(
      `No reachable database URL (source=${resolved.source}${
        resolved.reason ? `: ${resolved.reason}` : ''
      }). Set DATABASE_URL or DATABASE_PUBLIC_URL.`
    );
  }
  const hostHint = (() => {
    try {
      return new URL(url).host;
    } catch {
      return '(unparseable)';
    }
  })();

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const tablesRes = await pool.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
    );
    const liveTables = new Set(
      tablesRes.rows.map((r) =>
        r.table_schema.toLowerCase() === 'public'
          ? r.table_name.toLowerCase()
          : `${r.table_schema.toLowerCase()}.${r.table_name.toLowerCase()}`
      )
    );

    const colsRes = await pool.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_schema, table_name, column_name FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
    );
    const liveColumns = new Set(
      colsRes.rows.map((r) => {
        const table =
          r.table_schema.toLowerCase() === 'public'
            ? r.table_name.toLowerCase()
            : `${r.table_schema.toLowerCase()}.${r.table_name.toLowerCase()}`;
        return `${table}.${r.column_name.toLowerCase()}`;
      })
    );

    const missingTables = [...expected.tables.entries()]
      .filter(([t]) => !liveTables.has(t))
      .map(([table, definedIn]) => ({ table, definedIn }));

    const missingColumns = [...expected.columns.entries()]
      // a column on a missing table is already covered by missingTables
      .filter(
        ([key]) => liveTables.has(key.slice(0, key.lastIndexOf('.'))) && !liveColumns.has(key)
      )
      .map(([key, definedIn]) => {
        const splitAt = key.lastIndexOf('.');
        const table = key.slice(0, splitAt);
        const column = key.slice(splitAt + 1);
        return { table, column, definedIn };
      });

    const report: Report = {
      databaseHostHint: hostHint,
      migrationsDir: dir,
      expectedTables: expected.tables.size,
      expectedAlterColumns: expected.columns.size,
      missingTables,
      missingColumns,
      ok: missingTables.length === 0 && missingColumns.length === 0,
    };

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`DB host: ${hostHint}`);
      console.log(
        `Expected: ${report.expectedTables} tables, ${report.expectedAlterColumns} ALTER-added columns (from ${dir})`
      );
      if (report.ok) {
        console.log('✅ Schema matches migrations (information_schema verified).');
      } else {
        if (missingTables.length) {
          console.log(`\n❌ Missing tables (${missingTables.length}):`);
          for (const m of missingTables) console.log(`  - ${m.table}  (defined in ${m.definedIn})`);
        }
        if (missingColumns.length) {
          console.log(`\n❌ Missing columns (${missingColumns.length}):`);
          for (const m of missingColumns)
            console.log(`  - ${m.table}.${m.column}  (defined in ${m.definedIn})`);
        }
      }
    }
    return report.ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
  const argv = process.argv.slice(2);
  const getOpt = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dir = getOpt('dir') || path.resolve(process.cwd(), 'server/migrations');
  const only = getOpt('only');
  const asJson = argv.includes('--json');

  verify(dir, only, asJson)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`verify-schema-vs-migrations failed: ${err?.message || err}`);
      process.exit(2);
    });
}
