#!/usr/bin/env tsx
/**
 * Schema sync: SQLite -> Postgres (create missing tables)
 *
 * Goal:
 * - Ensure Postgres has (at least) all tables that exist in SQLite so ETL does not skip them.
 * - Translate SQLite DDL conservatively (types + basic defaults). Avoid destructive changes.
 *
 * Usage:
 *   SQLITE_PATH=./data/dev/consultinity.db DB_TYPE=postgres DATABASE_URL="postgresql://..." \
 *     tsx server/scripts/schema-sync-sqlite-to-postgres.ts --mode create
 *
 * Options:
 *   --mode <create|create+indexes|create+fks|all>   default create
 *   --only <t1,t2,...>                              restrict to tables
 *   --skip <t1,t2,...>                              skip tables
 *   --dry-run                                      print plan only
 *
 * Notes:
 * - This does NOT drop/rename anything.
 * - Foreign keys are added as NOT VALID to avoid long locks; you can validate later.
 */

import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

type Sqlite3Module = {
  verbose?: () => any;
  Database: new (filename: string, cb: (err: unknown) => void) => any;
};

type SqliteDb = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: any[]) => void) => void;
  get: (sql: string, params: unknown[], cb: (err: Error | null, row: any) => void) => void;
  close: (cb: (err: Error | null) => void) => void;
};

type Mode = 'create' | 'create+indexes' | 'create+fks' | 'all';

// Avoid crashing when output is piped and the reader closes early (e.g. `| head`)
process.stdout.on('error', (err: any) => {
  if (err?.code === 'EPIPE') process.exit(0);
});

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
      args[key] = value;
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

async function openSqlite(sqlitePath: string) {
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
  const all = <T = any>(sql: string, params: unknown[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows as T[]) || []);
      });
    });
  const get = <T = any>(sql: string, params: unknown[] = []) =>
    new Promise<T | null>((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  const close = () => new Promise<void>((resolve) => db.close(() => resolve()));
  return { db, all, get, close };
}

function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function splitTopLevelCommaList(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      buf += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      buf += ch;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        const part = buf.trim();
        if (part) out.push(part);
        buf = '';
        continue;
      }
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

function stripSqlComments(input: string): string {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      // line comment --
      if (ch === '-' && next === '-') {
        // skip until newline
        i += 1;
        while (i + 1 < input.length && input[i + 1] !== '\n') i++;
        continue;
      }
      // block comment /* ... */
      if (ch === '/' && next === '*') {
        i += 1;
        while (i + 1 < input.length) {
          if (input[i] === '*' && input[i + 1] === '/') {
            i += 1;
            break;
          }
          i++;
        }
        continue;
      }
    }

    out += ch;
  }
  return out;
}

function mapSqliteTypeToPg(sqliteTypeRaw: string): string {
  const t = sqliteTypeRaw.trim().toUpperCase();
  if (!t) return 'TEXT';

  // SQLite "array" annotations like INTEGER[] are stored as text/JSON in practice.
  if (t.includes('[') || t.includes(']')) return 'TEXT';

  // affinity-based mapping
  if (t.includes('INT')) return 'BIGINT';
  if (t.includes('CHAR') || t.includes('CLOB') || t.includes('TEXT')) return 'TEXT';
  if (t.includes('BLOB')) return 'BYTEA';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'DOUBLE PRECISION';
  if (t.includes('NUM') || t.includes('DEC')) return 'NUMERIC';
  if (t.includes('BOOL')) return 'BOOLEAN';
  if (t === 'TIME' || t.endsWith(' TIME')) return 'TIME';
  if (t.includes('DATE') && !t.includes('DATETIME')) return 'DATE';
  if (t.includes('DATETIME') || t.includes('TIMESTAMP')) return 'TIMESTAMPTZ';

  return 'TEXT';
}

