#!/usr/bin/env tsx
/**
 * Transfer data from a SQLite DB file to a Postgres database.
 *
 * Run (from repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." SQLITE_PATH="./data/dev/consultinity.db" tsx server/scripts/transfer-sqlite-to-postgres.ts
 *
 * Options:
 *   --sqlite-path <path>   Override SQLITE_PATH
 *   --database-url <url>   Override DATABASE_URL
 *   --batch-size <n>       Default 200
 *   --only <t1,t2,...>     Only these tables
 *   --skip <t1,t2,...>     Skip these tables (in addition to defaults)
 *   --dry-run              Print plan, do not write
 *   --continue             Continue after table failure (default true)
 *   --strict-types         Fail on type coercion errors (default false)
 *   --skip-embeddings      Do not transfer vector/embedding columns (default true)
 *   --report-limit <n>     Max errors captured per table (default 50)
 *   --only-from-report <path>  Retry tables with failed/skipped rows from a prior report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import crypto from 'crypto';

import { getDatabaseAsync } from '../src/database/Database.js';
import logger from '../src/utils/Logger.js';

type Sqlite3Module = {
  verbose?: () => any;
  Database: new (filename: string, cb: (err: unknown) => void) => any;
};

type SqliteDb = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void;
  get: (sql: string, params: unknown[], cb: (err: Error | null, row: unknown) => void) => void;
  close: (cb: (err: Error | null) => void) => void;
};

type PgColumn = {
  column_name: string;
  data_type: string;
  udt_name: string;
  column_default: string | null;
  is_nullable?: 'YES' | 'NO' | string;
  character_maximum_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run') {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      if (value === 'false' || value === '0') args[key] = false;
      else if (value === 'true' || value === '1') args[key] = true;
      else args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function openSqlite(sqlitePath: string): Promise<
  SqliteDb & {
    query: <T = unknown>(
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: T[]; rowCount: number }>;
  }
> {
  const sqlite3Mod: Sqlite3Module = await import('sqlite3').then((m: any) =>
    m?.default ? m.default : m
  );
  const sqlite3 = sqlite3Mod?.verbose ? sqlite3Mod.verbose() : (sqlite3Mod as any);

  const db: SqliteDb = await new Promise((resolve, reject) => {
    const handle = new sqlite3.Database(sqlitePath, (err: unknown) => {
      if (err) reject(err);
      else resolve(handle);
    });
  });

  const query = async <T = unknown>(sql: string, params: unknown[] = []) => {
    const rows = await new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err, r) => {
        if (err) reject(err);
        else resolve((r as T[]) || []);
      });
    });
    return { rows, rowCount: rows.length };
  };

  return Object.assign(db, { query });
}

async function sqliteAll<T = unknown>(db: SqliteDb, sql: string, params: unknown[] = []) {
  return await new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

async function sqliteGet<T = unknown>(db: SqliteDb, sql: string, params: unknown[] = []) {
  return await new Promise<T | null>((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

type CoerceResult = { value: unknown; error?: string };

function parseDateLike(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // heuristic: seconds vs ms
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function coerceValue(value: unknown, targetColumn: PgColumn | undefined): CoerceResult {
  if (!targetColumn) return { value };
  if (value === null || value === undefined) return { value: null };

  const t = targetColumn.data_type;
  const udt = targetColumn.udt_name;
  const maxLen =
    typeof targetColumn.character_maximum_length === 'number'
      ? targetColumn.character_maximum_length
      : null;

  // vector/embedding often present as USER-DEFINED 'vector' in pgvector
  if (t === 'USER-DEFINED' && udt === 'vector') {
    return { value: null };
  }

  // varchar/char truncation
  if (
    (t === 'character varying' || t === 'character') &&
    typeof value === 'string' &&
    maxLen &&
    maxLen > 0
  ) {
    if (value.length > maxLen) return { value: value.slice(0, maxLen) };
    return { value };
  }

  // Postgres ARRAY types (e.g. text[])
  if (t === 'ARRAY' || (typeof udt === 'string' && udt.startsWith('_'))) {
    if (Array.isArray(value)) return { value };
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return { value: null };
      // Prefer JSON array format from SQLite TEXT columns
      if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return { value: parsed };
        } catch {
          // fallthrough
        }
      }
      // As a fallback, store single-element array (avoids malformed array literal errors)
      return { value: [s] };
    }
    return { value: null };
  }

  if (t === 'boolean') {
    if (typeof value === 'boolean') return { value };
    if (typeof value === 'number') return { value: value !== 0 };
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 't' || v === 'yes') return { value: true };
      if (v === '0' || v === 'false' || v === 'f' || v === 'no') return { value: false };
    }
    return { value: null, error: `invalid boolean: ${String(value)}` };
  }

  if (t === 'integer' || t === 'bigint' || udt === 'int4' || udt === 'int8') {
    const min = t === 'integer' || udt === 'int4' ? -2147483648 : -9223372036854775808;
    const max = t === 'integer' || udt === 'int4' ? 2147483647 : 9223372036854775807;

    const within = (n: number) => n >= min && n <= max;

    if (typeof value === 'number' && Number.isFinite(value)) {
      const n = Math.trunc(value);
      if (!Number.isSafeInteger(n) || !within(n))
        return { value: null, error: `int overflow: ${String(value)}` };
      return { value: n };
    }
    if (typeof value === 'string') {
      const s = value.trim();
      // handle scientific notation like 4.56e+21
      const asNum = Number(s);
      if (Number.isFinite(asNum)) {
        const n = Math.trunc(asNum);
        if (!Number.isSafeInteger(n) || !within(n))
          return { value: null, error: `int overflow: ${s}` };
        return { value: n };
      }
      const n = Number.parseInt(s, 10);
      if (Number.isFinite(n) && Number.isSafeInteger(n) && within(n)) return { value: n };
    }
    return { value: null, error: `invalid int: ${String(value)}` };
  }

  if (
    t === 'numeric' ||
    t === 'double precision' ||
    t === 'real' ||
    udt === 'float4' ||
    udt === 'float8'
  ) {
    const prec =
      typeof targetColumn.numeric_precision === 'number' ? targetColumn.numeric_precision : null;
    const scale =
      typeof targetColumn.numeric_scale === 'number' ? targetColumn.numeric_scale : null;

    const clampNumeric = (n: number): CoerceResult => {
      // If we have precision/scale, clamp to the max representable magnitude to avoid PG overflow.
      if (prec && scale !== null && prec > 0 && scale >= 0 && prec >= scale) {
        const intDigits = prec - scale;
        const max = Math.pow(10, intDigits) - Math.pow(10, -scale);
        if (!Number.isFinite(max) || max <= 0)
          return { value: null, error: `numeric overflow: ${String(n)}` };
        if (Math.abs(n) > max) {
          const clamped = (Math.sign(n) * max).toFixed(scale);
          return { value: clamped, error: `numeric clamped to ${clamped}` };
        }
        // normalize to scale if applicable
        if (scale > 0) return { value: n.toFixed(scale) };
        return { value: Math.trunc(n) };
      }
      // generic overflow guard
      if (Math.abs(n) > 1e15) return { value: null, error: `numeric overflow: ${String(n)}` };
      return { value: n };
    };

    if (typeof value === 'number' && Number.isFinite(value)) {
      return clampNumeric(value);
    }
    if (typeof value === 'string') {
      const n = Number.parseFloat(value.trim());
      if (Number.isFinite(n)) {
        return clampNumeric(n);
      }
    }
    return { value: null, error: `invalid number: ${String(value)}` };
  }

  if (t === 'time without time zone' || t === 'time') {
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return { value: null };
      // Accept HH:MM or HH:MM:SS
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
        return { value: s.length === 5 ? `${s}:00` : s };
      }
    }
    return { value: null, error: `invalid time: ${String(value)}` };
  }

  if (t === 'timestamp without time zone' || t === 'timestamp with time zone' || t === 'date') {
    const d = parseDateLike(value);
    if (!d) return { value: null, error: `invalid date/timestamp: ${String(value)}` };
    if (t === 'date') {
      // Keep only YYYY-MM-DD
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return { value: `${yyyy}-${mm}-${dd}` };
    }
    return { value: d.toISOString() };
  }

  if (t === 'json' || t === 'jsonb') {
    if (typeof value === 'object') {
      try {
        return { value: JSON.stringify(value) };
      } catch {
        return { value: null, error: 'invalid json object' };
      }
    }
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return { value: null };
      try {
        JSON.parse(s);
        return { value: s };
      } catch {
        return { value: null, error: `invalid json string` };
      }
    }
    return { value: null, error: `invalid json: ${String(value)}` };
  }

  // fallback: keep as-is (TEXT, UUID, etc.)
  return { value };
}

async function getSqliteTables(db: SqliteDb): Promise<string[]> {
  const rows = await sqliteAll<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => r.name).filter(Boolean);
}

async function getSqliteColumns(db: SqliteDb, table: string): Promise<string[]> {
  const rows = await sqliteAll<{ name: string }>(db, `PRAGMA table_info(${quoteIdent(table)})`);
  return rows.map((r) => r.name).filter(Boolean);
}

async function getSqliteForeignKeyDeps(db: SqliteDb, table: string): Promise<string[]> {
  const rows = await sqliteAll<{ table: string }>(
    db,
    `PRAGMA foreign_key_list(${quoteIdent(table)})`
  );
  return rows.map((r) => r.table).filter(Boolean);
}

function topoSortTables(tables: string[], deps: Map<string, Set<string>>): string[] {
  const inDegree = new Map<string, number>();
  const forward = new Map<string, Set<string>>();

  for (const t of tables) {
    inDegree.set(t, 0);
    forward.set(t, new Set());
  }

  for (const [t, ds] of deps.entries()) {
    for (const d of ds) {
      if (!inDegree.has(t) || !inDegree.has(d)) continue;
      inDegree.set(t, (inDegree.get(t) || 0) + 1);
      forward.get(d)!.add(t);
    }
  }

  const queue: string[] = [];
  for (const [t, deg] of inDegree.entries()) if (deg === 0) queue.push(t);

  const ordered: string[] = [];
  while (queue.length) {
    const t = queue.shift()!;
    ordered.push(t);
    for (const n of forward.get(t) || []) {
      const deg = (inDegree.get(n) || 0) - 1;
      inDegree.set(n, deg);
      if (deg === 0) queue.push(n);
    }
  }

  if (ordered.length === tables.length) return ordered;
  const remaining = tables.filter((t) => !ordered.includes(t)).sort();
  return [...ordered, ...remaining];
}

async function pgHasTable(pg: any, table: string): Promise<boolean> {
  const res = await pg.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}

async function getPgColumns(pg: any, table: string): Promise<PgColumn[]> {
  const res = await pg.query<PgColumn>(
    `SELECT column_name, data_type, udt_name, column_default, is_nullable, character_maximum_length,
            numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return (res.rows || []).filter((c) => c?.column_name);
}

async function resetPgSequences(pg: any, table: string): Promise<void> {
  const cols = await getPgColumns(pg, table);
  const serialCols = cols.filter(
    (c) =>
      !!c.column_default &&
      c.column_default.includes('nextval(') &&
      (c.data_type === 'integer' ||
        c.data_type === 'bigint' ||
        c.udt_name === 'int4' ||
        c.udt_name === 'int8')
  );
  for (const c of serialCols) {
    const col = c.column_name;
    try {
      await pg.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${quoteIdent(col)}) FROM ${quoteIdent(table)}), 0))`,
        [table, col]
      );
    } catch (e) {
      logger.warn(
        `[transfer] Failed to reset sequence for ${table}.${col}:`,
        (e as any)?.message || e
      );
    }
  }
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));

  const sqlitePathArg = (args['sqlite-path'] as string | undefined) || undefined;
  const databaseUrlArg = (args['database-url'] as string | undefined) || undefined;
  const batchSize = Math.max(
    1,
    parseInt(((args['batch-size'] as string | undefined) || '200').trim(), 10) || 200
  );
  const onlyTables = new Set(splitCsv(args['only'] as string | undefined));
  const onlyFromReport = (args['only-from-report'] as string | undefined) || undefined;
  const extraSkips = new Set(splitCsv(args['skip'] as string | undefined));
  const dryRun = args['dry-run'] === true;
  const shouldContinue = args['continue'] !== false;
  const strictTypes = args['strict-types'] === true;
  const skipEmbeddings = args['skip-embeddings'] !== false;
  const reportLimit = Math.max(0, parseInt(String(args['report-limit'] || '50'), 10) || 50);
  const relaxNotNull = args['relax-not-null'] !== false;
  const fillMissingNotNull = args['fill-missing-not-null'] !== false;
  const dropCheckConstraints = args['drop-check-constraints'] !== false;
  const disableTriggers = args['disable-triggers'] !== false;

  if (databaseUrlArg) process.env.DATABASE_URL = databaseUrlArg;
  process.env.DB_TYPE = 'postgres';

  const sqlitePath =
    sqlitePathArg ||
    process.env.SQLITE_PATH ||
    path.resolve(__dirname, '../../data/dev/consultinity.db');

  const databaseUrl = process.env.DATABASE_URL;
  if (
    !databaseUrl ||
    !(databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
  ) {
    throw new Error(
      'DATABASE_URL must be set to a PostgreSQL connection string (postgres:// or postgresql://).'
    );
  }

  const target = new URL(databaseUrl);
  logger.info('[transfer] Starting SQLite → Postgres transfer');
  logger.info(`[transfer] Source SQLite: ${sqlitePath}`);
  logger.info(
    `[transfer] Target Postgres: ${target.hostname}:${target.port || '5432'}/${target.pathname.slice(1)}`
  );

  const defaultSkips = new Set(['schema_migrations']);
  const skipTables = new Set([...defaultSkips, ...extraSkips]);

  const sqlite = await openSqlite(sqlitePath);
  try {
    const pg = await getDatabaseAsync();

    const allTables = (await getSqliteTables(sqlite)).filter((t) => !skipTables.has(t));
    let tables = onlyTables.size ? allTables.filter((t) => onlyTables.has(t)) : allTables;

    if (onlyFromReport) {
      try {
        const raw = fs.readFileSync(onlyFromReport, 'utf-8');
        const reportJson = JSON.parse(raw) as any;
        const badTables = new Set<string>(
          (reportJson?.tables || [])
            .filter((x: any) => Number(x?.failedRows || 0) > 0 || Number(x?.skippedRows || 0) > 0)
            .map((x: any) => String(x?.table || ''))
            .filter(Boolean)
        );
        tables = allTables.filter((t) => badTables.has(t));
        logger.info(`[transfer] only-from-report enabled; retry tables: ${tables.length}`);
      } catch (e: any) {
        throw new Error(`Failed to read --only-from-report: ${e?.message || e}`);
      }
    }

    const deps = new Map<string, Set<string>>();
    for (const t of tables) {
      const d = await getSqliteForeignKeyDeps(sqlite, t);
      deps.set(t, new Set(d.filter((x) => tables.includes(x) && x !== t)));
    }

    const ordered = topoSortTables(tables, deps);

    logger.info(`[transfer] Tables to transfer: ${ordered.length}`);
    if (dryRun) {
      logger.info('[transfer] dry-run enabled; exiting without writes.');
      logger.info(`[transfer] Order: ${ordered.join(', ')}`);
      return;
    }

    type TableError = { message: string; sampleRow?: Record<string, unknown> };
    type TableReport = {
      table: string;
      totalRows: number;
      insertedRows: number;
      attemptedRows: number;
      skippedRows: number;
      failedRows: number;
      ignoredColumns: string[];
      relaxedNotNullColumns: string[];
      droppedConstraints: string[];
      errors: TableError[];
      durationMs: number;
      status: 'success' | 'failed' | 'skipped';
    };

    const report: {
      generatedAt: string;
      sourceSqlite: string;
      targetHost: string;
      targetDb: string;
      options: {
        batchSize: number;
        strictTypes: boolean;
        skipEmbeddings: boolean;
        reportLimit: number;
      };
      tables: TableReport[];
      summary: {
        tablesPlanned: number;
        tablesSucceeded: number;
        tablesFailed: number;
        tablesSkipped: number;
      };
    } = {
      generatedAt: new Date().toISOString(),
      sourceSqlite: sqlitePath,
      targetHost: target.hostname,
      targetDb: target.pathname.slice(1),
      options: { batchSize, strictTypes, skipEmbeddings, reportLimit },
      tables: [],
      summary: {
        tablesPlanned: ordered.length,
        tablesSucceeded: 0,
        tablesFailed: 0,
        tablesSkipped: 0,
      },
    };

    // Disable FK triggers during import (best-effort)
    let allPgTables: string[] = [];
    if (disableTriggers) {
      try {
        logger.info('[transfer] Disabling triggers on target tables...');
        const res = await pg.query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
        );
        allPgTables = (res.rows || []).map((r) => r.tablename).filter(Boolean);
        for (const t of allPgTables) {
          try {
            await pg.query(`ALTER TABLE ${quoteIdent(t)} DISABLE TRIGGER ALL`);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    for (const table of ordered) {
      const startedAt = Date.now();
      const tableReport: TableReport = {
        table,
        totalRows: 0,
        insertedRows: 0,
        attemptedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        ignoredColumns: [],
        relaxedNotNullColumns: [],
        droppedConstraints: [],
        errors: [],
        durationMs: 0,
        status: 'failed',
      };
      const extractCheckConstraintName = (msg: string): string | null => {
        const m = msg.match(/violates check constraint \"([^\"]+)\"/i);
        return m?.[1] ? String(m[1]) : null;
      };

      const dropConstraint = async (constraintName: string) => {
        try {
          await pg.query(
            `ALTER TABLE ${quoteIdent(table)} DROP CONSTRAINT ${quoteIdent(constraintName)}`
          );
          if (!tableReport.droppedConstraints.includes(constraintName)) {
            tableReport.droppedConstraints.push(constraintName);
          }
          return true;
        } catch {
          return false;
        }
      };

      const fillNotNullFallback = (v: unknown, pgCol: PgColumn | undefined): unknown => {
        if (!fillMissingNotNull || !pgCol) return v;
        if (v !== null && v !== undefined && v !== '') return v;

        const notNull = String(pgCol.is_nullable || '').toUpperCase() === 'NO';
        if (!notNull) return v;

        const dt = String(pgCol.data_type || '').toLowerCase();
        if (dt === 'boolean') return false;
        if (
          dt === 'integer' ||
          dt === 'bigint' ||
          dt === 'numeric' ||
          dt === 'real' ||
          dt === 'double precision'
        )
          return 0;
        if (dt === 'json' || dt === 'jsonb') return '{}';
        if (dt === 'time' || dt === 'time without time zone') return '00:00:00';
        if (dt.includes('timestamp')) return new Date().toISOString();
        if (dt === 'date') return new Date().toISOString().slice(0, 10);
        if (dt === 'uuid') return crypto.randomUUID();
        // TEXT + everything else: generate stable-ish placeholder
        return crypto.randomUUID();
      };
      try {
        const exists = await pgHasTable(pg, table);
        if (!exists) {
          logger.warn(`[transfer] Skipping ${table}: not present in target Postgres schema.`);
          tableReport.status = 'skipped';
          report.tables.push({ ...tableReport, durationMs: Date.now() - startedAt });
          report.summary.tablesSkipped++;
          continue;
        }

        const pgCols = await getPgColumns(pg, table);
        const pgColByName = new Map(pgCols.map((c) => [c.column_name, c] as const));
        const sqliteCols = await getSqliteColumns(sqlite, table);
        let cols = sqliteCols.filter((c) => pgColByName.has(c));

        if (skipEmbeddings) {
          const ignored: string[] = [];
          cols = cols.filter((c) => {
            const col = pgColByName.get(c);
            const name = c.toLowerCase();
            if (name === 'embedding' || name.endsWith('_embedding')) {
              ignored.push(c);
              return false;
            }
            if (col?.data_type === 'USER-DEFINED' && col?.udt_name === 'vector') {
              ignored.push(c);
              return false;
            }
            return true;
          });
          tableReport.ignoredColumns = ignored;
        }

        if (cols.length === 0) {
          logger.warn(`[transfer] Skipping ${table}: no common columns.`);
          tableReport.status = 'skipped';
          report.tables.push({ ...tableReport, durationMs: Date.now() - startedAt });
          report.summary.tablesSkipped++;
          continue;
        }

        // If Postgres has SERIAL/IDENTITY columns but SQLite stores non-numeric IDs (e.g., UUID strings),
        // omit those columns so Postgres can use its default (nextval).
        const isNumericLike = (v: unknown): boolean => {
          if (typeof v === 'number') return Number.isFinite(v);
          if (typeof v !== 'string') return false;
          const s = v.trim();
          if (!s) return false;
          return /^-?\d+$/.test(s);
        };

        const serialCols = cols.filter((c) => {
          const pgCol = pgColByName.get(c);
          return (
            Boolean(pgCol?.column_default) && String(pgCol?.column_default).includes('nextval(')
          );
        });
        for (const sc of serialCols) {
          // sample up to 5 non-null values from SQLite
          const sample = await sqliteAll<Record<string, unknown>>(
            sqlite,
            `SELECT ${quoteIdent(sc)} AS v FROM ${quoteIdent(table)} WHERE ${quoteIdent(sc)} IS NOT NULL LIMIT 5`
          );
          const nonNumeric = sample.some((r) => !isNumericLike((r as any).v));
          if (nonNumeric) {
            cols = cols.filter((c) => c !== sc);
          }
        }

        // If Postgres table has NOT NULL columns with no defaults that are NOT present in SQLite,
        // inserts that omit those columns will fail. Relax them for the import.
        if (relaxNotNull) {
          const missingRequired = pgCols.filter((c) => {
            const notNull = String(c.is_nullable || '').toUpperCase() === 'NO';
            const hasDefault = Boolean(c.column_default);
            const presentInImport = cols.includes(c.column_name);
            return notNull && !hasDefault && !presentInImport;
          });
          for (const c of missingRequired) {
            try {
              await pg.query(
                `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(c.column_name)} DROP NOT NULL`
              );
              tableReport.relaxedNotNullColumns.push(c.column_name);
            } catch {
              // If we can't relax (e.g. PK), add as synthetic import column and fill via fallback.
              if (!cols.includes(c.column_name)) cols.push(c.column_name);
            }
          }
        }

        const totalRow = await sqliteGet<{ count: number }>(
          sqlite,
          `SELECT COUNT(*) as count FROM ${quoteIdent(table)}`
        );
        const total = totalRow?.count || 0;
        tableReport.totalRows = total;
        logger.info(`[transfer] ${table}: ${total} rows, ${cols.length} columns`);
        if (total === 0) continue;

        const quotedCols = cols.map(quoteIdent).join(', ');
        let offset = 0;
        await pg.query('BEGIN');
        while (offset < total) {
          const rows = await sqliteAll<Record<string, unknown>>(
            sqlite,
            `SELECT ${quotedCols} FROM ${quoteIdent(table)} LIMIT ? OFFSET ?`,
            [batchSize, offset]
          );
          offset += rows.length;
          if (rows.length === 0) break;

          const buildInsert = (batchRows: Record<string, unknown>[]) => {
            const values: unknown[] = [];
            const tuples: string[] = [];
            const rowValues: unknown[][] = [];
            const rowErrors: string[][] = [];
            const keptRows: Record<string, unknown>[] = [];
            const skipped: Array<{ row: Record<string, unknown>; reason: string }> = [];

            for (const row of batchRows) {
              // Skip rows where we would explicitly insert NULL into SERIAL/IDENTITY columns
              // (would bypass defaults and violate NOT NULL). These are usually data issues.
              let shouldSkipRow = false;
              for (const col of cols) {
                const pgCol = pgColByName.get(col);
                if (!pgCol) continue;
                const isSerial =
                  Boolean(pgCol.column_default) &&
                  String(pgCol.column_default).includes('nextval(');
                const v = (row as any)[col];
                if (isSerial && (v === null || v === undefined || v === '')) {
                  shouldSkipRow = true;
                  break;
                }
              }
              if (shouldSkipRow) {
                skipped.push({ row, reason: 'null serial/identity column value' });
                continue;
              }

              const placeholders: string[] = [];
              const oneRowValues: unknown[] = [];
              const oneRowErrors: string[] = [];
              for (const col of cols) {
                const res = coerceValue((row as any)[col], pgColByName.get(col));
                oneRowValues.push(fillNotNullFallback(res.value, pgColByName.get(col)));
                if (res.error) oneRowErrors.push(`${col}: ${res.error}`);
              }
              for (const v of oneRowValues) {
                values.push(v);
                placeholders.push(`$${values.length}`);
              }
              tuples.push(`(${placeholders.join(', ')})`);
              rowValues.push(oneRowValues);
              rowErrors.push(oneRowErrors);
              keptRows.push(row);
            }

            const sql = `INSERT INTO ${quoteIdent(table)} (${quotedCols}) VALUES ${tuples.join(
              ', '
            )} ON CONFLICT DO NOTHING`;
            return { sql, values, rowValues, rowErrors, keptRows, skipped };
          };

          const { sql, values, rowValues, rowErrors, keptRows, skipped } = buildInsert(rows);

          for (const s of skipped) {
            tableReport.skippedRows++;
            if (tableReport.errors.length < reportLimit) {
              tableReport.errors.push({ message: `skipped: ${s.reason}`, sampleRow: s.row });
            }
          }

          // Track type coercion issues (optional strict mode)
          for (let i = 0; i < rowErrors.length; i++) {
            if (rowErrors[i].length === 0) continue;
            tableReport.skippedRows++;
            if (tableReport.errors.length < reportLimit) {
              tableReport.errors.push({
                message: `coercion: ${rowErrors[i].join('; ')}`,
                sampleRow: keptRows[i],
              });
            }
            if (strictTypes) {
              throw new Error(`Type coercion error in ${table}: ${rowErrors[i].join('; ')}`);
            }
          }

          try {
            if (keptRows.length === 0) continue;
            let res;
            try {
              res = await pg.query(sql, values);
            } catch (e: any) {
              const msg = e?.message || String(e);
              const cname = dropCheckConstraints ? extractCheckConstraintName(msg) : null;
              if (cname && (await dropConstraint(cname))) {
                res = await pg.query(sql, values);
              } else {
                throw e;
              }
            }
            tableReport.attemptedRows += keptRows.length;
            tableReport.insertedRows += Number(res?.rowCount || 0);
          } catch (bulkErr: any) {
            // fallback: row-by-row to isolate failures
            const msg = bulkErr?.message || String(bulkErr);
            logger.warn(
              `[transfer] ${table}: bulk insert failed, falling back to row-by-row. Reason: ${msg}`
            );

            for (let i = 0; i < keptRows.length; i++) {
              const oneRowValues = rowValues[i];
              const placeholders = oneRowValues.map((_v, idx) => `$${idx + 1}`).join(', ');
              const oneSql = `INSERT INTO ${quoteIdent(table)} (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
              tableReport.attemptedRows++;
              try {
                let r;
                try {
                  r = await pg.query(oneSql, oneRowValues);
                } catch (e: any) {
                  const msg = e?.message || String(e);
                  const cname = dropCheckConstraints ? extractCheckConstraintName(msg) : null;
                  if (cname && (await dropConstraint(cname))) {
                    r = await pg.query(oneSql, oneRowValues);
                  } else {
                    throw e;
                  }
                }
                tableReport.insertedRows += Number(r?.rowCount || 0);
              } catch (rowErr: any) {
                tableReport.failedRows++;
                if (tableReport.errors.length < reportLimit) {
                  tableReport.errors.push({
                    message: rowErr?.message || String(rowErr),
                    sampleRow: keptRows[i],
                  });
                }
                if (!shouldContinue) {
                  throw rowErr;
                }
              }
            }
          }
        }

        await resetPgSequences(pg, table);
        await pg.query('COMMIT');
        tableReport.status = 'success';
        report.summary.tablesSucceeded++;
      } catch (tableError: any) {
        const msg = tableError?.message || String(tableError);
        logger.error(`[transfer] Failed to transfer ${table}: ${msg}`);
        try {
          await pg.query('ROLLBACK');
        } catch {
          // ignore
        }
        tableReport.status = 'failed';
        report.summary.tablesFailed++;
        if (tableReport.errors.length < reportLimit) tableReport.errors.push({ message: msg });
        if (!shouldContinue) throw tableError;
      } finally {
        tableReport.durationMs = Date.now() - startedAt;
        report.tables.push(tableReport);
      }
    }

    if (disableTriggers && allPgTables.length) {
      try {
        logger.info('[transfer] Re-enabling triggers on target tables...');
        for (const t of allPgTables) {
          try {
            await pg.query(`ALTER TABLE ${quoteIdent(t)} ENABLE TRIGGER ALL`);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    report.summary.tablesSkipped = report.tables.filter((t) => t.status === 'skipped').length;

    const outDir = path.resolve(process.cwd(), 'server/exports');
    fs.mkdirSync(outDir, { recursive: true });
    const reportPath = path.join(outDir, `transfer-report-sqlite-to-pg-${nowStamp()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    logger.info(
      `[transfer] Completed. ok=${report.summary.tablesSucceeded} failed=${report.summary.tablesFailed} skipped=${report.summary.tablesSkipped}`
    );
    logger.info(`[transfer] Report: ${reportPath}`);
  } finally {
    await new Promise<void>((resolve) => sqlite.close(() => resolve()));
  }
}

main().catch((e) => {
  logger.error('[transfer] Failed:', (e as any)?.message || e);
  process.exit(1);
});
