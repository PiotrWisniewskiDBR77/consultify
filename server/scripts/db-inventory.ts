#!/usr/bin/env tsx
/**
 * DB Inventory (SQLite + Postgres)
 *
 * Purpose:
 * - Produce a machine-readable snapshot of schema + table row counts
 * - Use it to validate migration parity before cutover
 *
 * Output:
 * - Writes JSON files under server/exports/ (gitignored)
 *
 * Usage (repo root):
 *   SQLITE_PATH=./data/dev/consultinity.db tsx server/scripts/db-inventory.ts --mode sqlite
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/db-inventory.ts --mode postgres
 *   SQLITE_PATH=./data/dev/consultinity.db DATABASE_URL="postgresql://..." tsx server/scripts/db-inventory.ts --mode both
 *
 * Options:
 *   --mode <sqlite|postgres|both>   default both
 *   --counts <exact|estimate|none>  default exact
 *   --sqlite <path>                override SQLITE_PATH
 *   --database-url <url>           override DATABASE_URL
 *   --tables <t1,t2,...>           restrict inventory to these tables
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

type CountsMode = 'exact' | 'estimate' | 'none';
type Mode = 'sqlite' | 'postgres' | 'both';

type ColumnInfo = {
  name: string;
  type?: string;
  notnull?: number | boolean;
  dflt_value?: string | null;
};

type ForeignKeyInfo = {
  table: string;
  from: string;
  to: string;
  on_update?: string;
  on_delete?: string;
};

type TableInventory = {
  table: string;
  rowCount?: number;
  estimatedRowCount?: number;
  columns: ColumnInfo[];
  foreignKeys?: ForeignKeyInfo[];
};

type Inventory = {
  engine: 'sqlite' | 'postgres';
  generatedAt: string;
  countsMode: CountsMode;
  tables: TableInventory[];
};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = 'true';
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

async function openSqlite(sqlitePath: string) {
  const sqlite3Mod: any = await import('sqlite3').then((m: any) => (m?.default ? m.default : m));
  const sqlite3 = sqlite3Mod?.verbose ? sqlite3Mod.verbose() : sqlite3Mod;
  const db = await new Promise<any>((resolve, reject) => {
    const handle = new sqlite3.Database(sqlitePath, (err: any) => {
      if (err) reject(err);
      else resolve(handle);
    });
  });

  const all = (sql: string, params: any[] = []) =>
    new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

  const get = (sql: string, params: any[] = []) =>
    new Promise<any>((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });

  const close = () => new Promise<void>((resolve) => db.close(() => resolve()));

  return { db, all, get, close };
}

async function sqliteInventory(opts: {
  sqlitePath: string;
  countsMode: CountsMode;
  onlyTables?: Set<string>;
}): Promise<Inventory> {
  const { sqlitePath, countsMode, onlyTables } = opts;
  const sqlite = await openSqlite(sqlitePath);
  try {
    const tableRows = await sqlite.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tables = (tableRows || [])
      .map((r: any) => String(r.name))
      .filter(Boolean)
      .filter((t) => (onlyTables?.size ? onlyTables.has(t) : true));

    const out: TableInventory[] = [];
    for (const t of tables) {
      const columns = (await sqlite.all(`PRAGMA table_info(${t})`)).map((c: any) => ({
        name: String(c.name),
        type: c.type,
        notnull: c.notnull,
        dflt_value: c.dflt_value ?? null,
      }));

      const foreignKeys = (await sqlite.all(`PRAGMA foreign_key_list(${t})`)).map((fk: any) => ({
        table: String(fk.table),
        from: String(fk.from),
        to: String(fk.to),
        on_update: fk.on_update,
        on_delete: fk.on_delete,
      }));

      let rowCount: number | undefined;
      if (countsMode === 'exact') {
        const row = await sqlite.get(`SELECT COUNT(*) as count FROM ${t}`);
        rowCount = Number(row?.count || 0);
      }

      out.push({
        table: t,
        rowCount,
        columns,
        foreignKeys,
      });
    }

    return {
      engine: 'sqlite',
      generatedAt: new Date().toISOString(),
      countsMode,
      tables: out,
    };
  } finally {
    await sqlite.close();
  }
}

async function postgresInventory(opts: {
  databaseUrl: string;
  countsMode: CountsMode;
  onlyTables?: Set<string>;
}): Promise<Inventory> {
  const { databaseUrl, countsMode, onlyTables } = opts;
  const pg: any = await import('pg');
  const { Pool } = pg.default || pg;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const tablesRes = await pool.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );
    const tables = (tablesRes.rows || [])
      .map((r: any) => String(r.tablename))
      .filter(Boolean)
      .filter((t: string) => (onlyTables?.size ? onlyTables.has(t) : true));

    const out: TableInventory[] = [];
    for (const t of tables) {
      const colsRes = await pool.query(
        `SELECT column_name as name, data_type as type, is_nullable, column_default as dflt_value
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [t]
      );
      const columns = (colsRes.rows || []).map((c: any) => ({
        name: String(c.name),
        type: c.type,
        notnull: c.is_nullable === 'NO',
        dflt_value: c.dflt_value ?? null,
      }));

      let rowCount: number | undefined;
      let estimatedRowCount: number | undefined;

      if (countsMode === 'exact') {
        const r = await pool.query(`SELECT COUNT(*)::text as cnt FROM "${t}"`);
        rowCount = Number(r.rows?.[0]?.cnt || 0);
      } else if (countsMode === 'estimate') {
        const r = await pool.query(
          `SELECT COALESCE(reltuples::bigint, 0)::text as est
           FROM pg_class
           WHERE oid = $1::regclass`,
          [`public."${t}"`]
        );
        estimatedRowCount = Number(r.rows?.[0]?.est || 0);
      }

      out.push({
        table: t,
        rowCount,
        estimatedRowCount,
        columns,
      });
    }

    return {
      engine: 'postgres',
      generatedAt: new Date().toISOString(),
      countsMode,
      tables: out,
    };
  } finally {
    await pool.end();
  }
}

function ensureExportsDir() {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filename: string, data: unknown) {
  const dir = ensureExportsDir();
  const full = path.join(dir, filename);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf-8');
  return full;
}

async function main() {
  // Load local env (gitignored) if present so DATABASE_URL/SQLITE_PATH can be picked up.
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const mode = (args.mode as Mode | undefined) || 'both';
  const countsMode = ((args.counts as CountsMode | undefined) || 'exact') as CountsMode;
  const sqlitePath = args.sqlite || process.env.SQLITE_PATH;
  const databaseUrl = args['database-url'] || process.env.DATABASE_URL;
  const onlyTablesList = splitCsv(args.tables);
  const onlyTables = onlyTablesList.length ? new Set(onlyTablesList) : undefined;

  const stamp = nowStamp();
  const written: string[] = [];

  if ((mode === 'sqlite' || mode === 'both') && !sqlitePath) {
    throw new Error('SQLITE_PATH is required for --mode sqlite/both (or pass --sqlite).');
  }
  if ((mode === 'postgres' || mode === 'both') && !databaseUrl) {
    throw new Error('DATABASE_URL is required for --mode postgres/both (or pass --database-url).');
  }

  if (mode === 'sqlite' || mode === 'both') {
    const inv = await sqliteInventory({ sqlitePath: sqlitePath!, countsMode, onlyTables });
    const p = writeJson(`inventory-sqlite-${stamp}.json`, inv);
    written.push(p);
  }
  if (mode === 'postgres' || mode === 'both') {
    const inv = await postgresInventory({ databaseUrl: databaseUrl!, countsMode, onlyTables });
    const p = writeJson(`inventory-postgres-${stamp}.json`, inv);
    written.push(p);
  }

  // eslint-disable-next-line no-console
  console.log('✅ Inventory written:');
  for (const p of written) console.log(`- ${p}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Inventory failed:', e?.message || e);
  process.exit(1);
});