function normalizeDefault(expr: string, pgType: string): string | null {
  let e = expr.trim();
  // remove surrounding parentheses
  if (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim();

  // SQLite-only random/id generators (best-effort: drop the default)
  // e.g. lower(hex(randomblob(16)))
  if (/randomblob\s*\(/i.test(e) || /\bhex\s*\(/i.test(e) || /\bstrftime\s*\(/i.test(e)) {
    return null;
  }

  // sqlite date/time helpers
  e = e.replace(/datetime\(['"]now['"]\)/gi, 'NOW()');
  e = e.replace(/CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP');

  // boolean-ish
  if (pgType.toUpperCase() === 'BOOLEAN') {
    if (e === '1') return 'TRUE';
    if (e === '0') return 'FALSE';
  }

  return e;
}

function translateCreateTableSql(sql: string): {
  tableName: string;
  createSql: string;
  fks: string[];
} {
  // very small DDL translator: enough for common SQLite CREATE TABLEs
  const cleanedSql = stripSqlComments(sql);
  const m = cleanedSql.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(.+?)\s*\(([\s\S]*)\)\s*;?\s*$/i
  );
  if (!m) throw new Error('Unsupported CREATE TABLE SQL shape');
  const rawName = stripOuterQuotes(m[1] || '');
  const body = m[2] || '';

  const tableName = rawName.replace(/^public\./i, '');

  const parts = splitTopLevelCommaList(body);
  const colsAndConstraints: string[] = [];
  const fkConstraints: string[] = [];

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;

    const upper = p.toUpperCase();
    if (upper.startsWith('CONSTRAINT')) {
      // Table constraint: keep UNIQUE/PK/CHECK; defer only FOREIGN KEY
      if (upper.includes('FOREIGN KEY')) {
        fkConstraints.push(p);
      } else {
        // Conservative: keep only PRIMARY KEY constraints, drop UNIQUE/CHECK (identifier quoting differences can break PG)
        if (upper.includes('PRIMARY KEY')) {
          colsAndConstraints.push(
            p
              .replace(/\bAUTOINCREMENT\b/gi, '')
              .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ')
              .replace(/\bCOLLATE\b\s+\w+/gi, '')
              .trim()
          );
        }
      }
      continue;
    }
    if (upper.startsWith('FOREIGN KEY')) {
      // defer FK creation to second pass
      fkConstraints.push(p);
      continue;
    }
    if (
      upper.includes('REFERENCES') &&
      (upper.startsWith('CONSTRAINT') || upper.startsWith('FOREIGN'))
    ) {
      fkConstraints.push(p);
      continue;
    }
    if (upper.startsWith('CONSTRAINT') && upper.includes('FOREIGN KEY')) {
      fkConstraints.push(p);
      continue;
    }

    // table constraints we keep: PRIMARY KEY only (drop UNIQUE/CHECK for compatibility)
    if (upper.startsWith('PRIMARY KEY')) {
      colsAndConstraints.push(p.replace(/\bAUTOINCREMENT\b/gi, ''));
      continue;
    }
    if (upper.startsWith('UNIQUE') || upper.startsWith('CHECK')) {
      continue;
    }

    // column definition
    // format: name [TYPE...] [constraints...]
    // tokenize while keeping quoted identifiers intact
    const tokens = p.match(/"[^"]*"|'[^']*'|[^\s]+/g) || [];
    const colName = stripOuterQuotes(tokens[0] || '');
    const restTokens = tokens.slice(1);

    const constraintStart = (tok: string) =>
      /^(PRIMARY|NOT|NULL|DEFAULT|UNIQUE|CHECK|COLLATE|REFERENCES|CONSTRAINT)$/i.test(tok);

    const typeTokens: string[] = [];
    for (const tok of restTokens) {
      if (constraintStart(tok)) break;
      typeTokens.push(tok);
    }
    const sqliteTypeRaw = typeTokens.join(' ');
    const remainderTokens = restTokens.slice(typeTokens.length);

    let remainder = remainderTokens.join(' ').trim();
    let pgType = sqliteTypeRaw ? mapSqliteTypeToPg(sqliteTypeRaw) : 'TEXT';

    // AUTOINCREMENT / INTEGER PRIMARY KEY special-case
    if (
      /\bPRIMARY\s+KEY\b/i.test(remainder) &&
      (/\bAUTOINCREMENT\b/i.test(p) ||
        /\bINTEGER\b/i.test(sqliteTypeRaw) ||
        /\bINT\b/i.test(sqliteTypeRaw))
    ) {
      // use identity-ish type
      pgType = 'BIGSERIAL';
      remainder = remainder.replace(/\bAUTOINCREMENT\b/gi, '');
    }

    // Remove SQLite-only clauses
    remainder = remainder.replace(/\bCOLLATE\b\s+\w+/gi, '');
    remainder = remainder.replace(/\bWITHOUT\s+ROWID\b/gi, '');

    // DATETIME -> TIMESTAMPTZ in-line types
    remainder = remainder.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

    // Conservative constraint cleanup for Postgres compatibility
    remainder = remainder.replace(/\bUNIQUE\b/gi, '');
    // CHECK(...) may contain nested parentheses; drop from CHECK to end safely.
    remainder = remainder.replace(/\bCHECK\b[\s\S]*$/gi, '');

    // Heuristic: JSON-ish defaults in SQLite often live in "integer" typed columns.
    // Postgres will reject DEFAULT '[]' on BIGINT, so force TEXT.
    if (/\bDEFAULT\s+'(\[\]|\{\})'\s*$/i.test(remainder)) {
      const pt = pgType.toUpperCase();
      if (pt === 'BIGINT' || pt === 'INTEGER' || pt === 'NUMERIC' || pt === 'DOUBLE PRECISION') {
        pgType = 'TEXT';
      }
    }

    // DEFAULT normalization (drop SQLite-only defaults)
    remainder = remainder.replace(/\bDEFAULT\b\s+(.+)$/i, (_m2, defExpr) => {
      const norm = normalizeDefault(String(defExpr), pgType);
      return norm ? `DEFAULT ${norm}` : '';
    });

    // Drop inline REFERENCES for first pass (FKs later)
    remainder = remainder.replace(/\bREFERENCES\b[\s\S]*$/i, '').trim();

    const colSql =
      `${quoteIdent(colName)} ${pgType}${remainder ? ' ' + remainder.trim() : ''}`.trim();
    colsAndConstraints.push(colSql);
  }

  const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (\n  ${colsAndConstraints.join(
    ',\n  '
  )}\n);`;

  return { tableName, createSql, fks: fkConstraints };
}

async function pgHasTable(pool: Pool, table: string): Promise<boolean> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return Number(res.rows?.[0]?.count || 0) > 0;
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const mode = String(args.mode || 'create') as Mode;
  const dryRun = args['dry-run'] === true;
  const verbose = args.verbose === true;

  const sqlitePath =
    (args['sqlite-path'] as string | undefined) ||
    (process.env.SQLITE_PATH as string | undefined) ||
    path.resolve(process.cwd(), 'data/dev/consultinity.db');
  const databaseUrl = (args['database-url'] as string | undefined) || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const only = new Set(splitCsv(args.only as string | undefined));
  const skip = new Set(['schema_migrations', ...splitCsv(args.skip as string | undefined)]);

  const sqlite = await openSqlite(sqlitePath);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const tableRows = await sqlite.all<{ name: string; sql: string | null }>(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const tables = (tableRows || [])
      .map((r) => ({ name: String(r.name), sql: r.sql }))
      .filter((r) => r.name && !skip.has(r.name))
      .filter((r) => (only.size ? only.has(r.name) : true));

    let createPlanned = 0;
    const createdTables: string[] = [];
    const fkPlan: Array<{ table: string; fkSql: string }> = [];
    const indexPlan: Array<{ table: string; sql: string }> = [];

    for (const t of tables) {
      const exists = await pgHasTable(pool, t.name);
      if (exists) continue;
      if (!t.sql) continue;
      const translated = translateCreateTableSql(t.sql);
      createPlanned++;
      createdTables.push(translated.tableName);
      if (!dryRun) {
        try {
          await pool.query(translated.createSql);
        } catch (e: any) {
          console.error(`❌ Failed creating table: ${translated.tableName}`);
          console.error(translated.createSql);
          throw e;
        }
      }

      // collect FKs for second pass
      for (const fk of translated.fks) {
        fkPlan.push({ table: translated.tableName, fkSql: fk });
      }
    }

    if (mode === 'create+indexes' || mode === 'all') {
      const idxRows = await sqlite.all<{ name: string; tbl_name: string; sql: string | null }>(
        "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"
      );
      for (const idx of idxRows || []) {
        const table = String(idx.tbl_name || '');
        if (!table || skip.has(table)) continue;
        if (only.size && !only.has(table)) continue;
        const sql = String(idx.sql || '').trim();
        if (!sql) continue;
        // best-effort: most CREATE INDEX statements are compatible; map IF NOT EXISTS
        const pgSql = sql
          .replace(/CREATE\s+UNIQUE\s+INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
          .replace(/CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ')
          .replace(/\bON\s+["']?(\w+)["']?\b/i, (_m, tn) => `ON ${quoteIdent(tn)}`)
          .replace(/\bCOLLATE\b\s+\w+/gi, '');
        indexPlan.push({ table, sql: pgSql.endsWith(';') ? pgSql : pgSql + ';' });
      }

      if (dryRun) {
        console.log(`-- would create indexes: ${indexPlan.length}`);
      } else {
        for (const i of indexPlan) {
          try {
            await pool.query(i.sql);
          } catch {
            // ignore incompatible indexes; ETL still works
          }
        }
      }
    }

    if (mode === 'create+fks' || mode === 'all') {
      // second pass: FKs from SQLite pragmas (more reliable than parsing SQL fragments)
      for (const t of tables) {
        const fkRows = await sqlite.all<any>(`PRAGMA foreign_key_list(${t.name})`);
        for (const fk of fkRows || []) {
          const from = String(fk.from || '');
          const refTable = String(fk.table || '');
          const to = String(fk.to || '');
          if (!from || !refTable || !to) continue;
          if (skip.has(refTable)) continue;
          // only add if referenced table exists
          const refExists = await pgHasTable(pool, refTable);
          if (!refExists) continue;

          const cname = `fk_${t.name}_${from}__${refTable}_${to}`.slice(0, 55);
          const fkSql = `ALTER TABLE ${quoteIdent(t.name)}
            ADD CONSTRAINT ${quoteIdent(cname)}
            FOREIGN KEY (${quoteIdent(from)}) REFERENCES ${quoteIdent(refTable)}(${quoteIdent(to)})
            NOT VALID;`;
          fkPlan.push({ table: t.name, fkSql });
        }
      }

      if (dryRun) {
        console.log(`-- would add FKs: ${fkPlan.length}`);
      } else {
        for (const f of fkPlan) {
          try {
            await pool.query(f.fkSql);
          } catch {
            // ignore; FKs are best-effort
          }
        }
      }
    }

    if (dryRun) {
      const preview = createdTables.slice(0, 50);
      console.log(`-- would create tables: ${createPlanned}`);
      if (verbose) {
        for (const t of preview) console.log(`-- would create: ${t}`);
        if (createdTables.length > preview.length)
          console.log(`-- ... +${createdTables.length - preview.length} more`);
      }
    }

    console.log(
      `✅ schema-sync complete. createPlanned=${createPlanned} mode=${mode} dryRun=${dryRun}`
    );
  } finally {
    await pool.end();
    await sqlite.close();
  }
}

main().catch((e) => {
  console.error('❌ schema-sync failed:', e?.message || e);
  process.exit(1);
});
